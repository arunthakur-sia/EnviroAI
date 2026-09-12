"use client";
// Knowledge footprint: seven outcome arcs coloured sand -> maroon by depth,
// with the level ring and streak flame in the centre. Private to the user.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Flame } from "lucide-react";
import { bi } from "@/lib/utils";
import { Reveal } from "@/components/motion";
import { Tip } from "@/components/ui/overlays";

type Footprint = {
  outcomes: { code: string; nameEn: string; nameAr: string; depth: number }[];
  points: number;
  levelNameEn: string;
  levelNameAr: string;
  nextLevelNameEn: string | null;
  nextLevelNameAr: string | null;
  nextLevelPoints: number | null;
  dailyStreak: number;
  weeklyStreak: number;
};

function depthColor(depth: number, max: number): string {
  if (depth <= 0) return "var(--color-sand-200)";
  const ratio = Math.min(1, depth / Math.max(1, max));
  if (ratio < 0.34) return "var(--color-maroon-300)";
  if (ratio < 0.67) return "var(--color-maroon-500)";
  return "var(--color-maroon-700)";
}

export function FootprintCard({ footprint }: { footprint: Footprint }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const n = footprint.outcomes.length || 7;
  const maxDepth = Math.max(1, ...footprint.outcomes.map((o) => o.depth));
  const size = 210;
  const c = size / 2;
  const rOuter = 92;
  const rInner = 58;
  const gap = 4; // degrees between arcs

  const arcs = footprint.outcomes.map((o, i) => {
    const start = (360 / n) * i + gap / 2 - 90;
    const end = (360 / n) * (i + 1) - gap / 2 - 90;
    const large = end - start > 180 ? 1 : 0;
    const rad = (d: number) => (d * Math.PI) / 180;
    const x1 = c + rOuter * Math.cos(rad(start));
    const y1 = c + rOuter * Math.sin(rad(start));
    const x2 = c + rOuter * Math.cos(rad(end));
    const y2 = c + rOuter * Math.sin(rad(end));
    const x3 = c + rInner * Math.cos(rad(end));
    const y3 = c + rInner * Math.sin(rad(end));
    const x4 = c + rInner * Math.cos(rad(start));
    const y4 = c + rInner * Math.sin(rad(start));
    return {
      d: `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4} Z`,
      color: depthColor(o.depth, maxDepth),
      outcome: o,
    };
  });

  return (
    <Reveal delay={0.1}>
      <div className="card flex h-full flex-col items-center p-5" data-testid="footprint">
        <p className="mb-1 self-start text-xs font-semibold uppercase tracking-wider text-ink-400">
          {t("footprint")}
        </p>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={t("footprint")}
          style={{ direction: "ltr" }}
        >
          {arcs.map((arc, i) => (
            <Tip
              key={arc.outcome.code}
              content={`${bi(locale, arc.outcome.nameEn, arc.outcome.nameAr)}: ${arc.outcome.depth}`}
            >
              <path
                d={arc.d}
                fill={arc.color}
                opacity={0.92}
                style={{
                  transformOrigin: `${c}px ${c}px`,
                  animation: `footprint-in 700ms ${i * 60}ms var(--ease-paper) backwards`,
                }}
              />
            </Tip>
          ))}
          <style>{`@keyframes footprint-in { from { opacity: 0; transform: scale(0.85); } }`}</style>
        </svg>
        <div className="-mt-[138px] mb-[52px] flex flex-col items-center">
          <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-maroon-900 tnum">
            {footprint.points.toLocaleString()}
          </p>
          <p className="text-[11px] text-ink-600">
            {bi(locale, footprint.levelNameEn, footprint.levelNameAr)}
          </p>
          {footprint.dailyStreak > 1 ? (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-warn tnum">
              <Flame className="size-3" /> {footprint.dailyStreak}
            </p>
          ) : null}
        </div>
        {footprint.nextLevelPoints ? (
          <p className="mt-auto text-center text-[11px] text-ink-400">
            {t("nextUnlock", {
              points: (footprint.nextLevelPoints - footprint.points).toLocaleString(),
              level: bi(locale, footprint.nextLevelNameEn ?? "", footprint.nextLevelNameAr ?? ""),
            })}
          </p>
        ) : null}
      </div>
    </Reveal>
  );
}
