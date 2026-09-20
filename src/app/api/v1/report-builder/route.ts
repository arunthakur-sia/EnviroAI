// CR08 5.4: the Reports module. GET lists the types, the section library and
// the reports the caller may see; POST creates a request and queues the
// build job.
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { enqueue } from "@/server/jobs/queue";
import {
  canUseReports,
  createReportRequest,
  listModuleReports,
  listReportTypes,
  listSectionLibrary,
} from "@/server/services/reports";

const STATUS_OF: Record<string, number> = { forbidden: 403, not_found: 404, invalid: 400 };

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!canUseReports(user)) return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const [types, reports] = await Promise.all([
    listReportTypes(user),
    listModuleReports(user, {
      status: sp.get("status") ?? undefined,
      typeCode: sp.get("type") ?? undefined,
      scopeKind: sp.get("scope") ?? undefined,
      mine: sp.get("mine") === "1",
    }),
  ]);
  return NextResponse.json({ data: { types, library: listSectionLibrary(), reports }, error: null });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!canUseReports(user)) return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const result = await createReportRequest(user, body);
  if (!result.ok) {
    return NextResponse.json({ data: null, error: result.error, detail: result.detail ?? null }, { status: STATUS_OF[result.error] ?? 400 });
  }
  await enqueue("report_build", { reportId: result.id });
  return NextResponse.json({ data: { id: result.id, titleEn: result.titleEn, titleAr: result.titleAr, sectionCodes: result.sectionCodes }, error: null });
}
