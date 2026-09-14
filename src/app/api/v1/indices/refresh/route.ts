import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { audit } from "@/server/auth/audit";
import { enqueue } from "@/server/jobs/queue";

/* CR05 4.4/4.8: Refresh data (permissioned) runs the fetch as a job. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  await enqueue("indices_fetch", {});
  await audit(user.id, "indices_refresh_queued", "index", undefined);
  return NextResponse.json({ data: { queued: true }, error: null });
}
