/**
 * The platform's health check. Opens the database, runs one trivial query and
 * answers 200, or 503 when the database cannot be read. No session, no AI, no
 * work that could make a healthy container look unhealthy: a health check that
 * does real work eventually restarts a server that was merely busy.
 *
 * It sits at /api/health rather than under /api/v1 because it is the
 * platform's contract, not the product's, and it is excluded from the
 * middleware in src/middleware.ts.
 */
import { NextResponse } from "next/server";
import { rawClient } from "@/server/db/client";
import { DATA_DIR } from "@/server/paths";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VERSION = process.env.npm_package_version ?? "1.0.0";

export async function GET() {
  try {
    await rawClient.execute("SELECT 1");
    return NextResponse.json(
      { ok: true, version: VERSION, dataDir: DATA_DIR },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        version: VERSION,
        dataDir: DATA_DIR,
        error: String((e as Error)?.message ?? e).slice(0, 200),
      },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }
}
