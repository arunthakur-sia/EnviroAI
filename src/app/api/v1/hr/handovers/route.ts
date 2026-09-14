import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { hrScopeFor, refreshHandoverCompletion, startHandover } from "@/server/services/hr";
import { audit } from "@/server/auth/audit";
import { notify, record } from "@/server/gamification/engine";
import { nowIso } from "@/lib/ids";

/* CR05 5.6.4: create a handover with its generated checklist. */
const CreateBody = z.object({
  userId: z.string().min(1),
  kind: z.enum(["leaving", "transferring", "leave"]),
  dueDate: z.string().nullable().optional(),
  successorDefaultUserId: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const scope = hrScopeFor(user);
  if (!scope) return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const b = parsed.data;
  const [target] = await db.select().from(schema.users).where(eq(schema.users.id, b.userId)).limit(1);
  if (!target) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  if (!scope.all && target.departmentId !== scope.departmentId) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const created = await startHandover(user, {
    userId: b.userId,
    kind: b.kind,
    dueDate: b.dueDate ?? null,
    successorDefaultUserId: b.successorDefaultUserId ?? null,
  });
  await audit(user.id, "handover_started", "handover", created?.id, { kind: b.kind });
  return NextResponse.json({ data: created, error: null });
}

/* item updates, bulk assignment to the default successor, completion */
const PatchBody = z.object({
  handoverId: z.string().min(1),
  action: z.enum(["bulk_assign", "item"]),
  itemId: z.string().optional(),
  status: z.enum(["pending", "reassigned", "captured", "not_needed"]).optional(),
  successorUserId: z.string().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const scope = hrScopeFor(user);
  if (!scope) return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const b = parsed.data;
  const [h] = await db.select().from(schema.handovers).where(eq(schema.handovers.id, b.handoverId)).limit(1);
  if (!h) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  const [person] = await db.select().from(schema.users).where(eq(schema.users.id, h.userId)).limit(1);
  if (!scope.all && person?.departmentId !== scope.departmentId) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const wasComplete = h.status === "complete";

  if (b.action === "bulk_assign") {
    if (!h.successorDefaultUserId) {
      return NextResponse.json({ data: null, error: "no_default_successor" }, { status: 400 });
    }
    const items = await db
      .select()
      .from(schema.handoverItems)
      .where(eq(schema.handoverItems.handoverId, h.id));
    let assigned = 0;
    for (const i of items) {
      if (i.successorUserId) continue;
      await db
        .update(schema.handoverItems)
        .set({ successorUserId: h.successorDefaultUserId })
        .where(eq(schema.handoverItems.id, i.id));
      assigned++;
    }
    await audit(user.id, "handover_bulk_assigned", "handover", h.id, { assigned });
  } else {
    if (!b.itemId) return NextResponse.json({ data: null, error: "item_required" }, { status: 400 });
    const [item] = await db
      .select()
      .from(schema.handoverItems)
      .where(eq(schema.handoverItems.id, b.itemId))
      .limit(1);
    if (!item || item.handoverId !== h.id) {
      return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
    }
    const nextStatus = b.status ?? item.status;
    const successor = b.successorUserId === undefined ? item.successorUserId : b.successorUserId;
    await db
      .update(schema.handoverItems)
      .set({
        status: nextStatus,
        successorUserId: successor,
        note: b.note === undefined ? item.note : b.note,
        doneAt: nextStatus !== "pending" ? item.doneAt ?? nowIso() : null,
      })
      .where(eq(schema.handoverItems.id, b.itemId));
    // points to the successor for a newly completed item (5, cap 50/day)
    if (item.status === "pending" && nextStatus !== "pending" && nextStatus !== "not_needed") {
      const receiver = successor ?? h.successorDefaultUserId;
      if (receiver) {
        await record({
          userId: receiver,
          type: "handover_item_completed",
          resourceType: "handover_item",
          resourceId: item.id,
        });
      }
    }
    // successor and department head hear about each reassignment
    if (successor && successor !== item.successorUserId) {
      const dept = person?.departmentId
        ? (
            await db
              .select()
              .from(schema.departments)
              .where(eq(schema.departments.id, person.departmentId))
              .limit(1)
          )[0]
        : null;
      for (const to of [successor, dept?.headUserId].filter(Boolean) as string[]) {
        await notify(
          to,
          "handover_item_reassigned",
          `Handover item assigned: ${item.title.slice(0, 60)}`,
          `أُسند إليك عنصر تسليم: ${item.title.slice(0, 60)}`,
          `/hr/handovers/${h.id}`
        );
      }
    }
  }

  const pct = await refreshHandoverCompletion(h.id);
  if (!wasComplete && pct >= 100) {
    // 60 to the successor; 40 to the leaving person when before the due date
    const beforeDue = !h.dueDate || nowIso().slice(0, 10) <= h.dueDate;
    if (h.successorDefaultUserId) {
      await record({
        userId: h.successorDefaultUserId,
        type: "handover_completed",
        resourceType: "handover",
        resourceId: h.id,
      });
    }
    if (beforeDue) {
      await record({
        userId: h.userId,
        type: "handover_completed_owner",
        resourceType: "handover",
        resourceId: h.id,
      });
    }
  }
  return NextResponse.json({ data: { completionPct: pct }, error: null });
}
