import { cache as reactCache } from "react";
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

/* ------------------------------------------------------------------ */
/* CR05 2: responsible leads (departments and entities) on nodes       */
/* ------------------------------------------------------------------ */

export type LeadChip = {
  kind: "department" | "entity";
  role: "lead" | "supporting";
  id: string; // department or entity id
  nameEn: string;
  nameAr: string;
  shortEn: string;
  shortAr: string;
  entityKind: string | null; // ministry|agency|authority|company|international|other, null for departments
  verified: boolean;
};

/** Loads lead and supporting chips for a set of nodes, sorted lead-first. */
export async function loadLeadsFor(
  nodeIds: string[]
): Promise<Map<string, LeadChip[]>> {
  const out = new Map<string, LeadChip[]>();
  if (!nodeIds.length) return out;
  const rows = await db
    .select()
    .from(schema.nodeLeads)
    .where(inArray(schema.nodeLeads.nodeId, nodeIds));
  if (!rows.length) return out;
  const entityIds = [...new Set(rows.map((r) => r.entityId).filter(Boolean))] as string[];
  const deptIds = [...new Set(rows.map((r) => r.departmentId).filter(Boolean))] as string[];
  const [ents, deps] = await Promise.all([
    entityIds.length
      ? db.select().from(schema.entities).where(inArray(schema.entities.id, entityIds))
      : Promise.resolve([]),
    deptIds.length
      ? db
          .select()
          .from(schema.departments)
          .where(inArray(schema.departments.id, deptIds))
      : Promise.resolve([]),
  ]);
  const entById = new Map(ents.map((e) => [e.id, e]));
  const depById = new Map(deps.map((d) => [d.id, d]));
  for (const r of rows.sort(
    (a, b) => (a.role === b.role ? a.sort - b.sort : a.role === "lead" ? -1 : 1)
  )) {
    let chip: LeadChip | null = null;
    if (r.leadKind === "entity" && r.entityId) {
      const e = entById.get(r.entityId);
      if (e) {
        chip = {
          kind: "entity",
          role: r.role as "lead" | "supporting",
          id: e.id,
          nameEn: e.nameEn,
          nameAr: e.nameAr,
          shortEn: e.shortNameEn ?? e.nameEn,
          shortAr: e.shortNameAr ?? e.nameAr,
          entityKind: e.kind,
          verified: r.verified === 1,
        };
      }
    } else if (r.leadKind === "department" && r.departmentId) {
      const d = depById.get(r.departmentId);
      if (d) {
        chip = {
          kind: "department",
          role: r.role as "lead" | "supporting",
          id: d.id,
          nameEn: d.nameEn,
          nameAr: d.nameAr,
          shortEn: d.nameEn.replace(/^Department of /i, ""),
          shortAr: d.nameAr.replace(/^إدارة /, ""),
          entityKind: null,
          verified: r.verified === 1,
        };
      }
    }
    if (chip) {
      (out.get(r.nodeId) ?? out.set(r.nodeId, []).get(r.nodeId)!).push(chip);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* CR05 3: stakeholders on projects and initiatives                    */
/* ------------------------------------------------------------------ */

export const STAKEHOLDER_ROLE_ORDER = [
  "sponsor",
  "owner",
  "manager",
  "team",
  "expert",
  "external_partner",
] as const;

export type StakeholderRow = {
  id: string;
  nodeId: string;
  personKind: "employee" | "expert" | "external_contact";
  userId: string | null;
  expertId: string | null;
  nameEn: string;
  nameAr: string;
  organisationEn: string | null;
  organisationAr: string | null;
  email: string | null;
  avatarColor: string;
  role: string;
  roleNoteEn: string | null;
  roleNoteAr: string | null;
  domain: { id: string; nameEn: string; nameAr: string } | null;
  sinceDate: string | null;
  untilDate: string | null;
};

/** Loads the stakeholder section rows for a set of nodes, in the CR05 3.2
    order (sponsor, owner, manager, team, experts, external partners). */
export async function loadStakeholdersFor(
  nodeIds: string[]
): Promise<Map<string, StakeholderRow[]>> {
  const out = new Map<string, StakeholderRow[]>();
  if (!nodeIds.length) return out;
  const rows = await db
    .select()
    .from(schema.nodeStakeholders)
    .where(inArray(schema.nodeStakeholders.nodeId, nodeIds));
  if (!rows.length) return out;
  const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
  const expertIds = [...new Set(rows.map((r) => r.expertId).filter(Boolean))] as string[];
  const termIds = [...new Set(rows.map((r) => r.domainTermId).filter(Boolean))] as string[];
  const [users, experts, terms, allDeps] = await Promise.all([
    userIds.length
      ? db.select().from(schema.users).where(inArray(schema.users.id, userIds))
      : Promise.resolve([]),
    expertIds.length
      ? db.select().from(schema.experts).where(inArray(schema.experts.id, expertIds))
      : Promise.resolve([]),
    termIds.length
      ? db
          .select()
          .from(schema.taxonomyTerms)
          .where(inArray(schema.taxonomyTerms.id, termIds))
      : Promise.resolve([]),
    db.select().from(schema.departments),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const expertById = new Map(experts.map((e) => [e.id, e]));
  const termById = new Map(terms.map((t) => [t.id, t]));
  const depById = new Map(allDeps.map((d) => [d.id, d]));
  const orderOf = (role: string) => {
    const i = STAKEHOLDER_ROLE_ORDER.indexOf(role as (typeof STAKEHOLDER_ROLE_ORDER)[number]);
    return i === -1 ? 99 : i;
  };
  for (const r of rows.sort(
    (a, b) => orderOf(a.role) - orderOf(b.role) || a.sort - b.sort
  )) {
    const u = r.userId ? userById.get(r.userId) : null;
    const e = r.expertId ? expertById.get(r.expertId) : null;
    const dep = u?.departmentId ? depById.get(u.departmentId) : null;
    const term = r.domainTermId ? termById.get(r.domainTermId) : null;
    const row: StakeholderRow = {
      id: r.id,
      nodeId: r.nodeId,
      personKind: r.personKind as StakeholderRow["personKind"],
      userId: r.userId,
      expertId: r.expertId,
      nameEn: u?.nameEn ?? e?.nameEn ?? r.nameEn ?? "",
      nameAr: u?.nameAr ?? e?.nameAr ?? r.nameAr ?? r.nameEn ?? "",
      organisationEn:
        dep?.nameEn ?? e?.organisationEn ?? r.organisation ?? null,
      organisationAr:
        dep?.nameAr ?? e?.organisationAr ?? r.organisation ?? null,
      email: u?.email ?? e?.email ?? r.email ?? null,
      avatarColor: u?.avatarColor ?? e?.avatarColor ?? "maroon",
      role: r.role,
      roleNoteEn: r.roleNoteEn,
      roleNoteAr: r.roleNoteAr,
      domain: term ? { id: term.id, nameEn: term.nameEn, nameAr: term.nameAr } : null,
      sinceDate: r.sinceDate,
      untilDate: r.untilDate,
    };
    (out.get(r.nodeId) ?? out.set(r.nodeId, []).get(r.nodeId)!).push(row);
  }
  return out;
}

export type NavOutcome = {
  id: string;
  code: string | null;
  slug: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  /* CR05 2.2: lead chips replace the old free-text owner */
  leads: LeadChip[];
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
  /* CR05 2.2: lead and supporting chips replace the old free-text owner */
  leads: LeadChip[];
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

  const leadsByNode = await loadLeadsFor(
    nodes
      .filter((n) => itemTypes.has(n.nodeType) || paneOneTypes.includes(n.nodeType))
      .map((n) => n.id)
  );

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
      leads: leadsByNode.get(n.id) ?? [],
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
      leads: leadsByNode.get(o.id) ?? [],
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

/* ------------------------------------------------------------------ */
/* CR04 2: the Strategy Canvas extras                                   */
/* ------------------------------------------------------------------ */

export type QnvPillar = {
  key: "human" | "social" | "economic" | "environmental";
  outcomes: number[]; // outcome numbers (O1..O7)
};

/* CR04 2.2 seed mapping: Economic 1+2, Human 3, Social 4+5,
   Environmental 6, and outcome 7 is driven by all four. */
export const DEFAULT_QNV_PILLARS: QnvPillar[] = [
  { key: "human", outcomes: [3, 7] },
  { key: "social", outcomes: [4, 5, 7] },
  { key: "economic", outcomes: [1, 2, 7] },
  { key: "environmental", outcomes: [6, 7] },
];

export type ChapterInfo = {
  documentId: string;
  documentIdAr: string | null;
  pageFrom: number;
  pageTo: number;
  summaryEn: string;
  summaryAr: string;
};

export type CanvasExtras = {
  pillars: QnvPillar[];
  /* outcome node code (O1..O7) -> */
  kpiTiles: Record<
    string,
    {
      id: string;
      nameEn: string;
      nameAr: string;
      unit: string | null;
      decimals: number;
      direction: string;
      latestValue: number | null;
      latestPeriod: string | null;
      previousValue: number | null;
      spark: number[];
    }[]
  >;
  /* CR06: the four outcome stakeholder groups replace the CR04 expert chips */
  outcomeStakeholders: Record<string, OutcomeStakeholders>;
  signalsCount: Record<string, number>;
  outcomeTax: Record<string, string>; // node code -> outcome taxonomy code
  chapters: Record<string, ChapterInfo>;
};

/* ------------------------------------------------------------------ */
/* CR06 3: outcome stakeholders. The department owner is the           */
/* department-kind lead row on the outcome node itself (strategy_nodes  */
/* lost its owner columns to node_leads in CR05); lead entities         */
/* aggregate over the outcome's initiatives and projects; experts and   */
/* the sponsor/owner/manager groups aggregate node_stakeholders across  */
/* the outcome, its targets, and the items beneath, direct rows first.  */
/* ------------------------------------------------------------------ */

export type OutcomeStakeholderItem = {
  id: string;
  code: string | null;
  titleEn: string;
  titleAr: string;
  nodeType: string;
};

export type OutcomeDepartmentOwner = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  head: { id: string; nameEn: string; nameAr: string; avatarColor: string } | null;
};

export type OutcomeLeadEntity = { chip: LeadChip; count: number };

export type OutcomePerson = {
  key: string;
  userId: string | null;
  expertId: string | null;
  nameEn: string;
  nameAr: string;
  organisationEn: string | null;
  organisationAr: string | null;
  email: string | null;
  avatarColor: string;
  domains: { id: string; nameEn: string; nameAr: string }[];
  /* a row sits on the outcome node itself */
  direct: boolean;
  count: number;
  items: OutcomeStakeholderItem[];
};

export type OutcomeStakeholders = {
  outcomeId: string;
  departmentOwner: OutcomeDepartmentOwner | null;
  leadEntities: OutcomeLeadEntity[];
  experts: OutcomePerson[];
  leaders: { sponsor: OutcomePerson[]; owner: OutcomePerson[]; manager: OutcomePerson[] };
};

/** The four groups for one outcome, cached per request (CR06 3). React's
    cache() dedupes within one server request and never outlives it, so an
    edit is visible on the very next request. */
export const getOutcomeStakeholders = reactCache(
  (outcomeId: string): Promise<OutcomeStakeholders | null> =>
    computeOutcomeStakeholders(outcomeId)
);

async function computeOutcomeStakeholders(
  outcomeId: string
): Promise<OutcomeStakeholders | null> {
  const [outcome] = await db
    .select()
    .from(schema.strategyNodes)
    .where(eq(schema.strategyNodes.id, outcomeId))
    .limit(1);
  if (!outcome) return null;
  const nodes = await db
    .select()
    .from(schema.strategyNodes)
    .where(eq(schema.strategyNodes.editionId, outcome.editionId))
    .orderBy(asc(schema.strategyNodes.sort));
  const childrenOf = new Map<string, NodeLite[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    (childrenOf.get(n.parentId) ?? childrenOf.set(n.parentId, []).get(n.parentId)!).push(n);
  }
  const subtree: NodeLite[] = [];
  const walk = (id: string) => {
    for (const c of childrenOf.get(id) ?? []) {
      subtree.push(c);
      walk(c.id);
    }
  };
  walk(outcomeId);
  const targets = subtree.filter((n) => n.nodeType === "target");
  const items = subtree.filter((n) => n.nodeType === "initiative" || n.nodeType === "project");
  const infoOf = new Map<string, OutcomeStakeholderItem>(
    [outcome, ...subtree].map((n) => [
      n.id,
      { id: n.id, code: n.code, titleEn: n.titleEn, titleAr: n.titleAr, nodeType: n.nodeType },
    ])
  );

  /* 1. the department owner: the department-kind lead on the outcome node */
  let departmentOwner: OutcomeDepartmentOwner | null = null;
  const ownRows = await db
    .select()
    .from(schema.nodeLeads)
    .where(
      and(
        eq(schema.nodeLeads.nodeId, outcomeId),
        eq(schema.nodeLeads.leadKind, "department"),
        eq(schema.nodeLeads.role, "lead")
      )
    )
    .orderBy(asc(schema.nodeLeads.sort));
  if (ownRows[0]?.departmentId) {
    const [dep] = await db
      .select()
      .from(schema.departments)
      .where(eq(schema.departments.id, ownRows[0].departmentId))
      .limit(1);
    if (dep) {
      const [head] = dep.headUserId
        ? await db.select().from(schema.users).where(eq(schema.users.id, dep.headUserId)).limit(1)
        : [];
      departmentOwner = {
        id: dep.id,
        code: dep.code,
        nameEn: dep.nameEn,
        nameAr: dep.nameAr,
        head: head
          ? { id: head.id, nameEn: head.nameEn, nameAr: head.nameAr, avatarColor: head.avatarColor }
          : null,
      };
    }
  }

  /* 2. lead entities and departments across the initiatives and projects */
  const leadsMap = await loadLeadsFor(items.map((i) => i.id));
  const leadAgg = new Map<string, OutcomeLeadEntity>();
  for (const chips of leadsMap.values()) {
    for (const c of chips) {
      if (c.role !== "lead") continue;
      const key = `${c.kind}:${c.id}`;
      const g = leadAgg.get(key);
      if (g) g.count++;
      else leadAgg.set(key, { chip: c, count: 1 });
    }
  }
  const leadEntities = [...leadAgg.values()].sort(
    (a, b) => b.count - a.count || a.chip.nameEn.localeCompare(b.chip.nameEn)
  );

  /* 3 + 4. experts and the sponsor/owner/manager groups, deduplicated */
  const shMap = await loadStakeholdersFor([
    outcomeId,
    ...targets.map((t) => t.id),
    ...items.map((i) => i.id),
  ]);
  const keyOf = (r: StakeholderRow) =>
    r.expertId ? `x:${r.expertId}` : r.userId ? `u:${r.userId}` : `n:${r.nameEn}`;
  const collect = (role: string): Map<string, OutcomePerson> => {
    const agg = new Map<string, OutcomePerson>();
    for (const [nodeId, rows] of shMap) {
      for (const r of rows) {
        if (r.role !== role) continue;
        const key = keyOf(r);
        const g =
          agg.get(key) ??
          ({
            key,
            userId: r.userId,
            expertId: r.expertId,
            nameEn: r.nameEn,
            nameAr: r.nameAr,
            organisationEn: r.organisationEn,
            organisationAr: r.organisationAr,
            email: r.email,
            avatarColor: r.avatarColor,
            domains: [],
            direct: false,
            count: 0,
            items: [],
          } satisfies OutcomePerson);
        if (nodeId === outcomeId) g.direct = true;
        const item = infoOf.get(nodeId);
        if (item && !g.items.some((x) => x.id === item.id)) g.items.push(item);
        if (r.domain && !g.domains.some((d) => d.id === r.domain!.id)) g.domains.push(r.domain);
        agg.set(key, g);
      }
    }
    for (const g of agg.values()) g.count = g.items.length;
    return agg;
  };
  const order = (agg: Map<string, OutcomePerson>): OutcomePerson[] =>
    [...agg.values()].sort(
      (a, b) =>
        Number(b.direct) - Number(a.direct) ||
        b.count - a.count ||
        a.nameEn.localeCompare(b.nameEn)
    );

  return {
    outcomeId,
    departmentOwner,
    leadEntities,
    experts: order(collect("expert")),
    leaders: {
      sponsor: order(collect("sponsor")),
      owner: order(collect("owner")),
      manager: order(collect("manager")),
    },
  };
}

export async function getCanvasExtras(editionId: string): Promise<CanvasExtras> {
  const { getSetting } = await import("@/server/settings");
  const { outcomeNodeMap } = await import("@/server/scan/extract");
  const pillars = await getSetting<QnvPillar[]>("qnv_pillars", DEFAULT_QNV_PILLARS);
  const chapters = await getSetting<Record<string, ChapterInfo>>("outcome_chapters", {});

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
  const outcomeIds = outcomes.map((o) => o.id);

  // outcome node code -> taxonomy code, for Trends links and expert domains
  const taxMap = await outcomeNodeMap(); // tax -> nodeId
  const outcomeTax: Record<string, string> = {};
  for (const [tax, nodeId] of taxMap) {
    const node = outcomes.find((o) => o.id === nodeId);
    if (node?.code) outcomeTax[node.code] = tax;
  }

  // headline KPI tiles (only KPIs backed by a statistical indicator)
  const kpis = outcomeIds.length
    ? await db.select().from(schema.kpis).where(inArray(schema.kpis.nodeId, outcomeIds))
    : [];
  const indicatorIds = [...new Set(kpis.map((k) => k.indicatorId).filter(Boolean))] as string[];
  const indicators = indicatorIds.length
    ? await db
        .select()
        .from(schema.indicators)
        .where(inArray(schema.indicators.id, indicatorIds))
    : [];
  const values = indicatorIds.length
    ? await db
        .select()
        .from(schema.indicatorValues)
        .where(
          and(
            inArray(schema.indicatorValues.indicatorId, indicatorIds),
            eq(schema.indicatorValues.dimensionKey, "total")
          )
        )
        .orderBy(asc(schema.indicatorValues.period))
    : [];
  const kpiTiles: CanvasExtras["kpiTiles"] = {};
  for (const outcome of outcomes) {
    if (!outcome.code) continue;
    const tiles = kpis
      .filter((k) => k.nodeId === outcome.id && k.indicatorId)
      .slice(0, 4)
      .map((k) => {
        const ind = indicators.find((i) => i.id === k.indicatorId)!;
        if (!ind) return null;
        const series = values.filter((v) => v.indicatorId === ind.id);
        const latest = series.at(-1);
        const prev = series.at(-2);
        return {
          id: ind.id,
          nameEn: ind.nameEn,
          nameAr: ind.nameAr,
          unit: ind.unit,
          decimals: ind.decimals,
          direction: ind.direction,
          latestValue: latest?.value ?? null,
          latestPeriod: latest?.period ?? null,
          previousValue: prev?.value ?? null,
          spark: series.slice(-12).map((v) => v.value),
        };
      })
      .filter((t): t is NonNullable<typeof t> => Boolean(t));
    if (tiles.length) kpiTiles[outcome.code] = tiles;
  }

  // CR06: the outcome stakeholder groups replace the CR04 expert chips
  const outcomeStakeholders: CanvasExtras["outcomeStakeholders"] = {};
  for (const outcome of outcomes) {
    if (!outcome.code) continue;
    const groups = await getOutcomeStakeholders(outcome.id);
    if (groups) outcomeStakeholders[outcome.code] = groups;
  }

  // accepted signals per outcome
  const links = outcomeIds.length
    ? await db
        .select({ resourceId: schema.signalLinks.resourceId, signalId: schema.signalLinks.signalId })
        .from(schema.signalLinks)
        .innerJoin(schema.signals, eq(schema.signals.id, schema.signalLinks.signalId))
        .where(
          and(
            eq(schema.signalLinks.resourceType, "node"),
            inArray(schema.signalLinks.resourceId, outcomeIds),
            inArray(schema.signals.triageStatus, ["accepted", "converted"])
          )
        )
    : [];
  const signalsCount: CanvasExtras["signalsCount"] = {};
  for (const outcome of outcomes) {
    if (!outcome.code) continue;
    signalsCount[outcome.code] = new Set(
      links.filter((l) => l.resourceId === outcome.id).map((l) => l.signalId)
    ).size;
  }

  return { pillars, kpiTiles, outcomeStakeholders, signalsCount, outcomeTax, chapters };
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
  const leads = (await loadLeadsFor([nodeId])).get(nodeId) ?? [];
  const stakeholders = (await loadStakeholdersFor([nodeId])).get(nodeId) ?? [];
  const leadsByChild = Object.fromEntries(
    await loadLeadsFor(children.map((c) => c.id))
  ) as Record<string, LeadChip[]>;

  return {
    node,
    edition,
    parent,
    children,
    leads,
    stakeholders,
    leadsByChild,
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
  // CR05 4.6.11: a target status change recomputes the forecasts of the
  // indices linked to that node
  if (node.status !== input.status) {
    try {
      const linked = await db.select().from(schema.indices);
      const affected = linked.filter((idx) => {
        try {
          return (JSON.parse(idx.linkedNodeIdsJson ?? "[]") as string[]).includes(input.nodeId);
        } catch {
          return false;
        }
      });
      if (affected.length) {
        const { computeForecast } = await import("@/server/indices/compute");
        for (const idx of affected) await computeForecast(idx.id);
      }
    } catch (e) {
      console.error("index recompute after status change failed:", (e as Error)?.message);
    }
  }
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
