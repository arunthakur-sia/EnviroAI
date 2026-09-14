// Shared persistence for scan candidates: dedupe, store, link to NDS3 nodes and
// indicators, and index accepted signals for retrieval.
import crypto from "node:crypto";
import { and, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { newId, nowIso } from "@/lib/ids";
import {
  embedTexts,
  bufferToFloat32,
  float32ToBuffer,
  cosine,
} from "@/server/ai/embeddings";

export type CandidateSignal = {
  title_en: string;
  title_ar: string;
  summary_en: string;
  summary_ar: string;
  why_en: string;
  why_ar: string;
  url: string | null;
  publisher: string | null;
  published_at: string | null;
  signal_type: string;
  impact: string;
  horizon: string;
  sentiment: string;
  confidence: number;
  outcome_codes: string[];
  indicator_codes: string[];
  source_excerpt?: string | null;
};

const SIGNAL_TYPES = new Set([
  "policy",
  "market",
  "technology",
  "social",
  "environment",
  "geopolitical",
  "index",
  "research",
]);

export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    u.hash = "";
    for (const p of [...u.searchParams.keys()]) {
      if (/^utm_|^fbclid|^gclid|^ref$/.test(p)) u.searchParams.delete(p);
    }
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return url.trim() || null;
  }
}

export function candidateHash(c: {
  title_en?: string | null;
  publisher?: string | null;
  published_at?: string | null;
}): string {
  return crypto
    .createHash("sha1")
    .update(
      `${(c.title_en ?? "").toLowerCase().trim()}|${(c.publisher ?? "").toLowerCase().trim()}|${c.published_at ?? ""}`
    )
    .digest("hex");
}

/** Maps taxonomy outcome codes to the NDS3 outcome node ids (by sort order). */
export async function outcomeNodeMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const [edition] = await db
    .select()
    .from(schema.strategyEditions)
    .where(eq(schema.strategyEditions.code, "nds3"))
    .limit(1);
  if (!edition) return map;
  const outcomes = await db
    .select()
    .from(schema.strategyNodes)
    .where(
      and(
        eq(schema.strategyNodes.editionId, edition.id),
        eq(schema.strategyNodes.nodeType, "outcome")
      )
    )
    .orderBy(schema.strategyNodes.sort);
  const terms = await db
    .select({ code: schema.taxonomyTerms.code, sort: schema.taxonomyTerms.sort })
    .from(schema.taxonomyTerms)
    .innerJoin(
      schema.taxonomyDimensions,
      eq(schema.taxonomyDimensions.id, schema.taxonomyTerms.dimensionId)
    )
    .where(eq(schema.taxonomyDimensions.code, "outcome"))
    .orderBy(schema.taxonomyTerms.sort);
  terms.forEach((t, i) => {
    if (outcomes[i]) map.set(t.code, outcomes[i].id);
  });
  return map;
}

export async function indicatorCodeMap(): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: schema.indicators.id, code: schema.indicators.code })
    .from(schema.indicators);
  return new Map(rows.map((r) => [r.code, r.id]));
}

export type PersistResult = {
  added: string[];
  duplicates: number;
  rejected: number;
};

/**
 * Dedupe and store candidates. Duplicate when: same normalised URL, same
 * title+publisher+date hash, or embedding similarity > 0.9 to an existing signal.
 */
