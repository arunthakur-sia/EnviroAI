// CR01 5.4: publishes reviewed knowledge items to their modules and awards points.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { newId, nowIso } from "@/lib/ids";
import { audit } from "@/server/auth/audit";
import { record } from "@/server/gamification/engine";
import { getAllTerms } from "@/server/services/taxonomy";
import { outcomeNodeMap, indexSignal } from "@/server/scan/extract";
import { enqueue } from "@/server/jobs/queue";

const Item = z.object({
  types: z.array(z.string()).min(1),
  title_en: z.string().default(""),
  title_ar: z.string().default(""),
  cleaned_en: z.string().default(""),
  cleaned_ar: z.string().default(""),
  lesson: z
    .object({
      context_en: z.string().default(""),
      context_ar: z.string().default(""),
      learning_en: z.string().default(""),
      learning_ar: z.string().default(""),
      recommendation_en: z.string().default(""),
      recommendation_ar: z.string().default(""),
    })
    .optional(),
  signal: z
    .object({
      publisher: z.string().default(""),
      signal_type: z.string().default("research"),
      impact: z.string().default("medium"),
      horizon: z.string().default("mid"),
      why_en: z.string().default(""),
      why_ar: z.string().default(""),
    })
    .optional(),
  decision: z
    .object({
      decision_en: z.string().default(""),
      decision_ar: z.string().default(""),
      rationale_en: z.string().default(""),
      rationale_ar: z.string().default(""),
    })
    .optional(),
  document: z
    .object({
      summary_en: z.string().default(""),
      summary_ar: z.string().default(""),
      key_facts: z.array(z.object({ text_en: z.string(), text_ar: z.string() })).default([]),
    })
    .optional(),
  expert: z
    .object({
      name_en: z.string().default(""),
      name_ar: z.string().default(""),
      organisation_en: z.string().default(""),
      organisation_ar: z.string().default(""),
      position_en: z.string().default(""),
      position_ar: z.string().default(""),
      email: z.string().default(""),
      domains: z.array(z.string()).default([]),
    })
    .optional(),
  category: z.string().nullable().optional(),
  node_link: z
    .object({
      id: z.string(),
      code: z.string().nullable(),
      title_en: z.string().default(""),
      title_ar: z.string().default(""),
    })
    .nullable()
    .optional(),
  topic_codes: z.array(z.string()).default([]),
  outcome_links: z
    .array(z.object({ code: z.string(), reason_en: z.string().default(""), reason_ar: z.string().default("") }))
    .default([]),
  indicator_codes: z.array(z.string()).default([]),
  classification_level: z.number().min(1).max(4).default(2),
  confidence: z.number().default(0.5),
  file_ref: z
    .object({
      storagePath: z.string(),
      filename: z.string(),
      mime: z.string(),
      sizeBytes: z.number(),
    })
    .nullable()
    .optional(),
  machine: z.boolean().optional(),
});

const Body = z.object({
  items: z.array(Item).min(1).max(12),
  whereFrom: z.string().default(""),
  /* CR02 5.2: the submission came through the Speak mode */
  voice: z.boolean().default(false),
  /* CR05 5.6.4: a knowledge capture session linked to a handover */
  handoverId: z.string().nullable().optional(),
  audioRef: z
    .object({
      storagePath: z.string(),
      filename: z.string(),
      mime: z.string(),
      sizeBytes: z.number(),
    })
    .nullable()
    .optional(),
});

