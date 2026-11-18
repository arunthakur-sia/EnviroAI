// The NCEC dataset catalogue: every dataset the caller may browse, with
// per-layer field counts, or locked with no counts at all when every field
// is out of reach (brief s6, s8.2; ui-plan.md s2, s3.3).
import "server-only";
import type { CatalogueDataset, DatasetDomain, NcecPrincipal } from "./types";
import { countAllRecordsByDataset, listAllFields, listDatasets, listDepartments, type FieldRow } from "./repo";
import { isDatasetLocked } from "./policy";

export async function getCatalogue(
  principal: NcecPrincipal,
  domain?: DatasetDomain
): Promise<CatalogueDataset[]> {
  const [datasets, depts, fields, recordCounts] = await Promise.all([
    listDatasets(),
    listDepartments(),
    listAllFields(),
    countAllRecordsByDataset(),
  ]);
  const deptById = new Map(depts.map((d) => [d.deptId, d]));
  const fieldsByDataset = new Map<string, FieldRow[]>();
  for (const f of fields) {
    const list = fieldsByDataset.get(f.datasetId);
    if (list) list.push(f);
    else fieldsByDataset.set(f.datasetId, [f]);
  }

  const filtered = domain ? datasets.filter((d) => d.domain === domain) : datasets;
  return filtered
    .map((d): CatalogueDataset => {
      const dFields = fieldsByDataset.get(d.datasetId) ?? [];
      const locked = isDatasetLocked(
        principal,
        dFields.map((f) => ({ datasetId: f.datasetId, layer: f.effectiveLayer, fieldKind: f.fieldKind }))
      );
      const execDept = deptById.get(d.execDeptId) ?? null;
      const generalDept = d.generalDeptId ? deptById.get(d.generalDeptId) ?? null : null;
      const recordCount = recordCounts.get(d.datasetId) ?? 0;
      const base = {
        datasetId: d.datasetId,
        nameAr: d.nameAr,
        nameEn: d.nameEn,
        nameEnStatus: d.nameEnStatus,
        domain: d.domain,
        execDeptId: d.execDeptId,
        execDeptNameAr: execDept?.nameAr ?? null,
        execDeptNameEn: execDept?.nameEn ?? null,
        generalDeptId: d.generalDeptId,
        generalDeptNameAr: generalDept?.nameAr ?? null,
        generalDeptNameEn: generalDept?.nameEn ?? null,
        registerOrder: d.registerOrder,
        hasDummyData: recordCount > 0,
      };
      if (locked) {
        return { ...base, fieldCounts: null, recordCount: null, locked: true };
      }
      // The catalogue's field-count chip counts register fields only
      // (decision #9): a mockup_helper column (e.g. DS-022's two averaging-
      // period columns) is real, visible data in the dataset view's table,
      // but it is not one of the register's 893 rows, so it is not counted
      // here.
      const dataFields = dFields.filter((f) => f.fieldKind === "field");
      const fieldCounts = { l1: 0, l2: 0, l3: 0 };
      for (const f of dataFields) {
        if (f.effectiveLayer === 1) fieldCounts.l1++;
        else if (f.effectiveLayer === 2) fieldCounts.l2++;
        else fieldCounts.l3++;
      }
      return { ...base, fieldCounts, recordCount, locked: false };
    })
    .sort((a, b) => a.registerOrder - b.registerOrder);
}

export type CorporateGroup = {
  /** the general department id, or the exec department id when a dataset has
      no general department (e.g. CEO Office, PMO rows) */
  key: string;
  deptNameAr: string;
  deptNameEn: string | null;
  datasetCount: number;
  datasets: CatalogueDataset[];
};

/** Groups the corporate catalogue by owning department (ui-plan.md s2.3,
    decision #8 option A). Every corporate dataset is catalogue-only: none
    of the 73 has dummy records, so this never needs record counts. */
export function groupCorporate(entries: CatalogueDataset[]): CorporateGroup[] {
  const groups = new Map<string, CorporateGroup>();
  for (const d of entries) {
    const key = d.generalDeptId ?? d.execDeptId;
    const deptNameAr = d.generalDeptNameAr ?? d.execDeptNameAr ?? d.execDeptId;
    const deptNameEn = d.generalDeptNameEn ?? d.execDeptNameEn ?? null;
    const g = groups.get(key);
    if (g) {
      g.datasetCount++;
      g.datasets.push(d);
    } else {
      groups.set(key, { key, deptNameAr, deptNameEn, datasetCount: 1, datasets: [d] });
    }
  }
  return [...groups.values()].sort((a, b) => b.datasetCount - a.datasetCount);
}
