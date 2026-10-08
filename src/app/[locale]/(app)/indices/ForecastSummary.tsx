"use client";
// CR05 4.6.8 forecast summary, rebuilt for CR08 as a CSS grid with ARIA
// table roles. Rows expand to the +3 year explanation.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronDown } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Chip } from "@/components/ui/primitives";
import { DirectionIcon, fmtValue, type BoardData } from "./board-shared";

const COLS = "grid-cols-[minmax(180px,2.4fr)_minmax(90px,1fr)_minmax(72px,0.8fr)_minmax(72px,0.8fr)_minmax(72px,0.8fr)_minmax(110px,1.2fr)_minmax(90px,1fr)_32px]";

export function ForecastSummary({ rows }: { rows: BoardData["forecastTable"] }) {
  const t = useTranslations("indices");
  const locale = useLocale();
  const [open, setOpen] = React.useState<string | null>(null);

  const head = (label: string) => (
    <div role="columnheader" className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600 rtl:tracking-normal">
      {label}
    </div>
  );

  return (
    <div className="mt-8" data-testid="forecast-summary">
      <h2 className="mb-1 font-display text-lg">{t("forecastSummary")}</h2>
      <p className="mb-3 text-xs text-ink-600">{t("forecastDisclaimer")}</p>
      <div className="card overflow-x-auto">
        <div role="table" aria-label={t("forecastSummary")} className="min-w-[860px] text-sm">
          <div role="rowgroup">
            <div role="row" className={cn("grid border-b border-mist-100", COLS)}>
              {head(t("colIndex"))}
              {head(t("colLatest"))}
              {head("+1")}
              {head("+3")}
              {head("+5")}
              {head(t("colRange"))}
              {head(t("colConfidence"))}
              <div role="columnheader" className="px-3 py-2.5" aria-label={t("openMethod")} />
            </div>
          </div>
          <div role="rowgroup">
            {rows.length === 0 ? (
              <div role="row" className="grid">
                <div role="cell" className="px-4 py-6 text-center text-sm text-ink-400">
                  {t("forecast.none")}
                </div>
              </div>
            ) : null}
            {rows.map((f) => {
              const isOpen = open === f.code;
              const cell = (h: number) => {
                const row = f.horizons.find((r) => r.horizon === h);
                if (!row) return <span className="text-ink-400">-</span>;
                const v =
                  row.centralRank != null
                    ? Math.round(row.centralRank)
                    : row.centralScore != null
                      ? fmtValue(row.centralScore)
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
                  <div
                    role="row"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : f.code)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpen(isOpen ? null : f.code);
                      }
                    }}
                    className={cn(
                      "grid cursor-pointer items-center border-b border-mist-100 hover:bg-navy-50/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-aqua-500",
                      COLS
                    )}
                    data-testid="forecast-row"
                  >
                    <div role="cell" className="truncate px-3 py-2.5 font-medium text-ink-900">
                      {bi(locale, f.nameEn, f.nameAr)}
                    </div>
                    <div role="cell" className="px-3 py-2.5 tnum">
                      {f.latest?.rank ?? (f.latest?.score != null ? fmtValue(f.latest.score) : "-")}
                      <span className="text-xs text-ink-400"> · {f.latest?.year ?? "-"}</span>
                    </div>
                    <div role="cell" className="px-3 py-2.5">{cell(1)}</div>
                    <div role="cell" className="px-3 py-2.5">{cell(3)}</div>
                    <div role="cell" className="px-3 py-2.5">{cell(5)}</div>
                    <div role="cell" className="px-3 py-2.5 tnum text-xs text-ink-600">
                      {f3 && f3.low != null && f3.high != null
                        ? `${fmtValue(f3.low)} to ${fmtValue(f3.high)}`
                        : "-"}
                    </div>
                    <div role="cell" className="px-3 py-2.5">
                      {f.confidence ? (
                        <Chip tone={f.confidence === "narrow" ? "ok" : f.confidence === "medium" ? "mist" : "warn"}>
                          {t(`confidence.${f.confidence}` as never)}
                        </Chip>
                      ) : (
                        "-"
                      )}
                    </div>
                    <div role="cell" className="px-3 py-2.5 text-end">
                      <ChevronDown className={cn("size-4 text-ink-400 transition-transform", isOpen && "rotate-180")} aria-hidden />
                    </div>
                  </div>
                  {isOpen && f3 ? (
                    <div role="row" className="grid border-b border-mist-100 bg-mist-50/60">
                      <div role="cell" className="px-4 py-3">
                        <p className="max-w-3xl whitespace-pre-line text-xs leading-relaxed text-ink-600">
                          {bi(locale, f3.explanationEn ?? "", f3.explanationAr ?? "")}
                        </p>
                        <Link
                          href={`/indices/${f.code}` as never}
                          className="link-draw mt-2 inline-block text-xs font-medium text-navy-700"
                        >
                          {t("openMethod")}
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
