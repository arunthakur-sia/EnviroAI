// CR07 3.6: Settings > Organisation. Read the structure, add, rename, move,
// deactivate a unit, set its level and its head, assign members in bulk from a
// CSV of emails, and run the re-sync against npc.qa which shows a diff before
// anything is applied.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { audit } from "@/server/auth/audit";
import { newId, nowIso } from "@/lib/ids";
import { getOrgLevels, takeSnapshot } from "@/server/services/organisation";
import { readFile } from "node:fs/promises";
import path from "node:path";

function mayManage(user: Parameters<typeof can>[0]): boolean {
  return can(user, "manage", "settings") || can(user, "edit_any", "organisation");
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const view = req.nextUrl.searchParams.get("view");

  if (view === "sync") {
    if (!mayManage(user)) {
      return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ data: await buildSyncDiff(), error: null });
  }
  if (view === "runs") {
    const runs = await db
      .select()
      .from(schema.orgSyncRuns)
      .orderBy(asc(schema.orgSyncRuns.fetchedAt))
      .limit(20);
    return NextResponse.json({ data: runs, error: null });
  }

  const [units, users, members, levelDefs] = await Promise.all([
    db.select().from(schema.orgUnits).orderBy(asc(schema.orgUnits.sort)),
    db
      .select({
        id: schema.users.id,
        nameEn: schema.users.nameEn,
        nameAr: schema.users.nameAr,
        email: schema.users.email,
        departmentId: schema.users.departmentId,
      })
      .from(schema.users)
      .where(isNull(schema.users.deletedAt)),
    db.select().from(schema.orgUnitMembers),
    // CR08 1.2: the levels come from the editable org_levels table
    getOrgLevels(),
  ]);
  const counts = new Map<string, number>();
  for (const u of users) {
    if (!u.departmentId) continue;
    counts.set(u.departmentId, (counts.get(u.departmentId) ?? 0) + 1);
  }
  return NextResponse.json({
    data: {
      units: units.map((u) => ({
        id: u.id,
        code: u.code,
        nameEn: u.nameEn,
        nameAr: u.nameAr,
        level: u.level,
        parentId: u.parentId,
        headUserId: u.headUserId,
        headNameEn: u.headNameEn,
        headNameAr: u.headNameAr,
        headTitleEn: u.headTitleEn,
        headTitleAr: u.headTitleAr,
        // CR08 1.2: the editor's kebab edits the mandate and responsibilities
        mandateEn: u.mandateEn,
        mandateAr: u.mandateAr,
        responsibilitiesEn: u.responsibilitiesEn,
        responsibilitiesAr: u.responsibilitiesAr,
        sort: u.sort,
        isActive: u.isActive === 1,
        headcount: counts.get(u.id) ?? 0,
        memberCount: members.filter((m) => m.unitId === u.id).length,
      })),
      users,
      levels: levelDefs.map((l) => l.code),
      levelDefs,
      canManage: mayManage(user),
      // CR08 1.2: the structure editor itself is Super Admin only
      canEditStructure: can(user, "manage", "settings"),
    },
    error: null,
  });
}

const UnitBody = z.object({
  id: z.string().optional(),
  code: z.string().min(1).max(40).optional(),
  nameEn: z.string().min(1).max(300).optional(),
  nameAr: z.string().min(1).max(300).optional(),
  /** validated against org_levels in the handler */
  level: z.string().min(1).max(60).optional(),
  parentId: z.string().nullable().optional(),
  headUserId: z.string().nullable().optional(),
  headNameEn: z.string().max(200).nullable().optional(),
  headNameAr: z.string().max(200).nullable().optional(),
  headTitleEn: z.string().max(200).nullable().optional(),
  headTitleAr: z.string().max(200).nullable().optional(),
  sort: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

/** Add a unit. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!mayManage(user)) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = UnitBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  }
  const b = parsed.data;
  const { code, nameEn, nameAr } = b;
  if (!code || !nameEn || !nameAr) {
    return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  }
  if (b.level && !(await getOrgLevels()).some((l) => l.code === b.level)) {
    return NextResponse.json({ data: null, error: "unknown_level" }, { status: 400 });
  }
  const [clash] = await db
    .select()
    .from(schema.orgUnits)
    .where(eq(schema.orgUnits.code, code))
    .limit(1);
  if (clash) return NextResponse.json({ data: null, error: "code_taken" }, { status: 409 });
  const id = newId();
  await db.insert(schema.orgUnits).values({
    id,
    code,
    nameEn,
    nameAr,
    level: b.level ?? "department",
    parentId: b.parentId ?? null,
    headUserId: b.headUserId ?? null,
    headNameEn: b.headNameEn ?? null,
    headNameAr: b.headNameAr ?? null,
    headTitleEn: b.headTitleEn ?? null,
    headTitleAr: b.headTitleAr ?? null,
    sort: b.sort ?? 999,
    isActive: 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  await audit(user.id, "org_unit_created", "org_unit", id, { code });
  await takeSnapshot(user.id, `added ${code} ${nameEn}`.slice(0, 120));
  return NextResponse.json({ data: { id }, error: null });
}

/** Rename, move, set the level or the head, or deactivate. */
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!mayManage(user)) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = UnitBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !parsed.data.id) {
    return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  }
  const { id, isActive, ...rest } = parsed.data;
  if (rest.level && !(await getOrgLevels()).some((l) => l.code === rest.level)) {
    return NextResponse.json({ data: null, error: "unknown_level" }, { status: 400 });
  }
  // a unit cannot become its own ancestor
  if (rest.parentId) {
    const units = await db.select().from(schema.orgUnits);
    const byId = new Map(units.map((u) => [u.id, u]));
    let cursor = byId.get(rest.parentId);
    for (let i = 0; i < 12 && cursor; i++) {
      if (cursor.id === id) {
        return NextResponse.json({ data: null, error: "would_create_a_cycle" }, { status: 400 });
      }
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
  }
  await db
    .update(schema.orgUnits)
    .set({
      ...rest,
      ...(isActive === undefined ? {} : { isActive: isActive ? 1 : 0 }),
      updatedAt: nowIso(),
    })
    .where(eq(schema.orgUnits.id, id));
  await audit(user.id, "org_unit_edited", "org_unit", id, rest);
  await takeSnapshot(user.id, `edited unit ${id}`);
  return NextResponse.json({ data: { ok: true }, error: null });
}

