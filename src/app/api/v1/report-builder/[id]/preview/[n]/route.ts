// CR08 5.4: one page preview (PNG) of a module report, by index.
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import { getCurrentUser } from "@/server/auth/session";
import { canUseReports, resolvePreview } from "@/server/services/reports";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!canUseReports(user)) return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  const index = Number.parseInt(n, 10);
  if (!Number.isInteger(index) || index < 0) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  // the cover gallery asks for the small rendition of the first page
  const thumb = req.nextUrl.searchParams.get("thumb") === "1";
  const result = await resolvePreview(user, id, index, { thumb });
  if (!result.ok) return NextResponse.json({ data: null, error: result.error }, { status: 404 });
  const buf = await fs.readFile(result.absPath);
  const type = result.absPath.toLowerCase().endsWith(".jpg") || result.absPath.toLowerCase().endsWith(".jpeg") ? "image/jpeg" : "image/png";
  return new NextResponse(new Uint8Array(buf), {
    headers: { "content-type": type, "cache-control": "private, max-age=300" },
  });
}
