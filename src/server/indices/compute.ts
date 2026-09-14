// CR05 4.6: builds forecast inputs from the database, runs the engine, and
// stores official forecasts (superseding the previous rows). Recomputes on
// data refresh, on signal acceptance linked to the index, on target status
// change, and nightly (worker job). The explanation is written by Claude from
// the stored inputs only; the mock produces a templated explanation from the
// same numbers (DECISIONS 5).
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { newId, nowIso } from "@/lib/ids";
import { callJson } from "@/server/ai/client";
import { getAiSettings } from "@/server/settings";
import {
  DEFAULT_ASSUMPTIONS,
  dampedTrend,
  fitHolt,
  runForecast,
  type ForecastAssumptions,
  type ForecastInputs,
  type ForecastResult,
  type SignalInput,
} from "./forecast";

/* ------------------------------------------------------------------ */
/* input assembly                                                       */
/* ------------------------------------------------------------------ */

export type AssembledInputs = {
  index: typeof schema.indices.$inferSelect;
  inputs: ForecastInputs;
  signalIds: string[];
  targetNodeId: string | null;
  targetText: string | null;
};

function sentimentOf(s: string): 1 | -1 | 0 {
  if (s === "positive") return 1;
  if (s === "negative") return -1;
  return 0;
}

function monthsBetween(fromIso: string, to: Date): number {
  const from = new Date(fromIso);
  return Math.max(
    0,
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  );
}

/** Reads a rank or score target out of a linked NDS3 target's wording, e.g.
    "top-10 business environment" -> rank 10 by the edition horizon. */
export function parseTargetStatement(
  text: string
): { rank: number | null; score: number | null } | null {
  const top = /top[\s-](\d{1,3})/i.exec(text);
  if (top) return { rank: Number(top[1]), score: null };
  const rank = /rank(?:ed)?\s+(?:of\s+)?(\d{1,3})/i.exec(text);
  if (rank) return { rank: Number(rank[1]), score: null };
  const arTop = /أفضل\s+(\d{1,3})/.exec(text);
  if (arTop) return { rank: Number(arTop[1]), score: null };
  return null;
}

