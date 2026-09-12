import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
const r = await db.execute(
  "select n.node_type, count(distinct k.id) kn, count(distinct n.id) nodes from strategy_nodes n left join kpis k on k.node_id=n.id where n.edition_id=(select id from strategy_editions where code='nds3') group by n.node_type"
);
console.log(r.rows);
const d = await db.execute("select count(*) c from kpi_values");
console.log("kpi_values", d.rows[0].c);
const t = await db.execute(
  "select count(*) c from strategy_nodes where node_type='target' and id in (select node_id from kpis)"
);
console.log("targets with kpis", t.rows[0].c);
db.close();
