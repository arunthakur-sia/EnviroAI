// Pure, DB-free access-control rules for the NCEC data layer (brief R1-R6;
// ui-plan.md s3.2). Every function here takes plain data in and returns
// plain data out, so it is unit-tested without a database
// (tests/ncec-policy.test.ts). Nothing outside this file decides whether a
// value is visible.
import type { ColumnMeta, FieldKind, NcecLayer, NcecPrincipal, PersonalDataKind } from "./types";
import { PERSONAL_MASK } from "./types";

export type RawField = {
  assetId: string;
  datasetId: string;
  ordinal: number;
  fieldKind: FieldKind;
  nameAr: string | null;
  nameEn: string | null;
  layer: NcecLayer;
  personalData: PersonalDataKind;
};

const DATA_KINDS: readonly FieldKind[] = ["field", "mockup_helper"];

/** R2-R4: a field at or below the caller's layer is visible; an L3 field is
    visible on top of that only when the dataset is in an active grant. A
    null principal (no NCEC access) never sees anything. */
export function canSeeField(principal: NcecPrincipal | null, datasetId: string, layer: NcecLayer): boolean {
  if (!principal) return false;
  if (layer <= principal.baseLayer) return true;
  if (layer === 3) return principal.grantedDatasetIds.includes(datasetId);
  return false;
}

/** Kinds whose effective_layer gates whether a dataset is locked. This is
    wider than DATA_KINDS: a "dataset_placeholder" row carries no displayable
    value (it never appears as a key in field_values, so it is never a table
    column), but its classification is the register's only statement of how
    sensitive that whole dataset is, and must still gate access — otherwise
    a dataset with no itemised fields yet (several corporate datasets
    classified Top Secret) would wrongly show as open to everyone. A group
    label is pure layout and never gates anything. */
const LOCK_RELEVANT_KINDS: readonly FieldKind[] = ["field", "mockup_helper", "dataset_placeholder"];

/** A dataset is locked for a caller when none of its fields, including an
    un-itemised placeholder's own classification, are visible to them. A
    dataset with at least one visible field is not locked, even if some of
    its columns are individually locked (a "mixed" dataset, brief s8.2). */
export function isDatasetLocked(principal: NcecPrincipal | null, fields: Pick<RawField, "datasetId" | "layer" | "fieldKind">[]): boolean {
  const relevant = fields.filter((f) => LOCK_RELEVANT_KINDS.includes(f.fieldKind));
  if (relevant.length === 0) return false;
  return !relevant.some((f) => canSeeField(principal, f.datasetId, f.layer));
}

/** Builds the column list a caller receives for a dataset's data fields,
    marking each one visible or locked. Locked columns carry metadata
    (name, layer) only; projectRecord never fills in a value for them. */
export function columnsFor(principal: NcecPrincipal | null, fields: RawField[]): ColumnMeta[] {
  return fields
    .filter((f) => DATA_KINDS.includes(f.fieldKind))
    .map((f) => ({
      assetId: f.assetId,
      ordinal: f.ordinal,
      nameAr: f.nameAr,
      nameEn: f.nameEn,
      layer: f.layer,
      personalData: f.personalData,
      locked: !canSeeField(principal, f.datasetId, f.layer),
    }));
}

/** Builds the record a caller receives from the stored field_values, one key
    at a time from the allowlisted, unlocked columns. It never spreads or
    forwards the stored object as a whole, so a locked field's value can
    never leak through an unexpected key. Personal data (R6) is masked
    unless the principal's grant explicitly includes it. */
export function projectRecord(
  principal: NcecPrincipal | null,
  columns: ColumnMeta[],
  values: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of columns) {
    if (c.locked) continue;
    if (!(c.assetId in values)) continue;
    const raw = values[c.assetId];
    if (raw === null || raw === undefined) continue;
    out[c.assetId] = c.personalData !== "none" && !principal?.includePersonalData ? PERSONAL_MASK : raw;
  }
  return out;
}
