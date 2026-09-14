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
  const normalized = email.toLowerCase().trim();

  // CR05 6.3: only allowed domains may sign in; the message stays neutral so
  // the domain policy is not probed through the login form
  const { getSetting } = await import("@/server/settings");
  const allowed = await getSetting<string[]>("allowed_domains", ["npc.qa"]);
  const domain = normalized.split("@")[1] ?? "";
  if (!allowed.includes(domain)) {
    await audit(null, "login_rejected_domain", "user", undefined, { email: normalized });
    return NextResponse.json(
      { data: null, error: "invalid_credentials" },
      { status: 401 }
    );
  }

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, normalized))
    .limit(1);

  // CR05 6.3: five failed attempts lock the account for 15 minutes
  const now = new Date();
  if (user && user.lockedUntil && new Date(user.lockedUntil) > now) {
    await audit(user.id, "login_locked", "user", user.id);
    return NextResponse.json({ data: null, error: "account_locked" }, { status: 401 });
  }

  if (!user || user.deletedAt || !(await verifyPassword(password, user.passwordHash))) {
    if (user && !user.deletedAt) {
      const fails = (user.failedLogins ?? 0) + 1;
      const locked = fails >= 5;
      await db
        .update(schema.users)
        .set({
          failedLogins: locked ? 0 : fails,
          lockedUntil: locked ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null,
        })
        .where(eq(schema.users.id, user.id));
      if (locked) await audit(user.id, "account_locked", "user", user.id, { fails });
    }
    await audit(user?.id ?? null, "login_failed", "user", user?.id, { email: normalized });
    return NextResponse.json(
      { data: null, error: "invalid_credentials" },
      { status: 401 }
    );
  }

  if (user.failedLogins || user.lockedUntil) {
    await db
      .update(schema.users)
      .set({ failedLogins: 0, lockedUntil: null })
      .where(eq(schema.users.id, user.id));
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
