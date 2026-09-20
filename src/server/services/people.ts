// CR08 9.1: the person card behind OwnerControl. Facts only: position, unit
// breadcrumb, accepted expertise, availability, the HR backup owner for the
// item in view, and the active delegate (9.3). Never a message (9.2).
import { cache } from "react";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { activeDelegateOf } from "./messaging";

export type PersonRef = {
  id: string;
  nameEn: string;
  nameAr: string;
  avatarColor: string;
  positionEn: string | null;
  positionAr: string | null;
};

export type UnitCrumb = { id: string; code: string; nameEn: string; nameAr: string; level: string };

export type PersonCard = PersonRef & {
  email: string;
  /** the person's own unit */
  unit: UnitCrumb | null;
  /** sector > department > section, the unit itself last (the top office is skipped) */
  breadcrumb: UnitCrumb[];
  /** accepted expert domains */
  expertise: { id: string; code: string; nameEn: string; nameAr: string }[];
  availability: "available" | "limited" | "unavailable" | null;
  expertId: string | null;
  /** CR05 5: the named HR backup for the item in view, or the person's usual backup */
  backupOwner: (PersonRef & { forItem: boolean }) | null;
  /** CR08 9.3: the delegate while the delegation is in force */
  delegate: (PersonRef & { from: string | null; to: string | null }) | null;
  links: { profile: string | null; unit: string | null; email: string };
};

/** ownership_backups resource types for the item kinds OwnerControl sees. */
export function backupResourceType(itemType: string): string[] {
  switch (itemType) {
    case "project":
    case "initiative":
    case "outcome":
    case "target":
    case "node":
      return ["node"];
    case "document":
    case "study":
    case "policy":
      return ["document"];
    case "indicator":
      return ["kpi", "indicator", "council_indicator"];
    case "council_node":
      return ["council_node", "node"];
    case "unit":
      return ["unit", "org_unit"];
    default:
      return [itemType];
  }
}

