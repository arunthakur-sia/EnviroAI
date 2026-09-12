// SiaNexus Intelligence capabilities. Each function tries the live model and falls
// back to the deterministic mock so every screen works without a key.
import { desc, eq, and, gte } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getAiSettings } from "@/server/settings";
import { callJson } from "./client";
import {
  mockEnrich,
  mockNarrate,
  mockWhatChanged,
  mockBrief,
  mockExpertReasons,
  mockLessonStructure,
  mockIntent,
  mockHealth,
  type EnrichResult,
  type MockEnrichInput,
} from "./mock";
import type { RetrievedChunk } from "@/server/search/hybrid";

/* ---------------- enrichment ---------------- */

export async function enrichContent(input: MockEnrichInput): Promise<EnrichResult> {
  const settings = await getAiSettings();
  const termList = input.terms
    .map((t) => `${t.dimension}:${t.code} = ${t.nameEn} / ${t.nameAr}`)
    .join("\n");
  const live = await callJson<Omit<EnrichResult, "machine">>(
    "system_enrich",
    `Filename: ${input.filename}\nDetected language: ${input.lang}\nSource origin: ${input.sourceOrigin ?? "npc"}\n\nTaxonomy codes:\n${termList}\n\nDocument text (first pages):\n${input.pages
      .slice(0, 12)
      .map((p) => `[page ${p.page}] ${p.text.slice(0, 1600)}`)
      .join("\n\n")
      .slice(0, 24000)}`,
    { model: settings.modelDefault, maxTokens: 4000 }
  );
  if (live && live.title_en !== undefined) {
    return { ...live, machine: true } as EnrichResult;
  }
  return mockEnrich(input);
}

/* ---------------- translation ---------------- */

export async function translateFields(
  fields: { key: string; text: string }[],
  from: "en" | "ar",
  to: "en" | "ar"
): Promise<{ key: string; text: string }[] | null> {
  if (!fields.length) return [];
  const live = await callJson<{ translations: { key: string; text: string }[] }>(
    "system_translate",
    `Translate from ${from} to ${to}. Fields:\n${fields
      .map((f) => `key "${f.key}":\n${f.text.slice(0, 4000)}`)
      .join("\n---\n")}`,
    { maxTokens: 6000 }
  );
  if (live?.translations?.length) return live.translations;
  return null; // mock mode: no machine translation; UI shows original with a chip
}

/* ---------------- indicator narration ---------------- */

export async function narrateIndicator(indicatorId: string): Promise<{
  narration_en: string;
  narration_ar: string;
}> {
  const [ind] = await db
    .select()
    .from(schema.indicators)
    .where(eq(schema.indicators.id, indicatorId))
    .limit(1);
  if (!ind) return { narration_en: "", narration_ar: "" };
  const values = await db
    .select()
    .from(schema.indicatorValues)
    .where(
      and(
        eq(schema.indicatorValues.indicatorId, indicatorId),
        eq(schema.indicatorValues.dimensionKey, "total")
      )
    )
    .orderBy(desc(schema.indicatorValues.period))
    .limit(24);
  const series = values
    .map((v) => ({ period: v.period, value: v.value }))
    .reverse();
  const kpiLinks = await db
    .select()
    .from(schema.kpis)
    .where(eq(schema.kpis.indicatorId, indicatorId))
    .limit(1);
  const target = kpiLinks.length && kpiLinks[0].targetValue !== null
    ? { value: kpiLinks[0].targetValue!, year: kpiLinks[0].targetYear ?? 2030 }
    : null;
  const live = await callJson<{ narration_en: string; narration_ar: string }>(
    "system_narrate_indicator",
    JSON.stringify({
      indicator: {
        name_en: ind.nameEn,
        name_ar: ind.nameAr,
        unit: ind.unit,
        direction: ind.direction,
        definition_en: ind.definitionEn,
        methodology_en: ind.methodologyEn,
      },
      series,
      target,
    }),
    { maxTokens: 1200 }
  );
  if (live?.narration_en) return live;
  return mockNarrate(
    { nameEn: ind.nameEn, nameAr: ind.nameAr, unit: ind.unit, direction: ind.direction, decimals: ind.decimals },
    series,
    target
  );
}

/* ---------------- what changed ---------------- */

export async function whatChanged(
  nodeIds: string[],
  sinceDays = 7
): Promise<ReturnType<typeof mockWhatChanged>> {
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const updates = nodeIds.length
    ? await db
        .select({
          nodeId: schema.statusUpdates.nodeId,
          status: schema.statusUpdates.status,
          progressPct: schema.statusUpdates.progressPct,
          createdAt: schema.statusUpdates.createdAt,
          titleEn: schema.strategyNodes.titleEn,
          titleAr: schema.strategyNodes.titleAr,
        })
        .from(schema.statusUpdates)
        .innerJoin(schema.strategyNodes, eq(schema.strategyNodes.id, schema.statusUpdates.nodeId))
        .where(gte(schema.statusUpdates.createdAt, since))
        .orderBy(desc(schema.statusUpdates.createdAt))
        .limit(10)
    : [];
  const filtered = updates.filter((u) => nodeIds.includes(u.nodeId));
  const kpiRows = await db
    .select({
      kpiId: schema.kpiValues.kpiId,
      period: schema.kpiValues.period,
      value: schema.kpiValues.actualValue,
      createdAt: schema.kpiValues.createdAt,
      nameEn: schema.kpis.nameEn,
      nameAr: schema.kpis.nameAr,
      nodeId: schema.kpis.nodeId,
    })
    .from(schema.kpiValues)
    .innerJoin(schema.kpis, eq(schema.kpis.id, schema.kpiValues.kpiId))
    .where(gte(schema.kpiValues.createdAt, since))
    .orderBy(desc(schema.kpiValues.createdAt))
    .limit(20);
  const kpiFiltered = kpiRows.filter((k) => nodeIds.includes(k.nodeId));
  const updatesShaped = filtered.map((u) => ({
    nodeTitleEn: u.titleEn,
    nodeTitleAr: u.titleAr,
    status: u.status,
    progressPct: u.progressPct,
    createdAt: u.createdAt,
  }));
  const deltasShaped = kpiFiltered
    .filter((k) => k.value !== null)
    .map((k) => ({
      kpiNameEn: k.nameEn,
      kpiNameAr: k.nameAr,
      from: null,
      to: k.value!,
      period: k.period,
    }));
  const live = await callJson<ReturnType<typeof mockWhatChanged>>(
    "system_what_changed",
    JSON.stringify({ updates: updatesShaped, kpi_changes: deltasShaped }),
    { maxTokens: 1500 }
  );
  if (live?.summary_en) return live;
  return mockWhatChanged(updatesShaped, deltasShaped);
}

