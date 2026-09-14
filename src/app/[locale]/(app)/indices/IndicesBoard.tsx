"use client";
// CR05 4.4: the Indices board. Cards ranked by Qatar's latest rank (default)
// or a compact sortable table; a summary strip; category chips; a Qatar vs
// GCC mode; the forecast summary table with expanding analysis rows.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  Download,
  LayoutGrid,
  Minus,
  RefreshCw,
  Table2,
} from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Chip, Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { ReportButton } from "@/components/nexus/ReportButton";
import type { getIndicesBoard } from "@/server/services/indices";

type BoardData = Awaited<ReturnType<typeof getIndicesBoard>>;
type Card = BoardData["cards"][number];

const CATEGORIES = ["economy", "governance", "society", "environment", "technology", "human"];

function DirectionIcon({ d, className }: { d: string | null; className?: string }) {
  if (d === "up") return <ArrowUpRight className={cn("size-3.5 text-ok", className)} aria-hidden />;
  if (d === "down")
    return <ArrowDownRight className={cn("size-3.5 text-danger", className)} aria-hidden />;
  return <Minus className={cn("size-3.5 text-ink-400", className)} aria-hidden />;
}

/** 10-year rank sparkline, inverted so up means better. */
function RankSparkline({
  points,
  highlight,
}: {
  points: { year: number; rank: number }[];
  highlight: boolean;
}) {
  if (points.length < 2) return <span className="block h-11" aria-hidden />;
  const w = 148;
  const h = 44;
  const ranks = points.map((p) => p.rank);
  const min = Math.min(...ranks);
  const max = Math.max(...ranks);
  const span = max - min || 1;
  const xy = points.map((p, i) => ({
    x: (i / (points.length - 1)) * (w - 8) + 4,
    y: 5 + ((p.rank - min) / span) * (h - 12), // small rank = top
  }));
  const path = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = xy[xy.length - 1];
  return (
    <svg width={w} height={h} className="block" aria-hidden style={{ direction: "ltr" }}>
      <path d={path} fill="none" stroke="var(--color-maroon-500)" strokeWidth={1.75} strokeLinejoin="round" />
      <circle
        cx={last.x}
        cy={last.y}
        r={highlight ? 4 : 2.5}
        fill="var(--color-maroon-700)"
        stroke="#fff"
        strokeWidth={highlight ? 1.5 : 0}
      />
    </svg>
  );
}

