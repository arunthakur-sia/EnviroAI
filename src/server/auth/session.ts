import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { cache } from "react";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { newId, nowIso } from "@/lib/ids";

export type SessionData = {
  sid?: string;
  userId?: string;
};

let secret: string | null = null;
export function sessionSecret(): string {
  if (secret) return secret;
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) {
    secret = process.env.SESSION_SECRET;
    return secret;
  }
  const file = path.resolve(process.cwd(), "data", "session-secret.txt");
  try {
    const existing = fs.readFileSync(file, "utf8").trim();
    if (existing.length >= 32) {
      secret = existing;
      return secret;
    }
  } catch {
    /* generate below */
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  secret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(file, secret);
  return secret;
}

const SESSION_OPTIONS = () => ({
  password: sessionSecret(),
  cookieName: "nexus_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false, // local prototype over http
    maxAge: 60 * 60 * 24 * 14,
  },
});

export async function getSession(): Promise<IronSession<SessionData>> {
  const store = await cookies();
  return getIronSession<SessionData>(store, SESSION_OPTIONS());
}

export type CurrentUser = typeof schema.users.$inferSelect & {
  role: typeof schema.roles.$inferSelect;
  department: typeof schema.departments.$inferSelect | null;
};

/** Loads the authenticated user with role and department. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session.sid || !session.userId) return null;
  const rows = await db
    .select()
    .from(schema.sessions)
    .where(
      and(eq(schema.sessions.id, session.sid), gt(schema.sessions.expiresAt, nowIso()))
    )
    .limit(1);
  if (!rows.length) return null;
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);
  if (!user || user.deletedAt) return null;
  const [role] = await db
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.id, user.roleId))
    .limit(1);
  if (!role) return null;
  let department = null;
  if (user.departmentId) {
    const deps = await db
      .select()
      .from(schema.departments)
      .where(eq(schema.departments.id, user.departmentId))
      .limit(1);
    department = deps[0] ?? null;
  }
  return { ...user, role, department };
});

export async function createSessionFor(
  userId: string,
  meta: { ip?: string; userAgent?: string } = {}
): Promise<void> {
  const sid = newId();
  const expires = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
  await db.insert(schema.sessions).values({
    id: sid,
    userId,
    expiresAt: expires,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
    createdAt: nowIso(),
  });
  await db
    .update(schema.users)
    .set({ lastLoginAt: nowIso() })
    .where(eq(schema.users.id, userId));
  const session = await getSession();
  session.sid = sid;
  session.userId = userId;
  await session.save();
}

export async function destroySession(): Promise<void> {
  const session = await getSession();
  if (session.sid) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, session.sid));
  }
  session.destroy();
}
