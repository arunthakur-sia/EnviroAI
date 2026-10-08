"use client";
// CR08 4.2: small pieces shared by the board, the group sections and the
// index page: direction icons, the rank sparkline, number formatting, the
// SDG goal chip and the national target line.
import * as React from "react";
import { useTranslations } from "next-intl";
import { ArrowDownRight, ArrowUpRight, Minus, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { sdgGoal, sdgTextOn } from "@/lib/sdg-colours";
import type { getIndicesBoard } from "@/server/services/indices";

export type BoardData = Awaited<ReturnType<typeof getIndicesBoard>>;
export type Card = BoardData["cards"][number];
export type Group = BoardData["groups"][number];

export function fmtValue(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return "-";
  return Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(d);
}

export function DirectionIcon({ d, className }: { d: string | null; className?: string }) {
  if (d === "up") return <ArrowUpRight className={cn("size-3.5 text-ok", className)} aria-hidden />;
  if (d === "down")
    return <ArrowDownRight className={cn("size-3.5 text-danger", className)} aria-hidden />;
  return <Minus className={cn("size-3.5 text-ink-400", className)} aria-hidden />;
}

/** 10-year rank sparkline, inverted so up means better. */
export function RankSparkline({
  points,
  highlight,
}: {
  points: { year: number; rank: number }[];
  highlight: boolean;
}) {
  if (points.length < 2) return <span className="block h-11" aria-hidden />;
  const w = 148;
  const h = 44;
  const ranks = points.map((p) => p.rank);
  const min = Math.min(...ranks);
  const max = Math.max(...ranks);
  const span = max - min || 1;
  const xy = points.map((p, i) => ({
    x: (i / (points.length - 1)) * (w - 8) + 4,
    y: 5 + ((p.rank - min) / span) * (h - 12), // small rank = top
  }));
  const path = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = xy[xy.length - 1];
  return (
    <svg width={w} height={h} className="block" aria-hidden style={{ direction: "ltr" }}>
      <path d={path} fill="none" stroke="var(--color-navy-500)" strokeWidth={1.75} strokeLinejoin="round" />
      <circle
        cx={last.x}
        cy={last.y}
        r={highlight ? 4 : 2.5}
        fill="var(--color-navy-700)"
        stroke="#fff"
        strokeWidth={highlight ? 1.5 : 0}
      />
    </svg>
  );
}

/** The goal number on its official colour; the only raw colour in the module. */
export function SdgChip({ goal, withTitle = false, locale }: { goal: number; withTitle?: boolean; locale?: string }) {
  const g = sdgGoal(goal);
  if (!g) return null;
  const title = locale === "ar" ? g.shortAr : g.shortEn;
  return (
    <span
      className="inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold tnum"
      style={{ background: g.colour, color: sdgTextOn(g.n) }}
      title={title}
      data-testid="sdg-chip"
    >
      SDG {g.n}
      {withTitle ? <span className="font-medium">{title}</span> : null}
    </span>
  );
}

/** "Target 75 by 2030, 19.7 to go" for national indicators. */
export function TargetLine({
  target,
  unit,
  className,
}: {
  target: NonNullable<Card["target"]>;
  unit?: string | null;
  className?: string;
}) {
  const t = useTranslations("indices");
  // the unit belongs to the value, not to the sentence: appending it after the
  // whole phrase produced "Target 75.0 by 2030 percent"
  const value = unit ? `${fmtValue(target.value)} ${unit}` : fmtValue(target.value);
  return (
    <span
      className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-ink-600 tnum", className)}
      data-testid="target-line"
    >
      <Target className="size-3 text-aqua-500" aria-hidden />
      <span className="font-medium text-ink-900">
        {target.year ? t("targetBy", { value, year: target.year }) : t("targetOnly", { value })}
      </span>
      {target.gap == null ? null : target.met ? (
        <span className="text-ok">{t("targetMet")}</span>
      ) : (
        <span>{t("targetGap", { gap: fmtValue(target.gap) })}</span>
      )}
    </span>
  );
}
