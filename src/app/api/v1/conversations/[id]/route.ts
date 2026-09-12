// One conversation: PATCH share toggle / pin, DELETE remove.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { audit } from "@/server/auth/audit";
import { newId, nowIso } from "@/lib/ids";

const Body = z.object({
  share: z.boolean().optional(),
  pinToCollection: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const [conv] = await db
    .select()
    .from(schema.aiConversations)
    .where(eq(schema.aiConversations.id, id))
    .limit(1);
  if (!conv || conv.userId !== user.id) {
    return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });

  if (parsed.data.share !== undefined) {
    await db
      .update(schema.aiConversations)
      .set({ isShared: parsed.data.share ? 1 : 0 })
      .where(eq(schema.aiConversations.id, id));
    await audit(user.id, "edit", "ai_conversation", id, { shared: parsed.data.share });
  }
  if (parsed.data.pinToCollection) {
    const [collection] = await db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.id, parsed.data.pinToCollection))
      .limit(1);
    if (!collection) {
      return NextResponse.json({ data: null, error: "collection_not_found" }, { status: 404 });
    }
    await db.insert(schema.collectionItems).values({
      id: newId(),
      collectionId: collection.id,
      resourceType: "conversation",
      resourceId: id,
      addedBy: user.id,
      createdAt: nowIso(),
    });
    await audit(user.id, "edit", "collection", collection.id, { pinnedConversation: id });
  }
  return NextResponse.json({ data: { ok: true }, error: null });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const [conv] = await db
    .select()
    .from(schema.aiConversations)
    .where(eq(schema.aiConversations.id, id))
    .limit(1);
  if (!conv || conv.userId !== user.id) {
    return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  }
  await db.delete(schema.aiMessages).where(eq(schema.aiMessages.conversationId, id));
  await db.delete(schema.aiConversations).where(eq(schema.aiConversations.id, id));
  await audit(user.id, "delete", "ai_conversation", id);
  return NextResponse.json({ data: { ok: true }, error: null });
}
