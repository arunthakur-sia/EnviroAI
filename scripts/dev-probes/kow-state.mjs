// The Knowledge of the Week schedule, against today's date.
import { createClient } from "@libsql/client";
import { dbUrl } from "../lib/paths.mjs";
const db = createClient({ url: dbUrl() });
const rows = (
  await db.execute(
    "select week_start, status, resource_type, resource_id, read_count from knowledge_of_week order by week_start"
  )
).rows;
console.log(`today: ${new Date().toISOString().slice(0, 10)}`);
console.log(`picks: ${rows.length}`);
for (const r of rows) {
  console.log(`  ${r.week_start}  ${String(r.status).padEnd(10)} ${String(r.resource_type).padEnd(10)} reads=${r.read_count}`);
}
db.close();
