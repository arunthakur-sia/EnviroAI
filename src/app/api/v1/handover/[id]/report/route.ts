// CR08 6.4: downloads the handover report docx (?lang=en|ar).
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { getHandoverForViewer, reportFile } from "@/server/services/handover";
import { fail, forbidden, notFound, unauthorized } from "../../_shared";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const lang = req.nextUrl.searchParams.get("lang") === "ar" ? "ar" : "en";
  try {
    const detail = await getHandoverForViewer(user, id);
    if (!detail) return notFound();
    if (detail.viewer !== "admin") return forbidden();
    const file = await reportFile(id, lang);
    if (!file) return NextResponse.json({ data: null, error: "file_missing" }, { status: 404 });
    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="${encodeURIComponent(file.filename)}"`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
