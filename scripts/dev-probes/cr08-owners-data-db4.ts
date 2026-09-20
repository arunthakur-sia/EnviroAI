/* eslint-disable no-console */
// CR08 9.1 dev probe (fourth pass): the department scope of every role, to see
// whether giving an indicator a department would hide it from anybody.
//   npx tsx scripts/dev-probes/cr08-owners-data-db4.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { rawClient } = await import("../../src/server/db/client");
  const cols = await rawClient.execute("select name from pragma_table_info('roles')");
  console.log("== roles columns:", cols.rows.map((r) => r.name).join(", "));
  const roles = await rawClient.execute("select * from roles order by name_en");
  console.log("== roles");
  for (const r of roles.rows) console.log(`  ${r.name_en}: scope=${r.default_department_scope} clearance=${r.default_clearance}`);
  const ind = await rawClient.execute(
    "select id, code, name_en, classification_level from indicators where code in ('QAT_GDP_GROWTH','gdp_real_growth') or lower(name_en) like '%real gdp growth%' or lower(name_en) like '%unemployment%' limit 10"
  );
  console.log("== candidate indicators");
  for (const r of ind.rows) console.log("  ", JSON.stringify(r));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
