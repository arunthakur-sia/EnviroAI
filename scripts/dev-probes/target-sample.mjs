import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
const r = await db.execute(
  "select id, code, title_en, description_en, status, source_ref, owner_entity_name from strategy_nodes where node_type='target' order by sort limit 5"
);
for (const row of r.rows) console.log(JSON.stringify(row, null, 1));
// any kpis whose indicator links exist that we could attach to targets?
const k = await db.execute(
  "select k.id, k.name_en, k.node_id, n.node_type, n.code, k.target_value, k.unit, k.indicator_id from kpis k join strategy_nodes n on n.id=k.node_id limit 25"
);
console.log(k.rows.map((x) => `${x.node_type} ${x.code}: ${x.name_en} target=${x.target_value}${x.unit ?? ""} ind=${x.indicator_id ? "y" : "n"}`).join("\n"));
db.close();
