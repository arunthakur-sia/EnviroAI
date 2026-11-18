// GET /api/v1/ncec/datasets/[id] — a dataset's metadata and columns, filtered
// for the caller (ui-plan.md s3.3).
import { NextRequest, NextResponse } from "next/server";
import { getNcecPrincipal } from "@/server/ncec/principal";
import { getDatasetView } from "@/server/ncec/datasets";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const principal = await getNcecPrincipal();
  if (!principal) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  const { id } = await ctx.params;
  const data = await getDatasetView(principal, id);
  if (!data) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  return NextResponse.json({ data, error: null }, { headers: { "cache-control": "private, no-store" } });
}
