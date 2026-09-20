/* eslint-disable no-console */
// CR08 5: removes the module reports a given account requested (default the
// Contributor the smoke suite uses), with their sections, versions,
// published documents and files, and prints the account's scope first.
//   npx tsx scripts/dev-probes/cr08-reports-cleanup.ts [email]
import { loadEnv } from "../../src/lib/load-env";
loadEnv();
import { createClient } from "@libsql/client";

async function main() {
  const email = process.argv[2] ?? "analyst@npc.qa";
  const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
  const user = await db.execute({ sql: "select u.id, u.department_scope, r.name_en role from users u join roles r on r.id = u.role_id where u.email = ?", args: [email] });
  console.log("account:", user.rows[0]);
  if (!user.rows[0]) return;
  const rows = await db.execute({ sql: "select id, title_en, status from reports where type_id is not null and requested_by = ?", args: [String(user.rows[0].id)] });
  console.log(`${rows.rows.length} module reports requested by ${email}`);
  const { cleanupReport } = await import("../smoke-cr08-reports");
  for (const r of rows.rows) {
    console.log(`  removing ${r.id} "${r.title_en}" (${r.status})`);
    await cleanupReport({ base: "", cookie: "", adminCookie: "", db }, String(r.id));
  }
  const jobs = await db.execute("select type, status, count(*) c from jobs where type like 'report_%' group by type, status");
  console.log("report jobs:", jobs.rows);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
