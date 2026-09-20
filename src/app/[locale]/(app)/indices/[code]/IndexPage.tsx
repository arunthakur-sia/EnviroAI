"use client";
// CR05 4.5-4.7: the index page. History with the GCC leader as a faint
// comparison, pillars against the GCC average, related signals, the forecast
// with its full method section (actual numbers, histogram, fan chart,
// sensitivity) and the in-browser what-if simulator, and the benchmark views.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ExternalLink,
  MessageCircleQuestion,
  Minus,
  RotateCcw,
} from "lucide-react";
import {
  Area,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn, bi } from "@/lib/utils";
import { Button, Chip, SectionTitle } from "@/components/ui/primitives";
import { BriefDialog } from "@/components/nexus/BriefDialog";
import { ReportButton } from "@/components/nexus/ReportButton";
import { AskContextItem } from "@/components/nexus/ask/AskContextItem";
import { OwnerControl } from "@/components/nexus/people/OwnerControl";
import type { OwnerRef } from "@/components/nexus/people/types";
import { groupStyle } from "@/lib/sdg-colours";
import { SdgChip, TargetLine } from "../board-shared";
import {
  runForecast,
  DEFAULT_ASSUMPTIONS,
  type ForecastInputs,
  type ForecastResult,
} from "@/server/indices/forecast";
import type { IndexPageData } from "@/server/services/indices";
import { targetGap, targetIsRank } from "@/lib/index-targets";

const GCC = ["QAT", "SAU", "ARE", "KWT", "BHR", "OMN"];
const PEER_COLORS = ["#8a93a0", "#b0b7c1", "#9aa3ae", "#c3c9d1", "#a5adb8"];

function fmt(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return "-";
  return Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(d);
}

function DirIcon({ d }: { d: string | null }) {
  if (d === "up") return <ArrowUpRight className="size-4 text-ok" aria-hidden />;
  if (d === "down") return <ArrowDownRight className="size-4 text-danger" aria-hidden />;
  return <Minus className="size-4 text-ink-400" aria-hidden />;
}

