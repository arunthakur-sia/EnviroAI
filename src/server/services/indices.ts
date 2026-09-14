// CR05 4.4/4.5/4.7: read models for the Indices board, the index page, and
// the benchmark views. Forecast math lives in src/server/indices/*.
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getSetting } from "@/server/settings";
import type { CurrentUser } from "@/server/auth/session";

export type IndexObservationLite = {
  country: string;
  year: number;
  rank: number | null;
  score: number | null;
  total: number | null;
  status: string;
  sourceUrl: string | null;
};

export type ForecastRow = {
  horizon: number;
  centralRank: number | null;
  centralScore: number | null;
  low: number | null;
  high: number | null;
  rankLow: number | null;
  rankHigh: number | null;
  direction: string;
  generatedAt: string;
  methodVersion: string;
  assumptions: Record<string, number>;
  inputs: Record<string, unknown>;
  simulation: Record<string, unknown>;
  explanationEn: string | null;
  explanationAr: string | null;
};

export type BoardCard = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  publisher: string | null;
  category: string;
  isActive: boolean;
  higherIsBetter: boolean;
  scale: string;
  latestYear: number | null;
  qatar: { year: number; rank: number | null; score: number | null; total: number | null } | null;
  previous: { year: number; rank: number | null; score: number | null } | null;
  /** positive = improved (rank moved toward 1, or score moved the good way) */
  change: number | null;
  changeKind: "rank" | "score" | null;
  gccPosition: number | null;
  gccCount: number;
  gccLeader: { country: string; rank: number | null; score: number | null } | null;
  sparkline: { year: number; rank: number }[];
  forecastDirection: string | null;
  entity: { id: string; nameEn: string; nameAr: string; shortEn: string; shortAr: string } | null;
  linkedTargets: { id: string; code: string | null; titleEn: string; titleAr: string }[];
};

const GCC = ["QAT", "SAU", "ARE", "KWT", "BHR", "OMN"];

function gccStanding(
  obs: IndexObservationLite[],
  year: number,
  higherIsBetter: boolean
): { position: number | null; count: number; leader: { country: string; rank: number | null; score: number | null } | null } {
  const rows = GCC.map((c) => {
    // the country's observation for the index's latest Qatar year, or its own
    // latest within 2 years so biennial editions still compare
    const mine = obs
      .filter((o) => o.country === c && o.year <= year && o.year >= year - 2)
      .sort((a, b) => b.year - a.year)[0];
    return mine ? { country: c, rank: mine.rank, score: mine.score } : null;
  }).filter(Boolean) as { country: string; rank: number | null; score: number | null }[];
  if (!rows.length) return { position: null, count: 0, leader: null };
  const sorted = [...rows].sort((a, b) => {
    if (a.rank != null && b.rank != null) return a.rank - b.rank;
    if (a.score != null && b.score != null)
      return higherIsBetter ? b.score - a.score : a.score - b.score;
    return a.rank != null ? -1 : 1;
  });
  const position = sorted.findIndex((r) => r.country === "QAT");
  return {
    position: position === -1 ? null : position + 1,
    count: rows.length,
    leader: sorted[0] ?? null,
  };
}

