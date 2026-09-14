import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { audit } from "@/server/auth/audit";
import { computeAllForecasts } from "@/server/indices/compute";

/* CR05 4.8: forecast recompute now (Settings > Indices). */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const done = await computeAllForecasts();
  await audit(user.id, "indices_forecasts_recomputed", "index", undefined, { count: done });
  return NextResponse.json({ data: { recomputed: done }, error: null });
}
