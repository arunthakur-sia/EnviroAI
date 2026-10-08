// CR08 4.1 (agent B) planning probe: headline indicators with their home-country
// series, the strategy KPI targets that link to them, the current indices rows
// and the group tables. Read-only.
import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/enviroai/data/nexus.db" });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;

console.log("-- headline indicators --");
for (const r of await q(
  `select i.id, i.code, i.name_en, i.unit, i.decimals, i.direction, i.frequency, i.first_period, i.last_period,
     (select count(*) from indicator_values v where v.indicator_id=i.id and v.dimension_key='total') n
   from indicators i where i.is_headline=1 order by i.code`
)) console.log(r.code, "|", r.name_en, "|", r.unit, "| dir", r.direction, "|", r.frequency, "|", r.first_period, "..", r.last_period, "| n", r.n);

console.log("-- indicators with any KPI link (kpis.indicator_id) --");
for (const r of await q(
  `select i.code, i.name_en, i.is_headline, k.name_en kpi, k.target_value, k.target_year, k.baseline_value, k.baseline_year, k.unit, n.node_type, n.code ncode, n.title_en ntitle, n.status
   from kpis k join indicators i on i.id=k.indicator_id join strategy_nodes n on n.id=k.node_id order by i.code`
)) console.log(r.code, "| headline", r.is_headline, "|", r.kpi, "| target", r.target_value, r.target_year, "| base", r.baseline_value, r.baseline_year, "|", r.node_type, r.ncode, "|", r.status);

console.log("-- kpis with numeric targets (all) --");
for (const r of await q(
  `select k.name_en kpi, k.unit, k.target_value, k.target_year, k.baseline_value, k.baseline_year, k.indicator_id, n.node_type, n.code ncode, substr(n.title_en,1,60) ntitle
   from kpis k join strategy_nodes n on n.id=k.node_id where k.target_value is not null order by n.code`
)) console.log(r.kpi, "|", r.unit, "| target", r.target_value, r.target_year, "| base", r.baseline_value, r.baseline_year, "| ind", r.indicator_id ? "yes" : "no", "|", r.node_type, r.ncode, "|", r.ntitle);

console.log("-- headline indicator values (total, annual periods) --");
for (const r of await q(
  `select i.code, group_concat(v.period || '=' || v.value, ' ') s
   from indicators i join indicator_values v on v.indicator_id=i.id and v.dimension_key='total'
   where i.is_headline=1 group by i.id order by i.code`
)) console.log(r.code, ":", r.s);

console.log("-- indicators (non-headline) with targets via kpis, sample values --");
for (const r of await q(
  `select distinct i.code, i.name_en, i.unit, i.frequency, i.first_period, i.last_period from kpis k join indicators i on i.id=k.indicator_id where k.target_value is not null order by i.code`
)) console.log(r.code, "|", r.name_en, "|", r.unit, "|", r.frequency, "|", r.first_period, "..", r.last_period);

console.log("-- indices rows --");
for (const r of await q(
  `select code, scale, latest_year, is_active, sdg_goal, forecast_mode, forecast_enabled, target_value, target_year, linked_statistics_indicator_id,
     (select count(*) from index_observations o where o.index_id=indices.id) obs,
     (select count(*) from index_forecasts f where f.index_id=indices.id and f.status='current') fc
   from indices order by code`
)) console.log(r.code, "|", r.scale, "| latest", r.latest_year, "| active", r.is_active, "| sdg", r.sdg_goal, "| mode", r.forecast_mode, "| en", r.forecast_enabled, "| obs", r.obs, "| fc", r.fc);

console.log("-- index groups --");
for (const r of await q(`select g.code, g.sort, (select count(*) from index_group_members m where m.group_id=g.id) n from index_groups g order by g.sort`)) console.log(r.code, r.sort, "members", r.n);

console.log("-- strategy editions --");
for (const r of await q(`select code, name_en, period_from, period_to from strategy_editions`)) console.log(r.code, "|", r.name_en, r.period_from, r.period_to);

console.log("-- strategy targets sample (with numbers in title) --");
for (const r of await q(
  `select n.code, n.title_en, n.status from strategy_nodes n join strategy_editions e on e.id=n.edition_id and e.is_default=1 where n.node_type='target' and (n.title_en glob '*[0-9]*') order by n.code limit 60`
)) console.log(r.code, "|", r.title_en, "|", r.status);

console.log("-- entities count --");
console.log((await q(`select count(*) c from entities`))[0].c);
db.close();
