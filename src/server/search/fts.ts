// FTS5 keyword search over document chunks and structured records.
import { rawClient } from "@/server/db/client";

export type FtsChunkHit = {
  chunkId: string;
  documentId: string;
  pageFrom: number | null;
  text: string;
  lang: string;
  rank: number;
};

export type FtsRecordHit = {
  resourceType: string;
  resourceId: string;
  text: string;
  rank: number;
};

/** Escape a user query for FTS5: quoted tokens joined with OR for recall. */
export function ftsQuery(q: string): string {
  const tokens = q
    .replace(/["'()*:^]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .slice(0, 12);
  if (!tokens.length) return "";
  return tokens.map((t) => `"${t}"`).join(" OR ");
}

export async function ftsChunks(q: string, limit = 40): Promise<FtsChunkHit[]> {
  const match = ftsQuery(q);
  if (!match) return [];
  try {
    const res = await rawClient.execute({
      sql: `SELECT dc.id as chunk_id, dc.document_id, dc.page_from, dc.text, dc.lang,
                   bm25(chunks_fts) as rank
            FROM chunks_fts
            JOIN document_chunks dc ON dc.rowid = chunks_fts.rowid
            WHERE chunks_fts MATCH ?
            ORDER BY rank LIMIT ?`,
      args: [match, limit],
    });
    return res.rows.map((r) => ({
      chunkId: String(r.chunk_id),
      documentId: String(r.document_id),
      pageFrom: r.page_from === null ? null : Number(r.page_from),
      text: String(r.text),
      lang: String(r.lang),
      rank: Number(r.rank),
    }));
  } catch (e) {
    console.error("[fts] chunk search failed", e);
    return [];
  }
}

export async function ftsRecords(q: string, limit = 40): Promise<FtsRecordHit[]> {
  const match = ftsQuery(q);
  if (!match) return [];
  try {
    const res = await rawClient.execute({
      sql: `SELECT si.resource_type, si.resource_id, si.text, bm25(records_fts) as rank
            FROM records_fts
            JOIN search_index si ON si.rowid = records_fts.rowid
            WHERE records_fts MATCH ?
            ORDER BY rank LIMIT ?`,
      args: [match, limit],
    });
    return res.rows.map((r) => ({
      resourceType: String(r.resource_type),
      resourceId: String(r.resource_id),
      text: String(r.text),
      rank: Number(r.rank),
    }));
  } catch (e) {
    console.error("[fts] record search failed", e);
    return [];
  }
}

/** Highlighted snippet around the first matched term. */
export function makeSnippet(text: string, q: string, len = 220): string {
  const tokens = q.split(/\s+/).filter((t) => t.length > 1);
  let pos = -1;
  for (const t of tokens) {
    const i = text.toLowerCase().indexOf(t.toLowerCase());
    if (i !== -1 && (pos === -1 || i < pos)) pos = i;
  }
  if (pos === -1) return text.slice(0, len) + (text.length > len ? "…" : "");
  const start = Math.max(0, pos - Math.floor(len / 3));
  const chunk = text.slice(start, start + len);
  return (start > 0 ? "…" : "") + chunk + (start + len < text.length ? "…" : "");
}
