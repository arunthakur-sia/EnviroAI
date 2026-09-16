// CR07 3: the Organisation module. One structure for the whole product: the
// org chart, the unit panel (mandate as published, people, what the unit owns,
// its policies and procedures), and the re-sync diff against npc.qa.
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { can, canSeeDocument } from "@/server/auth/permissions";

export const UNIT_LEVELS = [
  "secretary_general",
  "sector",
  "office",
  "department",
  "section",
] as const;
export type UnitLevel = (typeof UNIT_LEVELS)[number];

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
  /** the published head when they hold no SiaNexus account */
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
};

export type UnitOwns = {
  councilNodes: { id: string; code: string | null; titleEn: string; titleAr: string; level: string; status: string }[];
  ndsNodes: { id: string; code: string | null; titleEn: string; titleAr: string; nodeType: string; status: string }[];
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
  const [councilNodes, ndsLeads, unitDocs, indicators, expertRows, handovers] = await Promise.all([
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
          eq(schema.nodeLeads.nodeKind, "nds")
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

  const ndsNodeIds = ndsLeads.map((l) => l.nodeId);
  const ndsNodes = ndsNodeIds.length
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
        .where(inArray(schema.strategyNodes.id, ndsNodeIds))
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
  const ownedNodeIds = [...councilNodes.map((n) => n.id), ...ndsNodeIds];
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
    });
  }

  const mandateDoc = await db
    .select({ id: schema.documents.id })
    .from(schema.documents)
    .where(eq(schema.documents.sourceRef, `npc.qa organisational structure: ${unit.code}`))
    .limit(1);

  const isHead = row.headUserId === user.id;
  return {
    unit,
    breadcrumb,
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
      ndsNodes,
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
  };
}

function collectSubtree(id: string, units: OrgUnitNode[], depth = 0): string[] {
  if (depth > 6) return [];
  const direct = units.filter((u) => u.parentId === id).map((u) => u.id);
  return [...direct, ...direct.flatMap((d) => collectSubtree(d, units, depth + 1))];
}

/** Resolves a unit by code, id, or a loose name match (for Ask NPC). */
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
