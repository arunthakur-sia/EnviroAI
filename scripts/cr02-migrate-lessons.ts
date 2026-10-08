/* eslint-disable no-console */
// CR02 3.1: assign categories to existing lessons. The CR rule: linked to a
// node -> delivery; otherwise -> institutional. Idempotent by nature (it only
// rewrites the same values), safe to run repeatedly.
import { DATA_DIR } from "./lib/paths.mjs";
import { createClient } from "@libsql/client";
import path from "node:path";

const dbPath = path.join(DATA_DIR, "nexus.db").replace(/\\/g, "/");

export async function migrateLessonCategoriesCr02() {
  const db = createClient({ url: `file:${dbPath}` });
  const delivery = await db.execute(
    "update lessons set category='delivery' where node_id is not null and node_id != ''"
  );
  const institutional = await db.execute(
    "update lessons set category='institutional' where node_id is null or node_id = ''"
  );
  // Seed refinement (CR02 8, "update seeds: lesson categories"): unlinked
  // lessons whose text clearly names an external event or a person's tacit
  // knowledge move to external/expert so all four categories exist in the demo.
  const external = await db.execute(
    `update lessons set category='external'
     where (node_id is null or node_id='')
       and (title_en || ' ' || coalesce(context_en,'') like '%conference%'
         or title_en || ' ' || coalesce(context_en,'') like '%forum%'
         or title_en || ' ' || coalesce(context_en,'') like '%study visit%'
         or title_en || ' ' || coalesce(context_en,'') like '%benchmark%'
         or title_ar || ' ' || coalesce(context_ar,'') like '%مؤتمر%'
         or title_ar || ' ' || coalesce(context_ar,'') like '%منتدى%')`
  );
  const expert = await db.execute(
    `update lessons set category='expert'
     where (node_id is null or node_id='')
       and category='institutional'
       and (title_en || ' ' || coalesce(context_en,'') like '%interview%'
         or title_en || ' ' || coalesce(context_en,'') like '%handover%'
         or title_en || ' ' || coalesce(context_en,'') like '%expert%'
         or title_ar || ' ' || coalesce(context_ar,'') like '%مقابلة%'
         or title_ar || ' ' || coalesce(context_ar,'') like '%خبير%')`
  );
  console.log(
    `lesson categories: ${delivery.rowsAffected} delivery, ${institutional.rowsAffected} institutional, then ${external.rowsAffected} external, ${expert.rowsAffected} expert`
  );
  db.close();
  return {
    delivery: delivery.rowsAffected,
    institutional: institutional.rowsAffected,
    external: external.rowsAffected,
    expert: expert.rowsAffected,
  };
}

const isMain = process.argv[1] && /cr02-migrate-lessons\.(ts|js|mjs)$/.test(process.argv[1]);
if (isMain) {
  migrateLessonCategoriesCr02().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
