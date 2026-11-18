// Stored access row -> NCEC principal (src/server/ncec/access.ts).
import { describe, expect, it } from "vitest";
import { principalFromAccess, type AccessRow } from "@/server/ncec/access";

const NOW = Date.parse("2026-11-18T00:00:00Z");
const L2: AccessRow = { baseLayer: 2, grantedDatasetIds: [], includePersonalData: false, allowExport: false, grantExpiresAt: null };

describe("principalFromAccess", () => {
  it("gives no NCEC access without a row, or with base layer 1", () => {
    expect(principalFromAccess("u", null, NOW)).toBeNull();
    expect(principalFromAccess("u", { ...L2, baseLayer: 1 }, NOW)).toBeNull();
  });

  it("maps an L2 row to an L2 principal with no grants", () => {
    const p = principalFromAccess("u", L2, NOW)!;
    expect(p.baseLayer).toBe(2);
    expect(p.grantedDatasetIds).toEqual([]);
  });

  it("keeps an active grant, still on base layer 2 (L3 is never blanket)", () => {
    const p = principalFromAccess("u", { ...L2, grantedDatasetIds: ["DS-016"], grantExpiresAt: "2026-12-18T00:00:00Z" }, NOW)!;
    expect(p.baseLayer).toBe(2);
    expect(p.grantedDatasetIds).toEqual(["DS-016"]);
    expect(p.grantExpiresAt).toBe("2026-12-18T00:00:00.000Z");
  });

  it("drops a lapsed or undated grant back to plain L2", () => {
    const lapsed = principalFromAccess("u", { ...L2, grantedDatasetIds: ["DS-016"], grantExpiresAt: "2026-11-01T00:00:00Z", allowExport: true }, NOW)!;
    expect(lapsed.grantedDatasetIds).toEqual([]);
    expect(lapsed.allowExport).toBe(false);
    const undated = principalFromAccess("u", { ...L2, grantedDatasetIds: ["DS-016"] }, NOW)!;
    expect(undated.grantedDatasetIds).toEqual([]);
  });
});
