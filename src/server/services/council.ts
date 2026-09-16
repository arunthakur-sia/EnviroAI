// CR07 2: the Council Strategy, NPC's own institutional strategy, read as a
// results chain: goals, intermediate outcomes, outputs, projects, activities,
// with an indicator card at every level. Labels follow the results-based
// planning manual (sources/manual/manual-structure.md); the deviations are
// recorded in DECISIONS.md.
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { getSetting } from "@/server/settings";
import { loadStakeholdersFor, type StakeholderRow } from "@/server/services/strategy";

/* ------------------------------------------------------------------ */
/* the results chain                                                    */
/* ------------------------------------------------------------------ */

export const COUNCIL_LEVELS = [
  "goal",
  "intermediate_outcome",
  "output",
  "project",
  "activity",
] as const;
export type CouncilLevel = (typeof COUNCIL_LEVELS)[number];

/* CR07 2.4: the arithmetic lives in a database-free module so the client views
   share this implementation rather than keeping a second copy in step. */
import {
  ragOf,
  periodFor,
  periodCadence,
  periodRange,
  latestReported,
  type Cadence,
  type Rag,
  type IndicatorPoint,
} from "@/lib/council-math";

export { ragOf, periodFor, periodCadence, periodRange, latestReported };
export type { Cadence, Rag, IndicatorPoint };

export type CouncilValue = {
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
};

export type CouncilStrategyHeader = {
  id: string;
  nameEn: string;
  nameAr: string;
  periodFrom: string | null;
  periodTo: string | null;
  visionEn: string | null;
  visionAr: string | null;
  missionEn: string | null;
  missionAr: string | null;
  values: CouncilValue[];
  status: string;
  approvedOn: string | null;
  sourceDocumentId: string | null;
  isIllustrative: boolean;
  owner: { id: string; code: string; nameEn: string; nameAr: string } | null;
};

export type CouncilIndicatorCard = {
  id: string;
  nodeId: string;
  code: string;
  nameEn: string;
  nameAr: string;
  definitionEn: string | null;
  definitionAr: string | null;
  formulaEn: string | null;
  formulaAr: string | null;
  unit: string | null;
  direction: string;
  baselineYear: string | null;
  baselineValue: number | null;
  frequency: Cadence;
  dataSourceEn: string | null;
  dataSourceAr: string | null;
  meansOfVerificationEn: string | null;
  meansOfVerificationAr: string | null;
  responsible: { id: string; nameEn: string; nameAr: string } | null;
  linkedStatisticsIndicatorId: string | null;
  notesEn: string | null;
  notesAr: string | null;
  series: IndicatorPoint[];
  /** the newest period that has an actual */
  latest: IndicatorPoint | null;
  /** on_target | at_risk | behind | no_data for the latest reported period */
  rag: Rag;
  /** the share of target reached, 0 to over 1, direction aware */
  attainment: number | null;
};

export type CouncilNodeView = {
  id: string;
  parentId: string | null;
  level: CouncilLevel;
  code: string | null;
  titleEn: string;
  titleAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  budgetQar: number | null;
  priorityImpact: number | null;
  priorityFeasibility: number | null;
  sort: number;
  isIllustrative: boolean;
  ownerUnit: { id: string; code: string; nameEn: string; nameAr: string } | null;
  ownerUser: { id: string; nameEn: string; nameAr: string; avatarColor: string } | null;
  /** indicator ids attached to this node */
  indicatorIds: string[];
  /** share of this node's indicators that are on target, null when it has none */
  onTargetShare: number | null;
  childIds: string[];
  counts: { intermediateOutcomes: number; outputs: number; projects: number; activities: number };
};

export type CouncilAlignmentView = {
  id: string;
  councilNodeId: string;
  targetKind: string;
  targetId: string;
  labelEn: string | null;
  labelAr: string | null;
  noteEn: string | null;
  noteAr: string | null;
  /** resolved NDS node, when the target is one */
  ndsNodeId: string | null;
  ndsSlug: string | null;
};

