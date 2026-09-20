// What did the smoke suite and the e2e suite leave in the demo database?
import { createClient } from "@libsql/client";
const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;
const show = async (label, sql, args = []) => {
  try {
    const rows = await q(sql, args);
    console.log(`${label}: ${rows.length}`);
    for (const r of rows.slice(0, 8)) console.log(`   ${Object.values(r).map((v) => String(v).slice(0, 60)).join(" | ")}`);
  } catch (e) {
    console.log(`${label}: (${String(e.message).slice(0, 60)})`);
  }
};

await show("org units named for a test", "select code, name_en from org_units where code like 'SMK%' or code like 'QCE%' or name_en like '%Smoke%' or name_en like '%QC E2E%'");
await show("org snapshots", "select note from org_snapshots order by taken_at");
await show("index groups from a test", "select code, name_en from index_groups where code like 'smoke%' or code like '%test%'");
await show("indices from a test", "select code, name_en from indices where code like 'sm%test%' or code like 'smoke%'");
await show("podcast episodes from a test", "select title_en from podcast_episodes where title_en like '%smoke%' or title_en like '%test%'");
await show("reports from a test", "select title_en, status from reports where title_en like '%smoke%' or title_en like '%QC%' or title_en like '%test%'");
await show("message threads from a test", "select subject from message_threads where subject like '%qc-e2e%' or subject like '%smoke%'");
await show("documents from a test", "select title_en from documents where title_en like '%smoke%' or title_en like '%qc-e2e%'");
await show("lessons from a test", "select title_en from lessons where title_en like '%smoke%' or title_en like '%qc-e2e%'");
await show("experts from a test", "select name_en from experts where name_en like '%Test%' or name_en like '%Smoke%'");
await show("handovers", "select status, completion_pct from handovers");
await show("signals accepted today", "select count(*) c from signals where triage_status = 'accepted' and date(triaged_at) = date('now')");
await show("game events total", "select count(*) c from game_events");
await show("ai conversations", "select count(*) c from ai_conversations");
db.close();
