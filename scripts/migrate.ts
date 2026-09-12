// Applies every SQL file in src/server/db/migrations in name order.
// Statements are separated by the drizzle `--> statement-breakpoint` marker.
// Safe to run repeatedly: "already exists" errors are ignored.
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "data");
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "nexus.db").replace(/\\/g, "/");

export async function migrate(): Promise<void> {
  const client = createClient({ url: `file:${dbPath}` });
  await client.execute("PRAGMA journal_mode = WAL;");
  const dir = path.join(root, "src", "server", "db", "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    const statements = sql
      .split(/-->\s*statement-breakpoint/g)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      try {
        await client.execute(stmt);
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (/already exists|duplicate column name/i.test(msg)) continue;
        console.error(`Migration ${f} failed on:\n${stmt.slice(0, 200)}\n${msg}`);
        throw e;
      }
    }
    console.log(`applied ${f}`);
  }
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
