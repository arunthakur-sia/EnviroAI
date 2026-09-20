"use client";
// CR07 2.4 (1 to 5): the Council Strategy, the centrepiece of SiaNexus. One
// page, one URL: the strategy header with the Internal mark, the strategic
// direction band, the scorecard strip of goal rings with a period switch, and
// the results chain navigator that opens a goal panel beneath the strip with a
// tapered pointer sliding to the selected ring. Intermediate outcomes expand in
// place to outputs, outputs expand in place to projects and programmes, and a
// project opens the end-side drawer. State lives in the query string, so Back
// unwinds drawer, output, intermediate outcome, goal.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  ChevronDown,
  FileOutput,
  Headphones,
  Layers,
  ListTree,
  MessageCircleQuestion,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn, bi } from "@/lib/utils";
import { formatDate, formatNumber, formatPeriod } from "@/lib/format";
import { Button, Chip } from "@/components/ui/primitives";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { ReportButton } from "@/components/nexus/ReportButton";
import { OwnerControlCompact } from "@/components/nexus/people/OwnerControl";
import type { ItemRef } from "@/components/nexus/people/OwnerControl";
import type {
  Cadence,
  CouncilIndicatorCard,
  CouncilNodeView,
  CouncilPageData,
  Rag,
  Scorecard,
  ScorecardGoal,
} from "@/server/services/council";
import {
  IndicatorChart,
  ProjectDrawer,
  RAG_VAR,
  RagMark,
  SubHeading,
  displayFont,
  fetchCouncilProject,
} from "./ProjectDrawer";
import { ResultsView } from "./ResultsView";
import { ReferenceSections } from "./ReferenceSections";

const EASE = [0.22, 1, 0.36, 1] as const;
const CADENCES: Cadence[] = ["monthly", "quarterly", "yearly"];
const CADENCE_LABEL: Record<Cadence, "thisMonth" | "thisQuarter" | "thisYear"> = {
  monthly: "thisMonth",
  quarterly: "thisQuarter",
  yearly: "thisYear",
};

export type CouncilStrategyOption = {
  id: string;
  nameEn: string;
  nameAr: string;
  periodFrom: string | null;
  periodTo: string | null;
};

export type CouncilView = "chain" | "results";

export type CouncilState = {
  g: string | null;
  io: string | null;
  o: string | null;
  p: string | null;
};

export type CouncilInitialState = CouncilState & {
  view: CouncilView;
  period: Cadence;
};

/* ------------------------------------------------------------------ */
/* small helpers                                                        */
/* ------------------------------------------------------------------ */

function slugOf(code: string | null, id: string): string {
  return code ? code.toLowerCase().replace(/\./g, "-") : id;
}

function levelNumber(code: string | null): string {
  const m = code?.match(/\d+/);
  return m ? m[0] : code ?? "";
}

function shareRag(share: number | null): Rag {
  if (share == null) return "no_data";
  return share >= 0.8 ? "on_target" : share >= 0.5 ? "at_risk" : "behind";
}

function yearOf(iso: string | null): string {
  return iso ? iso.slice(0, 4) : "";
}

/* ------------------------------------------------------------------ */
/* URL state                                                            */
/* ------------------------------------------------------------------ */

function parseState(search: string): CouncilInitialState {
  const params = new URLSearchParams(search);
  const rawPeriod = params.get("period");
  const period: Cadence =
    rawPeriod === "monthly" ? "monthly" : rawPeriod === "quarterly" ? "quarterly" : "yearly";
  return {
    g: params.get("g"),
    io: params.get("io"),
    o: params.get("o"),
    p: params.get("p"),
    view: params.get("view") === "results" ? "results" : "chain",
    period,
  };
}

function stateQuery(
  state: CouncilState,
  view: CouncilView,
  period: Cadence,
  strategyId: string | null
): string {
  const params = new URLSearchParams();
  if (strategyId) params.set("strategy", strategyId);
  if (state.g) params.set("g", state.g);
  if (state.io) params.set("io", state.io);
  if (state.o) params.set("o", state.o);
  if (state.p) params.set("p", state.p);
  if (view !== "chain") params.set("view", view);
  if (period !== "yearly") params.set("period", period);
  const s = params.toString();
  return s ? `?${s}` : "";
}

/* ------------------------------------------------------------------ */
/* CR07 2.4.3: a goal ring on the scorecard strip                       */
/* ------------------------------------------------------------------ */

