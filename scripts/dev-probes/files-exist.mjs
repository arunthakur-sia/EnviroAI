/* eslint-disable no-console */
// Does every file the database names actually exist? Run before and after a
// prune: the two answers must be identical.
import fs from "node:fs";
import { createClient } from "@libsql/client";
import { dbUrl, resolveDataPath } from "../lib/paths.mjs";

const db = createClient({ url: dbUrl() });
const checks = [
  ["documents.storage_path", "select id, storage_path v from documents where storage_path is not null"],
  ["documents.text_path", "select id, text_path v from documents where text_path is not null"],
  ["document_versions.storage_path", "select id, storage_path v from document_versions where storage_path is not null"],
  ["reports.docx_path", "select id, docx_path v from reports where docx_path is not null"],
  ["report_versions.docx_path", "select id, docx_path v from report_versions where docx_path is not null"],
  ["podcast_episodes.audio_path", "select id, audio_path v from podcast_episodes where audio_path is not null"],
];
let missingTotal = 0;
for (const [label, sql] of checks) {
  try {
    const rows = (await db.execute(sql)).rows;
    const missing = rows.filter((r) => !fs.existsSync(resolveDataPath(String(r.v))));
    missingTotal += missing.length;
    console.log(`${label.padEnd(34)} ${String(rows.length).padStart(4)} named, ${missing.length} missing`);
    for (const m of missing.slice(0, 3)) console.log(`     ${String(m.v).slice(0, 90)}`);
  } catch (e) {
    console.log(`${label.padEnd(34)} (${String(e.message).slice(0, 50)})`);
  }
}
/* The second language edition of a report is derived from the first by name,
   so no column holds it and a file check driven by columns alone misses it. */
const both = (await db.execute("select id, docx_path from reports where language_mode = 'both' and docx_path is not null")).rows;
let missingEditions = 0;
for (const r of both) {
  for (const lang of ["en", "ar"]) {
    const p = resolveDataPath(`reports/module/${String(r.id)}-${lang}.docx`);
    if (!fs.existsSync(p)) {
      missingEditions++;
      console.log(`  missing ${lang} edition of ${String(r.id).slice(0, 10)}`);
    }
  }
}
console.log(`\nbilingual reports: ${both.length}, missing editions: ${missingEditions}`);
missingTotal += missingEditions;

// the reader reads these by convention, not from a column
const docs = (await db.execute("select id from documents")).rows.map((r) => String(r.id));
const extracted = docs.filter((id) => fs.existsSync(resolveDataPath(`uploads/${id}/extracted.txt`)));
console.log(`\nextracted text present for ${extracted.length} of ${docs.length} documents`);
console.log(missingTotal ? `\n${missingTotal} FILES MISSING` : "\nevery named file is present");
db.close();
process.exit(missingTotal ? 1 : 0);
