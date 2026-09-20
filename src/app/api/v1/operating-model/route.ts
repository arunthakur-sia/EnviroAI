// CR08 10.2: the Operating Model. GET the whole model, or one section with
// ?section=principles|governance|processes|raci|calendar|interfaces|kpis
// (&year=2026 for the calendar).
import { NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import {
  OPERATING_MODEL_SECTIONS,
  getOperatingModel,
  getOperatingModelSection,
  type OperatingModelSection,
} from "@/server/services/operating-model";
import { fail, ok } from "./_shared";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const yearRaw = Number(sp.get("year"));
  const year = Number.isInteger(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100 ? yearRaw : undefined;
  const section = sp.get("section");
  if (section) {
    if (!(OPERATING_MODEL_SECTIONS as readonly string[]).includes(section)) return fail("unknown_section", 400);
    return ok(await getOperatingModelSection(user, section as OperatingModelSection, { year }));
  }
  return ok(await getOperatingModel(user, { year }));
}
