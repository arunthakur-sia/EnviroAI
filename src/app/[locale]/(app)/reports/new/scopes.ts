// CR08 5.4: the scopes a requester may pick in the builder, composed from the
// existing strategy and organisation services with the same rules the
// reports service enforces on the request: outcomes are open to everyone
// with the portal; a unit must be the requester's own; a project or
// initiative must be owned by them, led by their department or carry them as
// a stakeholder; the Super Admin sees everything. Server only.
import "server-only";
import type { CurrentUser } from "@/server/auth/session";
import { getEditionNodes, getEditions, loadLeadsFor, loadStakeholdersFor, type NodeLite } from "@/server/services/strategy";
import { getOrgLevels, getOrgTree } from "@/server/services/organisation";
import { isSuperAdmin } from "@/server/services/reports";

export type ScopeOption = {
  id: string;
  code: string | null;
  nameEn: string;
  nameAr: string;
  /** project or initiative; the unit level code for a department */
  subKind: string | null;
  /** the outcome (or top ancestor) a project belongs to, or a unit's level name */
  contextEn: string | null;
  contextAr: string | null;
};

export type AllowedScopes = {
  outcomes: ScopeOption[];
  departments: ScopeOption[];
  projects: ScopeOption[];
  ownUnitId: string | null;
  isSuperAdmin: boolean;
};

export async function loadAllowedScopes(user: CurrentUser): Promise<AllowedScopes> {
  const admin = isSuperAdmin(user);
  const editions = await getEditions();
  const edition = editions.find((e) => e.isDefault === 1) ?? editions[0] ?? null;
  const nodes: NodeLite[] = edition ? await getEditionNodes(edition.id) : [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const topOf = (n: NodeLite): NodeLite => {
    let cur = n;
    for (let i = 0; i < 10 && cur.parentId; i++) {
      const p = byId.get(cur.parentId);
      if (!p) break;
      cur = p;
    }
    return cur;
  };

  const outcomes: ScopeOption[] = nodes
    .filter((n) => n.nodeType === "outcome")
    .map((n) => ({ id: n.id, code: n.code, nameEn: n.titleEn, nameAr: n.titleAr, subKind: null, contextEn: null, contextAr: null }));

  const projectNodes = nodes.filter((n) => n.nodeType === "project" || n.nodeType === "initiative");
  let allowed = projectNodes;
  if (!admin) {
    const ids = projectNodes.map((n) => n.id);
    const [leads, stakeholders] = await Promise.all([loadLeadsFor(ids), loadStakeholdersFor(ids)]);
    allowed = projectNodes.filter(
      (n) =>
        n.ownerUserId === user.id ||
        (user.departmentId ? (leads.get(n.id) ?? []).some((c) => c.kind === "department" && c.id === user.departmentId) : false) ||
        (stakeholders.get(n.id) ?? []).some((s) => s.userId === user.id)
    );
  }
  const projects: ScopeOption[] = allowed.map((n) => {
    const top = topOf(n);
    const hasContext = top.id !== n.id;
    return {
      id: n.id,
      code: n.code,
      nameEn: n.titleEn,
      nameAr: n.titleAr,
      subKind: n.nodeType,
      contextEn: hasContext ? `${top.code ?? ""} ${top.titleEn}`.trim() : null,
      contextAr: hasContext ? `${top.code ?? ""} ${top.titleAr}`.trim() : null,
    };
  });

  const [tree, levels] = await Promise.all([getOrgTree(user), getOrgLevels()]);
  const levelName = new Map(levels.map((l) => [l.code, l]));
  const units = tree.units.filter((u) => u.isActive && (admin || u.id === user.departmentId));
  const departments: ScopeOption[] = units.map((u) => ({
    id: u.id,
    code: u.code,
    nameEn: u.nameEn,
    nameAr: u.nameAr,
    subKind: u.level,
    contextEn: levelName.get(u.level)?.nameEn ?? null,
    contextAr: levelName.get(u.level)?.nameAr ?? null,
  }));

  return { outcomes, departments, projects, ownUnitId: user.departmentId ?? null, isSuperAdmin: admin };
}
