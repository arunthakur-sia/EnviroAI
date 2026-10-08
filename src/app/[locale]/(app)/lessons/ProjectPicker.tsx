"use client";
// CR07 1.3: the By project tab of the Learning Room becomes a proper picker:
// a strategy store switch (the NES editions or the Programme Strategy), a search
// box, a drill down through the chain with lesson counts at every level, and a
// "Not linked" group at the end. Selecting a project shows its own lessons and
// the lessons inherited from its parent, each marked with where it came from.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, Search } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Chip, RagDot } from "@/components/ui/primitives";
import type { LessonPicker, PickerNode, RoomLesson } from "@/server/services/lessons";

/** The chain each store drills through, top level first. */
const LEVELS: Record<"nes" | "council", string[]> = {
  nes: ["outcome", "target", "initiative", "project"],
  council: ["goal", "intermediate_outcome", "output", "project"],
};

export function ProjectPicker({
  picker,
  lessons,
  renderLesson,
}: {
  picker: LessonPicker;
  lessons: RoomLesson[];
  /** the Learning Room's own lesson card, so the picker stays presentational */
  renderLesson: (lesson: RoomLesson, inheritedFrom?: string) => React.ReactNode;
}) {
  const t = useTranslations("lessons.picker");
  const locale = useLocale();
  const [store, setStore] = React.useState<"nes" | "council">("nes");
  const [query, setQuery] = React.useState("");
  /** the selected node at each depth, shortest path first */
  const [path, setPath] = React.useState<string[]>([]);
  const [showUnlinked, setShowUnlinked] = React.useState(false);

  const nodes = store === "nes" ? picker.nes : picker.council;
  const byId = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const levels = LEVELS[store];

  React.useEffect(() => {
    setPath([]);
    setShowUnlinked(false);
  }, [store]);

  const childrenOf = React.useMemo(() => {
    const map = new Map<string | null, PickerNode[]>();
    for (const n of nodes) {
      const key = n.parentId && byId.has(n.parentId) ? n.parentId : null;
      (map.get(key) ?? map.set(key, []).get(key)!).push(n);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.code ?? "").localeCompare(b.code ?? "") || a.titleEn.localeCompare(b.titleEn));
    }
    return map;
  }, [nodes, byId]);

  const matches = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return null;
    return nodes
      .filter(
        (n) =>
          n.titleEn.toLowerCase().includes(needle) ||
          n.titleAr.includes(query.trim()) ||
          (n.code ?? "").toLowerCase().includes(needle)
      )
      .slice(0, 20);
  }, [nodes, query]);

  const selectedId = path[path.length - 1] ?? null;
  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  /** The lessons of a node, split into its own and those from beneath it. */
  const lessonsFor = (nodeId: string) => {
    const direct: RoomLesson[] = [];
    const inherited: { lesson: RoomLesson; from: string }[] = [];
    const subtree = new Set<string>();
    const walk = (id: string, depth: number) => {
      if (depth > 5) return;
      for (const child of childrenOf.get(id) ?? []) {
        subtree.add(child.id);
        walk(child.id, depth + 1);
      }
    };
    walk(nodeId, 0);
    for (const lesson of lessons) {
      const onNode = lesson.links.some((l) => l.nodeId === nodeId);
      if (onNode) {
        direct.push(lesson);
        continue;
      }
      const below = lesson.links.find((l) => subtree.has(l.nodeId));
      if (below) {
        const from = byId.get(below.nodeId);
        inherited.push({
          lesson,
          from: from ? `${from.code ? `${from.code} ` : ""}${bi(locale, from.titleEn, from.titleAr)}` : "",
        });
      }
    }
    return { direct, inherited };
  };

  const unlinked = lessons.filter((l) => picker.unlinkedIds.includes(l.id));

  /** One drill column. */
  const column = (parentId: string | null, depth: number) => {
    const list = childrenOf.get(parentId) ?? [];
    const levelName = levels[depth] ?? "";
    if (!list.length) return null;
    return (
      <div key={depth} className="min-w-0 flex-1" data-testid="picker-column">
        <p
          className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600"
          style={{ fontFamily: "inherit" }}
        >
          {t(`levels.${levelName}` as never)}
        </p>
        <ul className="card max-h-72 divide-y divide-mist-100 overflow-y-auto">
          {list.map((node) => {
            const active = path[depth] === node.id;
            return (
              <li key={node.id}>
                <button
                  onClick={() =>
                    setPath((current) =>
                      current[depth] === node.id
                        ? current.slice(0, depth)
                        : [...current.slice(0, depth), node.id]
                    )
                  }
                  aria-pressed={active}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-start text-sm cursor-pointer",
                    active ? "bg-navy-100/60 text-navy-900" : "hover:bg-mist-50 text-ink-900"
                  )}
                  data-testid="picker-node"
                >
                  {node.code ? <span className="shrink-0 text-[11px] text-ink-600 tnum">{node.code}</span> : null}
                  <span className="min-w-0 flex-1 truncate">{bi(locale, node.titleEn, node.titleAr)}</span>
                  <span className="shrink-0 text-[11px] text-ink-600 tnum" title={t("countTitle", { direct: node.direct, total: node.total })}>
                    {node.total}
                  </span>
                  {(childrenOf.get(node.id) ?? []).length ? (
                    <ChevronRight className="size-3.5 shrink-0 text-ink-400 flip-rtl" aria-hidden />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const columns: React.ReactNode[] = [];
  columns.push(column(null, 0));
  for (let depth = 0; depth < path.length; depth++) {
    const node = column(path[depth], depth + 1);
    if (node) columns.push(node);
  }

  return (
    <div data-testid="lesson-project-picker">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-0.5 rounded-lg bg-mist-100 p-0.5">
          {(["nes", "council"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setStore(key)}
              aria-pressed={store === key}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer",
                store === key ? "bg-white font-medium text-navy-900 shadow-sm" : "text-ink-600"
              )}
              data-testid={`picker-store-${key}`}
            >
              {key === "nes" ? t("storeNes") : t("storeCouncil")}
            </button>
          ))}
        </span>
        <span className="relative ms-auto">
          <Search
            className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-400"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="h-9 w-64 rounded-lg border border-mist-300 bg-white ps-8 pe-3 text-sm placeholder:text-ink-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100"
            data-testid="picker-search"
          />
        </span>
      </div>

      {matches ? (
        <div className="card divide-y divide-mist-100" data-testid="picker-results">
          {matches.length ? (
            matches.map((node) => (
              <button
                key={node.id}
                onClick={() => {
                  // walk the ancestry so the columns open at the match
                  const chain: string[] = [];
                  let cursor: PickerNode | undefined = node;
                  for (let i = 0; i < 6 && cursor; i++) {
                    chain.unshift(cursor.id);
                    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
                  }
                  setPath(chain);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-navy-50 cursor-pointer"
              >
                {node.code ? <span className="text-[11px] text-ink-600 tnum">{node.code}</span> : null}
                <span className="min-w-0 flex-1 truncate text-ink-900">
                  {bi(locale, node.titleEn, node.titleAr)}
                </span>
                <Chip tone="mist">{t(`levels.${node.level}` as never)}</Chip>
                <span className="text-[11px] text-ink-600 tnum">{node.total}</span>
              </button>
            ))
          ) : (
            <p className="px-4 py-6 text-center text-sm text-ink-600">{t("noMatches")}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 lg:flex-row">{columns}</div>
      )}

      {selected ? (
        <div className="mt-4" data-testid="picker-selection">
          <p className="mb-2 flex flex-wrap items-baseline gap-2 text-sm">
            <span className="font-medium text-ink-900">
              {selected.code ? <span className="me-1.5 text-xs text-ink-600 tnum">{selected.code}</span> : null}
              {bi(locale, selected.titleEn, selected.titleAr)}
            </span>
            <Chip tone="mist">{t(`levels.${selected.level}` as never)}</Chip>
            {selected.edition ? <Chip tone="mist">{selected.edition.toUpperCase()}</Chip> : null}
            {store === "council" ? <Chip tone="navy">{t("internal")}</Chip> : null}
            <RagDot status="on_track" className="hidden" />
          </p>
          {(() => {
            const { direct, inherited } = lessonsFor(selected.id);
            if (!direct.length && !inherited.length) {
              return <p className="text-sm text-ink-600">{t("noLessonsHere")}</p>;
            }
            return (
              <div className="flex flex-col gap-4">
                {direct.length ? (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600">
                      {t("direct", { count: direct.length })}
                    </p>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {direct.map((lesson) => renderLesson(lesson))}
                    </div>
                  </div>
                ) : null}
                {inherited.length ? (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600">
                      {t("inherited", { count: inherited.length })}
                    </p>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {inherited.map(({ lesson, from }) => renderLesson(lesson, from))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })()}
        </div>
      ) : null}

      {/* the Not linked group always closes the picker */}
      <div className="mt-4 card overflow-hidden" data-testid="picker-unlinked">
        <button
          onClick={() => setShowUnlinked((v) => !v)}
          aria-expanded={showUnlinked}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-start cursor-pointer hover:bg-mist-50"
        >
          <span className="text-sm font-medium text-ink-900">{t("notLinked")}</span>
          <span className="text-xs text-ink-600 tnum">{unlinked.length}</span>
          <ChevronRight
            className={cn("ms-auto size-4 text-ink-400 transition-transform flip-rtl", showUnlinked && "rotate-90")}
            aria-hidden
          />
        </button>
        {showUnlinked ? (
          <div className="border-t border-mist-100 p-3">
            {unlinked.length ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {unlinked.map((lesson) => renderLesson(lesson))}
              </div>
            ) : (
              <p className="text-sm text-ink-600">{t("allLinked")}</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