export async function getIndicesBoard(_user: CurrentUser): Promise<{
  cards: BoardCard[];
  summary: { improving: number; stable: number; declining: number; gccLead: number };
  lastRefresh: string | null;
  forecastTable: {
    code: string;
    nameEn: string;
    nameAr: string;
    latest: { year: number; rank: number | null; score: number | null } | null;
    horizons: ForecastRow[];
    confidence: "narrow" | "medium" | "wide" | null;
  }[];
}> {
  const indices = await db
    .select()
    .from(schema.indices)
    .where(eq(schema.indices.isActive, 1))
    .orderBy(asc(schema.indices.code));
  const ids = indices.map((i) => i.id);
  const allObs = ids.length
    ? await db
        .select()
        .from(schema.indexObservations)
        .where(
          and(
            inArray(schema.indexObservations.indexId, ids),
            inArray(schema.indexObservations.countryCode, GCC)
          )
        )
    : [];
  const forecasts = ids.length
    ? await db
        .select()
        .from(schema.indexForecasts)
        .where(
          and(
            inArray(schema.indexForecasts.indexId, ids),
            eq(schema.indexForecasts.status, "current")
          )
        )
    : [];
  const entityIds = [
    ...new Set(indices.map((i) => i.responsibleEntityId).filter(Boolean)),
  ] as string[];
  const entities = entityIds.length
    ? await db.select().from(schema.entities).where(inArray(schema.entities.id, entityIds))
    : [];
  const entityById = new Map(entities.map((e) => [e.id, e]));
  const targetIds = [
    ...new Set(
      indices.flatMap((i) => {
        try {
          return JSON.parse(i.linkedNodeIdsJson ?? "[]") as string[];
        } catch {
          return [];
        }
      })
    ),
  ];
  const targets = targetIds.length
    ? await db
        .select()
        .from(schema.strategyNodes)
        .where(inArray(schema.strategyNodes.id, targetIds))
    : [];
  const targetById = new Map(targets.map((t) => [t.id, t]));

  const cards: BoardCard[] = indices.map((idx) => {
    const obs: IndexObservationLite[] = allObs
      .filter((o) => o.indexId === idx.id)
      .map((o) => ({
        country: o.countryCode,
        year: o.year,
        rank: o.rank,
        score: o.score,
        total: o.totalCountries,
        status: o.status,
        sourceUrl: o.sourceUrl,
      }));
    const qatSeries = obs
      .filter((o) => o.country === "QAT")
      .sort((a, b) => a.year - b.year);
    const latest = qatSeries[qatSeries.length - 1] ?? null;
    const previous = qatSeries[qatSeries.length - 2] ?? null;
    let change: number | null = null;
    let changeKind: "rank" | "score" | null = null;
    if (latest && previous) {
      if (latest.rank != null && previous.rank != null) {
        change = previous.rank - latest.rank; // positive = climbed
        changeKind = "rank";
      } else if (latest.score != null && previous.score != null) {
        change =
          (latest.score - previous.score) * (idx.higherIsBetter === 1 ? 1 : -1);
        changeKind = "score";
      }
    }
    const standing = latest
      ? gccStanding(obs, latest.year, idx.higherIsBetter === 1)
      : { position: null, count: 0, leader: null };
    const sparkline = qatSeries
      .filter((o) => o.rank != null && (latest ? o.year > latest.year - 11 : true))
      .map((o) => ({ year: o.year, rank: o.rank as number }));
    const f3 = forecasts.find((f) => f.indexId === idx.id && f.horizonYears === 3);
    let linkedTargets: BoardCard["linkedTargets"] = [];
    try {
      linkedTargets = (JSON.parse(idx.linkedNodeIdsJson ?? "[]") as string[])
        .map((id) => targetById.get(id))
        .filter(Boolean)
        .map((t) => ({ id: t!.id, code: t!.code, titleEn: t!.titleEn, titleAr: t!.titleAr }));
    } catch {
      /* none */
    }
    const entity = idx.responsibleEntityId ? entityById.get(idx.responsibleEntityId) : null;
    return {
      id: idx.id,
      code: idx.code,
      nameEn: idx.nameEn,
      nameAr: idx.nameAr,
      publisher: idx.publisher,
      category: idx.category,
      isActive: idx.isActive === 1,
      higherIsBetter: idx.higherIsBetter === 1,
      scale: idx.scale,
      latestYear: idx.latestYear,
      qatar: latest
        ? { year: latest.year, rank: latest.rank, score: latest.score, total: latest.total }
        : null,
      previous: previous
        ? { year: previous.year, rank: previous.rank, score: previous.score }
        : null,
      change,
      changeKind,
      gccPosition: standing.position,
      gccCount: standing.count,
      gccLeader: standing.leader,
      sparkline,
      forecastDirection: f3?.direction ?? null,
      entity: entity
        ? {
            id: entity.id,
            nameEn: entity.nameEn,
            nameAr: entity.nameAr,
            shortEn: entity.shortNameEn ?? entity.nameEn,
            shortAr: entity.shortNameAr ?? entity.nameAr,
          }
        : null,
      linkedTargets,
    };
  });

  // ranked by Qatar's latest rank (unranked last)
  cards.sort((a, b) => (a.qatar?.rank ?? 9999) - (b.qatar?.rank ?? 9999));

  const summary = {
    improving: cards.filter((c) => (c.change ?? 0) > 0).length,
    declining: cards.filter((c) => (c.change ?? 0) < 0).length,
    stable: cards.filter((c) => c.change === 0 || c.change === null).length,
    gccLead: cards.filter((c) => c.gccPosition === 1).length,
  };

  const forecastTable = indices.map((idx) => {
    const rows = forecasts
      .filter((f) => f.indexId === idx.id)
      .sort((a, b) => a.horizonYears - b.horizonYears)
      .map(parseForecastRow);
    const card = cards.find((c) => c.id === idx.id)!;
    const f3 = rows.find((r) => r.horizon === 3);
    let confidence: "narrow" | "medium" | "wide" | null = null;
    if (f3 && f3.low != null && f3.high != null) {
      const range = (idx.scoreMax ?? 100) - (idx.scoreMin ?? 0) || 1;
      const width = Math.abs(f3.high - f3.low) / range;
      confidence = width < 0.05 ? "narrow" : width < 0.12 ? "medium" : "wide";
    }
    return {
      code: idx.code,
      nameEn: idx.nameEn,
      nameAr: idx.nameAr,
      latest: card.qatar,
      horizons: rows,
      confidence,
    };
  });

  const lastRefresh =
    (await getSetting<{ at?: string }>("indices_last_refresh", {})).at ?? null;
  return { cards, summary, lastRefresh, forecastTable };
}

