import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { verifyPassword } from "@/server/auth/passwords";
import { createSessionFor } from "@/server/auth/session";
import { audit } from "@/server/auth/audit";
import { record } from "@/server/gamification/engine";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: "Invalid request" },
      { status: 400 }
    );
  }
  const { email, password } = parsed.data;
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email.toLowerCase().trim()))
    .limit(1);
  if (!user || user.deletedAt || !(await verifyPassword(password, user.passwordHash))) {
    await audit(user?.id ?? null, "login_failed", "user", user?.id, { email });
    return NextResponse.json(
      { data: null, error: "invalid_credentials" },
      { status: 401 }
    );
  }
  await createSessionFor(user.id, {
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  await audit(user.id, "login", "user", user.id);
  await record({ userId: user.id, type: "daily_login" });
  return NextResponse.json({
    data: { id: user.id, localePref: user.localePref },
    error: null,
  });
}
