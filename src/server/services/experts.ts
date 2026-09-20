// The Expert Network service. CR08 3 splits the network into Internal
// (NPC staff, grouped by organisation unit) and External (other entities,
// academia, consultants, international advisors): every card now knows its
// kind, its unit path, its project involvement and its engagement history,
// and the page data comes from one call so the two views share one shape.
import { and, asc, desc, eq, inArray, isNotNull, isNull, like, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { newId, nowIso } from "@/lib/ids";
import { record, notify } from "@/server/gamification/engine";
import { audit } from "@/server/auth/audit";
import { enqueue } from "@/server/jobs/queue";
import { retrieveRecords } from "@/server/search/hybrid";

import { LEVEL_ORDER } from "@/lib/experts-constants";

export type ExpertKind = "internal" | "external";

export type ExpertUnitCrumb = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  level: string;
};

export type ExpertCardData = {
  id: string;
  nameEn: string;
  nameAr: string;
  type: string;
  kind: ExpertKind;
  avatarColor: string;
  organisationEn: string | null;
  organisationAr: string | null;
  positionEn: string | null;
  positionAr: string | null;
  availability: string;
  isVerified: boolean;
  engagementCount: number;
  endorsementCount: number;
  domains: { code: string; nameEn: string; nameAr: string }[];
  matchReason?: string;
  /* CR08 3 */
  country: string | null;
  lastEngagementYear: number | null;
  workedWithNpc: boolean;
  projectCount: number;
  topLevel: string | null;
  unitId: string | null;
  /** sector first, the person's own unit last; empty for externals */
  unitPath: ExpertUnitCrumb[];
  badges: { code: string; nameEn: string; nameAr: string; tier: string | null }[];
};

export type ExpertFilters = {
  q?: string;
  view?: string;
  type?: string;
  domain?: string;
  availability?: string;
  /** legacy alias of `unit` */
  department?: string;
  unit?: string;
  level?: string;
  projects?: boolean;
  organisation?: string;
  country?: string;
  workedWith?: boolean;
  limit?: number;
};

export type InternalGroup = {
  key: string;
  unit: ExpertUnitCrumb | null;
  sector: ExpertUnitCrumb | null;
  experts: ExpertCardData[];
};

export type ExpertsPageData = {
  view: ExpertKind;
  counts: { internal: number; external: number };
  experts: ExpertCardData[];
  groups: InternalGroup[];
  facets: {
    units: (ExpertUnitCrumb & { sectorNameEn: string | null; sectorNameAr: string | null; count: number })[];
    organisations: { en: string; ar: string; count: number }[];
    countries: { code: string; count: number }[];
  };
};

type ExpertRow = typeof schema.experts.$inferSelect;
type UnitRow = Pick<
  typeof schema.orgUnits.$inferSelect,
  "id" | "code" | "nameEn" | "nameAr" | "level" | "parentId" | "sort"
>;

export function kindOf(row: Pick<ExpertRow, "type" | "userId">): ExpertKind {
  return row.userId || row.type === "npc_employee" ? "internal" : "external";
}

function crumb(u: UnitRow): ExpertUnitCrumb {
  return { id: u.id, code: u.code, nameEn: u.nameEn, nameAr: u.nameAr, level: u.level };
}

