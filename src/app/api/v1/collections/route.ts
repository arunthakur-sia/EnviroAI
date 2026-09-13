import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { or, and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { newId, nowIso } from "@/lib/ids";
import { audit } from "@/server/auth/audit";

/* CR04 1.4: "Save to collection" from the book preview card. */
const AddItem = z.object({
  collectionId: z.string(),
  resourceType: z.enum(["document", "conversation", "lesson"]),
  resourceId: z.string(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = AddItem.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  }
  const [collection] = await db
    .select()
    .from(schema.collections)
    .where(eq(schema.collections.id, parsed.data.collectionId))
    .limit(1);
  if (!collection) {
    return NextResponse.json({ data: null, error: "collection_not_found" }, { status: 404 });
  }
  const [already] = await db
    .select({ id: schema.collectionItems.id })
    .from(schema.collectionItems)
    .where(
      and(
        eq(schema.collectionItems.collectionId, collection.id),
        eq(schema.collectionItems.resourceType, parsed.data.resourceType),
        eq(schema.collectionItems.resourceId, parsed.data.resourceId)
      )
    )
    .limit(1);
  if (already) return NextResponse.json({ data: { ok: true, duplicate: true }, error: null });
  await db.insert(schema.collectionItems).values({
    id: newId(),
    collectionId: collection.id,
    resourceType: parsed.data.resourceType,
    resourceId: parsed.data.resourceId,
    addedBy: user.id,
    createdAt: nowIso(),
  });
  await audit(user.id, "edit", "collection", collection.id, {
    added: `${parsed.data.resourceType}:${parsed.data.resourceId}`,
  });
  return NextResponse.json({ data: { ok: true }, error: null });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const rows = await db
    .select({
      id: schema.collections.id,
      nameEn: schema.collections.nameEn,
      nameAr: schema.collections.nameAr,
      visibility: schema.collections.visibility,
    })
    .from(schema.collections)
    .where(
      or(
        eq(schema.collections.visibility, "all"),
        eq(schema.collections.ownerUserId, user.id)
      )
    )
    .limit(50);
  return NextResponse.json({ data: rows, error: null });
}