export type CouncilPageData = {
  strategy: CouncilStrategyHeader;
  nodes: CouncilNodeView[];
  indicators: CouncilIndicatorCard[];
  alignment: CouncilAlignmentView[];
  analysis: {
    swot: { quadrant: string; textEn: string; textAr: string }[];
    stakeholders: {
      nameEn: string;
      nameAr: string;
      interest: number;
      influence: number;
      roleEn: string;
      roleAr: string;
    }[];
    challenges: {
      titleEn: string;
      titleAr: string;
      descriptionEn: string;
      descriptionAr: string;
      goalCode: string;
    }[];
    baseline: { textEn: string; textAr: string }[];
  };
  risks: {
    id: string;
    code: string | null;
    titleEn: string;
    titleAr: string;
    descriptionEn: string | null;
    descriptionAr: string | null;
    likelihood: number;
    impact: number;
    mitigationEn: string | null;
    mitigationAr: string | null;
    status: string;
    nodeId: string | null;
    owner: { id: string; nameEn: string; nameAr: string } | null;
  }[];
  governance: {
    id: string;
    bodyNameEn: string;
    bodyNameAr: string;
    roleEn: string | null;
    roleAr: string | null;
    cadence: string | null;
    members: { en: string; ar: string }[];
  }[];
  canEdit: boolean;
};

/* ------------------------------------------------------------------ */
/* the page payload                                                     */
/* ------------------------------------------------------------------ */

export async function getDefaultStrategy() {
  const rows = await db
    .select()
    .from(schema.councilStrategies)
    .orderBy(desc(schema.councilStrategies.isDefault), desc(schema.councilStrategies.periodFrom));
  return rows[0] ?? null;
}

export async function getCouncilStrategies() {
  return db
    .select()
    .from(schema.councilStrategies)
    .orderBy(desc(schema.councilStrategies.isDefault), desc(schema.councilStrategies.periodFrom));
}

/** CR07 2.1: the Strategy Office is a configurable unit in Settings. */
export async function strategyOfficeUnitId(): Promise<string | null> {
  const setting = await getSetting<{ unitCode?: string }>("council_strategy_office", {});
  const code = setting.unitCode || "IDP";
  const [unit] = await db
    .select({ id: schema.orgUnits.id })
    .from(schema.orgUnits)
    .where(eq(schema.orgUnits.code, code))
    .limit(1);
  return unit?.id ?? null;
}

/** CR07 2.1: Knowledge Admin, Super Admin, and the Strategy Office may edit. */
export async function canEditCouncil(user: CurrentUser | null): Promise<boolean> {
  if (!user) return false;
  if (can(user, "manage", "settings") || can(user, "edit_any", "council")) return true;
  const officeId = await strategyOfficeUnitId();
  return Boolean(officeId) && user.departmentId === officeId;
}

