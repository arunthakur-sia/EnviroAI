"use client";
// Latest value with a big tabular number, delta arrow, sparkline, period, source.
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { formatNumber, formatPeriod } from "@/lib/format";
import { Sparkline } from "./IndicatorChart";
import { Chip } from "@/components/ui/primitives";
import { CountUp } from "@/components/motion";

export type TileData = {
  id: string;
  nameEn: string;
  nameAr: string;
  unit: string | null;
  decimals: number;
  direction: string;
  latestValue: number | null;
  latestPeriod: string | null;
  previousValue: number | null;
  spark: number[];
  illustrative?: boolean;
};

export function IndicatorTile({ tile, animate }: { tile: TileData; animate?: boolean }) {
  const locale = useLocale();
  const t = useTranslations("statistics");
  const tc = useTranslations("common");
  const delta =
    tile.latestValue !== null && tile.previousValue !== null
      ? tile.latestValue - tile.previousValue
      : null;
  const good = delta === null ? null : tile.direction === "down_good" ? delta < 0 : delta > 0;

  return (
    <Link href={`/statistics/${tile.id}` as never} className="card card-hover flex flex-col gap-1.5 p-4">
      <p className="line-clamp-1 text-xs font-medium text-ink-600">
        {bi(locale, tile.nameEn, tile.nameAr)}
      </p>
      <div className="flex items-end justify-between gap-2">
        <p className="min-w-0 font-[family-name:var(--font-display)] text-[26px] font-semibold leading-none text-ink-900 tnum">
          {tile.latestValue !== null ? (
            animate ? (
              <CountUp
                value={tile.latestValue}
                format={(v) => formatNumber(v, locale, { decimals: tile.decimals })}
              />
            ) : (
              formatNumber(tile.latestValue, locale, { decimals: tile.decimals })
            )
          ) : (
            "-"
          )}
          {tile.unit ? <span className="ms-1 text-sm font-normal text-ink-600">{tile.unit}</span> : null}
        </p>
        <Sparkline data={tile.spark} />
      </div>
      <div className="flex items-center gap-2 text-[11px] text-ink-400">
        {delta !== null && delta !== 0 ? (
          <span
            className={cn(
              "flex items-center gap-0.5 font-medium tnum",
              good ? "text-ok" : "text-danger"
            )}
          >
            {delta > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {formatNumber(Math.abs(delta), locale, { decimals: tile.decimals })}
          </span>
        ) : delta === 0 ? (
          <span className="flex items-center gap-0.5">
            <Minus className="size-3" /> {t("unchanged")}
          </span>
        ) : null}
        {tile.latestPeriod ? <span className="tnum">{formatPeriod(tile.latestPeriod, locale)}</span> : null}
        {tile.illustrative ? <Chip tone="warn">{tc("illustrative")}</Chip> : null}
      </div>
    </Link>
  );
}
