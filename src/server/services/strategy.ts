import { and, asc, desc, eq, gte, inArray, or } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { newId, nowIso } from "@/lib/ids";
import { record } from "@/server/gamification/engine";
import { audit } from "@/server/auth/audit";
import { enqueue } from "@/server/jobs/queue";

export async function getEditions() {
  return db
    .select()
    .from(schema.strategyEditions)
    .orderBy(desc(schema.strategyEditions.periodFrom));
}

export async function getEditionByCode(code: string) {
  const [edition] = await db
    .select()
    .from(schema.strategyEditions)
    .where(eq(schema.strategyEditions.code, code))
    .limit(1);
  return edition ?? null;
}

export type NodeLite = typeof schema.strategyNodes.$inferSelect;

export async function getEditionNodes(editionId: string): Promise<NodeLite[]> {
  return db
    .select()
    .from(schema.strategyNodes)
    .where(eq(schema.strategyNodes.editionId, editionId))
    .orderBy(asc(schema.strategyNodes.sort));
}

export type OutcomeTile = {
  id: string;
  code: string | null;
  titleEn: string;
  titleAr: string;
  status: string;
  progress: number; // 0..1 share of descendants on track
  initiativeCount: number;
  projectCount: number;
  headlineKpi: {
    nameEn: string;
    nameAr: string;
    unit: string | null;
    latest: number | null;
    target: number | null;
  } | null;
};

export async function getOverview(editionId: string): Promise<OutcomeTile[]> {
  const nodes = await getEditionNodes(editionId);
  const topLevel = nodes.filter(
    (n) => !n.parentId && (n.nodeType === "outcome" || n.nodeType === "sector_strategy")
  );
  const childrenOf = new Map<string, NodeLite[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    (childrenOf.get(n.parentId) ?? childrenOf.set(n.parentId, []).get(n.parentId)!).push(n);
  }
  const descendants = (id: string): NodeLite[] => {
    const direct = childrenOf.get(id) ?? [];
    return [...direct, ...direct.flatMap((d) => descendants(d.id))];
  };
  const allKpis = await db.select().from(schema.kpis);
  const kpiByNode = new Map<string, (typeof allKpis)[number][]>();
  for (const k of allKpis) {
    (kpiByNode.get(k.nodeId) ?? kpiByNode.set(k.nodeId, []).get(k.nodeId)!).push(k);
  }

  const tiles: OutcomeTile[] = [];
  for (const outcome of topLevel) {
    const subtree = descendants(outcome.id);
    const active = subtree.filter((d) => d.nodeType === "initiative" || d.nodeType === "project");
    const good = active.filter((d) => d.status === "on_track" || d.status === "completed");
    const kpi = kpiByNode.get(outcome.id)?.[0] ?? null;
    let headlineKpi: OutcomeTile["headlineKpi"] = null;
    if (kpi) {
      const [latest] = await db
        .select()
        .from(schema.kpiValues)
        .where(eq(schema.kpiValues.kpiId, kpi.id))
        .orderBy(desc(schema.kpiValues.period))
        .limit(1);
      headlineKpi = {
        nameEn: kpi.nameEn,
        nameAr: kpi.nameAr,
        unit: kpi.unit,
        latest: latest?.actualValue ?? null,
        target: kpi.targetValue,
      };
    }
    tiles.push({
      id: outcome.id,
      code: outcome.code,
      titleEn: outcome.titleEn,
      titleAr: outcome.titleAr,
      status: outcome.status,
      progress: active.length ? good.length / active.length : 0,
      initiativeCount: subtree.filter((d) => d.nodeType === "initiative").length,
      projectCount: subtree.filter((d) => d.nodeType === "project").length,
      headlineKpi,
    });
  }
  return tiles;
}

/* ------------------------------------------------------------------ */
/* CR02 2.2: the column navigator                                       */
/* ------------------------------------------------------------------ */

export function slugOfCode(code: string | null, id: string): string {
  if (!code) return id;
  return code.toLowerCase().replace(/\./g, "-");
}

export type NavOutcome = {
  id: string;
  code: string | null;
  slug: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  ownerEntityName: string | null;
  status: string;
  progress: number; // share of targets on track
  targetCount: number;
  initiativeCount: number;
  projectCount: number;
};

