"use client";
// CR08 10.2 section 6: the chord overview of internal interfaces. A directed
// chord layout (d3-chord) over the unit-to-unit counts: unit arcs in org
// order, arrow ribbons from the giving unit to the receiving unit sized by
// count. Hovering a unit lights its flows and dims the rest; clicking selects
// the unit for the matrix and the list. The drawing is pure SVG computed on
// render (it also server-renders), kept LTR in Arabic, and every transition
// honours reduced motion.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useReducedMotion } from "framer-motion";
import { chordDirected, ribbonArrow, type Chord, type ChordGroup } from "d3-chord";
import { arc as d3arc } from "d3-shape";
import { bi, cn } from "@/lib/utils";
import type { UnitRef } from "@/server/services/operating-model";
import { UNIT_PALETTE, useFmt } from "./shared";

const SIZE = 420;
const C = SIZE / 2;
const OUTER = 176;
const INNER = 162;

/* Node and the browser can differ in the last bit of Math.sin and Math.cos,
   so every generated coordinate is rounded before it reaches the markup,
   otherwise React reports a hydration mismatch on the arcs. */
function roundPath(d: string): string {
  return d.replace(/-?\d+\.\d+(e-?\d+)?/g, (m) => String(Math.round(Number(m) * 100) / 100));
}

