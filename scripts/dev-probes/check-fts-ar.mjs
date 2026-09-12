import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/npckms/data/nexus.db" });

const match = '"بلغ" OR "معدل" OR "التضخم" OR "قطر" OR "مؤخراً"';
const res = await db.execute({
  sql: `SELECT si.resource_type, si.resource_id, substr(si.text,1,60) t, bm25(records_fts) rank
        FROM records_fts JOIN search_index si ON si.rowid = records_fts.rowid
        WHERE records_fts MATCH ? ORDER BY rank LIMIT 60`,
  args: [match],
});
console.log("total hits:", res.rows.length);
const cpi = await db.execute("select id from indicators where code='cpi_inflation'");
const cpiId = String(cpi.rows[0].id);
const pos = res.rows.findIndex((r) => String(r.resource_id) === cpiId);
console.log("CPI position in top60:", pos);
console.log(
  "top 10:",
  res.rows.slice(0, 10).map((r) => `${r.resource_type} ${String(r.t).slice(0, 40)} (${Number(r.rank).toFixed(2)})`)
);
const only = await db.execute({
  sql: `SELECT si.resource_type, substr(si.text,1,50) t FROM records_fts JOIN search_index si ON si.rowid=records_fts.rowid WHERE records_fts MATCH '"التضخم"'`,
  args: [],
});
console.log("التضخم-only hits:", only.rows.map((r) => `${r.resource_type}: ${r.t}`));
db.close();
