// Analyst conversations: list mine (GET).
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const rows = await db
    .select({
      id: schema.aiConversations.id,
      title: schema.aiConversations.title,
      isShared: schema.aiConversations.isShared,
      updatedAt: schema.aiConversations.updatedAt,
    })
    .from(schema.aiConversations)
    .where(eq(schema.aiConversations.userId, user.id))
    .orderBy(desc(schema.aiConversations.updatedAt))
    .limit(30);
  return NextResponse.json({ data: rows, error: null });
}
