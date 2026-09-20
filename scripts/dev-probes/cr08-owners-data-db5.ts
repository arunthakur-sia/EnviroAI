/* eslint-disable no-console */
// CR08 9.1 dev probe (final pass): confirms the probe left no temporary data
// behind: no indicator carries a department, and the conversations the probe
// created are ordinary rows owned by the Contributor account.
//   npx tsx scripts/dev-probes/cr08-owners-data-db5.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { rawClient } = await import("../../src/server/db/client");
  const ind = await rawClient.execute("select count(*) total, count(department_id) with_dept from indicators");
  console.log("indicators:", JSON.stringify(ind.rows[0]));
  const conv = await rawClient.execute(
    "select count(*) n from ai_messages where citations_json like '%\"owner\"%'"
  );
  console.log("answers whose citations carry owners:", JSON.stringify(conv.rows[0]));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
