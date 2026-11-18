// GET /api/v1/ncec/dashboards/environmental|sensitive|corporate — server-computed
// KPIs and chart series (ui-plan.md s3.3). The sensitive dashboard 404s for
// anyone without an active L3 grant, the same as a missing route.
import { NextRequest, NextResponse } from "next/server";
import { getNcecPrincipal } from "@/server/ncec/principal";
import { getEnvironmentalDashboard, getSensitiveDashboard } from "@/server/ncec/dashboards";
import { getCorporateDashboard } from "@/server/ncec/corporate";
import { todayIso } from "@/lib/ids";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const principal = await getNcecPrincipal();
  if (!principal) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  const { name } = await ctx.params;

  if (name === "environmental") {
    const data = await getEnvironmentalDashboard(todayIso());
    return NextResponse.json({ data, error: null }, { headers: { "cache-control": "private, no-store" } });
  }
  if (name === "corporate") {
    const data = await getCorporateDashboard(principal);
    return NextResponse.json({ data, error: null }, { headers: { "cache-control": "private, no-store" } });
  }
  if (name === "sensitive") {
    if (principal.grantedDatasetIds.length === 0) {
      return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
    }
    const data = await getSensitiveDashboard(principal);
    return NextResponse.json({ data, error: null }, { headers: { "cache-control": "private, no-store" } });
  }
  return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
}
