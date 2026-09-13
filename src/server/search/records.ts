// Embeds structured records (indicators, strategy nodes, experts, lessons, verified
// answers, document titles) into the unified search_index table.
import { eq, and, desc } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { embedTexts, float32ToBuffer } from "@/server/ai/embeddings";
import { newId, nowIso } from "@/lib/ids";

type RecordRow = {
  resourceType: string;
  resourceId: string;
  text: string;
  lang: string;
  edition?: string | null;
};

async function upsertRecords(rows: RecordRow[]): Promise<void> {
  if (!rows.length) return;
  const { vectors, model } = await embedTexts(rows.map((r) => r.text));
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const existing = await db
      .select({ id: schema.searchIndex.id })
      .from(schema.searchIndex)
      .where(
        and(
          eq(schema.searchIndex.resourceType, r.resourceType),
          eq(schema.searchIndex.resourceId, r.resourceId)
        )
      )
      .limit(1);
    const values = {
      text: r.text.slice(0, 4000),
      lang: r.lang,
      edition: r.edition ?? null,
      embedding: float32ToBuffer(vectors[i]),
      embeddingModel: model,
      updatedAt: nowIso(),
    };
    if (existing.length) {
      await db
        .update(schema.searchIndex)
        .set(values)
        .where(eq(schema.searchIndex.id, existing[0].id));
    } else {
      await db.insert(schema.searchIndex).values({
        id: newId(),
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        ...values,
      });
    }
  }
}

async function indicatorText(id: string): Promise<RecordRow | null> {
  const [ind] = await db.select().from(schema.indicators).where(eq(schema.indicators.id, id)).limit(1);
  if (!ind) return null;
  const values = await db
    .select()
    .from(schema.indicatorValues)
    .where(and(eq(schema.indicatorValues.indicatorId, id), eq(schema.indicatorValues.dimensionKey, "total")))
    .orderBy(desc(schema.indicatorValues.period))
    .limit(3);
  const latest = values.map((v) => `${v.period}: ${v.value}${ind.unit ? " " + ind.unit : ""}`).join("; ");
  return {
    resourceType: "indicator",
    resourceId: id,
    lang: "en",
    text: `${ind.nameEn} | ${ind.nameAr} | ${ind.definitionEn ?? ""} | ${ind.definitionAr ?? ""} | Latest values: ${latest} | Source: ${ind.sourceEn ?? ""} | Frequency: ${ind.frequency}`,
  };
}

async function nodeText(id: string): Promise<RecordRow | null> {
  const [n] = await db.select().from(schema.strategyNodes).where(eq(schema.strategyNodes.id, id)).limit(1);
  if (!n) return null;
  const [edition] = await db
    .select()
    .from(schema.strategyEditions)
    .where(eq(schema.strategyEditions.id, n.editionId))
    .limit(1);
  const kpiNames = await db
    .select({ nameEn: schema.kpis.nameEn, nameAr: schema.kpis.nameAr })
    .from(schema.kpis)
    .where(eq(schema.kpis.nodeId, id))
    .limit(6);
  return {
    resourceType: "node",
    resourceId: id,
    lang: "en",
    edition: edition?.code ?? null,
    text: `${edition?.code?.toUpperCase() ?? ""} ${n.nodeType} ${n.code ?? ""}: ${n.titleEn} | ${n.titleAr} | ${n.descriptionEn ?? ""} | ${n.descriptionAr ?? ""}${kpiNames.length ? ` | KPIs: ${kpiNames.map((k) => `${k.nameEn} / ${k.nameAr}`).join("; ")}` : ""}`,
  };
}

async function signalText(id: string): Promise<RecordRow | null> {
  const [s] = await db.select().from(schema.signals).where(eq(schema.signals.id, id)).limit(1);
  if (!s || s.triageStatus !== "accepted") return null;
  return {
    resourceType: "signal",
    resourceId: id,
    lang: "en",
    text: `Signal (${s.signalType}, ${s.publisher ?? "unknown"}${s.publishedAt ? `, ${s.publishedAt}` : ""}): ${s.titleEn} | ${s.titleAr} | ${s.descriptionEn ?? ""} | ${s.descriptionAr ?? ""} | Why it matters: ${s.whyItMattersEn ?? ""} | ${s.whyItMattersAr ?? ""}`,
  };
}

