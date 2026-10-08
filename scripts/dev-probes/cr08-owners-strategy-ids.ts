/* eslint-disable no-console */
// CR08 9.1 dev probe: the exact deep links the owner probe and the smoke
// module open, resolved from the seeded data.
//   npx tsx scripts/dev-probes/cr08-owners-strategy-ids.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { rawClient } = await import("../../src/server/db/client");
  const project = await rawClient.execute(
    `select n.id, n.code, n.title_en, u.name_en owner, e.code edition
       from strategy_nodes n join users u on u.id = n.owner_user_id
       join strategy_editions e on e.id = n.edition_id
      where n.node_type = 'project' and u.deleted_at is null limit 3`
  );
  console.log("owned projects:", JSON.stringify(project.rows));
  const outcome = await rawClient.execute(
    `select n.id, n.code, e.code edition, (select count(*) from kpis k where k.node_id = n.id and k.owner_user_id is not null) kpis_owned,
            (select count(*) from strategy_nodes c where c.parent_id = n.id) children
       from strategy_nodes n join strategy_editions e on e.id = n.edition_id
      where n.node_type = 'outcome' and e.code = 'nes3' order by n.sort limit 4`
  );
  console.log("nes3 outcomes:", JSON.stringify(outcome.rows));
  const items = await rawClient.execute(
    `select n.id, n.code, n.node_type, p.code parent_code, pp.code grandparent_code, u.name_en owner
       from strategy_nodes n
       left join strategy_nodes p on p.id = n.parent_id
       left join strategy_nodes pp on pp.id = p.parent_id
       join users u on u.id = n.owner_user_id
      where n.node_type in ('project','initiative') limit 10`
  );
  console.log("owned items with their ancestors:", JSON.stringify(items.rows));
  const council = await rawClient.execute(
    `select c.id, c.code, c.level, p.code parent_code, pp.code grandparent_code, ppp.code goal_code, u.name_en owner
       from council_nodes c
       left join council_nodes p on p.id = c.parent_id
       left join council_nodes pp on pp.id = p.parent_id
       left join council_nodes ppp on ppp.id = pp.parent_id
       join users u on u.id = c.owner_user_id
      where c.level = 'project' order by c.code limit 5`
  );
  console.log("owned council projects:", JSON.stringify(council.rows));
  const sh = await rawClient.execute(
    `select n.id, n.code, count(*) rows_with_user
       from node_stakeholders s join strategy_nodes n on n.id = s.node_id
      where s.user_id is not null group by n.id order by rows_with_user desc limit 5`
  );
  console.log("nodes with the most stakeholder accounts:", JSON.stringify(sh.rows));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
