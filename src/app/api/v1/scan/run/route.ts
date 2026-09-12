// "Scan now": Knowledge Admins and Department Heads trigger a scan.
// Mock mode runs inline (fast, deterministic); live mode enqueues an immediate
// job so the request returns while briefs run in the worker.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { aiLive } from "@/server/ai/client";
import { runScan } from "@/server/scan";
import { enqueue } from "@/server/jobs/queue";
import { audit } from "@/server/auth/audit";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!(can(user, "verify", "foresight") || can(user, "manage", "foresight"))) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  await audit(user.id, "scan_now", "scan_run", undefined);
  if (await aiLive()) {
    await enqueue("scan_run", { userId: user.id });
    return NextResponse.json({ data: { queued: true }, error: null });
  }
  const result = await runScan({ trigger: "manual", userId: user.id });
  return NextResponse.json({ data: { queued: false, ...result }, error: null });
}
