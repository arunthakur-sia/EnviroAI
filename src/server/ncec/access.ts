// Turns a stored NCEC access row into the principal every NCEC page and API
// route works with. Pure (no DB), so it is unit-tested directly.
import type { NcecPrincipal } from "./types";

export type AccessRow = {
  baseLayer: number;
  grantedDatasetIds: string[];
  includePersonalData: boolean;
  allowExport: boolean;
  grantExpiresAt: string | null;
};

/** No row, or base layer 1, means no NCEC access at all (null). L3 is never
    a base layer (brief R4): it is base layer 2 plus a grant naming specific
    datasets. A lapsed grant falls back to plain L2, never to L3. */
export function principalFromAccess(userId: string, row: AccessRow | null, now: number = Date.now()): NcecPrincipal | null {
  if (!row || row.baseLayer !== 2) return null;
  const expiresMs = row.grantExpiresAt ? Date.parse(row.grantExpiresAt) : NaN;
  const grantActive = row.grantedDatasetIds.length > 0 && Number.isFinite(expiresMs) && expiresMs > now;
  return {
    userId,
    baseLayer: 2,
    grantedDatasetIds: grantActive ? [...row.grantedDatasetIds] : [],
    includePersonalData: grantActive && row.includePersonalData,
    allowExport: grantActive && row.allowExport,
    grantExpiresAt: grantActive ? new Date(expiresMs).toISOString() : null,
    source: "db",
  };
}
