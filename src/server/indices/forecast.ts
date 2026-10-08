// CR05 4.6: the index forecasting engine. Pure TypeScript over passed-in
// inputs: no database, no services, no globals, so the same module runs on
// the server (official forecasts, 5,000 runs) and in the browser (the what-if
// simulator, 1,000 runs). Deterministic given inputs: the Monte Carlo uses a
// seeded PRNG. Unit tests in tests/forecast.test.ts.

export type SignalInput = {
  id: string;
  title: string;
  /** +1 favourable for the home country, -1 unfavourable, 0 neutral or mixed */
  sentiment: 1 | -1 | 0;
  impact: "high" | "medium" | "low";
  horizon: "short" | "mid" | "long";
  ageMonths: number;
};

export type TargetInput = {
  year: number;
  score: number | null;
  rank: number | null;
  status: string; // on_track | at_risk | delayed | ...
};

export type ForecastAssumptions = {
  /** multiplier on the signal adjustment, 0..2, default 1 */
  signalStrength: number;
  /** multiplier on the target pull weight, 0..2, default 1 */
  targetPullWeight: number;
  /** history window in years counted back from the latest year, default 15 */
  historyWindowYears: number;
  /** manual what-if shock in score points added to every horizon, default 0 */
  manualShock: number;
};

export const DEFAULT_ASSUMPTIONS: ForecastAssumptions = {
  signalStrength: 1,
  targetPullWeight: 1,
  historyWindowYears: 15,
  manualShock: 0,
};

export type ForecastInputs = {
  higherIsBetter: boolean;
  scoreMin: number;
  scoreMax: number;
  latestYear: number;
  /** the country's series, ascending years; scores (or ranks when
      usingRankFallback, already sign-flipped so higher = better) */
  series: { year: number; value: number }[];
  usingRankFallback: boolean;
  signals: SignalInput[];
  target: TargetInput | null;
  /** other countries' forecast values per horizon (peer Holt drift is
      computed once, outside the engine) for rank derivation */
  peerValues: { h1: number[]; h3: number[]; h5: number[]; latest: number[] };
  /** The home country's latest published rank, the anchor when the stored peer pool is
      only a sample of the index (rank movement within the pool is applied to
      the anchor instead of pretending the pool is the whole field) */
  latestRank: number | null;
  totalCountries: number | null;
  assumptions: ForecastAssumptions;
  runs: number; // 5000 official, 1000 what-if
  seed: number;
  /** CR08 4.1: the forecast mode. "rank" and "score" leave the engine as it
      was (the series compute.ts assembled is what gets forecast, in -rank or
      score units); "target_gap" forecasts a national indicator's value series
      and measures the gap to its target (see targetGap and TargetGapResult). */
  mode?: "rank" | "score" | "target_gap";
  /** the national target for target_gap mode, in series units */
  targetGap?: { value: number; year: number } | null;
};

/* ------------------------------------------------------------------ */
/* CR08 4.1: target_gap mode                                            */
/* ------------------------------------------------------------------ */
/*
  A national indicator carries a numeric target and a target year (National Environment Strategy).
  The engine keeps the same machinery, Holt or damped baseline on the value
  series, bounded signal adjustment, and the seeded bootstrap Monte Carlo,
  and adds one simulated horizon at the target year. Two things differ:

  1. The target pull is switched off. Pulling the path toward the target and
     then measuring the distance to it would be circular; the gap must read
     the historical trajectory, not the aspiration.
  2. The scale of the bounded adjustment and of the residual floors is the
     larger of the distance to the target and the observed range of the
     series, because national indicators have open scales (persons, SAR
     billion, percentage points) rather than a 0-100 score.

  The gap is direction-corrected: gap = (target - value) * (higherIsBetter
  ? 1 : -1), so a positive gap always means "short of the target". The
  result reports the gap today, the central/low/high value at the target
  year, the share of simulation runs that reach the target by that year,
  the pace per year the target needs against the fitted trend per year, and
  the first year in which the central path reaches the target (null when it
  does not within fifteen years). The horizons 1/3/5 keep their shape so the
  stored forecast rows are identical to the other modes.
*/

