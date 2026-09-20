/* eslint-disable no-console */
// CR08 9.1 dev probe (third pass): an existing Ask conversation whose messages
// carry citations (for the source-list screenshot), and the units whose panel
// shows both a head account and policy documents.
//   npx tsx scripts/dev-probes/cr08-owners-data-db3.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { rawClient } = await import("../../src/server/db/client");
  const q = async (label: string, sql: string) => {
    const res = await rawClient.execute(sql);
    console.log(`== ${label} (${res.rows.length})`);
    for (const r of res.rows.slice(0, 10)) console.log("  ", JSON.stringify(r).slice(0, 420));
    return res.rows;
  };

  await q("tables that hold citations", "select name from sqlite_master where type = 'table' and name like '%conversation%' or name like '%message%' order by name");
  await q(
    "ai_conversations with cited messages",
    `select c.id, c.title, u.email, count(m.id) msgs
       from ai_conversations c join ai_messages m on m.conversation_id = c.id
       join users u on u.id = c.user_id
      where m.citations_json is not null and m.citations_json != '[]'
      group by c.id, c.title, u.email order by c.updated_at desc limit 10`
  );
  await q(
    "units with a head account and linked policy documents",
    `select o.code, u.name_en head, count(l.document_id) docs
       from org_units o join users u on u.id = o.head_user_id
       join document_unit_links l on l.unit_id = o.id
       join documents d on d.id = l.document_id and d.deleted_at is null
      group by o.code, u.name_en order by docs desc limit 10`
  );
  await q("processes with owner units", "select code, name_en, level, owner_unit_id from processes where level <= 1 order by code limit 14");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
