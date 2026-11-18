// One small database wrapper over the two stores the app supports, plus the target guard.
// SQL is written with ? placeholders and translated to $n for Postgres.
//
// Guard rules (docs/ncec/ingestion-plan.md, 5.1):
//  - the connection string is read inside this process and never printed; only the kind
//    (local or remote) and the database name are;
//  - --target <name> must equal the database name (nexus.db for SQLite);
//  - a remote Postgres host needs --allow-remote.
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { DB_PATH, dbUrl } from "../../lib/paths.mjs";

export function parseArgs(argv) {
  const a = { flags: new Set(), values: {} };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith("--")) continue;
    const k = t.slice(2);
    if (["driver", "target"].includes(k)) a.values[k] = argv[++i];
    else a.flags.add(k);
  }
  return a;
}

function pgUrl() {
  let url = process.env.NCEC_DATABASE_URL || process.env.DATABASE_URL;
  if (!url && fs.existsSync(".env.local")) {
    url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim();
  }
  if (!url) throw new Error("No Postgres connection string: set NCEC_DATABASE_URL or DATABASE_URL.");
  url = url.replace(/^["']|["']$/g, "");
  if (!/^postgres(ql)?:\/\//.test(url)) throw new Error("The Postgres connection string is not a postgres:// URL.");
  return url;
}

/** Opens the target after the guard. Returns the wrapper. */
export async function openDb(args) {
  const driver = args.values.driver;
  const target = args.values.target;
  if (!["sqlite", "pg"].includes(driver)) throw new Error("--driver sqlite|pg is required");
  if (!target) throw new Error("--target <database name> is required");

  let kind, name, raw, tx = null;
  if (driver === "sqlite") {
    name = path.basename(DB_PATH);
    if (target !== name) throw new Error(`--target must be "${name}" for sqlite`);
    raw = createClient({ url: dbUrl() });
    kind = "local file";
  } else {
    const url = pgUrl();
    const u = new URL(url);
    name = decodeURIComponent(u.pathname.replace(/^\//, ""));
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
    if (target !== name) throw new Error(`--target "${target}" does not match the database name in the connection string`);
    if (!local && !args.flags.has("allow-remote")) throw new Error("Remote Postgres host: pass --allow-remote to confirm.");
    kind = local ? "local" : u.hostname.includes("supabase") ? "remote (Supabase)" : "remote";
    raw = new pg.Client({ connectionString: url, ssl: local ? undefined : { rejectUnauthorized: false } });
    await raw.connect();
  }

  const toPg = (sql) => { let n = 0; return sql.replace(/\?/g, () => `$${++n}`); };
  const db = {
    driver,
    label: `${driver} (${kind}) database "${name}"`,
    async all(sql, params = []) {
      if (driver === "pg") return (await raw.query(toPg(sql), params)).rows;
      const r = await (tx || raw).execute({ sql, args: params });
      return r.rows.map((row) => ({ ...row }));
    },
    async run(sql, params = []) {
      if (driver === "pg") return (await raw.query(toPg(sql), params)).rowCount;
      return (await (tx || raw).execute({ sql, args: params })).rowsAffected;
    },
    async begin() { if (driver === "pg") await raw.query("BEGIN"); else tx = await raw.transaction("write"); },
    async commit() { if (driver === "pg") await raw.query("COMMIT"); else { await tx.commit(); tx = null; } },
    async rollback() { if (driver === "pg") await raw.query("ROLLBACK"); else if (tx) { await tx.rollback(); tx = null; } },
    bool: (v) => (driver === "pg" ? !!v : v ? 1 : 0),
    async close() { if (driver === "pg") await raw.end(); else raw.close(); },
  };
  return db;
}

export const num = (v) => (v === null || v === undefined ? null : Number(v));
export const parseJson = (v) => (typeof v === "string" ? JSON.parse(v) : v);
