// Serves extracted content for the reader: html (docx) or text.
import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { getCurrentUser } from "@/server/auth/session";
import { getDocument } from "@/server/services/documents";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const { doc, allowed } = await getDocument(user, id);
  if (!doc) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });

  const kind = req.nextUrl.searchParams.get("kind") ?? "text";
  const dir = path.resolve(process.cwd(), "data", "uploads", id);
  try {
    if (kind === "html") {
      const html = await fs.readFile(path.join(dir, "extracted.html"), "utf8");
      return NextResponse.json({ data: { html }, error: null });
    }
    const text = await fs.readFile(path.join(dir, "extracted.txt"), "utf8");
    return NextResponse.json({ data: { text: text.slice(0, 400_000) }, error: null });
  } catch {
    return NextResponse.json({ data: { text: "", html: "" }, error: null });
  }
}
