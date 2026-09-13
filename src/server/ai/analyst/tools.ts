// The analyst's tools. Every tool is permission-filtered by the calling user,
// returns a compact JSON payload for the model, registers numbered sources for
// citations, and contributes typed sections to the answer workspace.
import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { canReadResource } from "@/server/auth/permissions";
import { retrieveChunks, retrieveRecords } from "@/server/search/hybrid";
import { filtersForUser, suggestExperts } from "@/server/ai/ask";
import { getAiSettings } from "@/server/settings";
import { whatChanged } from "@/server/ai";
import { listSignals } from "@/server/services/signals";

/* ------------------------------------------------------------------ */
/* Loop state: sources registry + workspace accumulation               */
/* ------------------------------------------------------------------ */

export type SourceRef = {
  n: number;
  resource_type: string;
  resource_id: string;
  title: string;
  page: number | null;
  excerpt: string;
  lang?: string;
  edition?: string | null;
  classification?: number;
  verified?: boolean;
};

export type WorkspaceStrategyCard = {
  id: string;
  code: string | null;
  nodeType: string;
  titleEn: string;
  titleAr: string;
  status: string;
  editionCode: string;
  ownerName: string | null;
  classification?: number;
  kpi: {
    nameEn: string;
    nameAr: string;
    unit: string | null;
    latest: number | null;
    latestPeriod: string | null;
    target: number | null;
    targetYear: number | null;
  } | null;
};

export type WorkspaceIndicator = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  unit: string | null;
  decimals: number;
  direction: string;
  classification: number;
  latest: { period: string; value: number } | null;
  previous: { period: string; value: number } | null;
  target: { value: number; year: number | null } | null;
  gapToTarget: number | null;
  series: { period: string; value: number }[];
};

export type WorkspaceDocument = {
  id: string;
  titleEn: string;
  titleAr: string;
  summaryEn: string | null;
  summaryAr: string | null;
  page: number | null;
  status: string;
  classification: number;
  /* CR02 2.3: set when the document is a deliverable of a node */
  deliverable?: { code: string; nodeCode: string | null } | null;
};

export type WorkspaceLesson = {
  id: string;
  kind: "lesson" | "decision";
  /* CR02 3.1: delivery | external | expert | institutional */
  category?: string | null;
  titleEn: string;
  titleAr: string;
  learningEn: string | null;
  learningAr: string | null;
  recommendationEn: string | null;
  recommendationAr: string | null;
  status: string;
  classification?: number;
};

export type WorkspaceSignal = {
  id: string;
  titleEn: string;
  titleAr: string;
  whyItMattersEn: string | null;
  whyItMattersAr: string | null;
  publisher: string | null;
  publishedAt: string | null;
  signalType: string;
  impact: string;
};

export type WorkspacePerson = {
  id: string;
  nameEn: string;
  nameAr: string;
  positionEn: string | null;
  positionAr: string | null;
  organisationEn: string | null;
  availability: string;
  reasonEn: string;
  reasonAr: string;
};

export type Workspace = {
  strategy: WorkspaceStrategyCard[];
  numbers: WorkspaceIndicator[];
  documents: WorkspaceDocument[];
  lessons: WorkspaceLesson[];
  signals: WorkspaceSignal[];
  people: WorkspacePerson[];
};

export class AnalystState {
  sources: SourceRef[] = [];
  workspace: Workspace = {
    strategy: [],
    numbers: [],
    documents: [],
    lessons: [],
    signals: [],
    people: [],
  };
  toolCalls = 0;

  addSource(s: Omit<SourceRef, "n">): number {
    const existing = this.sources.find(
      (x) => x.resource_type === s.resource_type && x.resource_id === s.resource_id && x.page === s.page
    );
    if (existing) return existing.n;
    const n = this.sources.length + 1;
    this.sources.push({ ...s, n });
    return n;
  }
}

function dedupePush<T extends { id: string }>(list: T[], item: T, cap = 8) {
  if (list.some((x) => x.id === item.id)) return;
  if (list.length >= cap) return;
  list.push(item);
}

/* ------------------------------------------------------------------ */
/* Tool implementations                                                */
/* ------------------------------------------------------------------ */

export type ToolContext = { user: CurrentUser; state: AnalystState };

async function editionByCode(code?: string | null) {
  const editions = await db.select().from(schema.strategyEditions);
  if (!code) return { edition: editions.find((e) => e.isDefault === 1) ?? editions[0], editions };
  return { edition: editions.find((e) => e.code === code) ?? null, editions };
}

async function outcomeTermSort(): Promise<{ code: string; sort: number; nameEn: string; nameAr: string }[]> {
  return db
    .select({
      code: schema.taxonomyTerms.code,
      sort: schema.taxonomyTerms.sort,
      nameEn: schema.taxonomyTerms.nameEn,
      nameAr: schema.taxonomyTerms.nameAr,
    })
    .from(schema.taxonomyTerms)
    .innerJoin(
      schema.taxonomyDimensions,
      eq(schema.taxonomyDimensions.id, schema.taxonomyTerms.dimensionId)
    )
    .where(eq(schema.taxonomyDimensions.code, "outcome"))
    .orderBy(schema.taxonomyTerms.sort);
}

/** Maps an outcome taxonomy code to the outcome node of the given edition. */
async function outcomeNodeForEdition(
  editionId: string,
  outcomeCode: string
): Promise<string | null> {
  const outcomes = await db
    .select()
    .from(schema.strategyNodes)
    .where(
      and(
        eq(schema.strategyNodes.editionId, editionId),
        eq(schema.strategyNodes.nodeType, "outcome")
      )
    )
    .orderBy(asc(schema.strategyNodes.sort));
  const terms = await outcomeTermSort();
  const idx = terms.findIndex((t) => t.code === outcomeCode);
  return idx >= 0 && outcomes[idx] ? outcomes[idx].id : null;
}

/** All node ids in the subtree rooted at the given nodes (inclusive). */
async function subtreeIds(editionId: string, rootIds: string[]): Promise<Set<string>> {
  const all = await db
    .select({ id: schema.strategyNodes.id, parentId: schema.strategyNodes.parentId })
    .from(schema.strategyNodes)
    .where(eq(schema.strategyNodes.editionId, editionId));
  const children = new Map<string | null, string[]>();
  for (const n of all) {
    const list = children.get(n.parentId) ?? [];
    list.push(n.id);
    children.set(n.parentId, list);
  }
  const seen = new Set<string>(rootIds);
  const queue = [...rootIds];
  while (queue.length) {
    const cur = queue.pop()!;
    for (const c of children.get(cur) ?? []) {
      if (!seen.has(c)) {
        seen.add(c);
        queue.push(c);
      }
    }
  }
  return seen;
}

