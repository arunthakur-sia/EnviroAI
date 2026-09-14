import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull, like, or } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { audit } from "@/server/auth/audit";
import { loadStakeholdersFor } from "@/server/services/strategy";
import { newId, nowIso } from "@/lib/ids";

/* CR05 3.2: person search for the inline Add stakeholder (users and experts). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ data: [], error: null });
  const pattern = `%${q}%`;
  const [users, experts] = await Promise.all([
    db
      .select()
      .from(schema.users)
      .where(
        and(
          isNull(schema.users.deletedAt),
          or(
            like(schema.users.nameEn, pattern),
            like(schema.users.nameAr, pattern),
            like(schema.users.email, pattern)
          )
        )
      )
      .limit(6),
    db
      .select()
      .from(schema.experts)
      .where(or(like(schema.experts.nameEn, pattern), like(schema.experts.nameAr, pattern)))
      .limit(6),
  ]);
  const seenUserIds = new Set(users.map((u) => u.id));
  const data = [
    ...users.map((u) => ({
      kind: "user" as const,
      id: u.id,
      nameEn: u.nameEn,
      nameAr: u.nameAr,
      subtitleEn: u.positionEn ?? u.email,
      subtitleAr: u.positionAr ?? u.email,
    })),
    // experts who are also users appear once, as the internal person
    ...experts
      .filter((e) => !e.userId || !seenUserIds.has(e.userId))
      .map((e) => ({
        kind: "expert" as const,
        id: e.id,
        nameEn: e.nameEn,
        nameAr: e.nameAr,
        subtitleEn: e.organisationEn ?? e.positionEn ?? "Expert",
        subtitleAr: e.organisationAr ?? e.positionAr ?? "خبير",
      })),
  ].slice(0, 8);
  return NextResponse.json({ data, error: null });
}

const AddBody = z.object({
  nodeId: z.string().min(1),
  role: z.enum(["sponsor", "owner", "manager", "team", "expert", "external_partner"]),
  personKind: z.enum(["employee", "expert", "external_contact"]),
  userId: z.string().optional(),
  expertId: z.string().optional(),
  nameEn: z.string().optional(),
  nameAr: z.string().optional(),
  organisation: z.string().optional(),
  email: z.string().optional(),
  roleNoteEn: z.string().optional(),
  roleNoteAr: z.string().optional(),
  domainTermId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "create", "strategy")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = AddBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  }
  const b = parsed.data;
  if (!b.userId && !b.expertId && !b.nameEn) {
    return NextResponse.json({ data: null, error: "person_required" }, { status: 400 });
  }
  const id = newId();
  await db.insert(schema.nodeStakeholders).values({
    id,
    nodeId: b.nodeId,
    personKind: b.personKind,
    userId: b.userId ?? null,
    expertId: b.expertId ?? null,
    nameEn: b.nameEn ?? null,
    nameAr: b.nameAr ?? null,
    organisation: b.organisation ?? null,
    email: b.email ?? null,
    role: b.role,
    roleNoteEn: b.roleNoteEn ?? null,
    roleNoteAr: b.roleNoteAr ?? null,
    domainTermId: b.domainTermId ?? null,
    sinceDate: nowIso().slice(0, 10),
    sort: 50,
    createdAt: nowIso(),
  });
  await audit(user.id, "stakeholder_added", "node", b.nodeId, { role: b.role });
  const row = (await loadStakeholdersFor([b.nodeId])).get(b.nodeId)?.find((r) => r.id === id);
  return NextResponse.json({ data: row ?? null, error: null });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "edit_any", "strategy")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const [row] = await db
    .select()
    .from(schema.nodeStakeholders)
    .where(eq(schema.nodeStakeholders.id, id))
    .limit(1);
  if (!row) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  await db.delete(schema.nodeStakeholders).where(eq(schema.nodeStakeholders.id, id));
  await audit(user.id, "stakeholder_removed", "node", row.nodeId, { role: row.role });
  return NextResponse.json({ data: { ok: true }, error: null });
}