/** The unit path from the sector (or the office under the SG) down to the unit. */
export function unitPathFor(unitId: string | null, byId: Map<string, UnitRow>): ExpertUnitCrumb[] {
  if (!unitId) return [];
  const path: ExpertUnitCrumb[] = [];
  let cursor = byId.get(unitId);
  for (let i = 0; i < 6 && cursor; i++) {
    if (cursor.level === "secretary_general") break;
    path.unshift(crumb(cursor));
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return path;
}

async function loadUnits(): Promise<UnitRow[]> {
  return db
    .select({
      id: schema.orgUnits.id,
      code: schema.orgUnits.code,
      nameEn: schema.orgUnits.nameEn,
      nameAr: schema.orgUnits.nameAr,
      level: schema.orgUnits.level,
      parentId: schema.orgUnits.parentId,
      sort: schema.orgUnits.sort,
    })
    .from(schema.orgUnits)
    .orderBy(asc(schema.orgUnits.sort));
}

/** Everything a card needs, loaded in batches for a set of expert rows. */
async function buildCards(rows: ExpertRow[], units?: UnitRow[]): Promise<ExpertCardData[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const userIds = rows.map((r) => r.userId).filter((u): u is string => Boolean(u));
  const unitRows = units ?? (await loadUnits());
  const unitById = new Map(unitRows.map((u) => [u.id, u]));

  const [domains, engagements, endorsements, users, badgeRows, stakeByExpert, stakeByUser, owned, requests] =
    await Promise.all([
      db
        .select({
          expertId: schema.expertDomains.expertId,
          code: schema.taxonomyTerms.code,
          nameEn: schema.taxonomyTerms.nameEn,
          nameAr: schema.taxonomyTerms.nameAr,
          level: schema.expertDomains.level,
          accepted: schema.expertDomains.accepted,
        })
        .from(schema.expertDomains)
        .innerJoin(schema.taxonomyTerms, eq(schema.taxonomyTerms.id, schema.expertDomains.termId))
        .where(inArray(schema.expertDomains.expertId, ids)),
      db
        .select({
          expertId: schema.expertEngagements.expertId,
          c: sql<number>`count(*)`,
          lastYear: sql<number | null>`max(${schema.expertEngagements.year})`,
        })
        .from(schema.expertEngagements)
        .where(inArray(schema.expertEngagements.expertId, ids))
        .groupBy(schema.expertEngagements.expertId),
      db
        .select({ expertId: schema.endorsements.expertId, c: sql<number>`count(*)` })
        .from(schema.endorsements)
        .where(inArray(schema.endorsements.expertId, ids))
        .groupBy(schema.endorsements.expertId),
      userIds.length
        ? db
            .select({ id: schema.users.id, departmentId: schema.users.departmentId })
            .from(schema.users)
            .where(inArray(schema.users.id, userIds))
        : Promise.resolve([] as { id: string; departmentId: string | null }[]),
      userIds.length
        ? db
            .select({
              userId: schema.userBadges.userId,
              code: schema.badges.code,
              nameEn: schema.badges.nameEn,
              nameAr: schema.badges.nameAr,
              tier: schema.badges.tier,
            })
            .from(schema.userBadges)
            .innerJoin(schema.badges, eq(schema.badges.id, schema.userBadges.badgeId))
            .where(inArray(schema.userBadges.userId, userIds))
        : Promise.resolve(
            [] as { userId: string; code: string; nameEn: string; nameAr: string; tier: string | null }[]
          ),
      db
        .select({
          expertId: schema.nodeStakeholders.expertId,
          nodeId: schema.nodeStakeholders.nodeId,
          nodeKind: schema.nodeStakeholders.nodeKind,
        })
        .from(schema.nodeStakeholders)
        .where(inArray(schema.nodeStakeholders.expertId, ids)),
      userIds.length
        ? db
            .select({
              userId: schema.nodeStakeholders.userId,
              nodeId: schema.nodeStakeholders.nodeId,
              nodeKind: schema.nodeStakeholders.nodeKind,
            })
            .from(schema.nodeStakeholders)
            .where(inArray(schema.nodeStakeholders.userId, userIds))
        : Promise.resolve([] as { userId: string | null; nodeId: string; nodeKind: string }[]),
      userIds.length
        ? db
            .select({ ownerUserId: schema.strategyNodes.ownerUserId, id: schema.strategyNodes.id })
            .from(schema.strategyNodes)
            .where(inArray(schema.strategyNodes.ownerUserId, userIds))
        : Promise.resolve([] as { ownerUserId: string | null; id: string }[]),
      db
        .select({ expertId: schema.expertRequests.expertId, c: sql<number>`count(*)` })
        .from(schema.expertRequests)
        .where(inArray(schema.expertRequests.expertId, ids))
        .groupBy(schema.expertRequests.expertId),
    ]);

  const engMap = new Map(engagements.map((e) => [e.expertId, e]));
  const endMap = new Map(endorsements.map((e) => [e.expertId, e.c]));
  const reqMap = new Map(requests.map((r) => [r.expertId, r.c]));
  const deptByUser = new Map(users.map((u) => [u.id, u.departmentId]));
  const badgesByUser = new Map<string, typeof badgeRows>();
  for (const b of badgeRows) {
    (badgesByUser.get(b.userId) ?? badgesByUser.set(b.userId, []).get(b.userId)!).push(b);
  }

  // CR08 3: "involved in N projects" counts the distinct nodes where the
  // person is a stakeholder (as an expert row or as an employee row) or the
  // owner, across both strategy stores.
  const nodesByExpert = new Map<string, Set<string>>();
  const nodesByUser = new Map<string, Set<string>>();
  for (const s of stakeByExpert) {
    if (!s.expertId) continue;
    (nodesByExpert.get(s.expertId) ?? nodesByExpert.set(s.expertId, new Set()).get(s.expertId)!).add(
      `${s.nodeKind}:${s.nodeId}`
    );
  }
  for (const s of stakeByUser) {
    if (!s.userId) continue;
    (nodesByUser.get(s.userId) ?? nodesByUser.set(s.userId, new Set()).get(s.userId)!).add(
      `${s.nodeKind}:${s.nodeId}`
    );
  }
  for (const n of owned) {
    if (!n.ownerUserId) continue;
    (nodesByUser.get(n.ownerUserId) ?? nodesByUser.set(n.ownerUserId, new Set()).get(n.ownerUserId)!).add(
      `nds:${n.id}`
    );
  }

  return rows.map((r) => {
    const kind = kindOf(r);
    const accepted = domains.filter((d) => d.expertId === r.id && d.accepted === 1);
    let topLevel: string | null = null;
    for (const d of accepted) {
      if (!topLevel || LEVEL_ORDER.indexOf(d.level as never) > LEVEL_ORDER.indexOf(topLevel as never)) {
        topLevel = d.level;
      }
    }
    const projectSet = new Set<string>([
      ...(nodesByExpert.get(r.id) ?? []),
      ...(r.userId ? nodesByUser.get(r.userId) ?? [] : []),
    ]);
    const eng = engMap.get(r.id);
    const engagementCount = eng?.c ?? 0;
    const unitId = r.userId ? deptByUser.get(r.userId) ?? null : null;
    return {
      id: r.id,
      nameEn: r.nameEn,
      nameAr: r.nameAr,
      type: r.type,
      kind,
      avatarColor: r.avatarColor,
      organisationEn: r.organisationEn,
      organisationAr: r.organisationAr,
      positionEn: r.positionEn,
      positionAr: r.positionAr,
      availability: r.availability,
      isVerified: r.isVerified === 1,
      engagementCount,
      endorsementCount: endMap.get(r.id) ?? 0,
      domains: accepted.slice(0, 6).map((d) => ({ code: d.code, nameEn: d.nameEn, nameAr: d.nameAr })),
      country: r.country ?? null,
      lastEngagementYear: eng?.lastYear ?? null,
      // an engagement, a project role, or an answered request all count as
      // having worked with NPC
      workedWithNpc:
        engagementCount > 0 || (nodesByExpert.get(r.id)?.size ?? 0) > 0 || (reqMap.get(r.id) ?? 0) > 0,
      projectCount: projectSet.size,
      topLevel,
      unitId,
      unitPath: kind === "internal" ? unitPathFor(unitId, unitById) : [],
      badges: r.userId ? (badgesByUser.get(r.userId) ?? []).slice(0, 3) : [],
    };
  });
}

function viewCondition(view?: string) {
  if (view === "internal") return or(eq(schema.experts.type, "npc_employee"), isNotNull(schema.experts.userId))!;
  if (view === "external") return and(ne(schema.experts.type, "npc_employee"), isNull(schema.experts.userId))!;
  return null;
}

/** The in-memory filters that need card facts (domain, unit, level, projects, engagements). */
export function applyCardFilters(cards: ExpertCardData[], filters: ExpertFilters): ExpertCardData[] {
  let out = cards;
  if (filters.type) out = out.filter((c) => c.type === filters.type);
  if (filters.availability) out = out.filter((c) => c.availability === filters.availability);
  if (filters.domain) out = out.filter((c) => c.domains.some((d) => d.code === filters.domain));
  const unit = filters.unit ?? filters.department;
  if (unit) out = out.filter((c) => c.unitId === unit || c.unitPath.some((p) => p.id === unit || p.code === unit));
  if (filters.level) out = out.filter((c) => c.topLevel === filters.level);
  if (filters.projects) out = out.filter((c) => c.projectCount > 0);
  if (filters.workedWith) out = out.filter((c) => c.workedWithNpc);
  if (filters.organisation) {
    const needle = filters.organisation.toLowerCase();
    out = out.filter(
      (c) =>
        (c.organisationEn ?? "").toLowerCase() === needle || (c.organisationAr ?? "") === filters.organisation
    );
  }
  if (filters.country) out = out.filter((c) => c.country === filters.country);
  return out;
}

export async function listExperts(user: CurrentUser, filters: ExpertFilters): Promise<ExpertCardData[]> {
  // natural-language query runs semantic matching first
  let semanticOrder: string[] | null = null;
  if (filters.q && filters.q.trim().split(/\s+/).length >= 2) {
    const hits = await retrieveRecords(
      filters.q,
      { maxClassification: user.clearanceLevel, resourceTypes: ["expert"] },
      40
    );
    semanticOrder = hits.map((h) => h.resourceId);
  }

  const conds = [sql`${schema.experts.visibilityClassification} <= ${user.clearanceLevel}`];
  const viewCond = viewCondition(filters.view);
  if (viewCond) conds.push(viewCond);
  if (filters.type) conds.push(eq(schema.experts.type, filters.type));
  if (filters.availability) conds.push(eq(schema.experts.availability, filters.availability));
  if (filters.q && !semanticOrder) {
    const pat = `%${filters.q}%`;
    conds.push(
      or(
        like(schema.experts.nameEn, pat),
        like(schema.experts.nameAr, pat),
        like(schema.experts.organisationEn, pat),
        like(schema.experts.organisationAr, pat),
        like(schema.experts.bioEn, pat)
      )!
    );
  }
  let rows = await db
    .select()
    .from(schema.experts)
    .where(and(...conds))
    .orderBy(asc(schema.experts.nameEn))
    .limit(Math.min(filters.limit ?? 200, 400));

  if (semanticOrder) {
    const rank = new Map(semanticOrder.map((id, i) => [id, i]));
    rows = rows
      .filter((r) => rank.has(r.id))
      .sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));
  }

  const cards = await buildCards(rows);
  return applyCardFilters(cards, filters);
}

