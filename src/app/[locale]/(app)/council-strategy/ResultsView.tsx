"use client";
// CR07 2.4.6: the results view. Goals down the side, reporting periods across
// the top, one RAG cell per goal and period, the indicator cards behind each
// cell, and a written summary of the chosen period composed from the numbers
// on the page (mock mode: no model is called).
//
// The period axis is a CSS grid with grid ARIA roles rather than a table: the
// product does not use HTML tables, and the axis is forced left to right in
// both locales so a time line never reads backwards.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDownRight, ArrowUpRight, Check, Minus, TriangleAlert, X } from "lucide-react";
import { bi, cn } from "@/lib/utils";
import { formatNumber, formatPeriod } from "@/lib/format";
import { Chip, EmptyState, NativeSelect, SectionTitle } from "@/components/ui/primitives";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import type {
  Cadence,
  CouncilIndicatorCard,
  CouncilPageData,
  IndicatorPoint,
  Rag,
} from "@/server/services/council";

/* CR07 2.4: the arithmetic comes from src/lib/council-math.ts, which the
   strategy service imports too, so the matrix on screen and the one the API
   builds can never drift apart. */
import { ragOf, periodRange } from "@/lib/council-math";


/* ------------------------------------------------------------------ */

type Trend = "up" | "down" | "flat" | null;

type MatrixCell = {
  period: string;
  rag: Rag;
  share: number | null;
  reported: number;
  onTarget: number;
  behind: number;
  trend: Trend;
};

type MatrixRow = {
  goalId: string;
  code: string | null;
  titleEn: string;
  titleAr: string;
  cells: MatrixCell[];
};

type Matrix = { cadence: Cadence; periods: string[]; rows: MatrixRow[] };

const CADENCES: Cadence[] = ["monthly", "quarterly", "yearly"];

const RAG_TOKEN: Record<Rag, string> = {
  on_target: "var(--color-ok)",
  at_risk: "var(--color-warn)",
  behind: "var(--color-danger)",
  no_data: "var(--color-ink-400)",
};

const RAG_CHIP: Record<Rag, "ok" | "warn" | "danger" | "sand"> = {
  on_target: "ok",
  at_risk: "warn",
  behind: "danger",
  no_data: "sand",
};