async function personRef(id: string): Promise<(PersonRef & { email: string; departmentId: string | null; deleted: boolean }) | null> {
  const [u] = await db
    .select({
      id: schema.users.id,
      nameEn: schema.users.nameEn,
      nameAr: schema.users.nameAr,
      avatarColor: schema.users.avatarColor,
      positionEn: schema.users.positionEn,
      positionAr: schema.users.positionAr,
      email: schema.users.email,
      departmentId: schema.users.departmentId,
      deletedAt: schema.users.deletedAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  if (!u) return null;
  return { ...u, deleted: Boolean(u.deletedAt) };
}

async function unitChain(unitId: string | null): Promise<UnitCrumb[]> {
  if (!unitId) return [];
  const units = await db
    .select({
      id: schema.orgUnits.id,
      code: schema.orgUnits.code,
      nameEn: schema.orgUnits.nameEn,
      nameAr: schema.orgUnits.nameAr,
      parentId: schema.orgUnits.parentId,
      level: schema.orgUnits.level,
    })
    .from(schema.orgUnits);
  const byId = new Map(units.map((u) => [u.id, u]));
  const chain: UnitCrumb[] = [];
  let cursor = byId.get(unitId);
  for (let i = 0; i < 8 && cursor; i++) {
    chain.unshift({ id: cursor.id, code: cursor.code, nameEn: cursor.nameEn, nameAr: cursor.nameAr, level: cursor.level });
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  // the Secretary General's office heads every chain; the card reads sector > department
  return chain.filter((c, i) => !(i === 0 && c.level === "secretary_general" && chain.length > 1));
}

/** The backup owner: the item's named backup when an item is in view, else
    the person most often named as backup across what this person owns. */
async function backupOwnerFor(
  userId: string,
  item: { type: string; id: string } | null
): Promise<(PersonRef & { forItem: boolean }) | null> {
  const backups = await db.select().from(schema.ownershipBackups);
  if (!backups.length) return null;
  let backupUserId: string | null = null;
  let forItem = false;
  if (item) {
    const types = backupResourceType(item.type);
    const hit = backups.find((b) => types.includes(b.resourceType) && b.resourceId === item.id);
    if (hit && hit.backupUserId !== userId) {
      backupUserId = hit.backupUserId;
      forItem = true;
    }
  }
  if (!backupUserId) {
    const [docs, nodes, kpis, council] = await Promise.all([
      db.select({ id: schema.documents.id }).from(schema.documents).where(and(eq(schema.documents.ownerUserId, userId), isNull(schema.documents.deletedAt))),
      db.select({ id: schema.strategyNodes.id }).from(schema.strategyNodes).where(eq(schema.strategyNodes.ownerUserId, userId)),
      db.select({ id: schema.kpis.id }).from(schema.kpis).where(eq(schema.kpis.ownerUserId, userId)),
      db.select({ id: schema.councilNodes.id }).from(schema.councilNodes).where(eq(schema.councilNodes.ownerUserId, userId)),
    ]);
    const owned = new Set<string>([
      ...docs.map((d) => `document:${d.id}`),
      ...nodes.map((n) => `node:${n.id}`),
      ...kpis.map((k) => `kpi:${k.id}`),
      ...council.map((c) => `council_node:${c.id}`),
    ]);
    const tally = new Map<string, number>();
    for (const b of backups) {
      if (b.backupUserId === userId) continue;
      if (!owned.has(`${b.resourceType}:${b.resourceId}`)) continue;
      tally.set(b.backupUserId, (tally.get(b.backupUserId) ?? 0) + 1);
    }
    const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    backupUserId = best?.[0] ?? null;
  }
  if (!backupUserId) return null;
  const p = await personRef(backupUserId);
  if (!p || p.deleted) return null;
  return { id: p.id, nameEn: p.nameEn, nameAr: p.nameAr, avatarColor: p.avatarColor, positionEn: p.positionEn, positionAr: p.positionAr, forItem };
}

async function buildPersonCard(
  user: CurrentUser,
  targetUserId: string,
  itemType: string | null,
  itemId: string | null
): Promise<PersonCard | null> {
  const p = await personRef(targetUserId);
  if (!p || p.deleted) return null;
  const item = itemType && itemId ? { type: itemType, id: itemId } : null;

  const [breadcrumb, expertRows, backupOwner, delegate] = await Promise.all([
    unitChain(p.departmentId),
    db
      .select({
        id: schema.experts.id,
        availability: schema.experts.availability,
        visibilityClassification: schema.experts.visibilityClassification,
      })
      .from(schema.experts)
      .where(eq(schema.experts.userId, targetUserId))
      .limit(1),
    backupOwnerFor(targetUserId, item),
    activeDelegateOf(targetUserId),
  ]);
  const expert = expertRows[0] ?? null;
  const expertVisible = expert ? expert.visibilityClassification <= user.clearanceLevel : false;

  let expertise: PersonCard["expertise"] = [];
  if (expert && expertVisible) {
    const domains = await db
      .select({ termId: schema.expertDomains.termId })
      .from(schema.expertDomains)
      .where(and(eq(schema.expertDomains.expertId, expert.id), eq(schema.expertDomains.accepted, 1)));
    const termIds = [...new Set(domains.map((d) => d.termId))];
    if (termIds.length) {
      expertise = await db
        .select({
          id: schema.taxonomyTerms.id,
          code: schema.taxonomyTerms.code,
          nameEn: schema.taxonomyTerms.nameEn,
          nameAr: schema.taxonomyTerms.nameAr,
        })
        .from(schema.taxonomyTerms)
        .where(inArray(schema.taxonomyTerms.id, termIds))
        .limit(8);
    }
  }
  const unit = breadcrumb.length ? breadcrumb[breadcrumb.length - 1] : null;
  const availability = expert
    ? (["available", "limited", "unavailable"].includes(expert.availability)
        ? (expert.availability as PersonCard["availability"])
        : "available")
    : null;
  return {
    id: p.id,
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    avatarColor: p.avatarColor,
    positionEn: p.positionEn,
    positionAr: p.positionAr,
    email: p.email,
    unit,
    breadcrumb,
    expertise,
    availability,
    expertId: expert && expertVisible ? expert.id : null,
    backupOwner,
    delegate: delegate
      ? { id: delegate.id, nameEn: delegate.nameEn, nameAr: delegate.nameAr, avatarColor: delegate.avatarColor, positionEn: null, positionAr: null, from: delegate.from, to: delegate.to }
      : null,
    links: {
      profile: expert && expertVisible ? `/experts/${expert.id}` : null,
      unit: unit ? `/organisation?unit=${encodeURIComponent(unit.code)}` : null,
      email: `mailto:${p.email}`,
    },
  };
}

/** The shape OwnerControl takes as its `owner` prop. */
export type OwnerRefData = PersonRef & { unitEn: string | null; unitAr: string | null; email: string };

/** Bulk `userId -> OwnerRef` loader for the pages that only hold an owner id
    (documents, strategy nodes, reports, search results, citations). Unknown
    or deleted ids are simply absent from the result. */
export async function getOwnerRefs(userIds: (string | null | undefined)[]): Promise<Record<string, OwnerRefData>> {
  const ids = [...new Set(userIds.filter((x): x is string => Boolean(x)))];
  if (!ids.length) return {};
  const rows = await db
    .select({
      id: schema.users.id,
      nameEn: schema.users.nameEn,
      nameAr: schema.users.nameAr,
      avatarColor: schema.users.avatarColor,
      positionEn: schema.users.positionEn,
      positionAr: schema.users.positionAr,
      email: schema.users.email,
      unitEn: schema.orgUnits.nameEn,
      unitAr: schema.orgUnits.nameAr,
    })
    .from(schema.users)
    .leftJoin(schema.orgUnits, eq(schema.orgUnits.id, schema.users.departmentId))
    .where(and(inArray(schema.users.id, ids), isNull(schema.users.deletedAt)));
  const out: Record<string, OwnerRefData> = {};
  for (const r of rows) out[r.id] = r;
  return out;
}

/** Per-request cached (React cache): one card per person and item per render. */
export const getPersonCard = cache(
  (user: CurrentUser, targetUserId: string, item?: { type: string; id: string } | null) =>
    buildPersonCard(user, targetUserId, item?.type ?? null, item?.id ?? null)
);
