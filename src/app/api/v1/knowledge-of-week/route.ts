// CR08 8: Knowledge of the Week.
//   GET  ?view=active | ids | hall | schedule | preview&type=&id=&week=
//   POST { resourceType, resourceId, weekStart, noteEn, noteAr, replace }
//   PATCH { action: "seen" | "read", kowId }
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { audit } from "@/server/auth/audit";
import {
  KOW_RESOURCE_TYPES,
  canManageKnowledgeOfWeek,
  getActiveKnowledgeOfWeek,
  getHallOfKnowledge,
  getKnowledgeOfWeekIds,
  getKnowledgeOfWeekSchedule,
  markRead,
  markSeen,
  previewKnowledgeOfWeek,
  setKnowledgeOfWeek,
  weekStartOf,
} from "@/server/services/knowledge-of-week";

const ResourceType = z.enum(KOW_RESOURCE_TYPES);
const Ulid = z.string().min(1).max(64);
const WeekStart = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const SetBody = z.object({
  resourceType: ResourceType,
  resourceId: Ulid,
  weekStart: WeekStart,
  noteEn: z.string().max(600).optional().nullable(),
  noteAr: z.string().max(600).optional().nullable(),
  replace: z.boolean().optional(),
});

const PatchBody = z.object({
  action: z.enum(["seen", "read"]),
  kowId: Ulid,
});

function unauthorized() {
  return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const params = req.nextUrl.searchParams;
  const view = params.get("view") ?? "active";

  switch (view) {
    case "active":
      return NextResponse.json({ data: await getActiveKnowledgeOfWeek(user), error: null });
    case "ids": {
      const ids = [...(await getKnowledgeOfWeekIds())];
      return NextResponse.json(
        { data: ids, error: null },
        { headers: { "cache-control": "private, max-age=60" } }
      );
    }
    case "hall":
      return NextResponse.json({ data: await getHallOfKnowledge(user), error: null });
    case "schedule":
      if (!canManageKnowledgeOfWeek(user)) return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
      return NextResponse.json({ data: await getKnowledgeOfWeekSchedule(user), error: null });
    case "preview": {
      if (!canManageKnowledgeOfWeek(user)) return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
      const parsed = z
        .object({ type: ResourceType, id: Ulid, week: WeekStart.optional() })
        .safeParse({ type: params.get("type"), id: params.get("id"), week: params.get("week") ?? undefined });
      if (!parsed.success) return NextResponse.json({ data: null, error: "bad_request" }, { status: 400 });
      const card = await previewKnowledgeOfWeek(user, parsed.data.type, parsed.data.id, parsed.data.week ?? weekStartOf());
      if (!card) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
      return NextResponse.json({ data: card, error: null });
    }
    default:
      return NextResponse.json({ data: null, error: "bad_request" }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!canManageKnowledgeOfWeek(user)) return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  const parsed = SetBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: "bad_request", issues: parsed.error.issues }, { status: 400 });
  }
  const result = await setKnowledgeOfWeek(user, parsed.data);
  if (!result.ok) {
    const status =
      result.error === "forbidden" ? 403
      : result.error === "not_found" ? 404
      : result.error === "conflict" ? 409
      : result.error === "not_eligible" ? 422
      : 400;
    return NextResponse.json({ data: result.existing ?? null, error: result.error }, { status });
  }
  await audit(user.id, result.replaced ? "kow_replace" : "kow_set", "knowledge_of_week", result.id, {
    resourceType: parsed.data.resourceType,
    resourceId: parsed.data.resourceId,
    weekStart: parsed.data.weekStart,
  });
  return NextResponse.json({ data: result, error: null }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "bad_request" }, { status: 400 });
  const { action, kowId } = parsed.data;
  if (action === "seen") {
    const r = await markSeen(user, kowId);
    if (!r.ok) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
    return NextResponse.json({ data: r, error: null });
  }
  const r = await markRead(user, kowId);
  if (!r.ok) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  if (r.first) await audit(user.id, "kow_read", "knowledge_of_week", kowId);
  return NextResponse.json({ data: r, error: null });
}
