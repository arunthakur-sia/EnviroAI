import { and, desc, eq, gte, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { newId, nowIso, todayIso } from "@/lib/ids";
import { parseJson, Breadth } from "@/server/db/json";
import { getFlags, getSetting } from "@/server/settings";
import { toShelfDocs } from "./documents";
import { whatChanged } from "@/server/ai";
import { CONTRIBUTION_TYPES } from "@/server/gamification/engine";

let whatChangedCache: { value: Awaited<ReturnType<typeof whatChanged>> | null; at: number } | null = null;
const WHAT_CHANGED_TTL = 15 * 60 * 1000;

async function cachedWhatChanged() {
  if (whatChangedCache && Date.now() - whatChangedCache.at < WHAT_CHANGED_TTL) {
    return whatChangedCache.value;
  }
  let changed: Awaited<ReturnType<typeof whatChanged>> | null = null;
  const [nds3] = await db
    .select()
    .from(schema.strategyEditions)
    .where(eq(schema.strategyEditions.code, "nds3"))
    .limit(1);
  if (nds3) {
    const nodeIds = (
      await db
        .select({ id: schema.strategyNodes.id })
        .from(schema.strategyNodes)
        .where(eq(schema.strategyNodes.editionId, nds3.id))
    ).map((n) => n.id);
    changed = await whatChanged(nodeIds, 7);
    if (!changed.highlights.length) changed = await whatChanged(nodeIds, 90);
  }
  whatChangedCache = { value: changed, at: Date.now() };
  return changed;
}

/* CR02 1.3.3: the old "For you" list becomes notifications. Materialised at
   most once per user per day; each pick dedupes on (user, link) so the bell
   never repeats an item. */
async function materializeForYouNotifications(user: CurrentUser) {
  const today = todayIso();
  const [already] = await db
    .select({ id: schema.notifications.id })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, user.id),
        eq(schema.notifications.kind, "for_you"),
        gte(schema.notifications.createdAt, today + "T00:00:00.000Z")
      )
    )
    .limit(1);
  if (already) return;

  const picks: {
    titleEn: string;
    titleAr: string;
    bodyEn: string;
    bodyAr: string;
    link: string;
  }[] = [];

  const releases = await db
    .select()
    .from(schema.releases)
    .where(sql`${schema.releases.releaseDate} <= ${today}`)
    .orderBy(desc(schema.releases.releaseDate))
    .limit(1);
  if (releases[0]) {
    picks.push({
      titleEn: releases[0].titleEn,
      titleAr: releases[0].titleAr,
      bodyEn: "New in Statistics",
      bodyAr: "جديد في الإحصاءات",
      link: "/statistics/releases",
    });
  }

  const [expert] = await db
    .select({ id: schema.experts.id })
    .from(schema.experts)
    .where(eq(schema.experts.userId, user.id))
    .limit(1);
  let routedQuestion: { id: string; titleEn: string; titleAr: string } | null = null;
  if (expert) {
    const [route] = await db
      .select({
        id: schema.questions.id,
        titleEn: schema.questions.titleEn,
        titleAr: schema.questions.titleAr,
      })
      .from(schema.questionRoutes)
      .innerJoin(schema.questions, eq(schema.questions.id, schema.questionRoutes.questionId))
      .where(
        and(
          eq(schema.questionRoutes.expertId, expert.id),
          inArray(schema.questionRoutes.status, ["notified", "accepted"])
        )
      )
      .orderBy(desc(schema.questionRoutes.createdAt))
      .limit(1);
    routedQuestion = route ?? null;
  }
  if (!routedQuestion) {
    const [openQ] = await db
      .select({ id: schema.questions.id, titleEn: schema.questions.titleEn, titleAr: schema.questions.titleAr })
      .from(schema.questions)
      .where(
        and(
          eq(schema.questions.status, "open"),
          sql`${schema.questions.classificationLevel} <= ${user.clearanceLevel}`
        )
      )
      .orderBy(desc(schema.questions.createdAt))
      .limit(1);
    routedQuestion = openQ ?? null;
  }
  if (routedQuestion) {
    picks.push({
      titleEn: routedQuestion.titleEn || routedQuestion.titleAr,
      titleAr: routedQuestion.titleAr || routedQuestion.titleEn,
      bodyEn: "An answer is waiting for your expertise",
      bodyAr: "إجابة بانتظار خبرتك",
      link: `/ask/${routedQuestion.id}`,
    });
  }

  const viewedIds = (
    await db
      .select({ resourceId: schema.auditLog.resourceId })
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.userId, user.id),
          eq(schema.auditLog.action, "view"),
          eq(schema.auditLog.resourceType, "document")
        )
      )
      .limit(500)
  )
    .map((v) => v.resourceId)
    .filter(Boolean) as string[];
  const unseenConds = [
    eq(schema.documents.status, "verified"),
    isNull(schema.documents.deletedAt),
    sql`${schema.documents.classificationLevel} <= ${user.clearanceLevel}`,
  ];
  if (viewedIds.length) unseenConds.push(notInArray(schema.documents.id, viewedIds));
  const [unseenDoc] = await db
    .select()
    .from(schema.documents)
    .where(and(...unseenConds))
    .orderBy(desc(schema.documents.createdAt))
    .limit(1);
  if (unseenDoc) {
    picks.push({
      titleEn: unseenDoc.titleEn,
      titleAr: unseenDoc.titleAr || unseenDoc.titleEn,
      bodyEn: "Verified and unread by you",
      bodyAr: "موثقة ولم تقرأها بعد",
      link: `/vault/${unseenDoc.id}`,
    });
  }

  if (!picks.length) return;
  const existing = await db
    .select({ link: schema.notifications.link })
    .from(schema.notifications)
    .where(
      and(eq(schema.notifications.userId, user.id), eq(schema.notifications.kind, "for_you"))
    );
  const seenLinks = new Set(existing.map((e) => e.link));
  const fresh = picks.filter((p) => !seenLinks.has(p.link));
  if (!fresh.length) return;
  await db.insert(schema.notifications).values(
    fresh.map((p) => ({
      id: newId(),
      userId: user.id,
      kind: "for_you",
      titleEn: p.titleEn,
      titleAr: p.titleAr,
      bodyEn: p.bodyEn,
      bodyAr: p.bodyAr,
      link: p.link,
      readAt: null,
      createdAt: nowIso(),
    }))
  );
}

