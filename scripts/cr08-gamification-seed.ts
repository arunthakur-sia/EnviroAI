/* eslint-disable no-console */
// CR08 7: the ten numeric levels, the board exclusions, the first
// materialised leaderboard. Owned by the Gamification agent. Idempotent.
//
// LEVEL_DEFS is also read by seed.ts block 10 on a pristine seed; this file's
// default export migrates an EXISTING database (replaces the five named
// levels, remaps user_game_state.level_id, seeds exclusions, refreshes the
// boards once).
import { loadEnv } from "../src/lib/load-env";
loadEnv();

export type LevelDef = {
  order: number;
  nameEn: string;
  nameAr: string;
  minPoints: number;
  descriptorEn: string;
  descriptorAr: string;
  unlocks: string[];
};

/** CR08 7.1: Level 1..10 with the change request's thresholds. Descriptors
    are shown only on hover and on the profile, and none of them reuses a
    retired level name (Explorer, Curator, Keeper, Sage and their Arabic).
    Unlocks are re-mapped from the CR-era five levels (recorded in DECISIONS). */
export const LEVEL_DEFS: LevelDef[] = [
  { order: 1, nameEn: "Level 1", nameAr: "المستوى 1", minPoints: 0, descriptorEn: "Getting started", descriptorAr: "بداية الطريق", unlocks: [] },
  { order: 2, nameEn: "Level 2", nameAr: "المستوى 2", minPoints: 100, descriptorEn: "First contributions", descriptorAr: "أولى المساهمات", unlocks: ["profile_domains"] },
  { order: 3, nameEn: "Level 3", nameAr: "المستوى 3", minPoints: 300, descriptorEn: "Regular contributor", descriptorAr: "مساهم منتظم", unlocks: ["collections"] },
  { order: 4, nameEn: "Level 4", nameAr: "المستوى 4", minPoints: 700, descriptorEn: "Trusted reviewer", descriptorAr: "مراجع موثوق", unlocks: ["nominate_lesson_of_week"] },
  { order: 5, nameEn: "Level 5", nameAr: "المستوى 5", minPoints: 1300, descriptorEn: "A reference for colleagues", descriptorAr: "مرجع للزملاء", unlocks: ["bounties_post"] },
  { order: 6, nameEn: "Level 6", nameAr: "المستوى 6", minPoints: 2200, descriptorEn: "Community lead", descriptorAr: "قائد مجتمع", unlocks: ["communities_lead"] },
  { order: 7, nameEn: "Level 7", nameAr: "المستوى 7", minPoints: 3500, descriptorEn: "Guards the institutional memory", descriptorAr: "يصون الذاكرة المؤسسية", unlocks: ["podcast_propose"] },
  { order: 8, nameEn: "Level 8", nameAr: "المستوى 8", minPoints: 5500, descriptorEn: "Senior expert", descriptorAr: "خبير أول", unlocks: ["expert_verify"] },
  { order: 9, nameEn: "Level 9", nameAr: "المستوى 9", minPoints: 8500, descriptorEn: "Counsel the Office turns to", descriptorAr: "رأي يعود إليه المكتب", unlocks: ["report_request_any"] },
  { order: 10, nameEn: "Level 10", nameAr: "المستوى 10", minPoints: 13000, descriptorEn: "Living legend of the Office", descriptorAr: "أسطورة المكتب", unlocks: ["hall_of_fame"] },
];

/** CR08 7.2 and 8: rules the leaderboard and the Knowledge of the Week
    agent need; inserted only when missing so admin edits survive a reseed. */
export const CR08_GAME_RULES: [string, number][] = [
  ["learning_path_completed", 40], // CR08 6: a handover learning path signed off
  ["kow_contributor", 150], // CR08 8: the Knowledge of the Week award
  ["kow_unit", 100], // CR08 8: the unit award, Departments board only
  ["kow_read", 10], // CR08 8: read the week's pick in full
];