/** CR08 3: the two labelled groups, internal first, never blended. */
export async function listExpertsGrouped(
  user: CurrentUser,
  filters: Omit<ExpertFilters, "view">
): Promise<{ internal: ExpertCardData[]; external: ExpertCardData[]; all: ExpertCardData[] }> {
  const all = await listExperts(user, filters);
  const internal = all.filter((e) => e.kind === "internal");
  const external = all.filter((e) => e.kind === "external");
  return { internal, external, all: [...internal, ...external] };
}

export async function expertCounts(user: CurrentUser): Promise<{ internal: number; external: number }> {
  const rows = await db
    .select({
      internal: sql<number>`sum(case when ${schema.experts.type} = 'npc_employee' or ${schema.experts.userId} is not null then 1 else 0 end)`,
      external: sql<number>`sum(case when ${schema.experts.type} <> 'npc_employee' and ${schema.experts.userId} is null then 1 else 0 end)`,
    })
    .from(schema.experts)
    .where(sql`${schema.experts.visibilityClassification} <= ${user.clearanceLevel}`);
  return { internal: Number(rows[0]?.internal ?? 0), external: Number(rows[0]?.external ?? 0) };
}

/** Groups internal experts by their own unit, in organisation order; the
    unassigned come last. */
export function groupByUnit(experts: ExpertCardData[], units: UnitRow[]): InternalGroup[] {
  const byId = new Map(units.map((u) => [u.id, u]));
  const order = new Map(units.map((u, i) => [u.id, i]));
  const buckets = new Map<string, ExpertCardData[]>();
  for (const e of experts) {
    const key = e.unitId && byId.has(e.unitId) ? e.unitId : "unassigned";
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(e);
  }
  const keys = [...buckets.keys()].sort((a, b) => {
    if (a === "unassigned") return 1;
    if (b === "unassigned") return -1;
    return (order.get(a) ?? 999) - (order.get(b) ?? 999);
  });
  return keys.map((key) => {
    const unit = key === "unassigned" ? null : byId.get(key) ?? null;
    const path = unit ? unitPathFor(unit.id, byId) : [];
    const sector = path.length > 1 ? path[0] : null;
    return {
      key,
      unit: unit ? crumb(unit) : null,
      sector,
      experts: buckets.get(key)!.sort((a, b) => a.nameEn.localeCompare(b.nameEn)),
    };
  });
}

