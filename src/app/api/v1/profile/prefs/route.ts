import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { nowIso } from "@/lib/ids";

/* CR03 1.1: small per-user UI preferences (Vault shelf collapse state and
   similar). PATCH merges the given keys into users.prefs_json. */

const MAX_BYTES = 8_000;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  let prefs: Record<string, unknown> = {};
  try {
    prefs = user.prefsJson ? JSON.parse(user.prefsJson) : {};
  } catch {
    prefs = {};
  }
  return NextResponse.json({ data: prefs, error: null });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  }
  let prefs: Record<string, unknown> = {};
  try {
    prefs = user.prefsJson ? JSON.parse(user.prefsJson) : {};
  } catch {
    prefs = {};
  }
  const merged = { ...prefs, ...body };
  const json = JSON.stringify(merged);
  if (json.length > MAX_BYTES) {
    return NextResponse.json({ data: null, error: "too_large" }, { status: 400 });
  }
  await db
    .update(schema.users)
    .set({ prefsJson: json, updatedAt: nowIso() })
    .where(eq(schema.users.id, user.id));
  return NextResponse.json({ data: merged, error: null });
}
