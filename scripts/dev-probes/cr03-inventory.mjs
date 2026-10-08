// CR03 planning probe: knowledge type codes and counts, deliverable/project
// counts, page counts coverage, word_of_day rows, headline indicators,
// signals horizon/type spread, status updates per month.
import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/enviroai/data/nexus.db" });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;

console.log("-- knowledge types --");
for (const r of await q(`select t.code, t.name_en, t.sort, count(d.id) c
  from taxonomy_terms t
  join taxonomy_dimensions dim on dim.id=t.dimension_id and dim.code='knowledge_type'
  left join documents d on d.knowledge_type_term_id=t.id and d.deleted_at is null
  group by t.id order by t.sort`)) console.log(r.code, "|", r.name_en, "| sort", r.sort, "| docs", r.c);

console.log("-- page count coverage --");
for (const r of await q(`select (page_count is null) as noPages, count(*) c from documents where deleted_at is null group by noPages`)) console.log("noPages:", r.noPages, "count:", r.c);

console.log("-- deliverables per project (top 5) --");
for (const r of await q(`select n.code, n.title_en, count(*) c from deliverable_meta m join strategy_nodes n on n.id=m.node_id group by m.node_id order by n.code limit 5`)) console.log(r.code, r.c);
const tot = await q(`select count(*) c, count(distinct node_id) p from deliverable_meta`);
console.log("total deliverables:", tot[0].c, "across projects:", tot[0].p);

console.log("-- word_of_day --");
for (const r of await q(`select kind, substr(text_en,1,40) t, attribution_en, source_ref from word_of_day limit 10`)) console.log(r.kind, "|", r.t, "|", r.attribution_en, "|", r.source_ref);

console.log("-- headline indicators --");
for (const r of await q(`select id, code, name_en, unit, is_headline from indicators where is_headline=1 limit 12`)) console.log(r.code, "|", r.name_en, "|", r.unit);

console.log("-- daily cards --");
for (const r of await q(`select date, indicator_id is not null hasInd, big_number, substr(hook_en,1,40) hook from daily_cards order by date desc limit 5`)) console.log(r.date, r.hasInd, r.big_number, "|", r.hook);

console.log("-- signals: horizon x type (accepted, last 180d) --");
for (const r of await q(`select horizon, signal_type, impact, sentiment, count(*) c from signals where triage_status in ('accepted','converted') group by horizon, signal_type, impact, sentiment order by c desc limit 30`)) console.log(r.horizon, r.signal_type, r.impact, r.sentiment, r.c);
const sigTot = await q(`select triage_status, count(*) c from signals group by triage_status`);
console.log("triage:", sigTot.map(r => `${r.triage_status}:${r.c}`).join(" "));

console.log("-- status updates per month (nes3) --");
for (const r of await q(`select substr(su.created_at,1,7) m, count(*) c from status_updates su join strategy_nodes n on n.id=su.node_id join strategy_editions e on e.id=n.edition_id and e.code='nes3' group by m order by m`)) console.log(r.m, r.c);

console.log("-- outcomes with descriptions --");
for (const r of await q(`select code, substr(description_en,1,50) d from strategy_nodes where node_type='outcome' and edition_id=(select id from strategy_editions where code='nes3') order by sort`)) console.log(r.code, "|", r.d);

console.log("-- indicator with most values --");
for (const r of await q(`select i.code, i.name_en, count(v.id) c from indicators i join indicator_values v on v.indicator_id=i.id and v.dimension_key='total' group by i.id order by c desc limit 5`)) console.log(r.code, "|", r.name_en, "|", r.c);
db.close();
