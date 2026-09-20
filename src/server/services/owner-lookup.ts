// CR08 9.1: the owner behind an item for the surfaces that hold only an id.
// Search results, Ask citations, the Statistics Hub indicators and the
// international indices that mirror a national series all know what an item is
// and never who stands behind it. This resolves both in one bulk pass through
// getOwnerRefs, with the same fallbacks the Ask NPC owner tool uses
// (src/server/ai/analyst/cr08/messaging.ts): a document is held by its
// custodian, a strategy node by its owner (a project or an initiative by its
// project owner), a lesson by its author, an indicator by the head of its own
// department. Nothing is invented: an item with no person recorded is simply
// absent from the result, and the caller renders nothing.
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getOwnerRefs, type OwnerRefData } from "./people";

/** The roles this lookup can return; a subset of OwnerControl's OwnerRole. */
export type OwnerChipRole = "owner" | "department_owner" | "project_owner" | "author" | "custodian";

/** An owner in the shape OwnerControl takes, with the role it plays here. */
export type OwnerChip = OwnerRefData & { role: OwnerChipRole };

/** The kinds of item this lookup understands. */
export type OwnerItemType = "document" | "node" | "lesson" | "indicator";

export type OwnerItemRef = { type: string; id: string };

export function ownerKey(type: string, id: string): string {
  return `${type}:${id}`;
}

/** The owners of the given items, keyed `type:id`. Items without a person are absent. */
export async function resolveOwners(items: OwnerItemRef[]): Promise<Record<string, OwnerChip>> {
  const byType = new Map<string, Set<string>>();
  for (const item of items) {
    if (!item?.id) continue;
    (byType.get(item.type) ?? byType.set(item.type, new Set()).get(item.type)!).add(item.id);
  }
  const ids = (type: OwnerItemType) => [...(byType.get(type) ?? [])];
  const documentIds = ids("document");
  const nodeIds = ids("node");
  const lessonIds = ids("lesson");
  const indicatorIds = ids("indicator");
  if (!documentIds.length && !nodeIds.length && !lessonIds.length && !indicatorIds.length) return {};

  const [documents, nodes, lessons, indicators] = await Promise.all([
    documentIds.length
      ? db
          .select({ id: schema.documents.id, ownerUserId: schema.documents.ownerUserId })
          .from(schema.documents)
          .where(inArray(schema.documents.id, documentIds))
      : Promise.resolve([]),
    nodeIds.length
      ? db
          .select({ id: schema.strategyNodes.id, ownerUserId: schema.strategyNodes.ownerUserId, nodeType: schema.strategyNodes.nodeType })
          .from(schema.strategyNodes)
          .where(inArray(schema.strategyNodes.id, nodeIds))
      : Promise.resolve([]),
    lessonIds.length
      ? db
          .select({ id: schema.lessons.id, authorId: schema.lessons.authorId })
          .from(schema.lessons)
          .where(inArray(schema.lessons.id, lessonIds))
      : Promise.resolve([]),
    indicatorIds.length
      ? db
          .select({ id: schema.indicators.id, departmentId: schema.indicators.departmentId })
          .from(schema.indicators)
          .where(inArray(schema.indicators.id, indicatorIds))
      : Promise.resolve([]),
  ]);

  /* the indicator's department head, the fallback the owner tool uses */
  const departmentIds = [...new Set(indicators.map((i) => i.departmentId).filter((x): x is string => Boolean(x)))];
  const units = departmentIds.length
    ? await db
        .select({ id: schema.orgUnits.id, headUserId: schema.orgUnits.headUserId })
        .from(schema.orgUnits)
        .where(inArray(schema.orgUnits.id, departmentIds))
    : [];
  const headOfUnit = new Map(units.map((u) => [u.id, u.headUserId]));

  const wanted: { key: string; userId: string; role: OwnerChipRole }[] = [];
  for (const d of documents) {
    if (d.ownerUserId) wanted.push({ key: ownerKey("document", d.id), userId: d.ownerUserId, role: "custodian" });
  }
  for (const n of nodes) {
    if (!n.ownerUserId) continue;
    const role: OwnerChipRole = n.nodeType === "project" || n.nodeType === "initiative" ? "project_owner" : "owner";
    wanted.push({ key: ownerKey("node", n.id), userId: n.ownerUserId, role });
  }
  for (const l of lessons) {
    if (l.authorId) wanted.push({ key: ownerKey("lesson", l.id), userId: l.authorId, role: "author" });
  }
  for (const i of indicators) {
    const head = i.departmentId ? headOfUnit.get(i.departmentId) ?? null : null;
    if (head) wanted.push({ key: ownerKey("indicator", i.id), userId: head, role: "department_owner" });
  }
  if (!wanted.length) return {};

  const refs = await getOwnerRefs(wanted.map((w) => w.userId));
  const out: Record<string, OwnerChip> = {};
  for (const w of wanted) {
    const ref = refs[w.userId];
    if (ref) out[w.key] = { ...ref, role: w.role };
  }
  return out;
}

/** One item's owner, for a page that holds a single item. */
export async function resolveOwner(type: OwnerItemType, id: string): Promise<OwnerChip | null> {
  const map = await resolveOwners([{ type, id }]);
  return map[ownerKey(type, id)] ?? null;
}

/** The head of one organisation unit, in the shape OwnerControl takes. */
export async function resolveUnitHead(unitId: string | null | undefined): Promise<OwnerRefData | null> {
  if (!unitId) return null;
  const [unit] = await db
    .select({ headUserId: schema.orgUnits.headUserId })
    .from(schema.orgUnits)
    .where(eq(schema.orgUnits.id, unitId))
    .limit(1);
  if (!unit?.headUserId) return null;
  const refs = await getOwnerRefs([unit.headUserId]);
  return refs[unit.headUserId] ?? null;
}
