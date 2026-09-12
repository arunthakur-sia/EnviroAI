import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { newId, nowIso } from "@/lib/ids";
import { audit } from "@/server/auth/audit";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const [expert] = await db.select().from(schema.experts).where(eq(schema.experts.id, id)).limit(1);
  if (!expert) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  await db.insert(schema.endorsements).values({
    id: newId(),
    expertId: id,
    endorsedBy: user.id,
    termId: body?.termId ?? null,
    note: body?.note ?? null,
    createdAt: nowIso(),
  });
  await audit(user.id, "create", "endorsement", id);
  return NextResponse.json({ data: { ok: true }, error: null });
}
