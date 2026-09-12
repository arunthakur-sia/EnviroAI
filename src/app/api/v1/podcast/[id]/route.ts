// CR02 4.6: one episode. GET returns detail plus any live render progress;
// PATCH lets the creator edit the script.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { getEpisode, studioRendersLeft } from "@/server/services/podcast";
import { renderProgress, studioAvailable } from "@/server/ai/podcast/audio";
import { nowIso } from "@/lib/ids";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const detail = await getEpisode(user, id);
  if (!detail) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  return NextResponse.json({
    data: {
      ...detail,
      renderProgress: renderProgress.get(id) ?? null,
      studioAvailable: studioAvailable(),
      studioRendersLeft: await studioRendersLeft(user),
    },
    error: null,
  });
}

const Patch = z.object({
  segments: z
    .array(
      z.object({
        speaker: z.enum(["mariam", "hamad"]),
        text: z.string(),
        source_mention: z.string().nullable().optional(),
      })
    )
    .min(1)
    .optional(),
  title_en: z.string().optional(),
  title_ar: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const [episode] = await db
    .select()
    .from(schema.podcastEpisodes)
    .where(eq(schema.podcastEpisodes.id, id))
    .limit(1);
  if (!episode) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  if (episode.createdBy !== user.id) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  }
  const script = episode.scriptJson ? JSON.parse(episode.scriptJson) : { segments: [] };
  if (parsed.data.segments) script.segments = parsed.data.segments;
  if (parsed.data.title_en) script.title_en = parsed.data.title_en;
  if (parsed.data.title_ar) script.title_ar = parsed.data.title_ar;
  await db
    .update(schema.podcastEpisodes)
    .set({
      scriptJson: JSON.stringify(script),
      titleEn: parsed.data.title_en ?? episode.titleEn,
      titleAr: parsed.data.title_ar ?? episode.titleAr,
      updatedAt: nowIso(),
    })
    .where(eq(schema.podcastEpisodes.id, id));
  return NextResponse.json({ data: { ok: true }, error: null });
}