export async function persistCandidates(
  candidates: CandidateSignal[],
  meta: {
    sourceKind: "web_search" | "rss" | "manual";
    scanRunId?: string | null;
    createdBy?: string | null;
    triageStatus?: string;
  }
): Promise<PersistResult> {
  const result: PersistResult = { added: [], duplicates: 0, rejected: 0 };
  if (!candidates.length) return result;

  const existing = await db
    .select({
      id: schema.signals.id,
      url: schema.signals.url,
      titleEn: schema.signals.titleEn,
      publisher: schema.signals.publisher,
      publishedAt: schema.signals.publishedAt,
      embedding: schema.signals.embedding,
      embeddingModel: schema.signals.embeddingModel,
    })
    .from(schema.signals);
  const existingUrls = new Set(
    existing.map((e) => normalizeUrl(e.url)).filter(Boolean) as string[]
  );
  const existingHashes = new Set(
    existing.map((e) =>
      candidateHash({ title_en: e.titleEn, publisher: e.publisher, published_at: e.publishedAt })
    )
  );

  const valid = candidates.filter((c) => {
    if (!c.title_en && !c.title_ar) return false;
    if (!SIGNAL_TYPES.has(c.signal_type)) c.signal_type = "policy";
    return true;
  });
  result.rejected = candidates.length - valid.length;
  if (!valid.length) return result;

  const { vectors, model } = await embedTexts(
    valid.map((c) => `${c.title_en} ${c.summary_en} ${c.title_ar}`.slice(0, 2000))
  );
  const existingVectors = existing
    .filter((e) => e.embedding && e.embeddingModel === model)
    .map((e) => ({
      id: e.id,
      vec: bufferToFloat32(e.embedding as Buffer),
    }));

  const nodeMap = await outcomeNodeMap();
  const indMap = await indicatorCodeMap();
  const addedVectors: Float32Array[] = [];

  for (let i = 0; i < valid.length; i++) {
    const c = valid[i];
    const url = normalizeUrl(c.url);
    const hash = candidateHash(c);
    if (url && existingUrls.has(url)) {
      result.duplicates++;
      continue;
    }
    if (existingHashes.has(hash)) {
      result.duplicates++;
      continue;
    }
    const vec = vectors[i];
    const tooSimilar =
      existingVectors.some((e) => cosine(vec, e.vec) > 0.9) ||
      addedVectors.some((v) => cosine(vec, v) > 0.9);
    if (tooSimilar) {
      result.duplicates++;
      continue;
    }

    const id = newId();
    await db.insert(schema.signals).values({
      id,
      titleEn: c.title_en || c.title_ar,
      titleAr: c.title_ar || c.title_en,
      descriptionEn: c.summary_en || null,
      descriptionAr: c.summary_ar || null,
      source: c.publisher ?? null,
      impact: ["low", "medium", "high"].includes(c.impact) ? c.impact : "medium",
      horizon: ["near", "mid", "long"].includes(c.horizon) ? c.horizon : "mid",
      createdBy: meta.createdBy ?? null,
      createdAt: nowIso(),
      sourceKind: meta.sourceKind,
      url: url,
      publisher: c.publisher ?? null,
      publishedAt: c.published_at ?? null,
      signalType: c.signal_type,
      sentiment: ["positive", "neutral", "negative", "mixed"].includes(c.sentiment)
        ? c.sentiment
        : "neutral",
      confidence: Math.min(1, Math.max(0, Number(c.confidence) || 0.6)),
      whyItMattersEn: c.why_en || null,
      whyItMattersAr: c.why_ar || null,
      triageStatus: meta.triageStatus ?? "new",
      scanRunId: meta.scanRunId ?? null,
      rawJson: JSON.stringify(c).slice(0, 20000),
      sourceExcerpt: c.source_excerpt?.slice(0, 600) ?? null,
      embedding: float32ToBuffer(vec),
      embeddingModel: model,
    });
    addedVectors.push(vec);
    if (url) existingUrls.add(url);
    existingHashes.add(hash);

    for (const code of c.outcome_codes ?? []) {
      const nodeId = nodeMap.get(code);
      if (!nodeId) continue;
      await db.insert(schema.signalLinks).values({
        id: newId(),
        signalId: id,
        resourceType: "node",
        resourceId: nodeId,
        relation: "about",
        source: "ai",
        createdAt: nowIso(),
      });
    }
    for (const code of c.indicator_codes ?? []) {
      const indId = indMap.get(code);
      if (!indId) continue;
      await db.insert(schema.signalLinks).values({
        id: newId(),
        signalId: id,
        resourceType: "indicator",
        resourceId: indId,
        relation: "about",
        source: "ai",
        createdAt: nowIso(),
      });
    }
    // CR05 7: signals about a ranking link to the Indices module (the CR01
    // index_rankings tracker rows stay linked too for old deep links)
    if (c.signal_type === "index") {
      try {
        const title = `${c.title_en} ${c.summary_en}`.toLowerCase();
        const indices = await db
          .select({ id: schema.indices.id, nameEn: schema.indices.nameEn })
          .from(schema.indices);
        for (const idx of indices) {
          const words = idx.nameEn.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
          const matched = words.length >= 2 && words.filter((w) => title.includes(w)).length >= 2;
          if (matched) {
            await db.insert(schema.signalLinks).values({
              id: newId(),
              signalId: id,
              resourceType: "index",
              resourceId: idx.id,
              relation: "about",
              source: "ai",
              createdAt: nowIso(),
            });
            // an accepted signal about an index nudges its forecast (4.6.11)
          }
        }
        const rankings = await db
          .select({ id: schema.indexRankings.id, nameEn: schema.indexRankings.indexNameEn })
          .from(schema.indexRankings);
        for (const rk of rankings) {
          const words = rk.nameEn.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
          const matched = words.length >= 2 && words.filter((w) => title.includes(w)).length >= 2;
          if (matched) {
            await db.insert(schema.signalLinks).values({
              id: newId(),
              signalId: id,
              resourceType: "ranking",
              resourceId: rk.id,
              relation: "about",
              source: "ai",
              createdAt: nowIso(),
            });
          }
        }
      } catch {
        /* linking is best-effort */
      }
    }
    if (meta.triageStatus === "accepted") {
      await indexSignal(id);
    }
    result.added.push(id);
  }
  return result;
}

/** Adds/updates the accepted signal in the unified retrieval index. */
export async function indexSignal(signalId: string): Promise<void> {
  const { embedStructuredRecords } = await import("@/server/search/records");
  await embedStructuredRecords("signal", signalId);
}
