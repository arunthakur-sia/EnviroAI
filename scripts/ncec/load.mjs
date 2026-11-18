// Loads the cleaned NCEC CSVs (scripts/seed-content/ncec) into SQLite or Postgres.
// One transaction, idempotent: rows that already match are not touched, and an import batch
// row is only created when something changes. Every record is stored with is_dummy = true.
// Usage:
//   node scripts/ncec/load.mjs --driver sqlite --target nexus.db [--dry-run]
//   node scripts/ncec/load.mjs --driver pg --target <db> --allow-remote [--dry-run]
//   --allow-layer-decrease   permit a reload that lowers a field's effective layer
//   --purge                  empty the ncec_* tables (data rollback), same guard
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { openDb, parseArgs, num } from "./lib/db.mjs";
import { readCsv } from "./lib/csv.mjs";
import { canon } from "./lib/canon.mjs";

const args = parseArgs(process.argv.slice(2));
const dry = args.flags.has("dry-run");
const DIR = path.resolve("scripts", "seed-content", "ncec");

const TABLES_CHILD_FIRST = [
  "ncec_classification_history", "ncec_records", "ncec_fields", "ncec_datasets",
  "ncec_departments", "ncec_classifications", "ncec_import_batches",
];

const db = await openDb(args);
console.log(`target: ${db.label}${dry ? " (dry run)" : ""}`);
const summary = {};
let batchId = null;

