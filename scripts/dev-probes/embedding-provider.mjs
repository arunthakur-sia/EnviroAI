/* eslint-disable no-console */
// Which embedder produced the vectors in this database? A deployment that
// inherits local-hash vectors has weak cross-lingual search until someone runs
// "Re-embed all" in Settings.
import { createClient } from "@libsql/client";
import { dbUrl } from "../lib/paths.mjs";

const db = createClient({ url: dbUrl() });
const q = async (sql) => (await db.execute(sql)).rows;

for (const [label, table] of [
  ["document chunks", "document_chunks"],
  ["structured records", "search_index"],
]) {
  try {
    const rows = await q(
      `select coalesce(embedding_model, '(null)') model, count(*) n,
              sum(case when embedding is null then 1 else 0 end) without_vector
       from ${table} group by model order by n desc`
    );
    const total = rows.reduce((s, r) => s + Number(r.n), 0);
    console.log(`\n${label} (${total} rows):`);
    for (const r of rows) {
      console.log(`  ${String(r.model).padEnd(26)} ${String(r.n).padStart(6)}  without a vector: ${r.without_vector}`);
    }
  } catch (e) {
    console.log(`\n${label}: ${String(e.message).slice(0, 80)}`);
  }
}
db.close();
