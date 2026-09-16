"use client";
// CR07 3.4: the org chart. A top-down tree with the Secretary General at the
// top, each level a row of cards in the Strategy Canvas language, connected by
// SVG curves in the --connection token measured from the real DOM boxes.
// Wheel zoom and drag pan on an inner stage, fit to width on load, a mini-map
// in the corner, collapse and expand of branches, a list view for narrow
// screens and screen readers, and search that rings the matches and dims the
// rest. Selecting a card pushes ?unit=<code> and opens the unit panel beneath
// the chart with a tapered pointer tail, exactly as the outcome panel does.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  ChevronDown,
  Minus,
  Network,
  Plus,
  Rows3,
  Scan,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn, bi } from "@/lib/utils";
import { Avatar, Chip, Input, Skeleton } from "@/components/ui/primitives";
import type { OrgUnitNode, UnitPanelData } from "@/server/services/organisation";
import { UnitPanel } from "./UnitPanel";

const MIN_Z = 0.4;
const MAX_Z = 2;
const CARD_W = 210;
const ROW_GAP = 60;
const NARROW = 900;

type Box = { id: string; x: number; y: number; w: number; h: number };
type Edge = {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** true when the child is stacked beneath its parent rather than beside it */
  stacked?: boolean;
};
type Transform = { x: number; y: number; z: number };

