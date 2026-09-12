import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { audit } from "@/server/auth/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const rules = await db.select().from(schema.gameRules).orderBy(schema.gameRules.eventType);
  return NextResponse.json({ data: rules, error: null });
}

const Body = z.object({
  id: z.string(),
  points: z.number().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (parsed.data.points !== undefined) patch.points = parsed.data.points;
  if (parsed.data.isActive !== undefined) patch.isActive = parsed.data.isActive ? 1 : 0;
  await db.update(schema.gameRules).set(patch).where(eq(schema.gameRules.id, parsed.data.id));
  await audit(user.id, "edit", "game_rule", parsed.data.id, patch);
  return NextResponse.json({ data: { ok: true }, error: null });
}
