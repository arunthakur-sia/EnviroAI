// GET /api/v1/ncec/catalogue?domain=core_environmental|corporate_support
// Datasets visible to the caller, per-layer field counts, locked flags
// (ui-plan.md s3.3). A caller with no NCEC access gets the same 404 a
// missing route would give (decision #2: no trace for public users).
import { NextRequest, NextResponse } from "next/server";
import { getNcecPrincipal } from "@/server/ncec/principal";
import { getCatalogue } from "@/server/ncec/catalogue";
import type { DatasetDomain } from "@/server/ncec/types";

export const dynamic = "force-dynamic";

function isDomain(v: string | null): v is DatasetDomain {
  return v === "core_environmental" || v === "corporate_support";
}

export async function GET(req: NextRequest) {
  const principal = await getNcecPrincipal();
  if (!principal) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  const domain = req.nextUrl.searchParams.get("domain");
  const data = await getCatalogue(principal, isDomain(domain) ? domain : undefined);
  return NextResponse.json({ data, error: null }, { headers: { "cache-control": "private, no-store" } });
}
