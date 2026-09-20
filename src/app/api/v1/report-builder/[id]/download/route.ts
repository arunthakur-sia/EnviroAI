// CR08 5.4: downloads the rendered docx of a module report, by language
// (?lang=en|ar; the primary edition when omitted).
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import { getCurrentUser } from "@/server/auth/session";
import { audit } from "@/server/auth/audit";
import { canUseReports, resolveDownload } from "@/server/services/reports";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!canUseReports(user)) return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  const result = await resolveDownload(user, id, req.nextUrl.searchParams.get("lang") ?? undefined);
  if (!result.ok) {
    const status = result.error === "docx_pending" ? 409 : 404;
    return NextResponse.json({ data: null, error: result.error }, { status });
  }
  const buf = await fs.readFile(result.absPath);
  await audit(user.id, "download", "report", id, { lang: result.lang });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${encodeURIComponent(result.filename)}"`,
    },
  });
}