export default async function seedCr08Gamification(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const { eq, inArray } = await import("drizzle-orm");
  const { newId } = await import("../src/lib/ids");
  const { BOARD_EXCLUDED_DEFAULT_TYPES } = await import("../src/server/gamification/engine");
  const { getSetting, setSetting } = await import("../src/server/settings");
  const { DEFAULT_LEADERBOARD_SETTINGS, refreshLeaderboardsDetailed } = await import(
    "../src/server/services/leaderboard"
  );

  /* ---- 1. the ten levels: keep ids where the order matches ---- */
  const existing = await db.select().from(schema.levels).orderBy(schema.levels.order);
  let updated = 0;
  let inserted = 0;
  for (const def of LEVEL_DEFS) {
    const row = existing.find((l) => l.order === def.order);
    const values = {
      nameEn: def.nameEn,
      nameAr: def.nameAr,
      minPoints: def.minPoints,
      descriptorEn: def.descriptorEn,
      descriptorAr: def.descriptorAr,
      unlocksJson: JSON.stringify(def.unlocks),
    };
    if (row) {
      const same =
        row.nameEn === values.nameEn &&
        row.nameAr === values.nameAr &&
        row.minPoints === values.minPoints &&
        row.descriptorEn === values.descriptorEn &&
        row.descriptorAr === values.descriptorAr &&
        row.unlocksJson === values.unlocksJson;
      if (!same) {
        await db.update(schema.levels).set(values).where(eq(schema.levels.id, row.id));
        updated++;
      }
    } else {
      await db.insert(schema.levels).values({ id: newId(), order: def.order, ...values });
      inserted++;
    }
  }
  const stale = existing.filter((l) => l.order < 1 || l.order > LEVEL_DEFS.length);
  if (stale.length) {
    await db.delete(schema.levels).where(inArray(schema.levels.id, stale.map((l) => l.id)));
  }
  console.log(
    `cr08 gamification: levels ${inserted} inserted, ${updated} updated, ${stale.length} removed (${LEVEL_DEFS.length} total)`
  );

  /* ---- 2. every person sits on the level their points earn ---- */
  const levels = await db.select().from(schema.levels).orderBy(schema.levels.order);
  const states = await db
    .select({
      userId: schema.userGameState.userId,
      totalPoints: schema.userGameState.totalPoints,
      levelId: schema.userGameState.levelId,
    })
    .from(schema.userGameState);
  let remapped = 0;
  for (const s of states) {
    const level = levels.filter((l) => l.minPoints <= s.totalPoints).pop() ?? levels[0];
    if (level && level.id !== s.levelId) {
      await db
        .update(schema.userGameState)
        .set({ levelId: level.id })
        .where(eq(schema.userGameState.userId, s.userId));
      remapped++;
    }
  }
  console.log(`cr08 gamification: ${remapped} of ${states.length} game states remapped`);

  /* ---- 3. rules: the CR08 additions and the board exclusions ---- */
  let rulesAdded = 0;
  for (const [eventType, points] of CR08_GAME_RULES) {
    const [row] = await db
      .select({ id: schema.gameRules.id })
      .from(schema.gameRules)
      .where(eq(schema.gameRules.eventType, eventType))
      .limit(1);
    if (row) continue;
    await db.insert(schema.gameRules).values({
      id: newId(),
      eventType,
      points,
      multiplierRulesJson: null,
      isActive: 1,
      excludedFromBoards: 0,
    });
    rulesAdded++;
  }
  const excluded = [...BOARD_EXCLUDED_DEFAULT_TYPES];
  const flagged = await db
    .select({ id: schema.gameRules.id, eventType: schema.gameRules.eventType, excludedFromBoards: schema.gameRules.excludedFromBoards })
    .from(schema.gameRules)
    .where(inArray(schema.gameRules.eventType, excluded));
  let flaggedNow = 0;
  for (const rule of flagged) {
    if (rule.excludedFromBoards === 1) continue;
    await db
      .update(schema.gameRules)
      .set({ excludedFromBoards: 1 })
      .where(eq(schema.gameRules.id, rule.id));
    flaggedNow++;
  }
  console.log(
    `cr08 gamification: ${rulesAdded} rules added, ${flaggedNow} newly excluded from boards (${excluded.join(", ")})`
  );

  /* ---- 4. the People board's role exclusions, only when never saved ---- */
  const [stored] = await db
    .select({ key: schema.settings.key })
    .from(schema.settings)
    .where(eq(schema.settings.key, "leaderboard_settings"))
    .limit(1);
  if (!stored) {
    await setSetting("leaderboard_settings", DEFAULT_LEADERBOARD_SETTINGS);
    console.log("cr08 gamification: leaderboard_settings written with the defaults");
  } else {
    const current = await getSetting("leaderboard_settings", DEFAULT_LEADERBOARD_SETTINGS);
    console.log(
      `cr08 gamification: leaderboard_settings kept (${(current.excludeRoles ?? []).join(", ") || "no roles"} excluded)`
    );
  }

  /* ---- 5. the first materialised board ---- */
  const report = await refreshLeaderboardsDetailed();
  console.log(
    `cr08 gamification: leaderboard refreshed, ${report.rows} rows, ${report.closed.length} periods closed, ${report.notified} notifications`
  );
}

const isMain = process.argv[1] && /cr08-gamification-seed\.ts$/.test(process.argv[1]);
if (isMain) {
  seedCr08Gamification()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