export type NavTarget = {
  id: string;
  outcomeId: string;
  code: string | null;
  slug: string;
  titleEn: string;
  titleAr: string;
  status: string;
  initiativeCount: number;
  projectCount: number;
  kpi: {
    nameEn: string;
    nameAr: string;
    unit: string | null;
    latest: number | null;
    target: number | null;
    direction: string;
    period: string | null;
  } | null;
  clusterIds: string[];
  sort: number;
};

export type NavItem = {
  id: string;
  type: "initiative" | "project";
  outcomeId: string;
  targetId: string | null; // null = outcome level
  parentInitiativeId: string | null;
  code: string | null;
  titleEn: string;
  titleAr: string;
  status: string;
  ownerEntityName: string | null;
  startDate: string | null;
  endDate: string | null;
  deliverableCount: number;
  clusterIds: string[];
  sort: number;
};

export type NavigatorData = {
  edition: { id: string; code: string; nameEn: string; nameAr: string; status: string };
  editions: { code: string; nameEn: string; nameAr: string; status: string; isDefault: boolean }[];
  outcomes: NavOutcome[];
  targets: NavTarget[];
  items: NavItem[];
  clusters: { id: string; code: string | null; titleEn: string; titleAr: string; nodeType: string }[];
  /* CR03 2.2: the at-a-glance band */
  glance: {
    targetsOnTrack: number;
    targetsTotal: number;
    initiatives: number;
    projects: number;
    months: string[]; // "2026-03" oldest -> newest (12)
    updatesPerMonth: number[];
  };
};

const STOP_WORDS = new Set([
  "the", "of", "per", "a", "an", "to", "and", "rate", "average", "total",
  "growth", "year", "annual", "overall",
]);
function nameTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

