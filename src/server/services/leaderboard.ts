// CR08 7.2: the materialised leaderboard. `refreshLeaderboards()` rebuilds
// `leaderboard_periods` from the game events ledger for every board, category
// and window; the page reads the table, never the ledger. Owned by the
// Gamification agent.
//
// Boards: people | departments. Categories: overall (every rule not flagged
// excluded_from_boards), contributors, guardians, learners (the type sets in
// the engine). Windows: this ISO week, this month, this quarter, this year,
// all time. Every row carries the rank and points of the same subject in the
// previous period of the same kind, which is where the trend arrows come
// from, and the job notifies the top three and the winning unit's head when
// a period closes.
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { hasPermission } from "@/server/auth/permissions";
import { getSetting, setSetting } from "@/server/settings";
import { newId, nowIso } from "@/lib/ids";
import {
  CONTRIBUTOR_BOARD_TYPES,
  GUARDIAN_TYPES,
  LEARNER_TYPES,
  UNIT_ONLY_TYPES,
  notify,
} from "@/server/gamification/engine";
import {
  BOARDS,
  CATEGORIES,
  PERIOD_KINDS,
  activeShare,
  inRange,
  ordinalWord,
  periodKeyFor,
  periodLabel,
  periodRange,
  pointsPerMember,
  previousPeriodKey,
  rankSubjects,
  trendOf,
  type BoardCategory,
  type BoardKind,
  type PeriodKind,
  type Trend,
} from "@/lib/leaderboard-math";

/* ------------------------------------------------------------------ */
/* settings                                                              */
/* ------------------------------------------------------------------ */

export type LeaderboardSettings = {
  /** Role names whose accounts never appear on the People board. */
  excludeRoles: string[];
  /** Quiet mode hides the board from that person's own view. */
  quietModeHidesBoard: boolean;
};

export const DEFAULT_LEADERBOARD_SETTINGS: LeaderboardSettings = {
  excludeRoles: ["Super Admin", "Knowledge Admin"],
  quietModeHidesBoard: true,
};

export async function getLeaderboardSettings(): Promise<LeaderboardSettings> {
  const raw = await getSetting<LeaderboardSettings>(
    "leaderboard_settings",
    DEFAULT_LEADERBOARD_SETTINGS
  );
  return {
    excludeRoles: Array.isArray(raw.excludeRoles)
      ? raw.excludeRoles.filter((r): r is string => typeof r === "string")
      : DEFAULT_LEADERBOARD_SETTINGS.excludeRoles,
    quietModeHidesBoard: raw.quietModeHidesBoard !== false,
  };
}

export async function saveLeaderboardSettings(
  patch: Partial<LeaderboardSettings>
): Promise<LeaderboardSettings> {
  const current = await getLeaderboardSettings();
  const next = { ...current, ...patch };
  await setSetting("leaderboard_settings", next);
  return next;
}

/** The last period keys the job saw, so a change means a period closed. */
type LeaderboardState = { keys: Partial<Record<PeriodKind, string>>; refreshedAt: string | null };

/* ------------------------------------------------------------------ */
/* permissions                                                           */
/* ------------------------------------------------------------------ */

const ADMIN_ROLES = new Set(["Super Admin", "Knowledge Admin"]);
const FULL_LIST_ROLES = new Set(["Super Admin", "Knowledge Admin", "HR Admin"]);

/** Super Admin and Knowledge Admin may press Refresh now. */
export function canRefreshLeaderboard(user: CurrentUser | null): boolean {
  if (!user) return false;
  return ADMIN_ROLES.has(user.role.nameEn) || hasPermission(user, "settings", "manage");
}

export type BoardScope = "top10" | "full" | "unit";

/** Who sees the whole People list: admins and HR see everything, a
    Department Head sees the top ten plus every member of their own unit. */
export function boardScopeFor(user: CurrentUser): BoardScope {
  if (FULL_LIST_ROLES.has(user.role.nameEn) || hasPermission(user, "settings", "manage")) {
    return "full";
  }
  if (user.role.nameEn === "Department Head" && user.departmentId) return "unit";
  return "top10";
}

/* ------------------------------------------------------------------ */
/* category membership                                                   */
/* ------------------------------------------------------------------ */

