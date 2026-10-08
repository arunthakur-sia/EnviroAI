import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { audit } from "@/server/auth/audit";
import { getSetting } from "@/server/settings";
import { newId, nowIso } from "@/lib/ids";

/* CR05 6.3: invite-only onboarding. The Super Admin invites users (single or
   CSV); since there is no mail server locally, the invitation link is shown
   to the admin and logged. Tokens last 7 days. */

function isSuperAdmin(user: { role: { nameEn: string } }): boolean {
  return user.role.nameEn === "Super Admin";
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isSuperAdmin(user)) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const rows = await db
    .select()
    .from(schema.invitations)
    .orderBy(desc(schema.invitations.createdAt))
    .limit(100);
  const now = nowIso();
  return NextResponse.json({
    data: rows.map((r) => ({
      id: r.id,
      email: r.email,
      nameEn: r.nameEn,
      roleId: r.roleId,
      departmentId: r.departmentId,
      clearanceLevel: r.clearanceLevel,
      status: r.status === "pending" && r.expiresAt < now ? "expired" : r.status,
      expiresAt: r.expiresAt,
      acceptedAt: r.acceptedAt,
      link: r.status === "pending" && r.expiresAt >= now ? `/invite/${r.token}` : null,
    })),
    error: null,
  });
}

const InviteRow = z.object({
  email: z.string().email(),
  nameEn: z.string().min(2),
  nameAr: z.string().optional(),
  roleId: z.string().min(1),
  departmentId: z.string().nullable().optional(),
  clearanceLevel: z.number().int().min(1).max(4).default(2),
  portals: z.array(z.string()).optional(),
});

const Body = z.object({ invites: z.array(InviteRow).min(1).max(100) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isSuperAdmin(user)) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const allowed = await getSetting<string[]>("allowed_domains", ["enviroai.demo"]);
  const created: { email: string; link: string }[] = [];
  const rejected: { email: string; reason: string }[] = [];
  for (const row of parsed.data.invites) {
    const email = row.email.toLowerCase().trim();
    const domain = email.split("@")[1] ?? "";
    if (!allowed.includes(domain)) {
      rejected.push({ email, reason: "domain_not_allowed" });
      continue;
    }
    const [existingUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (existingUser) {
      rejected.push({ email, reason: "user_exists" });
      continue;
    }
    const token = crypto.randomBytes(24).toString("hex");
    await db.insert(schema.invitations).values({
      id: newId(),
      email,
      nameEn: row.nameEn,
      nameAr: row.nameAr ?? row.nameEn,
      roleId: row.roleId,
      departmentId: row.departmentId ?? null,
      clearanceLevel: row.clearanceLevel,
      portalsJson: row.portals ? JSON.stringify(row.portals) : null,
      token,
      invitedBy: user.id,
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      status: "pending",
    });
    // no local mail server: the link is surfaced to the admin and logged
    await audit(user.id, "invite_created", "invitation", email, { link: `/invite/${token}` });
    created.push({ email, link: `/invite/${token}` });
  }
  return NextResponse.json({ data: { created, rejected }, error: null });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isSuperAdmin(user)) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("id") ?? "";
  await db
    .update(schema.invitations)
    .set({ status: "revoked" })
    .where(eq(schema.invitations.id, id));
  await audit(user.id, "invite_revoked", "invitation", id);
  return NextResponse.json({ data: { ok: true }, error: null });
}
