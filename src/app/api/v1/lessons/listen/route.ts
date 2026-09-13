import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { findOrCreateLessonEpisode } from "@/server/services/lessons";

/* CR04 3.6: Listen on a lesson or a theme. The episode is generated through
   the NPC Knowledge Cast pipeline on the first play and reused afterwards. */
const Body = z.object({
  lessonId: z.string().optional(),
  themeId: z.string().optional(),
  locale: z.enum(["en", "ar"]).default("en"),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.lessonId && !parsed.data.themeId)) {
    return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  }
  const result = await findOrCreateLessonEpisode(user, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ data: null, error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    data: { episodeId: result.episodeId, created: result.created },
    error: null,
  });
}
