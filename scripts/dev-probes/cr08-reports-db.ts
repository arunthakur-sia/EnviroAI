/* eslint-disable no-console */
// CR08 5: quick read of the reports tables and the scope candidates while
// building the module.
//   npx tsx scripts/dev-probes/cr08-reports-db.ts
import { createClient } from "@libsql/client";

async function main() {
  const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
  const q = async (sql: string) => (await db.execute(sql)).rows;
  console.log(
    "knowledge types:",
    await q(
      "select t.code, t.name_en from taxonomy_terms t join taxonomy_dimensions d on d.id = t.dimension_id where d.code = 'knowledge_type'"
    )
  );
  console.log("report_types:", await q("select code, family, name_en, scope_kind from report_types order by sort"));
  console.log(
    "module reports:",
    await q(
      "select r.id, r.status, r.title_en, r.docx_path, r.version, t.code from reports r left join report_types t on t.id = r.type_id where r.type_id is not null order by r.created_at"
    )
  );
  console.log(
    "sections by status:",
    await q("select status, count(*) c from report_sections group by status")
  );
  console.log(
    "outcomes:",
    await q(
      "select n.id, n.code, n.title_en, e.code edition from strategy_nodes n join strategy_editions e on e.id = n.edition_id where n.node_type = 'outcome' and e.is_default = 1 order by n.sort limit 8"
    )
  );
  console.log(
    "departments:",
    await q("select id, code, name_en, level from org_units where level = 'department' order by sort limit 6")
  );
  console.log(
    "projects with deliverables:",
    await q(
      "select n.id, n.code, n.title_en, n.status, (select count(*) from deliverable_meta m where m.node_id = n.id) d from strategy_nodes n where n.node_type = 'project' order by d desc limit 5"
    )
  );
  console.log(
    "users:",
    await q(
      "select u.id, u.email, r.name_en role, u.department_id from users u join roles r on r.id = u.role_id where u.email in ('admin@enviroai.demo', 'analyst@enviroai.demo', 'head.stats@enviroai.demo')"
    )
  );
  console.log("settings keys:", await q("select key from settings"));
  console.log("game rules:", await q("select event_type, points from game_rules where event_type like 'report%'"));
  console.log("signals accepted:", await q("select signal_type, count(*) c from signals where triage_status = 'accepted' group by signal_type"));
  console.log("episodes:", await q("select count(*) c from podcast_episodes where status = 'published'"));
  console.log("indices:", await q("select count(*) c from indices where is_active = 1"));
  console.log("forecasts current:", await q("select horizon_years, count(*) c from index_forecasts where status = 'current' group by horizon_years"));
  console.log("indicators headline:", await q("select count(*) c from indicators where is_headline = 1"));
  console.log("indicator categories:", await q("select t.code, t.name_en, count(i.id) c from indicators i left join taxonomy_terms t on t.id = i.category_term_id group by t.code"));
  console.log("lessons:", await q("select status, count(*) c from lessons group by status"));
  console.log("status updates in 2026:", await q("select count(*) c from status_updates where created_at >= '2026-01-01'"));
  console.log("releases upcoming:", await q("select count(*) c from releases where release_date >= '2026-09-19'"));
  console.log("council:", await q("select id, name_en, is_illustrative from council_strategies"));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
