"use client";
// CR08 3: internal experts grouped by organisation unit, in organisation
// order, each group collapsible (260ms height animation) with the collapse
// state remembered per user; ?layout=flat shows the plain grid instead.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, FoldVertical, UnfoldVertical } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { Stagger } from "@/components/motion";
import { ExpertCard } from "@/components/nexus/ExpertCard";
import type { ExpertCardData, InternalGroup } from "@/server/services/experts";

const EASE = [0.22, 1, 0.36, 1] as const;
const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export function InternalBoard({
  groups,
  experts,
  layout,
  initialOpen,
}: {
  groups: InternalGroup[];
  experts: ExpertCardData[];
  layout: "grouped" | "flat";
  initialOpen: Record<string, boolean>;
}) {
  const t = useTranslations("experts");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [open, setOpen] = React.useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {};
    for (const g of groups) state[g.key] = initialOpen[g.key] ?? true;
    return state;
  });
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = React.useCallback((next: Record<string, boolean>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/v1/profile/prefs", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expertsGroups: next }),
      }).catch(() => {});
    }, 600);
  }, []);

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = { ...prev, [key]: !(prev[key] ?? true) };
      persist(next);
      return next;
    });
  const setAll = (value: boolean) =>
    setOpen(() => {
      const next: Record<string, boolean> = {};
      for (const g of groups) next[g.key] = value;
      persist(next);
      return next;
    });

  if (layout === "flat") {
    return (
      <Stagger className={cn("mt-6", GRID)} step={0.03}>
        {experts.map((e) => (
          <ExpertCard key={e.id} expert={e} />
        ))}
      </Stagger>
    );
  }

  return (
    <div className="mt-4" data-testid="internal-groups">
      <div className="mb-1 flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => setAll(true)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-ink-600 transition-colors hover:bg-sand-100 hover:text-maroon-700 cursor-pointer focus-visible:outline-2 focus-visible:outline-gold-500"
          data-testid="expand-all"
        >
          <UnfoldVertical className="size-3.5" aria-hidden /> {t("expandAll")}
        </button>
        <button
          type="button"
          onClick={() => setAll(false)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-ink-600 transition-colors hover:bg-sand-100 hover:text-maroon-700 cursor-pointer focus-visible:outline-2 focus-visible:outline-gold-500"
          data-testid="collapse-all"
        >
          <FoldVertical className="size-3.5" aria-hidden /> {t("collapseAll")}
        </button>
      </div>

      {groups.map((g) => {
        const isOpen = open[g.key] ?? true;
        const label = g.unit ? bi(locale, g.unit.nameEn, g.unit.nameAr) : t("unassignedUnit");
        const sector = g.sector ? bi(locale, g.sector.nameEn, g.sector.nameAr) : null;
        const panelId = `unit-group-${g.key}`;
        return (
          <section key={g.key} className="mb-2" data-testid="unit-group" data-unit={g.unit?.code ?? "unassigned"}>
            <button
              type="button"
              onClick={() => toggle(g.key)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="group/header flex w-full items-center gap-3 rounded-lg px-1.5 py-2 text-start transition-colors hover:bg-sand-100/70 cursor-pointer focus-visible:outline-2 focus-visible:outline-gold-500"
            >
              <span aria-hidden className="h-6 w-1 shrink-0 rounded-full bg-maroon-700" />
              <span className="min-w-0">
                {sector ? (
                  <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">
                    {sector}
                  </span>
                ) : null}
                <h2 className="truncate font-display text-base font-semibold text-ink-900 group-hover/header:text-maroon-900">
                  {label}
                </h2>
              </span>
              <span className="rounded-full bg-sand-100 px-2 py-0.5 text-xs text-ink-600 tnum">
                {formatNumber(g.experts.length, locale, { decimals: 0 })}
              </span>
              <span className="mx-2 h-px flex-1 bg-sand-300/70" aria-hidden />
              <ChevronDown
                className={cn("size-4 shrink-0 text-ink-400 transition-transform duration-200", !isOpen && "-rotate-90 rtl:rotate-90")}
                aria-hidden
              />
            </button>
            <motion.div
              id={panelId}
              initial={false}
              animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
              transition={reduced ? { duration: 0 } : { duration: 0.26, ease: EASE }}
              className="overflow-hidden"
              aria-hidden={!isOpen}
            >
              <div className={cn("px-1 pb-4 pt-2", !isOpen && "pointer-events-none")}>
                <div className={GRID}>
                  {g.experts.map((e) => (
                    <ExpertCard key={e.id} expert={e} />
                  ))}
                </div>
              </div>
            </motion.div>
          </section>
        );
      })}
    </div>
  );
}
