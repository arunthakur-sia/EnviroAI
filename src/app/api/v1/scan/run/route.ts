// CR02 6: "Refresh signals" queues a scan run immediately; "Rescan" limits
// it to one brief (resolved from a brief id or an outcome filter). GET
// returns the latest run for the inline progress card.
import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { aiLive } from "@/server/ai/client";
import { runScan } from "@/server/scan";
import { enqueue } from "@/server/jobs/queue";
import { audit } from "@/server/auth/audit";

async function resolveBriefId(briefId?: string, outcome?: string): Promise<string | null> {
  if (briefId) return briefId;
  if (!outcome) return null;
  // outcome code (taxonomy) -> NDS3 outcome node -> a brief linked to it
  const { outcomeNodeMap } = await import("@/server/scan/extract");
  const nodeMap = await outcomeNodeMap();
  const nodeId = nodeMap.get(outcome);
  if (!nodeId) return null;
  const briefs = await db
    .select()
    .from(schema.scanBriefs)
    .where(eq(schema.scanBriefs.isActive, 1));
  const match = briefs.find((b) => {
    try {
      return (JSON.parse(b.nodeIdsJson ?? "[]") as string[]).includes(nodeId);
    } catch {
      return false;
    }
  });
  return match?.id ?? null;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!(can(user, "verify", "foresight") || can(user, "manage", "foresight"))) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { briefId?: string; outcome?: string };
  const briefId = await resolveBriefId(body.briefId, body.outcome);
  if ((body.briefId || body.outcome) && !briefId) {
    return NextResponse.json({ data: null, error: "no_brief_for_filter" }, { status: 404 });
  }
  await audit(user.id, "scan_now", "scan_run", briefId ?? undefined);
  if (await aiLive()) {
    await enqueue("scan_run", { userId: user.id, briefId, trigger: "manual" });
    return NextResponse.json({ data: { queued: true, briefId }, error: null });
  }
  const result = await runScan({ trigger: "manual", userId: user.id, briefId });
  return NextResponse.json({ data: { queued: false, briefId, ...result }, error: null });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const [latest] = await db
    .select()
    .from(schema.scanRuns)
    .orderBy(desc(schema.scanRuns.startedAt))
    .limit(1);
  const briefs = await db
    .select({ id: schema.scanBriefs.id })
    .from(schema.scanBriefs)
    .where(eq(schema.scanBriefs.isActive, 1));
  return NextResponse.json({
    data: latest
      ? {
          id: latest.id,
          status: latest.status,
          startedAt: latest.startedAt,
          finishedAt: latest.finishedAt,
          briefsRun: latest.briefsRun,
          totalBriefs: briefs.length,
          candidates: latest.candidates,
          acceptedNew: latest.acceptedNew,
          duplicates: latest.duplicates,
        }
      : null,
    error: null,
  });
}
