// CR05 5.6.4 surface, delegating to the CR08 6 handover service. The People
// page still POSTs the CR05 body (userId, kind leaving|transferring|leave,
// dueDate, successorDefaultUserId); the CR08 start form uses
// /api/v1/handover. PATCH keeps the CR05 item actions as thin wrappers over
// the recipient decision.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { hrScopeFor } from "@/server/services/hr";
import {
  getHandoverForViewer,
  HandoverError,
  listHandovers,
  setItemNote,
  setItemRecipient,
  setItemStatusCompat,
  startHandover2,
} from "@/server/services/handover";
import { audit } from "@/server/auth/audit";

function fail(e: unknown) {
  if (e instanceof HandoverError) return NextResponse.json({ data: e.extra ?? null, error: e.code }, { status: e.status });
  console.error("[hr handovers api]", (e as Error)?.message ?? e);
  return NextResponse.json({ data: null, error: "server_error" }, { status: 500 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const list = await listHandovers(user);
  if (!list) return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  return NextResponse.json({ data: list, error: null });
}

const CreateBody = z.object({
  userId: z.string().min(1),
  kind: z.enum(["leaving", "transferring", "leave", "long_leave"]),
  dueDate: z.string().nullable().optional(),
  lastWorkingDay: z.string().nullable().optional(),
  successorDefaultUserId: z.string().nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!hrScopeFor(user)) return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const b = parsed.data;
  try {
    const created = await startHandover2(user, {
      person: { userId: b.userId },
      kind: b.kind === "leave" ? "long_leave" : b.kind,
      reason: b.reason ?? null,
      lastWorkingDay: b.lastWorkingDay ?? b.dueDate ?? null,
      dueDate: b.dueDate ?? b.lastWorkingDay ?? null,
      recipient: { mode: b.successorDefaultUserId ? "person" : "per_item", defaultRecipientUserId: b.successorDefaultUserId ?? null },
      notes: b.notes ?? null,
    });
    await audit(user.id, "handover_started", "handover", created.id, { kind: b.kind, via: "hr" });
    return NextResponse.json({ data: { id: created.id, items: created.items }, error: null });
  } catch (e) {
    return fail(e);
  }
}

const PatchBody = z.object({
  handoverId: z.string().min(1),
  action: z.enum(["bulk_assign", "item"]),
  itemId: z.string().optional(),
  status: z.enum(["pending", "reassigned", "captured", "not_needed"]).optional(),
  successorUserId: z.string().nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const b = parsed.data;
  try {
    const detail = await getHandoverForViewer(user, b.handoverId);
    if (!detail) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
    if (detail.viewer !== "admin") return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
    if (b.action === "bulk_assign") {
      if (!detail.defaultRecipient) return NextResponse.json({ data: null, error: "no_default_successor" }, { status: 400 });
      let assigned = 0;
      for (const i of detail.items) {
        if (!i.inScope || i.recipientKind) continue;
        await setItemRecipient(user, i.id, { recipientKind: "person", recipientUserId: detail.defaultRecipient.id });
        assigned++;
      }
      await audit(user.id, "handover_bulk_assigned", "handover", b.handoverId, { assigned });
    } else {
      if (!b.itemId) return NextResponse.json({ data: null, error: "item_required" }, { status: 400 });
      const item = detail.items.find((i) => i.id === b.itemId);
      if (!item) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
      if (b.status) {
        await setItemStatusCompat(user, item.id, b.status, { recipientUserId: b.successorUserId, note: b.note });
      } else if (b.successorUserId !== undefined) {
        await setItemRecipient(user, item.id, { recipientKind: b.successorUserId ? "person" : null, recipientUserId: b.successorUserId, note: b.note });
      } else if (b.note !== undefined && b.note !== null) {
        await setItemNote({ userId: user.id, admin: true }, item.id, b.note);
      }
    }
    const fresh = await getHandoverForViewer(user, b.handoverId);
    return NextResponse.json({ data: { completionPct: fresh?.progress.items.pct ?? 0 }, error: null });
  } catch (e) {
    return fail(e);
  }
}
