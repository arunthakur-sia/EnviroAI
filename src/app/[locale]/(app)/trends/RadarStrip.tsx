"use client";
// Radar by outcome: seven columns, 30-day accepted volume with a daily sparkline
// and the top three signals. Sparkline drawn like the IndicatorTile's.
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { bi, cn } from "@/lib/utils";

export type RadarOutcome = {
  code: string;
  nameEn: string;
  nameAr: string;
  count: number;
  daily: number[];
  top: { id: string; titleEn: string; titleAr: string }[];
};

function Sparkline({ values }: { values: number[] }) {
  const w = 120;
  const h = 28;
  const max = Math.max(1, ...values);
  const points = values
    .map(
      (v, i) =>
        `${(i / Math.max(1, values.length - 1)) * w},${h - 3 - (v / max) * (h - 6)}`
    )
    .join(" ");
  return (
    <svg width={w} height={h} className="block" aria-hidden style={{ direction: "ltr" }}>
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-gulf-600)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RadarStrip({ radar }: { radar: RadarOutcome[] }) {
  const locale = useLocale();
  const t = useTranslations("trends");
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      {radar.map((o) => (
        <div key={o.code} className="card flex flex-col gap-2 p-3.5">
          <p className="line-clamp-2 min-h-9 text-xs font-medium leading-snug text-ink-900">
            {bi(locale, o.nameEn, o.nameAr)}
          </p>
          <div className="flex items-end justify-between gap-2">
            <span
              className={cn(
                "text-2xl font-semibold tnum",
                o.count > 0 ? "text-maroon-900" : "text-ink-200"
              )}
            >
              {o.count}
            </span>
            <Sparkline values={o.daily} />
          </div>
          <p className="text-[10px] uppercase tracking-wider text-ink-400">{t("last30Days")}</p>
          {o.top.length ? (
            <div className="flex flex-col gap-1 border-t border-sand-100 pt-2">
              {o.top.map((s) => (
                <Link
                  key={s.id}
                  href={`/trends/${s.id}` as never}
                  className="line-clamp-1 text-[11px] text-ink-600 hover:text-maroon-900"
                >
                  {bi(locale, s.titleEn, s.titleAr)}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