export type TargetGapResult = {
  targetValue: number;
  targetYear: number;
  /** years between the latest observation and the target year, 1..15 */
  horizonYears: number;
  /** the gap today; positive = short of the target (series units) */
  gapNow: number;
  /** simulated value at the target year */
  central: number;
  low: number;
  high: number;
  /** central gap at the target year; positive = short of the target */
  gapCentral: number;
  /** share of simulation runs that meet the target by the target year */
  probability: number;
  /** change per year the target needs from the latest value (signed, raw units) */
  requiredPacePerYear: number;
  /** the fitted one-step trend per year (signed, raw units) */
  trendPerYear: number;
  /** first year the central path reaches the target; null if not within 15 years */
  closingYear: number | null;
};

export type HorizonResult = {
  horizon: 1 | 3 | 5;
  year: number;
  baseline: number;
  signalAdjustment: number;
  targetPull: number;
  central: number;
  low: number;
  high: number;
  rankCentral: number | null;
  rankLow: number | null;
  rankHigh: number | null;
};

export type SignalContribution = {
  id: string;
  title: string;
  weight: number;
  /** score points contributed to the +3 adjustment */
  contribution: number;
};

export type ForecastResult = {
  method: "holt" | "damped";
  alpha: number;
  beta: number;
  residualSd: number;
  widened: boolean;
  fitted: number[];
  residuals: number[];
  horizons: HorizonResult[];
  signalContributions: SignalContribution[];
  direction: "up" | "down" | "stable";
  sensitivity: { key: string; impact: number }[];
  /** per-horizon simulated distribution summaries for the histogram chart */
  histograms: { horizon: 1 | 3 | 5; bins: { x0: number; x1: number; n: number }[] }[];
  /** the mode the engine ran in */
  mode: "rank" | "score" | "target_gap";
  /** target_gap mode only */
  targetGap?: TargetGapResult;
};

/* ------------------------------------------------------------------ */
/* deterministic PRNG (mulberry32)                                     */
/* ------------------------------------------------------------------ */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* 1. baseline: Holt linear exponential smoothing                      */
/* ------------------------------------------------------------------ */

export type HoltFit = {
  alpha: number;
  beta: number;
  level: number;
  trend: number;
  fitted: number[];
  residuals: number[];
  sse: number;
};

/** One Holt pass with fixed parameters; returns the end state and the
    one-step-ahead fit. */
export function holtPass(values: number[], alpha: number, beta: number): HoltFit {
  let level = values[0];
  let trend = values.length > 1 ? values[1] - values[0] : 0;
  const fitted: number[] = [];
  const residuals: number[] = [];
  let sse = 0;
  for (let i = 1; i < values.length; i++) {
    const forecast = level + trend;
    fitted.push(forecast);
    const e = values[i] - forecast;
    residuals.push(e);
    sse += e * e;
    const prevLevel = level;
    level = alpha * values[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  return { alpha, beta, level, trend, fitted, residuals, sse };
}

/** Fits alpha and beta by grid search over one-step-ahead squared error. */
export function fitHolt(values: number[]): HoltFit {
  let best: HoltFit | null = null;
  for (let a = 5; a <= 95; a += 5) {
    for (let b = 5; b <= 95; b += 5) {
      const fit = holtPass(values, a / 100, b / 100);
      if (!best || fit.sse < best.sse) best = fit;
    }
  }
  return best!;
}

/** Damped linear trend for short series (fewer than 5 points): ordinary
    least squares slope damped by phi per step ahead. */
export function dampedTrend(values: number[]): {
  level: number;
  trend: number;
  phi: number;
  fitted: number[];
  residuals: number[];
} {
  const n = values.length;
  const phi = 0.8;
  if (n === 1) {
    return { level: values[0], trend: 0, phi, fitted: [], residuals: [] };
  }
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) * (i - xMean);
  }
  const slope = den ? num / den : 0;
  const intercept = yMean - slope * xMean;
  const fitted: number[] = [];
  const residuals: number[] = [];
  for (let i = 1; i < n; i++) {
    const f = intercept + slope * i;
    fitted.push(f);
    residuals.push(values[i] - f);
  }
  return { level: values[n - 1], trend: slope, phi, fitted, residuals };
}