async function decisionText(id: string): Promise<RecordRow | null> {
  const [d] = await db.select().from(schema.decisions).where(eq(schema.decisions.id, id)).limit(1);
  if (!d) return null;
  return {
    resourceType: "decision",
    resourceId: id,
    lang: "en",
    text: `Decision (${d.decidedOn ?? ""}): ${d.titleEn} | ${d.titleAr} | ${d.decisionEn ?? ""} | ${d.decisionAr ?? ""} | Rationale: ${d.rationaleEn ?? ""} | ${d.rationaleAr ?? ""}`,
  };
}

async function expertText(id: string): Promise<RecordRow | null> {
  const [e] = await db.select().from(schema.experts).where(eq(schema.experts.id, id)).limit(1);
  if (!e) return null;
  const domains = await db
    .select({ nameEn: schema.taxonomyTerms.nameEn, nameAr: schema.taxonomyTerms.nameAr })
    .from(schema.expertDomains)
    .innerJoin(schema.taxonomyTerms, eq(schema.taxonomyTerms.id, schema.expertDomains.termId))
    .where(eq(schema.expertDomains.expertId, id));
  const engagements = await db
    .select({ title: schema.expertEngagements.title })
    .from(schema.expertEngagements)
    .where(eq(schema.expertEngagements.expertId, id))
    .limit(5);
  return {
    resourceType: "expert",
    resourceId: id,
    lang: "en",
    text: `${e.nameEn} | ${e.nameAr} | ${e.positionEn ?? ""} at ${e.organisationEn ?? ""} | ${e.bioEn ?? ""} | ${e.bioAr ?? ""} | Domains: ${domains.map((d) => d.nameEn + " " + d.nameAr).join(", ")} | Engagements: ${engagements.map((g) => g.title).join("; ")}`,
  };
}

async function lessonText(id: string): Promise<RecordRow | null> {
  const [l] = await db.select().from(schema.lessons).where(eq(schema.lessons.id, id)).limit(1);
  if (!l) return null;
  return {
    resourceType: "lesson",
    resourceId: id,
    lang: "en",
    text: `${l.titleEn} | ${l.titleAr} | ${l.contextEn ?? ""} | ${l.learningEn ?? ""} | ${l.recommendationEn ?? ""} | ${l.learningAr ?? ""}`,
  };
}

async function answerText(id: string): Promise<RecordRow | null> {
  const [a] = await db.select().from(schema.answers).where(eq(schema.answers.id, id)).limit(1);
  if (!a || !a.isVerified) return null;
  const [q] = await db.select().from(schema.questions).where(eq(schema.questions.id, a.questionId)).limit(1);
  return {
    resourceType: "answer",
    resourceId: id,
    lang: "en",
    text: `Q: ${q?.titleEn ?? ""} | ${q?.titleAr ?? ""} A: ${(a.bodyEn ?? a.bodyAr ?? "").slice(0, 1500)}`,
  };
}

async function documentText(id: string): Promise<RecordRow | null> {
  const [d] = await db.select().from(schema.documents).where(eq(schema.documents.id, id)).limit(1);
  if (!d || d.deletedAt) return null;
  return {
    resourceType: "document",
    resourceId: id,
    lang: d.languageOriginal === "ar" ? "ar" : "en",
    text: `${d.titleEn} | ${d.titleAr} | ${(d.summaryEn ?? "").slice(0, 900)} | ${(d.summaryAr ?? "").slice(0, 900)}`,
  };
}

async function questionText(id: string): Promise<RecordRow | null> {
  const [q] = await db.select().from(schema.questions).where(eq(schema.questions.id, id)).limit(1);
  if (!q) return null;
  return {
    resourceType: "question",
    resourceId: id,
    lang: q.langOriginal,
    text: `${q.titleEn} | ${q.titleAr} | ${(q.bodyEn ?? "").slice(0, 500)} | ${(q.bodyAr ?? "").slice(0, 500)}`,
  };
}