export async function assembleInputs(
  indexId: string,
  assumptions?: Partial<ForecastAssumptions>,
  runs = 5000
): Promise<AssembledInputs | null> {
  const [index] = await db
    .select()
    .from(schema.indices)
    .where(eq(schema.indices.id, indexId))
    .limit(1);
  if (!index) return null;
  const obs = await db
    .select()
    .from(schema.indexObservations)
    .where(eq(schema.indexObservations.indexId, indexId));

  const qat = obs
    .filter((o) => o.countryCode === "QAT" && o.year >= 2010)
    .sort((a, b) => a.year - b.year);
  if (!qat.length) return null;
  const scorePoints = qat.filter((o) => o.score != null);
  const usingRankFallback = scorePoints.length < Math.min(5, qat.length);
  const series = (usingRankFallback
    ? qat.filter((o) => o.rank != null).map((o) => ({ year: o.year, value: -(o.rank as number) }))
    : scorePoints.map((o) => ({ year: o.year, value: o.score as number }))
  ).filter((p) => Number.isFinite(p.value));
  if (!series.length) return null;
  const latestYear = series[series.length - 1].year;

  /* signals: accepted/converted, linked to the index or to its linked nodes
     (and their outcome), within 18 months */
  const linkedNodeIds: string[] = (() => {
    try {
      return JSON.parse(index.linkedNodeIdsJson ?? "[]");
    } catch {
      return [];
    }
  })();
  // walk linked targets up to their outcomes so outcome-linked signals count
  const nodeScope = new Set<string>(linkedNodeIds);
  if (linkedNodeIds.length) {
    const nodes = await db
      .select()
      .from(schema.strategyNodes)
      .where(inArray(schema.strategyNodes.id, linkedNodeIds));
    for (const n of nodes) if (n.parentId) nodeScope.add(n.parentId);
  }
  const links = await db.select().from(schema.signalLinks);
  const signalIdSet = new Set<string>();
  for (const l of links) {
    if (l.resourceType === "index" && l.resourceId === indexId) signalIdSet.add(l.signalId);
    if (l.resourceType === "node" && nodeScope.has(l.resourceId)) signalIdSet.add(l.signalId);
  }
  const now = new Date();
  let signals: SignalInput[] = [];
  if (signalIdSet.size) {
    const rows = await db
      .select()
      .from(schema.signals)
      .where(inArray(schema.signals.id, [...signalIdSet]));
    signals = rows
      .filter(
        (s) =>
          (s.triageStatus === "accepted" || s.triageStatus === "converted") &&
          monthsBetween(s.publishedAt ?? s.createdAt, now) <= 18
      )
      .map((s) => ({
        id: s.id,
        title: s.titleEn,
        sentiment: sentimentOf(s.sentiment),
        impact: (s.impact as SignalInput["impact"]) ?? "medium",
        horizon: (s.horizon as SignalInput["horizon"]) ?? "mid",
        ageMonths: monthsBetween(s.publishedAt ?? s.createdAt, now),
      }));
  }

  /* target pull from the first linked target that states a rank/score */
  let target: ForecastInputs["target"] = null;
  let targetNodeId: string | null = null;
  let targetText: string | null = null;
  if (linkedNodeIds.length) {
    const nodes = await db
      .select()
      .from(schema.strategyNodes)
      .where(inArray(schema.strategyNodes.id, linkedNodeIds));
    for (const n of nodes) {
      const stated = parseTargetStatement(`${n.titleEn} ${n.descriptionEn ?? ""}`);
      if (stated) {
        const [edition] = await db
          .select()
          .from(schema.strategyEditions)
          .where(eq(schema.strategyEditions.id, n.editionId))
          .limit(1);
        target = {
          year: edition?.periodTo ?? latestYear + 5,
          score: stated.score,
          rank: stated.rank,
          status: n.status,
        };
        targetNodeId = n.id;
        targetText = n.titleEn;
        break;
      }
    }
  }

  /* peers: every other country's series drifted by its own trend */
  const peerSeries = new Map<string, { year: number; value: number }[]>();
  for (const o of obs) {
    if (o.countryCode === "QAT" || o.year < 2010) continue;
    const v = usingRankFallback
      ? o.rank != null
        ? -(o.rank as number)
        : null
      : o.score;
    if (v == null || !Number.isFinite(v)) continue;
    (peerSeries.get(o.countryCode) ?? peerSeries.set(o.countryCode, []).get(o.countryCode)!).push({
      year: o.year,
      value: v,
    });
  }
  const peerValues: ForecastInputs["peerValues"] = { h1: [], h3: [], h5: [], latest: [] };
  for (const [, s] of peerSeries) {
    const pts = s.sort((a, b) => a.year - b.year);
    // only peers with data reasonably close to the latest year join the pool
    if (pts[pts.length - 1].year < latestYear - 4) continue;
    peerValues.latest.push(pts[pts.length - 1].value);
    const values = pts.map((p) => p.value);
    let level: number;
    let trend: number;
    let phi = 1;
    if (values.length >= 5) {
      const f = fitHolt(values);
      level = f.level;
      trend = f.trend;
    } else {
      const f = dampedTrend(values);
      level = f.level;
      trend = f.trend;
      phi = f.phi;
    }
    const at = (h: number) => {
      if (phi === 1) return level + trend * h;
      let sum = 0;
      for (let i = 1; i <= h; i++) sum += Math.pow(phi, i);
      return level + trend * sum;
    };
    peerValues.h1.push(at(1));
    peerValues.h3.push(at(3));
    peerValues.h5.push(at(5));
  }

  const latestQat = qat[qat.length - 1];
  const latestRanked = [...qat].reverse().find((o) => o.rank != null) ?? null;
  const inputs: ForecastInputs = {
    higherIsBetter: index.higherIsBetter === 1,
    scoreMin: index.scoreMin ?? 0,
    scoreMax: index.scoreMax ?? 100,
    latestYear,
    series,
    usingRankFallback,
    signals,
    target,
    peerValues,
    latestRank: latestRanked?.rank ?? null,
    totalCountries: latestQat.totalCountries ?? latestRanked?.totalCountries ?? null,
    assumptions: { ...DEFAULT_ASSUMPTIONS, ...(await storedAssumptions(indexId)), ...assumptions },
    runs,
    // deterministic per index and data day
    seed: hashSeed(`${index.code}:${latestYear}:${series.length}:${signals.length}`),
  };
  return { index, inputs, signalIds: signals.map((s) => s.id), targetNodeId, targetText };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

async function storedAssumptions(indexId: string): Promise<Partial<ForecastAssumptions>> {
  const rows = await db
    .select()
    .from(schema.indexForecastAssumptions)
    .where(eq(schema.indexForecastAssumptions.indexId, indexId));
  const out: Partial<ForecastAssumptions> = {};
  for (const r of rows) {
    if (r.key === "signal_strength") out.signalStrength = r.value;
    if (r.key === "target_pull") out.targetPullWeight = r.value;
    if (r.key === "history_window") out.historyWindowYears = r.value;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* the templated (mock) explanation, from the numbers only              */
/* ------------------------------------------------------------------ */

export function mockExplanation(
  index: { nameEn: string; nameAr: string; higherIsBetter: number },
  result: ForecastResult,
  usingRankFallback: boolean,
  targetText: string | null
): { en: string; ar: string } {
  const h3raw = result.horizons[1];
  // rank-fallback engines work in -rank units; read everything back as ranks
  const disp = (v: number) => (usingRankFallback ? -v : v);
  const h3 = {
    ...h3raw,
    baseline: disp(h3raw.baseline),
    signalAdjustment: usingRankFallback ? -h3raw.signalAdjustment : h3raw.signalAdjustment,
    targetPull: usingRankFallback ? -h3raw.targetPull : h3raw.targetPull,
    low: usingRankFallback ? disp(h3raw.high) : h3raw.low,
    high: usingRankFallback ? disp(h3raw.low) : h3raw.high,
  };
  const fmt = (v: number) => (Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));
  const unit = usingRankFallback ? "rank points" : "score points";
  const unitAr = usingRankFallback ? "مرتبة" : "نقطة";
  const trendWord =
    result.direction === "up" ? "improving" : result.direction === "down" ? "slipping" : "stable";
  const trendAr =
    result.direction === "up" ? "في تحسن" : result.direction === "down" ? "في تراجع" : "مستقر";
  const top = result.signalContributions
    .slice()
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 3);
  const evidenceEn = [
    `Evidence: the fitted ${result.method === "holt" ? "Holt" : "damped-trend"} baseline puts the three-year central value at ${fmt(h3.baseline)} with a residual deviation of ${fmt(result.residualSd)} ${unit}.`,
    top.length
      ? `Accepted signals adjust it by ${fmt(h3.signalAdjustment)} ${unit}; the largest contributions come from ${top.map((s) => `"${s.title}" (${fmt(s.contribution)})`).join(", ")}.`
      : "No accepted signals currently bear on this index.",
    targetText
      ? `The linked target "${targetText}" pulls the path by ${fmt(h3.targetPull)} ${unit}.`
      : "No linked target states a rank or score, so no target pull applies.",
    `The 5,000-run simulation brackets the three-year value between ${fmt(h3.low)} and ${fmt(h3.high)}.`,
  ].join(" ");
  const assessEn = `Assessment: the trajectory reads as ${trendWord}${
    h3.rankCentral ? `, with a central rank around ${h3.rankCentral} in three years` : ""
  }. This is a SiaNexus forecast (method v1), not a published figure.`;
  const evidenceAr = [
    `الشواهد: يضع خط الأساس (${result.method === "holt" ? "تمهيد هولت" : "اتجاه مخمد"}) القيمة المركزية بعد ثلاث سنوات عند ${fmt(h3.baseline)} بانحراف بواقٍ قدره ${fmt(result.residualSd)} ${unitAr}.`,
    top.length
      ? `تعدّلها الإشارات المعتمدة بمقدار ${fmt(h3.signalAdjustment)} ${unitAr}، وأكبر المساهمات من: ${top.map((s) => `"${s.title}" (${fmt(s.contribution)})`).join("، ")}.`
      : "لا توجد إشارات معتمدة مؤثرة على هذا المؤشر حاليًا.",
    targetText
      ? `يجذب المستهدف المرتبط "${targetText}" المسار بمقدار ${fmt(h3.targetPull)} ${unitAr}.`
      : "لا يحدد أي مستهدف مرتبط رتبة أو درجة، فلا يوجد جذب نحو مستهدف.",
    `تحصر المحاكاة (5,000 دورة) قيمة السنوات الثلاث بين ${fmt(h3.low)} و${fmt(h3.high)}.`,
  ].join(" ");
  const assessAr = `التقدير: المسار ${trendAr}${
    h3.rankCentral ? `، برتبة مركزية قرب ${h3.rankCentral} بعد ثلاث سنوات` : ""
  }. هذا تنبؤ من سيا نكسس (المنهجية v1) وليس رقمًا منشورًا.`;
  return { en: `${evidenceEn}\n\n${assessEn}`, ar: `${evidenceAr}\n\n${assessAr}` };
}

/* ------------------------------------------------------------------ */
/* compute and store                                                    */
/* ------------------------------------------------------------------ */

export async function computeForecast(indexId: string): Promise<boolean> {
  const assembled = await assembleInputs(indexId);
  if (!assembled) return false;
  const { index, inputs, signalIds, targetNodeId, targetText } = assembled;
  const result = runForecast(inputs);

  /* explanation: live model from the stored inputs only, mock template otherwise */
  const settings = await getAiSettings();
  let explanation = mockExplanation(index, result, inputs.usingRankFallback, targetText);
  if (!settings.mockMode) {
    const h3 = result.horizons[1];
    const live = await callJson<{ explanation_en: string; explanation_ar: string }>(
      "system_index_forecast",
      JSON.stringify({
        index: { name_en: index.nameEn, name_ar: index.nameAr, higher_is_better: index.higherIsBetter === 1, rank_based: inputs.usingRankFallback },
        history: inputs.series,
        baseline: { method: result.method, alpha: result.alpha, beta: result.beta, residual_sd: result.residualSd },
        horizons: result.horizons,
        top_signals: result.signalContributions
          .slice()
          .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
          .slice(0, 3),
        target: targetText ? { statement: targetText, pull: h3.targetPull } : null,
        direction: result.direction,
      })
    );
    if (live?.explanation_en && live?.explanation_ar) {
      explanation = { en: live.explanation_en, ar: live.explanation_ar };
    }
  }

  /* supersede and insert */
  await db
    .update(schema.indexForecasts)
    .set({ status: "superseded" })
    .where(
      and(eq(schema.indexForecasts.indexId, indexId), eq(schema.indexForecasts.status, "current"))
    );
  const generatedAt = nowIso();
  for (const h of result.horizons) {
    // rank-fallback series simulate in -rank units; the stored range reads
    // as ranks (positive, low = best, clamped to the field)
    const cap = inputs.totalCountries ?? Number.POSITIVE_INFINITY;
    const clampRank = (v: number) => Math.max(1, Math.min(cap, v));
    const low = inputs.usingRankFallback ? clampRank(-h.high) : h.low;
    const high = inputs.usingRankFallback ? clampRank(-h.low) : h.high;
    await db.insert(schema.indexForecasts).values({
      id: newId(),
      indexId,
      generatedAt,
      horizonYears: h.horizon,
      centralRank: h.rankCentral,
      centralScore: inputs.usingRankFallback ? null : h.central,
      low,
      high,
      rankLow: h.rankLow,
      rankHigh: h.rankHigh,
      direction: result.direction,
      methodVersion: "v1",
      assumptionsJson: JSON.stringify(inputs.assumptions),
      inputsJson: JSON.stringify({
        signalIds,
        targetNodeId,
        seriesYears: inputs.series.map((p) => p.year),
        usingRankFallback: inputs.usingRankFallback,
        latestYear: inputs.latestYear,
        seed: inputs.seed,
        runs: inputs.runs,
      }),
      simulationSummaryJson: JSON.stringify({
        method: result.method,
        alpha: result.alpha,
        beta: result.beta,
        residualSd: result.residualSd,
        widened: result.widened,
        fitted: result.fitted,
        residuals: result.residuals,
        baseline: h.baseline,
        signalAdjustment: h.signalAdjustment,
        targetPull: h.targetPull,
        contributions: result.signalContributions,
        sensitivity: result.sensitivity,
        histogram: result.histograms.find((x) => x.horizon === h.horizon)?.bins ?? [],
      }),
      explanationEn: explanation.en,
      explanationAr: explanation.ar,
      status: "current",
    });
  }
  return true;
}

/** Recompute every active index (nightly job, refresh, seed). */
export async function computeAllForecasts(): Promise<number> {
  const indices = await db.select().from(schema.indices).where(eq(schema.indices.isActive, 1));
  let done = 0;
  for (const idx of indices) {
    try {
      if (await computeForecast(idx.id)) done++;
    } catch (e) {
      console.error(`forecast failed for ${idx.code}:`, (e as Error)?.message);
    }
  }
  return done;
}

/** CR05 4.6.11: recompute the indices affected by an accepted signal. */
export async function recomputeForSignal(signalId: string): Promise<void> {
  const links = await db
    .select()
    .from(schema.signalLinks)
    .where(eq(schema.signalLinks.signalId, signalId));
  const direct = links.filter((l) => l.resourceType === "index").map((l) => l.resourceId);
  const nodeIds = links.filter((l) => l.resourceType === "node").map((l) => l.resourceId);
  const affected = new Set(direct);
  if (nodeIds.length) {
    const allIndices = await db.select().from(schema.indices);
    // an index is affected when the signal touches one of its linked nodes or
    // that node's parent outcome
    const parents = await db
      .select()
      .from(schema.strategyNodes)
      .where(inArray(schema.strategyNodes.id, nodeIds));
    const scope = new Set(nodeIds);
    for (const p of parents) if (p.parentId) scope.add(p.parentId);
    for (const idx of allIndices) {
      try {
        const linked: string[] = JSON.parse(idx.linkedNodeIdsJson ?? "[]");
        if (linked.some((id) => scope.has(id))) affected.add(idx.id);
      } catch {
        /* no links */
      }
    }
  }
  for (const id of affected) {
    try {
      await computeForecast(id);
    } catch (e) {
      console.error(`signal-driven recompute failed for index ${id}:`, (e as Error)?.message);
    }
  }
}
