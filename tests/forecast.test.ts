// CR05 4.6: unit tests for the index forecasting engine (baseline fit,
// adjustment bounds, target pull, simulation percentiles, rank derivation,
// direction). Pure module, no database.
import { describe, expect, it } from "vitest";
import {
  ADJUSTMENT_CAP_PCT,
  boundedAdjustment,
  DEFAULT_ASSUMPTIONS,
  deriveRank,
  fitHolt,
  horizonRelevance,
  mulberry32,
  percentile,
  runForecast,
  signalWeight,
  targetStatusScale,
  type ForecastInputs,
} from "../src/server/indices/forecast";

function baseInputs(over: Partial<ForecastInputs> = {}): ForecastInputs {
  return {
    higherIsBetter: true,
    scoreMin: 0,
    scoreMax: 100,
    latestYear: 2024,
    series: Array.from({ length: 10 }, (_, i) => ({
      year: 2015 + i,
      value: 50 + i * 1.2, // clean upward trend
    })),
    usingRankFallback: false,
    signals: [],
    target: null,
    peerValues: { h1: [], h3: [], h5: [], latest: [] },
    latestRank: null,
    totalCountries: 140,
    assumptions: { ...DEFAULT_ASSUMPTIONS },
    runs: 1000,
    seed: 42,
    ...over,
  };
}

describe("baseline fit", () => {
  it("recovers a linear trend with Holt smoothing", () => {
    const values = Array.from({ length: 12 }, (_, i) => 30 + 2 * i);
    const fit = fitHolt(values);
    // a perfect line: level near the last value, trend near 2
    expect(fit.level).toBeCloseTo(52, 0);
    expect(fit.trend).toBeCloseTo(2, 1);
    expect(fit.sse).toBeLessThan(1);
  });

  it("uses the damped path and widens uncertainty under 5 points", () => {
    const r = runForecast(
      baseInputs({
        series: [
          { year: 2021, value: 60 },
          { year: 2022, value: 61 },
          { year: 2023, value: 62 },
        ],
      })
    );
    expect(r.method).toBe("damped");
    expect(r.widened).toBe(true);
  });

  it("is deterministic for the same seed and differs across seeds", () => {
    // a noisy series so the bootstrap has residuals to resample
    const noisy = Array.from({ length: 12 }, (_, i) => ({
      year: 2013 + i,
      value: 50 + i * 1.2 + (i % 3 === 0 ? 1.6 : i % 3 === 1 ? -1.1 : 0.2),
    }));
    const a = runForecast(baseInputs({ series: noisy, seed: 7 }));
    const b = runForecast(baseInputs({ series: noisy, seed: 7 }));
    const c = runForecast(baseInputs({ series: noisy, seed: 8 }));
    expect(a.horizons[1].low).toBe(b.horizons[1].low);
    expect(a.horizons[1].low).not.toBe(c.horizons[1].low);
  });
});

describe("signal adjustment", () => {
  it("weights impact x horizon relevance x age decay", () => {
    const w = signalWeight(
      { id: "s", title: "", sentiment: 1, impact: "high", horizon: "mid", ageMonths: 12 },
      3
    );
    expect(w).toBeCloseTo(1 * 1 * Math.exp(-1), 5);
    expect(horizonRelevance("short", 1)).toBe(1);
    expect(horizonRelevance("short", 3)).toBe(0.5);
    expect(horizonRelevance("short", 5)).toBe(0.25);
  });

  it("never exceeds the per-horizon caps of the score range", () => {
    for (const h of [1, 3, 5] as const) {
      const extreme = boundedAdjustment(1000, h, 100, 1);
      expect(Math.abs(extreme)).toBeLessThanOrEqual(ADJUSTMENT_CAP_PCT[h] * 100 + 1e-9);
      expect(Math.abs(extreme)).toBeGreaterThan(ADJUSTMENT_CAP_PCT[h] * 100 * 0.99);
    }
    // symmetric for negative sums
    expect(boundedAdjustment(-1000, 3, 100, 1)).toBeCloseTo(-8, 5);
  });

  it("moves the central forecast in the sentiment's direction", () => {
    const positive = runForecast(
      baseInputs({
        signals: [
          { id: "a", title: "good", sentiment: 1, impact: "high", horizon: "mid", ageMonths: 1 },
        ],
      })
    );
    const none = runForecast(baseInputs());
    expect(positive.horizons[1].central).toBeGreaterThan(none.horizons[1].central);
    expect(positive.signalContributions[0].contribution).toBeGreaterThan(0);
  });
});