function categoryAccepts(category: BoardCategory, type: string): boolean {
  switch (category) {
    case "contributors":
      return CONTRIBUTOR_BOARD_TYPES.has(type);
    case "guardians":
      return GUARDIAN_TYPES.has(type);
    case "learners":
      return LEARNER_TYPES.has(type);
    default:
      return true;
  }
}

/* ------------------------------------------------------------------ */
/* the refresh                                                           */
/* ------------------------------------------------------------------ */

type LedgerEvent = {
  userId: string;
  eventType: string;
  resourceType: string | null;
  resourceId: string | null;
  points: number;
  createdAt: string;
};

type Totals = {
  /** person -> points */
  people: Map<string, number>;
  /** unit -> points (members' points plus unit-only awards) */
  units: Map<string, number>;
  /** unit -> members who scored */
  activeByUnit: Map<string, Set<string>>;
};

function emptyTotals(): Totals {
  return { people: new Map(), units: new Map(), activeByUnit: new Map() };
}

function bump(map: Map<string, number>, key: string, by: number) {
  map.set(key, (map.get(key) ?? 0) + by);
}

export type RefreshReport = {
  rows: number;
  closed: PeriodKind[];
  notified: number;
  refreshedAt: string;
};

/** Rebuilds every board, category and window. Returns the rows written. */
export async function refreshLeaderboards(): Promise<number> {
  const report = await refreshLeaderboardsDetailed();
  return report.rows;
}

