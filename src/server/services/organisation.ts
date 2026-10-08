// CR07 3: the Organisation module. One structure for the whole product: the
// org chart, the unit panel (mandate as published, people, what the unit owns,
// its policies and procedures), and the re-sync diff against enviroai.demo.
// CR08 1: the levels live in org_levels, the structure editor's mutations
// (move, add, rename, edit, deactivate and delete with reassignment) each
// return the inverse operation for the undo stack, every save takes an
// org_snapshots row, a snapshot can be restored through the same validated
// path, units can be imported from a CSV, and unit heads can file change
// requests that reach every Super Admin.
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { can, canSeeDocument } from "@/server/auth/permissions";
import { audit } from "@/server/auth/audit";
import { notify } from "@/server/gamification/engine";
import { getOwnerRefs, type OwnerRefData } from "@/server/services/people";
import { newId, nowIso } from "@/lib/ids";

/** @deprecated CR08 1.2: the levels are read from org_levels; kept for old imports. */
export const UNIT_LEVELS = [
  "secretary_general",
  "sector",
  "office",
  "department",
  "section",
] as const;
export type UnitLevel = (typeof UNIT_LEVELS)[number];

/** CR08 1.2: the published levels, the seed of org_levels and the fallback
    before the seed has run. */
export const BUILTIN_LEVELS: readonly { code: string; nameEn: string; nameAr: string }[] = [
  { code: "secretary_general", nameEn: "Secretary General", nameAr: "الأمين العام" },
  { code: "sector", nameEn: "Sector", nameAr: "القطاع" },
  { code: "office", nameEn: "Office", nameAr: "المكتب" },
  { code: "department", nameEn: "Department", nameAr: "الإدارة" },
  { code: "section", nameEn: "Section", nameAr: "القسم" },
];

export type OrgLevel = { id: string; code: string; nameEn: string; nameAr: string; sort: number };

/** The levels in order, from the editable table; the built-ins until seeded. */
export async function getOrgLevels(): Promise<OrgLevel[]> {
  const rows = await db.select().from(schema.orgLevels).orderBy(asc(schema.orgLevels.sort));
  if (rows.length) return rows;
  return BUILTIN_LEVELS.map((l, i) => ({ id: `builtin:${l.code}`, ...l, sort: i }));
}

/** CR07 3.5: the four tabs of every unit panel. */
export const POLICY_TABS = ["policy_internal", "procedure", "form_template", "service"] as const;
export type PolicyTab = (typeof POLICY_TABS)[number];

export type OrgPerson = {
  id: string;
  nameEn: string;
  nameAr: string;
  positionEn: string | null;
  positionAr: string | null;
  avatarColor: string;
  email: string;
  roleInUnit: string;
};

export type OrgUnitNode = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  level: string;
  parentId: string | null;
  sort: number;
  isActive: boolean;
  head: { id: string; nameEn: string; nameAr: string; avatarColor: string } | null;
  /** the published head when they hold no EnviroAI account */
  headNameEn: string | null;
  headNameAr: string | null;
  headTitleEn: string | null;
  headTitleAr: string | null;
  headcount: number;
  /** headcount of this unit and everything under it */
  headcountTotal: number;
  policyCount: number;
  childIds: string[];
};

export type OrgTree = {
  units: OrgUnitNode[];
  rootId: string | null;
};

/** The whole structure with headcounts and policy counts, for the chart. */
export async function getOrgTree(user: CurrentUser): Promise<OrgTree> {
  const [units, users, links, docs] = await Promise.all([
    db.select().from(schema.orgUnits).orderBy(asc(schema.orgUnits.sort)),
    db
      .select({
        id: schema.users.id,
        nameEn: schema.users.nameEn,
        nameAr: schema.users.nameAr,
        avatarColor: schema.users.avatarColor,
        departmentId: schema.users.departmentId,
      })
      .from(schema.users)
      .where(isNull(schema.users.deletedAt)),
    db.select().from(schema.documentUnitLinks),
    db
      .select({
        id: schema.documents.id,
        classificationLevel: schema.documents.classificationLevel,
        visibilityScope: schema.documents.visibilityScope,
        visibilityAllowJson: schema.documents.visibilityAllowJson,
        departmentId: schema.documents.departmentId,
        ownerUserId: schema.documents.ownerUserId,
        knowledgeTypeTermId: schema.documents.knowledgeTypeTermId,
        deletedAt: schema.documents.deletedAt,
      })
      .from(schema.documents),
  ]);

  const policyTermIds = await policyTermIdSet();
  const docById = new Map(docs.map((d) => [d.id, d]));
  const policyCount = new Map<string, number>();
  for (const link of links) {
    const doc = docById.get(link.documentId);
    if (!doc || doc.deletedAt) continue;
    if (!doc.knowledgeTypeTermId || !policyTermIds.has(doc.knowledgeTypeTermId)) continue;
    if (!canSeeDocument(user, doc)) continue;
    policyCount.set(link.unitId, (policyCount.get(link.unitId) ?? 0) + 1);
  }

  const userById = new Map(users.map((u) => [u.id, u]));
  const staffCount = new Map<string, number>();
  for (const u of users) {
    if (!u.departmentId) continue;
    staffCount.set(u.departmentId, (staffCount.get(u.departmentId) ?? 0) + 1);
  }
  const childrenOf = new Map<string, string[]>();
  for (const u of units) {
    if (!u.parentId) continue;
    (childrenOf.get(u.parentId) ?? childrenOf.set(u.parentId, []).get(u.parentId)!).push(u.id);
  }
  const totalOf = (id: string, depth = 0): number => {
    if (depth > 6) return staffCount.get(id) ?? 0;
    return (
      (staffCount.get(id) ?? 0) +
      (childrenOf.get(id) ?? []).reduce((sum, c) => sum + totalOf(c, depth + 1), 0)
    );
  };

  const nodes: OrgUnitNode[] = units.map((u) => {
    const head = u.headUserId ? userById.get(u.headUserId) ?? null : null;
    return {
      id: u.id,
      code: u.code,
      nameEn: u.nameEn,
      nameAr: u.nameAr,
      level: u.level,
      parentId: u.parentId,
      sort: u.sort,
      isActive: u.isActive === 1,
      head: head
        ? { id: head.id, nameEn: head.nameEn, nameAr: head.nameAr, avatarColor: head.avatarColor }
        : null,
      headNameEn: u.headNameEn,
      headNameAr: u.headNameAr,
      headTitleEn: u.headTitleEn,
      headTitleAr: u.headTitleAr,
      headcount: staffCount.get(u.id) ?? 0,
      headcountTotal: totalOf(u.id),
      policyCount: policyCount.get(u.id) ?? 0,
      childIds: childrenOf.get(u.id) ?? [],
    };
  });
  const root = units.find((u) => !u.parentId) ?? null;
  return { units: nodes, rootId: root?.id ?? null };
}

async function policyTermIdSet(): Promise<Set<string>> {
  const [dimension] = await db
    .select()
    .from(schema.taxonomyDimensions)
    .where(eq(schema.taxonomyDimensions.code, "knowledge_type"))
    .limit(1);
  if (!dimension) return new Set();
  const terms = await db
    .select()
    .from(schema.taxonomyTerms)
    .where(eq(schema.taxonomyTerms.dimensionId, dimension.id));
  return new Set(
    terms.filter((t) => (POLICY_TABS as readonly string[]).includes(t.code)).map((t) => t.id)
  );
}

export type UnitPolicy = {
  id: string;
  tab: PolicyTab;
  titleEn: string;
  titleAr: string;
  summaryEn: string | null;
  summaryAr: string | null;
  versionLabel: string | null;
  effectiveFrom: string | null;
  reviewCycleMonths: number | null;
  reviewDue: boolean;
  visibilityScope: string;
  classificationLevel: number;
  status: string;
  supersedesDocumentId: string | null;
  updatedAt: string;
  /** CR08 9.1: the custodian of the document (documents.owner_user_id) */
  ownerUserId: string | null;
  /** CR08 9.1: that custodian resolved for OwnerControl; null when none holds an account */
  owner?: OwnerRefData | null;
};

export type UnitOwns = {
  councilNodes: { id: string; code: string | null; titleEn: string; titleAr: string; level: string; status: string }[];
  nesNodes: { id: string; code: string | null; titleEn: string; titleAr: string; nodeType: string; status: string }[];
  documentsByType: { code: string; nameEn: string; nameAr: string; count: number }[];
  indicators: { id: string; code: string; nameEn: string; nameAr: string }[];
  lessons: number;
  experts: { id: string; nameEn: string; nameAr: string }[];
  openHandovers: { id: string; personEn: string; personAr: string; completionPct: number }[];
};

export type UnitPanelData = {
  unit: OrgUnitNode;
  breadcrumb: { id: string; code: string; nameEn: string; nameAr: string }[];
  mandateEn: string[];
  mandateAr: string[];
  mandateSourceUrl: string | null;
  mandateSourceUrlAr: string | null;
  mandateFetchedAt: string | null;
  mandateDocumentId: string | null;
  responsibilitiesEn: string | null;
  responsibilitiesAr: string | null;
  head: OrgPerson | null;
  people: OrgPerson[];
  /** staff of the sub units, grouped under them */
  subUnitPeople: { unit: OrgUnitNode; people: OrgPerson[] }[];
  subUnits: OrgUnitNode[];
  owns: UnitOwns;
  policies: Record<PolicyTab, UnitPolicy[]>;
  canEdit: boolean;
  canAddPolicy: boolean;
  /** CR08 1.2: the unit's level as named in org_levels */
  levelNameEn: string;
  levelNameAr: string;
  /** CR08 1.2: the unit head or a Department Head of this unit may file a change request */
  canRequestChange: boolean;
  /** the reader's own change requests on this unit, newest first */
  myRequests: OrgChangeRequest[];
};

