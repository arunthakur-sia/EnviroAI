import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { hashPassword, passwordPolicyError } from "@/server/auth/passwords";
import { createSessionFor } from "@/server/auth/session";
import { defaultPortalsForRole } from "@/server/auth/permissions";
import { audit } from "@/server/auth/audit";
import { newId, nowIso } from "@/lib/ids";

/* CR05 6.3: first login. The token confirms the email, the user sets a
   password meeting the policy and accepts the acceptable-use notice. */
const Body = z.object({
  token: z.string().min(10),
  password: z.string().min(1),
  acceptUse: z.literal(true),
  localePref: z.enum(["en", "ar"]).default("en"),
});

export async function GET(req: NextRequest) {
  // the accept page asks who the invite is for
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const [invite] = await db
    .select()
    .from(schema.invitations)
    .where(eq(schema.invitations.token, token))
    .limit(1);
  if (!invite || invite.status !== "pending" || invite.expiresAt < nowIso()) {
    return NextResponse.json({ data: null, error: "invalid_invite" }, { status: 404 });
  }
  return NextResponse.json({
    data: { email: invite.email, nameEn: invite.nameEn, nameAr: invite.nameAr },
    error: null,
  });
}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const { token, password } = parsed.data;
  const [invite] = await db
    .select()
    .from(schema.invitations)
    .where(eq(schema.invitations.token, token))
    .limit(1);
  if (!invite || invite.status !== "pending" || invite.expiresAt < nowIso()) {
    return NextResponse.json({ data: null, error: "invalid_invite" }, { status: 404 });
  }
  const policy = passwordPolicyError(password);
  if (policy) return NextResponse.json({ data: null, error: policy }, { status: 400 });
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, invite.email))
    .limit(1);
  if (existing) return NextResponse.json({ data: null, error: "user_exists" }, { status: 409 });

  const [role] = await db
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.id, invite.roleId))
    .limit(1);
  if (!role) return NextResponse.json({ data: null, error: "role_missing" }, { status: 400 });

  const userId = newId();
  await db.insert(schema.users).values({
    id: userId,
    email: invite.email,
    passwordHash: await hashPassword(password),
    nameEn: invite.nameEn ?? invite.email.split("@")[0],
    nameAr: invite.nameAr ?? invite.nameEn ?? invite.email.split("@")[0],
    avatarColor: "navy",
    departmentId: invite.departmentId,
    roleId: invite.roleId,
    clearanceLevel: invite.clearanceLevel,
    departmentScope: role.defaultDepartmentScope,
    localePref: parsed.data.localePref,
    passwordSetAt: nowIso(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  /* the invited portal set becomes per-user overrides relative to the role */
  try {
    const wanted: string[] = JSON.parse(invite.portalsJson ?? "null") ?? [];
    if (wanted.length) {
      const roleDefaults = new Set<string>(
        (() => {
          try {
            const stored = JSON.parse(role.portalsJson ?? "null");
            return Array.isArray(stored) ? stored : defaultPortalsForRole(role.nameEn);
          } catch {
            return defaultPortalsForRole(role.nameEn);
          }
        })()
      );
      const wantedSet = new Set(wanted);
      for (const p of wantedSet) {
        if (!roleDefaults.has(p)) {
          await db.insert(schema.userPermissionOverrides).values({
            id: newId(),
            userId,
            permissionKey: `portal:${p}`,
            effect: "grant",
            reason: "Invitation portal set",
            setBy: invite.invitedBy,
            setAt: nowIso(),
          });
        }
      }
      for (const p of roleDefaults) {
        if (!wantedSet.has(p)) {
          await db.insert(schema.userPermissionOverrides).values({
            id: newId(),
            userId,
            permissionKey: `portal:${p}`,
            effect: "deny",
            reason: "Invitation portal set",
            setBy: invite.invitedBy,
            setAt: nowIso(),
          });
        }
      }
    }
  } catch {
    /* no portal narrowing */
  }

  await db
    .update(schema.invitations)
    .set({ status: "accepted", acceptedAt: nowIso() })
    .where(eq(schema.invitations.id, invite.id));
  await audit(userId, "invite_accepted", "user", userId, { email: invite.email });
  await createSessionFor(userId, {
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  return NextResponse.json({ data: { id: userId }, error: null });
}
