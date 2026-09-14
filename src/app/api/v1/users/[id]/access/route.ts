import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, or } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser, getUserById } from "@/server/auth/session";
import {
  can,
  defaultPortalsForRole,
  hasPermission,
  visiblePortals,
} from "@/server/auth/permissions";
import { ACTIONS, MODULES, PORTALS, parseJson, PermissionsMatrix } from "@/server/db/json";
import { audit } from "@/server/auth/audit";
import { newId, nowIso } from "@/lib/ids";

/* CR05 6.2: the user Access tab: the effective permission matrix with the
   source of each cell (role, grant, deny), per-user overrides, and the
   override audit trail. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || !can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const target = await getUserById(id);
  if (!target) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });

  const roleMatrix = parseJson(PermissionsMatrix, target.role.permissionsJson, {});
  const overrides = target.overrides;
  const overrideOf = (key: string): "grant" | "deny" | null => {
    let effect: "grant" | "deny" | null = null;
    for (const o of overrides) {
      if (o.permissionKey !== key) continue;
      if (o.effect === "deny") return "deny";
      effect = "grant";
    }
    return effect;
  };
  const matrix = MODULES.map((module) => ({
    module,
    actions: ACTIONS.map((action) => {
      const o = overrideOf(`${module}:${action}`);
      return {
        action,
        effective: hasPermission(target, module, action),
        source: o ?? (roleMatrix[module]?.[action] ? "role" : "none"),
      };
    }),
  }));

  const rolePortals = (() => {
    try {
      const stored = JSON.parse(target.role.portalsJson ?? "null");
      return Array.isArray(stored) ? stored : defaultPortalsForRole(target.role.nameEn);
    } catch {
      return defaultPortalsForRole(target.role.nameEn);
    }
  })();
  const effectivePortals = visiblePortals(target);
  const portals = PORTALS.map((p) => ({
    portal: p,
    effective: effectivePortals.includes(p),
    source: (() => {
      const o = overrideOf(`portal:${p}`);
      if (o) return o;
      return rolePortals.includes(p) ? "role" : "none";
    })(),
  }));

  const trail = await db
    .select()
    .from(schema.auditLog)
    .where(
      and(
        or(
          eq(schema.auditLog.action, "override_set"),
          eq(schema.auditLog.action, "override_removed"),
          eq(schema.auditLog.action, "edit")
        ),
        eq(schema.auditLog.resourceType, "user"),
        eq(schema.auditLog.resourceId, id)
      )
    )
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(30);
  const allUsers = await db.select({ id: schema.users.id, nameEn: schema.users.nameEn }).from(schema.users);
  const nameOf = new Map(allUsers.map((u) => [u.id, u.nameEn]));

  return NextResponse.json({
    data: {
      user: {
        id: target.id,
        nameEn: target.nameEn,
        nameAr: target.nameAr,
        email: target.email,
        roleId: target.roleId,
        roleName: target.role.nameEn,
        clearanceLevel: target.clearanceLevel,
        departmentId: target.departmentId,
        departmentScope: target.departmentScope,
      },
      matrix,
      portals,
      overrides: overrides.map((o) => ({
        permissionKey: o.permissionKey,
        effect: o.effect,
        reason: o.reason,
        setBy: o.setBy ? nameOf.get(o.setBy) ?? o.setBy : null,
        setAt: o.setAt,
        expiresAt: o.expiresAt,
      })),
      audit: trail.map((a) => ({
        action: a.action,
        by: a.userId ? nameOf.get(a.userId) ?? a.userId : null,
        at: a.createdAt,
        meta: a.metaJson,
      })),
    },
    error: null,
  });
}

const OverrideBody = z.object({
  permissionKey: z.string().min(3).max(60),
  effect: z.enum(["grant", "deny"]).nullable(), // null clears the override
  reason: z.string().max(300).optional(),
  expiresAt: z.string().nullable().optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || !can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = OverrideBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const b = parsed.data;
  await db
    .delete(schema.userPermissionOverrides)
    .where(
      and(
        eq(schema.userPermissionOverrides.userId, id),
        eq(schema.userPermissionOverrides.permissionKey, b.permissionKey)
      )
    );
  if (b.effect) {
    await db.insert(schema.userPermissionOverrides).values({
      id: newId(),
      userId: id,
      permissionKey: b.permissionKey,
      effect: b.effect,
      reason: b.reason ?? null,
      setBy: user.id,
      setAt: nowIso(),
      expiresAt: b.expiresAt ?? null,
    });
  }
  await audit(user.id, b.effect ? "override_set" : "override_removed", "user", id, {
    permissionKey: b.permissionKey,
    effect: b.effect,
    reason: b.reason,
    expiresAt: b.expiresAt,
  });
  return NextResponse.json({ data: { ok: true }, error: null });
}
