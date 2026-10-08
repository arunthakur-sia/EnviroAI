"use client";
// CR08 1.1: the org chart, rebuilt. A d3-hierarchy tree laid out top-down with
// fixed 220 by 88 cards, drawn inside one SVG that fills a fixed-height,
// user-resizable viewport; pan and zoom are one d3-zoom transform on the root
// group with translate extents (the chart cannot leave the frame), a 0.4 to
// 2.0 scale range, fit-to-width on arrival and on resize, and fit/in/out/reset
// controls plus a mini-map when the tree is wider than the frame. Expanding
// or collapsing a branch recomputes the layout and animates every node and
// connector over 260ms; the frame never changes height because of it. Drag
// pans, the wheel scrolls the page unless Ctrl or Cmd is held, pinch zooms,
// touch drags pan. Level labels come from org_levels and sit as row bands on
// the start side. Arrow keys walk siblings and parent or child, Enter opens
// the unit panel BELOW the frame (with the pointer tail under the card's x)
// and Escape closes it. The list view stays and is the default under 768px.
// DECISIONS 80 still holds: leaf children stack down one column, the sectors
// arrive collapsed, and the fit re-runs until the reader takes over.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { hierarchy, tree, type HierarchyPointNode } from "d3-hierarchy";
import { select } from "d3-selection";
import {
  zoom as d3zoom,
  zoomIdentity,
  type D3ZoomEvent,
  type ZoomBehavior,
  type ZoomTransform,
} from "d3-zoom";
import {
  ArrowUp,
  ChevronDown,
  FileText,
  GripHorizontal,
  Minus,
  Network,
  Plus,
  RotateCcw,
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
import type { OrgLevel, OrgUnitNode, UnitPanelData } from "@/server/services/organisation";
import { UnitPanel } from "./UnitPanel";

/* ------------------------------------------------------------------ */
/* geometry                                                             */
/* ------------------------------------------------------------------ */

const NODE_W = 220;
const NODE_H = 88;
const GAP_X = 20;
const GAP_Y = 64;
const STACK_GAP = 12;
const STACK_SHIFT = 18;
const ROW_PITCH = NODE_H + GAP_Y;
const MIN_Z = 0.4;
const MAX_Z = 2;
const PAD = 28;
const RAIL_W = 108;
const NARROW = 768;
const MIN_HEIGHT = 480;
const MAX_HEIGHT = 1400;
const EASE = [0.22, 1, 0.36, 1] as const;
const ANIM = 0.26;

type LaidNode = {
  id: string;
  unit: OrgUnitNode;
  /** centre x and top y in world units */
  x: number;
  y: number;
  stacked: boolean;
  parentId: string | null;
};
type LaidLink = { key: string; d: string; parentId: string };
type Band = { key: string; levels: string[]; y0: number; y1: number };
type Layout = {
  nodes: LaidNode[];
  links: LaidLink[];
  byId: Map<string, LaidNode>;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  bands: Band[];
};
type Extent = [[number, number], [number, number]];

type TNode =
  | { kind: "unit"; id: string; unit: OrgUnitNode }
  | { kind: "stack"; id: string; parentId: string; items: OrgUnitNode[] }
  | { kind: "dummy"; id: string; rest: number }
  | { kind: "virtual"; id: string; roots: OrgUnitNode[] };

function clampNum(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function childrenOf(node: OrgUnitNode, byId: Map<string, OrgUnitNode>): OrgUnitNode[] {
  const out: OrgUnitNode[] = [];
  for (const id of node.childIds) {
    const child = byId.get(id);
    if (child) out.push(child);
  }
  return out.sort((a, b) => a.sort - b.sort);
}

function descendantCount(node: OrgUnitNode, byId: Map<string, OrgUnitNode>, depth = 0): number {
  if (depth > 8) return 0;
  let total = 0;
  for (const child of childrenOf(node, byId)) total += 1 + descendantCount(child, byId, depth + 1);
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

/** An orthogonal connector with two rounded corners at the mid row. The path
    always has the same shape (M V Q H Q V) so framer-motion can tween it. */
function elbow(x1: number, y1: number, x2: number, y2: number, midY: number): string {
  const dx = x2 - x1;
  const r = Math.min(10, Math.abs(dx) / 2, Math.max(0, (y2 - y1) / 2 - 1));
  const s = Math.sign(dx) || 1;
  return `M ${x1} ${y1} V ${midY - r} Q ${x1} ${midY} ${x1 + s * r} ${midY} H ${x2 - s * r} Q ${x2} ${midY} ${x2} ${midY + r} V ${y2}`;
}

/** The d3-hierarchy layout with DECISIONS 80's stacking: children that lead
    nowhere run DOWN one column when there are more than two, children that
    carry a branch run ACROSS. A stack reserves the rows it covers through a
    chain of dummy nodes so a neighbouring subtree never tucks under it. */
function computeLayout(
  units: OrgUnitNode[],
  byId: Map<string, OrgUnitNode>,
  roots: OrgUnitNode[],
  collapsed: Set<string>,
  levelOrder: string[]
): Layout {
  const empty: Layout = { nodes: [], links: [], byId: new Map(), minX: 0, maxX: 0, minY: 0, maxY: 0, bands: [] };
  if (!roots.length) return empty;
  const stackHeight = (n: number) => n * NODE_H + (n - 1) * STACK_GAP;
  const children = (n: TNode): TNode[] | null => {
    if (n.kind === "virtual") return n.roots.map((u) => ({ kind: "unit", id: u.id, unit: u }));
    if (n.kind === "dummy") return n.rest > 0 ? [{ kind: "dummy", id: `${n.id}+`, rest: n.rest - 1 }] : null;
    if (n.kind === "stack") {
      const rows = Math.ceil(stackHeight(n.items.length) / ROW_PITCH) - 1;
      return rows > 0 ? [{ kind: "dummy", id: `${n.id}:d`, rest: rows - 1 }] : null;
    }
    if (collapsed.has(n.id)) return null;
    const kids = childrenOf(n.unit, byId);
    if (!kids.length) return null;
    const leaves = kids.filter((k) => !childrenOf(k, byId).length);
    const branches = kids.filter((k) => childrenOf(k, byId).length > 0);
    if (leaves.length > 2) {
      return [
        { kind: "stack", id: `${n.id}:stack`, parentId: n.id, items: leaves },
        ...branches.map((u): TNode => ({ kind: "unit", id: u.id, unit: u })),
      ];
    }
    return kids.map((u): TNode => ({ kind: "unit", id: u.id, unit: u }));
  };
  const rootData: TNode =
    roots.length === 1
      ? { kind: "unit", id: roots[0].id, unit: roots[0] }
      : { kind: "virtual", id: "virtual-root", roots };
  const root = hierarchy<TNode>(rootData, children);
  const layout = tree<TNode>()
    .nodeSize([NODE_W + GAP_X, ROW_PITCH])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.06));
  const laid = layout(root);
  const yShift = rootData.kind === "virtual" ? -ROW_PITCH : 0;

  const nodes: LaidNode[] = [];
  const links: LaidLink[] = [];
  const parentOf = (d: HierarchyPointNode<TNode>): string | null => {
    let p = d.parent;
    while (p && p.data.kind !== "unit") p = p.parent;
    return p ? p.data.id : null;
  };
  laid.each((d) => {
    if (d.data.kind === "unit") {
      nodes.push({ id: d.data.id, unit: d.data.unit, x: d.x, y: d.y + yShift, stacked: false, parentId: parentOf(d) });
    } else if (d.data.kind === "stack") {
      d.data.items.forEach((u, i) => {
        nodes.push({
          id: u.id,
          unit: u,
          x: d.x + STACK_SHIFT,
          y: d.y + yShift + i * (NODE_H + STACK_GAP),
          stacked: true,
          parentId: d.data.kind === "stack" ? d.data.parentId : null,
        });
      });
    }
  });
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // connectors: plain elbows, and one spine with short arms per stack
  const stacks = new Map<string, LaidNode[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    const p = nodeById.get(n.parentId);
    if (!p) continue;
    if (n.stacked) {
      const bucket = stacks.get(n.parentId);
      if (bucket) bucket.push(n);
      else stacks.set(n.parentId, [n]);
      continue;
    }
    links.push({ key: `link:${n.id}`, parentId: p.id, d: elbow(p.x, p.y + NODE_H, n.x, n.y, p.y + NODE_H + GAP_Y / 2) });
  }
  for (const [parentId, items] of stacks) {
    const p = nodeById.get(parentId)!;
    const sorted = items.slice().sort((a, b) => a.y - b.y);
    const spineX = sorted[0].x - NODE_W / 2 - STACK_SHIFT + 4;
    const lastArmY = sorted[sorted.length - 1].y + NODE_H / 2;
    links.push({
      key: `spine:${parentId}`,
      parentId,
      d: elbow(p.x, p.y + NODE_H, spineX, lastArmY, p.y + NODE_H + GAP_Y / 2),
    });
    for (const item of sorted) {
      links.push({
        key: `arm:${item.id}`,
        parentId,
        d: `M ${spineX} ${item.y + NODE_H / 2} H ${item.x - NODE_W / 2}`,
      });
    }
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - NODE_W / 2 - (n.stacked ? STACK_SHIFT + 4 : 0));
    maxX = Math.max(maxX, n.x + NODE_W / 2);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y + NODE_H);
  }

  // level bands: one per level, merged when they overlap in y
  const byLevel = new Map<string, { y0: number; y1: number }>();
  for (const n of nodes) {
    const b = byLevel.get(n.unit.level);
    if (b) {
      b.y0 = Math.min(b.y0, n.y);
      b.y1 = Math.max(b.y1, n.y + NODE_H);
    } else byLevel.set(n.unit.level, { y0: n.y, y1: n.y + NODE_H });
  }
  const order = (code: string) => {
    const i = levelOrder.indexOf(code);
    return i < 0 ? 99 : i;
  };
  const raw = [...byLevel.entries()]
    .map(([code, b]) => ({ key: code, levels: [code], y0: b.y0, y1: b.y1 }))
    .sort((a, b) => a.y0 - b.y0 || order(a.levels[0]) - order(b.levels[0]));
  const bands: Band[] = [];
  for (const b of raw) {
    const last = bands[bands.length - 1];
    if (last && b.y0 < last.y1 - 1) {
      last.levels.push(...b.levels);
      last.levels.sort((a, c) => order(a) - order(c));
      last.y1 = Math.max(last.y1, b.y1);
      last.key = last.levels.join("+");
    } else bands.push({ ...b, levels: [...b.levels] });
  }
  return { nodes, links, byId: nodeById, minX, maxX, minY, maxY, bands };
}