export async function getCouncilPageData(
  user: CurrentUser,
  strategyId?: string
): Promise<CouncilPageData | null> {
  const strategyRow = strategyId
    ? (
        await db
          .select()
          .from(schema.councilStrategies)
          .where(eq(schema.councilStrategies.id, strategyId))
          .limit(1)
      )[0]
    : await getDefaultStrategy();
  if (!strategyRow) return null;

  const [nodes, indicatorRows, targets, values, alignmentRows, analysisRows, riskRows, govRows, units, users] =
    await Promise.all([
      db
        .select()
        .from(schema.councilNodes)
        .where(eq(schema.councilNodes.strategyId, strategyRow.id))
        .orderBy(asc(schema.councilNodes.sort)),
      db.select().from(schema.councilIndicators),
      db.select().from(schema.councilIndicatorTargets),
      db.select().from(schema.councilIndicatorValues),
      db.select().from(schema.councilAlignment),
      db
        .select()
        .from(schema.councilAnalysis)
        .where(eq(schema.councilAnalysis.strategyId, strategyRow.id))
        .orderBy(asc(schema.councilAnalysis.sort)),
      db
        .select()
        .from(schema.councilRisks)
        .where(eq(schema.councilRisks.strategyId, strategyRow.id)),
      db
        .select()
        .from(schema.councilGovernance)
        .where(eq(schema.councilGovernance.strategyId, strategyRow.id))
        .orderBy(asc(schema.councilGovernance.sort)),
      db.select().from(schema.orgUnits),
      db
        .select({
          id: schema.users.id,
          nameEn: schema.users.nameEn,
          nameAr: schema.users.nameAr,
          avatarColor: schema.users.avatarColor,
        })
        .from(schema.users),
    ]);

  const nodeIds = new Set(nodes.map((n) => n.id));
  const unitById = new Map(units.map((u) => [u.id, u]));
  const userById = new Map(users.map((u) => [u.id, u]));

  /* indicator cards with their series */
  const targetsBy = new Map<string, Map<string, number | null>>();
  for (const t of targets) {
    const m = targetsBy.get(t.indicatorId) ?? targetsBy.set(t.indicatorId, new Map()).get(t.indicatorId)!;
    m.set(t.period, t.targetValue);
  }
  const valuesBy = new Map<string, Map<string, number | null>>();
  for (const v of values) {
    const m = valuesBy.get(v.indicatorId) ?? valuesBy.set(v.indicatorId, new Map()).get(v.indicatorId)!;
    m.set(v.period, v.actualValue);
  }

  const indicators: CouncilIndicatorCard[] = indicatorRows
    .filter((i) => nodeIds.has(i.nodeId))
    .map((i) => {
      const tMap = targetsBy.get(i.id) ?? new Map();
      const vMap = valuesBy.get(i.id) ?? new Map();
      const periods = [...new Set([...tMap.keys(), ...vMap.keys()])].sort();
      const series: IndicatorPoint[] = periods.map((period) => ({
        period,
        target: tMap.get(period) ?? null,
        actual: vMap.get(period) ?? null,
      }));
      const latest = latestReported(series);
      const { rag, attainment } = ragOf(latest?.actual, latest?.target, i.direction);
      return {
        id: i.id,
        nodeId: i.nodeId,
        code: i.code ?? "",
        nameEn: i.nameEn,
        nameAr: i.nameAr,
        definitionEn: i.definitionEn,
        definitionAr: i.definitionAr,
        formulaEn: i.formulaEn,
        formulaAr: i.formulaAr,
        unit: i.unit,
        direction: i.direction,
        baselineYear: i.baselineYear,
        baselineValue: i.baselineValue,
        frequency: i.frequency as Cadence,
        dataSourceEn: i.dataSourceEn,
        dataSourceAr: i.dataSourceAr,
        meansOfVerificationEn: i.meansOfVerificationEn,
        meansOfVerificationAr: i.meansOfVerificationAr,
        responsible: i.responsibleUserId
          ? (() => {
              const u = userById.get(i.responsibleUserId);
              return u ? { id: u.id, nameEn: u.nameEn, nameAr: u.nameAr } : null;
            })()
          : null,
        linkedStatisticsIndicatorId: i.linkedStatisticsIndicatorId,
        notesEn: i.notesEn,
        notesAr: i.notesAr,
        series,
        latest,
        rag,
        attainment,
      };
    });

  const indicatorsByNode = new Map<string, CouncilIndicatorCard[]>();
  for (const i of indicators) {
    (indicatorsByNode.get(i.nodeId) ?? indicatorsByNode.set(i.nodeId, []).get(i.nodeId)!).push(i);
  }

  /* node views with roll-up counts and the on-target share */
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    (childrenOf.get(n.parentId) ?? childrenOf.set(n.parentId, []).get(n.parentId)!).push(n.id);
  }
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const subtreeOf = (id: string, depth = 0): string[] => {
    if (depth > 6) return [];
    const direct = childrenOf.get(id) ?? [];
    return [...direct, ...direct.flatMap((c) => subtreeOf(c, depth + 1))];
  };

  const nodeViews: CouncilNodeView[] = nodes.map((n) => {
    const subtree = subtreeOf(n.id);
    const own = indicatorsByNode.get(n.id) ?? [];
    // a goal's ring counts every indicator beneath it as well as its own
    const all = [...own, ...subtree.flatMap((id) => indicatorsByNode.get(id) ?? [])];
    const scored = all.filter((i) => i.rag !== "no_data");
    return {
      id: n.id,
      parentId: n.parentId,
      level: n.level as CouncilLevel,
      code: n.code,
      titleEn: n.titleEn,
      titleAr: n.titleAr,
      descriptionEn: n.descriptionEn,
      descriptionAr: n.descriptionAr,
      status: n.status,
      startDate: n.startDate,
      endDate: n.endDate,
      budgetQar: n.budgetQar,
      priorityImpact: n.priorityImpact,
      priorityFeasibility: n.priorityFeasibility,
      sort: n.sort,
      isIllustrative: n.isIllustrative === 1,
      ownerUnit: n.ownerUnitId
        ? (() => {
            const u = unitById.get(n.ownerUnitId);
            return u ? { id: u.id, code: u.code, nameEn: u.nameEn, nameAr: u.nameAr } : null;
          })()
        : null,
      ownerUser: n.ownerUserId ? userById.get(n.ownerUserId) ?? null : null,
      indicatorIds: own.map((i) => i.id),
      onTargetShare: scored.length
        ? scored.filter((i) => i.rag === "on_target").length / scored.length
        : null,
      childIds: childrenOf.get(n.id) ?? [],
      counts: {
        intermediateOutcomes: subtree.filter((id) => nodeById.get(id)?.level === "intermediate_outcome").length,
        outputs: subtree.filter((id) => nodeById.get(id)?.level === "output").length,
        projects: subtree.filter((id) => nodeById.get(id)?.level === "project").length,
        activities: subtree.filter((id) => nodeById.get(id)?.level === "activity").length,
      },
    };
  });

  /* alignment, resolved to the NDS node so the chip can open it */
  const ndsTargets = alignmentRows.filter((a) => a.targetKind === "nds_node").map((a) => a.targetId);
  const ndsNodes = ndsTargets.length
    ? await db
        .select({
          id: schema.strategyNodes.id,
          code: schema.strategyNodes.code,
        })
        .from(schema.strategyNodes)
        .where(inArray(schema.strategyNodes.id, ndsTargets))
    : [];
  const ndsById = new Map(ndsNodes.map((n) => [n.id, n]));
  const alignment: CouncilAlignmentView[] = alignmentRows
    .filter((a) => nodeIds.has(a.councilNodeId))
    .map((a) => {
      const nds = a.targetKind === "nds_node" ? ndsById.get(a.targetId) : undefined;
      return {
        id: a.id,
        councilNodeId: a.councilNodeId,
        targetKind: a.targetKind,
        targetId: a.targetId,
        labelEn: a.labelEn,
        labelAr: a.labelAr,
        noteEn: a.noteEn,
        noteAr: a.noteAr,
        ndsNodeId: nds?.id ?? null,
        ndsSlug: nds?.code ? nds.code.toLowerCase().replace(/\./g, "-") : null,
      };
    });

  /* the situation analysis, unpacked per kind */
  const analysis: CouncilPageData["analysis"] = {
    swot: [],
    stakeholders: [],
    challenges: [],
    baseline: [],
  };
  for (const row of analysisRows) {
    let payload: unknown;
    try {
      payload = JSON.parse(row.payloadJson);
    } catch {
      continue;
    }
    if (!Array.isArray(payload)) continue;
    if (row.kind === "swot") analysis.swot = payload as typeof analysis.swot;
    if (row.kind === "stakeholder") analysis.stakeholders = payload as typeof analysis.stakeholders;
    if (row.kind === "challenge") analysis.challenges = payload as typeof analysis.challenges;
    if (row.kind === "baseline") analysis.baseline = payload as typeof analysis.baseline;
  }

  let strategyValues: CouncilValue[] = [];
  try {
    const parsed = JSON.parse(strategyRow.valuesJson ?? "[]");
    if (Array.isArray(parsed)) strategyValues = parsed;
  } catch {
    strategyValues = [];
  }

  const ownerUnit = strategyRow.ownerUnitId ? unitById.get(strategyRow.ownerUnitId) : undefined;

  return {
    strategy: {
      id: strategyRow.id,
      nameEn: strategyRow.nameEn,
      nameAr: strategyRow.nameAr,
      periodFrom: strategyRow.periodFrom,
      periodTo: strategyRow.periodTo,
      visionEn: strategyRow.visionEn,
      visionAr: strategyRow.visionAr,
      missionEn: strategyRow.missionEn,
      missionAr: strategyRow.missionAr,
      values: strategyValues,
      status: strategyRow.status,
      approvedOn: strategyRow.approvedOn,
      sourceDocumentId: strategyRow.sourceDocumentId,
      isIllustrative: strategyRow.isIllustrative === 1,
      owner: ownerUnit
        ? { id: ownerUnit.id, code: ownerUnit.code, nameEn: ownerUnit.nameEn, nameAr: ownerUnit.nameAr }
        : null,
    },
    nodes: nodeViews,
    indicators,
    alignment,
    analysis,
    risks: riskRows.map((r) => ({
      id: r.id,
      code: r.code,
      titleEn: r.titleEn,
      titleAr: r.titleAr,
      descriptionEn: r.descriptionEn,
      descriptionAr: r.descriptionAr,
      likelihood: r.likelihood,
      impact: r.impact,
      mitigationEn: r.mitigationEn,
      mitigationAr: r.mitigationAr,
      status: r.status,
      nodeId: r.nodeId,
      owner: r.ownerUserId
        ? (() => {
            const u = userById.get(r.ownerUserId);
            return u ? { id: u.id, nameEn: u.nameEn, nameAr: u.nameAr } : null;
          })()
        : null,
    })),
    governance: govRows.map((g) => {
      let members: { en: string; ar: string }[] = [];
      try {
        const parsed = JSON.parse(g.membersJson ?? "[]");
        if (Array.isArray(parsed)) members = parsed;
      } catch {
        members = [];
      }
      return {
        id: g.id,
        bodyNameEn: g.bodyNameEn,
        bodyNameAr: g.bodyNameAr,
        roleEn: g.roleEn,
        roleAr: g.roleAr,
        cadence: g.cadence,
        members,
      };
    }),
    canEdit: await canEditCouncil(user),
  };
}

