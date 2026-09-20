// CR08 7.2: "Refresh now" for administrators. Runs the materialisation in
// the request (a few thousand ledger rows, well under a second) so the button
// can report the row count, and audits the press.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { audit } from "@/server/auth/audit";
import { canRefreshLeaderboard, refreshLeaderboardsDetailed } from "@/server/services/leaderboard";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!canRefreshLeaderboard(user)) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const report = await refreshLeaderboardsDetailed();
  await audit(user.id, "refresh", "leaderboard", "all", { rows: report.rows });
  return NextResponse.json({ data: report, error: null });
}