/** d3-zoom's constrain, but top-aligned: when the tree is narrower than the
    frame it is centred, when shorter it hangs from the top, and otherwise it
    can never be panned out of view. */
function constrainTransform(t: ZoomTransform, extent: Extent, te: Extent): ZoomTransform {
  const [[ex0, ey0], [ex1, ey1]] = extent;
  const [[wx0, wy0], [wx1, wy1]] = te;
  const vw = ex1 - ex0;
  const vh = ey1 - ey0;
  const cw = (wx1 - wx0) * t.k;
  const ch = (wy1 - wy0) * t.k;
  const x = cw <= vw ? ex0 + (vw - cw) / 2 - wx0 * t.k : clampNum(t.x, ex1 - wx1 * t.k, ex0 - wx0 * t.k);
  const y = ch <= vh ? ey0 - wy0 * t.k : clampNum(t.y, ey1 - wy1 * t.k, ey0 - wy0 * t.k);
  return zoomIdentity.translate(x, y).scale(t.k);
}

function headOf(node: OrgUnitNode, locale: string): { name: string; title: string; color: string } {
  const name = node.head
    ? bi(locale, node.head.nameEn, node.head.nameAr)
    : bi(locale, node.headNameEn ?? "", node.headNameAr ?? "");
  return {
    name,
    title: bi(locale, node.headTitleEn ?? "", node.headTitleAr ?? ""),
    color: node.head?.avatarColor ?? "navy",
  };
}

/* ------------------------------------------------------------------ */
/* shared context for the cards                                         */
/* ------------------------------------------------------------------ */

type TreeCtx = {
  byId: Map<string, OrgUnitNode>;
  collapsed: Set<string>;
  selected: string | null;
  matches: Set<string> | null;
  tabbable: string | null;
  levelLabel: (code: string) => string;
  onSelect: (node: OrgUnitNode) => void;
  onToggle: (id: string) => void;
  onFocusNode: (id: string) => void;
};

