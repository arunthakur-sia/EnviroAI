// CR04 final sanity on the fresh DB.
import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;

const eps = await q("select title_en, script_json from podcast_episodes order by created_at limit 2");
for (const e of eps) {
  const hasName =
    String(e.script_json).includes("NPC Knowledge Cast") ||
    String(e.script_json).includes("\u0628\u0648\u062f\u0643\u0627\u0633\u062a \u0627\u0644\u0645\u0639\u0631\u0641\u0629");
  console.log("episode:", e.title_en.slice(0, 50), "| official name in script:", hasName);
}
const clusters = await q("select count(*) c from lesson_clusters");
console.log("themes:", clusters[0].c);
const themeIdx = await q("select count(*) c from search_index where resource_type='lesson_theme'");
console.log("themes indexed:", themeIdx[0].c);
const chapters = await q("select value_json from settings where key='outcome_chapters'");
console.log("chapters:", Object.keys(JSON.parse(chapters[0]?.value_json ?? "{}")).length);
const pillars = await q("select value_json from settings where key='qnv_pillars'");
console.log("pillars:", JSON.parse(pillars[0]?.value_json ?? "[]").length);
const rules = await q(
  "select event_type, points from game_rules where event_type in ('learn_session_completed','reflection_saved','lesson_read_fully')"
);
console.log("cr04 rules:", rules.map((r) => `${r.event_type}=${r.points}`).join(" "));
const sessions = await q("select count(*) c from learn_sessions");
const notes = await q("select count(*) c from notes");
console.log("learn sessions:", sessions[0].c, "| notes:", notes[0].c);
const low = await q("select value_json from settings where key='lesson_of_week'");
console.log("lesson-of-week weeks:", JSON.parse(low[0]?.value_json ?? "{}").schedule?.length ?? 0);
const prompts = await q("select value_json from settings where key='reflection_prompts'");
console.log("reflection prompts:", JSON.parse(prompts[0]?.value_json ?? "[]").length);
db.close();
