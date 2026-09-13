import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import {
  getOrStartSession,
  markSessionRead,
  completeSession,
} from "@/server/services/lessons";
import { getSetting } from "@/server/settings";

/* CR04 3.5: the guided Learn session. start returns (or resumes) today's
   session; read marks a lesson done; complete finishes with an optional
   reflection note. */
const Body = z.object({
  action: z.enum(["start", "read", "complete"]),
  sessionId: z.string().optional(),
  lessonId: z.string().optional(),
  index: z.number().int().min(0).max(10).optional(),
  reflection: z
    .object({ lessonId: z.string(), text: z.string().max(4000) })
    .optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const settings = await getSetting<{ learnModeEnabled?: boolean }>("lessons_settings", {});
  if (settings.learnModeEnabled === false) {
    return NextResponse.json({ data: null, error: "learn_mode_off" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const body = parsed.data;

  if (body.action === "start") {
    const session = await getOrStartSession(user);
    return NextResponse.json({ data: session, error: null });
  }
  if (body.action === "read") {
    if (!body.sessionId || !body.lessonId) {
      return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
    }
    const result = await markSessionRead(user, body.sessionId, body.lessonId, body.index ?? 0);
    return NextResponse.json({ data: result, error: null });
  }
  if (!body.sessionId) {
    return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  }
  const result = await completeSession(user, body.sessionId, body.reflection);
  return NextResponse.json({ data: result, error: null });
}
