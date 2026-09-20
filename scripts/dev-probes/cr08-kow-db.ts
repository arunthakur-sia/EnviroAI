/* eslint-disable no-console */
// CR08 8: what the Knowledge of the Week seed can pick from, and what the
// tables hold right now.
//   npx tsx scripts/dev-probes/cr08-kow-db.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { rawClient } = await import("../../src/server/db/client");
  const q = async (sql: string) => (await rawClient.execute(sql)).rows;

  console.log("verified documents with an owner, by knowledge type:");
  console.log(
    await q(
      "select t.code as type, count(*) as n from documents d left join taxonomy_terms t on t.id = d.knowledge_type_term_id join users u on u.id = d.owner_user_id where d.status = 'verified' and d.deleted_at is null and u.department_id is not null group by t.code order by n desc"
    )
  );
  console.log("verified lessons:", await q("select count(*) as n from lessons where status = 'verified'"));
  console.log(
    "module reports approved or published:",
    await q("select id, title_en, status, requested_by from reports where status in ('approved','published') and type_id is not null limit 5")
  );
  console.log("users with a unit:", await q("select email, department_id from users where department_id is not null and deleted_at is null limit 12"));
  console.log("kow rows:", await q("select week_start, resource_type, status, read_count from knowledge_of_week order by week_start"));
  console.log("badge:", await q("select code, family from badges where code = 'knowledge_of_week'"));
  console.log("rules:", await q("select event_type, points from game_rules where event_type like 'kow_%'"));
  console.log("sample verified study/report docs:", await q("select d.id, d.title_en, t.code, d.owner_user_id, d.classification_level from documents d left join taxonomy_terms t on t.id = d.knowledge_type_term_id where d.status = 'verified' and t.code in ('study','report','research','evaluation') and d.owner_user_id is not null limit 6"));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
