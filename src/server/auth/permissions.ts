// The single permission gate. Every route handler and server mutation goes through can().
import { parseJson, PermissionsMatrix, type Action, type Module } from "@/server/db/json";
import type { CurrentUser } from "./session";

export type Resource = {
  classificationLevel?: number | null;
  departmentId?: string | null;
  ownerUserId?: string | null;
  sharedToAll?: boolean;
};

export function hasPermission(user: CurrentUser, module: Module, action: Action): boolean {
  const matrix = parseJson(PermissionsMatrix, user.role.permissionsJson, {});
  return Boolean(matrix[module]?.[action]);
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
