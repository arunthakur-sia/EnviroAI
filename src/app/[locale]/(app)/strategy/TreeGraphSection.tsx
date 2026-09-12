"use client";
// Tree / graph toggle below the outcome arc.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ListTree, Workflow, ChevronDown } from "lucide-react";
import { cn, bi, truncate } from "@/lib/utils";
import { RagDot, Chip } from "@/components/ui/primitives";

export type GraphNode = {
  id: string;
  parentId: string | null;
  nodeType: string;
  code: string | null;
  titleEn: string;
  titleAr: string;
  status: string;
  ownerEntityName: string | null;
  verified: boolean;
};

export function TreeGraphSection({
  nodes,
  archived: _archived,
}: {
  nodes: GraphNode[];
  archived: boolean;
}) {
  const t = useTranslations("strategy");
  const [view, setView] = React.useState<"tree" | "graph">("tree");
  return (
    <div>
      <div className="mb-4 inline-flex items-center gap-0.5 rounded-xl bg-sand-100 p-1">
        {(
          [
            ["tree", ListTree],
            ["graph", Workflow],
          ] as const
        ).map(([mode, Icon]) => (
          <button
            key={mode}
            onClick={() => setView(mode)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm transition-colors cursor-pointer",
              view === mode ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
            )}
          >
            <Icon className="size-4" /> {t(`view.${mode}`)}
          </button>
        ))}
      </div>
      {view === "tree" ? <StrategyTree nodes={nodes} /> : <StrategyGraph nodes={nodes} />}
    </div>
  );
}

/* ---------------- Tree ---------------- */

function StrategyTree({ nodes }: { nodes: GraphNode[] }) {
  const roots = nodes.filter((n) => !n.parentId);
  const childrenOf = React.useMemo(() => {
    const m = new Map<string, GraphNode[]>();
    for (const n of nodes) {
      if (!n.parentId) continue;
      (m.get(n.parentId) ?? m.set(n.parentId, []).get(n.parentId)!).push(n);
    }
    return m;
  }, [nodes]);
  return (
    <div className="card px-2 py-2">
      {roots.map((r) => (
        <TreeRow key={r.id} node={r} childrenOf={childrenOf} depth={0} />
      ))}
    </div>
  );
}

function TreeRow({
  node,
  childrenOf,
  depth,
}: {
  node: GraphNode;
  childrenOf: Map<string, GraphNode[]>;
  depth: number;
}) {
  const locale = useLocale();
  const t = useTranslations("strategy");
  const router = useRouter();
  const kids = childrenOf.get(node.id) ?? [];
  const [open, setOpen] = React.useState(depth === 0);

  return (
    <div>
      <div
        className={cn(
          "group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-maroon-50",
          depth === 0 && "py-2"
        )}
        style={{ paddingInlineStart: `${depth * 22 + 8}px` }}
        onClick={() => router.push(`/strategy/${node.id}` as never)}
      >
        {kids.length ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
            className="rounded p-0.5 text-ink-400 hover:bg-sand-100 cursor-pointer"
            aria-label={open ? t("collapse") : t("expand")}
          >
            <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90 rtl:rotate-90")} />
          </button>
        ) : (
          <span className="w-[18px]" />
        )}
        <RagDot status={node.status} />
        {node.code ? <span className="shrink-0 text-[10px] font-semibold text-ink-400 tnum">{node.code}</span> : null}
        <span
          className={cn(
            "min-w-0 truncate text-sm",
            depth === 0 ? "font-medium text-ink-900" : "text-ink-900"
          )}
        >
          {bi(locale, node.titleEn, node.titleAr)}
        </span>
        <Chip tone="ghost" className="ms-auto hidden shrink-0 sm:inline-flex">
          {t(`nodeType.${node.nodeType}` as never)}
        </Chip>
        {node.ownerEntityName ? (
          <span className="hidden max-w-40 shrink-0 truncate text-[11px] text-ink-400 lg:block">
            {node.ownerEntityName}
          </span>
        ) : null}
      </div>
      {open
        ? kids.map((k) => (
            <TreeRow key={k.id} node={k} childrenOf={childrenOf} depth={depth + 1} />
          ))
        : null}
    </div>
  );
}

/* ---------------- Graph (d3-force) ---------------- */

