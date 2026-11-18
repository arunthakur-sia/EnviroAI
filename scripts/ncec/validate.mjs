// Read-only validation of the loaded NCEC tables (docs/ncec/ingestion-plan.md, section 6).
// Mismatches are reported with the offending IDs and are never corrected.
// Usage: node scripts/ncec/validate.mjs --driver sqlite|pg --target <db> [--allow-remote]
// Exit code 1 when any check fails.
import { createRequire } from "node:module";
import crypto from "node:crypto";
import path from "node:path";
import { openDb, parseArgs, num, parseJson } from "./lib/db.mjs";
import { readCsv } from "./lib/csv.mjs";
import { canon, stable } from "./lib/canon.mjs";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const args = parseArgs(process.argv.slice(2));
const DIR = path.resolve("scripts", "seed-content", "ncec");
const WORKBOOK = path.resolve("docs", "ncec", "NCEC_Data_Source_Catalogue_EnviroAI_Mockup.xlsx");
const ws = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

const results = [];
const check = (id, desc, expected, actual, detail = "") => {
  const e = typeof expected === "string" ? expected : stable(expected);
  const a = typeof actual === "string" ? actual : stable(actual);
  results.push({ id, desc, ok: e === a, expected: e, actual: a, detail });
};
const cnt = async (sql, p = []) => num((await db.all(`SELECT CAST(count(*) AS integer) AS n FROM (${sql}) q`, p))[0].n);
const rows = (sql, p) => db.all(sql, p);

