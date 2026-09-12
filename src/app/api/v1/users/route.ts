import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { db, schema } from "@/server/db/client";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const users = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      nameEn: schema.users.nameEn,
      nameAr: schema.users.nameAr,
      roleId: schema.users.roleId,
      departmentId: schema.users.departmentId,
      clearanceLevel: schema.users.clearanceLevel,
      departmentScope: schema.users.departmentScope,
      lastLoginAt: schema.users.lastLoginAt,
      avatarColor: schema.users.avatarColor,
    })
    .from(schema.users);
  return NextResponse.json({ data: users, error: null });
}