/** One call for the /experts page: counts, the active view's cards, its
    unit groups and the facets its filters offer. */
export async function getExpertsPage(user: CurrentUser, filters: ExpertFilters): Promise<ExpertsPageData> {
  const view: ExpertKind = filters.view === "external" ? "external" : "internal";
  const [counts, units, base] = await Promise.all([
    expertCounts(user),
    loadUnits(),
    listExperts(user, { q: filters.q, view, limit: 400 }),
  ]);
  const experts = applyCardFilters(base, { ...filters, q: undefined, view });
  const unitById = new Map(units.map((u) => [u.id, u]));

  // facets come from the unfiltered view so a filter never empties its own select
  const unitCounts = new Map<string, number>();
  const orgCounts = new Map<string, { en: string; ar: string; count: number }>();
  const countryCounts = new Map<string, number>();
  for (const e of base) {
    if (e.unitId) unitCounts.set(e.unitId, (unitCounts.get(e.unitId) ?? 0) + 1);
    if (e.organisationEn) {
      const key = e.organisationEn.toLowerCase();
      const cur = orgCounts.get(key) ?? { en: e.organisationEn, ar: e.organisationAr ?? e.organisationEn, count: 0 };
      cur.count++;
      orgCounts.set(key, cur);
    }
    if (e.country) countryCounts.set(e.country, (countryCounts.get(e.country) ?? 0) + 1);
  }
  const facetUnits = units
    .filter((u) => unitCounts.has(u.id))
    .map((u) => {
      const path = unitPathFor(u.id, unitById);
      const sector = path.length > 1 ? path[0] : null;
      return {
        ...crumb(u),
        sectorNameEn: sector?.nameEn ?? null,
        sectorNameAr: sector?.nameAr ?? null,
        count: unitCounts.get(u.id) ?? 0,
      };
    });

  return {
    view,
    counts,
    experts,
    groups: view === "internal" ? groupByUnit(experts, units) : [],
    facets: {
      units: facetUnits,
      organisations: [...orgCounts.values()].sort((a, b) => a.en.localeCompare(b.en)),
      countries: [...countryCounts.entries()]
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
    },
  };
}

