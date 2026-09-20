"use client";
// CR03 2.3: Level 2 of the Living Strategy. Outcome hero with a watermark
// number, then targets as a two-column grid of cards with progress figures.
// Clicking a target expands it in place into side-by-side Initiatives and
// Projects lanes (one target open at a time); Enter expands, Escape collapses,
// arrow keys move between cards. No tables anywhere.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight, FileStack, Lightbulb, Link as LinkIcon } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn, bi } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { Chip, ProgressRing, RagDot, Skeleton } from "@/components/ui/primitives";
import { LeadChips } from "@/components/nexus/LeadChips";
import { OwnerControl, OwnerControlCompact } from "@/components/nexus/people/OwnerControl";
import type { ItemRef, OwnerRef } from "@/components/nexus/people/OwnerControl";
import type { NavigatorData, NavItem, NavTarget } from "@/server/services/strategy";

const EASE = [0.22, 1, 0.36, 1] as const;

/** CR08 9.1: user id -> person, resolved once on the server (navigator-server). */
export type OwnerMap = Record<string, OwnerRef>;

/** The item a person card is opened for, from a navigator item. */
export function itemRefOfNav(item: NavItem): ItemRef {
  return {
    type: item.type,
    id: item.id,
    titleEn: item.titleEn,
    titleAr: item.titleAr,
    href: `/strategy/${item.id}`,
  };
}

function timelinePct(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  return Math.max(0, Math.min(1, (Date.now() - s) / (e - s)));
}

function outcomeNumber(code: string | null): string {
  const m = code?.match(/\d+/);
  return m ? m[0] : code ?? "";
}

/* A compact delivery card inside a lane */
export function LaneCard({
  item,
  locale,
  today,
  onOpen,
  owner,
}: {
  item: NavItem;
  locale: string;
  today: string;
  /** CR04 2.4: the canvas opens a drawer instead of navigating */
  onOpen?: (item: NavItem) => void;
  /** CR08 9.1: the person who owns this initiative or project */
  owner?: OwnerRef | null;
}) {
  const t = useTranslations("strategy");
  const router = useRouter();
  const pct = timelinePct(item.startDate, item.endDate);
  /* CR08 9.1: the person chip is a button, so it sits beside the card's own
     button rather than inside it; the card frame carries the hover lift */
  return (
    <div
      className="card flex w-60 shrink-0 flex-col gap-1.5 px-3.5 py-3 transition-all duration-200 ease-[var(--ease-paper)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
      data-node-id={item.id}
    >
      <button
        onClick={() => (onOpen ? onOpen(item) : router.push(`/strategy/${item.id}` as never))}
        className="flex flex-col gap-1.5 rounded-lg text-start cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
        data-testid="lane-card"
      >
        <span className="flex items-center gap-2">
          <RagDot status={item.status} />
          {item.code ? <span className="text-[10px] text-ink-600 tnum">{item.code}</span> : null}
        </span>
        <span className="line-clamp-2 min-h-9 text-sm font-medium leading-snug text-ink-900">
          {bi(locale, item.titleEn, item.titleAr)}
        </span>
        <LeadChips leads={item.leads} />
        {pct != null ? (
          <span
            className="relative mt-0.5 block h-1 overflow-visible rounded-full bg-sand-200"
            role="img"
            aria-label={`${t("timeline")}: ${Math.round(pct * 100)}%`}
          >
            <span
              className="absolute inset-y-0 start-0 rounded-full bg-gulf-400"
              style={{ width: `${Math.round(pct * 100)}%` }}
            />
            {/* today's mark */}
            <span
              className="absolute -top-0.5 h-2 w-0.5 rounded-full bg-maroon-700"
              style={{ insetInlineStart: `${Math.round(pct * 100)}%` }}
              title={today}
            />
          </span>
        ) : null}
        {item.deliverableCount ? (
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-600 tnum">
            <FileStack className="size-3" aria-hidden />
            {t("nav.deliverablesCount", { count: item.deliverableCount })}
          </span>
        ) : null}
      </button>
      {/* mt-auto keeps the chips of a row of cards on one line */}
      {owner ? (
        <OwnerControlCompact owner={owner} item={itemRefOfNav(item)} className="mt-auto max-w-full pt-1" />
      ) : null}
    </div>
  );
}

