// Vector search: brute-force cosine over BLOB Float32 embeddings.
// The single interface searchSimilar(embedding, filters, k) is the swap point for pgvector.
import { rawClient } from "@/server/db/client";
import { bufferToFloat32, cosine, embeddingModelName } from "@/server/ai/embeddings";

export type VectorFilters = {
  maxClassification: number;
  departmentId?: string | null;
  departmentScope?: "all" | "own";
  excludeSecret?: boolean;
  documentIds?: string[];
  resourceTypes?: string[];
};

export type ChunkVectorHit = {
  chunkId: string;
  documentId: string;
  pageFrom: number | null;
  heading: string | null;
  text: string;
  lang: string;
  score: number;
};

export type RecordVectorHit = {
  resourceType: string;
  resourceId: string;
  text: string;
  score: number;
};

export async function searchSimilarChunks(
  query: Float32Array,
  filters: VectorFilters,
  k = 40
): Promise<ChunkVectorHit[]> {
  const model = embeddingModelName();
  const maxCls = filters.excludeSecret
    ? Math.min(filters.maxClassification, 3)
    : filters.maxClassification;
  let sql = `SELECT dc.id, dc.document_id, dc.page_from, dc.heading, dc.text, dc.lang, dc.embedding
             FROM document_chunks dc
             JOIN documents d ON d.id = dc.document_id
             WHERE dc.embedding IS NOT NULL
               AND dc.embedding_model = ?
               AND d.deleted_at IS NULL
               AND d.classification_level <= ?`;
  const args: unknown[] = [model, maxCls];
  if (filters.departmentScope === "own") {
    sql += ` AND (d.department_id IS NULL OR d.department_id = ?)`;
    args.push(filters.departmentId ?? "");
  }
  if (filters.documentIds?.length) {
    sql += ` AND dc.document_id IN (${filters.documentIds.map(() => "?").join(",")})`;
    args.push(...filters.documentIds);
  }
  const res = await rawClient.execute({ sql, args: args as any });
  const scored: ChunkVectorHit[] = [];
  for (const r of res.rows) {
    const emb = r.embedding as unknown;
    if (!emb) continue;
    const vec = bufferToFloat32(
      Buffer.isBuffer(emb) ? emb : Buffer.from(emb as ArrayBuffer)
    );
    const score = cosine(query, vec);
    scored.push({
      chunkId: String(r.id),
      documentId: String(r.document_id),
      pageFrom: r.page_from === null ? null : Number(r.page_from),
      heading: r.heading === null ? null : String(r.heading),
      text: String(r.text),
      lang: String(r.lang),
      score,
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

export async function searchSimilarRecords(
  query: Float32Array,
  filters: VectorFilters,
  k = 40
): Promise<RecordVectorHit[]> {
  const model = embeddingModelName();
  let sql = `SELECT resource_type, resource_id, text, embedding FROM search_index
             WHERE embedding IS NOT NULL AND embedding_model = ?`;
  const args: unknown[] = [model];
  if (filters.resourceTypes?.length) {
    sql += ` AND resource_type IN (${filters.resourceTypes.map(() => "?").join(",")})`;
    args.push(...filters.resourceTypes);
  }
  const res = await rawClient.execute({ sql, args: args as any });
  const scored: RecordVectorHit[] = [];
  for (const r of res.rows) {
    const emb = r.embedding as unknown;
    if (!emb) continue;
    const vec = bufferToFloat32(
      Buffer.isBuffer(emb) ? emb : Buffer.from(emb as ArrayBuffer)
    );
    scored.push({
      resourceType: String(r.resource_type),
      resourceId: String(r.resource_id),
      text: String(r.text),
      score: cosine(query, vec),
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

/** Document-level vector = mean of its chunk vectors. Used for duplicate detection. */
export async function documentMeanVector(documentId: string): Promise<Float32Array | null> {
  const res = await rawClient.execute({
    sql: `SELECT embedding FROM document_chunks WHERE document_id = ? AND embedding IS NOT NULL LIMIT 200`,
    args: [documentId],
  });
  const vecs = res.rows
    .map((r) => r.embedding)
    .filter(Boolean)
    .map((e) => bufferToFloat32(Buffer.isBuffer(e) ? (e as Buffer) : Buffer.from(e as ArrayBuffer)));
  if (!vecs.length) return null;
  const dim = vecs[0].length;
  const mean = new Float32Array(dim);
  for (const v of vecs) {
    if (v.length !== dim) continue;
    for (let i = 0; i < dim; i++) mean[i] += v[i];
  }
  for (let i = 0; i < dim; i++) mean[i] /= vecs.length;
  return mean;
}