try {
  await db.begin();

  if (args.flags.has("purge")) {
    for (const t of TABLES_CHILD_FIRST) console.log(`purge ${t}: ${await db.run(`DELETE FROM ${t}`)} rows`);
    await (dry ? db.rollback() : db.commit());
    console.log(dry ? "dry run: purge rolled back" : "purged");
    process.exit(0);
  }

  try {
    await db.all("SELECT 1 FROM ncec_datasets LIMIT 1");
  } catch {
    throw new Error("The ncec_* tables do not exist yet. Run the migrations first.");
  }

  // ---- read CSVs ----------------------------------------------------------
  const read = (f) => readCsv(path.join(DIR, f));
  const classifications = read("classifications.csv");
  const departments = read("departments.csv");
  const datasets = read("datasets.csv");
  const fields = read("fields.csv");
  const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "build_manifest.json"), "utf8"));
  const valueType = new Map(fields.map((f) => [f.asset_id, f.value_type]));
  const fieldKind = new Map(fields.map((f) => [f.asset_id, f]));
  const files = {};
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv") || x.endsWith(".json")).sort())
    files[f] = crypto.createHash("sha256").update(fs.readFileSync(path.join(DIR, f))).digest("hex");

  const getBatch = async () => {
    if (batchId) return batchId;
    const r = await db.all(
      "INSERT INTO ncec_import_batches (files, counts) VALUES (?, ?) RETURNING import_batch_id",
      [JSON.stringify(files), JSON.stringify(manifest.counts)],
    );
    batchId = num(r[0].import_batch_id);
    return batchId;
  };

  // ---- generic upsert ------------------------------------------------------
  async function upsert(table, pk, cols, rows, opts = {}) {
    const st = { inserted: 0, updated: 0, unchanged: 0, deleted: 0 };
    const sel = Object.entries(cols).map(([c, t]) => (t === "date" ? `CAST(${c} AS text) AS ${c}` : c));
    const extra = opts.selectExtra || [];
    const existing = new Map(
      (await db.all(`SELECT ${[...sel, ...extra].join(", ")} FROM ${table}`)).map((r) => [r[pk], r]),
    );
    const toInsert = [], toUpdate = [];
    for (const row of rows) {
      const old = existing.get(row[pk]);
      if (!old) { toInsert.push(row); continue; }
      const diff = Object.keys(cols).filter((c) => canon(old[c], cols[c]) !== canon(row[c], cols[c]));
      if (diff.length) toUpdate.push({ row, old, diff }); else st.unchanged++;
    }
    if (opts.beforeWrite) opts.beforeWrite(toUpdate);
    const bid = toInsert.length || toUpdate.length ? await getBatch() : null;
    const colNames = Object.keys(cols);
    const prep = (row) => colNames.map((c) => {
      const v = row[c];
      if (v === null || v === undefined) return null;
      const t = cols[c];
      if (t === "int") return Number(v);
      if (t === "bool") return db.bool(v === true || v === "true" || v === 1);
      if (t === "json") return typeof v === "string" ? v : JSON.stringify(v);
      return v;
    });
    const withBatch = opts.batchColumn !== false;
    const insCols = withBatch ? [...colNames, "import_batch_id"] : colNames;
    for (let i = 0; i < toInsert.length; i += 50) {
      const chunk = toInsert.slice(i, i + 50);
      const one = `(${insCols.map(() => "?").join(", ")})`;
      await db.run(
        `INSERT INTO ${table} (${insCols.join(", ")}) VALUES ${chunk.map(() => one).join(", ")}`,
        chunk.flatMap((r) => (withBatch ? [...prep(r), bid] : prep(r))),
      );
    }
    st.inserted = toInsert.length;
    for (const u of toUpdate) {
      const setCols = u.diff.filter((c) => c !== pk);
      const p = prep(u.row);
      const vals = setCols.map((c) => p[colNames.indexOf(c)]);
      const set = setCols.map((c) => `${c} = ?`).concat(withBatch ? ["import_batch_id = ?"] : []).join(", ");
      await db.run(`UPDATE ${table} SET ${set} WHERE ${pk} = ?`, [...vals, ...(withBatch ? [bid] : []), u.row[pk]]);
    }
    st.updated = toUpdate.length;
    st.existing = existing;
    summary[table] = st;
    return st;
  }

  // ---- catalogue ------------------------------------------------------------
  await upsert("ncec_classifications", "code", { code: "text", name_ar: "text", name_en: "text", layer: "int" },
    classifications, { batchColumn: false });
  await upsert("ncec_departments", "dept_id",
    { dept_id: "text", name_ar: "text", name_en: "text", name_en_status: "text", unit_type: "text", parent_dept_id: "text" },
    departments, { batchColumn: false });
  const dsSt = await upsert("ncec_datasets", "dataset_id",
    { dataset_id: "text", register_order: "int", name_ar: "text", name_en: "text", name_en_status: "text", domain: "text",
      exec_dept_id: "text", general_dept_id: "text" }, datasets);

  const layerOf = new Map(classifications.map((c) => [c.code, Number(c.layer)]));
  const newLayer = (f) => Math.max(f.register_classification ? layerOf.get(f.register_classification) : 3, f.personal_data !== "none" ? 2 : 1);
  const FIELD_COLS = {
    asset_id: "text", dataset_id: "text", ordinal: "int", register_row: "int", field_kind: "text", name_ar: "text", name_en: "text",
    name_en_status: "text", register_classification: "text", personal_data: "text", data_nature_ar: "text", description_ar: "text",
    data_steward: "text", steward_email: "text", source_system: "text", update_frequency_ar: "text", last_update_date: "date",
    update_status_ar: "text", notes_ar: "text", next_update_date: "date", audit_notes_ar: "text",
  };
  const fldSt = await upsert("ncec_fields", "asset_id", FIELD_COLS, fields, {
    selectExtra: ["effective_layer"],
    beforeWrite: (updates) => {
      if (args.flags.has("allow-layer-decrease")) return;
      const lowered = updates
        .map((u) => ({ id: u.row.asset_id, from: num(u.old.effective_layer), to: newLayer(u.row) }))
        .filter((x) => x.to < x.from);
      if (lowered.length)
        throw new Error(`reload would lower the layer of ${lowered.length} field(s): ${lowered.slice(0, 5).map((x) => `${x.id} L${x.from}->L${x.to}`).join(", ")}. Pass --allow-layer-decrease to accept.`);
    },
  });

  // ---- records (dummy) ------------------------------------------------------
  const allowedKeys = new Map();
  for (const f of fields) {
    if (!["field", "mockup_helper"].includes(f.field_kind)) continue;
    (allowedKeys.get(f.dataset_id) || allowedKeys.set(f.dataset_id, new Set()).get(f.dataset_id)).add(f.asset_id);
  }
  const records = [];
  for (const f of fs.readdirSync(DIR).filter((x) => /^records_DS-\d{3}\.csv$/.test(x)).sort()) {
    for (const row of read(f)) {
      if (row.is_dummy !== "true" || row.data_status !== "DUMMY" || !row.record_id.startsWith("DUM-"))
        throw new Error(`${f}: ${row.record_id} is not a dummy record (R7)`);
      const values = {};
      for (const [k, v] of Object.entries(row)) {
        if (["record_id", "dataset_id", "is_dummy", "data_status"].includes(k) || v === null) continue;
        if (!allowedKeys.get(row.dataset_id)?.has(k)) throw new Error(`${f}: ${row.record_id} has key ${k} that is not a field of ${row.dataset_id}`);
        const t = valueType.get(k);
        if (t === "number") {
          if (!Number.isFinite(Number(v))) throw new Error(`${row.record_id} ${k}: "${v}" is not a number`);
          values[k] = Number(v);
        } else values[k] = v;
      }
      records.push({ record_id: row.record_id, dataset_id: row.dataset_id, field_values: values, is_dummy: true, data_status: "DUMMY" });
    }
  }
  const recSt = await upsert("ncec_records", "record_id",
    { record_id: "text", dataset_id: "text", field_values: "json", is_dummy: "bool", data_status: "text" }, records);

  // dummy records of the loaded datasets that are no longer in the CSVs
  const keep = new Set(records.map((r) => r.record_id));
  const loadedDs = new Set(records.map((r) => r.dataset_id));
  const stale = [...recSt.existing.values()].filter((r) => loadedDs.has(r.dataset_id) && !keep.has(r.record_id));
  const nonDummyStale = stale.filter((r) => canon(r.is_dummy, "bool") !== "1");
  if (nonDummyStale.length) throw new Error(`${nonDummyStale.length} non-dummy record(s) are in loaded datasets; refusing to touch them`);
  for (const r of stale) await db.run("DELETE FROM ncec_records WHERE record_id = ? AND is_dummy = ?", [r.record_id, db.bool(true)]);
  recSt.deleted = stale.length;

  // catalogue rows in the database but not in the CSVs: reported, never deleted
  const orphanDs = [...dsSt.existing.keys()].filter((k) => !datasets.some((d) => d.dataset_id === k));
  const orphanFld = [...fldSt.existing.keys()].filter((k) => !fieldKind.has(k));
  if (orphanDs.length || orphanFld.length) console.log(`note: ${orphanDs.length} dataset(s) and ${orphanFld.length} field(s) in the database are not in the CSVs (kept)`);

  // ---- report ------------------------------------------------------------------
  const hist = await db.all("SELECT CAST(count(*) AS integer) AS n FROM ncec_classification_history" + (batchId ? " WHERE import_batch_id = ?" : " WHERE 1 = 0"), batchId ? [batchId] : []);
  console.log("table".padEnd(30), "inserted updated unchanged deleted");
  for (const [t, s] of Object.entries(summary))
    console.log(t.padEnd(30), String(s.inserted).padStart(8), String(s.updated).padStart(7), String(s.unchanged).padStart(9), String(s.deleted).padStart(7));
  console.log(`history rows written this run: ${num(hist[0].n)}`);
  const changed = Object.values(summary).some((s) => s.inserted || s.updated || s.deleted);
  if (batchId) {
    await db.run("UPDATE ncec_import_batches SET counts = ? WHERE import_batch_id = ?", [
      JSON.stringify({ ...manifest.counts, changes: Object.fromEntries(Object.entries(summary).map(([t, s]) => [t, { inserted: s.inserted, updated: s.updated, deleted: s.deleted }])) }),
      batchId,
    ]);
  }
  console.log(changed ? `import batch ${batchId}` : "no changes (idempotent)");
  if (dry) { await db.rollback(); console.log("dry run: rolled back"); }
  else { await db.commit(); console.log("committed"); }
} catch (e) {
  await db.rollback().catch(() => {});
  console.error("FAILED, rolled back:", e.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
