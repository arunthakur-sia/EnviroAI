import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { ksaPortalAllowed } from "@/server/services/ksa-gate";
import { getRegulatoryOverview } from "@/server/services/regulatory";

/* GET /api/v1/regulatory?regulator=MEWA&type=royal_decree
   The same shape the Regulatory Overview renders: regulators with computed
   counts, the timeline, and the (filtered) regulations. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!ksaPortalAllowed(user, "regulatory")) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  const sp = req.nextUrl.searchParams;
  const data = await getRegulatoryOverview({
    regulator: sp.get("regulator") ?? undefined,
    type: sp.get("type") ?? undefined,
  });
  return NextResponse.json({ data, error: null });
}
