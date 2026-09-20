// CR08 4.1: the index definitions added by the two research agents, merged
// into one list the fetcher appends to the CR05 twelve, plus the group
// memberships of those twelve. The group codes are fixed (see
// scripts/cr08-indices-seed.ts INDEX_GROUPS): sdg, national, competitiveness,
// gallup, governance, human, environment, peace, digital.
//
// Keep this module free of runtime imports from ./fetcher (fetcher imports it
// at module load, so a value import back would form a cycle); the IndexDef
// import below is type-only and erased.
import type { IndexDef } from "./fetcher";
import { CR08_INDEX_DEFS_A } from "./defs-cr08-a";
import { CR08_INDEX_DEFS_B } from "./defs-cr08-b";

export type Cr08IndexDef = IndexDef & {
  /** group codes the index belongs to (an index may sit in several groups) */
  groups: string[];
  /** SDG goal number for the seventeen goal records */
  sdgGoal?: number;
  /** official SDG palette colour, used only as a small chip */
  sdgColour?: string;
  /** forecast engine mode; undefined lets compute.ts decide per data shape */
  forecastMode?: "rank" | "score" | "target_gap";
  /** false switches forecasting off for the index (nothing to forecast) */
  forecastEnabled?: boolean;
  /** extra research file under sources/indices/research/ (cr08-<code>.json is
      always read); the same JSON shape as the CR05 extractions */
  researchFile?: string;
};

export const CR08_INDEX_DEFS: Cr08IndexDef[] = [...CR08_INDEX_DEFS_A, ...CR08_INDEX_DEFS_B];

/** Group memberships of the twelve CR05 indices. */
export const EXISTING_INDEX_GROUPS: Record<string, string[]> = {
  hdi: ["human"],
  gii: ["competitiveness"],
  cpi: ["governance"],
  egdi: ["governance", "digital"],
  gpi: ["peace"],
  imd: ["competitiveness"],
  lpi: ["competitiveness"],
  nri: ["competitiveness", "digital"],
  ttdi: ["competitiveness"],
  epi: ["environment"],
  gtci: ["competitiveness", "human"],
  wjp: ["governance"],
};

/** Every def's groups plus the CR05 memberships, keyed by index code. */
export function groupsOfIndexCode(code: string): string[] {
  const def = CR08_INDEX_DEFS.find((d) => d.code === code);
  if (def) return def.groups;
  return EXISTING_INDEX_GROUPS[code] ?? [];
}
