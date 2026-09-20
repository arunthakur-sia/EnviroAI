/* eslint-disable no-console */
// CR08 11: the seed orchestrator for every CR08 module. Wired into seed.ts
// block 12h; each module owns its own file (scripts/cr08-<module>-seed.ts)
// and exports a default async function that is idempotent.
//
//   npx tsx scripts/cr08-seed.ts            all modules
//   npx tsx scripts/cr08-seed.ts indices    one module
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { eq } from "drizzle-orm";

export const CR08_SEED_MODULES = [
  "portals",
  "gamification",
  "org",
  "experts",
  "studies",
  "indices",
  "reports",
  "handover",
  "kow",
  "messaging",
  "opmodel",
  // CR08 9.1: the KPI custodians the owner chips read (no column, no migration)
  "owners-strategy",
] as const;
export type Cr08SeedModule = (typeof CR08_SEED_MODULES)[number];

/**
 * CR08 2.2 / 11: every role seeded by CR05 carries a stored portal set that
 * predates the new portals (DECISIONS 77), so the new keys are appended to
 * every stored role set in rail order, following the role's default policy.
 */
export async function seedCr08Portals(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const { PORTALS } = await import("../src/server/db/json");
  const { defaultPortalsForRole } = await import("../src/server/auth/permissions");
  const roles = await db.select().from(schema.roles);
  let touched = 0;
  for (const role of roles) {
    let stored: string[] | null = null;
    try {
      const parsed = JSON.parse(role.portalsJson ?? "null");
      stored = Array.isArray(parsed) ? parsed.filter((p) => typeof p === "string") : null;
    } catch {
      stored = null;
    }
    if (!stored) continue;
    const defaults = new Set<string>(defaultPortalsForRole(role.nameEn));
    const have = new Set(stored);
    // a portal the role's default policy grants, that the stored set never
    // had the chance to include
    const missing = PORTALS.filter((p) => defaults.has(p) && !have.has(p));
    if (!missing.length) continue;
    const next = PORTALS.filter((p) => have.has(p) || missing.includes(p));
    await db
      .update(schema.roles)
      .set({ portalsJson: JSON.stringify(next) })
      .where(eq(schema.roles.id, role.id));
    touched++;
  }
  console.log(`cr08 portals: ${touched} role sets extended`);
}

/** CR08 7.1: the explorer badge family drops the retired level word from its
    display names on an existing database (the pristine seed writes the new
    names directly). */
export async function seedCr08BadgeNames(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const names: Record<string, [string, string]> = {
    explorer_bronze: ["Pathfinder I", "رائد 1"],
    explorer_silver: ["Pathfinder II", "رائد 2"],
    explorer_gold: ["Pathfinder III", "رائد 3"],
  };
  let renamed = 0;
  for (const [code, [nameEn, nameAr]] of Object.entries(names)) {
    const [row] = await db.select().from(schema.badges).where(eq(schema.badges.code, code)).limit(1);
    if (!row || (row.nameEn === nameEn && row.nameAr === nameAr)) continue;
    await db.update(schema.badges).set({ nameEn, nameAr }).where(eq(schema.badges.id, row.id));
    renamed++;
  }
  console.log(`cr08 badges: ${renamed} explorer badges renamed`);
}

export async function seedCr08(only?: string[]): Promise<void> {
  const wanted = new Set(only && only.length ? only : CR08_SEED_MODULES);
  for (const mod of CR08_SEED_MODULES) {
    if (!wanted.has(mod)) continue;
    if (mod === "portals") {
      await seedCr08Portals();
      await seedCr08BadgeNames();
      continue;
    }
    const file = `./cr08-${mod}-seed`;
    const imported = (await import(file)) as { default?: () => Promise<void> };
    if (typeof imported.default !== "function") {
      console.warn(`cr08 seed: ${file} has no default export, skipped`);
      continue;
    }
    console.log(`-- cr08 ${mod}`);
    await imported.default();
  }

  /* CR08 7.2: the boards are materialised, so they are rebuilt once after
     every other module has paid its points (Knowledge of the Week, the
     handover learning paths, the published reports). */
  if (!only || !only.length) {
    const { refreshLeaderboardsDetailed } = await import("../src/server/services/leaderboard");
    const report = await refreshLeaderboardsDetailed();
    console.log(`cr08 leaderboards: ${report.rows} rows refreshed`);
  }
}

const isMain = process.argv[1] && /cr08-seed\.ts$/.test(process.argv[1]);
if (isMain) {
  seedCr08(process.argv.slice(2))
    .then(() => {
      console.log("cr08 seed complete");
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
