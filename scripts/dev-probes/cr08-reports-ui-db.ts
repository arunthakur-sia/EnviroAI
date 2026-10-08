/* eslint-disable no-console */
// CR08 5 (Reports UI agent): which roles carry the reports portal, the default
// edition, a published report id, and a seeded user's department, so the probe
// and the smoke module know what to expect.
//   npx tsx scripts/dev-probes/cr08-reports-ui-db.ts
import { createClient } from "@libsql/client";

async function main() {
  const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
  const roles = (await db.execute("select name_en, portals_json from roles order by name_en")).rows;
  for (const r of roles) {
    let portals: string[] = [];
    try {
      portals = JSON.parse(String(r.portals_json ?? "[]"));
    } catch {
      portals = [];
    }
    console.log(`${String(r.name_en).padEnd(18)} reports=${portals.includes("reports") ? "yes" : "no "} (${portals.length} portals)`);
  }
  const editions = (await db.execute("select id, code, is_default from strategy_editions")).rows;
  console.log("editions:", editions.map((e) => `${e.code}:${e.is_default}`).join(", "));
  const counts = (await db.execute("select node_type, count(*) c from strategy_nodes group by node_type")).rows;
  console.log("nodes:", counts.map((c) => `${c.node_type}=${c.c}`).join(", "));
  const users = (await db.execute("select u.email, u.department_id, o.code from users u left join org_units o on o.id = u.department_id where u.email in ('analyst@enviroai.demo','reader@enviroai.demo','head.stats@enviroai.demo','admin@enviroai.demo')")).rows;
  for (const u of users) console.log(`${u.email}: dept=${u.code ?? "none"}`);
  const analyst = users.find((u) => u.email === "analyst@enviroai.demo");
  if (analyst?.department_id) {
    const led = (await db.execute({ sql: "select count(*) c from node_leads where lead_kind = 'department' and department_id = ?", args: [String(analyst.department_id)] })).rows;
    console.log("projects led by the analyst's department:", led[0]?.c);
  }
  const stake = (await db.execute("select count(*) c from node_stakeholders s join users u on u.id = s.user_id where u.email = 'analyst@enviroai.demo'")).rows;
  console.log("analyst stakeholder rows:", stake[0]?.c);
  const published = (await db.execute("select r.id, t.code, r.preview_images_json from reports r join report_types t on t.id = r.type_id where r.status = 'published' order by t.sort limit 3")).rows;
  for (const p of published) console.log(`published: ${p.code} ${p.id} previews=${JSON.parse(String(p.preview_images_json ?? "[]")).length}`);
  const settings = (await db.execute("select key, value_json from settings where key like '%mock%' or key like '%ai%'")).rows.slice(0, 10);
  for (const s of settings) console.log(`setting ${s.key}: ${String(s.value_json).slice(0, 80)}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
