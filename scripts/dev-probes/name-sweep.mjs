/* eslint-disable no-console */
// Where does a name appear across the system? Scans the seeded database's text
// columns and a set of files, and prints the table, column, row id and a window
// of context around each hit so a rename can be planned rather than guessed.
//   node scripts/dev-probes/name-sweep.mjs "Full Name" "الاسم الكامل"
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";

const terms = process.argv.slice(2);
if (!terms.length) {
  console.error('usage: node scripts/dev-probes/name-sweep.mjs "Full Name" "الاسم الكامل"');
  process.exit(1);
}
const hit = (s) => terms.some((t) => String(s).includes(t));
const window_ = (s, t) => {
  const i = String(s).indexOf(t);
  if (i < 0) return "";
  const start = Math.max(0, i - 60);
  return String(s).slice(start, start + 160).replace(/\s+/g, " ");
};
const firstHit = (s) => terms.find((t) => String(s).includes(t)) ?? "";

async function scanDb(label, file) {
  if (!fs.existsSync(file)) {
    console.log(`\n### ${label}: not present`);
    return;
  }
  const db = createClient({ url: `file:${file.replace(/\\/g, "/")}` });
  const tables = (
    await db.execute("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'")
  ).rows.map((r) => String(r.name));
  console.log(`\n### ${label}: ${tables.length} tables`);
  let total = 0;
  for (const table of tables) {
    let cols;
    try {
      cols = (await db.execute(`pragma table_info(${JSON.stringify(table)})`)).rows;
    } catch {
      continue;
    }
    const textCols = cols
      .filter((c) => /text|char|clob|json/i.test(String(c.type ?? "")) || String(c.type ?? "") === "")
      .map((c) => String(c.name));
    if (!textCols.length) continue;
    const hasId = cols.some((c) => String(c.name) === "id");
    for (const col of textCols) {
      const where = terms.map(() => `"${col}" like ?`).join(" or ");
      const args = terms.map((t) => `%${t}%`);
      let rows;
      try {
        rows = (
          await db.execute({
            sql: `select ${hasId ? '"id"' : "rowid as id"} as id, "${col}" as v from "${table}" where ${where} limit 200`,
            args,
          })
        ).rows;
      } catch {
        continue;
      }
      if (!rows.length) continue;
      total += rows.length;
      console.log(`  ${table}.${col}: ${rows.length}`);
      for (const r of rows.slice(0, 3)) {
        const t = firstHit(r.v);
        console.log(`     ${String(r.id).slice(0, 10)}  ...${window_(r.v, t)}...`);
      }
      if (rows.length > 3) console.log(`     (${rows.length - 3} more)`);
    }
  }
  console.log(`  total rows touched: ${total}`);
  db.close();
}

function scanFiles(label, roots, exts) {
  console.log(`\n### ${label}`);
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (/node_modules|\.next|\.git|previews|uploads|screenshots|lighthouse/i.test(e.name)) continue;
        walk(full);
      } else if (exts.some((x) => e.name.toLowerCase().endsWith(x))) {
        let text;
        try {
          text = fs.readFileSync(full, "utf8");
        } catch {
          continue;
        }
        if (!hit(text)) continue;
        const t = firstHit(text);
        const lines = text.split(/\r?\n/);
        const n = lines.findIndex((l) => l.includes(t));
        out.push(`  ${path.relative(process.cwd(), full)}:${n + 1}  ...${window_(lines[n] ?? text, t)}...`);
      }
    }
  };
  for (const r of roots) walk(path.join(process.cwd(), r));
  if (!out.length) console.log("  none");
  for (const line of out) console.log(line);
}

console.log(`searching for: ${terms.join(", ")}`);
await scanDb("live database (data/nexus.db)", path.join(process.cwd(), "data", "nexus.db"));
await scanDb("frozen baseline (data/demo-snapshot/nexus.db)", path.join(process.cwd(), "data", "demo-snapshot", "nexus.db"));
scanFiles("repository files", ["src", "scripts", "messages", "docs"], [".ts", ".tsx", ".json", ".md", ".mjs", ".css"]);
scanFiles("root documents", ["."], [".md"]);
scanFiles("fetched sources", ["sources"], [".json", ".md", ".txt"]);
