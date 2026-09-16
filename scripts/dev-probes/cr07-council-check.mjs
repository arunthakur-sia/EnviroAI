import { createClient } from "@libsql/client";
const db = createClient({ url: "file:" + process.cwd().replace(/\\/g, "/") + "/data/nexus.db" });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;

const [s] = await q("select * from council_strategies");
console.log("strategy:", s.name_en, "|", s.name_ar);
console.log("period:", s.period_from, "to", s.period_to, "| approved", s.approved_on, "| illustrative", s.is_illustrative);
console.log("values:", JSON.parse(s.values_json).length);

const levels = await q("select level, count(*) c from council_nodes group by level");
console.log("\nlevels:", levels.map((r) => `${r.level}=${r.c}`).join(", "));

const freq = await q("select frequency, count(*) c from council_indicators group by frequency");
console.log("indicator cadence:", freq.map((r) => `${r.frequency}=${r.c}`).join(", "));

const st = await q("select status, count(*) c from council_nodes where level='project' group by status");
console.log("project status:", st.map((r) => `${r.status}=${r.c}`).join(", "));

// RAG of the newest actual per indicator
const rows = await q(`
  select i.id, i.code, i.direction, i.unit, i.frequency,
         v.period, v.actual_value, t.target_value
  from council_indicators i
  join council_indicator_values v on v.indicator_id = i.id
  left join council_indicator_targets t on t.indicator_id = i.id and t.period = v.period
  where v.period = (select max(period) from council_indicator_values v2 where v2.indicator_id = i.id)
`);
let onTarget = 0, atRisk = 0, behind = 0, noData = 0;
for (const r of rows) {
  const a = r.actual_value, t = r.target_value;
  if (a == null || t == null) { noData++; continue; }
  const ratio = r.direction === "down_good" ? (a <= 0 ? 1 : t / a) : (t === 0 ? 1 : a / t);
  if (ratio >= 0.95) onTarget++; else if (ratio >= 0.8) atRisk++; else behind++;
}
console.log(`\nlatest-period RAG over ${rows.length} indicators: onTarget=${onTarget} atRisk=${atRisk} behind=${behind} noData=${noData}`);

const bad = await q("select count(*) c from council_indicator_values where actual_value < 0");
console.log("negative actuals:", bad[0].c);
const pct = await q(`
  select count(*) c from council_indicator_values v
  join council_indicators i on i.id = v.indicator_id
  where i.unit = 'percent' and (v.actual_value > 100 or v.actual_value < 0)`);
console.log("percent out of range:", pct[0].c);

const orphan = await q(`select count(*) c from council_indicators where node_id not in (select id from council_nodes)`);
console.log("orphan indicators:", orphan[0].c);
const align = await q("select target_kind, count(*) c from council_alignment group by target_kind");
console.log("alignment:", align.map((r) => `${r.target_kind}=${r.c}`).join(", "));
const risks = await q("select status, count(*) c from council_risks group by status");
console.log("risks:", risks.map((r) => `${r.status}=${r.c}`).join(", "));
const heat = await q("select likelihood, impact, count(*) c from council_risks group by likelihood, impact order by impact desc, likelihood");
console.log("risk heat cells used:", heat.length, "of 25");
const lessons = await q("select count(*) c from lesson_node_links where node_kind='council'");
console.log("council lesson links:", lessons[0].c);
const stake = await q("select role, count(*) c from node_stakeholders where node_kind='council' group by role");
console.log("council stakeholders:", stake.map((r) => `${r.role}=${r.c}`).join(", "));
const ms = await q("select count(*) c from council_milestones");
console.log("milestones:", ms[0].c);

// a sample indicator card in both languages
const [card] = await q("select * from council_indicators where frequency='quarterly' limit 1");
console.log("\nsample card:", card.code, "|", card.name_en, "|", card.name_ar);
console.log("  definition ar:", String(card.definition_ar).slice(0, 90));
console.log("  formula en:", String(card.formula_en).slice(0, 90));
console.log("  unit", card.unit, "direction", card.direction, "baseline", card.baseline_value);
const series = await q("select period, actual_value from council_indicator_values where indicator_id=? order by period", [card.id]);
console.log("  actuals:", series.map((r) => `${r.period}=${r.actual_value}`).join(" "));
