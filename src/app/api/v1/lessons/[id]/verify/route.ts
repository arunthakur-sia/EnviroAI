import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { nowIso } from "@/lib/ids";
import { record, notify } from "@/server/gamification/engine";
import { audit } from "@/server/auth/audit";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const [lesson] = await db.select().from(schema.lessons).where(eq(schema.lessons.id, id)).limit(1);
  if (!lesson) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  if (!can(user, "verify", "lessons", { classificationLevel: lesson.classificationLevel })) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  await db
    .update(schema.lessons)
    .set({ status: "verified", updatedAt: nowIso() })
    .where(eq(schema.lessons.id, id));
  await record({
    userId: user.id,
    type: "content_verified",
    resourceType: "lesson",
    resourceId: id,
    meta: { departmentId: user.departmentId },
  });
  if (lesson.authorId !== user.id) {
    await record({
      userId: lesson.authorId,
      type: "lesson_verified",
      resourceType: "lesson",
      resourceId: id,
    });
    // CR01 5.5: items born in Add Knowledge also award knowledge_verified
    const provenance = await db
      .select({ id: schema.relations.id })
      .from(schema.relations)
      .where(
        and(
          eq(schema.relations.fromType, "knowledge_submission"),
          eq(schema.relations.toType, "lesson"),
          eq(schema.relations.toId, id)
        )
      )
      .limit(1);
    if (provenance.length) {
      await record({
        userId: lesson.authorId,
        type: "knowledge_verified",
        resourceType: "lesson",
        resourceId: id,
      });
    }
    await notify(
      lesson.authorId,
      "verify",
      "Your lesson was verified",
      "تم توثيق درسك المستفاد",
      `/lessons/${id}`
    );
  }
  await audit(user.id, "verify", "lesson", id);
  return NextResponse.json({ data: { ok: true }, error: null });
}
