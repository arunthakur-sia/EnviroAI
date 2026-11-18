// Client-safe types for the NCEC data layer (no database imports). See
// docs/ncec/ui-plan.md s3 for the design this implements.
export type NcecLayer = 1 | 2 | 3;

/** Who the current NCEC caller is and what they may see. Produced only by
    getNcecPrincipal() in principal.ts — nothing else should construct one. */
export type NcecPrincipal = {
  /** The signed-in app user's id. NCEC always requires a login (decision #2). */
  userId: string;
  /** The caller's cumulative login layer (brief s4): L1 never reaches this
      type at all (getNcecPrincipal returns null for it), so this is always
      1 or 2. L3 is never a blanket clearance on this field — per brief R4 it
      is always a per-dataset grant on top of baseLayer, held in
      grantedDatasetIds below. */
  baseLayer: 1 | 2;
  /** Dataset ids opened by an active L3 grant; empty outside an L3 elevation. */
  grantedDatasetIds: string[];
  /** Whether the active grant includes personal data (brief R6). */
  includePersonalData: boolean;
  /** Whether export is allowed under the active grant. */
  allowExport: boolean;
  /** ISO timestamp the L3 grant expires at, or null with no active grant. */
  grantExpiresAt: string | null;
  /** Only "demo" is implemented in Step 1; real SSO/grants come later. */
  source: "demo";
};

/** The layer to show on a badge: L3 only while an active grant exists,
    otherwise the caller's own login layer (brief R4: L3 is an elevation, not
    a second identity). */
export function principalDisplayLayer(p: NcecPrincipal): NcecLayer {
  return p.grantedDatasetIds.length > 0 ? 3 : p.baseLayer;
}

export type FieldKind = "field" | "group_label" | "dataset_placeholder" | "mockup_helper";
export type PersonalDataKind = "none" | "personal" | "sensitive";
export type DatasetDomain = "core_environmental" | "corporate_support";

/** A column as the caller is allowed to see it. When locked is true, no
    value for this asset_id is ever sent to the browser (policy.ts). */
export type ColumnMeta = {
  assetId: string;
  ordinal: number;
  nameAr: string | null;
  nameEn: string | null;
  layer: NcecLayer;
  personalData: PersonalDataKind;
  locked: boolean;
};

export type CatalogueDataset = {
  datasetId: string;
  nameAr: string;
  nameEn: string | null;
  nameEnStatus: string;
  domain: DatasetDomain | null;
  execDeptId: string;
  execDeptNameAr: string | null;
  execDeptNameEn: string | null;
  generalDeptId: string | null;
  generalDeptNameAr: string | null;
  generalDeptNameEn: string | null;
  registerOrder: number;
  /** null when the dataset is entirely out of reach: no counts are shown
      for a dataset the caller cannot open at all (brief s6, avoids inference). */
  fieldCounts: { l1: number; l2: number; l3: number } | null;
  recordCount: number | null;
  locked: boolean;
  hasDummyData: boolean;
};

export type DatasetView = {
  dataset: CatalogueDataset;
  columns: ColumnMeta[];
};

export type RecordRowView = { recordId: string; values: Record<string, unknown> };

export type RecordsPage = {
  columns: ColumnMeta[];
  rows: RecordRowView[];
  total: number;
  page: number;
  pageSize: number;
};

/** What a masked personal-data value looks like to the browser. The real
    value never leaves the server (policy.ts projectRecord). */
export const PERSONAL_MASK = "••••••";
