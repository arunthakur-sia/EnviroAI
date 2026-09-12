import { NextRequest, NextResponse } from "next/server";
import { sql, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { getDocument } from "@/server/services/documents";
import { get as storageGet } from "@/server/storage";
import { audit } from "@/server/auth/audit";

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
  if (!doc.storagePath) return NextResponse.json({ data: null, error: "no_file" }, { status: 404 });

  const buf = await storageGet(doc.storagePath);
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  if (!inline) {
    await db
      .update(schema.documents)
      .set({ downloadCount: sql`${schema.documents.downloadCount} + 1` })
      .where(eq(schema.documents.id, id));
    await audit(user.id, "download", "document", id);
  }
  const filename = encodeURIComponent(doc.originalFilename ?? "document");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": doc.mime ?? "application/octet-stream",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${filename}`,
      "cache-control": "private, max-age=60",
    },
  });
}
