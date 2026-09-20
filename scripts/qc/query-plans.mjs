/* eslint-disable no-console */
// CR08 Phase B: EXPLAIN QUERY PLAN over the queries the product runs most,
// so a full scan of a large table is a finding and not a surprise. Writes
// docs/qc/query-plans.md.
//   node scripts/qc/query-plans.mjs
import { createClient } from "@libsql/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });

/** Tables big enough that a full scan matters. */
const BIG = new Set([
  "documents",
  "document_chunks",
  "search_index",
  "index_observations",
  "indicator_values",
  "council_indicator_values",
  "game_events",
  "audit_log",
  "notifications",
  "strategy_nodes",
  "lessons",
  "messages",
  "handover_items",
  "leaderboard_periods",
  "report_sections",
]);

const QUERIES = [
  ["documents: the library listing", "select id, title_en from documents where deleted_at is null and classification_level <= 2 order by created_at desc limit 120"],
  ["documents: by knowledge type (studies)", "select id from documents where knowledge_type_term_id = 'x' and deleted_at is null order by created_at desc limit 40"],
  ["document chunks of one document", "select id from document_chunks where document_id = 'x' order by chunk_index"],
  ["search index by resource", "select id from search_index where resource_type = 'document' and resource_id = 'x'"],
  ["index observations of one index", "select year, score from index_observations where index_id = 'x' order by year"],
  ["index observations for a year", "select index_id, score from index_observations where year = 2025"],
  ["indicator values of one indicator", "select period, value from indicator_values where indicator_id = 'x' order by period"],
  ["council values in a period", "select actual_value from council_indicator_values where period = '2026-Q3'"],
  ["game events of one person", "select points from game_events where user_id = 'x' and created_at >= '2026-09-01'"],
  ["leaderboard rows for a board", "select subject_id, points from leaderboard_periods where board = 'people' and category = 'overall' and period_kind = 'month' and period_key = '2026-09' order by rank limit 10"],
  ["notifications: unread badge", "select count(*) from notifications where user_id = 'x' and read_at is null"],
  ["inbox: unread threads", "select t.id from thread_participants p join message_threads t on t.id = p.thread_id where p.user_id = 'x' and t.status = 'open'"],
  ["messages of one thread", "select body from messages where thread_id = 'x' order by created_at"],
  ["strategy nodes of an edition", "select id, code from strategy_nodes where edition_id = 'x' and node_type = 'project'"],
  ["lessons by status", "select id from lessons where status = 'verified' order by created_at desc limit 40"],
  ["lesson links of a node", "select lesson_id from lesson_node_links where node_id = 'x'"],
  ["handover items of one handover", "select id from handover_items where handover_id = 'x'"],
  ["report sections of one report", "select section_code from report_sections where report_id = 'x' order by sort"],
  ["reports by status", "select id from reports where status = 'published' order by created_at desc limit 20"],
  ["processes by parent", "select id, code from processes where parent_id = 'x' order by sort"],
  ["raci of one process", "select unit_id, role from process_raci where process_id = 'x'"],
  ["interfaces of one unit", "select id from unit_interfaces where from_unit_id = 'x' or to_unit_id = 'x'"],
  ["calendar of a year", "select id from calendar_events where date_from >= '2026-01-01' and date_from <= '2026-12-31'"],
  ["knowledge of the week: active", "select id from knowledge_of_week where status = 'active'"],
  ["kow reads of one pick", "select user_id from knowledge_of_week_reads where kow_id = 'x'"],
  ["org units by parent", "select id, code from org_units where parent_id = 'x'"],
  ["people of one unit", "select id from users where department_id = 'x' and deleted_at is null"],
  ["node stakeholders of a node", "select user_id from node_stakeholders where node_id = 'x'"],
  ["audit trail of one resource", "select id from audit_log where resource_type = 'document' and resource_id = 'x' order by created_at desc limit 20"],
  ["jobs the worker claims", "select id from jobs where status = 'queued' and (run_after is null or run_after <= '2026-09-20') order by created_at limit 1"],
];

const rows = [];
let findings = 0;
for (const [name, sql] of QUERIES) {
  let plan = [];
  try {
    const res = await db.execute(`EXPLAIN QUERY PLAN ${sql}`);
    plan = res.rows.map((r) => String(r.detail));
  } catch (e) {
    plan = [`(failed: ${String(e).slice(0, 80)})`];
  }
  // "SCAN t USING INDEX i" walks an index in order (what a latest-N query
  // wants); only a bare SCAN reads every row of the table.
  const scans = plan
    .filter((p) => /^SCAN (\w+)$/.test(p.trim()))
    .map((p) => /^SCAN (\w+)$/.exec(p.trim())?.[1] ?? "");
  const bad = scans.filter((t) => BIG.has(t));
  if (bad.length) findings++;
  rows.push({ name, sql, plan, bad });
}

const md = [
  "# Query plans (generated)",
  "",
  `Generated ${new Date().toISOString()} by \`node scripts/qc/query-plans.mjs\` over \`data/nexus.db\`.`,
  "A finding is a full scan of a table large enough for it to matter; a scan of a small",
  "reference table (levels, roles, taxonomy) is cheaper than the index lookup and is not flagged.",
  "",
  `${QUERIES.length} queries checked, ${findings} with a scan of a large table.`,
  "",
  "| query | plan | finding |",
  "| --- | --- | --- |",
  ...rows.map(
    (r) =>
      `| ${r.name} | ${r.plan.join("<br>").replace(/\|/g, "\\|")} | ${r.bad.length ? `**scans ${r.bad.join(", ")}**` : "ok"} |`
  ),
  "",
].join("\n");

mkdirSync(path.join(process.cwd(), "docs", "qc"), { recursive: true });
writeFileSync(path.join(process.cwd(), "docs", "qc", "query-plans.md"), md);
console.log(`${QUERIES.length} queries, ${findings} findings`);
for (const r of rows.filter((x) => x.bad.length)) console.log(`  SCAN ${r.bad.join(", ")}: ${r.name}`);
db.close();
