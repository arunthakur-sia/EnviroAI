import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import fs from "node:fs";
import * as schema from "./schema";
import { DATA_DIR, DB_PATH } from "@/server/paths";
import { createPgClient } from "./pg-adapter";

/** Set DATABASE_URL (a postgres:// URL, e.g. Supabase) to run on Postgres instead of the SQLite file. */
export const isPostgres = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");

const DB_DIR = DATA_DIR;

declare global {
  // eslint-disable-next-line no-var
  var __nexusDb: ReturnType<typeof makeDb> | undefined;
}

function makeDb() {
  if (isPostgres) {
    const client = createPgClient(process.env.DATABASE_URL!) as unknown as Client;
    return { db: drizzle(client, { schema }), client };
  }
  fs.mkdirSync(DB_DIR, { recursive: true });
  const client: Client = createClient({ url: `file:${DB_PATH.replace(/\\/g, "/")}` });
  /* CR08 Phase A, the data layer. One shared connection for the whole
     process (the global below), WAL so readers never block the job worker,
     synchronous NORMAL because WAL already survives a process crash and only
     a power cut could lose the last commits of a prototype, a 64 MB page
     cache and 256 MB of memory-mapped reads so the hot tables stay resident,
     temporary indexes and sorts in memory, and a busy timeout so a seed or a
     probe writing from another process waits instead of throwing SQLITE_BUSY. */
  for (const pragma of [
    "PRAGMA journal_mode = WAL;",
    "PRAGMA synchronous = NORMAL;",
    "PRAGMA foreign_keys = ON;",
    "PRAGMA busy_timeout = 8000;",
    "PRAGMA cache_size = -64000;",
    "PRAGMA temp_store = MEMORY;",
    "PRAGMA mmap_size = 268435456;",
  ]) {
    client.execute(pragma).catch(() => {});
  }
  const db = drizzle(client, { schema });
  return { db, client };
}

const g = globalThis as typeof globalThis & { __nexusDb?: ReturnType<typeof makeDb> };
if (!g.__nexusDb) g.__nexusDb = makeDb();

export const db = g.__nexusDb.db;
export const rawClient = g.__nexusDb.client;
export { schema };
