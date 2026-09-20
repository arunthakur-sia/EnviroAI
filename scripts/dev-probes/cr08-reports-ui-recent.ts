/* eslint-disable no-console */
// CR08 5 (Reports UI agent): module reports created in the last hour that
// are not published (the probe's own, when a run was cut short), and their
// removal with CLEAN=<id> (or CLEAN=all for every such row).
//   npx tsx scripts/dev-probes/cr08-reports-ui-recent.ts
//   CLEAN=all npx tsx scripts/dev-probes/cr08-reports-ui-recent.ts
import { createClient } from "@libsql/client";

async function main() {
  const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
  const rows = (await db.execute(
    "select r.id, t.code, r.status, r.created_at, u.email from reports r join report_types t on t.id = r.type_id left join users u on u.id = r.requested_by where r.status != 'published' and r.created_at > datetime('now', '-1 hour') order by r.created_at"
  )).rows;
  for (const r of rows) console.log(`${r.id} ${r.code} ${r.status} ${r.created_at} ${r.email}`);
  if (!rows.length) console.log("no unpublished module reports in the last hour");
  // ONLY=<id> removes exactly that report whatever its age or status (a probe
  // report that reached "published" is not in the list above)
  const only = process.env.ONLY;
  if (only) {
    const row = (await db.execute({ sql: "select id, status, title_en from reports where id = ? and type_id is not null", args: [only] })).rows[0];
    if (!row) {
      console.log(`no module report ${only}`);
    } else {
      const { cleanupReport } = await import("../smoke-cr08-reports");
      await cleanupReport({ base: "", cookie: "", adminCookie: "", db }, String(row.id));
      console.log(`cleaned ${row.id} "${row.title_en}" (${row.status})`);
    }
    return;
  }
  const clean = process.env.CLEAN;
  if (clean) {
    const { cleanupReport } = await import("../smoke-cr08-reports");
    for (const r of rows) {
      if (clean === "all" || clean === String(r.id)) {
        await cleanupReport({ base: "", cookie: "", adminCookie: "", db }, String(r.id));
        console.log(`cleaned ${r.id}`);
      }
    }
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
