// CR08 7.2: the board, read from the materialised leaderboard_periods table.
//   GET /api/v1/leaderboard?board=people|departments&window=week|month|quarter|year|all&category=overall|contributors|guardians|learners
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { canSeePortal } from "@/server/auth/permissions";
import { getLeaderboard } from "@/server/services/leaderboard";
import { isBoardKind, isCategory, isPeriodKind } from "@/lib/leaderboard-math";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!canSeePortal(user, "leaderboard")) {
    return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  }
  const sp = req.nextUrl.searchParams;
  const board = sp.get("board") ?? "people";
  const window = sp.get("window") ?? "month";
  const category = sp.get("category") ?? "overall";
  if (!isBoardKind(board) || !isPeriodKind(window) || !isCategory(category)) {
    return NextResponse.json({ data: null, error: "invalid_query" }, { status: 400 });
  }
  const view = await getLeaderboard(user, { board, window, category });
  return NextResponse.json({ data: view, error: null });
}