function isoWeekStart(): string {
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
  return monday.toISOString();
}

export async function getHomeData(user: CurrentUser) {
  const today = todayIso();
  const flags = await getFlags();

  try {
    await materializeForYouNotifications(user);
  } catch {
    /* best effort; the bell just stays as it was */
  }

  /* Word of the day: rotate by day-of-year */
  const words = await db.select().from(schema.wordOfDay);
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const word = words.length ? words[dayOfYear % words.length] : null;

  /* Daily card: today's, else the latest past card */
  const [cardToday] = await db
    .select()
    .from(schema.dailyCards)
    .where(eq(schema.dailyCards.date, today))
    .limit(1);
  let card = cardToday ?? null;
  if (!card) {
    const [latest] = await db
      .select()
      .from(schema.dailyCards)
      .where(sql`${schema.dailyCards.date} <= ${today}`)
      .orderBy(desc(schema.dailyCards.date))
      .limit(1);
    card = latest ?? null;
  }
  let cardAnswer: { chosenIndex: number; isCorrect: boolean } | null = null;
  if (card) {
    const [ans] = await db
      .select()
      .from(schema.dailyCardAnswers)
      .where(
        and(eq(schema.dailyCardAnswers.userId, user.id), eq(schema.dailyCardAnswers.cardId, card.id))
      )
      .limit(1);
    if (ans) cardAnswer = { chosenIndex: ans.chosenIndex, isCorrect: ans.isCorrect === 1 };
  }
  const cardIndicator = card?.indicatorId
    ? (
        await db
          .select({ id: schema.indicators.id, nameEn: schema.indicators.nameEn, nameAr: schema.indicators.nameAr })
          .from(schema.indicators)
          .where(eq(schema.indicators.id, card.indicatorId))
          .limit(1)
      )[0] ?? null
    : null;

  /* What changed in NDS3 this week (cached: the live model call is slow) */
  const changed = await cachedWhatChanged();

  /* CR02 1.4: latest podcast episode within clearance */
  const [latestEpisode] = await db
    .select()
    .from(schema.podcastEpisodes)
    .where(
      and(
        eq(schema.podcastEpisodes.status, "published"),
        sql`${schema.podcastEpisodes.classificationLevel} <= ${user.clearanceLevel}`
      )
    )
    .orderBy(desc(schema.podcastEpisodes.createdAt))
    .limit(1);
  let episodeSource: { en: string; ar: string } | null = null;
  if (latestEpisode?.sourceScopeJson) {
    try {
      const scope = JSON.parse(latestEpisode.sourceScopeJson) as {
        labelEn?: string;
        labelAr?: string;
      };
      if (scope.labelEn || scope.labelAr) {
        episodeSource = { en: scope.labelEn ?? "", ar: scope.labelAr ?? "" };
      }
    } catch {
      /* no source label */
    }
  }

  /* CR02 1.3: four latest lessons with category and primary node */
  const lessons = await db
    .select()
    .from(schema.lessons)
    .where(
      and(
        inArray(schema.lessons.status, ["published", "verified"]),
        sql`${schema.lessons.classificationLevel} <= ${user.clearanceLevel}`
      )
    )
    .orderBy(desc(schema.lessons.createdAt))
    .limit(4);
  const lessonNodeIds = lessons.map((l) => l.nodeId).filter(Boolean) as string[];
  const lessonNodes = lessonNodeIds.length
    ? await db
        .select({
          id: schema.strategyNodes.id,
          code: schema.strategyNodes.code,
          titleEn: schema.strategyNodes.titleEn,
          titleAr: schema.strategyNodes.titleAr,
        })
        .from(schema.strategyNodes)
        .where(inArray(schema.strategyNodes.id, lessonNodeIds))
    : [];

  /* CR02 1.5: progress panel data */
  const [state] = await db
    .select()
    .from(schema.userGameState)
    .where(eq(schema.userGameState.userId, user.id))
    .limit(1);
  const breadth = parseJson(Breadth, state?.breadthJson, {});
  const levels = await db.select().from(schema.levels).orderBy(schema.levels.order);
  const points = state?.totalPoints ?? 0;
  const level = levels.filter((l) => l.minPoints <= points).pop() ?? null;
  const nextLevel = levels.find((l) => l.minPoints > points) ?? null;
  const outcomes = await db
    .select({
      code: schema.taxonomyTerms.code,
      nameEn: schema.taxonomyTerms.nameEn,
      nameAr: schema.taxonomyTerms.nameAr,
    })
    .from(schema.taxonomyTerms)
    .innerJoin(
      schema.taxonomyDimensions,
      eq(schema.taxonomyDimensions.id, schema.taxonomyTerms.dimensionId)
    )
    .where(eq(schema.taxonomyDimensions.code, "outcome"))
    .orderBy(schema.taxonomyTerms.sort);
  const weekEvents = await db
    .select({ eventType: schema.gameEvents.eventType })
    .from(schema.gameEvents)
    .where(
      and(eq(schema.gameEvents.userId, user.id), gte(schema.gameEvents.createdAt, isoWeekStart()))
    );
  const contributionsThisWeek = weekEvents.filter((e) =>
    CONTRIBUTION_TYPES.has(e.eventType)
  ).length;

  /* CR01 3.2: example questions for the Home ask box + today's conversation */
  const exampleQuestions = await getSetting<{ en: string; ar: string }[]>(
    "example_questions",
    []
  );
  const [todayConv] = await db
    .select({ id: schema.aiConversations.id, title: schema.aiConversations.title })
    .from(schema.aiConversations)
    .where(
      and(
        eq(schema.aiConversations.userId, user.id),
        sql`${schema.aiConversations.updatedAt} >= ${today + "T00:00:00.000Z"}`
      )
    )
    .orderBy(desc(schema.aiConversations.updatedAt))
    .limit(1);

  /* Newest verified shelf (Explore row: 8 spines) */
  const newest = await db
    .select()
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.status, "verified"),
        isNull(schema.documents.deletedAt),
        sql`${schema.documents.classificationLevel} <= ${user.clearanceLevel}`
      )
    )
    .orderBy(desc(schema.documents.createdAt))
    .limit(8);
  const newestShelf = await toShelfDocs(newest);

  return {
    flags,
    word: word
      ? {
          kind: word.kind,
          textEn: word.textEn,
          textAr: word.textAr,
          attributionEn: word.attributionEn,
          attributionAr: word.attributionAr,
        }
      : null,
    card: card
      ? {
          id: card.id,
          bigNumber: card.bigNumber,
          factEn: card.factEn,
          factAr: card.factAr,
          hookEn: card.hookEn,
          hookAr: card.hookAr,
          quizQuestionEn: card.quizQuestionEn,
          quizQuestionAr: card.quizQuestionAr,
          options: parseJson(
            { parse: (v) => v as { en: string; ar: string }[] },
            card.optionsJson,
            []
          ),
          explanationEn: card.explanationEn,
          explanationAr: card.explanationAr,
          indicator: cardIndicator,
          answered: cardAnswer,
        }
      : null,
    changed,
    latestEpisode: latestEpisode
      ? {
          id: latestEpisode.id,
          titleEn: latestEpisode.titleEn,
          titleAr: latestEpisode.titleAr,
          durationSec: latestEpisode.durationSec,
          language: latestEpisode.language,
          audioProvider: latestEpisode.audioProvider,
          source: episodeSource,
        }
      : null,
    lessons: lessons.map((l) => {
      const node = lessonNodes.find((n) => n.id === l.nodeId) ?? null;
      return {
        id: l.id,
        titleEn: l.titleEn,
        titleAr: l.titleAr,
        learningEn: l.learningEn,
        learningAr: l.learningAr,
        recommendationEn: l.recommendationEn,
        recommendationAr: l.recommendationAr,
        status: l.status,
        reuseCount: l.reuseCount,
        category: l.category,
        nodeCode: node?.code ?? null,
        nodeTitleEn: node?.titleEn ?? null,
        nodeTitleAr: node?.titleAr ?? null,
      };
    }),
    progress: {
      outcomes: outcomes.map((o) => ({
        code: o.code,
        nameEn: o.nameEn,
        nameAr: o.nameAr,
        depth: breadth[o.code] ?? 0,
      })),
      points,
      levelNameEn: level?.nameEn ?? "",
      levelNameAr: level?.nameAr ?? "",
      levelMinPoints: level?.minPoints ?? 0,
      nextLevelNameEn: nextLevel?.nameEn ?? null,
      nextLevelNameAr: nextLevel?.nameAr ?? null,
      nextLevelPoints: nextLevel?.minPoints ?? null,
      dailyStreak: state?.dailyStreak ?? 0,
      weeklyStreak: state?.weeklyStreak ?? 0,
      contributionsThisWeek,
    },
    newestShelf,
    exampleQuestions,
    todayConversation: todayConv
      ? { id: todayConv.id, title: todayConv.title ?? "" }
      : null,
    quietMode: user.quietMode === 1 || !flags.gamification,
  };
}
