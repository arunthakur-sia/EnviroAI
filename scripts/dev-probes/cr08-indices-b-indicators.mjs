// CR08 4.1 (agent B): the full indicator catalogue with its Qatar series
// shape and any NDS3 KPI target, to choose the national indicator set.
import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;

for (const r of await q(
  `select i.code, i.name_en, i.name_ar, i.unit, i.direction, i.frequency, i.first_period, i.last_period, i.is_headline, i.category_term_id,
     (select count(*) from indicator_values v where v.indicator_id=i.id and v.dimension_key='total') n,
     (select group_concat(k.target_value || '@' || k.target_year || ' [' || n2.code || ']', ';') from kpis k join strategy_nodes n2 on n2.id=k.node_id where k.indicator_id=i.id and k.target_value is not null) targets
   from indicators i order by i.code`
)) console.log(r.code, "|", r.name_en, "|", r.unit, "|", r.direction, "|", r.frequency, "|", r.first_period, "..", r.last_period, "| head", r.is_headline, "| n", r.n, "| targets", r.targets);

console.log("-- annual indicator values sample --");
for (const code of ["digital_services_share", "ghg_per_capita", "labour_productivity_growth", "solar_capacity"]) {
  const rows = await q(`select v.period, v.value from indicator_values v join indicators i on i.id=v.indicator_id where i.code=? and v.dimension_key='total' order by v.period`, [code]);
  console.log(code, ":", rows.map((r) => `${r.period}=${r.value}`).join(" "));
}
console.log("-- taxonomy terms for indicator categories --");
for (const r of await q(`select t.id, t.code, t.name_en from taxonomy_terms t where t.id in (select distinct category_term_id from indicators where category_term_id is not null)`)) console.log(r.id, r.code, r.name_en);
db.close();