export type OrgChangeRequest = {
  id: string;
  unitId: string;
  unitCode: string;
  unitNameEn: string;
  unitNameAr: string;
  requestedBy: string;
  requesterEn: string;
  requesterAr: string;
  what: string;
  why: string | null;
  status: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

/** Everything the unit panel shows. */
export async function getUnitPanel(
  user: CurrentUser,
  code: string
): Promise<UnitPanelData | null> {
  const tree = await getOrgTree(user);
  const unit = tree.units.find((u) => u.code === code);
  if (!unit) return null;
  const byId = new Map(tree.units.map((u) => [u.id, u]));

  const [row] = await db
    .select()
    .from(schema.orgUnits)
    .where(eq(schema.orgUnits.id, unit.id))
    .limit(1);
  if (!row) return null;

  const breadcrumb: UnitPanelData["breadcrumb"] = [];
  let cursor = unit.parentId ? byId.get(unit.parentId) : undefined;
  for (let i = 0; i < 6 && cursor; i++) {
    breadcrumb.unshift({
      id: cursor.id,
      code: cursor.code,
      nameEn: cursor.nameEn,
      nameAr: cursor.nameAr,
    });
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }

  /* people, the head first */
  const staff = await db
    .select({
      id: schema.users.id,
      nameEn: schema.users.nameEn,
      nameAr: schema.users.nameAr,
      positionEn: schema.users.positionEn,
      positionAr: schema.users.positionAr,
      avatarColor: schema.users.avatarColor,
      email: schema.users.email,
      departmentId: schema.users.departmentId,
    })
    .from(schema.users)
    .where(isNull(schema.users.deletedAt));
  const members = await db.select().from(schema.orgUnitMembers);
  const roleOf = new Map(members.map((m) => [`${m.unitId}:${m.userId}`, m.roleInUnit]));
  const toPerson = (
    p: (typeof staff)[number],
    unitId: string
  ): OrgPerson => ({
    id: p.id,
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    positionEn: p.positionEn,
    positionAr: p.positionAr,
    avatarColor: p.avatarColor,
    email: p.email,
    roleInUnit: roleOf.get(`${unitId}:${p.id}`) ?? (row.headUserId === p.id ? "head" : "member"),
  });
  const ownStaff = staff.filter((s) => s.departmentId === unit.id).map((s) => toPerson(s, unit.id));
  const rank = (r: string) => (r === "head" ? 0 : r === "deputy" ? 1 : 2);
  ownStaff.sort((a, b) => rank(a.roleInUnit) - rank(b.roleInUnit) || a.nameEn.localeCompare(b.nameEn));
  const head = ownStaff.find((p) => p.roleInUnit === "head") ?? null;

  const subUnits = unit.childIds.map((id) => byId.get(id)!).filter(Boolean);
  const subUnitPeople = subUnits
    .map((sub) => ({
      unit: sub,
      people: staff
        .filter((s) => s.departmentId === sub.id)
        .map((s) => toPerson(s, sub.id))
        .sort((a, b) => rank(a.roleInUnit) - rank(b.roleInUnit) || a.nameEn.localeCompare(b.nameEn)),
    }))
    .filter((g) => g.people.length > 0);

  /* what the unit owns */
  const subtreeIds = [unit.id, ...collectSubtree(unit.id, tree.units)];
  const memberIds = staff.filter((s) => subtreeIds.includes(s.departmentId ?? "")).map((s) => s.id);
  const [councilNodes, nesLeads, unitDocs, indicators, expertRows, handovers] = await Promise.all([
    db
      .select({
        id: schema.councilNodes.id,
        code: schema.councilNodes.code,
        titleEn: schema.councilNodes.titleEn,
        titleAr: schema.councilNodes.titleAr,
        level: schema.councilNodes.level,
        status: schema.councilNodes.status,
      })
      .from(schema.councilNodes)
      .where(eq(schema.councilNodes.ownerUnitId, unit.id))
      .orderBy(asc(schema.councilNodes.sort))
      .limit(60),
    db
      .select({ nodeId: schema.nodeLeads.nodeId })
      .from(schema.nodeLeads)
      .where(
        and(
          eq(schema.nodeLeads.departmentId, unit.id),
          eq(schema.nodeLeads.role, "lead"),
          eq(schema.nodeLeads.nodeKind, "nes")
        )
      ),
    db
      .select({
        id: schema.documents.id,
        knowledgeTypeTermId: schema.documents.knowledgeTypeTermId,
        classificationLevel: schema.documents.classificationLevel,
        visibilityScope: schema.documents.visibilityScope,
        visibilityAllowJson: schema.documents.visibilityAllowJson,
        departmentId: schema.documents.departmentId,
        ownerUserId: schema.documents.ownerUserId,
        deletedAt: schema.documents.deletedAt,
      })
      .from(schema.documents)
      .where(eq(schema.documents.departmentId, unit.id)),
    db
      .select({
        id: schema.councilIndicators.id,
        code: schema.councilIndicators.code,
        nameEn: schema.councilIndicators.nameEn,
        nameAr: schema.councilIndicators.nameAr,
        nodeId: schema.councilIndicators.nodeId,
      })
      .from(schema.councilIndicators)
      .limit(400),
    memberIds.length
      ? db
          .select({
            id: schema.experts.id,
            nameEn: schema.experts.nameEn,
            nameAr: schema.experts.nameAr,
            userId: schema.experts.userId,
          })
          .from(schema.experts)
          .where(inArray(schema.experts.userId, memberIds))
      : Promise.resolve([]),
    db
      .select()
      .from(schema.handovers)
      .where(eq(schema.handovers.status, "in_progress"))
      .limit(40),
  ]);

  const nesNodeIds = nesLeads.map((l) => l.nodeId);
  const nesNodes = nesNodeIds.length
    ? await db
        .select({
          id: schema.strategyNodes.id,
          code: schema.strategyNodes.code,
          titleEn: schema.strategyNodes.titleEn,
          titleAr: schema.strategyNodes.titleAr,
          nodeType: schema.strategyNodes.nodeType,
          status: schema.strategyNodes.status,
        })
        .from(schema.strategyNodes)
        .where(inArray(schema.strategyNodes.id, nesNodeIds))
        .limit(40)
    : [];

  // documents by knowledge type, visibility aware
  const [dimension] = await db
    .select()
    .from(schema.taxonomyDimensions)
    .where(eq(schema.taxonomyDimensions.code, "knowledge_type"))
    .limit(1);
  const terms = dimension
    ? await db
        .select()
        .from(schema.taxonomyTerms)
        .where(eq(schema.taxonomyTerms.dimensionId, dimension.id))
    : [];
  const termById = new Map(terms.map((t) => [t.id, t]));
  const typeCounts = new Map<string, number>();
  for (const d of unitDocs) {
    if (d.deletedAt || !d.knowledgeTypeTermId) continue;
    if (!canSeeDocument(user, d)) continue;
    typeCounts.set(d.knowledgeTypeTermId, (typeCounts.get(d.knowledgeTypeTermId) ?? 0) + 1);
  }
  const documentsByType = [...typeCounts.entries()]
    .map(([termId, count]) => {
      const term = termById.get(termId);
      return term
        ? { code: term.code, nameEn: term.nameEn, nameAr: term.nameAr, count }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => b.count - a.count);

  // indicators the unit's council nodes carry
  const councilNodeIds = new Set(councilNodes.map((n) => n.id));
  const unitIndicators = indicators
    .filter((i) => councilNodeIds.has(i.nodeId))
    .map((i) => ({ id: i.id, code: i.code ?? "", nameEn: i.nameEn, nameAr: i.nameAr }));

  // lessons on anything the unit owns or leads
  const ownedNodeIds = [...councilNodes.map((n) => n.id), ...nesNodeIds];
  const lessonCount = ownedNodeIds.length
    ? (
        await db
          .select({ c: sql<number>`count(distinct ${schema.lessonNodeLinks.lessonId})` })
          .from(schema.lessonNodeLinks)
          .where(inArray(schema.lessonNodeLinks.nodeId, ownedNodeIds))
      )[0]?.c ?? 0
    : 0;

  // HR handovers: only the unit head and HR admins see them
  const seesHr = can(user, "read", "settings") || head?.id === user.id || user.id === row.headUserId;
  const staffIds = new Set(ownStaff.map((p) => p.id));
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const openHandovers = seesHr
    ? handovers
        .filter((h) => staffIds.has(h.userId))
        .map((h) => {
          const person = staffById.get(h.userId);
          return {
            id: h.id,
            personEn: person?.nameEn ?? "",
            personAr: person?.nameAr ?? "",
            completionPct: h.completionPct,
          };
        })
    : [];

  /* the four policy tabs */
  const policyTermIds = await policyTermIdSet();
  const links = await db
    .select()
    .from(schema.documentUnitLinks)
    .where(eq(schema.documentUnitLinks.unitId, unit.id));
  const linkedIds = links.map((l) => l.documentId);
  const policyDocs = linkedIds.length
    ? await db
        .select()
        .from(schema.documents)
        .where(inArray(schema.documents.id, linkedIds))
        .orderBy(desc(schema.documents.updatedAt))
    : [];
  const policies: Record<PolicyTab, UnitPolicy[]> = {
    policy_internal: [],
    procedure: [],
    form_template: [],
    service: [],
  };
  const today = new Date();
  for (const d of policyDocs) {
    if (d.deletedAt) continue;
    if (!d.knowledgeTypeTermId || !policyTermIds.has(d.knowledgeTypeTermId)) continue;
    if (!canSeeDocument(user, d)) continue;
    const term = termById.get(d.knowledgeTypeTermId);
    if (!term) continue;
    const tab = term.code as PolicyTab;
    let reviewDue = false;
    if (d.effectiveFrom && d.reviewCycleMonths) {
      const due = new Date(d.effectiveFrom);
      due.setMonth(due.getMonth() + d.reviewCycleMonths);
      reviewDue = due <= today;
    }
    policies[tab].push({
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
    });
  }
  /* CR08 9.1: the custodians of the tabs in one pass, for the person chip */
  const policyList = Object.values(policies).flat();
  const policyOwners = await getOwnerRefs(policyList.map((p) => p.ownerUserId));
  for (const p of policyList) p.owner = p.ownerUserId ? policyOwners[p.ownerUserId] ?? null : null;

  const mandateDoc = await db
    .select({ id: schema.documents.id })
    .from(schema.documents)
    .where(eq(schema.documents.sourceRef, `enviroai.demo organisational structure: ${unit.code}`))
    .limit(1);

  const isHead = row.headUserId === user.id;
  // CR08 1.2: the head of the unit, or a Department Head whose department this
  // is, may ask the Super Admin for a structural change
  const canRequestChange =
    isHead ||
    (user.role.nameEn === "Department Head" &&
      (user.departmentId === unit.id || subtreeIds.includes(user.departmentId ?? "")));
  const myRequests = await listChangeRequests({ unitId: unit.id, requestedBy: user.id });
  const levelDef = (await getOrgLevels()).find((l) => l.code === unit.level);
  return {
    unit,
    breadcrumb,
    levelNameEn: levelDef?.nameEn ?? unit.level,
    levelNameAr: levelDef?.nameAr ?? unit.level,
    mandateEn: (row.mandateEn ?? "").split("\n").filter(Boolean),
    mandateAr: (row.mandateAr ?? "").split("\n").filter(Boolean),
    mandateSourceUrl: row.mandateSourceUrl,
    mandateSourceUrlAr: row.mandateSourceUrlAr,
    mandateFetchedAt: row.mandateFetchedAt,
    mandateDocumentId: mandateDoc[0]?.id ?? null,
    responsibilitiesEn: row.responsibilitiesEn,
    responsibilitiesAr: row.responsibilitiesAr,
    head,
    people: ownStaff,
    subUnitPeople,
    subUnits,
    owns: {
      councilNodes,
      nesNodes,
      documentsByType,
      indicators: unitIndicators,
      lessons: Number(lessonCount),
      experts: expertRows.map((e) => ({ id: e.id, nameEn: e.nameEn, nameAr: e.nameAr })),
      openHandovers,
    },
    policies,
    // CR07 3.1: the structure is edited by admins; the head edits their own
    // unit's policies and their visibility
    canEdit: can(user, "manage", "settings"),
    canAddPolicy: isHead || can(user, "manage", "settings") || can(user, "create", "vault"),
    canRequestChange,
    myRequests,
  };
}

function collectSubtree(id: string, units: OrgUnitNode[], depth = 0): string[] {
  if (depth > 6) return [];
  const direct = units.filter((u) => u.parentId === id).map((u) => u.id);
  return [...direct, ...direct.flatMap((d) => collectSubtree(d, units, depth + 1))];
}

/** Resolves a unit by code, id, or a loose name match (for Ask EnviroAI). */
export async function findUnit(nameOrCode: string) {
  const needle = nameOrCode.trim().toLowerCase();
  const units = await db.select().from(schema.orgUnits);
  return (
    units.find((u) => u.code.toLowerCase() === needle) ??
    units.find((u) => u.id === nameOrCode) ??
    units.find((u) => u.nameEn.toLowerCase() === needle || u.nameAr === nameOrCode) ??
    units.find(
      (u) => u.nameEn.toLowerCase().includes(needle) || u.nameAr.includes(nameOrCode.trim())
    ) ??
    null
  );
}

/* ================================================================== */
/* CR08 1.2: the structure editor                                       */
/* ================================================================== */

export class OrgError extends Error {
  constructor(
    public code: string,
    public status = 400
  ) {
    super(code);
  }
}

type UnitRow = typeof schema.orgUnits.$inferSelect;

/** Every column in the product that points at an organisation unit. When a
    unit is deleted or deactivated, each of these moves to the chosen unit, so
    nothing is ever orphaned; the moves are recorded so an undo can put them
    back. Pairs with a unique index name the partner column so a move that
    would collide deletes the duplicate instead of failing. */
type UnitRef = {
  key: string;
  /** the impact category the count is reported under */
  category: keyof UnitImpactCounts;
  table: SQLiteTable;
  column: SQLiteColumn;
  field: string;
  id: SQLiteColumn;
  uniqueWith?: SQLiteColumn;
};

const UNIT_REFS: UnitRef[] = [
  { key: "users.department_id", category: "people", table: schema.users, column: schema.users.departmentId, field: "departmentId", id: schema.users.id },
  { key: "org_unit_members.unit_id", category: "people", table: schema.orgUnitMembers, column: schema.orgUnitMembers.unitId, field: "unitId", id: schema.orgUnitMembers.id, uniqueWith: schema.orgUnitMembers.userId },
  { key: "documents.department_id", category: "documents", table: schema.documents, column: schema.documents.departmentId, field: "departmentId", id: schema.documents.id },
  { key: "document_unit_links.unit_id", category: "policies", table: schema.documentUnitLinks, column: schema.documentUnitLinks.unitId, field: "unitId", id: schema.documentUnitLinks.id, uniqueWith: schema.documentUnitLinks.documentId },
  { key: "council_nodes.owner_unit_id", category: "ownedItems", table: schema.councilNodes, column: schema.councilNodes.ownerUnitId, field: "ownerUnitId", id: schema.councilNodes.id },
  { key: "council_strategies.owner_unit_id", category: "ownedItems", table: schema.councilStrategies, column: schema.councilStrategies.ownerUnitId, field: "ownerUnitId", id: schema.councilStrategies.id },
  { key: "node_leads.department_id", category: "ownedItems", table: schema.nodeLeads, column: schema.nodeLeads.departmentId, field: "departmentId", id: schema.nodeLeads.id },
  { key: "indicators.department_id", category: "indicators", table: schema.indicators, column: schema.indicators.departmentId, field: "departmentId", id: schema.indicators.id },
  { key: "hr_risks.department_id", category: "hrRisks", table: schema.hrRisks, column: schema.hrRisks.departmentId, field: "departmentId", id: schema.hrRisks.id },
  { key: "processes.owner_unit_id", category: "processes", table: schema.processes, column: schema.processes.ownerUnitId, field: "ownerUnitId", id: schema.processes.id },
  { key: "process_raci.unit_id", category: "processes", table: schema.processRaci, column: schema.processRaci.unitId, field: "unitId", id: schema.processRaci.id, uniqueWith: schema.processRaci.processId },
  { key: "collections.department_id", category: "other", table: schema.collections, column: schema.collections.departmentId, field: "departmentId", id: schema.collections.id },
  { key: "questions.department_id", category: "other", table: schema.questions, column: schema.questions.departmentId, field: "departmentId", id: schema.questions.id },
  { key: "expert_engagements.department_id", category: "other", table: schema.expertEngagements, column: schema.expertEngagements.departmentId, field: "departmentId", id: schema.expertEngagements.id },
  { key: "invitations.department_id", category: "other", table: schema.invitations, column: schema.invitations.departmentId, field: "departmentId", id: schema.invitations.id },
  { key: "knowledge_of_week.unit_id", category: "other", table: schema.knowledgeOfWeek, column: schema.knowledgeOfWeek.unitId, field: "unitId", id: schema.knowledgeOfWeek.id },
  { key: "calendar_events.owner_unit_id", category: "other", table: schema.calendarEvents, column: schema.calendarEvents.ownerUnitId, field: "ownerUnitId", id: schema.calendarEvents.id },
  { key: "unit_interfaces.from_unit_id", category: "other", table: schema.unitInterfaces, column: schema.unitInterfaces.fromUnitId, field: "fromUnitId", id: schema.unitInterfaces.id },
  { key: "unit_interfaces.to_unit_id", category: "other", table: schema.unitInterfaces, column: schema.unitInterfaces.toUnitId, field: "toUnitId", id: schema.unitInterfaces.id },
  { key: "interface_change_requests.from_unit_id", category: "other", table: schema.interfaceChangeRequests, column: schema.interfaceChangeRequests.fromUnitId, field: "fromUnitId", id: schema.interfaceChangeRequests.id },
  { key: "interface_change_requests.to_unit_id", category: "other", table: schema.interfaceChangeRequests, column: schema.interfaceChangeRequests.toUnitId, field: "toUnitId", id: schema.interfaceChangeRequests.id },
  { key: "org_change_requests.unit_id", category: "other", table: schema.orgChangeRequests, column: schema.orgChangeRequests.unitId, field: "unitId", id: schema.orgChangeRequests.id },
];

export type UnitImpactCounts = {
  people: number;
  documents: number;
  policies: number;
  ownedItems: number;
  indicators: number;
  lessons: number;
  openHandovers: number;
  hrRisks: number;
  processes: number;
  other: number;
};

export type UnitImpact = {
  unit: { id: string; code: string; nameEn: string; nameAr: string; level: string };
  subUnits: { id: string; code: string; nameEn: string; nameAr: string; level: string }[];
  counts: UnitImpactCounts;
  total: number;
};

async function allUnits(): Promise<UnitRow[]> {
  return db.select().from(schema.orgUnits).orderBy(asc(schema.orgUnits.sort));
}

function subtreeOf(id: string, units: { id: string; parentId: string | null }[]): string[] {
  const kids = new Map<string, string[]>();
  for (const u of units) {
    if (!u.parentId) continue;
    const bucket = kids.get(u.parentId);
    if (bucket) bucket.push(u.id);
    else kids.set(u.parentId, [u.id]);
  }
  const out: string[] = [];
  const stack = [...(kids.get(id) ?? [])];
  const seen = new Set<string>([id]);
  while (stack.length) {
    const next = stack.pop()!;
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
    stack.push(...(kids.get(next) ?? []));
  }
  return out;
}

async function countRef(ref: UnitRef, ids: string[]): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)` })
    .from(ref.table)
    .where(inArray(ref.column, ids));
  return Number(row?.c ?? 0);
}

/** Everything beneath a unit and everything that points at it, for the move
    confirmation and the delete or deactivate risk dialog. */
export async function getUnitImpact(unitId: string): Promise<UnitImpact> {
  const units = await allUnits();
  const unit = units.find((u) => u.id === unitId);
  if (!unit) throw new OrgError("not_found", 404);
  const subtree = subtreeOf(unit.id, units);
  const ids = [unit.id, ...subtree];
  const counts: UnitImpactCounts = {
    people: 0,
    documents: 0,
    policies: 0,
    ownedItems: 0,
    indicators: 0,
    lessons: 0,
    openHandovers: 0,
    hrRisks: 0,
    processes: 0,
    other: 0,
  };
  for (const ref of UNIT_REFS) {
    // members are the same people as users.department_id; count people once
    if (ref.key === "org_unit_members.unit_id") continue;
    counts[ref.category] += await countRef(ref, ids);
  }
  // deleted documents do not count
  const [deletedDocs] = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.documents)
    .where(and(inArray(schema.documents.departmentId, ids), sql`${schema.documents.deletedAt} is not null`));
  counts.documents = Math.max(0, counts.documents - Number(deletedDocs?.c ?? 0));

  // indicators of the owned council nodes, lessons on the owned nodes, and the
  // open handovers of the unit's people are consequences of the ownership
  const owned = await db
    .select({ id: schema.councilNodes.id })
    .from(schema.councilNodes)
    .where(inArray(schema.councilNodes.ownerUnitId, ids));
  const leads = await db
    .select({ nodeId: schema.nodeLeads.nodeId })
    .from(schema.nodeLeads)
    .where(inArray(schema.nodeLeads.departmentId, ids));
  const ownedIds = [...new Set([...owned.map((o) => o.id), ...leads.map((l) => l.nodeId)])];
  if (ownedIds.length) {
    const [ci] = await db
      .select({ c: sql<number>`count(*)` })
      .from(schema.councilIndicators)
      .where(inArray(schema.councilIndicators.nodeId, ownedIds));
    counts.indicators += Number(ci?.c ?? 0);
    const [ll] = await db
      .select({ c: sql<number>`count(distinct ${schema.lessonNodeLinks.lessonId})` })
      .from(schema.lessonNodeLinks)
      .where(inArray(schema.lessonNodeLinks.nodeId, ownedIds));
    counts.lessons = Number(ll?.c ?? 0);
  }
  const people = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(inArray(schema.users.departmentId, ids), isNull(schema.users.deletedAt)));
  if (people.length) {
    const [ho] = await db
      .select({ c: sql<number>`count(*)` })
      .from(schema.handovers)
      .where(
        and(
          inArray(schema.handovers.userId, people.map((p) => p.id)),
          inArray(schema.handovers.status, ["open", "in_progress", "overdue"])
        )
      );
    counts.openHandovers = Number(ho?.c ?? 0);
  }
  const subUnits = subtree
    .map((id) => units.find((u) => u.id === id)!)
    .filter(Boolean)
    .map((u) => ({ id: u.id, code: u.code, nameEn: u.nameEn, nameAr: u.nameAr, level: u.level }));
  const total =
    subUnits.length +
    counts.people +
    counts.documents +
    counts.policies +
    counts.ownedItems +
    counts.indicators +
    counts.lessons +
    counts.openHandovers +
    counts.hrRisks +
    counts.processes +
    counts.other;
  return {
    unit: { id: unit.id, code: unit.code, nameEn: unit.nameEn, nameAr: unit.nameAr, level: unit.level },
    subUnits,
    counts,
    total,
  };
}

/** One moved reference, recorded so the inverse operation can put it back. */
export type MovedRef = { key: string; id: string; from: string; deleted?: boolean };

async function moveRefs(fromIds: string[], toId: string): Promise<MovedRef[]> {
  const moved: MovedRef[] = [];
  for (const ref of UNIT_REFS) {
    const rows = await db
      .select({ id: ref.id, from: ref.column, partner: ref.uniqueWith ?? ref.id })
      .from(ref.table)
      .where(inArray(ref.column, fromIds));
    if (!rows.length) continue;
    let clashes = new Set<string>();
    if (ref.uniqueWith) {
      const existing = await db
        .select({ partner: ref.uniqueWith })
        .from(ref.table)
        .where(eq(ref.column, toId));
      clashes = new Set(existing.map((e) => String(e.partner)));
    }
    for (const row of rows) {
      const id = String(row.id);
      const from = String(row.from);
      if (ref.uniqueWith && clashes.has(String(row.partner))) {
        // the target already holds this pairing: the duplicate goes
        await db.delete(ref.table).where(eq(ref.id, id));
        moved.push({ key: ref.key, id, from, deleted: true });
        continue;
      }
      await db
        .update(ref.table)
        .set({ [ref.field]: toId } as never)
        .where(eq(ref.id, id));
      moved.push({ key: ref.key, id, from });
    }
  }
  return moved;
}

async function unmoveRefs(moved: MovedRef[]): Promise<number> {
  let restored = 0;
  const byKey = new Map(UNIT_REFS.map((r) => [r.key, r]));
  for (const m of moved) {
    if (m.deleted) continue; // a duplicate pairing that was dropped stays dropped
    const ref = byKey.get(m.key);
    if (!ref) continue;
    await db
      .update(ref.table)
      .set({ [ref.field]: m.from } as never)
      .where(eq(ref.id, m.id));
    restored++;
  }
  return restored;
}

/* ------------------------------------------------------------------ */
/* validation                                                           */
/* ------------------------------------------------------------------ */

function assertNoCycle(units: { id: string; parentId: string | null }[]): void {
  const byId = new Map(units.map((u) => [u.id, u]));
  for (const unit of units) {
    let cursor = unit.parentId ? byId.get(unit.parentId) : undefined;
    for (let i = 0; i < units.length + 1 && cursor; i++) {
      if (cursor.id === unit.id) throw new OrgError("would_create_a_cycle");
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
  }
}

async function assertLevel(code: string): Promise<void> {
  const levels = await getOrgLevels();
  if (!levels.some((l) => l.code === code)) throw new OrgError("unknown_level");
}

/* ------------------------------------------------------------------ */
/* snapshots                                                            */
/* ------------------------------------------------------------------ */

const SnapshotUnit = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  nameEn: z.string().min(1),
  nameAr: z.string().min(1),
  level: z.string().min(1),
  parentId: z.string().nullable(),
  sort: z.number().int(),
  isActive: z.number().int(),
  headUserId: z.string().nullable().optional(),
  headNameEn: z.string().nullable().optional(),
  headNameAr: z.string().nullable().optional(),
  headTitleEn: z.string().nullable().optional(),
  headTitleAr: z.string().nullable().optional(),
  mandateEn: z.string().nullable().optional(),
  mandateAr: z.string().nullable().optional(),
  mandateSourceUrl: z.string().nullable().optional(),
  mandateSourceUrlAr: z.string().nullable().optional(),
  mandateFetchedAt: z.string().nullable().optional(),
  responsibilitiesEn: z.string().nullable().optional(),
  responsibilitiesAr: z.string().nullable().optional(),
  descriptionEn: z.string().nullable().optional(),
  descriptionAr: z.string().nullable().optional(),
  keyProjectsNote: z.string().nullable().optional(),
});
const SnapshotTree = z.object({
  version: z.literal(1),
  units: z.array(SnapshotUnit),
  levels: z
    .array(z.object({ code: z.string(), nameEn: z.string(), nameAr: z.string(), sort: z.number() }))
    .default([]),
});
export type SnapshotTree = z.infer<typeof SnapshotTree>;

export type OrgSnapshotMeta = {
  id: string;
  takenAt: string;
  takenBy: string | null;
  takenByName: string | null;
  note: string | null;
  unitCount: number;
};

/** Serialises the whole structure. Every structural save calls this. */
export async function takeSnapshot(userId: string | null, note: string): Promise<string> {
  const [units, levels] = await Promise.all([allUnits(), getOrgLevels()]);
  const tree: SnapshotTree = {
    version: 1,
    units: units.map((u) => ({
      id: u.id,
      code: u.code,
      nameEn: u.nameEn,
      nameAr: u.nameAr,
      level: u.level,
      parentId: u.parentId,
      sort: u.sort,
      isActive: u.isActive,
      headUserId: u.headUserId,
      headNameEn: u.headNameEn,
      headNameAr: u.headNameAr,
      headTitleEn: u.headTitleEn,
      headTitleAr: u.headTitleAr,
      mandateEn: u.mandateEn,
      mandateAr: u.mandateAr,
      mandateSourceUrl: u.mandateSourceUrl,
      mandateSourceUrlAr: u.mandateSourceUrlAr,
      mandateFetchedAt: u.mandateFetchedAt,
      responsibilitiesEn: u.responsibilitiesEn,
      responsibilitiesAr: u.responsibilitiesAr,
      descriptionEn: u.descriptionEn,
      descriptionAr: u.descriptionAr,
      keyProjectsNote: u.keyProjectsNote,
    })),
    levels: levels.map((l) => ({ code: l.code, nameEn: l.nameEn, nameAr: l.nameAr, sort: l.sort })),
  };
  const id = newId();
  await db.insert(schema.orgSnapshots).values({
    id,
    takenAt: nowIso(),
    takenBy: userId,
    treeJson: JSON.stringify(tree),
    note: note.slice(0, 200),
  });
  return id;
}

export async function listSnapshots(limit = 30): Promise<OrgSnapshotMeta[]> {
  const rows = await db
    .select({
      id: schema.orgSnapshots.id,
      takenAt: schema.orgSnapshots.takenAt,
      takenBy: schema.orgSnapshots.takenBy,
      note: schema.orgSnapshots.note,
      treeJson: schema.orgSnapshots.treeJson,
    })
    .from(schema.orgSnapshots)
    .orderBy(desc(schema.orgSnapshots.takenAt))
    .limit(limit);
  const userIds = [...new Set(rows.map((r) => r.takenBy).filter(Boolean))] as string[];
  const users = userIds.length
    ? await db
        .select({ id: schema.users.id, nameEn: schema.users.nameEn })
        .from(schema.users)
        .where(inArray(schema.users.id, userIds))
    : [];
  const nameOf = new Map(users.map((u) => [u.id, u.nameEn]));
  return rows.map((r) => {
    let unitCount = 0;
    try {
      const parsed = JSON.parse(r.treeJson) as { units?: unknown[] };
      unitCount = Array.isArray(parsed.units) ? parsed.units.length : 0;
    } catch {
      unitCount = 0;
    }
    return {
      id: r.id,
      takenAt: r.takenAt,
      takenBy: r.takenBy,
      takenByName: r.takenBy ? nameOf.get(r.takenBy) ?? null : null,
      note: r.note,
      unitCount,
    };
  });
}

/** Replaces the structure with a snapshot through the validated path: a
    snapshot of the present state is taken first, units in the snapshot are
    upserted by id, and units that exist now but not in the snapshot are kept
    as inactive (their references stay intact, nothing is orphaned). */
export async function restoreSnapshot(
  userId: string,
  snapshotId: string
): Promise<{ restored: number; inserted: number; deactivated: number; beforeId: string }> {
  const [row] = await db
    .select()
    .from(schema.orgSnapshots)
    .where(eq(schema.orgSnapshots.id, snapshotId))
    .limit(1);
  if (!row) throw new OrgError("not_found", 404);
  let tree: SnapshotTree;
  try {
    tree = SnapshotTree.parse(JSON.parse(row.treeJson));
  } catch {
    throw new OrgError("invalid_snapshot");
  }
  const codes = new Set<string>();
  for (const u of tree.units) {
    if (codes.has(u.code)) throw new OrgError("duplicate_code");
    codes.add(u.code);
  }
  const ids = new Set(tree.units.map((u) => u.id));
  for (const u of tree.units) {
    if (u.parentId && !ids.has(u.parentId)) throw new OrgError("unknown_parent");
  }
  assertNoCycle(tree.units);

  const beforeId = await takeSnapshot(userId, `before restore of ${row.takenAt.slice(0, 16)}`);

  // levels first so every unit's level exists
  const currentLevels = await db.select().from(schema.orgLevels);
  for (const level of tree.levels) {
    const existing = currentLevels.find((l) => l.code === level.code);
    if (existing) {
      await db
        .update(schema.orgLevels)
        .set({ nameEn: level.nameEn, nameAr: level.nameAr, sort: level.sort })
        .where(eq(schema.orgLevels.id, existing.id));
    } else {
      await db.insert(schema.orgLevels).values({ id: newId(), ...level });
    }
  }
  const levelCodes = new Set((await getOrgLevels()).map((l) => l.code));
  for (const u of tree.units) {
    if (!levelCodes.has(u.level)) throw new OrgError("unknown_level");
  }

  const current = await allUnits();
  const currentById = new Map(current.map((u) => [u.id, u]));
  let restored = 0;
  let inserted = 0;
  // a code the snapshot gives to one id may be held by another row now:
  // free it first so the unique code rule holds during the upsert
  for (const u of tree.units) {
    const holder = current.find((c) => c.code === u.code && c.id !== u.id);
    if (holder) {
      await db
        .update(schema.orgUnits)
        .set({ code: `${holder.code}~${holder.id.slice(-4)}`, updatedAt: nowIso() })
        .where(eq(schema.orgUnits.id, holder.id));
    }
  }
  for (const u of tree.units) {
    const values = {
      code: u.code,
      nameEn: u.nameEn,
      nameAr: u.nameAr,
      level: u.level,
      parentId: u.parentId,
      sort: u.sort,
      isActive: u.isActive,
      headUserId: u.headUserId ?? null,
      headNameEn: u.headNameEn ?? null,
      headNameAr: u.headNameAr ?? null,
      headTitleEn: u.headTitleEn ?? null,
      headTitleAr: u.headTitleAr ?? null,
      mandateEn: u.mandateEn ?? null,
      mandateAr: u.mandateAr ?? null,
      mandateSourceUrl: u.mandateSourceUrl ?? null,
      mandateSourceUrlAr: u.mandateSourceUrlAr ?? null,
      mandateFetchedAt: u.mandateFetchedAt ?? null,
      responsibilitiesEn: u.responsibilitiesEn ?? null,
      responsibilitiesAr: u.responsibilitiesAr ?? null,
      descriptionEn: u.descriptionEn ?? null,
      descriptionAr: u.descriptionAr ?? null,
      keyProjectsNote: u.keyProjectsNote ?? null,
      updatedAt: nowIso(),
    };
    if (currentById.has(u.id)) {
      await db.update(schema.orgUnits).set(values).where(eq(schema.orgUnits.id, u.id));
      restored++;
    } else {
      await db.insert(schema.orgUnits).values({ id: u.id, ...values, createdAt: nowIso() });
      inserted++;
    }
  }
  let deactivated = 0;
  const root = tree.units.find((u) => !u.parentId) ?? null;
  for (const c of current) {
    if (ids.has(c.id)) continue;
    // not in the snapshot: kept, inactive, hung under the restored root so
    // its references still resolve and the tree stays connected
    await db
      .update(schema.orgUnits)
      .set({ isActive: 0, parentId: root && root.id !== c.id ? root.id : c.parentId, updatedAt: nowIso() })
      .where(eq(schema.orgUnits.id, c.id));
    deactivated++;
  }
  await audit(userId, "org_snapshot_restored", "org_snapshot", snapshotId, { restored, inserted, deactivated });
  await takeSnapshot(userId, `restored snapshot of ${row.takenAt.slice(0, 16)}`);
  return { restored, inserted, deactivated, beforeId };
}

/* ------------------------------------------------------------------ */
/* the editor's mutations, each answering with its inverse              */
/* ------------------------------------------------------------------ */

/** What the client pushes on its undo stack; applied through the same API. */
export type OrgInverse =
  | { action: "unit.move"; id: string; parentId: string | null; sort: number }
  | { action: "unit.edit"; id: string; patch: UnitPatch }
  | { action: "unit.delete"; id: string; reassignTo: string | null }
  | { action: "unit.restore"; unit: z.infer<typeof SnapshotUnit>; children: { id: string; parentId: string | null }[]; moved: MovedRef[]; wasDeleted: boolean }
  | { action: "unit.deactivateOnly"; id: string; active: boolean }
  | { action: "levels.save"; id: string; nameEn: string; nameAr: string; code: string }
  | { action: "levels.reorder"; ids: string[] }
  | { action: "levels.delete"; id: string }
  | { action: "levels.restore"; id: string; code: string; nameEn: string; nameAr: string; sort: number }
  | { action: "snapshots.restore"; id: string };

export type UnitPatch = {
  code?: string;
  nameEn?: string;
  nameAr?: string;
  level?: string;
  headUserId?: string | null;
  headNameEn?: string | null;
  headNameAr?: string | null;
  headTitleEn?: string | null;
  headTitleAr?: string | null;
  mandateEn?: string | null;
  mandateAr?: string | null;
  responsibilitiesEn?: string | null;
  responsibilitiesAr?: string | null;
  sort?: number;
};

const PATCH_KEYS: (keyof UnitPatch)[] = [
  "code",
  "nameEn",
  "nameAr",
  "level",
  "headUserId",
  "headNameEn",
  "headNameAr",
  "headTitleEn",
  "headTitleAr",
  "mandateEn",
  "mandateAr",
  "responsibilitiesEn",
  "responsibilitiesAr",
  "sort",
];

async function unitOr404(id: string): Promise<UnitRow> {
  const [unit] = await db.select().from(schema.orgUnits).where(eq(schema.orgUnits.id, id)).limit(1);
  if (!unit) throw new OrgError("not_found", 404);
  return unit;
}

function summary(unit: { code: string; nameEn: string }): string {
  return `${unit.code} ${unit.nameEn}`.slice(0, 80);
}

/** Moves a unit (and everything beneath it) under another parent. */
export async function moveUnit(
  userId: string,
  id: string,
  parentId: string | null,
  sort?: number
): Promise<{ inverse: OrgInverse; snapshotId: string }> {
  const unit = await unitOr404(id);
  const units = await allUnits();
  if (parentId) {
    if (!units.some((u) => u.id === parentId)) throw new OrgError("unknown_parent");
    if (parentId === id) throw new OrgError("would_create_a_cycle");
    assertNoCycle(units.map((u) => (u.id === id ? { id, parentId } : u)));
  }
  const nextSort = sort ?? unit.sort;
  await db
    .update(schema.orgUnits)
    .set({ parentId, sort: nextSort, updatedAt: nowIso() })
    .where(eq(schema.orgUnits.id, id));
  await audit(userId, "org_unit_moved", "org_unit", id, { from: unit.parentId, to: parentId });
  const parent = units.find((u) => u.id === parentId);
  const snapshotId = await takeSnapshot(
    userId,
    `moved ${summary(unit)} under ${parent ? summary(parent) : "the root"}`
  );
  return { inverse: { action: "unit.move", id, parentId: unit.parentId, sort: unit.sort }, snapshotId };
}

/** Adds a child unit at any level. */
export async function addUnit(
  userId: string,
  input: {
    code: string;
    nameEn: string;
    nameAr: string;
    level: string;
    parentId: string | null;
    headUserId?: string | null;
    headNameEn?: string | null;
    headNameAr?: string | null;
    headTitleEn?: string | null;
    headTitleAr?: string | null;
    mandateEn?: string | null;
    mandateAr?: string | null;
    responsibilitiesEn?: string | null;
    responsibilitiesAr?: string | null;
    sort?: number;
  }
): Promise<{ id: string; inverse: OrgInverse; snapshotId: string }> {
  await assertLevel(input.level);
  const units = await allUnits();
  if (units.some((u) => u.code.toLowerCase() === input.code.toLowerCase())) {
    throw new OrgError("code_taken", 409);
  }
  if (input.parentId && !units.some((u) => u.id === input.parentId)) throw new OrgError("unknown_parent");
  const siblings = units.filter((u) => u.parentId === (input.parentId ?? null));
  const id = newId();
  await db.insert(schema.orgUnits).values({
    id,
    code: input.code,
    nameEn: input.nameEn,
    nameAr: input.nameAr,
    level: input.level,
    parentId: input.parentId ?? null,
    headUserId: input.headUserId ?? null,
    headNameEn: input.headNameEn ?? null,
    headNameAr: input.headNameAr ?? null,
    headTitleEn: input.headTitleEn ?? null,
    headTitleAr: input.headTitleAr ?? null,
    mandateEn: input.mandateEn ?? null,
    mandateAr: input.mandateAr ?? null,
    responsibilitiesEn: input.responsibilitiesEn ?? null,
    responsibilitiesAr: input.responsibilitiesAr ?? null,
    sort: input.sort ?? (siblings.length ? Math.max(...siblings.map((s) => s.sort)) + 1 : 0),
    isActive: 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  await audit(userId, "org_unit_created", "org_unit", id, { code: input.code });
  const snapshotId = await takeSnapshot(userId, `added ${input.code} ${input.nameEn}`.slice(0, 120));
  // a brand new unit has nothing beneath it, so its undo is a plain delete
  return { id, inverse: { action: "unit.delete", id, reassignTo: input.parentId ?? null }, snapshotId };
}

/** Rename in both languages, or edit any field of the kebab menu. */
export async function editUnit(
  userId: string,
  id: string,
  patch: UnitPatch
): Promise<{ inverse: OrgInverse; snapshotId: string }> {
  const unit = await unitOr404(id);
  const clean: UnitPatch = {};
  const before: UnitPatch = {};
  for (const key of PATCH_KEYS) {
    if (!(key in patch) || patch[key] === undefined) continue;
    (clean as Record<string, unknown>)[key] = patch[key];
    (before as Record<string, unknown>)[key] = unit[key as keyof UnitRow];
  }
  if (clean.level) await assertLevel(clean.level);
  if (clean.code && clean.code !== unit.code) {
    const units = await allUnits();
    if (units.some((u) => u.id !== id && u.code.toLowerCase() === clean.code!.toLowerCase())) {
      throw new OrgError("code_taken", 409);
    }
  }
  if (clean.headUserId) {
    // a user head replaces any free-text head
    clean.headNameEn = null;
    clean.headNameAr = null;
    before.headNameEn = unit.headNameEn;
    before.headNameAr = unit.headNameAr;
  }
  await db
    .update(schema.orgUnits)
    .set({ ...clean, updatedAt: nowIso() })
    .where(eq(schema.orgUnits.id, id));
  await audit(userId, "org_unit_edited", "org_unit", id, { fields: Object.keys(clean) });
  const snapshotId = await takeSnapshot(userId, `edited ${summary(unit)}: ${Object.keys(clean).join(", ")}`);
  return { inverse: { action: "unit.edit", id, patch: before }, snapshotId };
}

/** Deactivate or delete: everything beneath moves to the chosen unit first,
    so nothing is orphaned. The inverse carries the row, the children and every
    moved reference, and puts all of it back. */
export async function retireUnit(
  userId: string,
  id: string,
  mode: "deactivate" | "delete",
  reassignTo: string | null
): Promise<{ inverse: OrgInverse; snapshotId: string; moved: number }> {
  const unit = await unitOr404(id);
  const units = await allUnits();
  const subtree = subtreeOf(id, units);
  const impact = await getUnitImpact(id);
  if (impact.total > 0 && !reassignTo) throw new OrgError("reassign_required");
  if (reassignTo) {
    if (reassignTo === id || subtree.includes(reassignTo)) throw new OrgError("reassign_inside_subtree");
    if (!units.some((u) => u.id === reassignTo)) throw new OrgError("unknown_parent");
  }
  const children = units.filter((u) => u.parentId === id).map((u) => ({ id: u.id, parentId: u.parentId }));
  let moved: MovedRef[] = [];
  if (reassignTo) {
    // direct children hang under the target; deeper units follow their parents
    for (const child of children) {
      await db
        .update(schema.orgUnits)
        .set({ parentId: reassignTo, updatedAt: nowIso() })
        .where(eq(schema.orgUnits.id, child.id));
    }
    // references of the unit itself move; the subtree's references stay with
    // their (now reparented) units
    moved = await moveRefs([id], reassignTo);
  }
  const row = SnapshotUnit.parse({ ...unit });
  if (mode === "delete") {
    await db.delete(schema.orgUnits).where(eq(schema.orgUnits.id, id));
  } else {
    await db
      .update(schema.orgUnits)
      .set({ isActive: 0, updatedAt: nowIso() })
      .where(eq(schema.orgUnits.id, id));
  }
  await audit(userId, mode === "delete" ? "org_unit_deleted" : "org_unit_deactivated", "org_unit", id, {
    reassignTo,
    moved: moved.length,
    children: children.length,
  });
  const target = units.find((u) => u.id === reassignTo);
  const snapshotId = await takeSnapshot(
    userId,
    `${mode === "delete" ? "deleted" : "deactivated"} ${summary(unit)}${target ? `, reassigned to ${summary(target)}` : ""}`
  );
  return {
    inverse: { action: "unit.restore", unit: row, children, moved, wasDeleted: mode === "delete" },
    snapshotId,
    moved: moved.length,
  };
}

/** The undo of retireUnit: the row comes back (or is reactivated), the
    children return, and every moved reference points at it again. */
export async function restoreUnit(
  userId: string,
  payload: Extract<OrgInverse, { action: "unit.restore" }>
): Promise<{ snapshotId: string }> {
  const u = SnapshotUnit.parse(payload.unit);
  const [existing] = await db.select().from(schema.orgUnits).where(eq(schema.orgUnits.id, u.id)).limit(1);
  const values = {
    code: u.code,
    nameEn: u.nameEn,
    nameAr: u.nameAr,
    level: u.level,
    parentId: u.parentId,
    sort: u.sort,
    isActive: 1,
    headUserId: u.headUserId ?? null,
    headNameEn: u.headNameEn ?? null,
    headNameAr: u.headNameAr ?? null,
    headTitleEn: u.headTitleEn ?? null,
    headTitleAr: u.headTitleAr ?? null,
    mandateEn: u.mandateEn ?? null,
    mandateAr: u.mandateAr ?? null,
    mandateSourceUrl: u.mandateSourceUrl ?? null,
    mandateSourceUrlAr: u.mandateSourceUrlAr ?? null,
    mandateFetchedAt: u.mandateFetchedAt ?? null,
    responsibilitiesEn: u.responsibilitiesEn ?? null,
    responsibilitiesAr: u.responsibilitiesAr ?? null,
    updatedAt: nowIso(),
  };
  if (existing) {
    await db.update(schema.orgUnits).set(values).where(eq(schema.orgUnits.id, u.id));
  } else {
    const clash = await db.select({ id: schema.orgUnits.id }).from(schema.orgUnits).where(eq(schema.orgUnits.code, u.code)).limit(1);
    if (clash.length) throw new OrgError("code_taken", 409);
    await db.insert(schema.orgUnits).values({ id: u.id, ...values, createdAt: nowIso() });
  }
  for (const child of payload.children) {
    await db
      .update(schema.orgUnits)
      .set({ parentId: u.id, updatedAt: nowIso() })
      .where(eq(schema.orgUnits.id, child.id));
  }
  const restored = await unmoveRefs(payload.moved);
  await audit(userId, "org_unit_restored", "org_unit", u.id, { restored, children: payload.children.length });
  const snapshotId = await takeSnapshot(userId, `restored ${summary(u)} (undo)`);
  return { snapshotId };
}

export async function setUnitActive(userId: string, id: string, active: boolean): Promise<{ inverse: OrgInverse; snapshotId: string }> {
  const unit = await unitOr404(id);
  await db
    .update(schema.orgUnits)
    .set({ isActive: active ? 1 : 0, updatedAt: nowIso() })
    .where(eq(schema.orgUnits.id, id));
  await audit(userId, active ? "org_unit_reactivated" : "org_unit_deactivated", "org_unit", id);
  const snapshotId = await takeSnapshot(userId, `${active ? "reactivated" : "deactivated"} ${summary(unit)}`);
  return { inverse: { action: "unit.deactivateOnly", id, active: unit.isActive === 1 }, snapshotId };
}

/* ------------------------------------------------------------------ */
/* levels                                                               */
/* ------------------------------------------------------------------ */

export async function saveLevel(
  userId: string,
  input: { id?: string; code: string; nameEn: string; nameAr: string }
): Promise<{ id: string; inverse: OrgInverse; snapshotId: string }> {
  const rows = await db.select().from(schema.orgLevels).orderBy(asc(schema.orgLevels.sort));
  const code = input.code.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  if (!code) throw new OrgError("invalid");
  const existing = input.id ? rows.find((l) => l.id === input.id) : undefined;
  if (rows.some((l) => l.code === code && l.id !== existing?.id)) throw new OrgError("code_taken", 409);
  if (existing) {
    // renaming a level's code renames it on every unit that uses it
    if (existing.code !== code) {
      await db.update(schema.orgUnits).set({ level: code }).where(eq(schema.orgUnits.level, existing.code));
    }
    await db
      .update(schema.orgLevels)
      .set({ code, nameEn: input.nameEn.trim(), nameAr: input.nameAr.trim() })
      .where(eq(schema.orgLevels.id, existing.id));
    await audit(userId, "org_level_edited", "org_level", existing.id, { code });
    const snapshotId = await takeSnapshot(userId, `renamed level ${existing.code}`);
    return {
      id: existing.id,
      inverse: { action: "levels.save", id: existing.id, code: existing.code, nameEn: existing.nameEn, nameAr: existing.nameAr },
      snapshotId,
    };
  }
  const id = newId();
  await db.insert(schema.orgLevels).values({
    id,
    code,
    nameEn: input.nameEn.trim(),
    nameAr: input.nameAr.trim(),
    sort: rows.length ? Math.max(...rows.map((r) => r.sort)) + 1 : 0,
  });
  await audit(userId, "org_level_created", "org_level", id, { code });
  const snapshotId = await takeSnapshot(userId, `added level ${code}`);
  return { id, inverse: { action: "levels.delete", id }, snapshotId };
}

export async function reorderLevels(userId: string, ids: string[]): Promise<{ inverse: OrgInverse; snapshotId: string }> {
  const rows = await db.select().from(schema.orgLevels).orderBy(asc(schema.orgLevels.sort));
  const known = new Set(rows.map((r) => r.id));
  const ordered = ids.filter((id) => known.has(id));
  for (const row of rows) if (!ordered.includes(row.id)) ordered.push(row.id);
  for (let i = 0; i < ordered.length; i++) {
    await db.update(schema.orgLevels).set({ sort: i }).where(eq(schema.orgLevels.id, ordered[i]));
  }
  await audit(userId, "org_levels_reordered", "org_level", "all", { order: ordered });
  const snapshotId = await takeSnapshot(userId, "reordered the levels");
  return { inverse: { action: "levels.reorder", ids: rows.map((r) => r.id) }, snapshotId };
}

/** A level can only go when no unit uses it. */
export async function deleteLevel(userId: string, id: string): Promise<{ inverse: OrgInverse; snapshotId: string }> {
  const [level] = await db.select().from(schema.orgLevels).where(eq(schema.orgLevels.id, id)).limit(1);
  if (!level) throw new OrgError("not_found", 404);
  const [used] = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.orgUnits)
    .where(eq(schema.orgUnits.level, level.code));
  if (Number(used?.c ?? 0) > 0) throw new OrgError("level_in_use", 409);
  await db.delete(schema.orgLevels).where(eq(schema.orgLevels.id, id));
  await audit(userId, "org_level_deleted", "org_level", id, { code: level.code });
  const snapshotId = await takeSnapshot(userId, `removed level ${level.code}`);
  return {
    inverse: { action: "levels.restore", id: level.id, code: level.code, nameEn: level.nameEn, nameAr: level.nameAr, sort: level.sort },
    snapshotId,
  };
}

export async function restoreLevel(
  userId: string,
  level: { id: string; code: string; nameEn: string; nameAr: string; sort: number }
): Promise<{ snapshotId: string }> {
  const [existing] = await db.select().from(schema.orgLevels).where(eq(schema.orgLevels.code, level.code)).limit(1);
  if (!existing) {
    await db.insert(schema.orgLevels).values(level);
  }
  await audit(userId, "org_level_restored", "org_level", level.id, { code: level.code });
  const snapshotId = await takeSnapshot(userId, `restored level ${level.code} (undo)`);
  return { snapshotId };
}

/* ------------------------------------------------------------------ */
/* CSV import: code, parent_code, level, name_en, name_ar, head_name,   */
/* head_title                                                           */
/* ------------------------------------------------------------------ */

export type CsvRow = {
  line: number;
  code: string;
  parentCode: string | null;
  level: string;
  nameEn: string;
  nameAr: string;
  headName: string | null;
  headTitle: string | null;
  /** new | update | unchanged | error */
  status: "new" | "update" | "unchanged" | "error";
  errors: string[];
  changes: string[];
};

export type CsvPreview = {
  rows: CsvRow[];
  counts: { new: number; update: number; unchanged: number; error: number };
  columns: string[];
};

const CSV_COLUMNS = ["code", "parent_code", "level", "name_en", "name_ar", "head_name", "head_title"];

/** A small CSV reader: quoted fields, doubled quotes, CRLF, a BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/** Validates the CSV against the structure and says what each row would do. */
export async function previewOrgCsv(text: string): Promise<CsvPreview> {
  const table = parseCsv(text);
  const empty: CsvPreview = { rows: [], counts: { new: 0, update: 0, unchanged: 0, error: 0 }, columns: [] };
  if (!table.length) return empty;
  const header = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const col = (name: string) => header.indexOf(name);
  const missing = ["code", "name_en", "name_ar"].filter((c) => col(c) < 0);
  if (missing.length) {
    return {
      ...empty,
      columns: header,
      rows: [
        {
          line: 1,
          code: "",
          parentCode: null,
          level: "",
          nameEn: "",
          nameAr: "",
          headName: null,
          headTitle: null,
          status: "error",
          errors: [`missing_columns:${missing.join(",")}`],
          changes: [],
        },
      ],
      counts: { new: 0, update: 0, unchanged: 0, error: 1 },
    };
  }
  const [units, levels] = await Promise.all([allUnits(), getOrgLevels()]);
  const levelCodes = new Set(levels.map((l) => l.code));
  const byCode = new Map(units.map((u) => [u.code.toLowerCase(), u]));
  const seen = new Set<string>();
  const rows: CsvRow[] = [];
  const cell = (r: string[], name: string) => {
    const i = col(name);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };
  for (let i = 1; i < table.length; i++) {
    const r = table[i];
    const code = cell(r, "code");
    const parentCode = cell(r, "parent_code") || null;
    const level = cell(r, "level") || "department";
    const nameEn = cell(r, "name_en");
    const nameAr = cell(r, "name_ar");
    const headName = cell(r, "head_name") || null;
    const headTitle = cell(r, "head_title") || null;
    const errors: string[] = [];
    if (!code) errors.push("code_required");
    if (!nameEn) errors.push("name_en_required");
    if (!nameAr) errors.push("name_ar_required");
    if (!levelCodes.has(level)) errors.push("unknown_level");
    if (code && seen.has(code.toLowerCase())) errors.push("duplicate_code");
    seen.add(code.toLowerCase());
    if (parentCode && parentCode.toLowerCase() === code.toLowerCase()) errors.push("parent_is_self");
    const existing = byCode.get(code.toLowerCase());
    const changes: string[] = [];
    let status: CsvRow["status"] = existing ? "unchanged" : "new";
    if (existing) {
      if (existing.nameEn !== nameEn) changes.push("name_en");
      if (existing.nameAr !== nameAr) changes.push("name_ar");
      if (existing.level !== level) changes.push("level");
      const currentParent = existing.parentId ? units.find((u) => u.id === existing.parentId)?.code ?? null : null;
      if ((currentParent ?? "").toLowerCase() !== (parentCode ?? "").toLowerCase()) changes.push("parent");
      if (headName && (existing.headNameEn ?? "") !== headName && !existing.headUserId) changes.push("head");
      if (headTitle && (existing.headTitleEn ?? "") !== headTitle) changes.push("head_title");
      if (changes.length) status = "update";
    }
    rows.push({ line: i + 1, code, parentCode, level, nameEn, nameAr, headName, headTitle, status: errors.length ? "error" : status, errors, changes });
  }
  // parents must exist in the file or in the structure, and no cycles
  const fileCodes = new Set(rows.map((r) => r.code.toLowerCase()));
  for (const row of rows) {
    if (row.parentCode && !fileCodes.has(row.parentCode.toLowerCase()) && !byCode.has(row.parentCode.toLowerCase())) {
      row.errors.push("unknown_parent");
      row.status = "error";
    }
  }
  const nextParent = new Map<string, string | null>();
  for (const u of units) nextParent.set(u.code.toLowerCase(), u.parentId ? units.find((p) => p.id === u.parentId)?.code.toLowerCase() ?? null : null);
  for (const row of rows) nextParent.set(row.code.toLowerCase(), row.parentCode?.toLowerCase() ?? null);
  for (const row of rows) {
    if (row.status === "error") continue;
    let cursor = nextParent.get(row.code.toLowerCase()) ?? null;
    for (let i = 0; i < nextParent.size + 1 && cursor; i++) {
      if (cursor === row.code.toLowerCase()) {
        row.errors.push("would_create_a_cycle");
        row.status = "error";
        break;
      }
      cursor = nextParent.get(cursor) ?? null;
    }
  }
  const counts = { new: 0, update: 0, unchanged: 0, error: 0 };
  for (const row of rows) counts[row.status]++;
  return { rows, counts, columns: CSV_COLUMNS };
}

/** Applies a validated CSV: a snapshot of the present state first (the undo
    restores it), then parents before children, then a snapshot of the result. */
export async function applyOrgCsv(
  userId: string,
  text: string
): Promise<{ inserted: number; updated: number; snapshotId: string; beforeId: string }> {
  const preview = await previewOrgCsv(text);
  if (preview.counts.error > 0) throw new OrgError("csv_has_errors");
  const beforeId = await takeSnapshot(userId, "before CSV import");
  const units = await allUnits();
  const idByCode = new Map(units.map((u) => [u.code.toLowerCase(), u.id]));
  const pending = preview.rows.filter((r) => r.status !== "unchanged");
  let inserted = 0;
  let updated = 0;
  // resolve in dependency order: a row whose parent is still pending waits
  const done = new Set<string>();
  let guard = 0;
  while (pending.some((r) => !done.has(r.code)) && guard++ < pending.length + 2) {
    for (const row of pending) {
      if (done.has(row.code)) continue;
      const parentKey = row.parentCode?.toLowerCase() ?? null;
      if (parentKey && !idByCode.has(parentKey)) continue; // parent not created yet
      const parentId = parentKey ? idByCode.get(parentKey) ?? null : null;
      const existingId = idByCode.get(row.code.toLowerCase());
      if (existingId) {
        const existing = units.find((u) => u.id === existingId)!;
        await db
          .update(schema.orgUnits)
          .set({
            nameEn: row.nameEn,
            nameAr: row.nameAr,
            level: row.level,
            parentId,
            ...(row.headName && !existing.headUserId ? { headNameEn: row.headName } : {}),
            ...(row.headTitle ? { headTitleEn: row.headTitle } : {}),
            updatedAt: nowIso(),
          })
          .where(eq(schema.orgUnits.id, existingId));
        updated++;
      } else {
        const id = newId();
        const siblings = units.filter((u) => u.parentId === parentId);
        await db.insert(schema.orgUnits).values({
          id,
          code: row.code,
          nameEn: row.nameEn,
          nameAr: row.nameAr,
          level: row.level,
          parentId,
          headNameEn: row.headName,
          headTitleEn: row.headTitle,
          sort: siblings.length ? Math.max(...siblings.map((s) => s.sort)) + 1 + inserted : inserted,
          isActive: 1,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
        idByCode.set(row.code.toLowerCase(), id);
        inserted++;
      }
      done.add(row.code);
    }
  }
  await audit(userId, "org_csv_imported", "org_unit", "structure", { inserted, updated });
  const snapshotId = await takeSnapshot(userId, `CSV import: ${inserted} new, ${updated} updated`);
  return { inserted, updated, snapshotId, beforeId };
}

/* ------------------------------------------------------------------ */
/* change requests (CR08 1.2, last bullet)                              */
/* ------------------------------------------------------------------ */

async function superAdminIds(): Promise<string[]> {
  const rows = await db
    .select({ id: schema.users.id, roleName: schema.roles.nameEn })
    .from(schema.users)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.users.roleId))
    .where(and(isNull(schema.users.deletedAt), eq(schema.roles.nameEn, "Super Admin")));
  return rows.map((r) => r.id);
}

export async function listChangeRequests(filter: {
  status?: string;
  unitId?: string;
  requestedBy?: string;
  limit?: number;
} = {}): Promise<OrgChangeRequest[]> {
  const rows = await db
    .select({
      id: schema.orgChangeRequests.id,
      unitId: schema.orgChangeRequests.unitId,
      requestedBy: schema.orgChangeRequests.requestedBy,
      what: schema.orgChangeRequests.what,
      why: schema.orgChangeRequests.why,
      status: schema.orgChangeRequests.status,
      resolvedBy: schema.orgChangeRequests.resolvedBy,
      resolvedAt: schema.orgChangeRequests.resolvedAt,
      createdAt: schema.orgChangeRequests.createdAt,
      unitCode: schema.orgUnits.code,
      unitNameEn: schema.orgUnits.nameEn,
      unitNameAr: schema.orgUnits.nameAr,
      requesterEn: schema.users.nameEn,
      requesterAr: schema.users.nameAr,
    })
    .from(schema.orgChangeRequests)
    .leftJoin(schema.orgUnits, eq(schema.orgUnits.id, schema.orgChangeRequests.unitId))
    .leftJoin(schema.users, eq(schema.users.id, schema.orgChangeRequests.requestedBy))
    .where(
      and(
        filter.status ? eq(schema.orgChangeRequests.status, filter.status) : undefined,
        filter.unitId ? eq(schema.orgChangeRequests.unitId, filter.unitId) : undefined,
        filter.requestedBy ? eq(schema.orgChangeRequests.requestedBy, filter.requestedBy) : undefined
      )
    )
    .orderBy(desc(schema.orgChangeRequests.createdAt))
    .limit(filter.limit ?? 100);
  return rows.map((r) => ({
    ...r,
    unitCode: r.unitCode ?? "",
    unitNameEn: r.unitNameEn ?? "",
    unitNameAr: r.unitNameAr ?? "",
    requesterEn: r.requesterEn ?? "",
    requesterAr: r.requesterAr ?? "",
  }));
}

/** A unit head asks the Super Admin for a structural change. */
export async function createChangeRequest(
  user: CurrentUser,
  input: { unitId: string; what: string; why?: string | null }
): Promise<{ id: string; notified: number }> {
  const unit = await unitOr404(input.unitId);
  const units = await allUnits();
  const isHead = unit.headUserId === user.id;
  const inSubtree =
    user.departmentId === unit.id || subtreeOf(unit.id, units).includes(user.departmentId ?? "");
  const allowed =
    isHead ||
    (user.role.nameEn === "Department Head" && inSubtree) ||
    can(user, "manage", "settings");
  if (!allowed) throw new OrgError("forbidden", 403);
  const id = newId();
  await db.insert(schema.orgChangeRequests).values({
    id,
    unitId: unit.id,
    requestedBy: user.id,
    what: input.what.trim().slice(0, 2000),
    why: input.why?.trim().slice(0, 2000) || null,
    status: "open",
    createdAt: nowIso(),
  });
  await audit(user.id, "org_change_requested", "org_change_request", id, { unitId: unit.id });
  const admins = await superAdminIds();
  for (const adminId of admins) {
    await notify(
      adminId,
      "org_change_request",
      `Change requested for ${unit.nameEn}`,
      `طلب تعديل على ${unit.nameAr}`,
      "/settings?tab=organisation",
      {
        en: `${user.nameEn} asks: ${input.what.trim().slice(0, 180)}`,
        ar: `${user.nameAr} يطلب: ${input.what.trim().slice(0, 180)}`,
      }
    );
  }
  return { id, notified: admins.length };
}

/** The Super Admin resolves or declines; the requester hears back. */
export async function resolveChangeRequest(
  user: CurrentUser,
  id: string,
  status: "resolved" | "declined"
): Promise<void> {
  const [row] = await db
    .select()
    .from(schema.orgChangeRequests)
    .where(eq(schema.orgChangeRequests.id, id))
    .limit(1);
  if (!row) throw new OrgError("not_found", 404);
  await db
    .update(schema.orgChangeRequests)
    .set({ status, resolvedBy: user.id, resolvedAt: nowIso() })
    .where(eq(schema.orgChangeRequests.id, id));
  await audit(user.id, `org_change_request_${status}`, "org_change_request", id);
  const unit = await unitOr404(row.unitId).catch(() => null);
  await notify(
    row.requestedBy,
    "org_change_request_resolved",
    status === "resolved"
      ? `Your change request for ${unit?.nameEn ?? "the unit"} was applied`
      : `Your change request for ${unit?.nameEn ?? "the unit"} was declined`,
    status === "resolved"
      ? `تم تنفيذ طلب التعديل الخاص بك على ${unit?.nameAr ?? "الوحدة"}`
      : `تم رفض طلب التعديل الخاص بك على ${unit?.nameAr ?? "الوحدة"}`,
    unit ? `/organisation?unit=${encodeURIComponent(unit.code)}` : "/organisation",
    { en: row.what.slice(0, 180), ar: row.what.slice(0, 180) }
  );
}
