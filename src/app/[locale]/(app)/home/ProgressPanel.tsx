"use client";
// CR02 1.5: the redesigned Your Progress panel. One large maroon ring (level
// progress) with a thin gold inner ring (weekly contribution streak), seven
// outcome dots filled by knowledge-footprint depth, and one caption line.
// Badges, receipts, and history live on the profile page. Quiet mode shows
// only the dots and a "Progress hidden" caption.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Flame } from "lucide-react";
import { bi } from "@/lib/utils";
import { Tip } from "@/components/ui/overlays";

export type ProgressData = {
  outcomes: { code: string; nameEn: string; nameAr: string; depth: number }[];
  points: number;
  levelNameEn: string;
  levelNameAr: string;
  levelMinPoints: number;
  nextLevelNameEn: string | null;
  nextLevelNameAr: string | null;
  nextLevelPoints: number | null;
  dailyStreak: number;
  weeklyStreak: number;
  contributionsThisWeek: number;
};

function depthColor(depth: number, max: number): string {
  if (depth <= 0) return "var(--color-sand-200)";
  const ratio = Math.min(1, depth / Math.max(1, max));
  if (ratio < 0.34) return "var(--color-maroon-300)";
  if (ratio < 0.67) return "var(--color-maroon-500)";
  return "var(--color-maroon-700)";
}

function Ring({
  size,
  stroke,
  value,
  color,
  track,
}: {
  size: number;
  stroke: number;
  value: number;
  color: string;
  track: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      className="absolute inset-0 m-auto -rotate-90"
      aria-hidden
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 700ms var(--ease-paper)" }}
      />
    </svg>
  );
}

function FootprintDots({
  outcomes,
}: {
  outcomes: ProgressData["outcomes"];
}) {
  const locale = useLocale();
  const t = useTranslations("home");
  const maxDepth = Math.max(1, ...outcomes.map((o) => o.depth));
  return (
    <div
      className="flex items-center justify-center gap-2.5"
      role="group"
      aria-label={t("footprintHint")}
    >
      {outcomes.map((o) => (
        <Tip key={o.code} content={`${bi(locale, o.nameEn, o.nameAr)}: ${o.depth}`}>
          <Link
            href={"/profile" as never}
            className="block size-3 rounded-full transition-transform hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
            style={{ background: depthColor(o.depth, maxDepth) }}
            aria-label={`${bi(locale, o.nameEn, o.nameAr)}: ${o.depth}`}
          />
        </Tip>
      ))}
    </div>
  );
}

export function ProgressPanel({
  progress,
  quiet,
}: {
  progress: ProgressData;
  quiet: boolean;
}) {
  const t = useTranslations("home");
  const locale = useLocale();

  if (quiet) {
    return (
      <div className="card flex h-full flex-col items-center justify-center gap-3 p-5" data-testid="progress-panel">
        <FootprintDots outcomes={progress.outcomes} />
        <p className="text-xs text-ink-600">{t("progressHidden")}</p>
      </div>
    );
  }

  const levelSpan = progress.nextLevelPoints
    ? progress.nextLevelPoints - progress.levelMinPoints
    : 0;
  const levelValue = progress.nextLevelPoints
    ? (progress.points - progress.levelMinPoints) / Math.max(1, levelSpan)
    : 1;
  const weeklyValue = Math.min(1, progress.contributionsThisWeek);
  const size = 172;

  return (
    <div className="card flex h-full flex-col items-center gap-4 p-5" data-testid="progress-panel">
      <div className="relative" style={{ width: size, height: size }}>
        <Ring
          size={size}
          stroke={11}
          value={levelValue}
          color="var(--color-maroon-700)"
          track="var(--color-sand-200)"
        />
        <Ring
          size={size - 32}
          stroke={4}
          value={weeklyValue}
          color="var(--color-gold-500)"
          track="var(--color-sand-100)"
        />
        <span
          className="absolute inset-0 flex flex-col items-center justify-center"
          aria-label={
            weeklyValue >= 1 ? t("weeklyRing") : t("weeklyRingPending")
          }
        >
          <span className="font-[family-name:var(--font-display)] text-[26px] font-semibold leading-none text-maroon-900 tnum">
            {progress.points.toLocaleString(locale === "ar" ? "ar-QA-u-nu-latn" : "en-US")}
          </span>
          <span className="mt-1 text-xs text-ink-600">
            {bi(locale, progress.levelNameEn, progress.levelNameAr)}
          </span>
        </span>
      </div>

      <FootprintDots outcomes={progress.outcomes} />

      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-center text-xs text-ink-600">
        {progress.nextLevelPoints ? (
          <span className="tnum">
            {t("nextUnlock", {
              points: (progress.nextLevelPoints - progress.points).toLocaleString(),
              level: bi(locale, progress.nextLevelNameEn ?? "", progress.nextLevelNameAr ?? ""),
            })}
          </span>
        ) : (
          <span>{t("topLevel")}</span>
        )}
        {progress.dailyStreak > 0 ? (
          <span className="flex items-center gap-1 font-medium text-warn tnum">
            <Flame className="size-3.5" aria-hidden />
            {t("dayStreak", { count: progress.dailyStreak })}
          </span>
        ) : null}
      </p>
    </div>
  );
}
