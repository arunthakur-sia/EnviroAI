"use client";
// A deliberately simple schematic point plot, not a traced coastline or a
// downloaded map (ui-plan.md decision #3): bubbles are positioned by a plain
// linear projection of the record's own lat/long onto Saudi Arabia's
// bounding box (16-32N, 34-56E), inside a bordered reference panel. The
// panel always names itself a schematic so nobody mistakes it for a
// surveyed map.
import { useTranslations } from "next-intl";

export type MapPoint = { key: string; label: string; count: number; lat: number; lng: number; colorVar?: string };
export type MapLegendItem = { key: string; label: string; colorVar: string };

const LAT_MIN = 16;
const LAT_MAX = 32;
const LNG_MIN = 34;
const LNG_MAX = 56;
const W = 520;
const H = 280;
const PAD = 22;

function project(lat: number, lng: number) {
  const x = PAD + ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * (W - PAD * 2);
  const y = PAD + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (H - PAD * 2);
  return { x: Math.min(W - PAD, Math.max(PAD, x)), y: Math.min(H - PAD, Math.max(PAD, y)) };
}

export function KsaPointMap({ points, legend }: { points: MapPoint[]; legend?: MapLegendItem[] }) {
  const t = useTranslations("ksaNcec");
  const maxCount = Math.max(1, ...points.map((p) => p.count));
  return (
    <div data-testid="ncec-map">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t("common.schematicNote")}
        className="w-full rounded-lg border border-mist-300 bg-mist-50"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={`v${i}`}
            x1={PAD + (i * (W - PAD * 2)) / 4}
            y1={PAD}
            x2={PAD + (i * (W - PAD * 2)) / 4}
            y2={H - PAD}
            stroke="var(--color-mist-200)"
          />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <line
            key={`h${i}`}
            x1={PAD}
            y1={PAD + (i * (H - PAD * 2)) / 3}
            x2={W - PAD}
            y2={PAD + (i * (H - PAD * 2)) / 3}
            stroke="var(--color-mist-200)"
          />
        ))}
        <rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} fill="none" stroke="var(--color-mist-300)" rx={6} />
        {points.map((p) => {
          const { x, y } = project(p.lat, p.lng);
          const r = 5 + 13 * Math.sqrt(p.count / maxCount);
          return (
            <g key={p.key}>
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={p.colorVar ?? "var(--color-teal-500)"}
                fillOpacity={0.55}
                stroke={p.colorVar ?? "var(--color-teal-600)"}
                strokeWidth={1.5}
              />
              <text x={x} y={y - r - 4} textAnchor="middle" fontSize={10} fill="var(--color-ink-600)">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1.5 text-[11px] text-ink-400">{t("common.schematicNote")}</p>
      {legend?.length ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
          {legend.map((l) => (
            <span key={l.key} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: l.colorVar }} aria-hidden />
              {l.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
