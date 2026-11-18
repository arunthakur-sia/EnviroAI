// Builds the cleaned NCEC CSVs from the Arabic register (source of truth) and the
// generated workbook. No database. Usage: node scripts/ncec/build-csv.mjs
// The rules are documented in docs/ncec/ingestion-plan.md, section 2.
import { createRequire } from "node:module";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { writeCsv } from "./lib/csv.mjs";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const ROOT = process.cwd();
const REGISTER = path.join(ROOT, "docs", "ncec", "سجل حصر البيانات - نسخة أولية.xlsx");
const WORKBOOK = path.join(ROOT, "docs", "ncec", "NCEC_Data_Source_Catalogue_EnviroAI_Mockup.xlsx");
const OUT = path.join(ROOT, "scripts", "seed-content", "ncec");
fs.mkdirSync(OUT, { recursive: true });

const log = [];
const logRow = (rule_id, entity, entity_id, column, before, after) =>
  log.push({ rule_id, entity, entity_id, column, before, after });
const fail = (m) => {
  console.error("BUILD FAILED: " + m);
  process.exit(1);
};

// C-01: trim and collapse whitespace, logging every cell that changes.
const ws = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
function clean(v, entity, id, column) {
  const raw = String(v ?? "");
  const c = ws(raw);
  if (raw !== c && raw !== "") logRow("C-01", entity, id, column, raw, c);
  return c;
}
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const sheet = (wb, name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" });
const isoDate = (v) => new Date(Date.UTC(1899, 11, 30) + v * 864e5).toISOString().slice(0, 10);

const regWb = XLSX.readFile(REGISTER);
const genWb = XLSX.readFile(WORKBOOK);

const CLASS = {
  "عام": { code: "public", en: "Public", layer: 1 },
  "مقيد": { code: "restricted", en: "Restricted", layer: 2 },
  "سري": { code: "secret", en: "Secret", layer: 3 },
  "سري للغاية": { code: "top_secret", en: "Top Secret", layer: 3 },
};

// ---- register rows ---------------------------------------------------------
const regRows = sheet(regWb, "سجل أصول البيانات")
  .map((r, i) => ({ r, row: i + 1 }))
  .filter((x) => ws(x.r[0]).startsWith("DMO-"));
if (regRows.length !== 893) fail(`register has ${regRows.length} rows, expected 893`);

// ---- generated workbook ----------------------------------------------------
const genFields = new Map();
for (const r of sheet(genWb, "Field Register")) if (/^DMO-/.test(ws(r[0]))) genFields.set(ws(r[0]), r);
const catalogue = new Map(); // by Arabic dataset name
for (const r of sheet(genWb, "Dataset Catalogue")) if (/^DS-/.test(ws(r[0]))) catalogue.set(ws(r[8]), r);
if (genFields.size !== 893 || catalogue.size !== 131) fail("generated workbook does not have 893 fields and 131 datasets");

// ---- departments -----------------------------------------------------------
const stripEn = (s) => ws(s).replace(/\s*\((General Dept\.|as labelled in register)\)\s*$/i, "");
const deptEn = new Map(); // Arabic -> English (from the catalogue)
for (const c of catalogue.values()) {
  deptEn.set(ws(c[4]), stripEn(c[3]));
  if (!/غير محدد/.test(ws(c[6]))) deptEn.set(ws(c[6]), stripEn(c[5]));
}
const unitOrder = [];
const parentOf = new Map();
const seenUnit = (ar) => {
  if (!unitOrder.includes(ar)) unitOrder.push(ar);
};
for (const { r } of regRows) {
  const ex = ws(r[1]);
  const gd = ws(r[2]);
  seenUnit(ex);
  if (gd) {
    seenUnit(gd);
    if (gd !== ex) {
      if (parentOf.has(gd) && parentOf.get(gd) !== ex) fail(`general department under two executives: ${gd}`);
      parentOf.set(gd, ex);
    }
  }
}
const deptId = new Map(unitOrder.map((ar, i) => [ar, `NCEC-U${String(i + 1).padStart(2, "0")}`]));
const unitType = (ar) =>
  ar.startsWith("الإدارة التنفيذية")
    ? "executive_department"
    : ar.startsWith("الإدارة العامة")
      ? "general_department"
      : "department";
const departments = unitOrder.map((ar) => {
  if (!deptEn.has(ar)) fail(`no English name for department ${ar}`);
  return {
    dept_id: deptId.get(ar),
    name_ar: ar,
    name_en: deptEn.get(ar),
    name_en_status: "working_translation",
    unit_type: unitType(ar),
    parent_dept_id: parentOf.has(ar) ? deptId.get(parentOf.get(ar)) : null,
  };
});
for (const en of [
  "Center Affairs (General Dept.)",
  "Project Management Office (General Dept.)",
  "Environmental Audit (as labelled in register)",
])
  logRow("L-04", "department", "-", "name_en", en, stripEn(en));

// ---- datasets and fields ---------------------------------------------------
const datasets = [];
const dsByAr = new Map();
const fields = [];
const ordinals = new Map();
const placeholders = [];
const groups = [];
const EN_FIX = {
  "DMO-037": ["L-02", "Causing party (if not a facility)"],
  "DMO-182": ["L-03", "Contaminated site remediation plan approval date"],
};
const GROUP_NOTE = /Group label in register/;

for (const { r, row } of regRows) {
  const id = clean(r[0], "field", r[0], "asset_id");
  const dsAr = clean(r[3], "field", id, "dataset_ar");
  const exAr = clean(r[1], "field", id, "exec_dept_ar");
  const gdAr = clean(r[2], "field", id, "general_dept_ar");
  const g = genFields.get(id);
  if (!g) fail(`${id} missing from generated workbook`);
  const cat = catalogue.get(dsAr);
  if (!cat) fail(`${id}: dataset not in catalogue: ${dsAr}`);
  if (ws(g[1]) !== ws(cat[0])) fail(`${id}: dataset id disagrees with catalogue`);

  if (!dsByAr.has(dsAr)) {
    const ds = {
      dataset_id: ws(cat[0]),
      register_order: datasets.length + 1,
      name_ar: dsAr,
      name_en: ws(cat[7]),
      name_en_status: "working_translation",
      domain: /Core/.test(ws(cat[1])) ? "core_environmental" : "corporate_support",
      exec_dept_id: deptId.get(exAr),
      general_dept_id: gdAr ? deptId.get(gdAr) : null,
    };
    if (!gdAr) logRow("C-05", "dataset", ds.dataset_id, "general_dept_id", "(blank in register)", "NULL");
    datasets.push(ds);
    dsByAr.set(dsAr, ds);
  } else {
    const d0 = dsByAr.get(dsAr);
    if (d0.exec_dept_id !== deptId.get(exAr) || d0.general_dept_id !== (gdAr ? deptId.get(gdAr) : null))
      fail(`${id}: department differs within dataset ${d0.dataset_id}`);
  }
  const ds = dsByAr.get(dsAr);

  // register classification (C-02), checked against the workbook (R1, R2)
  const clsAr = clean(r[11], "field", id, "classification");
  const wbCls = ws(g[11]);
  if (clsAr) {
    if (!CLASS[clsAr]) fail(`${id}: unknown classification ${clsAr}`);
    if (wbCls !== clsAr) fail(`${id}: workbook classification ${wbCls} differs from register ${clsAr}`);
  } else {
    if (!/غير مصنف/.test(wbCls)) fail(`${id}: register blank but workbook says ${wbCls}`);
    logRow("C-02", "field", id, "register_classification", wbCls, "NULL");
  }

  // field name and kind (C-03, C-04)
  const nameAr = clean(r[4], "field", id, "field_ar");
  const wbAr = ws(g[10]);
  let kind = "field";
  let name_ar = nameAr;
  let name_en = ws(g[9]);
  if (!nameAr) {
    if (!/بدون اسم حقل/.test(wbAr)) fail(`${id}: register name blank but workbook says ${wbAr}`);
    kind = "dataset_placeholder";
    name_ar = null;
    name_en = null;
    placeholders.push(id);
    logRow("C-04", "field", id, "field_kind", "(no field name)", "dataset_placeholder");
  } else {
    if (wbAr !== nameAr) fail(`${id}: Arabic name differs (${wbAr} vs ${nameAr})`);
    if (GROUP_NOTE.test(ws(g[16]))) {
      kind = "group_label";
      groups.push(id);
      logRow("C-03", "field", id, "field_kind", "field", "group_label");
    }
  }
  if (name_en) {
    const stripped = name_en.replace(/\s*\((group label|pollutant list)\)\s*$/i, "");
    if (stripped !== name_en) {
      logRow("L-04", "field", id, "name_en", name_en, stripped);
      name_en = stripped;
    }
  }
  if (EN_FIX[id]) {
    logRow(EN_FIX[id][0], "field", id, "name_en", name_en, EN_FIX[id][1]);
    name_en = EN_FIX[id][1];
  }

  const pdRaw = ws(g[14]);
  const personal_data = pdRaw === "Yes" ? "personal" : pdRaw === "Yes (health)" ? "sensitive" : "none";

  const next = r[15];
  const nextIso = typeof next === "number" ? isoDate(next) : ws(next) || null;
  if (typeof next === "number") logRow("C-14", "field", id, "next_update_date", next, nextIso);
  const last = r[12];
  const meta = (i, col) => clean(r[i], "field", id, col) || null;

  const ord = (ordinals.get(ds.dataset_id) || 0) + 1;
  ordinals.set(ds.dataset_id, ord);
  fields.push({
    asset_id: id,
    dataset_id: ds.dataset_id,
    ordinal: ord,
    register_row: row,
    field_kind: kind,
    name_ar,
    name_en,
    name_en_status: "working_translation",
    register_classification: clsAr ? CLASS[clsAr].code : null,
    personal_data,
    data_nature_ar: meta(5, "data_nature"),
    description_ar: meta(6, "description"),
    data_steward: meta(7, "steward"),
    steward_email: meta(8, "email"),
    source_system: meta(9, "source"),
    update_frequency_ar: meta(10, "frequency"),
    last_update_date: typeof last === "number" ? isoDate(last) : ws(last) || null,
    update_status_ar: meta(13, "status"),
    notes_ar: meta(14, "notes"),
    next_update_date: nextIso,
    audit_notes_ar: meta(16, "audit"),
    workbook_effective_layer: Number(ws(g[12]).slice(1)),
    value_type: "",
  });
}
if (datasets.length !== 131) fail(`${datasets.length} datasets, expected 131`);
for (const ar of catalogue.keys()) if (!dsByAr.has(ar)) fail(`catalogue dataset not in register: ${ar}`);
logRow("C-07", "dataset", "DS-022", "register_blocks", "2 blocks (DMO-363..367, DMO-751..778)", "1 dataset");
logRow("C-08", "field", "DMO-751", "register_classification", "restricted (other AQI fields public)", "unchanged, reported to DMO");
logRow("C-09", "field", "DMO-801", "effective_layer", "public (register)", "2 (personal data rule R6)");

// ---- dummy tabs ------------------------------------------------------------
const TABS = {
  "DUMMY Facilities": "DS-001",
  "DUMMY Inspections": "DS-015",
  "DUMMY Violations": "DS-016",
  "DUMMY ODS-HFC": "DS-018",
  "DUMMY Air Quality": "DS-022",
  "DUMMY Contam Sites": "DS-027",
  "DUMMY Incidents": "DS-035",
  "DUMMY Complaints": "DS-038",
  "DUMMY Water Samples": "DS-047",
};
const HELPERS = [
  { header: "Averaging period [mockup helper]", asset_id: "DUM-HLP-022-01", name_en: "Averaging period" },
  { header: "Period (month) [mockup helper]", asset_id: "DUM-HLP-022-02", name_en: "Period (month)" },
];
const fieldById = new Map(fields.map((f) => [f.asset_id, f]));
const recordFiles = {};
const valueTypes = new Map();
let totalRecords = 0;
const DATE_HDR = /تاريخ|date/i;

for (const [tab, dsId] of Object.entries(TABS)) {
  const rows = sheet(genWb, tab);
  const hi = rows.findIndex((r) => ws(r[0]) === "Record ID");
  const head = rows[hi].map(ws);
  const data = rows.slice(hi + 1).filter((r) => ws(r[0]));
  const dsFields = fields.filter((f) => f.dataset_id === dsId);
  const colMap = [];
  for (let i = 2; i < head.length; i++) {
    const h = head[i];
    const helper = HELPERS.find((x) => x.header === h);
    if (helper) {
      if (dsId !== "DS-022") fail(`helper column outside DS-022: ${h}`);
      if (!fieldById.has(helper.asset_id)) {
        const f = {
          asset_id: helper.asset_id,
          dataset_id: "DS-022",
          ordinal: dsFields.length + HELPERS.indexOf(helper) + 1,
          register_row: null,
          field_kind: "mockup_helper",
          name_ar: null,
          name_en: helper.name_en,
          name_en_status: "working_translation",
          register_classification: "public",
          personal_data: "none",
          data_nature_ar: null,
          description_ar: null,
          data_steward: null,
          steward_email: null,
          source_system: null,
          update_frequency_ar: null,
          last_update_date: null,
          update_status_ar: null,
          notes_ar: null,
          next_update_date: null,
          audit_notes_ar: null,
          workbook_effective_layer: 1,
          value_type: "",
        };
        fields.push(f);
        fieldById.set(f.asset_id, f);
        logRow("D-03", "field", f.asset_id, "field_kind", "column not in register", "mockup_helper, layer L1 (class public)");
      }
      colMap.push({ index: i, asset_id: helper.asset_id });
      continue;
    }
    const m = h.match(/^(.*?)\s*\|\s*(.*?)\s*\[(L[123])\]$/);
    if (!m) fail(`${tab}: unparseable header ${h}`);
    const cands = dsFields.filter((f) => f.name_ar === ws(m[1]));
    if (cands.length !== 1) fail(`${tab}: header "${m[1]}" matches ${cands.length} register fields`);
    const f = cands[0];
    if (`L${f.workbook_effective_layer}` !== m[3]) fail(`${tab}: ${f.asset_id} layer tag ${m[3]} differs from register`);
    if (f.field_kind === "group_label") {
      logRow("D-02", "dummy_column", f.asset_id, tab, "group label column", "dropped");
      continue;
    }
    colMap.push({ index: i, asset_id: f.asset_id });
  }
  const cols = colMap.map((c) => c.asset_id);
  const out = [];
  const seenIds = new Set();
  for (const r of data) {
    const rid = ws(r[0]);
    if (!new RegExp(`^DUM-${dsId.slice(3)}-\\d{4}$`).test(rid)) fail(`${tab}: bad record id ${rid}`);
    if (seenIds.has(rid)) fail(`${tab}: duplicate record id ${rid}`);
    seenIds.add(rid);
    if (ws(r[1]) !== "DUMMY") fail(`${tab}: ${rid} is not DUMMY`);
    const o = { record_id: rid, dataset_id: dsId, is_dummy: "true", data_status: "DUMMY" };
    for (const c of colMap) {
      let v = r[c.index];
      if (v === "" || v === null || v === undefined) continue;
      const f = fieldById.get(c.asset_id);
      const t = typeof v === "number" ? (DATE_HDR.test(`${f.name_ar || ""} ${f.name_en || ""}`) ? "date" : "number") : "text";
      const prev = valueTypes.get(c.asset_id);
      if (prev && prev !== t) fail(`${tab}: mixed value types in ${c.asset_id}`);
      valueTypes.set(c.asset_id, t);
      if (t === "date") {
        logRow("D-01", "dummy_value", rid, c.asset_id, v, isoDate(v));
        v = isoDate(v);
      } else if (t === "text") v = ws(v);
      if (f.personal_data !== "none") {
        const s = String(v);
        if (/\d{6,}/.test(s) || !/masked|تجريبي/.test(s))
          fail(`${rid} ${c.asset_id}: personal data value is not a masked placeholder`);
      }
      o[c.asset_id] = v;
    }
    out.push(o);
  }
  totalRecords += out.length;
  recordFiles[dsId] = { file: `records_${dsId}.csv`, rows: out.length, columns: cols.length };
  writeCsv(path.join(OUT, `records_${dsId}.csv`), ["record_id", "dataset_id", "is_dummy", "data_status", ...cols], out);
}
for (const f of fields) f.value_type = valueTypes.get(f.asset_id) || "";

// ---- write -----------------------------------------------------------------
writeCsv(
  path.join(OUT, "classifications.csv"),
  ["code", "name_ar", "name_en", "layer"],
  Object.entries(CLASS).map(([ar, c]) => ({ code: c.code, name_ar: ar, name_en: c.en, layer: c.layer })),
);
writeCsv(
  path.join(OUT, "departments.csv"),
  ["dept_id", "name_ar", "name_en", "name_en_status", "unit_type", "parent_dept_id"],
  departments,
);
writeCsv(
  path.join(OUT, "datasets.csv"),
  ["dataset_id", "register_order", "name_ar", "name_en", "name_en_status", "domain", "exec_dept_id", "general_dept_id"],
  datasets,
);
const FIELD_COLS = [
  "asset_id", "dataset_id", "ordinal", "register_row", "field_kind", "name_ar", "name_en", "name_en_status",
  "register_classification", "personal_data", "data_nature_ar", "description_ar", "data_steward", "steward_email",
  "source_system", "update_frequency_ar", "last_update_date", "update_status_ar", "notes_ar", "next_update_date",
  "audit_notes_ar", "workbook_effective_layer", "value_type",
];
writeCsv(path.join(OUT, "fields.csv"), FIELD_COLS, fields);
writeCsv(path.join(OUT, "cleaning_log.csv"), ["rule_id", "entity", "entity_id", "column", "before", "after"], log);

const counts = {
  departments: departments.length,
  datasets: datasets.length,
  fields: fields.length,
  register_rows: fields.filter((f) => f.asset_id.startsWith("DMO-")).length,
  group_labels: groups.length,
  placeholders: placeholders.length,
  dummy_records: totalRecords,
  cleaning_log_rows: log.length,
};
fs.writeFileSync(
  path.join(OUT, "build_manifest.json"),
  JSON.stringify(
    {
      inputs: {
        register: { file: path.basename(REGISTER), sha256: sha(REGISTER) },
        workbook: { file: path.basename(WORKBOOK), sha256: sha(WORKBOOK) },
      },
      counts,
      records: recordFiles,
    },
    null,
    2,
  ) + "\n",
);
console.log(counts);
