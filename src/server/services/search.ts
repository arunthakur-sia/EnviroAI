// Full hybrid search backing /search. Fuses record + chunk retrieval, resolves
// titles and snippets, logs to search_log.
import { inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { retrieveChunks, retrieveRecords } from "@/server/search/hybrid";
import { classifyIntent } from "@/server/ai";
import { makeSnippet } from "@/server/search/fts";
import { canReadResource } from "@/server/auth/permissions";
import type { CurrentUser } from "@/server/auth/session";
import { newId, nowIso } from "@/lib/ids";

export type SearchResult = {
  type: string;
  id: string;
  titleEn: string;
  titleAr: string;
  snippet: string;
  snippetLang: string;
  semantic: boolean;
  page: number | null;
  score: number;
  verified?: boolean;
};

export async function runSearch(user: CurrentUser, q: string, _locale: string) {
  const intent = await classifyIntent(q);
  const filters = {
    maxClassification: user.clearanceLevel,
    departmentId: user.departmentId,
    departmentScope: (user.departmentScope === "own" ? "own" : "all") as "own" | "all",
    excludeSecret: user.clearanceLevel < 4,
  };
  const [records, chunkResult, ftsRecordHits, ftsChunkHits] = await Promise.all([
    retrieveRecords(q, filters, 24),
    retrieveChunks(q, filters, 12),
    import("@/server/search/fts").then((m) => m.ftsRecords(q, 1)),
    import("@/server/search/fts").then((m) => m.ftsChunks(q, 1)),
  ]);

  // Zero-signal gate: vector search always returns nearest neighbours, so a
  // query counts as answered only with a keyword hit or a real semantic match.
  const hasSignal =
    ftsRecordHits.length > 0 || ftsChunkHits.length > 0 || chunkResult.topSimilarity >= 0.35;
  if (!hasSignal) {
    await db.insert(schema.searchLog).values({
      id: newId(),
      userId: user.id,
      query: q,
      lang: intent.lang,
      intent: intent.intent,
      resultCount: 0,
      createdAt: nowIso(),
    });
    return { intent, results: [] as SearchResult[] };
  }

  const results: SearchResult[] = [];
  const seenDocs = new Set<string>();

  // resolve record titles + clearance
  const byType = new Map<string, string[]>();
  for (const r of records) {
    (byType.get(r.resourceType) ?? byType.set(r.resourceType, []).get(r.resourceType)!).push(
      r.resourceId
    );
  }
  const titleMap = new Map<string, { titleEn: string; titleAr: string; verified?: boolean; cls?: number; dept?: string | null }>();
  if (byType.get("document")?.length) {
    const docs = await db
      .select()
      .from(schema.documents)
      .where(inArray(schema.documents.id, byType.get("document")!));
    for (const d of docs) {
      if (d.deletedAt) continue;
      if (!canReadResource(user, { classificationLevel: d.classificationLevel, departmentId: d.departmentId })) continue;
      titleMap.set(`document:${d.id}`, {
        titleEn: d.titleEn,
        titleAr: d.titleAr,
        verified: d.status === "verified",
      });
    }
  }
  const simpleLookups: [string, any][] = [
    ["indicator", schema.indicators],
    ["node", schema.strategyNodes],
    ["expert", schema.experts],
    ["question", schema.questions],
    ["lesson", schema.lessons],
  ];
  for (const [type, table] of simpleLookups) {
    const ids = byType.get(type);
    if (!ids?.length) continue;
    const rows = await db.select().from(table).where(inArray(table.id, ids));
    for (const r of rows as any[]) {
      const cls = r.classificationLevel ?? 1;
      if (cls > user.clearanceLevel) continue;
      titleMap.set(`${type}:${r.id}`, {
        titleEn: r.titleEn ?? r.nameEn ?? "",
        titleAr: r.titleAr ?? r.nameAr ?? "",
      });
    }
  }

  for (const r of records) {
    const meta = titleMap.get(`${r.resourceType}:${r.resourceId}`);
    if (!meta) continue;
    if (r.resourceType === "document") seenDocs.add(r.resourceId);
    results.push({
      type: r.resourceType,
      id: r.resourceId,
      titleEn: meta.titleEn,
      titleAr: meta.titleAr,
      snippet: makeSnippet(r.text.replace(/\s*\|\s*/g, " · "), q),
      snippetLang: "en",
      semantic: !r.text.toLowerCase().includes(q.toLowerCase().split(/\s+/)[0] ?? ""),
      page: null,
      score: r.score,
      verified: meta.verified,
    });
  }

  // chunk-level passages for documents not already present
  for (const c of chunkResult.chunks) {
    if (seenDocs.has(c.documentId)) continue;
    seenDocs.add(c.documentId);
    results.push({
      type: "document",
      id: c.documentId,
      titleEn: c.documentTitleEn,
      titleAr: c.documentTitleAr,
      snippet: makeSnippet(c.text, q),
      snippetLang: c.lang,
      semantic: !c.text.toLowerCase().includes(q.toLowerCase().split(/\s+/)[0] ?? ""),
      page: c.page,
      score: c.score * 0.9,
      verified: c.verified,
    });
  }

  results.sort((a, b) => b.score - a.score);

  await db.insert(schema.searchLog).values({
    id: newId(),
    userId: user.id,
    query: q,
    lang: intent.lang,
    intent: intent.intent,
    resultCount: results.length,
    createdAt: nowIso(),
  });

  return { intent, results };
}
