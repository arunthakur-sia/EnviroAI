// What does knowledge_of_week hold right now?
import { createClient } from "@libsql/client";
const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
const rows = (
  await db.execute(
    "select week_start, status, resource_type, resource_id, read_count, set_at from knowledge_of_week order by week_start desc"
  )
).rows;
console.log(`${rows.length} picks`);
for (const r of rows) {
  console.log(`  ${r.week_start} ${r.status} ${r.resource_type} reads=${r.read_count} set=${String(r.set_at).slice(0, 19)}`);
}
const now = new Date();
const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
const day = d.getUTCDay() || 7;
d.setUTCDate(d.getUTCDate() - (day - 1));
console.log(`this week starts ${d.toISOString().slice(0, 10)}`);
db.close();
