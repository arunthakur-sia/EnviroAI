// The Ask EnviroAI pipeline: permission-aware hybrid retrieval, optional rerank,
// grounded streaming generation (live or mock), citation validation, confidence,
// and expert suggestions. Yields SSE-ready events.
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { retrieveChunks, retrieveRecords, type RetrievedChunk } from "@/server/search/hybrid";
import { searchSimilarRecords } from "@/server/search/vector";
import { ftsRecords } from "@/server/search/fts";
import { embedQuery } from "./embeddings";
import { aiLive, streamPrompt } from "./client";
import { mockAnswer } from "./mock";
import { rerankChunks, expertReasons } from "./index";
import { isArabicText } from "@/lib/utils";
import { mockIntent } from "./mock";
import type { CurrentUser } from "@/server/auth/session";
import { getAiSettings } from "@/server/settings";
import { ownerKey, resolveOwners, type OwnerChip } from "@/server/services/owner-lookup";

/** A retrieval source for Ask: a document chunk or a statistical indicator. */
export type AskSource = RetrievedChunk & { resourceType: "document" | "indicator" };

export type AskEvent =
  | { type: "sources"; citations: CitationOut[] }
  | { type: "delta"; text: string }
  | {
      type: "final";
      markdown: string;
      citations: CitationOut[];
      confidence: "high" | "medium" | "low";
      suggestedExperts: SuggestedExpert[];
      /* CR08 3: the same suggestions in two labelled groups, internal first */
      suggestedExpertGroups: SuggestedExpertGroups;
      followUps: string[];
      includesSecret: boolean;
      chunkIds: string[];
    };

export type CitationOut = {
  n: number;
  chunk_id: string;
  resource_type: string;
  resource_id: string;
  title: string;
  page: number | null;
  excerpt: string;
  lang: string;
  /** CR08 9.1: the person behind the cited item, when one is recorded.
      OPTIONAL for good: citations are persisted in answers.citations_json and
      every row written before this pass has none. */
  owner?: OwnerChip | null;
};

/** CR08 9.1: fills `owner` on the citations whose item records a person (a
    document's custodian, a strategy node's owner, a lesson's author), in one
    bulk pass. Citations of anything else are left as they are. */
export async function attachCitationOwners(citations: CitationOut[]): Promise<void> {
  const items = citations
    .filter((c) => c.resource_type === "document" || c.resource_type === "node" || c.resource_type === "lesson")
    .map((c) => ({ type: c.resource_type, id: c.resource_id }));
  if (!items.length) return;
  const owners = await resolveOwners(items);
  for (const c of citations) {
    const owner = owners[ownerKey(c.resource_type, c.resource_id)];
    if (owner) c.owner = owner;
  }
}

export type SuggestedExpert = {
  id: string;
  nameEn: string;
  nameAr: string;
  positionEn: string | null;
  positionAr: string | null;
  organisationEn: string | null;
  availability: string;
  reasonEn: string;
  reasonAr: string;
  /* CR08 3: Programme Office staff are internal, everyone else external */
  kind: "internal" | "external";
};

export type SuggestedExpertGroups = {
  internal: SuggestedExpert[];
  external: SuggestedExpert[];
};

/**
 * Retrieves statistical indicators relevant to the question and composes a fresh
 * source text from the live series, so Ask can answer number questions directly
 * from the Statistics Hub, not only from documents.
 */
