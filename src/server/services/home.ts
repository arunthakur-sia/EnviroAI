import { and, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { todayIso } from "@/lib/ids";
import { parseJson, Breadth } from "@/server/db/json";
import { getFlags, getSetting } from "@/server/settings";
import { toShelfDocs } from "./documents";
import { whatChanged } from "@/server/ai";

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

export async function getHomeData(user: CurrentUser) {
  const today = todayIso();
  const flags = await getFlags();

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

  /* For you: newest release; a question waiting; an unseen verified document */
  const forYou: {
    kind: "release" | "question" | "document" | "bounty";
    titleEn: string;
    titleAr: string;
    link: string;
    hintEn: string;
    hintAr: string;
  }[] = [];
  const follows = await db
    .select()
    .from(schema.follows)
    .where(eq(schema.follows.userId, user.id));
  const followedIndicatorIds = follows
    .filter((f) => f.resourceType === "indicator")
    .map((f) => f.resourceId);
  const releases = await db
    .select()
    .from(schema.releases)
    .where(sql`${schema.releases.releaseDate} <= ${today}`)
    .orderBy(desc(schema.releases.releaseDate))
    .limit(10);
  const followedRelease =
    releases.find((r) => {
      try {
        const ids = JSON.parse(r.indicatorIdsJson ?? "[]") as string[];
        return ids.some((id) => followedIndicatorIds.includes(id));
      } catch {
        return false;
      }
    }) ?? releases[0];
  if (followedRelease) {
    forYou.push({
      kind: "release",
      titleEn: followedRelease.titleEn,
      titleAr: followedRelease.titleAr,
      link: "/statistics/releases",
      hintEn: "New in Statistics",
      hintAr: "جديد في الإحصاءات",
    });
  }
  // a question routed to my expert profile, else an open question
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
    forYou.push({
      kind: "question",
      titleEn: routedQuestion.titleEn || routedQuestion.titleAr,
      titleAr: routedQuestion.titleAr || routedQuestion.titleEn,
      link: `/ask/${routedQuestion.id}`,
      hintEn: "An answer is waiting for your expertise",
      hintAr: "إجابة بانتظار خبرتك",
    });
  }
  // one verified document never opened by me
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
  const unseenDocs = await db
    .select()
    .from(schema.documents)
    .where(and(...unseenConds))
    .orderBy(desc(schema.documents.createdAt))
    .limit(10);
  if (unseenDocs[0]) {
    forYou.push({
      kind: "document",
      titleEn: unseenDocs[0].titleEn,
      titleAr: unseenDocs[0].titleAr || unseenDocs[0].titleEn,
      link: `/vault/${unseenDocs[0].id}`,
      hintEn: "Verified and unread by you",
      hintAr: "موثقة ولم تقرأها بعد",
    });
  }
  // CR01 2.8: one accepted signal from the user's followed outcomes may take a slot
  try {
    const followedTermIds = follows
      .filter((f) => f.resourceType === "term")
      .map((f) => f.resourceId);
    if (followedTermIds.length) {
      const outcomeTerms = await db
        .select({ id: schema.taxonomyTerms.id, code: schema.taxonomyTerms.code })
        .from(schema.taxonomyTerms)
        .innerJoin(
          schema.taxonomyDimensions,
          eq(schema.taxonomyDimensions.id, schema.taxonomyTerms.dimensionId)
        )
        .where(eq(schema.taxonomyDimensions.code, "outcome"));
      const followedOutcomeCodes = outcomeTerms
        .filter((t) => followedTermIds.includes(t.id))
        .map((t) => t.code);
      if (followedOutcomeCodes.length) {
        const { listSignals } = await import("./signals");
        for (const code of followedOutcomeCodes) {
          const [signal] = await listSignals(user, {
            outcome: code,
            triage: "accepted",
            days: 90,
            limit: 1,
          });
          if (signal) {
            forYou.splice(1, 0, {
              kind: "signal" as never,
              titleEn: signal.titleEn,
              titleAr: signal.titleAr || signal.titleEn,
              link: `/trends/${signal.id}`,
              hintEn: "A signal in an outcome you follow",
              hintAr: "إشارة في نتيجة وطنية تتابعها",
            });
            break;
          }
        }
      }
    }
  } catch {
    /* the signal slot is best-effort */
  }

  /* What changed in NDS3 this week (cached: the live model call is slow) */
  const changed = await cachedWhatChanged();

  /* Latest lessons */
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
    .limit(3);

  /* Footprint + game state */
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

  /* Mystery shelf: one random verified unseen doc with a hook */
  const mystery = unseenDocs.length
    ? unseenDocs[Math.floor(Math.random() * unseenDocs.length)]
    : null;

  /* Spotlight */
  const [activeSpotlight] = await db
    .select({
      blurbEn: schema.spotlights.blurbEn,
      blurbAr: schema.spotlights.blurbAr,
      startsOn: schema.spotlights.startsOn,
      endsOn: schema.spotlights.endsOn,
      nameEn: schema.users.nameEn,
      nameAr: schema.users.nameAr,
      color: schema.users.avatarColor,
      suggested: sql<number>`0`,
    })
    .from(schema.spotlights)
    .innerJoin(schema.users, eq(schema.users.id, schema.spotlights.userId))
    .orderBy(desc(schema.spotlights.startsOn))
    .limit(1);

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

  /* Newest verified shelf */
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
    .limit(12);
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
    forYou: forYou.slice(0, 3),
    changed,
    lessons: lessons.map((l) => ({
      id: l.id,
      titleEn: l.titleEn,
      titleAr: l.titleAr,
      learningEn: l.learningEn,
      learningAr: l.learningAr,
      recommendationEn: l.recommendationEn,
      recommendationAr: l.recommendationAr,
      status: l.status,
      reuseCount: l.reuseCount,
    })),
    footprint: {
      outcomes: outcomes.map((o) => ({
        code: o.code,
        nameEn: o.nameEn,
        nameAr: o.nameAr,
        depth: breadth[o.code] ?? 0,
      })),
      points,
      levelNameEn: level?.nameEn ?? "",
      levelNameAr: level?.nameAr ?? "",
      nextLevelNameEn: nextLevel?.nameEn ?? null,
      nextLevelNameAr: nextLevel?.nameAr ?? null,
      nextLevelPoints: nextLevel?.minPoints ?? null,
      dailyStreak: state?.dailyStreak ?? 0,
      weeklyStreak: state?.weeklyStreak ?? 0,
    },
    mystery: mystery
      ? {
          id: mystery.id,
          hookEn:
            mystery.summaryEn?.split(/(?<=[.!?])\s/)[0]?.slice(0, 140) ??
            "A verified document you have never opened.",
          hookAr:
            mystery.summaryAr?.split(/(?<=[.!؟?])\s/)[0]?.slice(0, 140) ??
            "وثيقة موثقة لم تفتحها من قبل.",
          typeCode: null,
        }
      : null,
    spotlight: activeSpotlight ?? null,
    newestShelf,
    exampleQuestions,
    todayConversation: todayConv
      ? { id: todayConv.id, title: todayConv.title ?? "" }
      : null,
    quietMode: user.quietMode === 1 || !flags.gamification,
  };
}
