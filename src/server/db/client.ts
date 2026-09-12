import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

const DB_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "nexus.db");

declare global {
  // eslint-disable-next-line no-var
  var __nexusDb: ReturnType<typeof makeDb> | undefined;
}

function makeDb() {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const client: Client = createClient({ url: `file:${DB_PATH.replace(/\\/g, "/")}` });
  // WAL keeps reads fast while the job worker writes.
  client.execute("PRAGMA journal_mode = WAL;").catch(() => {});
  client.execute("PRAGMA foreign_keys = ON;").catch(() => {});
  const db = drizzle(client, { schema });
  return { db, client };
}

const g = globalThis as typeof globalThis & { __nexusDb?: ReturnType<typeof makeDb> };
if (!g.__nexusDb) g.__nexusDb = makeDb();

export const db = g.__nexusDb.db;
export const rawClient = g.__nexusDb.client;
export { schema };
