"use client";
// CR03 4.2: the knowledge constellation behind Home. An SVG layer of small
// nodes and thin curved lines generated from real relations (documents,
// lessons, indicators, experts around the seven outcomes), drifting slowly.
// Hovering a card brightens the lines of its outcome; focusing the Ask hero
// dims the whole field. Never distracting: 3px nodes, sand lines.
import * as React from "react";
import { useConnections } from "./connections";

export type ConstellationData = {
  hubs: { tax: string; code: string; nameEn: string; nameAr: string }[];
  satellites: { id: string; type: string; outcome: string }[];
};

function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const W = 1240;
const H = 1400;

export function Constellation({ data }: { data: ConstellationData }) {
  const conn = useConnections();
  const hovered = conn?.hovered ?? null;
  const dimmed = conn?.askFocused ?? false;

  const { nodes, links } = React.useMemo(() => {
    // hubs spread over the canvas in a loose ring around the content
    const hubPos = new Map<string, { x: number; y: number }>();
    data.hubs.forEach((hub, i) => {
      const angle = (i / Math.max(1, data.hubs.length)) * Math.PI * 2 - Math.PI / 2;
      hubPos.set(hub.tax, {
        x: W / 2 + Math.cos(angle) * (W * 0.4),
        y: H / 2 + Math.sin(angle) * (H * 0.42),
      });
    });
    const nodes: { id: string; x: number; y: number; outcome: string; hub: boolean }[] = [];
    for (const hub of data.hubs) {
      const p = hubPos.get(hub.tax)!;
      nodes.push({ id: `hub:${hub.tax}`, x: p.x, y: p.y, outcome: hub.tax, hub: true });
    }
    const links: { x1: number; y1: number; x2: number; y2: number; outcome: string }[] = [];
    for (const s of data.satellites) {
      const hub = hubPos.get(s.outcome);
      if (!hub) continue;
      const h = hashOf(s.id);
      const angle = ((h % 997) / 997) * Math.PI * 2;
      const dist = 60 + (((h >> 9) % 997) / 997) * 150;
      const x = Math.min(W - 8, Math.max(8, hub.x + Math.cos(angle) * dist));
      const y = Math.min(H - 8, Math.max(8, hub.y + Math.sin(angle) * dist * 0.8));
      nodes.push({ id: s.id, x, y, outcome: s.outcome, hub: false });
      links.push({ x1: hub.x, y1: hub.y, x2: x, y2: y, outcome: s.outcome });
    }
    return { nodes, links };
  }, [data]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMin slice"
      aria-hidden
      data-testid="constellation"
      className="pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-300"
      style={{ opacity: dimmed ? 0.4 : 1 }}
    >
      <g className="constellation-drift">
        {links.map((l, i) => {
          const lit = hovered !== null && l.outcome === hovered;
          // a soft curve: control point offset perpendicular to the line
          const mx = (l.x1 + l.x2) / 2 + (l.y2 - l.y1) * 0.12;
          const my = (l.y1 + l.y2) / 2 - (l.x2 - l.x1) * 0.12;
          return (
            <path
              key={i}
              d={`M ${l.x1} ${l.y1} Q ${mx} ${my} ${l.x2} ${l.y2}`}
              fill="none"
              stroke={lit ? "rgba(23, 48, 68, 0.6)" : "var(--connection)"}
              strokeWidth={lit ? 1.2 : 1}
              style={{ transition: "stroke 300ms var(--ease-paper)" }}
            />
          );
        })}
        {nodes.map((n) => {
          const lit = hovered !== null && n.outcome === hovered;
          return (
            <circle
              key={n.id}
              cx={n.x}
              cy={n.y}
              r={lit ? (n.hub ? 6 : 4.5) : n.hub ? 4 : 3}
              fill={
                lit
                  ? "rgba(23, 48, 68, 0.6)"
                  : n.hub
                    ? "var(--color-mist-300)"
                    : "var(--color-mist-300)"
              }
              opacity={lit ? 1 : 0.6}
              style={{ transition: "all 300ms var(--ease-paper)" }}
            />
          );
        })}
      </g>
    </svg>
  );
}
