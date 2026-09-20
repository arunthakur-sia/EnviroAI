/* eslint-disable no-console */
// CR08 9.1 dev probe: what the data, organisation and answer surfaces can show
// a person for. Units with a head account, policy documents with a custodian,
// indicators whose department has a head, indices linked to a Statistics Hub
// series, documents/nodes/lessons for the search and citation rows.
//   npx tsx scripts/dev-probes/cr08-owners-data-db.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { rawClient } = await import("../../src/server/db/client");
  const q = async (label: string, sql: string) => {
    const res = await rawClient.execute(sql);
    console.log(`== ${label} (${res.rows.length})`);
    for (const r of res.rows.slice(0, 12)) console.log("  ", JSON.stringify(r));
    return res.rows;
  };

  await q(
    "units with a head account",
    "select o.code, o.name_en, u.name_en head, u.email from org_units o join users u on u.id = o.head_user_id where u.deleted_at is null order by o.sort limit 12"
  );
  await q(
    "policy documents linked to a unit, with a custodian",
    `select d.id, d.title_en, o.code unit, u.name_en custodian
       from document_unit_links l
       join documents d on d.id = l.document_id
       join org_units o on o.id = l.unit_id
       left join users u on u.id = d.owner_user_id
      where d.deleted_at is null
      order by u.name_en is null, d.updated_at desc limit 12`
  );
  await q(
    "indicators whose department has a head with an account",
    `select i.id, i.code, i.name_en, o.code unit, u.name_en head
       from indicators i
       join org_units o on o.id = i.department_id
       join users u on u.id = o.head_user_id
      where u.deleted_at is null and i.classification_level <= 2
      order by i.code limit 12`
  );
  await q(
    "indices linked to a Statistics Hub series",
    `select x.code, x.name_en, i.id indicator_id, i.name_en indicator, o.code unit, u.name_en head
       from indices x
       join indicators i on i.id = x.linked_statistics_indicator_id
       left join org_units o on o.id = i.department_id
       left join users u on u.id = o.head_user_id
      order by x.code limit 12`
  );
  await q(
    "documents with a custodian (search rows)",
    "select id, title_en, owner_user_id from documents where deleted_at is null and owner_user_id is not null limit 8"
  );
  await q(
    "strategy nodes with an owner",
    "select id, code, node_type, title_en from strategy_nodes where owner_user_id is not null limit 8"
  );
  await q("lessons with an author", "select id, title_en, author_id from lessons where author_id is not null limit 8");
  await q(
    "search-friendly terms: documents and lessons sharing a word",
    "select 'document' kind, id, title_en from documents where deleted_at is null and lower(title_en) like '%data%' union all select 'lesson', id, title_en from lessons where lower(title_en) like '%data%' limit 12"
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
