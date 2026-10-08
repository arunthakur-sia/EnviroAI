import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can, canSeePortal } from "@/server/auth/permissions";
import { audit } from "@/server/auth/audit";
import { newId } from "@/lib/ids";
import { getIndexGroups } from "@/server/services/indices";
import { GROUP_COLOUR_TOKENS } from "@/lib/sdg-colours";

/* CR08 4.1/4.3: the index groups. GET lists them (with member ids) for
   anyone who can see the Indices portal; POST is the Super Admin's group
   manager: create, update (rename in both languages, description, colour),
   reorder, archive or restore. Memberships live in ./members. */

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!canSeePortal(user, "indices")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const groups = await getIndexGroups(user);
  return NextResponse.json({ data: groups, error: null });
}

const Colour = z.enum(GROUP_COLOUR_TOKENS);

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    code: z
      .string()
      .regex(/^[a-z0-9_-]{2,32}$/)
      .optional(),
    nameEn: z.string().trim().min(2).max(80),
    nameAr: z.string().trim().min(1).max(80),
    descriptionEn: z.string().trim().max(600).optional(),
    descriptionAr: z.string().trim().max(600).optional(),
    colourToken: Colour.default("navy"),
  }),
  z.object({
    action: z.literal("update"),
    id: z.string().min(1),
    nameEn: z.string().trim().min(2).max(80).optional(),
    nameAr: z.string().trim().min(1).max(80).optional(),
    descriptionEn: z.string().trim().max(600).nullable().optional(),
    descriptionAr: z.string().trim().max(600).nullable().optional(),
    colourToken: Colour.optional(),
  }),
  z.object({
    action: z.literal("reorder"),
    ids: z.array(z.string().min(1)).min(1).max(100),
  }),
  z.object({
    action: z.literal("archive"),
    id: z.string().min(1),
    isActive: z.boolean(),
  }),
]);

function slugOf(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 28);
  return slug.length >= 2 ? slug : `group_${Date.now().toString(36)}`;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const b = parsed.data;

  if (b.action === "create") {
    const existing = await db.select().from(schema.indexGroups);
    let code = b.code ?? slugOf(b.nameEn);
    if (existing.some((g) => g.code === code)) {
      if (b.code) return NextResponse.json({ data: null, error: "code_exists" }, { status: 409 });
      let n = 2;
      while (existing.some((g) => g.code === `${code}_${n}`)) n++;
      code = `${code}_${n}`;
    }
    const id = newId();
    const sort = existing.reduce((m, g) => Math.max(m, g.sort), 0) + 1;
    await db.insert(schema.indexGroups).values({
      id,
      code,
      nameEn: b.nameEn,
      nameAr: b.nameAr,
      descriptionEn: b.descriptionEn || null,
      descriptionAr: b.descriptionAr || null,
      colourToken: b.colourToken,
      sort,
      isActive: 1,
    });
    await audit(user.id, "index_group_created", "index_group", id, { code });
    return NextResponse.json({ data: { id, code, sort }, error: null });
  }

  if (b.action === "update") {
    const [row] = await db
      .select()
      .from(schema.indexGroups)
      .where(eq(schema.indexGroups.id, b.id))
      .limit(1);
    if (!row) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
    await db
      .update(schema.indexGroups)
      .set({
        nameEn: b.nameEn ?? row.nameEn,
        nameAr: b.nameAr ?? row.nameAr,
        descriptionEn: b.descriptionEn === undefined ? row.descriptionEn : b.descriptionEn || null,
        descriptionAr: b.descriptionAr === undefined ? row.descriptionAr : b.descriptionAr || null,
        colourToken: b.colourToken ?? row.colourToken,
      })
      .where(eq(schema.indexGroups.id, b.id));
    await audit(user.id, "index_group_updated", "index_group", b.id);
    return NextResponse.json({ data: { ok: true }, error: null });
  }

  if (b.action === "reorder") {
    const rows = await db
      .select()
      .from(schema.indexGroups)
      .orderBy(asc(schema.indexGroups.sort), asc(schema.indexGroups.code));
    const known = new Set(rows.map((g) => g.id));
    const ordered = b.ids.filter((id) => known.has(id));
    if (!ordered.length) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
    // listed groups take the front in the given order; the rest keep theirs
    const rest = rows.filter((g) => !ordered.includes(g.id)).map((g) => g.id);
    const all = [...ordered, ...rest];
    for (let i = 0; i < all.length; i++) {
      await db
        .update(schema.indexGroups)
        .set({ sort: i + 1 })
        .where(eq(schema.indexGroups.id, all[i]));
    }
    await audit(user.id, "index_groups_reordered", "index_group", undefined, { ids: all });
    return NextResponse.json({ data: { ok: true, order: all }, error: null });
  }

  // archive / restore
  const [row] = await db
    .select()
    .from(schema.indexGroups)
    .where(eq(schema.indexGroups.id, b.id))
    .limit(1);
  if (!row) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  await db
    .update(schema.indexGroups)
    .set({ isActive: b.isActive ? 1 : 0 })
    .where(eq(schema.indexGroups.id, b.id));
  await audit(user.id, b.isActive ? "index_group_restored" : "index_group_archived", "index_group", b.id);
  return NextResponse.json({ data: { ok: true }, error: null });
}
