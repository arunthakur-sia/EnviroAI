import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { hrScopeFor } from "@/server/services/hr";
import { audit } from "@/server/auth/audit";
import { record } from "@/server/gamification/engine";
import { newId, nowIso } from "@/lib/ids";

/* CR05 5.6.3: assign (or replace) a named backup owner for an owned item.
   backup_assigned points go to the owner (5, capped 25/day). */
const Body = z.union([
  z.object({
    resourceType: z.string().min(1),
    resourceId: z.string().min(1),
    backupUserId: z.string().min(1),
  }),
  // bulk: a named backup for every unbacked item a person owns
  z.object({
    forUserId: z.string().min(1),
    backupUserId: z.string().min(1),
  }),
]);

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });

  if ("forUserId" in parsed.data) {
    const scope = hrScopeFor(user);
    const isSelf = parsed.data.forUserId === user.id;
    if (!scope && !isSelf) {
      return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
    }
    const { buildInventory } = await import("@/server/services/hr");
    const inventory = await buildInventory();
    const items = (inventory.get(parsed.data.forUserId) ?? []).filter(
      (i) => i.itemKind !== "node_role"
    );
    const existing = await db.select().from(schema.ownershipBackups);
    const have = new Set(existing.map((e) => `${e.resourceType}:${e.resourceId}`));
    let created = 0;
    for (const i of items) {
      if (have.has(`${i.resourceType}:${i.resourceId}`)) continue;
      await db.insert(schema.ownershipBackups).values({
        id: newId(),
        resourceType: i.resourceType,
        resourceId: i.resourceId,
        backupUserId: parsed.data.backupUserId,
        setBy: user.id,
        setAt: nowIso(),
      });
      created++;
      if (created <= 5) {
        await record({
          userId: parsed.data.forUserId,
          type: "backup_assigned",
          resourceType: i.resourceType,
          resourceId: i.resourceId,
        });
      }
    }
    await audit(user.id, "backups_bulk_assigned", "user", parsed.data.forUserId, {
      created,
      backupUserId: parsed.data.backupUserId,
    });
    return NextResponse.json({ data: { created }, error: null });
  }

  const b = parsed.data;
  const scope = hrScopeFor(user);

  // the item's owner may set their own backup; otherwise HR scope is needed
  let ownerId: string | null = null;
  if (b.resourceType === "document") {
    const [d] = await db.select().from(schema.documents).where(eq(schema.documents.id, b.resourceId)).limit(1);
    ownerId = d?.ownerUserId ?? null;
  } else if (b.resourceType === "node") {
    const [n] = await db
      .select()
      .from(schema.strategyNodes)
      .where(eq(schema.strategyNodes.id, b.resourceId))
      .limit(1);
    ownerId = n?.ownerUserId ?? null;
  } else if (b.resourceType === "kpi") {
    const [k] = await db.select().from(schema.kpis).where(eq(schema.kpis.id, b.resourceId)).limit(1);
    ownerId = k?.ownerUserId ?? null;
  } else if (b.resourceType === "lesson") {
    const [l] = await db.select().from(schema.lessons).where(eq(schema.lessons.id, b.resourceId)).limit(1);
    ownerId = l?.authorId ?? null;
  } else if (b.resourceType === "collection") {
    const [c] = await db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.id, b.resourceId))
      .limit(1);
    ownerId = c?.ownerUserId ?? null;
  } else if (b.resourceType === "expert") {
    const [e] = await db.select().from(schema.experts).where(eq(schema.experts.id, b.resourceId)).limit(1);
    ownerId = e?.ownerUserId ?? null;
  }
  if (!scope && ownerId !== user.id) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }

  const [existing] = await db
    .select()
    .from(schema.ownershipBackups)
    .where(
      and(
        eq(schema.ownershipBackups.resourceType, b.resourceType),
        eq(schema.ownershipBackups.resourceId, b.resourceId)
      )
    )
    .limit(1);
  if (existing) {
    await db
      .update(schema.ownershipBackups)
      .set({ backupUserId: b.backupUserId, setBy: user.id, setAt: nowIso() })
      .where(eq(schema.ownershipBackups.id, existing.id));
  } else {
    await db.insert(schema.ownershipBackups).values({
      id: newId(),
      resourceType: b.resourceType,
      resourceId: b.resourceId,
      backupUserId: b.backupUserId,
      setBy: user.id,
      setAt: nowIso(),
    });
  }
  if (ownerId) {
    await record({
      userId: ownerId,
      type: "backup_assigned",
      resourceType: b.resourceType,
      resourceId: b.resourceId,
    });
  }
  await audit(user.id, "backup_assigned", b.resourceType, b.resourceId, {
    backupUserId: b.backupUserId,
  });
  return NextResponse.json({ data: { ok: true }, error: null });
}
