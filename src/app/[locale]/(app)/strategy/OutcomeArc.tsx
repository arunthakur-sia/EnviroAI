"use client";
// The seven outcomes arranged in a gentle arc, each with a RAG dot, progress
// ring, one headline KPI, and counts. The memorable element of the page.
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { bi } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { ProgressRing, RagDot } from "@/components/ui/primitives";
import type { OutcomeTile } from "@/server/services/strategy";

const EASE = [0.22, 1, 0.36, 1] as const;

export function OutcomeArc({
  tiles,
  archived,
}: {
  tiles: OutcomeTile[];
  archived: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("strategy");
  const reduced = useReducedMotion();
  const n = tiles.length;

  return (
    <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-7 xl:gap-3">
      {tiles.map((tile, i) => {
        // gentle arc: middle tiles float higher on wide screens
        const mid = (n - 1) / 2;
        const lift = n > 3 ? Math.round(Math.pow(Math.abs(i - mid), 1.4) * 7) : 0;
        return (
          <motion.div
            key={tile.id}
            initial={reduced ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05, ease: EASE }}
            className="xl:relative"
            style={{ marginTop: undefined }}
          >
            <Link
              href={`/strategy/${tile.id}` as never}
              className="card card-hover flex h-full flex-col items-center gap-2 p-4 text-center xl:transition-transform"
              style={{ transform: `translateY(${lift}px)` }}
            >
              <ProgressRing
                value={tile.progress}
                size={62}
                stroke={4}
                color={archived ? "var(--color-ink-400)" : "var(--color-maroon-700)"}
              >
                <span className="text-sm font-semibold text-ink-900 tnum">
                  {Math.round(tile.progress * 100)}%
                </span>
              </ProgressRing>
              <p className="flex min-h-10 items-center justify-center gap-1.5 text-[13px] font-medium leading-snug text-ink-900">
                <RagDot status={tile.status} />
                {bi(locale, tile.titleEn, tile.titleAr)}
              </p>
              {tile.headlineKpi && tile.headlineKpi.latest !== null ? (
                <p className="text-xs text-ink-600 tnum">
                  {formatNumber(tile.headlineKpi.latest, locale, { decimals: 1 })}
                  {tile.headlineKpi.unit ? ` ${tile.headlineKpi.unit}` : ""}
                  {tile.headlineKpi.target !== null &&
                  tile.headlineKpi.target !== tile.headlineKpi.latest ? (
                    <span className="text-gold-500">
                      {" "}
                      / {formatNumber(tile.headlineKpi.target, locale, { decimals: 1 })}
                    </span>
                  ) : null}
                </p>
              ) : null}
              <p className="mt-auto text-[11px] text-ink-400 tnum">
                {t("tileCounts", {
                  initiatives: tile.initiativeCount,
                  projects: tile.projectCount,
                })}
              </p>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
