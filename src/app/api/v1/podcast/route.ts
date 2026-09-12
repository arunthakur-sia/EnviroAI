// CR02 4.6: podcast library API. GET lists published episodes within
// clearance; POST creates an episode from a reviewed script and optionally
// queues a studio render.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import {
  createEpisode,
  listEpisodes,
  studioRendersLeft,
} from "@/server/services/podcast";
import { studioAvailable } from "@/server/ai/podcast/audio";
import { enqueue } from "@/server/jobs/queue";
import { audit } from "@/server/auth/audit";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const episodes = await listEpisodes(user, {
    language: sp.get("language") ?? undefined,
    focus: sp.get("focus") ?? undefined,
    outcome: sp.get("outcome") ?? undefined,
  });
  return NextResponse.json({ data: episodes, error: null });
}

const Body = z.object({
  scope: z.object({
    kind: z.enum(["node", "document", "collection", "lessons", "topic", "conversation"]),
    ids: z.array(z.string()).default([]),
    labelEn: z.string(),
    labelAr: z.string().default(""),
    query: z.string().optional(),
    outcomeCode: z.string().nullable().optional(),
  }),
  options: z.object({
    language: z.enum(["ar", "en"]),
    minutes: z.union([z.literal(3), z.literal(5)]),
    focus: z.enum(["overview", "lessons", "numbers", "risks"]),
  }),
  script: z.object({
    title_en: z.string(),
    title_ar: z.string(),
    description_en: z.string().default(""),
    description_ar: z.string().default(""),
    segments: z
      .array(
        z.object({
          speaker: z.enum(["mariam", "hamad"]),
          text: z.string(),
          source_mention: z.string().nullable().optional(),
        })
      )
      .min(1),
    estimated_seconds: z.number(),
    sources: z.array(z.record(z.unknown())).default([]),
  }),
  render: z.enum(["studio", "browser"]).default("browser"),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  }
  const { scope, options, script, render } = parsed.data;
  const res = await createEpisode(user, {
    scope,
    options,
    script: script as never,
  });
  if (!res.ok) {
    return NextResponse.json({ data: null, error: res.error }, { status: 403 });
  }

  let rendering = false;
  if (render === "studio" && studioAvailable()) {
    const left = await studioRendersLeft(user);
    if (left > 0) {
      await audit(user.id, "render_podcast", "podcast_episode", res.id);
      await enqueue("podcast_render", { episodeId: res.id });
      rendering = true;
    }
  }
  return NextResponse.json({
    data: { id: res.id, points: res.points, rendering },
    error: null,
  });
}