const MembersBody = z.object({
  unitId: z.string().min(1),
  /** a CSV or newline separated list of email addresses */
  emails: z.string().min(3).max(20000),
  roleInUnit: z.enum(["head", "deputy", "member"]).default("member"),
});

/** Bulk member assignment from a CSV of emails. */
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!mayManage(user)) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = MembersBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const { unitId, emails, roleInUnit } = parsed.data;
  const [unit] = await db
    .select()
    .from(schema.orgUnits)
    .where(eq(schema.orgUnits.id, unitId))
    .limit(1);
  if (!unit) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });

  const wanted = [
    ...new Set(
      emails
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.includes("@"))
    ),
  ];
  if (!wanted.length) return NextResponse.json({ data: null, error: "no_emails" }, { status: 400 });
  const found = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(inArray(schema.users.email, wanted));
  const foundEmails = new Set(found.map((f) => f.email.toLowerCase()));
  const existing = await db
    .select()
    .from(schema.orgUnitMembers)
    .where(eq(schema.orgUnitMembers.unitId, unitId));
  const have = new Set(existing.map((m) => m.userId));

  let added = 0;
  for (const person of found) {
    if (!have.has(person.id)) {
      await db.insert(schema.orgUnitMembers).values({
        id: newId(),
        unitId,
        userId: person.id,
        roleInUnit,
        since: nowIso().slice(0, 10),
        createdAt: nowIso(),
      });
      added++;
    }
    // the unit becomes the person's department so every other module follows
    await db
      .update(schema.users)
      .set({ departmentId: unitId, updatedAt: nowIso() })
      .where(eq(schema.users.id, person.id));
    if (roleInUnit === "head") {
      await db
        .update(schema.orgUnits)
        .set({ headUserId: person.id, updatedAt: nowIso() })
        .where(eq(schema.orgUnits.id, unitId));
    }
  }
  const unknown = wanted.filter((e) => !foundEmails.has(e));
  await audit(user.id, "org_members_assigned", "org_unit", unitId, { added, unknown: unknown.length });
  return NextResponse.json({ data: { added, matched: found.length, unknown }, error: null });
}

/* ------------------------------------------------------------------ */
/* CR07 3.6: re-sync from the website, diff first                       */
/* ------------------------------------------------------------------ */

type SyncChange = {
  code: string;
  kind: "new" | "renamed" | "mandate" | "head" | "removed";
  nameEn: string;
  nameAr: string;
  beforeEn?: string;
  afterEn?: string;
  beforeAr?: string;
  afterAr?: string;
};

