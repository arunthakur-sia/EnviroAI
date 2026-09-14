import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { audit } from "@/server/auth/audit";
import { newId, nowIso } from "@/lib/ids";

/* CR05 4.8: the index register (Settings > Indices). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const rows = await db.select().from(schema.indices).orderBy(asc(schema.indices.code));
  const assumptions = await db.select().from(schema.indexForecastAssumptions);
  return NextResponse.json({ data: { indices: rows, assumptions }, error: null });
}

const CreateBody = z.object({
  code: z.string().min(2).max(12).regex(/^[a-z0-9-]+$/),
  nameEn: z.string().min(2),
  nameAr: z.string().min(1),
  publisher: z.string().optional(),
  publisherUrl: z.string().optional(),
  scale: z.enum(["rank", "score", "both"]).default("both"),
  scoreMin: z.number().optional(),
  scoreMax: z.number().optional(),
  higherIsBetter: z.boolean().default(true),
  frequency: z.string().default("annual"),
  category: z
    .enum(["economy", "governance", "society", "environment", "technology", "human"])
    .default("economy"),
  responsibleEntityId: z.string().optional(),
  linkedNodeIds: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const b = parsed.data;
  const [dupe] = await db
    .select()
    .from(schema.indices)
    .where(eq(schema.indices.code, b.code))
    .limit(1);
  if (dupe) return NextResponse.json({ data: null, error: "code_exists" }, { status: 409 });
  const id = newId();
  await db.insert(schema.indices).values({
    id,
    code: b.code,
    nameEn: b.nameEn,
    nameAr: b.nameAr,
    publisher: b.publisher ?? null,
    publisherUrl: b.publisherUrl ?? null,
    scale: b.scale,
    scoreMin: b.scoreMin ?? null,
    scoreMax: b.scoreMax ?? null,
    higherIsBetter: b.higherIsBetter ? 1 : 0,
    frequency: b.frequency,
    category: b.category,
    responsibleEntityId: b.responsibleEntityId ?? null,
    linkedNodeIdsJson: b.linkedNodeIds ? JSON.stringify(b.linkedNodeIds) : null,
    isActive: 1,
    sourceNotes: "Added in Settings > Indices; observations pending.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  await audit(user.id, "index_created", "index", id, { code: b.code });
  return NextResponse.json({ data: { id }, error: null });
}

const PatchBody = z.object({
  id: z.string().min(1),
  nameEn: z.string().optional(),
  nameAr: z.string().optional(),
  category: z
    .enum(["economy", "governance", "society", "environment", "technology", "human"])
    .optional(),
  responsibleEntityId: z.string().nullable().optional(),
  linkedNodeIds: z.array(z.string()).optional(),
  higherIsBetter: z.boolean().optional(),
  isActive: z.boolean().optional(),
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
  const [row] = await db.select().from(schema.indices).where(eq(schema.indices.id, b.id)).limit(1);
  if (!row) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  await db
    .update(schema.indices)
    .set({
      nameEn: b.nameEn ?? row.nameEn,
      nameAr: b.nameAr ?? row.nameAr,
      category: b.category ?? row.category,
      responsibleEntityId:
        b.responsibleEntityId === undefined ? row.responsibleEntityId : b.responsibleEntityId,
      linkedNodeIdsJson:
        b.linkedNodeIds === undefined ? row.linkedNodeIdsJson : JSON.stringify(b.linkedNodeIds),
      higherIsBetter:
        b.higherIsBetter === undefined ? row.higherIsBetter : b.higherIsBetter ? 1 : 0,
      isActive: b.isActive === undefined ? row.isActive : b.isActive ? 1 : 0,
      updatedAt: nowIso(),
    })
    .where(eq(schema.indices.id, b.id));
  await audit(user.id, "index_updated", "index", b.id);
  return NextResponse.json({ data: { ok: true }, error: null });
}
