// CR08 10: the Operating Model and the process architecture. Read models for
// the /processes page (the Level 0 chain with its Level 1 processes and Level
// 2 procedures, the by-unit and by-policy-type views, one process in full)
// and for the /operating-model page (principles, governance, the RACI, the
// planning and reporting calendar, the internal and external interfaces, the
// operational KPI scorecard), plus the permission-checked writes behind them.
//
// Governance reuses the Programme Strategy's governance bodies (council.ts) and
// adds the bodies the Programme Strategy does not carry (the Office itself, the
// Secretary General, the Executive Committee, the National Statistics
// Committee, the Data Governance Board) from the settings key
// `operating_model_governance`, which the seed writes.
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { can, canSeeDocument } from "@/server/auth/permissions";
import { audit } from "@/server/auth/audit";
import { notify } from "@/server/gamification/engine";
import { newId, nowIso } from "@/lib/ids";
import { getSetting } from "@/server/settings";
import { getDefaultStrategy, strategyOfficeUnitId } from "@/server/services/council";
import { POLICY_TABS, type PolicyTab, type UnitPolicy } from "@/server/services/organisation";
import { getOwnerRefs } from "@/server/services/people";

/* ------------------------------------------------------------------ */
/* errors                                                               */
/* ------------------------------------------------------------------ */

export class OpModelError extends Error {
  constructor(
    public code: string,
    public status = 400,
    public detail?: Record<string, unknown>
  ) {
    super(code);
  }
}

/* ------------------------------------------------------------------ */
/* shared shapes                                                        */
/* ------------------------------------------------------------------ */

export type UnitRef = { id: string; code: string; nameEn: string; nameAr: string; level: string };
export type PersonRef = {
  id: string;
  nameEn: string;
  nameAr: string;
  avatarColor: string;
  positionEn: string | null;
  positionAr: string | null;
  email: string;
};
export type ProcessRef = { id: string; code: string; nameEn: string; nameAr: string; level: number };
export type EntityRef = {
  id: string;
  nameEn: string;
  nameAr: string;
  shortNameEn: string | null;
  shortNameAr: string | null;
  kind: string;
};

export type ProcessLevel = 0 | 1 | 2;
export type RaciRole = "R" | "A" | "C" | "I";
export const RACI_ROLES: readonly RaciRole[] = ["R", "A", "C", "I"];
export type FlowKind = "data" | "input" | "approval" | "review" | "deliverable";
export const FLOW_KINDS: readonly FlowKind[] = ["data", "input", "approval", "review", "deliverable"];
export type CalendarKind =
  | "strategy_review"
  | "budget"
  | "statistical_release"
  | "nes_review"
  | "council_meeting"
  | "report_deadline"
  | "forum"
  | "other";
export const CALENDAR_KINDS: readonly CalendarKind[] = [
  "strategy_review",
  "budget",
  "statistical_release",
  "nes_review",
  "council_meeting",
  "report_deadline",
  "forum",
  "other",
];
export type Recurrence = "none" | "annual" | "quarterly" | "monthly";
export type Rag = "on_target" | "at_risk" | "behind" | "no_data";

/* the JSON columns of `processes`, stored snake_case as the change request names them */
const StepsJson = z.array(
  z.object({
    n: z.number().int(),
    text_en: z.string(),
    text_ar: z.string(),
    role_unit_code: z.string().nullable().optional(),
    system: z.string().nullable().optional(),
  })
);
const IoJson = z.array(
  z.object({ text_en: z.string(), text_ar: z.string(), from_unit_code: z.string().nullable().optional() })
);
const SystemsJson = z.array(
  z.union([z.string(), z.object({ name_en: z.string(), name_ar: z.string().optional() })])
);
const KpisJson = z.array(
  z.object({
    name_en: z.string(),
    name_ar: z.string(),
    target: z.union([z.string(), z.number()]).nullable().optional(),
    unit: z.string().nullable().optional(),
  })
);
const IdsJson = z.array(z.string());

