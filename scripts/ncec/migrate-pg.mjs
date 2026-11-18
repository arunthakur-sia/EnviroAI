// Applies src/server/db/migrations-pg/*.sql to Postgres, in name order.
// Ledger: _pg_migrations (name, hash, applied_at). A file whose hash is recorded is skipped;
// a file already applied whose content has changed is refused; each file runs with its
// ledger row in one transaction. SQLite migrations are applied by the existing `npm run migrate`.
// Usage: node scripts/ncec/migrate-pg.mjs --driver pg --target <db> [--allow-remote] [--dry-run]
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { openDb, parseArgs } from "./lib/db.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.values.driver) args.values.driver = "pg";
if (args.values.driver !== "pg") throw new Error("migrate-pg only handles --driver pg");
const dry = args.flags.has("dry-run");
const dir = path.resolve("src", "server", "db", "migrations-pg");

const db = await openDb(args);
console.log(`target: ${db.label}${dry ? " (dry run)" : ""}`);
try {
  await db.begin();
  await db.run(
    "CREATE TABLE IF NOT EXISTS _pg_migrations (name text PRIMARY KEY, hash text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const applied = new Map((await db.all("SELECT name, hash FROM _pg_migrations")).map((r) => [r.name, r.hash]));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let ran = 0;
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    const hash = crypto.createHash("sha1").update(sql).digest("hex");
    if (applied.has(f)) {
      if (applied.get(f) !== hash) throw new Error(`${f} was already applied and has since changed. Add a new migration instead.`);
      console.log(`skip ${f} (already applied)`);
      continue;
    }
    await db.run(sql); // one multi-statement simple query; no parameters
    await db.run("INSERT INTO _pg_migrations (name, hash) VALUES (?, ?)", [f, hash]);
    console.log(`applied ${f}`);
    ran++;
  }
  if (dry) {
    await db.rollback();
    console.log(`dry run: ${ran} migration(s) would be applied, rolled back`);
  } else {
    await db.commit();
    console.log(ran ? `${ran} migration(s) applied` : "migrations up to date");
  }
} catch (e) {
  await db.rollback().catch(() => {});
  console.error("FAILED, rolled back:", e.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