/* ------------------------------------------------------------------ */
/* the card, 220 by 88                                                  */
/* ------------------------------------------------------------------ */

const UnitCard = React.memo(function UnitCard({ node, ctx }: { node: OrgUnitNode; ctx: TreeCtx }) {
  const t = useTranslations("organisation");
  const locale = useLocale();
  const name = bi(locale, node.nameEn, node.nameAr);
  const alt = locale === "ar" ? node.nameEn : node.nameAr;
  const head = headOf(node, locale);
  const hasKids = node.childIds.length > 0;
  const collapsed = ctx.collapsed.has(node.id);
  const selected = ctx.selected === node.code;
  const matched = ctx.matches ? ctx.matches.has(node.id) : false;
  const dimmed = ctx.matches !== null && !matched;
  const hidden = collapsed ? descendantCount(node, ctx.byId) : 0;

  return (
    <div className="relative" style={{ width: NODE_W, height: NODE_H }}>
      <button
        type="button"
        onClick={() => ctx.onSelect(node)}
        onFocus={() => ctx.onFocusNode(node.id)}
        tabIndex={ctx.tabbable === node.id ? 0 : -1}
        aria-pressed={selected}
        aria-label={t("openUnit", { unit: name })}
        title={`${name}\n${alt}`}
        data-testid="org-unit-card"
        data-node-id={node.id}
        data-unit-code={node.code}
        className={cn(
          "card flex h-full w-full cursor-pointer flex-col px-3 py-2 text-start transition-[box-shadow,transform,opacity] duration-200 ease-[var(--ease-paper)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500",
          selected && "ring-2 ring-navy-700",
          matched && !selected && "ring-2 ring-navy-500",
          dimmed && "opacity-35",
          !node.isActive && "border-dashed opacity-70"
        )}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-600 rtl:tracking-normal">
            {ctx.levelLabel(node.level)}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-ink-600 tnum">
            <Users className="size-3" aria-hidden />
            {node.headcountTotal}
          </span>
        </span>
        <span className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-4 text-ink-900">{name}</span>
        <span className="mt-auto flex items-center gap-1.5">
          {head.name ? (
            <Avatar name={head.name} color={head.color} size={20} />
          ) : (
            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-mist-200 text-ink-400" aria-hidden>
              <UserRound className="size-3" />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-[11px] leading-4 text-ink-600">
            {head.name || t("headVacant")}
          </span>
          {node.policyCount > 0 ? (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-navy-100 px-1.5 text-[10px] font-medium text-navy-900 tnum"
              title={t("policyChip", { count: node.policyCount })}
            >
              <FileText className="size-2.5" aria-hidden />
              {node.policyCount}
            </span>
          ) : null}
        </span>
      </button>
      {hasKids ? (
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            ctx.onToggle(node.id);
          }}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("expandBranch", { unit: name }) : t("collapseBranch", { unit: name })}
          className="absolute -bottom-3 left-1/2 z-10 flex min-h-6 min-w-6 -translate-x-1/2 cursor-pointer items-center justify-center gap-1 rounded-full border border-mist-300 bg-white px-2 py-1 text-[10px] text-ink-600 shadow-sm transition-colors hover:text-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
        >
          <ChevronDown className={cn("size-3 transition-transform", collapsed && "-rotate-90")} aria-hidden />
          {collapsed && hidden ? <span className="tnum">{t("hiddenUnits", { count: hidden })}</span> : null}
        </button>
      ) : null}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* the nodes and links layer (memoised: it never sees the transform)    */
/* ------------------------------------------------------------------ */

const NodesLayer = React.memo(function NodesLayer({
  layout,
  ctx,
  reduced,
}: {
  layout: Layout;
  ctx: TreeCtx;
  reduced: boolean;
}) {
  const duration = reduced ? 0 : ANIM;
  const parentPos = (parentId: string | null) => {
    const p = parentId ? layout.byId.get(parentId) : undefined;
    return p ? { x: p.x - NODE_W / 2, y: p.y + NODE_H / 2 } : null;
  };
  return (
    <>
      <g fill="none" stroke="var(--connection)" strokeWidth={1.4} strokeLinecap="round">
        <AnimatePresence initial={false}>
          {layout.links.map((l) => (
            <motion.path
              key={l.key}
              initial={{ d: l.d, opacity: 0 }}
              animate={{ d: l.d, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration, ease: EASE }}
            />
          ))}
        </AnimatePresence>
      </g>
      <AnimatePresence initial={false}>
        {layout.nodes.map((n) => {
          const from = parentPos(n.parentId) ?? { x: n.x - NODE_W / 2, y: n.y };
          return (
            <motion.foreignObject
              key={n.id}
              width={NODE_W}
              height={NODE_H + 20}
              style={{ overflow: "visible" }}
              initial={reduced ? false : { attrX: from.x, attrY: from.y, opacity: 0 }}
              animate={{ attrX: n.x - NODE_W / 2, attrY: n.y, opacity: 1 }}
              exit={reduced ? undefined : { attrX: from.x, attrY: from.y, opacity: 0 }}
              transition={{ duration, ease: EASE }}
            >
              <div style={{ width: NODE_W, height: NODE_H }}>
                <UnitCard node={n.unit} ctx={ctx} />
              </div>
            </motion.foreignObject>
          );
        })}
      </AnimatePresence>
    </>
  );
});

/* ------------------------------------------------------------------ */
/* the canvas: fixed frame, zoom, rail, controls, mini-map, resize      */
/* ------------------------------------------------------------------ */

type CanvasHandle = { focusNode: (id: string) => void; scrollIntoView: () => void };

const ChartCanvas = React.forwardRef<
  CanvasHandle,
  {
    layout: Layout;
    ctx: TreeCtx;
    height: number | null;
    onHeightChange: (h: number) => void;
    onHeightCommit: (h: number) => void;
    onKeyNavigate: (key: string, nodeId: string) => void;
    tailRef: React.RefObject<HTMLSpanElement | null>;
    selectedId: string | null;
  }
>(function ChartCanvas({ layout, ctx, height, onHeightChange, onHeightCommit, onKeyNavigate, tailRef, selectedId }, ref) {
  const t = useTranslations("organisation");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const reduced = Boolean(useReducedMotion());
  const containerRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const zoomRef = React.useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const tRef = React.useRef<ZoomTransform>(zoomIdentity);
  const [transform, setTransform] = React.useState<ZoomTransform>(zoomIdentity);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const interactedRef = React.useRef(false);
  const readyRef = React.useRef(false);
  const [hint, setHint] = React.useState(false);
  const hintTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizeRef = React.useRef<{ y: number; h: number } | null>(null);
  const layoutRef = React.useRef(layout);
  layoutRef.current = layout;

  const treeW = Math.max(1, layout.maxX - layout.minX);
  const treeH = Math.max(1, layout.maxY - layout.minY);
  const railStart = isRtl ? 0 : RAIL_W;
  const railEnd = isRtl ? size.w - RAIL_W : size.w;

  /* the zoom's viewport is the frame beside the level rail, so a fitted or
     centred tree never sits under the rail; the rail only covers cards the
     reader has panned towards it */
  const extents = React.useCallback((): { extent: Extent; te: Extent } => {
    const l = layoutRef.current;
    const w = containerRef.current?.clientWidth ?? 0;
    const h = containerRef.current?.clientHeight ?? 0;
    return {
      extent: [
        [isRtl ? 0 : RAIL_W, 0],
        [isRtl ? w - RAIL_W : w, h],
      ],
      te: [
        [l.minX - PAD, l.minY - PAD],
        [l.maxX + PAD, l.maxY + PAD],
      ],
    };
  }, [isRtl]);

  /* programmatic changes tween the transform over 260ms with the paper ease
     (a small rAF loop rather than d3-transition, whose types are absent) */
  const tweenRaf = React.useRef<number | null>(null);
  const apply = React.useCallback(
    (next: ZoomTransform, animate: boolean) => {
      const svg = svgRef.current;
      const z = zoomRef.current;
      if (!svg || !z) return;
      const { extent, te } = extents();
      const target = constrainTransform(next, extent, te);
      if (tweenRaf.current !== null) cancelAnimationFrame(tweenRaf.current);
      tweenRaf.current = null;
      if (!animate || reduced) {
        select(svg).call(z.transform, target);
        return;
      }
      const from = tRef.current;
      const started = performance.now();
      const ease = (t: number) => 1 - Math.pow(1 - t, 3);
      const step = (now: number) => {
        const p = Math.min(1, (now - started) / (ANIM * 1000));
        const e = ease(p);
        const k = from.k + (target.k - from.k) * e;
        const x = from.x + (target.x - from.x) * e;
        const y = from.y + (target.y - from.y) * e;
        select(svg).call(z.transform, zoomIdentity.translate(x, y).scale(k));
        tweenRaf.current = p < 1 ? requestAnimationFrame(step) : null;
      };
      tweenRaf.current = requestAnimationFrame(step);
    },
    [extents, reduced]
  );
  React.useEffect(
    () => () => {
      if (tweenRaf.current !== null) cancelAnimationFrame(tweenRaf.current);
    },
    []
  );

  /* fit to width (and to height when the tree is taller than the frame, so
     nothing is clipped on arrival); capped at 1 so small trees stay life size */
  const fit = React.useCallback(
    (animate: boolean) => {
      const { extent } = extents();
      const l = layoutRef.current;
      const vw = extent[1][0] - extent[0][0];
      const vh = extent[1][1] - extent[0][1];
      if (vw <= 0 || vh <= 0 || !l.nodes.length) return;
      const w = l.maxX - l.minX + 2 * PAD;
      const h = l.maxY - l.minY + 2 * PAD;
      const k = clampNum(Math.min(vw / w, vh / h, 1), MIN_Z, MAX_Z);
      const x = extent[0][0] + (vw - w * k) / 2 - (l.minX - PAD) * k;
      const y = extent[0][1] - (l.minY - PAD) * k;
      apply(zoomIdentity.translate(x, y).scale(k), animate);
    },
    [apply, extents]
  );

  /* d3-zoom on the svg: the transform lands on the root <g> */
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_Z, MAX_Z])
      .filter((event: WheelEvent | MouseEvent | TouchEvent) => {
        if (event.type === "wheel") {
          const e = event as WheelEvent;
          return e.ctrlKey || e.metaKey; // pinch on a trackpad arrives with ctrlKey
        }
        if (event.type === "dblclick") return false;
        if ("button" in event && (event as MouseEvent).button) return false;
        const target = event.target as HTMLElement | null;
        if (target && typeof target.closest === "function" && target.closest("button, a, input")) return false;
        return true;
      })
      .on("start", (e: D3ZoomEvent<SVGSVGElement, unknown>) => {
        if (e.sourceEvent) interactedRef.current = true;
      })
      .on("zoom", (e: D3ZoomEvent<SVGSVGElement, unknown>) => {
        tRef.current = e.transform;
        setTransform(e.transform);
      });
    select(svg).call(z).on("dblclick.zoom", null);
    zoomRef.current = z;
    return () => {
      select(svg).on(".zoom", null);
      zoomRef.current = null;
    };
  }, []);

  /* wheel without a modifier scrolls the page; say how to zoom, once in a while */
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      if (hintTimer.current) return;
      setHint(true);
      hintTimer.current = setTimeout(() => {
        setHint(false);
        hintTimer.current = null;
      }, 1600);
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* the frame's size: fit until the reader takes over, then keep the framing */
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setSize({ w, h });
      if (!w || !h) return;
      if (!interactedRef.current) fit(readyRef.current);
      else apply(tRef.current, false);
      readyRef.current = true;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, apply]);

  /* a new layout (expand, collapse, search) refits until the reader has
     zoomed or panned; afterwards the framing is theirs, only constrained */
  React.useEffect(() => {
    if (!size.w) return;
    if (!interactedRef.current) fit(true);
    else apply(tRef.current, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  const zoomBy = (factor: number) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z) return;
    interactedRef.current = true;
    const { extent, te } = extents();
    const cx = (extent[0][0] + extent[1][0]) / 2;
    const cy = (extent[0][1] + extent[1][1]) / 2;
    const cur = tRef.current;
    const k = clampNum(cur.k * factor, MIN_Z, MAX_Z);
    const ratio = k / cur.k;
    const next = zoomIdentity.translate(cx - (cx - cur.x) * ratio, cy - (cy - cur.y) * ratio).scale(k);
    apply(constrainTransform(next, extent, te), true);
  };

  const reset = () => {
    interactedRef.current = true;
    const { extent } = extents();
    const l = layoutRef.current;
    const root = l.nodes.find((n) => !n.parentId) ?? l.nodes[0];
    if (!root) return;
    const vw = extent[1][0] - extent[0][0];
    apply(zoomIdentity.translate(extent[0][0] + vw / 2 - root.x, extent[0][1] + PAD - root.y), true);
  };

  /** pans just enough to bring a node inside the frame */
  const ensureVisible = React.useCallback(
    (id: string) => {
      const n = layoutRef.current.byId.get(id);
      const z = zoomRef.current;
      const svg = svgRef.current;
      if (!n || !z || !svg) return;
      const { extent } = extents();
      const cur = tRef.current;
      const left = cur.x + (n.x - NODE_W / 2) * cur.k;
      const right = cur.x + (n.x + NODE_W / 2) * cur.k;
      const top = cur.y + n.y * cur.k;
      const bottom = cur.y + (n.y + NODE_H) * cur.k;
      let dx = 0;
      let dy = 0;
      const m = 16;
      if (left < extent[0][0] + m) dx = extent[0][0] + m - left;
      else if (right > extent[1][0] - m) dx = extent[1][0] - m - right;
      if (top < extent[0][1] + m) dy = extent[0][1] + m - top;
      else if (bottom > extent[1][1] - m) dy = extent[1][1] - m - bottom;
      if (!dx && !dy) return;
      interactedRef.current = true;
      apply(zoomIdentity.translate(cur.x + dx, cur.y + dy).scale(cur.k), true);
    },
    [apply, extents]
  );

  React.useImperativeHandle(
    ref,
    () => ({
      focusNode: (id: string) => {
        ensureVisible(id);
        const el = svgRef.current?.querySelector<HTMLButtonElement>(`[data-node-id="${id}"]`);
        el?.focus({ preventScroll: true });
      },
      scrollIntoView: () => {
        containerRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      },
    }),
    [ensureVisible, reduced]
  );

  /* the pointer tail beneath the frame follows the selected card's x */
  React.useEffect(() => {
    const tail = tailRef.current;
    if (!tail) return;
    const n = selectedId ? layout.byId.get(selectedId) : undefined;
    if (!n || !size.w) {
      tail.style.display = "none";
      return;
    }
    const sx = transform.x + n.x * transform.k;
    if (sx < railStart + 20 || sx > railEnd - 20) {
      tail.style.display = "none";
      return;
    }
    tail.style.display = "";
    tail.style.left = `${Math.round(sx) - 12}px`;
  }, [transform, selectedId, layout, size.w, railStart, railEnd, tailRef]);

  /* keyboard: arrows walk the tree, Enter opens, Escape closes */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const id = target.getAttribute?.("data-node-id");
    if (!id) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " ", "Escape"].includes(e.key)) {
      e.preventDefault();
      onKeyNavigate(e.key, id);
    }
  };

  /* the resize handle at the bottom edge */
  const onResizeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const h = containerRef.current?.clientHeight ?? MIN_HEIGHT;
    resizeRef.current = { y: e.clientY, h };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = resizeRef.current;
    if (!start) return;
    onHeightChange(clampNum(start.h + (e.clientY - start.y), MIN_HEIGHT, MAX_HEIGHT));
  };
  const onResizeUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = resizeRef.current;
    if (!start) return;
    resizeRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    onHeightCommit(clampNum(start.h + (e.clientY - start.y), MIN_HEIGHT, MAX_HEIGHT));
  };
  const onResizeKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const h = containerRef.current?.clientHeight ?? MIN_HEIGHT;
    const next = clampNum(h + (e.key === "ArrowDown" ? 24 : -24), MIN_HEIGHT, MAX_HEIGHT);
    onHeightChange(next);
    onHeightCommit(next);
  };

  const wider = treeW * transform.k > railEnd - railStart + 1 || treeH * transform.k > size.h + 1;
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const viewportWorld = {
    x: (railStart - transform.x) / transform.k,
    y: (0 - transform.y) / transform.k,
    w: (railEnd - railStart) / transform.k,
    h: size.h / transform.k,
  };
  const currentHeight = size.h || height || MIN_HEIGHT;

  const onMiniMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const worldW = treeW + 2 * PAD;
    const worldH = treeH + 2 * PAD;
    const scale = Math.min(rect.width / worldW, rect.height / worldH);
    const ox = (rect.width - worldW * scale) / 2;
    const oy = (rect.height - worldH * scale) / 2;
    const wx = layout.minX - PAD + (e.clientX - rect.left - ox) / scale;
    const wy = layout.minY - PAD + (e.clientY - rect.top - oy) / scale;
    const cur = tRef.current;
    interactedRef.current = true;
    const cx = (railStart + railEnd) / 2;
    const cy = size.h / 2;
    apply(zoomIdentity.translate(cx - wx * cur.k, cy - wy * cur.k).scale(cur.k), true);
  };

  const controlClass =
    "flex size-8 cursor-pointer items-center justify-center rounded-lg border border-mist-300 bg-white text-ink-600 shadow-[var(--shadow-paper)] transition-colors hover:text-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500";

  return (
    <div
      ref={containerRef}
      data-testid="org-chart"
      role="group"
      aria-label={t("chartAria")}
      aria-describedby="org-chart-keys"
      onKeyDown={onKeyDown}
      className="relative overflow-hidden rounded-2xl bg-mist-100"
      style={{ height: height ? `${height}px` : "max(480px, 70vh)" }}
    >
      <p id="org-chart-keys" className="sr-only">
        {t("chart.keyboardHint")}
      </p>
      {/* the drawing is pinned to a physical left origin in both directions */}
      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none", direction: "ltr" }}
        aria-hidden={false}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          <NodesLayer layout={layout} ctx={ctx} reduced={reduced} />
        </g>
      </svg>

      {/* the level rail: row bands on the start side */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 z-10"
        style={{
          insetInlineStart: 0,
          width: RAIL_W,
          background: isRtl
            ? "linear-gradient(270deg, var(--color-mist-100) 55%, rgba(0,0,0,0) 100%)"
            : "linear-gradient(90deg, var(--color-mist-100) 55%, rgba(0,0,0,0) 100%)",
        }}
      >
        {layout.bands.map((band) => {
          const top = transform.y + band.y0 * transform.k;
          const h = (band.y1 - band.y0) * transform.k;
          if (top + h < 0 || top > size.h) return null;
          return (
            <div
              key={band.key}
              className="absolute flex flex-col"
              style={{ top, height: h, insetInlineStart: 12, insetInlineEnd: 8 }}
            >
              <span
                className="sticky top-2 line-clamp-3 break-normal text-[10px] font-semibold uppercase leading-tight tracking-[0.05em] text-ink-600 rtl:tracking-normal"
                style={{ maxWidth: RAIL_W - 22 }}
              >
                {band.levels.map((code) => ctx.levelLabel(code)).join(" / ")}
              </span>
              <span
                className="absolute bottom-0 top-0 w-px bg-mist-300"
                style={{ insetInlineEnd: 0 }}
              />
              <span className="absolute top-0 h-px w-2 bg-mist-300" style={{ insetInlineEnd: 0 }} />
              <span className="absolute bottom-0 h-px w-2 bg-mist-300" style={{ insetInlineEnd: 0 }} />
            </div>
          );
        })}
      </div>

      {/* controls */}
      <div className="absolute top-3 z-10 flex flex-col gap-1" style={{ insetInlineEnd: 12 }} role="group" aria-label={t("viewToggle")}>
        <button type="button" onClick={() => zoomBy(1.25)} aria-label={t("zoomIn")} className={controlClass} data-testid="org-zoom-in">
          <Plus className="size-4" />
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.25)} aria-label={t("zoomOut")} className={controlClass} data-testid="org-zoom-out">
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            interactedRef.current = true;
            fit(true);
          }}
          aria-label={t("fit")}
          className={controlClass}
          data-testid="org-fit"
        >
          <Scan className="size-4" />
        </button>
        <button type="button" onClick={reset} aria-label={t("chart.reset")} className={controlClass} data-testid="org-reset">
          <RotateCcw className="size-4" />
        </button>
      </div>

      {/* the zoom hint after a plain wheel */}
      <AnimatePresence>
        {hint ? (
          <motion.div
            key="hint"
            role="status"
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center"
          >
            <span className="rounded-full border border-mist-300 bg-white/95 px-3 py-1 text-xs text-ink-900 shadow-[var(--shadow-paper)]">
              {isMac ? t("chart.zoomHintMac") : t("chart.zoomHint")}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* the mini-map, when the tree does not fit */}
      {wider && layout.nodes.length ? (
        <div
          data-testid="org-minimap"
          className="absolute bottom-5 z-10 hidden h-24 w-36 rounded-lg border border-mist-300 bg-white/90 p-1 shadow-[var(--shadow-paper)] sm:block"
          style={{ insetInlineEnd: 12 }}
        >
          <svg
            width="100%"
            height="100%"
            viewBox={`${layout.minX - PAD} ${layout.minY - PAD} ${treeW + 2 * PAD} ${treeH + 2 * PAD}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ direction: "ltr" }}
            role="img"
            aria-label={t("minimap")}
            onClick={onMiniMapClick}
            className="cursor-pointer"
          >
            {layout.nodes.map((n) => (
              <rect
                key={n.id}
                x={n.x - NODE_W / 2}
                y={n.y}
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill={selectedId === n.id ? "var(--color-navy-700)" : "var(--color-mist-300)"}
              />
            ))}
            <rect
              x={viewportWorld.x}
              y={viewportWorld.y}
              width={Math.max(1, viewportWorld.w)}
              height={Math.max(1, viewportWorld.h)}
              fill="rgba(23, 48, 68, 0.05)"
              stroke="var(--color-navy-500)"
              strokeWidth={Math.max(2, (treeW + 2 * PAD) / 140)}
            />
          </svg>
        </div>
      ) : null}

      {/* the resize handle on the bottom edge; the height is the reader's */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={t("chart.resizeHandle")}
        aria-valuemin={MIN_HEIGHT}
        aria-valuemax={MAX_HEIGHT}
        aria-valuenow={Math.round(currentHeight)}
        tabIndex={0}
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        onPointerCancel={onResizeUp}
        onKeyDown={onResizeKey}
        data-testid="org-resize-handle"
        className="group absolute inset-x-0 bottom-0 z-10 flex h-4 cursor-row-resize items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-aqua-500"
        title={t("chart.resizeHint", { height: Math.round(currentHeight) })}
      >
        <span className="flex h-2.5 w-12 items-center justify-center rounded-full bg-white/90 text-ink-400 shadow-[var(--shadow-paper)] transition-colors group-hover:text-navy-700">
          <GripHorizontal className="size-3" aria-hidden />
        </span>
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* the list view: the same information, indented                        */
/* ------------------------------------------------------------------ */

function ListRow({ node, depth, ctx }: { node: OrgUnitNode; depth: number; ctx: TreeCtx }) {
  const t = useTranslations("organisation");
  const locale = useLocale();
  const name = bi(locale, node.nameEn, node.nameAr);
  const alt = locale === "ar" ? node.nameEn : node.nameAr;
  const head = headOf(node, locale);
  const kids = childrenOf(node, ctx.byId);
  const collapsed = ctx.collapsed.has(node.id);
  const selected = ctx.selected === node.code;
  const matched = ctx.matches ? ctx.matches.has(node.id) : false;
  const dimmed = ctx.matches !== null && !matched;

  return (
    <li>
      <div className="flex items-center gap-1" style={{ paddingInlineStart: Math.min(depth, 5) * 18 }}>
        {kids.length ? (
          <button
            type="button"
            onClick={() => ctx.onToggle(node.id)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? t("expandBranch", { unit: name }) : t("collapseBranch", { unit: name })}
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-400 hover:text-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", collapsed && "-rotate-90 rtl:rotate-90")} aria-hidden />
          </button>
        ) : (
          <span aria-hidden className="size-6 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => ctx.onSelect(node)}
          aria-pressed={selected}
          aria-label={t("openUnit", { unit: name })}
          data-testid="org-unit-card"
          data-unit-code={node.code}
          className={cn(
            "card flex min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-start transition-colors hover:border-navy-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500",
            selected && "ring-2 ring-navy-700",
            matched && !selected && "ring-2 ring-navy-500",
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
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-mist-200 text-ink-400" aria-hidden>
                <UserRound className="size-3" />
              </span>
            )}
            <span className="max-w-40 truncate text-[11px] text-ink-600">{head.name || t("headVacant")}</span>
          </span>
          <span className="text-[11px] text-ink-600 tnum">{t("staff", { count: node.headcountTotal })}</span>
          <Chip tone="mist">{ctx.levelLabel(node.level)}</Chip>
          {node.policyCount > 0 ? <Chip tone="navy">{t("policyChip", { count: node.policyCount })}</Chip> : null}
        </button>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* the chart                                                            */
/* ------------------------------------------------------------------ */

export function OrgChart({
  units,
  rootId,
  levels,
  panel,
  initialUnit,
  initialHeight,
}: {
  units: OrgUnitNode[];
  rootId: string | null;
  levels: OrgLevel[];
  panel: UnitPanelData | null;
  initialUnit: string | null;
  initialHeight: number | null;
}) {
  const t = useTranslations("organisation");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const reduced = useReducedMotion();

  const [view, setView] = React.useState<"chart" | "list">("chart");
  const [query, setQuery] = React.useState("");
  /* DECISIONS 80: the sectors arrive collapsed */
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => {
    const shut = new Set<string>();
    for (const unit of units) if (unit.parentId && unit.childIds.length) shut.add(unit.id);
    return shut;
  });
  const [selected, setSelected] = React.useState<string | null>(initialUnit);
  const [tabbable, setTabbable] = React.useState<string | null>(null);
  const [height, setHeight] = React.useState<number | null>(initialHeight);
  const [chartAway, setChartAway] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const canvasRef = React.useRef<CanvasHandle>(null);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const tailRef = React.useRef<HTMLSpanElement>(null);
  const chartWrapRef = React.useRef<HTMLDivElement>(null);
  const depthRef = React.useRef(0);
  const requestedRef = React.useRef<string | null>(initialUnit);

  const byId = React.useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const roots = React.useMemo(
    () =>
      units
        .filter((u) => (u.parentId ? !byId.has(u.parentId) : true))
        .sort((a, b) => {
          if (rootId && a.id === rootId) return -1;
          if (rootId && b.id === rootId) return 1;
          return a.sort - b.sort;
        }),
    [units, byId, rootId]
  );
  const levelOrder = React.useMemo(() => levels.map((l) => l.code), [levels]);
  const levelLabel = React.useCallback(
    (code: string) => {
      const level = levels.find((l) => l.code === code);
      return level ? bi(locale, level.nameEn, level.nameAr) : code;
    },
    [levels, locale]
  );

  const needle = query.trim().toLowerCase();
  const matches = React.useMemo(() => {
    if (!needle) return null;
    const set = new Set<string>();
    for (const u of units) {
      const hay = [u.nameEn, u.nameAr, u.code, u.head?.nameEn ?? "", u.head?.nameAr ?? "", u.headNameEn ?? "", u.headNameAr ?? ""]
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

  const layout = React.useMemo(
    () => computeLayout(units, byId, roots, effectiveCollapsed, levelOrder),
    [units, byId, roots, effectiveCollapsed, levelOrder]
  );

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
    const url = code ? `${window.location.pathname}?unit=${encodeURIComponent(code)}` : window.location.pathname;
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

  /* the panel opens below the frame and the page goes to it: once when the
     selection is made, again when the panel has finished growing and when
     its body has arrived, because a smooth scroll is dropped by the browser
     while the document is still changing height */
  const scrollToPanel = React.useCallback(() => {
    anchorRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [reduced]);

  const selectCode = React.useCallback(
    (code: string) => {
      setSelected(code);
      pushUnit(code);
      setTimeout(scrollToPanel, 60);
    },
    [pushUnit, scrollToPanel]
  );

  const onSelect = React.useCallback(
    (node: OrgUnitNode) => {
      setTabbable(node.id);
      if (selected === node.code) {
        closePanel();
        return;
      }
      selectCode(node.code);
    },
    [selected, closePanel, selectCode]
  );

  const onFocusNode = React.useCallback((id: string) => setTabbable(id), []);

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

  /* the body has arrived for the unit the reader chose: settle the scroll */
  const shownRef = React.useRef<string | null>(initialUnit);
  React.useEffect(() => {
    if (!panelData) return;
    if (shownRef.current === panelData.unit.code) return;
    shownRef.current = panelData.unit.code;
    scrollToPanel();
  }, [panelData, scrollToPanel]);

  /* deep link: bring the panel into view once */
  React.useEffect(() => {
    if (!initialUnit) return;
    const timer = setTimeout(() => {
      anchorRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Escape anywhere on the page closes the panel */
  React.useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[role=dialog]")) return;
      closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, closePanel]);

  /* the sticky chip appears once the frame has scrolled away */
  React.useEffect(() => {
    const el = chartWrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setChartAway(!entry.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [view]);

  /* the chart height is the reader's: remembered in their preferences */
  const commitHeight = React.useCallback((h: number) => {
    setHeight(h);
    void fetch("/api/v1/profile/prefs", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orgChartHeight: Math.round(h) }),
    }).catch(() => {});
  }, []);

  /* ---- keyboard walking over the laid-out tree ---- */

  const onKeyNavigate = React.useCallback(
    (key: string, id: string) => {
      const node = layout.byId.get(id);
      if (!node) return;
      const unit = node.unit;
      if (key === "Enter" || key === " ") {
        onSelect(unit);
        return;
      }
      if (key === "Escape") {
        if (selected) closePanel();
        else setQuery("");
        return;
      }
      /* siblings form columns: a stack is one column walked with Up and Down,
         every branch sibling is its own column; Left and Right jump columns */
      const siblings = layout.nodes.filter((n) => n.parentId === node.parentId);
      const stack = siblings.filter((n) => n.stacked).sort((a, b) => a.y - b.y);
      const columns: { x: number; ids: string[] }[] = siblings
        .filter((n) => !n.stacked)
        .map((n) => ({ x: n.x, ids: [n.id] }));
      if (stack.length) columns.push({ x: stack[0].x, ids: stack.map((n) => n.id) });
      columns.sort((a, b) => a.x - b.x);
      const column = columns.findIndex((c) => c.ids.includes(id));
      const index = node.stacked ? stack.findIndex((n) => n.id === id) : 0;
      let nextId: string | null = null;
      if (key === "ArrowLeft") nextId = columns[column - 1]?.ids[0] ?? null;
      else if (key === "ArrowRight") nextId = columns[column + 1]?.ids[0] ?? null;
      else if (key === "ArrowUp") {
        nextId = node.stacked && index > 0 ? stack[index - 1].id : node.parentId;
      } else if (key === "ArrowDown") {
        if (unit.childIds.length) {
          if (effectiveCollapsed.has(unit.id)) {
            onToggle(unit.id);
            const first = childrenOf(unit, byId)[0];
            nextId = first?.id ?? null;
            if (nextId) {
              const target = nextId;
              setTimeout(() => canvasRef.current?.focusNode(target), ANIM * 1000 + 40);
              setTabbable(target);
              return;
            }
          } else {
            const kids = layout.nodes.filter((n) => n.parentId === unit.id).sort((a, b) => a.x - b.x || a.y - b.y);
            nextId = kids[0]?.id ?? null;
          }
        } else if (node.stacked) nextId = stack[index + 1]?.id ?? null;
      }
      if (!nextId) return;
      setTabbable(nextId);
      canvasRef.current?.focusNode(nextId);
    },
    [layout, onSelect, selected, closePanel, effectiveCollapsed, onToggle, byId]
  );

  const ctx: TreeCtx = React.useMemo(
    () => ({
      byId,
      collapsed: effectiveCollapsed,
      selected,
      matches,
      tabbable: tabbable ?? selectedNode?.id ?? roots[0]?.id ?? null,
      levelLabel,
      onSelect,
      onToggle,
      onFocusNode,
    }),
    [byId, effectiveCollapsed, selected, matches, tabbable, selectedNode, roots, levelLabel, onSelect, onToggle, onFocusNode]
  );

  const matchCount = matches ? matches.size : 0;

  return (
    <div className="relative">
      {/* toolbar: search, counts, view toggle */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-80">
          <Search className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-ink-400" style={{ insetInlineStart: 10 }} aria-hidden />
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
              className="absolute top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-ink-400 hover:text-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
              style={{ insetInlineEnd: 6 }}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        {matches ? (
          <span className={cn("text-xs tnum", matchCount ? "text-navy-700" : "text-ink-600")} role="status">
            {matchCount ? t("matches", { count: matchCount }) : t("noMatches")}
          </span>
        ) : (
          <span className="text-xs text-ink-600 tnum">{t("unitsCount", { count: units.length })}</span>
        )}
        <span className="ms-auto inline-flex items-center gap-0.5 rounded-lg bg-mist-100 p-0.5" role="group" aria-label={t("viewToggle")}>
          <button
            type="button"
            onClick={() => setView("chart")}
            aria-pressed={view === "chart"}
            data-testid="org-view-chart"
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500",
              view === "chart" ? "bg-white font-medium text-navy-900 shadow-sm" : "text-ink-600"
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
              "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500",
              view === "list" ? "bg-white font-medium text-navy-900 shadow-sm" : "text-ink-600"
            )}
          >
            <Rows3 className="size-3.5" aria-hidden /> {t("listView")}
          </button>
        </span>
      </div>

      {units.length === 0 ? (
        <p className="rounded-2xl bg-mist-100 px-6 py-10 text-center text-sm text-ink-600">{t("emptyTree")}</p>
      ) : view === "chart" ? (
        <div ref={chartWrapRef}>
          <ChartCanvas
            ref={canvasRef}
            layout={layout}
            ctx={ctx}
            height={height}
            onHeightChange={setHeight}
            onHeightCommit={commitHeight}
            onKeyNavigate={onKeyNavigate}
            tailRef={tailRef}
            selectedId={selectedNode?.id ?? null}
          />
        </div>
      ) : (
        <ul data-testid="org-list-view" aria-label={t("listAria")} className="flex flex-col gap-1.5">
          {flat.map(({ node, depth }) => (
            <ListRow key={node.id} node={node} depth={depth} ctx={ctx} />
          ))}
        </ul>
      )}

      {/* the sticky way back once the frame has scrolled off */}
      <div className="pointer-events-none sticky top-20 z-30 flex justify-center" aria-live="polite">
        <AnimatePresence>
          {selected && chartAway && view === "chart" ? (
            <motion.button
              key="back"
              type="button"
              initial={reduced ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              onClick={() => {
                canvasRef.current?.scrollIntoView();
                if (selectedNode) setTimeout(() => canvasRef.current?.focusNode(selectedNode.id), 400);
              }}
              data-testid="org-back-to-chart"
              className="pointer-events-auto mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-mist-300 bg-white px-3.5 py-1.5 text-xs font-medium text-navy-900 shadow-[var(--shadow-lift)] hover:border-navy-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
            >
              <ArrowUp className="size-3.5" aria-hidden /> {t("chart.backToChart")}
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>

      {/* the unit panel beneath the frame, with the pointer tail */}
      <div ref={anchorRef} className="relative mt-4 scroll-mt-24">
        <span
          ref={tailRef}
          aria-hidden
          data-testid="org-panel-tail"
          className="absolute -top-2.5 z-10 hidden lg:block"
          style={{ left: 40, display: "none", transition: reduced ? undefined : "left 260ms var(--ease-paper)" }}
        >
          <span
            className="block size-6 rotate-45 rounded-[3px] bg-mist-100"
            style={{ borderTop: "1px solid var(--color-mist-300)", borderLeft: "1px solid var(--color-mist-300)" }}
          />
        </span>
        <AnimatePresence initial={false}>
          {selected ? (
            <motion.div
              key="unit-panel"
              initial={reduced ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduced ? undefined : { height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              onAnimationComplete={(definition) => {
                if (definition === "exit") return;
                scrollToPanel();
              }}
              className="overflow-visible"
            >
              {panelData ? (
                <UnitPanel data={panelData} onClose={closePanel} onSelectUnit={selectCode} />
              ) : pending || requestedRef.current !== selected ? (
                <div className="rounded-2xl bg-mist-100 px-7 py-6" aria-busy aria-label={t("loadingPanel")}>
                  <Skeleton className="h-7 w-64" />
                  <Skeleton className="mt-3 h-4 w-40" />
                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                </div>
              ) : (
                <p className="rounded-2xl bg-mist-100 px-7 py-6 text-sm text-ink-600">{tc("notFound")}</p>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
