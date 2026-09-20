// CR08 7.2: the database-free arithmetic of the leaderboard. Period keys,
// period ranges, ranking with tie-breaks and trend arrows live here so the
// unit tests need no database and the client can label periods the same way
// the refresh job keys them. Everything is computed in UTC, matching the ISO
// timestamps in game_events.

export const BOARDS = ["people", "departments"] as const;
export type BoardKind = (typeof BOARDS)[number];

export const CATEGORIES = ["overall", "contributors", "guardians", "learners"] as const;
export type BoardCategory = (typeof CATEGORIES)[number];

export const PERIOD_KINDS = ["week", "month", "quarter", "year", "all"] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

export type Trend = "up" | "down" | "same" | "new";

export const ALL_TIME_KEY = "all";

export function isBoardKind(v: unknown): v is BoardKind {
  return typeof v === "string" && (BOARDS as readonly string[]).includes(v);
}
export function isCategory(v: unknown): v is BoardCategory {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
}
export function isPeriodKind(v: unknown): v is PeriodKind {
  return typeof v === "string" && (PERIOD_KINDS as readonly string[]).includes(v);
}

/* ------------------------------------------------------------------ */
/* ISO weeks                                                             */
/* ------------------------------------------------------------------ */

function isoWeekParts(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

/** Monday 00:00 UTC of the given ISO week (January 4 is always in week 1). */
function isoWeekStart(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime());
  monday.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1) * 7);
  return monday;
}

/* ------------------------------------------------------------------ */
/* period keys                                                           */
/* ------------------------------------------------------------------ */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** The key of the period that contains `date` (default now). */
export function periodKeyFor(kind: PeriodKind, date: Date = new Date()): string {
  switch (kind) {
    case "week": {
      const { year, week } = isoWeekParts(date);
      return `${year}-W${pad2(week)}`;
    }
    case "month":
      return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
    case "quarter":
      return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
    case "year":
      return String(date.getUTCFullYear());
    default:
      return ALL_TIME_KEY;
  }
}

/** Parses a key back to its parts; null when the key is not of that kind. */
export function parsePeriodKey(
  kind: PeriodKind,
  key: string
): { year: number; index: number } | null {
  switch (kind) {
    case "week": {
      const m = /^(\d{4})-W(\d{2})$/.exec(key);
      return m ? { year: Number(m[1]), index: Number(m[2]) } : null;
    }
    case "month": {
      const m = /^(\d{4})-(\d{2})$/.exec(key);
      return m ? { year: Number(m[1]), index: Number(m[2]) } : null;
    }
    case "quarter": {
      const m = /^(\d{4})-Q([1-4])$/.exec(key);
      return m ? { year: Number(m[1]), index: Number(m[2]) } : null;
    }
    case "year": {
      const m = /^(\d{4})$/.exec(key);
      return m ? { year: Number(m[1]), index: 1 } : null;
    }
    default:
      return key === ALL_TIME_KEY ? { year: 0, index: 0 } : null;
  }
}