/** Walks every node up to the goal that owns it. */
function goalIndex(data: CouncilPageData): Map<string, string> {
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const out = new Map<string, string>();
  for (const node of data.nodes) {
    let cursor = byId.get(node.id);
    for (let i = 0; i < 6 && cursor; i++) {
      if (cursor.level === "goal") {
        out.set(node.id, cursor.id);
        break;
      }
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
  }
  return out;
}

function buildMatrix(data: CouncilPageData, cadence: Cadence): Matrix {
  const from = data.strategy.periodFrom ?? "2025-01-01";
  const today = new Date().toISOString().slice(0, 10);
  const reportedPeriods = new Set<string>();
  for (const indicator of data.indicators) {
    if (indicator.frequency !== cadence) continue;
    for (const point of indicator.series) if (point.actual != null) reportedPeriods.add(point.period);
  }
  const periods = periodRange(cadence, from, today).filter((p) => reportedPeriods.has(p));

  const goalOf = goalIndex(data);
  const tally = new Map<string, { reported: number; onTarget: number; behind: number }>();
  for (const indicator of data.indicators) {
    if (indicator.frequency !== cadence) continue;
    const goalId = goalOf.get(indicator.nodeId);
    if (!goalId) continue;
    for (const point of indicator.series) {
      if (point.actual == null) continue;
      const { rag } = ragOf(point.actual, point.target, indicator.direction);
      if (rag === "no_data") continue;
      const key = `${goalId}|${point.period}`;
      const entry = tally.get(key) ?? { reported: 0, onTarget: 0, behind: 0 };
      entry.reported += 1;
      if (rag === "on_target") entry.onTarget += 1;
      if (rag === "behind") entry.behind += 1;
      tally.set(key, entry);
    }
  }

  const goals = data.nodes.filter((n) => n.level === "goal").sort((a, b) => a.sort - b.sort);
  const rows: MatrixRow[] = goals.map((goal) => {
    const cells: MatrixCell[] = periods.map((period) => {
      const entry = tally.get(`${goal.id}|${period}`);
      const share = entry && entry.reported ? entry.onTarget / entry.reported : null;
      const rag: Rag =
        share == null ? "no_data" : share >= 0.8 ? "on_target" : share >= 0.5 ? "at_risk" : "behind";
      return {
        period,
        rag,
        share,
        reported: entry?.reported ?? 0,
        onTarget: entry?.onTarget ?? 0,
        behind: entry?.behind ?? 0,
        trend: null,
      };
    });
    for (let i = 1; i < cells.length; i++) {
      const prev = cells[i - 1].share;
      const now = cells[i].share;
      if (prev == null || now == null) continue;
      cells[i].trend = now > prev + 0.02 ? "up" : now < prev - 0.02 ? "down" : "flat";
    }
    return { goalId: goal.id, code: goal.code, titleEn: goal.titleEn, titleAr: goal.titleAr, cells };
  });

  return { cadence, periods, rows };
}

/* ------------------------------------------------------------------ */
/* small parts                                                          */
/* ------------------------------------------------------------------ */

function RagGlyph({ rag, className }: { rag: Rag; className?: string }) {
  const shared = cn("size-3 shrink-0", className);
  if (rag === "on_target") return <Check className={shared} aria-hidden />;
  if (rag === "at_risk") return <TriangleAlert className={shared} aria-hidden />;
  if (rag === "behind") return <X className={shared} aria-hidden />;
  return <Minus className={shared} aria-hidden />;
}

function TrendGlyph({ trend, className }: { trend: Trend; className?: string }) {
  const shared = cn("size-3 shrink-0", className);
  if (trend === "up") return <ArrowUpRight className={shared} aria-hidden />;
  if (trend === "down") return <ArrowDownRight className={shared} aria-hidden />;
  if (trend === "flat") return <Minus className={shared} aria-hidden />;
  return null;
}

/** Target dashed, actual solid, the chosen period marked in gold. */
function IndicatorSpark({
  series,
  highlight,
  label,
}: {
  series: IndicatorPoint[];
  highlight: string;
  label: string;
}) {
  const points = series.filter((p) => p.actual != null || p.target != null);
  if (points.length < 2) return null;
  const values = points
    .flatMap((p) => [p.actual, p.target])
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.abs(max) || 1;
  const W = 220;
  const H = 54;
  const PAD = 5;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD);
  const path = (key: "actual" | "target") =>
    points
      .map((p, i) => (p[key] == null ? null : `${x(i).toFixed(1)},${y(p[key] as number).toFixed(1)}`))
      .filter((s): s is string => s !== null)
      .join(" ");
  const actual = path("actual");
  const target = path("target");
  const markIndex = points.findIndex((p) => p.period === highlight);

  return (
    <div style={{ direction: "ltr" }} className="mt-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={label}
        preserveAspectRatio="xMidYMid meet"
      >
        {markIndex >= 0 ? (
          <line
            x1={x(markIndex)}
            y1={PAD}
            x2={x(markIndex)}
            y2={H - PAD}
            stroke="var(--color-gold-500)"
            strokeWidth={1.5}
          />
        ) : null}
        {target ? (
          <polyline
            points={target}
            fill="none"
            stroke="var(--color-ink-400)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            strokeLinejoin="round"
          />
        ) : null}
        {actual ? (
          <polyline
            points={actual}
            fill="none"
            stroke="var(--color-maroon-700)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the view                                                             */
/* ------------------------------------------------------------------ */

export function ResultsView({ data, canEdit }: { data: CouncilPageData; canEdit: boolean }) {
  const t = useTranslations("council");
  const tc = useTranslations("common");
  const locale = useLocale();
  void canEdit; // the results view is read only; editing lives in the chain

  const [cadence, setCadence] = React.useState<Cadence>("quarterly");
  const matrix = React.useMemo(() => buildMatrix(data, cadence), [data, cadence]);
  const periods = matrix.periods;

  const [period, setPeriod] = React.useState<string | null>(null);
  const activePeriod = period && periods.includes(period) ? period : periods[periods.length - 1] ?? null;

  const [open, setOpen] = React.useState<{ goalId: string; period: string } | null>(null);
  const [focusCell, setFocusCell] = React.useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const cellRefs = React.useRef(new Map<string, HTMLButtonElement | null>());

  const goalOf = React.useMemo(() => goalIndex(data), [data]);
  const nodeById = React.useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes]);

  /* indicators of the chosen cadence sitting anywhere beneath a goal */
  const indicatorsForGoal = React.useCallback(
    (goalId: string) =>
      data.indicators
        .filter((i) => i.frequency === cadence && goalOf.get(i.nodeId) === goalId)
        .sort((a, b) => a.code.localeCompare(b.code)),
    [data.indicators, cadence, goalOf]
  );

  const shareLabel = React.useCallback(
    (share: number | null) =>
      share == null ? t("results.noData") : `${formatNumber(Math.round(share * 100), locale, { decimals: 0 })}%`,
    [t, locale]
  );

  /* ---------------- the narrative, composed from the data ---------------- */
  const narrative = React.useMemo(() => {
    if (!activePeriod) return [] as string[];
    const label = formatPeriod(activePeriod, locale);
    const column = matrix.rows.map((row) => ({
      row,
      cell: row.cells.find((c) => c.period === activePeriod) ?? null,
    }));
    const withData = column.filter((x) => x.cell && x.cell.share != null);
    const goalName = (row: MatrixRow) =>
      row.code ? `${row.code} ${bi(locale, row.titleEn, row.titleAr)}` : bi(locale, row.titleEn, row.titleAr);

    if (!withData.length) {
      return [t("results.narrative.none", { period: label })];
    }

    const sentences: string[] = [];
    const onTarget = withData.filter((x) => x.cell!.rag === "on_target");
    sentences.push(
      t("results.narrative.lead", {
        period: label,
        onTarget: onTarget.length,
        total: withData.length,
      })
    );

    const improved = withData.filter((x) => x.cell!.trend === "up").map((x) => x.row);
    const declined = withData.filter((x) => x.cell!.trend === "down").map((x) => x.row);
    if (improved.length === 1) {
      sentences.push(t("results.narrative.improvedOne", { goal: goalName(improved[0]) }));
    } else if (improved.length > 1) {
      sentences.push(
        t("results.narrative.improvedMany", {
          count: improved.length,
          goal: goalName(improved[0]),
        })
      );
    } else if (declined.length === 1) {
      sentences.push(t("results.narrative.declinedOne", { goal: goalName(declined[0]) }));
    }

    /* the goal carrying the most indicators behind target this period */
    let worst: { row: MatrixRow; behind: CouncilIndicatorCard[] } | null = null;
    for (const entry of withData) {
      const behind = indicatorsForGoal(entry.row.goalId).filter((indicator) => {
        const point = indicator.series.find((p) => p.period === activePeriod);
        if (!point || point.actual == null) return false;
        return ragOf(point.actual, point.target, indicator.direction).rag === "behind";
      });
      if (behind.length && (!worst || behind.length > worst.behind.length)) {
        worst = { row: entry.row, behind };
      }
    }
    if (worst) {
      const nodeIds = new Set(worst.behind.map((i) => i.nodeId));
      const single = nodeIds.size === 1 ? nodeById.get([...nodeIds][0]) : undefined;
      sentences.push(
        single
          ? t("results.narrative.behindUnder", {
              goal: goalName(worst.row),
              count: worst.behind.length,
              node: bi(locale, single.titleEn, single.titleAr),
            })
          : t("results.narrative.behind", {
              goal: goalName(worst.row),
              count: worst.behind.length,
            })
      );
    } else if (onTarget.length === withData.length) {
      sentences.push(t("results.narrative.allClear"));
    }

    const missing = column.length - withData.length;
    if (missing > 0) sentences.push(t("results.narrative.silent", { count: missing }));

    return sentences.slice(0, 4);
  }, [activePeriod, matrix.rows, locale, t, indicatorsForGoal, nodeById]);

  /* ---------------- keyboard roving inside the grid ---------------- */
  function onGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const rows = matrix.rows.length;
    const cols = periods.length;
    if (!rows || !cols) return;
    let { r, c } = focusCell;
    switch (event.key) {
      case "ArrowRight":
        c = Math.min(cols - 1, c + 1);
        break;
      case "ArrowLeft":
        c = Math.max(0, c - 1);
        break;
      case "ArrowDown":
        r = Math.min(rows - 1, r + 1);
        break;
      case "ArrowUp":
        r = Math.max(0, r - 1);
        break;
      case "Home":
        c = 0;
        break;
      case "End":
        c = cols - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    setFocusCell({ r, c });
    cellRefs.current.get(`${r}-${c}`)?.focus();
  }

  const openGoal = open ? matrix.rows.find((row) => row.goalId === open.goalId) ?? null : null;
  const openIndicators = open ? indicatorsForGoal(open.goalId) : [];
  const template = `minmax(9.5rem, 14rem) repeat(${Math.max(1, periods.length)}, minmax(4.25rem, 1fr))`;

  return (
    <div data-testid="results-view">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionTitle className="mb-1">{t("results.title")}</SectionTitle>
          <p className="max-w-prose text-sm text-ink-600">{t("results.intro")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-600">
              {t("results.cadenceLabel")}
            </span>
            <NativeSelect
              data-testid="results-cadence"
              className="w-40 cursor-pointer"
              value={cadence}
              onChange={(e) => {
                setCadence(e.target.value as Cadence);
                setPeriod(null);
                setFocusCell({ r: 0, c: 0 });
              }}
            >
              {CADENCES.map((option) => (
                <option key={option} value={option}>
                  {t(`results.cadence.${option}`)}
                </option>
              ))}
            </NativeSelect>
          </label>
          {periods.length ? (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-600">
                {t("results.periodLabel")}
              </span>
              <NativeSelect
                data-testid="results-period"
                className="w-40 cursor-pointer"
                value={activePeriod ?? ""}
                onChange={(e) => setPeriod(e.target.value)}
              >
                {[...periods].reverse().map((p) => (
                  <option key={p} value={p}>
                    {formatPeriod(p, locale)}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ) : null}
        </div>
      </div>

      {!periods.length || !matrix.rows.length ? (
        <EmptyState title={tc("nothingHere")} hint={t("results.emptyHint")} />
      ) : (
        <>
          {/* the matrix: a CSS grid, never a table, with its axis forced ltr */}
          <div className="card overflow-x-auto p-3">
            <div
              role="grid"
              aria-label={t("results.gridAria")}
              onKeyDown={onGridKeyDown}
              style={{ direction: "ltr", minWidth: `${160 + periods.length * 72}px` }}
            >
              <div role="row" className="grid gap-1" style={{ gridTemplateColumns: template }}>
                <div
                  role="columnheader"
                  className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400"
                  style={{ direction: locale === "ar" ? "rtl" : "ltr", textAlign: "start" }}
                >
                  {t("results.goalColumn")}
                </div>
                {periods.map((p) => (
                  <div
                    key={p}
                    role="columnheader"
                    className={cn(
                      "px-1 pb-2 text-center text-[11px] font-semibold tnum",
                      p === activePeriod ? "text-maroon-900" : "text-ink-600"
                    )}
                  >
                    {formatPeriod(p, locale)}
                  </div>
                ))}
              </div>

              {matrix.rows.map((row, r) => (
                <div
                  key={row.goalId}
                  role="row"
                  className="grid gap-1 pb-1"
                  style={{ gridTemplateColumns: template }}
                >
                  <div
                    role="rowheader"
                    className="flex items-center gap-2 px-2 py-1"
                    style={{ direction: locale === "ar" ? "rtl" : "ltr", textAlign: "start" }}
                  >
                    {row.code ? (
                      <span className="shrink-0 text-[11px] font-semibold text-maroon-700 tnum">
                        {row.code}
                      </span>
                    ) : null}
                    <span className="line-clamp-2 text-xs leading-snug text-ink-900">
                      {bi(locale, row.titleEn, row.titleAr)}
                    </span>
                  </div>
                  {row.cells.map((cell, c) => {
                    const tint = 12 + Math.round((cell.share ?? 0) * 18);
                    const isActive = cell.period === activePeriod;
                    const cellAria =
                      cell.share == null
                        ? t("results.cellAriaNoData", {
                            goal: bi(locale, row.titleEn, row.titleAr),
                            period: formatPeriod(cell.period, locale),
                          })
                        : t("results.cellAria", {
                            goal: bi(locale, row.titleEn, row.titleAr),
                            period: formatPeriod(cell.period, locale),
                            rag: t(`results.rag.${cell.rag}`),
                            share: shareLabel(cell.share),
                            reported: cell.reported,
                            trend: t(`results.trend.${cell.trend ?? "none"}`),
                          });
                    return (
                      <div key={cell.period} role="gridcell" className="p-0">
                        <button
                          type="button"
                          data-testid="results-cell"
                          ref={(el) => {
                            cellRefs.current.set(`${r}-${c}`, el);
                          }}
                          tabIndex={focusCell.r === r && focusCell.c === c ? 0 : -1}
                          aria-label={cellAria}
                          onFocus={() => setFocusCell({ r, c })}
                          onClick={() => {
                            setPeriod(cell.period);
                            setOpen({ goalId: row.goalId, period: cell.period });
                          }}
                          className={cn(
                            "flex h-full w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 transition-transform duration-150 hover:-translate-y-0.5",
                            isActive && "ring-2 ring-gold-500"
                          )}
                          style={{
                            backgroundColor:
                              cell.rag === "no_data"
                                ? "var(--color-sand-100)"
                                : `color-mix(in srgb, ${RAG_TOKEN[cell.rag]} ${tint}%, transparent)`,
                            color:
                              cell.rag === "no_data" ? "var(--color-ink-600)" : RAG_TOKEN[cell.rag],
                          }}
                        >
                          <span className="text-sm font-semibold tnum">
                            {cell.share == null ? "·" : shareLabel(cell.share)}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <RagGlyph rag={cell.rag} />
                            <TrendGlyph trend={cell.trend} />
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* legend: colour is never the only signal */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-600">
            {(["on_target", "at_risk", "behind", "no_data"] as Rag[]).map((rag) => (
              <span key={rag} className="flex items-center gap-1.5">
                <span
                  className="inline-flex size-4 items-center justify-center rounded"
                  style={{
                    backgroundColor:
                      rag === "no_data"
                        ? "var(--color-sand-100)"
                        : `color-mix(in srgb, ${RAG_TOKEN[rag]} 22%, transparent)`,
                    color: rag === "no_data" ? "var(--color-ink-600)" : RAG_TOKEN[rag],
                  }}
                  aria-hidden
                >
                  <RagGlyph rag={rag} />
                </span>
                {t(`results.rag.${rag}`)}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <ArrowUpRight className="size-3.5 text-ok" aria-hidden />
              {t("results.trendHint")}
            </span>
          </div>

          {/* the written summary of the chosen period */}
          <section className="mt-5" data-testid="results-narrative" aria-live="polite">
            <div className="card border-s-2 border-s-maroon-700 p-5">
              <h3 className="mb-2 text-base">{t("results.narrativeTitle")}</h3>
              <p className="measure text-sm leading-relaxed text-ink-900">{narrative.join(" ")}</p>
              <p className="mt-2 text-xs text-ink-400">{t("results.narrativeSource")}</p>
            </div>
          </section>
        </>
      )}

      {/* the indicator cards behind one cell */}
      <Dialog open={open !== null} onOpenChange={(next) => (next ? null : setOpen(null))}>
        <DialogContent
          className="max-h-[85vh] w-[min(640px,94vw)] overflow-y-auto"
          title={
            openGoal && open
              ? t("results.dialogTitle", {
                  goal: openGoal.code
                    ? `${openGoal.code} ${bi(locale, openGoal.titleEn, openGoal.titleAr)}`
                    : bi(locale, openGoal.titleEn, openGoal.titleAr),
                  period: formatPeriod(open.period, locale),
                })
              : t("results.dialogFallbackTitle")
          }
        >
          <div data-testid="results-indicator-card" className="space-y-3">
            {openIndicators.length === 0 ? (
              <p className="text-sm text-ink-600">{t("results.dialogEmpty")}</p>
            ) : (
              openIndicators.map((indicator) => {
                const point = open
                  ? indicator.series.find((p) => p.period === open.period) ?? null
                  : null;
                const shown: IndicatorPoint | null = point ?? indicator.latest;
                const rag = shown
                  ? ragOf(shown.actual, shown.target, indicator.direction).rag
                  : "no_data";
                const unit = indicator.unit ? ` ${indicator.unit}` : "";
                return (
                  <article key={indicator.id} className="rounded-xl border border-sand-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-maroon-700 tnum">
                          {indicator.code}
                        </p>
                        <h4 className="text-sm leading-snug text-ink-900">
                          {bi(locale, indicator.nameEn, indicator.nameAr)}
                        </h4>
                      </div>
                      <Chip tone={RAG_CHIP[rag]}>{t(`results.rag.${rag}`)}</Chip>
                    </div>
                    <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                      <div className="flex items-baseline gap-1.5">
                        <dt className="text-ink-600">{t("results.actual")}</dt>
                        <dd className="font-semibold text-ink-900 tnum">
                          {shown && shown.actual != null
                            ? `${formatNumber(shown.actual, locale)}${unit}`
                            : t("results.noData")}
                        </dd>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <dt className="text-ink-600">{t("results.target")}</dt>
                        <dd className="font-semibold text-ink-900 tnum">
                          {shown && shown.target != null
                            ? `${formatNumber(shown.target, locale)}${unit}`
                            : t("results.noData")}
                        </dd>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <dt className="text-ink-600">{t("results.reportedPeriod")}</dt>
                        <dd className="font-semibold text-ink-900 tnum">
                          {shown ? formatPeriod(shown.period, locale) : t("results.noData")}
                        </dd>
                      </div>
                    </dl>
                    <IndicatorSpark
                      series={indicator.series}
                      highlight={open?.period ?? ""}
                      label={t("results.sparkAria", {
                        indicator: bi(locale, indicator.nameEn, indicator.nameAr),
                      })}
                    />
                    <p className="mt-1 text-[11px] text-ink-400">{t("results.sparkLegend")}</p>
                  </article>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