function parse<T>(s: { parse: (v: unknown) => T }, raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return s.parse(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

export type ProcessStep = {
  n: number;
  textEn: string;
  textAr: string;
  roleUnitCode: string | null;
  roleUnit: UnitRef | null;
  system: string | null;
};
export type ProcessIo = { textEn: string; textAr: string; fromUnitCode: string | null; fromUnit: UnitRef | null };
export type ProcessSystem = { nameEn: string; nameAr: string };
export type ProcessKpi = { nameEn: string; nameAr: string; target: string | null; unit: string | null };

export type ProcessCounts = {
  children: number;
  procedures: number;
  policies: number;
  sops: number;
  interfaces: number;
  raci: number;
};

export type ProcessSummary = {
  id: string;
  code: string;
  level: ProcessLevel;
  parentId: string | null;
  nameEn: string;
  nameAr: string;
  purposeEn: string | null;
  purposeAr: string | null;
  status: string;
  sort: number;
  isIllustrative: boolean;
  ownerUnit: UnitRef | null;
  counts: ProcessCounts;
  updatedAt: string;
};

export type ProcessMapNode = ProcessSummary & { children: (ProcessSummary & { children: ProcessSummary[] })[] };

export type PolicyDoc = UnitPolicy & { unit: UnitRef | null };

export type ProcessMap = {
  /** the eight Level 0 processes in order, each with its Level 1 children and their Level 2 procedures */
  chain: ProcessMapNode[];
  /** units that own a process or publish a policy, in org order */
  byUnit: { unit: UnitRef; processes: ProcessSummary[]; policies: Record<PolicyTab, PolicyDoc[]> }[];
  /** the four policy tabs with the documents of every unit */
  byPolicyType: { tab: PolicyTab; documents: PolicyDoc[] }[];
  totals: { level0: number; level1: number; level2: number; illustrative: number };
  canEdit: boolean;
};

export type ProcessDetail = ProcessSummary & {
  inputs: ProcessIo[];
  outputs: ProcessIo[];
  steps: ProcessStep[];
  systems: ProcessSystem[];
  kpis: ProcessKpi[];
  policies: PolicyDoc[];
  sops: PolicyDoc[];
  interfaces: { internal: UnitInterfaceView[]; external: EntityInterfaceView[] };
  raci: { unit: UnitRef; role: RaciRole }[];
  parent: ProcessSummary | null;
  ancestors: ProcessSummary[];
  children: ProcessSummary[];
  canEdit: boolean;
};

export type Principle = {
  id: string;
  sort: number;
  titleEn: string;
  titleAr: string;
  textEn: string | null;
  textAr: string | null;
  isIllustrative: boolean;
};

export type GovernanceBody = {
  /** the council_governance row id, or the settings key of an added body */
  id: string;
  key: string;
  source: "council" | "operating_model";
  nameEn: string;
  nameAr: string;
  roleEn: string | null;
  roleAr: string | null;
  decisionsEn: string[];
  decisionsAr: string[];
  cadence: string | null;
  members: { en: string; ar: string }[];
  escalatesToId: string | null;
  escalationEn: string | null;
  escalationAr: string | null;
  sort: number;
  isIllustrative: boolean;
};
export type GovernanceConnectorKind = "reports_to" | "escalates_to" | "advises" | "delegates_to" | "informs";
export type GovernanceConnector = { fromId: string; toId: string; kind: GovernanceConnectorKind };
export type GovernanceView = { bodies: GovernanceBody[]; connectors: GovernanceConnector[] };

export type RaciMatrix = {
  /** Level 1 processes in chain order */
  processes: (ProcessSummary & { parentCode: string | null })[];
  /** active units that hold at least one cell, in org order */
  units: UnitRef[];
  cells: { processId: string; unitId: string; role: RaciRole }[];
};

export type CalendarLinked = { type: string; id: string; code: string | null; titleEn: string; titleAr: string };
export type CalendarOccurrence = {
  /** the calendar_events row */
  id: string;
  /** `${id}:${dateFrom}` so a recurring event's occurrences stay distinct */
  occurrenceKey: string;
  kind: CalendarKind;
  titleEn: string;
  titleAr: string;
  dateFrom: string;
  dateTo: string | null;
  ownerUnit: UnitRef | null;
  linked: CalendarLinked | null;
  recurrence: Recurrence;
  isIllustrative: boolean;
};
export type CalendarView = { year: number; events: CalendarOccurrence[] };

export type UnitInterfaceView = {
  id: string;
  fromUnit: UnitRef;
  toUnit: UnitRef;
  flowKind: FlowKind;
  descriptionEn: string | null;
  descriptionAr: string | null;
  triggerEn: string | null;
  triggerAr: string | null;
  cadence: string | null;
  serviceLevel: string | null;
  process: ProcessRef | null;
  focalFrom: PersonRef | null;
  focalTo: PersonRef | null;
  status: string;
  isIllustrative: boolean;
  /** the reader may file a change request on this interface (head of either unit, or an editor) */
  canPropose: boolean;
};

export type EntityInterfaceView = {
  id: string;
  entity: EntityRef;
  providesEn: string | null;
  providesAr: string | null;
  receivesEn: string | null;
  receivesAr: string | null;
  focalOrg: PersonRef | null;
  focalEntityName: string | null;
  legalBasisEn: string | null;
  legalBasisAr: string | null;
  cadence: string | null;
  processes: ProcessRef[];
  isIllustrative: boolean;
};

export type InterfaceChangeRequestView = {
  id: string;
  interfaceId: string | null;
  fromUnit: UnitRef | null;
  toUnit: UnitRef | null;
  requestedBy: PersonRef | null;
  text: string;
  status: string;
  resolvedBy: PersonRef | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type InterfaceMatrixCell = {
  fromUnitId: string;
  toUnitId: string;
  count: number;
  kinds: Record<FlowKind, number>;
  interfaceIds: string[];
};

export type InterfacesView = {
  external: EntityInterfaceView[];
  internal: UnitInterfaceView[];
  /** units that give or receive at least one internal interface, in org order */
  units: UnitRef[];
  matrix: InterfaceMatrixCell[];
  /** chord-ready aggregate, one entry per ordered pair */
  chord: { fromUnitId: string; toUnitId: string; count: number }[];
  /** open requests (editors see all, others their own) plus the reader's own resolved ones */
  changeRequests: InterfaceChangeRequestView[];
};

export type OpsKpiPoint = { period: string; value: number | null };
export type OpsKpiCard = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  definitionEn: string | null;
  definitionAr: string | null;
  unit: string | null;
  direction: "up_good" | "down_good";
  sourceKind: "auto" | "manual";
  target: number | null;
  latest: OpsKpiPoint | null;
  previous: OpsKpiPoint | null;
  series: OpsKpiPoint[];
  /** raw movement of the value against the previous period */
  trend: "up" | "down" | "flat" | null;
  /** the movement read in the KPI's good direction */
  improving: boolean | null;
  rag: Rag;
  /** share of target reached, direction aware, 1 = on target */
  attainment: number | null;
  sort: number;
};

export type OperatingModel = {
  principles: Principle[];
  governance: GovernanceView;
  chain: ProcessMapNode[];
  raci: RaciMatrix;
  calendar: CalendarView;
  interfaces: InterfacesView;
  kpis: OpsKpiCard[];
  canEdit: boolean;
  /** true while any seeded row is illustrative */
  isIllustrative: boolean;
};

/* ------------------------------------------------------------------ */
/* permissions                                                          */
/* ------------------------------------------------------------------ */

/** Super Admin, an operating_model editor, or a member of the Strategy Office unit. */
export async function canEditOperatingModel(user: CurrentUser | null): Promise<boolean> {
  if (!user) return false;
  if (can(user, "manage", "settings") || can(user, "edit_any", "operating_model")) return true;
  const officeId = await strategyOfficeUnitId();
  return Boolean(officeId) && user.departmentId === officeId;
}

/** The head of the unit (org_units.head_user_id or an org_unit_members head row), or an editor. */
export async function canEditUnitProcesses(user: CurrentUser | null, unitId: string | null | undefined): Promise<boolean> {
  if (!user) return false;
  if (await canEditOperatingModel(user)) return true;
  if (!unitId) return false;
  return isUnitHead(user, unitId);
}

async function isUnitHead(user: CurrentUser, unitId: string): Promise<boolean> {
  const [unit] = await db
    .select({ headUserId: schema.orgUnits.headUserId })
    .from(schema.orgUnits)
    .where(eq(schema.orgUnits.id, unitId))
    .limit(1);
  if (!unit) return false;
  if (unit.headUserId === user.id) return true;
  if (user.role.nameEn === "Department Head" && user.departmentId === unitId) return true;
  const [member] = await db
    .select({ id: schema.orgUnitMembers.id })
    .from(schema.orgUnitMembers)
    .where(
      and(
        eq(schema.orgUnitMembers.unitId, unitId),
        eq(schema.orgUnitMembers.userId, user.id),
        eq(schema.orgUnitMembers.roleInUnit, "head")
      )
    )
    .limit(1);
  return Boolean(member);
}

async function requireEditor(user: CurrentUser | null): Promise<CurrentUser> {
  if (!user) throw new OpModelError("unauthorized", 401);
  if (!(await canEditOperatingModel(user))) throw new OpModelError("forbidden", 403);
  return user;
}

/* ------------------------------------------------------------------ */
/* reference loaders                                                    */
/* ------------------------------------------------------------------ */

type UnitRow = typeof schema.orgUnits.$inferSelect;
type ProcessRow = typeof schema.processes.$inferSelect;

function unitRef(u: UnitRow | undefined | null): UnitRef | null {
  return u ? { id: u.id, code: u.code, nameEn: u.nameEn, nameAr: u.nameAr, level: u.level } : null;
}

async function loadUnits(): Promise<{ rows: UnitRow[]; byId: Map<string, UnitRow>; byCode: Map<string, UnitRow> }> {
  const rows = await db.select().from(schema.orgUnits).orderBy(asc(schema.orgUnits.sort));
  return {
    rows,
    byId: new Map(rows.map((u) => [u.id, u])),
    byCode: new Map(rows.map((u) => [u.code.toUpperCase(), u])),
  };
}

async function loadPeople(ids: (string | null | undefined)[]): Promise<Map<string, PersonRef>> {
  const wanted = [...new Set(ids.filter(Boolean) as string[])];
  if (!wanted.length) return new Map();
  const rows = await db
    .select({
      id: schema.users.id,
      nameEn: schema.users.nameEn,
      nameAr: schema.users.nameAr,
      avatarColor: schema.users.avatarColor,
      positionEn: schema.users.positionEn,
      positionAr: schema.users.positionAr,
      email: schema.users.email,
    })
    .from(schema.users)
    .where(and(inArray(schema.users.id, wanted), isNull(schema.users.deletedAt)));
  return new Map(rows.map((r) => [r.id, r]));
}

function processRef(p: ProcessRow | undefined | null): ProcessRef | null {
  return p ? { id: p.id, code: p.code, nameEn: p.nameEn, nameAr: p.nameAr, level: p.level } : null;
}

/** The knowledge-type terms of the four policy tabs, id to tab code. */
async function policyTerms(): Promise<Map<string, PolicyTab>> {
  const [dimension] = await db
    .select()
    .from(schema.taxonomyDimensions)
    .where(eq(schema.taxonomyDimensions.code, "knowledge_type"))
    .limit(1);
  if (!dimension) return new Map();
  const terms = await db
    .select()
    .from(schema.taxonomyTerms)
    .where(eq(schema.taxonomyTerms.dimensionId, dimension.id));
  const out = new Map<string, PolicyTab>();
  for (const t of terms) {
    if ((POLICY_TABS as readonly string[]).includes(t.code)) out.set(t.id, t.code as PolicyTab);
  }
  return out;
}

type DocRow = typeof schema.documents.$inferSelect;

function toPolicyDoc(d: DocRow, tab: PolicyTab, unit: UnitRef | null): PolicyDoc {
  let reviewDue = false;
  if (d.effectiveFrom && d.reviewCycleMonths) {
    const due = new Date(d.effectiveFrom);
    due.setMonth(due.getMonth() + d.reviewCycleMonths);
    reviewDue = due <= new Date();
  }
  return {
    id: d.id,
    tab,
    titleEn: d.titleEn,
    titleAr: d.titleAr,
    summaryEn: d.summaryEn,
    summaryAr: d.summaryAr,
    versionLabel: d.versionLabel,
    effectiveFrom: d.effectiveFrom,
    reviewCycleMonths: d.reviewCycleMonths,
    reviewDue,
    visibilityScope: d.visibilityScope,
    classificationLevel: d.classificationLevel,
    status: d.status,
    supersedesDocumentId: d.supersedesDocumentId,
    updatedAt: d.updatedAt,
    ownerUserId: d.ownerUserId,
    owner: null,
    unit,
  };
}

/** CR08 9.1: the custodians of a set of policy documents, in one bulk pass.
    The rows are shared between the by-unit and by-policy views, so filling
    them in place fills every view that holds the same document. */
async function attachPolicyOwners(docs: PolicyDoc[]): Promise<void> {
  if (!docs.length) return;
  const owners = await getOwnerRefs(docs.map((d) => d.ownerUserId));
  for (const d of docs) d.owner = d.ownerUserId ? owners[d.ownerUserId] ?? null : null;
}

/** Documents by id that the reader may see and that carry a policy-type term. */
async function visiblePolicyDocs(
  user: CurrentUser,
  ids: string[],
  terms: Map<string, PolicyTab>,
  unitsById: Map<string, UnitRow>
): Promise<Map<string, PolicyDoc>> {
  const wanted = [...new Set(ids)];
  if (!wanted.length) return new Map();
  const rows = await db.select().from(schema.documents).where(inArray(schema.documents.id, wanted));
  const out = new Map<string, PolicyDoc>();
  for (const d of rows) {
    if (d.deletedAt || d.status === "archived") continue;
    if (!canSeeDocument(user, d)) continue;
    const tab = d.knowledgeTypeTermId ? terms.get(d.knowledgeTypeTermId) : undefined;
    out.set(d.id, toPolicyDoc(d, tab ?? "policy_internal", unitRef(d.departmentId ? unitsById.get(d.departmentId) : null)));
  }
  await attachPolicyOwners([...out.values()]);
  return out;
}

/* ------------------------------------------------------------------ */
/* the process index shared by the read models                          */
/* ------------------------------------------------------------------ */

type ProcessIndex = {
  rows: ProcessRow[];
  byId: Map<string, ProcessRow>;
  childrenOf: Map<string, ProcessRow[]>;
  units: Awaited<ReturnType<typeof loadUnits>>;
  raci: (typeof schema.processRaci.$inferSelect)[];
  unitInterfaces: (typeof schema.unitInterfaces.$inferSelect)[];
  entityInterfaces: (typeof schema.entityInterfaces.$inferSelect)[];
  terms: Map<string, PolicyTab>;
  /** policy and SOP documents referenced by any process, visibility applied */
  docs: Map<string, PolicyDoc>;
  summaries: Map<string, ProcessSummary>;
};

function sortRows(rows: ProcessRow[]): ProcessRow[] {
  return [...rows].sort((a, b) => a.sort - b.sort || a.code.localeCompare(b.code, undefined, { numeric: true }));
}

function descendantsOf(id: string, childrenOf: Map<string, ProcessRow[]>, depth = 0): ProcessRow[] {
  if (depth > 4) return [];
  const direct = childrenOf.get(id) ?? [];
  return [...direct, ...direct.flatMap((c) => descendantsOf(c.id, childrenOf, depth + 1))];
}

function entityProcessIds(row: typeof schema.entityInterfaces.$inferSelect): string[] {
  return parse(IdsJson, row.processIdsJson, []);
}

async function loadProcessIndex(user: CurrentUser): Promise<ProcessIndex> {
  const [rawRows, units, raci, unitInterfaces, entityInterfaces, terms] = await Promise.all([
    db.select().from(schema.processes),
    loadUnits(),
    db.select().from(schema.processRaci),
    db.select().from(schema.unitInterfaces),
    db.select().from(schema.entityInterfaces),
    policyTerms(),
  ]);
  const rows = sortRows(rawRows);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const childrenOf = new Map<string, ProcessRow[]>();
  for (const r of rows) {
    if (!r.parentId) continue;
    (childrenOf.get(r.parentId) ?? childrenOf.set(r.parentId, []).get(r.parentId)!).push(r);
  }
  const docIds = rows.flatMap((r) => [
    ...parse(IdsJson, r.policyDocumentIdsJson, []),
    ...parse(IdsJson, r.sopDocumentIdsJson, []),
  ]);
  const docs = await visiblePolicyDocs(user, docIds, terms, units.byId);

  const raciCount = new Map<string, number>();
  for (const r of raci) raciCount.set(r.processId, (raciCount.get(r.processId) ?? 0) + 1);
  const ifaceCount = new Map<string, number>();
  for (const i of unitInterfaces) {
    if (i.processId && i.status !== "retired") ifaceCount.set(i.processId, (ifaceCount.get(i.processId) ?? 0) + 1);
  }
  for (const e of entityInterfaces) {
    for (const pid of entityProcessIds(e)) ifaceCount.set(pid, (ifaceCount.get(pid) ?? 0) + 1);
  }

  const summaries = new Map<string, ProcessSummary>();
  for (const r of rows) {
    const kids = childrenOf.get(r.id) ?? [];
    const descendants = descendantsOf(r.id, childrenOf);
    const policies = parse(IdsJson, r.policyDocumentIdsJson, []).filter((id) => docs.has(id));
    const sops = parse(IdsJson, r.sopDocumentIdsJson, []).filter((id) => docs.has(id));
    // interfaces roll up from the levels beneath, the way getProcess reads them
    const interfaces = [r.id, ...descendants.map((d) => d.id)].reduce((s, id) => s + (ifaceCount.get(id) ?? 0), 0);
    summaries.set(r.id, {
      id: r.id,
      code: r.code,
      level: (r.level === 0 || r.level === 2 ? r.level : 1) as ProcessLevel,
      parentId: r.parentId,
      nameEn: r.nameEn,
      nameAr: r.nameAr,
      purposeEn: r.purposeEn,
      purposeAr: r.purposeAr,
      status: r.status,
      sort: r.sort,
      isIllustrative: r.isIllustrative === 1,
      ownerUnit: unitRef(r.ownerUnitId ? units.byId.get(r.ownerUnitId) : null),
      counts: {
        children: kids.length,
        procedures: descendants.filter((d) => d.level === 2).length,
        policies: policies.length,
        sops: sops.length,
        interfaces,
        raci: raciCount.get(r.id) ?? 0,
      },
      updatedAt: r.updatedAt,
    });
  }
  return { rows, byId, childrenOf, units, raci, unitInterfaces, entityInterfaces, terms, docs, summaries };
}

function buildChain(index: ProcessIndex): ProcessMapNode[] {
  const summary = (r: ProcessRow) => index.summaries.get(r.id)!;
  return index.rows
    .filter((r) => r.level === 0)
    .map((l0) => ({
      ...summary(l0),
      children: (index.childrenOf.get(l0.id) ?? []).map((l1) => ({
        ...summary(l1),
        children: (index.childrenOf.get(l1.id) ?? []).map(summary),
      })),
    }));
}

/* ------------------------------------------------------------------ */
/* the process map                                                      */
/* ------------------------------------------------------------------ */

export async function getProcessMap(user: CurrentUser): Promise<ProcessMap> {
  const index = await loadProcessIndex(user);
  const chain = buildChain(index);

  /* the policy documents of every unit, through document_unit_links */
  const links = await db.select().from(schema.documentUnitLinks);
  const linkedIds = [...new Set(links.map((l) => l.documentId))];
  const linkedDocs = linkedIds.length
    ? await db.select().from(schema.documents).where(inArray(schema.documents.id, linkedIds))
    : [];
  const docById = new Map(linkedDocs.map((d) => [d.id, d]));
  const policiesByUnit = new Map<string, Record<PolicyTab, PolicyDoc[]>>();
  const emptyTabs = (): Record<PolicyTab, PolicyDoc[]> => ({ policy_internal: [], procedure: [], form_template: [], service: [] });
  const byPolicyType = new Map<PolicyTab, PolicyDoc[]>(POLICY_TABS.map((t) => [t, []]));
  for (const link of links) {
    const d = docById.get(link.documentId);
    if (!d || d.deletedAt || d.status === "archived") continue;
    const tab = d.knowledgeTypeTermId ? index.terms.get(d.knowledgeTypeTermId) : undefined;
    if (!tab) continue;
    if (!canSeeDocument(user, d)) continue;
    const unit = unitRef(index.units.byId.get(link.unitId));
    const doc = toPolicyDoc(d, tab, unit);
    (policiesByUnit.get(link.unitId) ?? policiesByUnit.set(link.unitId, emptyTabs()).get(link.unitId)!)[tab].push(doc);
    byPolicyType.get(tab)!.push(doc);
  }
  for (const tabs of policiesByUnit.values()) {
    for (const tab of POLICY_TABS) tabs[tab].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  /* CR08 9.1: one pass over the rows both views share */
  await attachPolicyOwners([...byPolicyType.values()].flat());

  const ownedByUnit = new Map<string, ProcessSummary[]>();
  for (const r of index.rows) {
    if (!r.ownerUnitId) continue;
    (ownedByUnit.get(r.ownerUnitId) ?? ownedByUnit.set(r.ownerUnitId, []).get(r.ownerUnitId)!).push(index.summaries.get(r.id)!);
  }
  const byUnit: ProcessMap["byUnit"] = index.units.rows
    .filter((u) => u.isActive === 1 && (ownedByUnit.has(u.id) || policiesByUnit.has(u.id)))
    .map((u) => ({
      unit: unitRef(u)!,
      processes: ownedByUnit.get(u.id) ?? [],
      policies: policiesByUnit.get(u.id) ?? emptyTabs(),
    }));

  return {
    chain,
    byUnit,
    byPolicyType: POLICY_TABS.map((tab) => ({
      tab,
      documents: byPolicyType.get(tab)!.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    })),
    totals: {
      level0: index.rows.filter((r) => r.level === 0).length,
      level1: index.rows.filter((r) => r.level === 1).length,
      level2: index.rows.filter((r) => r.level === 2).length,
      illustrative: index.rows.filter((r) => r.isIllustrative === 1).length,
    },
    canEdit: await canEditOperatingModel(user),
  };
}

/* ------------------------------------------------------------------ */
/* one process                                                          */
/* ------------------------------------------------------------------ */

function findProcessRow(index: ProcessIndex, codeOrId: string): ProcessRow | null {
  const needle = codeOrId.trim().toLowerCase();
  return (
    index.byId.get(codeOrId) ??
    index.rows.find((r) => r.code.toLowerCase() === needle) ??
    null
  );
}

async function unitInterfaceViews(
  user: CurrentUser,
  rows: (typeof schema.unitInterfaces.$inferSelect)[],
  index: ProcessIndex
): Promise<UnitInterfaceView[]> {
  const people = await loadPeople(rows.flatMap((r) => [r.focalFromUserId, r.focalToUserId]));
  const editor = await canEditOperatingModel(user);
  const headOf = new Map<string, boolean>();
  const isHeadCached = async (unitId: string) => {
    if (!headOf.has(unitId)) headOf.set(unitId, await isUnitHead(user, unitId));
    return headOf.get(unitId)!;
  };
  const out: UnitInterfaceView[] = [];
  for (const r of rows) {
    const from = unitRef(index.units.byId.get(r.fromUnitId));
    const to = unitRef(index.units.byId.get(r.toUnitId));
    if (!from || !to) continue;
    const canPropose = editor || (await isHeadCached(r.fromUnitId)) || (await isHeadCached(r.toUnitId));
    out.push({
      id: r.id,
      fromUnit: from,
      toUnit: to,
      flowKind: (FLOW_KINDS.includes(r.flowKind as FlowKind) ? r.flowKind : "data") as FlowKind,
      descriptionEn: r.descriptionEn,
      descriptionAr: r.descriptionAr,
      triggerEn: r.triggerEn,
      triggerAr: r.triggerAr,
      cadence: r.cadence,
      serviceLevel: r.serviceLevel,
      process: processRef(r.processId ? index.byId.get(r.processId) : null),
      focalFrom: r.focalFromUserId ? people.get(r.focalFromUserId) ?? null : null,
      focalTo: r.focalToUserId ? people.get(r.focalToUserId) ?? null : null,
      status: r.status,
      isIllustrative: r.isIllustrative === 1,
      canPropose,
    });
  }
  return out;
}

async function entityInterfaceViews(
  rows: (typeof schema.entityInterfaces.$inferSelect)[],
  index: ProcessIndex
): Promise<EntityInterfaceView[]> {
  const entityIds = [...new Set(rows.map((r) => r.entityId))];
  const entities = entityIds.length
    ? await db.select().from(schema.entities).where(inArray(schema.entities.id, entityIds))
    : [];
  const entityById = new Map(entities.map((e) => [e.id, e]));
  const people = await loadPeople(rows.map((r) => r.focalOrgUserId));
  const out: EntityInterfaceView[] = [];
  for (const r of rows) {
    const e = entityById.get(r.entityId);
    if (!e) continue;
    out.push({
      id: r.id,
      entity: { id: e.id, nameEn: e.nameEn, nameAr: e.nameAr, shortNameEn: e.shortNameEn, shortNameAr: e.shortNameAr, kind: e.kind },
      providesEn: r.providesEn,
      providesAr: r.providesAr,
      receivesEn: r.receivesEn,
      receivesAr: r.receivesAr,
      focalOrg: r.focalOrgUserId ? people.get(r.focalOrgUserId) ?? null : null,
      focalEntityName: r.focalEntityName,
      legalBasisEn: r.legalBasisEn,
      legalBasisAr: r.legalBasisAr,
      cadence: r.cadence,
      processes: entityProcessIds(r)
        .map((id) => processRef(index.byId.get(id)))
        .filter((p): p is ProcessRef => Boolean(p)),
      isIllustrative: r.isIllustrative === 1,
    });
  }
  return out.sort((a, b) => a.entity.nameEn.localeCompare(b.entity.nameEn));
}

export async function getProcess(user: CurrentUser, codeOrId: string): Promise<ProcessDetail | null> {
  const index = await loadProcessIndex(user);
  const row = findProcessRow(index, codeOrId);
  if (!row) return null;
  const summary = index.summaries.get(row.id)!;
  const unitByCode = (code: string | null | undefined) =>
    code ? unitRef(index.units.byCode.get(code.toUpperCase())) : null;

  const steps: ProcessStep[] = parse(StepsJson, row.stepsJson, [])
    .sort((a, b) => a.n - b.n)
    .map((s) => ({
      n: s.n,
      textEn: s.text_en,
      textAr: s.text_ar,
      roleUnitCode: s.role_unit_code ?? null,
      roleUnit: unitByCode(s.role_unit_code),
      system: s.system ?? null,
    }));
  const io = (raw: string | null): ProcessIo[] =>
    parse(IoJson, raw, []).map((i) => ({
      textEn: i.text_en,
      textAr: i.text_ar,
      fromUnitCode: i.from_unit_code ?? null,
      fromUnit: unitByCode(i.from_unit_code),
    }));
  const systems: ProcessSystem[] = parse(SystemsJson, row.systemsJson, []).map((s) =>
    typeof s === "string" ? { nameEn: s, nameAr: s } : { nameEn: s.name_en, nameAr: s.name_ar ?? s.name_en }
  );
  const kpis: ProcessKpi[] = parse(KpisJson, row.kpisJson, []).map((k) => ({
    nameEn: k.name_en,
    nameAr: k.name_ar,
    target: k.target == null ? null : String(k.target),
    unit: k.unit ?? null,
  }));

  const subtree = new Set([row.id, ...descendantsOf(row.id, index.childrenOf).map((d) => d.id)]);
  const internal = await unitInterfaceViews(
    user,
    index.unitInterfaces.filter((i) => i.processId && subtree.has(i.processId) && i.status !== "retired"),
    index
  );
  const external = await entityInterfaceViews(
    index.entityInterfaces.filter((e) => entityProcessIds(e).some((id) => subtree.has(id))),
    index
  );
  const raci = index.raci
    .filter((r) => r.processId === row.id)
    .map((r) => ({ unit: unitRef(index.units.byId.get(r.unitId)), role: r.role as RaciRole }))
    .filter((r): r is { unit: UnitRef; role: RaciRole } => Boolean(r.unit) && RACI_ROLES.includes(r.role))
    .sort((a, b) => RACI_ROLES.indexOf(a.role) - RACI_ROLES.indexOf(b.role) || a.unit.nameEn.localeCompare(b.unit.nameEn));

  const ancestors: ProcessSummary[] = [];
  let cursor = row.parentId ? index.byId.get(row.parentId) : undefined;
  for (let i = 0; i < 4 && cursor; i++) {
    ancestors.unshift(index.summaries.get(cursor.id)!);
    cursor = cursor.parentId ? index.byId.get(cursor.parentId) : undefined;
  }

  return {
    ...summary,
    inputs: io(row.inputsJson),
    outputs: io(row.outputsJson),
    steps,
    systems,
    kpis,
    policies: parse(IdsJson, row.policyDocumentIdsJson, []).map((id) => index.docs.get(id)).filter((d): d is PolicyDoc => Boolean(d)),
    sops: parse(IdsJson, row.sopDocumentIdsJson, []).map((id) => index.docs.get(id)).filter((d): d is PolicyDoc => Boolean(d)),
    interfaces: { internal, external },
    raci,
    parent: row.parentId ? index.summaries.get(row.parentId) ?? null : null,
    ancestors,
    children: (index.childrenOf.get(row.id) ?? []).map((c) => index.summaries.get(c.id)!),
    canEdit: await canEditUnitProcesses(user, row.ownerUnitId),
  };
}

/* ------------------------------------------------------------------ */
/* principles                                                           */
/* ------------------------------------------------------------------ */

export async function getPrinciples(): Promise<Principle[]> {
  const rows = await db.select().from(schema.operatingPrinciples).orderBy(asc(schema.operatingPrinciples.sort));
  return rows.map((r) => ({
    id: r.id,
    sort: r.sort,
    titleEn: r.titleEn,
    titleAr: r.titleAr,
    textEn: r.textEn,
    textAr: r.textAr,
    isIllustrative: r.isIllustrative === 1,
  }));
}

/* ------------------------------------------------------------------ */
/* governance: the Programme Strategy's bodies plus the settings extras   */
/* ------------------------------------------------------------------ */

const GovernanceSettingSchema = z.object({
  bodies: z
    .array(
      z.object({
        key: z.string(),
        nameEn: z.string(),
        nameAr: z.string(),
        roleEn: z.string().nullable().optional(),
        roleAr: z.string().nullable().optional(),
        decisionsEn: z.array(z.string()).default([]),
        decisionsAr: z.array(z.string()).default([]),
        cadence: z.string().nullable().optional(),
        members: z.array(z.object({ en: z.string(), ar: z.string() })).default([]),
        escalatesTo: z.string().nullable().optional(),
        escalationEn: z.string().nullable().optional(),
        escalationAr: z.string().nullable().optional(),
        sort: z.number().optional(),
      })
    )
    .default([]),
  councilEnrichment: z
    .array(
      z.object({
        matchNameEn: z.string(),
        key: z.string(),
        decisionsEn: z.array(z.string()).default([]),
        decisionsAr: z.array(z.string()).default([]),
        escalatesTo: z.string().nullable().optional(),
        escalationEn: z.string().nullable().optional(),
        escalationAr: z.string().nullable().optional(),
      })
    )
    .default([]),
  connectors: z
    .array(z.object({ from: z.string(), to: z.string(), kind: z.enum(["reports_to", "escalates_to", "advises", "delegates_to", "informs"]) }))
    .default([]),
  isIllustrative: z.boolean().default(true),
});
export type GovernanceSetting = z.infer<typeof GovernanceSettingSchema>;
export const GOVERNANCE_SETTING_KEY = "operating_model_governance";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export async function getGovernance(): Promise<GovernanceView> {
  const strategy = await getDefaultStrategy();
  const councilRows = strategy
    ? await db
        .select()
        .from(schema.councilGovernance)
        .where(eq(schema.councilGovernance.strategyId, strategy.id))
        .orderBy(asc(schema.councilGovernance.sort))
    : [];
  const raw = await getSetting<unknown>(GOVERNANCE_SETTING_KEY, {});
  const setting = GovernanceSettingSchema.safeParse(raw);
  const extras: GovernanceSetting = setting.success ? setting.data : { bodies: [], councilEnrichment: [], connectors: [], isIllustrative: true };

  const bodies: GovernanceBody[] = [];
  const idOfKey = new Map<string, string>();
  for (const b of extras.bodies) {
    idOfKey.set(b.key, b.key);
    bodies.push({
      id: b.key,
      key: b.key,
      source: "operating_model",
      nameEn: b.nameEn,
      nameAr: b.nameAr,
      roleEn: b.roleEn ?? null,
      roleAr: b.roleAr ?? null,
      decisionsEn: b.decisionsEn,
      decisionsAr: b.decisionsAr,
      cadence: b.cadence ?? null,
      members: b.members,
      escalatesToId: null,
      escalationEn: b.escalationEn ?? null,
      escalationAr: b.escalationAr ?? null,
      sort: b.sort ?? bodies.length,
      isIllustrative: extras.isIllustrative,
    });
  }
  for (const g of councilRows) {
    const enrich = extras.councilEnrichment.find((e) => e.matchNameEn.toLowerCase() === g.bodyNameEn.toLowerCase());
    const key = enrich?.key ?? `council_${slug(g.bodyNameEn)}`;
    idOfKey.set(key, g.id);
    let members: { en: string; ar: string }[] = [];
    try {
      const parsed = JSON.parse(g.membersJson ?? "[]");
      if (Array.isArray(parsed)) members = parsed;
    } catch {
      members = [];
    }
    bodies.push({
      id: g.id,
      key,
      source: "council",
      nameEn: g.bodyNameEn,
      nameAr: g.bodyNameAr,
      roleEn: g.roleEn,
      roleAr: g.roleAr,
      decisionsEn: enrich?.decisionsEn ?? [],
      decisionsAr: enrich?.decisionsAr ?? [],
      cadence: g.cadence,
      members,
      escalatesToId: null,
      escalationEn: enrich?.escalationEn ?? null,
      escalationAr: enrich?.escalationAr ?? null,
      sort: 100 + g.sort,
      isIllustrative: strategy?.isIllustrative === 1,
    });
  }
  // resolve escalation targets now that every key has an id
  const escalationKey = new Map<string, string | null>();
  for (const b of extras.bodies) escalationKey.set(b.key, b.escalatesTo ?? null);
  for (const e of extras.councilEnrichment) escalationKey.set(e.key, e.escalatesTo ?? null);
  for (const b of bodies) {
    const target = escalationKey.get(b.key);
    b.escalatesToId = target ? idOfKey.get(target) ?? null : null;
  }
  const connectors: GovernanceConnector[] = extras.connectors
    .map((c) => ({ fromId: idOfKey.get(c.from), toId: idOfKey.get(c.to), kind: c.kind }))
    .filter((c): c is GovernanceConnector => Boolean(c.fromId && c.toId));
  bodies.sort((a, b) => a.sort - b.sort);
  return { bodies, connectors };
}

/* ------------------------------------------------------------------ */
/* the RACI matrix                                                      */
/* ------------------------------------------------------------------ */

function buildRaci(index: ProcessIndex): RaciMatrix {
  const level1 = index.rows.filter((r) => r.level === 1);
  const l1Ids = new Set(level1.map((r) => r.id));
  const cells = index.raci
    .filter((r) => l1Ids.has(r.processId) && RACI_ROLES.includes(r.role as RaciRole) && index.units.byId.has(r.unitId))
    .map((r) => ({ processId: r.processId, unitId: r.unitId, role: r.role as RaciRole }));
  const unitIds = new Set(cells.map((c) => c.unitId));
  return {
    processes: level1.map((r) => ({
      ...index.summaries.get(r.id)!,
      parentCode: r.parentId ? index.byId.get(r.parentId)?.code ?? null : null,
    })),
    units: index.units.rows.filter((u) => u.isActive === 1 && unitIds.has(u.id)).map((u) => unitRef(u)!),
    cells,
  };
}

/* ------------------------------------------------------------------ */
/* the calendar, recurrences expanded into the requested year           */
/* ------------------------------------------------------------------ */

function shiftDate(iso: string, year: number, monthDelta: number): string {
  const [, m, d] = iso.split("-").map(Number);
  const month = (m - 1) + monthDelta;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function occurrencesFor(row: typeof schema.calendarEvents.$inferSelect, year: number): { dateFrom: string; dateTo: string | null }[] {
  const fromYear = Number(row.dateFrom.slice(0, 4));
  const withTo = (from: string) => ({ dateFrom: from, dateTo: row.dateTo ? addDays(from, daysBetween(row.dateFrom, row.dateTo)) : null });
  if (row.recurrence === "none") return fromYear === year ? [withTo(row.dateFrom)] : [];
  if (row.recurrence === "annual") return [withTo(shiftDate(row.dateFrom, year, 0))];
  const baseMonth = Number(row.dateFrom.slice(5, 7)) - 1;
  const step = row.recurrence === "quarterly" ? 3 : 1;
  const out: { dateFrom: string; dateTo: string | null }[] = [];
  for (let m = baseMonth % step; m < 12; m += step) {
    out.push(withTo(shiftDate(row.dateFrom, year, m - baseMonth)));
  }
  return out;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}
function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86400000).toISOString().slice(0, 10);
}

export async function getCalendar(year = new Date().getUTCFullYear()): Promise<CalendarView> {
  const [rows, units, reportTypes, releases, processes, strategy] = await Promise.all([
    db.select().from(schema.calendarEvents).orderBy(asc(schema.calendarEvents.dateFrom)),
    loadUnits(),
    db.select().from(schema.reportTypes),
    db.select().from(schema.releases),
    db.select().from(schema.processes),
    getDefaultStrategy(),
  ]);
  const linkedOf = (type: string | null, id: string | null): CalendarLinked | null => {
    if (!type || !id) return null;
    if (type === "report_type") {
      const r = reportTypes.find((x) => x.id === id || x.code === id);
      return r ? { type, id: r.id, code: r.code, titleEn: r.nameEn, titleAr: r.nameAr } : null;
    }
    if (type === "release") {
      const r = releases.find((x) => x.id === id);
      return r ? { type, id: r.id, code: null, titleEn: r.titleEn, titleAr: r.titleAr } : null;
    }
    if (type === "process") {
      const p = processes.find((x) => x.id === id || x.code === id);
      return p ? { type, id: p.id, code: p.code, titleEn: p.nameEn, titleAr: p.nameAr } : null;
    }
    if (type === "council_strategy") {
      return strategy ? { type, id: strategy.id, code: null, titleEn: strategy.nameEn, titleAr: strategy.nameAr } : null;
    }
    return { type, id, code: null, titleEn: id, titleAr: id };
  };
  const events: CalendarOccurrence[] = [];
  for (const row of rows) {
    const kind = (CALENDAR_KINDS.includes(row.kind as CalendarKind) ? row.kind : "other") as CalendarKind;
    for (const occ of occurrencesFor(row, year)) {
      events.push({
        id: row.id,
        occurrenceKey: `${row.id}:${occ.dateFrom}`,
        kind,
        titleEn: row.titleEn,
        titleAr: row.titleAr,
        dateFrom: occ.dateFrom,
        dateTo: occ.dateTo,
        ownerUnit: unitRef(row.ownerUnitId ? units.byId.get(row.ownerUnitId) : null),
        linked: linkedOf(row.linkedResourceType, row.linkedResourceId),
        recurrence: (["none", "annual", "quarterly", "monthly"].includes(row.recurrence) ? row.recurrence : "none") as Recurrence,
        isIllustrative: row.isIllustrative === 1,
      });
    }
  }
  events.sort((a, b) => a.dateFrom.localeCompare(b.dateFrom) || a.titleEn.localeCompare(b.titleEn));
  return { year, events };
}

/* ------------------------------------------------------------------ */
/* interfaces                                                           */
/* ------------------------------------------------------------------ */

export async function listInterfaceChangeRequests(
  user: CurrentUser,
  filter: { status?: string; mineOnly?: boolean } = {}
): Promise<InterfaceChangeRequestView[]> {
  const editor = await canEditOperatingModel(user);
  const rows = await db
    .select()
    .from(schema.interfaceChangeRequests)
    .orderBy(desc(schema.interfaceChangeRequests.createdAt))
    .limit(200);
  const units = await loadUnits();
  const people = await loadPeople(rows.flatMap((r) => [r.requestedBy, r.resolvedBy]));
  return rows
    .filter((r) => (filter.status ? r.status === filter.status : true))
    .filter((r) => (filter.mineOnly || !editor ? r.requestedBy === user.id : true))
    .map((r) => ({
      id: r.id,
      interfaceId: r.interfaceId,
      fromUnit: unitRef(r.fromUnitId ? units.byId.get(r.fromUnitId) : null),
      toUnit: unitRef(r.toUnitId ? units.byId.get(r.toUnitId) : null),
      requestedBy: people.get(r.requestedBy) ?? null,
      text: r.text,
      status: r.status,
      resolvedBy: r.resolvedBy ? people.get(r.resolvedBy) ?? null : null,
      resolvedAt: r.resolvedAt,
      createdAt: r.createdAt,
    }));
}

async function buildInterfaces(user: CurrentUser, index: ProcessIndex): Promise<InterfacesView> {
  const internal = await unitInterfaceViews(
    user,
    index.unitInterfaces.filter((i) => i.status !== "retired"),
    index
  );
  const external = await entityInterfaceViews(index.entityInterfaces, index);
  const cellMap = new Map<string, InterfaceMatrixCell>();
  const unitIds = new Set<string>();
  for (const i of internal) {
    unitIds.add(i.fromUnit.id);
    unitIds.add(i.toUnit.id);
    const key = `${i.fromUnit.id}>${i.toUnit.id}`;
    const cell =
      cellMap.get(key) ??
      cellMap
        .set(key, {
          fromUnitId: i.fromUnit.id,
          toUnitId: i.toUnit.id,
          count: 0,
          kinds: { data: 0, input: 0, approval: 0, review: 0, deliverable: 0 },
          interfaceIds: [],
        })
        .get(key)!;
    cell.count++;
    cell.kinds[i.flowKind]++;
    cell.interfaceIds.push(i.id);
  }
  const matrix = [...cellMap.values()];
  return {
    external,
    internal,
    units: index.units.rows.filter((u) => u.isActive === 1 && unitIds.has(u.id)).map((u) => unitRef(u)!),
    matrix,
    chord: matrix.map((c) => ({ fromUnitId: c.fromUnitId, toUnitId: c.toUnitId, count: c.count })),
    changeRequests: await listInterfaceChangeRequests(user),
  };
}

/** Everything one unit gives and receives, for the tool and the unit panel. */
export async function getUnitInterfaces(user: CurrentUser, unitId: string): Promise<{
  unit: UnitRef;
  gives: UnitInterfaceView[];
  receives: UnitInterfaceView[];
  external: EntityInterfaceView[];
} | null> {
  const index = await loadProcessIndex(user);
  const unit = unitRef(index.units.byId.get(unitId));
  if (!unit) return null;
  const internal = await unitInterfaceViews(
    user,
    index.unitInterfaces.filter((i) => i.status !== "retired" && (i.fromUnitId === unitId || i.toUnitId === unitId)),
    index
  );
  const ownedIds = new Set(index.rows.filter((r) => r.ownerUnitId === unitId).map((r) => r.id));
  const unitPeople = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.departmentId, unitId), isNull(schema.users.deletedAt)));
  const peopleIds = new Set(unitPeople.map((p) => p.id));
  const external = await entityInterfaceViews(
    index.entityInterfaces.filter(
      (e) => (e.focalOrgUserId && peopleIds.has(e.focalOrgUserId)) || entityProcessIds(e).some((id) => ownedIds.has(id))
    ),
    index
  );
  return {
    unit,
    gives: internal.filter((i) => i.fromUnit.id === unitId),
    receives: internal.filter((i) => i.toUnit.id === unitId),
    external,
  };
}