export async function getNavigator(editionId: string): Promise<NavigatorData> {
  const [nodes, editions, allKpis, deliverables, clusterRels] = await Promise.all([
    getEditionNodes(editionId),
    getEditions(),
    db.select().from(schema.kpis),
    db
      .select({ nodeId: schema.deliverableMeta.nodeId })
      .from(schema.deliverableMeta),
    db
      .select()
      .from(schema.relations)
      .where(
        and(
          eq(schema.relations.fromType, "node"),
          eq(schema.relations.toType, "node"),
          inArray(schema.relations.relation, ["in_cluster", "under_enabler"])
        )
      ),
  ]);
  const edition = editions.find((e) => e.id === editionId)!;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const deliverableCounts = new Map<string, number>();
  for (const d of deliverables) {
    deliverableCounts.set(d.nodeId, (deliverableCounts.get(d.nodeId) ?? 0) + 1);
  }
  const clustersOf = new Map<string, string[]>();
  for (const r of clusterRels) {
    if (!byId.has(r.fromId)) continue;
    (clustersOf.get(r.fromId) ?? clustersOf.set(r.fromId, []).get(r.fromId)!).push(r.toId);
  }

  // Archives keep their historical shape: pane 1 shows the edition's top
  // level (sector strategies for NDS2, outcome areas for NDS1) and the
  // deeper panes show whatever levels exist (DECISIONS 39).
  const isNds3Shape = nodes.some((n) => n.nodeType === "target");
  const paneOneTypes = isNds3Shape
    ? ["outcome"]
    : [...new Set(nodes.filter((n) => !n.parentId).map((n) => n.nodeType))];

  const outcomesRaw = nodes
    .filter((n) => paneOneTypes.includes(n.nodeType) && !n.parentId)
    .sort((a, b) => a.sort - b.sort);
  const targetsRaw = nodes.filter((n) => n.nodeType === "target");
  const itemTypes = new Set(["initiative", "project"]);

  // KPI values for target bars: the seed keeps KPIs on outcomes, so each
  // outcome KPI is matched to at most one of that outcome's targets by
  // name-token overlap, presentation only (DECISIONS 40).
  const kpisByNode = new Map<string, typeof allKpis>();
  for (const k of allKpis) {
    (kpisByNode.get(k.nodeId) ?? kpisByNode.set(k.nodeId, []).get(k.nodeId)!).push(k);
  }
  const kpiForTarget = new Map<string, (typeof allKpis)[number]>();
  for (const outcome of outcomesRaw) {
    const kpis = kpisByNode.get(outcome.id) ?? [];
    const targets = targetsRaw
      .filter((t) => t.parentId === outcome.id)
      .sort((a, b) => a.sort - b.sort);
    const taken = new Set<string>();
    for (const kpi of kpis) {
      const kt = nameTokens(kpi.nameEn);
      let best: { t: (typeof targets)[number]; score: number } | null = null;
      for (const t of targets) {
        if (taken.has(t.id)) continue;
        const tt = nameTokens(t.titleEn);
        let score = 0;
        for (const w of kt) if (tt.has(w)) score++;
        if (score >= 2 && (!best || score > best.score)) best = { t, score };
      }
      if (best) {
        taken.add(best.t.id);
        kpiForTarget.set(best.t.id, kpi);
      }
    }
  }
  const matchedKpiIds = [...kpiForTarget.values()].map((k) => k.id);
  const latestByKpi = new Map<string, { value: number; period: string }>();
  if (matchedKpiIds.length) {
    const values = await db
      .select()
      .from(schema.kpiValues)
      .where(inArray(schema.kpiValues.kpiId, matchedKpiIds))
      .orderBy(asc(schema.kpiValues.period));
    for (const v of values) {
      if (v.actualValue != null)
        latestByKpi.set(v.kpiId, { value: v.actualValue, period: v.period });
    }
  }

  const items: NavItem[] = [];
  for (const n of nodes) {
    if (!itemTypes.has(n.nodeType)) continue;
    const parent = n.parentId ? byId.get(n.parentId) : null;
    let outcomeId = "";
    let targetId: string | null = null;
    let parentInitiativeId: string | null = null;
    if (n.nodeType === "initiative") {
      if (parent?.nodeType === "target") {
        targetId = parent.id;
        outcomeId = parent.parentId ?? "";
      } else if (parent && paneOneTypes.includes(parent.nodeType)) {
        outcomeId = parent.id; // outcome level
      } else if (parent) {
        outcomeId = parent.parentId ?? parent.id;
      }
    } else {
      // project: inherits through its initiative
      parentInitiativeId = parent?.id ?? null;
      const ini = parent;
      const iniParent = ini?.parentId ? byId.get(ini.parentId) : null;
      if (iniParent?.nodeType === "target") {
        targetId = iniParent.id;
        outcomeId = iniParent.parentId ?? "";
      } else if (iniParent && paneOneTypes.includes(iniParent.nodeType)) {
        outcomeId = iniParent.id;
      } else if (iniParent) {
        outcomeId = iniParent.parentId ?? iniParent.id;
      }
    }
    if (!outcomeId) continue;
    items.push({
      id: n.id,
      type: n.nodeType as "initiative" | "project",
      outcomeId,
      targetId,
      parentInitiativeId,
      code: n.code,
      titleEn: n.titleEn,
      titleAr: n.titleAr,
      status: n.status,
      ownerEntityName: n.ownerEntityName,
      startDate: n.startDate,
      endDate: n.endDate,
      deliverableCount: deliverableCounts.get(n.id) ?? 0,
      clusterIds:
        n.nodeType === "project"
          ? clustersOf.get(parentInitiativeId ?? "") ?? []
          : clustersOf.get(n.id) ?? [],
      sort: n.sort,
    });
  }

  const targets: NavTarget[] = targetsRaw
    .filter((t) => t.parentId)
    .map((t) => {
      const kpi = kpiForTarget.get(t.id) ?? null;
      const tItems = items.filter((i) => i.targetId === t.id);
      return {
        id: t.id,
        outcomeId: t.parentId!,
        code: t.code,
        slug: slugOfCode(t.code, t.id),
        titleEn: t.titleEn,
        titleAr: t.titleAr,
        status: t.status,
        initiativeCount: tItems.filter((i) => i.type === "initiative").length,
        projectCount: tItems.filter((i) => i.type === "project").length,
        kpi: kpi
          ? {
              nameEn: kpi.nameEn,
              nameAr: kpi.nameAr,
              unit: kpi.unit,
              latest: latestByKpi.get(kpi.id)?.value ?? kpi.baselineValue ?? null,
              target: kpi.targetValue,
              direction: kpi.direction,
              period:
                latestByKpi.get(kpi.id)?.period ??
                (kpi.baselineYear ? String(kpi.baselineYear) : null),
            }
          : null,
        clusterIds: [
          ...new Set(tItems.flatMap((i) => i.clusterIds)),
        ],
        sort: t.sort,
      };
    })
    .sort((a, b) => a.sort - b.sort);

  const outcomes: NavOutcome[] = outcomesRaw.map((o) => {
    const oTargets = targets.filter((t) => t.outcomeId === o.id);
    const good = oTargets.filter(
      (t) => t.status === "on_track" || t.status === "completed"
    );
    const oItems = items.filter((i) => i.outcomeId === o.id);
    return {
      id: o.id,
      code: o.code,
      descriptionEn: o.descriptionEn,
      descriptionAr: o.descriptionAr,
      ownerEntityName: o.ownerEntityName,
      slug: slugOfCode(o.code, o.id),
      titleEn: o.titleEn,
      titleAr: o.titleAr,
      status: o.status,
      progress: oTargets.length ? good.length / oTargets.length : 0,
      targetCount: oTargets.length,
      initiativeCount: oItems.filter((i) => i.type === "initiative").length,
      projectCount: oItems.filter((i) => i.type === "project").length,
    };
  });

  const clusters = nodes
    .filter((n) => n.nodeType === "cluster" || n.nodeType === "enabler" || n.nodeType === "sector_strategy")
    .map((c) => ({
      id: c.id,
      code: c.code,
      titleEn: c.titleEn,
      titleAr: c.titleAr,
      nodeType: c.nodeType,
    }));

  /* CR03 2.2: the at-a-glance band, with a 12-month status-update sparkline */
  const nodeIdSet = new Set(nodes.map((n) => n.id));
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const sinceIso = `${months[0]}-01T00:00:00.000Z`;
  const updateRows = await db
    .select({ nodeId: schema.statusUpdates.nodeId, createdAt: schema.statusUpdates.createdAt })
    .from(schema.statusUpdates)
    .where(gte(schema.statusUpdates.createdAt, sinceIso));
  const updatesPerMonth = months.map(
    (m) =>
      updateRows.filter((u) => nodeIdSet.has(u.nodeId) && u.createdAt.startsWith(m)).length
  );
  const glance = {
    targetsOnTrack: targets.filter((t) => t.status === "on_track" || t.status === "completed")
      .length,
    targetsTotal: targets.length,
    initiatives: items.filter((i) => i.type === "initiative").length,
    projects: items.filter((i) => i.type === "project").length,
    months,
    updatesPerMonth,
  };

  return {
    glance,
    edition: {
      id: edition.id,
      code: edition.code,
      nameEn: edition.nameEn,
      nameAr: edition.nameAr,
      status: edition.status,
    },
    editions: editions.map((e) => ({
      code: e.code,
      nameEn: e.nameEn,
      nameAr: e.nameAr,
      status: e.status,
      isDefault: e.isDefault === 1,
    })),
    outcomes,
    targets,
    items,
    clusters,
  };
}