const db = await openDb(args);
console.log(`target: ${db.label}`);
try {
  // ---- V-01 .. V-07 -----------------------------------------------------------
  check("V-01", "datasets (total, core, corporate)", [131, 58, 73], [
    await cnt("SELECT 1 FROM ncec_datasets"),
    await cnt("SELECT 1 FROM ncec_datasets WHERE domain = 'core_environmental'"),
    await cnt("SELECT 1 FROM ncec_datasets WHERE domain = 'corporate_support'"),
  ]);
  const reg = (await rows("SELECT asset_id, field_kind, effective_layer, register_classification, personal_data FROM ncec_fields WHERE asset_id LIKE 'DMO-%' ORDER BY asset_id"));
  const expectIds = Array.from({ length: 893 }, (_, i) => `DMO-${String(i + 1).padStart(3, "0")}`);
  check("V-02", "register rows are DMO-001..DMO-893, no gaps", [893, 0], [reg.length, expectIds.filter((id, i) => reg[i]?.asset_id !== id).length]);
  const by = (k, f = (r) => r) => reg.reduce((m, r) => ((m[f(r[k])] = (m[f(r[k])] || 0) + 1), m), {});
  const kinds = by("field_kind");
  check("V-03", "register rows by kind (field, group_label, dataset_placeholder)", [810, 8, 75], [kinds.field || 0, kinds.group_label || 0, kinds.dataset_placeholder || 0]);
  check("V-03b", "mockup helpers outside the register", 20, await cnt("SELECT 1 FROM ncec_fields WHERE field_kind = 'mockup_helper'"));
  const lay = by("effective_layer", num);
  check("V-04", "effective layer L1, L2, L3", [174, 283, 436], [lay[1] || 0, lay[2] || 0, lay[3] || 0]);
  const unc = reg.filter((r) => r.register_classification === null);
  check("V-05", "unclassified count, all at L3", [335, 335], [unc.length, unc.filter((r) => num(r.effective_layer) === 3).length]);
  const cls = by("register_classification");
  check("V-06", "register classes (public, restricted, secret, top_secret)", [175, 282, 35, 66], [cls.public || 0, cls.restricted || 0, cls.secret || 0, cls.top_secret || 0]);
  const pd = reg.filter((r) => r.personal_data !== "none");
  check("V-07", "personal data fields (total, personal, sensitive, at L2, at L3)", [25, 23, 2, 15, 10], [
    pd.length, pd.filter((r) => r.personal_data === "personal").length, pd.filter((r) => r.personal_data === "sensitive").length,
    pd.filter((r) => num(r.effective_layer) === 2).length, pd.filter((r) => num(r.effective_layer) === 3).length,
  ]);

  // ---- V-08 rule equals workbook -------------------------------------------
  const csvFields = readCsv(path.join(DIR, "fields.csv"));
  const dbLayer = new Map((await rows("SELECT asset_id, effective_layer FROM ncec_fields")).map((r) => [r.asset_id, num(r.effective_layer)]));
  const diff = csvFields.filter((f) => dbLayer.get(f.asset_id) !== Number(f.workbook_effective_layer)).map((f) => f.asset_id);
  check("V-08", "database effective_layer equals workbook layer (mismatching IDs)", [], diff);

  // ---- V-09 per dataset vs Dataset Catalogue -------------------------------
  const wb = XLSX.readFile(WORKBOOK);
  const cat = XLSX.utils.sheet_to_json(wb.Sheets["Dataset Catalogue"], { header: 1, defval: "" }).filter((r) => /^DS-/.test(ws(r[0])));
  const perDs = new Map((await rows(
    `SELECT dataset_id, CAST(count(*) AS integer) AS f,
            CAST(sum(CASE WHEN effective_layer = 1 THEN 1 ELSE 0 END) AS integer) AS l1,
            CAST(sum(CASE WHEN effective_layer = 2 THEN 1 ELSE 0 END) AS integer) AS l2,
            CAST(sum(CASE WHEN effective_layer = 3 THEN 1 ELSE 0 END) AS integer) AS l3,
            CAST(sum(CASE WHEN register_classification IS NULL THEN 1 ELSE 0 END) AS integer) AS u
       FROM ncec_fields WHERE asset_id LIKE 'DMO-%' GROUP BY dataset_id`)).map((r) => [r.dataset_id, [num(r.f), num(r.l1), num(r.l2), num(r.l3), num(r.u)]]));
  const bad9 = cat.filter((c) => JSON.stringify(perDs.get(ws(c[0]))) !== JSON.stringify([c[9], c[10], c[11], c[12], c[13]].map(Number))).map((c) => ws(c[0]));
  check("V-09", "per dataset fields/L1/L2/L3/unclassified equal the Dataset Catalogue (mismatching datasets)", [131, []], [cat.length, bad9]);

  // ---- V-10 per executive department vs the brief's appendix -------------------
  const APPX = {
    "Licensing & Compliance Operations": [31, 387, 133, 158, 96, 16], "Monitoring Operations": [7, 101, 14, 87, 0, 0],
    "Environmental Performance": [6, 44, 0, 0, 44, 44], "Environmental Emergencies": [3, 45, 0, 0, 45, 45],
    "Regional Operations": [6, 105, 0, 0, 105, 105], "Legal Affairs": [3, 70, 0, 0, 70, 70],
    "Environmental Research & Studies": [2, 51, 0, 0, 51, 51], "Center Affairs": [53, 70, 19, 31, 20, 4],
    "CEO Office": [6, 6, 4, 0, 2, 0], "Internal Audit": [10, 10, 3, 4, 3, 0], "Project Management Office": [4, 4, 1, 3, 0, 0],
  };
  const dept = await rows(
    `SELECT d.name_en AS name, CAST(count(DISTINCT s.dataset_id) AS integer) AS ds, CAST(count(*) AS integer) AS f,
            CAST(sum(CASE WHEN f.effective_layer = 1 THEN 1 ELSE 0 END) AS integer) AS l1,
            CAST(sum(CASE WHEN f.effective_layer = 2 THEN 1 ELSE 0 END) AS integer) AS l2,
            CAST(sum(CASE WHEN f.effective_layer = 3 THEN 1 ELSE 0 END) AS integer) AS l3,
            CAST(sum(CASE WHEN f.register_classification IS NULL THEN 1 ELSE 0 END) AS integer) AS u
       FROM ncec_fields f JOIN ncec_datasets s ON s.dataset_id = f.dataset_id JOIN ncec_departments d ON d.dept_id = s.exec_dept_id
      WHERE f.asset_id LIKE 'DMO-%' GROUP BY d.name_en`);
  const got10 = Object.fromEntries(dept.map((r) => [r.name, [r.ds, r.f, r.l1, r.l2, r.l3, r.u].map(num)]));
  check("V-10", "per executive department (datasets, fields, L1, L2, L3, unclassified) equal the brief's appendix", APPX, got10);

  // ---- V-11 departments --------------------------------------------------------
  check("V-11", "departments (units, executive owners, general departments, datasets with no general dept)", [32, 11, 22, 9], [
    await cnt("SELECT 1 FROM ncec_departments"),
    await cnt("SELECT DISTINCT exec_dept_id FROM ncec_datasets"),
    await cnt("SELECT DISTINCT general_dept_id FROM ncec_datasets WHERE general_dept_id IS NOT NULL"),
    await cnt("SELECT 1 FROM ncec_datasets WHERE general_dept_id IS NULL"),
  ]);

  // ---- V-12 referential integrity ------------------------------------------------
  const orph = {
    fields_dataset: await cnt("SELECT 1 FROM ncec_fields f LEFT JOIN ncec_datasets d ON d.dataset_id = f.dataset_id WHERE d.dataset_id IS NULL"),
    fields_class: await cnt("SELECT 1 FROM ncec_fields f LEFT JOIN ncec_classifications c ON c.code = f.register_classification WHERE f.register_classification IS NOT NULL AND c.code IS NULL"),
    datasets_dept: await cnt("SELECT 1 FROM ncec_datasets d LEFT JOIN ncec_departments x ON x.dept_id = d.exec_dept_id WHERE x.dept_id IS NULL"),
    datasets_gen: await cnt("SELECT 1 FROM ncec_datasets d LEFT JOIN ncec_departments x ON x.dept_id = d.general_dept_id WHERE d.general_dept_id IS NOT NULL AND x.dept_id IS NULL"),
    parents: await cnt("SELECT 1 FROM ncec_departments d LEFT JOIN ncec_departments p ON p.dept_id = d.parent_dept_id WHERE d.parent_dept_id IS NOT NULL AND p.dept_id IS NULL"),
    records_dataset: await cnt("SELECT 1 FROM ncec_records r LEFT JOIN ncec_datasets d ON d.dataset_id = r.dataset_id WHERE d.dataset_id IS NULL"),
  };
  const fieldRows = await rows("SELECT asset_id, dataset_id, field_kind, name_en, personal_data FROM ncec_fields");
  const okKeys = new Map();
  for (const f of fieldRows) if (["field", "mockup_helper"].includes(f.field_kind)) (okKeys.get(f.dataset_id) || okKeys.set(f.dataset_id, new Set()).get(f.dataset_id)).add(f.asset_id);
  const recs = (await rows("SELECT record_id, dataset_id, field_values, is_dummy, data_status FROM ncec_records ORDER BY record_id")).map((r) => ({ ...r, values: parseJson(r.field_values) }));
  const badKeys = recs.flatMap((r) => Object.keys(r.values).filter((k) => !okKeys.get(r.dataset_id)?.has(k)).map((k) => `${r.record_id}:${k}`));
  check("V-12", "orphans per relation and invalid record keys (all zero)", [Object.fromEntries(Object.keys(orph).map((k) => [k, 0])), []], [orph, badKeys]);

  // ---- V-13, V-14 dummy rows ----------------------------------------------------------
  const perRec = {};
  for (const r of recs) perRec[r.dataset_id] = (perRec[r.dataset_id] || 0) + 1;
  check("V-13", "dummy rows per dataset and total", { "DS-001": 45, "DS-015": 60, "DS-016": 45, "DS-018": 30, "DS-022": 72, "DS-027": 20, "DS-035": 25, "DS-038": 40, "DS-047": 30, "DS-056": 88, "DS-117": 74, "DS-118": 60, "DS-120": 270, total: 859 },
    { ...Object.fromEntries(Object.entries(perRec).sort()), total: recs.length });
  const notDummy = recs.filter((r) => canon(r.is_dummy, "bool") !== "1" || r.data_status !== "DUMMY" || !r.record_id.startsWith("DUM-")).map((r) => r.record_id);
  check("V-14", "records not flagged is_dummy / DUMMY / DUM- (none)", [859, []], [recs.length - notDummy.length, notDummy]);

  // ---- V-15 personal data values -------------------------------------------------------
  const pdIds = new Set(fieldRows.filter((f) => f.personal_data !== "none").map((f) => f.asset_id));
  const badPd = [];
  let pdCells = 0;
  for (const r of recs) for (const [k, v] of Object.entries(r.values)) if (pdIds.has(k)) { pdCells++; if (/\d{6,}/.test(String(v)) || !/masked|تجريبي/.test(String(v))) badPd.push(`${r.record_id}:${k}`); }
  check("V-15", "personal data cells (count, unmasked)", [165, []], [pdCells, badPd], "DS-038: 3 personal fields x 40 rows, DS-016 reporter contact x 45 rows");

  // ---- V-16 facilities ------------------------------------------------------------------
  const isId = (f) => /^Facility ID/.test(f.name_en || ""), isName = (f) => f.name_en === "Facility name", isCr = (f) => /^Commercial registration/.test(f.name_en || "");
  const idSet = new Set(), name = new Map(), cr = new Map(), conflicts = [];
  for (const r of recs) {
    const fs_ = fieldRows.filter((f) => f.dataset_id === r.dataset_id);
    const get = (pred) => { const f = fs_.find(pred); return f ? r.values[f.asset_id] : undefined; };
    const id = get(isId); if (!id) continue;
    idSet.add(id);
    for (const [m, v] of [[name, get(isName)], [cr, get(isCr)]]) if (v !== undefined) { if (m.has(id) && m.get(id) !== v) conflicts.push(`${id}`); m.set(id, v); }
  }
  check("V-16", "distinct facilities and ID/name/CR conflicts", [60, []], [idSet.size, conflicts]);

  // ---- V-17 R1 example -------------------------------------------------------------------
  const fn = await rows("SELECT dataset_id, effective_layer FROM ncec_fields WHERE name_en = 'Facility name' AND dataset_id IN ('DS-001','DS-016','DS-018') ORDER BY dataset_id");
  check("V-17", "R1: Facility name layer in DS-001, DS-016, DS-018", { "DS-001": 2, "DS-016": 3, "DS-018": 3 }, Object.fromEntries(fn.map((r) => [r.dataset_id, num(r.effective_layer)])));

  // ---- V-19 fingerprint, to compare SQLite and Postgres -------------------------------------
  const FP = {
    ncec_classifications: [["code", "text"], ["name_ar", "text"], ["name_en", "text"], ["layer", "int"]],
    ncec_departments: [["dept_id", "text"], ["name_ar", "text"], ["name_en", "text"], ["name_en_status", "text"], ["unit_type", "text"], ["parent_dept_id", "text"]],
    ncec_datasets: [["dataset_id", "text"], ["register_order", "int"], ["name_ar", "text"], ["name_en", "text"], ["name_en_status", "text"], ["domain", "text"], ["exec_dept_id", "text"], ["general_dept_id", "text"]],
    ncec_fields: [["asset_id", "text"], ["dataset_id", "text"], ["ordinal", "int"], ["register_row", "int"], ["field_kind", "text"], ["name_ar", "text"], ["name_en", "text"], ["register_classification", "text"], ["personal_data", "text"], ["effective_layer", "int"], ["last_update_date", "date"], ["next_update_date", "date"], ["notes_ar", "text"]],
    ncec_records: [["record_id", "text"], ["dataset_id", "text"], ["field_values", "json"], ["is_dummy", "bool"], ["data_status", "text"]],
  };
  const fp = {};
  for (const [t, cols] of Object.entries(FP)) {
    const sel = cols.map(([c, ty]) => (ty === "date" ? `CAST(${c} AS text) AS ${c}` : c)).join(", ");
    const pk = cols[0][0];
    const data = await rows(`SELECT ${sel} FROM ${t} ORDER BY ${pk}`);
    fp[t] = crypto.createHash("sha256").update(data.map((r) => cols.map(([c, ty]) => canon(r[c], ty)).join("\u001f")).join("\n")).digest("hex").slice(0, 16);
  }

  // ---- report ----------------------------------------------------------------------------------
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(6)} ${r.desc}`);
    if (!r.ok) console.log(`        expected ${r.expected}\n        actual   ${r.actual}`);
  }
  console.log("V-19 fingerprints (compare between sqlite and pg runs):");
  for (const [t, h] of Object.entries(fp)) console.log(`  ${t.padEnd(22)} ${h}`);
  console.log(`${results.length - failed}/${results.length} checks passed`);
  if (failed) process.exitCode = 1;
} catch (e) {
  console.error("VALIDATION ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