/** [start, end) of a period as ISO strings; both null for all time. */
export function periodRange(
  kind: PeriodKind,
  key: string
): { start: string | null; end: string | null } {
  const parts = parsePeriodKey(kind, key);
  if (!parts || kind === "all") return { start: null, end: null };
  let start: Date;
  let end: Date;
  switch (kind) {
    case "week":
      start = isoWeekStart(parts.year, parts.index);
      end = new Date(start.getTime() + 7 * 86400000);
      break;
    case "month":
      start = new Date(Date.UTC(parts.year, parts.index - 1, 1));
      end = new Date(Date.UTC(parts.year, parts.index, 1));
      break;
    case "quarter":
      start = new Date(Date.UTC(parts.year, (parts.index - 1) * 3, 1));
      end = new Date(Date.UTC(parts.year, parts.index * 3, 1));
      break;
    default:
      start = new Date(Date.UTC(parts.year, 0, 1));
      end = new Date(Date.UTC(parts.year + 1, 0, 1));
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

/** The key of the period just before `key`; null for all time or a bad key. */
export function previousPeriodKey(kind: PeriodKind, key: string): string | null {
  const parts = parsePeriodKey(kind, key);
  if (!parts || kind === "all") return null;
  switch (kind) {
    case "week": {
      const start = isoWeekStart(parts.year, parts.index);
      return periodKeyFor("week", new Date(start.getTime() - 7 * 86400000));
    }
    case "month":
      return parts.index === 1
        ? `${parts.year - 1}-12`
        : `${parts.year}-${pad2(parts.index - 1)}`;
    case "quarter":
      return parts.index === 1 ? `${parts.year - 1}-Q4` : `${parts.year}-Q${parts.index - 1}`;
    default:
      return String(parts.year - 1);
  }
}

/** True when `event` (an ISO timestamp) falls inside the period. */
export function inRange(
  event: string,
  range: { start: string | null; end: string | null }
): boolean {
  if (range.start && event < range.start) return false;
  if (range.end && event >= range.end) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* ranking                                                               */
/* ------------------------------------------------------------------ */

export type Rankable = { id: string; points: number; name: string };

/**
 * Sorts by points (highest first) and breaks ties by name, then numbers the
 * rows 1..n. Ranks are therefore unique: two people on equal points sit on
 * consecutive ranks in name order, so a podium always has three distinct
 * places.
 */
export function rankSubjects<T extends Rankable>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort(
    (a, b) => b.points - a.points || a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id)
  );
  return sorted.map((row, i) => ({ ...row, rank: i + 1 }));
}

/** Direction of movement against the previous period. */
export function trendOf(rank: number | null, previousRank: number | null): Trend {
  if (rank == null) return "same";
  if (previousRank == null) return "new";
  if (rank < previousRank) return "up";
  if (rank > previousRank) return "down";
  return "same";
}

/** Total divided by members, one decimal, zero when the unit is empty. */
export function pointsPerMember(total: number, members: number): number {
  if (!members || members <= 0) return 0;
  return Math.round((total / members) * 10) / 10;
}

/** Share of members who scored at all, 0..1. */
export function activeShare(activeMembers: number, members: number): number {
  if (!members || members <= 0) return 0;
  return Math.min(1, Math.max(0, activeMembers / members));
}

/* ------------------------------------------------------------------ */
/* labels                                                                */
/* ------------------------------------------------------------------ */

const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];
const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** A human period label: "September 2026", "Week 38, 2026", "Q3 2026". */
export function periodLabel(kind: PeriodKind, key: string, locale: string): string {
  const ar = locale === "ar";
  const parts = parsePeriodKey(kind, key);
  if (!parts || kind === "all") return ar ? "منذ البداية" : "All time";
  switch (kind) {
    case "week": {
      const range = periodRange(kind, key);
      const start = range.start ? new Date(range.start) : null;
      const end = range.end ? new Date(new Date(range.end).getTime() - 86400000) : null;
      const span =
        start && end
          ? `${start.getUTCDate()} ${ar ? MONTHS_AR[start.getUTCMonth()] : MONTHS_EN[start.getUTCMonth()].slice(0, 3)} to ${end.getUTCDate()} ${ar ? MONTHS_AR[end.getUTCMonth()] : MONTHS_EN[end.getUTCMonth()].slice(0, 3)}`
          : "";
      const spanAr =
        start && end
          ? `${start.getUTCDate()} ${MONTHS_AR[start.getUTCMonth()]} إلى ${end.getUTCDate()} ${MONTHS_AR[end.getUTCMonth()]}`
          : "";
      return ar
        ? `الأسبوع ${parts.index}، ${parts.year} (${spanAr})`
        : `Week ${parts.index}, ${parts.year} (${span})`;
    }
    case "month":
      return ar
        ? `${MONTHS_AR[parts.index - 1]} ${parts.year}`
        : `${MONTHS_EN[parts.index - 1]} ${parts.year}`;
    case "quarter":
      return ar ? `الربع ${parts.index} من ${parts.year}` : `Q${parts.index} ${parts.year}`;
    default:
      return String(parts.year);
  }
}

/** Ordinal words for the period-close notification. */
export function ordinalWord(rank: number, locale: string): string {
  if (locale === "ar") {
    return ["الأول", "الثاني", "الثالث"][rank - 1] ?? `رقم ${rank}`;
  }
  const s = ["th", "st", "nd", "rd"];
  const v = rank % 100;
  return `${rank}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
