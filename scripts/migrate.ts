// Applies every SQL file in src/server/db/migrations in name order.
// Statements are separated by the drizzle `--> statement-breakpoint` marker.
// Safe to run repeatedly: "already exists" errors are ignored, and a file
// whose content hash is already recorded in `_migrations` is skipped outright
// (CR08 Phase B: cold start checks migrations instead of re-running them).
import { createClient } from "@libsql/client";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "data");
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "nexus.db").replace(/\\/g, "/");

const IGNORABLE =
  /already exists|duplicate column name|Cannot add a column to a view|no such column: .* in index/i;

export async function migrate(opts: { quiet?: boolean } = {}): Promise<void> {
  const log = opts.quiet ? () => undefined : console.log;
  const client = createClient({ url: `file:${dbPath}` });
  await client.execute("PRAGMA journal_mode = WAL;");
  await client.execute(
    "CREATE TABLE IF NOT EXISTS `_migrations` (`name` text PRIMARY KEY, `hash` text NOT NULL, `applied_at` text NOT NULL)"
  );
  const applied = new Map<string, string>();
  for (const row of (await client.execute("SELECT name, hash FROM `_migrations`")).rows) {
    applied.set(String(row.name), String(row.hash));
  }

  const dir = path.join(root, "src", "server", "db", "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  let ran = 0;
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    const hash = crypto.createHash("sha1").update(sql).digest("hex");
    if (applied.get(f) === hash) continue;
    const statements = sql
      .split(/-->\s*statement-breakpoint/g)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      try {
        await client.execute(stmt);
      } catch (e: unknown) {
        const msg = String((e as { message?: string })?.message || e);
        if (IGNORABLE.test(msg)) continue;
        // CR07: statements that cannot be written with IF NOT EXISTS (a table
        // rename, for one) carry this marker and are allowed to fail on reruns.
        if (/--\s*idempotent:/i.test(stmt)) {
          log(`  (skipped idempotent statement: ${msg.slice(0, 80)})`);
          continue;
        }
        console.error(`Migration ${f} failed on:\n${stmt.slice(0, 200)}\n${msg}`);
        throw e;
      }
    }
    await client.execute({
      sql: "INSERT INTO `_migrations` (name, hash, applied_at) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET hash = excluded.hash, applied_at = excluded.applied_at",
      args: [f, hash, new Date().toISOString()],
    });
    ran++;
    log(`applied ${f}`);
  }
  if (ran === 0) log("migrations up to date");
  client.close();
}

const isMain = process.argv[1] && /migrate\.(ts|js|mjs)$/.test(process.argv[1]);
if (isMain) {
  migrate()
    .then(() => console.log("migrations complete"))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
