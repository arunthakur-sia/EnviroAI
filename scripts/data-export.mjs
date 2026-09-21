#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Writes `sianexus-data.tar.gz` in the project root: everything under DATA_DIR
 * that the deployed app needs, and nothing it can rebuild.
 *
 * Carried: the database, and the folders the app writes into and reads back
 * (uploads, reports, podcasts, deliverables).
 *
 * Left out, and named in the output so it is never a surprise: the local model
 * cache, QC screenshots and Lighthouse reports, the demo snapshot (a second
 * copy of everything), `import/` (a bundle inside a bundle is a restore loop),
 * `tmp/`, anything set aside by hand during a reseed, the SQLite sidecars, and
 * `session-secret.txt` (the deployment sets SESSION_SECRET as a variable; a
 * secret has no business travelling in a tarball).
 *
 * The write-ahead log is checkpointed into the database first, so the single
 * `nexus.db` in the bundle is complete without its sidecars.
 *
 *   npm run data:export
 */
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { createClient } from "@libsql/client";
import { DATA_DIR, DB_PATH, dbUrl } from "./lib/paths.mjs";

const OUT = path.join(process.cwd(), "sianexus-data.tar.gz");

/**
 * The bundle carries what the deployed app reads, and nothing else. This is an
 * allowlist rather than a deny list because a data directory accumulates:
 * QC evidence, demo snapshots, and directories set aside by hand during a
 * reseed. Anything at the top level that is not named here is skipped AND
 * printed, so nothing leaves quietly.
 */
const CARRIED_DIRS = new Set(["uploads", "reports", "podcasts", "deliverables"]);
const EXCLUDED_FILE =
  /\.(tar\.gz|log)$|^nexus\.db-(wal|shm)$|^\.DS_Store$|^session-secret\.txt$/;

function human(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} kB`;
}

function portBusy(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(true));
    s.once("listening", () => s.close(() => resolve(false)));
    s.listen(port, "127.0.0.1");
  });
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`no data directory at ${DATA_DIR}`);
    process.exit(1);
  }
  if (!fs.existsSync(DB_PATH)) {
    console.error(`no database at ${DB_PATH}`);
    process.exit(1);
  }

  /* A running server holds the database open. The export still works, because
     the checkpoint below folds the write-ahead log into the file, but anything
     written after this moment is not in the bundle, and that is worth saying
     out loud rather than discovering on the other side. */
  const port = Number(process.env.PORT || process.env.DEMO_PORT || 3000);
  if (await portBusy(port)) {
    console.warn(
      `! something is listening on port ${port}. The bundle is a snapshot of this instant; ` +
        `stop the server and run this again if anyone is still using it.`
    );
  }

  const client = createClient({ url: dbUrl() });
  try {
    await client.execute("PRAGMA wal_checkpoint(TRUNCATE);");
    console.log("checkpointed the write-ahead log into nexus.db");
  } catch (e) {
    console.warn(`! could not checkpoint: ${String(e?.message ?? e)}`);
  } finally {
    client.close();
  }

  /* Collect the entries explicitly rather than handing tar a filter: the list
     is what gets printed, so what is in the bundle and what the caller is told
     can never disagree. */
  const entries = [];
  const skipped = [];
  let bytes = 0;
  const walk = (absDir, relDir) => {
    for (const e of fs.readdirSync(absDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = relDir ? `${relDir}/${e.name}` : e.name;
      const abs = path.join(absDir, e.name);
      if (e.isDirectory()) {
        if (!relDir && !CARRIED_DIRS.has(e.name)) {
          const n = fs.readdirSync(abs, { recursive: true }).length;
          skipped.push(`${e.name}/ (${n} entries)`);
          continue;
        }
        walk(abs, rel);
        continue;
      }
      if (EXCLUDED_FILE.test(e.name)) {
        if (!relDir) skipped.push(e.name);
        continue;
      }
      entries.push(rel);
      bytes += fs.statSync(abs).size;
    }
  };
  walk(DATA_DIR, "");

  if (!entries.length) {
    console.error("nothing to export");
    process.exit(1);
  }

  let tar;
  try {
    tar = await import("tar");
  } catch {
    console.error("the `tar` package is not installed. Run `npm install` and try again.");
    process.exit(1);
  }

  fs.rmSync(OUT, { force: true });
  await tar.c({ gzip: true, file: OUT, cwd: DATA_DIR }, entries);

  const top = new Map();
  for (const rel of entries) {
    const head = rel.includes("/") ? `${rel.split("/")[0]}/` : rel;
    top.set(head, (top.get(head) ?? 0) + 1);
  }
  console.log(`\nbundled ${entries.length} files (${human(bytes)} on disk) from ${DATA_DIR}:`);
  for (const [head, n] of [...top].sort()) console.log(`  ${head.padEnd(28)} ${n}`);
  if (skipped.length) {
    console.log(`\nleft out of the bundle (${skipped.length}):`);
    for (const s of skipped) console.log(`  ${s}`);
  }
  console.log(`\nwrote ${path.basename(OUT)}  ${human(fs.statSync(OUT).size)}`);
  console.log("upload it to the volume as data/import/sianexus-data.tar.gz; the boot script restores it once.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
