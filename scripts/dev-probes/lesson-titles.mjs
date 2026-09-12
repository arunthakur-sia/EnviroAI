import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
const r = await db.execute(
  "select id, category, title_en, substr(coalesce(context_en,''),1,90) ctx from lessons where node_id is null or node_id=''"
);
for (const row of r.rows) console.log(row.category, "|", row.title_en, "|", row.ctx);
db.close();
