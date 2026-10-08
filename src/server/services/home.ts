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
  const [nes3] = await db
    .select()
    .from(schema.strategyEditions)
    .where(eq(schema.strategyEditions.code, "nes3"))
    .limit(1);
  if (nes3) {
    const nodeIds = (
      await db
        .select({ id: schema.strategyNodes.id })
        .from(schema.strategyNodes)
        .where(eq(schema.strategyNodes.editionId, nes3.id))
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

  /* What changed in NES this week (cached: the live model call is slow) */
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

  /* ---------------- CR03 4 additions ---------------- */

  // nodeId -> outcome taxonomy code, for connection highlights
  const { outcomeNodeMap } = await import("@/server/scan/extract");
  const outcomeMap = await outcomeNodeMap(); // tax code -> outcome node id
  const taxByOutcomeNode = new Map<string, string>();
  for (const [tax, nodeId] of outcomeMap) taxByOutcomeNode.set(nodeId, tax);
  const allNodes = await db
    .select({
      id: schema.strategyNodes.id,
      parentId: schema.strategyNodes.parentId,
      code: schema.strategyNodes.code,
      nodeType: schema.strategyNodes.nodeType,
    })
    .from(schema.strategyNodes);
  const nodeById = new Map(allNodes.map((n) => [n.id, n]));
  const outcomeTaxOfNode = (nodeId: string | null): string | null => {
    let current = nodeId ? nodeById.get(nodeId) : undefined;
    for (let i = 0; i < 6 && current; i++) {
      const tax = taxByOutcomeNode.get(current.id);
      if (tax) return tax;
      current = current.parentId ? nodeById.get(current.parentId) : undefined;
    }
    return null;
  };

  /* CR03 4.4.1: all quotes for the Words that guide us band */
  const quotes = words
    .filter((w) => w.kind === "quote")
    .map((w) => ({
      textEn: w.textEn,
      textAr: w.textAr,
      attributionEn: w.attributionEn,
      attributionAr: w.attributionAr,
      sourceRef: w.sourceRef,
    }));

  /* CR03 4.4.2: Saudi Arabia in numbers. The daily card's indicator when set, else a
     headline indicator rotated by day. Series of the last 24 periods. */
  let homeNumber: {
    indicatorId: string;
    nameEn: string;
    nameAr: string;
    unit: string | null;
    decimals: number;
    direction: string;
    latestValue: number;
    latestPeriod: string;
    prevValue: number | null;
    series: { period: string; value: number }[];
    hookEn: string | null;
    hookAr: string | null;
  } | null = null;
  {
    let indicatorId = card?.indicatorId ?? null;
    if (!indicatorId) {
      const headliners = await db
        .select({ id: schema.indicators.id })
        .from(schema.indicators)
        .where(eq(schema.indicators.isHeadline, 1))
        .orderBy(schema.indicators.code);
      if (headliners.length) indicatorId = headliners[dayOfYear % headliners.length].id;
    }
    if (indicatorId) {
      const [ind] = await db
        .select()
        .from(schema.indicators)
        .where(eq(schema.indicators.id, indicatorId))
        .limit(1);
      if (ind) {
        const values = await db
          .select()
          .from(schema.indicatorValues)
          .where(
            and(
              eq(schema.indicatorValues.indicatorId, ind.id),
              eq(schema.indicatorValues.dimensionKey, "total")
            )
          )
          .orderBy(schema.indicatorValues.period);
        const series = values.slice(-24).map((v) => ({ period: v.period, value: v.value }));
        const latest = series.at(-1);
        if (latest) {
          homeNumber = {
            indicatorId: ind.id,
            nameEn: ind.nameEn,
            nameAr: ind.nameAr,
            unit: ind.unit,
            decimals: ind.decimals,
            direction: ind.direction,
            latestValue: latest.value,
            latestPeriod: latest.period,
            prevValue: series.at(-2)?.value ?? null,
            series,
            hookEn: card?.indicatorId === ind.id ? card?.hookEn ?? null : null,
            hookAr: card?.indicatorId === ind.id ? card?.hookAr ?? null : null,
          };
        }
      }
    }
  }

  /* CR03 4.4.4: What changed as a compact timeline with outcome chips */
  const since90 = new Date(Date.now() - 90 * 86400000).toISOString();
  const updateRows = await db
    .select({
      nodeId: schema.statusUpdates.nodeId,
      status: schema.statusUpdates.status,
      progressPct: schema.statusUpdates.progressPct,
      summaryEn: schema.statusUpdates.summaryEn,
      summaryAr: schema.statusUpdates.summaryAr,
      createdAt: schema.statusUpdates.createdAt,
      titleEn: schema.strategyNodes.titleEn,
      titleAr: schema.strategyNodes.titleAr,
      code: schema.strategyNodes.code,
    })
    .from(schema.statusUpdates)
    .innerJoin(schema.strategyNodes, eq(schema.strategyNodes.id, schema.statusUpdates.nodeId))
    .where(gte(schema.statusUpdates.createdAt, since90))
    .orderBy(desc(schema.statusUpdates.createdAt))
    .limit(6);
  const kpiRows = await db
    .select({
      period: schema.kpiValues.period,
      value: schema.kpiValues.actualValue,
      createdAt: schema.kpiValues.createdAt,
      nameEn: schema.kpis.nameEn,
      nameAr: schema.kpis.nameAr,
      unit: schema.kpis.unit,
      nodeId: schema.kpis.nodeId,
    })
    .from(schema.kpiValues)
    .innerJoin(schema.kpis, eq(schema.kpis.id, schema.kpiValues.kpiId))
    .where(gte(schema.kpiValues.createdAt, since90))
    .orderBy(desc(schema.kpiValues.createdAt))
    .limit(6);
  const changedTimeline = [
    ...updateRows.map((u) => ({
      kind: "status" as const,
      date: u.createdAt,
      titleEn: u.titleEn,
      titleAr: u.titleAr,
      nodeCode: u.code,
      status: u.status,
      deltaEn: u.progressPct != null ? `${u.progressPct}%` : null,
      deltaAr: u.progressPct != null ? `${u.progressPct}%` : null,
      detailEn: u.summaryEn ?? "",
      detailAr: u.summaryAr ?? "",
      outcome: outcomeTaxOfNode(u.nodeId),
      outcomeCode: (() => {
        let cur = nodeById.get(u.nodeId);
        for (let i = 0; i < 6 && cur; i++) {
          if (taxByOutcomeNode.has(cur.id)) return cur.code;
          cur = cur.parentId ? nodeById.get(cur.parentId) : undefined;
        }
        return null;
      })(),
    })),
    ...kpiRows
      .filter((k) => k.value != null)
      .map((k) => ({
        kind: "kpi" as const,
        date: k.createdAt,
        titleEn: k.nameEn,
        titleAr: k.nameAr,
        nodeCode: null as string | null,
        status: null as string | null,
        deltaEn: `${k.value}${k.unit ? ` ${k.unit}` : ""} (${k.period})`,
        deltaAr: `${k.value}${k.unit ? ` ${k.unit}` : ""} (${k.period})`,
        detailEn: "",
        detailAr: "",
        outcome: outcomeTaxOfNode(k.nodeId),
        outcomeCode: (() => {
          let cur = k.nodeId ? nodeById.get(k.nodeId) : undefined;
          for (let i = 0; i < 6 && cur; i++) {
            if (taxByOutcomeNode.has(cur.id)) return cur.code;
            cur = cur.parentId ? nodeById.get(cur.parentId) : undefined;
          }
          return null;
        })(),
      })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    // one row per subject: three KPI values entered the same day collapse
    .filter(
      (row, i, all) => all.findIndex((r) => r.kind === row.kind && r.titleEn === row.titleEn) === i
    )
    .slice(0, 3);

  /* CR03 4.2: the knowledge constellation, from real relations */
  const outcomeHubs = outcomes.map((o) => {
    const nodeId = outcomeMap.get(o.code);
    const node = nodeId ? nodeById.get(nodeId) : undefined;
    return { tax: o.code, code: node?.code ?? o.code, nameEn: o.nameEn, nameAr: o.nameAr };
  });
  const satellites: { id: string; type: string; outcome: string }[] = [];
  // documents tagged with an outcome term
  const outcomeTerms = await db
    .select({ id: schema.taxonomyTerms.id, code: schema.taxonomyTerms.code })
    .from(schema.taxonomyTerms)
    .innerJoin(
      schema.taxonomyDimensions,
      eq(schema.taxonomyDimensions.id, schema.taxonomyTerms.dimensionId)
    )
    .where(eq(schema.taxonomyDimensions.code, "outcome"));
  const termTax = new Map(outcomeTerms.map((t) => [t.id, t.code]));
  const docTags = await db
    .select({ resourceId: schema.taggings.resourceId, termId: schema.taggings.termId })
    .from(schema.taggings)
    .where(
      and(
        eq(schema.taggings.resourceType, "document"),
        inArray(schema.taggings.termId, outcomeTerms.map((t) => t.id))
      )
    )
    .limit(400);
  const seenDocs = new Set<string>();
  for (const tag of docTags) {
    if (satellites.length >= 22) break;
    if (seenDocs.has(tag.resourceId)) continue;
    seenDocs.add(tag.resourceId);
    const tax = termTax.get(tag.termId);
    if (tax) satellites.push({ id: `doc:${tag.resourceId}`, type: "document", outcome: tax });
  }
  // lessons linked to nodes
  const lessonRows = await db
    .select({ id: schema.lessons.id, nodeId: schema.lessons.nodeId })
    .from(schema.lessons)
    .where(inArray(schema.lessons.status, ["published", "verified"]))
    .limit(60);
  let lessonCount = 0;
  for (const l of lessonRows) {
    if (lessonCount >= 12) break;
    const tax = outcomeTaxOfNode(l.nodeId);
    if (tax) {
      satellites.push({ id: `lesson:${l.id}`, type: "lesson", outcome: tax });
      lessonCount++;
    }
  }
  // indicators through KPIs on outcome subtrees
  const kpiIndicators = await db
    .select({ indicatorId: schema.kpis.indicatorId, nodeId: schema.kpis.nodeId })
    .from(schema.kpis)
    .limit(80);
  const seenInd = new Set<string>();
  for (const k of kpiIndicators) {
    if (seenInd.size >= 12) break;
    if (!k.indicatorId || seenInd.has(k.indicatorId)) continue;
    const tax = outcomeTaxOfNode(k.nodeId);
    if (tax) {
      seenInd.add(k.indicatorId);
      satellites.push({ id: `ind:${k.indicatorId}`, type: "indicator", outcome: tax });
    }
  }
  // experts with an outcome domain
  const domainRows = await db
    .select({ expertId: schema.expertDomains.expertId, termId: schema.expertDomains.termId })
    .from(schema.expertDomains)
    .where(inArray(schema.expertDomains.termId, outcomeTerms.map((t) => t.id)))
    .limit(30);
  const seenExperts = new Set<string>();
  for (const d of domainRows) {
    if (seenExperts.size >= 8) break;
    if (seenExperts.has(d.expertId)) continue;
    seenExperts.add(d.expertId);
    const tax = termTax.get(d.termId);
    if (tax) satellites.push({ id: `exp:${d.expertId}`, type: "expert", outcome: tax });
  }
  const constellation = { hubs: outcomeHubs, satellites: satellites.slice(0, 52) };

  /* CR03 4.4.5: has the user finished the latest episode (halo when not) */
  let episodeListened = false;
  if (latestEpisode) {
    const [listen] = await db
      .select({ id: schema.podcastListens.id })
      .from(schema.podcastListens)
      .where(
        and(
          eq(schema.podcastListens.episodeId, latestEpisode.id),
          eq(schema.podcastListens.userId, user.id),
          eq(schema.podcastListens.completed, 1)
        )
      )
      .limit(1);
    episodeListened = Boolean(listen);
  }

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
          listened: episodeListened,
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
        outcome: outcomeTaxOfNode(l.nodeId),
      };
    }),
    quotes,
    homeNumber,
    changedTimeline,
    constellation,
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
      // CR08 7.1: the descriptor rides along for the hover tip
      levelDescriptorEn: level?.descriptorEn ?? "",
      levelDescriptorAr: level?.descriptorAr ?? "",
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
