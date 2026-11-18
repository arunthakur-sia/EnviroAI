// A single dataset's metadata, columns and (paged) records, filtered for the
// caller (ui-plan.md s3.1-3.3). Returns null when the dataset itself does
// not exist; callers (pages, API routes) decide how to turn that into a
// 404. Never throws for "locked" — a locked dataset still resolves, with
// locked columns and no rows, so the generic dataset view can show the
// "Request access" state instead of a dead end.
import "server-only";
import type { ColumnMeta, DatasetView, NcecPrincipal, RecordsPage } from "./types";
import { countRecords, getDataset, listDepartments, listFields, listRecords } from "./repo";
import { columnsFor, isDatasetLocked, projectRecord } from "./policy";

function buildColumns(principal: NcecPrincipal, fields: Awaited<ReturnType<typeof listFields>>): ColumnMeta[] {
  return columnsFor(
    principal,
    fields.map((f) => ({
      assetId: f.assetId,
      datasetId: f.datasetId,
      ordinal: f.ordinal,
      fieldKind: f.fieldKind,
      nameAr: f.nameAr,
      nameEn: f.nameEn,
      layer: f.effectiveLayer,
      personalData: f.personalData,
    }))
  );
}

export async function getDatasetView(principal: NcecPrincipal, datasetId: string): Promise<DatasetView | null> {
  const [dataset, fields, depts] = await Promise.all([
    getDataset(datasetId),
    listFields(datasetId),
    listDepartments(),
  ]);
  if (!dataset) return null;

  const locked = isDatasetLocked(
    principal,
    fields.map((f) => ({ datasetId: f.datasetId, layer: f.effectiveLayer, fieldKind: f.fieldKind }))
  );
  const deptById = new Map(depts.map((d) => [d.deptId, d]));
  const execDept = deptById.get(dataset.execDeptId) ?? null;
  const generalDept = dataset.generalDeptId ? deptById.get(dataset.generalDeptId) ?? null : null;
  const recordCount = locked ? null : await countRecords(datasetId);
  const columns = buildColumns(principal, fields);

  return {
    dataset: {
      datasetId: dataset.datasetId,
      nameAr: dataset.nameAr,
      nameEn: dataset.nameEn,
      nameEnStatus: dataset.nameEnStatus,
      domain: dataset.domain,
      execDeptId: dataset.execDeptId,
      execDeptNameAr: execDept?.nameAr ?? null,
      execDeptNameEn: execDept?.nameEn ?? null,
      generalDeptId: dataset.generalDeptId,
      generalDeptNameAr: generalDept?.nameAr ?? null,
      generalDeptNameEn: generalDept?.nameEn ?? null,
      registerOrder: dataset.registerOrder,
      fieldCounts: null,
      recordCount,
      locked,
      hasDummyData: (recordCount ?? 0) > 0,
    },
    columns,
  };
}

export async function getDatasetRecords(
  principal: NcecPrincipal,
  datasetId: string,
  page = 1,
  pageSize = 25
): Promise<RecordsPage | null> {
  const [dataset, fields] = await Promise.all([getDataset(datasetId), listFields(datasetId)]);
  if (!dataset) return null;

  const locked = isDatasetLocked(
    principal,
    fields.map((f) => ({ datasetId: f.datasetId, layer: f.effectiveLayer, fieldKind: f.fieldKind }))
  );
  const columns = buildColumns(principal, fields);
  if (locked) return { columns, rows: [], total: 0, page, pageSize };

  const total = await countRecords(datasetId);
  const rawRows = await listRecords(datasetId, { limit: pageSize, offset: (page - 1) * pageSize });
  const rows = rawRows.map((r) => ({ recordId: r.recordId, values: projectRecord(principal, columns, r.values) }));
  return { columns, rows, total, page, pageSize };
}