/* ------------------------------------------------------------------ */
/* CR07 2.4.3: the scorecard for a chosen period                        */
/* ------------------------------------------------------------------ */

export type ScorecardGoal = {
  goalId: string;
  code: string | null;
  titleEn: string;
  titleAr: string;
  /** indicators of the chosen cadence that reported in this period */
  reported: number;
  onTarget: number;
  atRisk: number;
  behind: number;
  /** share on target among those that reported, null when none did */
  share: number | null;
  /** indicators of another cadence, so the ring says so rather than lying */
  otherCadence: { quarterly: number; yearly: number; monthly: number };
  counts: { intermediateOutcomes: number; outputs: number; projects: number };
};

export type Scorecard = {
  period: string;
  cadence: Cadence;
  goals: ScorecardGoal[];
};

/** CR07 2.4.3: rings recalculated for the indicators of a matching cadence;
    the others are reported as "reported quarterly" rather than left blank. */
export async function getScorecard(
  user: CurrentUser,
  opts: { strategyId?: string; period?: string } = {}
): Promise<Scorecard | null> {
  const data = await getCouncilPageData(user, opts.strategyId);
  if (!data) return null;
  const period = opts.period ?? periodFor("yearly");
  const cadence = periodCadence(period);
  return buildScorecard(data, period, cadence);
}