export async function refreshLeaderboardsDetailed(now: Date = new Date()): Promise<RefreshReport> {
  const settings = await getLeaderboardSettings();
  const rules = await db.select().from(schema.gameRules);
  const excludedTypes = new Set(
    rules.filter((r) => r.excludedFromBoards === 1).map((r) => r.eventType)
  );

  const roles = await db.select({ id: schema.roles.id, nameEn: schema.roles.nameEn }).from(schema.roles);
  const roleName = new Map(roles.map((r) => [r.id, r.nameEn]));
  const excludedRoles = new Set(settings.excludeRoles);

  const users = await db
    .select({
      id: schema.users.id,
      nameEn: schema.users.nameEn,
      roleId: schema.users.roleId,
      departmentId: schema.users.departmentId,
    })
    .from(schema.users)
    .where(isNull(schema.users.deletedAt));
  const userById = new Map(users.map((u) => [u.id, u]));
  const eligiblePeople = users.filter((u) => !excludedRoles.has(roleName.get(u.roleId) ?? ""));

  const units = await db
    .select({
      id: schema.orgUnits.id,
      nameEn: schema.orgUnits.nameEn,
      headUserId: schema.orgUnits.headUserId,
    })
    .from(schema.orgUnits)
    .where(eq(schema.orgUnits.isActive, 1));
  const membersByUnit = new Map<string, string[]>();
  for (const u of users) {
    if (!u.departmentId) continue;
    const list = membersByUnit.get(u.departmentId);
    if (list) list.push(u.id);
    else membersByUnit.set(u.departmentId, [u.id]);
  }
  // CR08 7.2: "all units listed" means every unit that has people in it
  const rankedUnits = units.filter((u) => (membersByUnit.get(u.id)?.length ?? 0) > 0);

  const ledger: LedgerEvent[] = await db
    .select({
      userId: schema.gameEvents.userId,
      eventType: schema.gameEvents.eventType,
      resourceType: schema.gameEvents.resourceType,
      resourceId: schema.gameEvents.resourceId,
      points: schema.gameEvents.points,
      createdAt: schema.gameEvents.createdAt,
    })
    .from(schema.gameEvents)
    .where(sql`${schema.gameEvents.points} > 0`);
  const events = ledger.filter((e) => !excludedTypes.has(e.eventType) && userById.has(e.userId));

  const refreshedAt = nowIso();
  const state = await getSetting<LeaderboardState>("leaderboard_state", {
    keys: {},
    refreshedAt: null,
  });

  type Row = typeof schema.leaderboardPeriods.$inferInsert;
  const rows: Row[] = [];
  const closed: PeriodKind[] = [];
  let notified = 0;

  for (const kind of PERIOD_KINDS) {
    const key = periodKeyFor(kind, now);
    const prevKey = previousPeriodKey(kind, key);
    const range = periodRange(kind, key);
    const prevRange = prevKey ? periodRange(kind, prevKey) : null;
    const lastSeen = state.keys[kind];
    const periodClosed = kind !== "all" && Boolean(lastSeen) && lastSeen !== key && lastSeen === prevKey;
    if (periodClosed) closed.push(kind);

    for (const category of CATEGORIES) {
      const current = emptyTotals();
      const previous = emptyTotals();
      for (const e of events) {
        if (!categoryAccepts(category, e.eventType) && !UNIT_ONLY_TYPES.has(e.eventType)) continue;
        const bucket = inRange(e.createdAt, range)
          ? current
          : prevRange && inRange(e.createdAt, prevRange)
            ? previous
            : null;
        if (!bucket) continue;
        const user = userById.get(e.userId)!;
        if (UNIT_ONLY_TYPES.has(e.eventType)) {
          // the unit award: attributed to the named unit, else the payee's unit
          const unitId =
            e.resourceType === "org_unit" && e.resourceId ? e.resourceId : user.departmentId;
          if (unitId && category === "overall") bump(bucket.units, unitId, e.points);
          continue;
        }
        bump(bucket.people, e.userId, e.points);
        if (user.departmentId) {
          bump(bucket.units, user.departmentId, e.points);
          const active = bucket.activeByUnit.get(user.departmentId);
          if (active) active.add(e.userId);
          else bucket.activeByUnit.set(user.departmentId, new Set([e.userId]));
        }
      }

      /* ---- People ---- */
      const peopleNow = rankSubjects(
        eligiblePeople
          .map((u) => ({ id: u.id, name: u.nameEn, points: current.people.get(u.id) ?? 0 }))
          .filter((r) => r.points > 0)
      );
      const peoplePrev = rankSubjects(
        eligiblePeople
          .map((u) => ({ id: u.id, name: u.nameEn, points: previous.people.get(u.id) ?? 0 }))
          .filter((r) => r.points > 0)
      );
      const prevPeopleById = new Map(peoplePrev.map((r) => [r.id, r]));
      for (const r of peopleNow) {
        const p = prevPeopleById.get(r.id);
        rows.push({
          id: newId(),
          board: "people",
          category,
          periodKind: kind,
          periodKey: key,
          subjectId: r.id,
          points: r.points,
          rank: r.rank,
          previousPoints: p?.points ?? 0,
          previousRank: p?.rank ?? null,
          members: null,
          activeMembers: null,
          refreshedAt,
        });
      }

      /* ---- Departments: ranked by points per member ---- */
      const unitRow = (totals: Totals) =>
        rankedUnits.map((u) => {
          const members = membersByUnit.get(u.id)?.length ?? 0;
          const total = totals.units.get(u.id) ?? 0;
          return {
            id: u.id,
            name: u.nameEn,
            total,
            members,
            active: totals.activeByUnit.get(u.id)?.size ?? 0,
            points: pointsPerMember(total, members),
          };
        });
      const unitsNow = rankSubjects(unitRow(current));
      const unitsPrev = rankSubjects(unitRow(previous));
      const prevUnitById = new Map(unitsPrev.map((r) => [r.id, r]));
      for (const r of unitsNow) {
        const p = prevUnitById.get(r.id);
        rows.push({
          id: newId(),
          board: "departments",
          category,
          periodKind: kind,
          periodKey: key,
          subjectId: r.id,
          points: r.total,
          rank: r.rank,
          previousPoints: p?.total ?? 0,
          previousRank: p && p.total > 0 ? p.rank : null,
          members: r.members,
          activeMembers: r.active,
          refreshedAt,
        });
      }

      /* ---- the period-close notification (overall only) ---- */
      if (periodClosed && category === "overall" && prevKey) {
        notified += await notifyPeriodClose(kind, prevKey, peoplePrev, unitsPrev, units);
      }
    }
  }

  // one transaction: the page never sees a half-built table
  await db.transaction(async (tx) => {
    await tx.delete(schema.leaderboardPeriods);
    for (let i = 0; i < rows.length; i += 80) {
      await tx.insert(schema.leaderboardPeriods).values(rows.slice(i, i + 80));
    }
  });

  const keys: LeaderboardState["keys"] = {};
  for (const kind of PERIOD_KINDS) keys[kind] = periodKeyFor(kind, now);
  await setSetting("leaderboard_state", { keys, refreshedAt } satisfies LeaderboardState);

  return { rows: rows.length, closed, notified, refreshedAt };
}