/** Point forecast h steps ahead. */
function pointForecast(
  method: "holt" | "damped",
  level: number,
  trend: number,
  phi: number,
  h: number
): number {
  if (method === "holt") return level + trend * h;
  // damped: level + trend * (phi + phi^2 + ... + phi^h)
  let s = 0;
  for (let i = 1; i <= h; i++) s += Math.pow(phi, i);
  return level + trend * s;
}

/* ------------------------------------------------------------------ */
/* 2. signal adjustment                                                */
/* ------------------------------------------------------------------ */

const IMPACT_WEIGHT: Record<SignalInput["impact"], number> = {
  high: 1.0,
  medium: 0.5,
  low: 0.25,
};

/** Signal horizon vs forecast horizon: match 1.0, adjacent 0.5, else 0.25. */
export function horizonRelevance(signal: SignalInput["horizon"], h: 1 | 3 | 5): number {
  const order: SignalInput["horizon"][] = ["short", "mid", "long"];
  const hIndex = h === 1 ? 0 : h === 3 ? 1 : 2;
  const sIndex = order.indexOf(signal);
  const d = Math.abs(hIndex - sIndex);
  return d === 0 ? 1 : d === 1 ? 0.5 : 0.25;
}

export function signalWeight(s: SignalInput, h: 1 | 3 | 5): number {
  return (
    IMPACT_WEIGHT[s.impact] *
    horizonRelevance(s.horizon, h) *
    Math.exp(-s.ageMonths / 12)
  );
}

/** The bounded adjustment cap per horizon as a share of the score range. */
export const ADJUSTMENT_CAP_PCT: Record<1 | 3 | 5, number> = {
  1: 0.04,
  3: 0.08,
  5: 0.1,
};

/** Maps a weighted sentiment sum through tanh to at most the cap. The result
    is in "goodness" points (positive = better), sign-corrected later. */
export function boundedAdjustment(
  weightedSum: number,
  h: 1 | 3 | 5,
  range: number,
  strength: number
): number {
  const cap = ADJUSTMENT_CAP_PCT[h] * range;
  return cap * Math.tanh(weightedSum * strength * 0.6);
}

/* ------------------------------------------------------------------ */
/* 3. target pull                                                      */
/* ------------------------------------------------------------------ */

export const TARGET_PULL_WEIGHT: Record<1 | 3 | 5, number> = { 1: 0.3, 3: 0.5, 5: 0.6 };

export function targetStatusScale(status: string): number {
  if (status === "on_track" || status === "completed") return 1;
  if (status === "at_risk") return 0.6;
  if (status === "delayed") return 0.3;
  return 0.6;
}

/* ------------------------------------------------------------------ */
/* percentiles                                                          */
/* ------------------------------------------------------------------ */

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/* ------------------------------------------------------------------ */
/* rank derivation                                                      */
/* ------------------------------------------------------------------ */

/** 5. Rank = 1 + peers strictly better; peers already hold their own
    drifted values for the horizon. Values are in "display" units where
    higherIsBetter tells the direction. */
export function deriveRank(
  value: number,
  peers: number[],
  higherIsBetter: boolean
): number {
  let better = 0;
  for (const p of peers) {
    if (higherIsBetter ? p > value : p < value) better++;
  }
  return 1 + better;
}

/* ------------------------------------------------------------------ */
/* the engine                                                           */
/* ------------------------------------------------------------------ */

