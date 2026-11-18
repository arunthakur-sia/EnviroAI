// GET /api/v1/ncec/datasets/[id]/records?page=&size= — projected rows only
// (ui-plan.md s3.3). A locked dataset resolves with columns but zero rows,
// never with an error that would hint at what the dataset holds.
import { NextRequest, NextResponse } from "next/server";
import { getNcecPrincipal } from "@/server/ncec/principal";
import { getDatasetRecords } from "@/server/ncec/datasets";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const principal = await getNcecPrincipal();
  if (!principal) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("size")) || 25));
  const data = await getDatasetRecords(principal, id, page, pageSize);
  if (!data) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  return NextResponse.json({ data, error: null }, { headers: { "cache-control": "private, no-store" } });
}
