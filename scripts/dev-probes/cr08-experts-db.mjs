// CR08 3 / 2.2 probe: what the experts and studies work starts from.
//   node scripts/dev-probes/cr08-experts-db.mjs
import { createClient } from "@libsql/client";
const db = createClient({ url: "file:" + process.cwd().replace(/\\/g, "/") + "/data/nexus.db" });
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;

const kt = (await q("select id from taxonomy_dimensions where code = 'knowledge_type'"))[0];
console.log("knowledge_type terms:");
for (const t of await q("select code, name_en, name_ar, sort from taxonomy_terms where dimension_id = ? order by sort", [kt.id]))
  console.log(`  ${String(t.code).padEnd(20)} ${t.name_en} / ${t.name_ar}`);

console.log("\nexperts by type:");
for (const r of await q("select type, count(*) c, sum(user_id is not null) withUser from experts group by type")) console.log("  ", r);

console.log("\nexperts columns:", (await q("pragma table_info(experts)")).map((c) => c.name).join(", "));

console.log("\ninternal experts whose user has no department:", (await q(
  "select count(*) c from experts e join users u on u.id = e.user_id where u.department_id is null"
))[0].c);
console.log("internal experts whose user department is not a department-level unit:");
for (const r of await q(
  "select o.level, count(*) c from experts e join users u on u.id = e.user_id join org_units o on o.id = u.department_id group by o.level"
)) console.log("  ", r);

console.log("\norg_units by level:");
for (const r of await q("select level, count(*) c from org_units group by level")) console.log("  ", r);
console.log("sample units:");
for (const r of await q("select code, name_en, level, parent_id, sort from org_units order by sort limit 12")) console.log("  ", r);

console.log("\nstudy-like documents:");
for (const r of await q(
  "select t.code, count(*) c, sum(d.status = 'verified') verified from documents d join taxonomy_terms t on t.id = d.knowledge_type_term_id where d.deleted_at is null and t.code in ('study','research','evaluation') group by t.code"
)) console.log("  ", r);

console.log("\nstakeholder rows by person_kind:");
for (const r of await q("select person_kind, count(*) c from node_stakeholders group by person_kind")) console.log("  ", r);
console.log("stakeholder rows with expert_id set:", (await q("select count(*) c from node_stakeholders where expert_id is not null"))[0].c);
console.log("stakeholder rows with user_id set:", (await q("select count(*) c from node_stakeholders where user_id is not null"))[0].c);

console.log("\nengagements:", (await q("select count(*) c, count(distinct expert_id) experts from expert_engagements"))[0]);
console.log("expert_requests:", (await q("select count(*) c from expert_requests"))[0]);
console.log("game_rules types:", (await q("select event_type from game_rules")).map((r) => r.event_type).join(", "));

console.log("\ndimensions:", (await q("select code from taxonomy_dimensions")).map((r) => r.code).join(", "));
console.log("outcome terms:", (await q("select t.code, t.name_en from taxonomy_terms t join taxonomy_dimensions d on d.id = t.dimension_id where d.code = 'outcome' order by t.sort")).map((r) => `${r.code}`).join(", "));
console.log("topic terms:", (await q("select t.code from taxonomy_terms t join taxonomy_dimensions d on d.id = t.dimension_id where d.code = 'topic' order by t.sort")).map((r) => r.code).join(", "));
console.log("sector terms:", (await q("select t.code from taxonomy_terms t join taxonomy_dimensions d on d.id = t.dimension_id where d.code = 'sector' order by t.sort")).map((r) => r.code).join(", "));
console.log("external nationalities:", (await q("select nationality, count(*) c from experts where user_id is null group by nationality")));
console.log("external organisations:", (await q("select organisation_en from experts where user_id is null")).map((r) => r.organisation_en).join(" | "));

console.log("\nsearch_index rows for experts:", (await q("select count(*) c, sum(embedding is not null) embedded from search_index where resource_type = 'expert'"))[0]);
console.log("search_index rows for documents:", (await q("select count(*) c from search_index where resource_type = 'document'"))[0]);
console.log("users prefs sample:", (await q("select prefs_json from users where prefs_json is not null limit 2")).map((r) => r.prefs_json));
console.log("documents publish years for studies:", (await q(
  "select d.publish_year y, count(*) c from documents d join taxonomy_terms t on t.id = d.knowledge_type_term_id where t.code in ('study','research','evaluation') group by d.publish_year order by y"
)));
