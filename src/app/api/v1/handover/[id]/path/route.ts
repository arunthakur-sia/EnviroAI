// CR08 6.3: the recipient's Handover Learning Path.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { askLeavingPerson, getLearningPath, markModuleUnderstood, signOff } from "@/server/services/handover";
import { fail, invalid, notFound, unauthorized } from "../../_shared";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const path = await getLearningPath(user, id);
    if (!path) return notFound();
    return NextResponse.json({ data: path, error: null });
  } catch (e) {
    return fail(e);
  }
}

const PatchBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("understood"), moduleId: z.string().min(1) }),
  z.object({ action: z.literal("sign_off") }),
]);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten());
  try {
    if (parsed.data.action === "understood") {
      return NextResponse.json({ data: await markModuleUnderstood(user, id, parsed.data.moduleId), error: null });
    }
    return NextResponse.json({ data: await signOff(user, id), error: null });
  } catch (e) {
    return fail(e);
  }
}

const QuestionBody = z.object({ text: z.string().min(2).max(4000) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const parsed = QuestionBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten());
  try {
    const path = await getLearningPath(user, id);
    if (!path) return notFound();
    return NextResponse.json({ data: await askLeavingPerson(user, id, parsed.data.text), error: null });
  } catch (e) {
    return fail(e);
  }
}