/* ------------------------------------------------------------------ */
/* the operational KPI scorecard                                        */
/* ------------------------------------------------------------------ */

const KPI_DEFINITIONS: Record<string, { en: string; ar: string }> = {
  release_timeliness: {
    en: "Share of statistical releases published on their pre-announced date in the month.",
    ar: "نسبة الإصدارات الإحصائية المنشورة في موعدها المعلن مسبقاً خلال الشهر.",
  },
  data_request_turnaround: {
    en: "Average working days from receipt of a government data request to delivery.",
    ar: "متوسط أيام العمل من استلام طلب بيانات حكومي إلى التسليم.",
  },
  strategy_review_completion: {
    en: "Share of scheduled strategy review milestones completed on time over the rolling twelve months.",
    ar: "نسبة معالم مراجعة الاستراتيجية المجدولة المنجزة في موعدها خلال الاثني عشر شهراً الأخيرة.",
  },
  handover_completion: {
    en: "Share of handovers in the register that have reached complete; the current month reads the live handovers table.",
    ar: "نسبة التسليمات في السجل التي بلغت حالة الاكتمال، ويُقرأ الشهر الحالي من جدول التسليمات مباشرة.",
  },
  policy_review_currency: {
    en: "Share of policies, procedures, forms and services still inside their review cycle; the current month reads the live documents.",
    ar: "نسبة السياسات والإجراءات والنماذج والخدمات التي لا تزال ضمن دورة مراجعتها، ويُقرأ الشهر الحالي من الوثائق مباشرة.",
  },
};

