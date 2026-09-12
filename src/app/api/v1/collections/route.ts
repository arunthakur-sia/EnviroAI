import { NextResponse } from "next/server";
import { or, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const rows = await db
    .select({
      id: schema.collections.id,
      nameEn: schema.collections.nameEn,
      nameAr: schema.collections.nameAr,
      visibility: schema.collections.visibility,
    })
    .from(schema.collections)
    .where(
      or(
        eq(schema.collections.visibility, "all"),
        eq(schema.collections.ownerUserId, user.id)
      )
    )
    .limit(50);
  return NextResponse.json({ data: rows, error: null });
}
