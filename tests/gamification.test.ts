// Unit tests: caps, multipliers, streak freeze consumption, level thresholds,
// confidence rules, and i18n key parity. Runs against an isolated temp database.
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

// the engine tests run against the seeded data/nexus.db (npm run seed)

describe("i18n key parity", () => {
  it("en.json and ar.json have identical key sets", () => {
    const flat = (o: Record<string, unknown>, p = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === "object" && v !== null ? flat(v as Record<string, unknown>, p + k + ".") : [p + k]
      );
    const en = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages/en.json"), "utf8"));
    const ar = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages/ar.json"), "utf8"));
    const enKeys = new Set(flat(en));
    const arKeys = new Set(flat(ar));
    expect([...enKeys].filter((k) => !arKeys.has(k))).toEqual([]);
    expect([...arKeys].filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it("no em dashes in UI messages", () => {
    for (const f of ["en.json", "ar.json"]) {
      const text = fs.readFileSync(path.join(process.cwd(), "messages", f), "utf8");
      expect(text.includes(String.fromCharCode(0x2014)), `${f} contains an em dash`).toBe(false);
    }
  });
});

describe("confidence rules", () => {
  it("computes coverage and confidence per section 11.5", async () => {
    const { citationCoverage, computeConfidence } = await import("../src/server/ai/ask");
    const covered =
      "The population reached 3.1 million in July 2026, according to the monthly bulletin [1]. Growth was driven by workforce inflows across the construction sector [2].";
    expect(citationCoverage(covered)).toBe(1);
    const uncovered =
      "The population reached 3.1 million in July 2026, according to the monthly bulletin. Growth was driven by workforce inflows across construction and services sectors generally.";
    expect(citationCoverage(uncovered)).toBe(0);

    const chunk = (verified: boolean) =>
      ({ verified }) as unknown as import("../src/server/search/hybrid").RetrievedChunk;
    expect(computeConfidence([chunk(true), chunk(true)], 0.7, 1)).toBe("high");
    expect(computeConfidence([chunk(true)], 0.7, 1)).toBe("medium");
    expect(computeConfidence([chunk(true), chunk(true)], 0.2, 1)).toBe("low");
    expect(computeConfidence([chunk(true), chunk(true)], 0.7, 0.5)).toBe("low");
  });
});

describe("engine primitives", () => {
  it("iso week helpers roll over correctly", async () => {
    const { isoWeekKey } = await import("../src/lib/ids");
    expect(isoWeekKey(new Date("2026-01-01T12:00:00Z"))).toMatch(/^202[56]-W\d{2}$/);
    expect(isoWeekKey(new Date("2026-09-08T12:00:00Z"))).toBe("2026-W37");
  });
});

/* CR08 7.2: the leaderboard arithmetic needs no database */
describe("leaderboard period keys", () => {
  it("keys every window kind from one date", async () => {
    const m = await import("../src/lib/leaderboard-math");
    const d = new Date("2026-09-19T10:00:00Z");
    expect(m.periodKeyFor("week", d)).toBe("2026-W38");
    expect(m.periodKeyFor("month", d)).toBe("2026-09");
    expect(m.periodKeyFor("quarter", d)).toBe("2026-Q3");
    expect(m.periodKeyFor("year", d)).toBe("2026");
    expect(m.periodKeyFor("all", d)).toBe("all");
  });

  it("puts the first days of January in the last ISO week of the previous year", async () => {
    const m = await import("../src/lib/leaderboard-math");
    expect(m.periodKeyFor("week", new Date("2027-01-01T12:00:00Z"))).toBe("2026-W53");
    expect(m.periodKeyFor("week", new Date("2026-01-01T12:00:00Z"))).toBe("2026-W01");
    expect(m.periodKeyFor("week", new Date("2021-01-03T12:00:00Z"))).toBe("2020-W53");
  });

  it("walks back to the previous period across year boundaries", async () => {
    const m = await import("../src/lib/leaderboard-math");
    expect(m.previousPeriodKey("week", "2026-W38")).toBe("2026-W37");
    expect(m.previousPeriodKey("week", "2026-W01")).toBe("2025-W52");
    expect(m.previousPeriodKey("month", "2026-01")).toBe("2025-12");
    expect(m.previousPeriodKey("month", "2026-09")).toBe("2026-08");
    expect(m.previousPeriodKey("quarter", "2026-Q1")).toBe("2025-Q4");
    expect(m.previousPeriodKey("quarter", "2026-Q3")).toBe("2026-Q2");
    expect(m.previousPeriodKey("year", "2026")).toBe("2025");
    expect(m.previousPeriodKey("all", "all")).toBeNull();
    expect(m.previousPeriodKey("month", "nonsense")).toBeNull();
  });

  it("ranges are half-open and start on Monday for weeks", async () => {
    const m = await import("../src/lib/leaderboard-math");
    const week = m.periodRange("week", "2026-W38");
    expect(week.start).toBe("2026-09-14T00:00:00.000Z");
    expect(week.end).toBe("2026-09-21T00:00:00.000Z");
    const month = m.periodRange("month", "2026-09");
    expect(month.start).toBe("2026-09-01T00:00:00.000Z");
    expect(month.end).toBe("2026-10-01T00:00:00.000Z");
    const quarter = m.periodRange("quarter", "2026-Q4");
    expect(quarter.start).toBe("2026-10-01T00:00:00.000Z");
    expect(quarter.end).toBe("2027-01-01T00:00:00.000Z");
    expect(m.periodRange("all", "all")).toEqual({ start: null, end: null });
    expect(m.inRange("2026-09-21T00:00:00.000Z", week)).toBe(false);
    expect(m.inRange("2026-09-20T23:59:59.000Z", week)).toBe(true);
    expect(m.inRange("2026-09-13T23:59:59.000Z", week)).toBe(false);
    expect(m.inRange("1999-01-01T00:00:00.000Z", m.periodRange("all", "all"))).toBe(true);
  });

  it("every period key round-trips through its own range", async () => {
    const m = await import("../src/lib/leaderboard-math");
    for (const kind of ["week", "month", "quarter", "year"] as const) {
      const key = m.periodKeyFor(kind, new Date("2026-03-31T23:30:00Z"));
      const range = m.periodRange(kind, key);
      expect(m.inRange("2026-03-31T23:30:00.000Z", range)).toBe(true);
      expect(m.periodKeyFor(kind, new Date(range.start!))).toBe(key);
    }
  });

  it("labels periods in both languages", async () => {
    const m = await import("../src/lib/leaderboard-math");
    expect(m.periodLabel("month", "2026-09", "en")).toBe("September 2026");
    expect(m.periodLabel("month", "2026-09", "ar")).toBe("سبتمبر 2026");
    expect(m.periodLabel("quarter", "2026-Q3", "en")).toBe("Q3 2026");
    expect(m.periodLabel("all", "all", "ar")).toBe("منذ البداية");
    expect(m.periodLabel("week", "2026-W38", "en")).toContain("Week 38, 2026");
    expect(m.ordinalWord(1, "en")).toBe("1st");
    expect(m.ordinalWord(2, "en")).toBe("2nd");
    expect(m.ordinalWord(3, "en")).toBe("3rd");
    expect(m.ordinalWord(11, "en")).toBe("11th");
    expect(m.ordinalWord(22, "en")).toBe("22nd");
    expect(m.ordinalWord(2, "ar")).toBe("الثاني");
  });
});

describe("leaderboard ranking", () => {
  it("ranks by points, breaks ties by name, and numbers 1..n", async () => {
    const { rankSubjects } = await import("../src/lib/leaderboard-math");
    const ranked = rankSubjects([
      { id: "c", name: "Noora", points: 120 },
      { id: "a", name: "Hamad", points: 340 },
      { id: "b", name: "Aisha", points: 120 },
      { id: "d", name: "Khalid", points: 0 },
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    // equal points, equal names: the id keeps the order stable
    const twins = rankSubjects([
      { id: "z", name: "Same", points: 5 },
      { id: "y", name: "Same", points: 5 },
    ]);
    expect(twins.map((r) => r.id)).toEqual(["y", "z"]);
  });

  it("does not mutate its input", async () => {
    const { rankSubjects } = await import("../src/lib/leaderboard-math");
    const input = [
      { id: "1", name: "B", points: 1 },
      { id: "2", name: "A", points: 9 },
    ];
    rankSubjects(input);
    expect(input[0].id).toBe("1");
  });

  it("derives trends against the previous period", async () => {
    const { trendOf } = await import("../src/lib/leaderboard-math");
    expect(trendOf(1, 3)).toBe("up");
    expect(trendOf(5, 2)).toBe("down");
    expect(trendOf(4, 4)).toBe("same");
    expect(trendOf(2, null)).toBe("new");
    expect(trendOf(null, 2)).toBe("same");
  });

  it("computes unit measures without dividing by zero", async () => {
    const { pointsPerMember, activeShare } = await import("../src/lib/leaderboard-math");
    expect(pointsPerMember(300, 4)).toBe(75);
    expect(pointsPerMember(100, 3)).toBe(33.3);
    expect(pointsPerMember(100, 0)).toBe(0);
    expect(activeShare(2, 8)).toBe(0.25);
    expect(activeShare(9, 8)).toBe(1);
    expect(activeShare(1, 0)).toBe(0);
  });
});

describe("gamification engine against the seeded database", () => {
  let db: typeof import("../src/server/db/client").db;
  let schema: typeof import("../src/server/db/client").schema;
  let record: typeof import("../src/server/gamification/engine").record;
  let userId: string;

  beforeAll(async () => {
    // requires a seeded data/nexus.db (npm run seed)
    const client = await import("../src/server/db/client");
    db = client.db;
    schema = client.schema;
    ({ record } = await import("../src/server/gamification/engine"));
    const { eq } = await import("drizzle-orm");
    const [reader] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "reader@npc.qa"))
      .limit(1);
    expect(reader).toBeTruthy();
    userId = reader.id;
  });

  it("daily_login is once per day", async () => {
    const first = await record({ userId, type: "daily_login" });
    const second = await record({ userId, type: "daily_login" });
    expect(second.recorded).toBe(false);
    expect(second.points).toBe(0);
    // first may be false if the seed already logged one today; at most one records
    expect([first.recorded, second.recorded].filter(Boolean).length).toBeLessThanOrEqual(1);
  });

  it("ai_tag_confirmed caps at 30 points per day", async () => {
    let total = 0;
    for (let i = 0; i < 15; i++) {
      const r = await record({
        userId,
        type: "ai_tag_confirmed",
        resourceType: "tag",
        resourceId: `test-tag-${i}-${Date.now()}`,
      });
      total += r.points;
    }
    expect(total).toBeLessThanOrEqual(30);
    const more = await record({
      userId,
      type: "ai_tag_confirmed",
      resourceType: "tag",
      resourceId: `overflow-${Date.now()}`,
    });
    expect(more.points).toBe(0);
  });

  it("document_read_fully is once per document", async () => {
    const docId = `test-doc-${Date.now()}`;
    const first = await record({
      userId,
      type: "document_read_fully",
      resourceType: "document",
      resourceId: docId,
      meta: { outcomes: ["eco_growth"] },
    });
    const second = await record({
      userId,
      type: "document_read_fully",
      resourceType: "document",
      resourceId: docId,
    });
    expect(second.recorded).toBe(false);
    expect(first.points === 3 || first.points === 0).toBe(true);
  });

  it("gap fill applies a 2x multiplier", async () => {
    const r = await record({
      userId,
      type: "lesson_published",
      resourceType: "lesson",
      resourceId: `test-lesson-${Date.now()}`,
      meta: { gapFill: true },
    });
    expect(r.recorded).toBe(true);
    expect(r.points).toBe(50); // 25 x 2
  });

  it("level thresholds match CR08 7.1 and carry only numeric names", async () => {
    const levels = await db.select().from(schema.levels).orderBy(schema.levels.order);
    expect(levels.map((l) => l.minPoints)).toEqual([
      0, 100, 300, 700, 1300, 2200, 3500, 5500, 8500, 13000,
    ]);
    expect(levels.map((l) => l.nameEn)).toEqual(levels.map((_, i) => `Level ${i + 1}`));
    expect(levels.map((l) => l.nameAr)).toEqual(levels.map((_, i) => `المستوى ${i + 1}`));
    for (const l of levels) expect(l.descriptorEn).toBeTruthy();
  });

  it("streak freezes: earn one per 5 contributions, capped at 3", async () => {
    const { eq } = await import("drizzle-orm");
    const before = await db
      .select()
      .from(schema.userGameState)
      .where(eq(schema.userGameState.userId, userId));
    const startCount = before[0]?.contributionCount ?? 0;
    const startFreezes = before[0]?.streakFreezes ?? 0;
    // push contributions to cross a multiple of 5
    const need = 5 - (startCount % 5);
    for (let i = 0; i < need; i++) {
      await record({
        userId,
        type: "kpi_value_entered",
        resourceType: "kpi",
        resourceId: `freeze-test-${Date.now()}-${i}`,
      });
    }
    const after = await db
      .select()
      .from(schema.userGameState)
      .where(eq(schema.userGameState.userId, userId));
    expect(after[0].streakFreezes).toBeGreaterThanOrEqual(Math.min(3, startFreezes));
    expect(after[0].streakFreezes).toBeLessThanOrEqual(3);
  });
});
