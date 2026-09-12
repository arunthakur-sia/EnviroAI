import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { nowIso } from "@/lib/ids";
import { audit } from "@/server/auth/audit";

const Body = z.object({
  roleId: z.string().optional(),
  departmentId: z.string().nullable().optional(),
  clearanceLevel: z.number().min(1).max(4).optional(),
  departmentScope: z.enum(["all", "own"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || !can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });

  // Guard: never remove the last super admin
  if (parsed.data.roleId) {
    const [target] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    if (!target) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
    const roles = await db.select().from(schema.roles);
    const superAdmin = roles.find((r) => r.nameEn === "Super Admin");
    if (superAdmin && target.roleId === superAdmin.id && parsed.data.roleId !== superAdmin.id) {
      const admins = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.roleId, superAdmin.id));
      if (admins.length <= 1) {
        return NextResponse.json({ data: null, error: "last_super_admin" }, { status: 409 });
      }
    }
  }
  await db
    .update(schema.users)
    .set({ ...parsed.data, updatedAt: nowIso() })
    .where(eq(schema.users.id, id));
  await audit(user.id, "edit", "user", id, parsed.data as Record<string, unknown>);
  return NextResponse.json({ data: { ok: true }, error: null });
}
