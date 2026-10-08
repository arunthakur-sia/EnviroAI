"use client";
// CR08 10.2 section 2: the governance map. Bodies are cards laid out in
// tiers (a body sits one tier beneath the body it reports or escalates to),
// and the decision flows are SVG connectors drawn over the measured card
// positions, so the map is RTL-safe by construction: the geometry is read
// from the DOM after layout. Clicking a card expands it in place with its
// decisions, members and escalation path; the connectors re-measure.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarDays, ChevronDown, Gavel, Users } from "lucide-react";
import { bi, cn } from "@/lib/utils";
import { Chip, EmptyState } from "@/components/ui/primitives";
import type { GovernanceBody, GovernanceConnector, GovernanceConnectorKind, GovernanceView } from "@/server/services/operating-model";
import { CONNECTOR_ORDER, CONNECTOR_STYLE, EASE, SectionBand, SubLabel, displayFont } from "./shared";

const UPWARD: GovernanceConnectorKind[] = ["reports_to", "escalates_to"];
const KNOWN_CADENCES = new Set(["weekly", "monthly", "quarterly", "yearly", "annual"]);

type Rect = { x: number; y: number; w: number; h: number };

/** Tier 0 is the body nothing reports to; each body sits beneath its parent. */
function computeTiers(bodies: GovernanceBody[], connectors: GovernanceConnector[]): Map<string, number> {
  const parent = new Map<string, string>();
  for (const c of connectors) {
    if (UPWARD.includes(c.kind) && !parent.has(c.fromId)) parent.set(c.fromId, c.toId);
  }
  for (const b of bodies) {
    if (!parent.has(b.id) && b.escalatesToId) parent.set(b.id, b.escalatesToId);
  }
  const tiers = new Map<string, number>();
  const tierOf = (id: string, depth = 0): number => {
    const known = tiers.get(id);
    if (known != null) return known;
    const p = parent.get(id);
    const tier = p && depth < 12 && p !== id ? tierOf(p, depth + 1) + 1 : 0;
    tiers.set(id, tier);
    return tier;
  };
  for (const b of bodies) tierOf(b.id);
  return tiers;
}

function connectorPath(kind: GovernanceConnectorKind, from: Rect, to: Rect, lateralIndex: number): string {
  if (UPWARD.includes(kind)) {
    // child top centre up to parent bottom centre
    const x1 = from.x + from.w / 2;
    const y1 = from.y;
    const x2 = to.x + to.w / 2;
    const y2 = to.y + to.h;
    const dy = Math.max(24, (y1 - y2) / 2);
    return `M ${x1} ${y1} C ${x1} ${y1 - dy}, ${x2} ${y2 + dy}, ${x2} ${y2}`;
  }
  const sameRow = Math.abs(from.y - to.y) < 8;
  if (sameRow) {
    // side to side between neighbours on the same tier
    const leftFirst = from.x < to.x;
    const x1 = leftFirst ? from.x + from.w : from.x;
    const x2 = leftFirst ? to.x : to.x + to.w;
    const y = from.y + from.h / 2 + lateralIndex * 10;
    const bend = Math.max(20, Math.abs(x2 - x1) / 3);
    return `M ${x1} ${y} C ${x1 + (leftFirst ? bend : -bend)} ${y}, ${x2 - (leftFirst ? bend : -bend)} ${y}, ${x2} ${y}`;
  }
  // between tiers, offset from the centre so the line reads apart from the reporting line
  const offset = 26 + lateralIndex * 12;
  const upward = from.y > to.y;
  const x1 = from.x + from.w / 2 + offset;
  const y1 = upward ? from.y : from.y + from.h;
  const x2 = to.x + to.w / 2 + offset;
  const y2 = upward ? to.y + to.h : to.y;
  const dy = Math.max(24, Math.abs(y1 - y2) / 2) * (upward ? 1 : -1);
  return `M ${x1} ${y1} C ${x1} ${y1 - dy}, ${x2} ${y2 + dy}, ${x2} ${y2}`;
}