export async function getExpertProfile(user: CurrentUser, id: string) {
  const [expert] = await db.select().from(schema.experts).where(eq(schema.experts.id, id)).limit(1);
  if (!expert || expert.visibilityClassification > user.clearanceLevel) return null;
  const domains = await db
    .select({
      id: schema.expertDomains.id,
      code: schema.taxonomyTerms.code,
      nameEn: schema.taxonomyTerms.nameEn,
      nameAr: schema.taxonomyTerms.nameAr,
      level: schema.expertDomains.level,
      source: schema.expertDomains.source,
      accepted: schema.expertDomains.accepted,
    })
    .from(schema.expertDomains)
    .innerJoin(schema.taxonomyTerms, eq(schema.taxonomyTerms.id, schema.expertDomains.termId))
    .where(eq(schema.expertDomains.expertId, id));
  const endorsementCounts = await db
    .select({ termId: schema.endorsements.termId, c: sql<number>`count(*)` })
    .from(schema.endorsements)
    .where(eq(schema.endorsements.expertId, id))
    .groupBy(schema.endorsements.termId);
  const skills = await db.select().from(schema.expertSkills).where(eq(schema.expertSkills.expertId, id));
  const engagements = await db
    .select()
    .from(schema.expertEngagements)
    .where(eq(schema.expertEngagements.expertId, id))
    .orderBy(desc(schema.expertEngagements.year));
  const publications = await db
    .select()
    .from(schema.expertPublications)
    .where(eq(schema.expertPublications.expertId, id));

  // contributions in SiaNexus for employees
  let contributions: { documents: number; answers: number; lessons: number } | null = null;
  let badges: { code: string; nameEn: string; nameAr: string; family: string; tier: string | null }[] = [];
  if (expert.userId) {
    const [docs] = await db
      .select({ c: sql<number>`count(*)` })
      .from(schema.documents)
      .where(eq(schema.documents.ownerUserId, expert.userId));
    const [answers] = await db
      .select({ c: sql<number>`count(*)` })
      .from(schema.answers)
      .where(eq(schema.answers.authorId, expert.userId));
    const [lessons] = await db
      .select({ c: sql<number>`count(*)` })
      .from(schema.lessons)
      .where(eq(schema.lessons.authorId, expert.userId));
    contributions = { documents: docs?.c ?? 0, answers: answers?.c ?? 0, lessons: lessons?.c ?? 0 };
    badges = await db
      .select({
        code: schema.badges.code,
        nameEn: schema.badges.nameEn,
        nameAr: schema.badges.nameAr,
        family: schema.badges.family,
        tier: schema.badges.tier,
      })
      .from(schema.userBadges)
      .innerJoin(schema.badges, eq(schema.badges.id, schema.userBadges.badgeId))
      .where(eq(schema.userBadges.userId, expert.userId));
  }
  // CR08 3: the card facts (kind, unit path, project count, last engagement)
  const [card] = await buildCards([expert]);
  return { expert, card, domains, endorsementCounts, skills, engagements, publications, contributions, badges };
}

