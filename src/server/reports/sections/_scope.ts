// CR08 5.3: what "the scope" means for the loaders. One resolution per
// build (memoised on the request): the default NDS3 edition and its nodes,
// the outcome or project the request names, the organisational unit for a
// department report, and the set of node ids that fall inside the scope.
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import {
  getEditions,
  getNavigator,
  loadLeadsFor,
  type NavigatorData,
  type NodeLite,
} from "@/server/services/strategy";
import type { BiText, ScopeKind, SectionContext } from "../spec";
import { bi } from "../spec";
import { memo } from "./_shared";

export type OrgUnitRow = typeof schema.orgUnits.$inferSelect;

export type ResolvedScope = {
  kind: ScopeKind;
  edition: { id: string; code: string; nameEn: string; nameAr: string } | null;
  nodes: NodeLite[];
  byId: Map<string, NodeLite>;
  childrenOf: Map<string, NodeLite[]>;
  /** the outcome of an outcome report, or the outcome above a project */
  outcome: NodeLite | null;
  /** the project (or initiative) of a project report */
  project: NodeLite | null;
  /** the unit of a department report */
  unit: OrgUnitRow | null;
  /** node ids inside the scope; every node of the edition for npc and period */
  scopeNodeIds: Set<string>;
  /** true when the scope named something that does not exist */
  missing: boolean;
  label: BiText;
};

export function descendantsOf(id: string, childrenOf: Map<string, NodeLite[]>): NodeLite[] {
  const out: NodeLite[] = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const c of childrenOf.get(cur) ?? []) {
      out.push(c);
      stack.push(c.id);
    }
  }
  return out;
}

export function ancestorOfType(
  node: NodeLite | null,
  byId: Map<string, NodeLite>,
  type: string
): NodeLite | null {
  let cursor = node;
  for (let i = 0; i < 8 && cursor; i++) {
    if (cursor.nodeType === type) return cursor;
    cursor = cursor.parentId ? byId.get(cursor.parentId) ?? null : null;
  }
  return null;
}

async function defaultEdition() {
  const editions = await getEditions();
  return editions.find((e) => e.isDefault === 1) ?? editions[0] ?? null;
}

export function resolveScope(ctx: SectionContext): Promise<ResolvedScope> {
  return memo(ctx, "scope", async () => {
    const scope = ctx.request.scope;
    const edition = await defaultEdition();
    const nodes = edition
      ? await db.select().from(schema.strategyNodes).where(eq(schema.strategyNodes.editionId, edition.id))
      : [];
    nodes.sort((a, b) => a.sort - b.sort);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const childrenOf = new Map<string, NodeLite[]>();
    for (const n of nodes) {
      if (!n.parentId) continue;
      (childrenOf.get(n.parentId) ?? childrenOf.set(n.parentId, []).get(n.parentId)!).push(n);
    }
    const all = new Set(nodes.map((n) => n.id));
    const base: ResolvedScope = {
      kind: scope.kind,
      edition: edition ? { id: edition.id, code: edition.code, nameEn: edition.nameEn, nameAr: edition.nameAr } : null,
      nodes,
      byId,
      childrenOf,
      outcome: null,
      project: null,
      unit: null,
      scopeNodeIds: all,
      missing: false,
      label: scope.label,
    };

    const findNode = (): NodeLite | null => {
      if (scope.id && byId.has(scope.id)) return byId.get(scope.id)!;
      const code = (scope.code ?? scope.id ?? "").toLowerCase();
      if (!code) return null;
      return nodes.find((n) => (n.code ?? "").toLowerCase() === code) ?? null;
    };

    if (scope.kind === "outcome") {
      const node = findNode();
      const outcome = node ? ancestorOfType(node, byId, "outcome") ?? node : null;
      if (!outcome) return { ...base, missing: true, scopeNodeIds: new Set() };
      const ids = new Set([outcome.id, ...descendantsOf(outcome.id, childrenOf).map((n) => n.id)]);
      return { ...base, outcome, scopeNodeIds: ids, label: bi(`${outcome.code ?? ""} ${outcome.titleEn}`.trim(), `${outcome.code ?? ""} ${outcome.titleAr}`.trim()) };
    }
    if (scope.kind === "project") {
      const project = findNode();
      if (!project) return { ...base, missing: true, scopeNodeIds: new Set() };
      const outcome = ancestorOfType(project, byId, "outcome");
      const ids = new Set([project.id, ...descendantsOf(project.id, childrenOf).map((n) => n.id)]);
      return { ...base, project, outcome, scopeNodeIds: ids, label: bi(`${project.code ?? ""} ${project.titleEn}`.trim(), `${project.code ?? ""} ${project.titleAr}`.trim()) };
    }
    if (scope.kind === "department") {
      const units = await db.select().from(schema.orgUnits);
      const unit =
        units.find((u) => u.id === scope.id) ??
        units.find((u) => u.code.toLowerCase() === (scope.code ?? scope.id ?? "").toLowerCase()) ??
        null;
      if (!unit) return { ...base, missing: true, scopeNodeIds: new Set() };
      // nodes the unit leads, plus nodes where its people hold sponsor,
      // owner or manager roles, each with its subtree
      const leads = await db
        .select()
        .from(schema.nodeLeads)
        .where(eq(schema.nodeLeads.departmentId, unit.id));
      const people = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.departmentId, unit.id));
      const roles = people.length
        ? await db
            .select()
            .from(schema.nodeStakeholders)
            .where(inArray(schema.nodeStakeholders.userId, people.map((p) => p.id)))
        : [];
      const roots = new Set<string>([
        ...leads.map((l) => l.nodeId),
        ...roles.filter((r) => ["sponsor", "owner", "manager"].includes(r.role)).map((r) => r.nodeId),
      ]);
      const ids = new Set<string>();
      for (const id of roots) {
        if (!byId.has(id)) continue;
        ids.add(id);
        for (const d of descendantsOf(id, childrenOf)) ids.add(d.id);
      }
      return { ...base, unit, scopeNodeIds: ids, label: bi(unit.nameEn, unit.nameAr) };
    }
    return base;
  });
}

/** The navigator of the default edition, once per build. */
export function navigator(ctx: SectionContext): Promise<NavigatorData | null> {
  return memo(ctx, "navigator", async () => {
    const edition = await defaultEdition();
    if (!edition) return null;
    return getNavigator(edition.id);
  });
}

/** Lead chips for a set of nodes, once per build per set key. */
export function leadsFor(ctx: SectionContext, nodeIds: string[]) {
  const key = `leads:${nodeIds.slice().sort().join(",").slice(0, 400)}:${nodeIds.length}`;
  return memo(ctx, key, () => loadLeadsFor(nodeIds));
}

/** The report type row, for the cover and the foreword. */
export function reportType(ctx: SectionContext) {
  return memo(ctx, "type", async () => {
    const [row] = await db
      .select()
      .from(schema.reportTypes)
      .where(eq(schema.reportTypes.code, ctx.request.typeCode))
      .limit(1);
    return row ?? null;
  });
}

export const leadNames = (chips: { role: string; nameEn: string; nameAr: string }[] | undefined): BiText => {
  const leads = (chips ?? []).filter((c) => c.role === "lead");
  if (!leads.length) return bi("unassigned", "غير محدد");
  return bi(leads.map((c) => c.nameEn).join(", "), leads.map((c) => c.nameAr).join("، "));
};