function currentPeriod(): string {
  return nowIso().slice(0, 7);
}

/** Live values for the auto-sourced KPIs, by code. */
async function liveKpiValues(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const handovers = await db.select({ status: schema.handovers.status }).from(schema.handovers);
  out.set(
    "handover_completion",
    handovers.length ? Math.round((100 * handovers.filter((h) => h.status === "complete").length) / handovers.length) : 100
  );
  const terms = await policyTerms();
  const docs = await db
    .select({
      knowledgeTypeTermId: schema.documents.knowledgeTypeTermId,
      effectiveFrom: schema.documents.effectiveFrom,
      reviewCycleMonths: schema.documents.reviewCycleMonths,
      status: schema.documents.status,
    })
    .from(schema.documents)
    .where(isNull(schema.documents.deletedAt));
  const policies = docs.filter((d) => d.knowledgeTypeTermId && terms.has(d.knowledgeTypeTermId) && d.status !== "archived");
  const today = new Date();
  const current = policies.filter((d) => {
    if (!d.effectiveFrom || !d.reviewCycleMonths) return true;
    const due = new Date(d.effectiveFrom);
    due.setMonth(due.getMonth() + d.reviewCycleMonths);
    return due > today;
  }).length;
  out.set("policy_review_currency", policies.length ? Math.round((100 * current) / policies.length) : 100);
  return out;
}

