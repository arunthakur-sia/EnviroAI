import { NextResponse } from "next/server";
import { destroySession, getCurrentUser } from "@/server/auth/session";
import { audit } from "@/server/auth/audit";

export async function POST() {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await audit(user.id, "logout", "user", user.id);
  return NextResponse.json({ data: { ok: true }, error: null });
}
