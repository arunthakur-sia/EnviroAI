"use client";
// The NCEC KPI tile, as in the mockups: a tinted icon square on the leading
// side, the label above a large number. The tone colours the icon square;
// "amber" also tints the whole tile (an attention figure, e.g. permits about
// to expire). Snapshot counts only, no time series.
import * as React from "react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { CountUp } from "@/components/motion";
import { Lock, TrendingDown, TrendingUp } from "lucide-react";

export type NcecKpiTone = "teal" | "ok" | "amber" | "amberIcon" | "danger" | "navy" | "plain";

const TONES: Record<NcecKpiTone, { icon: string; tile: string; label: string; value: string }> = {
  teal: { icon: "bg-teal-100 text-teal-700", tile: "", label: "text-ink-900", value: "text-navy-900" },
  ok: { icon: "bg-teal-100 text-ok", tile: "", label: "text-ink-900", value: "text-navy-900" },
  navy: { icon: "bg-navy-50 text-navy-700", tile: "", label: "text-ink-900", value: "text-navy-900" },
  amberIcon: { icon: "bg-amber-100 text-amber-700", tile: "", label: "text-ink-900", value: "text-navy-900" },
  /** the icon slot holds its own graphic (e.g. a progress ring), no tinted square */
  plain: { icon: "", tile: "", label: "text-ink-900", value: "text-navy-900" },
  danger: { icon: "bg-mist-100 text-danger", tile: "", label: "text-ink-900", value: "text-danger" },
  amber: {
    icon: "bg-amber-100 text-amber-700 ring-1 ring-amber-300",
    tile: "border-amber-300 bg-amber-100/60",
    label: "text-amber-700",
    value: "text-amber-700",
  },
};

export function NcecKpiTile({
  label,
  value,
  suffix,
  icon,
  tone = "teal",
  note,
  display,
  trendPct,
  trendLabel,
  lockedLabel,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon?: React.ReactNode;
  tone?: NcecKpiTone;
  note?: string;
  /** shown instead of the counted number, e.g. a percentage */
  display?: string;
  /** change against the previous period, shown as a badge */
  trendPct?: number | null;
  trendLabel?: string;
  /** when set, the figure is above the caller's layer: no number is rendered */
  lockedLabel?: string;
}) {
  const locale = useLocale();
  const s = TONES[tone];
  return (
    <div className={cn("card flex items-center gap-3.5 p-4", s.tile)} data-testid="ncec-kpi">
      {icon ? (
        <span className={cn("grid size-12 shrink-0 place-items-center rounded-xl", tone !== "plain" && "[&>svg]:size-6", s.icon)} aria-hidden>
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", s.label)}>{label}</p>
        {lockedLabel ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-ink-400" data-locked="1">
            <Lock className="size-4" aria-hidden /> {lockedLabel}
          </p>
        ) : (
          <p className={cn("mt-1 font-[family-name:var(--font-display)] text-[28px] font-semibold leading-none tnum", s.value)}>
            {display ?? <CountUp value={value} format={(v) => formatNumber(v, locale, { decimals: 0 })} />}
            {suffix ? <span className="ms-1 text-sm font-normal text-ink-600">{suffix}</span> : null}
          </p>
        )}
        {note ? <p className="mt-1 text-[11px] text-ink-400">{note}</p> : null}
      </div>
      {!lockedLabel && trendPct != null ? (
        <span
          className={cn(
            "flex shrink-0 flex-col items-center rounded-md px-2 py-1 text-xs font-semibold tnum",
            trendPct >= 0 ? "bg-teal-100 text-ok" : "bg-mist-100 text-danger"
          )}
        >
          <span className="flex items-center gap-0.5">
            {trendPct >= 0 ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
            <bdi dir="ltr">
              {trendPct >= 0 ? "+" : ""}
              {formatNumber(trendPct, locale, { decimals: 1 })}%
            </bdi>
          </span>
          {trendLabel ? <span className="text-[10px] font-normal text-ink-600">{trendLabel}</span> : null}
        </span>
      ) : null}
    </div>
  );
}