export function ragForKpi(value: number | null, target: number | null, direction: string): { rag: Rag; attainment: number | null } {
  if (value == null || target == null) return { rag: "no_data", attainment: null };
  let attainment: number;
  if (direction === "down_good") attainment = value <= 0 ? 1.5 : target / value;
  else attainment = target <= 0 ? 1 : value / target;
  const rag: Rag = attainment >= 1 ? "on_target" : attainment >= 0.9 ? "at_risk" : "behind";
  return { rag, attainment: Math.round(attainment * 1000) / 1000 };
}

export async function getOpsKpis(): Promise<OpsKpiCard[]> {
  const [kpis, values] = await Promise.all([
    db.select().from(schema.opsKpis).orderBy(asc(schema.opsKpis.sort)),
    db.select().from(schema.opsKpiValues).orderBy(asc(schema.opsKpiValues.period)),
  ]);
  const live = kpis.some((k) => k.sourceKind === "auto") ? await liveKpiValues() : new Map<string, number>();
  const period = currentPeriod();
  return kpis.map((k) => {
    const series: OpsKpiPoint[] = values.filter((v) => v.kpiId === k.id).map((v) => ({ period: v.period, value: v.value }));
    if (k.sourceKind === "auto" && live.has(k.code)) {
      const idx = series.findIndex((p) => p.period === period);
      const point = { period, value: live.get(k.code)! };
      if (idx === -1) series.push(point);
      else series[idx] = point;
      series.sort((a, b) => a.period.localeCompare(b.period));
    }
    const reported = series.filter((p) => p.value != null);
    const latest = reported[reported.length - 1] ?? null;
    const previous = reported[reported.length - 2] ?? null;
    const { rag, attainment } = ragForKpi(latest?.value ?? null, k.targetValue, k.direction);
    let trend: OpsKpiCard["trend"] = null;
    let improving: boolean | null = null;
    if (latest?.value != null && previous?.value != null) {
      const tolerance = Math.abs(k.targetValue ?? latest.value) * 0.01;
      const delta = latest.value - previous.value;
      trend = Math.abs(delta) <= tolerance ? "flat" : delta > 0 ? "up" : "down";
      improving = trend === "flat" ? null : k.direction === "down_good" ? trend === "down" : trend === "up";
    }
    const def = KPI_DEFINITIONS[k.code];
    return {
      id: k.id,
      code: k.code,
      nameEn: k.nameEn,
      nameAr: k.nameAr,
      definitionEn: def?.en ?? null,
      definitionAr: def?.ar ?? null,
      unit: k.unit,
      direction: (k.direction === "down_good" ? "down_good" : "up_good") as "up_good" | "down_good",
      sourceKind: (k.sourceKind === "auto" ? "auto" : "manual") as "auto" | "manual",
      target: k.targetValue,
      latest,
      previous,
      series,
      trend,
      improving,
      rag,
      attainment,
      sort: k.sort,
    };
  });
}

