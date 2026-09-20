"use client";
// CR07 2.4.5: the project drawer of the Council Strategy. 520px from the end
// side over a 20 percent scrim, the same motion as the Living Strategy node
// drawer. It loads the project from GET /api/v1/council?view=project&id=, its
// lessons from PUT /api/v1/lessons/links, and its deliverables from the shared
// deliverables endpoint. Previous and Next walk detail.siblings.
//
// The inline target-against-actual chart lives here and is exported, so the
// chain page and the drawer draw the same figure without a circular import.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  GitBranch,
  Link as LinkIcon,
  ShieldAlert,
  Wallet,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn, bi } from "@/lib/utils";
import { formatDate, formatNumber, formatPeriod } from "@/lib/format";
import { Chip, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { Shelf, type ShelfDoc } from "@/components/nexus/Shelf";
import { OwnerControl } from "@/components/nexus/people/OwnerControl";
import type { ItemRef } from "@/components/nexus/people/OwnerControl";
import type {
  CouncilIndicatorCard,
  CouncilProjectDetail,
  IndicatorPoint,
  Rag,
} from "@/server/services/council";
import type { NodeLessonRow } from "@/server/services/lesson-links";
import type { DeliverableRow } from "@/server/services/deliverables";
import { StakeholdersSection } from "@/components/nexus/Stakeholders";
import { AskContextItem } from "@/components/nexus/ask/AskContextItem";

/* ------------------------------------------------------------------ */
/* shared bits                                                          */
/* ------------------------------------------------------------------ */

export const RAG_CLASS: Record<Rag, string> = {
  on_target: "bg-ok",
  at_risk: "bg-warn",
  behind: "bg-danger",
  no_data: "bg-ink-200",
};

export const RAG_VAR: Record<Rag, string> = {
  on_target: "var(--color-ok)",
  at_risk: "var(--color-warn)",
  behind: "var(--color-danger)",
  no_data: "var(--color-ink-200)",
};

/** A small status dot for the council RAG vocabulary. */
export function RagMark({ rag, className }: { rag: Rag; className?: string }) {
  return (
    <span
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", RAG_CLASS[rag], className)}
      aria-hidden
    />
  );
}

/** The display face, Fraunces in English and Noto Kufi in Arabic. */
export function displayFont(locale: string): string {
  return locale === "ar" ? "var(--font-kufi)" : "var(--font-display)";
}

export function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600"
      style={{ fontFamily: "inherit" }}
    >
      {children}
    </p>
  );
}

function timelinePct(start: string | null, end: string | null, at?: string | null): number | null {
  if (!start || !end) return null;
  const s = Date.parse(start);
  const e = Date.parse(end);
  const p = at ? Date.parse(at) : Date.now();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s || !Number.isFinite(p)) return null;
  return Math.max(0, Math.min(1, (p - s) / (e - s)));
}

/* ------------------------------------------------------------------ */
/* the target against actual chart, drawn by hand                       */
/* ------------------------------------------------------------------ */

