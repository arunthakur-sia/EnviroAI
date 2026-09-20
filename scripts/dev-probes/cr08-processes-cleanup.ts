/* eslint-disable no-console */
// CR08 10.1 dev probe: removes any P8.PROBE row a interrupted Playwright pass
// left behind, and times the process API so a slow shared server is visible.
//   npx tsx scripts/dev-probes/cr08-processes-cleanup.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { rawClient } = await import("../../src/server/db/client");
  const left = await rawClient.execute("select id, code from processes where code like 'P8.PROBE%'");
  console.log(`probe rows: ${left.rows.length}`);
  for (const row of left.rows) {
    await rawClient.execute({ sql: "delete from process_raci where process_id = ?", args: [String(row.id)] });
    await rawClient.execute({ sql: "delete from processes where id = ?", args: [String(row.id)] });
    console.log(`  deleted ${row.code}`);
  }
  const counts = await rawClient.execute("select level, count(*) n from processes group by level order by level");
  console.log("processes by level:", counts.rows.map((r) => `L${r.level}=${r.n}`).join(" "));
  const raci = await rawClient.execute("select count(*) n from process_raci");
  console.log("raci cells:", raci.rows[0]?.n);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