/* ------------------------------------------------------------------ */
/* the whole operating model                                            */
/* ------------------------------------------------------------------ */

export type OperatingModelSection = "principles" | "governance" | "processes" | "raci" | "calendar" | "interfaces" | "kpis";
export const OPERATING_MODEL_SECTIONS: readonly OperatingModelSection[] = [
  "principles",
  "governance",
  "processes",
  "raci",
  "calendar",
  "interfaces",
  "kpis",
];

export async function getOperatingModel(user: CurrentUser, opts: { year?: number } = {}): Promise<OperatingModel> {
  const index = await loadProcessIndex(user);
  const [principles, governance, calendar, interfaces, kpis, canEdit] = await Promise.all([
    getPrinciples(),
    getGovernance(),
    getCalendar(opts.year),
    buildInterfaces(user, index),
    getOpsKpis(),
    canEditOperatingModel(user),
  ]);
  const isIllustrative =
    principles.some((p) => p.isIllustrative) ||
    index.rows.some((r) => r.isIllustrative === 1) ||
    calendar.events.some((e) => e.isIllustrative) ||
    interfaces.internal.some((i) => i.isIllustrative) ||
    interfaces.external.some((i) => i.isIllustrative);
  return {
    principles,
    governance,
    chain: buildChain(index),
    raci: buildRaci(index),
    calendar,
    interfaces,
    kpis,
    canEdit,
    isIllustrative,
  };
}

/** One section of the model, for `?section=` and the Ask EnviroAI tool. */
export async function getOperatingModelSection(
  user: CurrentUser,
  section: OperatingModelSection,
  opts: { year?: number } = {}
): Promise<unknown> {
  switch (section) {
    case "principles":
      return getPrinciples();
    case "governance":
      return getGovernance();
    case "processes":
      return buildChain(await loadProcessIndex(user));
    case "raci":
      return buildRaci(await loadProcessIndex(user));
    case "calendar":
      return getCalendar(opts.year);
    case "interfaces":
      return buildInterfaces(user, await loadProcessIndex(user));
    case "kpis":
      return getOpsKpis();
  }
}

/* ================================================================== */
/* writes: every one checks its permission and audits                   */
/* ================================================================== */

export type ProcessInput = {
  id?: string;
  code: string;
  level: ProcessLevel;
  parentId?: string | null;
  nameEn: string;
  nameAr: string;
  purposeEn?: string | null;
  purposeAr?: string | null;
  ownerUnitId?: string | null;
  inputs?: { textEn: string; textAr: string; fromUnitCode?: string | null }[];
  outputs?: { textEn: string; textAr: string; fromUnitCode?: string | null }[];
  steps?: { n: number; textEn: string; textAr: string; roleUnitCode?: string | null; system?: string | null }[];
  systems?: { nameEn: string; nameAr: string }[];
  kpis?: { nameEn: string; nameAr: string; target?: string | number | null; unit?: string | null }[];
  policyDocumentIds?: string[];
  sopDocumentIds?: string[];
  status?: string;
  sort?: number;
  isIllustrative?: boolean;
};

async function processOr404(id: string): Promise<ProcessRow> {
  const [row] = await db.select().from(schema.processes).where(eq(schema.processes.id, id)).limit(1);
  if (!row) throw new OpModelError("not_found", 404);
  return row;
}

/** Editors write any process; a unit head writes the processes their unit owns. */
async function requireProcessWriter(user: CurrentUser | null, ownerUnitId: string | null | undefined): Promise<CurrentUser> {
  if (!user) throw new OpModelError("unauthorized", 401);
  if (!(await canEditUnitProcesses(user, ownerUnitId))) throw new OpModelError("forbidden", 403);
  return user;
}

export async function upsertProcess(user: CurrentUser | null, input: ProcessInput): Promise<{ id: string }> {
  const existing = input.id ? await processOr404(input.id) : null;
  // the head of a unit may only create beneath or edit inside their own unit
  const actor = await requireProcessWriter(user, existing?.ownerUnitId ?? input.ownerUnitId ?? null);
  if (existing && input.ownerUnitId && input.ownerUnitId !== existing.ownerUnitId) {
    await requireProcessWriter(actor, input.ownerUnitId);
  }
  const code = input.code.trim();
  if (!code) throw new OpModelError("code_required");
  const [clash] = await db
    .select({ id: schema.processes.id })
    .from(schema.processes)
    .where(eq(schema.processes.code, code))
    .limit(1);
  if (clash && clash.id !== existing?.id) throw new OpModelError("code_taken", 409);
  if (input.parentId) {
    const parent = await processOr404(input.parentId);
    if (parent.level >= input.level) throw new OpModelError("parent_level_invalid");
    if (existing && input.parentId === existing.id) throw new OpModelError("would_create_a_cycle");
  } else if (input.level > 0) {
    throw new OpModelError("parent_required");
  }
  if (input.ownerUnitId) {
    const [unit] = await db.select({ id: schema.orgUnits.id }).from(schema.orgUnits).where(eq(schema.orgUnits.id, input.ownerUnitId)).limit(1);
    if (!unit) throw new OpModelError("unknown_unit");
  }
  const json = {
    inputsJson: input.inputs
      ? JSON.stringify(input.inputs.map((i) => ({ text_en: i.textEn, text_ar: i.textAr, from_unit_code: i.fromUnitCode ?? null })))
      : undefined,
    outputsJson: input.outputs
      ? JSON.stringify(input.outputs.map((i) => ({ text_en: i.textEn, text_ar: i.textAr, from_unit_code: i.fromUnitCode ?? null })))
      : undefined,
    stepsJson: input.steps
      ? JSON.stringify(
          input.steps.map((s, i) => ({
            n: s.n ?? i + 1,
            text_en: s.textEn,
            text_ar: s.textAr,
            role_unit_code: s.roleUnitCode ?? null,
            system: s.system ?? null,
          }))
        )
      : undefined,
    systemsJson: input.systems ? JSON.stringify(input.systems.map((s) => ({ name_en: s.nameEn, name_ar: s.nameAr }))) : undefined,
    kpisJson: input.kpis
      ? JSON.stringify(input.kpis.map((k) => ({ name_en: k.nameEn, name_ar: k.nameAr, target: k.target ?? null, unit: k.unit ?? null })))
      : undefined,
    policyDocumentIdsJson: input.policyDocumentIds ? JSON.stringify(input.policyDocumentIds) : undefined,
    sopDocumentIdsJson: input.sopDocumentIds ? JSON.stringify(input.sopDocumentIds) : undefined,
  };
  const values = {
    parentId: input.parentId ?? null,
    level: input.level,
    code,
    nameEn: input.nameEn,
    nameAr: input.nameAr,
    purposeEn: input.purposeEn ?? existing?.purposeEn ?? null,
    purposeAr: input.purposeAr ?? existing?.purposeAr ?? null,
    ownerUnitId: input.ownerUnitId === undefined ? existing?.ownerUnitId ?? null : input.ownerUnitId,
    status: input.status ?? existing?.status ?? "active",
    sort: input.sort ?? existing?.sort ?? 0,
    // a hand-edited row stops being illustrative unless the caller says otherwise
    isIllustrative: input.isIllustrative ? 1 : 0,
    updatedAt: nowIso(),
  };
  const defined = Object.fromEntries(Object.entries(json).filter(([, v]) => v !== undefined));
  if (existing) {
    await db.update(schema.processes).set({ ...values, ...defined }).where(eq(schema.processes.id, existing.id));
    await audit(actor.id, "process_updated", "process", existing.id, { code });
    return { id: existing.id };
  }
  const id = newId();
  await db.insert(schema.processes).values({ id, ...values, ...defined, createdAt: nowIso() });
  await audit(actor.id, "process_created", "process", id, { code, level: input.level });
  return { id };
}

