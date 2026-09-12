import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { newId, nowIso } from "@/lib/ids";
import { record, notify } from "@/server/gamification/engine";
import { audit } from "@/server/auth/audit";
import { enqueue } from "@/server/jobs/queue";
import { isArabicText } from "@/lib/utils";

export async function createQuestion(
  user: CurrentUser,
  input: {
    title: string;
    body?: string;
    communityId?: string | null;
    classificationLevel?: number;
    aiAnswer?: {
      markdown: string;
      citationsJson: string;
      confidence: string;
    } | null;
  }
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!can(user, "create", "ask")) return { ok: false, error: "forbidden" };
  const isAr = isArabicText(input.title);
  const id = newId();
  await db.insert(schema.questions).values({
    id,
    authorId: user.id,
    titleEn: isAr ? "" : input.title,
    titleAr: isAr ? input.title : "",
    bodyEn: isAr ? null : (input.body ?? null),
    bodyAr: isAr ? (input.body ?? null) : null,
    langOriginal: isAr ? "ar" : "en",
    classificationLevel: input.classificationLevel ?? 2,
    departmentId: user.departmentId,
    status: input.aiAnswer ? "ai_answered" : "open",
    contextJson: input.communityId ? JSON.stringify({ communityId: input.communityId }) : null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  if (input.aiAnswer) {
    const answerId = newId();
    await db.insert(schema.answers).values({
      id: answerId,
      questionId: id,
      authorId: null,
      isAi: 1,
      bodyEn: isAr ? null : input.aiAnswer.markdown,
      bodyAr: isAr ? input.aiAnswer.markdown : null,
      citationsJson: input.aiAnswer.citationsJson,
      confidence: input.aiAnswer.confidence,
      createdAt: nowIso(),
    });
    await db.update(schema.questions).set({ aiAnswerId: answerId }).where(eq(schema.questions.id, id));
  }
  await record({
    userId: user.id,
    type: "question_asked",
    resourceType: "question",
    resourceId: id,
  });
  await audit(user.id, "ask", "question", id);
  await enqueue("embed_records", { resourceType: "question", resourceId: id });
  return { ok: true, id };
}

export async function postAnswer(
  user: CurrentUser,
  questionId: string,
  body: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!can(user, "create", "ask")) return { ok: false, error: "forbidden" };
  const [q] = await db.select().from(schema.questions).where(eq(schema.questions.id, questionId)).limit(1);
  if (!q) return { ok: false, error: "not_found" };
  const isAr = isArabicText(body);
  const id = newId();
  await db.insert(schema.answers).values({
    id,
    questionId,
    authorId: user.id,
    isAi: 0,
    bodyEn: isAr ? null : body,
    bodyAr: isAr ? body : null,
    createdAt: nowIso(),
  });
  await db
    .update(schema.questions)
    .set({ status: "answered", updatedAt: nowIso() })
    .where(eq(schema.questions.id, questionId));
  await record({
    userId: user.id,
    type: "answer_posted",
    resourceType: "answer",
    resourceId: id,
    meta: { departmentId: user.departmentId },
  });
  if (q.authorId !== user.id) {
    await notify(
      q.authorId,
      "answer",
      `Your question was answered: ${(q.titleEn || q.titleAr).slice(0, 60)}`,
      `تمت الإجابة عن سؤالك: ${(q.titleAr || q.titleEn).slice(0, 60)}`,
      `/ask/${questionId}`
    );
  }
  await audit(user.id, "answer", "question", questionId);
  return { ok: true, id };
}

export async function verifyAnswer(
  user: CurrentUser,
  answerId: string
): Promise<{ ok: boolean; error?: string }> {
  const [answer] = await db.select().from(schema.answers).where(eq(schema.answers.id, answerId)).limit(1);
  if (!answer) return { ok: false, error: "not_found" };
  const [q] = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.id, answer.questionId))
    .limit(1);
  if (!q) return { ok: false, error: "not_found" };
  if (!can(user, "verify", "ask", { departmentId: q.departmentId, classificationLevel: q.classificationLevel })) {
    return { ok: false, error: "forbidden" };
  }
  await db
    .update(schema.answers)
    .set({ isVerified: 1, verifiedBy: user.id, verifiedAt: nowIso() })
    .where(eq(schema.answers.id, answerId));
  await db
    .update(schema.questions)
    .set({ status: "verified", verifiedAnswerId: answerId, updatedAt: nowIso() })
    .where(eq(schema.questions.id, q.id));
  await record({
    userId: user.id,
    type: "content_verified",
    resourceType: "answer",
    resourceId: answerId,
    meta: { departmentId: user.departmentId },
  });
  if (answer.authorId && answer.authorId !== user.id) {
    await record({
      userId: answer.authorId,
      type: "answer_verified",
      resourceType: "answer",
      resourceId: answerId,
    });
    await notify(
      answer.authorId,
      "verify",
      "Your answer was verified",
      "تم توثيق إجابتك",
      `/ask/${q.id}`
    );
  }
  await audit(user.id, "verify", "answer", answerId);
  await enqueue("embed_records", { resourceType: "answer", resourceId: answerId });
  return { ok: true };
}

