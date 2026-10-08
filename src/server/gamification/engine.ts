// The Engagement Engine. record(event) is called by every mutation route.
// Append-only ledger in game_events; totals derived into user_game_state.
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { newId, nowIso, todayIso, isoWeekKey } from "@/lib/ids";
import { getFlags } from "@/server/settings";
import { parseJson, Breadth } from "@/server/db/json";

export type GameEventInput = {
  userId: string;
  type: string;
  resourceType?: string;
  resourceId?: string;
  /** Extra context: outcomes touched (breadth), gapFill, bountyPoints */
  meta?: {
    outcomes?: string[];
    gapFill?: boolean;
    bountyPoints?: number;
    departmentId?: string | null;
  };
};

export type GameEventResult = {
  recorded: boolean;
  points: number;
  leveledUp?: { nameEn: string; nameAr: string } | null;
  newBadges?: string[];
};

/** Daily caps by event type: max points per day. */
const DAILY_POINT_CAPS: Record<string, number> = {
  ai_tag_confirmed: 30,
  question_asked: 125, // 25 questions x 5
  document_read_fully: 60, // 20 x 3
  knowledge_submitted: 90, // CR01 5.5
  signal_accepted: 100, // triage stays rewarding but bounded
  podcast_listened_full: 20, // CR02 4.6: 4 full listens x 5
  report_extracted: 45, // CR02 7: 3 reports x 15
  lesson_read_fully: 60, // CR04 3.5: 20 x 3, like document_read_fully
  handover_item_completed: 50, // CR05 5.7: 10 items x 5 per day
  backup_assigned: 25, // CR05 5.7: 5 x 5 per day
};

const ONCE_PER_DAY = new Set([
  "daily_login",
  "mystery_shelf_opened",
  "daily_quiz_correct",
  "daily_quiz_wrong",
  "learn_session_completed", // CR04 3.5
]);
const ONCE_PER_RESOURCE = new Set([
  "document_read_fully",
  "expert_profile_completed",
  "document_verified",
  "answer_verified",
  "lesson_verified",
  "podcast_listened_full", // CR02 4.6: per episode per user
  "lesson_read_fully", // CR04 3.5: per lesson per user
  "reflection_saved", // CR04 3.5: per lesson per user
  "handover_item_completed", // CR05 5.7: per item
  "handover_completed", // CR05 5.7: per handover
  "handover_completed_owner", // CR05 5.7: per handover, before due date
  "backup_assigned", // CR05 5.7: per item
]);

/** Event types that count as contributions (weekly streak, freeze earning). */
export const CONTRIBUTION_TYPES = new Set([
  "document_uploaded",
  "document_version_added",
  "answer_posted",
  "lesson_published",
  "decision_logged",
  "content_verified",
  "translation_reviewed",
  "kpi_value_entered",
  "status_update_posted",
  "indicator_import_completed",
  "external_expert_added",
  "expert_request_answered",
  "bounty_fulfilled",
  "knowledge_submitted", // CR01 5.5
  "signal_accepted", // CR01 2.6 triage
]);

/* ------------------------------------------------------------------ */
/* CR08 7.2: the leaderboard category sets and the board exclusions      */
/* ------------------------------------------------------------------ */

/** Guardians: points the verifier or reviewer earns for keeping the
    memory trustworthy (the author-side rewards such as document_verified
    are contributions, not guardianship). */
export const GUARDIAN_TYPES = new Set([
  "content_verified",
  "translation_reviewed",
  "signal_accepted",
]);

/** Learners: reading, listening, quizzes and guided learning. */
export const LEARNER_TYPES = new Set([
  "daily_quiz_correct",
  "document_read_fully",
  "podcast_listened_full",
  "learning_path_completed", // CR08 6: a handover learning path signed off
  "lesson_read_fully",
  "learn_session_completed",
  "reflection_saved",
  "mystery_shelf_opened",
  "kow_read", // CR08 8: read the Knowledge of the Week in full
]);

/** Rules that count for the Departments board only: the CR08 8 unit award
    is paid to the contributor's account (the engine pays per user) but is a
    unit achievement, so the People board ignores it. */
export const UNIT_ONLY_TYPES = new Set(["kow_unit"]);

/** Rules seeded as "excluded from boards": attendance and bulk operations
    that reward a duty rather than knowledge work. Editable in Settings >
    Gamification; the flag lives on game_rules.excluded_from_boards. */
export const BOARD_EXCLUDED_DEFAULT_TYPES = [
  "daily_login",
  "indicator_import_completed",
] as const;