/* CR02 8: podcast episodes join the unified index (script text). */
async function podcastEpisodeText(id: string): Promise<RecordRow | null> {
  const [e] = await db
    .select()
    .from(schema.podcastEpisodes)
    .where(eq(schema.podcastEpisodes.id, id))
    .limit(1);
  if (!e || e.status !== "published") return null;
  let scriptText = "";
  try {
    const script = JSON.parse(e.scriptJson ?? "{}") as {
      segments?: { speaker: string; text: string }[];
    };
    scriptText = (script.segments ?? []).map((s) => s.text).join(" ");
  } catch {
    scriptText = "";
  }
  return {
    resourceType: "podcast_episode",
    resourceId: id,
    lang: e.language,
    text: `Podcast episode: ${e.titleEn} | ${e.titleAr} | ${e.descriptionEn ?? ""} | ${e.descriptionAr ?? ""} | ${scriptText.slice(0, 2500)}`,
  };
}

/* CR04 5: theme syntheses join the unified index. */
async function lessonThemeText(id: string): Promise<RecordRow | null> {
  const [c] = await db
    .select()
    .from(schema.lessonClusters)
    .where(eq(schema.lessonClusters.id, id))
    .limit(1);
  if (!c) return null;
  return {
    resourceType: "lesson_theme",
    resourceId: id,
    lang: "en",
    text: `Lesson theme: ${c.labelEn} | ${c.labelAr} | ${c.summaryEn ?? ""} | ${c.summaryAr ?? ""}`,
  };
}

const BUILDERS: Record<string, (id: string) => Promise<RecordRow | null>> = {
  indicator: indicatorText,
  node: nodeText,
  expert: expertText,
  lesson: lessonText,
  answer: answerText,
  document: documentText,
  question: questionText,
  signal: signalText,
  decision: decisionText,
  podcast_episode: podcastEpisodeText,
  lesson_theme: lessonThemeText,
};

export async function embedStructuredRecords(
  resourceType?: string,
  resourceId?: string
): Promise<void> {
  if (resourceType && resourceId) {
    const builder = BUILDERS[resourceType];
    if (!builder) return;
    const row = await builder(resourceId);
    if (row) await upsertRecords([row]);
    return;
  }
  // Full rebuild (used by seed): walk every table.
  const rows: RecordRow[] = [];
  const push = (r: RecordRow | null) => r && rows.push(r);
  for (const ind of await db.select({ id: schema.indicators.id }).from(schema.indicators))
    push(await indicatorText(ind.id));
  for (const n of await db.select({ id: schema.strategyNodes.id }).from(schema.strategyNodes))
    push(await nodeText(n.id));
  for (const e of await db.select({ id: schema.experts.id }).from(schema.experts))
    push(await expertText(e.id));
  for (const l of await db.select({ id: schema.lessons.id }).from(schema.lessons))
    push(await lessonText(l.id));
  for (const a of await db.select({ id: schema.answers.id }).from(schema.answers))
    push(await answerText(a.id));
  for (const d of await db.select({ id: schema.documents.id }).from(schema.documents))
    push(await documentText(d.id));
  for (const q of await db.select({ id: schema.questions.id }).from(schema.questions))
    push(await questionText(q.id));
  for (const s of await db.select({ id: schema.signals.id }).from(schema.signals))
    push(await signalText(s.id)); // accepted signals only (builder filters)
  for (const d of await db.select({ id: schema.decisions.id }).from(schema.decisions))
    push(await decisionText(d.id));
  for (const e of await db.select({ id: schema.podcastEpisodes.id }).from(schema.podcastEpisodes))
    push(await podcastEpisodeText(e.id));
  for (const c of await db.select({ id: schema.lessonClusters.id }).from(schema.lessonClusters))
    push(await lessonThemeText(c.id));
  // batch in groups of 64 for embedding efficiency
  for (let i = 0; i < rows.length; i += 64) {
    await upsertRecords(rows.slice(i, i + 64));
  }
}
