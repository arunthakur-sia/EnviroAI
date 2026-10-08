import fs from "node:fs";
import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/enviroai/data/nexus.db" });
const q = async (sql) => (await db.execute(sql)).rows;

const stray = await q(`select count(*) c from strategy_nodes n
  where n.edition_id=(select id from strategy_editions where code='nes3')
    and n.node_type='initiative'
    and n.parent_id not in (select id from strategy_nodes where node_type in ('target','outcome'))`);
console.log("stray initiatives:", stray[0].c);
const cats = await q("select category, count(*) c from lessons group by category");
console.log("lesson categories:", cats.map((r) => `${r.category}:${r.c}`).join(" "));
const eps = await q("select audio_provider, count(*) c from podcast_episodes group by audio_provider");
console.log("episodes:", eps.map((r) => `${r.audio_provider}:${r.c}`).join(" "));
const studio = await q("select audio_path from podcast_episodes where audio_provider='elevenlabs'");
for (const s of studio) {
  const p = `C:/enviroai/data/${s.audio_path}`;
  console.log(" ", s.audio_path, fs.existsSync(p) ? `${fs.statSync(p).size} bytes` : "MISSING");
}
const rules = await q("select event_type, points from game_rules where event_type in ('knowledge_by_voice','podcast_created','podcast_listened_full','report_extracted')");
console.log("cr02 rules:", rules.map((r) => `${r.event_type}=${r.points}`).join(" "));
const idx = await q("select count(*) c from search_index where resource_type='podcast_episode'");
console.log("indexed episodes:", idx[0].c);
const delType = await q("select count(*) c from documents d join taxonomy_terms t on t.id=d.knowledge_type_term_id where t.code='deliverable'");
console.log("deliverable docs:", delType[0].c);
const voices = await q("select value_json from settings where key='podcast_voices'");
console.log("voices stored:", voices.length ? "yes" : "no");
db.close();
