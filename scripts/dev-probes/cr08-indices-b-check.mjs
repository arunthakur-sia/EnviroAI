// CR08 4.1 (agent B) verification probe: per group the member count, per new
// index (everything beyond the CR05 twelve) the observation count, Qatar's
// years, the forecast mode and the current forecast rows. Read-only.
// Usage: node scripts/dev-probes/cr08-indices-b-check.mjs
import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;

const CR05 = ["hdi", "gii", "cpi", "egdi", "gpi", "imd", "lpi", "nri", "ttdi", "epi", "gtci", "wjp"];

console.log("== groups ==");
for (const g of await q(
  `select g.code, g.sort, count(m.id) n, group_concat(i.code, ' ') members
   from index_groups g left join index_group_members m on m.group_id = g.id
   left join indices i on i.id = m.index_id group by g.id order by g.sort`
)) console.log(`${String(g.code).padEnd(16)} members=${String(g.n).padStart(3)}  ${g.members ?? ""}`);

console.log("\n== new indices ==");
const rows = await q(
  `select i.id, i.code, i.scale, i.forecast_mode, i.forecast_enabled, i.target_value, i.target_year, i.latest_year,
     (select count(*) from index_observations o where o.index_id = i.id) obs,
     (select count(distinct o.country_code) from index_observations o where o.index_id = i.id) countries,
     (select group_concat(o.year, ',') from (select year from index_observations o where o.index_id = i.id and o.country_code = 'QAT' order by year) o) qyears,
     (select count(*) from index_forecasts f where f.index_id = i.id and f.status = 'current') fc,
     (select f.inputs_json from index_forecasts f where f.index_id = i.id and f.status = 'current' and f.horizon_years = 3) inputs
   from indices i order by i.code`
);
let total = 0;
for (const r of rows) {
  if (CR05.includes(r.code)) continue;
  total++;
  let mode = "-";
  try {
    mode = JSON.parse(r.inputs ?? "{}").mode ?? "-";
  } catch {
    /* no forecast */
  }
  const qy = r.qyears ? String(r.qyears).split(",") : [];
  console.log(
    `${String(r.code).padEnd(30)} obs=${String(r.obs).padStart(4)} countries=${String(r.countries).padStart(3)} qatar=${
      qy.length ? `${qy.length}y ${qy[0]}-${qy[qy.length - 1]}` : "none"
    } mode=${r.forecast_mode ?? "auto"}${r.forecast_enabled === 0 ? " (off)" : ""} target=${
      r.target_value == null ? "-" : `${r.target_value}@${r.target_year}`
    } forecasts=${r.fc}${r.fc ? ` (${mode})` : ""}`
  );
}
console.log(`\n${total} indices beyond the CR05 twelve`);
const gapRows = await q(
  `select i.code, f.horizon_years, f.central_score, f.low, f.high, f.simulation_summary_json
   from index_forecasts f join indices i on i.id = f.index_id
   where f.status = 'current' and f.horizon_years = 3 and i.forecast_mode = 'target_gap' order by i.code`
);
console.log("\n== target_gap forecasts (+3 rows) ==");
for (const r of gapRows) {
  const s = JSON.parse(r.simulation_summary_json ?? "{}");
  const g = s.targetGap;
  console.log(
    `${String(r.code).padEnd(30)} central=${Number(r.central_score).toFixed(2)} [${Number(r.low).toFixed(2)}, ${Number(r.high).toFixed(2)}]` +
      (g
        ? ` target=${g.targetValue}@${g.targetYear} gapNow=${g.gapNow.toFixed(2)} gap@target=${g.gapCentral.toFixed(2)} p=${(g.probability * 100).toFixed(0)}% closes=${g.closingYear ?? "never<15y"}`
        : "")
  );
}
db.close();
