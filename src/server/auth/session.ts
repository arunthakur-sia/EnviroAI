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

export type PermissionOverride = {
  permissionKey: string;
  effect: string;
  reason: string | null;
  setBy: string | null;
  setAt: string;
  expiresAt: string | null;
};

export type CurrentUser = typeof schema.users.$inferSelect & {
  role: typeof schema.roles.$inferSelect;
  department: typeof schema.departments.$inferSelect | null;
  /* CR05 6.2: unexpired per-user overrides */
  overrides: PermissionOverride[];
  /* CR05 6.4: set when a Super Admin previews as a role or user */
  previewing?: { byUserId: string; label: string } | null;
};

async function loadOverrides(userId: string): Promise<PermissionOverride[]> {
  const rows = await db
    .select()
    .from(schema.userPermissionOverrides)
    .where(eq(schema.userPermissionOverrides.userId, userId));
  const now = nowIso();
  return rows
    .filter((o) => !o.expiresAt || o.expiresAt > now)
    .map((o) => ({
      permissionKey: o.permissionKey,
      effect: o.effect,
      reason: o.reason,
      setBy: o.setBy,
      setAt: o.setAt,
      expiresAt: o.expiresAt,
    }));
}

async function hydrate(
  user: typeof schema.users.$inferSelect
): Promise<CurrentUser | null> {
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
  const overrides = await loadOverrides(user.id);
  return { ...user, role, department, overrides, previewing: null };
}

/** Loads the authenticated user with role, department, and overrides.
    CR05 6.3: sessions die after 12 hours of inactivity and 7 days absolute.
    CR05 6.4: a Super Admin with the preview cookie sees the app as the
    chosen role or user (read-only; the middleware blocks writes). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session.sid || !session.userId) return null;
  const now = nowIso();
  const rows = await db
    .select()
    .from(schema.sessions)
    .where(and(eq(schema.sessions.id, session.sid), gt(schema.sessions.expiresAt, now)))
    .limit(1);
  if (!rows.length) return null;
  const sess = rows[0];
  const lastSeen = sess.lastSeenAt ?? sess.createdAt;
  if (Date.parse(now) - Date.parse(lastSeen) > 12 * 3600 * 1000) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sess.id));
    return null;
  }
  // throttled activity stamp (at most one write per 5 minutes)
  if (Date.parse(now) - Date.parse(lastSeen) > 5 * 60 * 1000) {
    await db
      .update(schema.sessions)
      .set({ lastSeenAt: now })
      .where(eq(schema.sessions.id, sess.id));
  }
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);
  if (!user || user.deletedAt) return null;
  const real = await hydrate(user);
  if (!real) return null;

  /* preview-as (Super Admin only) */
  if (real.role.nameEn === "Super Admin") {
    try {
      const store = await cookies();
      const raw = store.get("nexus_preview")?.value;
      if (raw) {
        const preview = JSON.parse(raw) as { userId?: string; roleId?: string };
        if (preview.userId && preview.userId !== real.id) {
          const [target] = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, preview.userId))
            .limit(1);
          if (target && !target.deletedAt) {
            const hydrated = await hydrate(target);
            if (hydrated) {
              return {
                ...hydrated,
                previewing: { byUserId: real.id, label: target.nameEn },
              };
            }
          }
        } else if (preview.roleId) {
          const [role] = await db
            .select()
            .from(schema.roles)
            .where(eq(schema.roles.id, preview.roleId))
            .limit(1);
          if (role) {
            return {
              ...real,
              role,
              overrides: [],
              clearanceLevel: role.defaultClearance,
              departmentScope: role.defaultDepartmentScope,
              previewing: { byUserId: real.id, label: role.nameEn },
            };
          }
        }
      }
    } catch {
      /* a broken cookie never breaks login */
    }
  }
  return real;
});

/** Loads a user by id with role and department, for job contexts with no
    request session (CR02 report generation runs as the report's creator). */
export async function getUserById(userId: string): Promise<CurrentUser | null> {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!user || user.deletedAt) return null;
  return hydrate(user);
}

export async function createSessionFor(
  userId: string,
  meta: { ip?: string; userAgent?: string } = {}
): Promise<void> {
  const sid = newId();
  // CR05 6.3: 7 days absolute; the 12-hour inactivity window rides on
  // last_seen_at in getCurrentUser
  const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  await db.insert(schema.sessions).values({
    id: sid,
    userId,
    expiresAt: expires,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
    lastSeenAt: nowIso(),
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
