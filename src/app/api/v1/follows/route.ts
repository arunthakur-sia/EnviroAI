import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { newId, nowIso } from "@/lib/ids";

const Body = z.object({
  resourceType: z.enum(["term", "question", "node", "indicator", "document", "community", "expert"]),
  resourceId: z.string(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const { resourceType, resourceId } = parsed.data;
  const existing = await db
    .select()
    .from(schema.follows)
    .where(
      and(
        eq(schema.follows.userId, user.id),
        eq(schema.follows.resourceType, resourceType),
        eq(schema.follows.resourceId, resourceId)
      )
    )
    .limit(1);
  if (existing.length) {
    await db.delete(schema.follows).where(eq(schema.follows.id, existing[0].id));
    return NextResponse.json({ data: { following: false }, error: null });
  }
  await db.insert(schema.follows).values({
    id: newId(),
    userId: user.id,
    resourceType,
    resourceId,
    createdAt: nowIso(),
  });
  return NextResponse.json({ data: { following: true }, error: null });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const rows = await db.select().from(schema.follows).where(eq(schema.follows.userId, user.id));
  return NextResponse.json({ data: rows, error: null });
}