describe("target pull", () => {
  it("blends toward the target with the specified weights and status scaling", () => {
    const inputs = baseInputs({
      target: { year: 2030, score: 90, rank: null, status: "on_track" },
    });
    const r = runForecast(inputs);
    const noTarget = runForecast(baseInputs());
    // pulled toward 90 (above the baseline trend), most at +5
    expect(r.horizons[0].targetPull).toBeGreaterThan(0);
    expect(r.horizons[2].targetPull).toBeGreaterThan(r.horizons[0].targetPull);
    expect(r.horizons[1].central).toBeGreaterThan(noTarget.horizons[1].central);
    // a delayed target pulls at 30 percent of the strength
    expect(targetStatusScale("on_track")).toBe(1);
    expect(targetStatusScale("at_risk")).toBe(0.6);
    expect(targetStatusScale("delayed")).toBe(0.3);
    const delayed = runForecast(
      baseInputs({ target: { year: 2030, score: 90, rank: null, status: "delayed" } })
    );
    expect(delayed.horizons[1].targetPull).toBeLessThan(r.horizons[1].targetPull);
  });
});

describe("simulation percentiles", () => {
  it("orders low <= central <= high with a sensible spread", () => {
    const r = runForecast(baseInputs({ runs: 2000 }));
    for (const h of r.horizons) {
      expect(h.low).toBeLessThanOrEqual(h.central);
      expect(h.central).toBeLessThanOrEqual(h.high);
    }
    // longer horizons accumulate more bootstrap error
    const spread1 = r.horizons[0].high - r.horizons[0].low;
    const spread5 = r.horizons[2].high - r.horizons[2].low;
    expect(spread5).toBeGreaterThanOrEqual(spread1);
  });

  it("computes interpolated percentiles", () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([10], 0.9)).toBe(10);
  });

  it("mulberry32 is uniform-ish and deterministic", () => {
    const r1 = mulberry32(1);
    const r2 = mulberry32(1);
    const a = Array.from({ length: 5 }, () => r1());
    const b = Array.from({ length: 5 }, () => r2());
    expect(a).toEqual(b);
    for (const v of a) expect(v).toBeGreaterThanOrEqual(0);
  });
});

describe("rank derivation", () => {
  it("ranks against peers in the right direction", () => {
    expect(deriveRank(70, [80, 60, 50], true)).toBe(2); // one peer better
    expect(deriveRank(70, [80, 60, 50], false)).toBe(3); // lower is better: two better
    expect(deriveRank(95, [80, 60, 50], true)).toBe(1);
  });

  it("reports a rank range from the score range", () => {
    const peers = Array.from({ length: 30 }, (_, i) => 40 + i * 2); // 40..98
    const r = runForecast(
      baseInputs({
        peerValues: { h1: peers, h3: peers, h5: peers, latest: peers },
        totalCountries: 40, // the pool is essentially the whole field
      })
    );
    const h3 = r.horizons[1];
    expect(h3.rankCentral).not.toBeNull();
    expect(h3.rankLow!).toBeLessThanOrEqual(h3.rankCentral!);
    expect(h3.rankHigh!).toBeGreaterThanOrEqual(h3.rankCentral!);
  });

  it("anchors to the published rank when the pool is only a sample", () => {
    // 18 peers of a 130-country field; Saudi Arabia published rank 49
    const peers = Array.from({ length: 18 }, (_, i) => 45 + i * 3);
    const r = runForecast(
      baseInputs({
        peerValues: { h1: peers, h3: peers, h5: peers, latest: peers },
        latestRank: 49,
        totalCountries: 130,
      })
    );
    const h3 = r.horizons[1];
    // the derived rank must stay near the anchor, never peer-relative (< 19)
    expect(h3.rankCentral).not.toBeNull();
    expect(h3.rankCentral!).toBeGreaterThan(19);
    expect(Math.abs(h3.rankCentral! - 49)).toBeLessThanOrEqual(18);
  });
});

describe("direction", () => {
  it("is up for a clear improvement, down for decline, stable when small", () => {
    const up = runForecast(baseInputs());
    expect(up.direction).toBe("up");
    const down = runForecast(
      baseInputs({
        series: Array.from({ length: 10 }, (_, i) => ({
          year: 2015 + i,
          value: 80 - i * 1.5,
        })),
      })
    );
    expect(down.direction).toBe("down");
    const flat = runForecast(
      baseInputs({
        series: Array.from({ length: 10 }, (_, i) => ({
          year: 2015 + i,
          value: 60 + (i % 2 === 0 ? 0.4 : -0.4),
        })),
      })
    );
    expect(flat.direction).toBe("stable");
  });

  it("inverts correctly when lower scores are better", () => {
    // GPI-style: score falling = improving
    const r = runForecast(
      baseInputs({
        higherIsBetter: false,
        scoreMin: 1,
        scoreMax: 5,
        series: Array.from({ length: 10 }, (_, i) => ({
          year: 2015 + i,
          value: 2.4 - i * 0.05,
        })),
      })
    );
    expect(r.direction).toBe("up");
  });
});