/** Contributors: the streak-earning contribution types plus the author-side
    rewards paid when someone's work is verified, and the CR08 8 award. */
export const CONTRIBUTOR_BOARD_TYPES = new Set([
  ...[...CONTRIBUTION_TYPES].filter((t) => !GUARDIAN_TYPES.has(t)),
  "document_verified",
  "answer_verified",
  "lesson_verified",
  "knowledge_verified",
  "podcast_created",
  "report_extracted",
  "knowledge_by_voice",
  "knowledge_from_event",
  "knowledge_linked_to_nes",
  "expert_profile_completed",
  "expert_profile_domain_accepted",
  "kow_contributor", // CR08 8: the Knowledge of the Week award
]);

export function boardCategoryOf(
  type: string
): "guardians" | "learners" | "contributors" | "unit" | null {
  if (UNIT_ONLY_TYPES.has(type)) return "unit";
  if (GUARDIAN_TYPES.has(type)) return "guardians";
  if (LEARNER_TYPES.has(type)) return "learners";
  if (CONTRIBUTOR_BOARD_TYPES.has(type)) return "contributors";
  return null;
}

async function ruleFor(type: string): Promise<{ points: number; active: boolean }> {
  const rows = await db
    .select()
    .from(schema.gameRules)
    .where(eq(schema.gameRules.eventType, type))
    .limit(1);
  if (!rows.length) return { points: 0, active: false };
  return { points: rows[0].points, active: rows[0].isActive === 1 };
}

