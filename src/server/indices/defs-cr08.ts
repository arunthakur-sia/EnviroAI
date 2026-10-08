// CR08 4.1: the index definitions added by the research agents and the Saudi
// water, agriculture and climate additions (defs-ksa.ts), merged into one
// list the fetcher appends to the CR05 indices, plus the group memberships of
// those. The group codes are fixed (see scripts/cr08-indices-seed.ts
// INDEX_GROUPS): sdg, national, environment, climate, water, agriculture,
// governance, human.
//
// Keep this module free of runtime imports from ./fetcher (fetcher imports it
// at module load, so a value import back would form a cycle); the IndexDef
// import below is type-only and erased.
import type { IndexDef } from "./fetcher";
import { CR08_INDEX_DEFS_A } from "./defs-cr08-a";
import { CR08_INDEX_DEFS_B } from "./defs-cr08-b";
import { KSA_INDEX_DEFS } from "./defs-ksa";

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

export const CR08_INDEX_DEFS: Cr08IndexDef[] = [...CR08_INDEX_DEFS_A, ...CR08_INDEX_DEFS_B, ...KSA_INDEX_DEFS];

/** Group memberships of the CR05 indices that remain in the register. */
export const EXISTING_INDEX_GROUPS: Record<string, string[]> = {
  hdi: ["human"],
  cpi: ["governance"],
  epi: ["environment", "climate"],
};
