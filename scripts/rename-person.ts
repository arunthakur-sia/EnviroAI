/* eslint-disable no-console */
/**
 * Renames a seeded person everywhere their name was written into the database.
 *
 * A name lands in more places than the `users` row it came from: the expert
 * profile, the search record that was built from it, notification titles that
 * were composed when the event happened, and the prose of any report that
 * named them. None of that is recomputed on read, so a rename has to rewrite
 * each one.
 *
 * Match the FULL name, never a first name on its own. This database holds the
 * verbatim text of published documents, the names of officials who appear in
 * fetched public sources, and country names in trade data, and a short match
 * will hit all three. A seeded person has been renamed here before where their
 * given name also appeared inside the name of a public figure in a source
 * document and inside a country name in the trade tables; only the full-name
 * match left those alone.
 *
 * Give the full names as `old=new` pairs, one per language, and start with a
 * dry run:
 *
 *   npx tsx scripts/rename-person.ts --name "Old Full Name=New Full Name" --dry-run
 *   npx tsx scripts/rename-person.ts --name "Old Full Name=New Full Name" --name "الاسم القديم=الاسم الجديد" --refresh
 *   npx tsx scripts/rename-person.ts --name "..." --db data/demo-snapshot/nexus.db
 *
 * `--refresh` also rebuilds what was derived from the old text: the search
 * record's embedding and the Word document of any report that named them.
 *
 * The seeded name itself lives in `scripts/seed-content/taxonomy-org.json`.
 * Change it there as well, or the next `npm run seed` writes the old name back.
 */
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import fs from "node:fs";
import path from "node:path";

/** Old to new, exact strings, read from repeated `--name "old=new"` arguments
    so no one's name has to live in this file. */
function renamesFromArgv(argv: string[]): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== "--name") continue;
    const pair = argv[i + 1] ?? "";
    const at = pair.indexOf("=");
    if (at <= 0 || at === pair.length - 1) continue;
    out.push({ from: pair.slice(0, at).trim(), to: pair.slice(at + 1).trim() });
  }
  return out;
}

/** Tables holding the verbatim text of ingested source documents. A rename
    must never edit these: they are what a published PDF or web page actually
    says, and the product cites them by page. A hit here is reported, never
    changed, so someone can decide what to do about the document itself. */
const VERBATIM_TABLES = new Set(["document_chunks"]);

type Hit = { table: string; column: string; id: string; count: number };