function parseForecastRow(f: typeof schema.indexForecasts.$inferSelect): ForecastRow {
  const parse = (raw: string | null) => {
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };
  return {
    horizon: f.horizonYears,
    centralRank: f.centralRank,
    centralScore: f.centralScore,
    low: f.low,
    high: f.high,
    rankLow: f.rankLow,
    rankHigh: f.rankHigh,
    direction: f.direction,
    generatedAt: f.generatedAt,
    methodVersion: f.methodVersion,
    assumptions: parse(f.assumptionsJson),
    inputs: parse(f.inputsJson),
    simulation: parse(f.simulationSummaryJson),
    explanationEn: f.explanationEn,
    explanationAr: f.explanationAr,
  };
}

/* ------------------------------------------------------------------ */
/* index page                                                           */
/* ------------------------------------------------------------------ */

export async function getIndexPage(user: CurrentUser, code: string) {
  const [index] = await db
    .select()
    .from(schema.indices)
    .where(eq(schema.indices.code, code))
    .limit(1);
  if (!index) return null;
  const obs = await db
    .select()
    .from(schema.indexObservations)
    .where(eq(schema.indexObservations.indexId, index.id))
    .orderBy(asc(schema.indexObservations.year));
  const focus = obs.filter((o) => GCC.includes(o.countryCode));
  const entity = index.responsibleEntityId
    ? (
        await db
          .select()
          .from(schema.entities)
          .where(eq(schema.entities.id, index.responsibleEntityId))
          .limit(1)
      )[0] ?? null
    : null;
  let linkedTargets: { id: string; code: string | null; titleEn: string; titleAr: string; status: string }[] = [];
  try {
    const ids = JSON.parse(index.linkedNodeIdsJson ?? "[]") as string[];
    if (ids.length) {
      const nodes = await db
        .select()
        .from(schema.strategyNodes)
        .where(inArray(schema.strategyNodes.id, ids));
      linkedTargets = nodes.map((n) => ({
        id: n.id,
        code: n.code,
        titleEn: n.titleEn,
        titleAr: n.titleAr,
        status: n.status,
      }));
    }
  } catch {
    /* none */
  }

  /* pillars (latest year with pillar data) */
  const pillars = await db
    .select()
    .from(schema.indexPillars)
    .where(eq(schema.indexPillars.indexId, index.id))
    .orderBy(asc(schema.indexPillars.sort));
  const pillarValues = pillars.length
    ? await db
        .select()
        .from(schema.indexPillarValues)
        .where(eq(schema.indexPillarValues.indexId, index.id))
    : [];

  /* related signals: last 12 months, accepted/converted, linked to the index
     or its nodes */
  const links = await db.select().from(schema.signalLinks);
  const nodeScope = new Set(linkedTargets.map((t) => t.id));
  const signalIds = new Set<string>();
  for (const l of links) {
    if (l.resourceType === "index" && l.resourceId === index.id) signalIds.add(l.signalId);
    if (l.resourceType === "node" && nodeScope.has(l.resourceId)) signalIds.add(l.signalId);
  }
  let signals: (typeof schema.signals.$inferSelect)[] = [];
  if (signalIds.size) {
    const rows = await db
      .select()
      .from(schema.signals)
      .where(inArray(schema.signals.id, [...signalIds]))
      .orderBy(desc(schema.signals.publishedAt));
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);
    signals = rows
      .filter(
        (s) =>
          (s.triageStatus === "accepted" || s.triageStatus === "converted") &&
          new Date(s.publishedAt ?? s.createdAt) >= cutoff
      )
      .slice(0, 6);
  }

  const forecasts = (
    await db
      .select()
      .from(schema.indexForecasts)
      .where(
        and(
          eq(schema.indexForecasts.indexId, index.id),
          eq(schema.indexForecasts.status, "current")
        )
      )
  )
    .sort((a, b) => a.horizonYears - b.horizonYears)
    .map(parseForecastRow);

  /* previous current generation for "forecast moved from X to Y" */
  const history = await db
    .select()
    .from(schema.indexForecasts)
    .where(
      and(
        eq(schema.indexForecasts.indexId, index.id),
        eq(schema.indexForecasts.status, "superseded"),
        eq(schema.indexForecasts.horizonYears, 3)
      )
    )
    .orderBy(desc(schema.indexForecasts.generatedAt))
    .limit(1);
  const previousForecast = history.length ? parseForecastRow(history[0]) : null;

  const peerGroupRows = await db.select().from(schema.peerGroups);
  const peerGroups = peerGroupRows
    .filter((g) => !g.ownerUserId || g.ownerUserId === user.id)
    .map((g) => ({
      id: g.id,
      nameEn: g.nameEn,
      nameAr: g.nameAr,
      countries: (() => {
        try {
          return JSON.parse(g.countryCodesJson) as string[];
        } catch {
          return [];
        }
      })(),
      isDefault: g.isDefault === 1,
      isMine: g.ownerUserId === user.id,
    }));

  const countries = await db.select().from(schema.countries);

  return {
    index,
    entity,
    linkedTargets,
    observations: obs.map((o) => ({
      country: o.countryCode,
      year: o.year,
      rank: o.rank,
      score: o.score,
      total: o.totalCountries,
      status: o.status,
      sourceUrl: o.sourceUrl,
    })),
    focusObservations: focus.map((o) => ({
      country: o.countryCode,
      year: o.year,
      rank: o.rank,
      score: o.score,
    })),
    pillars: pillars.map((p) => ({
      code: p.pillarCode,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
    })),
    pillarValues: pillarValues.map((v) => ({
      pillar: v.pillarCode,
      country: v.countryCode,
      year: v.year,
      rank: v.rank,
      score: v.score,
    })),
    signals: signals.map((s) => ({
      id: s.id,
      titleEn: s.titleEn,
      titleAr: s.titleAr,
      publisher: s.publisher,
      publishedAt: s.publishedAt,
      impact: s.impact,
      horizon: s.horizon,
      sentiment: s.sentiment,
    })),
    forecasts,
    previousForecast,
    peerGroups,
    countries: countries.map((c) => ({
      iso3: c.iso3,
      nameEn: c.nameEn,
      nameAr: c.nameAr,
      region: c.region,
    })),
  };
}

export type IndexPageData = NonNullable<Awaited<ReturnType<typeof getIndexPage>>>;
