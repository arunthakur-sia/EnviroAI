// CR08 6.2: the AI knowledge capture interview (the person, or an
// administrator on behalf of an external). Transcripts are never audited.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { answerInterview, completeInterview, getHandoverForViewer, startInterview } from "@/server/services/handover";
import { fail, forbidden, invalid, notFound, unauthorized } from "../../_shared";

const StartBody = z.object({
  topic: z.string().min(2).max(160),
  refType: z.enum(["node", "council_node", "topic", "general"]).optional(),
  refId: z.string().nullable().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const parsed = StartBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten());
  try {
    const detail = await getHandoverForViewer(user, id);
    if (!detail) return notFound();
    if (detail.viewer !== "person" && detail.viewer !== "admin") return forbidden();
    const iv = await startInterview({ userId: user.id, admin: detail.viewer === "admin" }, id, { topic: parsed.data.topic, refType: parsed.data.refType, refId: parsed.data.refId ?? null });
    return NextResponse.json({ data: iv, error: null });
  } catch (e) {
    return fail(e);
  }
}

const PatchBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("answer"), interviewId: z.string().min(1), text: z.string().min(1).max(4000) }),
  z.object({ action: z.literal("complete"), interviewId: z.string().min(1) }),
]);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten());
  const b = parsed.data;
  try {
    const detail = await getHandoverForViewer(user, id);
    if (!detail) return notFound();
    if (detail.viewer !== "person" && detail.viewer !== "admin") return forbidden();
    if (!detail.interviews.some((i) => i.id === b.interviewId)) return notFound();
    const actor = { userId: user.id, admin: detail.viewer === "admin" };
    if (b.action === "answer") return NextResponse.json({ data: await answerInterview(actor, b.interviewId, b.text), error: null });
    return NextResponse.json({ data: await completeInterview(actor, b.interviewId), error: null });
  } catch (e) {
    return fail(e);
  }
}
