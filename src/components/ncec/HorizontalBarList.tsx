"use client";
// A ranked horizontal bar chart (violations by type), as in the mockup:
// category labels on the leading side, bars on a numeric axis with
// gridlines and tick labels, the value at each bar's end, the top category
// highlighted, and an axis title. Plain markup, no charting library.
import { useLocale } from "next-intl";
import { formatNumber } from "@/lib/format";

export type BarItem = { key: string; label: string; count: number };

function niceStep(max: number): number {
  const raw = Math.max(1, max) / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

export function HorizontalBarList({
  items,
  barColor = "var(--color-navy-700)",
  highlightColor = "var(--color-amber-500)",
  axisLabel,
}: {
  items: BarItem[];
  barColor?: string;
  highlightColor?: string;
  axisLabel?: string;
}) {
  const locale = useLocale();
  const sorted = [...items].sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...sorted.map((i) => i.count));
  const step = niceStep(max);
  const axisMax = Math.ceil((max * 1.08) / step) * step;
  const ticks = Array.from({ length: Math.round(axisMax / step) + 1 }, (_, i) => i * step);
  const pct = (v: number) => (v / axisMax) * 100;

  return (
    <div data-testid="ncec-bar-list">
      <div className="grid grid-cols-[minmax(8rem,38%)_1fr] gap-x-3">
        <div className="flex flex-col">
          {sorted.map((it) => (
            <span key={it.key} className="flex h-9 items-center justify-end text-end text-xs leading-tight text-ink-900 sm:text-sm" title={it.label}>
              <span className="line-clamp-2">{it.label}</span>
            </span>
          ))}
        </div>
        <div className="relative border-s border-mist-300">
          {ticks.map((tk) => (
            <span key={tk} className="absolute inset-y-0 w-px bg-mist-100" style={{ insetInlineStart: `${pct(tk)}%` }} aria-hidden />
          ))}
          {sorted.map((it, i) => (
            <div key={it.key} className="relative flex h-9 items-center">
              <div
                className="h-5 rounded-e-sm"
                style={{ width: `${pct(it.count)}%`, background: i === 0 ? highlightColor : barColor }}
                title={`${it.label}: ${it.count}`}
              />
              <span className="ms-2 text-xs font-semibold text-ink-900 tnum">{formatNumber(it.count, locale, { decimals: 0 })}</span>
            </div>
          ))}
        </div>
        <span aria-hidden />
        <div className="relative h-5 text-[11px] text-ink-600">
          {ticks.map((tk) => (
            <span key={tk} className="absolute top-1 -translate-x-1/2 tnum rtl:translate-x-1/2" style={{ insetInlineStart: `${pct(tk)}%` }}>
              {formatNumber(tk, locale, { decimals: 0 })}
            </span>
          ))}
        </div>
        {axisLabel ? (
          <>
            <span aria-hidden />
            <p className="mt-1 text-center text-xs text-ink-600">{axisLabel}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
