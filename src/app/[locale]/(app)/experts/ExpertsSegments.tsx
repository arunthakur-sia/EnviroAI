"use client";
// CR08 3: the segmented control at the top of the Expert Network. Two
// segments, each with its title, its count and a one-line description; the
// active one carries the register's accent (maroon for internal, gulf for
// external). Deep links through ?view=, the last view remembered per user.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Building2, Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import type { ExpertKind } from "@/server/services/experts";

const EASE = [0.22, 1, 0.36, 1] as const;

export function ExpertsSegments({
  view,
  counts,
}: {
  view: ExpertKind;
  counts: { internal: number; external: number };
}) {
  const t = useTranslations("experts");
  const locale = useLocale();
  const router = useRouter();
  const reduced = useReducedMotion();
  const refs = React.useRef<Record<ExpertKind, HTMLButtonElement | null>>({ internal: null, external: null });

  const select = React.useCallback(
    (next: ExpertKind) => {
      if (next === view) return;
      // the filters of one view mean nothing to the other, so the URL resets
      router.push(`/experts?view=${next}` as never, { scroll: false });
      fetch("/api/v1/profile/prefs", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expertsView: next }),
      }).catch(() => {});
    },
    [router, view]
  );

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next: ExpertKind =
      e.key === "Home" ? "internal" : e.key === "End" ? "external" : view === "internal" ? "external" : "internal";
    refs.current[next]?.focus();
    select(next);
  };

  const segments: { key: ExpertKind; icon: React.ReactNode; count: number }[] = [
    { key: "internal", icon: <Building2 className="size-4" aria-hidden />, count: counts.internal },
    { key: "external", icon: <Globe2 className="size-4" aria-hidden />, count: counts.external },
  ];

  return (
    <div
      role="tablist"
      aria-label={t("viewLabel")}
      className="grid grid-cols-1 gap-2 rounded-2xl bg-sand-100 p-1.5 sm:grid-cols-2"
      data-testid="experts-segments"
    >
      {segments.map((s) => {
        const active = s.key === view;
        const accent = s.key === "internal" ? "bg-maroon-700" : "bg-gulf-600";
        return (
          <button
            key={s.key}
            ref={(el) => {
              refs.current[s.key] = el;
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => select(s.key)}
            onKeyDown={onKey}
            data-testid={`segment-${s.key}`}
            className={cn(
              "relative flex flex-col gap-1 overflow-hidden rounded-xl px-4 py-3 text-start transition-colors cursor-pointer",
              "focus-visible:outline-2 focus-visible:outline-gold-500",
              active ? "bg-white shadow-sm" : "hover:bg-white/60"
            )}
          >
            <span className="flex items-center gap-2">
              <span className={cn(active ? (s.key === "internal" ? "text-maroon-700" : "text-gulf-600") : "text-ink-400")}>
                {s.icon}
              </span>
              <span className={cn("font-display text-lg font-semibold", active ? "text-ink-900" : "text-ink-600")}>
                {t(`views.${s.key}.title`)}
              </span>
              <span
                className={cn(
                  "ms-auto rounded-full px-2 py-0.5 text-xs font-semibold tnum",
                  active
                    ? s.key === "internal"
                      ? "bg-maroon-100 text-maroon-900"
                      : "bg-gulf-100 text-gulf-600"
                    : "bg-sand-200 text-ink-600"
                )}
                data-testid={`segment-count-${s.key}`}
              >
                {formatNumber(s.count, locale, { decimals: 0 })}
              </span>
            </span>
            <span className={cn("text-xs leading-relaxed", active ? "text-ink-600" : "text-ink-400")}>
              {t(`views.${s.key}.description`)}
            </span>
            {active ? (
              <motion.span
                layoutId="experts-segment-accent"
                aria-hidden
                className={cn("absolute inset-x-0 bottom-0 h-0.5", accent)}
                transition={reduced ? { duration: 0 } : { duration: 0.24, ease: EASE }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