export function ChordDiagram({
  units,
  chord,
  selected,
  hovered,
  onHover,
  onSelect,
  className,
}: {
  units: UnitRef[];
  chord: { fromUnitId: string; toUnitId: string; count: number }[];
  selected: string | null;
  hovered: string | null;
  onHover: (unitId: string | null) => void;
  onSelect: (unitId: string | null) => void;
  className?: string;
}) {
  const t = useTranslations("operatingModel");
  const locale = useLocale();
  const fmt = useFmt();
  const reduced = useReducedMotion();

  const layout = React.useMemo(() => {
    const n = units.length;
    const index = new Map(units.map((u, i) => [u.id, i]));
    const matrix = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    for (const c of chord) {
      const i = index.get(c.fromUnitId);
      const j = index.get(c.toUnitId);
      if (i == null || j == null) continue;
      matrix[i][j] += c.count;
    }
    const chords = chordDirected()
      .padAngle(14 / INNER)
      .sortSubgroups((a, b) => b - a)(matrix);
    const groupArc = d3arc<ChordGroup>().innerRadius(INNER).outerRadius(OUTER).cornerRadius(3);
    const ribbon = ribbonArrow<Chord, Chord["source"]>().radius(INNER - 3).padAngle(1 / INNER).headRadius(9);
    const gives = units.map((_, i) => matrix[i].reduce((s, v) => s + v, 0));
    const receives = units.map((_, j) => matrix.reduce((s, row) => s + row[j], 0));
    return { chords, groups: chords.groups, groupArc, ribbon, gives, receives };
  }, [units, chord]);

  const focus = hovered ?? selected;
  const focusIndex = focus ? units.findIndex((u) => u.id === focus) : -1;
  const colour = (i: number) => UNIT_PALETTE[i % UNIT_PALETTE.length];
  const transition = reduced ? undefined : "opacity 200ms var(--ease-paper), stroke-width 200ms var(--ease-paper)";

  return (
    <div className={cn("relative", className)} style={{ direction: "ltr" }}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-auto w-full"
        role="group"
        aria-label={t("interfaces.internal.chordAria")}
        data-testid="chord-diagram"
        onMouseLeave={() => onHover(null)}
      >
        <g transform={`translate(${C} ${C})`}>
          {/* ribbons first so the arcs sit above them */}
          {layout.chords.map((ch) => {
            const s = ch.source.index;
            const tgt = ch.target.index;
            const lit = focusIndex < 0 || s === focusIndex || tgt === focusIndex;
            const from = units[s];
            const to = units[tgt];
            return (
              <path
                key={`${s}-${tgt}`}
                d={roundPath(layout.ribbon(ch) ?? "")}
                fill={colour(s)}
                fillOpacity={focusIndex < 0 ? 0.55 : lit ? 0.85 : 0.06}
                stroke={colour(s)}
                strokeOpacity={lit ? 0.6 : 0.05}
                strokeWidth={0.6}
                style={{ transition }}
                data-testid="chord-ribbon"
                data-from={from?.code}
                data-to={to?.code}
              >
                <title>
                  {t("interfaces.internal.cellAria", {
                    from: from ? bi(locale, from.nameEn, from.nameAr) : "",
                    to: to ? bi(locale, to.nameEn, to.nameAr) : "",
                    count: ch.source.value,
                  })}
                </title>
              </path>
            );
          })}
          {layout.groups.map((g) => {
            const u = units[g.index];
            if (!u) return null;
            const angle = (g.startAngle + g.endAngle) / 2;
            const flip = angle > Math.PI;
            const isFocus = focusIndex === g.index;
            const dim = focusIndex >= 0 && !isFocus;
            const name = bi(locale, u.nameEn, u.nameAr);
            const label = t("interfaces.internal.unitAria", {
              unit: name,
              gives: fmt.n(layout.gives[g.index], 0),
              receives: fmt.n(layout.receives[g.index], 0),
            });
            return (
              <g
                key={u.id}
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-pressed={selected === u.id}
                className="cursor-pointer outline-none"
                onMouseEnter={() => onHover(u.id)}
                onFocus={() => onHover(u.id)}
                onBlur={() => onHover(null)}
                onClick={() => onSelect(selected === u.id ? null : u.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(selected === u.id ? null : u.id);
                  }
                }}
                data-testid="chord-unit"
                data-code={u.code}
                data-selected={selected === u.id || undefined}
              >
                <path
                  d={roundPath(layout.groupArc(g) ?? "")}
                  fill={colour(g.index)}
                  fillOpacity={dim ? 0.25 : 1}
                  stroke={isFocus ? "var(--color-aqua-500)" : "#ffffff"}
                  strokeWidth={isFocus ? 2.5 : 1}
                  style={{ transition }}
                />
                <text
                  transform={`rotate(${Math.round(((angle * 180) / Math.PI - 90) * 100) / 100}) translate(${OUTER + 8}) ${flip ? "rotate(180)" : ""}`}
                  textAnchor={flip ? "end" : "start"}
                  dy="0.35em"
                  fontSize={11}
                  fontWeight={isFocus ? 700 : 600}
                  fill={dim ? "var(--color-ink-400)" : "var(--color-ink-900)"}
                  className="select-none tnum"
                  style={{ transition }}
                >
                  {u.code}
                </text>
                <title>{label}</title>
              </g>
            );
          })}
        </g>
      </svg>
      {/* The caption is positioned inside the LTR-locked wrapper, so it keeps
          the wrapper's direction and carries the reader's direction on the
          text inside it: a dir="rtl" on the positioned box itself would flip
          start-1/2 to the right edge and push the caption off centre. */}
      {focusIndex >= 0 && units[focusIndex] ? (
        <div
          className="pointer-events-none absolute start-1/2 top-1/2 w-44 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-mist-200 bg-white/90 px-2.5 py-2 text-center shadow-[var(--shadow-paper)]"
          data-testid="chord-focus"
        >
          <div dir={locale === "ar" ? "rtl" : "ltr"}>
            <p className="text-[11px] font-semibold text-ink-400 tnum">{units[focusIndex].code}</p>
            <p className="line-clamp-2 text-xs font-medium leading-snug text-ink-900">{bi(locale, units[focusIndex].nameEn, units[focusIndex].nameAr)}</p>
            <p className="mt-1 text-[11px] text-ink-600 tnum">
              {t("interfaces.internal.gives", { count: layout.gives[focusIndex] })}
              <br />
              {t("interfaces.internal.receives", { count: layout.receives[focusIndex] })}
            </p>
          </div>
        </div>
      ) : (
        <div className="pointer-events-none absolute start-1/2 top-1/2 w-40 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white/85 px-2.5 py-2 text-center">
          <p className="text-[11px] leading-snug text-ink-600" dir={locale === "ar" ? "rtl" : "ltr"}>
            {t("interfaces.internal.chordHint")}
          </p>
        </div>
      )}
    </div>
  );
}
