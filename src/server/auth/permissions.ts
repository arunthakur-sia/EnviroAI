// The single permission gate. Every route handler and server mutation goes
// through can(). CR05 6.2: effective permissions = role permissions + per-user
// grants - denies, all evaluated here (no parallel checks).
import {
  parseJson,
  PermissionsMatrix,
  PORTALS,
  type Action,
  type Module,
  type Portal,
} from "@/server/db/json";
import type { CurrentUser } from "./session";

export type Resource = {
  classificationLevel?: number | null;
  departmentId?: string | null;
  ownerUserId?: string | null;
  sharedToAll?: boolean;
};

/** CR05 6.2: a user's overrides for one permission key: grant wins over the
    role, deny wins over everything. */
function overrideFor(user: CurrentUser, key: string): "grant" | "deny" | null {
  let effect: "grant" | "deny" | null = null;
  for (const o of user.overrides ?? []) {
    if (o.permissionKey !== key) continue;
    if (o.effect === "deny") return "deny";
    effect = "grant";
  }
  return effect;
}

export function hasPermission(user: CurrentUser, module: Module, action: Action): boolean {
  const o = overrideFor(user, `${module}:${action}`);
  if (o === "deny") return false;
  if (o === "grant") return true;
  const matrix = parseJson(PermissionsMatrix, user.role.permissionsJson, {});
  return Boolean(matrix[module]?.[action]);
}

/* ------------------------------------------------------------------ */
/* CR05 6.1: portal visibility                                          */
/* ------------------------------------------------------------------ */

/** The role's default portal set when none is stored. */
export function defaultPortalsForRole(roleNameEn: string): Portal[] {
  const base = PORTALS.filter((p) => p !== "hr" && p !== "settings");
  switch (roleNameEn) {
    case "Super Admin":
    case "HR Admin":
      return [...PORTALS];
    case "Knowledge Admin":
      return [...base, "settings"];
    case "Department Head":
      return [...base, "hr"];
    default:
      return [...base];
  }
}

/** Effective portals: the role set plus per-user grants minus denies. */
export function visiblePortals(user: CurrentUser): Portal[] {
  let set: Portal[];
  try {
    const stored = JSON.parse(user.role.portalsJson ?? "null");
    set = Array.isArray(stored)
      ? (stored.filter((p: string) => (PORTALS as readonly string[]).includes(p)) as Portal[])
      : defaultPortalsForRole(user.role.nameEn);
  } catch {
    set = defaultPortalsForRole(user.role.nameEn);
  }
  const result = new Set(set);
  for (const o of user.overrides ?? []) {
    if (!o.permissionKey.startsWith("portal:")) continue;
    const portal = o.permissionKey.slice(7) as Portal;
    if (!(PORTALS as readonly string[]).includes(portal)) continue;
    if (o.effect === "grant") result.add(portal);
    else result.delete(portal);
  }
  return PORTALS.filter((p) => result.has(p));
}

export function canSeePortal(user: CurrentUser | null, portal: Portal): boolean {
  if (!user) return false;
  return visiblePortals(user).includes(portal);
}

/** Resource types that must vanish from search and Ask sources when their
    portal is hidden (CR05 6.1). */
const PORTAL_OF_RESOURCE: Record<string, Portal> = {
  document: "vault",
  indicator: "statistics",
  node: "strategy",
  expert: "experts",
  question: "ask",
  answer: "ask",
  lesson: "lessons",
  lesson_theme: "lessons",
  signal: "trends",
  podcast_episode: "podcast",
  index: "indices",
  index_forecast: "indices",
};

export function hiddenResourceTypes(user: CurrentUser): Set<string> {
  const visible = new Set(visiblePortals(user));
  const hidden = new Set<string>();
  for (const [type, portal] of Object.entries(PORTAL_OF_RESOURCE)) {
    if (!visible.has(portal)) hidden.add(type);
  }
  return hidden;
}

/** Clearance and department gate for reading a specific item. */
export function canReadResource(user: CurrentUser, resource: Resource): boolean {
  const classification = resource.classificationLevel ?? 1;
  if (classification > user.clearanceLevel) return false;
  if (user.departmentScope === "all") return true;
  if (!resource.departmentId) return true; // items without a department are shared
  if (resource.sharedToAll) return true;
  return resource.departmentId === user.departmentId;
}

/**
 * can(user, action, module, resource?)
 * - read: module read permission plus clearance/department gate when a resource is given
 * - edit_own resolves to edit_any when the user holds it
 * - verify/delete/manage: matrix, with department scoping applied to the resource
 */
export function can(
  user: CurrentUser | null,
  action: Action,
  module: Module,
  resource?: Resource
): boolean {
  if (!user) return false;
  if (action === "read") {
    if (!hasPermission(user, module, "read")) return false;
    return resource ? canReadResource(user, resource) : true;
  }
  if (action === "edit_own") {
    if (hasPermission(user, module, "edit_any")) {
      return resource ? canReadResource(user, resource) : true;
    }
    if (!hasPermission(user, module, "edit_own")) return false;
    if (resource?.ownerUserId && resource.ownerUserId !== user.id) return false;
    return resource ? canReadResource(user, resource) : true;
  }
  if (!hasPermission(user, module, action)) return false;
  if (resource) {
    // Department-scoped roles act only inside their department.
    if (
      user.departmentScope !== "all" &&
      resource.departmentId &&
      resource.departmentId !== user.departmentId
    ) {
      return false;
    }
    if (action !== "manage" && !canReadResource(user, resource)) return false;
  }
  return true;
}

/** SQL-side clearance ceiling for list queries. */
export function clearanceCeiling(user: CurrentUser | null): number {
  return user?.clearanceLevel ?? 1;
}