export function buildScorecard(
  data: CouncilPageData,
  period: string,
  cadence: Cadence
): Scorecard {
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const goalOf = (nodeId: string): string | null => {
    let cursor = byId.get(nodeId);
    for (let i = 0; i < 6 && cursor; i++) {
      if (cursor.level === "goal") return cursor.id;
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return null;
  };
  const goals = data.nodes.filter((n) => n.level === "goal").sort((a, b) => a.sort - b.sort);
  const perGoal = new Map<string, ScorecardGoal>();
  for (const g of goals) {
    perGoal.set(g.id, {
      goalId: g.id,
      code: g.code,
      titleEn: g.titleEn,
      titleAr: g.titleAr,
      reported: 0,
      onTarget: 0,
      atRisk: 0,
      behind: 0,
      share: null,
      otherCadence: { quarterly: 0, yearly: 0, monthly: 0 },
      counts: {
        intermediateOutcomes: g.counts.intermediateOutcomes,
        outputs: g.counts.outputs,
        projects: g.counts.projects,
      },
    });
  }
  for (const indicator of data.indicators) {
    const goalId = goalOf(indicator.nodeId);
    if (!goalId) continue;
    const entry = perGoal.get(goalId);
    if (!entry) continue;
    if (indicator.frequency !== cadence) {
      entry.otherCadence[indicator.frequency] += 1;
      continue;
    }
    const point = indicator.series.find((p) => p.period === period);
    if (!point || point.actual == null) continue;
    const { rag } = ragOf(point.actual, point.target, indicator.direction);
    if (rag === "no_data") continue;
    entry.reported += 1;
    if (rag === "on_target") entry.onTarget += 1;
    else if (rag === "at_risk") entry.atRisk += 1;
    else entry.behind += 1;
  }
  for (const entry of perGoal.values()) {
    entry.share = entry.reported ? entry.onTarget / entry.reported : null;
  }
  return { period, cadence, goals: [...perGoal.values()] };
}

/* ------------------------------------------------------------------ */
/* CR07 2.4.6: the results matrix, goals by period                      */
/* ------------------------------------------------------------------ */

export type ResultsMatrix = {
  cadence: Cadence;
  periods: string[];
  rows: {
    goalId: string;
    code: string | null;
    titleEn: string;
    titleAr: string;
    cells: {
      period: string;
      rag: Rag;
      share: number | null;
      reported: number;
      /** up | down | flat against the previous reported period */
      trend: "up" | "down" | "flat" | null;
    }[];
  }[];
};

export function buildResultsMatrix(data: CouncilPageData, cadence: Cadence): ResultsMatrix {
  const from = data.strategy.periodFrom ?? "2025-01-01";
  const today = new Date().toISOString().slice(0, 10);
  const all = periodRange(cadence, from, today);
  // only periods that carry at least one actual of this cadence
  const reportedPeriods = new Set<string>();
  for (const i of data.indicators) {
    if (i.frequency !== cadence) continue;
    for (const p of i.series) if (p.actual != null) reportedPeriods.add(p.period);
  }
  const periods = all.filter((p) => reportedPeriods.has(p));
  const rows: ResultsMatrix["rows"] = [];
  const goals = data.nodes.filter((n) => n.level === "goal").sort((a, b) => a.sort - b.sort);
  for (const g of goals) {
    const cells = periods.map((period) => {
      const card = buildScorecard(data, period, cadence).goals.find((x) => x.goalId === g.id);
      const share = card?.share ?? null;
      const rag: Rag =
        share == null ? "no_data" : share >= 0.8 ? "on_target" : share >= 0.5 ? "at_risk" : "behind";
      return { period, rag, share, reported: card?.reported ?? 0, trend: null as null };
    });
    for (let i = 1; i < cells.length; i++) {
      const prev = cells[i - 1].share;
      const now = cells[i].share;
      if (prev == null || now == null) continue;
      cells[i].trend = (now > prev + 0.02 ? "up" : now < prev - 0.02 ? "down" : "flat") as never;
    }
    rows.push({ goalId: g.id, code: g.code, titleEn: g.titleEn, titleAr: g.titleAr, cells });
  }
  return { cadence, periods, rows };
}

/* ------------------------------------------------------------------ */
/* CR07 2.4.5: one project, everything the drawer shows                 */
/* ------------------------------------------------------------------ */

export type CouncilProjectDetail = {
  node: CouncilNodeView;
  path: { id: string; code: string | null; titleEn: string; titleAr: string; level: string }[];
  indicators: CouncilIndicatorCard[];
  activities: CouncilNodeView[];
  milestones: {
    id: string;
    titleEn: string;
    titleAr: string;
    dueDate: string | null;
    doneDate: string | null;
    status: string;
  }[];
  dependencies: { id: string; nodeId: string; titleEn: string; titleAr: string; code: string | null; noteEn: string | null; noteAr: string | null }[];
  inputs: { people: number | null; systemsEn: string[]; systemsAr: string[]; noteEn: string | null; noteAr: string | null };
  risks: CouncilPageData["risks"];
  siblings: string[];
  /* CR07 2.5: council projects use the same six-role stakeholder section */
  stakeholders: StakeholderRow[];
};

/**
 * One project, everything the drawer shows. This deliberately does NOT go
 * through getCouncilPageData: the drawer is opened constantly and the page
 * payload carries every node, every indicator and several thousand target and
 * value rows, which made each drawer open a second and a half of work.
 */
export async function getCouncilProject(
  user: CurrentUser,
  nodeId: string
): Promise<CouncilProjectDetail | null> {
  const [row] = await db
    .select()
    .from(schema.councilNodes)
    .where(eq(schema.councilNodes.id, nodeId))
    .limit(1);
  if (!row) return null;

  // the nodes of this strategy only, for the path, the children and siblings
  const siblingsAndKin = await db
    .select()
    .from(schema.councilNodes)
    .where(eq(schema.councilNodes.strategyId, row.strategyId))
    .orderBy(asc(schema.councilNodes.sort));
  const rowById = new Map(siblingsAndKin.map((n) => [n.id, n]));
  const units = await db.select().from(schema.orgUnits);
  const unitById = new Map(units.map((u) => [u.id, u]));
  const [owner] = row.ownerUserId
    ? await db
        .select({
          id: schema.users.id,
          nameEn: schema.users.nameEn,
          nameAr: schema.users.nameAr,
          avatarColor: schema.users.avatarColor,
        })
        .from(schema.users)
        .where(eq(schema.users.id, row.ownerUserId))
        .limit(1)
    : [];

  const toView = (n: (typeof siblingsAndKin)[number]): CouncilNodeView => {
    const unit = n.ownerUnitId ? unitById.get(n.ownerUnitId) : undefined;
    const kids = siblingsAndKin.filter((c) => c.parentId === n.id);
    return {
      id: n.id,
      parentId: n.parentId,
      level: n.level as CouncilLevel,
      code: n.code,
      titleEn: n.titleEn,
      titleAr: n.titleAr,
      descriptionEn: n.descriptionEn,
      descriptionAr: n.descriptionAr,
      status: n.status,
      startDate: n.startDate,
      endDate: n.endDate,
      budgetQar: n.budgetQar,
      priorityImpact: n.priorityImpact,
      priorityFeasibility: n.priorityFeasibility,
      sort: n.sort,
      isIllustrative: n.isIllustrative === 1,
      ownerUnit: unit
        ? { id: unit.id, code: unit.code, nameEn: unit.nameEn, nameAr: unit.nameAr }
        : null,
      ownerUser: n.id === row.id ? owner ?? null : null,
      indicatorIds: [],
      onTargetShare: null,
      childIds: kids.map((c) => c.id),
      counts: {
        intermediateOutcomes: 0,
        outputs: 0,
        projects: 0,
        activities: kids.filter((c) => c.level === "activity").length,
      },
    };
  };
  const node = toView(row);

  const path: CouncilProjectDetail["path"] = [];
  let cursor = row.parentId ? rowById.get(row.parentId) : undefined;
  for (let i = 0; i < 6 && cursor; i++) {
    path.unshift({
      id: cursor.id,
      code: cursor.code,
      titleEn: cursor.titleEn,
      titleAr: cursor.titleAr,
      level: cursor.level,
    });
    cursor = cursor.parentId ? rowById.get(cursor.parentId) : undefined;
  }

  const [milestones, dependencies, stakeholderMap, indicatorRows, riskRows] = await Promise.all([
    db
      .select()
      .from(schema.councilMilestones)
      .where(eq(schema.councilMilestones.nodeId, nodeId))
      .orderBy(asc(schema.councilMilestones.sort)),
    db
      .select()
      .from(schema.councilDependencies)
      .where(eq(schema.councilDependencies.nodeId, nodeId)),
    loadStakeholdersFor([nodeId]),
    db.select().from(schema.councilIndicators).where(eq(schema.councilIndicators.nodeId, nodeId)),
    db.select().from(schema.councilRisks).where(eq(schema.councilRisks.nodeId, nodeId)),
  ]);

  // only the series of this project's own indicators
  const indicatorIds = indicatorRows.map((i) => i.id);
  const [targets, values] = indicatorIds.length
    ? await Promise.all([
        db
          .select()
          .from(schema.councilIndicatorTargets)
          .where(inArray(schema.councilIndicatorTargets.indicatorId, indicatorIds)),
        db
          .select()
          .from(schema.councilIndicatorValues)
          .where(inArray(schema.councilIndicatorValues.indicatorId, indicatorIds)),
      ])
    : [[], []];
  const indicators: CouncilIndicatorCard[] = indicatorRows.map((i) => {
    const periods = [
      ...new Set([
        ...targets.filter((t) => t.indicatorId === i.id).map((t) => t.period),
        ...values.filter((v) => v.indicatorId === i.id).map((v) => v.period),
      ]),
    ].sort();
    const series: IndicatorPoint[] = periods.map((period) => ({
      period,
      target: targets.find((t) => t.indicatorId === i.id && t.period === period)?.targetValue ?? null,
      actual: values.find((v) => v.indicatorId === i.id && v.period === period)?.actualValue ?? null,
    }));
    const latest = latestReported(series);
    const { rag, attainment } = ragOf(latest?.actual, latest?.target, i.direction);
    return {
      id: i.id,
      nodeId: i.nodeId,
      code: i.code ?? "",
      nameEn: i.nameEn,
      nameAr: i.nameAr,
      definitionEn: i.definitionEn,
      definitionAr: i.definitionAr,
      formulaEn: i.formulaEn,
      formulaAr: i.formulaAr,
      unit: i.unit,
      direction: i.direction,
      baselineYear: i.baselineYear,
      baselineValue: i.baselineValue,
      frequency: i.frequency as Cadence,
      dataSourceEn: i.dataSourceEn,
      dataSourceAr: i.dataSourceAr,
      meansOfVerificationEn: i.meansOfVerificationEn,
      meansOfVerificationAr: i.meansOfVerificationAr,
      responsible: null,
      linkedStatisticsIndicatorId: i.linkedStatisticsIndicatorId,
      notesEn: i.notesEn,
      notesAr: i.notesAr,
      series,
      latest,
      rag,
      attainment,
    };
  });
  const risks: CouncilPageData["risks"] = riskRows.map((r) => ({
    id: r.id,
    code: r.code,
    titleEn: r.titleEn,
    titleAr: r.titleAr,
    descriptionEn: r.descriptionEn,
    descriptionAr: r.descriptionAr,
    likelihood: r.likelihood,
    impact: r.impact,
    mitigationEn: r.mitigationEn,
    mitigationAr: r.mitigationAr,
    status: r.status,
    nodeId: r.nodeId,
    owner: null,
  }));

  let inputs: CouncilProjectDetail["inputs"] = {
    people: null,
    systemsEn: [],
    systemsAr: [],
    noteEn: null,
    noteAr: null,
  };
  try {
    const parsed = JSON.parse(row.inputsJson ?? "{}");
    inputs = {
      people: typeof parsed.people === "number" ? parsed.people : null,
      systemsEn: Array.isArray(parsed.systems_en) ? parsed.systems_en : [],
      systemsAr: Array.isArray(parsed.systems_ar) ? parsed.systems_ar : [],
      noteEn: parsed.note_en ?? null,
      noteAr: parsed.note_ar ?? null,
    };
  } catch {
    /* an empty inputs card is honest */
  }

  const siblings = row.parentId
    ? siblingsAndKin
        .filter((n) => n.parentId === row.parentId && n.level === row.level)
        .sort((a, b) => a.sort - b.sort)
        .map((n) => n.id)
    : [row.id];

  return {
    node,
    path,
    indicators,
    activities: siblingsAndKin
      .filter((n) => n.parentId === nodeId && n.level === "activity")
      .map(toView),
    milestones: milestones.map((m) => ({
      id: m.id,
      titleEn: m.titleEn,
      titleAr: m.titleAr,
      dueDate: m.dueDate,
      doneDate: m.doneDate,
      status: m.status,
    })),
    dependencies: dependencies.map((d) => {
      const target = rowById.get(d.dependsOnNodeId);
      return {
        id: d.id,
        nodeId: d.dependsOnNodeId,
        titleEn: target?.titleEn ?? "",
        titleAr: target?.titleAr ?? "",
        code: target?.code ?? null,
        noteEn: d.noteEn,
        noteAr: d.noteAr,
      };
    }),
    inputs,
    risks,
    siblings,
    stakeholders: stakeholderMap.get(nodeId) ?? [],
  };
}

/** CR07 2.5: an indicator linked to a Statistics Hub indicator reads its
    actuals from there rather than from the council's own values. */
export async function syncLinkedIndicator(indicatorId: string): Promise<number> {
  const [indicator] = await db
    .select()
    .from(schema.councilIndicators)
    .where(eq(schema.councilIndicators.id, indicatorId))
    .limit(1);
  if (!indicator?.linkedStatisticsIndicatorId) return 0;
  const values = await db
    .select()
    .from(schema.indicatorValues)
    .where(
      and(
        eq(schema.indicatorValues.indicatorId, indicator.linkedStatisticsIndicatorId),
        eq(schema.indicatorValues.dimensionKey, "total")
      )
    )
    .orderBy(asc(schema.indicatorValues.period));
  const { newId, nowIso } = await import("@/lib/ids");
  let written = 0;
  for (const v of values) {
    const period = v.period.length >= 4 ? v.period : null;
    if (!period) continue;
    const [existing] = await db
      .select()
      .from(schema.councilIndicatorValues)
      .where(
        and(
          eq(schema.councilIndicatorValues.indicatorId, indicatorId),
          eq(schema.councilIndicatorValues.period, period)
        )
      )
      .limit(1);
    if (existing) {
      await db
        .update(schema.councilIndicatorValues)
        .set({ actualValue: v.value, status: "final" })
        .where(eq(schema.councilIndicatorValues.id, existing.id));
    } else {
      await db.insert(schema.councilIndicatorValues).values({
        id: newId(),
        indicatorId,
        period,
        actualValue: v.value,
        status: "final",
        sourceDocumentId: null,
        enteredBy: null,
        createdAt: nowIso(),
      });
    }
    written++;
  }
  return written;
}

/** CR07 2.4.8: every edit leaves a record. */
export async function logCouncilChange(
  strategyId: string,
  entityKind: string,
  entityId: string,
  action: string,
  detail: Record<string, unknown>,
  actorId: string
): Promise<void> {
  const { newId, nowIso } = await import("@/lib/ids");
  await db.insert(schema.councilChangeLog).values({
    id: newId(),
    strategyId,
    entityKind,
    entityId,
    action,
    detailJson: JSON.stringify(detail).slice(0, 4000),
    actorId,
    createdAt: nowIso(),
  });
}

export async function getCouncilChangeLog(strategyId: string, limit = 40) {
  const rows = await db
    .select({
      id: schema.councilChangeLog.id,
      entityKind: schema.councilChangeLog.entityKind,
      entityId: schema.councilChangeLog.entityId,
      action: schema.councilChangeLog.action,
      detailJson: schema.councilChangeLog.detailJson,
      createdAt: schema.councilChangeLog.createdAt,
      actorNameEn: schema.users.nameEn,
      actorNameAr: schema.users.nameAr,
    })
    .from(schema.councilChangeLog)
    .leftJoin(schema.users, eq(schema.users.id, schema.councilChangeLog.actorId))
    .where(eq(schema.councilChangeLog.strategyId, strategyId))
    .orderBy(desc(schema.councilChangeLog.createdAt))
    .limit(limit);
  return rows;
}
