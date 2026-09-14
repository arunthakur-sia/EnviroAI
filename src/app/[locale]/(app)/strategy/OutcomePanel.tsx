"use client";
// CR04 2.3: the outcome panel that opens beneath the arc. Header with the
// watermark numeral and pillar chips, Read the chapter (AI summary first,
// then the page-cited full text from the NDS3 document), headline KPI tiles,
// the target cards with in-place lanes, the CR06 Outcome stakeholders
// section, and the signals link.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BookOpen, ChevronDown, ExternalLink, Link as LinkIcon, Radar, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn, bi } from "@/lib/utils";
import { Chip, ProgressRing, Skeleton } from "@/components/ui/primitives";
import { LeadChips } from "@/components/nexus/LeadChips";
import { IndicatorTile } from "@/components/nexus/IndicatorTile";
import { useToast } from "@/components/ui/toast";
import type { NavigatorData, NavItem, CanvasExtras } from "@/server/services/strategy";
import { TargetCard } from "./OutcomeTargets";
import { OutcomeStakeholdersSection } from "./OutcomeStakeholders";

function outcomeNumber(code: string | null): string {
  const m = code?.match(/\d+/);
  return m ? m[0] : code ?? "";
}

type ChapterText = {
  documentId: string;
  pages: { page: number; text: string }[];
};

const chapterCache = new Map<string, ChapterText>();

export async function prefetchChapter(outcomeCode: string, locale: string): Promise<void> {
  const key = `${outcomeCode}:${locale}`;
  if (chapterCache.has(key)) return;
  try {
    const res = await fetch(
      `/api/v1/strategy/chapter?outcome=${encodeURIComponent(outcomeCode)}&locale=${locale}`
    );
    const json = await res.json();
    if (res.ok && json.data) chapterCache.set(key, json.data as ChapterText);
  } catch {
    /* fetched again on demand */
  }
}