function BodyCard({
  body,
  bodiesById,
  open,
  onToggle,
  cardRef,
}: {
  body: GovernanceBody;
  bodiesById: Map<string, GovernanceBody>;
  open: boolean;
  onToggle: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const t = useTranslations("operatingModel");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const panelId = React.useId();
  const name = bi(locale, body.nameEn, body.nameAr);
  const role = bi(locale, body.roleEn, body.roleAr);
  const decisions = locale === "ar" && body.decisionsAr.length ? body.decisionsAr : body.decisionsEn;
  const escalation = bi(locale, body.escalationEn, body.escalationAr);
  const escalatesTo = body.escalatesToId ? bodiesById.get(body.escalatesToId) : null;
  const cadence = body.cadence
    ? KNOWN_CADENCES.has(body.cadence)
      ? t(`governance.cadence.${body.cadence}` as never)
      : body.cadence
    : null;

  return (
    <div
      ref={cardRef}
      className={cn(
        "card relative w-[272px] max-w-full overflow-hidden transition-colors",
        open ? "border-navy-300 shadow-[var(--shadow-lift)]" : "card-hover"
      )}
      data-testid="governance-body"
      data-body-id={body.id}
      data-open={open || undefined}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? t("governance.closeAria", { name }) : t("governance.openAria", { name })}
        className="flex w-full cursor-pointer flex-col gap-2 px-4 py-3.5 text-start outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
      >
        <span className="flex w-full items-start gap-2">
          <span
            className="min-w-0 flex-1 text-[15px] font-medium leading-snug text-ink-900"
            style={{ fontFamily: displayFont(locale) }}
          >
            {name}
          </span>
          <ChevronDown
            className={cn("mt-1 size-4 shrink-0 text-ink-400 transition-transform duration-200", open && "rotate-180")}
            aria-hidden
          />
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {cadence ? (
            <Chip tone="teal">
              <CalendarDays className="size-3" aria-hidden />
              {cadence}
            </Chip>
          ) : null}
          <Chip tone="ghost" className="px-0 text-[10px]" title={t(`governance.source.${body.source}` as never)}>
            {t(`governance.source.${body.source}` as never)}
          </Chip>
        </span>
        {role ? <span className="line-clamp-2 text-xs leading-relaxed text-ink-600">{role}</span> : null}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={panelId}
            key="panel"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-mist-200 px-4 py-3.5">
              <div>
                <SubLabel>
                  <Gavel className="me-1 inline size-3 align-[-1px]" aria-hidden />
                  {t("governance.decisions")}
                </SubLabel>
                {decisions.length ? (
                  <ol className="list-decimal space-y-1 ps-4 text-xs leading-relaxed text-ink-900 marker:text-navy-700">
                    {decisions.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-xs text-ink-400">{t("governance.noDecisions")}</p>
                )}
              </div>
              <div>
                <SubLabel>
                  <Users className="me-1 inline size-3 align-[-1px]" aria-hidden />
                  {t("governance.members")}
                </SubLabel>
                {body.members.length ? (
                  <div className="flex flex-wrap gap-1">
                    {body.members.map((m, i) => (
                      <Chip key={i} tone="mist">
                        {bi(locale, m.en, m.ar)}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-ink-400">{t("governance.noMembers")}</p>
                )}
              </div>
              <div>
                <SubLabel>{t("governance.escalation")}</SubLabel>
                <p className="text-xs leading-relaxed text-ink-900">
                  {escalatesTo ? (
                    <span className="font-medium text-navy-700">
                      {t("governance.escalatesTo", { body: bi(locale, escalatesTo.nameEn, escalatesTo.nameAr) })}
                    </span>
                  ) : (
                    <span className="text-ink-600">{t("governance.noEscalation")}</span>
                  )}
                  {escalation ? <span className="block text-ink-600">{escalation}</span> : null}
                </p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function GovernanceMap({ governance, n }: { governance: GovernanceView; n: number }) {
  const t = useTranslations("operatingModel");
  const reduced = useReducedMotion();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef(new Map<string, HTMLDivElement>());
  const [open, setOpen] = React.useState<string | null>(null);
  const [rects, setRects] = React.useState<Map<string, Rect>>(new Map());
  const [size, setSize] = React.useState({ w: 0, h: 0 });

  const bodies = governance.bodies;
  const bodiesById = React.useMemo(() => new Map(bodies.map((b) => [b.id, b])), [bodies]);
  const tiers = React.useMemo(() => computeTiers(bodies, governance.connectors), [bodies, governance.connectors]);
  const rows = React.useMemo(() => {
    const byTier = new Map<number, GovernanceBody[]>();
    for (const b of bodies) {
      const tier = tiers.get(b.id) ?? 0;
      (byTier.get(tier) ?? byTier.set(tier, []).get(tier)!).push(b);
    }
    return [...byTier.entries()].sort((a, b) => a[0] - b[0]).map(([tier, list]) => ({ tier, list }));
  }, [bodies, tiers]);

  const measure = React.useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const base = container.getBoundingClientRect();
    const next = new Map<string, Rect>();
    for (const [id, el] of cardRefs.current) {
      const r = el.getBoundingClientRect();
      next.set(id, { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });
    }
    setRects(next);
    setSize({ w: base.width, h: base.height });
  }, []);

  React.useEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    for (const el of cardRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [measure, bodies.length]);

  // the expansion animates height for 240ms; measure again once it settles
  React.useEffect(() => {
    const timer = window.setTimeout(measure, reduced ? 30 : 300);
    return () => window.clearTimeout(timer);
  }, [open, measure, reduced]);

  const paths = React.useMemo(() => {
    const lateralCount = new Map<string, number>();
    return governance.connectors
      .map((c, i) => {
        const from = rects.get(c.fromId);
        const to = rects.get(c.toId);
        if (!from || !to) return null;
        const key = `${c.fromId}>${c.toId}`;
        const lateral = UPWARD.includes(c.kind) ? 0 : lateralCount.get(key) ?? 0;
        if (!UPWARD.includes(c.kind)) lateralCount.set(key, lateral + 1);
        return { key: `${key}:${c.kind}:${i}`, kind: c.kind, d: connectorPath(c.kind, from, to, lateral) };
      })
      .filter((p): p is { key: string; kind: GovernanceConnectorKind; d: string } => Boolean(p));
  }, [governance.connectors, rects]);

  return (
    <SectionBand
      id="om-governance"
      n={n}
      eyebrow={t("section.n", { n })}
      title={t("governance.title")}
      hint={t("governance.hint")}
      testId="om-governance"
    >
      {bodies.length === 0 ? (
        <EmptyState title={t("governance.empty")} hint={t("governance.emptyHint")} />
      ) : (
        <div className="rounded-2xl border border-mist-200 bg-white/60 px-3 py-6 sm:px-6" data-testid="governance-map">
          <div ref={containerRef} className="relative" role="group" aria-label={t("governance.mapAria")}>
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              width={size.w || undefined}
              height={size.h || undefined}
              aria-hidden
              data-testid="governance-connectors"
            >
              <defs>
                {CONNECTOR_ORDER.map((kind) => (
                  <marker
                    key={kind}
                    id={`om-arrow-${kind}`}
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={CONNECTOR_STYLE[kind].stroke} />
                  </marker>
                ))}
              </defs>
              {paths.map((p) => (
                <path
                  key={p.key}
                  d={p.d}
                  fill="none"
                  stroke={CONNECTOR_STYLE[p.kind].stroke}
                  strokeWidth={CONNECTOR_STYLE[p.kind].width}
                  strokeDasharray={CONNECTOR_STYLE[p.kind].dash}
                  strokeLinecap="round"
                  markerEnd={`url(#om-arrow-${p.kind})`}
                  opacity={0.9}
                  data-kind={p.kind}
                />
              ))}
            </svg>
            <div className="relative flex flex-col gap-12">
              {rows.map(({ tier, list }) => (
                <div
                  key={tier}
                  className="flex flex-wrap items-start justify-center gap-x-10 gap-y-8"
                  role="group"
                  aria-label={t("governance.tierAria", { n: tier + 1 })}
                  data-tier={tier}
                >
                  {list.map((b) => (
                    <BodyCard
                      key={b.id}
                      body={b}
                      bodiesById={bodiesById}
                      open={open === b.id}
                      onToggle={() => setOpen((cur) => (cur === b.id ? null : b.id))}
                      cardRef={(el) => {
                        if (el) cardRefs.current.set(b.id, el);
                        else cardRefs.current.delete(b.id);
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-mist-200 pt-4" data-testid="governance-legend">
            <span className="text-[11px] font-semibold text-ink-600">{t("governance.legend")}</span>
            {CONNECTOR_ORDER.map((kind) => (
              <span key={kind} className="flex items-center gap-2 text-xs text-ink-600">
                <svg width="34" height="10" aria-hidden style={{ direction: "ltr" }}>
                  <line
                    x1="1"
                    y1="5"
                    x2="30"
                    y2="5"
                    stroke={CONNECTOR_STYLE[kind].stroke}
                    strokeWidth={CONNECTOR_STYLE[kind].width}
                    strokeDasharray={CONNECTOR_STYLE[kind].dash}
                    markerEnd={`url(#om-arrow-${kind})`}
                  />
                </svg>
                {t(`governance.kind.${kind}` as never)}
              </span>
            ))}
          </div>
        </div>
      )}
    </SectionBand>
  );
}