async function main() {
  const RENAMES = renamesFromArgv(process.argv);
  if (!RENAMES.length) {
    console.error('give at least one pair, for example: --name "Old Full Name=New Full Name"');
    console.error("use the full name, never a first name on its own (see the note at the top of this file)");
    process.exit(1);
  }
  const dryRun = process.argv.includes("--dry-run");
  const refresh = process.argv.includes("--refresh");
  const dbArg = process.argv.includes("--db") ? process.argv[process.argv.indexOf("--db") + 1] : "data/nexus.db";
  const dbPath = path.isAbsolute(dbArg) ? dbArg : path.join(process.cwd(), dbArg);
  if (!fs.existsSync(dbPath)) {
    console.error(`no database at ${dbPath}`);
    process.exit(1);
  }

  const { createClient } = await import("@libsql/client");
  const db = createClient({ url: `file:${dbPath.replace(/\\/g, "/")}` });
  const q = async (sql: string, args: unknown[] = []) =>
    (await db.execute({ sql, args: args as never[] })).rows;

  console.log(`${dryRun ? "would rename" : "renaming"} in ${path.relative(process.cwd(), dbPath)}:`);
  for (const r of RENAMES) console.log(`  "${r.from}" -> "${r.to}"`);

  /* Full-text indexes are external-content FTS5 tables over `document_chunks`
     and `search_index`, kept in step by AFTER UPDATE triggers, and their shadow
     tables have no rowid to address. Leave all of them to the triggers and
     verify afterwards. */
  const all = await q("select name, sql from sqlite_master where type = 'table' and name not like 'sqlite_%'");
  const virtualNames = all
    .filter((r) => /create\s+virtual\s+table/i.test(String(r.sql ?? "")))
    .map((r) => String(r.name));
  const isFtsOwned = (name: string) =>
    virtualNames.some((v) => name === v || name.startsWith(`${v}_`));
  const tables = all.map((r) => String(r.name)).filter((name) => !isFtsOwned(name));

  const hits: Hit[] = [];
  let skippedVerbatim = 0;

  for (const table of tables) {
    let cols: Record<string, unknown>[];
    try {
      cols = (await q(`pragma table_info(${JSON.stringify(table)})`)) as Record<string, unknown>[];
    } catch {
      continue;
    }
    const textCols = cols
      .filter((c) => /text|char|clob|json/i.test(String(c.type ?? "")) || String(c.type ?? "") === "")
      .map((c) => String(c.name));
    if (!textCols.length) continue;
    const hasId = cols.some((c) => String(c.name) === "id");
    const idExpr = hasId ? '"id"' : "rowid";
    if (!hasId) {
      try {
        await q(`select rowid from "${table}" limit 1`);
      } catch {
        console.log(`  skipped ${table}: no id column and no rowid to address a row by`);
        continue;
      }
    }

    for (const col of textCols) {
      for (const { from, to } of RENAMES) {
        const rows = await q(
          `select ${idExpr} as id, "${col}" as v from "${table}" where "${col}" like ? limit 1000`,
          [`%${from}%`]
        );
        if (!rows.length) continue;
        if (VERBATIM_TABLES.has(table)) {
          skippedVerbatim += rows.length;
          console.log(`  skipped ${table}.${col}: ${rows.length} row(s) of verbatim source text`);
          continue;
        }
        for (const row of rows) {
          const before = String(row.v);
          const after = before.split(from).join(to);
          const count = before.split(from).length - 1;
          hits.push({ table, column: col, id: String(row.id), count });
          if (!dryRun) {
            await db.execute({
              sql: `update "${table}" set "${col}" = ? where ${idExpr} = ?`,
              args: [after, row.id as never],
            });
          }
        }
      }
    }
  }

  const byTable = new Map<string, number>();
  for (const h of hits) {
    const key = `${h.table}.${h.column}`;
    byTable.set(key, (byTable.get(key) ?? 0) + h.count);
  }
  console.log("");
  for (const [key, n] of [...byTable].sort()) console.log(`  ${key.padEnd(34)} ${n}`);
  console.log(
    `\n${dryRun ? "would change" : "changed"} ${hits.length} row(s), ${[...byTable.values()].reduce((a, b) => a + b, 0)} occurrence(s)` +
      (skippedVerbatim ? `; left ${skippedVerbatim} row(s) of verbatim source text alone` : "")
  );
  db.close();

  if (dryRun || !refresh) {
    if (!dryRun && !refresh) console.log("\nrun again with --refresh to rebuild the search record and the report document");
    return;
  }

  /* The search record carries an embedding computed from the old text, and the
     report document on disk was rendered from the old prose. Both have to be
     rebuilt or the name survives in a vector and in a Word file. */
  console.log("\nrebuilding derived artefacts:");
  const { db: orm, schema } = await import("../src/server/db/client");
  const { eq, like, or } = await import("drizzle-orm");

  const experts = await orm
    .select({ id: schema.experts.id, name: schema.experts.nameEn })
    .from(schema.experts)
    .where(or(...RENAMES.map((r) => like(schema.experts.nameEn, `%${r.to}%`))));
  const { embedStructuredRecords } = await import("../src/server/search/records");
  for (const e of experts) {
    await embedStructuredRecords("expert", e.id);
    console.log(`  search record rebuilt for ${e.name}`);
  }

  const sections = await orm
    .select({ reportId: schema.reportSections.reportId })
    .from(schema.reportSections)
    .where(or(...RENAMES.map((r) => like(schema.reportSections.contentJson, `%${r.to}%`))));
  const reportIds = [...new Set(sections.map((s) => s.reportId))];
  if (reportIds.length) {
    const { runSectionRebuild, RENDER_ONLY } = await import("../src/server/reports/build");
    for (const id of reportIds) {
      const [before] = await orm
        .select({ status: schema.reports.status })
        .from(schema.reports)
        .where(eq(schema.reports.id, id))
        .limit(1);
      await runSectionRebuild(id, RENDER_ONLY, { forceMock: true });
      const [after] = await orm
        .select({ status: schema.reports.status })
        .from(schema.reports)
        .where(eq(schema.reports.id, id))
        .limit(1);
      console.log(`  report ${id.slice(0, 10)} re-rendered (${before?.status} -> ${after?.status})`);
    }
  }
  const { closePngRenderer } = await import("../src/server/reports/template/png");
  await closePngRenderer();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