export function IndexPage({
  data,
  whatIfInputs,
  statisticsOwner = null,
}: {
  data: IndexPageData;
  whatIfInputs: ForecastInputs | null;
  /** CR08 9.1: the department owner of the linked Statistics Hub series, when there is one */
  statisticsOwner?: OwnerRef | null;
}) {
  const t = useTranslations("indices");
  const locale = useLocale();
  const { index } = data;
  const higherBetter = index.higherIsBetter === 1;

  const [methodOpen, setMethodOpen] = React.useState(false);
  // a score-only series (an SDG goal, a national indicator) opens on its scores
  const hasRanks = data.focusObservations.some((o) => o.country === "QAT" && o.rank != null);
  const [historyView, setHistoryView] = React.useState<"rank" | "score">(hasRanks ? "rank" : "score");
  const [tableOpen, setTableOpen] = React.useState(false);
  const [forecastMethodOpen, setForecastMethodOpen] = React.useState(false);

  const qat = React.useMemo(() => {
    const published = data.focusObservations
      .filter((o) => o.country === "QAT")
      .sort((a, b) => a.year - b.year);
    if (published.length || !data.statistics) return published;
    // CR08 4.1: a national indicator reads its values from the Statistics Hub
    return data.statistics.series.map((p) => ({
      country: "QAT",
      year: p.year,
      rank: null as number | null,
      score: p.value as number | null,
    }));
  }, [data.focusObservations, data.statistics]);
  const latest = qat[qat.length - 1] ?? null;
  /* CR08 4.1: the national target and the distance still to go */
  const nationalTarget = React.useMemo(() => {
    if (index.targetValue == null) return null;
    const rankBased = targetIsRank(index.forecastMode, latest?.rank ?? null, latest?.score ?? null);
    const current = rankBased ? latest?.rank ?? null : latest?.score ?? null;
    const gap = targetGap(index.targetValue, current, rankBased, higherBetter);
    return {
      value: index.targetValue,
      year: index.targetYear,
      gap,
      met: gap != null && gap <= 0,
    };
  }, [index.targetValue, index.targetYear, index.forecastMode, latest, higherBetter]);

  /* GCC leader for the faint comparison line: best latest rank/score */
  const leader = React.useMemo(() => {
    const latestYear = latest?.year;
    if (!latestYear) return null;
    let best: { country: string; v: number } | null = null;
    for (const c of GCC.filter((x) => x !== "QAT")) {
      const o = data.focusObservations
        .filter((x) => x.country === c && x.year <= latestYear && x.year >= latestYear - 2)
        .sort((a, b) => b.year - a.year)[0];
      if (!o) continue;
      const v = o.rank != null ? -o.rank : higherBetter ? o.score ?? -Infinity : -(o.score ?? Infinity);
      if (v != null && (best === null || v > best.v)) best = { country: c, v };
    }
    return best?.country ?? null;
  }, [data.focusObservations, latest, higherBetter]);

  const historyData = React.useMemo(() => {
    const years = [...new Set(qat.map((o) => o.year))].sort();
    return years.map((year) => {
      const mine = qat.find((o) => o.year === year);
      const lead = leader
        ? data.focusObservations.find((o) => o.country === leader && o.year === year)
        : null;
      return {
        year,
        qatar: historyView === "rank" ? mine?.rank ?? null : mine?.score ?? null,
        leader: lead ? (historyView === "rank" ? lead.rank ?? null : lead.score ?? null) : null,
      };
    });
  }, [qat, leader, historyView, data.focusObservations]);

  /* target marker (gold): from the current forecast inputs' target */
  const forecast3 = data.forecasts.find((f) => f.horizon === 3) ?? null;
  const targetRank = (() => {
    const sim = forecast3?.inputs as { targetNodeId?: string } | undefined;
    if (!sim?.targetNodeId || !whatIfInputs?.target) return null;
    return whatIfInputs.target.rank;
  })();

  /* pillars vs GCC average (latest pillar year) */
  const pillarView = React.useMemo(() => {
    if (!data.pillars.length || !data.pillarValues.length) return null;
    const years = data.pillarValues.map((v) => v.year);
    const latestYear = Math.max(...years);
    const rows = data.pillars
      .map((p) => {
        const values = data.pillarValues.filter(
          (v) => v.pillar === p.code && v.year === latestYear
        );
        const mine = values.find((v) => v.country === "QAT");
        const gcc = values.filter((v) => v.country !== "QAT" && GCC.includes(v.country));
        const metric = (x: { score: number | null; rank: number | null }) =>
          x.score ?? (x.rank != null ? -x.rank : null);
        const mineV = mine ? metric(mine) : null;
        const avg = gcc.length
          ? gcc.reduce((s, v) => s + (metric(v) ?? 0), 0) / gcc.length
          : null;
        return { pillar: p, year: latestYear, mine: mineV, gccAvg: avg, isRank: mine?.score == null };
      })
      .filter((r) => r.mine != null);
    return rows.length ? { year: latestYear, rows } : null;
  }, [data.pillars, data.pillarValues]);

  /* what-if state */
  const [assump, setAssump] = React.useState(
    whatIfInputs?.assumptions ?? { ...DEFAULT_ASSUMPTIONS }
  );
  const official = whatIfInputs?.assumptions ?? DEFAULT_ASSUMPTIONS;
  const isOfficial =
    assump.signalStrength === official.signalStrength &&
    assump.targetPullWeight === official.targetPullWeight &&
    assump.historyWindowYears === official.historyWindowYears &&
    assump.manualShock === official.manualShock;
  const whatIf: ForecastResult | null = React.useMemo(() => {
    if (!whatIfInputs || isOfficial) return null;
    try {
      return runForecast({ ...whatIfInputs, assumptions: assump, runs: 1000 });
    } catch {
      return null;
    }
  }, [whatIfInputs, assump, isOfficial]);

  /* fan chart data in display units (rank-fallback series show ranks):
     history line + the low/central/high band from the official rows or the
     live what-if run */
  const fanData = React.useMemo(() => {
    if (!whatIfInputs) return [];
    const fallback = whatIfInputs.usingRankFallback;
    const rows: {
      year: number;
      value: number | null;
      band: number[] | null;
      central: number | null;
    }[] = whatIfInputs.series.map((p) => ({
      year: p.year,
      value: fallback ? -p.value : p.value,
      band: null,
      central: null,
    }));
    const src = whatIf
      ? whatIf.horizons.map((h) => ({
          year: h.year,
          low: fallback ? -h.high : h.low,
          high: fallback ? -h.low : h.high,
          central: fallback ? (h.rankCentral ?? -h.central) : h.central,
        }))
      : data.forecasts.map((f) => ({
          year: (whatIfInputs.latestYear ?? 0) + f.horizon,
          low: f.low,
          high: f.high,
          central: fallback ? f.centralRank : f.centralScore,
        }));
    const last = rows[rows.length - 1];
    if (last?.value != null) {
      last.central = last.value;
      last.band = [last.value, last.value];
    }
    for (const f of src) {
      if (f.central == null) continue;
      rows.push({
        year: f.year,
        value: null,
        band: f.low != null && f.high != null ? [f.low, f.high] : null,
        central: f.central,
      });
    }
    return rows;
  }, [whatIfInputs, whatIf, data.forecasts]);

  /* benchmark state */
  const presetGroups = data.peerGroups.filter((g) => !g.isMine);
  const [benchView, setBenchView] = React.useState<"rank" | "score" | "gap">("rank");
  const [groupId, setGroupId] = React.useState<string | "top10" | null>(
    presetGroups.find((g) => g.isDefault)?.id ?? presetGroups[0]?.id ?? null
  );
  const [customCountries, setCustomCountries] = React.useState<string[] | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerQuery, setPickerQuery] = React.useState("");
  const [myGroups, setMyGroups] = React.useState(data.peerGroups.filter((g) => g.isMine));
  const [narrative, setNarrative] = React.useState<{ en: string; ar: string } | null>(null);
  const [narrativeBusy, setNarrativeBusy] = React.useState(false);

  const benchCountries = React.useMemo(() => {
    if (customCountries) return customCountries;
    if (groupId === "top10") {
      const latestYear = Math.max(...data.observations.map((o) => o.year));
      return data.observations
        .filter((o) => o.year === latestYear && o.rank != null)
        .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
        .slice(0, 10)
        .map((o) => o.country);
    }
    const g = [...presetGroups, ...myGroups].find((x) => x.id === groupId);
    return g?.countries ?? GCC.filter((c) => c !== "QAT");
  }, [customCountries, groupId, presetGroups, myGroups, data.observations]);

  const benchSet = React.useMemo(
    () => [...new Set(["QAT", ...benchCountries])],
    [benchCountries]
  );

  const benchSeries = React.useMemo(() => {
    const years = [
      ...new Set(
        data.observations
          .filter((o) => benchSet.includes(o.country) && o.year >= 2010)
          .map((o) => o.year)
      ),
    ].sort();
    return years.map((year) => {
      const row: Record<string, number | null> & { year: number } = { year };
      for (const c of benchSet) {
        const o = data.observations.find((x) => x.country === c && x.year === year);
        row[c] = o ? (benchView === "score" ? o.score : o.rank) : null;
      }
      return row;
    });
  }, [data.observations, benchSet, benchView]);

  const latestBench = React.useMemo(() => {
    const rows = benchSet
      .map((c) => {
        const mine = data.observations
          .filter((o) => o.country === c && o.score != null)
          .sort((a, b) => b.year - a.year)[0];
        return mine ? { country: c, score: mine.score as number, year: mine.year } : null;
      })
      .filter(Boolean) as { country: string; score: number; year: number }[];
    return rows.sort((a, b) => (higherBetter ? b.score - a.score : a.score - b.score));
  }, [data.observations, benchSet, higherBetter]);

  const gap = React.useMemo(() => {
    if (!latestBench.length) return null;
    const leaderRow = latestBench[0];
    const mine = latestBench.find((r) => r.country === "QAT");
    if (!mine || leaderRow.country === "QAT") return { leader: leaderRow, value: 0, pillars: [] };
    const value = Math.abs(leaderRow.score - mine.score);
    const pillarGaps = (pillarView?.rows ?? [])
      .map((r) => {
        const leaderVal = data.pillarValues.find(
          (v) => v.pillar === r.pillar.code && v.country === leaderRow.country && v.year === r.year
        );
        const metric = leaderVal?.score ?? (leaderVal?.rank != null ? -leaderVal.rank : null);
        if (r.mine == null || metric == null) return null;
        return { pillar: r.pillar, gap: Math.abs(metric - r.mine) };
      })
      .filter(Boolean)
      .sort((a, b) => b!.gap - a!.gap)
      .slice(0, 3) as { pillar: { code: string; nameEn: string; nameAr: string }; gap: number }[];
    return { leader: leaderRow, value, pillars: pillarGaps };
  }, [latestBench, pillarView, data.pillarValues]);

  async function saveGroup() {
    if (!customCountries?.length) return;
    const name = window.prompt(t("benchmark.groupNamePrompt"));
    if (!name) return;
    const res = await fetch("/api/v1/indices/peer-groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nameEn: name, nameAr: name, countries: customCountries }),
    });
    const j = await res.json();
    if (j.data) {
      setMyGroups((g) => [...g, { ...j.data, isMine: true, isDefault: false }]);
      setGroupId(j.data.id);
      setCustomCountries(null);
    }
  }

  async function loadNarrative() {
    setNarrativeBusy(true);
    try {
      const res = await fetch(`/api/v1/indices/${index.code}/benchmark-narrative`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ countries: benchCountries }),
      });
      const j = await res.json();
      if (j.data) setNarrative(j.data);
    } finally {
      setNarrativeBusy(false);
    }
  }

  const sim3 = (forecast3?.simulation ?? {}) as {
    method?: string;
    alpha?: number;
    beta?: number;
    residualSd?: number;
    baseline?: number;
    signalAdjustment?: number;
    targetPull?: number;
    contributions?: { id: string; title: string; weight: number; contribution: number }[];
    sensitivity?: { key: string; impact: number }[];
    histogram?: { x0: number; x1: number; n: number }[];
  };
  const histogram = whatIf
    ? whatIf.histograms.find((h) => h.horizon === 3)?.bins ?? []
    : sim3.histogram ?? [];
  const maxBin = Math.max(1, ...histogram.map((b) => b.n));

  const fallbackMode = !!whatIfInputs?.usingRankFallback;
  // `low`/`high` are the bounds that belong with the tile's headline: score
  // bounds for a score headline, rank bounds for a rank one. In the what-if
  // rank fallback the simulator already works in negated scores, so its
  // bounds are ranks; otherwise the rank bounds come from the forecast row.
  const horizonsShown = whatIf
    ? whatIf.horizons.map((h) => ({
        horizon: h.horizon,
        rank: h.rankCentral,
        score: fallbackMode ? null : h.central,
        low: fallbackMode ? -h.high : h.low,
        high: fallbackMode ? -h.low : h.high,
        rankLow: fallbackMode ? -h.high : null,
        rankHigh: fallbackMode ? -h.low : null,
        direction: whatIf.direction,
      }))
    : data.forecasts.map((f) => ({
        horizon: f.horizon,
        rank: f.centralRank,
        score: f.centralScore,
        low: f.low,
        high: f.high,
        rankLow: f.rankLow,
        rankHigh: f.rankHigh,
        direction: f.direction,
      }));

  /**
   * The uncertainty range on the same basis as the tile's headline. A rank
   * headline above a score range read as one number pair before, which was
   * simply wrong. Rank bounds are whole places and are ordered so the label
   * always runs from the smaller number to the larger.
   */
  function rangeLabel(h: (typeof horizonsShown)[number]): string {
    const rankBased = h.rank != null && h.rankLow != null && h.rankHigh != null;
    const lo = rankBased ? h.rankLow : h.low;
    const hi = rankBased ? h.rankHigh : h.high;
    if (lo == null || hi == null) return "";
    const [a, b] = lo <= hi ? [lo, hi] : [hi, lo];
    const show = (v: number) => (rankBased ? `#${Math.round(v)}` : fmt(v));
    return `${t("forecast.range")}: ${show(a)} ${t("forecast.to")} ${show(b)}`;
  }

  return (
    <div data-testid="index-page">
      <AskContextItem
        item={{
          kind: "index",
          id: index.id,
          code: index.code,
          titleEn: index.nameEn,
          titleAr: index.nameAr,
          href: `/indices/${index.code}`,
        }}
      />
      {/* 1. header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <p className="text-xs text-ink-600">
            <Link href="/indices" className="link-draw">{t("title")}</Link>
            {" / "}
            {index.publisher}
          </p>
          <h1 className="mt-1 text-2xl">{bi(locale, index.nameEn, index.nameAr)}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {index.sdgGoal != null ? <SdgChip goal={index.sdgGoal} withTitle locale={locale} /> : null}
            {data.groups.map((g) => {
              const style = groupStyle(g.colourToken);
              return (
                <Link key={g.id} href={`/indices?group=${g.code}` as never} data-testid="index-group-chip">
                  <Chip tone={style.chip} className="hover:opacity-80">
                    {bi(locale, g.nameEn, g.nameAr)}
                  </Chip>
                </Link>
              );
            })}
            <Chip tone="sand">{t(`categories.${index.category}` as never)}</Chip>
            {data.statistics ? (
              <Chip tone="gulf" data-testid="index-statistics-chip">
                {t("statisticsChip")} · {bi(locale, data.statistics.nameEn, data.statistics.nameAr)}
              </Chip>
            ) : null}
            {data.entity ? (
              <Chip tone="gulf">
                {bi(locale, data.entity.shortNameEn ?? data.entity.nameEn, data.entity.shortNameAr ?? data.entity.nameAr)}
              </Chip>
            ) : null}
            {data.linkedTargets.map((tg) => (
              <Link key={tg.id} href={`/strategy/${tg.id}` as never}>
                <Chip tone="maroon" className="hover:bg-maroon-300/40">
                  {tg.code ?? bi(locale, tg.titleEn, tg.titleAr).slice(0, 24)}
                </Chip>
              </Link>
            ))}
            {index.publisherUrl ? (
              <a
                href={index.publisherUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-ink-600 hover:text-maroon-700"
              >
                <ExternalLink className="size-3" /> {t("publisherSite")}
              </a>
            ) : null}
          </div>
          {/* CR08 9.1: the responsible entity stays a chip, because an entity
              is an organisation and not a person. Only a national indicator
              that mirrors a Statistics Hub series carries a person: the head
              of that series' department. */}
          {statisticsOwner && data.statistics ? (
            <div className="mt-2.5" data-testid="index-statistics-owner">
              <OwnerControl
                owner={statisticsOwner}
                role="department_owner"
                size="sm"
                align="start"
                item={{
                  type: "indicator",
                  id: data.statistics.id,
                  titleEn: data.statistics.nameEn,
                  titleAr: data.statistics.nameAr,
                  href: `/statistics/${data.statistics.id}`,
                }}
              />
            </div>
          ) : null}
          {nationalTarget ? (
            <TargetLine target={nationalTarget} unit={data.statistics?.unit} className="mt-2 text-xs" />
          ) : null}
          <button
            onClick={() => setMethodOpen((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-ink-600 hover:text-maroon-700 cursor-pointer"
            aria-expanded={methodOpen}
          >
            <ChevronDown className={cn("size-3.5 transition-transform", methodOpen && "rotate-180")} />
            {t("methodologyToggle")}
          </button>
          {methodOpen ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-600">
              {bi(locale, index.methodologySummaryEn ?? "", index.methodologySummaryAr ?? "")}
            </p>
          ) : null}
        </div>
        <div className="card px-5 py-4 text-center" data-testid="index-latest">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-600">
            {t("latest")} · <span className="tnum">{latest?.year ?? "-"}</span>
          </p>
          <p className="mt-1 text-3xl font-semibold text-maroon-900 tnum" style={{ fontFamily: "var(--font-display)" }}>
            {latest?.rank != null ? latest.rank : fmt(latest?.score)}
          </p>
          <p className="text-xs text-ink-600 tnum">
            {latest?.rank != null
              ? (() => {
                  // manual rows may carry no field size: say "rank" rather than "of -"
                  const total = data.observations.find((o) => o.country === "QAT" && o.year === latest.year)?.total;
                  return total ? t("rankOf", { total }) : t("colRank");
                })()
              : data.statistics?.unit ?? t("scoreLabel")}
            {latest?.rank != null && latest?.score != null ? ` · ${t("scoreShort")} ${fmt(latest.score)}` : ""}
          </p>
        </div>
      </div>

      {/* 2. history */}
      <section className="card p-5" data-testid="index-history">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle className="mb-0">{t("history")}</SectionTitle>
          <span className="inline-flex items-center gap-0.5 rounded-lg bg-sand-100 p-0.5">
            {(["rank", "score"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setHistoryView(v)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer",
                  historyView === v ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
                )}
              >
                {v === "rank" ? t("rankView") : t("scoreView")}
              </button>
            ))}
          </span>
        </div>
        <div style={{ height: 260, direction: "ltr" }}>
          <ResponsiveContainer>
            <LineChart data={historyData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <XAxis
                dataKey="year"
                tick={{ fontSize: 11, fill: "var(--color-ink-400)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-sand-300)" }}
              />
              <YAxis
                reversed={historyView === "rank"}
                tick={{ fontSize: 11, fill: "var(--color-ink-400)" }}
                tickLine={false}
                axisLine={false}
                width={36}
                domain={["auto", "auto"]}
              />
              <Tooltip
                formatter={(v: number, name: string) => [
                  historyView === "rank" ? `#${v}` : fmt(v),
                  name === "qatar" ? "Qatar" : leader ?? "",
                ]}
                labelFormatter={(l) => String(l)}
              />
              {targetRank != null && historyView === "rank" ? (
                <Line
                  dataKey={() => targetRank}
                  stroke="var(--color-gold-500)"
                  strokeDasharray="6 4"
                  dot={false}
                  isAnimationActive={false}
                  name="target"
                />
              ) : null}
              {leader ? (
                <Line
                  dataKey="leader"
                  stroke="var(--color-gulf-400)"
                  strokeWidth={1.25}
                  strokeOpacity={0.55}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ) : null}
              <Line
                dataKey="qatar"
                stroke="var(--color-maroon-700)"
                strokeWidth={2}
                dot={{ r: 2.5 }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {leader ? (
          <p className="mt-1 text-[11px] text-ink-600">{t("leaderLine", { country: leader })}</p>
        ) : null}
        <button
          onClick={() => setTableOpen((v) => !v)}
          className="mt-3 flex items-center gap-1 text-xs font-medium text-ink-600 hover:text-maroon-700 cursor-pointer"
          aria-expanded={tableOpen}
          data-testid="history-table-toggle"
        >
          <ChevronDown className={cn("size-3.5 transition-transform", tableOpen && "rotate-180")} />
          {t("historyTable")}
        </button>
        {tableOpen ? (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-sand-100 text-[11px] uppercase tracking-wider text-ink-600">
                  <th className="px-3 py-2 text-start">{t("colYear")}</th>
                  <th className="px-3 py-2 text-start">{t("colRank")}</th>
                  <th className="px-3 py-2 text-start">{t("colScore")}</th>
                  <th className="px-3 py-2 text-start">{t("colTotal")}</th>
                  <th className="px-3 py-2 text-start">{t("colSource")}</th>
                </tr>
              </thead>
              <tbody>
                {[...qat].reverse().map((o) => {
                  const full = data.observations.find(
                    (x) => x.country === "QAT" && x.year === o.year
                  );
                  return (
                    <tr key={o.year} className="border-b border-sand-100 last:border-0">
                      <td className="px-3 py-1.5 tnum">{o.year}</td>
                      <td className="px-3 py-1.5 tnum">{o.rank ?? "-"}</td>
                      <td className="px-3 py-1.5 tnum">{fmt(o.score)}</td>
                      <td className="px-3 py-1.5 tnum">{full?.total ?? "-"}</td>
                      <td className="px-3 py-1.5">
                        {full?.sourceUrl ? (
                          <a
                            href={full.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-gulf-600 hover:underline"
                          >
                            {t("source")}
                          </a>
                        ) : (
                          "-"
                        )}
                        {full?.status !== "fetched" ? (
                          <Chip tone="warn" className="ms-1.5">{full?.status}</Chip>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* 3. pillars */}
      {pillarView ? (
        <section className="card mt-5 p-5" data-testid="index-pillars">
          <SectionTitle>{t("pillars", { year: pillarView.year })}</SectionTitle>
          <div className="flex flex-col gap-2.5">
            {pillarView.rows.map((r) => {
              const max = Math.max(
                Math.abs(r.mine ?? 0),
                Math.abs(r.gccAvg ?? 0),
                r.isRank ? 50 : (index.scoreMax ?? 100)
              );
              const w = (v: number | null) =>
                v == null ? 0 : Math.min(100, (Math.abs(v) / max) * 100);
              return (
                <div key={r.pillar.code}>
                  <p className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="font-medium text-ink-900">
                      {bi(locale, r.pillar.nameEn, r.pillar.nameAr)}
                    </span>
                    <span className="tnum text-ink-600">
                      {r.isRank ? `#${Math.abs(r.mine ?? 0)}` : fmt(r.mine)}
                      {r.gccAvg != null
                        ? ` · ${t("gccAvg")} ${r.isRank ? `#${Math.abs(r.gccAvg).toFixed(0)}` : fmt(r.gccAvg)}`
                        : ""}
                    </span>
                  </p>
                  <div className="relative h-2.5 overflow-hidden rounded-full bg-sand-100">
                    <span
                      className="absolute inset-y-0 start-0 rounded-full bg-maroon-500"
                      style={{ width: `${w(r.mine)}%` }}
                    />
                    {r.gccAvg != null ? (
                      <span
                        className="absolute top-0 h-full w-0.5 bg-gulf-600"
                        style={{ insetInlineStart: `${w(r.gccAvg)}%` }}
                        title={t("gccAvg")}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 4. related signals */}
      {data.signals.length ? (
        <section className="mt-5" data-testid="index-signals">
          <SectionTitle>{t("relatedSignals")}</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.signals.map((s) => (
              <Link
                key={s.id}
                href={`/trends/${s.id}` as never}
                className="card card-hover flex flex-col gap-1 px-3.5 py-3"
              >
                <span className="flex items-center gap-1.5 text-[11px] text-ink-600">
                  <Chip tone={s.sentiment === "positive" ? "ok" : s.sentiment === "negative" ? "danger" : "sand"}>
                    {s.impact}
                  </Chip>
                  {s.publisher}
                  <span className="ms-auto tnum">{s.publishedAt?.slice(0, 10)}</span>
                </span>
                <span className="line-clamp-2 text-sm font-medium text-ink-900">
                  {bi(locale, s.titleEn, s.titleAr)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* 5. forecast */}
      <section className="card mt-5 p-5" data-testid="index-forecast">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle className="mb-0">{t("forecast.title")}</SectionTitle>
          <span className="text-[11px] text-ink-600">
            {forecast3
              ? t("forecast.citedAs", {
                  version: forecast3.methodVersion,
                  date: forecast3.generatedAt.slice(0, 10),
                })
              : t("forecast.none")}
          </span>
        </div>
        {whatIf ? (
          <p className="mt-2 rounded-lg bg-gold-100 px-3 py-1.5 text-xs text-maroon-900" data-testid="whatif-banner">
            {t("forecast.whatIfBanner")}
          </p>
        ) : null}

        {horizonsShown.length ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {horizonsShown.map((h) => (
              <div key={h.horizon} className="rounded-xl bg-sand-50 px-4 py-3" data-testid={`forecast-h${h.horizon}`}>
                <p className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                  +{h.horizon} {t("forecast.years")}
                  <DirIcon d={h.direction} />
                </p>
                <p className="mt-1 text-2xl font-semibold text-maroon-900 tnum" style={{ fontFamily: "var(--font-display)" }}>
                  {h.rank != null ? `#${Math.round(h.rank)}` : fmt(h.score)}
                </p>
                <p className="text-[11px] text-ink-600 tnum">{rangeLabel(h)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-600">{t("forecast.none")}</p>
        )}

        {/* fan chart */}
        {fanData.length ? (
          <div className="mt-5" style={{ height: 240, direction: "ltr" }} data-testid="fan-chart">
            <ResponsiveContainer>
              <ComposedChart data={fanData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11, fill: "var(--color-ink-400)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-sand-300)" }}
                />
                <YAxis
                  reversed={!!whatIfInputs?.usingRankFallback}
                  tick={{ fontSize: 11, fill: "var(--color-ink-400)" }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  domain={["auto", "auto"]}
                />
                <Tooltip formatter={(v: number | number[]) => (Array.isArray(v) ? v.map((x) => fmt(x)).join(` ${t("forecast.to")} `) : fmt(v))} />
                <Area
                  dataKey="band"
                  fill="var(--color-maroon-100)"
                  stroke="none"
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  dataKey="value"
                  stroke="var(--color-maroon-700)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  dataKey="central"
                  stroke="var(--color-maroon-500)"
                  strokeWidth={1.75}
                  strokeDasharray="5 4"
                  dot={{ r: 2.5 }}
                  connectNulls
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        {/* explanation */}
        {forecast3?.explanationEn ? (
          <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-ink-600">
            {bi(locale, forecast3.explanationEn ?? "", forecast3.explanationAr ?? "")}
          </p>
        ) : null}
        {data.previousForecast &&
        forecast3 &&
        (data.previousForecast.centralRank != null
          ? Math.round(data.previousForecast.centralRank) !==
            Math.round(forecast3.centralRank ?? NaN)
          : data.previousForecast.centralScore?.toFixed(2) !==
            forecast3.centralScore?.toFixed(2)) ? (
          <p className="mt-2 text-xs text-ink-400">
            {t("forecast.moved", {
              from:
                data.previousForecast.centralRank != null
                  ? `#${Math.round(data.previousForecast.centralRank)}`
                  : fmt(data.previousForecast.centralScore),
              to:
                forecast3.centralRank != null
                  ? `#${Math.round(forecast3.centralRank)}`
                  : fmt(forecast3.centralScore),
              date: data.previousForecast.generatedAt.slice(0, 10),
            })}
          </p>
        ) : null}

        {/* 4.6.9 method section */}
        <button
          onClick={() => setForecastMethodOpen((v) => !v)}
          className="mt-4 flex items-center gap-1 text-xs font-medium text-ink-600 hover:text-maroon-700 cursor-pointer"
          aria-expanded={forecastMethodOpen}
          data-testid="forecast-method-toggle"
        >
          <ChevronDown className={cn("size-3.5 transition-transform", forecastMethodOpen && "rotate-180")} />
          {t("forecast.methodToggle")}
        </button>
        {forecastMethodOpen ? (
          <div className="mt-3 flex flex-col gap-4 border-t border-sand-100 pt-4" data-testid="forecast-method">
            <p className="max-w-3xl text-sm leading-relaxed text-ink-600">{t("forecast.methodText")}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-sand-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-ink-600">{t("forecast.baselineMethod")}</p>
                <p className="text-sm font-medium tnum">
                  {sim3.method === "holt" ? "Holt" : t("forecast.damped")}
                  {sim3.method === "holt" ? ` (α ${fmt(sim3.alpha)}, β ${fmt(sim3.beta)})` : ""}
                </p>
              </div>
              <div className="rounded-lg bg-sand-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-ink-600">{t("forecast.residual")}</p>
                <p className="text-sm font-medium tnum">{fmt(sim3.residualSd)}</p>
              </div>
              <div className="rounded-lg bg-sand-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-ink-600">{t("forecast.baseline3")}</p>
                <p className="text-sm font-medium tnum">
                  {fmt(fallbackMode && sim3.baseline != null ? -sim3.baseline : sim3.baseline)}
                </p>
              </div>
              <div className="rounded-lg bg-sand-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-ink-600">{t("forecast.pull")}</p>
                <p className="text-sm font-medium tnum">
                  {fmt(fallbackMode && sim3.signalAdjustment != null ? -sim3.signalAdjustment : sim3.signalAdjustment)}
                  {" / "}
                  {fmt(fallbackMode && sim3.targetPull != null ? -sim3.targetPull : sim3.targetPull)}
                </p>
              </div>
            </div>
            {(sim3.contributions ?? []).length ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-ink-900">{t("forecast.contributions")}</p>
                <ul className="flex flex-col gap-1">
                  {(sim3.contributions ?? [])
                    .slice()
                    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
                    .slice(0, 5)
                    .map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-3 text-xs text-ink-600">
                        <span className="truncate">{c.title}</span>
                        <span className="tnum shrink-0">
                          w {fmt(c.weight)} · {c.contribution >= 0 ? "+" : ""}
                          {fmt(c.contribution)}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
            {/* histogram */}
            {histogram.length ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-ink-900">{t("forecast.histogram")}</p>
                <div className="flex h-20 items-end gap-0.5" dir="ltr" data-testid="forecast-histogram">
                  {histogram.map((b, i) => (
                    <span
                      key={i}
                      className="flex-1 rounded-t bg-maroon-300/60"
                      style={{ height: `${(b.n / maxBin) * 100}%` }}
                      title={
                        fallbackMode
                          ? `${fmt(-b.x1)} ${t("forecast.to")} ${fmt(-b.x0)}: ${b.n}`
                          : `${fmt(b.x0)} ${t("forecast.to")} ${fmt(b.x1)}: ${b.n}`
                      }
                    />
                  ))}
                </div>
              </div>
            ) : null}
            {(whatIf?.sensitivity ?? sim3.sensitivity ?? []).length ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-ink-900">{t("forecast.sensitivity")}</p>
                <ul className="flex flex-wrap gap-2">
                  {(whatIf?.sensitivity ?? sim3.sensitivity ?? []).map((s) => (
                    <li key={s.key}>
                      <Chip tone="sand">
                        {t(`forecast.inputs.${s.key}` as never)} · {fmt(s.impact)}
                      </Chip>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* 4.6.10 what-if simulator */}
        {whatIfInputs ? (
          <div className="mt-5 rounded-xl border border-sand-300 bg-sand-50 p-4" data-testid="whatif">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink-900">{t("forecast.whatIf")}</p>
              <button
                onClick={() => setAssump({ ...official })}
                className={cn(
                  "flex items-center gap-1 text-xs font-medium cursor-pointer",
                  isOfficial ? "text-ink-400" : "text-maroon-700 hover:underline"
                )}
                disabled={isOfficial}
                data-testid="whatif-reset"
              >
                <RotateCcw className="size-3.5" /> {t("forecast.reset")}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  { key: "signalStrength", min: 0, max: 2, step: 0.1 },
                  { key: "targetPullWeight", min: 0, max: 2, step: 0.1 },
                  { key: "historyWindowYears", min: 5, max: 16, step: 1 },
                  { key: "manualShock", min: -10, max: 10, step: 0.5 },
                ] as const
              ).map((s) => (
                <label key={s.key} className="block text-xs text-ink-600">
                  <span className="flex justify-between">
                    {t(`forecast.sliders.${s.key}` as never)}
                    <span className="tnum font-medium text-ink-900">{assump[s.key]}</span>
                  </span>
                  <input
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={assump[s.key]}
                    onChange={(e) =>
                      setAssump((a) => ({ ...a, [s.key]: Number(e.target.value) }))
                    }
                    className="mt-1.5 w-full accent-maroon-700"
                    data-testid={`whatif-${s.key}`}
                  />
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ink-400">{t("forecast.whatIfHint")}</p>
          </div>
        ) : null}
      </section>

      {/* 6. benchmark */}
      <section className="card mt-5 p-5" data-testid="index-benchmark">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle className="mb-0">{t("benchmark.title")}</SectionTitle>
          <span className="inline-flex items-center gap-0.5 rounded-lg bg-sand-100 p-0.5">
            {(["rank", "score", "gap"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setBenchView(v)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer",
                  benchView === v ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
                )}
              >
                {t(`benchmark.views.${v}` as never)}
              </button>
            ))}
          </span>
        </div>
        {/* group picker */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {[...presetGroups, ...myGroups].map((g) => (
            <button
              key={g.id}
              onClick={() => {
                setGroupId(g.id);
                setCustomCountries(null);
              }}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs transition-colors cursor-pointer",
                groupId === g.id && !customCountries
                  ? "bg-maroon-100 font-medium text-maroon-700"
                  : "bg-sand-100 text-ink-600 hover:text-ink-900"
              )}
            >
              {bi(locale, g.nameEn, g.nameAr)}
            </button>
          ))}
          <button
            onClick={() => {
              setGroupId("top10");
              setCustomCountries(null);
            }}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs transition-colors cursor-pointer",
              groupId === "top10" && !customCountries
                ? "bg-maroon-100 font-medium text-maroon-700"
                : "bg-sand-100 text-ink-600 hover:text-ink-900"
            )}
          >
            {t("benchmark.top10")}
          </button>
          <button
            onClick={() => {
              setPickerOpen((v) => !v);
              setCustomCountries((c) => c ?? benchCountries);
            }}
            className={cn(
              "rounded-lg border border-dashed border-sand-300 px-2.5 py-1 text-xs cursor-pointer",
              customCountries ? "border-maroon-300 text-maroon-700" : "text-ink-600"
            )}
            data-testid="custom-group-toggle"
          >
            {t("benchmark.custom")}
          </button>
          {customCountries ? (
            <Button size="sm" variant="secondary" onClick={saveGroup}>
              {t("benchmark.saveGroup")}
            </Button>
          ) : null}
        </div>
        {pickerOpen && customCountries ? (
          <div className="mb-4 rounded-xl border border-sand-300 bg-sand-50 p-3" data-testid="country-picker">
            <input
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder={t("benchmark.searchCountry")}
              className="mb-2 h-9 w-full max-w-72 rounded-lg border border-sand-300 bg-white px-3 text-sm focus:border-maroon-500 focus:outline-none"
              aria-label={t("benchmark.searchCountry")}
            />
            <div className="flex flex-wrap gap-1.5">
              {data.countries
                .filter((c) => c.iso3 !== "QAT")
                .filter(
                  (c) =>
                    !pickerQuery.trim() ||
                    c.nameEn.toLowerCase().includes(pickerQuery.toLowerCase()) ||
                    c.nameAr.includes(pickerQuery)
                )
                .map((c) => {
                  const on = customCountries.includes(c.iso3);
                  return (
                    <button
                      key={c.iso3}
                      onClick={() =>
                        setCustomCountries((cur) =>
                          on ? (cur ?? []).filter((x) => x !== c.iso3) : [...(cur ?? []), c.iso3]
                        )
                      }
                      className={cn(
                        "rounded-lg px-2 py-1 text-xs cursor-pointer",
                        on ? "bg-maroon-100 font-medium text-maroon-700" : "bg-white text-ink-600 border border-sand-300"
                      )}
                    >
                      {bi(locale, c.nameEn, c.nameAr)}
                    </button>
                  );
                })}
            </div>
          </div>
        ) : null}

        {benchView === "rank" || benchView === "score" ? (
          <div style={{ height: 280, direction: "ltr" }} data-testid="benchmark-chart">
            <ResponsiveContainer>
              <LineChart data={benchSeries} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11, fill: "var(--color-ink-400)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-sand-300)" }}
                />
                <YAxis
                  reversed={benchView === "rank"}
                  tick={{ fontSize: 11, fill: "var(--color-ink-400)" }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  domain={["auto", "auto"]}
                />
                <Tooltip formatter={(v: number, name: string) => [benchView === "rank" ? `#${v}` : fmt(v), name]} />
                {benchSet
                  .filter((c) => c !== "QAT")
                  .map((c, i) => (
                    <Line
                      key={c}
                      dataKey={c}
                      stroke={
                        latestBench[0]?.country === c
                          ? "var(--color-gulf-600)"
                          : PEER_COLORS[i % PEER_COLORS.length]
                      }
                      strokeWidth={latestBench[0]?.country === c ? 1.75 : 1.25}
                      strokeOpacity={latestBench[0]?.country === c ? 0.9 : 0.6}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                <Line
                  dataKey="QAT"
                  stroke="var(--color-maroon-700)"
                  strokeWidth={2.25}
                  dot={{ r: 2 }}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        {benchView === "score" && latestBench.length ? (
          <div className="mt-4 flex flex-col gap-1.5" data-testid="benchmark-bars">
            {latestBench.map((r) => {
              const max = Math.max(...latestBench.map((x) => Math.abs(x.score))) || 1;
              return (
                <div key={r.country} className="flex items-center gap-2 text-xs">
                  <span className={cn("w-10 shrink-0 tnum", r.country === "QAT" ? "font-semibold text-maroon-900" : "text-ink-600")}>
                    {r.country}
                  </span>
                  <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-sand-100">
                    <span
                      className={cn(
                        "absolute inset-y-0 start-0 rounded-full",
                        r.country === "QAT" ? "bg-maroon-700" : "bg-ink-200"
                      )}
                      style={{ width: `${(Math.abs(r.score) / max) * 100}%` }}
                    />
                  </span>
                  <span className="w-14 shrink-0 text-end tnum text-ink-600">{fmt(r.score)}</span>
                </div>
              );
            })}
          </div>
        ) : null}

        {benchView === "gap" && gap ? (
          <div className="flex flex-wrap items-start gap-6" data-testid="benchmark-gap">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                {t("benchmark.gapTo", { country: gap.leader.country })}
              </p>
              <p className="mt-1 text-4xl font-semibold text-maroon-900 tnum" style={{ fontFamily: "var(--font-display)" }}>
                {fmt(gap.value)}
              </p>
              <p className="text-xs text-ink-600">{t("benchmark.gapUnit")}</p>
            </div>
            {gap.pillars.length ? (
              <div className="min-w-56">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                  {t("benchmark.widestGaps")}
                </p>
                <ul className="flex flex-col gap-1 text-sm text-ink-900">
                  {gap.pillars.map((p) => (
                    <li key={p.pillar.code} className="flex items-center justify-between gap-4">
                      <span>{bi(locale, p.pillar.nameEn, p.pillar.nameAr)}</span>
                      <span className="tnum text-ink-600">{fmt(p.gap)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* narrative */}
        <div className="mt-4 border-t border-sand-100 pt-3">
          {narrative ? (
            <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-ink-600" data-testid="benchmark-narrative">
              {bi(locale, narrative.en, narrative.ar)}
            </p>
          ) : (
            <Button size="sm" variant="secondary" onClick={loadNarrative} loading={narrativeBusy} data-testid="narrative-cta">
              {t("benchmark.narrativeCta")}
            </Button>
          )}
        </div>
      </section>

      {/* 7. actions */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <BriefDialog resourceType="index" resourceId={index.id} />
        <Link
          href={`/ask/c/new?q=${encodeURIComponent(`Tell me about Qatar's standing in the ${index.nameEn}`)}` as never}
          className="inline-flex h-9.5 items-center gap-2 rounded-lg border border-sand-300 bg-white px-4 text-sm font-medium text-ink-900 hover:border-maroon-300 hover:text-maroon-700"
        >
          <MessageCircleQuestion className="size-4" /> {t("askAbout")}
        </Link>
        <ReportButton
          scope={{
            kind: "indices",
            ids: [index.id],
            labelEn: index.nameEn,
            labelAr: index.nameAr,
          }}
        />
      </div>
    </div>
  );
}
