"use client";
// CR03 4.4.2: Saudi Arabia in numbers. One headline indicator per day: a 64px
// count-up figure, the AI hook line, a 100px sparkline of the last 24 periods
// with a pulsing end dot, a delta chip against the last period, and an
// Explore link into Statistics. No quiz in here.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { CountUp } from "@/components/motion";

export type HomeNumberData = {
  indicatorId: string;
  nameEn: string;
  nameAr: string;
  unit: string | null;
  decimals: number;
  direction: string;
  latestValue: number;
  latestPeriod: string;
  prevValue: number | null;
  series: { period: string; value: number }[];
  hookEn: string | null;
  hookAr: string | null;
};

function Sparkline({ values }: { values: number[] }) {
  const w = 260;
  const h = 100;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pt = (v: number, i: number): [number, number] => [
    (i / Math.max(1, values.length - 1)) * (w - 10) + 4,
    h - 8 - ((v - min) / span) * (h - 18),
  ];
  const points = values.map((v, i) => pt(v, i).join(",")).join(" ");
  const [ex, ey] = pt(values[values.length - 1], values.length - 1);
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${w} ${h}`}
      style={{ direction: "ltr", maxHeight: 100 }}
      aria-hidden
      className="block"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-navy-500)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* the pulsing end dot (allowed loop, CR03 4.3) */}
      <circle className="dot-pulse" cx={ex} cy={ey} r={4} fill="var(--color-navy-700)" opacity={0.3} />
      <circle cx={ex} cy={ey} r={3.5} fill="var(--color-navy-700)" />
    </svg>
  );
}

export function HomeNumbers({ data }: { data: HomeNumberData }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const delta =
    data.prevValue != null && data.prevValue !== 0
      ? ((data.latestValue - data.prevValue) / Math.abs(data.prevValue)) * 100
      : null;
  const deltaGood =
    delta == null ? null : data.direction === "down_good" ? delta <= 0 : delta >= 0;

  return (
    <div
      className="bento-card digit-tick relative flex h-full flex-col p-6"
      data-testid="home-numbers"
    >
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-600" style={{ fontFamily: "inherit" }}>
        {t("homeNumbers")}
      </p>
      <p className="text-sm font-medium text-ink-900">{bi(locale, data.nameEn, data.nameAr)}</p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="font-semibold leading-none text-navy-900 tnum" style={{ fontSize: 64 }}>
          <CountUp
            value={data.latestValue}
            format={(v) => formatNumber(v, locale, { decimals: data.decimals })}
          />
        </span>
        <span className="text-sm text-ink-600 tnum">
          {data.unit ? `${data.unit} · ` : ""}
          {data.latestPeriod}
        </span>
      </p>
      {delta != null ? (
        <p className="mt-2.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium tnum",
              deltaGood ? "bg-ok-light text-ok" : "bg-warn-light text-warn"
            )}
          >
            {delta >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)}% {t("vsLastPeriod")}
          </span>
        </p>
      ) : null}
      {(data.hookEn || data.hookAr) ? (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-600">
          {bi(locale, data.hookEn ?? "", data.hookAr ?? "")}
        </p>
      ) : null}
      <div className="mt-auto pt-4">
        <Sparkline values={data.series.map((s) => s.value)} />
        <div className="mt-3 flex items-center justify-between gap-2">
          <Link
            href={`/statistics/${data.indicatorId}` as never}
            className="card-action link-draw inline-flex items-center gap-1 text-sm font-medium text-navy-700"
          >
            {t("exploreIndicator")} <ArrowRight className="size-3.5 flip-rtl" />
          </Link>
          <span className="text-[11px] text-ink-600">{t("tomorrowNumber")}</span>
        </div>
      </div>
    </div>
  );
}