export async function getNodeDetail(user: CurrentUser, nodeId: string) {
  const [node] = await db
    .select()
    .from(schema.strategyNodes)
    .where(eq(schema.strategyNodes.id, nodeId))
    .limit(1);
  if (!node) return null;
  const [edition] = await db
    .select()
    .from(schema.strategyEditions)
    .where(eq(schema.strategyEditions.id, node.editionId))
    .limit(1);
  const children = await db
    .select()
    .from(schema.strategyNodes)
    .where(eq(schema.strategyNodes.parentId, nodeId))
    .orderBy(asc(schema.strategyNodes.sort));
  const parent = node.parentId
    ? (
        await db
          .select()
          .from(schema.strategyNodes)
          .where(eq(schema.strategyNodes.id, node.parentId))
          .limit(1)
      )[0] ?? null
    : null;
  const kpis = await db.select().from(schema.kpis).where(eq(schema.kpis.nodeId, nodeId));
  const kpiValues = kpis.length
    ? await db
        .select()
        .from(schema.kpiValues)
        .where(inArray(schema.kpiValues.kpiId, kpis.map((k) => k.id)))
        .orderBy(asc(schema.kpiValues.period))
    : [];
  const updates = await db
    .select({
      id: schema.statusUpdates.id,
      status: schema.statusUpdates.status,
      progressPct: schema.statusUpdates.progressPct,
      summaryEn: schema.statusUpdates.summaryEn,
      summaryAr: schema.statusUpdates.summaryAr,
      risksJson: schema.statusUpdates.risksJson,
      nextStepsJson: schema.statusUpdates.nextStepsJson,
      evidenceDocumentIdsJson: schema.statusUpdates.evidenceDocumentIdsJson,
      period: schema.statusUpdates.period,
      createdAt: schema.statusUpdates.createdAt,
      authorNameEn: schema.users.nameEn,
      authorNameAr: schema.users.nameAr,
      authorColor: schema.users.avatarColor,
    })
    .from(schema.statusUpdates)
    .innerJoin(schema.users, eq(schema.users.id, schema.statusUpdates.authorId))
    .where(eq(schema.statusUpdates.nodeId, nodeId))
    .orderBy(desc(schema.statusUpdates.createdAt))
    .limit(20);

  // linked resources via relations
  const rels = await db
    .select()
    .from(schema.relations)
    .where(
      or(
        and(eq(schema.relations.fromType, "node"), eq(schema.relations.fromId, nodeId)),
        and(eq(schema.relations.toType, "node"), eq(schema.relations.toId, nodeId))
      )
    );
  const linkedDocIds = rels
    .map((r) => (r.fromType === "document" ? r.fromId : r.toType === "document" ? r.toId : null))
    .filter(Boolean) as string[];
  const linkedExpertIds = rels
    .map((r) => (r.fromType === "expert" ? r.fromId : r.toType === "expert" ? r.toId : null))
    .filter(Boolean) as string[];

  const linkedDocs = linkedDocIds.length
    ? await db.select().from(schema.documents).where(inArray(schema.documents.id, linkedDocIds))
    : [];
  const linkedExperts = linkedExpertIds.length
    ? await db.select().from(schema.experts).where(inArray(schema.experts.id, linkedExpertIds))
    : [];
  // CR02 3.2: initiative and project pages list their own linked lessons
  // (primary nodeId or an about_node relation); outcome and target pages
  // aggregate the lessons of everything beneath them.
  const descendantIds: string[] = [];
  if (node.nodeType === "outcome" || node.nodeType === "target") {
    const editionNodes = await getEditionNodes(node.editionId);
    const childIdsOf = new Map<string, string[]>();
    for (const n of editionNodes) {
      if (!n.parentId) continue;
      (childIdsOf.get(n.parentId) ?? childIdsOf.set(n.parentId, []).get(n.parentId)!).push(n.id);
    }
    const stack = [nodeId];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const c of childIdsOf.get(cur) ?? []) {
        descendantIds.push(c);
        stack.push(c);
      }
    }
  }
  const relLessonIds = rels
    .filter((r) => r.fromType === "lesson" && r.toType === "node" && r.toId === nodeId)
    .map((r) => r.fromId);
  const lessonConds = [inArray(schema.lessons.nodeId, [nodeId, ...descendantIds])];
  if (relLessonIds.length) lessonConds.push(inArray(schema.lessons.id, relLessonIds));
  const lessons = await db
    .select()
    .from(schema.lessons)
    .where(or(...lessonConds))
    .orderBy(desc(schema.lessons.createdAt))
    .limit(30);
  const lessonsAggregated = descendantIds.length > 0;

  const deps = await db
    .select()
    .from(schema.nodeDependencies)
    .where(
      or(eq(schema.nodeDependencies.nodeId, nodeId), eq(schema.nodeDependencies.dependsOnNodeId, nodeId))
    );
  const depNodeIds = [
    ...new Set(deps.flatMap((d) => [d.nodeId, d.dependsOnNodeId]).filter((id) => id !== nodeId)),
  ];
  const depNodes = depNodeIds.length
    ? await db.select().from(schema.strategyNodes).where(inArray(schema.strategyNodes.id, depNodeIds))
    : [];

  // lineage across editions
  const lineage = await db
    .select()
    .from(schema.nodeLineage)
    .where(or(eq(schema.nodeLineage.fromNodeId, nodeId), eq(schema.nodeLineage.toNodeId, nodeId)));
  const lineageNodeIds = [
    ...new Set(lineage.flatMap((l) => [l.fromNodeId, l.toNodeId]).filter((id) => id !== nodeId)),
  ];
  const lineageNodes = lineageNodeIds.length
    ? await db
        .select({
          id: schema.strategyNodes.id,
          titleEn: schema.strategyNodes.titleEn,
          titleAr: schema.strategyNodes.titleAr,
          editionId: schema.strategyNodes.editionId,
        })
        .from(schema.strategyNodes)
        .where(inArray(schema.strategyNodes.id, lineageNodeIds))
    : [];
  const editions = await getEditions();

  return {
    node,
    edition,
    parent,
    children,
    kpis,
    kpiValues,
    updates,
    linkedDocs: linkedDocs.filter((d) => !d.deletedAt && d.classificationLevel <= user.clearanceLevel),
    linkedExperts,
    lessons,
    lessonsAggregated,
    deps,
    depNodes,
    lineage,
    lineageNodes,
    editions,
  };
}

