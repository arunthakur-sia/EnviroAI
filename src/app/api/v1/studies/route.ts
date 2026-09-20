import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { canSeePortal } from "@/server/auth/permissions";
import { getStudiesPage } from "@/server/services/studies";

/* CR08 2.2: GET /api/v1/studies?type=&topic=&outcome=&year=&q=
   The same shape the page renders: featured, shelves per year, facets. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!canSeePortal(user, "studies")) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  const sp = req.nextUrl.searchParams;
  const year = sp.get("year");
  const data = await getStudiesPage(user, {
    type: sp.get("type") ?? undefined,
    topic: sp.get("topic") ?? undefined,
    outcome: sp.get("outcome") ?? undefined,
    year: year && /^\d{4}$/.test(year) ? Number(year) : undefined,
    q: sp.get("q") ?? undefined,
  });
  return NextResponse.json({ data, error: null });
}
