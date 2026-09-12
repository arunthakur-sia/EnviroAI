"use client";
// CR02 2.2: the map toggle. A zoomable radial partition: outcomes on the
// inner ring, targets on the middle ring, initiatives and projects on the
// outer ring. Hand-rolled angles (proportional to item counts) instead of a
// d3-hierarchy dependency. Draw-in once on first load, then static; clicking
// a node sets the panes to that path.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { ZoomIn, ZoomOut } from "lucide-react";
import { bi } from "@/lib/utils";
import type { NavigatorData } from "@/server/services/strategy";

const STATUS_FILL: Record<string, string> = {
  on_track: "var(--color-ok)",
  completed: "var(--color-gulf-600)",
  at_risk: "var(--color-warn)",
  delayed: "var(--color-danger)",
  not_started: "var(--color-ink-200)",
};

type Slice = {
  id: string;
  kind: "outcome" | "target" | "item";
  a0: number;
  a1: number;
  r0: number;
  r1: number;
  status: string;
  label: string;
  outcomeId: string;
  targetId: string | null;
};

function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const pad = 0.006;
  a0 += pad;
  a1 -= pad;
  if (a1 <= a0) a1 = a0 + 0.001;
  const p = (r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(r1, a0);
  const [x1, y1] = p(r1, a1);
  const [x2, y2] = p(r0, a1);
  const [x3, y3] = p(r0, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0} ${y0} A ${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
}

export function StrategyMap({
  data,
  selection,
  onSelect,
  onOpen,
}: {
  data: NavigatorData;
  selection: { outcomeId: string | null; targetId: string | null };
  onSelect: (next: { outcomeId: string | null; targetId: string | null }) => void;
  onOpen: (id: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("strategy");
  const [zoom, setZoom] = React.useState(1);
  const size = 640;
  const cx = size / 2;
  const cy = size / 2;

  const slices = React.useMemo(() => {
    const out: Slice[] = [];
    const weightOf = (outcomeId: string) =>
      Math.max(1, data.items.filter((i) => i.outcomeId === outcomeId).length);
    const totalWeight = data.outcomes.reduce((s, o) => s + weightOf(o.id), 0);
    let angle = -Math.PI / 2;
    for (const o of data.outcomes) {
      const span = (weightOf(o.id) / totalWeight) * Math.PI * 2;
      const a0 = angle;
      const a1 = angle + span;
      angle = a1;
      out.push({
        id: o.id,
        kind: "outcome",
        a0,
        a1,
        r0: 70,
        r1: 130,
        status: o.status,
        label: `${o.code ?? ""} ${bi(locale, o.titleEn, o.titleAr)}`.trim(),
        outcomeId: o.id,
        targetId: null,
      });
      // middle ring: targets plus one outcome-level slot if direct items exist
      const targets = data.targets.filter((tg) => tg.outcomeId === o.id);
      const directItems = data.items.filter(
        (i) => i.outcomeId === o.id && i.targetId === null
      );
      const groups: { id: string | null; weight: number; status: string; label: string }[] =
        targets.map((tg) => ({
          id: tg.id,
          weight: Math.max(1, data.items.filter((i) => i.targetId === tg.id).length),
          status: tg.status,
          label: `${tg.code ?? ""} ${bi(locale, tg.titleEn, tg.titleAr)}`.trim(),
        }));
      if (directItems.length) {
        groups.push({
          id: null,
          weight: directItems.length,
          status: o.status,
          label: t("nav.outcomeLevel"),
        });
      }
      const gTotal = groups.reduce((s, g) => s + g.weight, 0) || 1;
      let ga = a0;
      for (const g of groups) {
        const gSpan = (g.weight / gTotal) * span;
        const g0 = ga;
        const g1 = ga + gSpan;
        ga = g1;
        if (g.id) {
          out.push({
            id: g.id,
            kind: "target",
            a0: g0,
            a1: g1,
            r0: 134,
            r1: 194,
            status: g.status,
            label: g.label,
            outcomeId: o.id,
            targetId: g.id,
          });
        }
        // outer ring: the group's items
        const items = g.id
          ? data.items.filter((i) => i.targetId === g.id)
          : directItems;
        if (!items.length) continue;
        const iSpan = gSpan / items.length;
        items.forEach((i, idx) => {
          out.push({
            id: i.id,
            kind: "item",
            a0: g0 + idx * iSpan,
            a1: g0 + (idx + 1) * iSpan,
            r0: g.id ? 198 : 134,
            r1: 258,
            status: i.status,
            label: `${i.code ?? ""} ${bi(locale, i.titleEn, i.titleAr)}`.trim(),
            outcomeId: o.id,
            targetId: g.id,
          });
        });
      }
    }
    return out;
  }, [data, locale, t]);

  const dimmed = (s: Slice) => {
    if (!selection.outcomeId) return false;
    if (s.outcomeId !== selection.outcomeId) return true;
    if (selection.targetId && s.kind !== "outcome" && s.targetId !== selection.targetId) return true;
    return false;
  };

  const view = size / zoom;
  const offset = (size - view) / 2;

  return (
    <div className="card relative overflow-hidden p-4" data-testid="strategy-map">
      <div className="absolute end-4 top-4 z-10 flex gap-1">
        <button
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.5))}
          className="rounded-lg border border-sand-300 bg-white p-1.5 text-ink-600 hover:text-maroon-700 cursor-pointer"
          aria-label={t("nav.map") + " +"}
        >
          <ZoomIn className="size-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
          className="rounded-lg border border-sand-300 bg-white p-1.5 text-ink-600 hover:text-maroon-700 cursor-pointer"
          aria-label={t("nav.map") + " -"}
        >
          <ZoomOut className="size-4" />
        </button>
      </div>
      <svg
        viewBox={`${offset} ${offset} ${view} ${view}`}
        className="sunburst-in mx-auto block max-h-[70vh] w-full max-w-3xl"
        role="img"
        aria-label={t("nav.map")}
        style={{ direction: "ltr" }}
      >
        {/* centre: the edition */}
        <circle cx={cx} cy={cy} r={64} fill="var(--color-maroon-700)" />
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fill="#fff"
          fontSize="18"
          fontWeight="600"
        >
          {data.edition.code.toUpperCase()}
        </text>
        {slices.map((s) => (
          <path
            key={`${s.kind}-${s.id}`}
            d={arcPath(cx, cy, s.r0, s.r1, s.a0, s.a1)}
            fill={STATUS_FILL[s.status] ?? "var(--color-ink-200)"}
            opacity={dimmed(s) ? 0.18 : s.kind === "outcome" ? 0.9 : s.kind === "target" ? 0.75 : 0.6}
            stroke="#fff"
            strokeWidth={1}
            className="cursor-pointer transition-opacity"
            role="button"
            aria-label={s.label}
            tabIndex={0}
            onClick={() => {
              if (s.kind === "item") onOpen(s.id);
              else onSelect({ outcomeId: s.outcomeId, targetId: s.targetId });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (s.kind === "item") onOpen(s.id);
                else onSelect({ outcomeId: s.outcomeId, targetId: s.targetId });
              }
            }}
          >
            <title>{s.label}</title>
          </path>
        ))}
        {/* outcome code labels */}
        {slices
          .filter((s) => s.kind === "outcome")
          .map((s) => {
            const mid = (s.a0 + s.a1) / 2;
            const r = (s.r0 + s.r1) / 2;
            return (
              <text
                key={`label-${s.id}`}
                x={cx + r * Math.cos(mid)}
                y={cy + r * Math.sin(mid) + 4}
                textAnchor="middle"
                fontSize="13"
                fontWeight="600"
                fill="#fff"
                pointerEvents="none"
              >
                {data.outcomes.find((o) => o.id === s.id)?.code ?? ""}
              </text>
            );
          })}
      </svg>
    </div>
  );
}
