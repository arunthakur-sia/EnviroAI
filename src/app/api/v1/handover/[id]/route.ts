// CR08 6: one handover. GET the detail for the viewer (administrator in
// scope, the person, a recipient); PATCH the actions.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { audit } from "@/server/auth/audit";
import {
  addHandoverItem,
  applyFiling,
  approveFiling,
  buildLearningPath,
  canClose,
  CATEGORIES,
  closeHandover,
  createAccessLink,
  getFilingReport,
  getHandoverForViewer,
  markUnderstood,
  performCutOff,
  proposeAllFiling,
  proposeFiling,
  revokeAccess,
  setItemNote,
  setItemRecipient,
  setItemScope,
} from "@/server/services/handover";
import { fail, forbidden, invalid, notFound, unauthorized } from "../_shared";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const detail = await getHandoverForViewer(user, id);
    if (!detail) return notFound();
    return NextResponse.json({ data: detail, error: null });
  } catch (e) {
    return fail(e);
  }
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("scope"), itemId: z.string().min(1), inScope: z.boolean() }),
  z.object({
    action: z.literal("add_item"),
    title: z.string().max(200).optional(),
    category: z.enum(CATEGORIES).optional(),
    note: z.string().max(2000).nullable().optional(),
    published: z.array(z.object({ type: z.string(), id: z.string() })).max(12).optional(),
  }),
  z.object({ action: z.literal("note"), itemId: z.string().min(1), note: z.string().max(2000) }),
  z.object({
    action: z.literal("set_recipient"),
    itemId: z.string().min(1),
    recipientKind: z.enum(["person", "system"]).nullable(),
    recipientUserId: z.string().nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
  }),
  z.object({ action: z.literal("bulk_recipient"), recipientKind: z.enum(["person", "system"]), recipientUserId: z.string().nullable().optional(), onlyUndecided: z.boolean().default(true) }),
  z.object({ action: z.literal("understood"), itemId: z.string().min(1) }),
  z.object({ action: z.literal("access_link") }),
  z.object({ action: z.literal("revoke") }),
  z.object({ action: z.literal("propose_filing"), itemId: z.string().optional() }),
  z.object({ action: z.literal("filing_report") }),
  z.object({ action: z.literal("approve_filing"), itemIds: z.array(z.string()).min(1) }),
  z.object({ action: z.literal("apply_filing") }),
  z.object({ action: z.literal("build_path"), recipientUserId: z.string().min(1), episodes: z.boolean().optional() }),
  z.object({ action: z.literal("readiness") }),
  z.object({ action: z.literal("close"), override: z.string().max(1000).nullable().optional() }),
  z.object({ action: z.literal("override"), reason: z.string().min(3).max(1000) }),
  z.object({ action: z.literal("cut_off") }),
]);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten());
  const b = parsed.data;
  try {
    const detail = await getHandoverForViewer(user, id);
    if (!detail) return notFound();
    const admin = detail.viewer === "admin";
    const person = detail.viewer === "person";
    switch (b.action) {
      case "scope": {
        if (!admin) return forbidden();
        return NextResponse.json({ data: await setItemScope(user, b.itemId, b.inScope), error: null });
      }
      case "add_item": {
        if (!admin && !person) return forbidden();
        const items = await addHandoverItem({ userId: user.id, admin }, id, { title: b.title, category: b.category, note: b.note ?? null, published: b.published });
        return NextResponse.json({ data: items, error: null });
      }
      case "note": {
        if (!admin && !person) return forbidden();
        return NextResponse.json({ data: await setItemNote({ userId: user.id, admin }, b.itemId, b.note), error: null });
      }
      case "set_recipient": {
        if (!admin) return forbidden();
        return NextResponse.json({ data: await setItemRecipient(user, b.itemId, { recipientKind: b.recipientKind, recipientUserId: b.recipientUserId ?? null, note: b.note }), error: null });
      }
      case "bulk_recipient": {
        if (!admin) return forbidden();
        let n = 0;
        for (const i of detail.items) {
          if (!i.inScope || i.status === "not_needed") continue;
          if (b.onlyUndecided && i.recipientKind) continue;
          await setItemRecipient(user, i.id, { recipientKind: b.recipientKind, recipientUserId: b.recipientUserId ?? null });
          n++;
        }
        return NextResponse.json({ data: { assigned: n }, error: null });
      }
      case "understood": {
        return NextResponse.json({ data: await markUnderstood(user, b.itemId), error: null });
      }
      case "access_link": {
        if (!admin) return forbidden();
        return NextResponse.json({ data: await createAccessLink(user, id), error: null });
      }
      case "revoke": {
        if (!admin) return forbidden();
        await revokeAccess(user, id);
        return NextResponse.json({ data: { ok: true }, error: null });
      }
      case "propose_filing": {
        if (!admin) return forbidden();
        if (b.itemId) return NextResponse.json({ data: await proposeFiling(user, b.itemId), error: null });
        return NextResponse.json({ data: { proposed: await proposeAllFiling(user, id) }, error: null });
      }
      case "filing_report": {
        if (!admin) return forbidden();
        return NextResponse.json({ data: await getFilingReport(id), error: null });
      }
      case "approve_filing": {
        if (!admin) return forbidden();
        return NextResponse.json({ data: { approved: await approveFiling(user, id, b.itemIds) }, error: null });
      }
      case "apply_filing": {
        if (!admin) return forbidden();
        return NextResponse.json({ data: { applied: await applyFiling(user, id) }, error: null });
      }
      case "build_path": {
        if (!admin) return forbidden();
        const built = await buildLearningPath(id, b.recipientUserId, { episodes: b.episodes });
        await audit(user.id, "handover_path_built", "handover", id, { recipientUserId: b.recipientUserId, modules: built.modules.length });
        return NextResponse.json({ data: built, error: null });
      }
      case "readiness": {
        if (!admin) return forbidden();
        return NextResponse.json({ data: await canClose(id), error: null });
      }
      case "close": {
        if (!admin) return forbidden();
        return NextResponse.json({ data: await closeHandover(user, id, { override: b.override ?? null }), error: null });
      }
      case "override": {
        if (!admin) return forbidden();
        return NextResponse.json({ data: await closeHandover(user, id, { override: b.reason }), error: null });
      }
      case "cut_off": {
        if (!admin) return forbidden();
        return NextResponse.json({ data: await performCutOff(user, id), error: null });
      }
      default:
        return invalid();
    }
  } catch (e) {
    return fail(e);
  }
}
