/* eslint-disable no-console */
// CR08 9.1 dev probe (second pass): how many indicators carry a department at
// all, which units own them, and whether those units have a head account.
//   npx tsx scripts/dev-probes/cr08-owners-data-db2.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { rawClient } = await import("../../src/server/db/client");
  const q = async (label: string, sql: string) => {
    const res = await rawClient.execute(sql);
    console.log(`== ${label} (${res.rows.length})`);
    for (const r of res.rows.slice(0, 20)) console.log("  ", JSON.stringify(r));
    return res.rows;
  };

  await q("indicators: department fill", "select count(*) total, count(department_id) with_dept from indicators");
  await q(
    "indicator departments",
    `select o.code, o.name_en, o.head_user_id, u.name_en head, count(*) indicators
       from indicators i left join org_units o on o.id = i.department_id left join users u on u.id = o.head_user_id
      group by o.code, o.name_en, o.head_user_id, u.name_en order by indicators desc limit 20`
  );
  await q(
    "units that head accounts run, with any indicator",
    `select o.code, o.name_en, u.name_en head, (select count(*) from indicators i where i.department_id = o.id) inds
       from org_units o join users u on u.id = o.head_user_id where u.deleted_at is null order by inds desc limit 20`
  );
  await q("org_unit_members heads", "select o.code, u.name_en from org_unit_members m join org_units o on o.id = m.unit_id join users u on u.id = m.user_id where m.role_in_unit = 'head' order by o.code limit 20");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
