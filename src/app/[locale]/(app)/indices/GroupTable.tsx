"use client";
// CR08 4.2: the per-group table view. A CSS grid with ARIA table roles (no
// HTML table): name, latest year, rank, score, change, forecast direction.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { DirectionIcon, SdgChip, fmtValue, type Card } from "./board-shared";

type SortKey = "name" | "year" | "rank" | "score" | "change" | "forecast";

const COLS = "grid-cols-[minmax(180px,2.4fr)_minmax(64px,0.8fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(90px,1fr)]";

const DIR_ORDER: Record<string, number> = { up: 0, stable: 1, down: 2 };

export function GroupTable({ cards, testId }: { cards: Card[]; testId?: string }) {
  const t = useTranslations("indices");
  const locale = useLocale();
  const router = useRouter();
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "rank", dir: 1 });

  const rows = [...cards].sort((a, b) => {
    const dir = sort.dir;
    switch (sort.key) {
      case "name":
        return bi(locale, a.nameEn, a.nameAr).localeCompare(bi(locale, b.nameEn, b.nameAr), locale) * dir;
      case "year":
        return ((a.home?.year ?? 0) - (b.home?.year ?? 0)) * dir;
      case "score":
        return ((a.home?.score ?? -Infinity) - (b.home?.score ?? -Infinity)) * dir;
      case "change":
        return ((a.change ?? -999) - (b.change ?? -999)) * dir;
      case "forecast":
        return ((DIR_ORDER[a.forecastDirection ?? "stable"] ?? 1) - (DIR_ORDER[b.forecastDirection ?? "stable"] ?? 1)) * dir;
      default:
        return ((a.home?.rank ?? 9999) - (b.home?.rank ?? 9999)) * dir;
    }
  });

  const header = (key: SortKey, label: string) => {
    const active = sort.key === key;
    return (
      <button
        type="button"
        role="columnheader"
        aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((s.dir * -1) as 1 | -1) : 1 }))}
        className={cn(
          "flex items-center gap-1 px-3 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wider rtl:tracking-normal cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-aqua-500",
          active ? "text-navy-700" : "text-ink-600 hover:text-navy-700"
        )}
      >
        {label}
        {active ? (
          sort.dir === 1 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />
        ) : null}
      </button>
    );
  };

  return (
    <div className="card overflow-x-auto" data-testid={testId ?? "indices-table"}>
      <div role="table" aria-label={t("table")} className="min-w-[640px] text-sm">
        <div role="rowgroup">
          <div role="row" className={cn("grid border-b border-mist-100", COLS)}>
            {header("name", t("colIndex"))}
            {header("year", t("colYear"))}
            {header("rank", t("colRank"))}
            {header("score", t("colScore"))}
            {header("change", t("colChange"))}
            {header("forecast", t("colForecast"))}
          </div>
        </div>
        <div role="rowgroup">
          {rows.map((c) => (
            <div
              key={c.id}
              role="row"
              tabIndex={0}
              onClick={() => router.push(`/indices/${c.code}` as never)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/indices/${c.code}` as never);
                }
              }}
              className={cn(
                "grid cursor-pointer items-center border-b border-mist-100 last:border-0 hover:bg-navy-50/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-aqua-500",
                COLS
              )}
              data-testid="indices-table-row"
            >
              <div role="cell" className="min-w-0 px-3 py-2.5">
                <span className="flex items-center gap-1.5">
                  {c.sdgGoal != null ? <SdgChip goal={c.sdgGoal} /> : null}
                  <span className="block truncate font-medium text-ink-900">{bi(locale, c.nameEn, c.nameAr)}</span>
                </span>
                <span className="block truncate text-xs text-ink-600">
                  {c.statistics ? t("statisticsSource") : c.publisher}
                </span>
              </div>
              <div role="cell" className="px-3 py-2.5 tnum">{c.home?.year ?? "-"}</div>
              <div role="cell" className="px-3 py-2.5 tnum font-semibold text-navy-900">
                {/* an LTR isolate keeps "38 / 213" in that order inside Arabic text */}
                <span dir="ltr" className="inline-block">
                  {c.home?.rank ?? "-"}
                  {c.home?.rank != null && c.home?.total ? (
                    <span className="font-normal text-ink-400"> / {c.home.total}</span>
                  ) : null}
                </span>
              </div>
              <div role="cell" className="px-3 py-2.5 tnum">
                {fmtValue(c.home?.score)}
                {c.statistics?.unit && c.home?.score != null ? (
                  <span className="text-xs text-ink-400"> {c.statistics.unit}</span>
                ) : null}
              </div>
              <div
                role="cell"
                className={cn(
                  "px-3 py-2.5 tnum",
                  (c.change ?? 0) > 0 ? "text-ok" : (c.change ?? 0) < 0 ? "text-danger" : "text-ink-400"
                )}
              >
                <span dir="ltr" className="inline-block">
                  {c.change != null
                    ? c.changeKind === "rank"
                      ? `${c.change > 0 ? "+" : ""}${c.change}`
                      : `${c.change > 0 ? "+" : ""}${fmtValue(c.change)}`
                    : "-"}
                </span>
              </div>
              <div role="cell" className="flex items-center gap-1.5 px-3 py-2.5 text-xs text-ink-600">
                <DirectionIcon d={c.forecastDirection} />
                {c.forecastDirection ? t(`direction.${c.forecastDirection}` as never) : c.forecastEnabled ? "-" : t("forecastOff")}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
