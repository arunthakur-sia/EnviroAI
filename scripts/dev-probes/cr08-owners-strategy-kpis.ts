/* eslint-disable no-console */
// CR08 9.1 dev probe: the KPIs, the nodes they hang on and the head of the
// department that leads each node, which is who a custodian would be.
//   npx tsx scripts/dev-probes/cr08-owners-strategy-kpis.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { rawClient } = await import("../../src/server/db/client");
  const rows = await rawClient.execute(
    `select k.id, k.name_en, k.owner_user_id, n.id node_id, n.code node_code, n.node_type, e.code edition,
            d.code dep, u.name_en head, u.id head_id
       from kpis k
       join strategy_nodes n on n.id = k.node_id
       join strategy_editions e on e.id = n.edition_id
       left join node_leads nl on nl.node_id = n.id and nl.role = 'lead' and nl.lead_kind = 'department'
       left join departments d on d.id = nl.department_id
       left join users u on u.id = d.head_user_id
      order by e.code, n.code`
  );
  for (const r of rows.rows) {
    console.log(
      `${r.edition} ${r.node_code} (${r.node_type}) kpi=${String(r.name_en).slice(0, 40)} owner=${r.owner_user_id ?? "-"} dep=${r.dep ?? "-"} head=${r.head ?? "-"}`
    );
  }
  console.log(`rows: ${rows.rows.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