const WINDOW_WORD: Record<Exclude<PeriodKind, "all">, { en: string; ar: string }> = {
  week: { en: "weekly", ar: "الأسبوعية" },
  month: { en: "monthly", ar: "الشهرية" },
  quarter: { en: "quarterly", ar: "الفصلية" },
  year: { en: "yearly", ar: "السنوية" },
};

async function notifyPeriodClose(
  kind: PeriodKind,
  closedKey: string,
  people: { id: string; rank: number; points: number }[],
  units: { id: string; rank: number; total: number; points: number }[],
  allUnits: { id: string; nameEn: string; headUserId: string | null }[]
): Promise<number> {
  if (kind === "all") return 0;
  const word = WINDOW_WORD[kind];
  const link = `/leaderboard?board=people&window=${kind}`;
  let sent = 0;
  for (const r of people.slice(0, 3)) {
    await notify(
      r.id,
      "game_leaderboard",
      `You finished ${ordinalWord(r.rank, "en")} on the ${word.en} board`,
      `حللت في المركز ${ordinalWord(r.rank, "ar")} على اللوحة ${word.ar}`,
      link,
      {
        en: `${periodLabel(kind, closedKey, "en")}: ${r.points} points on the Overall board.`,
        ar: `${periodLabel(kind, closedKey, "ar")}: ${r.points} نقطة على اللوحة العامة.`,
      }
    );
    sent++;
  }
  const winner = units.find((u) => u.rank === 1 && u.total > 0);
  const unit = winner ? allUnits.find((u) => u.id === winner.id) : null;
  if (unit?.headUserId) {
    await notify(
      unit.headUserId,
      "game_leaderboard",
      `Your unit finished first on the ${word.en} Departments board`,
      `حلّت وحدتك في المركز الأول على لوحة الإدارات ${word.ar}`,
      `/leaderboard?board=departments&window=${kind}`,
      {
        en: `${unit.nameEn}, ${periodLabel(kind, closedKey, "en")}: ${winner!.points} points per member.`,
        ar: `${unit.nameEn}، ${periodLabel(kind, closedKey, "ar")}: ${winner!.points} نقطة لكل عضو.`,
      }
    );
    sent++;
  }
  return sent;
}

/* ------------------------------------------------------------------ */
/* the read side: leaderboard_periods only                               */
/* ------------------------------------------------------------------ */

export type BoardQuery = { board: BoardKind; window: PeriodKind; category: BoardCategory };

export type PersonRow = {
  subjectId: string;
  rank: number;
  points: number;
  previousRank: number | null;
  previousPoints: number;
  trend: Trend;
  nameEn: string;
  nameAr: string;
  avatarColor: string;
  unitId: string | null;
  unitEn: string | null;
  unitAr: string | null;
  levelOrder: number | null;
  levelNameEn: string | null;
  levelNameAr: string | null;
  descriptorEn: string | null;
  descriptorAr: string | null;
  isMe: boolean;
  /** true for a Department Head's own-unit rows beyond the top ten */
  inViewerUnit: boolean;
};

export type UnitRow = {
  subjectId: string;
  rank: number;
  points: number;
  previousRank: number | null;
  previousPoints: number;
  trend: Trend;
  nameEn: string;
  nameAr: string;
  code: string;
  members: number;
  activeMembers: number;
  pointsPerMember: number;
  activeShare: number;
  isMine: boolean;
};

export type LeaderboardView = BoardQuery & {
  periodKey: string;
  periodStart: string | null;
  periodEnd: string | null;
  refreshedAt: string | null;
  /** the whole table is empty: the job has not run yet */
  notBuilt: boolean;
  /** quiet mode hides the board from this viewer */
  hidden: boolean;
  scope: BoardScope;
  total: number;
  people: PersonRow[];
  units: UnitRow[];
  mine: PersonRow | null;
  mineUnit: UnitRow | null;
  /** the viewer's role is excluded from the People board */
  excludedViewer: boolean;
  canRefresh: boolean;
};

