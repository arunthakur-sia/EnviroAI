// CR02 4.6: streams an episode's rendered audio within clearance.
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { resolveDataPath } from "@/server/paths";

export async function GET(
  _req: NextRequest,
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
  if (!episode || episode.classificationLevel > user.clearanceLevel || !episode.audioPath) {
    return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  }
  const filePath = resolveDataPath(episode.audioPath);
  try {
    const buf = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": "audio/mpeg",
        "content-length": String(buf.length),
        "cache-control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ data: null, error: "audio_missing" }, { status: 404 });
  }
}
