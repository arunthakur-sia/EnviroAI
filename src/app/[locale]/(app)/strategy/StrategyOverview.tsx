"use client";
// CR03 2.2: Level 1 of the Living Strategy. "Strategy at a glance" band with
// three count-up figures and a 12-month update sparkline, then the seven
// outcomes as large medallions in a gentle arc: 176px progress rings that draw
// in once (700ms, staggered 60ms), RAG dot at the ring's end, hover lift with
// a one-line description card. The radial map stays behind a toggle.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Archive, Map as MapIcon, CircleDot } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn, bi } from "@/lib/utils";
import { CountUp } from "@/components/motion";
import type { NavigatorData, NavOutcome } from "@/server/services/strategy";
import { StrategyMap } from "./StrategyMap";

const RAG: Record<string, string> = {
  on_track: "var(--color-ok)",
  completed: "var(--color-gulf-600)",
  at_risk: "var(--color-warn)",
  delayed: "var(--color-danger)",
  not_started: "var(--color-ink-200)",
};

/* the gentle arc: centre high, ends low (mirrors itself in RTL) */
const ARC_OFFSETS = [44, 22, 7, 0, 7, 22, 44];

function outcomeNumber(code: string | null): string {
  const m = code?.match(/\d+/);
  return m ? m[0] : code ?? "";
}

export function OutcomeMedallion({
  outcome,
  editionCode,
  index,
  size = 176,
}: {
  outcome: NavOutcome;
  editionCode: string;
  index: number;
  size?: number;
}) {
  const t = useTranslations("strategy");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [drawn, setDrawn] = React.useState(!!reduced);
  React.useEffect(() => {
    if (reduced) return;
    const timer = setTimeout(() => setDrawn(true), 80 + index * 60);
    return () => clearTimeout(timer);
  }, [index, reduced]);

  const stroke = 10;
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const value = Math.min(1, Math.max(0, outcome.progress));
  const endAngle = -Math.PI / 2 + value * Math.PI * 2;
  const dotX = size / 2 + r * Math.cos(endAngle);
  const dotY = size / 2 + r * Math.sin(endAngle);
  const pct = Math.round(value * 100);
  const description = bi(locale, outcome.descriptionEn ?? "", outcome.descriptionAr ?? "");

  return (
    <Link
      href={`/strategy/${editionCode}/${outcome.slug}` as never}
      className="group/med relative flex flex-col items-center gap-2 rounded-2xl p-2 text-center outline-none transition-transform duration-200 ease-[var(--ease-paper)] hover:-translate-y-1.5 focus-visible:-translate-y-1.5"
      aria-label={t("medallionAria", {
        title: `${outcome.code ?? ""} ${bi(locale, outcome.titleEn, outcome.titleAr)}`,
        pct,
      })}
      data-testid="outcome-medallion"
    >
      <span className="relative block" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="block" aria-hidden style={{ direction: "ltr" }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-sand-300)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-maroon-700)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={drawn ? c * (1 - value) : c}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-[stroke] group-hover/med:stroke-maroon-500"
            style={{ transition: "stroke-dashoffset 700ms var(--ease-paper), stroke 200ms" }}
          />
          {/* RAG dot at the ring's end point */}
          {drawn && value > 0.01 ? (
            <circle cx={dotX} cy={dotY} r={6.5} fill={RAG[outcome.status] ?? RAG.not_started} stroke="#fff" strokeWidth={2} />
          ) : null}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-semibold text-maroon-900 tnum"
            style={{ fontFamily: "var(--font-display)", fontSize: 40 }}
          >
            {outcomeNumber(outcome.code)}
          </span>
        </span>
      </span>
      <span className="line-clamp-2 max-w-[176px] text-sm font-medium leading-snug text-ink-900">
        {bi(locale, outcome.titleEn, outcome.titleAr)}
      </span>
      <span className="text-[11px] text-ink-600 tnum">
        {outcome.targetCount
          ? t("nav.counts", {
              targets: outcome.targetCount,
              initiatives: outcome.initiativeCount,
              projects: outcome.projectCount,
            })
          : t("nav.countsShort", {
              initiatives: outcome.initiativeCount,
              projects: outcome.projectCount,
            })}
      </span>

      {/* the one-line description in a tooltip card */}
      {description ? (
        <span className="pointer-events-none invisible absolute -top-2 start-1/2 z-30 w-72 -translate-x-1/2 -translate-y-full opacity-0 transition-all duration-200 group-hover/med:visible group-hover/med:opacity-100 group-focus-visible/med:visible group-focus-visible/med:opacity-100 rtl:translate-x-1/2">
          <span className="card block p-3 text-start text-xs leading-relaxed text-ink-600 shadow-[var(--shadow-pop)]">
            <span className="mb-0.5 block font-medium text-ink-900">
              {outcome.code} · {t("nav.onTrackShare", { pct })}
            </span>
            <span className="line-clamp-2 block">{description}</span>
          </span>
        </span>
      ) : null}
    </Link>
  );
}

