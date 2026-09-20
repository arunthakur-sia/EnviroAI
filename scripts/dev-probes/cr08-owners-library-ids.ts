/* eslint-disable no-console */
// CR08 9.1 (library surfaces): which seeded rows the owner pass can use.
//   npx tsx scripts/dev-probes/cr08-owners-library-ids.ts
import { rawClient } from "../../src/server/db/client";

async function show(label: string, sql: string) {
  const res = await rawClient.execute(sql);
  console.log(`\n== ${label} (${res.rows.length})`);
  for (const r of res.rows.slice(0, 5)) console.log("  ", JSON.stringify(r));
}

async function main() {
  await show(
    "documents with a live owner",
    "select d.id, d.title_en, d.classification_level, u.email from documents d join users u on u.id = d.owner_user_id where d.deleted_at is null and u.deleted_at is null and d.classification_level <= 2 order by d.updated_at desc limit 5"
  );
  await show(
    "studies with an owner",
    "select d.id, d.title_en from documents d join taxonomy_terms t on t.id = d.knowledge_type_term_id join users u on u.id = d.owner_user_id where t.code in ('study','research','evaluation') and d.deleted_at is null and d.classification_level <= 2 limit 5"
  );
  await show(
    "collections with an owner",
    "select c.id, c.name_en, u.email from collections c join users u on u.id = c.owner_user_id limit 5"
  );
  await show(
    "lessons with an author",
    "select l.id, l.title_en, l.status, u.email from lessons l join users u on u.id = l.author_id where l.status in ('published','verified') and l.classification_level <= 2 limit 5"
  );
  await show(
    "reports with a requester",
    "select r.id, r.title_en, r.status, u.email from reports r join users u on u.id = r.requested_by where r.type_id is not null order by r.created_at desc limit 5"
  );
  await show(
    "questions with a human answer",
    "select q.id, q.title_en, count(a.id) as answers from questions q join answers a on a.question_id = q.id and a.is_ai = 0 and a.author_id is not null where q.classification_level <= 2 group by q.id limit 5"
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
