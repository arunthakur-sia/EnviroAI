// CR08 10.2 section 5: the planning and reporting calendar. GET ?year=,
// POST creates, PATCH edits (id required), DELETE ?id=.
import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import {
  CALENDAR_KINDS,
  deleteCalendarEvent,
  getCalendar,
  upsertCalendarEvent,
  type CalendarKind,
} from "@/server/services/operating-model";
import { fail, failFrom, ok, readJson } from "../_shared";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const yearRaw = Number(req.nextUrl.searchParams.get("year"));
  const year = Number.isInteger(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100 ? yearRaw : undefined;
  return ok(await getCalendar(year));
}

const Body = z.object({
  id: z.string().min(1).optional(),
  kind: z.enum(CALENDAR_KINDS as unknown as [CalendarKind, ...CalendarKind[]]),
  titleEn: z.string().min(1).max(300),
  titleAr: z.string().min(1).max(300),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  ownerUnitId: z.string().nullable().optional(),
  linkedResourceType: z.string().max(40).nullable().optional(),
  linkedResourceId: z.string().max(60).nullable().optional(),
  recurrence: z.enum(["none", "annual", "quarterly", "monthly"]).optional(),
});

async function write(req: NextRequest, requireId: boolean) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail("invalid", 400);
  if (requireId && !parsed.data.id) return fail("id_required", 400);
  try {
    return ok(await upsertCalendarEvent(user, parsed.data));
  } catch (e) {
    return failFrom(e);
  }
}

export async function POST(req: NextRequest) {
  return write(req, false);
}

export async function PATCH(req: NextRequest) {
  return write(req, true);
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id) return fail("id_required", 400);
  try {
    await deleteCalendarEvent(user, id);
    return ok({ ok: true });
  } catch (e) {
    return failFrom(e);
  }
}
