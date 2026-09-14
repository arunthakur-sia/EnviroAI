// CR05 final sanity on the fresh DB.
import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;
const one = async (sql) => Number((await q(sql))[0].c);

console.log("entities:", await one("select count(*) c from entities"));
console.log(
  "nds3 delivery nodes without a lead:",
  await one(
    `select count(*) c from strategy_nodes n where n.edition_id=(select id from strategy_editions where code='nds3')
     and n.node_type in ('initiative','project')
     and not exists (select 1 from node_leads l where l.node_id=n.id and l.role='lead')`
  )
);
console.log("supporting leads:", await one("select count(*) c from node_leads where role='supporting'"));
console.log("stakeholder rows:", await one("select count(*) c from node_stakeholders"));
console.log(
  "projects with sponsor+owner+manager:",
  await one(
    `select count(*) c from (select node_id from node_stakeholders where role in ('sponsor','owner','manager') group by node_id having count(distinct role)=3)`
  )
);
console.log("active indices:", await one("select count(*) c from indices where is_active=1"));
console.log("observations:", await one("select count(*) c from index_observations"));
console.log("unsourced observations:", await one("select count(*) c from index_observations where source_url is null"));
console.log("current forecasts:", await one("select count(*) c from index_forecasts where status='current'"));
console.log("pillar values:", await one("select count(*) c from index_pillar_values"));
console.log("peer groups (shared):", await one("select count(*) c from peer_groups where owner_user_id is null"));
console.log("assumption defaults:", await one("select count(*) c from index_forecast_assumptions where index_id is null"));
console.log("employee statuses:", await one("select count(*) c from employee_status"));
console.log("ownership backups:", await one("select count(*) c from ownership_backups"));
console.log("handovers:", await one("select count(*) c from handovers"));
console.log("handover items:", await one("select count(*) c from handover_items"));
console.log("open hr risks:", await one("select count(*) c from hr_risks where resolved_at is null"));
console.log("hr game rules:", await one("select count(*) c from game_rules where event_type like 'handover%' or event_type in ('backup_assigned','knowledge_capture_bonus')"));
console.log("HR Admin role:", await one("select count(*) c from roles where name_en='HR Admin'"));
console.log("hr@npc.qa:", await one("select count(*) c from users where email='hr@npc.qa'"));
console.log("roles with portal sets:", await one("select count(*) c from roles where portals_json is not null"));
const domains = await q("select value_json from settings where key='allowed_domains'");
console.log("allowed domains:", domains[0]?.value_json ?? "MISSING");
const qatYears = await q(
  `select i.code, count(o.id) c from indices i left join index_observations o on o.index_id=i.id and o.country_code='QAT' group by i.code order by i.code`
);
console.log("qatar years per index:", qatYears.map((r) => `${r.code}=${r.c}`).join(" "));
db.close();
