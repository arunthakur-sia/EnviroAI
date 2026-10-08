"use client";
// The left column of the reader: a document outline built from the extracted
// headings. Numbered headings ("3.2 Water Resources") nest under their parent.
// The panel collapses to a rail, the search box filters sections, and
// "Collapse all" folds every parent. A click moves the viewer to the page.
import * as React from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, ListTree, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type OutlineEntry = { heading: string; page: number };

type Node = { entry: OutlineEntry; index: number; children: { entry: OutlineEntry; index: number }[] };

/** Depth from a leading section number: "3" is a parent, "3.2" a child. */
function depthOf(heading: string): number {
  const m = /^(\d+(?:\.\d+)*)[.)]?\s/.exec(heading.trim());
  return m ? m[1].split(".").length - 1 : 0;
}

export function buildTree(outline: OutlineEntry[]): Node[] {
  const tree: Node[] = [];
  outline.forEach((entry, index) => {
    const depth = depthOf(entry.heading);
    const parent = tree[tree.length - 1];
    if (depth > 0 && parent) parent.children.push({ entry, index });
    else tree.push({ entry, index, children: [] });
  });
  return tree;
}

export function OutlinePanel({
  outline,
  currentPage,
  totalPages,
  onJump,
  collapsed,
  onToggle,
}: {
  outline: OutlineEntry[];
  currentPage: number;
  totalPages: number;
  onJump: (page: number) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("ksaReader");
  const [q, setQ] = React.useState("");
  const tree = React.useMemo(() => buildTree(outline), [outline]);
  const [folded, setFolded] = React.useState<Set<number>>(new Set());

  // the active section is the last heading that starts on or before the page
  const activeIndex = React.useMemo(() => {
    let a = -1;
    outline.forEach((o, i) => {
      if (o.page <= currentPage) a = i;
    });
    return a;
  }, [outline, currentPage]);
  const activeParent = React.useMemo(() => {
    const n = tree.find((p) => p.index === activeIndex || p.children.some((c) => c.index === activeIndex));
    return n?.index ?? -1;
  }, [tree, activeIndex]);

  const needle = q.trim().toLowerCase();
  const visible = React.useMemo(() => {
    if (!needle) return tree;
    return tree
      .map((n) => {
        const own = n.entry.heading.toLowerCase().includes(needle);
        const kids = n.children.filter((c) => c.entry.heading.toLowerCase().includes(needle));
        if (own) return n;
        if (kids.length) return { ...n, children: kids };
        return null;
      })
      .filter((n): n is Node => n !== null);
  }, [tree, needle]);

  const parents = tree.filter((n) => n.children.length > 0).map((n) => n.index);
  const allFolded = parents.length > 0 && parents.every((i) => folded.has(i));
  const sectionNo = Math.max(1, tree.findIndex((p) => p.index === activeParent) + 1);

  if (collapsed) {
    return (
      <div className="card flex w-11 flex-col items-center gap-2 py-3" data-testid="outline-rail">
        <button
          type="button"
          onClick={onToggle}
          aria-label={t("showOutline")}
          title={t("showOutline")}
          className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-600 hover:bg-navy-50 hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-aqua-500"
        >
          <PanelLeftOpen className="size-4 flip-rtl" />
        </button>
        <ListTree className="size-4 text-ink-400" aria-hidden />
      </div>
    );
  }

  return (
    <div className="card flex max-h-[calc(100vh-7rem)] flex-col p-3" data-testid="outline-panel">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <ListTree className="size-4 text-teal-600" aria-hidden /> {t("outline")}
        </p>
        <button
          type="button"
          onClick={onToggle}
          aria-label={t("collapsePanel")}
          title={t("collapsePanel")}
          className="grid size-7 cursor-pointer place-items-center rounded-md text-ink-400 hover:bg-navy-50 hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-aqua-500"
        >
          <PanelLeftClose className="size-4 flip-rtl" />
        </button>
      </div>

      <div className="relative mb-2">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("outlineSearch")}
          aria-label={t("outlineSearch")}
          data-testid="outline-search"
          className="h-8 w-full rounded-lg border border-mist-300 bg-white ps-8 pe-2 text-xs text-ink-900 placeholder:text-ink-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100"
        />
      </div>

      {parents.length ? (
        <button
          type="button"
          onClick={() => setFolded(allFolded ? new Set() : new Set(parents))}
          className="mb-1 flex cursor-pointer items-center gap-1 self-start rounded px-1.5 py-1 text-xs text-ink-600 hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-aqua-500"
          data-testid="outline-collapse-all"
        >
          {allFolded ? <ChevronRight className="size-3.5 flip-rtl" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
          {allFolded ? t("expandAll") : t("collapseAll")}
        </button>
      ) : null}

      <nav className="min-h-0 flex-1 overflow-y-auto text-sm" aria-label={t("outline")}>
        {outline.length === 0 ? (
          <p className="px-1 py-3 text-xs text-ink-600">{t("noOutline")}</p>
        ) : visible.length === 0 ? (
          <p className="px-1 py-3 text-xs text-ink-600">{t("noMatches")}</p>
        ) : (
          <ul className="space-y-0.5">
            {visible.map((n) => {
              const open = needle ? true : !folded.has(n.index);
              return (
                <li key={n.index}>
                  <div className="flex items-center">
                    {n.children.length ? (
                      <button
                        type="button"
                        onClick={() =>
                          setFolded((prev) => {
                            const next = new Set(prev);
                            if (next.has(n.index)) next.delete(n.index);
                            else next.add(n.index);
                            return next;
                          })
                        }
                        aria-expanded={open}
                        aria-label={n.entry.heading}
                        className="grid size-6 shrink-0 cursor-pointer place-items-center text-ink-400 hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-aqua-500"
                      >
                        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5 flip-rtl" />}
                      </button>
                    ) : (
                      <span className="size-6 shrink-0" aria-hidden />
                    )}
                    <Row entry={n.entry} active={n.index === activeIndex} strong onJump={onJump} />
                  </div>
                  {open && n.children.length ? (
                    <ul className="ms-6 space-y-0.5">
                      {n.children.map((c) => (
                        <li key={c.index}>
                          <Row entry={c.entry} active={c.index === activeIndex} onJump={onJump} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="mt-3 border-t border-mist-100 pt-2">
        <p className="mb-1 text-[11px] text-ink-600 tnum">
          {t("progress", { section: sectionNo, sections: Math.max(1, tree.length), page: currentPage, total: totalPages })}
        </p>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-mist-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((currentPage / Math.max(1, totalPages)) * 100)}
        >
          <div className="h-full rounded-full bg-teal-600" style={{ width: `${(currentPage / Math.max(1, totalPages)) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function Row({ entry, active, strong, onJump }: { entry: OutlineEntry; active: boolean; strong?: boolean; onJump: (page: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onJump(entry.page)}
      aria-current={active ? "true" : undefined}
      data-testid="outline-item"
      className={cn(
        "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1 text-start transition-colors focus-visible:outline-2 focus-visible:outline-aqua-500",
        strong ? "font-medium text-ink-900" : "text-ink-600",
        active ? "border-s-2 border-teal-600 bg-aqua-100/60 text-navy-900" : "hover:bg-navy-50 hover:text-navy-900"
      )}
    >
      <span className="truncate" dir="auto">{entry.heading}</span>
      <span className="shrink-0 text-xs text-ink-400 tnum">{entry.page}</span>
    </button>
  );
}
