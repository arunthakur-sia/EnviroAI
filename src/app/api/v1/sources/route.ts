import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { ksaPortalAllowed } from "@/server/services/ksa-gate";
import { getSourcesPage } from "@/server/services/sources";

/* GET /api/v1/sources?category=&q=&access=&flagged=1
   The same shape the Source Library renders: items, verification notes, counts. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!ksaPortalAllowed(user, "sources")) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  const sp = req.nextUrl.searchParams;
  const data = await getSourcesPage({
    category: sp.get("category") ?? undefined,
    q: sp.get("q") ?? undefined,
    access: sp.get("access") ?? undefined,
    flagged: sp.get("flagged") === "1",
  });
  return NextResponse.json({ data, error: null });
}
