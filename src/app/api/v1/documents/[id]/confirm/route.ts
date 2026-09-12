// Confirms an uploaded draft: applies edited metadata + tags, schedules ingest,
// awards points. The document appears on the shelf immediately (status under_review).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { newId, nowIso } from "@/lib/ids";
import { enqueue } from "@/server/jobs/queue";
import { record } from "@/server/gamification/engine";
import { audit } from "@/server/auth/audit";
import { getAllTerms } from "@/server/services/taxonomy";

const Body = z.object({
  title_en: z.string().min(1),
  title_ar: z.string().default(""),
  summary_en: z.string().default(""),
  summary_ar: z.string().default(""),
  key_facts: z
    .array(z.object({ text_en: z.string(), text_ar: z.string().default(""), page: z.number().nullable() }))
    .default([]),
  knowledge_type_code: z.string().default("report"),
  outcome_codes: z.array(z.string()).default([]),
  sector_codes: z.array(z.string()).default([]),
  topic_codes: z.array(z.string()).default([]),
  classification_level: z.number().min(1).max(4).default(2),
  review_months: z.number().min(1).max(60).default(12),
  collection_id: z.string().nullable().default(null),
  as_new_version_of: z.string().nullable().default(null),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  }
  const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, id)).limit(1);
  if (!doc || doc.ownerUserId !== user.id) {
    return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  }
  const b = body.data;

  // Duplicate resolution: attach the file as a new version of the existing document.
  if (b.as_new_version_of) {
    const [target] = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, b.as_new_version_of))
      .limit(1);
    if (target) {
      const versions = await db
        .select()
        .from(schema.documentVersions)
        .where(eq(schema.documentVersions.documentId, target.id));
      const versionId = newId();
      await db.insert(schema.documentVersions).values({
        id: versionId,
        documentId: target.id,
        versionNo: versions.length + 1,
        storagePath: doc.storagePath!,
        uploadedBy: user.id,
        note: `Uploaded as duplicate of draft ${doc.id}`,
        createdAt: nowIso(),
      });
      await db
        .update(schema.documents)
        .set({
          currentVersionId: versionId,
          storagePath: doc.storagePath,
          mime: doc.mime,
          sizeBytes: doc.sizeBytes,
          pageCount: doc.pageCount,
          updatedAt: nowIso(),
        })
        .where(eq(schema.documents.id, target.id));
      await db
        .update(schema.documents)
        .set({ deletedAt: nowIso() })
        .where(eq(schema.documents.id, doc.id));
      await enqueue("ingest_document", { documentId: target.id });
      await record({
        userId: user.id,
        type: "document_version_added",
        resourceType: "document",
        resourceId: target.id,
        meta: { departmentId: user.departmentId },
      });
      await audit(user.id, "create", "document_version", target.id);
      return NextResponse.json({ data: { documentId: target.id, version: true }, error: null });
    }
  }

  const terms = await getAllTerms();
  const codeToTerm = new Map(terms.map((t) => [`${t.dimension}:${t.code}`, t]));
  const typeTerm = codeToTerm.get(`knowledge_type:${b.knowledge_type_code}`);

  await db
    .update(schema.documents)
    .set({
      titleEn: b.title_en,
      titleAr: b.title_ar,
      summaryEn: b.summary_en || null,
      summaryAr: b.summary_ar || null,
      keyFactsJson: JSON.stringify(b.key_facts),
      knowledgeTypeTermId: typeTerm?.id ?? null,
      classificationLevel: b.classification_level,
      status: "under_review",
      reviewDueAt: new Date(Date.now() + b.review_months * 30.44 * 86400000).toISOString(),
      updatedAt: nowIso(),
    })
    .where(eq(schema.documents.id, id));

  // tags
  await db
    .delete(schema.taggings)
    .where(and(eq(schema.taggings.resourceType, "document"), eq(schema.taggings.resourceId, id)));
  const allCodes = [
    ...b.outcome_codes.map((c) => `outcome:${c}`),
    ...b.sector_codes.map((c) => `sector:${c}`),
    ...b.topic_codes.map((c) => `topic:${c}`),
  ];
  for (const key of allCodes) {
    const term = codeToTerm.get(key);
    if (!term) continue;
    await db.insert(schema.taggings).values({
      id: newId(),
      resourceType: "document",
      resourceId: id,
      termId: term.id,
      source: "ai_confirmed",
      createdBy: user.id,
      createdAt: nowIso(),
    });
  }

  if (b.collection_id) {
    await db.insert(schema.collectionItems).values({
      id: newId(),
      collectionId: b.collection_id,
      resourceType: "document",
      resourceId: id,
      addedBy: user.id,
      createdAt: nowIso(),
    });
  }

  await enqueue("ingest_document", { documentId: id });
  await enqueue("translate_document", { documentId: id });
  const game = await record({
    userId: user.id,
    type: "document_uploaded",
    resourceType: "document",
    resourceId: id,
    meta: { departmentId: user.departmentId, outcomes: b.outcome_codes },
  });
  await audit(user.id, "create", "document", id, { confirmed: true });

  return NextResponse.json({ data: { documentId: id, points: game.points }, error: null });
}
