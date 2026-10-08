/**
 * A Postgres-backed stand-in for the libsql `Client`.
 *
 * The app's data layer is drizzle's SQLite dialect over libsql, in 300+ files.
 * When DATABASE_URL is set, `client.ts` hands drizzle this adapter instead of a
 * libsql client: it receives the SQL drizzle builds for SQLite and runs it on
 * Postgres. What it bridges:
 *   - `?` placeholders become `$1, $2, ...`, and backticks become double quotes
 *   - PRAGMA statements are accepted and ignored
 *   - `like` becomes `ilike`, because SQLite's LIKE ignores ASCII case
 *   - bigint and numeric come back as numbers, booleans as 0/1, rows as
 *     array-likes with column names, the shape libsql returns
 *   - `rowsAffected` is filled from the command's row count
 * Anything else SQLite-only has to be written for both (see search/fts.ts).
 */
import { Pool, types, type PoolClient, type QueryResult } from "pg";

type Stmt = string | { sql: string; args?: unknown[] };
type Row = Record<string, unknown> & ArrayLike<unknown>;
export type PgResultSet = {
  columns: string[];
  rows: Row[];
  rowsAffected: number;
  lastInsertRowid: undefined;
};

const typeParsers = {
  getTypeParser: (oid: number, format?: "text" | "binary") => {
    if (oid === 20 || oid === 1700 || oid === 701 || oid === 700) return (v: string) => Number(v);
    return types.getTypeParser(oid, format as "text");
  },
};

/** SQLite dialect to Postgres, outside string literals and quoted identifiers. */
export function translate(sql: string): string {
  let out = "";
  let n = 0;
  let i = 0;
  const len = sql.length;
  while (i < len) {
    const c = sql[i];
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < len) {
        if (sql[j] === c) {
          if (sql[j + 1] === c) j += 2;
          else break;
        } else j++;
      }
      out += sql.slice(i, j + 1);
      i = j + 1;
    } else if (c === "`") {
      const j = sql.indexOf("`", i + 1);
      out += '"' + sql.slice(i + 1, j).replace(/"/g, '""') + '"';
      i = j + 1;
    } else if (c === "?") {
      out += "$" + ++n;
      i++;
    } else if (c === "-" && sql[i + 1] === "-") {
      const j = sql.indexOf("\n", i);
      i = j === -1 ? len : j;
    } else if (/[a-z_]/i.test(c) && !/[a-z0-9_$]/i.test(sql[i - 1] ?? " ")) {
      let j = i;
      while (j < len && /[a-z0-9_$]/i.test(sql[j])) j++;
      const word = sql.slice(i, j);
      out += word.toLowerCase() === "like" ? word.replace(/like/i, (m) => (m === "LIKE" ? "ILIKE" : "ilike")) : word;
      i = j;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function isPragma(sql: string) {
  return /^\s*pragma\b/i.test(sql);
}

function toRow(fields: string[], values: unknown[]): Row {
  const row: Record<string, unknown> = {};
  Object.defineProperty(row, "length", { value: values.length, enumerable: false });
  values.forEach((raw, idx) => {
    const v = typeof raw === "boolean" ? (raw ? 1 : 0) : raw;
    Object.defineProperty(row, idx, { value: v, enumerable: false });
    if (!(fields[idx] in row)) Object.defineProperty(row, fields[idx], { value: v, enumerable: true });
  });
  return row as Row;
}

function toResult(r: QueryResult): PgResultSet {
  const last = Array.isArray(r) ? (r as QueryResult[])[r.length - 1] : r;
  const fields = (last.fields ?? []).map((f) => f.name);
  return {
    columns: fields,
    rows: (last.rows ?? []).map((v) => toRow(fields, v as unknown[])),
    rowsAffected: last.rowCount ?? 0,
    lastInsertRowid: undefined,
  };
}

type Runner = { query: (q: unknown, values?: unknown[]) => Promise<QueryResult> };

async function run(conn: Runner, stmt: Stmt): Promise<PgResultSet> {
  const sql = typeof stmt === "string" ? stmt : stmt.sql;
  const args = typeof stmt === "string" ? [] : (stmt.args ?? []);
  if (isPragma(sql)) return { columns: [], rows: [], rowsAffected: 0, lastInsertRowid: undefined };
  const pgArgs = args.map((a) => {
    if (a instanceof ArrayBuffer) return Buffer.from(a);
    if (typeof a === "bigint") return a.toString();
    if (typeof a === "boolean") return a ? 1 : 0;
    return a;
  });
  // rowMode "array" keeps duplicate column names apart, as libsql does
  const res = await conn.query(
    { text: translate(sql), values: pgArgs.length ? pgArgs : undefined, rowMode: "array" },
    undefined
  );
  return toResult(res);
}

class PgTransaction {
  closed = false;
  constructor(private conn: PoolClient) {}
  execute(stmt: Stmt) {
    return run(this.conn, stmt);
  }
  async batch(stmts: Stmt[]) {
    const out: PgResultSet[] = [];
    for (const s of stmts) out.push(await run(this.conn, s));
    return out;
  }
  async executeMultiple(sql: string) {
    await run(this.conn, sql);
  }
  async commit() {
    if (this.closed) return;
    this.closed = true;
    try {
      await this.conn.query("COMMIT");
    } finally {
      this.conn.release();
    }
  }
  async rollback() {
    if (this.closed) return;
    this.closed = true;
    try {
      await this.conn.query("ROLLBACK");
    } finally {
      this.conn.release();
    }
  }
  close() {
    return this.rollback();
  }
}

export function createPgClient(connectionString: string) {
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
  const pool = new Pool({
    connectionString,
    max: 10,
    ssl: local ? undefined : { rejectUnauthorized: false },
    types: typeParsers,
  });
  pool.on("error", (e) => console.error("[pg] idle client error", e.message));
  const client = {
    closed: false,
    protocol: "postgres",
    execute: (stmt: Stmt) => run(pool, stmt),
    async batch(stmts: Stmt[]) {
      const tx = await client.transaction();
      try {
        const out = await tx.batch(stmts);
        await tx.commit();
        return out;
      } catch (e) {
        await tx.rollback();
        throw e;
      }
    },
    async transaction() {
      const conn = await pool.connect();
      await conn.query("BEGIN");
      return new PgTransaction(conn);
    },
    async executeMultiple(sql: string) {
      await pool.query(sql);
    },
    migrate: (stmts: Stmt[]) => client.batch(stmts),
    async sync() {},
    close() {
      void pool.end();
    },
  };
  return client;
}
