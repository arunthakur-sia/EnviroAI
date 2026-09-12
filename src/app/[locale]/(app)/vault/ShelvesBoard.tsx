"use client";
// CR03 1.1: shelves in a fixed order with collapsible headers (260ms height
// animation), Projects as the lowest shelf collapsed by default, and per-user
// persistence of the collapse state in preferences.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, UnfoldVertical, FoldVertical } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Shelf, type ShelfDoc } from "@/components/nexus/Shelf";

const EASE = [0.22, 1, 0.36, 1] as const;

export type ProjectShelf = {
  id: string;
  code: string | null;
  titleEn: string;
  titleAr: string;
  docs: ShelfDoc[];
};

export type ShelfGroup = {
  key: string;
  labelEn: string;
  labelAr: string;
  count: number;
  docs: ShelfDoc[];
  projects?: ProjectShelf[];
};

export function ShelvesBoard({
  groups,
  initialOpen,
  projectCount,
}: {
  groups: ShelfGroup[];
  initialOpen: Record<string, boolean>;
  projectCount: number;
}) {
  const t = useTranslations("vault");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [open, setOpen] = React.useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {};
    for (const g of groups) {
      state[g.key] = initialOpen[g.key] ?? g.key !== "projects";
    }
    return state;
  });
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = React.useCallback((next: Record<string, boolean>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/v1/profile/prefs", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vaultShelves: next }),
      }).catch(() => {});
    }, 600);
  }, []);

  const toggle = (key: string) => {
    setOpen((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      persist(next);
      return next;
    });
  };
  const setAll = (value: boolean) => {
    setOpen(() => {
      const next: Record<string, boolean> = {};
      for (const g of groups) next[g.key] = value;
      persist(next);
      return next;
    });
  };

  return (
    <div className="mt-4" data-testid="vault-shelves">
      {/* Expand all / Collapse all at the end of the shelf toolbar (CR03 1.1) */}
      <div className="mb-1 flex items-center justify-end gap-1">
        <button
          onClick={() => setAll(true)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-ink-600 transition-colors hover:bg-sand-100 hover:text-maroon-700 cursor-pointer"
          data-testid="expand-all"
        >
          <UnfoldVertical className="size-3.5" /> {t("expandAll")}
        </button>
        <button
          onClick={() => setAll(false)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-ink-600 transition-colors hover:bg-sand-100 hover:text-maroon-700 cursor-pointer"
          data-testid="collapse-all"
        >
          <FoldVertical className="size-3.5" /> {t("collapseAll")}
        </button>
      </div>

      {groups.map((g) => {
        const isOpen = open[g.key] ?? true;
        const label = bi(locale, g.labelEn, g.labelAr);
        const isProjects = g.key === "projects";
        return (
          <section key={g.key} className="mb-2" data-testid={`shelf-${g.key}`}>
            <button
              onClick={() => toggle(g.key)}
              aria-expanded={isOpen}
              className="group/header flex w-full items-center gap-2 rounded-lg px-1.5 py-2 text-start transition-colors hover:bg-sand-100/70 cursor-pointer"
            >
              <h2
                className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-600 group-hover/header:text-maroon-900"
                style={{ fontFamily: "inherit" }}
              >
                {isProjects && !isOpen
                  ? t("projectsSummary", { docs: g.count, projects: projectCount })
                  : label}
              </h2>
              {!(isProjects && !isOpen) ? (
                <span className="text-xs text-ink-600 tnum">{g.count}</span>
              ) : null}
              <span className="mx-2 h-px flex-1 bg-sand-300/70" aria-hidden />
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-ink-400 transition-transform duration-200",
                  !isOpen && "-rotate-90 rtl:rotate-90"
                )}
                aria-hidden
              />
            </button>
            <motion.div
              initial={false}
              animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
              transition={
                reduced ? { duration: 0 } : { duration: 0.26, ease: EASE }
              }
              className="overflow-hidden"
              aria-hidden={!isOpen}
            >
              <div className={cn("pt-2", !isOpen && "pointer-events-none")}>
                {isProjects && g.projects ? (
                  g.projects.map((p) => (
                    <Shelf
                      key={p.id}
                      docs={p.docs}
                      label={`${p.code ? `${p.code} · ` : ""}${p.titleEn}`}
                      labelAr={`${p.code ? `${p.code} · ` : ""}${p.titleAr}`}
                      count={p.docs.length}
                      className="mb-6"
                    />
                  ))
                ) : (
                  <Shelf docs={g.docs} />
                )}
              </div>
            </motion.div>
          </section>
        );
      })}
    </div>
  );
}