const EVENT_HINT = /conference|forum|summit|workshop|external meeting|site visit|مؤتمر|منتدى|قمة|ورشة|اجتماع خارجي|زيارة/i;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "create", "lessons") && !can(user, "create", "vault")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  }
  const { items, whereFrom, voice, audioRef, handoverId } = parsed.data;
  // CR05 5.6.4: validate the handover once; capture rows are written per item
  let handover: typeof schema.handovers.$inferSelect | null = null;
  if (handoverId) {
    const rows = await db
      .select()
      .from(schema.handovers)
      .where(eq(schema.handovers.id, handoverId))
      .limit(1);
    handover = rows[0] ?? null;
  }
  const submissionId = newId();
  const terms = await getAllTerms();
  const termByCode = new Map(terms.map((t) => [`${t.dimension}:${t.code}`, t]));
  const nodeMap = await outcomeNodeMap();
  const indicators = await db
    .select({ id: schema.indicators.id, code: schema.indicators.code })
    .from(schema.indicators);
  const indByCode = new Map(indicators.map((i) => [i.code, i.id]));

  let totalPoints = 0;
  const published: { type: string; id: string }[] = [];

  const tagAndLink = async (resourceType: string, resourceId: string, item: z.infer<typeof Item>) => {
    for (const code of item.topic_codes.slice(0, 5)) {
      const term = termByCode.get(`topic:${code}`);
      if (!term) continue;
      await db.insert(schema.taggings).values({
        id: newId(),
        resourceType,
        resourceId,
        termId: term.id,
        source: "ai_confirmed",
        createdBy: user.id,
        createdAt: nowIso(),
      });
    }
    // provenance for the knowledge_verified rule
    await db.insert(schema.relations).values({
      id: newId(),
      fromType: "knowledge_submission",
      fromId: submissionId,
      toType: resourceType,
      toId: resourceId,
      relation: "derived_from",
      source: "human",
      createdAt: nowIso(),
    });
    // NES links with points per accepted link (cap 5 per item)
    for (const link of item.outcome_links.slice(0, 5)) {
      const nodeId = nodeMap.get(link.code);
      if (!nodeId) continue;
      await db.insert(schema.relations).values({
        id: newId(),
        fromType: resourceType,
        fromId: resourceId,
        toType: "node",
        toId: nodeId,
        relation: "about_node",
        source: "human",
        confidence: item.confidence,
        createdAt: nowIso(),
      });
      const game = await record({
        userId: user.id,
        type: "knowledge_linked_to_nes",
        resourceType,
        resourceId: `${resourceId}:${link.code}`,
        meta: { departmentId: user.departmentId },
      });
      totalPoints += game.points;
    }
    for (const code of item.indicator_codes.slice(0, 3)) {
      const indId = indByCode.get(code);
      if (!indId) continue;
      await db.insert(schema.relations).values({
        id: newId(),
        fromType: resourceType,
        fromId: resourceId,
        toType: "indicator",
        toId: indId,
        relation: "about_indicator",
        source: "human",
        createdAt: nowIso(),
      });
    }
  };

  for (const item of items) {
    const primary = item.types[0];
    const outcomeNodeId = item.outcome_links.length
      ? (nodeMap.get(item.outcome_links[0].code) ?? null)
      : null;

    if (primary === "lesson" || primary === "insight" || primary === "indicator_observation") {
      const id = newId();
      // CR02 3.2/3.3: a confirmed node link is the primary node (Delivery
      // Lessons); the outcome node stays the fallback. Category from the
      // structurer, validated.
      // CR05 5.6.4: handover captures publish as Expert Insights
      const category = handover
        ? "expert"
        : ["delivery", "external", "expert", "institutional"].includes(item.category ?? "")
          ? item.category!
          : item.node_link
            ? "delivery"
            : "institutional";
      await db.insert(schema.lessons).values({
        id,
        authorId: user.id,
        category,
        titleEn: item.title_en || item.title_ar,
        titleAr: item.title_ar || item.title_en,
        contextEn: item.lesson?.context_en || item.cleaned_en || null,
        contextAr: item.lesson?.context_ar || item.cleaned_ar || null,
        learningEn: item.lesson?.learning_en || null,
        learningAr: item.lesson?.learning_ar || null,
        recommendationEn: item.lesson?.recommendation_en || null,
        recommendationAr: item.lesson?.recommendation_ar || null,
        nodeId: item.node_link?.id ?? outcomeNodeId,
        classificationLevel: item.classification_level,
        status: "published",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      /* CR07 1.2 and 1.3: the structurer's suggested node becomes the primary
         link, and the additional accepted nodes follow it. `lessons.node_id`
         stays as the primary link's mirror. */
      const lessonNodeIds = [
        ...new Set(
          [
            item.node_link?.id ?? outcomeNodeId,
            ...(item.outcome_links ?? [])
              .map((l) => nodeMap.get(l.code))
              .filter(Boolean),
          ].filter(Boolean) as string[]
        ),
      ];
      for (let i = 0; i < lessonNodeIds.length && i < 5; i++) {
        await db.insert(schema.lessonNodeLinks).values({
          id: newId(),
          lessonId: id,
          nodeId: lessonNodeIds[i],
          nodeKind: "nes",
          isPrimary: i === 0 ? 1 : 0,
          linkedBy: user.id,
          linkedAt: nowIso(),
        });
      }
      await tagAndLink("lesson", id, item);
      await enqueue("embed_records", { resourceType: "lesson", resourceId: id });
      published.push({ type: "lesson", id });
      if (handover) {
        await db.insert(schema.knowledgeCaptures).values({
          id: newId(),
          handoverId: handover.id,
          lessonId: id,
          documentId: null,
          topic: item.title_en || item.title_ar,
          createdAt: nowIso(),
        });
        // the +20 handover-capture bonus on top of the Add Knowledge rules
        const bonus = await record({
          userId: user.id,
          type: "knowledge_capture_bonus",
          resourceType: "lesson",
          resourceId: id,
        });
        totalPoints += bonus.points;
        // matching checklist items count as captured
        const tacit = await db
          .select()
          .from(schema.handoverItems)
          .where(eq(schema.handoverItems.handoverId, handover.id));
        const open = tacit.find(
          (t) => t.itemKind === "tacit_topic" && t.status === "pending"
        );
        if (open) {
          await db
            .update(schema.handoverItems)
            .set({ status: "captured", doneAt: nowIso() })
            .where(eq(schema.handoverItems.id, open.id));
        }
        const { refreshHandoverCompletion } = await import("@/server/services/hr");
        await refreshHandoverCompletion(handover.id);
      }
    } else if (primary === "signal") {
      const id = newId();
      await db.insert(schema.signals).values({
        id,
        titleEn: item.title_en || item.title_ar,
        titleAr: item.title_ar || item.title_en,
        descriptionEn: item.cleaned_en || null,
        descriptionAr: item.cleaned_ar || null,
        source: item.signal?.publisher || whereFrom || null,
        impact: item.signal?.impact ?? "medium",
        horizon: item.signal?.horizon ?? "mid",
        createdBy: user.id,
        createdAt: nowIso(),
        sourceKind: "manual",
        publisher: item.signal?.publisher || null,
        publishedAt: nowIso().slice(0, 10),
        signalType: item.signal?.signal_type ?? "research",
        sentiment: "neutral",
        confidence: item.confidence,
        whyItMattersEn: item.signal?.why_en || null,
        whyItMattersAr: item.signal?.why_ar || null,
        triageStatus: "accepted",
        triagedBy: user.id,
        triagedAt: nowIso(),
      });
      for (const link of item.outcome_links.slice(0, 3)) {
        const nodeId = nodeMap.get(link.code);
        if (!nodeId) continue;
        await db.insert(schema.signalLinks).values({
          id: newId(),
          signalId: id,
          resourceType: "node",
          resourceId: nodeId,
          relation: "about",
          source: "human",
          createdAt: nowIso(),
        });
      }
      await tagAndLink("signal", id, item);
      await indexSignal(id).catch(() => {});
      published.push({ type: "signal", id });
    } else if (primary === "decision") {
      const id = newId();
      await db.insert(schema.decisions).values({
        id,
        titleEn: item.title_en || item.title_ar,
        titleAr: item.title_ar || item.title_en,
        decisionEn: item.decision?.decision_en || item.cleaned_en || null,
        decisionAr: item.decision?.decision_ar || item.cleaned_ar || null,
        rationaleEn: item.decision?.rationale_en || null,
        rationaleAr: item.decision?.rationale_ar || null,
        decidedOn: nowIso().slice(0, 10),
        ownerUserId: user.id,
        nodeId: outcomeNodeId,
        createdAt: nowIso(),
      });
      await tagAndLink("decision", id, item);
      const game = await record({
        userId: user.id,
        type: "decision_logged",
        resourceType: "decision",
        resourceId: id,
        meta: { departmentId: user.departmentId },
      });
      totalPoints += game.points;
      published.push({ type: "decision", id });
    } else if (primary === "document") {
      const id = newId();
      let storagePath = item.file_ref?.storagePath ?? null;
      const mime = item.file_ref?.mime ?? "text/plain";
      const sizeBytes = item.file_ref?.sizeBytes ?? item.cleaned_en.length;
      const filename = item.file_ref?.filename ?? "note.txt";
      if (!storagePath) {
        const { putText } = await import("@/server/storage");
        storagePath = await putText(id, "note.txt", `${item.title_en}\n\n${item.cleaned_en}\n\n${item.cleaned_ar}`);
      }
      await db.insert(schema.documents).values({
        id,
        titleEn: item.title_en || item.title_ar,
        titleAr: item.title_ar || item.title_en,
        titleArMachine: item.machine && item.title_ar ? 1 : 0,
        summaryEn: item.document?.summary_en || item.cleaned_en.slice(0, 800) || null,
        summaryAr: item.document?.summary_ar || item.cleaned_ar.slice(0, 800) || null,
        summaryMachine: item.machine ? 1 : 0,
        keyFactsJson: JSON.stringify(
          (item.document?.key_facts ?? []).map((f) => ({ ...f, page: null }))
        ),
        classificationLevel: item.classification_level,
        departmentId: user.departmentId,
        ownerUserId: user.id,
        languageOriginal: item.cleaned_ar && !item.cleaned_en ? "ar" : "en",
        status: "draft",
        sourceOrigin: "org",
        originalFilename: filename,
        mime,
        sizeBytes,
        storagePath,
        isSeeded: 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      await tagAndLink("document", id, item);
      await enqueue("ingest_document", { documentId: id });
      published.push({ type: "document", id });
    } else if (primary === "expert") {
      const id = newId();
      await db.insert(schema.experts).values({
        id,
        userId: null,
        type: "consultant",
        nameEn: item.expert?.name_en || item.title_en,
        nameAr: item.expert?.name_ar || item.title_ar || item.expert?.name_en || item.title_en,
        organisationEn: item.expert?.organisation_en || null,
        organisationAr: item.expert?.organisation_ar || null,
        positionEn: item.expert?.position_en || null,
        positionAr: item.expert?.position_ar || null,
        bioEn: item.cleaned_en || null,
        bioAr: item.cleaned_ar || null,
        email: item.expert?.email || null,
        availability: "available",
        clearanceLevel: 2,
        ownerUserId: user.id,
        isVerified: 0,
        visibilityClassification: 2,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      for (const code of item.expert?.domains ?? []) {
        const term = termByCode.get(`topic:${code}`);
        if (!term) continue;
        await db.insert(schema.expertDomains).values({
          id: newId(),
          expertId: id,
          termId: term.id,
          level: "practitioner",
          source: "ai_suggested",
          accepted: 1,
        });
      }
      await tagAndLink("expert", id, item);
      await enqueue("embed_records", { resourceType: "expert", resourceId: id });
      published.push({ type: "expert", id });
    } else {
      continue;
    }

    const game = await record({
      userId: user.id,
      type: "knowledge_submitted",
      resourceType: published[published.length - 1]?.type,
      resourceId: published[published.length - 1]?.id,
      meta: { departmentId: user.departmentId, outcomes: item.outcome_links.map((l) => l.code) },
    });
    totalPoints += game.points;
  }

  // event bonus: once per submission when "where is this from" names an event
  if (whereFrom && EVENT_HINT.test(whereFrom) && published.length) {
    const game = await record({
      userId: user.id,
      type: "knowledge_from_event",
      resourceType: "knowledge_submission",
      resourceId: submissionId,
      meta: { departmentId: user.departmentId },
    });
    totalPoints += game.points;
  }

  // CR02 5.2: the Speak path stores the original recording as an audio
  // document, relates it to everything published, and awards the voice bonus
  // once per submission.
  if (voice && published.length) {
    if (audioRef) {
      const audioDocId = newId();
      const versionId = newId();
      await db.insert(schema.documents).values({
        id: audioDocId,
        titleEn: `Voice note: ${items[0]?.title_en || audioRef.filename}`.slice(0, 180),
        titleAr: `تسجيل صوتي: ${items[0]?.title_ar || audioRef.filename}`.slice(0, 180),
        titleArMachine: 0,
        summaryEn: "Original audio of a spoken knowledge submission.",
        summaryAr: "التسجيل الأصلي لمساهمة معرفية منطوقة.",
        summaryMachine: 0,
        keyFactsJson: "[]",
        knowledgeTypeTermId: null,
        classificationLevel: 2,
        departmentId: user.departmentId,
        ownerUserId: user.id,
        languageOriginal: "en",
        status: "published",
        sourceOrigin: "org",
        originalFilename: audioRef.filename,
        mime: audioRef.mime,
        sizeBytes: audioRef.sizeBytes,
        storagePath: audioRef.storagePath,
        currentVersionId: versionId,
        isSeeded: 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      await db.insert(schema.documentVersions).values({
        id: versionId,
        documentId: audioDocId,
        versionNo: 1,
        storagePath: audioRef.storagePath,
        uploadedBy: user.id,
        note: "Voice submission recording",
        createdAt: nowIso(),
      });
      for (const p of published) {
        await db.insert(schema.relations).values({
          id: newId(),
          fromType: p.type,
          fromId: p.id,
          toType: "document",
          toId: audioDocId,
          relation: "source_audio",
          source: "human",
          createdAt: nowIso(),
        });
      }
    }
    const game = await record({
      userId: user.id,
      type: "knowledge_by_voice",
      resourceType: "knowledge_submission",
      resourceId: submissionId,
      meta: { departmentId: user.departmentId },
    });
    totalPoints += game.points;
  }

  await audit(user.id, "create", "knowledge_submission", submissionId, {
    published: published.length,
    whereFrom,
  });
  return NextResponse.json({
    data: { published, points: totalPoints, submissionId },
    error: null,
  });
}