export async function createStatusUpdate(
  user: CurrentUser,
  input: {
    nodeId: string;
    status: string;
    progressPct: number;
    summaryEn?: string;
    summaryAr?: string;
    risks?: { text_en: string; text_ar?: string; severity?: string }[];
    nextSteps?: { text_en: string; text_ar?: string }[];
    evidenceDocumentIds?: string[];
    period?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const [node] = await db
    .select()
    .from(schema.strategyNodes)
    .where(eq(schema.strategyNodes.id, input.nodeId))
    .limit(1);
  if (!node) return { ok: false, error: "not_found" };
  if (!can(user, "create", "strategy")) return { ok: false, error: "forbidden" };
  await db.insert(schema.statusUpdates).values({
    id: newId(),
    nodeId: input.nodeId,
    authorId: user.id,
    status: input.status,
    progressPct: input.progressPct,
    summaryEn: input.summaryEn ?? null,
    summaryAr: input.summaryAr ?? null,
    risksJson: input.risks ? JSON.stringify(input.risks) : null,
    nextStepsJson: input.nextSteps ? JSON.stringify(input.nextSteps) : null,
    evidenceDocumentIdsJson: input.evidenceDocumentIds
      ? JSON.stringify(input.evidenceDocumentIds)
      : null,
    period: input.period ?? null,
    createdAt: nowIso(),
  });
  await db
    .update(schema.strategyNodes)
    .set({ status: input.status, updatedAt: nowIso() })
    .where(eq(schema.strategyNodes.id, input.nodeId));
  await record({
    userId: user.id,
    type: "status_update_posted",
    resourceType: "node",
    resourceId: input.nodeId,
    meta: { departmentId: user.departmentId },
  });
  await audit(user.id, "create", "status_update", input.nodeId, { status: input.status });
  await enqueue("embed_records", { resourceType: "node", resourceId: input.nodeId });
  return { ok: true };
}

export async function addKpiValue(
  user: CurrentUser,
  kpiId: string,
  period: string,
  value: number,
  note?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!can(user, "create", "strategy")) return { ok: false, error: "forbidden" };
  const [kpi] = await db.select().from(schema.kpis).where(eq(schema.kpis.id, kpiId)).limit(1);
  if (!kpi) return { ok: false, error: "not_found" };
  await db.insert(schema.kpiValues).values({
    id: newId(),
    kpiId,
    period,
    actualValue: value,
    note: note ?? null,
    enteredBy: user.id,
    createdAt: nowIso(),
  });
  await record({
    userId: user.id,
    type: "kpi_value_entered",
    resourceType: "kpi",
    resourceId: kpiId,
    meta: { departmentId: user.departmentId },
  });
  await audit(user.id, "create", "kpi_value", kpiId, { period, value });
  return { ok: true };
}
