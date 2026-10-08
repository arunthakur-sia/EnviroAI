// CR08 10.1: the unit-facing helpers of the process architecture. The
// Organisation unit panel loads "Processes this unit owns" through
// getUnitProcesses (a thin wrapper over getProcessMap's byUnit), and the
// /processes page loads the heads of the owner units for the OwnerControl
// block plus the active units for its pickers. The read models themselves
// live in operating-model.ts; nothing here writes.
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { getProcessMap, type ProcessSummary, type UnitRef } from "@/server/services/operating-model";

/** The person behind a unit head, in the shape OwnerControl takes. */
export type UnitHeadAccount = {
  id: string;
  nameEn: string;
  nameAr: string;
  avatarColor: string;
  positionEn: string | null;
  positionAr: string | null;
  unitEn: string | null;
  unitAr: string | null;
};

export type UnitHeadRef = {
  unitId: string;
  /** the head who holds a EnviroAI account (org_units.head_user_id or a head member row) */
  account: UnitHeadAccount | null;
  /** the head as published on enviroai.demo when they hold no account */
  publishedNameEn: string | null;
  publishedNameAr: string | null;
  publishedTitleEn: string | null;
  publishedTitleAr: string | null;
};

/** The processes one unit owns, in chain order, with the reader's visibility applied. */
export async function getUnitProcesses(user: CurrentUser, unitId: string): Promise<ProcessSummary[]> {
  const map = await getProcessMap(user);
  return map.byUnit.find((u) => u.unit.id === unitId)?.processes ?? [];
}

/** The heads of the given units, keyed by unit id. */
export async function getUnitHeads(unitIds: string[]): Promise<Record<string, UnitHeadRef>> {
  const wanted = [...new Set(unitIds.filter(Boolean))];
  if (!wanted.length) return {};
  const units = await db.select().from(schema.orgUnits).where(inArray(schema.orgUnits.id, wanted));
  const headRows = await db
    .select({ unitId: schema.orgUnitMembers.unitId, userId: schema.orgUnitMembers.userId })
    .from(schema.orgUnitMembers)
    .where(and(inArray(schema.orgUnitMembers.unitId, wanted), eq(schema.orgUnitMembers.roleInUnit, "head")));
  const memberHead = new Map<string, string>();
  for (const r of headRows) if (!memberHead.has(r.unitId)) memberHead.set(r.unitId, r.userId);

  const userIds = [...new Set(units.map((u) => u.headUserId ?? memberHead.get(u.id)).filter(Boolean) as string[])];
  const people = userIds.length
    ? await db
        .select({
          id: schema.users.id,
          nameEn: schema.users.nameEn,
          nameAr: schema.users.nameAr,
          avatarColor: schema.users.avatarColor,
          positionEn: schema.users.positionEn,
          positionAr: schema.users.positionAr,
        })
        .from(schema.users)
        .where(and(inArray(schema.users.id, userIds), isNull(schema.users.deletedAt)))
    : [];
  const personById = new Map(people.map((p) => [p.id, p]));

  const out: Record<string, UnitHeadRef> = {};
  for (const u of units) {
    const headId = u.headUserId ?? memberHead.get(u.id) ?? null;
    const person = headId ? personById.get(headId) : undefined;
    out[u.id] = {
      unitId: u.id,
      account: person
        ? {
            id: person.id,
            nameEn: person.nameEn,
            nameAr: person.nameAr,
            avatarColor: person.avatarColor,
            positionEn: person.positionEn,
            positionAr: person.positionAr,
            unitEn: u.nameEn,
            unitAr: u.nameAr,
          }
        : null,
      publishedNameEn: u.headNameEn,
      publishedNameAr: u.headNameAr,
      publishedTitleEn: u.headTitleEn,
      publishedTitleAr: u.headTitleAr,
    };
  }
  return out;
}

/** Every active unit in org order, for the owner, step and RACI pickers. */
export async function listPickerUnits(): Promise<UnitRef[]> {
  const rows = await db
    .select({
      id: schema.orgUnits.id,
      code: schema.orgUnits.code,
      nameEn: schema.orgUnits.nameEn,
      nameAr: schema.orgUnits.nameAr,
      level: schema.orgUnits.level,
      isActive: schema.orgUnits.isActive,
    })
    .from(schema.orgUnits)
    .orderBy(asc(schema.orgUnits.sort));
  return rows.filter((r) => r.isActive === 1).map(({ id, code, nameEn, nameAr, level }) => ({ id, code, nameEn, nameAr, level }));
}