export async function markHelpful(user: CurrentUser, answerId: string): Promise<{ ok: boolean }> {
  const [answer] = await db.select().from(schema.answers).where(eq(schema.answers.id, answerId)).limit(1);
  if (!answer) return { ok: false };
  // once per user per answer
  const existing = await db
    .select({ id: schema.gameEvents.id })
    .from(schema.gameEvents)
    .where(
      and(
        eq(schema.gameEvents.userId, user.id),
        eq(schema.gameEvents.eventType, "helpful_given"),
        eq(schema.gameEvents.resourceId, answerId)
      )
    )
    .limit(1);
  if (existing.length) return { ok: true };
  await db
    .update(schema.answers)
    .set({ helpfulCount: sql`${schema.answers.helpfulCount} + 1` })
    .where(eq(schema.answers.id, answerId));
  // marker event for idempotency (0 points)
  await db.insert(schema.gameEvents).values({
    id: newId(),
    userId: user.id,
    eventType: "helpful_given",
    resourceType: "answer",
    resourceId: answerId,
    points: 0,
    multiplier: 1,
    createdAt: nowIso(),
  });
  if (answer.authorId && answer.helpfulCount < 25) {
    await record({
      userId: answer.authorId,
      type: "answer_marked_helpful",
      resourceType: "answer",
      resourceId: `${answerId}:${user.id}`,
    });
  }
  return { ok: true };
}

export async function routeToExpert(
  user: CurrentUser,
  input: { questionId?: string | null; expertId: string; reason?: string; queryText?: string }
): Promise<{ ok: boolean; questionId?: string; error?: string }> {
  let questionId = input.questionId ?? null;
  if (!questionId && input.queryText) {
    const created = await createQuestion(user, { title: input.queryText });
    if (!created.ok) return { ok: false, error: created.error };
    questionId = created.id!;
  }
  if (!questionId) return { ok: false, error: "question_required" };
  const [expert] = await db
    .select()
    .from(schema.experts)
    .where(eq(schema.experts.id, input.expertId))
    .limit(1);
  if (!expert) return { ok: false, error: "not_found" };
  await db.insert(schema.questionRoutes).values({
    id: newId(),
    questionId,
    expertId: input.expertId,
    reason: input.reason ?? null,
    status: "notified",
    createdAt: nowIso(),
  });
  await db
    .update(schema.questions)
    .set({ status: "routed", updatedAt: nowIso() })
    .where(eq(schema.questions.id, questionId));
  const notifyUserId = expert.userId ?? expert.ownerUserId;
  if (notifyUserId) {
    await notify(
      notifyUserId,
      "route",
      "A question was routed to you",
      "سؤال بانتظار خبرتك",
      `/ask/${questionId}`
    );
  }
  await audit(user.id, "route", "question", questionId, { expertId: input.expertId });
  return { ok: true, questionId };
}

export async function listQuestions(
  user: CurrentUser,
  filters: { status?: string[]; communityId?: string; limit?: number }
) {
  const conds = [sql`${schema.questions.classificationLevel} <= ${user.clearanceLevel}`];
  if (filters.status?.length) conds.push(inArray(schema.questions.status, filters.status));
  let rows = await db
    .select({
      id: schema.questions.id,
      titleEn: schema.questions.titleEn,
      titleAr: schema.questions.titleAr,
      status: schema.questions.status,
      langOriginal: schema.questions.langOriginal,
      viewCount: schema.questions.viewCount,
      bountyId: schema.questions.bountyId,
      contextJson: schema.questions.contextJson,
      createdAt: schema.questions.createdAt,
      authorNameEn: schema.users.nameEn,
      authorNameAr: schema.users.nameAr,
      authorColor: schema.users.avatarColor,
      answerCount: sql<number>`(select count(*) from answers a where a.question_id = ${schema.questions.id})`,
    })
    .from(schema.questions)
    .innerJoin(schema.users, eq(schema.users.id, schema.questions.authorId))
    .where(and(...conds))
    .orderBy(desc(schema.questions.createdAt))
    .limit(filters.limit ?? 40);
  if (filters.communityId) {
    rows = rows.filter((r) => {
      try {
        return JSON.parse(r.contextJson ?? "{}").communityId === filters.communityId;
      } catch {
        return false;
      }
    });
  }
  return rows;
}
