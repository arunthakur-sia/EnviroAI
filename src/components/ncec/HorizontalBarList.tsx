"use client";
// A plain CSS bar list (violations by type): no charting library needed for
// a short, single-series ranking (ui-plan.md s3.1 "no new dependencies").
export type BarItem = { key: string; label: string; count: number };

export function HorizontalBarList({ items, barColor = "var(--color-teal-500)" }: { items: BarItem[]; barColor?: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="flex flex-col gap-2.5" data-testid="ncec-bar-list">
      {items.map((it) => (
        <div key={it.key} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-xs text-ink-700 sm:w-52" title={it.label}>
            {it.label}
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-mist-100">
            <div className="h-full rounded-full" style={{ width: `${(it.count / max) * 100}%`, background: barColor }} />
          </div>
          <span className="w-7 shrink-0 text-end text-xs font-semibold tnum text-ink-900">{it.count}</span>
        </div>
      ))}
    </div>
  );
}