async function nodeCard(
  state: AnalystState,
  node: typeof schema.strategyNodes.$inferSelect,
  editionCode: string
): Promise<WorkspaceStrategyCard> {
  const kpisRows = await db
    .select()
    .from(schema.kpis)
    .where(eq(schema.kpis.nodeId, node.id))
    .limit(1);
  let kpi: WorkspaceStrategyCard["kpi"] = null;
  if (kpisRows.length) {
    const k = kpisRows[0];
    const [latest] = await db
      .select()
      .from(schema.kpiValues)
      .where(eq(schema.kpiValues.kpiId, k.id))
      .orderBy(desc(schema.kpiValues.period))
      .limit(1);
    kpi = {
      nameEn: k.nameEn,
      nameAr: k.nameAr,
      unit: k.unit,
      latest: latest?.actualValue ?? null,
      latestPeriod: latest?.period ?? null,
      target: k.targetValue,
      targetYear: k.targetYear,
    };
  }
  let ownerName: string | null = node.ownerEntityName;
  if (!ownerName && node.ownerUserId) {
    const [u] = await db
      .select({ nameEn: schema.users.nameEn })
      .from(schema.users)
      .where(eq(schema.users.id, node.ownerUserId))
      .limit(1);
    ownerName = u?.nameEn ?? null;
  }
  return {
    id: node.id,
    code: node.code,
    nodeType: node.nodeType,
    titleEn: node.titleEn,
    titleAr: node.titleAr,
    status: node.status,
    editionCode,
    ownerName,
    kpi,
  };
}

/* ---- search_knowledge ---- */
export async function toolSearchKnowledge(
  ctx: ToolContext,
  input: { query: string; types?: string[]; limit?: number }
): Promise<string> {
  const settings = await getAiSettings();
  const filters = filtersForUser(ctx.user, settings.allowSecretInAnswers);
  const wantDocs = !input.types?.length || input.types.includes("document");
  const recordTypes = (input.types?.length
    ? input.types.filter((t) => t !== "document")
    : ["lesson", "answer", "signal", "decision", "podcast_episode"]) as string[];

  const lines: string[] = [];
  if (wantDocs) {
    const { chunks } = await retrieveChunks(input.query, filters, Math.min(input.limit ?? 6, 8));
    // CR02 2.3: deliverables cite as "Deliverable D3 of Project P-21, p. 12"
    const { deliverableInfoForDocs } = await import("@/server/services/deliverables");
    const deliverableInfo = await deliverableInfoForDocs([
      ...new Set(chunks.map((c) => c.documentId)),
    ]);
    for (const c of chunks) {
      const dInfo = deliverableInfo.get(c.documentId) ?? null;
      const baseTitle = c.documentTitleEn || c.documentTitleAr;
      const title = dInfo
        ? `Deliverable ${dInfo.code} of ${dInfo.nodeType === "project" ? "Project" : "Initiative"} ${dInfo.nodeCode ?? dInfo.nodeTitleEn}: ${baseTitle}`
        : baseTitle;
      const n = ctx.state.addSource({
        resource_type: "document",
        resource_id: c.documentId,
        title,
        page: c.page,
        excerpt: c.text.slice(0, 280),
        lang: c.lang,
        classification: c.classification,
        verified: c.verified,
      });
      const [doc] = await db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.id, c.documentId))
        .limit(1);
      if (doc) {
        dedupePush(ctx.state.workspace.documents, {
          id: doc.id,
          titleEn: doc.titleEn,
          titleAr: doc.titleAr,
          summaryEn: doc.summaryEn,
          summaryAr: doc.summaryAr,
          page: c.page,
          status: doc.status,
          classification: doc.classificationLevel,
          deliverable: dInfo ? { code: dInfo.code, nodeCode: dInfo.nodeCode } : null,
        });
      }
      lines.push(
        `[${n}] ${dInfo ? `deliverable ${dInfo.code} of ${dInfo.nodeCode ?? "node"} ` : "document "}"${baseTitle}"${c.page ? ` p.${c.page}` : ""} (${c.verified ? "verified" : "unverified"}): ${c.text.slice(0, 500)}`
      );
    }
  }
  if (recordTypes.length) {
    const records = await retrieveRecords(
      input.query,
      { maxClassification: ctx.user.clearanceLevel, resourceTypes: recordTypes },
      Math.min(input.limit ?? 6, 10)
    );
    for (const r of records) {
      const n = ctx.state.addSource({
        resource_type: r.resourceType,
        resource_id: r.resourceId,
        title: r.text.split("|")[0].slice(0, 120).trim(),
        page: null,
        excerpt: r.text.slice(0, 260),
      });
      lines.push(`[${n}] ${r.resourceType}: ${r.text.slice(0, 400)}`);
      if (r.resourceType === "lesson") {
        const [l] = await db.select().from(schema.lessons).where(eq(schema.lessons.id, r.resourceId)).limit(1);
        if (l && l.classificationLevel <= ctx.user.clearanceLevel) {
          dedupePush(ctx.state.workspace.lessons, {
            id: l.id,
            kind: "lesson",
            titleEn: l.titleEn,
            titleAr: l.titleAr,
            learningEn: l.learningEn,
            learningAr: l.learningAr,
            recommendationEn: l.recommendationEn,
            recommendationAr: l.recommendationAr,
            status: l.status,
            classification: l.classificationLevel,
          });
        }
      }
      if (r.resourceType === "decision") {
        const [d] = await db.select().from(schema.decisions).where(eq(schema.decisions.id, r.resourceId)).limit(1);
        if (d) {
          dedupePush(ctx.state.workspace.lessons, {
            id: d.id,
            kind: "decision",
            titleEn: d.titleEn,
            titleAr: d.titleAr,
            learningEn: d.decisionEn,
            learningAr: d.decisionAr,
            recommendationEn: d.rationaleEn,
            recommendationAr: d.rationaleAr,
            status: "published",
          });
        }
      }
      if (r.resourceType === "signal") {
        const [s] = await db.select().from(schema.signals).where(eq(schema.signals.id, r.resourceId)).limit(1);
        if (s) {
          dedupePush(ctx.state.workspace.signals, {
            id: s.id,
            titleEn: s.titleEn,
            titleAr: s.titleAr,
            whyItMattersEn: s.whyItMattersEn,
            whyItMattersAr: s.whyItMattersAr,
            publisher: s.publisher,
            publishedAt: s.publishedAt,
            signalType: s.signalType,
            impact: s.impact,
          });
        }
      }
    }
  }
  return lines.length ? lines.join("\n") : "No results found in SiaNexus for that query.";
}