async function buildSyncDiff(): Promise<{ changes: SyncChange[]; fetchedAt: string | null }> {
  let payload: { units: Record<string, string | null>[]; fetched_at?: string } | null = null;
  try {
    payload = JSON.parse(
      await readFile(path.join(process.cwd(), "sources", "org", "org-structure.json"), "utf8")
    );
  } catch {
    return { changes: [], fetchedAt: null };
  }
  if (!payload?.units?.length) return { changes: [], fetchedAt: null };
  const current = await db.select().from(schema.orgUnits);
  const byCode = new Map(current.map((u) => [u.code, u]));
  const changes: SyncChange[] = [];
  const seen = new Set<string>();

  for (const raw of payload.units) {
    const code = String(raw.code);
    seen.add(code);
    const existing = byCode.get(code);
    const nameEn = String(raw.name_en ?? "");
    const nameAr = String(raw.name_ar ?? "");
    if (!existing) {
      changes.push({ code, kind: "new", nameEn, nameAr });
      continue;
    }
    if (existing.nameEn !== nameEn || existing.nameAr !== nameAr) {
      changes.push({
        code,
        kind: "renamed",
        nameEn,
        nameAr,
        beforeEn: existing.nameEn,
        afterEn: nameEn,
        beforeAr: existing.nameAr,
        afterAr: nameAr,
      });
    }
    if ((existing.mandateEn ?? "") !== String(raw.mandate_en ?? "")) {
      changes.push({ code, kind: "mandate", nameEn, nameAr });
    }
    const headEn = raw.head_name_en ? String(raw.head_name_en) : null;
    if ((existing.headNameEn ?? null) !== headEn) {
      changes.push({
        code,
        kind: "head",
        nameEn,
        nameAr,
        beforeEn: existing.headNameEn ?? "",
        afterEn: headEn ?? "",
      });
    }
  }
  for (const unit of current) {
    if (!seen.has(unit.code)) {
      changes.push({ code: unit.code, kind: "removed", nameEn: unit.nameEn, nameAr: unit.nameAr });
    }
  }
  return { changes, fetchedAt: payload.fetched_at ?? null };
}

const ApplyBody = z.object({
  /** the codes the administrator ticked, with the change kind */
  apply: z.array(z.object({ code: z.string(), kind: z.string() })).max(300),
});

/** Applies only the ticked changes and records the run. */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!mayManage(user)) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = ApplyBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });

  let payload: { units: Record<string, string | null>[] } | null = null;
  try {
    payload = JSON.parse(
      await readFile(path.join(process.cwd(), "sources", "org", "org-structure.json"), "utf8")
    );
  } catch {
    return NextResponse.json({ data: null, error: "no_source" }, { status: 400 });
  }
  const source = new Map((payload?.units ?? []).map((u) => [String(u.code), u]));
  const current = await db.select().from(schema.orgUnits);
  const byCode = new Map(current.map((u) => [u.code, u]));
  let applied = 0;

  for (const change of parsed.data.apply) {
    const raw = source.get(change.code);
    const existing = byCode.get(change.code);
    if (change.kind === "new" && raw && !existing) {
      await db.insert(schema.orgUnits).values({
        id: newId(),
        code: change.code,
        nameEn: String(raw.name_en ?? change.code),
        nameAr: String(raw.name_ar ?? change.code),
        level: String(raw.level ?? "department"),
        parentId: raw.parent_code ? byCode.get(String(raw.parent_code))?.id ?? null : null,
        mandateEn: raw.mandate_en ? String(raw.mandate_en) : null,
        mandateAr: raw.mandate_ar ? String(raw.mandate_ar) : null,
        mandateSourceUrl: raw.source_url ? String(raw.source_url) : null,
        mandateSourceUrlAr: raw.source_url_ar ? String(raw.source_url_ar) : null,
        mandateFetchedAt: raw.fetched_at ? String(raw.fetched_at) : null,
        headNameEn: raw.head_name_en ? String(raw.head_name_en) : null,
        headNameAr: raw.head_name_ar ? String(raw.head_name_ar) : null,
        headTitleEn: raw.head_title_en ? String(raw.head_title_en) : null,
        headTitleAr: raw.head_title_ar ? String(raw.head_title_ar) : null,
        sort: 999,
        isActive: 1,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      applied++;
    } else if (raw && existing) {
      const patch: Record<string, unknown> = { updatedAt: nowIso() };
      if (change.kind === "renamed") {
        patch.nameEn = String(raw.name_en ?? existing.nameEn);
        patch.nameAr = String(raw.name_ar ?? existing.nameAr);
      }
      if (change.kind === "mandate") {
        patch.mandateEn = raw.mandate_en ? String(raw.mandate_en) : null;
        patch.mandateAr = raw.mandate_ar ? String(raw.mandate_ar) : null;
        patch.mandateFetchedAt = raw.fetched_at ? String(raw.fetched_at) : null;
      }
      if (change.kind === "head") {
        patch.headNameEn = raw.head_name_en ? String(raw.head_name_en) : null;
        patch.headNameAr = raw.head_name_ar ? String(raw.head_name_ar) : null;
        patch.headTitleEn = raw.head_title_en ? String(raw.head_title_en) : null;
        patch.headTitleAr = raw.head_title_ar ? String(raw.head_title_ar) : null;
      }
      if (change.kind === "removed") patch.isActive = 0;
      await db.update(schema.orgUnits).set(patch).where(eq(schema.orgUnits.id, existing.id));
      applied++;
    }
  }

  await db.insert(schema.orgSyncRuns).values({
    id: newId(),
    fetchedAt: nowIso(),
    diffJson: JSON.stringify(parsed.data.apply).slice(0, 8000),
    appliedBy: user.id,
    appliedAt: nowIso(),
  });
  await audit(user.id, "org_resync_applied", "org_unit", "structure", { applied });
  await takeSnapshot(user.id, `website re-sync: ${applied} changes applied`);
  return NextResponse.json({ data: { applied }, error: null });
}