function clampNum(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** The name in the other language, shown beneath the current one. */
function otherLang(locale: string, en: string, ar: string): string {
  return locale === "ar" ? en : ar;
}

function childrenOf(node: OrgUnitNode, byId: Map<string, OrgUnitNode>): OrgUnitNode[] {
  const out: OrgUnitNode[] = [];
  for (const id of node.childIds) {
    const child = byId.get(id);
    if (child) out.push(child);
  }
  return out;
}

function descendantCount(node: OrgUnitNode, byId: Map<string, OrgUnitNode>, depth = 0): number {
  if (depth > 8) return 0;
  let total = 0;
  for (const child of childrenOf(node, byId)) {
    total += 1 + descendantCount(child, byId, depth + 1);
  }
  return total;
}

function ancestorIds(node: OrgUnitNode, byId: Map<string, OrgUnitNode>): string[] {
  const out: string[] = [];
  let cursor = node.parentId ? byId.get(node.parentId) : undefined;
  for (let i = 0; i < 8 && cursor; i++) {
    out.push(cursor.id);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return out;
}

function headOf(node: OrgUnitNode, locale: string): { name: string; title: string; color: string } {
  const name = node.head
    ? bi(locale, node.head.nameEn, node.head.nameAr)
    : bi(locale, node.headNameEn ?? "", node.headNameAr ?? "");
  return {
    name,
    title: bi(locale, node.headTitleEn ?? "", node.headTitleAr ?? ""),
    color: node.head?.avatarColor ?? "maroon",
  };
}

/** Level labels stay literal keys so the message files type check. */
function useLevelLabel(): (level: string) => string {
  const t = useTranslations("organisation");
  return React.useCallback(
    (level: string) => {
      switch (level) {
        case "secretary_general":
          return t("levels.secretary_general");
        case "sector":
          return t("levels.sector");
        case "office":
          return t("levels.office");
        case "department":
          return t("levels.department");
        case "section":
          return t("levels.section");
        default:
          return level;
      }
    },
    [t]
  );
}

type TreeCtx = {
  byId: Map<string, OrgUnitNode>;
  collapsed: Set<string>;
  selected: string | null;
  matches: Set<string> | null;
  onSelect: (node: OrgUnitNode) => void;
  onToggle: (id: string) => void;
  register: (id: string, el: HTMLElement | null) => void;
};

/* ------------------------------------------------------------------ */
/* The node card                                                        */
/* ------------------------------------------------------------------ */

function UnitCard({ node, ctx }: { node: OrgUnitNode; ctx: TreeCtx }) {
  const t = useTranslations("organisation");
  const locale = useLocale();
  const levelLabel = useLevelLabel();
  const name = bi(locale, node.nameEn, node.nameAr);
  const alt = otherLang(locale, node.nameEn, node.nameAr);
  const head = headOf(node, locale);
  const kids = childrenOf(node, ctx.byId);
  const collapsed = ctx.collapsed.has(node.id);
  const selected = ctx.selected === node.code;
  const matched = ctx.matches ? ctx.matches.has(node.id) : false;
  const dimmed = ctx.matches !== null && !matched;
  const hidden = collapsed ? descendantCount(node, ctx.byId) : 0;

  return (
    <div className="relative" style={{ width: CARD_W }}>
      <button
        type="button"
        ref={(el) => {
          ctx.register(node.id, el);
        }}
        onClick={() => ctx.onSelect(node)}
        aria-pressed={selected}
        aria-label={t("openUnit", { unit: name })}
        data-testid="org-unit-card"
        data-unit-code={node.code}
        className={cn(
          "card w-full cursor-pointer px-3.5 py-3 text-start transition-all duration-200 ease-[var(--ease-paper)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700",
          selected && "ring-2 ring-maroon-700",
          matched && !selected && "ring-2 ring-maroon-500",
          dimmed && "opacity-35"
        )}
      >
        <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-600">
          {levelLabel(node.level)}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-sm font-medium leading-snug text-ink-900">
          {name}
        </span>
        <span className="line-clamp-1 block text-[11px] leading-snug text-ink-400">{alt}</span>
        <span className="mt-2 flex items-center gap-2">
          {head.name ? (
            <Avatar name={head.name} color={head.color} size={22} />
          ) : (
            <span
              className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-full bg-sand-200 text-ink-400"
              aria-hidden
            >
              <UserRound className="size-3" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] text-ink-900">
              {head.name || t("headVacant")}
            </span>
            {head.title ? (
              <span className="block truncate text-[10px] text-ink-600">{head.title}</span>
            ) : null}
          </span>
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-600 tnum">
            <Users className="size-3" aria-hidden />
            {t("staff", { count: node.headcountTotal })}
          </span>
          {node.policyCount > 0 ? (
            <Chip tone="maroon">{t("policyChip", { count: node.policyCount })}</Chip>
          ) : null}
        </span>
      </button>
      {kids.length ? (
        <button
          type="button"
          onClick={() => ctx.onToggle(node.id)}
          aria-expanded={!collapsed}
          aria-label={
            collapsed ? t("expandBranch", { unit: name }) : t("collapseBranch", { unit: name })
          }
          /* min-h-6 keeps the branch toggle at the 24px touch target WCAG 2.2
             asks for; it sat at 16px and Lighthouse called it */
          className="absolute -bottom-3 start-1/2 z-10 flex min-h-6 min-w-6 -translate-x-1/2 cursor-pointer items-center justify-center gap-1 rounded-full border border-sand-300 bg-white px-2 py-1 text-[10px] text-ink-600 shadow-sm transition-colors hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700 rtl:translate-x-1/2"
        >
          {/* rotated, not flip-rtl: the flip rule would replace the rotation */}
          <ChevronDown
            className={cn("size-3 transition-transform", collapsed && "-rotate-90 rtl:rotate-90")}
            aria-hidden
          />
          {collapsed && hidden ? (
            <span className="tnum">{t("hiddenUnits", { count: hidden })}</span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}

function Branch({ node, ctx }: { node: OrgUnitNode; ctx: TreeCtx }) {
  const kids = ctx.collapsed.has(node.id) ? [] : childrenOf(node, ctx.byId);
  /* Thirty two departments side by side would be two and a half thousand
     pixels wide and could only fit at the zoom floor, where nothing is legible.
     The published chart stacks a unit's departments beneath it, so children
     that lead nowhere run DOWN the page in one column while children that
     carry their own branch run ACROSS it. */
  const leaves = kids.filter((k) => !childrenOf(k, ctx.byId).length);
  const branches = kids.filter((k) => childrenOf(k, ctx.byId).length);
  const stackLeaves = leaves.length > 2;
  return (
    <div className="flex shrink-0 flex-col items-center px-3">
      <UnitCard node={node} ctx={ctx} />
      {kids.length ? (
        <>
          <span aria-hidden className="block" style={{ height: ROW_GAP }} />
          <div className="flex items-start justify-center">
            {stackLeaves ? (
              <div className="flex shrink-0 flex-col items-stretch gap-2 px-3">
                {leaves.map((child) => (
                  <Branch key={child.id} node={child} ctx={ctx} />
                ))}
              </div>
            ) : (
              leaves.map((child) => <Branch key={child.id} node={child} ctx={ctx} />)
            )}
            {branches.map((child) => (
              <Branch key={child.id} node={child} ctx={ctx} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The list view: the same information, indented                        */
/* ------------------------------------------------------------------ */

function ListRow({
  node,
  depth,
  ctx,
}: {
  node: OrgUnitNode;
  depth: number;
  ctx: TreeCtx;
}) {
  const t = useTranslations("organisation");
  const locale = useLocale();
  const levelLabel = useLevelLabel();
  const name = bi(locale, node.nameEn, node.nameAr);
  const alt = otherLang(locale, node.nameEn, node.nameAr);
  const head = headOf(node, locale);
  const kids = childrenOf(node, ctx.byId);
  const collapsed = ctx.collapsed.has(node.id);
  const selected = ctx.selected === node.code;
  const matched = ctx.matches ? ctx.matches.has(node.id) : false;
  const dimmed = ctx.matches !== null && !matched;

  return (
    <li>
      <div
        className="flex items-center gap-1"
        style={{ paddingInlineStart: Math.min(depth, 5) * 18 }}
      >
        {kids.length ? (
          <button
            type="button"
            onClick={() => ctx.onToggle(node.id)}
            aria-expanded={!collapsed}
            aria-label={
              collapsed ? t("expandBranch", { unit: name }) : t("collapseBranch", { unit: name })
            }
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-400 hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform", collapsed && "-rotate-90 rtl:rotate-90")}
              aria-hidden
            />
          </button>
        ) : (
          <span aria-hidden className="size-6 shrink-0" />
        )}
        <button
          type="button"
          ref={(el) => {
            ctx.register(node.id, el);
          }}
          onClick={() => ctx.onSelect(node)}
          aria-pressed={selected}
          aria-label={t("openUnit", { unit: name })}
          data-testid="org-unit-card"
          data-unit-code={node.code}
          className={cn(
            "card flex min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-start transition-colors hover:border-maroon-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700",
            selected && "ring-2 ring-maroon-700",
            matched && !selected && "ring-2 ring-maroon-500",
            dimmed && "opacity-35"
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink-900">{name}</span>
            <span className="block truncate text-[11px] text-ink-400">{alt}</span>
          </span>
          <span className="flex items-center gap-1.5">
            {head.name ? (
              <Avatar name={head.name} color={head.color} size={20} />
            ) : (
              <span
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-sand-200 text-ink-400"
                aria-hidden
              >
                <UserRound className="size-3" />
              </span>
            )}
            <span className="max-w-40 truncate text-[11px] text-ink-600">
              {head.name || t("headVacant")}
            </span>
          </span>
          <span className="text-[11px] text-ink-600 tnum">
            {t("staff", { count: node.headcountTotal })}
          </span>
          <Chip tone="sand">{levelLabel(node.level)}</Chip>
          {node.policyCount > 0 ? (
            <Chip tone="maroon">{t("policyChip", { count: node.policyCount })}</Chip>
          ) : null}
        </button>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* The chart                                                            */
/* ------------------------------------------------------------------ */

export function OrgChart({
  units,
  rootId,
  panel,
  initialUnit,
}: {
  units: OrgUnitNode[];
  rootId: string | null;
  panel: UnitPanelData | null;
  initialUnit: string | null;
}) {
  const t = useTranslations("organisation");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const reduced = useReducedMotion();

  const [view, setView] = React.useState<"chart" | "list">("chart");
  const [query, setQuery] = React.useState("");
  /* The whole structure at once needs the zoom floor, where no card is
     legible. The chart therefore arrives showing the Secretary General, the
     units that report to them, and the six sectors as closed branches; every
     sector opens with one click and the list view shows everything. */
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => {
    const shut = new Set<string>();
    for (const unit of units) {
      if (unit.parentId && unit.childIds.length) shut.add(unit.id);
    }
    return shut;
  });
  const [transform, setTransform] = React.useState<Transform>({ x: 0, y: 12, z: 1 });
  const [dragging, setDragging] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(initialUnit);
  const [layout, setLayout] = React.useState<{
    edges: Edge[];
    boxes: Box[];
    w: number;
    h: number;
    vw: number;
    vh: number;
  }>({ edges: [], boxes: [], w: 0, h: 0, vw: 0, vh: 0 });
  const [pointerX, setPointerX] = React.useState<number | null>(null);
  const [pending, startTransition] = React.useTransition();

  const viewportRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<Map<string, HTMLElement>>(new Map());
  const panRef = React.useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const tRef = React.useRef(transform);
  const depthRef = React.useRef(0);
  const fittedRef = React.useRef(false);
  const requestedRef = React.useRef<string | null>(initialUnit);

  React.useEffect(() => {
    tRef.current = transform;
  }, [transform]);

  const byId = React.useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const roots = React.useMemo(
    () =>
      units.filter((u) => (u.parentId ? !byId.has(u.parentId) : true)).sort((a, b) => {
        if (rootId && a.id === rootId) return -1;
        if (rootId && b.id === rootId) return 1;
        return a.sort - b.sort;
      }),
    [units, byId, rootId]
  );

  const needle = query.trim().toLowerCase();
  const matches = React.useMemo(() => {
    if (!needle) return null;
    const set = new Set<string>();
    for (const u of units) {
      const hay = [
        u.nameEn,
        u.nameAr,
        u.code,
        u.head?.nameEn ?? "",
        u.head?.nameAr ?? "",
        u.headNameEn ?? "",
        u.headNameAr ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (hay.includes(needle)) set.add(u.id);
    }
    return set;
  }, [needle, units]);

  /* a search opens the branches that hold its matches */
  const effectiveCollapsed = React.useMemo(() => {
    if (!matches || matches.size === 0) return collapsed;
    const next = new Set(collapsed);
    for (const id of matches) {
      const node = byId.get(id);
      if (!node) continue;
      for (const ancestor of ancestorIds(node, byId)) next.delete(ancestor);
    }
    return next;
  }, [collapsed, matches, byId]);

  const flat = React.useMemo(() => {
    const out: { node: OrgUnitNode; depth: number }[] = [];
    const walk = (node: OrgUnitNode, depth: number) => {
      out.push({ node, depth });
      if (effectiveCollapsed.has(node.id) || depth > 7) return;
      for (const child of childrenOf(node, byId)) walk(child, depth + 1);
    };
    for (const root of roots) walk(root, 0);
    return out;
  }, [roots, byId, effectiveCollapsed]);

  const selectedNode = React.useMemo(
    () => (selected ? units.find((u) => u.code === selected) ?? null : null),
    [selected, units]
  );

  /* narrow screens read the list first */
  React.useEffect(() => {
    if (window.innerWidth < NARROW) setView("list");
  }, []);

  const register = React.useCallback((id: string, el: HTMLElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  const onToggle = React.useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* ---- URL state: pushState, popstate unwinds (as the Canvas does) ---- */

  const pushUnit = React.useCallback((code: string | null) => {
    const url = code
      ? `${window.location.pathname}?unit=${encodeURIComponent(code)}`
      : window.location.pathname;
    window.history.pushState({ org: true }, "", url);
    depthRef.current++;
  }, []);

  const closePanel = React.useCallback(() => {
    if (depthRef.current > 0) {
      window.history.back();
      return;
    }
    setSelected(null);
    window.history.replaceState({ org: true }, "", window.location.pathname);
  }, []);

  const selectCode = React.useCallback(
    (code: string) => {
      setSelected(code);
      pushUnit(code);
    },
    [pushUnit]
  );

  const onSelect = React.useCallback(
    (node: OrgUnitNode) => {
      if (selected === node.code) {
        closePanel();
        return;
      }
      selectCode(node.code);
    },
    [selected, closePanel, selectCode]
  );

  React.useEffect(() => {
    function onPop() {
      const code = new URLSearchParams(window.location.search).get("unit");
      setSelected(code);
      depthRef.current = Math.max(0, depthRef.current - 1);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /* the panel body comes from the server; a new selection asks for it once */
  const panelData = panel && selected && panel.unit.code === selected ? panel : null;
  React.useEffect(() => {
    if (!selected || panelData) return;
    if (requestedRef.current === selected) return;
    requestedRef.current = selected;
    startTransition(() => {
      router.refresh();
    });
  }, [selected, panelData, router, startTransition]);

  /* deep link: bring the panel into view once */
  React.useEffect(() => {
    if (!initialUnit) return;
    const timer = setTimeout(() => {
      anchorRef.current?.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- measured connectors, mini-map boxes and stage size ---- */

  const measure = React.useCallback(() => {
    const stage = stageRef.current;
    const vp = viewportRef.current;
    if (!stage || !vp) return;
    const z = tRef.current.z || 1;
    const sr = stage.getBoundingClientRect();
    const boxes: Box[] = [];
    const pos = new Map<string, Box>();
    cardRefs.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      const box: Box = {
        id,
        x: (r.left - sr.left) / z,
        y: (r.top - sr.top) / z,
        w: r.width / z,
        h: r.height / z,
      };
      pos.set(id, box);
      boxes.push(box);
    });
    const edges: Edge[] = [];
    pos.forEach((parent, id) => {
      const node = byId.get(id);
      if (!node) return;
      for (const childId of node.childIds) {
        const child = pos.get(childId);
        if (!child) continue;
        // a stacked child sits beneath its siblings rather than beside them,
        // so the line leaves the parent's bottom and enters the child's side
        const stacked = child.y > parent.y + parent.h + 4 && Math.abs(child.x - parent.x) < parent.w;
        edges.push({
          key: `${id}:${childId}`,
          x1: parent.x + parent.w / 2,
          y1: parent.y + parent.h,
          x2: stacked ? child.x + child.w / 2 : child.x + child.w / 2,
          y2: child.y,
          stacked,
        });
      }
    });
    setLayout({
      edges,
      boxes,
      w: stage.offsetWidth,
      h: stage.offsetHeight,
      vw: vp.clientWidth,
      vh: vp.clientHeight,
    });
  }, [byId]);

  React.useEffect(() => {
    if (view !== "chart") return;
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    const timer = setTimeout(measure, 500);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
    };
  }, [measure, view, effectiveCollapsed, units, locale]);

  const fit = React.useCallback(() => {
    const vp = viewportRef.current;
    const stage = stageRef.current;
    if (!vp || !stage || !stage.offsetWidth) return;
    const w = stage.offsetWidth;
    const h = stage.offsetHeight;
    // fit the width the change request asks for, and the height too when the
    // tree is taller than the frame, so nothing is clipped on arrival
    const byWidth = (vp.clientWidth - 24) / w;
    const byHeight = h ? (vp.clientHeight - 24) / h : byWidth;
    const z = clampNum(Math.min(byWidth, byHeight, 1), MIN_Z, MAX_Z);
    setTransform({
      z,
      x: (vp.clientWidth - w * z) / 2,
      y: Math.max(12, (vp.clientHeight - h * z) / 2),
    });
  }, []);

  /* Fit again on every remeasure until the reader takes over: the first
     measurement runs before the fonts settle, so a single fit locks in a
     stale width and the tree spills out of the frame. */
  React.useEffect(() => {
    if (fittedRef.current || view !== "chart" || !layout.w) return;
    fit();
  }, [layout.w, layout.h, view, fit]);

  /* ---- zoom on the wheel, pan on a drag of the background ---- */

  React.useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || view !== "chart") return;
    function onWheel(e: WheelEvent) {
      if (!vp) return;
      e.preventDefault();
      fittedRef.current = true; // the reader has taken over the framing
      const rect = vp.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setTransform((prev) => {
        const z = clampNum(prev.z * Math.exp(-e.deltaY * 0.0015), MIN_Z, MAX_Z);
        const k = z / prev.z;
        return { z, x: px - (px - prev.x) * k, y: py - (py - prev.y) * k };
      });
    }
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [view]);

  const zoomBy = React.useCallback((factor: number) => {
    const vp = viewportRef.current;
    fittedRef.current = true;
    setTransform((prev) => {
      const z = clampNum(prev.z * factor, MIN_Z, MAX_Z);
      const k = z / prev.z;
      const px = (vp?.clientWidth ?? 0) / 2;
      const py = (vp?.clientHeight ?? 0) / 2;
      return { z, x: px - (px - prev.x) * k, y: py - (py - prev.y) * k };
    });
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input")) return;
    panRef.current = {
      x: e.clientX,
      y: e.clientY,
      tx: transform.x,
      ty: transform.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    fittedRef.current = true; // the reader has taken over the framing
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = panRef.current;
    if (!start) return;
    setTransform((prev) => ({
      ...prev,
      x: start.tx + (e.clientX - start.x),
      y: start.ty + (e.clientY - start.y),
    }));
  };
  const endPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panRef.current) return;
    panRef.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  /* keyboard users tab through the cards: keep the focused one in the frame */
  const ensureVisible = React.useCallback((el: HTMLElement) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const vr = vp.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    let dx = 0;
    let dy = 0;
    if (r.left < vr.left + 12) dx = vr.left + 12 - r.left;
    else if (r.right > vr.right - 12) dx = vr.right - 12 - r.right;
    if (r.top < vr.top + 12) dy = vr.top + 12 - r.top;
    else if (r.bottom > vr.bottom - 12) dy = vr.bottom - 12 - r.bottom;
    if (!dx && !dy) return;
    setTransform((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  }, []);

  /* ---- the tapered pointer tail, sliding to the selected card ---- */

  React.useEffect(() => {
    if (!selectedNode) {
      setPointerX(null);
      return;
    }
    const el = cardRefs.current.get(selectedNode.id);
    const anchor = anchorRef.current;
    if (!el || !anchor) {
      setPointerX(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    const vp = viewportRef.current?.getBoundingClientRect();
    const centre = r.left + r.width / 2;
    if (vp && (centre < vp.left || centre > vp.right)) {
      setPointerX(null);
      return;
    }
    setPointerX(clampNum(centre - ar.left, 28, Math.max(28, ar.width - 28)));
  }, [selectedNode, transform, view, layout, locale]);

  const ctx: TreeCtx = {
    byId,
    collapsed: effectiveCollapsed,
    selected,
    matches,
    onSelect,
    onToggle,
    register,
  };

  const matchCount = matches ? matches.size : 0;
  const viewportRect = {
    x: -transform.x / transform.z,
    y: -transform.y / transform.z,
    w: layout.vw / transform.z,
    h: layout.vh / transform.z,
  };

  return (
    <div className="relative">
      {/* toolbar: search, counts, view toggle */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-80">
          <Search
            className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-ink-400"
            style={{ insetInlineStart: 10 }}
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchLabel")}
            data-testid="org-search"
            style={{ paddingInlineStart: 34, paddingInlineEnd: query ? 34 : 12 }}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("clearSearch")}
              className="absolute top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-ink-400 hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
              style={{ insetInlineEnd: 6 }}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        {matches ? (
          <span
            className={cn("text-xs tnum", matchCount ? "text-maroon-700" : "text-ink-600")}
            role="status"
          >
            {matchCount ? t("matches", { count: matchCount }) : t("noMatches")}
          </span>
        ) : (
          <span className="text-xs text-ink-600 tnum">{t("unitsCount", { count: units.length })}</span>
        )}
        <span className="ms-auto inline-flex items-center gap-0.5 rounded-lg bg-sand-100 p-0.5" role="group" aria-label={t("viewToggle")}>
          <button
            type="button"
            onClick={() => setView("chart")}
            aria-pressed={view === "chart"}
            data-testid="org-view-chart"
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700",
              view === "chart" ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
            )}
          >
            <Network className="size-3.5" aria-hidden /> {t("chartView")}
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            data-testid="org-view-list"
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700",
              view === "list" ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
            )}
          >
            <Rows3 className="size-3.5" aria-hidden /> {t("listView")}
          </button>
        </span>
      </div>

      {units.length === 0 ? (
        <p className="rounded-2xl bg-sand-100 px-6 py-10 text-center text-sm text-ink-600">
          {t("emptyTree")}
        </p>
      ) : view === "chart" ? (
        <div
          ref={viewportRef}
          data-testid="org-chart"
          role="group"
          aria-label={t("chartAria")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onFocusCapture={(e) => ensureVisible(e.target as HTMLElement)}
          className={cn(
            "relative h-[clamp(420px,74vh,860px)] touch-pan-y overflow-hidden rounded-2xl bg-sand-100",
            dragging ? "cursor-grabbing" : "cursor-grab"
          )}
        >
          {/* the stage carries the transform; physical left keeps the
              measured geometry identical in both directions */}
          <div
            ref={stageRef}
            className="absolute top-0 w-max p-4"
            style={{
              left: 0,
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.z})`,
              transformOrigin: "0 0",
              transition: dragging || reduced ? undefined : "transform 160ms var(--ease-paper)",
            }}
          >
            <svg
              aria-hidden
              className="pointer-events-none absolute"
              width={layout.w || 1}
              height={layout.h || 1}
              style={{ left: 0, top: 0, direction: "ltr", overflow: "visible" }}
            >
              {layout.edges.map((e) => {
                const mid = (e.y1 + e.y2) / 2;
                // a stacked run reads better as one spine with short arms than
                // as a fan of curves that all start at the same point
                const d = e.stacked
                  ? `M ${e.x1} ${e.y1} L ${e.x1} ${e.y2 - 6} L ${e.x2} ${e.y2 - 6} L ${e.x2} ${e.y2}`
                  : `M ${e.x1} ${e.y1} C ${e.x1} ${mid}, ${e.x2} ${mid}, ${e.x2} ${e.y2}`;
                return (
                  <path
                    key={e.key}
                    d={d}
                    fill="none"
                    stroke="var(--connection)"
                    strokeWidth={1.25}
                  />
                );
              })}
            </svg>
            <div className="relative flex items-start justify-center">
              {roots.map((root) => (
                <Branch key={root.id} node={root} ctx={ctx} />
              ))}
            </div>
          </div>

          {/* zoom controls */}
          <div className="absolute top-3 end-3 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => zoomBy(1.2)}
              aria-label={t("zoomIn")}
              className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-sand-300 bg-white text-ink-600 shadow-[var(--shadow-paper)] hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
            >
              <Plus className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => zoomBy(1 / 1.2)}
              aria-label={t("zoomOut")}
              className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-sand-300 bg-white text-ink-600 shadow-[var(--shadow-paper)] hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
            >
              <Minus className="size-4" />
            </button>
            <button
              type="button"
              onClick={fit}
              aria-label={t("fit")}
              className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-sand-300 bg-white text-ink-600 shadow-[var(--shadow-paper)] hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
            >
              <Scan className="size-4" />
            </button>
          </div>

          {/* the mini-map */}
          {layout.w > 0 ? (
            <div
              data-testid="org-minimap"
              aria-hidden
              className="pointer-events-none absolute bottom-3 end-3 hidden h-24 w-36 rounded-lg border border-sand-300 bg-white/85 p-1 shadow-[var(--shadow-paper)] sm:block"
            >
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${Math.max(1, layout.w)} ${Math.max(1, layout.h)}`}
                preserveAspectRatio="xMidYMid meet"
                style={{ direction: "ltr" }}
              >
                {layout.boxes.map((b) => (
                  <rect
                    key={b.id}
                    x={b.x}
                    y={b.y}
                    width={b.w}
                    height={b.h}
                    rx={6}
                    fill={
                      selectedNode && b.id === selectedNode.id
                        ? "var(--color-maroon-700)"
                        : "var(--color-sand-300)"
                    }
                  />
                ))}
                <rect
                  x={viewportRect.x}
                  y={viewportRect.y}
                  width={Math.max(1, viewportRect.w)}
                  height={Math.max(1, viewportRect.h)}
                  fill="none"
                  stroke="var(--color-maroon-500)"
                  strokeWidth={Math.max(2, layout.w / 200)}
                />
              </svg>
            </div>
          ) : null}
        </div>
      ) : (
        <ul
          data-testid="org-list-view"
          aria-label={t("listAria")}
          className="flex flex-col gap-1.5"
        >
          {flat.map(({ node, depth }) => (
            <ListRow key={node.id} node={node} depth={depth} ctx={ctx} />
          ))}
        </ul>
      )}

      {/* the unit panel beneath the chart, with the pointer tail */}
      <div ref={anchorRef} className="relative mt-4 scroll-mt-24">
        {selected && pointerX !== null ? (
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
          {selected ? (
            <motion.div
              key="unit-panel"
              initial={reduced ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduced ? undefined : { height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-visible"
            >
              {panelData ? (
                <UnitPanel data={panelData} onClose={closePanel} onSelectUnit={selectCode} />
              ) : pending || requestedRef.current !== selected ? (
                <div
                  className="rounded-2xl bg-sand-100 px-7 py-6"
                  aria-busy
                  aria-label={t("loadingPanel")}
                >
                  <Skeleton className="h-7 w-64" />
                  <Skeleton className="mt-3 h-4 w-40" />
                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                </div>
              ) : (
                <p className="rounded-2xl bg-sand-100 px-7 py-6 text-sm text-ink-600">
                  {tc("notFound")}
                </p>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
