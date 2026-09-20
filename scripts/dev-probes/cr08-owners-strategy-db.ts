/* eslint-disable no-console */
// CR08 9.1 dev probe: what the strategy and council surfaces can actually
// show an owner for. Counts the recorded people per surface and names one
// node of each kind the Playwright probe can open.
//   npx tsx scripts/dev-probes/cr08-owners-strategy-db.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { rawClient } = await import("../../src/server/db/client");
  const q = async (label: string, sql: string) => {
    const res = await rawClient.execute(sql);
    console.log(`${label}: ${JSON.stringify(res.rows.slice(0, 6))}`);
  };

  await q(
    "strategy nodes with an owner, by type",
    "select node_type, count(*) n, sum(case when owner_user_id is not null then 1 else 0 end) owned from strategy_nodes group by node_type order by node_type"
  );
  await q(
    "kpis with a custodian",
    "select count(*) n, sum(case when owner_user_id is not null then 1 else 0 end) owned from kpis"
  );
  await q(
    "council nodes with an owner, by level",
    "select level, count(*) n, sum(case when owner_user_id is not null then 1 else 0 end) owned from council_nodes group by level order by level"
  );
  await q(
    "council indicators with a responsible",
    "select count(*) n, sum(case when responsible_user_id is not null then 1 else 0 end) owned from council_indicators"
  );
  await q(
    "node stakeholders with an account",
    "select count(*) n, sum(case when user_id is not null then 1 else 0 end) with_user from node_stakeholders"
  );
  await q(
    "departments that lead an outcome and their heads",
    "select d.code, d.name_en, u.name_en head from node_leads nl join departments d on d.id = nl.department_id left join users u on u.id = d.head_user_id join strategy_nodes n on n.id = nl.node_id where n.node_type = 'outcome' and nl.role = 'lead' limit 6"
  );
  await q(
    "an owned outcome and an owned project (for the probe)",
    "select n.id, n.code, n.node_type, e.code edition, u.name_en owner from strategy_nodes n join strategy_editions e on e.id = n.edition_id join users u on u.id = n.owner_user_id where n.node_type in ('outcome','project','initiative','target') order by n.node_type limit 8"
  );
  await q(
    "an owned KPI with its node",
    "select k.id, k.name_en, k.node_id, n.code node_code, n.node_type, u.name_en owner from kpis k join users u on u.id = k.owner_user_id join strategy_nodes n on n.id = k.node_id limit 6"
  );
  await q(
    "an owned council project",
    "select c.id, c.code, c.level, u.name_en owner from council_nodes c join users u on u.id = c.owner_user_id where c.level = 'project' limit 6"
  );
  await q(
    "a council indicator with a responsible",
    "select i.id, i.code, i.node_id, u.name_en responsible from council_indicators i join users u on u.id = i.responsible_user_id limit 6"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