async function levelsByPoints() {
  const levels = await db.select().from(schema.levels).orderBy(schema.levels.order);
  return (points: number) => levels.filter((l) => l.minPoints <= points).pop() ?? null;
}

async function tableRefreshedAt(): Promise<string | null> {
  const [row] = await db
    .select({ at: sql<string | null>`max(${schema.leaderboardPeriods.refreshedAt})` })
    .from(schema.leaderboardPeriods);
  return row?.at ?? null;
}

export async function getLeaderboard(user: CurrentUser, q: BoardQuery): Promise<LeaderboardView> {
  const settings = await getLeaderboardSettings();
  const periodKey = periodKeyFor(q.window);
  const range = periodRange(q.window, periodKey);
  const refreshedAt = await tableRefreshedAt();
  const base: LeaderboardView = {
    ...q,
    periodKey,
    periodStart: range.start,
    periodEnd: range.end,
    refreshedAt,
    notBuilt: refreshedAt === null,
    hidden: settings.quietModeHidesBoard && user.quietMode === 1,
    scope: boardScopeFor(user),
    total: 0,
    people: [],
    units: [],
    mine: null,
    mineUnit: null,
    excludedViewer: settings.excludeRoles.includes(user.role.nameEn),
    canRefresh: canRefreshLeaderboard(user),
  };
  if (base.hidden) return base;

  const stored = await db
    .select()
    .from(schema.leaderboardPeriods)
    .where(
      and(
        eq(schema.leaderboardPeriods.board, q.board),
        eq(schema.leaderboardPeriods.category, q.category),
        eq(schema.leaderboardPeriods.periodKind, q.window),
        eq(schema.leaderboardPeriods.periodKey, periodKey)
      )
    )
    .orderBy(schema.leaderboardPeriods.rank);
  base.total = stored.length;
  if (!stored.length) return base;

  if (q.board === "departments") {
    const unitRows = await db
      .select({
        id: schema.orgUnits.id,
        code: schema.orgUnits.code,
        nameEn: schema.orgUnits.nameEn,
        nameAr: schema.orgUnits.nameAr,
      })
      .from(schema.orgUnits)
      .where(inArray(schema.orgUnits.id, stored.map((r) => r.subjectId)));
    const unitById = new Map(unitRows.map((u) => [u.id, u]));
    base.units = stored
      .map((r) => {
        const u = unitById.get(r.subjectId);
        if (!u) return null;
        const members = r.members ?? 0;
        const active = r.activeMembers ?? 0;
        return {
          subjectId: r.subjectId,
          rank: r.rank,
          points: r.points,
          previousRank: r.previousRank,
          previousPoints: r.previousPoints,
          // a unit that has not scored is listed (every unit is), but it is
          // neither "new" nor moving
          trend: r.points > 0 ? trendOf(r.rank, r.previousRank) : "same",
          nameEn: u.nameEn,
          nameAr: u.nameAr,
          code: u.code,
          members,
          activeMembers: active,
          pointsPerMember: pointsPerMember(r.points, members),
          activeShare: activeShare(active, members),
          isMine: r.subjectId === user.departmentId,
        } satisfies UnitRow;
      })
      .filter((r): r is UnitRow => r !== null);
    base.mineUnit = base.units.find((u) => u.isMine) ?? null;
    return base;
  }

  /* ---- People ---- */
  const scope = base.scope;
  const own = stored.find((r) => r.subjectId === user.id) ?? null;
  // everyone sees the top ten; admins and HR the whole list
  const visible = scope === "full" ? stored : stored.slice(0, 10);
  const ids = new Set(visible.map((r) => r.subjectId));
  if (own) ids.add(own.subjectId);
  // a Department Head also sees every member of their own unit
  const unitMemberIds = new Set<string>();
  if (scope === "unit" && user.departmentId) {
    const members = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.departmentId, user.departmentId), isNull(schema.users.deletedAt)));
    for (const m of members) unitMemberIds.add(m.id);
    for (const r of stored) if (unitMemberIds.has(r.subjectId)) ids.add(r.subjectId);
  }

  const people = await db
    .select({
      id: schema.users.id,
      nameEn: schema.users.nameEn,
      nameAr: schema.users.nameAr,
      avatarColor: schema.users.avatarColor,
      departmentId: schema.users.departmentId,
      unitEn: schema.orgUnits.nameEn,
      unitAr: schema.orgUnits.nameAr,
      totalPoints: schema.userGameState.totalPoints,
    })
    .from(schema.users)
    .leftJoin(schema.orgUnits, eq(schema.orgUnits.id, schema.users.departmentId))
    .leftJoin(schema.userGameState, eq(schema.userGameState.userId, schema.users.id))
    .where(inArray(schema.users.id, [...ids]));
  const personById = new Map(people.map((p) => [p.id, p]));
  const levelFor = await levelsByPoints();

  const toRow = (r: (typeof stored)[number]): PersonRow | null => {
    const p = personById.get(r.subjectId);
    if (!p) return null;
    const level = levelFor(p.totalPoints ?? 0);
    return {
      subjectId: r.subjectId,
      rank: r.rank,
      points: r.points,
      previousRank: r.previousRank,
      previousPoints: r.previousPoints,
      trend: trendOf(r.rank, r.previousRank),
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      avatarColor: p.avatarColor,
      unitId: p.departmentId,
      unitEn: p.unitEn ?? null,
      unitAr: p.unitAr ?? null,
      levelOrder: level?.order ?? null,
      levelNameEn: level?.nameEn ?? null,
      levelNameAr: level?.nameAr ?? null,
      descriptorEn: level?.descriptorEn ?? null,
      descriptorAr: level?.descriptorAr ?? null,
      isMe: r.subjectId === user.id,
      inViewerUnit: unitMemberIds.has(r.subjectId),
    };
  };

  base.people = stored
    .filter((r, i) => scope === "full" || i < 10 || unitMemberIds.has(r.subjectId))
    .map(toRow)
    .filter((r): r is PersonRow => r !== null);
  base.mine = own ? toRow(own) : null;
  return base;
}

