// CR02 4.4: generates the two-voice episode script for a scope.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { generatePodcastScript } from "@/server/ai/podcast/script";

export const maxDuration = 120;

const Body = z.object({
  scope: z.object({
    kind: z.enum(["node", "document", "collection", "lessons", "topic", "conversation"]),
    ids: z.array(z.string()).default([]),
    labelEn: z.string(),
    labelAr: z.string().default(""),
    query: z.string().optional(),
  }),
  options: z.object({
    language: z.enum(["ar", "en"]),
    minutes: z.union([z.literal(3), z.literal(5)]),
    focus: z.enum(["overview", "lessons", "numbers", "risks"]),
  }),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  }
  const { script, live } = await generatePodcastScript(user, parsed.data.scope, parsed.data.options);
  if (!script.segments.length) {
    return NextResponse.json({ data: null, error: "no_content" }, { status: 422 });
  }
  return NextResponse.json({ data: { script, live }, error: null });
}
