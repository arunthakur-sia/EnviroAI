// Pure access-control rules for the NCEC data layer (ui-plan.md s3.2). These
// run with no database: canSeeField, isDatasetLocked, columnsFor and
// projectRecord are plain functions over fabricated rows.
import { describe, expect, it } from "vitest";
import { canSeeField, columnsFor, isDatasetLocked, projectRecord, type RawField } from "@/server/ncec/policy";
import { PERSONAL_MASK, type NcecPrincipal } from "@/server/ncec/types";

const L2: NcecPrincipal = {
  userId: "u1",
  baseLayer: 2,
  grantedDatasetIds: [],
  includePersonalData: false,
  allowExport: false,
  grantExpiresAt: null,
  source: "db",
};
// L3 is never a blanket layer (brief R4): the principal's own login stays
// baseLayer 2, and only a named grant opens specific L3 datasets.
const L3: NcecPrincipal = {
  ...L2,
  grantedDatasetIds: ["DS-016"],
};
const L3_WITH_PERSONAL: NcecPrincipal = { ...L3, includePersonalData: true };

describe("canSeeField", () => {
  it("denies everything to a null principal (no NCEC access)", () => {
    expect(canSeeField(null, "DS-001", 1)).toBe(false);
  });

  it("lets a caller see a field at or below their own layer", () => {
    expect(canSeeField(L2, "DS-001", 1)).toBe(true);
    expect(canSeeField(L2, "DS-001", 2)).toBe(true);
  });

  it("denies an L3 field to L2, even on an unrelated dataset", () => {
    expect(canSeeField(L2, "DS-016", 3)).toBe(false);
  });

  it("grants an L3 field only on a dataset the principal's grant actually names", () => {
    expect(canSeeField(L3, "DS-016", 3)).toBe(true);
    expect(canSeeField(L3, "DS-038-not-granted", 3)).toBe(false);
  });
});

describe("isDatasetLocked", () => {
  const mixedFields = [
    { datasetId: "DS-018", layer: 2 as const, fieldKind: "field" as const },
    { datasetId: "DS-018", layer: 3 as const, fieldKind: "field" as const },
  ];
  const allL3Fields = [
    { datasetId: "DS-016", layer: 3 as const, fieldKind: "field" as const },
    { datasetId: "DS-016", layer: 3 as const, fieldKind: "field" as const },
  ];

  it("is not locked when at least one field is visible (a mixed dataset)", () => {
    expect(isDatasetLocked(L2, mixedFields)).toBe(false);
  });

  it("is locked for L2 when every field is above L2 and ungranted", () => {
    expect(isDatasetLocked(L2, allL3Fields)).toBe(true);
  });

  it("unlocks for L3 once the dataset is in the grant", () => {
    expect(isDatasetLocked(L3, allL3Fields)).toBe(false);
  });

  it("ignores group labels (pure layout, never gates access)", () => {
    const onlyLabels = [{ datasetId: "DS-x", layer: 2 as const, fieldKind: "group_label" as const }];
    expect(isDatasetLocked(L2, onlyLabels)).toBe(false);
  });

  it("locks a dataset whose only row is an un-itemised Top Secret placeholder", () => {
    // several corporate datasets (e.g. DS-085) have no named fields yet, only
    // a dataset_placeholder row carrying the register's own classification
    const placeholderOnly = [{ datasetId: "DS-085", layer: 3 as const, fieldKind: "dataset_placeholder" as const }];
    expect(isDatasetLocked(L2, placeholderOnly)).toBe(true);
    expect(isDatasetLocked(L3, placeholderOnly)).toBe(true); // L3's grant doesn't name DS-085, so it stays locked
    const grantedPlaceholder = [{ datasetId: "DS-016", layer: 3 as const, fieldKind: "dataset_placeholder" as const }];
    expect(isDatasetLocked(L3, grantedPlaceholder)).toBe(false); // unlocks once the grant actually covers it
  });
});

describe("columnsFor / projectRecord", () => {
  const fields: RawField[] = [
    { assetId: "DMO-001", datasetId: "DS-016", ordinal: 1, fieldKind: "field", nameAr: null, nameEn: "Facility name", layer: 3, personalData: "none" },
    { assetId: "DMO-002", datasetId: "DS-016", ordinal: 2, fieldKind: "field", nameAr: null, nameEn: "Penalty", layer: 3, personalData: "none" },
    { assetId: "DMO-003", datasetId: "DS-016", ordinal: 3, fieldKind: "group_label", nameAr: null, nameEn: "A heading", layer: 2, personalData: "none" },
  ];
  const values = { "DMO-001": "Dummy Facility 001", "DMO-002": 154000 };

  it("never builds a column for a group label", () => {
    const cols = columnsFor(L3, fields);
    expect(cols.map((c) => c.assetId)).toEqual(["DMO-001", "DMO-002"]);
  });

  it("marks columns locked for a caller without the grant", () => {
    const cols = columnsFor(L2, fields);
    expect(cols.every((c) => c.locked)).toBe(true);
  });

  it("projectRecord drops every locked column's value entirely (no key at all)", () => {
    const cols = columnsFor(L2, fields);
    const out = projectRecord(L2, cols, values);
    expect(out).toEqual({});
    expect(Object.keys(out)).not.toContain("DMO-001");
  });

  it("projectRecord returns visible values for a granted L3 caller", () => {
    const cols = columnsFor(L3, fields);
    const out = projectRecord(L3, cols, values);
    expect(out).toEqual({ "DMO-001": "Dummy Facility 001", "DMO-002": 154000 });
  });

  it("masks personal data by default, even for L3", () => {
    const personalFields: RawField[] = [
      { assetId: "DMO-900", datasetId: "DS-038", ordinal: 1, fieldKind: "field", nameAr: null, nameEn: "Reporter name", layer: 3, personalData: "personal" },
    ];
    const personalGrant: NcecPrincipal = { ...L3, grantedDatasetIds: ["DS-038"] };
    const cols = columnsFor(personalGrant, personalFields);
    const out = projectRecord(personalGrant, cols, { "DMO-900": "مبلغ تجريبي 001" });
    expect(out["DMO-900"]).toBe(PERSONAL_MASK);
  });

  it("reveals personal data only when the grant explicitly includes it", () => {
    const personalFields: RawField[] = [
      { assetId: "DMO-900", datasetId: "DS-038", ordinal: 1, fieldKind: "field", nameAr: null, nameEn: "Reporter name", layer: 3, personalData: "personal" },
    ];
    const grant: NcecPrincipal = { ...L3_WITH_PERSONAL, grantedDatasetIds: ["DS-038"] };
    const cols = columnsFor(grant, personalFields);
    const out = projectRecord(grant, cols, { "DMO-900": "مبلغ تجريبي 001" });
    expect(out["DMO-900"]).toBe("مبلغ تجريبي 001");
  });

  it("never forwards a value that was not in the allowlisted columns", () => {
    const cols = columnsFor(L3, fields);
    const out = projectRecord(L3, cols, { ...values, "DMO-999-not-a-column": "leak" });
    expect(out).not.toHaveProperty("DMO-999-not-a-column");
  });
});