export function runForecast(inputs: ForecastInputs): ForecastResult {
  const {
    higherIsBetter,
    scoreMin,
    scoreMax,
    latestYear,
    usingRankFallback,
    signals,
    target,
    peerValues,
    assumptions,
    runs,
    seed,
  } = inputs;

  // history window
  const windowStart = latestYear - Math.max(3, assumptions.historyWindowYears);
  const series = inputs.series
    .filter((p) => p.year >= Math.max(2010, windowStart))
    .sort((a, b) => a.year - b.year);
  const values = series.map((p) => p.value);
  if (!values.length) throw new Error("empty series");

  // CR08 4.1: target_gap runs on the value series (never on ranks)
  const gapTarget =
    inputs.mode === "target_gap" && inputs.targetGap && !usingRankFallback
      ? inputs.targetGap
      : null;
  const mode: ForecastResult["mode"] = gapTarget
    ? "target_gap"
    : usingRankFallback
      ? "rank"
      : "score";

  const range = usingRankFallback
    ? Math.max(20, Math.abs(values[values.length - 1]) * 0.5)
    : gapTarget
      ? Math.max(
          Math.abs(gapTarget.value - values[values.length - 1]),
          Math.max(...values) - Math.min(...values),
          Math.abs(values[values.length - 1]) * 0.1,
          1e-6
        )
      : scoreMax - scoreMin;

  // 1. baseline
  let method: "holt" | "damped";
  let level: number;
  let trend: number;
  let phi = 1;
  let alpha = 0;
  let beta = 0;
  let fitted: number[] = [];
  let residuals: number[] = [];
  let widened = false;
  if (values.length >= 5) {
    method = "holt";
    const fit = fitHolt(values);
    alpha = fit.alpha;
    beta = fit.beta;
    level = fit.level;
    trend = fit.trend;
    fitted = fit.fitted;
    residuals = fit.residuals;
  } else {
    method = "damped";
    widened = true;
    const fit = dampedTrend(values);
    level = fit.level;
    trend = fit.trend;
    phi = fit.phi;
    fitted = fit.fitted;
    residuals = fit.residuals;
  }
  let residualSd = residuals.length
    ? Math.sqrt(residuals.reduce((s, e) => s + e * e, 0) / residuals.length)
    : range * 0.02;
  if (widened) residualSd = Math.max(residualSd * 1.75, range * 0.03);
  if (residualSd === 0) residualSd = range * 0.005;

  const latest = values[values.length - 1];
  // "goodness" direction of the stored series: rank fallback stores -rank so
  // higher is always better there; score series follow the index direction
  const sign = usingRankFallback ? 1 : higherIsBetter ? 1 : -1;

  // 2. per-signal weights (stored at the +3 horizon for the contributions)
  const weightedSum = (h: 1 | 3 | 5, perturb?: (i: number) => number): number => {
    let sum = 0;
    for (let i = 0; i < signals.length; i++) {
      const s = signals[i];
      sum += s.sentiment * signalWeight(s, h) * (perturb ? perturb(i) : 1);
    }
    return sum;
  };

  // 3. target value in series units (the pull is off in target_gap mode:
  //    the gap must read the trajectory, not the aspiration)
  let targetValue: number | null = null;
  if (target && !gapTarget) {
    if (target.score != null && !usingRankFallback) targetValue = target.score;
    else if (target.rank != null && usingRankFallback) targetValue = -target.rank; // rank fallback stores -rank so higher = better
    else if (target.score != null && usingRankFallback) targetValue = null;
  }
  const statusScale = target ? targetStatusScale(target.status) : 0;

  const horizonsSpec: (1 | 3 | 5)[] = [1, 3, 5];
  // the target year joins the simulated horizons in target_gap mode
  const gapHorizon = gapTarget
    ? Math.max(1, Math.min(15, gapTarget.year - latestYear))
    : null;
  const simHorizons: number[] = [...horizonsSpec];
  if (gapHorizon != null && !simHorizons.includes(gapHorizon)) simHorizons.push(gapHorizon);

  const centralOf = (
    h: number,
    opts: {
      signalFactor?: (i: number) => number;
      pullDelta?: number;
      residualDraw?: number;
      strength?: number;
      pullMult?: number;
      shock?: number;
    } = {}
  ): { value: number; baseline: number; adj: number; pull: number } => {
    // the signal caps and the pull weights are defined at 1/3/5; other
    // horizons (the target year) borrow the nearest of the three
    const hs: 1 | 3 | 5 = h <= 2 ? 1 : h <= 4 ? 3 : 5;
    const baseline = pointForecast(method, level, trend, phi, h) + (opts.residualDraw ?? 0);
    const adj =
      sign *
      boundedAdjustment(
        weightedSum(hs, opts.signalFactor),
        hs,
        range,
        (opts.strength ?? assumptions.signalStrength)
      );
    let value = baseline + adj;
    let pull = 0;
    if (targetValue != null) {
      const baseW = TARGET_PULL_WEIGHT[hs] * statusScale * (opts.pullMult ?? assumptions.targetPullWeight);
      const w = Math.max(0, Math.min(1, baseW + (opts.pullDelta ?? 0)));
      const pulled = value * (1 - w) + targetValue * w;
      pull = pulled - value;
      value = pulled;
    }
    // the manual shock is expressed as an improvement in score points
    value += (opts.shock ?? assumptions.manualShock) * sign;
    if (!usingRankFallback) value = Math.max(scoreMin, Math.min(scoreMax, value));
    return { value, baseline, adj, pull };
  };

  // 4. simulation
  const rand = mulberry32(seed);
  const sims: Record<number, number[]> = {};
  for (const h of simHorizons) sims[h] = [];
  const nRuns = Math.max(100, runs);
  for (let r = 0; r < nRuns; r++) {
    const factors = signals.map(() => 0.5 + rand());
    const pullDelta = (rand() * 2 - 1) * 0.15;
    for (const h of simHorizons) {
      // bootstrap: sum h resampled residuals for the cumulative path error
      let draw = 0;
      for (let i = 0; i < h; i++) {
        draw += residuals.length
          ? residuals[Math.floor(rand() * residuals.length)]
          : (rand() * 2 - 1) * residualSd;
      }
      if (widened) draw *= 1.5;
      const res = centralOf(h, {
        signalFactor: (i) => factors[i],
        pullDelta,
        residualDraw: draw,
      });
      sims[h].push(res.value);
    }
  }

  // is the stored pool essentially the whole ranked field? (bulk-file
  // indices) or only the focus sample? (report-extracted indices)
  const poolIsFull =
    inputs.totalCountries != null &&
    peerValues.latest.length + 1 >= 0.6 * inputs.totalCountries;
  const rankDirection = usingRankFallback ? true : higherIsBetter;
  const anchorPeerRank = peerValues.latest.length
    ? deriveRank(latest, peerValues.latest, rankDirection)
    : null;

  const horizons: HorizonResult[] = horizonsSpec.map((h) => {
    const centralParts = centralOf(h);
    const sorted = [...sims[h]].sort((a, b) => a - b);
    const p10 = percentile(sorted, 0.1);
    const p50 = percentile(sorted, 0.5);
    const p90 = percentile(sorted, 0.9);
    // low/high in "better/worse" terms follow the score axis as stored
    const low = Math.min(p10, p90);
    const high = Math.max(p10, p90);
    const peers = h === 1 ? peerValues.h1 : h === 3 ? peerValues.h3 : peerValues.h5;
    const toRank = (v: number): number | null => {
      if (!peers.length) return null;
      const peerRank = deriveRank(v, peers, rankDirection);
      if (poolIsFull) return peerRank;
      // sample pool: apply the movement within the pool to the published
      // anchor rank rather than pretending the pool is the whole field
      if (inputs.latestRank == null || anchorPeerRank == null) return null;
      const moved = inputs.latestRank + (peerRank - anchorPeerRank);
      const cap = inputs.totalCountries ?? Number.POSITIVE_INFINITY;
      return Math.max(1, Math.min(cap, moved));
    };
    const rankCentral = toRank(p50);
    // a better score gives a better (smaller) rank: high score -> low rank
    const rankFromHigh = toRank(high);
    const rankFromLow = toRank(low);
    return {
      horizon: h,
      year: latestYear + h,
      baseline: centralParts.baseline,
      signalAdjustment: centralParts.adj,
      targetPull: centralParts.pull,
      central: p50,
      low,
      high,
      rankCentral,
      rankLow: rankFromHigh == null || rankFromLow == null ? null : Math.min(rankFromHigh, rankFromLow),
      rankHigh: rankFromHigh == null || rankFromLow == null ? null : Math.max(rankFromHigh, rankFromLow),
    };
  });

  // per-signal contributions at +3 (marginal: with vs without the signal)
  const signalContributions: SignalContribution[] = signals.map((s, i) => {
    const w = signalWeight(s, 3);
    const withAll = sign * boundedAdjustment(weightedSum(3), 3, range, assumptions.signalStrength);
    const without =
      sign *
      boundedAdjustment(
        weightedSum(3, (j) => (j === i ? 0 : 1)),
        3,
        range,
        assumptions.signalStrength
      );
    return { id: s.id, title: s.title, weight: w, contribution: withAll - without };
  });

  // 6. direction over the +3 central vs the latest observed value
  const h3 = horizons[1];
  const betterBy = (h3.central - latest) * sign;
  const direction: "up" | "down" | "stable" =
    betterBy > residualSd ? "up" : betterBy < -residualSd ? "down" : "stable";

  // sensitivity: which input moves the +3 central most
  const base3 = h3.central;
  const probe = (opts: Parameters<typeof centralOf>[1]): number =>
    Math.abs(centralOf(3, opts).value - centralOf(3).value);
  const sensitivity = [
    { key: "signal_strength", impact: probe({ strength: assumptions.signalStrength * 1.5 }) },
    { key: "target_pull", impact: probe({ pullMult: assumptions.targetPullWeight * 1.5 }) },
    { key: "manual_shock", impact: Math.abs(centralOf(3, { shock: assumptions.manualShock + 1 }).value - base3) },
    {
      key: "history_window",
      impact: Math.abs(trend) * 1.5, // a shorter window mostly moves the trend
    },
  ]
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3);

  // histograms (12 bins per horizon) for the simulation chart
  const histograms = horizonsSpec.map((h) => {
    const arr = [...sims[h]].sort((a, b) => a - b);
    const min = arr[0];
    const max = arr[arr.length - 1];
    const span = max - min || 1;
    const bins = Array.from({ length: 12 }, (_, i) => ({
      x0: min + (span * i) / 12,
      x1: min + (span * (i + 1)) / 12,
      n: 0,
    }));
    for (const v of arr) {
      const idx = Math.min(11, Math.floor(((v - min) / span) * 12));
      bins[idx].n++;
    }
    return { horizon: h, bins };
  });

  // 7. CR08 4.1: the gap to the national target
  let targetGap: TargetGapResult | undefined;
  if (gapTarget && gapHorizon != null) {
    const gapOf = (v: number) => (gapTarget.value - v) * sign;
    const runsAtTarget = [...sims[gapHorizon]].sort((a, b) => a - b);
    const p10 = percentile(runsAtTarget, 0.1);
    const p50 = percentile(runsAtTarget, 0.5);
    const p90 = percentile(runsAtTarget, 0.9);
    const reached = runsAtTarget.filter((v) => gapOf(v) <= 0).length;
    const gapNow = gapOf(latest);
    let closingYear: number | null = gapNow <= 0 ? latestYear : null;
    if (closingYear == null) {
      for (let h = 1; h <= 15; h++) {
        if (gapOf(centralOf(h).value) <= 0) {
          closingYear = latestYear + h;
          break;
        }
      }
    }
    targetGap = {
      targetValue: gapTarget.value,
      targetYear: gapTarget.year,
      horizonYears: gapHorizon,
      gapNow,
      central: p50,
      low: Math.min(p10, p90),
      high: Math.max(p10, p90),
      gapCentral: gapOf(p50),
      probability: runsAtTarget.length ? reached / runsAtTarget.length : 0,
      requiredPacePerYear: (gapTarget.value - latest) / gapHorizon,
      trendPerYear: pointForecast(method, level, trend, phi, 1) - level,
      closingYear,
    };
  }

  return {
    method,
    alpha,
    beta,
    residualSd,
    widened,
    fitted,
    residuals,
    horizons,
    signalContributions,
    direction,
    sensitivity,
    histograms,
    mode,
    targetGap,
  };
}
