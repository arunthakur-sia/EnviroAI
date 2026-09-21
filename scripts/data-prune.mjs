#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Removes files in the data directory that the database no longer references.
 *
 * `npm run seed` drops and recreates the database but leaves the files behind,
 * so every reseed leaves a full set of orphaned uploads with fresh ids beside
 * the live ones. After two seeds the uploads folder is twice the size it needs
 * to be, and a data bundle carries all of it.
 *
 * What counts as referenced, and why both rules are needed:
 *
 *   1. Any path stored in the database. Uploads are not always filed under the
 *      id of the row that ends up owning them: Add Knowledge stages a file
 *      under a fresh id before anything is published, so a live document can
 *      own `uploads/<some other id>/file.pdf`. Matching on directory names
 *      alone would delete those.
 *   2. Any directory named after a live document id. The reader fetches
 *      `uploads/<document id>/extracted.txt` and `extracted.html` by
 *      convention, and only 46 of 248 documents record that path in a column,
 *      so the stored paths alone would delete the extracted text of the rest.
 *
 * Nothing outside `uploads/`, `reports/` and `podcasts/` is touched, and
 * nothing is removed without `--write`.
 *
 *   npm run data:prune            list what would go
 *   npm run data:prune -- --write remove it
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { DATA_DIR, DB_PATH, dbUrl, resolveDataPath } from "./lib/paths.mjs";

const write = process.argv.includes("--write");

function human(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} kB`;
}

function sizeOf(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return stat.size;
  let total = 0;
  for (const e of fs.readdirSync(target, { withFileTypes: true })) {
    total += sizeOf(path.join(target, e.name));
  }
  return total;
}

/** Every column that holds a path into the data directory. */
const PATH_COLUMNS = [
  ["documents", "storage_path"],
  ["documents", "text_path"],
  ["document_versions", "storage_path"],
  ["reports", "docx_path"],
  ["report_versions", "docx_path"],
  ["podcast_episodes", "audio_path"],
];
/** Columns holding a JSON array of paths. */
const PATH_JSON_COLUMNS = [["reports", "preview_images_json"]];

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`no database at ${DB_PATH}`);
    process.exit(1);
  }
  const db = createClient({ url: dbUrl() });

  /** Absolute paths the database names, and every directory above them. */
  const referenced = new Set();
  const note = (stored) => {
    if (!stored) return;
    let abs;
    try {
      abs = resolveDataPath(String(stored));
    } catch {
      return;
    }
    referenced.add(abs);
    // keep every directory on the way down to it
    let dir = path.dirname(abs);
    while (dir.startsWith(DATA_DIR) && dir !== DATA_DIR) {
      referenced.add(dir);
      dir = path.dirname(dir);
    }
  };

  for (const [table, col] of PATH_COLUMNS) {
    try {
      const rows = await db.execute(`select "${col}" v from "${table}" where "${col}" is not null`);
      for (const r of rows.rows) note(r.v);
    } catch {
      /* the column is not in this database */
    }
  }
  for (const [table, col] of PATH_JSON_COLUMNS) {
    try {
      const rows = await db.execute(`select "${col}" v from "${table}" where "${col}" is not null`);
      for (const r of rows.rows) {
        try {
          for (const p of JSON.parse(String(r.v))) note(p);
        } catch {
          /* not an array */
        }
      }
    } catch {
      /* absent */
    }
  }

  /* A report in "both" mode stores one docx_path and derives the other
     edition's name: `resolveDownload` asks for `<id>-ar.docx` when the column
     says `<id>-en.docx`. The sibling is a real file that nothing names, so
     every referenced edition keeps its counterpart. Found by the smoke suite
     after an earlier version of this script deleted every Arabic edition. */
  for (const abs of [...referenced]) {
    const m = /^(.*)-(en|ar)\.docx$/i.exec(abs);
    if (!m) continue;
    referenced.add(`${m[1]}-en.docx`);
    referenced.add(`${m[1]}-ar.docx`);
  }

  const documentIds = new Set(
    (await db.execute("select id from documents")).rows.map((r) => String(r.id))
  );
  db.close();

  const keep = (abs, name) => referenced.has(abs) || documentIds.has(name);

  const orphans = [];
  let bytes = 0;
  const scan = (sub, entriesAreDirs) => {
    const dir = path.join(DATA_DIR, sub);
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entriesAreDirs && !e.isDirectory()) continue;
      const abs = path.join(dir, e.name);
      if (keep(abs, e.name)) continue;
      const size = sizeOf(abs);
      orphans.push({ abs, rel: `${sub}/${e.name}`, size });
      bytes += size;
    }
  };

  // uploads: one directory per staged or published file
  scan("uploads", true);
  // rendered documents and their page previews
  scan("reports/module", false);
  scan("reports/handover", false);
  scan("reports/previews/module", true);
  scan("podcasts", false);

  if (!orphans.length) {
    console.log("nothing to prune: every file is referenced by the database");
    return;
  }
  console.log(
    `${write ? "removing" : "would remove"} ${orphans.length} orphaned entries (${human(bytes)}):`
  );
  for (const o of orphans.slice(0, 15)) console.log(`  ${o.rel.padEnd(52)} ${human(o.size)}`);
  if (orphans.length > 15) console.log(`  ... and ${orphans.length - 15} more`);
  console.log(`\nkept: ${referenced.size} paths named by the database, ${documentIds.size} document folders`);

  if (!write) {
    console.log("\nrun again with --write to remove them");
    return;
  }
  for (const o of orphans) fs.rmSync(o.abs, { recursive: true, force: true });
  console.log(`\nremoved ${orphans.length} entries, ${human(bytes)} freed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
