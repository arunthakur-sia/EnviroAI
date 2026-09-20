// CR08 6.1: start a handover; list the handovers in scope; my handover.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { getMyHandover, getMyRecipientHandovers, listHandovers, searchStartCandidates, startHandover2 } from "@/server/services/handover";
import { fail, forbidden, invalid, unauthorized } from "./_shared";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const sp = req.nextUrl.searchParams;
  try {
    if (sp.get("mine") === "1") {
      const [mine, recipient] = await Promise.all([getMyHandover(user), getMyRecipientHandovers(user)]);
      return NextResponse.json({ data: { mine, recipient }, error: null });
    }
    if (sp.get("candidates") === "1") {
      return NextResponse.json({ data: await searchStartCandidates(sp.get("q") ?? ""), error: null });
    }
    const list = await listHandovers(user);
    if (!list) return forbidden();
    return NextResponse.json({ data: list, error: null });
  } catch (e) {
    return fail(e);
  }
}

const StartBody = z.object({
  person: z.union([
    z.object({ userId: z.string().min(1) }),
    z.object({ expertId: z.string().min(1) }),
    z.object({ external: z.object({ name: z.string().min(2).max(120), email: z.string().max(160).default(""), organisation: z.string().max(160).default("") }) }),
  ]),
  kind: z.enum(["leaving", "transferring", "long_leave", "engagement_ending"]),
  reason: z.string().max(500).nullable().optional(),
  lastWorkingDay: z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullable().optional(),
  recipient: z
    .object({
      mode: z.enum(["person", "system", "per_item"]).default("per_item"),
      defaultRecipientUserId: z.string().nullable().optional(),
    })
    .default({ mode: "per_item", defaultRecipientUserId: null }),
  notes: z.string().max(2000).nullable().optional(),
  interviewRequired: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const parsed = StartBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten());
  const b = parsed.data;
  try {
    const created = await startHandover2(user, {
      person: b.person,
      kind: b.kind,
      reason: b.reason ?? null,
      lastWorkingDay: b.lastWorkingDay ?? null,
      dueDate: b.dueDate ?? null,
      recipient: { mode: b.recipient.mode, defaultRecipientUserId: b.recipient.defaultRecipientUserId ?? null },
      notes: b.notes ?? null,
      interviewRequired: b.interviewRequired,
    });
    return NextResponse.json({ data: { id: created.id, items: created.items }, error: null });
  } catch (e) {
    return fail(e);
  }
}