function StrategyGraph({ nodes }: { nodes: GraphNode[] }) {
  const locale = useLocale();
  const router = useRouter();
  const ref = React.useRef<SVGSVGElement>(null);
  const [positions, setPositions] = React.useState<Map<string, { x: number; y: number }>>(new Map());
  const [hover, setHover] = React.useState<GraphNode | null>(null);
  const width = 1100;
  const height = 640;

  const graphNodes = React.useMemo(
    () => nodes.filter((n) => ["outcome", "sector_strategy", "cluster", "enabler", "initiative"].includes(n.nodeType)).slice(0, 130),
    [nodes]
  );

  React.useEffect(() => {
    let stopped = false;
    (async () => {
      const d3 = await import("d3-force");
      const ids = new Set(graphNodes.map((n) => n.id));
      const simNodes = graphNodes.map((n) => ({ id: n.id, type: n.nodeType })) as any[];
      const links = graphNodes
        .filter((n) => n.parentId && ids.has(n.parentId))
        .map((n) => ({ source: n.parentId!, target: n.id }));
      const sim = d3
        .forceSimulation(simNodes)
        .force("link", d3.forceLink(links).id((d: any) => d.id).distance(60).strength(0.6))
        .force("charge", d3.forceManyBody().strength(-160))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius((d: any) => (d.type === "outcome" || d.type === "sector_strategy" ? 46 : 16)))
        .stop();
      for (let i = 0; i < 220 && !stopped; i++) sim.tick();
      const pos = new Map<string, { x: number; y: number }>();
      for (const n of simNodes) pos.set(n.id, { x: n.x, y: n.y });
      if (!stopped) setPositions(pos);
    })();
    return () => {
      stopped = true;
    };
  }, [graphNodes]);

  const color = (t: string) =>
    t === "outcome" || t === "sector_strategy"
      ? "var(--color-maroon-700)"
      : t === "cluster"
        ? "var(--color-gulf-600)"
        : t === "enabler"
          ? "var(--color-gold-500)"
          : "var(--color-maroon-300)";
  const radius = (t: string) =>
    t === "outcome" || t === "sector_strategy" ? 34 : t === "cluster" || t === "enabler" ? 18 : 8;

  return (
    <div className="card relative overflow-hidden">
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        className="h-[540px] w-full"
        role="img"
        style={{ direction: "ltr" }}
      >
        {graphNodes
          .filter((n) => n.parentId && positions.has(n.parentId) && positions.has(n.id))
          .map((n) => {
            const a = positions.get(n.parentId!)!;
            const b = positions.get(n.id)!;
            return (
              <line
                key={`l-${n.id}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--color-sand-300)"
                strokeWidth={1}
              />
            );
          })}
        {graphNodes.map((n, i) => {
          const p = positions.get(n.id);
          if (!p) return null;
          const r = radius(n.nodeType);
          return (
            <g
              key={n.id}
              transform={`translate(${p.x},${p.y})`}
              className="cursor-pointer"
              onClick={() => router.push(`/strategy/${n.id}` as never)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(null)}
            >
              <circle
                r={r}
                fill={color(n.nodeType)}
                opacity={hover && hover.id !== n.id ? 0.5 : 0.92}
                style={{
                  transition: "opacity 150ms",
                  animation: `graph-pop 500ms ${i * 8}ms var(--ease-paper) backwards`,
                }}
              />
              {r >= 18 ? (
                <text
                  textAnchor="middle"
                  dy={r + 14}
                  fontSize={11}
                  fill="var(--color-ink-600)"
                >
                  {truncate(bi(locale, n.titleEn, n.titleAr), 26)}
                </text>
              ) : null}
            </g>
          );
        })}
        <style>{`@keyframes graph-pop { from { opacity: 0; } }`}</style>
      </svg>
      {hover ? (
        <div className="pointer-events-none absolute bottom-4 start-4 max-w-xs rounded-xl border border-sand-300 bg-white px-4 py-3 shadow-[var(--shadow-pop)]">
          <p className="text-sm font-medium text-ink-900">{bi(locale, hover.titleEn, hover.titleAr)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-600">
            <RagDot status={hover.status} /> {hover.nodeType}
            {hover.ownerEntityName ? ` · ${hover.ownerEntityName}` : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}