async function pointsToday(userId: string, type: string): Promise<number> {
  const start = todayIso() + "T00:00:00.000Z";
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${schema.gameEvents.points}), 0)` })
    .from(schema.gameEvents)
    .where(
      and(
        eq(schema.gameEvents.userId, userId),
        eq(schema.gameEvents.eventType, type),
        gte(schema.gameEvents.createdAt, start)
      )
    );
  return rows[0]?.total ?? 0;
}

async function alreadyRecorded(
  userId: string,
  type: string,
  resourceId?: string,
  todayOnly = false
): Promise<boolean> {
  const conds = [
    eq(schema.gameEvents.userId, userId),
    eq(schema.gameEvents.eventType, type),
  ];
  if (resourceId) conds.push(eq(schema.gameEvents.resourceId, resourceId));
  if (todayOnly) conds.push(gte(schema.gameEvents.createdAt, todayIso() + "T00:00:00.000Z"));
  const rows = await db
    .select({ id: schema.gameEvents.id })
    .from(schema.gameEvents)
    .where(and(...conds))
    .limit(1);
  return rows.length > 0;
}

async function getState(userId: string) {
  const rows = await db
    .select()
    .from(schema.userGameState)
    .where(eq(schema.userGameState.userId, userId))
    .limit(1);
  if (rows.length) return rows[0];
  const fresh = {
    userId,
    totalPoints: 0,
    levelId: null as string | null,
    dailyStreak: 0,
    weeklyStreak: 0,
    streakFreezes: 0,
    lastActiveDate: null as string | null,
    lastContributionWeek: null as string | null,
    breadthJson: "{}",
    quizStreak: 0,
    contributionCount: 0,
    updatedAt: nowIso(),
  };
  await db.insert(schema.userGameState).values(fresh);
  return fresh;
}

function previousDay(dateIso: string): string {
  const d = new Date(dateIso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function previousWeek(week: string): string {
  const [y, w] = week.split("-W").map(Number);
  const d = new Date(Date.UTC(y, 0, 4));
  d.setUTCDate(d.getUTCDate() + (w - 2) * 7);
  return isoWeekKey(d);
}

export async function notify(
  userId: string,
  kind: string,
  titleEn: string,
  titleAr: string,
  link?: string,
  body?: { en?: string; ar?: string }
): Promise<void> {
  try {
    const [user] = await db
      .select({ quiet: schema.users.quietMode })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    if (user?.quiet === 1 && kind.startsWith("game_")) return;
    await db.insert(schema.notifications).values({
      id: newId(),
      userId,
      kind,
      titleEn,
      titleAr,
      bodyEn: body?.en ?? null,
      bodyAr: body?.ar ?? null,
      link: link ?? null,
      readAt: null,
      createdAt: nowIso(),
    });
  } catch {
    /* notifications never break the flow */
  }
}

export async function record(input: GameEventInput): Promise<GameEventResult> {
  const flags = await getFlags();
  if (!flags.gamification) return { recorded: false, points: 0 };

  const { userId, type } = input;
  const rule = await ruleFor(type);
  if (!rule.active) return { recorded: false, points: 0 };

  // Idempotency guards
  if (ONCE_PER_DAY.has(type) && (await alreadyRecorded(userId, type, undefined, true))) {
    return { recorded: false, points: 0 };
  }
  if (
    ONCE_PER_RESOURCE.has(type) &&
    input.resourceId &&
    (await alreadyRecorded(userId, type, input.resourceId))
  ) {
    return { recorded: false, points: 0 };
  }

  let base = type === "bounty_fulfilled" && input.meta?.bountyPoints ? input.meta.bountyPoints : rule.points;

  // Daily point caps
  const cap = DAILY_POINT_CAPS[type];
  if (cap !== undefined) {
    const sofar = await pointsToday(userId, type);
    if (sofar >= cap) return { recorded: false, points: 0 };
    base = Math.min(base, cap - sofar);
  }

  // Multipliers: 2x gap fill; 1.5x first contribution in the department this week
  let multiplier = 1;
  if (input.meta?.gapFill) multiplier = 2;
  else if (CONTRIBUTION_TYPES.has(type) && input.meta?.departmentId) {
    const week = isoWeekKey();
    const weekStartCheck = await db
      .select({ id: schema.gameEvents.id })
      .from(schema.gameEvents)
      .innerJoin(schema.users, eq(schema.users.id, schema.gameEvents.userId))
      .where(
        and(
          eq(schema.users.departmentId, input.meta.departmentId),
          gte(schema.gameEvents.createdAt, weekStartIso(week))
        )
      )
      .limit(50);
    const contributionThisWeek = weekStartCheck.length > 0 &&
      (await db
        .select({ id: schema.gameEvents.id })
        .from(schema.gameEvents)
        .innerJoin(schema.users, eq(schema.users.id, schema.gameEvents.userId))
        .where(
          and(
            eq(schema.users.departmentId, input.meta.departmentId),
            gte(schema.gameEvents.createdAt, weekStartIso(week)),
            inArray(schema.gameEvents.eventType, [...CONTRIBUTION_TYPES])
          )
        )
        .limit(1)).length > 0;
    if (!contributionThisWeek) multiplier = 1.5;
  }

  const points = Math.round(base * multiplier);

  await db.insert(schema.gameEvents).values({
    id: newId(),
    userId,
    eventType: type,
    resourceType: input.resourceType ?? null,
    resourceId: input.resourceId ?? null,
    points,
    multiplier,
    createdAt: nowIso(),
  });

  // ----- derived state -----
  const state = await getState(userId);
  const today = todayIso();
  let dailyStreak = state.dailyStreak;
  let freezes = state.streakFreezes;
  if (state.lastActiveDate !== today) {
    if (state.lastActiveDate === previousDay(today)) {
      dailyStreak += 1;
    } else if (state.lastActiveDate && freezes > 0 && state.lastActiveDate === previousDay(previousDay(today))) {
      // one missed day covered by a freeze
      freezes -= 1;
      dailyStreak += 1;
    } else {
      dailyStreak = 1;
    }
  }

  let weeklyStreak = state.weeklyStreak;
  let lastWeek = state.lastContributionWeek;
  let contributionCount = state.contributionCount;
  if (CONTRIBUTION_TYPES.has(type)) {
    contributionCount += 1;
    // one freeze earned per 5 contributions, hold at most 3
    if (contributionCount % 5 === 0) freezes = Math.min(3, freezes + 1);
    const week = isoWeekKey();
    if (lastWeek !== week) {
      if (lastWeek === previousWeek(week)) weeklyStreak += 1;
      else if (lastWeek && freezes > 0 && lastWeek === previousWeek(previousWeek(week))) {
        freezes -= 1;
        weeklyStreak += 1;
      } else weeklyStreak = 1;
      lastWeek = week;
    }
  }

  // quiz streak
  let quizStreak = state.quizStreak;
  if (type === "daily_quiz_correct") quizStreak += 1;
  if (type === "daily_quiz_wrong") quizStreak = 0;

  // breadth: outcomes touched
  const breadth = parseJson(Breadth, state.breadthJson, {});
  for (const o of input.meta?.outcomes ?? []) {
    breadth[o] = (breadth[o] ?? 0) + 1;
  }

  const totalPoints = state.totalPoints + points;

  // level check
  const allLevels = await db.select().from(schema.levels).orderBy(schema.levels.order);
  const current = allLevels.filter((l) => l.minPoints <= state.totalPoints).pop();
  const next = allLevels.filter((l) => l.minPoints <= totalPoints).pop();
  let leveledUp: GameEventResult["leveledUp"] = null;
  if (next && next.id !== current?.id) {
    leveledUp = { nameEn: next.nameEn, nameAr: next.nameAr };
    // CR08 7.1: the levels are numeric ("Level 5" / "المستوى 5"); the
    // descriptor rides in the body and shows on the profile, never in the title
    await notify(
      userId,
      "game_level",
      `You reached ${next.nameEn}`,
      `وصلت إلى ${next.nameAr}`,
      "/profile",
      next.descriptorEn || next.descriptorAr
        ? { en: next.descriptorEn ?? undefined, ar: next.descriptorAr ?? undefined }
        : undefined
    );
  }

  await db
    .update(schema.userGameState)
    .set({
      totalPoints,
      levelId: next?.id ?? state.levelId,
      dailyStreak,
      weeklyStreak,
      streakFreezes: freezes,
      lastActiveDate: today,
      lastContributionWeek: lastWeek,
      breadthJson: JSON.stringify(breadth),
      quizStreak,
      contributionCount,
      updatedAt: nowIso(),
    })
    .where(eq(schema.userGameState.userId, userId));

  const newBadges = await evaluateBadges(userId, {
    breadthCount: Object.keys(breadth).length,
    quizStreak,
  });

  return { recorded: true, points, leveledUp, newBadges };
}

function weekStartIso(week: string): string {
  const [y, w] = week.split("-W").map(Number);
  const d = new Date(Date.UTC(y, 0, 4));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1 + (w - 1) * 7);
  return d.toISOString();
}

async function countEvents(userId: string, types: string[]): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.gameEvents)
    .where(
      and(
        eq(schema.gameEvents.userId, userId),
        inArray(schema.gameEvents.eventType, types)
      )
    );
  return rows[0]?.c ?? 0;
}

async function evaluateBadges(
  userId: string,
  extra: { breadthCount: number; quizStreak: number }
): Promise<string[]> {
  const allBadges = await db.select().from(schema.badges);
  const mine = await db
    .select()
    .from(schema.userBadges)
    .where(eq(schema.userBadges.userId, userId));
  const owned = new Set(mine.map((b) => b.badgeId));
  const newly: string[] = [];

  const builderCount = await countEvents(userId, [
    "document_verified",
    "answer_verified",
    "lesson_verified",
    "knowledge_verified", // CR01 5.5
  ]);
  const guardianCount = await countEvents(userId, [
    "content_verified",
    "translation_reviewed",
    "signal_accepted", // CR01: triage keeps the stream trustworthy
  ]);
  const connectorCount = await countEvents(userId, [
    "external_expert_added",
    "expert_request_answered",
    "knowledge_linked_to_nes", // CR01 5.5
  ]);
  const uploads = await countEvents(userId, ["document_uploaded"]);
  const translations = await countEvents(userId, ["translation_reviewed"]);
  const bountiesFulfilled = await countEvents(userId, ["bounty_fulfilled"]);

  const check = (code: string, cond: boolean) => {
    const badge = allBadges.find((b) => b.code === code);
    if (badge && cond && !owned.has(badge.id)) {
      newly.push(badge.id);
    }
  };

  check("builder_bronze", builderCount >= 5);
  check("builder_silver", builderCount >= 25);
  check("builder_gold", builderCount >= 100);
  check("guardian_bronze", guardianCount >= 10);
  check("guardian_silver", guardianCount >= 50);
  check("guardian_gold", guardianCount >= 200);
  check("connector_bronze", connectorCount >= 3);
  check("connector_silver", connectorCount >= 15);
  check("connector_gold", connectorCount >= 50);
  // CR02 4.6: completed podcast episodes count toward the explorer badge family
  const podcastListens = await countEvents(userId, ["podcast_listened_full"]);
  check("explorer_bronze", extra.breadthCount >= 3 || extra.quizStreak >= 7 || podcastListens >= 3);
  check("explorer_silver", extra.breadthCount >= 5 || extra.quizStreak >= 30 || podcastListens >= 10);
  check("explorer_gold", extra.breadthCount >= 7 || extra.quizStreak >= 100 || podcastListens >= 30);
  check("first_shelf", uploads >= 1);
  check("bilingual", translations >= 10);
  check("gap_closer", bountiesFulfilled >= 3);

  for (const badgeId of newly) {
    await db.insert(schema.userBadges).values({
      id: newId(),
      userId,
      badgeId,
      awardedAt: nowIso(),
    });
    const badge = allBadges.find((b) => b.id === badgeId);
    if (badge) {
      await notify(
        userId,
        "game_badge",
        `New badge: ${badge.nameEn}`,
        `وسام جديد: ${badge.nameAr}`,
        "/profile"
      );
    }
  }
  return newly;
}
