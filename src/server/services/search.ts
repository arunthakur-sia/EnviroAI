// Full hybrid search backing /search. Fuses record + chunk retrieval, resolves
// titles and snippets, logs to search_log.
import { inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { retrieveChunks, retrieveRecords } from "@/server/search/hybrid";
import { classifyIntent } from "@/server/ai";
import { makeSnippet } from "@/server/search/fts";
import { canReadResource } from "@/server/auth/permissions";
import type { CurrentUser } from "@/server/auth/session";
import { ownerKey, resolveOwners, type OwnerChip } from "@/server/services/owner-lookup";
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
  /* CR08 3: expert results say which register they belong to */
  kind?: "internal" | "external";
  /* CR08 9.1: the person behind the result (a document's custodian, a
     strategy node's owner, a lesson's author), absent when none is recorded */
  owner?: OwnerChip | null;
};

/** CR08 3: the expert results in two labelled groups, internal first. */
export type ExpertGroups = { internal: SearchResult[]; external: SearchResult[] };

export function groupExpertResults(results: SearchResult[]): ExpertGroups {
  const experts = results.filter((r) => r.type === "expert");
  return {
    internal: experts.filter((r) => r.kind !== "external"),
    external: experts.filter((r) => r.kind === "external"),
  };
}

export async function runSearch(user: CurrentUser, q: string, _locale: string) {
  const intent = await classifyIntent(q);
  const filters = {
    maxClassification: user.clearanceLevel,
    departmentId: user.departmentId,
    departmentScope: (user.departmentScope === "own" ? "own" : "all") as "own" | "all",
    excludeSecret: user.clearanceLevel < 4,
  };
  const [recordsRaw, chunkResult, ftsRecordHits, ftsChunkHits] = await Promise.all([
    retrieveRecords(q, filters, 24),
    retrieveChunks(q, filters, 12),
    import("@/server/search/fts").then((m) => m.ftsRecords(q, 1)),
    import("@/server/search/fts").then((m) => m.ftsChunks(q, 1)),
  ]);
  // CR05 6.1: results from hidden portals do not exist for this user
  const { hiddenResourceTypes } = await import("@/server/auth/permissions");
  const hidden = hiddenResourceTypes(user);
  const records = recordsRaw.filter((r) => !hidden.has(r.resourceType));
  const vaultHidden = hidden.has("document");

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
    return {
      intent,
      results: [] as SearchResult[],
      expertGroups: { internal: [], external: [] } as ExpertGroups,
    };
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
  const titleMap = new Map<
    string,
    { titleEn: string; titleAr: string; verified?: boolean; cls?: number; dept?: string | null; kind?: "internal" | "external" }
  >();
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
      const cls = r.classificationLevel ?? r.visibilityClassification ?? 1;
      if (cls > user.clearanceLevel) continue;
      titleMap.set(`${type}:${r.id}`, {
        titleEn: r.titleEn ?? r.nameEn ?? "",
        titleAr: r.titleAr ?? r.nameAr ?? "",
        // CR08 3: NPC staff are internal, everyone else external
        kind:
          type === "expert"
            ? r.userId || r.type === "npc_employee"
              ? "internal"
              : "external"
            : undefined,
        verified: type === "expert" ? r.isVerified === 1 : undefined,
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
      kind: meta.kind,
    });
  }

  // chunk-level passages for documents not already present (unless the Vault
  // portal is hidden for this user, CR05 6.1)
  for (const c of vaultHidden ? [] : chunkResult.chunks) {
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

  /* CR08 9.1: the person behind each result, in one bulk pass: documents join
     their custodian, strategy nodes their owner, lessons their author. A
     result with nobody recorded simply carries no owner. */
  const owners = await resolveOwners(
    results
      .filter((r) => r.type === "document" || r.type === "node" || r.type === "lesson")
      .map((r) => ({ type: r.type, id: r.id }))
  );
  for (const r of results) {
    const owner = owners[ownerKey(r.type, r.id)];
    if (owner) r.owner = owner;
  }

  await db.insert(schema.searchLog).values({
    id: newId(),
    userId: user.id,
    query: q,
    lang: intent.lang,
    intent: intent.intent,
    resultCount: results.length,
    createdAt: nowIso(),
  });

  // CR08 3: the flat list keeps its shape for older callers; the two expert
  // groups ride alongside, internal first, never blended.
  return { intent, results, expertGroups: groupExpertResults(results) };
}