export function IndicatorChart({
  indicator,
  height = 168,
  labelId,
}: {
  indicator: CouncilIndicatorCard;
  height?: number;
  labelId: string;
}) {
  const t = useTranslations("council");
  const locale = useLocale();
  const series: IndicatorPoint[] = indicator.series;
  const numbers = series
    .flatMap((p) => [p.target, p.actual])
    .filter((v): v is number => v != null && Number.isFinite(v));

  if (!series.length || !numbers.length) {
    return (
      <p className="rounded-lg border border-dashed border-sand-300 bg-sand-50 px-3 py-4 text-center text-xs text-ink-600">
        {t("indicator.noSeries")}
      </p>
    );
  }

  const w = 560;
  const h = height;
  const padStart = 46;
  const padEnd = 12;
  const padTop = 14;
  const padBottom = 26;
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const span = max - min || Math.abs(max) || 1;
  const lo = min - span * 0.14;
  const hi = max + span * 0.14;
  const x = (i: number) =>
    series.length === 1
      ? padStart + (w - padStart - padEnd) / 2
      : padStart + (i / (series.length - 1)) * (w - padStart - padEnd);
  const y = (v: number) => padTop + (1 - (v - lo) / (hi - lo)) * (h - padTop - padBottom);

  const targetPoints = series
    .map((p, i) => (p.target == null ? null : `${x(i)},${y(p.target)}`))
    .filter((v): v is string => v !== null)
    .join(" ");
  const actualPoints = series
    .map((p, i) => (p.actual == null ? null : `${x(i)},${y(p.actual)}`))
    .filter((v): v is string => v !== null)
    .join(" ");

  const gridValues = [lo + (hi - lo) * 0.5, hi - (hi - lo) * 0.14, lo + (hi - lo) * 0.14];
  const tickIndexes = [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])];

  return (
    <div style={{ direction: "ltr" }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="block h-auto w-full"
        role="img"
        aria-labelledby={labelId}
        preserveAspectRatio="xMidYMid meet"
      >
        <title id={labelId}>
          {t("indicator.chartAria", {
            name: bi(locale, indicator.nameEn, indicator.nameAr),
            count: series.length,
          })}
        </title>
        {gridValues.map((v, i) => (
          <line
            key={i}
            x1={padStart}
            x2={w - padEnd}
            y1={y(v)}
            y2={y(v)}
            stroke="var(--color-sand-200)"
            strokeWidth={1}
          />
        ))}
        <line
          x1={padStart}
          x2={w - padEnd}
          y1={h - padBottom}
          y2={h - padBottom}
          stroke="var(--color-sand-300)"
          strokeWidth={1}
        />
        {targetPoints ? (
          <polyline
            points={targetPoints}
            fill="none"
            stroke="var(--color-ink-400)"
            strokeWidth={1.75}
            strokeDasharray="5 4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {/* gold ticks mark each recorded target */}
        {series.map((p, i) =>
          p.target == null ? null : (
            <line
              key={`tick-${p.period}`}
              x1={x(i)}
              x2={x(i)}
              y1={y(p.target) - 5}
              y2={y(p.target) + 5}
              stroke="var(--color-gold-500)"
              strokeWidth={2.25}
              strokeLinecap="round"
            />
          )
        )}
        {actualPoints ? (
          <polyline
            points={actualPoints}
            fill="none"
            stroke="var(--color-maroon-700)"
            strokeWidth={2.25}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {series.map((p, i) =>
          p.actual == null ? null : (
            <circle
              key={`dot-${p.period}`}
              cx={x(i)}
              cy={y(p.actual)}
              r={3.5}
              fill="var(--color-maroon-700)"
              stroke="#ffffff"
              strokeWidth={1.5}
            />
          )
        )}
        <text x={4} y={y(hi) + 10} fill="var(--color-ink-600)" fontSize={11}>
          {formatNumber(hi, locale, { decimals: 1 })}
        </text>
        <text x={4} y={y(lo)} fill="var(--color-ink-600)" fontSize={11}>
          {formatNumber(lo, locale, { decimals: 1 })}
        </text>
        {tickIndexes.map((i) => (
          <text
            key={`label-${i}`}
            x={x(i)}
            y={h - 8}
            fill="var(--color-ink-600)"
            fontSize={11}
            textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"}
          >
            {formatPeriod(series[i].period, locale)}
          </text>
        ))}
      </svg>
      <p className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded-full bg-maroon-700" aria-hidden />
          {t("indicator.legendActual")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-5 rounded-full"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to right, var(--color-ink-400) 0 5px, transparent 5px 9px)",
            }}
            aria-hidden
          />
          {t("indicator.legendTarget")}
        </span>
        {indicator.unit ? <span>{indicator.unit}</span> : null}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* data loading                                                         */
/* ------------------------------------------------------------------ */

const detailCache = new Map<string, CouncilProjectDetail>();

export async function fetchCouncilProject(id: string): Promise<CouncilProjectDetail | null> {
  const cached = detailCache.get(id);
  if (cached) return cached;
  try {
    const res = await fetch(`/api/v1/council?view=project&id=${encodeURIComponent(id)}`);
    const json = await res.json();
    if (res.ok && json.data) {
      detailCache.set(id, json.data as CouncilProjectDetail);
      return json.data as CouncilProjectDetail;
    }
  } catch {
    /* the drawer shows its error state */
  }
  return null;
}

async function fetchLessons(
  nodeId: string
): Promise<{ direct: NodeLessonRow[]; inherited: NodeLessonRow[] }> {
  try {
    const res = await fetch("/api/v1/lessons/links", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nodeId }),
    });
    const json = await res.json();
    if (res.ok && json.data) return json.data as { direct: NodeLessonRow[]; inherited: NodeLessonRow[] };
  } catch {
    /* lessons are optional */
  }
  return { direct: [], inherited: [] };
}

async function fetchDeliverables(nodeId: string): Promise<DeliverableRow[]> {
  try {
    const res = await fetch(`/api/v1/deliverables?nodeId=${encodeURIComponent(nodeId)}`);
    const json = await res.json();
    if (res.ok && Array.isArray(json.data)) return json.data as DeliverableRow[];
  } catch {
    /* deliverables are optional */
  }
  return [];
}

function DrawerSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-5" aria-busy>
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the drawer                                                           */
/* ------------------------------------------------------------------ */

export function ProjectDrawer({
  nodeId,
  onNavigate,
  onClose,
  onCopyLink,
  onOpenIndicator,
  dimmed = false,
}: {
  nodeId: string;
  /** moves the drawer to another council node, by id */
  onNavigate: (id: string) => void;
  onClose: () => void;
  onCopyLink: () => void;
  onOpenIndicator?: (indicator: CouncilIndicatorCard) => void;
  /** CR08 overlay layering: a dialog opened from the drawer rises above it, so
      the drawer dims itself and the page still reads as one stack */
  dimmed?: boolean;
}) {
  const t = useTranslations("council");
  const tc = useTranslations("common");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const { toast } = useToast();
  const [detail, setDetail] = React.useState<CouncilProjectDetail | null>(
    detailCache.get(nodeId) ?? null
  );
  const [failed, setFailed] = React.useState(false);
  const [lessons, setLessons] = React.useState<{
    direct: NodeLessonRow[];
    inherited: NodeLessonRow[];
  }>({ direct: [], inherited: [] });
  const [deliverables, setDeliverables] = React.useState<DeliverableRow[]>([]);

  React.useEffect(() => {
    let alive = true;
    setDetail(detailCache.get(nodeId) ?? null);
    setFailed(false);
    setLessons({ direct: [], inherited: [] });
    setDeliverables([]);
    void fetchCouncilProject(nodeId).then((data) => {
      if (!alive) return;
      if (data) {
        setDetail(data);
        for (const sib of [
          data.siblings[data.siblings.indexOf(nodeId) - 1],
          data.siblings[data.siblings.indexOf(nodeId) + 1],
        ]) {
          if (sib) void fetchCouncilProject(sib);
        }
      } else {
        setFailed(true);
      }
    });
    void fetchLessons(nodeId).then((rows) => {
      if (alive) setLessons(rows);
    });
    void fetchDeliverables(nodeId).then((rows) => {
      if (alive) setDeliverables(rows);
    });
    return () => {
      alive = false;
    };
  }, [nodeId]);

  const siblings = detail?.siblings ?? [];
  const index = siblings.indexOf(nodeId);
  const prevId = index > 0 ? siblings[index - 1] : null;
  const nextId = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      /* CR08 9.1: an overlay opened from inside the drawer (a person card, the
         indicator dialog) is the layer on top, so it owns Escape and the arrow
         keys until it is dismissed (DECISIONS 117) */
      if (
        e.defaultPrevented ||
        dimmed ||
        document.querySelector('[data-testid="person-card-popover"], [role="dialog"][data-state="open"]')
      ) {
        return;
      }
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const back = locale === "ar" ? "ArrowRight" : "ArrowLeft";
      const forward = locale === "ar" ? "ArrowLeft" : "ArrowRight";
      if (e.key === back && prevId) onNavigate(prevId);
      if (e.key === forward && nextId) onNavigate(nextId);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNavigate, prevId, nextId, locale, dimmed]);

  const node = detail?.node;
  const todayPct = node ? timelinePct(node.startDate, node.endDate) : null;
  const milestones = (detail?.milestones ?? [])
    .map((m) => ({
      ...m,
      date: m.doneDate ?? m.dueDate,
      pct: node ? timelinePct(node.startDate, node.endDate, m.doneDate ?? m.dueDate) : null,
    }))
    .filter((m) => m.pct !== null);

  const systems =
    locale === "ar" && detail?.inputs.systemsAr.length
      ? detail.inputs.systemsAr
      : (detail?.inputs.systemsEn ?? []);

  /* CR08 9.1: what a person card opened in this drawer is opened for */
  const ownerItem: ItemRef | null = node
    ? {
        type: "council_node",
        id: node.id,
        titleEn: node.titleEn,
        titleAr: node.titleAr,
        href: `/council-strategy?p=${encodeURIComponent(
          node.code ? node.code.toLowerCase().replace(/\./g, "-") : node.id
        )}`,
      }
    : null;

  const shelfDocs: ShelfDoc[] = deliverables.map((d) => ({
    id: d.documentId,
    titleEn: d.titleEn,
    titleAr: d.titleAr,
    typeCode: "deliverable",
    classification: d.classificationLevel,
    status: d.status,
    ownerName: d.ownerNameEn,
    ownerNameAr: d.ownerNameAr,
    deliverableCode: d.deliverableCode,
  }));

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label={t("drawer.aria")}
      data-testid="council-project-drawer"
    >
      <motion.button
        aria-label={tc("close")}
        className="absolute inset-0 cursor-pointer bg-ink-900/20"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduced ? undefined : { opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        className="absolute inset-y-0 end-0 flex w-full max-w-[520px] flex-col bg-white shadow-[var(--shadow-pop)]"
        initial={reduced ? false : { x: locale === "ar" ? "-100%" : "100%" }}
        animate={{ x: 0 }}
        exit={reduced ? undefined : { x: locale === "ar" ? "-100%" : "100%" }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* header bar: the Internal chip travels with the module */}
        <div className="flex items-center gap-1.5 border-b border-sand-100 px-4 py-3">
          <button
            onClick={() => prevId && onNavigate(prevId)}
            disabled={!prevId}
            aria-label={t("drawer.prev")}
            className="cursor-pointer rounded-lg p-1.5 text-ink-600 hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="size-4 flip-rtl" />
          </button>
          <button
            onClick={() => nextId && onNavigate(nextId)}
            disabled={!nextId}
            aria-label={t("drawer.next")}
            className="cursor-pointer rounded-lg p-1.5 text-ink-600 hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="size-4 flip-rtl" />
          </button>
          <Chip tone="maroon" title={t("header.internalTitle")} data-testid="internal-chip">
            {t("header.internal")}
          </Chip>
          <span className="min-w-0 flex-1" />
          <button
            onClick={() => {
              onCopyLink();
              toast(t("drawer.linkCopied"), "success");
            }}
            aria-label={t("drawer.copyLink")}
            className="cursor-pointer rounded-lg p-1.5 text-ink-600 hover:bg-sand-100"
          >
            <LinkIcon className="size-4" />
          </button>
          <button
            onClick={onClose}
            aria-label={tc("close")}
            className="cursor-pointer rounded-lg p-1.5 text-ink-600 hover:bg-sand-100"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!detail && !failed ? (
            <DrawerSkeleton />
          ) : failed || !node || !detail ? (
            <p className="p-6 text-sm text-ink-600">{t("drawer.notFound")}</p>
          ) : (
            <motion.div
              key={nodeId}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.16 }}
              className="flex flex-col gap-5 p-5"
            >
              {/* CR08 2.3: the Ask NPC launcher knows this council node while the drawer is open */}
              <AskContextItem item={{ kind: "council_node", id: node.id, code: node.code, titleEn: node.titleEn, titleAr: node.titleAr, href: `/council-strategy?p=${encodeURIComponent(node.code ? node.code.toLowerCase().replace(/\./g, "-") : node.id)}` }} />
              {/* identity */}
              <div>
                <p className="flex flex-wrap items-center gap-2 text-xs text-ink-600">
                  <Chip tone="sand">{t("levels.project")}</Chip>
                  {node.code ? <span className="tnum">{node.code}</span> : null}
                  <RagMark rag={node.status === "completed" || node.status === "on_track" ? "on_target" : node.status === "at_risk" ? "at_risk" : node.status === "delayed" ? "behind" : "no_data"} />
                  <span>{tc(`status.${node.status}` as never)}</span>
                  {node.isIllustrative ? (
                    <Chip tone="gold" title={t("header.illustrativeTitle")}>
                      {t("header.illustrative")}
                    </Chip>
                  ) : null}
                </p>
                <h2 className="mt-1.5 text-xl leading-snug">{bi(locale, node.titleEn, node.titleAr)}</h2>
                {node.descriptionEn || node.descriptionAr ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                    {bi(locale, node.descriptionEn ?? "", node.descriptionAr ?? "")}
                  </p>
                ) : null}
              </div>

              {/* where this sits */}
              {detail.path.length ? (
                <div>
                  <SubHeading>{t("drawer.path")}</SubHeading>
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-600">
                    {detail.path.map((p, i) => (
                      <React.Fragment key={p.id}>
                        {i ? <span aria-hidden>/</span> : null}
                        <span className="max-w-56 truncate">
                          {p.code ? <span className="tnum">{p.code} </span> : null}
                          {bi(locale, p.titleEn, p.titleAr)}
                        </span>
                      </React.Fragment>
                    ))}
                  </p>
                </div>
              ) : null}

              {/* owner and department */}
              {node.ownerUser || node.ownerUnit ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="council-owner">
                  {/* CR08 9.1: the owner is a person chip with the card */}
                  {node.ownerUser ? (
                    <OwnerControl
                      owner={node.ownerUser}
                      role="project_owner"
                      item={ownerItem}
                      align="start"
                    />
                  ) : null}
                  {node.ownerUnit ? (
                    <span className="text-sm">
                      <span className="block text-[10px] uppercase tracking-[0.1em] text-ink-400">
                        {t("drawer.department")}
                      </span>
                      <Link
                        href={`/organisation?unit=${encodeURIComponent(node.ownerUnit.code)}` as never}
                        className="link-draw font-medium text-maroon-700"
                      >
                        {bi(locale, node.ownerUnit.nameEn, node.ownerUnit.nameAr)}
                      </Link>
                    </span>
                  ) : null}
                </div>
              ) : null}

              {/* timeline with milestone dots */}
              {todayPct !== null ? (
                <div>
                  <SubHeading>{t("drawer.timeline")}</SubHeading>
                  <div className="relative h-1.5 rounded-full bg-sand-300/80">
                    <span
                      className="absolute inset-y-0 start-0 rounded-full bg-gulf-400"
                      style={{ width: `${Math.round(todayPct * 100)}%` }}
                      aria-hidden
                    />
                    <span
                      className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-maroon-700"
                      style={{ insetInlineStart: `${Math.round(todayPct * 100)}%` }}
                      aria-hidden
                    />
                    {milestones.map((m) => (
                      <span
                        key={m.id}
                        className={cn(
                          "absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 border-white",
                          m.doneDate ? "bg-ok" : "bg-sand-300"
                        )}
                        style={{ insetInlineStart: `calc(${Math.round((m.pct ?? 0) * 100)}% - 5px)` }}
                        title={`${bi(locale, m.titleEn, m.titleAr)} · ${
                          m.doneDate
                            ? t("drawer.milestoneDone", {
                                date: formatDate(m.doneDate, locale, { style: "short" }),
                              })
                            : t("drawer.milestoneDue", {
                                date: formatDate(m.dueDate, locale, { style: "short" }),
                              })
                        }`}
                      />
                    ))}
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-ink-600 tnum">
                    <span>{formatDate(node.startDate, locale, { style: "short" })}</span>
                    <span>{formatDate(node.endDate, locale, { style: "short" })}</span>
                  </div>
                  {milestones.length ? (
                    <ul className="mt-2 flex flex-col gap-1">
                      {milestones.map((m) => (
                        <li key={`row-${m.id}`} className="flex items-center gap-2 text-xs text-ink-600">
                          <span
                            className={cn(
                              "inline-block size-2 shrink-0 rounded-full",
                              m.doneDate ? "bg-ok" : "bg-sand-300"
                            )}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 truncate text-ink-900">
                            {bi(locale, m.titleEn, m.titleAr)}
                          </span>
                          <span className="shrink-0 tnum">
                            {formatDate(m.doneDate ?? m.dueDate, locale, { style: "short" })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {/* budget and inputs */}
              {node.budgetQar != null ||
              detail.inputs.people != null ||
              systems.length ||
              detail.inputs.noteEn ||
              detail.inputs.noteAr ? (
                <div className="rounded-xl bg-sand-50 px-4 py-3">
                  <SubHeading>{t("levels.inputs")}</SubHeading>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-900">
                    {node.budgetQar != null ? (
                      <span className="flex items-center gap-1.5">
                        <Wallet className="size-4 text-ink-400" aria-hidden />
                        <span className="tnum">
                          {t("drawer.budgetValue", {
                            amount: formatNumber(node.budgetQar, locale, { compact: true }),
                          })}
                        </span>
                      </span>
                    ) : null}
                    {detail.inputs.people != null ? (
                      <span className="tnum">
                        {t("drawer.inputsPeople", { count: detail.inputs.people })}
                      </span>
                    ) : null}
                  </div>
                  {systems.length ? (
                    <p className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Boxes className="size-3.5 text-ink-400" aria-hidden />
                      {systems.map((s) => (
                        <Chip key={s} tone="sand">
                          {s}
                        </Chip>
                      ))}
                    </p>
                  ) : null}
                  {detail.inputs.noteEn || detail.inputs.noteAr ? (
                    <p className="mt-2 text-xs leading-relaxed text-ink-600">
                      {bi(locale, detail.inputs.noteEn ?? "", detail.inputs.noteAr ?? "")}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* indicators with their charts */}
              {detail.indicators.length ? (
                <div>
                  <SubHeading>{t("drawer.indicators")}</SubHeading>
                  <div className="flex flex-col gap-3">
                    {detail.indicators.map((indicator) => (
                      <div
                        key={indicator.id}
                        className="rounded-xl border border-sand-200 bg-white p-3"
                      >
                        <div className="flex items-start gap-2">
                          <RagMark rag={indicator.rag} className="mt-1.5" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium leading-snug text-ink-900">
                              {bi(locale, indicator.nameEn, indicator.nameAr)}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-ink-600 tnum">
                              {indicator.latest?.actual != null
                                ? formatNumber(indicator.latest.actual, locale)
                                : t("chain.noResult")}
                              {indicator.latest?.target != null
                                ? ` / ${formatNumber(indicator.latest.target, locale)}`
                                : ""}
                              {indicator.unit ? ` ${indicator.unit}` : ""}
                              {" · "}
                              {t(`indicator.cadence.${indicator.frequency}` as never)}
                            </span>
                          </span>
                          {onOpenIndicator ? (
                            <button
                              onClick={() => onOpenIndicator(indicator)}
                              className="link-draw shrink-0 cursor-pointer text-[11px] font-medium text-maroon-700"
                              aria-label={t("chain.openIndicator", {
                                name: bi(locale, indicator.nameEn, indicator.nameAr),
                              })}
                            >
                              {t("levels.indicatorCard")}
                            </button>
                          ) : null}
                        </div>
                        <div className="mt-2">
                          <IndicatorChart
                            indicator={indicator}
                            height={140}
                            labelId={`drawer-chart-${indicator.id}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* activities as a checklist */}
              <div>
                <SubHeading>{t("levels.activities")}</SubHeading>
                {detail.activities.length ? (
                  <ul className="flex flex-col gap-1">
                    {detail.activities.map((a) => {
                      const done = a.status === "completed";
                      return (
                        <li
                          key={a.id}
                          className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-sand-50"
                        >
                          {done ? (
                            <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
                          ) : (
                            <Circle className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className={cn("block leading-snug", done ? "text-ink-600" : "text-ink-900")}>
                              {bi(locale, a.titleEn, a.titleAr)}
                            </span>
                            <span className="text-[11px] text-ink-600">
                              {tc(`status.${a.status}` as never)}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="rounded-lg border border-dashed border-sand-300 bg-sand-50 px-3 py-3 text-center text-xs text-ink-600">
                    {t("drawer.noActivities")}
                  </p>
                )}
              </div>

              {/* dependencies */}
              {detail.dependencies.length ? (
                <div>
                  <SubHeading>{t("drawer.dependencies")}</SubHeading>
                  <div className="flex flex-col gap-1.5">
                    {detail.dependencies.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => onNavigate(d.nodeId)}
                        aria-label={t("drawer.openDependency", {
                          title: bi(locale, d.titleEn, d.titleAr),
                        })}
                        className="flex cursor-pointer items-start gap-2 rounded-lg border border-sand-200 px-3 py-2 text-start text-sm transition-colors hover:border-maroon-300 hover:bg-maroon-50"
                      >
                        <GitBranch className="mt-0.5 size-3.5 shrink-0 text-ink-400 flip-rtl" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium leading-snug text-ink-900">
                            {d.code ? <span className="tnum text-ink-600">{d.code} </span> : null}
                            {bi(locale, d.titleEn, d.titleAr)}
                          </span>
                          {d.noteEn || d.noteAr ? (
                            <span className="block text-xs text-ink-600">
                              {bi(locale, d.noteEn ?? "", d.noteAr ?? "")}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* deliverables as a mini shelf */}
              {shelfDocs.length ? (
                <div>
                  <SubHeading>{t("drawer.deliverables")}</SubHeading>
                  <Shelf docs={shelfDocs} height={140} className="mb-2" />
                  <div className="flex flex-col gap-1">
                    {deliverables.map((d) => (
                      <Link
                        key={d.id}
                        href={`/vault/${d.documentId}` as never}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-maroon-50"
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-maroon-100 text-[10px] font-semibold text-maroon-900 tnum">
                          {d.deliverableCode}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-ink-900">
                          {bi(locale, d.titleEn, d.titleAr)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* CR07 2.5: council projects carry the same stakeholder section
                  as the delivery projects of the national strategy */}
              {detail.stakeholders.length ? (
                <div data-testid="council-stakeholders">
                  <StakeholdersSection
                    nodeId={detail.node.id}
                    rows={detail.stakeholders}
                    canEdit={false}
                    compact
                    owners={detail.stakeholderOwners}
                    item={ownerItem}
                  />
                </div>
              ) : null}

              {/* lessons, direct first then inherited */}
              {lessons.direct.length || lessons.inherited.length ? (
                <div>
                  <SubHeading>{t("drawer.lessons")}</SubHeading>
                  {lessons.direct.length ? (
                    <div className="flex flex-col gap-1.5">
                      {lessons.direct.map((l) => (
                        <Link
                          key={l.lessonId}
                          href={`/lessons/${l.lessonId}` as never}
                          className="rounded-lg border border-sand-200 px-3 py-2 text-sm hover:border-maroon-300 hover:bg-maroon-50"
                        >
                          <span className="line-clamp-2 font-medium leading-snug text-ink-900">
                            {bi(locale, l.titleEn, l.titleAr)}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-ink-600">
                            {t("drawer.lessonsDirect")}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {lessons.inherited.length ? (
                    <div className="mt-2 flex flex-col gap-1.5">
                      <p className="text-[11px] text-ink-600">{t("drawer.lessonsInherited")}</p>
                      {lessons.inherited.map((l) => (
                        <Link
                          key={l.lessonId}
                          href={`/lessons/${l.lessonId}` as never}
                          className="rounded-lg px-3 py-1.5 text-xs text-ink-900 hover:bg-maroon-50"
                        >
                          <span className="line-clamp-1">{bi(locale, l.titleEn, l.titleAr)}</span>
                          <span className="text-[11px] text-ink-600">
                            {l.originCode ? <span className="tnum">{l.originCode} </span> : null}
                            {bi(locale, l.originEn, l.originAr)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* risks */}
              {detail.risks.length ? (
                <div>
                  <SubHeading>{t("drawer.risks")}</SubHeading>
                  <div className="flex flex-col gap-1.5">
                    {detail.risks.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-lg border border-sand-200 px-3 py-2 text-sm"
                      >
                        <p className="flex items-start gap-2">
                          <ShieldAlert
                            className={cn(
                              "mt-0.5 size-3.5 shrink-0",
                              r.likelihood * r.impact >= 12 ? "text-danger" : "text-warn"
                            )}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 font-medium leading-snug text-ink-900">
                            {r.code ? <span className="tnum text-ink-600">{r.code} </span> : null}
                            {bi(locale, r.titleEn, r.titleAr)}
                          </span>
                        </p>
                        <p className="mt-1 text-[11px] text-ink-600 tnum">
                          {t("drawer.riskScore", { likelihood: r.likelihood, impact: r.impact })}
                          {" · "}
                          {tc(`status.${r.status}` as never)}
                        </p>
                        {r.mitigationEn || r.mitigationAr ? (
                          <p className="mt-1 text-xs leading-relaxed text-ink-600">
                            <span className="font-medium">{t("drawer.mitigation")}: </span>
                            {bi(locale, r.mitigationEn ?? "", r.mitigationAr ?? "")}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* the deep link back to this project on the page */}
              <div className="flex items-center justify-end border-t border-sand-100 pt-4">
                <Link
                  href={
                    `/council-strategy?p=${encodeURIComponent(
                      node.code ? node.code.toLowerCase().replace(/\./g, "-") : node.id
                    )}` as never
                  }
                  className="link-draw inline-flex items-center gap-1 text-xs font-medium text-ink-600"
                >
                  {t("drawer.openFullPage")}
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </motion.aside>
      {/* CR08 overlay layering: the indicator card opens above the drawer, so
          the drawer dims with the page beneath it (DECISIONS 117) */}
      {dimmed ? (
        <span aria-hidden className="absolute inset-0 bg-ink-900/25 backdrop-blur-[2px]" />
      ) : null}
    </div>
  );
}
