// CR08 9.2: one thread. GET marks it read for the viewer; PATCH replies,
// marks done or reopens, or converts the thread into a routed question. A
// caller who is not a participant (an admin included) gets a 404, so a thread
// id reveals nothing.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import {
  convertToQuestion,
  getThread,
  markDone,
  MessagingError,
  reply,
} from "@/server/services/messaging";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const thread = await getThread(user, id);
  if (!thread) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  return NextResponse.json({ data: thread, error: null });
}

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reply"),
    body: z.string().min(1).max(8000),
    attachments: z.array(z.object({ documentId: z.string().min(1) })).max(5).optional(),
  }),
  z.object({ action: z.literal("done") }),
  z.object({ action: z.literal("reopen") }),
  z.object({ action: z.literal("convert") }),
]);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  try {
    const b = parsed.data;
    if (b.action === "reply") {
      const result = await reply(user, id, b.body, b.attachments);
      return NextResponse.json({ data: result, error: null });
    }
    if (b.action === "done" || b.action === "reopen") {
      await markDone(user, id, b.action === "done");
      return NextResponse.json({ data: { ok: true, status: b.action === "done" ? "done" : "open" }, error: null });
    }
    const result = await convertToQuestion(user, id);
    return NextResponse.json({ data: result, error: null });
  } catch (e) {
    if (e instanceof MessagingError) {
      return NextResponse.json({ data: null, error: e.code }, { status: e.status });
    }
    throw e;
  }
}
