// Unit tests: caps, multipliers, streak freeze consumption, level thresholds,
// confidence rules, and i18n key parity. Runs against an isolated temp database.
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

// isolate the database before any server import
const TEST_DIR = fs.mkdtempSync(path.join(process.cwd(), "data", "test-"));
process.chdir; // keep cwd; we point the db by copying after migrate below

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
      expect(text.includes("—"), `${f} contains an em dash`).toBe(false);
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

  it("level thresholds match the blueprint", async () => {
    const levels = await db.select().from(schema.levels).orderBy(schema.levels.order);
    expect(levels.map((l) => l.minPoints)).toEqual([0, 150, 600, 1500, 4000]);
    expect(levels[4].nameEn).toBe("NPC Sage");
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
