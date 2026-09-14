import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { newId, nowIso } from "@/lib/ids";
import { audit } from "@/server/auth/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const roles = await db
    .select({
      id: schema.roles.id,
      nameEn: schema.roles.nameEn,
      nameAr: schema.roles.nameAr,
      permissionsJson: schema.roles.permissionsJson,
      portalsJson: schema.roles.portalsJson,
      defaultClearance: schema.roles.defaultClearance,
      defaultDepartmentScope: schema.roles.defaultDepartmentScope,
      isSystem: schema.roles.isSystem,
      memberCount: sql<number>`(select count(*) from users u where u.role_id = ${schema.roles.id})`,
    })
    .from(schema.roles);
  return NextResponse.json({ data: roles, error: null });
}

const Body = z.object({
  id: z.string().optional(),
  nameEn: z.string().min(2),
  nameAr: z.string().min(2),
  permissions: z.record(z.string(), z.record(z.string(), z.boolean())),
  defaultClearance: z.number().min(1).max(4).default(2),
  defaultDepartmentScope: z.enum(["all", "own"]).default("all"),
  /* CR05 6.1: the role's portal visibility set */
  portals: z.array(z.string()).optional(),
});

/* portal-only update from the roles table checkboxes */
const PortalsBody = z.object({
  id: z.string().min(1),
  portals: z.array(z.string()).min(0).max(20),
});

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = PortalsBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  await db
    .update(schema.roles)
    .set({ portalsJson: JSON.stringify(parsed.data.portals), updatedAt: nowIso() })
    .where(eq(schema.roles.id, parsed.data.id));
  await audit(user.id, "role_portals_set", "role", parsed.data.id, { portals: parsed.data.portals });
  return NextResponse.json({ data: { ok: true }, error: null });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const b = parsed.data;
  if (b.id) {
    await db
      .update(schema.roles)
      .set({
        nameEn: b.nameEn,
        nameAr: b.nameAr,
        permissionsJson: JSON.stringify(b.permissions),
        defaultClearance: b.defaultClearance,
        defaultDepartmentScope: b.defaultDepartmentScope,
        ...(b.portals ? { portalsJson: JSON.stringify(b.portals) } : {}),
        updatedAt: nowIso(),
      })
      .where(eq(schema.roles.id, b.id));
    await audit(user.id, "edit", "role", b.id);
    return NextResponse.json({ data: { id: b.id }, error: null });
  }
  const id = newId();
  await db.insert(schema.roles).values({
    id,
    nameEn: b.nameEn,
    nameAr: b.nameAr,
    permissionsJson: JSON.stringify(b.permissions),
    defaultClearance: b.defaultClearance,
    defaultDepartmentScope: b.defaultDepartmentScope,
    isSystem: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  await audit(user.id, "create", "role", id);
  return NextResponse.json({ data: { id }, error: null });
}
