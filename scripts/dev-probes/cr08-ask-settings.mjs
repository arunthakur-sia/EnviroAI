/* eslint-disable no-console */
// CR08 2.3 probe: is the analyst live or mocked, and which seeded items can
// the Ask panel test page attach as context? Read only.
import { createClient } from "@libsql/client";

const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
const ai = await db.execute("select value_json from settings where key = 'ai' limit 1");
const raw = ai.rows[0] ? String(ai.rows[0].value_json) : "{}";
let mockMode = null;
try {
  mockMode = JSON.parse(raw).mockMode ?? null;
} catch {
  mockMode = "unparsable";
}
console.log("ai.mockMode:", mockMode, "| key present:", Boolean(process.env.ANTHROPIC_API_KEY));

const project = await db.execute(
  "select id, code, title_en from strategy_nodes where node_type = 'project' and code is not null order by code limit 1"
);
const doc = await db.execute("select id, title_en from documents order by created_at desc limit 1");
const conv = await db.execute("select count(*) as c from ai_conversations");
console.log("project:", project.rows[0]);
console.log("document:", doc.rows[0]);
console.log("conversations:", conv.rows[0]);
db.close();
