/* eslint-disable no-console */
// CR08 10.1 dev probe: what the /processes page will see. Roles and their
// portal sets (which seeded account lacks the processes portal), the owner
// units of the seeded processes with their heads (for the OwnerControl block),
// and the policy documents each unit publishes.
//   npx tsx scripts/dev-probes/cr08-processes-db.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { rawClient } = await import("../../src/server/db/client");
  const roles = await rawClient.execute("select name_en, portals_json from roles order by name_en");
  console.log("== roles and portals");
  for (const r of roles.rows) {
    const portals = String(r.portals_json ?? "");
    console.log(`  ${r.name_en}: processes=${portals.includes('"processes"')} operating_model=${portals.includes('"operating_model"')}`);
  }
  const users = await rawClient.execute(
    "select u.email, r.name_en role, o.code unit from users u join roles r on r.id = u.role_id left join org_units o on o.id = u.department_id where u.email like '%@enviroai.demo' and u.deleted_at is null order by u.email"
  );
  console.log("== seeded accounts");
  for (const u of users.rows) console.log(`  ${u.email}: ${u.role} unit=${u.unit ?? "-"}`);

  console.log("== owner units of processes with heads");
  const units = await rawClient.execute(
    "select o.code, o.name_en, o.head_user_id, o.head_name_en, u.name_en head_account, u.avatar_color, (select count(*) from processes p where p.owner_unit_id = o.id) owned from org_units o left join users u on u.id = o.head_user_id where o.id in (select owner_unit_id from processes) order by o.sort"
  );
  for (const u of units.rows) console.log(`  ${u.code} ${u.name_en}: owned=${u.owned} head_account=${u.head_account ?? "-"} (${u.avatar_color ?? "-"}) published_head=${u.head_name_en ?? "-"}`);

  console.log("== unit heads through org_unit_members");
  const members = await rawClient.execute(
    "select o.code, u.email from org_unit_members m join org_units o on o.id = m.unit_id join users u on u.id = m.user_id where m.role_in_unit = 'head' order by o.code"
  );
  for (const m of members.rows) console.log(`  ${m.code}: ${m.email}`);

  console.log("== policy documents by unit (document_unit_links)");
  const docs = await rawClient.execute(
    "select o.code, d.title_en, d.visibility_scope, d.status, t.code term from document_unit_links l join org_units o on o.id = l.unit_id join documents d on d.id = l.document_id left join taxonomy_terms t on t.id = d.knowledge_type_term_id order by o.code"
  );
  for (const d of docs.rows) console.log(`  ${d.code}: [${d.term}] ${d.title_en} (${d.visibility_scope}, ${d.status})`);

  console.log("== processes");
  const procs = await rawClient.execute("select code, level, name_en, status, is_illustrative from processes order by sort");
  console.log(`  ${procs.rows.length} rows: ${procs.rows.map((p) => p.code).join(" ")}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
