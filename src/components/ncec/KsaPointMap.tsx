"use client";
// The NCEC map: Saudi Arabia and its neighbours from Natural Earth 1:50m
// borders (baked into ksa-geo.ts, no runtime fetch), reference cities, and
// the caller's points on top. "dots" plots one small marker per record;
// "bubbles" sizes each point by its count (per-region totals). Pan and zoom
// with the wheel, drag, or the +/- buttons (d3-zoom, as in OrgChart).
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior } from "d3-zoom";
import { Minus, Plus } from "lucide-react";
import { bi } from "@/lib/utils";
import { KSA_GEO, projectKsa } from "./ksa-geo";

export type MapPoint = { key: string; label: string; count: number; lat: number; lng: number; colorVar?: string };
export type MapLegendItem = { key: string; label: string; colorVar: string };

const CITIES = [
  { en: "Tabuk", ar: "تبوك", lat: 28.383, lng: 36.567 },
  { en: "Medina", ar: "المدينة المنورة", lat: 24.467, lng: 39.6 },
  { en: "Jeddah", ar: "جدة", lat: 21.543, lng: 39.173 },
  { en: "Riyadh", ar: "الرياض", lat: 24.713, lng: 46.675 },
  { en: "Dammam", ar: "الدمام", lat: 26.392, lng: 49.978 },
  { en: "Abha", ar: "أبها", lat: 18.216, lng: 42.505 },
];

export function KsaPointMap({
  points,
  legend,
  legendTitle,
  mode = "dots",
}: {
  points: MapPoint[];
  legend?: MapLegendItem[];
  legendTitle?: string;
  mode?: "dots" | "bubbles";
}) {
  const t = useTranslations("ksaNcec");
  const locale = useLocale();
  const svgRef = React.useRef<SVGSVGElement>(null);
  const zoomRef = React.useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [k, setK] = React.useState(1);
  const [transform, setTransform] = React.useState("");

  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 6])
      .translateExtent([
        [0, 0],
        [KSA_GEO.width, KSA_GEO.height],
      ])
      .on("zoom", (e: D3ZoomEvent<SVGSVGElement, unknown>) => {
        setTransform(e.transform.toString());
        setK(e.transform.k);
      });
    zoomRef.current = z;
    select(svg).call(z).on("dblclick.zoom", null);
    return () => {
      select(svg).on(".zoom", null);
    };
  }, []);

  const zoomBy = (factor: number) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (svg && z) select(svg).call(z.scaleBy, factor);
  };
  const reset = () => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (svg && z) select(svg).call(z.transform, zoomIdentity);
  };

  const maxCount = Math.max(1, ...points.map((p) => p.count));
  const radius = (p: MapPoint) => (mode === "bubbles" ? 6 + 16 * Math.sqrt(p.count / maxCount) : 4.5);
  const ksaLabel = projectKsa(23.4, 44.6);

  return (
    <div className="relative" data-testid="ncec-map">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${KSA_GEO.width} ${KSA_GEO.height}`}
        role="img"
        aria-label={t("common.mapLabel")}
        className="block w-full cursor-grab touch-none rounded-lg active:cursor-grabbing"
        style={{ background: "var(--color-aqua-100)" }}
      >
        <g transform={transform}>
          {KSA_GEO.neighbours.map((d, i) => (
            <path key={i} d={d} fill="var(--color-mist-100)" stroke="var(--color-mist-300)" strokeWidth={0.8 / k} />
          ))}
          <path d={KSA_GEO.ksa} fill="#ffffff" stroke="var(--color-ink-400)" strokeWidth={1.2 / k} />
          <text
            x={ksaLabel.x}
            y={ksaLabel.y}
            textAnchor="middle"
            fontSize={22 / k}
            fontWeight={600}
            fill="var(--color-ink-400)"
            opacity={0.55}
          >
            {bi(locale, "Saudi Arabia", "المملكة العربية السعودية")}
          </text>
          {points.map((p) => {
            const { x, y } = projectKsa(p.lat, p.lng);
            const r = radius(p) / k;
            return (
              <circle
                key={p.key}
                cx={x}
                cy={y}
                r={r}
                fill={p.colorVar ?? "var(--color-teal-500)"}
                fillOpacity={mode === "bubbles" ? 0.6 : 0.9}
                stroke="#ffffff"
                strokeWidth={1 / k}
              >
                <title>{p.label}</title>
              </circle>
            );
          })}
          {CITIES.map((c) => {
            const { x, y } = projectKsa(c.lat, c.lng);
            return (
              <g key={c.en} pointerEvents="none">
                <circle cx={x} cy={y} r={3.2 / k} fill="var(--color-ink-900)" />
                <text
                  x={x}
                  y={y - 6 / k}
                  textAnchor="middle"
                  fontSize={12 / k}
                  fontWeight={600}
                  fill="var(--color-ink-900)"
                  stroke="#ffffff"
                  strokeWidth={3 / k}
                  paintOrder="stroke"
                >
                  {bi(locale, c.en, c.ar)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="absolute start-2 top-2 flex flex-col overflow-hidden rounded-md border border-mist-300 bg-white shadow-sm">
        <button type="button" onClick={() => zoomBy(1.5)} aria-label={t("common.zoomIn")} className="grid size-7 place-items-center hover:bg-mist-50">
          <Plus className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.5)}
          onDoubleClick={reset}
          aria-label={t("common.zoomOut")}
          className="grid size-7 place-items-center border-t border-mist-300 hover:bg-mist-50"
        >
          <Minus className="size-4" aria-hidden />
        </button>
      </div>

      {legend?.length ? (
        <div className="absolute end-2 top-2 max-w-[48%] rounded-md border border-mist-200 bg-white/95 p-2.5 text-xs shadow-sm">
          {legendTitle ? <p className="mb-1.5 font-semibold text-ink-900">{legendTitle}</p> : null}
          <ul className="space-y-1">
            {legend.map((l) => (
              <li key={l.key} className="flex items-center gap-1.5 text-ink-600">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: l.colorVar }} aria-hidden />
                <span className="truncate">{l.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