export function OutcomePanel({
  data,
  extras,
  outcomeId,
  expandedTarget,
  onToggleTarget,
  onOpenItem,
  onCopyLink,
  onCopyTargetLink,
  onClose,
  pillarsOf,
  canEdit,
  leadFilter,
  onLeadFilter,
}: {
  data: NavigatorData;
  extras: CanvasExtras;
  outcomeId: string;
  expandedTarget: string | null;
  onToggleTarget: (targetId: string | null) => void;
  onOpenItem: (item: NavItem) => void;
  onCopyLink: () => void;
  onCopyTargetLink: (targetSlug: string) => void;
  onClose: () => void;
  pillarsOf: (outcomeNumber: number) => string[];
  /* CR06: the Outcome stakeholders section */
  canEdit: boolean;
  leadFilter: string | null;
  onLeadFilter: (lead: string | null) => void;
}) {
  const t = useTranslations("strategy");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const { toast } = useToast();
  const outcome = data.outcomes.find((o) => o.id === outcomeId)!;
  const code = outcome.code ?? "";
  const [chapterOpen, setChapterOpen] = React.useState(false);
  const [fullText, setFullText] = React.useState(false);
  const [chapter, setChapter] = React.useState<ChapterText | null>(
    chapterCache.get(`${code}:${locale}`) ?? null
  );

  React.useEffect(() => {
    setChapterOpen(false);
    setFullText(false);
    setChapter(chapterCache.get(`${code}:${locale}`) ?? null);
  }, [code, locale]);

  React.useEffect(() => {
    if (!fullText || chapter) return;
    let alive = true;
    prefetchChapter(code, locale).then(() => {
      if (alive) setChapter(chapterCache.get(`${code}:${locale}`) ?? null);
    });
    return () => {
      alive = false;
    };
  }, [fullText, chapter, code, locale]);

  const info = extras.chapters[code];
  const targets = data.targets.filter((tg) => tg.outcomeId === outcomeId).sort((a, b) => a.sort - b.sort);
  const itemsByTarget = new Map<string, NavItem[]>();
  for (const i of data.items) {
    if (i.targetId) {
      (itemsByTarget.get(i.targetId) ?? itemsByTarget.set(i.targetId, []).get(i.targetId)!).push(i);
    }
  }
  const directItems = data.items.filter((i) => i.outcomeId === outcomeId && i.targetId === null);
  const today = new Date().toISOString().slice(0, 10);
  const pct = Math.round(Math.min(1, Math.max(0, outcome.progress)) * 100);
  const tiles = extras.kpiTiles[code] ?? [];
  const stakeholders = extras.outcomeStakeholders[code] ?? null;
  const signalsCount = extras.signalsCount[code] ?? 0;
  const tax = extras.outcomeTax[code];
  const pillarKeys = pillarsOf(Number(outcomeNumber(outcome.code)) || 0);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-sand-100" data-testid="outcome-panel">
      <span
        aria-hidden
        className="pointer-events-none absolute top-1 start-4 select-none font-semibold text-maroon-100"
        style={{ fontFamily: "var(--font-display)", fontSize: 96, lineHeight: 1 }}
      >
        {outcomeNumber(outcome.code)}
      </span>

      <div className="relative px-7 py-6">
        {/* 1. header */}
        <div className="flex flex-wrap items-start gap-6">
          <div className="min-w-0 max-w-2xl flex-1">
            <h2 style={{ fontSize: 32, lineHeight: 1.15 }}>{bi(locale, outcome.titleEn, outcome.titleAr)}</h2>
            {(outcome.descriptionEn || outcome.descriptionAr) ? (
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                {bi(locale, outcome.descriptionEn ?? "", outcome.descriptionAr ?? "")}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {pillarKeys.map((p) => (
                <Chip key={p} tone="gold">{t(`canvas.pillars.${p}` as never)}</Chip>
              ))}
              <LeadChips leads={outcome.leads} max={3} />
              <Chip tone="maroon">{t("hero.targets", { count: outcome.targetCount })}</Chip>
              <Chip tone="sand">{t("hero.initiatives", { count: outcome.initiativeCount })}</Chip>
              <Chip tone="sand">{t("hero.projects", { count: outcome.projectCount })}</Chip>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ProgressRing value={outcome.progress} size={120} stroke={9} aria-label={t("hero.progressAria", { pct })}>
              <span className="text-xl font-semibold text-maroon-900 tnum">{pct}%</span>
            </ProgressRing>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => {
                  onCopyLink();
                  toast(t("canvas.linkCopied"), "success");
                }}
                aria-label={t("canvas.copyLink")}
                className="rounded-lg p-1.5 text-ink-600 hover:bg-white/70 cursor-pointer"
              >
                <LinkIcon className="size-4" />
              </button>
              <Link
                href={`/strategy/${outcome.id}` as never}
                aria-label={t("canvas.openFullPage")}
                className="rounded-lg p-1.5 text-ink-600 hover:bg-white/70"
              >
                <ExternalLink className="size-4" />
              </Link>
              <button
                onClick={onClose}
                aria-label={t("canvas.closePanel")}
                className="rounded-lg p-1.5 text-ink-600 hover:bg-white/70 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 2. Read the chapter */}
        <div className="mt-5 rounded-xl bg-white p-4 shadow-[var(--shadow-paper)]" data-testid="read-chapter">
          <button
            onClick={() => setChapterOpen((v) => !v)}
            aria-expanded={chapterOpen}
            className="flex w-full items-center gap-2 text-start cursor-pointer"
          >
            <BookOpen className="size-4 shrink-0 text-maroon-700" />
            <span className="text-sm font-medium text-ink-900">{t("canvas.readChapter")}</span>
            <ChevronDown
              className={cn("ms-auto size-4 text-ink-400 transition-transform", chapterOpen && "rotate-180")}
              aria-hidden
            />
          </button>
          <AnimatePresence initial={false}>
            {chapterOpen ? (
              <motion.div
                initial={reduced ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={reduced ? undefined : { height: 0, opacity: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="pt-3">
                  {info ? (
                    <>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600" style={{ fontFamily: "inherit" }}>
                        {t("canvas.chapterSummaryLabel")}
                      </p>
                      <p className="text-sm leading-relaxed text-ink-900">
                        {bi(locale, info.summaryEn, info.summaryAr || info.summaryEn)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => setFullText((v) => !v)}
                          className="link-draw text-xs font-medium text-maroon-700 cursor-pointer"
                          data-testid="show-full-text"
                        >
                          {fullText ? t("canvas.hideFullText") : t("canvas.showFullText")}
                        </button>
                        <Link
                          href={`/vault/${locale === "ar" && info.documentIdAr ? info.documentIdAr : info.documentId}` as never}
                          className="link-draw text-xs font-medium text-ink-600"
                        >
                          {t("canvas.openInVault")}
                        </Link>
                      </div>
                      {fullText ? (
                        chapter ? (
                          <div className="mt-3 flex max-h-96 flex-col gap-4 overflow-y-auto rounded-lg bg-sand-50 p-4">
                            {chapter.pages.map((p) => (
                              <div key={p.page}>
                                <Link
                                  href={`/vault/${chapter.documentId}?page=${p.page}` as never}
                                  className="mb-1 inline-flex items-center rounded-md bg-maroon-100 px-2 py-0.5 text-[10px] font-medium text-maroon-900 hover:bg-maroon-700 hover:text-white tnum"
                                >
                                  {t("canvas.pageChip", { page: p.page })}
                                </Link>
                                <p className="whitespace-pre-line text-sm leading-relaxed text-ink-900">
                                  {p.text}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 flex flex-col gap-2" aria-busy>
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-5/6" />
                            <Skeleton className="h-4 w-2/3" />
                          </div>
                        )
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-ink-600">{t("canvas.chapterEmpty")}</p>
                  )}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* 3. headline KPI tiles */}
        {tiles.length ? (
          <div className="mt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600" style={{ fontFamily: "inherit" }}>
              {t("canvas.headlineKpis")}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {tiles.map((tile) => (
                <IndicatorTile
                  key={tile.id}
                  tile={{ ...tile, illustrative: false }}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* 4. targets with in-place lanes (CR03 cards) */}
        {targets.length ? (
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="panel-targets">
            {targets.map((tg) => (
              <TargetCard
                key={tg.id}
                target={tg}
                items={itemsByTarget.get(tg.id) ?? []}
                expanded={expandedTarget === tg.id}
                onToggle={() => onToggleTarget(expandedTarget === tg.id ? null : tg.id)}
                editionCode={data.edition.code}
                outcomeSlug={outcome.slug}
                locale={locale}
                today={today}
                onOpenItem={onOpenItem}
                copyLink={() => {
                  onCopyTargetLink(tg.slug);
                  toast(t("canvas.linkCopied"), "success");
                }}
              />
            ))}
          </div>
        ) : null}
        {directItems.length ? (
          <div className="mt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600" style={{ fontFamily: "inherit" }}>
              {t("outcomeLevelLane")}
            </p>
            <div className="flex gap-2.5 overflow-x-auto pb-2">
              {directItems.map((i) => (
                <button
                  key={i.id}
                  onClick={() => onOpenItem(i)}
                  data-node-id={i.id}
                  className="card flex w-60 shrink-0 flex-col gap-1.5 px-3.5 py-3 text-start transition-all duration-200 ease-[var(--ease-paper)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] cursor-pointer"
                >
                  <span className="flex items-center gap-2 text-[10px] text-ink-600 tnum">{i.code}</span>
                  <span className="line-clamp-2 text-sm font-medium leading-snug text-ink-900">
                    {bi(locale, i.titleEn, i.titleAr)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* 5. the Outcome stakeholders section (CR06, replaces the expert chips) */}
        {stakeholders ? (
          <OutcomeStakeholdersSection
            outcomeId={outcome.id}
            data={stakeholders}
            canEdit={canEdit}
            leadFilter={leadFilter}
            onLeadFilter={onLeadFilter}
          />
        ) : null}

        {/* 6. the signals link */}
        {signalsCount && tax ? (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link
              href={`/trends?outcome=${tax}` as never}
              className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-gulf-600 shadow-sm hover:text-gulf-600/80 tnum"
              data-testid="panel-signals-link"
            >
              <Radar className="size-3.5" /> {t("canvas.signalsFor", { count: signalsCount })}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
