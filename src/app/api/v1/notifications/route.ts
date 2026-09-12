import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { nowIso } from "@/lib/ids";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, user.id))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(30);
  return NextResponse.json({ data: rows, error: null });
}

export async function PATCH() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  await db
    .update(schema.notifications)
    .set({ readAt: nowIso() })
    .where(
      and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt))
    );
  return NextResponse.json({ data: { ok: true }, error: null });
}
