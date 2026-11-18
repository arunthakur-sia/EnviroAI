"use client";
// A plain KPI tile for the NCEC dashboards: label, big number, optional
// suffix and tone. Simpler than IndicatorTile (no time series, no link —
// NCEC KPIs are snapshot counts over the loaded dummy records).
import * as React from "react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { CountUp } from "@/components/motion";

export function NcecKpiTile({
  label,
  value,
  suffix,
  icon,
  tone = "navy",
  note,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon?: React.ReactNode;
  tone?: "navy" | "danger" | "ok" | "amber";
  note?: string;
}) {
  const locale = useLocale();
  const toneClass = { navy: "text-navy-900", danger: "text-danger", ok: "text-ok", amber: "text-amber-700" }[tone];
  return (
    <div className="card flex flex-col gap-1.5 p-4" data-testid="ncec-kpi">
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink-600">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          "font-[family-name:var(--font-display)] text-[26px] font-semibold leading-none tnum",
          toneClass
        )}
      >
        <CountUp value={value} format={(v) => formatNumber(v, locale, { decimals: 0 })} />
        {suffix ? <span className="ms-1 text-sm font-normal text-ink-600">{suffix}</span> : null}
      </p>
      {note ? <p className="text-[11px] text-ink-400">{note}</p> : null}
    </div>
  );
}