/** Deletes a process with no children; RACI rows go with it, interfaces lose the link. */
export async function deleteProcess(user: CurrentUser | null, id: string): Promise<void> {
  const row = await processOr404(id);
  const actor = await requireProcessWriter(user, row.ownerUnitId);
  const [child] = await db.select({ id: schema.processes.id }).from(schema.processes).where(eq(schema.processes.parentId, id)).limit(1);
  if (child) throw new OpModelError("has_children", 409);
  await db.delete(schema.processRaci).where(eq(schema.processRaci.processId, id));
  await db.update(schema.unitInterfaces).set({ processId: null }).where(eq(schema.unitInterfaces.processId, id));
  const external = await db.select().from(schema.entityInterfaces);
  for (const e of external) {
    const ids = entityProcessIds(e);
    if (!ids.includes(id)) continue;
    await db
      .update(schema.entityInterfaces)
      .set({ processIdsJson: JSON.stringify(ids.filter((x) => x !== id)) })
      .where(eq(schema.entityInterfaces.id, e.id));
  }
  await db
    .update(schema.calendarEvents)
    .set({ linkedResourceType: null, linkedResourceId: null })
    .where(and(eq(schema.calendarEvents.linkedResourceType, "process"), eq(schema.calendarEvents.linkedResourceId, id)));
  await db.delete(schema.processes).where(eq(schema.processes.id, id));
  await audit(actor.id, "process_deleted", "process", id, { code: row.code });
}

/** Sets or clears one RACI cell. A second A on the same process is refused (409 accountable_exists). */
export async function setRaci(
  user: CurrentUser | null,
  processId: string,
  unitId: string,
  role: RaciRole | null
): Promise<{ processId: string; unitId: string; role: RaciRole | null }> {
  const actor = await requireEditor(user);
  await processOr404(processId);
  const [unit] = await db.select({ id: schema.orgUnits.id }).from(schema.orgUnits).where(eq(schema.orgUnits.id, unitId)).limit(1);
  if (!unit) throw new OpModelError("unknown_unit", 404);
  if (role && !RACI_ROLES.includes(role)) throw new OpModelError("invalid_role");
  const [existing] = await db
    .select()
    .from(schema.processRaci)
    .where(and(eq(schema.processRaci.processId, processId), eq(schema.processRaci.unitId, unitId)))
    .limit(1);
  if (role === "A") {
    const [other] = await db
      .select()
      .from(schema.processRaci)
      .where(and(eq(schema.processRaci.processId, processId), eq(schema.processRaci.role, "A")))
      .limit(1);
    if (other && other.unitId !== unitId) {
      throw new OpModelError("accountable_exists", 409, { accountableUnitId: other.unitId });
    }
  }
  if (!role) {
    if (existing) await db.delete(schema.processRaci).where(eq(schema.processRaci.id, existing.id));
  } else if (existing) {
    await db.update(schema.processRaci).set({ role }).where(eq(schema.processRaci.id, existing.id));
  } else {
    await db.insert(schema.processRaci).values({ id: newId(), processId, unitId, role });
  }
  await audit(actor.id, "raci_set", "process", processId, { unitId, role });
  return { processId, unitId, role };
}

export type PrincipleInput = { id?: string; titleEn: string; titleAr: string; textEn?: string | null; textAr?: string | null; sort?: number };

export async function upsertPrinciple(user: CurrentUser | null, input: PrincipleInput): Promise<{ id: string }> {
  const actor = await requireEditor(user);
  if (input.id) {
    const [row] = await db.select().from(schema.operatingPrinciples).where(eq(schema.operatingPrinciples.id, input.id)).limit(1);
    if (!row) throw new OpModelError("not_found", 404);
    await db
      .update(schema.operatingPrinciples)
      .set({
        titleEn: input.titleEn,
        titleAr: input.titleAr,
        textEn: input.textEn === undefined ? row.textEn : input.textEn,
        textAr: input.textAr === undefined ? row.textAr : input.textAr,
        sort: input.sort ?? row.sort,
        isIllustrative: 0,
      })
      .where(eq(schema.operatingPrinciples.id, row.id));
    await audit(actor.id, "principle_updated", "operating_principle", row.id);
    return { id: row.id };
  }
  const id = newId();
  const count = (await db.select({ id: schema.operatingPrinciples.id }).from(schema.operatingPrinciples)).length;
  await db.insert(schema.operatingPrinciples).values({
    id,
    titleEn: input.titleEn,
    titleAr: input.titleAr,
    textEn: input.textEn ?? null,
    textAr: input.textAr ?? null,
    sort: input.sort ?? 10 + count,
    isIllustrative: 0,
  });
  await audit(actor.id, "principle_created", "operating_principle", id);
  return { id };
}

export async function deletePrinciple(user: CurrentUser | null, id: string): Promise<void> {
  const actor = await requireEditor(user);
  const [row] = await db.select().from(schema.operatingPrinciples).where(eq(schema.operatingPrinciples.id, id)).limit(1);
  if (!row) throw new OpModelError("not_found", 404);
  await db.delete(schema.operatingPrinciples).where(eq(schema.operatingPrinciples.id, id));
  await audit(actor.id, "principle_deleted", "operating_principle", id);
}

export type CalendarEventInput = {
  id?: string;
  kind: CalendarKind;
  titleEn: string;
  titleAr: string;
  dateFrom: string;
  dateTo?: string | null;
  ownerUnitId?: string | null;
  linkedResourceType?: string | null;
  linkedResourceId?: string | null;
  recurrence?: Recurrence;
};

export async function upsertCalendarEvent(user: CurrentUser | null, input: CalendarEventInput): Promise<{ id: string }> {
  const actor = await requireEditor(user);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateFrom)) throw new OpModelError("invalid_date");
  if (input.dateTo && input.dateTo < input.dateFrom) throw new OpModelError("date_to_before_from");
  const values = {
    kind: input.kind,
    titleEn: input.titleEn,
    titleAr: input.titleAr,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo ?? null,
    ownerUnitId: input.ownerUnitId ?? null,
    linkedResourceType: input.linkedResourceType ?? null,
    linkedResourceId: input.linkedResourceId ?? null,
    recurrence: input.recurrence ?? "none",
    isIllustrative: 0,
  };
  if (input.id) {
    const [row] = await db.select().from(schema.calendarEvents).where(eq(schema.calendarEvents.id, input.id)).limit(1);
    if (!row) throw new OpModelError("not_found", 404);
    await db.update(schema.calendarEvents).set(values).where(eq(schema.calendarEvents.id, row.id));
    await audit(actor.id, "calendar_event_updated", "calendar_event", row.id, { kind: input.kind });
    return { id: row.id };
  }
  const id = newId();
  await db.insert(schema.calendarEvents).values({ id, ...values });
  await audit(actor.id, "calendar_event_created", "calendar_event", id, { kind: input.kind });
  return { id };
}

export async function deleteCalendarEvent(user: CurrentUser | null, id: string): Promise<void> {
  const actor = await requireEditor(user);
  const [row] = await db.select().from(schema.calendarEvents).where(eq(schema.calendarEvents.id, id)).limit(1);
  if (!row) throw new OpModelError("not_found", 404);
  await db.delete(schema.calendarEvents).where(eq(schema.calendarEvents.id, id));
  await audit(actor.id, "calendar_event_deleted", "calendar_event", id);
}

export type UnitInterfaceInput = {
  id?: string;
  fromUnitId: string;
  toUnitId: string;
  flowKind: FlowKind;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  triggerEn?: string | null;
  triggerAr?: string | null;
  cadence?: string | null;
  serviceLevel?: string | null;
  processId?: string | null;
  focalFromUserId?: string | null;
  focalToUserId?: string | null;
  status?: "active" | "retired";
};

export async function upsertUnitInterface(user: CurrentUser | null, input: UnitInterfaceInput): Promise<{ id: string }> {
  const actor = await requireEditor(user);
  if (input.fromUnitId === input.toUnitId) throw new OpModelError("same_unit");
  const units = await db
    .select({ id: schema.orgUnits.id })
    .from(schema.orgUnits)
    .where(inArray(schema.orgUnits.id, [input.fromUnitId, input.toUnitId]));
  if (units.length !== 2) throw new OpModelError("unknown_unit", 404);
  if (input.processId) await processOr404(input.processId);
  const values = {
    fromUnitId: input.fromUnitId,
    toUnitId: input.toUnitId,
    flowKind: input.flowKind,
    descriptionEn: input.descriptionEn ?? null,
    descriptionAr: input.descriptionAr ?? null,
    triggerEn: input.triggerEn ?? null,
    triggerAr: input.triggerAr ?? null,
    cadence: input.cadence ?? null,
    serviceLevel: input.serviceLevel ?? null,
    processId: input.processId ?? null,
    focalFromUserId: input.focalFromUserId ?? null,
    focalToUserId: input.focalToUserId ?? null,
    status: input.status ?? "active",
    isIllustrative: 0,
  };
  if (input.id) {
    const [row] = await db.select().from(schema.unitInterfaces).where(eq(schema.unitInterfaces.id, input.id)).limit(1);
    if (!row) throw new OpModelError("not_found", 404);
    await db.update(schema.unitInterfaces).set(values).where(eq(schema.unitInterfaces.id, row.id));
    await audit(actor.id, "unit_interface_updated", "unit_interface", row.id);
    return { id: row.id };
  }
  const id = newId();
  await db.insert(schema.unitInterfaces).values({ id, ...values });
  await audit(actor.id, "unit_interface_created", "unit_interface", id);
  return { id };
}

