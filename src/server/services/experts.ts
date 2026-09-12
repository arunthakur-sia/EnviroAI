import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { newId, nowIso } from "@/lib/ids";
import { record, notify } from "@/server/gamification/engine";
import { audit } from "@/server/auth/audit";
import { enqueue } from "@/server/jobs/queue";
import { retrieveRecords } from "@/server/search/hybrid";

export type ExpertCardData = {
  id: string;
  nameEn: string;
  nameAr: string;
  type: string;
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
};

export async function listExperts(
  user: CurrentUser,
  filters: {
    q?: string;
    type?: string;
    domain?: string;
    availability?: string;
    department?: string;
  }
): Promise<ExpertCardData[]> {
  // natural-language query runs semantic matching first
  let semanticOrder: string[] | null = null;
  if (filters.q && filters.q.trim().split(/\s+/).length >= 2) {
    const hits = await retrieveRecords(
      filters.q,
      { maxClassification: user.clearanceLevel, resourceTypes: ["expert"] },
      30
    );
    semanticOrder = hits.map((h) => h.resourceId);
  }

  const conds = [sql`${schema.experts.visibilityClassification} <= ${user.clearanceLevel}`];
  if (filters.type) conds.push(eq(schema.experts.type, filters.type));
  if (filters.availability) conds.push(eq(schema.experts.availability, filters.availability));
  if (filters.q && !semanticOrder) {
    const pat = `%${filters.q}%`;
    conds.push(
      or(
        like(schema.experts.nameEn, pat),
        like(schema.experts.nameAr, pat),
        like(schema.experts.organisationEn, pat),
        like(schema.experts.bioEn, pat)
      )!
    );
  }
  let rows = await db
    .select()
    .from(schema.experts)
    .where(and(...conds))
    .limit(120);

  if (semanticOrder) {
    const rank = new Map(semanticOrder.map((id, i) => [id, i]));
    rows = rows
      .filter((r) => rank.has(r.id))
      .sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));
  }

  const ids = rows.map((r) => r.id);
  const domains = ids.length
    ? await db
        .select({
          expertId: schema.expertDomains.expertId,
          code: schema.taxonomyTerms.code,
          nameEn: schema.taxonomyTerms.nameEn,
          nameAr: schema.taxonomyTerms.nameAr,
          accepted: schema.expertDomains.accepted,
        })
        .from(schema.expertDomains)
        .innerJoin(schema.taxonomyTerms, eq(schema.taxonomyTerms.id, schema.expertDomains.termId))
        .where(inArray(schema.expertDomains.expertId, ids))
    : [];
  const engagements = ids.length
    ? await db
        .select({
          expertId: schema.expertEngagements.expertId,
          c: sql<number>`count(*)`,
        })
        .from(schema.expertEngagements)
        .where(inArray(schema.expertEngagements.expertId, ids))
        .groupBy(schema.expertEngagements.expertId)
    : [];
  const endorsements = ids.length
    ? await db
        .select({ expertId: schema.endorsements.expertId, c: sql<number>`count(*)` })
        .from(schema.endorsements)
        .where(inArray(schema.endorsements.expertId, ids))
        .groupBy(schema.endorsements.expertId)
    : [];
  const engMap = new Map(engagements.map((e) => [e.expertId, e.c]));
  const endMap = new Map(endorsements.map((e) => [e.expertId, e.c]));

  let result = rows.map((r) => ({
    id: r.id,
    nameEn: r.nameEn,
    nameAr: r.nameAr,
    type: r.type,
    avatarColor: r.avatarColor,
    organisationEn: r.organisationEn,
    organisationAr: r.organisationAr,
    positionEn: r.positionEn,
    positionAr: r.positionAr,
    availability: r.availability,
    isVerified: r.isVerified === 1,
    engagementCount: engMap.get(r.id) ?? 0,
    endorsementCount: endMap.get(r.id) ?? 0,
    domains: domains
      .filter((d) => d.expertId === r.id && d.accepted === 1)
      .slice(0, 4)
      .map((d) => ({ code: d.code, nameEn: d.nameEn, nameAr: d.nameAr })),
  }));
  if (filters.domain) {
    result = result.filter((r) => r.domains.some((d) => d.code === filters.domain));
  }
  return result;
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
  return { expert, domains, endorsementCounts, skills, engagements, publications, contributions, badges };
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
