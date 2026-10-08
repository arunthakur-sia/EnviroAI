// Loads ./supabase/*.sql into the database at DATABASE_URL (from .env.local or
// the environment), in order. 00_schema drops and recreates every table, so
// this REPLACES the data. Usage: node scripts/pg-load.mjs [--skip-lock]
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

let url = process.env.DATABASE_URL;
if (!url && fs.existsSync(".env.local")) url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1];
if (!url) throw new Error("DATABASE_URL is not set");
const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
await client.connect();
const dir = path.resolve("supabase");
const skipLock = process.argv.includes("--skip-lock");
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (skipLock && f.startsWith("03_")) continue;
  await client.query(fs.readFileSync(path.join(dir, f), "utf8"));
  console.log("loaded", f);
}
await client.end();
