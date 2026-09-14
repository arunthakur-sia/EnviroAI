import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser, destroySession } from "@/server/auth/session";
import { audit } from "@/server/auth/audit";

/* CR05 6.3: "sign out of all devices" on the profile. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
  await destroySession();
  await audit(user.id, "logout_all_devices", "user", user.id);
  return NextResponse.json({ data: { ok: true }, error: null });
}
