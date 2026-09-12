// Hybrid retrieval: FTS (BM25) and vector similarity fused with reciprocal rank fusion,
// verified boost x1.3, recency boost for statistics, permission filters in SQL.
import { inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { embedQuery } from "@/server/ai/embeddings";
import { ftsChunks, ftsRecords } from "./fts";
import {
  searchSimilarChunks,
  searchSimilarRecords,
  type VectorFilters,
} from "./vector";

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  documentTitleEn: string;
  documentTitleAr: string;
  page: number | null;
  heading: string | null;
  text: string;
  lang: string;
  classification: number;
  verified: boolean;
  score: number;
};

export type RecordHit = {
  resourceType: string;
  resourceId: string;
  text: string;
  score: number;
};

const RRF_K = 60;

export async function retrieveChunks(
  query: string,
  filters: VectorFilters,
  k = 8
): Promise<{ chunks: RetrievedChunk[]; topSimilarity: number }> {
  const { vector } = await embedQuery(query);
  const [ftsHits, vecHits] = await Promise.all([
    ftsChunks(query, 40),
    searchSimilarChunks(vector, filters, 40),
  ]);

  const fused = new Map<string, { score: number; sim: number }>();
  ftsHits.forEach((h, i) => {
    const cur = fused.get(h.chunkId) ?? { score: 0, sim: 0 };
    cur.score += 1 / (RRF_K + i + 1);
    fused.set(h.chunkId, cur);
  });
  vecHits.forEach((h, i) => {
    const cur = fused.get(h.chunkId) ?? { score: 0, sim: 0 };
    cur.score += 1 / (RRF_K + i + 1);
    cur.sim = Math.max(cur.sim, h.score);
    fused.set(h.chunkId, cur);
  });
  if (!fused.size) return { chunks: [], topSimilarity: 0 };

  const ids = [...fused.keys()];
  const rows = await db
    .select({
      id: schema.documentChunks.id,
      documentId: schema.documentChunks.documentId,
      pageFrom: schema.documentChunks.pageFrom,
      heading: schema.documentChunks.heading,
      text: schema.documentChunks.text,
      lang: schema.documentChunks.lang,
    })
    .from(schema.documentChunks)
    .where(inArray(schema.documentChunks.id, ids));

  const docIds = [...new Set(rows.map((r) => r.documentId))];
  const docs = docIds.length
    ? await db
        .select({
          id: schema.documents.id,
          titleEn: schema.documents.titleEn,
          titleAr: schema.documents.titleAr,
          status: schema.documents.status,
          classification: schema.documents.classificationLevel,
          knowledgeType: schema.documents.knowledgeTypeTermId,
          deletedAt: schema.documents.deletedAt,
          departmentId: schema.documents.departmentId,
          updatedAt: schema.documents.updatedAt,
        })
        .from(schema.documents)
        .where(inArray(schema.documents.id, docIds))
    : [];
  const docMap = new Map(docs.map((d) => [d.id, d]));

  const maxCls = filters.excludeSecret
    ? Math.min(filters.maxClassification, 3)
    : filters.maxClassification;

  const result: RetrievedChunk[] = [];
  let topSimilarity = 0;
  for (const r of rows) {
    const doc = docMap.get(r.documentId);
    if (!doc || doc.deletedAt) continue;
    if (doc.classification > maxCls) continue;
    if (
      filters.departmentScope === "own" &&
      doc.departmentId &&
      doc.departmentId !== filters.departmentId
    )
      continue;
    const f = fused.get(r.id)!;
    let score = f.score;
    if (doc.status === "verified") score *= 1.3;
    // recency boost for recent statistical releases
    const ageDays = (Date.now() - new Date(doc.updatedAt).getTime()) / 86400000;
    if (ageDays < 90) score *= 1.1;
    topSimilarity = Math.max(topSimilarity, f.sim);
    result.push({
      chunkId: r.id,
      documentId: r.documentId,
      documentTitleEn: doc.titleEn,
      documentTitleAr: doc.titleAr,
      page: r.pageFrom,
      heading: r.heading,
      text: r.text,
      lang: r.lang,
      classification: doc.classification,
      verified: doc.status === "verified",
      score,
    });
  }
  result.sort((a, b) => b.score - a.score);
  return { chunks: result.slice(0, k), topSimilarity };
}

export async function retrieveRecords(
  query: string,
  filters: VectorFilters,
  k = 12
): Promise<RecordHit[]> {
  const { vector } = await embedQuery(query);
  const [ftsHits, vecHits] = await Promise.all([
    ftsRecords(query, 30),
    searchSimilarRecords(vector, filters, 30),
  ]);
  const fused = new Map<string, { hit: RecordHit; score: number }>();
  const keyOf = (t: string, i: string) => `${t}:${i}`;
  ftsHits.forEach((h, i) => {
    const key = keyOf(h.resourceType, h.resourceId);
    const cur =
      fused.get(key) ??
      ({ hit: { resourceType: h.resourceType, resourceId: h.resourceId, text: h.text, score: 0 }, score: 0 });
    cur.score += 1 / (RRF_K + i + 1);
    fused.set(key, cur);
  });
  vecHits.forEach((h, i) => {
    const key = keyOf(h.resourceType, h.resourceId);
    const cur =
      fused.get(key) ??
      ({ hit: { resourceType: h.resourceType, resourceId: h.resourceId, text: h.text, score: 0 }, score: 0 });
    cur.score += 1 / (RRF_K + i + 1);
    fused.set(key, cur);
  });
  const out = [...fused.values()]
    .map((f) => ({ ...f.hit, score: f.score }))
    .sort((a, b) => b.score - a.score);
  if (filters.resourceTypes?.length) {
    const allowed = new Set(filters.resourceTypes);
    return out.filter((o) => allowed.has(o.resourceType)).slice(0, k);
  }
  return out.slice(0, k);
}