/** CR08 7.2: the Home block, top five people this month plus the viewer. */
export async function getHomeLeaderboard(user: CurrentUser): Promise<{
  hidden: boolean;
  notBuilt: boolean;
  periodKey: string;
  top: PersonRow[];
  mine: PersonRow | null;
  excludedViewer: boolean;
}> {
  const view = await getLeaderboard(user, { board: "people", window: "month", category: "overall" });
  return {
    hidden: view.hidden,
    notBuilt: view.notBuilt,
    periodKey: view.periodKey,
    top: view.people.slice(0, 5),
    mine: view.mine,
    excludedViewer: view.excludedViewer,
  };
}

/** A compact text rendering for Ask NPC and the smoke checks. */
export function describeBoard(view: LeaderboardView, limit = 5): string {
  const label = periodLabel(view.window, view.periodKey, "en");
  if (view.hidden) return "The leaderboard is hidden for this person because quiet mode is on.";
  if (view.notBuilt) return "The leaderboard has not been built yet; it refreshes every ten minutes.";
  const head = `${view.board === "people" ? "People" : "Departments"} board, ${view.category}, ${label} (refreshed ${view.refreshedAt ?? "never"})`;
  if (view.board === "departments") {
    if (!view.units.length) return `${head}: no unit has scored in this period.`;
    const lines = view.units
      .slice(0, limit)
      .map(
        (u) =>
          `${u.rank}. ${u.nameEn} (${u.code}): ${u.pointsPerMember} points per member, ${u.points} total, ${u.activeMembers}/${u.members} active, trend ${u.trend}`
      );
    return [head, ...lines].join("\n");
  }
  if (!view.people.length) return `${head}: nobody has scored in this period.`;
  const lines = view.people
    .slice(0, limit)
    .map(
      (p) =>
        `${p.rank}. ${p.nameEn}${p.unitEn ? ` (${p.unitEn})` : ""}: ${p.points} points, ${p.levelNameEn ?? "no level"}, trend ${p.trend}`
    );
  const mine = view.mine
    ? `Viewer: rank ${view.mine.rank} with ${view.mine.points} points.`
    : view.excludedViewer
      ? "Viewer: administrator accounts are not ranked on the People board."
      : "Viewer: no points in this period yet.";
  return [head, ...lines, mine].join("\n");
}

export { BOARDS, CATEGORIES, PERIOD_KINDS };
