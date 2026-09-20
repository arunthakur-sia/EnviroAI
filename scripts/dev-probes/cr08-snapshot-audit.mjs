// What is sitting in org_snapshots: real demo snapshots vs probe leftovers?
import { createClient } from "@libsql/client";
const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
const rows = (
  await db.execute(
    `select id, note, taken_at, taken_by, length(tree_json) bytes
     from org_snapshots order by taken_at desc`
  )
).rows;
console.log(`total ${rows.length}`);
for (const r of rows.slice(0, 200)) {
  console.log(
    `${String(r.taken_at).slice(0, 19)}  ${String(r.bytes).padStart(7)}  ${String(r.note ?? "").slice(0, 80)}`
  );
}
db.close();
