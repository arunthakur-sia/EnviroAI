// CR02 4.6: listen tracking. Completion awards podcast_listened_full once
// per episode per user and bumps the episode's listen count.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { recordListen } from "@/server/services/podcast";

const Body = z.object({
  seconds: z.number().min(0).max(36000),
  completed: z.boolean().default(false),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  }
  const res = await recordListen(user, id, parsed.data.seconds, parsed.data.completed);
  return NextResponse.json({ data: res, error: null });
}
