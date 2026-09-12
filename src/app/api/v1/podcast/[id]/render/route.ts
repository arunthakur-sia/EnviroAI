// CR02 4.5: "Regenerate with studio voice". Guarded by the per-user daily
// cap of studio renders.
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { studioRendersLeft } from "@/server/services/podcast";
import { studioAvailable } from "@/server/ai/podcast/audio";
import { enqueue } from "@/server/jobs/queue";
import { audit } from "@/server/auth/audit";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!studioAvailable()) {
    return NextResponse.json({ data: null, error: "no_key" }, { status: 501 });
  }
  const [episode] = await db
    .select()
    .from(schema.podcastEpisodes)
    .where(eq(schema.podcastEpisodes.id, id))
    .limit(1);
  if (!episode || episode.classificationLevel > user.clearanceLevel) {
    return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  }
  const left = await studioRendersLeft(user);
  if (left <= 0) {
    return NextResponse.json({ data: null, error: "daily_cap_reached" }, { status: 429 });
  }
  await audit(user.id, "render_podcast", "podcast_episode", id);
  await enqueue("podcast_render", { episodeId: id });
  return NextResponse.json({ data: { rendering: true, left: left - 1 }, error: null });
}
