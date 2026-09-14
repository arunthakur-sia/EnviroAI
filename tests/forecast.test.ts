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
    // 18 peers of a 130-country field; Qatar published rank 49
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
