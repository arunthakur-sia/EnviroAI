"use client";
// CR03 3.2: a real radar. Semicircle with three horizon bands and one wedge
// per signal type; every accepted signal of the last 180 days is a blip sized
// by impact and coloured by sentiment, high-impact blips pulse, and a sweep
// reveals the field once on load. Band and wedge labels filter the briefing;
// hovering a blip raises a card; clicking it jumps to the signal's card.
// Small screens get a full 320px circle with the labels listed beneath.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Chip } from "@/components/ui/primitives";
import type { BoardSignal } from "./board-types";

const TYPES = [
  "policy",
  "market",
  "technology",
  "social",
  "environment",
  "geopolitical",
  "index",
  "research",
] as const;
const BANDS = ["near", "mid", "long"] as const;

const SENTIMENT_FILL: Record<string, string> = {
  positive: "var(--color-gulf-600)",
  negative: "rgba(179, 38, 30, 0.8)",
  neutral: "var(--color-ink-400)",
  mixed: "var(--color-warn)",
};
const IMPACT_R: Record<string, number> = { high: 9, medium: 6, low: 4 };
const IMPACT_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const p = (r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(r1, a0);
  const [x1, y1] = p(r1, a1);
  const [x2, y2] = p(r0, a1);
  const [x3, y3] = p(r0, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0} ${y0} A ${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
}

type Blip = {
  signal: BoardSignal;
  x: number;
  y: number;
  r: number;
  angle: number; // 0..1 along the sweep
};

export function SignalRadar({
  signals,
  hoveredId,
  onHoverSignal,
  onOpenSignal,
  onFilterBand,
  onFilterWedge,
}: {
  signals: BoardSignal[]; // accepted, last 180 days, already filtered
  hoveredId: string | null;
  onHoverSignal: (id: string | null) => void;
  onOpenSignal: (id: string) => void;
  onFilterBand: (band: string) => void;
  onFilterWedge: (type: string) => void;
}) {
  const t = useTranslations("trends");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const [small, setSmall] = React.useState(false);
  const [swept, setSwept] = React.useState(false);
  const [card, setCard] = React.useState<{ x: number; y: number; signal: BoardSignal } | null>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setSmall(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  React.useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setSwept(true);
      return;
    }
    const timer = setTimeout(() => setSwept(true), 1700);
    return () => clearTimeout(timer);
  }, []);

  // geometry: semicircle (flat side at the bottom) or a full circle on small
  const W = small ? 320 : 680;
  const H = small ? 320 : 330;
  const cx = W / 2;
  const cy = small ? H / 2 : H - 34;
  const R0 = small ? 26 : 48; // inner hole
  const bandWidth = small ? 40 : 74;
  const bands = BANDS.map((b, i) => ({
    key: b,
    r0: R0 + i * bandWidth,
    r1: R0 + (i + 1) * bandWidth,
  }));
  const RMAX = R0 + 3 * bandWidth;
  const fullAngle = small ? Math.PI * 2 : Math.PI;
  const baseAngle = Math.PI; // semicircle: from 180deg to 360deg (upper half)
  const slice = fullAngle / TYPES.length;

  // wedge angle for type index i; RTL mirrors so the first type starts at the
  // reader's start side (CR03 5)
  const wedgeAngle = (i: number): [number, number] => {
    if (!isRtl) return [baseAngle + i * slice, baseAngle + (i + 1) * slice];
    return [baseAngle + fullAngle - (i + 1) * slice, baseAngle + fullAngle - i * slice];
  };

  const blips = React.useMemo(() => {
    const out: Blip[] = [];
    for (const s of signals) {
      const ti = TYPES.indexOf(s.signalType as (typeof TYPES)[number]);
      const bi_ = BANDS.indexOf(s.horizon as (typeof BANDS)[number]);
      if (ti < 0 || bi_ < 0) continue;
      const [a0, a1] = wedgeAngle(ti);
      const h = hashOf(s.id);
      const angle = a0 + (0.14 + ((h % 997) / 997) * 0.72) * (a1 - a0);
      const band = bands[bi_];
      const rr = band.r0 + 10 + (((h >> 9) % 997) / 997) * (band.r1 - band.r0 - 20);
      out.push({
        signal: s,
        x: cx + rr * Math.cos(angle),
        y: cy + rr * Math.sin(angle),
        r: IMPACT_R[s.impact] ?? 5,
        angle: ((angle - baseAngle + Math.PI * 2) % (Math.PI * 2)) / fullAngle,
      });
    }
    // keyboard order and paint order: high impact first
    return out.sort(
      (a, b) =>
        (IMPACT_RANK[a.signal.impact] ?? 3) - (IMPACT_RANK[b.signal.impact] ?? 3) ||
        (b.signal.publishedAt ?? "").localeCompare(a.signal.publishedAt ?? "")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals, small, isRtl]);

  const showCard = (e: React.MouseEvent | React.FocusEvent, signal: BoardSignal) => {
    const wrap = wrapRef.current?.getBoundingClientRect();
    const target = (e.target as SVGElement).getBoundingClientRect();
    if (!wrap) return;
    setCard({
      x: target.left + target.width / 2 - wrap.left,
      y: target.top - wrap.top,
      signal,
    });
    onHoverSignal(signal.id);
  };
  const hideCard = () => {
    setCard(null);
    onHoverSignal(null);
  };

  const bandFills = ["var(--color-sand-100)", "var(--color-sand-50)", "#ffffff"];

  return (
    <div ref={wrapRef} className="relative" data-testid="signal-radar">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mx-auto block w-full"
          style={{ maxHeight: small ? 340 : 420, maxWidth: small ? 340 : 900 }}
          role="img"
          aria-label={t("radar.aria")}
        >
          {/* horizon bands */}
          {bands.map((b, i) => (
            <path
              key={b.key}
              d={arcPath(cx, cy, b.r0, b.r1, baseAngle, baseAngle + fullAngle - 0.0001)}
              fill={bandFills[i]}
              stroke="var(--color-sand-300)"
              strokeWidth={1}
            />
          ))}
          {/* wedge dividers */}
          {TYPES.map((_, i) => {
            if (i === 0 && !small) return null;
            const [a0] = wedgeAngle(i);
            return (
              <line
                key={i}
                x1={cx + R0 * Math.cos(a0)}
                y1={cy + R0 * Math.sin(a0)}
                x2={cx + RMAX * Math.cos(a0)}
                y2={cy + RMAX * Math.sin(a0)}
                stroke="var(--color-sand-300)"
                strokeWidth={1}
              />
            );
          })}
          {/* flat base line for the semicircle */}
          {!small ? (
            <line
              x1={cx - RMAX}
              y1={cy}
              x2={cx + RMAX}
              y2={cy}
              stroke="var(--color-sand-300)"
              strokeWidth={1}
            />
          ) : null}

          {/* wedge labels on the outer arc (upright, clickable filter) */}
          {!small
            ? TYPES.map((type, i) => {
                const [a0, a1] = wedgeAngle(i);
                const mid = (a0 + a1) / 2;
                const lx = cx + (RMAX + 16) * Math.cos(mid);
                const ly = cy + (RMAX + 16) * Math.sin(mid);
                const anchor =
                  Math.cos(mid) < -0.35 ? "end" : Math.cos(mid) > 0.35 ? "start" : "middle";
                return (
                  <text
                    key={type}
                    x={lx}
                    y={ly}
                    textAnchor={isRtl ? (anchor === "end" ? "start" : anchor === "start" ? "end" : "middle") : anchor}
                    fontSize={10.5}
                    fontWeight={600}
                    letterSpacing="0.08em"
                    fill="var(--color-ink-600)"
                    className="cursor-pointer uppercase hover:fill-maroon-700"
                    role="button"
                    tabIndex={0}
                    aria-label={t("radar.filterWedge", { type: t(`types.${type}` as never) })}
                    onClick={() => onFilterWedge(type)}
                    onKeyDown={(e) => e.key === "Enter" && onFilterWedge(type)}
                    style={{ direction: isRtl ? "rtl" : "ltr" }}
                  >
                    {t(`types.${type}` as never)}
                  </text>
                );
              })
            : null}

          {/* band labels along the flat base */}
          {!small
            ? bands.map((b) => (
                <text
                  key={b.key}
                  x={isRtl ? cx + (b.r0 + b.r1) / 2 : cx - (b.r0 + b.r1) / 2}
                  y={cy + 16}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill="var(--color-ink-600)"
                  className="cursor-pointer hover:fill-maroon-700"
                  role="button"
                  tabIndex={0}
                  aria-label={t("radar.filterBand", { band: t(`radar.bands.${b.key}` as never) })}
                  onClick={() => onFilterBand(b.key)}
                  onKeyDown={(e) => e.key === "Enter" && onFilterBand(b.key)}
                  style={{ direction: isRtl ? "rtl" : "ltr" }}
                >
                  {t(`radar.bandsShort.${b.key}` as never)}
                </text>
              ))
            : null}

          {/* blips */}
          {blips.map((b) => {
            const isHover = hoveredId === b.signal.id;
            const fill = SENTIMENT_FILL[b.signal.sentiment] ?? SENTIMENT_FILL.neutral;
            const delay = swept ? 0 : 0.05 + b.angle * 1.5;
            return (
              <g
                key={b.signal.id}
                data-testid="radar-blip"
                style={{
                  opacity: swept ? 1 : 0,
                  animation: swept ? undefined : `radar-blip-in 200ms ease-out ${delay}s forwards`,
                }}
              >
                {b.signal.impact === "high" ? (
                  <circle className="dot-pulse" cx={b.x} cy={b.y} r={b.r} fill={fill} opacity={0.25} />
                ) : null}
                {isHover ? (
                  <circle
                    cx={b.x}
                    cy={b.y}
                    r={b.r + 5}
                    fill="none"
                    stroke="var(--color-maroon-700)"
                    strokeWidth={1.5}
                  />
                ) : null}
                <circle
                  cx={b.x}
                  cy={b.y}
                  r={isHover ? b.r + 1.5 : b.r}
                  fill={fill}
                  stroke="#fff"
                  strokeWidth={1}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`${bi(locale, b.signal.titleEn, b.signal.titleAr)} · ${t(`impact.${b.signal.impact}` as never)} · ${t(`horizon.${b.signal.horizon}` as never)}`}
                  onMouseEnter={(e) => showCard(e, b.signal)}
                  onMouseLeave={hideCard}
                  onFocus={(e) => showCard(e, b.signal)}
                  onBlur={hideCard}
                  onClick={() => onOpenSignal(b.signal.id)}
                  onKeyDown={(e) => e.key === "Enter" && onOpenSignal(b.signal.id)}
                />
              </g>
            );
          })}

          {/* the one-time sweep */}
          {!swept && blips.length ? (
            <g
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                animation: `radar-sweep 1.6s linear forwards`,
                animationDirection: isRtl && !small ? "reverse" : "normal",
              }}
            >
              <path
                d={`M ${cx} ${cy} L ${cx + RMAX * Math.cos(baseAngle)} ${cy + RMAX * Math.sin(baseAngle)} A ${RMAX} ${RMAX} 0 0 1 ${cx + RMAX * Math.cos(baseAngle + 0.21)} ${cy + RMAX * Math.sin(baseAngle + 0.21)} Z`}
                fill="rgba(138, 21, 56, 0.14)"
              />
            </g>
          ) : null}

          {/* empty state rings already drawn; the message sits under the svg */}
        </svg>

        {/* legend at the end side (CR03 3.2) */}
        <div className="shrink-0 lg:w-44" data-testid="radar-legend">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600" style={{ fontFamily: "inherit" }}>
            {t("radar.legend")}
          </p>
          <p className="mb-1 text-[11px] text-ink-600">{t("radar.legendImpact")}</p>
          <div className="mb-3 flex flex-col gap-1">
            {(["high", "medium", "low"] as const).map((impact) => (
              <span key={impact} className="flex items-center gap-1.5 text-[11px] text-ink-600">
                <span
                  className="inline-block shrink-0 rounded-full bg-ink-400"
                  style={{ width: IMPACT_R[impact] * 2 - 2, height: IMPACT_R[impact] * 2 - 2 }}
                  aria-hidden
                />
                {t(`radar.impactShort.${impact}` as never)}
              </span>
            ))}
          </div>
          <p className="mb-3 text-[10px] leading-relaxed text-ink-600">
            {t("radar.bands.near")} · {t("radar.bands.mid")} · {t("radar.bands.long")}
          </p>
          <p className="mb-1 text-[11px] text-ink-600">{t("radar.legendSentiment")}</p>
          <div className="flex flex-col gap-1">
            {(["positive", "negative", "neutral", "mixed"] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5 text-[11px] text-ink-600">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ background: SENTIMENT_FILL[s] }}
                  aria-hidden
                />
                {t(`radar.sentiment.${s}` as never)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* small screens: the labels as a list beneath the circle (CR03 3.2) */}
      {small ? (
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
          {TYPES.map((type) => {
            const count = signals.filter((s) => s.signalType === type).length;
            if (!count) return null;
            return (
              <button
                key={type}
                onClick={() => onFilterWedge(type)}
                className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-start text-[11px] text-ink-600 hover:text-maroon-700 cursor-pointer"
              >
                <span>{t(`types.${type}` as never)}</span>
                <span className="tnum">{count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {signals.length === 0 ? (
        <p className="mt-2 text-center text-sm text-ink-600" data-testid="radar-empty">
          {t("radar.empty")}
        </p>
      ) : null}

      {/* blip hover card */}
      {card ? (
        <div
          className="pointer-events-none absolute z-20 w-72 -translate-x-1/2 -translate-y-full"
          style={{ left: card.x, top: card.y - 8 }}
        >
          <div className="card p-3 text-start shadow-[var(--shadow-pop)]">
            <p className="mb-0.5 flex items-center gap-2 text-[11px] text-ink-600">
              <span className="truncate font-medium">{card.signal.publisher ?? ""}</span>
              {card.signal.publishedAt ? (
                <span className="tnum shrink-0">{formatDate(card.signal.publishedAt, locale)}</span>
              ) : null}
            </p>
            <p className="line-clamp-2 text-sm font-medium leading-snug text-ink-900">
              {bi(locale, card.signal.titleEn, card.signal.titleAr)}
            </p>
            {card.signal.whyEn || card.signal.whyAr ? (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-600">
                {bi(locale, card.signal.whyEn ?? "", card.signal.whyAr ?? "")}
              </p>
            ) : null}
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Chip tone={card.signal.impact === "high" ? "danger" : card.signal.impact === "medium" ? "warn" : "sand"}>
                {t(`impact.${card.signal.impact}` as never)}
              </Chip>
              <Chip tone="sand">{t(`horizon.${card.signal.horizon}` as never)}</Chip>
              {card.signal.outcomes.slice(0, 2).map((o) => (
                <Chip key={o.code} tone="maroon">
                  {o.code}
                </Chip>
              ))}
            </p>
          </div>
        </div>
      ) : null}

      <style>{`
        @keyframes radar-blip-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes radar-sweep {
          from { transform: rotate(0deg); opacity: 1; }
          92% { opacity: 1; }
          to { transform: rotate(${small ? 360 : 180}deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="signal-radar"] g { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
    </div>
  );
}