/* ---- get_document ---- */
export async function toolGetDocument(
  ctx: ToolContext,
  input: { id: string; pages?: number[] }
): Promise<string> {
  const [d] = await db.select().from(schema.documents).where(eq(schema.documents.id, input.id)).limit(1);
  if (!d || d.deletedAt) return "Document not found.";
  if (!canReadResource(ctx.user, { classificationLevel: d.classificationLevel, departmentId: d.departmentId })) {
    return "You do not have clearance to read this document.";
  }
  const { deliverableInfoForDocs } = await import("@/server/services/deliverables");
  const dInfo = (await deliverableInfoForDocs([d.id])).get(d.id) ?? null;
  const n = ctx.state.addSource({
    resource_type: "document",
    resource_id: d.id,
    title: dInfo
      ? `Deliverable ${dInfo.code} of ${dInfo.nodeType === "project" ? "Project" : "Initiative"} ${dInfo.nodeCode ?? dInfo.nodeTitleEn}: ${d.titleEn || d.titleAr}`
      : d.titleEn || d.titleAr,
    page: null,
    excerpt: (d.summaryEn ?? "").slice(0, 260),
    classification: d.classificationLevel,
    verified: d.status === "verified",
  });
  dedupePush(ctx.state.workspace.documents, {
    id: d.id,
    titleEn: d.titleEn,
    titleAr: d.titleAr,
    summaryEn: d.summaryEn,
    summaryAr: d.summaryAr,
    page: input.pages?.[0] ?? null,
    status: d.status,
    classification: d.classificationLevel,
    deliverable: dInfo ? { code: dInfo.code, nodeCode: dInfo.nodeCode } : null,
  });
  let pageText = "";
  if (input.pages?.length) {
    const chunks = await db
      .select()
      .from(schema.documentChunks)
      .where(eq(schema.documentChunks.documentId, d.id));
    const wanted = chunks.filter((c) =>
      input.pages!.some((p) => (c.pageFrom ?? 0) <= p && p <= (c.pageTo ?? c.pageFrom ?? 0))
    );
    pageText = wanted.map((c) => `p.${c.pageFrom}: ${c.text.slice(0, 800)}`).join("\n").slice(0, 4000);
  }
  return `[${n}] "${d.titleEn}" (${d.status}, ${d.pageCount ?? "?"} pages)\nSummary: ${d.summaryEn ?? d.summaryAr ?? "none"}\nKey facts: ${d.keyFactsJson ?? "[]"}\n${pageText}`;
}

/* ---- query_strategy ---- */
export async function toolQueryStrategy(
  ctx: ToolContext,
  input: {
    edition?: string;
    node_type?: string;
    outcome_code?: string;
    text?: string;
    status?: string;
    count_by?: "outcome" | "node_type" | "status";
  }
): Promise<string> {
  const { edition } = await editionByCode(input.edition);
  if (!edition) return "Unknown strategy edition.";
  const conds = [eq(schema.strategyNodes.editionId, edition.id)];
  if (input.node_type) conds.push(eq(schema.strategyNodes.nodeType, input.node_type));
  if (input.status) conds.push(eq(schema.strategyNodes.status, input.status));
  if (input.text) {
    const pat = `%${input.text}%`;
    conds.push(
      or(
        like(schema.strategyNodes.titleEn, pat),
        like(schema.strategyNodes.titleAr, pat),
        like(schema.strategyNodes.descriptionEn, pat)
      )!
    );
  }
  let scope: Set<string> | null = null;
  if (input.outcome_code) {
    const rootId = await outcomeNodeForEdition(edition.id, input.outcome_code);
    if (!rootId) return `No outcome ${input.outcome_code} in ${edition.code}.`;
    scope = await subtreeIds(edition.id, [rootId]);
  }
  let rows = await db
    .select()
    .from(schema.strategyNodes)
    .where(and(...conds))
    .orderBy(asc(schema.strategyNodes.sort));
  if (scope) rows = rows.filter((r) => scope!.has(r.id));

  // register the strategy structure itself as a citable source
  const structureN = ctx.state.addSource({
    resource_type: "node",
    resource_id: edition.id,
    title: `SiaNexus strategy structure (${edition.nameEn})`,
    page: null,
    excerpt: `Seeded from the ${edition.code.toUpperCase()} document; counts computed over strategy_nodes.`,
    edition: edition.code,
    verified: true,
  });

  if (input.count_by) {
    const outcomes = await outcomeTermSort();
    const outcomeNodes = await db
      .select()
      .from(schema.strategyNodes)
      .where(
        and(
          eq(schema.strategyNodes.editionId, edition.id),
          eq(schema.strategyNodes.nodeType, "outcome")
        )
      )
      .orderBy(asc(schema.strategyNodes.sort));
    if (input.count_by === "outcome") {
      const parts: string[] = [];
      let total = 0;
      for (let i = 0; i < outcomeNodes.length; i++) {
        const ids = await subtreeIds(edition.id, [outcomeNodes[i].id]);
        const count = rows.filter((r) => ids.has(r.id) && r.id !== outcomeNodes[i].id).length;
        total += count;
        parts.push(`${outcomeNodes[i].titleEn} (${outcomes[i]?.code ?? i + 1}): ${count}`);
        // the breakdown renders as outcome cards in the workspace
        dedupePush(ctx.state.workspace.strategy, await nodeCard(ctx.state, outcomeNodes[i], edition.code), 8);
      }
      const unscoped = rows.filter((r) => r.nodeType !== "outcome").length;
      return `[${structureN}] ${edition.code.toUpperCase()} count of ${input.node_type ?? "nodes"} by outcome (total matching ${input.node_type ?? "nodes"}: ${unscoped}):\n${parts.join("\n")}\nNote: items outside any outcome subtree: ${unscoped - total}.`;
    }
    const key = input.count_by === "node_type" ? "nodeType" : "status";
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r[key] as string, (counts.get(r[key] as string) ?? 0) + 1);
    return `[${structureN}] ${edition.code.toUpperCase()} counts by ${input.count_by}: ${[...counts.entries()]
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ")}. Total: ${rows.length}.`;
  }

  const listed = rows.slice(0, 25);
  for (const nRow of listed.slice(0, 8)) {
    dedupePush(ctx.state.workspace.strategy, await nodeCard(ctx.state, nRow, edition.code), 8);
  }
  const lines = listed.map((r) => {
    const n = ctx.state.addSource({
      resource_type: "node",
      resource_id: r.id,
      title: `${r.code ?? r.nodeType}: ${r.titleEn}`,
      page: null,
      excerpt: (r.descriptionEn ?? "").slice(0, 200),
      edition: edition.code,
      verified: r.verified === 1,
    });
    return `[${n}] ${r.nodeType} ${r.code ?? ""} "${r.titleEn}" status=${r.status}`;
  });
  return `${edition.code.toUpperCase()}: ${rows.length} matching nodes${rows.length > 25 ? " (first 25 shown)" : ""}:\n${lines.join("\n")}`;
}