/* ---------------- brief ---------------- */

export type Brief = ReturnType<typeof mockBrief>;

export async function generateBrief(subject: {
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  numbers: { label_en: string; label_ar: string; value: string }[];
  extra?: string;
}): Promise<Brief> {
  const settings = await getAiSettings();
  const live = await callJson<Brief>(
    "system_brief",
    `Subject: ${subject.titleEn} / ${subject.titleAr}\n\nMaterial:\n${subject.bodyEn.slice(0, 12000)}\n\n${subject.bodyAr.slice(0, 8000)}\n\nNumbers:\n${subject.numbers
      .map((n) => `${n.label_en} / ${n.label_ar}: ${n.value}`)
      .join("\n")}\n${subject.extra ?? ""}`,
    { model: settings.modelBrief, maxTokens: 8000 }
  );
  if (live?.sections?.length) return live;
  // Opus may be unavailable: retry once on the default model before mocking.
  const retry = await callJson<Brief>(
    "system_brief",
    `Subject: ${subject.titleEn}\nMaterial:\n${subject.bodyEn.slice(0, 9000)}`,
    { model: settings.modelDefault, maxTokens: 6000 }
  );
  if (retry?.sections?.length) return retry;
  return mockBrief(subject);
}

/* ---------------- experts ---------------- */

export async function expertReasons(
  question: string,
  experts: {
    id: string;
    nameEn: string;
    domains: string[];
    topEngagement: string | null;
    contributions: number;
  }[]
): Promise<ReturnType<typeof mockExpertReasons>> {
  const live = await callJson<ReturnType<typeof mockExpertReasons>>(
    "system_expert_reason",
    JSON.stringify({ question, experts }),
    { maxTokens: 1200 }
  );
  if (live?.reasons?.length) return live;
  return mockExpertReasons(experts);
}

/* ---------------- lessons ---------------- */

export async function structureLesson(rough: string) {
  const terms = await db
    .select({
      code: schema.taxonomyTerms.code,
      dim: schema.taxonomyDimensions.code,
    })
    .from(schema.taxonomyTerms)
    .innerJoin(
      schema.taxonomyDimensions,
      eq(schema.taxonomyDimensions.id, schema.taxonomyTerms.dimensionId)
    );
  const outcomes = terms.filter((t) => t.dim === "outcome").map((t) => t.code);
  const topics = terms.filter((t) => t.dim === "topic").map((t) => t.code);
  const live = await callJson<ReturnType<typeof mockLessonStructure>>(
    "system_lesson_structure",
    `Outcome codes: ${outcomes.join(", ")}\nTopic codes: ${topics.slice(0, 60).join(", ")}\n\nRough text:\n${rough.slice(0, 6000)}`,
    { maxTokens: 3000 }
  );
  if (live?.learning_en !== undefined || live?.learning_ar !== undefined) return live;
  return mockLessonStructure(rough);
}

/* ---------------- intent ---------------- */

export async function classifyIntent(query: string): Promise<{ intent: string; lang: string }> {
  const quick = mockIntent(query);
  if (quick.intent !== "mixed") return quick;
  const settings = await getAiSettings();
  const live = await callJson<{ intent: string; lang: string }>(
    "system_intent",
    query,
    { model: settings.modelFast, maxTokens: 100 }
  );
  return live?.intent ? live : quick;
}

/* ---------------- rerank ---------------- */

export async function rerankChunks(
  query: string,
  chunks: RetrievedChunk[]
): Promise<RetrievedChunk[]> {
  if (chunks.length <= 3) return chunks;
  const settings = await getAiSettings();
  const live = await callJson<{ scores: { n: number; score: number }[] }>(
    "system_rerank",
    `Query: ${query}\n\n${chunks
      .map((c, i) => `[${i + 1}] ${c.text.slice(0, 500)}`)
      .join("\n\n")}`,
    { model: settings.modelFast, maxTokens: 800 }
  );
  if (!live?.scores?.length) return chunks;
  const scoreMap = new Map(live.scores.map((s) => [s.n, s.score]));
  return [...chunks]
    .map((c, i) => ({ c, s: scoreMap.get(i + 1) ?? 5 }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);
}

/* ---------------- health ---------------- */

export async function healthNarrative(metrics: Record<string, number | string>) {
  const live = await callJson<ReturnType<typeof mockHealth>>(
    "system_health",
    JSON.stringify(metrics),
    { maxTokens: 3000 }
  );
  if (live?.narrative_en) return live;
  return mockHealth(metrics);
}
