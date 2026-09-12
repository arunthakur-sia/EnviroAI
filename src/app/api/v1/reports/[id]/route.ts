// CR02 7: report status polling.
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { reportProgress } from "@/server/reports/generate";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const [row] = await db.select().from(schema.reports).where(eq(schema.reports.id, id)).limit(1);
  if (!row || row.createdBy !== user.id) {
    return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  }
  let itemCount = 0;
  try {
    itemCount = (JSON.parse(row.narrativeJson ?? "{}") as { itemCount?: number }).itemCount ?? 0;
  } catch {
    itemCount = 0;
  }
  return NextResponse.json({
    data: {
      id: row.id,
      status: row.status,
      title: row.title,
      progress: reportProgress.get(id) ?? null,
      itemCount,
      error: row.error,
      vaultDocumentId: row.vaultDocumentId,
    },
    error: null,
  });
}