export function Lane({
  label,
  items,
  locale,
  today,
  onOpen,
  owners,
}: {
  label: string;
  items: NavItem[];
  locale: string;
  today: string;
  onOpen?: (item: NavItem) => void;
  owners?: OwnerMap;
}) {
  const t = useTranslations("strategy");
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-2 flex items-baseline gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600">
        {label} <span className="tnum font-medium">{items.length}</span>
      </p>
      {items.length ? (
        <div className="flex gap-2.5 overflow-x-auto pb-2" style={{ overscrollBehaviorX: "contain" }}>
          {items.map((i) => (
            <LaneCard
              key={i.id}
              item={i}
              locale={locale}
              today={today}
              onOpen={onOpen}
              owner={i.ownerUserId ? owners?.[i.ownerUserId] ?? null : null}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-sand-300 bg-sand-50 px-3 py-4 text-center text-xs text-ink-600">
          {t("lanes.empty")}
        </p>
      )}
    </div>
  );
}

/* CR07 1.3: the lessons of a target and everything beneath it, grouped by the
   node each one came from, loaded when the target opens rather than with the
   page so the canvas payload stays small. */
function TargetLessons({ nodeId, locale }: { nodeId: string; locale: string }) {
  const t = useTranslations("strategy");
  const [rows, setRows] = React.useState<
    | {
        direct: { lessonId: string; titleEn: string; titleAr: string; originEn: string; originAr: string; originCode: string | null }[];
        inherited: { lessonId: string; titleEn: string; titleAr: string; originEn: string; originAr: string; originCode: string | null }[];
      }
    | null
  >(null);

  React.useEffect(() => {
    let alive = true;
    setRows(null);
    fetch("/api/v1/lessons/links", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nodeId }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (alive && j.data) setRows(j.data);
      })
      .catch(() => {
        /* the chip already said how many there are */
      });
    return () => {
      alive = false;
    };
  }, [nodeId]);

  if (!rows) {
    return (
      <div className="mt-4 flex flex-col gap-2" aria-busy>
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-64" />
      </div>
    );
  }
  const all = [...rows.direct, ...rows.inherited];
  if (!all.length) return null;
  // group by the node the lesson is actually linked to
  const groups = new Map<string, { label: string; lessons: typeof all }>();
  for (const row of all) {
    const label = `${row.originCode ? `${row.originCode} ` : ""}${bi(locale, row.originEn, row.originAr)}`;
    const group = groups.get(label) ?? { label, lessons: [] };
    group.lessons.push(row);
    groups.set(label, group);
  }

  return (
    <div className="mt-4 border-t border-sand-100 pt-3" data-testid="target-lessons">
      <p
        className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600"
        style={{ fontFamily: "inherit" }}
      >
        {t("lessonsRollup", { count: all.length })}
      </p>
      <div className="flex flex-col gap-2.5">
        {[...groups.values()].map((group) => (
          <div key={group.label}>
            <p className="mb-1 truncate text-[11px] text-ink-400">{group.label}</p>
            <ul className="flex flex-col gap-1">
              {group.lessons.map((row) => (
                <li key={row.lessonId}>
                  <Link
                    href={`/lessons?lesson=${row.lessonId}` as never}
                    className="flex items-center gap-1.5 truncate text-xs text-ink-900 hover:text-maroon-700"
                  >
                    <Lightbulb className="size-3 shrink-0 text-gold-500" aria-hidden />
                    <span className="truncate">{bi(locale, row.titleEn, row.titleAr)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TargetCard({
  target,
  items,
  expanded,
  onToggle,
  editionCode,
  outcomeSlug,
  locale,
  today,
  onOpenItem,
  copyLink,
  lessonCount,
  owners,
}: {
  target: NavTarget;
  items: NavItem[];
  expanded: boolean;
  onToggle: () => void;
  editionCode: string;
  outcomeSlug: string;
  locale: string;
  today: string;
  onOpenItem?: (item: NavItem) => void;
  /** CR04 2.5: copy the deep link for this target */
  copyLink?: () => void;
  /** CR07 1.3: lessons linked here and beneath */
  lessonCount?: { direct: number; inherited: number; total: number } | null;
  /** CR08 9.1: the people who own the items in the lanes */
  owners?: OwnerMap;
}) {
  const t = useTranslations("strategy");
  const reduced = useReducedMotion();
  const kpi = target.kpi;
  const downGood = kpi?.direction === "down_good";
  let ratio: number | null = null;
  if (kpi?.latest != null && kpi.target) {
    ratio = downGood
      ? Math.max(0, Math.min(1, kpi.target / Math.max(kpi.latest, 1e-9)))
      : Math.max(0, Math.min(1, kpi.latest / kpi.target));
  }
  const initiatives = items.filter((i) => i.type === "initiative");
  const projects = items.filter((i) => i.type === "project");

  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-paper)] transition-shadow duration-200",
        "hover:shadow-[var(--shadow-lift)]",
        expanded && "col-span-full border-s-2 border-maroon-100"
      )}
      data-testid="target-card"
      data-expanded={expanded}
    >
      <button
        data-target-row
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Escape" && expanded) {
            e.preventDefault();
            onToggle();
          }
        }}
        aria-expanded={expanded}
        aria-label={t("targetCard.expandAria", {
          title: `${target.code ?? ""} ${bi(locale, target.titleEn, target.titleAr)}`,
        })}
        className="block w-full px-5 py-4 text-start outline-none cursor-pointer rounded-[var(--radius-card)]"
      >
        <span className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600 tnum"
            style={{ fontFamily: "inherit" }}
          >
            {target.code}
          </span>
          <RagDot status={target.status} />
          <span className="ms-auto flex items-center gap-1.5">
            <Chip tone="sand">{t("hero.initiatives", { count: initiatives.length })}</Chip>
            <Chip tone="sand">{t("hero.projects", { count: projects.length })}</Chip>
            {/* CR07 1.3: the lessons of this target and everything beneath it */}
            {lessonCount?.total ? (
              <Chip tone="gold" data-testid="target-lessons-chip">
                {t("lessonsRollup", { count: lessonCount.total })}
              </Chip>
            ) : null}
          </span>
        </span>
        <span className="mt-1.5 block text-[15px] font-medium leading-snug text-ink-900">
          {bi(locale, target.titleEn, target.titleAr)}
        </span>

        {/* the progress figure block */}
        {kpi && ratio != null ? (
          <span className="mt-3 block">
            <span className="flex items-baseline gap-2">
              <span className="text-[32px] font-semibold leading-none text-maroon-900 tnum">
                {formatNumber(kpi.latest ?? 0, locale, { compact: true })}
              </span>
              <span className="text-sm text-ink-400 tnum">
                / {formatNumber(kpi.target ?? 0, locale, { compact: true })}
                {kpi.unit ? ` ${kpi.unit}` : ""}
              </span>
              {kpi.period ? (
                <span className="ms-auto text-[11px] text-ink-600 tnum">{kpi.period}</span>
              ) : null}
            </span>
            <span
              className="relative mt-2 block h-1.5 rounded-full bg-sand-200"
              role="img"
              aria-label={`${kpi.nameEn}: ${kpi.latest} / ${kpi.target} ${kpi.unit ?? ""}`}
            >
              <span
                className="absolute inset-y-0 start-0 rounded-full bg-maroon-700"
                style={{ width: `${Math.round(ratio * 100)}%` }}
              />
              {/* gold tick at the target */}
              <span
                className="absolute -top-[3px] h-3 w-[3px] rounded-full bg-gold-500"
                style={{ insetInlineStart: "calc(100% - 2px)" }}
                aria-hidden
              />
            </span>
            <span className="mt-1 block truncate text-[11px] text-ink-600">{bi(locale, kpi.nameEn, kpi.nameAr)}</span>
          </span>
        ) : (
          <span className="mt-3 block">
            <span className="block text-xs text-ink-600">{t("targetCard.noKpi")}</span>
            {/* the delivery pulse instead: one dot per initiative or project */}
            {items.length ? (
              <span className="mt-2 flex items-center gap-1.5" aria-hidden>
                {items.slice(0, 12).map((i) => (
                  <RagDot key={i.id} status={i.status} className="h-2.5 w-2.5" />
                ))}
              </span>
            ) : null}
          </span>
        )}
      </button>

      {/* in-place expansion: the two lanes (CR03 2.3) */}
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="lanes"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-sand-100 px-5 py-4">
              <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
                <Lane label={t("lanes.initiatives")} items={initiatives} locale={locale} today={today} onOpen={onOpenItem} owners={owners} />
                <Lane label={t("lanes.projects")} items={projects} locale={locale} today={today} onOpen={onOpenItem} owners={owners} />
              </div>
              {/* CR07 1.3: the rolled-up lessons, grouped by where they came from */}
              {lessonCount?.total ? <TargetLessons nodeId={target.id} locale={locale} /> : null}
              <div className="mt-2 flex items-center justify-end gap-3">
                {copyLink ? (
                  <button
                    onClick={copyLink}
                    className="link-draw inline-flex items-center gap-1 text-xs font-medium text-ink-600 cursor-pointer"
                    data-testid="copy-target-link"
                  >
                    <LinkIcon className="size-3" /> {t("canvas.copyLink")}
                  </button>
                ) : null}
                <Link
                  href={`/strategy/${editionCode}/${outcomeSlug}/${target.slug}` as never}
                  className="link-draw inline-flex items-center gap-1 text-sm font-medium text-maroon-700"
                  data-testid="open-target"
                >
                  {t("targetCard.open")} <ArrowRight className="size-3.5 flip-rtl" />
                </Link>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function OutcomeTargets({
  data,
  outcomeId,
  owners,
}: {
  data: NavigatorData;
  outcomeId: string;
  /** CR08 9.1: resolved people for this outcome and its items */
  owners?: OwnerMap;
}) {
  const t = useTranslations("strategy");
  const locale = useLocale();
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);

  const outcome = data.outcomes.find((o) => o.id === outcomeId)!;
  const targets = data.targets
    .filter((tg) => tg.outcomeId === outcomeId)
    .sort((a, b) => a.sort - b.sort);
  const itemsByTarget = new Map<string, NavItem[]>();
  for (const i of data.items) {
    if (i.targetId) {
      (itemsByTarget.get(i.targetId) ?? itemsByTarget.set(i.targetId, []).get(i.targetId)!).push(i);
    }
  }
  const directItems = data.items.filter((i) => i.outcomeId === outcomeId && i.targetId === null);
  const today = new Date().toISOString().slice(0, 10);
  const pct = Math.round(Math.min(1, Math.max(0, outcome.progress)) * 100);
  const outcomeOwner = outcome.ownerUserId ? owners?.[outcome.ownerUserId] ?? null : null;

  /* CR03 2.3 keyboard: arrows move between target cards */
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const active = document.activeElement as HTMLElement | null;
    if (!active?.hasAttribute("data-target-row")) return;
    const rows = [...(gridRef.current?.querySelectorAll<HTMLElement>("[data-target-row]") ?? [])];
    const idx = rows.indexOf(active);
    if (idx < 0) return;
    const isRtl = locale === "ar";
    const nextKey = isRtl ? "ArrowLeft" : "ArrowRight";
    const delta = e.key === "ArrowDown" || e.key === nextKey ? 1 : -1;
    const next = rows[idx + delta];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  }

  return (
    <div>
      {/* breadcrumb above the hero (CR03 2.5) */}
      <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-sm" aria-label={t("title")}>
        <Link
          href={`/strategy/${data.edition.code}` as never}
          className="link-draw flex items-center gap-1 font-medium text-maroon-700"
        >
          <ArrowLeft className="size-3.5 flip-rtl" /> {t("hero.back")}
        </Link>
        <span className="text-ink-400">/</span>
        <Chip tone="sand">{data.edition.code.toUpperCase()}</Chip>
        <span className="max-w-72 truncate text-ink-600">
          {outcome.code} · {bi(locale, outcome.titleEn, outcome.titleAr)}
        </span>
      </nav>

      {/* the outcome hero (CR03 2.3) */}
      <header
        className="relative overflow-hidden rounded-2xl bg-sand-100 px-7 py-6"
        data-testid="outcome-hero"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 start-4 select-none font-semibold text-maroon-100"
          style={{ fontFamily: "var(--font-display)", fontSize: 96, lineHeight: 1 }}
        >
          {outcomeNumber(outcome.code)}
        </span>
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="min-w-0 max-w-2xl flex-1">
            <h1 style={{ fontSize: 40, lineHeight: 1.15 }}>{bi(locale, outcome.titleEn, outcome.titleAr)}</h1>
            {(outcome.descriptionEn || outcome.descriptionAr) ? (
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                {bi(locale, outcome.descriptionEn ?? "", outcome.descriptionAr ?? "")}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <LeadChips leads={outcome.leads} max={3} />
              <Chip tone="maroon">{t("hero.targets", { count: outcome.targetCount })}</Chip>
              <Chip tone="sand">{t("hero.initiatives", { count: outcome.initiativeCount })}</Chip>
              <Chip tone="sand">{t("hero.projects", { count: outcome.projectCount })}</Chip>
            </div>
          </div>
          {/* CR08 9.1: the owner sits at the end side of the header */}
          {outcomeOwner ? (
            <OwnerControl
              owner={outcomeOwner}
              role="owner"
              item={{
                type: "outcome",
                id: outcome.id,
                titleEn: outcome.titleEn,
                titleAr: outcome.titleAr,
                href: `/strategy/${outcome.id}`,
              }}
              className="shrink-0"
            />
          ) : null}
          <ProgressRing
            value={outcome.progress}
            size={120}
            stroke={9}
            className="shrink-0"
            aria-label={t("hero.progressAria", { pct })}
          >
            <span className="text-center">
              <span className="block text-xl font-semibold text-maroon-900 tnum">{pct}%</span>
            </span>
          </ProgressRing>
        </div>
      </header>

      {/* target cards, two columns, one expands at a time (CR03 2.3) */}
      {targets.length ? (
        <div
          ref={gridRef}
          onKeyDown={onKeyDown}
          className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2"
          data-testid="target-grid"
        >
          {targets.map((tg) => (
            <TargetCard
              key={tg.id}
              target={tg}
              items={itemsByTarget.get(tg.id) ?? []}
              expanded={expandedId === tg.id}
              onToggle={() => setExpandedId((prev) => (prev === tg.id ? null : tg.id))}
              editionCode={data.edition.code}
              outcomeSlug={outcome.slug}
              locale={locale}
              today={today}
              owners={owners}
            />
          ))}
        </div>
      ) : null}

      {/* outcome-level initiatives (and archives without targets) */}
      {directItems.length ? (
        <section className="mt-8">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600" style={{ fontFamily: "inherit" }}>
            {t("outcomeLevelLane")}
          </p>
          <div className="flex gap-2.5 overflow-x-auto pb-2">
            {directItems.map((i) => (
              <LaneCard
                key={i.id}
                item={i}
                locale={locale}
                today={today}
                owner={i.ownerUserId ? owners?.[i.ownerUserId] ?? null : null}
              />
            ))}
          </div>
        </section>
      ) : null}

      <p className="mt-5 hidden text-[11px] text-ink-600 lg:block">{t("targetCard.keyboard")}</p>
    </div>
  );
}
