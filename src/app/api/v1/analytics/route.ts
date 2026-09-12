import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { analyticsSummary } from "@/server/services/analytics";
import { healthNarrative } from "@/server/ai";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user, "read", "analytics")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const summary = await analyticsSummary();
  return NextResponse.json({ data: summary, error: null });
}

export async function POST() {
  // KM health narrative, generated on demand
  const user = await getCurrentUser();
  if (!user || !can(user, "read", "analytics")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const summary = await analyticsSummary();
  const narrative = await healthNarrative({
    daily_active_users: summary.dailyActive,
    weekly_active_users: summary.weeklyActive,
    total_documents: summary.totalDocs,
    verified_ratio_pct: Math.round(summary.verifiedRatio * 100),
    stale_documents: summary.staleDocs,
    zero_result_searches_top: summary.zeroResults[0]?.query ?? "none",
    open_knowledge_gaps: summary.openGaps,
    open_expert_requests: summary.openExpertRequests,
    gamification_participants_30d: summary.gamificationParticipants,
  });
  return NextResponse.json({ data: narrative, error: null });
}
