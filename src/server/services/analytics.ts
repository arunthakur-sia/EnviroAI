import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";

export async function analyticsSummary() {
  const now = Date.now();
  const dayAgo = new Date(now - 86400000).toISOString();
  const weekAgo = new Date(now - 7 * 86400000).toISOString();
  const monthAgo = new Date(now - 30 * 86400000).toISOString();

  const count = async (table: any, conds?: any) => {
    const rows = await db
      .select({ c: sql<number>`count(*)` })
      .from(table)
      .where(conds);
    return rows[0]?.c ?? 0;
  };

  const [dailyActive, weeklyActive] = await Promise.all([
    db
      .select({ c: sql<number>`count(distinct ${schema.auditLog.userId})` })
      .from(schema.auditLog)
      .where(gte(schema.auditLog.createdAt, dayAgo))
      .then((r) => r[0]?.c ?? 0),
    db
      .select({ c: sql<number>`count(distinct ${schema.auditLog.userId})` })
      .from(schema.auditLog)
      .where(gte(schema.auditLog.createdAt, weekAgo))
      .then((r) => r[0]?.c ?? 0),
  ]);

  // contributions per week by type over last 8 weeks
  const contributionEvents = await db
    .select({ type: schema.gameEvents.eventType, createdAt: schema.gameEvents.createdAt })
    .from(schema.gameEvents)
    .where(
      and(
        gte(schema.gameEvents.createdAt, new Date(now - 56 * 86400000).toISOString()),
        inArray(schema.gameEvents.eventType, [
          "document_uploaded",
          "answer_posted",
          "lesson_published",
          "content_verified",
          "kpi_value_entered",
          "status_update_posted",
        ])
      )
    );
  const weeks: Record<string, Record<string, number>> = {};
  for (const ev of contributionEvents) {
    const weekStart = new Date(ev.createdAt);
    weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
    const key = weekStart.toISOString().slice(0, 10);
    weeks[key] ??= {};
    weeks[key][ev.type] = (weeks[key][ev.type] ?? 0) + 1;
  }
  const contributionSeries = Object.entries(weeks)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, types]) => ({
      week,
      uploads: types.document_uploaded ?? 0,
      answers: types.answer_posted ?? 0,
      lessons: types.lesson_published ?? 0,
      verifications: types.content_verified ?? 0,
      other: (types.kpi_value_entered ?? 0) + (types.status_update_posted ?? 0),
    }));

  const [totalDocs, verifiedDocs, staleDocs] = await Promise.all([
    count(schema.documents, sql`${schema.documents.deletedAt} is null`),
    count(
      schema.documents,
      and(sql`${schema.documents.deletedAt} is null`, eq(schema.documents.status, "verified"))
    ),
    count(
      schema.documents,
      and(
        sql`${schema.documents.deletedAt} is null`,
        sql`${schema.documents.reviewDueAt} < ${new Date().toISOString()}`
      )
    ),
  ]);

  const zeroResults = await db
    .select({ query: schema.searchLog.query, c: sql<number>`count(*)` })
    .from(schema.searchLog)
    .where(and(eq(schema.searchLog.resultCount, 0), gte(schema.searchLog.createdAt, monthAgo)))
    .groupBy(schema.searchLog.query)
    .orderBy(desc(sql`count(*)`))
    .limit(20);

  const gaps = await count(schema.knowledgeGaps, eq(schema.knowledgeGaps.status, "open"));

  const topReused = await db
    .select({
      id: schema.documents.id,
      titleEn: schema.documents.titleEn,
      titleAr: schema.documents.titleAr,
      reuseCount: schema.documents.reuseCount,
      viewCount: schema.documents.viewCount,
    })
    .from(schema.documents)
    .where(sql`${schema.documents.deletedAt} is null`)
    .orderBy(desc(schema.documents.reuseCount), desc(schema.documents.viewCount))
    .limit(8);

  const askMessages = await db
    .select({ confidence: schema.aiMessages.confidence, c: sql<number>`count(*)` })
    .from(schema.aiMessages)
    .where(and(eq(schema.aiMessages.role, "assistant"), gte(schema.aiMessages.createdAt, monthAgo)))
    .groupBy(schema.aiMessages.confidence);

  const openRequests = await count(
    schema.expertRequests,
    eq(schema.expertRequests.status, "open")
  );

  const gamificationParticipants = await db
    .select({ c: sql<number>`count(distinct ${schema.gameEvents.userId})` })
    .from(schema.gameEvents)
    .where(gte(schema.gameEvents.createdAt, monthAgo))
    .then((r) => r[0]?.c ?? 0);

  return {
    dailyActive,
    weeklyActive,
    contributionSeries,
    totalDocs,
    verifiedDocs,
    verifiedRatio: totalDocs ? verifiedDocs / totalDocs : 0,
    staleDocs,
    zeroResults: zeroResults.map((z) => ({ query: z.query, count: z.c })),
    openGaps: gaps,
    topReused,
    askConfidence: askMessages.map((a) => ({ level: a.confidence ?? "unknown", count: a.c })),
    openExpertRequests: openRequests,
    gamificationParticipants,
  };
}
