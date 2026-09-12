// CR02 7: downloads the generated docx.
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const [row] = await db.select().from(schema.reports).where(eq(schema.reports.id, id)).limit(1);
  if (!row || row.createdBy !== user.id || !row.filePath) {
    return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  }
  try {
    const buf = await fs.readFile(path.join(process.cwd(), "data", row.filePath));
    const name = `${(row.title || "report").replace(/[^\w؀-ۿ -]+/g, "").slice(0, 60)}.docx`;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="${encodeURIComponent(name)}"`,
      },
    });
  } catch {
    return NextResponse.json({ data: null, error: "file_missing" }, { status: 404 });
  }
}
