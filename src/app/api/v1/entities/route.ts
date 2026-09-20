import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq, like } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { audit } from "@/server/auth/audit";
import { newId, nowIso } from "@/lib/ids";

/* CR05 2.2: the entities register. GET lists (or searches with ?q=), POST
   creates, PATCH edits / merges duplicates / deactivates. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const includeInactive = req.nextUrl.searchParams.get("all") === "1";
  let rows = await db.select().from(schema.entities).orderBy(asc(schema.entities.nameEn));
  if (!includeInactive) rows = rows.filter((e) => e.isActive === 1 && !e.mergedIntoId);
  if (q) {
    const lower = q.toLowerCase();
    rows = rows.filter(
      (e) =>
        e.nameEn.toLowerCase().includes(lower) ||
        e.nameAr.includes(q) ||
        (e.shortNameEn ?? "").toLowerCase().includes(lower) ||
        (e.shortNameAr ?? "").includes(q)
    );
  }
  return NextResponse.json({ data: rows.slice(0, q ? 12 : 500), error: null });
}

const CreateBody = z.object({
  nameEn: z.string().min(2),
  nameAr: z.string().min(1).optional(),
  shortNameEn: z.string().optional(),
  shortNameAr: z.string().optional(),
  kind: z
    .enum(["ministry", "agency", "authority", "company", "international", "other"])
    .default("other"),
  website: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "create", "strategy") && !can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const b = parsed.data;
  const [existing] = await db
    .select()
    .from(schema.entities)
    .where(like(schema.entities.nameEn, b.nameEn))
    .limit(1);
  if (existing) return NextResponse.json({ data: existing, error: null });
  const id = newId();
  const row = {
    id,
    nameEn: b.nameEn,
    nameAr: b.nameAr ?? b.nameEn,
    shortNameEn: b.shortNameEn ?? b.nameEn,
    shortNameAr: b.shortNameAr ?? b.nameAr ?? b.nameEn,
    kind: b.kind,
    website: b.website ?? null,
    contactName: b.contactName ?? null,
    contactEmail: b.contactEmail ?? null,
    isActive: 1,
    // created without a human Arabic name: flag for review
    nameArMachine: b.nameAr ? 0 : 1,
    logoPath: null,
    mergedIntoId: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await db.insert(schema.entities).values(row);
  await audit(user.id, "entity_created", "entity", id, { nameEn: b.nameEn });
  return NextResponse.json({ data: row, error: null });
}

const PatchBody = z.object({
  id: z.string().min(1),
  action: z.enum(["update", "merge", "deactivate", "activate"]).default("update"),
  // update fields
  nameEn: z.string().optional(),
  nameAr: z.string().optional(),
  shortNameEn: z.string().optional(),
  shortNameAr: z.string().optional(),
  kind: z
    .enum(["ministry", "agency", "authority", "company", "international", "other"])
    .optional(),
  website: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  // merge target
  intoId: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const b = parsed.data;
  const [entity] = await db.select().from(schema.entities).where(eq(schema.entities.id, b.id)).limit(1);
  if (!entity) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });

  if (b.action === "merge") {
    if (!b.intoId || b.intoId === b.id) {
      return NextResponse.json({ data: null, error: "merge_target_required" }, { status: 400 });
    }
    const [target] = await db
      .select()
      .from(schema.entities)
      .where(eq(schema.entities.id, b.intoId))
      .limit(1);
    if (!target) return NextResponse.json({ data: null, error: "target_not_found" }, { status: 404 });
    // repoint leads, keep uniqueness by hand (a node may already carry the target)
    const leads = await db
      .select()
      .from(schema.nodeLeads)
      .where(eq(schema.nodeLeads.entityId, b.id));
    for (const l of leads) {
      const dupes = await db
        .select()
        .from(schema.nodeLeads)
        .where(eq(schema.nodeLeads.nodeId, l.nodeId));
      const already = dupes.some(
        (d) => d.entityId === b.intoId && d.role === l.role && d.id !== l.id
      );
      if (already) await db.delete(schema.nodeLeads).where(eq(schema.nodeLeads.id, l.id));
      else
        await db
          .update(schema.nodeLeads)
          .set({ entityId: b.intoId })
          .where(eq(schema.nodeLeads.id, l.id));
    }
    await db
      .update(schema.indices)
      .set({ responsibleEntityId: b.intoId })
      .where(eq(schema.indices.responsibleEntityId, b.id));
    await db
      .update(schema.entities)
      .set({ isActive: 0, mergedIntoId: b.intoId, updatedAt: nowIso() })
      .where(eq(schema.entities.id, b.id));
    await audit(user.id, "entity_merged", "entity", b.id, { intoId: b.intoId });
    return NextResponse.json({ data: { ok: true }, error: null });
  }

  if (b.action === "deactivate" || b.action === "activate") {
    await db
      .update(schema.entities)
      .set({ isActive: b.action === "activate" ? 1 : 0, updatedAt: nowIso() })
      .where(eq(schema.entities.id, b.id));
    await audit(user.id, `entity_${b.action}d`, "entity", b.id);
    return NextResponse.json({ data: { ok: true }, error: null });
  }

  await db
    .update(schema.entities)
    .set({
      nameEn: b.nameEn ?? entity.nameEn,
      nameAr: b.nameAr ?? entity.nameAr,
      shortNameEn: b.shortNameEn ?? entity.shortNameEn,
      shortNameAr: b.shortNameAr ?? entity.shortNameAr,
      kind: b.kind ?? entity.kind,
      website: b.website ?? entity.website,
      contactName: b.contactName ?? entity.contactName,
      contactEmail: b.contactEmail ?? entity.contactEmail,
      nameArMachine: b.nameAr ? 0 : entity.nameArMachine,
      updatedAt: nowIso(),
    })
    .where(eq(schema.entities.id, b.id));
  await audit(user.id, "entity_updated", "entity", b.id);
  const [updated] = await db.select().from(schema.entities).where(eq(schema.entities.id, b.id)).limit(1);
  return NextResponse.json({ data: updated, error: null });
}