/* CR08 4.1: target_gap mode (national indicators against their NES target) */
describe("target gap mode", () => {
  // an LFPR-like series: 52.2 to 55.3 over 2019-2026, target 75 by 2030
  const lfpr = baseInputs({
    latestYear: 2026,
    series: Array.from({ length: 8 }, (_, i) => ({ year: 2019 + i, value: 52.2 + i * 0.45 })),
    mode: "target_gap",
    targetGap: { value: 75, year: 2030 },
  });

  it("reports the gap, the target-year horizon and the same 1/3/5 row shape", () => {
    const r = runForecast(lfpr);
    expect(r.mode).toBe("target_gap");
    expect(r.horizons.map((h) => h.horizon)).toEqual([1, 3, 5]);
    expect(r.targetGap).toBeDefined();
    const g = r.targetGap!;
    expect(g.targetYear).toBe(2030);
    expect(g.horizonYears).toBe(4);
    expect(g.gapNow).toBeCloseTo(75 - (52.2 + 7 * 0.45), 5);
    expect(g.low).toBeLessThanOrEqual(g.central);
    expect(g.central).toBeLessThanOrEqual(g.high);
    expect(g.gapCentral).toBeCloseTo(75 - g.central, 5);
    // a 0.45 per year trend cannot close a 19-point gap in four years
    expect(g.probability).toBeLessThan(0.05);
    expect(g.requiredPacePerYear).toBeGreaterThan(g.trendPerYear);
    expect(g.closingYear == null || g.closingYear > 2030).toBe(true);
  });

  it("finds the closing year and a high probability when the trend closes the gap", () => {
    const r = runForecast(
      baseInputs({
        latestYear: 2025,
        series: Array.from({ length: 6 }, (_, i) => ({ year: 2020 + i, value: 70 + i * 4 })),
        mode: "target_gap",
        targetGap: { value: 90, year: 2030 },
      })
    );
    const g = r.targetGap!;
    // latest 90 already meets 90: closing year is the latest year
    expect(g.gapNow).toBeLessThanOrEqual(0);
    expect(g.closingYear).toBe(2025);
    expect(g.probability).toBeGreaterThan(0.9);
    const r2 = runForecast(
      baseInputs({
        latestYear: 2025,
        series: Array.from({ length: 6 }, (_, i) => ({ year: 2020 + i, value: 60 + i * 4 })),
        mode: "target_gap",
        targetGap: { value: 90, year: 2030 },
      })
    );
    const g2 = r2.targetGap!;
    expect(g2.gapNow).toBeCloseTo(10, 5);
    expect(g2.closingYear).not.toBeNull();
    expect(g2.closingYear!).toBeLessThanOrEqual(2030);
    expect(g2.probability).toBeGreaterThan(0.5);
  });

  it("direction-corrects the gap when lower values are better", () => {
    // unemployment-like series falling toward a target of 0.1
    const r = runForecast(
      baseInputs({
        higherIsBetter: false,
        scoreMin: 0,
        scoreMax: 100,
        latestYear: 2026,
        series: Array.from({ length: 6 }, (_, i) => ({ year: 2021 + i, value: 0.4 - i * 0.04 })),
        mode: "target_gap",
        targetGap: { value: 0.1, year: 2030 },
      })
    );
    const g = r.targetGap!;
    // latest 0.2, target 0.1: gap positive (short of the target) despite target < value
    expect(g.gapNow).toBeCloseTo(0.1, 5);
    expect(g.requiredPacePerYear).toBeLessThan(0);
    expect(g.closingYear).not.toBeNull();
    expect(g.closingYear!).toBeLessThanOrEqual(2030);
    expect(r.direction).toBe("up");
  });

  it("switches the target pull off and ignores the mode for rank series", () => {
    const withPull = runForecast({
      ...lfpr,
      target: { year: 2030, score: 75, rank: null, status: "on_track" },
    });
    for (const h of withPull.horizons) expect(h.targetPull).toBe(0);
    const scoreMode = runForecast({
      ...lfpr,
      mode: "score",
      target: { year: 2030, score: 75, rank: null, status: "on_track" },
    });
    expect(scoreMode.mode).toBe("score");
    expect(scoreMode.targetGap).toBeUndefined();
    expect(scoreMode.horizons[2].targetPull).toBeGreaterThan(0);
    // a rank-fallback series never runs the gap mode
    const rankSeries = runForecast(
      baseInputs({
        usingRankFallback: true,
        latestRank: 30,
        series: Array.from({ length: 6 }, (_, i) => ({ year: 2020 + i, value: -(34 - i) })),
        mode: "target_gap",
        targetGap: { value: -10, year: 2030 },
      })
    );
    expect(rankSeries.mode).toBe("rank");
    expect(rankSeries.targetGap).toBeUndefined();
  });

  it("is deterministic and scales its bounds to the gap, not to a 0-100 score", () => {
    // a population-like series in millions: the 0-100 clamp must not bite
    const pop = baseInputs({
      scoreMin: 0,
      scoreMax: 100_000_000,
      latestYear: 2026,
      series: Array.from({ length: 6 }, (_, i) => ({ year: 2021 + i, value: 2_900_000 + i * 45_000 })),
      mode: "target_gap",
      targetGap: { value: 3_400_000, year: 2030 },
    });
    const a = runForecast(pop);
    const b = runForecast(pop);
    expect(a.targetGap!.central).toBe(b.targetGap!.central);
    expect(a.horizons[2].central).toBeGreaterThan(3_000_000);
    expect(a.targetGap!.gapNow).toBeCloseTo(3_400_000 - 3_125_000, 0);
  });
});
