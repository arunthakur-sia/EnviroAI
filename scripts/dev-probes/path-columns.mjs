/* eslint-disable no-console */
// Which columns in the database hold a path into the data directory?
import { createClient } from "@libsql/client";
import { dbUrl } from "../lib/paths.mjs";
const db = createClient({ url: dbUrl() });
const tables = (await db.execute("select name from sqlite_master where type='table' and name not like 'sqlite_%'")).rows;
for (const t of tables) {
  const name = String(t.name);
  if (/_fts(_|$)/.test(name)) continue;
  let cols;
  try {
    cols = (await db.execute(`pragma table_info(${JSON.stringify(name)})`)).rows.map((c) => String(c.name));
  } catch {
    continue;
  }
  for (const col of cols) {
    if (!/path|file|audio|docx|preview|image/i.test(col)) continue;
    try {
      const r = await db.execute(
        `select count(*) c from "${name}" where "${col}" is not null and "${col}" != ''`
      );
      const n = Number(r.rows[0].c);
      if (!n) continue;
      const sample = await db.execute(`select "${col}" v from "${name}" where "${col}" is not null limit 1`);
      console.log(`${name}.${col}`.padEnd(46) + `${String(n).padStart(6)}  e.g. ${String(sample.rows[0].v).slice(0, 70)}`);
    } catch {
      /* not a text column */
    }
  }
}
db.close();
