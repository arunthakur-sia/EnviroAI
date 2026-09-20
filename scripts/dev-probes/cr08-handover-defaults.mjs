// Which open handovers have a default recipient, and how many pending in-scope items?
import { createClient } from "@libsql/client";
const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
const rows = (
  await db.execute(
    `select h.id, h.status, h.completion_pct pct, h.successor_default_user_id sdu,
            (select count(*) from handover_items i where i.handover_id = h.id and i.status='pending' and coalesce(i.in_scope,1)=1) pend
     from handovers h`
  )
).rows;
for (const r of rows) {
  console.log(
    `${String(r.id).slice(0, 8)} status=${r.status} pct=${r.pct} default=${r.sdu ? String(r.sdu).slice(0, 8) : "NONE"} pendingInScope=${r.pend}`
  );
}
db.close();