/* ---- get_node ---- */
export async function toolGetNode(
  ctx: ToolContext,
  input: { id?: string; code?: string }
): Promise<string> {
  const cond = input.id
    ? eq(schema.strategyNodes.id, input.id)
    : input.code
      ? sql`lower(${schema.strategyNodes.code}) = lower(${input.code})`
      : null;
  if (!cond) return "Give a node id or code.";
  const [node] = await db.select().from(schema.strategyNodes).where(cond).limit(1);
  if (!node) return "Node not found.";
  const [edition] = await db
    .select()
    .from(schema.strategyEditions)
    .where(eq(schema.strategyEditions.id, node.editionId))
    .limit(1);
  const n = ctx.state.addSource({
    resource_type: "node",
    resource_id: node.id,
    title: `${node.code ?? node.nodeType}: ${node.titleEn}`,
    page: null,
    excerpt: (node.descriptionEn ?? "").slice(0, 240),
    edition: edition?.code,
    verified: node.verified === 1,
  });
  dedupePush(ctx.state.workspace.strategy, await nodeCard(ctx.state, node, edition?.code ?? "nds3"), 8);

  const kpisRows = await db.select().from(schema.kpis).where(eq(schema.kpis.nodeId, node.id));
  const kpiLines: string[] = [];
  for (const k of kpisRows) {
    const values = await db
      .select()
      .from(schema.kpiValues)
      .where(eq(schema.kpiValues.kpiId, k.id))
      .orderBy(desc(schema.kpiValues.period))
      .limit(4);
    kpiLines.push(
      `KPI "${k.nameEn}" unit=${k.unit ?? "-"} baseline=${k.baselineValue ?? "-"} (${k.baselineYear ?? "-"}) target=${k.targetValue ?? "-"} by ${k.targetYear ?? "-"}; recent: ${values.map((v) => `${v.period}=${v.actualValue}`).join(", ")}`
    );
  }
  const updates = await db
    .select()
    .from(schema.statusUpdates)
    .where(eq(schema.statusUpdates.nodeId, node.id))
    .orderBy(desc(schema.statusUpdates.createdAt))
    .limit(3);
  const lineage = await db
    .select()
    .from(schema.nodeLineage)
    .where(or(eq(schema.nodeLineage.fromNodeId, node.id), eq(schema.nodeLineage.toNodeId, node.id)));
  return [
    `[${n}] ${edition?.code?.toUpperCase()} ${node.nodeType} ${node.code ?? ""} "${node.titleEn}" / "${node.titleAr}" status=${node.status} owner=${node.ownerEntityName ?? "-"} budgetQAR=${node.budgetQar ?? "-"}`,
    `Description: ${(node.descriptionEn ?? "").slice(0, 500)}`,
    ...kpiLines,
    ...updates.map(
      (u) => `Update ${u.period ?? u.createdAt.slice(0, 10)}: ${u.status} ${u.progressPct}% ${(u.summaryEn ?? "").slice(0, 200)}`
    ),
    lineage.length ? `Lineage links: ${lineage.length} (across editions)` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ---- query_indicators ---- */
export async function toolQueryIndicators(
  ctx: ToolContext,
  input: { text?: string; category?: string; codes?: string[] }
): Promise<string> {
  const conds = [sql`${schema.indicators.classificationLevel} <= ${ctx.user.clearanceLevel}`];
  if (input.codes?.length) conds.push(inArray(schema.indicators.code, input.codes));
  if (input.text) {
    const pat = `%${input.text}%`;
    conds.push(
      or(
        like(schema.indicators.nameEn, pat),
        like(schema.indicators.nameAr, pat),
        like(schema.indicators.definitionEn, pat)
      )!
    );
  }
  let rows = await db
    .select()
    .from(schema.indicators)
    .where(and(...conds))
    .limit(15);
  // fall back to semantic search when LIKE finds nothing
  if (!rows.length && input.text) {
    const records = await retrieveRecords(
      input.text,
      { maxClassification: ctx.user.clearanceLevel, resourceTypes: ["indicator"] },
      6
    );
    const ids = records.map((r) => r.resourceId);
    if (ids.length) {
      rows = await db.select().from(schema.indicators).where(inArray(schema.indicators.id, ids));
    }
  }
  if (!rows.length) return "No indicators matched.";
  return rows
    .map((r) => `indicator code=${r.code} id=${r.id} "${r.nameEn}" / "${r.nameAr}" unit=${r.unit ?? "-"} freq=${r.frequency}${r.isHeadline ? " headline" : ""}`)
    .join("\n");
}

/* ---- get_indicator_series ---- */
export async function toolGetIndicatorSeries(
  ctx: ToolContext,
  input: { indicator_id?: string; code?: string; from?: string; to?: string; dimension?: string }
): Promise<string> {
  const conds = [];
  if (input.indicator_id) conds.push(eq(schema.indicators.id, input.indicator_id));
  else if (input.code) conds.push(eq(schema.indicators.code, input.code));
  else return "Provide indicator_id or code.";
  const [ind] = await db
    .select()
    .from(schema.indicators)
    .where(and(...conds))
    .limit(1);
  if (!ind) return "Indicator not found.";
  if (ind.classificationLevel > ctx.user.clearanceLevel) return "You do not have clearance for this indicator.";

  const dimensionKey = input.dimension ?? "total";
  const valueConds = [
    eq(schema.indicatorValues.indicatorId, ind.id),
    input.dimension
      ? like(schema.indicatorValues.dimensionKey, `%${input.dimension}%`)
      : eq(schema.indicatorValues.dimensionKey, "total"),
  ];
  if (input.from) valueConds.push(sql`${schema.indicatorValues.period} >= ${input.from}`);
  if (input.to) valueConds.push(sql`${schema.indicatorValues.period} <= ${input.to}`);
  const values = await db
    .select()
    .from(schema.indicatorValues)
    .where(and(...valueConds))
    .orderBy(asc(schema.indicatorValues.period));
  if (!values.length) return `Indicator "${ind.nameEn}" has no values recorded${input.dimension ? ` for dimension ${input.dimension}` : ""}. The owner should update it.`;

  const totalSeries = values.filter((v) => !input.dimension);
  const series = (input.dimension ? values : totalSeries).slice(-36);
  const latest = series[series.length - 1];
  const previous = series.length > 1 ? series[series.length - 2] : null;
  const first = series[0];
  const delta = previous ? latest.value - previous.value : null;
  const years = series.length > 1 ? Math.max(1, (series.length - 1) / (ind.frequency === "monthly" ? 12 : ind.frequency === "quarterly" ? 4 : 1)) : 1;
  const cagr =
    first && latest && first.value > 0 && series.length > 2
      ? (Math.pow(latest.value / first.value, 1 / years) - 1) * 100
      : null;

  const [kpi] = await db.select().from(schema.kpis).where(eq(schema.kpis.indicatorId, ind.id)).limit(1);
  const target = kpi?.targetValue != null ? { value: kpi.targetValue, year: kpi.targetYear } : null;
  const gap = target && latest ? target.value - latest.value : null;

  const n = ctx.state.addSource({
    resource_type: "indicator",
    resource_id: ind.id,
    title: ind.nameEn,
    page: null,
    excerpt: `Latest ${latest.period}: ${latest.value}${ind.unit ? ` ${ind.unit}` : ""} (${latest.status})`,
    verified: true,
  });
  if (!input.dimension) {
    dedupePush(
      ctx.state.workspace.numbers,
      {
        id: ind.id,
        code: ind.code,
        nameEn: ind.nameEn,
        nameAr: ind.nameAr,
        unit: ind.unit,
        decimals: ind.decimals,
        direction: ind.direction,
        classification: ind.classificationLevel,
        latest: { period: latest.period, value: latest.value },
        previous: previous ? { period: previous.period, value: previous.value } : null,
        target: target ? { value: target.value, year: target.year } : null,
        gapToTarget: gap,
        series: series.slice(-24).map((v) => ({ period: v.period, value: v.value })),
      },
      6
    );
  }
  const illustrative = values.some((v) => v.note?.includes("illustrative"));
  return [
    `[${n}] Indicator "${ind.nameEn}" (${ind.code}) unit=${ind.unit ?? "-"} direction=${ind.direction}`,
    `Latest: ${latest.period} = ${latest.value}${latest.status !== "final" ? ` (${latest.status})` : ""}${illustrative ? " [seeded illustrative values]" : ""}`,
    previous ? `Previous: ${previous.period} = ${previous.value}; delta = ${delta}` : "",
    cagr !== null ? `Approx CAGR over series: ${cagr.toFixed(2)} percent per year` : "",
    target ? `Linked KPI target: ${target.value}${ind.unit ? ` ${ind.unit}` : ""} by ${target.year ?? "-"}; gap to target = ${gap}` : "No linked target.",
    `Series (${input.dimension ? `dimension ~${input.dimension}` : "total"}): ${series
      .slice(-18)
      .map((v) => `${v.period}${input.dimension ? `|${v.dimensionKey}` : ""}=${v.value}`)
      .join("; ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/* ---- compute ---- */
function safeEval(expression: string, inputs: Record<string, number>): number {
  // tiny recursive-descent evaluator: numbers, variables, + - * / ( ), unary minus
  const tokens = expression.match(/\d+\.?\d*|[A-Za-z_][A-Za-z0-9_]*|[+\-*/()]/g);
  if (!tokens) throw new Error("empty expression");
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  function parseExpr(): number {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const rhs = parseTerm();
      v = op === "+" ? v + rhs : v - rhs;
    }
    return v;
  }
  function parseTerm(): number {
    let v = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const rhs = parseFactor();
      v = op === "*" ? v * rhs : v / rhs;
    }
    return v;
  }
  function parseFactor(): number {
    const t = next();
    if (t === undefined) throw new Error("unexpected end");
    if (t === "-") return -parseFactor();
    if (t === "(") {
      const v = parseExpr();
      if (next() !== ")") throw new Error("missing )");
      return v;
    }
    if (/^\d/.test(t)) return Number(t);
    if (t in inputs) return inputs[t];
    throw new Error(`unknown variable ${t}`);
  }
  const result = parseExpr();
  if (pos !== tokens.length) throw new Error("trailing tokens");
  if (!Number.isFinite(result)) throw new Error("non-finite result");
  return result;
}

export async function toolCompute(
  _ctx: ToolContext,
  input: { expression: string; inputs?: Record<string, number> }
): Promise<string> {
  try {
    const result = safeEval(input.expression, input.inputs ?? {});
    return `compute(${input.expression}) with ${JSON.stringify(input.inputs ?? {})} = ${Number(result.toFixed(6))}`;
  } catch (e: any) {
    return `compute error: ${e.message}. Use numbers and variable names you passed in "inputs" with + - * / ( ).`;
  }
}

/* ---- find_experts ---- */
export async function toolFindExperts(
  ctx: ToolContext,
  input: { question: string; limit?: number }
): Promise<string> {
  const experts = await suggestExperts(input.question, ctx.user, Math.min(input.limit ?? 3, 5));
  if (!experts.length) return "No matching experts found.";
  for (const e of experts) {
    dedupePush(
      ctx.state.workspace.people,
      {
        id: e.id,
        nameEn: e.nameEn,
        nameAr: e.nameAr,
        positionEn: e.positionEn,
        positionAr: e.positionAr,
        organisationEn: e.organisationEn,
        availability: e.availability,
        reasonEn: e.reasonEn,
        reasonAr: e.reasonAr,
      },
      5
    );
  }
  return experts
    .map((e) => {
      const n = ctx.state.addSource({
        resource_type: "expert",
        resource_id: e.id,
        title: e.nameEn,
        page: null,
        excerpt: e.reasonEn,
      });
      return `[${n}] ${e.nameEn} (${e.positionEn ?? ""}${e.organisationEn ? `, ${e.organisationEn}` : ""}, ${e.availability}): ${e.reasonEn}`;
    })
    .join("\n");
}

/* ---- get_lessons ---- */
export async function toolGetLessons(
  ctx: ToolContext,
  input: { node_id?: string; text?: string; category?: string }
): Promise<string> {
  const conds = [
    inArray(schema.lessons.status, ["published", "verified"]),
    sql`${schema.lessons.classificationLevel} <= ${ctx.user.clearanceLevel}`,
  ];
  if (input.node_id) conds.push(eq(schema.lessons.nodeId, input.node_id));
  if (input.category) conds.push(eq(schema.lessons.category, input.category));
  if (input.text) {
    const pat = `%${input.text}%`;
    conds.push(
      or(
        like(schema.lessons.titleEn, pat),
        like(schema.lessons.learningEn, pat),
        like(schema.lessons.titleAr, pat)
      )!
    );
  }
  let rows = await db
    .select()
    .from(schema.lessons)
    .where(and(...conds))
    .orderBy(desc(schema.lessons.createdAt))
    .limit(8);
  if (!rows.length && input.text) {
    const records = await retrieveRecords(
      input.text,
      { maxClassification: ctx.user.clearanceLevel, resourceTypes: ["lesson"] },
      6
    );
    const ids = records.map((r) => r.resourceId);
    if (ids.length) rows = await db.select().from(schema.lessons).where(inArray(schema.lessons.id, ids));
  }
  if (!rows.length) return "No lessons found for that scope.";
  return rows
    .map((l) => {
      const n = ctx.state.addSource({
        resource_type: "lesson",
        resource_id: l.id,
        title: l.titleEn || l.titleAr,
        page: null,
        excerpt: (l.learningEn ?? "").slice(0, 220),
        verified: l.status === "verified",
      });
      dedupePush(ctx.state.workspace.lessons, {
        id: l.id,
        kind: "lesson",
        category: l.category,
        titleEn: l.titleEn,
        titleAr: l.titleAr,
        learningEn: l.learningEn,
        learningAr: l.learningAr,
        recommendationEn: l.recommendationEn,
        recommendationAr: l.recommendationAr,
        status: l.status,
        classification: l.classificationLevel,
      });
      return `[${n}] lesson (${l.category}) "${l.titleEn}": ${(l.learningEn ?? "").slice(0, 300)} Recommendation: ${(l.recommendationEn ?? "").slice(0, 200)}`;
    })
    .join("\n");
}

/* ---- get_lesson_themes (CR04 5) ---- */
export async function toolGetLessonThemes(ctx: ToolContext): Promise<string> {
  const clusters = await db.select().from(schema.lessonClusters);
  if (!clusters.length) return "No lesson themes exist yet.";
  return clusters
    .map((c) => {
      let count = 0;
      try {
        count = (JSON.parse(c.lessonIdsJson ?? "[]") as string[]).length;
      } catch {
        count = 0;
      }
      const n = ctx.state.addSource({
        resource_type: "lesson_theme",
        resource_id: c.id,
        title: c.labelEn || c.labelAr,
        page: null,
        excerpt: (c.summaryEn ?? "").slice(0, 220),
      });
      return `[${n}] theme "${c.labelEn}" / "${c.labelAr}" (${count} lessons): ${c.summaryEn ?? ""}`;
    })
    .join("\n");
}

/* ---- get_deliverables (CR02 2.3) ---- */
export async function toolGetDeliverables(
  ctx: ToolContext,
  input: { node_id?: string; node_code?: string }
): Promise<string> {
  let nodeId = input.node_id ?? null;
  if (!nodeId && input.node_code) {
    const [n] = await db
      .select({ id: schema.strategyNodes.id })
      .from(schema.strategyNodes)
      .where(sql`lower(${schema.strategyNodes.code}) = lower(${input.node_code})`)
      .limit(1);
    nodeId = n?.id ?? null;
  }
  if (!nodeId) return "Give a node_id or node_code of an initiative or project.";
  const [node] = await db
    .select()
    .from(schema.strategyNodes)
    .where(eq(schema.strategyNodes.id, nodeId))
    .limit(1);
  if (!node) return "Node not found.";
  const { listDeliverables } = await import("@/server/services/deliverables");
  const rows = await listDeliverables(ctx.user, nodeId);
  if (!rows.length) {
    return `${node.nodeType} ${node.code ?? ""} "${node.titleEn}" has no deliverables recorded.`;
  }
  const docs = await db
    .select()
    .from(schema.documents)
    .where(inArray(schema.documents.id, rows.map((r) => r.documentId)));
  const kind = node.nodeType === "project" ? "Project" : "Initiative";
  const lines = rows.map((r) => {
    const doc = docs.find((d) => d.id === r.documentId);
    const n = ctx.state.addSource({
      resource_type: "document",
      resource_id: r.documentId,
      title: `Deliverable ${r.deliverableCode} of ${kind} ${node.code ?? node.titleEn}: ${r.titleEn || r.titleAr}`,
      page: null,
      excerpt: (doc?.summaryEn ?? "").slice(0, 240),
      classification: r.classificationLevel,
      verified: r.status === "verified",
    });
    dedupePush(ctx.state.workspace.documents, {
      id: r.documentId,
      titleEn: r.titleEn,
      titleAr: r.titleAr,
      summaryEn: doc?.summaryEn ?? null,
      summaryAr: doc?.summaryAr ?? null,
      page: null,
      status: r.status,
      classification: r.classificationLevel,
      deliverable: { code: r.deliverableCode, nodeCode: node.code },
    });
    return `[${n}] ${r.deliverableCode} "${r.titleEn}" (v${r.versionNo}, ${r.status}, acceptance ${r.acceptanceStatus}${r.milestone ? `, milestone ${r.milestone}` : ""}${r.deliveredDate ? `, delivered ${r.deliveredDate}` : ""}): ${(doc?.summaryEn ?? "no summary").slice(0, 280)}`;
  });
  return [
    `${kind} ${node.code ?? ""} "${node.titleEn}" has ${rows.length} deliverables:`,
    ...lines,
  ].join("\n");
}

/* ---- get_signals ---- */
export async function toolGetSignals(
  ctx: ToolContext,
  input: { node_id?: string; text?: string; days?: number }
): Promise<string> {
  const rows = await listSignals(ctx.user, {
    nodeId: input.node_id,
    q: input.text,
    triage: "accepted",
    days: input.days ?? 90,
    limit: 8,
  });
  if (!rows.length) return "No accepted signals in that window.";
  return rows
    .map((s) => {
      const n = ctx.state.addSource({
        resource_type: "signal",
        resource_id: s.id,
        title: s.titleEn || s.titleAr,
        page: null,
        excerpt: (s.descriptionEn ?? "").slice(0, 220),
      });
      dedupePush(ctx.state.workspace.signals, {
        id: s.id,
        titleEn: s.titleEn,
        titleAr: s.titleAr,
        whyItMattersEn: s.whyItMattersEn,
        whyItMattersAr: s.whyItMattersAr,
        publisher: s.publisher,
        publishedAt: s.publishedAt,
        signalType: s.signalType,
        impact: s.impact,
      });
      return `[${n}] signal (${s.publisher ?? "-"}, ${s.publishedAt ?? "-"}): "${s.titleEn}". ${s.whyItMattersEn ?? ""}`;
    })
    .join("\n");
}

/* ---- what_changed ---- */
export async function toolWhatChanged(
  ctx: ToolContext,
  input: { node_id?: string; outcome_code?: string; days?: number; edition?: string }
): Promise<string> {
  const { edition } = await editionByCode(input.edition);
  if (!edition) return "Unknown edition.";
  let nodeIds: string[] = [];
  if (input.node_id) {
    nodeIds = [...(await subtreeIds(edition.id, [input.node_id]))];
  } else if (input.outcome_code) {
    const rootId = await outcomeNodeForEdition(edition.id, input.outcome_code);
    if (!rootId) return `No outcome ${input.outcome_code}.`;
    nodeIds = [...(await subtreeIds(edition.id, [rootId]))];
  } else {
    nodeIds = (
      await db
        .select({ id: schema.strategyNodes.id })
        .from(schema.strategyNodes)
        .where(eq(schema.strategyNodes.editionId, edition.id))
    ).map((r) => r.id);
  }
  const days = input.days ?? 90;
  const changed = await whatChanged(nodeIds, days);
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const newDocs = await db
    .select({ id: schema.documents.id, titleEn: schema.documents.titleEn })
    .from(schema.documents)
    .where(
      and(
        sql`${schema.documents.createdAt} >= ${since}`,
        sql`${schema.documents.classificationLevel} <= ${ctx.user.clearanceLevel}`
      )
    )
    .limit(5);
  const signals = input.outcome_code
    ? await listSignals(ctx.user, { outcome: input.outcome_code, triage: "accepted", days, limit: 4 })
    : [];
  // CR02 2.3: deliverables that arrived in the period, within the node scope
  const nodeScope = new Set(nodeIds);
  const recentDeliverables = (
    await db
      .select()
      .from(schema.deliverableMeta)
      .where(sql`${schema.deliverableMeta.createdAt} >= ${since}`)
      .limit(30)
  ).filter((m) => nodeScope.has(m.nodeId));
  let deliverableLine = "";
  if (recentDeliverables.length) {
    const dDocs = await db
      .select({ id: schema.documents.id, titleEn: schema.documents.titleEn })
      .from(schema.documents)
      .where(
        and(
          inArray(schema.documents.id, recentDeliverables.map((m) => m.documentId)),
          sql`${schema.documents.classificationLevel} <= ${ctx.user.clearanceLevel}`
        )
      );
    if (dDocs.length) {
      deliverableLine = `New deliverables in period: ${recentDeliverables
        .filter((m) => dDocs.some((d) => d.id === m.documentId))
        .map((m) => `${m.deliverableCode} ${dDocs.find((d) => d.id === m.documentId)?.titleEn ?? ""}`)
        .join("; ")}`;
    }
  }
  const n = ctx.state.addSource({
    resource_type: "node",
    resource_id: input.node_id ?? edition.id,
    title: `What changed (${days} days)`,
    page: null,
    excerpt: changed.summary_en.slice(0, 240),
    edition: edition.code,
  });
  for (const s of signals) {
    dedupePush(ctx.state.workspace.signals, {
      id: s.id,
      titleEn: s.titleEn,
      titleAr: s.titleAr,
      whyItMattersEn: s.whyItMattersEn,
      whyItMattersAr: s.whyItMattersAr,
      publisher: s.publisher,
      publishedAt: s.publishedAt,
      signalType: s.signalType,
      impact: s.impact,
    });
  }
  return [
    `[${n}] ${changed.summary_en}`,
    ...changed.highlights.map((h) => `- (${h.kind}) ${h.text_en}`),
    newDocs.length ? `New documents in period: ${newDocs.map((d) => d.titleEn).join("; ")}` : "",
    deliverableLine,
    signals.length ? `Accepted signals in period: ${signals.map((s) => s.titleEn).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ---- compare_editions ---- */
export async function toolCompareEditions(
  ctx: ToolContext,
  input: { theme: string }
): Promise<string> {
  const editions = await db.select().from(schema.strategyEditions);
  const pat = `%${input.theme}%`;
  const rows = await db
    .select()
    .from(schema.strategyNodes)
    .where(
      or(
        like(schema.strategyNodes.titleEn, pat),
        like(schema.strategyNodes.descriptionEn, pat),
        like(schema.strategyNodes.titleAr, pat)
      )!
    )
    .limit(40);
  let matched = rows;
  if (!matched.length) {
    const records = await retrieveRecords(
      input.theme,
      { maxClassification: ctx.user.clearanceLevel, resourceTypes: ["node"] },
      12
    );
    const ids = records.map((r) => r.resourceId);
    matched = ids.length
      ? await db.select().from(schema.strategyNodes).where(inArray(schema.strategyNodes.id, ids))
      : [];
  }
  if (!matched.length) return "No strategy nodes matched that theme in any edition.";
  const byEdition = new Map<string, typeof matched>();
  for (const m of matched) {
    const ed = editions.find((e) => e.id === m.editionId);
    const code = ed?.code ?? "?";
    (byEdition.get(code) ?? byEdition.set(code, []).get(code)!).push(m);
  }
  const ids = matched.map((m) => m.id);
  const lineage = await db
    .select()
    .from(schema.nodeLineage)
    .where(
      or(inArray(schema.nodeLineage.fromNodeId, ids), inArray(schema.nodeLineage.toNodeId, ids))
    );
  const lines: string[] = [];
  for (const [code, nodes] of [...byEdition.entries()].sort()) {
    for (const nd of nodes.slice(0, 6)) {
      const n = ctx.state.addSource({
        resource_type: "node",
        resource_id: nd.id,
        title: `${code.toUpperCase()} ${nd.code ?? nd.nodeType}: ${nd.titleEn}`,
        page: null,
        excerpt: (nd.descriptionEn ?? "").slice(0, 200),
        edition: code,
      });
      lines.push(
        `[${n}] ${code.toUpperCase()} ${nd.nodeType} ${nd.code ?? ""} "${nd.titleEn}" status=${nd.status}${nd.descriptionEn ? `: ${nd.descriptionEn.slice(0, 160)}` : ""}`
      );
      const ed = editions.find((e) => e.id === nd.editionId);
      dedupePush(ctx.state.workspace.strategy, await nodeCard(ctx.state, nd, ed?.code ?? code), 8);
    }
  }
  const lineageLines = lineage.slice(0, 10).map((l) => {
    const from = matched.find((m) => m.id === l.fromNodeId);
    const to = matched.find((m) => m.id === l.toNodeId);
    return `lineage: "${from?.titleEn ?? l.fromNodeId}" ${l.relation} "${to?.titleEn ?? l.toNodeId}"`;
  });
  return [...lines, ...lineageLines].join("\n");
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

export const TOOL_DEFINITIONS = [
  {
    name: "search_knowledge",
    description:
      "Hybrid search over SiaNexus documents, lessons, decisions, verified answers, and accepted signals. Returns numbered citable passages.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        types: {
          type: "array",
          items: { type: "string", enum: ["document", "lesson", "answer", "signal", "decision"] },
          description: "Restrict to these types. Omit for all.",
        },
        limit: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_document",
    description: "Fetch a document's summary, key facts, and optionally specific page text by page numbers.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string" },
        pages: { type: "array", items: { type: "number" } },
      },
      required: ["id"],
    },
  },
  {
    name: "query_strategy",
    description:
      "Query the Living Strategy tables (editions nds3, nds2, nds1). Filter by node_type (outcome|target|cluster|enabler|sector_strategy|initiative|project), outcome_code, text, status. Use count_by for aggregations, e.g. how many targets exist (node_type=target, count_by=outcome).",
    input_schema: {
      type: "object" as const,
      properties: {
        edition: { type: "string", enum: ["nds3", "nds2", "nds1"] },
        node_type: { type: "string" },
        outcome_code: {
          type: "string",
          enum: ["eco_growth", "fiscal_sust", "workforce", "cohesive_society", "quality_life", "env_sust", "gov_excellence"],
        },
        text: { type: "string" },
        status: { type: "string", enum: ["not_started", "on_track", "at_risk", "delayed", "completed"] },
        count_by: { type: "string", enum: ["outcome", "node_type", "status"] },
      },
    },
  },
  {
    name: "get_node",
    description:
      "Fetch one strategy node (by id or by code such as PRJ-01a) with its KPIs, latest values, status updates, and lineage.",
    input_schema: {
      type: "object" as const,
      properties: { id: { type: "string" }, code: { type: "string" } },
    },
  },
  {
    name: "query_indicators",
    description: "Search the statistical indicator catalog by text, category, or exact codes.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: { type: "string" },
        category: { type: "string" },
        codes: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "get_indicator_series",
    description:
      "Fetch an indicator's time series with latest value, delta, CAGR, linked target and gap. Use dimension for breakdowns like nationality or sex or sector.",
    input_schema: {
      type: "object" as const,
      properties: {
        indicator_id: { type: "string" },
        code: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
        dimension: { type: "string" },
      },
    },
  },
  {
    name: "compute",
    description:
      "Safe arithmetic over numbers from other tools (+ - * / parentheses). Pass values in inputs, e.g. expression '(latest - target) / target * 100', inputs {latest: 55.2, target: 60}. Always compute derived numbers here, never in your head.",
    input_schema: {
      type: "object" as const,
      properties: {
        expression: { type: "string" },
        inputs: { type: "object", additionalProperties: { type: "number" } },
      },
      required: ["expression"],
    },
  },
  {
    name: "find_experts",
    description: "Match NPC experts to a question or domain, with reasons from their stored profiles.",
    input_schema: {
      type: "object" as const,
      properties: { question: { type: "string" }, limit: { type: "number" } },
      required: ["question"],
    },
  },
  {
    name: "get_lessons",
    description: "Lessons learned, filtered by strategy node or text.",
    input_schema: {
      type: "object" as const,
      properties: {
        node_id: { type: "string" },
        text: { type: "string" },
        category: {
          type: "string",
          enum: ["delivery", "external", "expert", "institutional"],
        },
      },
    },
  },
  {
    name: "get_lesson_themes",
    description:
      "The Learning Room's lesson themes: AI clusters of related lessons with a one-line synthesis and lesson counts.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_signals",
    description: "Accepted external signals from Trends and Signals, by node, text, and recency window in days.",
    input_schema: {
      type: "object" as const,
      properties: { node_id: { type: "string" }, text: { type: "string" }, days: { type: "number" } },
    },
  },
  {
    name: "get_deliverables",
    description:
      "The deliverables (contracted outputs stored in the Vault) of an initiative or project, with codes, versions, acceptance status, and summaries. Give node_id or node_code such as PRJ-01a.",
    input_schema: {
      type: "object" as const,
      properties: { node_id: { type: "string" }, node_code: { type: "string" } },
    },
  },
  {
    name: "what_changed",
    description:
      "Status updates, KPI deltas, new documents, new deliverables, and accepted signals for a node or outcome over a period in days.",
    input_schema: {
      type: "object" as const,
      properties: {
        node_id: { type: "string" },
        outcome_code: { type: "string" },
        days: { type: "number" },
        edition: { type: "string" },
      },
    },
  },
  {
    name: "compare_editions",
    description: "Find nodes about a theme across NDS1, NDS2, and NDS3, aligned by lineage links, for comparisons.",
    input_schema: {
      type: "object" as const,
      properties: { theme: { type: "string" } },
      required: ["theme"],
    },
  },
];

export async function runTool(
  ctx: ToolContext,
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  ctx.state.toolCalls++;
  try {
    switch (name) {
      case "search_knowledge":
        return await toolSearchKnowledge(ctx, input as never);
      case "get_document":
        return await toolGetDocument(ctx, input as never);
      case "query_strategy":
        return await toolQueryStrategy(ctx, input as never);
      case "get_node":
        return await toolGetNode(ctx, input as never);
      case "query_indicators":
        return await toolQueryIndicators(ctx, input as never);
      case "get_indicator_series":
        return await toolGetIndicatorSeries(ctx, input as never);
      case "compute":
        return await toolCompute(ctx, input as never);
      case "find_experts":
        return await toolFindExperts(ctx, input as never);
      case "get_lessons":
        return await toolGetLessons(ctx, input as never);
      case "get_lesson_themes":
        return await toolGetLessonThemes(ctx);
      case "get_signals":
        return await toolGetSignals(ctx, input as never);
      case "get_deliverables":
        return await toolGetDeliverables(ctx, input as never);
      case "what_changed":
        return await toolWhatChanged(ctx, input as never);
      case "compare_editions":
        return await toolCompareEditions(ctx, input as never);
      default:
        return `Unknown tool ${name}.`;
    }
  } catch (e: any) {
    return `Tool ${name} failed: ${String(e?.message ?? e).slice(0, 200)}`;
  }
}
