#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * What has to happen inside the container before the server accepts a request.
 *
 * The volume is not mounted while the image is built, nor during a pre-deploy
 * step, so none of this can be done earlier: the first moment the data
 * directory exists is the moment the container starts. Plain JavaScript and
 * runtime dependencies only, so it runs in a production install with no tsx
 * and no TypeScript.
 *
 * It is safe to run on every start. It restores a bundle once, migrates if
 * there is anything to migrate, and otherwise does nothing.
 *
 *   node scripts/boot.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { DATA_DIR, DB_PATH, dataPath, dbUrl, ensureDataDirs } from "./lib/paths.mjs";
import { applyMigrations } from "./lib/migrate-core.mjs";

const BUNDLE_NAME = "sianexus-data.tar.gz";
const t0 = Date.now();
const step = (n, text) => console.log(`[boot ${n}/5] ${text}`);

function human(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} kB`;
}

/* ------------------------------------------------------------------ */
/* 1. the data directory                                                */
/* ------------------------------------------------------------------ */

step(1, `data directory ${DATA_DIR}`);
ensureDataDirs();

/* ------------------------------------------------------------------ */
/* 2. restore a bundle, once                                            */
/* ------------------------------------------------------------------ */

const bundle = dataPath("import", BUNDLE_NAME);
if (!fs.existsSync(bundle)) {
  step(2, "no import bundle to restore");
} else {
  const size = fs.statSync(bundle).size;
  step(2, `restoring ${BUNDLE_NAME} (${human(size)})`);
  let tar;
  try {
    tar = await import("tar");
  } catch {
    console.error(
      "[boot] the `tar` package is not installed, so the bundle cannot be restored. " +
        "Add it as a dependency and redeploy; the bundle has been left in place."
    );
    process.exit(1);
  }
  const entries = [];
  // tar.x overwrites by default, which is what "restore the bundle" means
  await tar.x({
    file: bundle,
    cwd: DATA_DIR,
    onentry: (entry) => entries.push(entry.path),
  });
  const done = `${bundle}.done`;
  fs.rmSync(done, { force: true });
  fs.renameSync(bundle, done);
  const top = [...new Set(entries.map((p) => String(p).split("/")[0]).filter(Boolean))].sort();
  console.log(`[boot] restored ${entries.length} entries: ${top.join(", ") || "(empty)"}`);
  console.log(`[boot] the bundle is now ${path.basename(done)} and will not be restored again`);
  // a restore may have introduced folders the export did not carry
  ensureDataDirs();
}

/* ------------------------------------------------------------------ */
/* 3. migrations                                                        */
/* ------------------------------------------------------------------ */

step(3, "migrations");
const { applied, skipped } = await applyMigrations({ dbUrl: dbUrl(), quiet: false });
console.log(`[boot] ${applied.length} applied, ${skipped} already up to date`);

/* ------------------------------------------------------------------ */
/* 4. the first seed, only when asked and only when empty               */
/* ------------------------------------------------------------------ */

const client = createClient({ url: dbUrl() });
async function userCount() {
  try {
    const res = await client.execute("SELECT COUNT(*) AS n FROM users");
    return Number(res.rows[0]?.n ?? 0);
  } catch {
    return 0; // no users table yet
  }
}

const users = await userCount();
if (process.env.SEED_ON_EMPTY !== "true") {
  step(4, `seeding not requested (${users} users in the database)`);
} else if (users > 0) {
  step(4, `database already has ${users} users; not seeding`);
} else {
  step(4, "empty database and SEED_ON_EMPTY=true: seeding from the committed sources");
  const { spawnSync } = await import("node:child_process");
  /* The seed is TypeScript and needs tsx, which is a development dependency:
     a production install does not have it. The bundle is the supported way to
     put data in front of this app; this path is the fallback for a deployment
     that has no bundle, and it says so plainly rather than failing silently. */
  const res = spawnSync(
    process.execPath,
    [path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), "scripts/seed.ts"],
    {
      stdio: "inherit",
      env: { ...process.env, SKIP_INDICES_FETCH: "1", SKIP_CR07_FETCH: "1" },
    }
  );
  if (res.status !== 0) {
    console.error(
      "[boot] the seed did not run. tsx is a development dependency and is absent from a " +
        "production install; deploy a data bundle instead (npm run data:export writes one), " +
        "or install development dependencies in the build."
    );
    // not fatal: the app starts empty and says so rather than refusing to boot
  }
}

/* ------------------------------------------------------------------ */
/* 5. pragmas                                                           */
/* ------------------------------------------------------------------ */

step(5, "pragmas");
/* journal_mode is stored in the database file, so setting it here settles it
   for every connection that follows. synchronous is per connection and the app
   sets its own in src/server/db/client.ts; it is set here too so the boot
   connection itself is consistent. */
for (const pragma of ["PRAGMA journal_mode = WAL;", "PRAGMA synchronous = NORMAL;"]) {
  try {
    const res = await client.execute(pragma);
    console.log(`[boot]   ${pragma.trim()} ${JSON.stringify(res.rows[0] ?? {})}`);
  } catch (e) {
    console.error(`[boot]   ${pragma.trim()} failed: ${String(e?.message ?? e)}`);
  }
}
client.close();

const dbSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
console.log(
  `[boot] ready in ${((Date.now() - t0) / 1000).toFixed(1)}s; database ${human(dbSize)}, ${users} users at start`
);
process.exit(0);
