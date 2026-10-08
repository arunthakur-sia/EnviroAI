/* eslint-disable no-console */
// CR08 1: quick read of the organisation tables while building the module.
//   npx tsx scripts/dev-probes/cr08-org-db.ts
import { createClient } from "@libsql/client";

async function main() {
  const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
  const q = async (sql: string) => (await db.execute(sql)).rows;
  // the dev server and other agents write to the same file; wait for the lock
  await db.execute("PRAGMA busy_timeout = 8000");
  const reparent = process.argv.indexOf("--reparent");
  if (reparent >= 0) {
    // --reparent CODE PARENT_CODE: puts a unit back where a probe left it
    const [code, parentCode] = process.argv.slice(reparent + 1, reparent + 3);
    const res = await db.execute({
      sql: "update org_units set parent_id = (select id from org_units where code = ?) where code = ?",
      args: [parentCode, code],
    });
    console.log(`reparent: ${res.rowsAffected} row, ${code} under ${parentCode}`);
  }
  if (process.argv.includes("--cleanup")) {
    // what an interrupted probe run may leave behind
    const gone = await db.execute("delete from org_units where code in ('PRB', 'PRB2')");
    const reqs = await db.execute("delete from org_change_requests where what like 'Probe:%'");
    console.log(`cleanup: ${gone.rowsAffected} probe units, ${reqs.rowsAffected} probe requests removed`);
  }
  console.log("org_levels:", await q("select * from org_levels order by sort"));
  console.log("org_snapshots:", await q("select id, taken_at, taken_by, note, length(tree_json) len from org_snapshots"));
  console.log("org_change_requests:", await q("select * from org_change_requests"));
  console.log(
    "levels:",
    await q("select level, count(*) c, sum(is_active) active from org_units group by level")
  );
  console.log(
    "head.stats:",
    await q(
      "select u.id, u.email, u.department_id, o.code, o.name_en, o.head_user_id = u.id as is_head from users u left join org_units o on o.id = u.department_id where u.email = 'head.stats@enviroai.demo'"
    )
  );
  console.log(
    "units headed by users:",
    await q("select code, name_en, head_user_id from org_units where head_user_id is not null")
  );
  console.log("roots:", await q("select code, name_en, level from org_units where parent_id is null"));
  console.log(
    "sectors:",
    await q(
      "select o.code, o.name_en, (select count(*) from org_units c where c.parent_id = o.id) kids from org_units o where o.level = 'sector' order by o.sort"
    )
  );
  console.log("super admins:", await q("select u.email from users u join roles r on r.id = u.role_id where r.name_en = 'Super Admin'"));
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
