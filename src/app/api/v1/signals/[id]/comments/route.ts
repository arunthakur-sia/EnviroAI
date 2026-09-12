import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { newId, nowIso } from "@/lib/ids";
import { audit } from "@/server/auth/audit";

const Body = z.object({ text: z.string().min(2).max(2000) });

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const [signal] = await db
    .select({ id: schema.signals.id })
    .from(schema.signals)
    .where(eq(schema.signals.id, id))
    .limit(1);
  if (!signal) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  await db.insert(schema.reviews).values({
    id: newId(),
    resourceType: "signal",
    resourceId: id,
    reviewerId: user.id,
    decision: "comment",
    note: parsed.data.text,
    createdAt: nowIso(),
  });
  await audit(user.id, "comment", "signal", id);
  return NextResponse.json({ data: { ok: true }, error: null });
}
