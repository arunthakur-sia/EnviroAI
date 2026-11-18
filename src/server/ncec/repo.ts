// Raw, parameterised SQL against the ncec_* tables (migrations 0011 /
// migrations-pg 0001), portable across the SQLite and Postgres drivers via
// rawClient (pg-adapter.ts translates "?" placeholders and LIKE/ILIKE; see
// ui-plan.md decision #19 for why this is raw SQL rather than a Drizzle
// schema). Every row mapper below normalises the two drivers' differences:
// field_values comes back as a JSON string on SQLite and an object on
// Postgres; is_dummy comes back as 0/1 on both (pg-adapter already forces
// booleans to 0/1); last_update_date/next_update_date come back as a Date on
// Postgres and as text on SQLite.
import "server-only";
import { rawClient } from "@/server/db/client";
import type { DatasetDomain, FieldKind, NcecLayer, PersonalDataKind } from "./types";

type Row = Record<string, unknown>;

async function all(sql: string, args: unknown[] = []): Promise<Row[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- libsql's InArgs typing is
  // narrower than the plain values we send; search/vector.ts casts the same way.
  const res = await rawClient.execute({ sql, args: args as any });
  return res.rows as unknown as Row[];
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}
function strOrNull(v: unknown): string | null {
  return v == null ? null : String(v);
}
function asLayer(v: unknown): NcecLayer {
  const n = Number(v);
  return n === 1 || n === 2 ? (n as NcecLayer) : 3;
}
function asBool(v: unknown): boolean {
  return v === true || v === 1 || v === "1";
}
function asJsonObject(v: unknown): Record<string, unknown> {
  if (v == null) return {};
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof v === "object" ? (v as Record<string, unknown>) : {};
}
/** Reserved for metadata display (dataset steward dates); unused by the
    Step 1 dashboards, kept here so a future dataset-detail view can show
    last_update_date/next_update_date consistently on both drivers. */
export function asIsoDateOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

export type DepartmentRow = {
  deptId: string;
  nameAr: string;
  nameEn: string | null;
  nameEnStatus: string;
  unitType: string;
  parentDeptId: string | null;
};
function mapDepartment(r: Row): DepartmentRow {
  return {
    deptId: str(r.dept_id),
    nameAr: str(r.name_ar),
    nameEn: strOrNull(r.name_en),
    nameEnStatus: str(r.name_en_status),
    unitType: str(r.unit_type),
    parentDeptId: strOrNull(r.parent_dept_id),
  };
}
export async function listDepartments(): Promise<DepartmentRow[]> {
  const rows = await all(
    `SELECT dept_id, name_ar, name_en, name_en_status, unit_type, parent_dept_id FROM ncec_departments`
  );
  return rows.map(mapDepartment);
}

export type DatasetRow = {
  datasetId: string;
  registerOrder: number;
  nameAr: string;
  nameEn: string | null;
  nameEnStatus: string;
  domain: DatasetDomain | null;
  execDeptId: string;
  generalDeptId: string | null;
};
function mapDataset(r: Row): DatasetRow {
  return {
    datasetId: str(r.dataset_id),
    registerOrder: Number(r.register_order),
    nameAr: str(r.name_ar),
    nameEn: strOrNull(r.name_en),
    nameEnStatus: str(r.name_en_status),
    domain: (strOrNull(r.domain) as DatasetDomain | null) ?? null,
    execDeptId: str(r.exec_dept_id),
    generalDeptId: strOrNull(r.general_dept_id),
  };
}
const DATASET_COLUMNS =
  "dataset_id, register_order, name_ar, name_en, name_en_status, domain, exec_dept_id, general_dept_id";
export async function listDatasets(): Promise<DatasetRow[]> {
  const rows = await all(`SELECT ${DATASET_COLUMNS} FROM ncec_datasets ORDER BY register_order`);
  return rows.map(mapDataset);
}
export async function getDataset(datasetId: string): Promise<DatasetRow | null> {
  const rows = await all(`SELECT ${DATASET_COLUMNS} FROM ncec_datasets WHERE dataset_id = ?`, [datasetId]);
  return rows.length ? mapDataset(rows[0]) : null;
}

export type FieldRow = {
  assetId: string;
  datasetId: string;
  ordinal: number;
  fieldKind: FieldKind;
  nameAr: string | null;
  nameEn: string | null;
  registerClassification: string | null;
  personalData: PersonalDataKind;
  effectiveLayer: NcecLayer;
};
function mapField(r: Row): FieldRow {
  return {
    assetId: str(r.asset_id),
    datasetId: str(r.dataset_id),
    ordinal: Number(r.ordinal),
    fieldKind: str(r.field_kind) as FieldKind,
    nameAr: strOrNull(r.name_ar),
    nameEn: strOrNull(r.name_en),
    registerClassification: strOrNull(r.register_classification),
    personalData: str(r.personal_data) as PersonalDataKind,
    effectiveLayer: asLayer(r.effective_layer),
  };
}
const FIELD_COLUMNS =
  "asset_id, dataset_id, ordinal, field_kind, name_ar, name_en, register_classification, personal_data, effective_layer";
export async function listFields(datasetId: string): Promise<FieldRow[]> {
  const rows = await all(`SELECT ${FIELD_COLUMNS} FROM ncec_fields WHERE dataset_id = ? ORDER BY ordinal`, [datasetId]);
  return rows.map(mapField);
}
/** All 895 field rows in one call. At this data size (131 datasets) a single
    query plus in-memory grouping is simpler and faster than one query per
    dataset, and is what the catalogue page needs. */
export async function listAllFields(): Promise<FieldRow[]> {
  const rows = await all(`SELECT ${FIELD_COLUMNS} FROM ncec_fields ORDER BY dataset_id, ordinal`);
  return rows.map(mapField);
}

export async function countRecords(datasetId: string): Promise<number> {
  const rows = await all(`SELECT count(*) AS n FROM ncec_records WHERE dataset_id = ?`, [datasetId]);
  return Number(rows[0]?.n ?? 0);
}
export async function countAllRecordsByDataset(): Promise<Map<string, number>> {
  const rows = await all(`SELECT dataset_id, count(*) AS n FROM ncec_records GROUP BY dataset_id`);
  return new Map(rows.map((r) => [str(r.dataset_id), Number(r.n)]));
}

export type RecordRow = { recordId: string; datasetId: string; values: Record<string, unknown>; isDummy: boolean };
function mapRecord(r: Row): RecordRow {
  return {
    recordId: str(r.record_id),
    datasetId: str(r.dataset_id),
    values: asJsonObject(r.field_values),
    isDummy: asBool(r.is_dummy),
  };
}
export async function listRecords(
  datasetId: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<RecordRow[]> {
  const limit = opts.limit ?? 500;
  const offset = opts.offset ?? 0;
  const rows = await all(
    `SELECT record_id, dataset_id, field_values, is_dummy FROM ncec_records WHERE dataset_id = ? ORDER BY record_id LIMIT ? OFFSET ?`,
    [datasetId, limit, offset]
  );
  return rows.map(mapRecord);
}