function Sparkline({ values, labelId }: { values: number[]; labelId: string }) {
  const w = 220;
  const h = 44;
  const max = Math.max(1, ...values);
  const points = values
    .map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - 4 - (v / max) * (h - 10)}`)
    .join(" ");
  return (
    <svg
      width={w}
      height={h}
      className="block"
      style={{ direction: "ltr" }}
      role="img"
      aria-labelledby={labelId}
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-maroon-500)"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StrategyOverview({
  data,
  initialView,
}: {
  data: NavigatorData;
  initialView: "overview" | "map";
}) {
  const t = useTranslations("strategy");
  const locale = useLocale();
  const router = useRouter();
  const [view, setView] = React.useState<"overview" | "map">(initialView);
  const archived = data.edition.status === "archived";
  const reduced = useReducedMotion();

  const pathBase = `/${locale}/strategy/${data.edition.code}`;
  const switchView = (v: "overview" | "map") => {
    setView(v);
    window.history.replaceState({}, "", v === "map" ? `${pathBase}?view=map` : pathBase);
  };

  return (
    <div>
      {/* Edition switch and map toggle at the top end side (CR03 2.2) */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <span aria-hidden />
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center gap-0.5 rounded-lg bg-sand-100 p-0.5">
            {data.editions.map((e) => (
              <button
                key={e.code}
                onClick={() => {
                  if (e.code === data.edition.code) return;
                  router.push((e.isDefault ? "/strategy" : `/strategy/${e.code}`) as never);
                }}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer",
                  e.code === data.edition.code
                    ? "bg-white font-medium text-maroon-900 shadow-sm"
                    : "text-ink-600 hover:text-ink-900"
                )}
              >
                {e.code.toUpperCase()}
                {e.status === "live" ? (
                  <span className="ms-1 inline-block h-1.5 w-1.5 rounded-full bg-ok align-middle" />
                ) : null}
              </button>
            ))}
          </span>
          <span className="inline-flex items-center gap-0.5 rounded-lg bg-sand-100 p-0.5">
            <button
              onClick={() => switchView("overview")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer",
                view === "overview" ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
              )}
            >
              <CircleDot className="size-3.5" /> {t("nav.outcomes")}
            </button>
            <button
              onClick={() => switchView("map")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer",
                view === "map" ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
              )}
            >
              <MapIcon className="size-3.5" /> {t("nav.map")}
            </button>
          </span>
        </span>
      </div>

      {archived ? (
        <div
          className="mb-5 flex items-center gap-3 rounded-xl border border-sand-300 bg-sand-100 px-4 py-2.5 text-sm text-ink-600"
          data-testid="archive-banner"
        >
          <Archive className="size-4 shrink-0" />
          {t("archiveBanner", { name: bi(locale, data.edition.nameEn, data.edition.nameAr) })}
        </div>
      ) : null}

      {view === "map" ? (
        <StrategyMap
          data={data}
          selection={{ outcomeId: null, targetId: null }}
          onSelect={(next) => {
            const o = data.outcomes.find((x) => x.id === next.outcomeId);
            const tg = data.targets.find((x) => x.id === next.targetId);
            if (o && tg) router.push(`/strategy/${data.edition.code}/${o.slug}/${tg.slug}` as never);
            else if (o) router.push(`/strategy/${data.edition.code}/${o.slug}` as never);
          }}
          onOpen={(id) => router.push(`/strategy/${id}` as never)}
        />
      ) : (
        <>
          {/* Strategy at a glance (CR03 2.2) */}
          <section
            className="rounded-2xl bg-sand-100 px-7 py-5"
            aria-label={t("glance.band")}
            data-testid="glance-band"
          >
            <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
              {data.glance.targetsTotal > 0 ? (
                <div className="digit-tick">
                  <p className="flex items-baseline gap-1.5">
                    <span
                      className="font-semibold text-maroon-900 tnum"
                      style={{ fontFamily: "var(--font-display)", fontSize: 44, lineHeight: 1 }}
                    >
                      <CountUp value={data.glance.targetsOnTrack} />
                    </span>
                    <span className="text-sm text-ink-600 tnum">
                      {t("glance.ofTotal", { total: data.glance.targetsTotal })}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-ink-600">{t("glance.targetsOnTrack")}</p>
                </div>
              ) : null}
              <div className="digit-tick">
                <p
                  className="font-semibold text-maroon-900 tnum"
                  style={{ fontFamily: "var(--font-display)", fontSize: 44, lineHeight: 1 }}
                >
                  <CountUp value={data.glance.initiatives} />
                </p>
                <p className="mt-1 text-xs text-ink-600">{t("glance.initiatives")}</p>
              </div>
              <div className="digit-tick">
                <p
                  className="font-semibold text-maroon-900 tnum"
                  style={{ fontFamily: "var(--font-display)", fontSize: 44, lineHeight: 1 }}
                >
                  <CountUp value={data.glance.projects} />
                </p>
                <p className="mt-1 text-xs text-ink-600">{t("glance.projects")}</p>
              </div>
              <div className="ms-auto">
                <Sparkline values={data.glance.updatesPerMonth} labelId="glance-spark-label" />
                <p id="glance-spark-label" className="mt-1 text-[11px] text-ink-600">
                  {t("glance.updatesSpark")}
                </p>
              </div>
            </div>
          </section>

          {/* The seven outcome medallions in a gentle arc (CR03 2.2) */}
          <motion.section
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 lg:mt-12"
            aria-label={t("nav.outcomes")}
            data-testid="medallion-arc"
          >
            <div className="grid grid-cols-2 gap-x-2 gap-y-8 sm:grid-cols-3 lg:grid-cols-7 lg:gap-x-0">
              {data.outcomes.map((o, i) => (
                <div key={o.id} className="flex justify-center">
                  <div
                    className="lg:translate-y-[var(--arc)]"
                    style={{ "--arc": `${ARC_OFFSETS[i % 7]}px` } as React.CSSProperties}
                  >
                    <OutcomeMedallion
                      outcome={o}
                      editionCode={data.edition.code}
                      index={i}
                      size={data.outcomes.length > 7 ? 152 : 176}
                    />
                  </div>
                </div>
              ))}
            </div>
            {/* room for the arc's lowest medallions */}
            <div className="hidden lg:block" style={{ height: 44 }} aria-hidden />
          </motion.section>
        </>
      )}
    </div>
  );
}