export type EntityInterfaceInput = {
  id?: string;
  entityId: string;
  providesEn?: string | null;
  providesAr?: string | null;
  receivesEn?: string | null;
  receivesAr?: string | null;
  focalOrgUserId?: string | null;
  focalEntityName?: string | null;
  legalBasisEn?: string | null;
  legalBasisAr?: string | null;
  cadence?: string | null;
  processIds?: string[];
};

export async function upsertEntityInterface(user: CurrentUser | null, input: EntityInterfaceInput): Promise<{ id: string }> {
  const actor = await requireEditor(user);
  const [entity] = await db.select({ id: schema.entities.id }).from(schema.entities).where(eq(schema.entities.id, input.entityId)).limit(1);
  if (!entity) throw new OpModelError("unknown_entity", 404);
  const values = {
    entityId: input.entityId,
    providesEn: input.providesEn ?? null,
    providesAr: input.providesAr ?? null,
    receivesEn: input.receivesEn ?? null,
    receivesAr: input.receivesAr ?? null,
    focalOrgUserId: input.focalOrgUserId ?? null,
    focalEntityName: input.focalEntityName ?? null,
    legalBasisEn: input.legalBasisEn ?? null,
    legalBasisAr: input.legalBasisAr ?? null,
    cadence: input.cadence ?? null,
    processIdsJson: JSON.stringify(input.processIds ?? []),
    isIllustrative: 0,
  };
  if (input.id) {
    const [row] = await db.select().from(schema.entityInterfaces).where(eq(schema.entityInterfaces.id, input.id)).limit(1);
    if (!row) throw new OpModelError("not_found", 404);
    await db.update(schema.entityInterfaces).set(values).where(eq(schema.entityInterfaces.id, row.id));
    await audit(actor.id, "entity_interface_updated", "entity_interface", row.id);
    return { id: row.id };
  }
  const id = newId();
  await db.insert(schema.entityInterfaces).values({ id, ...values });
  await audit(actor.id, "entity_interface_created", "entity_interface", id);
  return { id };
}

/** A unit head (of either side) or an editor proposes a change; the Strategy Office is notified. */
export async function proposeInterfaceChange(
  user: CurrentUser | null,
  input: { interfaceId?: string | null; fromUnitId?: string | null; toUnitId?: string | null; text: string }
): Promise<{ id: string; notified: number }> {
  if (!user) throw new OpModelError("unauthorized", 401);
  const text = input.text.trim();
  if (text.length < 5) throw new OpModelError("text_required");
  let fromUnitId = input.fromUnitId ?? null;
  let toUnitId = input.toUnitId ?? null;
  if (input.interfaceId) {
    const [iface] = await db.select().from(schema.unitInterfaces).where(eq(schema.unitInterfaces.id, input.interfaceId)).limit(1);
    if (!iface) throw new OpModelError("not_found", 404);
    fromUnitId = iface.fromUnitId;
    toUnitId = iface.toUnitId;
  }
  const allowed =
    (await canEditOperatingModel(user)) ||
    (fromUnitId ? await isUnitHead(user, fromUnitId) : false) ||
    (toUnitId ? await isUnitHead(user, toUnitId) : false);
  if (!allowed) throw new OpModelError("forbidden", 403);
  const id = newId();
  await db.insert(schema.interfaceChangeRequests).values({
    id,
    interfaceId: input.interfaceId ?? null,
    fromUnitId,
    toUnitId,
    requestedBy: user.id,
    text,
    status: "open",
    resolvedBy: null,
    resolvedAt: null,
    createdAt: nowIso(),
  });
  await audit(user.id, "interface_change_requested", "interface_change_request", id, { interfaceId: input.interfaceId ?? null });

  // the Strategy Office members and every Super Admin hear about it
  const officeId = await strategyOfficeUnitId();
  const users = await db
    .select({ id: schema.users.id, departmentId: schema.users.departmentId, roleId: schema.users.roleId })
    .from(schema.users)
    .where(isNull(schema.users.deletedAt));
  const roles = await db.select({ id: schema.roles.id, nameEn: schema.roles.nameEn }).from(schema.roles);
  const superAdminRoleIds = new Set(roles.filter((r) => r.nameEn === "Super Admin").map((r) => r.id));
  const recipients = users.filter(
    (u) => u.id !== user.id && ((officeId && u.departmentId === officeId) || superAdminRoleIds.has(u.roleId))
  );
  const units = await loadUnits();
  const from = fromUnitId ? units.byId.get(fromUnitId) : null;
  const to = toUnitId ? units.byId.get(toUnitId) : null;
  const pairEn = from && to ? `${from.code} to ${to.code}` : "an interface";
  const pairAr = from && to ? `${from.nameAr} إلى ${to.nameAr}` : "إحدى الواجهات";
  for (const r of recipients) {
    await notify(
      r.id,
      "interface_change_requested",
      `Interface change proposed: ${pairEn}`,
      `اقتراح تعديل على واجهة: ${pairAr}`,
      "/operating-model?section=interfaces",
      { en: text.slice(0, 180), ar: text.slice(0, 180) }
    );
  }
  return { id, notified: recipients.length };
}

export async function resolveInterfaceChange(
  user: CurrentUser | null,
  id: string,
  status: "approved" | "declined"
): Promise<void> {
  const actor = await requireEditor(user);
  const [row] = await db.select().from(schema.interfaceChangeRequests).where(eq(schema.interfaceChangeRequests.id, id)).limit(1);
  if (!row) throw new OpModelError("not_found", 404);
  if (row.status !== "open") throw new OpModelError("already_resolved", 409);
  await db
    .update(schema.interfaceChangeRequests)
    .set({ status, resolvedBy: actor.id, resolvedAt: nowIso() })
    .where(eq(schema.interfaceChangeRequests.id, id));
  await audit(actor.id, `interface_change_${status}`, "interface_change_request", id);
  await notify(
    row.requestedBy,
    "interface_change_resolved",
    status === "approved" ? "Your interface change was approved" : "Your interface change was declined",
    status === "approved" ? "تم اعتماد تعديل الواجهة الذي اقترحته" : "تم رفض تعديل الواجهة الذي اقترحته",
    "/operating-model?section=interfaces",
    { en: row.text.slice(0, 180), ar: row.text.slice(0, 180) }
  );
}

export type OpsKpiInput = {
  id?: string;
  code: string;
  nameEn: string;
  nameAr: string;
  unit?: string | null;
  direction?: "up_good" | "down_good";
  sourceKind?: "auto" | "manual";
  targetValue?: number | null;
  sort?: number;
};

export async function upsertOpsKpi(user: CurrentUser | null, input: OpsKpiInput): Promise<{ id: string }> {
  const actor = await requireEditor(user);
  const code = input.code.trim();
  if (!code) throw new OpModelError("code_required");
  const [clash] = await db.select({ id: schema.opsKpis.id }).from(schema.opsKpis).where(eq(schema.opsKpis.code, code)).limit(1);
  const existing = input.id
    ? (await db.select().from(schema.opsKpis).where(eq(schema.opsKpis.id, input.id)).limit(1))[0]
    : clash
      ? (await db.select().from(schema.opsKpis).where(eq(schema.opsKpis.id, clash.id)).limit(1))[0]
      : undefined;
  if (input.id && !existing) throw new OpModelError("not_found", 404);
  if (clash && existing && clash.id !== existing.id) throw new OpModelError("code_taken", 409);
  const values = {
    code,
    nameEn: input.nameEn,
    nameAr: input.nameAr,
    unit: input.unit === undefined ? existing?.unit ?? null : input.unit,
    direction: input.direction ?? existing?.direction ?? "up_good",
    sourceKind: input.sourceKind ?? existing?.sourceKind ?? "manual",
    targetValue: input.targetValue === undefined ? existing?.targetValue ?? null : input.targetValue,
    sort: input.sort ?? existing?.sort ?? 0,
  };
  if (existing) {
    await db.update(schema.opsKpis).set(values).where(eq(schema.opsKpis.id, existing.id));
    await audit(actor.id, "ops_kpi_updated", "ops_kpi", existing.id, { code });
    return { id: existing.id };
  }
  const id = newId();
  await db.insert(schema.opsKpis).values({ id, ...values });
  await audit(actor.id, "ops_kpi_created", "ops_kpi", id, { code });
  return { id };
}

/** Enters or replaces one monthly value (period YYYY-MM). */
export async function enterOpsKpiValue(
  user: CurrentUser | null,
  input: { kpiId?: string; code?: string; period: string; value: number | null }
): Promise<{ kpiId: string; period: string; value: number | null }> {
  const actor = await requireEditor(user);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period)) throw new OpModelError("invalid_period");
  const [kpi] = input.kpiId
    ? await db.select().from(schema.opsKpis).where(eq(schema.opsKpis.id, input.kpiId)).limit(1)
    : input.code
      ? await db.select().from(schema.opsKpis).where(eq(schema.opsKpis.code, input.code)).limit(1)
      : [];
  if (!kpi) throw new OpModelError("not_found", 404);
  const [existing] = await db
    .select()
    .from(schema.opsKpiValues)
    .where(and(eq(schema.opsKpiValues.kpiId, kpi.id), eq(schema.opsKpiValues.period, input.period)))
    .limit(1);
  if (existing) {
    await db
      .update(schema.opsKpiValues)
      .set({ value: input.value, enteredBy: actor.id })
      .where(eq(schema.opsKpiValues.id, existing.id));
  } else {
    await db.insert(schema.opsKpiValues).values({
      id: newId(),
      kpiId: kpi.id,
      period: input.period,
      value: input.value,
      enteredBy: actor.id,
      createdAt: nowIso(),
    });
  }
  await audit(actor.id, "ops_kpi_value_entered", "ops_kpi", kpi.id, { period: input.period, value: input.value });
  return { kpiId: kpi.id, period: input.period, value: input.value };
}