export function IndicesBoard({
  data,
  canRefresh,
  initialView,
  initialCategory,
}: {
  data: BoardData;
  canRefresh: boolean;
  initialView: "cards" | "table";
  initialCategory: string | null;
}) {
  const t = useTranslations("indices");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [view, setView] = React.useState<"cards" | "table">(initialView);
  const [category, setCategory] = React.useState<string | null>(initialCategory);
  const [gccMode, setGccMode] = React.useState(false);
  const [hover, setHover] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState<{ key: string; dir: 1 | -1 }>({ key: "rank", dir: 1 });
  const [openForecast, setOpenForecast] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const cards = data.cards.filter((c) => !category || c.category === category);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/v1/indices/refresh", { method: "POST" });
      if (res.ok) toast(t("refreshQueued"), "points");
      else toast(tc("error"), "error");
    } finally {
      setRefreshing(false);
    }
  }

  function exportCsv() {
    const head = [
      "code,name,publisher,year,rank,score,change,gcc_rank,forecast_1y,forecast_3y,forecast_5y,entity",
    ];
    const rows = cards.map((c) => {
      const f = data.forecastTable.find((x) => x.code === c.code);
      const dir = (h: number) =>
        f?.horizons.find((r) => r.horizon === h)?.direction ?? "";
      return [
        c.code,
        JSON.stringify(c.nameEn),
        JSON.stringify(c.publisher ?? ""),
        c.qatar?.year ?? "",
        c.qatar?.rank ?? "",
        c.qatar?.score ?? "",
        c.change ?? "",
        c.gccPosition ?? "",
        dir(1),
        dir(3),
        dir(5),
        JSON.stringify(c.entity?.shortEn ?? ""),
      ].join(",");
    });
    const blob = new Blob([head.concat(rows).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sianexus-indices.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const sortedTable = [...cards].sort((a, b) => {
    const dir = sort.dir;
    switch (sort.key) {
      case "name":
        return a.nameEn.localeCompare(b.nameEn) * dir;
      case "year":
        return ((a.qatar?.year ?? 0) - (b.qatar?.year ?? 0)) * dir;
      case "score":
        return ((a.qatar?.score ?? -1) - (b.qatar?.score ?? -1)) * dir;
      case "change":
        return ((a.change ?? -999) - (b.change ?? -999)) * dir;
      case "gcc":
        return ((a.gccPosition ?? 99) - (b.gccPosition ?? 99)) * dir;
      default:
        return ((a.qatar?.rank ?? 9999) - (b.qatar?.rank ?? 9999)) * dir;
    }
  });

  const th = (key: string, label: string) => (
    <th
      className="cursor-pointer select-none px-3 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wider text-ink-600 hover:text-maroon-700"
      onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((s.dir * -1) as 1 | -1) : 1 }))}
      aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
    >
      {label}
    </th>
  );

  return (
    <div data-testid="indices-board">
      {/* header row: refresh, filters, view toggle */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-600">
          {t("lastRefresh")}{" "}
          <span className="tnum">{data.lastRefresh ? data.lastRefresh.slice(0, 10) : "-"}</span>
        </span>
        {canRefresh ? (
          <Button size="sm" variant="secondary" onClick={refresh} loading={refreshing} data-testid="indices-refresh">
            <RefreshCw /> {t("refresh")}
          </Button>
        ) : null}
        <span className="mx-1 hidden h-5 w-px bg-sand-300 sm:block" />
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t("categoryFilter")}>
          <button
            onClick={() => setCategory(null)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs transition-colors cursor-pointer",
              !category ? "bg-maroon-100 font-medium text-maroon-700" : "text-ink-600 hover:bg-sand-100"
            )}
          >
            {t("allCategories")}
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(category === c ? null : c)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs transition-colors cursor-pointer",
                category === c ? "bg-maroon-100 font-medium text-maroon-700" : "text-ink-600 hover:bg-sand-100"
              )}
            >
              {t(`categories.${c}` as never)}
            </button>
          ))}
        </div>
        <span className="ms-auto inline-flex items-center gap-0.5 rounded-lg bg-sand-100 p-0.5">
          <button
            onClick={() => setGccMode((v) => !v)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer",
              gccMode ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
            )}
            data-testid="gcc-mode"
          >
            {t("qatarVsGcc")}
          </button>
          <button
            onClick={() => setView("cards")}
            className={cn(
              "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer",
              view === "cards" ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
            )}
          >
            <LayoutGrid className="size-3.5" /> {t("cards")}
          </button>
          <button
            onClick={() => setView("table")}
            className={cn(
              "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer",
              view === "table" ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
            )}
            data-testid="indices-table-toggle"
          >
            <Table2 className="size-3.5" /> {t("table")}
          </button>
        </span>
      </div>

      {/* summary strip */}
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-sand-100 px-4 py-2.5 text-sm" data-testid="indices-summary">
        <span className="flex items-center gap-1.5">
          <ArrowUpRight className="size-4 text-ok" aria-hidden />
          <span className="tnum font-semibold">{data.summary.improving}</span> {t("improving")}
        </span>
        <span className="flex items-center gap-1.5">
          <Minus className="size-4 text-ink-400" aria-hidden />
          <span className="tnum font-semibold">{data.summary.stable}</span> {t("stableCount")}
        </span>
        <span className="flex items-center gap-1.5">
          <ArrowDownRight className="size-4 text-danger" aria-hidden />
          <span className="tnum font-semibold">{data.summary.declining}</span> {t("declining")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="tnum font-semibold">{data.summary.gccLead}</span> {t("gccLeadCount")}
        </span>
        <span className="ms-auto flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1 text-xs font-medium text-ink-600 hover:text-maroon-700 cursor-pointer"
          >
            <Download className="size-3.5" /> CSV
          </button>
          <ReportButton
            scope={{ kind: "indices", ids: cards.map((c) => c.id), labelEn: "International indices", labelAr: "المؤشرات الدولية" }}
          />
        </span>
      </div>

      {view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <button
              key={c.id}
              onClick={() => router.push(`/indices/${c.code}` as never)}
              onMouseEnter={() => setHover(c.id)}
              onMouseLeave={() => setHover(null)}
              className="card card-hover flex flex-col gap-2 p-4 text-start cursor-pointer"
              data-testid="index-card"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink-900">
                    {bi(locale, c.nameEn, c.nameAr)}
                  </span>
                  <span className="block text-xs text-ink-600">{c.publisher}</span>
                </span>
                <DirectionIcon d={c.forecastDirection} className="mt-1 size-4" />
              </span>
              <span className="flex items-end justify-between gap-3">
                <span>
                  <span className="block text-2xl font-semibold text-maroon-900 tnum" style={{ fontFamily: "var(--font-display)" }}>
                    {c.qatar?.rank != null ? c.qatar.rank : c.qatar?.score != null ? c.qatar.score.toFixed(2) : "-"}
                  </span>
                  <span className="block text-[11px] text-ink-600 tnum">
                    {c.qatar?.rank != null && c.qatar?.total
                      ? t("rankOf", { total: c.qatar.total })
                      : c.qatar?.score != null
                        ? t("scoreLabel")
                        : t("noData")}
                    {" · "}
                    {c.qatar?.year ?? "-"}
                  </span>
                  {c.qatar?.score != null && c.qatar?.rank != null ? (
                    <span className="block text-[11px] text-ink-600 tnum">
                      {t("scoreShort")} {c.qatar.score.toFixed(c.qatar.score < 10 ? 2 : 1)}
                    </span>
                  ) : null}
                </span>
                <RankSparkline points={c.sparkline} highlight={hover === c.id} />
              </span>
              <span className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {c.change != null && c.change !== 0 ? (
                  <span
                    className={cn(
                      "flex items-center gap-0.5 tnum",
                      c.change > 0 ? "text-ok" : "text-danger"
                    )}
                  >
                    {c.change > 0 ? (
                      <ArrowUpRight className="size-3" />
                    ) : (
                      <ArrowDownRight className="size-3" />
                    )}
                    {c.changeKind === "rank"
                      ? t("rankChange", { n: Math.abs(c.change) })
                      : Math.abs(c.change).toFixed(2)}
                  </span>
                ) : null}
                {c.gccPosition ? (
                  <Chip tone={c.gccPosition === 1 ? "gold" : "sand"}>
                    {t("gccPosition", { pos: c.gccPosition })}
                  </Chip>
                ) : null}
                {c.entity ? <Chip tone="gulf">{bi(locale, c.entity.shortEn, c.entity.shortAr)}</Chip> : null}
                {c.linkedTargets.slice(0, 1).map((tg) => (
                  <Chip key={tg.id} tone="maroon">{tg.code ?? bi(locale, tg.titleEn, tg.titleAr).slice(0, 18)}</Chip>
                ))}
              </span>
              {gccMode ? (
                <span className="mt-1 border-t border-sand-100 pt-2" data-testid="gcc-scale">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-ink-600">
                    {t("gccScale")}
                    {c.gccLeader ? (
                      <span className="ms-1 font-normal normal-case tracking-normal">
                        · {t("leaderIs", { country: c.gccLeader.country })}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-1" dir="ltr">
                    {Array.from({ length: c.gccCount || 6 }, (_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-2 flex-1 rounded-full",
                          i + 1 === c.gccPosition ? "bg-maroon-700" : "bg-sand-300"
                        )}
                        title={`${i + 1}`}
                      />
                    ))}
                  </span>
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto" data-testid="indices-table">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-sand-100">
                {th("name", t("colIndex"))}
                {th("year", t("colYear"))}
                {th("rank", t("colRank"))}
                {th("score", t("colScore"))}
                {th("change", t("colChange"))}
                {th("gcc", t("colGcc"))}
                <th className="px-3 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wider text-ink-600">1y</th>
                <th className="px-3 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wider text-ink-600">3y</th>
                <th className="px-3 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wider text-ink-600">5y</th>
                <th className="px-3 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wider text-ink-600">{t("colEntity")}</th>
              </tr>
            </thead>
            <tbody>
              {sortedTable.map((c) => {
                const f = data.forecastTable.find((x) => x.code === c.code);
                const dir = (h: number) => f?.horizons.find((r) => r.horizon === h)?.direction ?? null;
                return (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-b border-sand-100 last:border-0 hover:bg-maroon-50/60"
                    onClick={() => router.push(`/indices/${c.code}` as never)}
                  >
                    <td className="px-3 py-2.5">
                      <span className="block font-medium text-ink-900">{bi(locale, c.nameEn, c.nameAr)}</span>
                      <span className="block text-xs text-ink-600">{c.publisher}</span>
                    </td>
                    <td className="px-3 py-2.5 tnum">{c.qatar?.year ?? "-"}</td>
                    <td className="px-3 py-2.5 tnum font-semibold text-maroon-900">
                      {c.qatar?.rank ?? "-"}
                      {c.qatar?.total ? <span className="font-normal text-ink-400"> / {c.qatar.total}</span> : null}
                    </td>
                    <td className="px-3 py-2.5 tnum">{c.qatar?.score != null ? c.qatar.score.toFixed(c.qatar.score < 10 ? 2 : 1) : "-"}</td>
                    <td className={cn("px-3 py-2.5 tnum", (c.change ?? 0) > 0 ? "text-ok" : (c.change ?? 0) < 0 ? "text-danger" : "text-ink-400")}>
                      {c.change != null ? (c.change > 0 ? `+${c.change}` : c.change) : "-"}
                    </td>
                    <td className="px-3 py-2.5 tnum">{c.gccPosition ?? "-"}</td>
                    <td className="px-3 py-2.5"><DirectionIcon d={dir(1)} /></td>
                    <td className="px-3 py-2.5"><DirectionIcon d={dir(3)} /></td>
                    <td className="px-3 py-2.5"><DirectionIcon d={dir(5)} /></td>
                    <td className="px-3 py-2.5 text-xs text-ink-600">
                      {c.entity ? bi(locale, c.entity.shortEn, c.entity.shortAr) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CR05 4.6.8: the forecast summary table */}
      <div className="mt-8" data-testid="forecast-summary">
        <h2 className="mb-1 text-lg">{t("forecastSummary")}</h2>
        <p className="mb-3 text-xs text-ink-600">{t("forecastDisclaimer")}</p>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-sand-100 text-[11px] uppercase tracking-wider text-ink-600">
                <th className="px-3 py-2.5 text-start">{t("colIndex")}</th>
                <th className="px-3 py-2.5 text-start">{t("colLatest")}</th>
                <th className="px-3 py-2.5 text-start">+1</th>
                <th className="px-3 py-2.5 text-start">+3</th>
                <th className="px-3 py-2.5 text-start">+5</th>
                <th className="px-3 py-2.5 text-start">{t("colRange")}</th>
                <th className="px-3 py-2.5 text-start">{t("colConfidence")}</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {data.forecastTable
                .filter((f) => !category || cards.some((c) => c.code === f.code))
                .map((f) => {
                  const open = openForecast === f.code;
                  const cell = (h: number) => {
                    const row = f.horizons.find((r) => r.horizon === h);
                    if (!row) return <span className="text-ink-400">-</span>;
                    const v =
                      row.centralRank != null
                        ? Math.round(row.centralRank)
                        : row.centralScore != null
                          ? row.centralScore.toFixed(row.centralScore < 10 ? 2 : 1)
                          : "-";
                    return (
                      <span className="flex items-center gap-1 tnum">
                        {v} <DirectionIcon d={row.direction} />
                      </span>
                    );
                  };
                  const f3 = f.horizons.find((r) => r.horizon === 3);
                  return (
                    <React.Fragment key={f.code}>
                      <tr
                        className="cursor-pointer border-b border-sand-100 hover:bg-maroon-50/60"
                        onClick={() => setOpenForecast(open ? null : f.code)}
                        data-testid="forecast-row"
                      >
                        <td className="px-3 py-2.5 font-medium text-ink-900">{bi(locale, f.nameEn, f.nameAr)}</td>
                        <td className="px-3 py-2.5 tnum">
                          {f.latest?.rank ?? (f.latest?.score != null ? f.latest.score.toFixed(2) : "-")}
                          <span className="text-xs text-ink-400"> · {f.latest?.year ?? "-"}</span>
                        </td>
                        <td className="px-3 py-2.5">{cell(1)}</td>
                        <td className="px-3 py-2.5">{cell(3)}</td>
                        <td className="px-3 py-2.5">{cell(5)}</td>
                        <td className="px-3 py-2.5 tnum text-xs text-ink-600">
                          {f3 && f3.low != null && f3.high != null
                            ? `${f3.low.toFixed(f3.low < 10 && f3.low > -10 ? 2 : 1)} – ${f3.high.toFixed(f3.high < 10 && f3.high > -10 ? 2 : 1)}`
                            : "-"}
                        </td>
                        <td className="px-3 py-2.5">
                          {f.confidence ? (
                            <Chip tone={f.confidence === "narrow" ? "ok" : f.confidence === "medium" ? "sand" : "warn"}>
                              {t(`confidence.${f.confidence}` as never)}
                            </Chip>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-end">
                          <ChevronDown className={cn("size-4 text-ink-400 transition-transform", open && "rotate-180")} aria-hidden />
                        </td>
                      </tr>
                      {open && f3 ? (
                        <tr className="border-b border-sand-100 bg-sand-50/60">
                          <td colSpan={8} className="px-4 py-3">
                            <p className="max-w-3xl whitespace-pre-line text-xs leading-relaxed text-ink-600">
                              {bi(locale, f3.explanationEn ?? "", f3.explanationAr ?? "")}
                            </p>
                            <Link
                              href={`/indices/${f.code}` as never}
                              className="link-draw mt-2 inline-block text-xs font-medium text-maroon-700"
                            >
                              {t("openMethod")}
                            </Link>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