function GoalRing({
  goal,
  index,
  selected,
  onClick,
  size = 156,
}: {
  goal: ScorecardGoal;
  index: number;
  selected: boolean;
  onClick: () => void;
  size?: number;
}) {
  const t = useTranslations("council");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [drawn, setDrawn] = React.useState(Boolean(reduced));

  React.useEffect(() => {
    if (reduced) {
      setDrawn(true);
      return;
    }
    const timer = setTimeout(() => setDrawn(true), 80 + index * 60);
    return () => clearTimeout(timer);
  }, [index, reduced]);

  const stroke = 10;
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const value = goal.share == null ? 0 : Math.min(1, Math.max(0, goal.share));
  const pct = Math.round(value * 100);
  const rag = shareRag(goal.share);
  const endAngle = -Math.PI / 2 + value * Math.PI * 2;
  const dotX = size / 2 + r * Math.cos(endAngle);
  const dotY = size / 2 + r * Math.sin(endAngle);
  const title = bi(locale, goal.titleEn, goal.titleAr);

  const otherLines = (
    [
      ["monthly", "otherMonthly"],
      ["quarterly", "otherQuarterly"],
      ["yearly", "otherYearly"],
    ] as const
  ).filter(([key]) => goal.otherCadence[key] > 0);

  return (
    <button
      onClick={onClick}
      aria-expanded={selected}
      aria-label={
        goal.share == null
          ? t("scorecard.goalAriaNoData", { title })
          : t("scorecard.goalAria", { title, pct })
      }
      data-testid="goal-ring"
      data-selected={selected || undefined}
      className="group/ring flex cursor-pointer flex-col items-center gap-2 rounded-2xl p-2 text-center outline-none transition-transform duration-200 ease-[var(--ease-paper)] hover:-translate-y-1.5 focus-visible:-translate-y-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
    >
      <span className="relative block" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="block" aria-hidden style={{ direction: "ltr" }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill={selected ? "var(--color-maroon-50)" : "none"}
            stroke="var(--color-sand-300)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={selected ? "var(--color-maroon-500)" : "var(--color-maroon-700)"}
            strokeWidth={selected ? stroke + 2 : stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={drawn ? c * (1 - value) : c}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="group-hover/ring:stroke-maroon-500"
            style={{
              transition: reduced
                ? undefined
                : "stroke-dashoffset 700ms var(--ease-paper), stroke 200ms, stroke-width 200ms",
            }}
          />
          {drawn && value > 0.01 ? (
            <circle
              cx={dotX}
              cy={dotY}
              r={6.5}
              fill={RAG_VAR[rag]}
              stroke="#ffffff"
              strokeWidth={2}
            />
          ) : null}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-semibold text-maroon-900 tnum"
            style={{ fontFamily: "var(--font-display)", fontSize: 38 }}
          >
            {levelNumber(goal.code)}
          </span>
        </span>
      </span>
      <span className="line-clamp-2 max-w-[168px] text-sm font-medium leading-snug text-ink-900">
        {title}
      </span>
      {goal.share == null ? (
        <span className="max-w-[168px] text-[11px] leading-snug text-ink-600">
          {t("scorecard.noCadence")}
        </span>
      ) : (
        <span className="text-[11px] font-medium text-maroon-900 tnum">
          {t("scorecard.onTarget", { pct })}
          <span className="font-normal text-ink-600">
            {" · "}
            {t("scorecard.reportedCount", { count: goal.reported })}
          </span>
        </span>
      )}
      <span className="max-w-[168px] text-[10px] leading-snug text-ink-600 tnum">
        {t("scorecard.counts", {
          io: goal.counts.intermediateOutcomes,
          outputs: goal.counts.outputs,
          projects: goal.counts.projects,
        })}
      </span>
      {otherLines.length ? (
        <span className="flex max-w-[168px] flex-col text-[10px] leading-snug text-ink-400 tnum">
          {otherLines.map(([key, msg]) => (
            <span key={key}>{t(`scorecard.${msg}`, { count: goal.otherCadence[key] })}</span>
          ))}
        </span>
      ) : null}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* CR07 2.4.5: the indicator tile and its card                          */
/* ------------------------------------------------------------------ */

function IndicatorTile({
  indicator,
  onOpen,
}: {
  indicator: CouncilIndicatorCard;
  onOpen: () => void;
}) {
  const t = useTranslations("council");
  const locale = useLocale();
  const name = bi(locale, indicator.nameEn, indicator.nameAr);
  const latest = indicator.latest;
  return (
    <button
      onClick={onOpen}
      aria-label={t("chain.openIndicator", { name })}
      className="flex cursor-pointer flex-col gap-1.5 rounded-[var(--radius-card)] bg-white px-3.5 py-3 text-start shadow-[var(--shadow-paper)] transition-all duration-200 ease-[var(--ease-paper)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
      data-testid="indicator-tile"
    >
      <span className="flex items-center gap-2">
        <RagMark rag={indicator.rag} />
        {indicator.code ? <span className="text-[10px] text-ink-600 tnum">{indicator.code}</span> : null}
        <span className="ms-auto text-[10px] text-ink-600">
          {t(`indicator.cadence.${indicator.frequency}` as never)}
        </span>
      </span>
      <span className="line-clamp-2 min-h-9 text-sm font-medium leading-snug text-ink-900">{name}</span>
      <span className="flex items-baseline gap-1.5">
        <span className="text-xl font-semibold leading-none text-maroon-900 tnum">
          {latest?.actual != null ? formatNumber(latest.actual, locale) : t("chain.noResult")}
        </span>
        {latest?.target != null ? (
          <span className="text-xs text-ink-400 tnum">
            / {formatNumber(latest.target, locale)}
            {indicator.unit ? ` ${indicator.unit}` : ""}
          </span>
        ) : indicator.unit ? (
          <span className="text-xs text-ink-400">{indicator.unit}</span>
        ) : null}
      </span>
      {latest?.period ? (
        <span className="text-[10px] text-ink-600 tnum">{formatPeriod(latest.period, locale)}</span>
      ) : null}
    </button>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-sm leading-relaxed text-ink-900">{value}</dd>
    </div>
  );
}

function IndicatorCardDialog({
  indicator,
  onClose,
  overDrawer = false,
}: {
  indicator: CouncilIndicatorCard | null;
  onClose: () => void;
  /** CR08 overlay layering: opened from inside the project drawer (z-60), the
      card has to rise above it (DECISIONS 117) while the drawer dims itself */
  overDrawer?: boolean;
}) {
  const t = useTranslations("council");
  const locale = useLocale();
  if (!indicator) return null;
  const name = bi(locale, indicator.nameEn, indicator.nameAr);
  const pct = indicator.attainment == null ? null : Math.round(indicator.attainment * 100);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        title={t("levels.indicatorCard")}
        className={cn("max-h-[88vh] w-[min(700px,94vw)] overflow-y-auto", overDrawer && "z-[75]")}
        data-testid="indicator-card"
      >
        <div className="flex flex-col gap-4">
          <div>
            <p className="flex flex-wrap items-center gap-2 text-xs text-ink-600">
              {indicator.code ? <Chip tone="sand">{indicator.code}</Chip> : null}
              <Chip tone="maroon">{t(`indicator.cadence.${indicator.frequency}` as never)}</Chip>
              <span className="flex items-center gap-1.5">
                <RagMark rag={indicator.rag} />
                {t(`indicator.rag.${indicator.rag}` as never)}
              </span>
              {pct != null ? (
                <span className="tnum">{t("indicator.attainment", { pct })}</span>
              ) : null}
            </p>
            <h3 className="mt-1.5 text-lg leading-snug">{name}</h3>
          </div>

          <div className="rounded-xl bg-sand-50 p-3">
            <SubHeading>{t("indicator.chart")}</SubHeading>
            <IndicatorChart indicator={indicator} labelId={`indicator-chart-${indicator.id}`} />
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field
              label={t("indicator.definition")}
              value={bi(locale, indicator.definitionEn ?? "", indicator.definitionAr ?? "")}
            />
            <Field
              label={t("indicator.formula")}
              value={bi(locale, indicator.formulaEn ?? "", indicator.formulaAr ?? "")}
            />
            <Field label={t("levels.unitOfMeasure")} value={indicator.unit} />
            <Field
              label={t("indicator.direction")}
              value={
                indicator.direction === "down_good"
                  ? t("indicator.directionDown")
                  : t("indicator.directionUp")
              }
            />
            <Field label={t("indicator.baselineYear")} value={indicator.baselineYear} />
            <Field
              label={t("indicator.baselineValue")}
              value={
                indicator.baselineValue == null
                  ? null
                  : formatNumber(indicator.baselineValue, locale)
              }
            />
            <Field
              label={t("levels.frequency")}
              value={t(`indicator.cadence.${indicator.frequency}` as never)}
            />
            <Field
              label={t("levels.dataSource")}
              value={bi(locale, indicator.dataSourceEn ?? "", indicator.dataSourceAr ?? "")}
            />
            <Field
              label={t("levels.meansOfVerification")}
              value={bi(
                locale,
                indicator.meansOfVerificationEn ?? "",
                indicator.meansOfVerificationAr ?? ""
              )}
            />
            {/* CR08 9.1: the custodian of the indicator opens their card */}
            <Field
              label={t("indicator.responsible")}
              value={
                indicator.responsible ? (
                  <OwnerControlCompact
                    owner={indicator.responsible}
                    size="md"
                    item={{
                      type: "indicator",
                      id: indicator.id,
                      titleEn: indicator.nameEn,
                      titleAr: indicator.nameAr,
                      href: "/council-strategy",
                    }}
                  />
                ) : null
              }
            />
            <Field
              label={t("indicator.latest")}
              value={
                indicator.latest
                  ? `${formatPeriod(indicator.latest.period, locale)}: ${
                      indicator.latest.actual == null
                        ? t("chain.noResult")
                        : formatNumber(indicator.latest.actual, locale)
                    }`
                  : null
              }
            />
            <Field
              label={t("indicator.notes")}
              value={bi(locale, indicator.notesEn ?? "", indicator.notesAr ?? "")}
            />
          </dl>

          {indicator.linkedStatisticsIndicatorId ? (
            <p className="text-xs text-gulf-600">{t("indicator.linkedStatistics")}</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* CR07 2.4.2: the strategic direction band                             */
/* ------------------------------------------------------------------ */

function DirectionBand({ strategy }: { strategy: CouncilPageData["strategy"] }) {
  const t = useTranslations("council");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [open, setOpen] = React.useState<number | null>(null);
  const vision = bi(locale, strategy.visionEn ?? "", strategy.visionAr ?? "");
  const mission = bi(locale, strategy.missionEn ?? "", strategy.missionAr ?? "");

  if (!vision && !mission && !strategy.values.length) return null;

  return (
    <section
      className="mt-6 rounded-2xl bg-sand-100 px-5 py-6 sm:px-7"
      aria-label={t("header.directionAria")}
      data-testid="direction-band"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
        {vision ? (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-maroon-700">
              {t("header.vision")}
            </p>
            <p
              className="text-[19px] leading-relaxed text-ink-900 sm:text-[21px]"
              style={{ fontFamily: displayFont(locale) }}
            >
              {vision}
            </p>
          </div>
        ) : null}
        {mission ? (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-maroon-700">
              {t("header.mission")}
            </p>
            <p
              className="text-[19px] leading-relaxed text-ink-900 sm:text-[21px]"
              style={{ fontFamily: displayFont(locale) }}
            >
              {mission}
            </p>
          </div>
        ) : null}
      </div>

      {strategy.values.length ? (
        <div className="mt-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-maroon-700">
            {t("header.values")}
          </p>
          <div className="flex flex-wrap gap-2">
            {strategy.values.map((v, i) => {
              const name = bi(locale, v.name_en, v.name_ar);
              const description = bi(locale, v.description_en, v.description_ar);
              const isOpen = open === i;
              return (
                <div
                  key={`${name}-${i}`}
                  className={cn(
                    "overflow-hidden rounded-xl border border-sand-300 bg-white transition-colors",
                    isOpen ? "w-full border-maroon-300" : ""
                  )}
                  data-testid="value-chip"
                >
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-label={
                      isOpen ? t("header.valueCollapse", { name }) : t("header.valueExpand", { name })
                    }
                    className="flex w-full cursor-pointer items-center gap-1.5 px-3 py-1.5 text-start text-sm font-medium text-ink-900 hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
                  >
                    {name}
                    <ChevronDown
                      className={cn(
                        "size-3.5 shrink-0 text-ink-400 transition-transform",
                        isOpen && "rotate-180"
                      )}
                      aria-hidden
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && description ? (
                      <motion.div
                        initial={reduced ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={reduced ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.24, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <p className="border-t border-sand-100 px-3 py-2.5 text-sm leading-relaxed text-ink-600">
                          {description}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* CR07 2.4.4: the goal panel and its in-place lanes                    */
/* ------------------------------------------------------------------ */

function ProjectCard({
  node,
  onOpen,
}: {
  node: CouncilNodeView;
  onOpen: () => void;
}) {
  const t = useTranslations("council");
  const tc = useTranslations("common");
  const locale = useLocale();
  const title = bi(locale, node.titleEn, node.titleAr);
  const item: ItemRef = {
    type: "council_node",
    id: node.id,
    titleEn: node.titleEn,
    titleAr: node.titleAr,
    href: `/council-strategy?p=${encodeURIComponent(slugOf(node.code, node.id))}`,
  };
  /* CR08 9.1: the card is a button, so the owner's chip (a button too) sits
     beside it inside the card frame rather than within it */
  return (
    <div className="flex w-56 shrink-0 flex-col gap-1.5 rounded-[var(--radius-card)] bg-white px-3.5 py-3 shadow-[var(--shadow-paper)] transition-all duration-200 ease-[var(--ease-paper)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
      <button
        onClick={onOpen}
        data-chain-level="project"
        data-testid="project-card"
        aria-label={t("chain.openProject", { title })}
        className="flex cursor-pointer flex-col gap-1.5 rounded-lg text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
      >
        <span className="flex items-center gap-2">
          <RagMark
            rag={
              node.status === "completed" || node.status === "on_track"
                ? "on_target"
                : node.status === "at_risk"
                  ? "at_risk"
                  : node.status === "delayed"
                    ? "behind"
                    : "no_data"
            }
          />
          {node.code ? <span className="text-[10px] text-ink-600 tnum">{node.code}</span> : null}
        </span>
        <span className="line-clamp-3 min-h-12 text-sm font-medium leading-snug text-ink-900">
          {title}
        </span>
        <span className="text-[10px] text-ink-600">{tc(`status.${node.status}` as never)}</span>
        {node.endDate ? (
          <span className="text-[10px] text-ink-400 tnum">
            {formatDate(node.endDate, locale, { style: "short" })}
          </span>
        ) : null}
      </button>
      {/* mt-auto keeps the chips of a row of cards on one line */}
      {node.ownerUser ? (
        <OwnerControlCompact owner={node.ownerUser} item={item} className="mt-auto max-w-full pt-1" />
      ) : null}
    </div>
  );
}

function OutputCard({
  node,
  projects,
  expanded,
  onToggle,
  onOpenProject,
}: {
  node: CouncilNodeView;
  projects: CouncilNodeView[];
  expanded: boolean;
  onToggle: () => void;
  onOpenProject: (node: CouncilNodeView) => void;
}) {
  const t = useTranslations("council");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const title = bi(locale, node.titleEn, node.titleAr);
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-white transition-colors",
        expanded ? "border-maroon-300" : "border-sand-200"
      )}
      data-testid="output-card"
      data-expanded={expanded}
    >
      <button
        onClick={onToggle}
        data-chain-level="output"
        aria-expanded={expanded}
        aria-label={expanded ? t("chain.collapse", { title }) : t("chain.expand", { title })}
        className="flex w-full cursor-pointer items-start gap-2.5 px-3.5 py-3 text-start outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
      >
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-gulf-100 text-[10px] font-semibold text-gulf-600 tnum">
          {levelNumber(node.code) || "·"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium leading-snug text-ink-900">{title}</span>
          <span className="mt-0.5 block text-[11px] text-ink-600 tnum">
            {t("chain.projectCount", { count: projects.length })}
            {node.onTargetShare != null ? (
              <>
                {" · "}
                {t("chain.onTarget", { pct: Math.round(node.onTargetShare * 100) })}
              </>
            ) : null}
          </span>
        </span>
        <ChevronDown
          className={cn("mt-1 size-4 shrink-0 text-ink-400 transition-transform", expanded && "rotate-180")}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-sand-100 px-3.5 py-3">
              <SubHeading>{t("chain.projects")}</SubHeading>
              {projects.length ? (
                <div
                  className="flex gap-2.5 overflow-x-auto pb-2"
                  style={{ overscrollBehaviorX: "contain" }}
                >
                  {projects.map((p) => (
                    <ProjectCard key={p.id} node={p} onOpen={() => onOpenProject(p)} />
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-sand-300 bg-sand-50 px-3 py-3 text-center text-xs text-ink-600">
                  {t("chain.noProjects")}
                </p>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function IoCard({
  node,
  indicators,
  outputs,
  projectsOf,
  expanded,
  openOutput,
  onToggle,
  onToggleOutput,
  onOpenProject,
}: {
  node: CouncilNodeView;
  indicators: CouncilIndicatorCard[];
  outputs: CouncilNodeView[];
  projectsOf: (outputId: string) => CouncilNodeView[];
  expanded: boolean;
  openOutput: string | null;
  onToggle: () => void;
  onToggleOutput: (node: CouncilNodeView | null) => void;
  onOpenProject: (node: CouncilNodeView) => void;
}) {
  const t = useTranslations("council");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const title = bi(locale, node.titleEn, node.titleAr);
  const pct = node.onTargetShare == null ? null : Math.round(node.onTargetShare * 100);

  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-paper)] transition-shadow duration-200 hover:shadow-[var(--shadow-lift)]",
        expanded && "col-span-full border-s-2 border-maroon-100"
      )}
      data-testid="io-card"
      data-expanded={expanded}
    >
      <button
        onClick={onToggle}
        data-chain-level="io"
        aria-expanded={expanded}
        aria-label={expanded ? t("chain.collapse", { title }) : t("chain.expand", { title })}
        className="block w-full cursor-pointer rounded-[var(--radius-card)] px-5 py-4 text-start outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
      >
        <span className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600 tnum"
            style={{ fontFamily: "inherit" }}
          >
            {node.code}
          </span>
          <RagMark rag={shareRag(node.onTargetShare)} />
          <span className="ms-auto flex items-center gap-1.5">
            <Chip tone="sand">{t("chain.childCounts", {
              outputs: node.counts.outputs,
              projects: node.counts.projects,
            })}</Chip>
            <ChevronDown
              className={cn("size-4 shrink-0 text-ink-400 transition-transform", expanded && "rotate-180")}
              aria-hidden
            />
          </span>
        </span>
        <span className="mt-1.5 block text-[15px] font-medium leading-snug text-ink-900">{title}</span>
        <span className="mt-3 flex items-baseline gap-2">
          {pct != null ? (
            <>
              <span className="text-[30px] font-semibold leading-none text-maroon-900 tnum">{pct}%</span>
              <span className="text-xs text-ink-600">{t("chain.onTarget", { pct })}</span>
            </>
          ) : (
            <span className="text-xs text-ink-600">{t("chain.noResult")}</span>
          )}
          <span className="ms-auto text-[11px] text-ink-600 tnum">
            {t("chain.indicatorCount", { count: indicators.length })}
          </span>
        </span>
        {indicators.length ? (
          <span className="mt-2 flex flex-wrap items-center gap-1.5" aria-hidden>
            {indicators.slice(0, 12).map((i) => (
              <RagMark key={i.id} rag={i.rag} className="h-2.5 w-2.5" />
            ))}
          </span>
        ) : null}
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-sand-100 px-5 py-4">
              <SubHeading>{t("chain.outputs")}</SubHeading>
              {outputs.length ? (
                <div className="flex flex-col gap-2">
                  {outputs.map((o) => (
                    <OutputCard
                      key={o.id}
                      node={o}
                      projects={projectsOf(o.id)}
                      expanded={openOutput === o.id}
                      onToggle={() => onToggleOutput(openOutput === o.id ? null : o)}
                      onOpenProject={onOpenProject}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-sand-300 bg-sand-50 px-3 py-4 text-center text-xs text-ink-600">
                  {t("chain.noOutputs")}
                </p>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function GoalPanel({
  data,
  goal,
  openIo,
  openOutput,
  onToggleIo,
  onToggleOutput,
  onOpenProject,
  onOpenIndicator,
  onClose,
}: {
  data: CouncilPageData;
  goal: CouncilNodeView;
  openIo: string | null;
  openOutput: string | null;
  onToggleIo: (node: CouncilNodeView | null) => void;
  onToggleOutput: (node: CouncilNodeView | null) => void;
  onOpenProject: (node: CouncilNodeView) => void;
  onOpenIndicator: (indicator: CouncilIndicatorCard) => void;
  onClose: () => void;
}) {
  const t = useTranslations("council");
  const locale = useLocale();
  const panelRef = React.useRef<HTMLDivElement>(null);

  const childrenOf = React.useCallback(
    (parentId: string, level: CouncilNodeView["level"]) =>
      data.nodes
        .filter((n) => n.parentId === parentId && n.level === level)
        .sort((a, b) => a.sort - b.sort),
    [data.nodes]
  );

  const ios = childrenOf(goal.id, "intermediate_outcome");
  const goalIndicators = data.indicators.filter((i) => i.nodeId === goal.id);
  const alignment = data.alignment.filter((a) => a.councilNodeId === goal.id);
  const description = bi(locale, goal.descriptionEn ?? "", goal.descriptionAr ?? "");

  /* CR03 keyboard model: arrows move within a level, Escape collapses it */
  function onKeyDown(e: React.KeyboardEvent) {
    const active = document.activeElement as HTMLElement | null;
    const level = active?.getAttribute("data-chain-level");
    if (!level) return;
    if (e.key === "Escape") {
      if (level === "output" && openOutput) {
        e.preventDefault();
        onToggleOutput(null);
      } else if (level === "io" && openIo) {
        e.preventDefault();
        onToggleIo(null);
      }
      return;
    }
    if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const rows = [
      ...(panelRef.current?.querySelectorAll<HTMLElement>(`[data-chain-level="${level}"]`) ?? []),
    ];
    const index = rows.indexOf(active as HTMLElement);
    if (index < 0) return;
    const forwardKey = locale === "ar" ? "ArrowLeft" : "ArrowRight";
    const delta = e.key === "ArrowDown" || e.key === forwardKey ? 1 : -1;
    const next = rows[index + delta];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  }

  return (
    <div
      ref={panelRef}
      onKeyDown={onKeyDown}
      className="relative overflow-hidden rounded-2xl bg-sand-100"
      data-testid="goal-panel"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-1 start-4 select-none font-semibold text-maroon-100"
        style={{ fontFamily: "var(--font-display)", fontSize: 96, lineHeight: 1 }}
      >
        {levelNumber(goal.code)}
      </span>

      <div className="relative px-5 py-6 sm:px-7">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 max-w-2xl flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-maroon-700 tnum">
              {t("levels.goal")} {goal.code}
            </p>
            <h2 className="mt-1 text-2xl leading-tight sm:text-[30px]">
              {bi(locale, goal.titleEn, goal.titleAr)}
            </h2>
            {description ? (
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{description}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {goal.ownerUnit ? (
                <Link
                  href={`/organisation?unit=${encodeURIComponent(goal.ownerUnit.code)}` as never}
                  className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-maroon-700 shadow-sm hover:text-maroon-900"
                >
                  {t("chain.ownerUnit")}: {bi(locale, goal.ownerUnit.nameEn, goal.ownerUnit.nameAr)}
                </Link>
              ) : null}
              {goal.isIllustrative ? (
                <Chip tone="gold" title={t("header.illustrativeTitle")}>
                  {t("header.illustrative")}
                </Chip>
              ) : null}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("chain.closePanel")}
            className="cursor-pointer rounded-lg p-1.5 text-ink-600 hover:bg-white/70"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* alignment with the National Development Strategy */}
        {alignment.length ? (
          <div className="mt-5">
            <SubHeading>{t("chain.alignment")}</SubHeading>
            <div className="flex flex-wrap gap-1.5">
              {alignment.map((a) => {
                const label = bi(locale, a.labelEn ?? "", a.labelAr ?? "") || a.targetId;
                const note = bi(locale, a.noteEn ?? "", a.noteAr ?? "");
                return a.ndsSlug ? (
                  <Link
                    key={a.id}
                    href={`/strategy?o=${encodeURIComponent(a.ndsSlug)}` as never}
                    title={note || undefined}
                    aria-label={t("chain.alignmentOpen", { label })}
                    data-testid="alignment-chip"
                    className="inline-flex items-center gap-1 rounded-md bg-gulf-100 px-2 py-0.5 text-[11px] font-medium leading-4 text-gulf-600 transition-colors hover:bg-gulf-400 hover:text-white"
                  >
                    {label}
                  </Link>
                ) : (
                  <Chip key={a.id} tone="gulf" title={note || undefined} data-testid="alignment-chip">
                    {label}
                  </Chip>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* the goal's own indicators */}
        <div className="mt-5">
          <SubHeading>{t("chain.indicators")}</SubHeading>
          {goalIndicators.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {goalIndicators.map((i) => (
                <IndicatorTile key={i.id} indicator={i} onOpen={() => onOpenIndicator(i)} />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-sand-300 bg-sand-50 px-3 py-4 text-center text-xs text-ink-600">
              {t("chain.noIndicators")}
            </p>
          )}
        </div>

        {/* intermediate outcomes, expanding in place */}
        <div className="mt-5">
          <SubHeading>{t("chain.intermediateOutcomes")}</SubHeading>
          {ios.length ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {ios.map((io) => (
                <IoCard
                  key={io.id}
                  node={io}
                  indicators={data.indicators.filter((i) => i.nodeId === io.id)}
                  outputs={childrenOf(io.id, "output")}
                  projectsOf={(outputId) => childrenOf(outputId, "project")}
                  expanded={openIo === io.id}
                  openOutput={openOutput}
                  onToggle={() => onToggleIo(openIo === io.id ? null : io)}
                  onToggleOutput={onToggleOutput}
                  onOpenProject={onOpenProject}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-sand-300 bg-sand-50 px-3 py-6 text-center text-sm text-ink-600">
              {t("chain.noIntermediateOutcomes")}
            </p>
          )}
        </div>

        <p className="mt-5 hidden text-[11px] text-ink-600 lg:block">{t("chain.keyboard")}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the page shell                                                       */
/* ------------------------------------------------------------------ */

export function CouncilStrategy({
  data,
  strategies,
  scorecards,
  initialState,
}: {
  data: CouncilPageData;
  strategies: CouncilStrategyOption[];
  /** CR07 2.4.3: buildScorecard is a server function; the three cadences are
      computed on the server and switched here without a round trip. */
  scorecards: Record<Cadence, Scorecard>;
  initialState: CouncilInitialState;
}) {
  const t = useTranslations("council");
  const locale = useLocale();
  const router = useRouter();
  const reduced = useReducedMotion();

  const [state, setState] = React.useState<CouncilState>({
    g: initialState.g,
    io: initialState.io,
    o: initialState.o,
    p: initialState.p,
  });
  const [view, setView] = React.useState<CouncilView>(initialState.view);
  const [period, setPeriod] = React.useState<Cadence>(initialState.period);
  const [indicator, setIndicator] = React.useState<CouncilIndicatorCard | null>(null);
  const [railVisible, setRailVisible] = React.useState(false);
  const [pointerX, setPointerX] = React.useState<number | null>(null);

  const depthRef = React.useRef(0);
  const stripRef = React.useRef<HTMLDivElement>(null);
  const ringRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const panelAnchorRef = React.useRef<HTMLDivElement>(null);

  const goals = React.useMemo(
    () => data.nodes.filter((n) => n.level === "goal").sort((a, b) => a.sort - b.sort),
    [data.nodes]
  );
  const scorecard = scorecards[period];
  const cardByGoal = React.useMemo(
    () => new Map(scorecard.goals.map((g) => [g.goalId, g])),
    [scorecard]
  );

  const goal = state.g ? goals.find((g) => slugOf(g.code, g.id) === state.g) ?? null : null;
  const selectedIndex = goal ? goals.findIndex((g) => g.id === goal.id) : -1;
  const openIo = React.useMemo(() => {
    if (!goal || !state.io) return null;
    const node = data.nodes.find(
      (n) => n.level === "intermediate_outcome" && slugOf(n.code, n.id) === state.io
    );
    return node?.id ?? null;
  }, [goal, state.io, data.nodes]);
  const openOutput = React.useMemo(() => {
    if (!state.o) return null;
    const node = data.nodes.find((n) => n.level === "output" && slugOf(n.code, n.id) === state.o);
    return node?.id ?? null;
  }, [state.o, data.nodes]);
  const project = React.useMemo(() => {
    if (!state.p) return null;
    return data.nodes.find((n) => n.level === "project" && slugOf(n.code, n.id) === state.p) ?? null;
  }, [state.p, data.nodes]);

  /* ---- URL state, exactly as the Strategy Canvas does it ---- */

  const applyUrl = React.useCallback(
    (next: CouncilState, nextView: CouncilView, nextPeriod: Cadence, push: boolean) => {
      const strategyId = new URLSearchParams(window.location.search).get("strategy");
      const url = `/${locale}/council-strategy${stateQuery(next, nextView, nextPeriod, strategyId)}`;
      if (push) {
        window.history.pushState({ council: true }, "", url);
        depthRef.current++;
      } else {
        window.history.replaceState({ council: true }, "", url);
      }
    },
    [locale]
  );

  React.useEffect(() => {
    function onPop() {
      const parsed = parseState(window.location.search);
      setState({ g: parsed.g, io: parsed.io, o: parsed.o, p: parsed.p });
      setView(parsed.view);
      setPeriod(parsed.period);
      depthRef.current = Math.max(0, depthRef.current - 1);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const closeLevel = React.useCallback(
    (next: CouncilState) => {
      if (depthRef.current > 0) {
        window.history.back(); // popstate applies the previous state
      } else {
        setState(next);
        applyUrl(next, view, period, false);
      }
    },
    [applyUrl, view, period]
  );

  const openGoal = (node: CouncilNodeView) => {
    const slug = slugOf(node.code, node.id);
    if (state.g === slug && !state.io && !state.o && !state.p) {
      closeLevel({ g: null, io: null, o: null, p: null });
      return;
    }
    const next: CouncilState = { g: slug, io: null, o: null, p: null };
    setState(next);
    applyUrl(next, view, period, true);
  };

  const toggleIo = (node: CouncilNodeView | null) => {
    if (!goal) return;
    const next: CouncilState = {
      g: state.g,
      io: node ? slugOf(node.code, node.id) : null,
      o: null,
      p: null,
    };
    setState(next);
    if (node) applyUrl(next, view, period, true);
    else closeLevel(next);
  };

  const toggleOutput = (node: CouncilNodeView | null) => {
    const next: CouncilState = {
      g: state.g,
      io: state.io,
      o: node ? slugOf(node.code, node.id) : null,
      p: null,
    };
    setState(next);
    if (node) applyUrl(next, view, period, true);
    else closeLevel(next);
  };

  const openProject = (node: CouncilNodeView) => {
    const next: CouncilState = { ...state, p: slugOf(node.code, node.id) };
    setState(next);
    applyUrl(next, "chain", period, true);
    setView("chain");
    void fetchCouncilProject(node.id);
  };

  /** Previous, Next and dependency jumps replace, so Back still closes. */
  const drawerNavigate = (id: string) => {
    const node = data.nodes.find((n) => n.id === id);
    if (!node) return;
    const next: CouncilState = { ...state, p: slugOf(node.code, node.id) };
    setState(next);
    applyUrl(next, view, period, false);
  };

  const switchView = (nextView: CouncilView) => {
    setView(nextView);
    applyUrl(state, nextView, period, false);
  };

  const switchPeriod = (nextPeriod: Cadence) => {
    setPeriod(nextPeriod);
    applyUrl(state, view, nextPeriod, false);
  };

  const copyLink = () => {
    const strategyId = new URLSearchParams(window.location.search).get("strategy");
    const url = `${window.location.origin}/${locale}/council-strategy${stateQuery(
      state,
      view,
      period,
      strategyId
    )}`;
    void navigator.clipboard?.writeText(url);
  };

  /* deep link: bring the open panel into view once */
  React.useEffect(() => {
    if (!initialState.g) return;
    depthRef.current = 0;
    const timer = setTimeout(() => {
      panelAnchorRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }, 420);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* the sticky rail appears once the strip scrolls away */
  React.useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setRailVisible(!entry.isIntersecting), {
      rootMargin: "-64px 0px 0px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [view]);

  /* the tapered pointer slides to the selected ring */
  const measurePointer = React.useCallback(() => {
    if (selectedIndex < 0) return;
    const ring = ringRefs.current[selectedIndex];
    const anchor = panelAnchorRef.current;
    if (!ring || !anchor) return;
    const rr = ring.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    setPointerX(rr.left + rr.width / 2 - ar.left);
  }, [selectedIndex]);

  React.useEffect(() => {
    measurePointer();
    const onResize = () => measurePointer();
    window.addEventListener("resize", onResize);
    const timer = setTimeout(measurePointer, 340);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
    };
  }, [measurePointer, view, period]);

  /* ---- header pieces ---- */

  const strategyName = bi(locale, data.strategy.nameEn, data.strategy.nameAr);
  const from = yearOf(data.strategy.periodFrom);
  const to = yearOf(data.strategy.periodTo);
  const goalTitle = goal ? bi(locale, goal.titleEn, goal.titleAr) : "";
  const askQuestion = goal
    ? t("header.briefGoal", { title: goalTitle, strategy: strategyName })
    : t("header.briefStrategy", { strategy: strategyName });
  const listenTopic = goal ? `${goalTitle} · ${strategyName}` : strategyName;
  const listenId = goal ? goal.id : data.strategy.id;
  const reportDocumentId = data.strategy.sourceDocumentId;

  return (
    <div className="relative">
      {/* 1. the header */}
      <header className="mb-5" data-testid="council-header">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <Chip tone="maroon" title={t("header.internalTitle")} data-testid="internal-chip">
                {t("header.internal")}
              </Chip>
              {data.strategy.isIllustrative ? (
                <Chip tone="gold" title={t("header.illustrativeTitle")} data-testid="illustrative-chip">
                  {t("header.illustrative")}
                </Chip>
              ) : null}
            </div>
            <h1
              className="text-[28px] leading-tight sm:text-[34px]"
              style={{ fontFamily: displayFont(locale) }}
            >
              {strategyName}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-600">
              {from && to ? (
                <span className="tnum">{t("header.periodRange", { from, to })}</span>
              ) : null}
              <span className="tnum">
                {data.strategy.approvedOn
                  ? t("header.approvedOn", {
                      date: formatDate(data.strategy.approvedOn, locale, { style: "medium" }),
                    })
                  : t("header.notApproved")}
              </span>
              {data.strategy.owner ? (
                <Link
                  href={`/organisation?unit=${encodeURIComponent(data.strategy.owner.code)}` as never}
                  aria-label={t("header.openOwner", {
                    unit: bi(locale, data.strategy.owner.nameEn, data.strategy.owner.nameAr),
                  })}
                  className="link-draw font-medium text-maroon-700"
                >
                  {bi(locale, data.strategy.owner.nameEn, data.strategy.owner.nameAr)}
                </Link>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {strategies.length > 1 ? (
              <select
                value={data.strategy.id}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id !== data.strategy.id) {
                    router.push(`/council-strategy?strategy=${encodeURIComponent(id)}` as never);
                  }
                }}
                aria-label={t("header.editionAria")}
                data-testid="council-edition"
                className="h-9.5 max-w-56 cursor-pointer rounded-lg border border-sand-300 bg-white px-2.5 text-sm text-ink-900 focus:border-maroon-500 focus:outline-none"
              >
                {strategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {bi(locale, s.nameEn, s.nameAr)}
                  </option>
                ))}
              </select>
            ) : null}

            {/* the view toggle switches in place, not by route */}
            <span
              className="inline-flex items-center gap-0.5 rounded-lg bg-sand-100 p-0.5"
              role="group"
              aria-label={t("header.viewToggleAria")}
              data-testid="council-view-toggle"
            >
              <button
                onClick={() => switchView("chain")}
                aria-pressed={view === "chain"}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                  view === "chain" ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
                )}
              >
                <ListTree className="size-3.5 flip-rtl" aria-hidden /> {t("header.viewChain")}
              </button>
              <button
                onClick={() => switchView("results")}
                aria-pressed={view === "results"}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                  view === "results" ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
                )}
              >
                <Layers className="size-3.5" aria-hidden /> {t("header.viewResults")}
              </button>
            </span>

            <Link
              href={`/ask?q=${encodeURIComponent(askQuestion)}` as never}
              data-testid="council-brief"
              className="inline-flex h-9.5 items-center gap-2 rounded-lg border border-sand-300 bg-white px-4 text-sm font-medium text-ink-900 transition-colors hover:border-maroon-300 hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
            >
              <MessageCircleQuestion className="size-4" aria-hidden /> {t("header.briefMe")}
            </Link>

            {reportDocumentId ? (
              <ReportButton
                scope={{
                  kind: "vault",
                  ids: [reportDocumentId],
                  labelEn: data.strategy.nameEn,
                  labelAr: data.strategy.nameAr,
                }}
              />
            ) : (
              <Button variant="secondary" disabled title={t("header.extractUnavailable")}>
                <FileOutput /> {t("header.extract")}
              </Button>
            )}

            <Link
              href={
                `/podcast/new?topic=${encodeURIComponent(listenTopic)}&scope=council&id=${encodeURIComponent(
                  listenId
                )}` as never
              }
              aria-label={t("header.listenAria", { title: listenTopic })}
              data-testid="council-listen"
              className="inline-flex h-9.5 items-center gap-2 rounded-lg px-4 text-sm font-medium text-ink-600 transition-colors hover:bg-maroon-100/60 hover:text-maroon-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
            >
              <Headphones className="size-4" aria-hidden /> {t("header.listen")}
            </Link>
          </div>
        </div>
      </header>

      {view === "results" ? (
        <ResultsView data={data} canEdit={data.canEdit} />
      ) : (
        <>
          {/* 2. the strategic direction band */}
          <DirectionBand strategy={data.strategy} />

          {/* 3. the scorecard strip */}
          <section
            ref={stripRef}
            className="mt-8"
            aria-label={t("scorecard.aria")}
            data-testid="scorecard-strip"
          >
            <div className="grid grid-cols-2 gap-x-2 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-0">
              {goals.map((g, i) => {
                const card = cardByGoal.get(g.id);
                if (!card) return null;
                return (
                  <div key={g.id} className="flex justify-center">
                    <div
                      ref={(el) => {
                        ringRefs.current[i] = el;
                      }}
                    >
                      <GoalRing
                        goal={card}
                        index={i}
                        selected={goal?.id === g.id}
                        onClick={() => openGoal(g)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* the period switch, recomputed rings without a round trip */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <span
                className="inline-flex items-center gap-0.5 rounded-lg bg-sand-100 p-0.5"
                role="group"
                aria-label={t("scorecard.periodSwitchAria")}
                data-testid="period-switch"
              >
                {CADENCES.map((c) => (
                  <button
                    key={c}
                    onClick={() => switchPeriod(c)}
                    aria-pressed={period === c}
                    className={cn(
                      "cursor-pointer rounded-md px-3 py-1.5 text-xs transition-colors",
                      period === c ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
                    )}
                  >
                    {t(`scorecard.${CADENCE_LABEL[c]}` as never)}
                  </button>
                ))}
              </span>
              <span className="text-[11px] text-ink-600 tnum">
                {t("scorecard.periodLabel", { period: formatPeriod(scorecard.period, locale) })}
              </span>
            </div>
          </section>

          {/* 4. the results chain navigator */}
          <section
            ref={panelAnchorRef}
            className="relative mt-8 scroll-mt-24"
            data-testid="chain-navigator"
            aria-label={t("chain.aria")}
          >
            {goal && pointerX !== null ? (
              <span
                aria-hidden
                className="absolute -top-2.5 z-10 hidden lg:block"
                style={{
                  left: pointerX - 12,
                  transition: reduced ? undefined : "left 300ms var(--ease-paper)",
                }}
              >
                <span
                  className="block size-6 rotate-45 rounded-[3px] bg-sand-100"
                  style={{
                    borderTop: "1px solid var(--color-sand-300)",
                    borderLeft: "1px solid var(--color-sand-300)",
                  }}
                />
              </span>
            ) : null}
            <AnimatePresence initial={false}>
              {goal ? (
                <motion.div
                  key="panel"
                  initial={reduced ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduced ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="overflow-visible"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={goal.id}
                      initial={reduced ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={reduced ? undefined : { opacity: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      <GoalPanel
                        data={data}
                        goal={goal}
                        openIo={openIo}
                        openOutput={openOutput}
                        onToggleIo={toggleIo}
                        onToggleOutput={toggleOutput}
                        onOpenProject={openProject}
                        onOpenIndicator={setIndicator}
                        onClose={() => closeLevel({ g: null, io: null, o: null, p: null })}
                      />
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>

          {/* the sticky ring rail */}
          <AnimatePresence>
            {railVisible ? (
              <motion.div
                initial={reduced ? false : { y: -48, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduced ? undefined : { y: -48, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-x-0 top-16 z-30 flex justify-center px-4"
                data-testid="council-rail"
              >
                <div
                  className="flex items-center gap-2 rounded-b-2xl border border-t-0 border-sand-300 bg-white/95 px-4 py-2 shadow-[var(--shadow-paper)] backdrop-blur"
                  role="toolbar"
                  aria-label={t("chain.railAria")}
                >
                  <Chip tone="maroon">{t("header.internal")}</Chip>
                  {goals.map((g) => {
                    const card = cardByGoal.get(g.id);
                    const isSel = goal?.id === g.id;
                    const value = card?.share == null ? 0 : Math.min(1, Math.max(0, card.share));
                    const r = 16;
                    const c = 2 * Math.PI * r;
                    return (
                      <button
                        key={g.id}
                        onClick={() => {
                          if (!isSel) openGoal(g);
                          panelAnchorRef.current?.scrollIntoView({
                            behavior: reduced ? "auto" : "smooth",
                            block: "start",
                          });
                        }}
                        aria-label={`${g.code ?? ""} ${bi(locale, g.titleEn, g.titleAr)}`}
                        aria-pressed={isSel}
                        className="relative size-10 cursor-pointer rounded-full transition-transform hover:-translate-y-0.5"
                      >
                        <svg width={40} height={40} aria-hidden style={{ direction: "ltr" }}>
                          <circle
                            cx={20}
                            cy={20}
                            r={r}
                            fill={isSel ? "var(--color-maroon-700)" : "none"}
                            stroke="var(--color-sand-300)"
                            strokeWidth={3}
                          />
                          <circle
                            cx={20}
                            cy={20}
                            r={r}
                            fill="none"
                            stroke={isSel ? "var(--color-maroon-700)" : "var(--color-maroon-500)"}
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeDasharray={c}
                            strokeDashoffset={c * (1 - value)}
                            transform="rotate(-90 20 20)"
                          />
                        </svg>
                        <span
                          className={cn(
                            "absolute inset-0 flex items-center justify-center text-xs font-semibold tnum",
                            isSel ? "text-white" : "text-maroon-900"
                          )}
                        >
                          {levelNumber(g.code)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </>
      )}

      {/* 7. the reference sections always sit beneath the chain */}
      <div className="mt-10">
        <ReferenceSections data={data} canEdit={data.canEdit} />
      </div>

      {/* 5. the indicator card */}
      <IndicatorCardDialog
        indicator={indicator}
        onClose={() => setIndicator(null)}
        overDrawer={Boolean(project)}
      />

      {/* CR07 2.4.5: the project drawer */}
      <AnimatePresence>
        {project ? (
          <ProjectDrawer
            key="council-drawer"
            nodeId={project.id}
            onNavigate={drawerNavigate}
            onClose={() => closeLevel({ ...state, p: null })}
            onCopyLink={copyLink}
            onOpenIndicator={setIndicator}
            dimmed={Boolean(indicator)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
