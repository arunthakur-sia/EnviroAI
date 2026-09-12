import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { inArray, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { newId, nowIso } from "@/lib/ids";
import { record } from "@/server/gamification/engine";
import { audit } from "@/server/auth/audit";
import { enqueue } from "@/server/jobs/queue";

const Body = z.object({
  title_en: z.string().default(""),
  title_ar: z.string().default(""),
  context_en: z.string().default(""),
  context_ar: z.string().default(""),
  learning_en: z.string().default(""),
  learning_ar: z.string().default(""),
  recommendation_en: z.string().default(""),
  recommendation_ar: z.string().default(""),
  outcome_code: z.string().nullable().default(null),
  topic_codes: z.array(z.string()).default([]),
  classification_level: z.number().min(1).max(4).default(2),
  node_id: z.string().nullable().default(null),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "create", "lessons")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const b = parsed.data;
  if (!b.title_en && !b.title_ar) {
    return NextResponse.json({ data: null, error: "title_required" }, { status: 400 });
  }
  const id = newId();
  await db.insert(schema.lessons).values({
    id,
    authorId: user.id,
    titleEn: b.title_en || b.title_ar,
    titleAr: b.title_ar || b.title_en,
    contextEn: b.context_en || null,
    contextAr: b.context_ar || null,
    learningEn: b.learning_en || null,
    learningAr: b.learning_ar || null,
    recommendationEn: b.recommendation_en || null,
    recommendationAr: b.recommendation_ar || null,
    nodeId: b.node_id,
    classificationLevel: b.classification_level,
    status: "published",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  // tags
  const codes = [...b.topic_codes, ...(b.outcome_code ? [b.outcome_code] : [])];
  if (codes.length) {
    const terms = await db
      .select({ id: schema.taxonomyTerms.id, code: schema.taxonomyTerms.code })
      .from(schema.taxonomyTerms)
      .where(inArray(schema.taxonomyTerms.code, codes));
    for (const term of terms) {
      await db.insert(schema.taggings).values({
        id: newId(),
        resourceType: "lesson",
        resourceId: id,
        termId: term.id,
        source: "human",
        createdBy: user.id,
        createdAt: nowIso(),
      });
    }
  }
  const game = await record({
    userId: user.id,
    type: "lesson_published",
    resourceType: "lesson",
    resourceId: id,
    meta: { departmentId: user.departmentId, outcomes: b.outcome_code ? [b.outcome_code] : [] },
  });
  await audit(user.id, "create", "lesson", id);
  await enqueue("embed_records", { resourceType: "lesson", resourceId: id });
  return NextResponse.json({ data: { id, points: game.points }, error: null });
}
