"use client";
// CR08 10.1: the horizontal process map. The eight Level 0 processes as cards
// chained with arrow connectors (the heads flip in RTL), one row that fits at
// 1280px and scrolls under a fade mask below it. Clicking a card expands its
// Level 1 processes in place beneath the chain: the panel is handed in by the
// page and a tapered pointer slides to the selected card, the way the
// Council's goal panel does. Arrow keys move between the cards, Enter
// expands, Escape closes what is open.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ChevronLeft, ChevronRight, MousePointerClick, Workflow } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn, bi } from "@/lib/utils";
import { EmptyState } from "@/components/ui/primitives";
import type { ProcessMapNode } from "@/server/services/operating-model";
import { EASE, UnitChip, displayFont } from "./shared";

function Connector() {
  const t = useTranslations("processes");
  return (
    <span className="flex w-7 shrink-0 items-center justify-center xl:w-8" role="presentation" data-testid="process-connector">
      <span className="sr-only">{t("map.connector")}</span>
      <svg width="30" height="12" viewBox="0 0 30 12" aria-hidden className="flip-rtl block text-navy-300">
        <line x1="1" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M20 1.5 L28 6 L20 10.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Level0Card({
  node,
  index,
  selected,
  onToggle,
}: {
  node: ProcessMapNode;
  index: number;
  selected: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("processes");
  const locale = useLocale();
  const name = bi(locale, node.nameEn, node.nameAr);
  const docs = node.counts.policies + node.counts.sops;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={selected}
      aria-label={selected ? t("map.collapse", { code: node.code, title: name }) : t("map.expand", { code: node.code, title: name })}
      title={name}
      data-process-level="0"
      data-testid="process-l0-card"
      data-code={node.code}
      data-selected={selected || undefined}
      className={cn(
        /* eight cards share the row at xl: the padding tightens so a long word
           still fits a line */
        "flex h-full w-full cursor-pointer flex-col rounded-[var(--radius-card)] border px-3.5 py-3 text-start shadow-[var(--shadow-paper)] outline-none transition-all duration-200 ease-[var(--ease-paper)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500 xl:px-2.5",
        selected ? "border-navy-500 bg-navy-50" : "border-transparent bg-white"
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy-700 tnum rtl:tracking-normal">{node.code}</span>
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold tnum",
            selected ? "bg-navy-700 text-white" : "bg-navy-100 text-navy-900"
          )}
          style={{ fontFamily: "var(--font-display)" }}
          aria-hidden
        >
          {index + 1}
        </span>
      </span>
      {/* hyphens and break-words: "development" is wider than a card at eight
          across, and a clamped line must not chop a word mid-stroke */}
      <span
        className="mt-2 line-clamp-3 min-h-[3.75em] hyphens-auto break-words text-[15px] font-medium leading-snug text-ink-900 xl:line-clamp-4 xl:text-[13px]"
        style={{ fontFamily: displayFont(locale) }}
      >
        {name}
      </span>
      <span className="mt-auto flex flex-col gap-1.5 pt-3">
        {node.ownerUnit ? (
          <UnitChip unit={node.ownerUnit} link={false} className="self-start" />
        ) : (
          <span className="text-[11px] text-ink-400">{t("map.noOwner")}</span>
        )}
        <span className="text-[11px] leading-snug text-ink-600 tnum">
          {t("map.childCount", { count: node.counts.children })}
          <span className="text-ink-400"> · </span>
          {t("map.procedureCount", { count: node.counts.procedures })}
        </span>
        {/* the counts wrap rather than truncate: a card is 176px wide and
            "no documents, no interfaces" never fits on one line */}
        <span className="flex items-start gap-1 text-[11px] leading-snug text-ink-400 tnum">
          <span className="min-w-0 flex-1">
            <span className="block">{t("map.docCount", { count: docs })}</span>
            <span className="block">{t("map.interfaceCount", { count: node.counts.interfaces })}</span>
          </span>
          <ChevronDown className={cn("mt-px size-3.5 shrink-0 transition-transform", selected && "rotate-180")} aria-hidden />
        </span>
      </span>
    </button>
  );
}

export function ProcessMap({
  chain,
  selectedCode,
  onToggle,
  onEscape,
  panel,
  panelKey,
  anchorRef,
}: {
  chain: ProcessMapNode[];
  selectedCode: string | null;
  onToggle: (node: ProcessMapNode) => void;
  /** Escape on a card: close the open panel, else collapse the chain */
  onEscape: () => void;
  /** the Level 1 panel of the selected process, rendered beneath the chain */
  panel: React.ReactNode;
  panelKey: string | null;
  anchorRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations("processes");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const rowRef = React.useRef<HTMLDivElement>(null);
  const localAnchor = React.useRef<HTMLDivElement>(null);
  const anchor = anchorRef ?? localAnchor;
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const [overflow, setOverflow] = React.useState<{ start: boolean; end: boolean }>({ start: false, end: false });
  const [pointerX, setPointerX] = React.useState<number | null>(null);
  const selectedIndex = selectedCode ? chain.findIndex((n) => n.code === selectedCode) : -1;

  const measureOverflow = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) {
      setOverflow({ start: false, end: false });
      return;
    }
    const pos = Math.abs(el.scrollLeft);
    setOverflow({ start: pos > 4, end: pos < max - 4 });
  }, []);

  const measurePointer = React.useCallback(() => {
    if (selectedIndex < 0) {
      setPointerX(null);
      return;
    }
    const card = cardRefs.current[selectedIndex];
    const a = anchor.current;
    if (!card || !a) return;
    const cr = card.getBoundingClientRect();
    const ar = a.getBoundingClientRect();
    setPointerX(cr.left + cr.width / 2 - ar.left);
  }, [selectedIndex, anchor]);

  React.useEffect(() => {
    measureOverflow();
    measurePointer();
    const el = scrollRef.current;
    const onResize = () => {
      measureOverflow();
      measurePointer();
    };
    window.addEventListener("resize", onResize);
    const ro = el ? new ResizeObserver(onResize) : null;
    if (el && ro) ro.observe(el);
    const timer = setTimeout(measurePointer, 340);
    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      clearTimeout(timer);
    };
  }, [measureOverflow, measurePointer, chain.length]);

  /* a selected card scrolled out of the row comes back into view */
  React.useEffect(() => {
    if (selectedIndex < 0) return;
    const card = cardRefs.current[selectedIndex];
    const el = scrollRef.current;
    if (!card || !el || el.scrollWidth - el.clientWidth <= 4) return;
    card.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest", inline: "center" });
  }, [selectedIndex, reduced]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const sign = locale === "ar" ? -dir : dir;
    el.scrollBy({ left: sign * Math.round(el.clientWidth * 0.7), behavior: reduced ? "auto" : "smooth" });
  };

  /* keyboard: arrows between the Level 0 cards, Home and End, Escape closes */
  function onKeyDown(e: React.KeyboardEvent) {
    const active = document.activeElement as HTMLElement | null;
    if (active?.getAttribute("data-process-level") !== "0") return;
    if (e.key === "Escape") {
      e.preventDefault();
      onEscape();
      return;
    }
    const cards = [...(rowRef.current?.querySelectorAll<HTMLElement>('[data-process-level="0"]') ?? [])];
    const index = cards.indexOf(active as HTMLElement);
    if (index < 0) return;
    const forwardKey = locale === "ar" ? "ArrowLeft" : "ArrowRight";
    const backKey = locale === "ar" ? "ArrowRight" : "ArrowLeft";
    let next: HTMLElement | undefined;
    if (e.key === forwardKey || e.key === "ArrowDown") next = cards[index + 1];
    else if (e.key === backKey || e.key === "ArrowUp") next = cards[index - 1];
    else if (e.key === "Home") next = cards[0];
    else if (e.key === "End") next = cards[cards.length - 1];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  }

  if (!chain.length) {
    return (
      <EmptyState icon={<Workflow />} title={t("map.empty")} hint={t("map.emptyHint")} className="mt-2" />
    );
  }

  return (
    <section aria-label={t("map.aria")} data-testid="process-map" className="group/map">
      <div className="relative">
        {overflow.start ? (
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label={t("map.scrollBack")}
            className="absolute start-1 top-1/2 z-20 -translate-y-1/2 cursor-pointer rounded-full border border-mist-300 bg-white/95 p-1.5 text-ink-600 shadow-sm transition-opacity hover:text-navy-700 focus-visible:outline-2 focus-visible:outline-aqua-500"
          >
            <ChevronLeft className="size-4 flip-rtl" />
          </button>
        ) : null}
        {overflow.end ? (
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label={t("map.scrollForward")}
            className="absolute end-1 top-1/2 z-20 -translate-y-1/2 cursor-pointer rounded-full border border-mist-300 bg-white/95 p-1.5 text-ink-600 shadow-sm transition-opacity hover:text-navy-700 focus-visible:outline-2 focus-visible:outline-aqua-500"
          >
            <ChevronRight className="size-4 flip-rtl" />
          </button>
        ) : null}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 start-0 z-10 w-12 bg-gradient-to-r from-mist-50 to-transparent transition-opacity rtl:bg-gradient-to-l",
            overflow.start ? "opacity-100" : "opacity-0"
          )}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 end-0 z-10 w-12 bg-gradient-to-l from-mist-50 to-transparent transition-opacity rtl:bg-gradient-to-r",
            overflow.end ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          ref={scrollRef}
          onScroll={measureOverflow}
          /* relative: the connectors' screen reader words are absolutely
             positioned, and without a containing block here they escape this
             scroller and stretch the page at phone widths */
          className="relative -mx-1 overflow-x-auto overflow-y-hidden px-1 pb-2 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ overscrollBehaviorX: "contain" }}
          data-testid="process-map-scroll"
        >
          <div
            ref={rowRef}
            role="list"
            onKeyDown={onKeyDown}
            className="flex min-w-max items-stretch xl:min-w-0"
          >
            {chain.map((node, i) => (
              <React.Fragment key={node.id}>
                {i > 0 ? <Connector /> : null}
                <div
                  role="listitem"
                  ref={(el) => {
                    cardRefs.current[i] = el;
                  }}
                  className="w-[176px] shrink-0 xl:w-auto xl:min-w-0 xl:flex-1"
                >
                  <Level0Card node={node} index={i} selected={selectedCode === node.code} onToggle={() => onToggle(node)} />
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-1 hidden text-[11px] text-ink-600 lg:block">{t("map.keyboard")}</p>

      {/* the panel beneath the chain, with the pointer tail */}
      <div ref={anchor} className="relative mt-5 scroll-mt-24" data-testid="process-map-anchor">
        {selectedIndex >= 0 && pointerX !== null ? (
          <span
            aria-hidden
            className="absolute -top-2.5 z-10 hidden xl:block"
            style={{ left: pointerX - 12, transition: reduced ? undefined : "left 300ms var(--ease-paper)" }}
          >
            <span
              className="block size-6 rotate-45 rounded-[3px] bg-mist-100"
              style={{ borderTop: "1px solid var(--color-mist-300)", borderLeft: "1px solid var(--color-mist-300)" }}
            />
          </span>
        ) : null}
        {/* the resting state: the chain alone would leave the page half empty,
            and the invitation belongs where the Level 1 panel will open */}
        {!panel ? (
          <EmptyState
            icon={<MousePointerClick />}
            title={t("map.restTitle")}
            hint={t("map.restHint")}
            className="bg-mist-100/70 py-14"
          />
        ) : null}
        <AnimatePresence initial={false}>
          {panel ? (
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
                  key={panelKey ?? "none"}
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduced ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {panel}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      {selectedIndex >= 0 ? (
        <span className="sr-only" aria-live="polite">
          {t("map.collapse", { code: chain[selectedIndex].code, title: bi(locale, chain[selectedIndex].nameEn, chain[selectedIndex].nameAr) })}
        </span>
      ) : null}
    </section>
  );
}