export function profileCompletion(expert: typeof schema.experts.$inferSelect, domainCount: number): number {
  const checks = [
    Boolean(expert.bioEn || expert.bioAr),
    Boolean(expert.positionEn || expert.positionAr),
    Boolean(expert.languagesJson && expert.languagesJson !== "[]"),
    Boolean(expert.educationJson && expert.educationJson !== "[]"),
    Boolean(expert.yearsExperience),
    domainCount >= 2,
    Boolean(expert.availability),
    Boolean(expert.phone || expert.email),
  ];
  return checks.filter(Boolean).length / checks.length;
}

export async function createExpertRequest(
  user: CurrentUser,
  input: { expertId: string; subject: string; detail?: string; questionId?: string }
): Promise<{ ok: boolean; error?: string }> {
  const [expert] = await db
    .select()
    .from(schema.experts)
    .where(eq(schema.experts.id, input.expertId))
    .limit(1);
  if (!expert) return { ok: false, error: "not_found" };
  await db.insert(schema.expertRequests).values({
    id: newId(),
    requesterId: user.id,
    expertId: input.expertId,
    questionId: input.questionId ?? null,
    subject: input.subject,
    detail: input.detail ?? null,
    status: "open",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  const notifyUserId = expert.userId ?? expert.ownerUserId;
  if (notifyUserId) {
    await notify(
      notifyUserId,
      "route",
      `Expert request: ${input.subject.slice(0, 60)}`,
      `طلب خبير: ${input.subject.slice(0, 60)}`,
      `/experts/${expert.id}`
    );
  }
  await audit(user.id, "create", "expert_request", input.expertId, { subject: input.subject });
  return { ok: true };
}

export async function createExternalExpert(
  user: CurrentUser,
  input: {
    nameEn: string;
    nameAr: string;
    type: string;
    organisationEn?: string;
    organisationAr?: string;
    positionEn?: string;
    positionAr?: string;
    bioEn?: string;
    bioAr?: string;
    email?: string;
    phone?: string;
    nationality?: string;
    country?: string;
    yearsExperience?: number;
    availability?: string;
    domainCodes?: string[];
  }
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!can(user, "create", "experts")) return { ok: false, error: "forbidden" };
  const id = newId();
  await db.insert(schema.experts).values({
    id,
    userId: null,
    type: input.type,
    nameEn: input.nameEn,
    nameAr: input.nameAr,
    avatarColor: "gulf",
    organisationEn: input.organisationEn ?? null,
    organisationAr: input.organisationAr ?? null,
    positionEn: input.positionEn ?? null,
    positionAr: input.positionAr ?? null,
    bioEn: input.bioEn ?? null,
    bioAr: input.bioAr ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    nationality: input.nationality ?? null,
    country: input.country ? input.country.toUpperCase().slice(0, 2) : null,
    yearsExperience: input.yearsExperience ?? null,
    availability: input.availability ?? "available",
    clearanceLevel: 1,
    ownerUserId: user.id,
    isVerified: 0,
    visibilityClassification: 2,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  if (input.domainCodes?.length) {
    const terms = await db
      .select({ id: schema.taxonomyTerms.id, code: schema.taxonomyTerms.code })
      .from(schema.taxonomyTerms)
      .where(inArray(schema.taxonomyTerms.code, input.domainCodes));
    for (const term of terms) {
      await db.insert(schema.expertDomains).values({
        id: newId(),
        expertId: id,
        termId: term.id,
        level: "expert",
        source: "self",
        accepted: 1,
      });
    }
  }
  await record({
    userId: user.id,
    type: "external_expert_added",
    resourceType: "expert",
    resourceId: id,
    meta: { departmentId: user.departmentId },
  });
  await audit(user.id, "create", "expert", id);
  await enqueue("embed_records", { resourceType: "expert", resourceId: id });
  return { ok: true, id };
}