export async function retrieveIndicatorSources(
  query: string,
  user: CurrentUser,
  k = 3
): Promise<{ sources: AskSource[]; bestSimilarity: number }> {
  const { vector } = await embedQuery(query);
  // Keyword pass: meaningful tokens only, so "في" and "the" cannot flood the ranking
  const keywordQuery = query
    .split(/\s+/)
    .filter((t) => t.replace(/[^\p{L}\p{N}]/gu, "").length >= 3)
    .join(" ");
  const [vecHits, ftsHits] = await Promise.all([
    // score every indicator record so keyword hits carry their true cosine
    searchSimilarRecords(
      vector,
      { maxClassification: user.clearanceLevel, resourceTypes: ["indicator"] },
      200
    ),
    keywordQuery ? ftsRecords(keywordQuery, 60) : Promise.resolve([]),
  ]);
  // Keyword bonus decays with BM25 rank: an indicator matched on a rare term like
  // "التضخم" outranks ones matched only on generic tokens like "معدل" or "السعودية".
  const ftsIndicatorIds = ftsHits
    .filter((h) => h.resourceType === "indicator")
    .map((h) => h.resourceId);
  const keywordBonus = new Map(ftsIndicatorIds.map((id, idx) => [id, 0.4 / (1 + idx)]));
  const vecById = new Map(vecHits.map((h) => [h.resourceId, h.score]));
  const candidateIds = new Set([...vecById.keys(), ...keywordBonus.keys()]);
  const scored = [...candidateIds]
    .map((id) => {
      const cosine = vecById.get(id) ?? 0;
      return { id, cosine, score: cosine + (keywordBonus.get(id) ?? 0) };
    })
    .filter((h) => h.cosine >= 0.32 || keywordBonus.has(h.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
  if (!scored.length) return { sources: [], bestSimilarity: 0 };

  const rows = await db
    .select()
    .from(schema.indicators)
    .where(inArray(schema.indicators.id, scored.map((s) => s.id)));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const sources: AskSource[] = [];
  let bestSimilarity = 0;
  for (const s of scored) {
    const ind = byId.get(s.id);
    if (!ind || ind.classificationLevel > user.clearanceLevel) continue;
    const values = await db
      .select()
      .from(schema.indicatorValues)
      .where(
        and(
          eq(schema.indicatorValues.indicatorId, ind.id),
          eq(schema.indicatorValues.dimensionKey, "total")
        )
      )
      .orderBy(desc(schema.indicatorValues.period))
      .limit(8);
    if (!values.length) continue;
    const latest = values[0];
    const illustrative = values.some((v) => v.note?.includes("illustrative"));
    const series = [...values]
      .reverse()
      .map((v) => `${v.period}: ${v.value}${ind.unit ? ` ${ind.unit}` : ""} (${v.status})`)
      .join("; ");
    const text = [
      `Official statistical indicator: ${ind.nameEn} / ${ind.nameAr}.`,
      ind.definitionEn ? `Definition: ${ind.definitionEn}` : "",
      ind.definitionAr ? `التعريف: ${ind.definitionAr}` : "",
      `Frequency: ${ind.frequency}. Unit: ${ind.unit ?? "-"}. Source: ${ind.sourceEn ?? "General Authority for Statistics (GASTAT)"}.`,
      `Latest value: ${latest.value}${ind.unit ? ` ${ind.unit}` : ""} for period ${latest.period}${latest.status !== "final" ? ` (${latest.status}; بيانات أولية)` : ""}.`,
      `Recent series: ${series}.`,
      illustrative
        ? "Note: these are seeded illustrative values in the prototype, marked provisional; cite the period and status with the number."
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    bestSimilarity = Math.max(bestSimilarity, s.cosine);
    sources.push({
      chunkId: `indicator:${ind.id}`,
      documentId: ind.id,
      documentTitleEn: ind.nameEn,
      documentTitleAr: ind.nameAr,
      page: null,
      heading: null,
      text,
      lang: "en",
      classification: ind.classificationLevel,
      verified: true, // official statistics count as verified sources
      score: s.score,
      resourceType: "indicator",
    });
  }
  return { sources, bestSimilarity };
}

export function filtersForUser(user: CurrentUser, allowSecret: boolean) {
  return {
    maxClassification: user.clearanceLevel,
    departmentId: user.departmentId,
    departmentScope: (user.departmentScope === "own" ? "own" : "all") as "own" | "all",
    excludeSecret: !(allowSecret && user.clearanceLevel >= 4),
  };
}

/** Citation coverage: share of substantive sentences that carry [n] markers. */
export function citationCoverage(markdown: string): number {
  const lines = markdown
    .split(/\n+/)
    .map((l) => l.replace(/^[-*#>\s]+/, "").trim())
    .filter((l) => l.length > 40);
  if (!lines.length) return 0;
  const sentencesAll = lines.flatMap((l) =>
    l.split(/(?<=[.!؟?])\s+/).filter((s) => s.trim().length > 40)
  );
  if (!sentencesAll.length) return 1;
  const cited = sentencesAll.filter((s) => /\[\d+\]\.?\s*$|\[\d+\]\[\d+\]/.test(s.trim()));
  return cited.length / sentencesAll.length;
}

export function computeConfidence(
  chunks: RetrievedChunk[],
  topSimilarity: number,
  coverage: number
): "high" | "medium" | "low" {
  if (topSimilarity < 0.35 || coverage < 0.8) return "low";
  const verified = chunks.filter((c) => c.verified).length;
  if (verified >= 2 && coverage >= 0.999) return "high";
  return "medium";
}

/**
 * CR08 3: expert suggestions come back in two labelled groups, internal
 * first, never blended. The flat list (`suggestExperts`) keeps its shape for
 * older callers and is simply the internal group followed by the external
 * one; each entry carries its `kind`. `limit` applies per group.
 */
export async function suggestExpertsGrouped(
  query: string,
  user: CurrentUser,
  limit = 3
): Promise<SuggestedExpertGroups & { all: SuggestedExpert[] }> {
  const records = await retrieveRecords(
    query,
    { maxClassification: user.clearanceLevel, resourceTypes: ["expert"] },
    limit * 6
  );
  const ids = records.map((r) => r.resourceId);
  if (!ids.length) return { internal: [], external: [], all: [] };
  const rows = await db
    .select()
    .from(schema.experts)
    .where(inArray(schema.experts.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const visible = ids
    .map((id) => byId.get(id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .filter((e) => (e.visibilityClassification ?? 2) <= user.clearanceLevel);
  const kindOf = (e: (typeof visible)[number]): "internal" | "external" =>
    e.userId || e.type === "org_employee" ? "internal" : "external";
  const ordered = [
    ...visible.filter((e) => kindOf(e) === "internal").slice(0, limit),
    ...visible.filter((e) => kindOf(e) === "external").slice(0, limit),
  ];
  const all = await describeSuggestions(query, ordered, kindOf);
  return {
    internal: all.filter((e) => e.kind === "internal"),
    external: all.filter((e) => e.kind === "external"),
    all,
  };
}

export async function suggestExperts(
  query: string,
  user: CurrentUser,
  limit = 3
): Promise<SuggestedExpert[]> {
  return (await suggestExpertsGrouped(query, user, limit)).all;
}

async function describeSuggestions(
  query: string,
  ordered: (typeof schema.experts.$inferSelect)[],
  kindOf: (e: typeof schema.experts.$inferSelect) => "internal" | "external"
): Promise<SuggestedExpert[]> {
  if (!ordered.length) return [];
  const inputs = await Promise.all(
    ordered.map(async (e) => {
      const domains = await db
        .select({ nameEn: schema.taxonomyTerms.nameEn })
        .from(schema.expertDomains)
        .innerJoin(schema.taxonomyTerms, eq(schema.taxonomyTerms.id, schema.expertDomains.termId))
        .where(eq(schema.expertDomains.expertId, e.id))
        .limit(4);
      const engagements = await db
        .select({ title: schema.expertEngagements.title })
        .from(schema.expertEngagements)
        .where(eq(schema.expertEngagements.expertId, e.id))
        .limit(1);
      return {
        id: e.id,
        nameEn: e.nameEn,
        domains: domains.map((d) => d.nameEn),
        topEngagement: engagements[0]?.title ?? null,
        contributions: 0,
      };
    })
  );
  const reasons = await expertReasons(query, inputs);
  const reasonMap = new Map(reasons.reasons.map((r) => [r.expert_id, r]));
  return ordered.map((e) => ({
    id: e.id,
    nameEn: e.nameEn,
    nameAr: e.nameAr,
    positionEn: e.positionEn,
    positionAr: e.positionAr,
    organisationEn: e.organisationEn,
    availability: e.availability,
    reasonEn: reasonMap.get(e.id)?.reason_en ?? "",
    reasonAr: reasonMap.get(e.id)?.reason_ar ?? "",
    kind: kindOf(e),
  }));
}

export async function* askStream(params: {
  user: CurrentUser;
  query: string;
  locale: string;
  scopeDocumentIds?: string[];
}): AsyncGenerator<AskEvent> {
  const { user, query, locale } = params;
  const settings = await getAiSettings();
  const filters = {
    ...filtersForUser(user, settings.allowSecretInAnswers),
    documentIds: params.scopeDocumentIds,
  };
  const scoped = Boolean(params.scopeDocumentIds?.length);
  const [chunkResult, indicatorResult] = await Promise.all([
    retrieveChunks(query, filters, Math.max(settings.maxSources, 8)),
    // statistics join the answer only for unscoped questions
    scoped
      ? Promise.resolve({ sources: [] as AskSource[], bestSimilarity: 0 })
      : retrieveIndicatorSources(query, user, 3),
  ]);
  const { chunks: rawChunks, topSimilarity } = chunkResult;
  const live = await aiLive();
  const rankedChunks: AskSource[] = (
    live ? (await rerankChunks(query, rawChunks)).slice(0, settings.maxSources) : rawChunks
  ).map((c) => ({ ...c, resourceType: "document" as const }));

  // Indicators keep reserved slots so document passages can never crowd them out;
  // for number questions they lead, otherwise documents lead.
  const budget = Math.max(settings.maxSources, 8);
  const docBudget = Math.max(3, budget - indicatorResult.sources.length);
  const docs = rankedChunks.slice(0, docBudget);
  const numberIntent = mockIntent(query).intent === "number";
  const chunks: AskSource[] = numberIntent
    ? [...indicatorResult.sources, ...docs]
    : [...docs, ...indicatorResult.sources];
  const effectiveSimilarity = Math.max(topSimilarity, indicatorResult.bestSimilarity);

  const citations: CitationOut[] = chunks.map((c, i) => ({
    n: i + 1,
    chunk_id: c.chunkId,
    resource_type: c.resourceType,
    resource_id: c.documentId,
    title:
      locale === "ar"
        ? c.documentTitleAr || c.documentTitleEn
        : c.documentTitleEn || c.documentTitleAr,
    page: c.page,
    excerpt: c.text.slice(0, 280),
    lang: c.lang,
  }));
  /* CR08 9.1: the citation cards carry the same person chip the item does */
  await attachCitationOwners(citations);
  yield { type: "sources", citations };

  const answerLang = isArabicText(query) ? "ar" : locale === "ar" ? "ar" : "en";
  const includesSecret = chunks.some((c) => c.classification >= 4);
  let markdown = "";

  if (live && chunks.length && effectiveSimilarity >= 0.3) {
    const sourceBlock = chunks
      .map((c, i) =>
        c.resourceType === "indicator"
          ? `[${i + 1}] (Official statistic from the Statistics Hub: ${c.documentTitleEn}, verified)\n${c.text.slice(0, 1500)}`
          : `[${i + 1}] (${c.documentTitleEn || c.documentTitleAr}${c.page ? `, page ${c.page}` : ""}, ${c.verified ? "verified" : "unverified"}, ${c.lang})\n${c.text.slice(0, 1500)}`
      )
      .join("\n\n");
    const stream = await streamPrompt(
      "system_ask",
      `Answer language: ${answerLang === "ar" ? "Arabic" : "English"}\nUser UI language: ${locale}\n\nQuestion: ${query}\n\nNumbered sources:\n${sourceBlock}`,
      { maxTokens: 2500 }
    );
    if (stream) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            markdown += event.delta.text;
            yield { type: "delta", text: event.delta.text };
          }
        }
      } catch (e) {
        console.error("[ask] stream error", e);
      }
    }
  }

  if (!markdown) {
    const mock = mockAnswer(query, chunks, answerLang, effectiveSimilarity);
    markdown = mock.markdown;
    // stream the mock in small pieces so the UI behaves identically
    for (let i = 0; i < markdown.length; i += 80) {
      yield { type: "delta", text: markdown.slice(i, i + 80) };
    }
  }

  const coverage = citationCoverage(markdown);
  const noSourceLine = /could not find a reliable EnviroAI source|لم أجد مصدراً موثوقاً/.test(markdown);
  const confidence = noSourceLine
    ? "low"
    : computeConfidence(chunks, effectiveSimilarity, coverage);

  const usedNs = new Set(
    [...markdown.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]))
  );
  const usedCitations = citations.filter((c) => usedNs.has(c.n));

  const suggested =
    confidence === "low"
      ? await suggestExpertsGrouped(query, user, 3)
      : { internal: [], external: [], all: [] };

  const followUps: string[] = [];
  yield {
    type: "final",
    markdown,
    citations: usedCitations.length ? usedCitations : citations.slice(0, 3),
    confidence,
    suggestedExperts: suggested.all,
    suggestedExpertGroups: { internal: suggested.internal, external: suggested.external },
    followUps,
    includesSecret,
    chunkIds: chunks.map((c) => c.chunkId),
  };
}
