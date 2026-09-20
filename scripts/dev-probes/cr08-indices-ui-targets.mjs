// CR08 4.2 (Indices UI agent): lists every index that carries a target with
// its forecast mode and its latest Qatar rank/score, so the rule in
// src/lib/index-targets.ts can be checked against real seeded rows rather
// than against the wizard's synthetic probe index.
//   node scripts/dev-probes/cr08-indices-ui-targets.mjs
import { createClient } from "@libsql/client";

const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
const rows = (
  await db.execute(`
    select i.code, i.forecast_mode, i.higher_is_better, i.target_value, i.target_year,
           (select rank from index_observations o where o.index_id = i.id and o.country_code = 'QAT' order by o.year desc limit 1) rank,
           (select score from index_observations o where o.index_id = i.id and o.country_code = 'QAT' order by o.year desc limit 1) score
    from indices i
    where i.target_value is not null and i.is_active = 1
    order by i.forecast_mode, i.code
  `)
).rows;

// the same rule as src/lib/index-targets.ts
const targetIsRank = (mode, rank, score) => {
  if (mode === "rank") return true;
  if (mode === "score" || mode === "target_gap") return false;
  if (rank != null) return true;
  return score == null;
};

console.log(`${rows.length} active indices carry a target\n`);
let ambiguous = 0;
for (const r of rows) {
  const isRank = targetIsRank(r.forecast_mode, r.rank, r.score);
  // an index whose mode is decided per data AND that has both a rank and a
  // score is the only case where the target reading and the forecast basis
  // could disagree
  const risky = (r.forecast_mode == null || r.forecast_mode === "auto") && r.rank != null && r.score != null;
  if (risky) ambiguous++;
  console.log(
    `${String(r.code).padEnd(24)} mode=${String(r.forecast_mode ?? "auto").padEnd(10)} target=${String(r.target_value).padEnd(8)} rank=${String(r.rank ?? "-").padEnd(5)} score=${String(r.score ?? "-").padEnd(8)} reads as ${isRank ? "RANK" : "score"}${risky ? "   <- auto mode with both" : ""}`
  );
}
console.log(
  ambiguous
    ? `\n${ambiguous} index(es) are on auto mode with both a rank and a score`
    : "\nno seeded index is on auto mode with both a rank and a score"
);

// do the forecast rows carry rank bounds? the +N tiles show a rank headline,
// so their range has to be a rank range too
const fc = (
  await db.execute(`
    select i.code, f.horizon_years h, f.central_rank, f.central_score, f.low, f.high, f.rank_low, f.rank_high
    from index_forecasts f join indices i on i.id = f.index_id
    where i.code in ('egdi', 'cpi', 'sdg_03', 'nat_lfpr_qatari')
    order by i.code, f.horizon_years
  `)
).rows;
console.log("\nforecast bounds on a few indices:");
for (const r of fc) {
  console.log(
    `  ${String(r.code).padEnd(16)} +${r.h}y  rank=${String(r.central_rank ?? "-").padEnd(6)} score=${String(r.central_score ?? "-").padEnd(8)} score band=[${r.low}, ${r.high}]  rank band=[${r.rank_low}, ${r.rank_high}]`
  );
}
const withRankCentral = fc.filter((r) => r.central_rank != null);
const missing = withRankCentral.filter((r) => r.rank_low == null || r.rank_high == null);
console.log(
  missing.length
    ? `\n${missing.length} of ${withRankCentral.length} rank forecasts have no rank band (the tile falls back to the score band)`
    : `\nevery one of the ${withRankCentral.length} rank forecasts carries a rank band`
);
db.close();
