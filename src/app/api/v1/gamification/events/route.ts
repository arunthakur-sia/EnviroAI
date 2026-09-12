// Small client-triggered game events: mystery shelf opened, tag confirmed.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { record } from "@/server/gamification/engine";

const ALLOWED = new Set(["mystery_shelf_opened", "ai_tag_confirmed"]);

const Body = z.object({
  type: z.string(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !ALLOWED.has(parsed.data.type)) {
    return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  }
  const result = await record({
    userId: user.id,
    type: parsed.data.type,
    resourceType: parsed.data.resourceType,
    resourceId: parsed.data.resourceId,
  });
  return NextResponse.json({ data: { points: result.points }, error: null });
}
