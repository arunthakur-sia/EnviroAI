"use client";
// CR04 2: the Strategy Canvas. One page, one URL: the QNV pillars strip with
// connector lines, the at-a-glance numbers, the 2024-2030 timeline, the
// medallion arc, the outcome panel that opens beneath it (with a sliding
// pointer and a sticky ring rail once the arc scrolls away), target cards
// expanding in place, and a drawer for initiatives and projects. State lives
// in the query string; the back button unwinds drawer, target, panel.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Archive, Building2, ChevronDown, CircleDot, Map as MapIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn, bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { CountUp } from "@/components/motion";
import type { NavigatorData, NavItem, NavOutcome, CanvasExtras, LeadChip } from "@/server/services/strategy";
import { StrategyMap } from "./StrategyMap";
import { OutcomePanel, prefetchChapter } from "./OutcomePanel";
import { NodeDrawer, fetchNodeCard } from "./NodeDrawer";
import { Lane } from "./OutcomeTargets";

const RAG: Record<string, string> = {
  on_track: "var(--color-ok)",
  completed: "var(--color-gulf-600)",
  at_risk: "var(--color-warn)",
  delayed: "var(--color-danger)",
  not_started: "var(--color-ink-200)",
};

const ARC_OFFSETS = [44, 22, 7, 0, 7, 22, 44];
const PILLAR_ORDER = ["human", "social", "economic", "environmental"] as const;

function outcomeNumber(code: string | null): string {
  const m = code?.match(/\d+/);
  return m ? m[0] : code ?? "";
}

/* ------------------------------------------------------------------ */
/* The medallion (CR03 look, CR04 canvas behaviour)                     */
/* ------------------------------------------------------------------ */

function OutcomeMedallion({
  outcome,
  index,
  selected,
  glow,
  onClick,
  onHover,
  size = 176,
}: {
  outcome: NavOutcome;
  index: number;
  selected: boolean;
  glow: boolean;
  onClick: () => void;
  onHover: () => void;
  size?: number;
}) {
  const t = useTranslations("strategy");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [drawn, setDrawn] = React.useState(!!reduced);
  React.useEffect(() => {
    if (reduced) return;
    const timer = setTimeout(() => setDrawn(true), 80 + index * 60);
    return () => clearTimeout(timer);
  }, [index, reduced]);

  const stroke = 10;
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const value = Math.min(1, Math.max(0, outcome.progress));
  const endAngle = -Math.PI / 2 + value * Math.PI * 2;
  const dotX = size / 2 + r * Math.cos(endAngle);
  const dotY = size / 2 + r * Math.sin(endAngle);
  const pct = Math.round(value * 100);
  const description = bi(locale, outcome.descriptionEn ?? "", outcome.descriptionAr ?? "");

  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      onFocus={onHover}
      aria-expanded={selected}
      className="group/med relative flex flex-col items-center gap-2 rounded-2xl p-2 text-center outline-none transition-transform duration-200 ease-[var(--ease-paper)] hover:-translate-y-1.5 focus-visible:-translate-y-1.5 cursor-pointer"
      aria-label={t("medallionAria", {
        title: `${outcome.code ?? ""} ${bi(locale, outcome.titleEn, outcome.titleAr)}`,
        pct,
      })}
      data-testid="outcome-medallion"
      data-selected={selected || undefined}
    >
      <span className="relative block" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="block" aria-hidden style={{ direction: "ltr" }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill={selected ? "var(--color-maroon-50)" : "none"}
            stroke="var(--color-sand-300)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={glow || selected ? "var(--color-maroon-500)" : "var(--color-maroon-700)"}
            strokeWidth={selected ? stroke + 2 : stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={drawn ? c * (1 - value) : c}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-[stroke] group-hover/med:stroke-maroon-500"
            style={{ transition: "stroke-dashoffset 700ms var(--ease-paper), stroke 200ms, stroke-width 200ms" }}
          />
          {drawn && value > 0.01 ? (
            <circle cx={dotX} cy={dotY} r={6.5} fill={RAG[outcome.status] ?? RAG.not_started} stroke="#fff" strokeWidth={2} />
          ) : null}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-semibold text-maroon-900 tnum"
            style={{ fontFamily: "var(--font-display)", fontSize: 40 }}
          >
            {outcomeNumber(outcome.code)}
          </span>
        </span>
      </span>
      <span className="line-clamp-2 max-w-[176px] text-sm font-medium leading-snug text-ink-900">
        {bi(locale, outcome.titleEn, outcome.titleAr)}
      </span>
      <span className="text-[11px] text-ink-600 tnum">
        {outcome.targetCount
          ? t("nav.counts", {
              targets: outcome.targetCount,
              initiatives: outcome.initiativeCount,
              projects: outcome.projectCount,
            })
          : t("nav.countsShort", {
              initiatives: outcome.initiativeCount,
              projects: outcome.projectCount,
            })}
      </span>
      {description && !selected ? (
        <span className="pointer-events-none invisible absolute -top-2 start-1/2 z-30 w-72 -translate-x-1/2 -translate-y-full opacity-0 transition-all duration-200 group-hover/med:visible group-hover/med:opacity-100 group-focus-visible/med:visible group-focus-visible/med:opacity-100 rtl:translate-x-1/2">
          <span className="card block p-3 text-start text-xs leading-relaxed text-ink-600 shadow-[var(--shadow-pop)]">
            <span className="mb-0.5 block font-medium text-ink-900">
              {outcome.code} · {t("nav.onTrackShare", { pct })}
            </span>
            <span className="line-clamp-2 block">{description}</span>
          </span>
        </span>
      ) : null}
    </button>
  );
}

function Sparkline({ values, labelId }: { values: number[]; labelId: string }) {
  const w = 220;
  const h = 44;
  const max = Math.max(1, ...values);
  const points = values
    .map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - 4 - (v / max) * (h - 10)}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="block" style={{ direction: "ltr" }} role="img" aria-labelledby={labelId}>
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-maroon-500)"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* URL state                                                            */
/* ------------------------------------------------------------------ */

type CanvasView = "canvas" | "map" | "lead";

type CanvasState = {
  o: string | null; // outcome slug
  t: string | null; // target slug
  itemKind: "i" | "p" | null;
  item: string | null; // item slug (lowercased code)
  /* CR05 2.2: lead filter, "d:<departmentId>" or "e:<entityId>" */
  lead: string | null;
};

function parseState(search: string): CanvasState {
  const params = new URLSearchParams(search);
  const i = params.get("i");
  const p = params.get("p");
  return {
    o: params.get("o"),
    t: params.get("t"),
    itemKind: i ? "i" : p ? "p" : null,
    item: i ?? p,
    lead: params.get("l"),
  };
}

function stateQuery(state: CanvasState, view: CanvasView): string {
  const params = new URLSearchParams();
  if (state.o) params.set("o", state.o);
  if (state.t) params.set("t", state.t);
  if (state.item && state.itemKind) params.set(state.itemKind, state.item);
  if (state.lead) params.set("l", state.lead);
  if (view !== "canvas") params.set("view", view);
  const s = params.toString();
  return s ? `?${s}` : "";
}

function slugOf(code: string | null, id: string): string {
  if (!code) return id;
  return code.toLowerCase().replace(/\./g, "-");
}

/* ------------------------------------------------------------------ */
/* CR05 2.2: the By-lead view: a grouped list of leads (departments     */
/* first, then entities) with counts and a completion ring, expanding   */
/* in place to their initiatives and projects.                          */
/* ------------------------------------------------------------------ */

function ByLeadView({
  data,
  onOpen,
}: {
  data: NavigatorData;
  onOpen: (item: NavItem) => void;
}) {
  const t = useTranslations("strategy");
  const locale = useLocale();
  const [open, setOpen] = React.useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const groups = React.useMemo(() => {
    const map = new Map<
      string,
      { key: string; lead: LeadChip; items: NavItem[] }
    >();
    for (const i of data.items) {
      for (const l of i.leads) {
        if (l.role !== "lead") continue;
        const key = `${l.kind === "department" ? "d" : "e"}:${l.id}`;
        const g = map.get(key) ?? { key, lead: l, items: [] };
        g.items.push(i);
        map.set(key, g);
      }
    }
    return [...map.values()].sort((a, b) =>
      a.lead.kind === b.lead.kind
        ? b.items.length - a.items.length ||
          a.lead.nameEn.localeCompare(b.lead.nameEn)
        : a.lead.kind === "department"
          ? -1
          : 1
    );
  }, [data.items]);

  return (
    <div className="flex flex-col gap-2.5" data-testid="bylead-view">
      {(["department", "entity"] as const).map((kind) => {
        const rows = groups.filter((g) => g.lead.kind === kind);
        if (!rows.length) return null;
        return (
          <div key={kind}>
            <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600" style={{ fontFamily: "inherit" }}>
              {kind === "department" ? t("canvas.leadDepartments") : t("canvas.leadEntities")}
            </p>
            <div className="flex flex-col gap-2">
              {rows.map((g) => {
                const done = g.items.filter(
                  (i) => i.status === "on_track" || i.status === "completed"
                ).length;
                const value = g.items.length ? done / g.items.length : 0;
                const r = 14;
                const c = 2 * Math.PI * r;
                const isOpen = open === g.key;
                return (
                  <div key={g.key} className="card overflow-hidden" data-testid="bylead-group">
                    <button
                      onClick={() => setOpen(isOpen ? null : g.key)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-3 px-4 py-3 text-start cursor-pointer hover:bg-sand-50"
                    >
                      <svg width={34} height={34} aria-hidden style={{ direction: "ltr" }} className="shrink-0">
                        <circle cx={17} cy={17} r={r} fill="none" stroke="var(--color-sand-300)" strokeWidth={3.5} />
                        <circle
                          cx={17}
                          cy={17}
                          r={r}
                          fill="none"
                          stroke="var(--color-maroon-700)"
                          strokeWidth={3.5}
                          strokeLinecap="round"
                          strokeDasharray={c}
                          strokeDashoffset={c * (1 - value)}
                          transform="rotate(-90 17 17)"
                        />
                      </svg>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-900">
                          {bi(locale, g.lead.nameEn, g.lead.nameAr)}
                        </span>
                        <span className="block text-xs text-ink-600 tnum">
                          {t("canvas.leadCounts", {
                            initiatives: g.items.filter((i) => i.type === "initiative").length,
                            projects: g.items.filter((i) => i.type === "project").length,
                          })}
                          {" · "}
                          {t("canvas.leadOnTrack", { pct: Math.round(value * 100) })}
                        </span>
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-ink-400 transition-transform",
                          isOpen && "rotate-180"
                        )}
                        aria-hidden
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col gap-4 border-t border-sand-100 px-4 py-4 lg:flex-row">
                            <Lane
                              label={t("lanes.initiatives")}
                              items={g.items.filter((i) => i.type === "initiative")}
                              locale={locale}
                              today={today}
                              onOpen={onOpen}
                            />
                            <Lane
                              label={t("lanes.projects")}
                              items={g.items.filter((i) => i.type === "project")}
                              locale={locale}
                              today={today}
                              onOpen={onOpen}
                            />
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The canvas                                                           */
/* ------------------------------------------------------------------ */

export function StrategyCanvas({
  data,
  extras,
  initialView,
  initialState,
}: {
  data: NavigatorData;
  extras: CanvasExtras;
  initialView: CanvasView;
  initialState: CanvasState;
}) {
  const t = useTranslations("strategy");
  const locale = useLocale();
  const router = useRouter();
  const reduced = useReducedMotion();
  const archived = data.edition.status === "archived";
  const [view, setView] = React.useState<CanvasView>(initialView);
  const [state, setState] = React.useState<CanvasState>(initialState);
  const [hoverPillar, setHoverPillar] = React.useState<string | null>(null);
  const [railVisible, setRailVisible] = React.useState(false);
  const [yearTip, setYearTip] = React.useState<number | null>(null);
  const depthRef = React.useRef(0);
  const arcRef = React.useRef<HTMLDivElement>(null);
  const panelAnchorRef = React.useRef<HTMLDivElement>(null);
  const medallionRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const pillarRefs = React.useRef<(HTMLSpanElement | null)[]>([]);
  const frameRef = React.useRef<HTMLDivElement>(null);
  const [connectors, setConnectors] = React.useState<
    { x1: number; x2: number; pillar: string; outcome: number }[]
  >([]);
  const [connectorH, setConnectorH] = React.useState(40);

  const outcome = state.o ? data.outcomes.find((o) => o.slug === state.o) ?? null : null;
  const target =
    outcome && state.t
      ? data.targets.find((tg) => tg.outcomeId === outcome.id && tg.slug === state.t) ?? null
      : null;
  const item = state.item
    ? data.items.find(
        (i) =>
          slugOf(i.code, i.id) === state.item &&
          (state.itemKind === "i" ? i.type === "initiative" : i.type === "project")
      ) ?? null
    : null;

  /* siblings for the drawer: the same lane (same target, same type) */
  const siblings = React.useMemo(() => {
    if (!item) return [] as string[];
    return data.items
      .filter((x) => x.type === item.type && x.targetId === item.targetId && x.outcomeId === item.outcomeId)
      .sort((a, b) => a.sort - b.sort)
      .map((x) => x.id);
  }, [item, data.items]);

  const basePath = `/${locale}/strategy${data.edition.code ? `/${data.edition.code}` : ""}`;

  const applyUrl = React.useCallback(
    (next: CanvasState, v: CanvasView, push: boolean) => {
      const url = `${basePath}${stateQuery(next, v)}`;
      if (push) {
        window.history.pushState({ canvas: true }, "", url);
        depthRef.current++;
      } else {
        window.history.replaceState({ canvas: true }, "", url);
      }
    },
    [basePath]
  );

  /* CR04 2.5: back unwinds drawer -> target -> panel */
  React.useEffect(() => {
    function onPop() {
      const parsed = parseState(window.location.search);
      setState(parsed);
      const v = new URLSearchParams(window.location.search).get("view");
      setView(v === "map" ? "map" : v === "lead" ? "lead" : "canvas");
      depthRef.current = Math.max(0, depthRef.current - 1);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openOutcome = (o: NavOutcome) => {
    if (state.o === o.slug && !state.t && !state.item) {
      closeLevel({ o: null, t: null, item: null, itemKind: null, lead: state.lead });
      return;
    }
    const next: CanvasState = { o: o.slug, t: null, item: null, itemKind: null, lead: state.lead };
    setState(next);
    applyUrl(next, view, true);
    void prefetchChapter(o.code ?? "", locale);
  };
  const toggleTarget = (targetId: string | null) => {
    if (!outcome) return;
    const tg = targetId ? data.targets.find((x) => x.id === targetId) : null;
    const next: CanvasState = {
      o: outcome.slug,
      t: tg?.slug ?? null,
      item: null,
      itemKind: null,
      lead: state.lead,
    };
    setState(next);
    if (tg) applyUrl(next, view, true);
    else closeLevel(next);
  };
  const openItem = (navItem: NavItem) => {
    const o = data.outcomes.find((x) => x.id === navItem.outcomeId);
    const tg = navItem.targetId ? data.targets.find((x) => x.id === navItem.targetId) : null;
    const next: CanvasState = {
      o: o?.slug ?? state.o,
      t: tg?.slug ?? state.t,
      item: slugOf(navItem.code, navItem.id),
      itemKind: navItem.type === "initiative" ? "i" : "p",
      lead: state.lead,
    };
    setState(next);
    applyUrl(next, "canvas", true);
    setView("canvas");
    void fetchNodeCard(navItem.id);
  };
  const closeLevel = (next: CanvasState) => {
    if (depthRef.current > 0) {
      window.history.back(); // popstate applies the previous state
    } else {
      setState(next);
      applyUrl(next, view, false);
    }
  };
  const drawerNavigate = (id: string) => {
    const navItem = data.items.find((x) => x.id === id);
    if (!navItem) return;
    const next: CanvasState = {
      ...state,
      item: slugOf(navItem.code, navItem.id),
      itemKind: navItem.type === "initiative" ? "i" : "p",
    };
    setState(next);
    applyUrl(next, view, false); // prev/next replaces so Back still closes
  };

  const copyLink = (next: CanvasState) => {
    const url = `${window.location.origin}${basePath}${stateQuery(next, "canvas")}`;
    void navigator.clipboard?.writeText(url);
  };

  /* deep link: scroll the open panel into view once */
  React.useEffect(() => {
    if (initialState.o) {
      depthRef.current = 0;
      setTimeout(() => {
        panelAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 450);
      if (initialState.item) {
        const navItem = data.items.find(
          (i) => slugOf(i.code, i.id) === initialState.item
        );
        if (navItem) void fetchNodeCard(navItem.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* sticky rail: appears when the arc leaves the viewport (CR04 2.3) */
  React.useEffect(() => {
    const el = arcRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setRailVisible(!entry.isIntersecting),
      { rootMargin: "-64px 0px 0px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* pillar connectors: measured lines from labels to medallions */
  const pillars = extras.pillars;
  const pillarsOf = React.useCallback(
    (n: number) => pillars.filter((p) => p.outcomes.includes(n)).map((p) => p.key),
    [pillars]
  );
  const measureConnectors = React.useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const frameRect = frame.getBoundingClientRect();
    const lines: { x1: number; x2: number; pillar: string; outcome: number }[] = [];
    pillars.forEach((pillar) => {
      const pi = PILLAR_ORDER.indexOf(pillar.key);
      const label = pillarRefs.current[pi];
      if (!label) return;
      const lr = label.getBoundingClientRect();
      const x1 = lr.left + lr.width / 2 - frameRect.left;
      for (const num of pillar.outcomes) {
        const med = medallionRefs.current[num - 1];
        if (!med) continue;
        const mr = med.getBoundingClientRect();
        lines.push({
          x1,
          x2: mr.left + mr.width / 2 - frameRect.left,
          pillar: pillar.key,
          outcome: num,
        });
      }
    });
    setConnectors(lines);
    const firstMed = medallionRefs.current.find(Boolean);
    const firstPillar = pillarRefs.current.find(Boolean);
    if (firstMed && firstPillar) {
      setConnectorH(
        Math.max(
          24,
          firstMed.getBoundingClientRect().top - firstPillar.getBoundingClientRect().bottom
        )
      );
    }
  }, [pillars]);
  React.useEffect(() => {
    if (view !== "canvas") return;
    measureConnectors();
    const onResize = () => measureConnectors();
    window.addEventListener("resize", onResize);
    const timer = setTimeout(measureConnectors, 600);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
    };
  }, [measureConnectors, view]);

  /* the 2024-2030 timeline strip (CR04 2.2) */
  const years = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
  const projectsByYear = React.useMemo(() => {
    const map = new Map<number, { starting: NavItem[]; ending: NavItem[] }>();
    for (const y of years) map.set(y, { starting: [], ending: [] });
    for (const i of data.items) {
      if (i.type !== "project") continue;
      const sy = i.startDate ? Number(i.startDate.slice(0, 4)) : null;
      const ey = i.endDate ? Number(i.endDate.slice(0, 4)) : null;
      if (sy && map.has(sy)) map.get(sy)!.starting.push(i);
      if (ey && map.has(ey)) map.get(ey)!.ending.push(i);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.items]);
  const now = Date.now();
  const spanStart = Date.UTC(2024, 0, 1);
  const spanEnd = Date.UTC(2030, 11, 31);
  const todayPct = Math.max(0, Math.min(1, (now - spanStart) / (spanEnd - spanStart)));
  const maxYearCount = Math.max(
    1,
    ...years.map((y) => {
      const e = projectsByYear.get(y)!;
      return Math.max(e.starting.length, e.ending.length);
    })
  );

  /* medallion index for the panel pointer */
  const selectedIndex = outcome ? data.outcomes.findIndex((o) => o.id === outcome.id) : -1;
  const [pointerX, setPointerX] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (selectedIndex < 0) return;
    const med = medallionRefs.current[selectedIndex];
    const anchor = panelAnchorRef.current;
    if (!med || !anchor) return;
    const mr = med.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    setPointerX(mr.left + mr.width / 2 - ar.left);
  }, [selectedIndex, view]);

  const switchView = (v: CanvasView) => {
    setView(v);
    applyUrl(state, v, false);
  };

  /* CR05 2.2: the Lead filter and the By-lead grouping over the same items */
  const leadOptions = React.useMemo(() => {
    const seen = new Map<string, { key: string; kind: string; label: string; sort: string }>();
    for (const i of data.items) {
      for (const l of i.leads) {
        if (l.role !== "lead") continue;
        const key = `${l.kind === "department" ? "d" : "e"}:${l.id}`;
        if (!seen.has(key)) {
          seen.set(key, {
            key,
            kind: l.kind,
            label: bi(locale, l.shortEn, l.shortAr),
            sort: l.shortEn.toLowerCase(),
          });
        }
      }
    }
    return [...seen.values()].sort((a, b) =>
      a.kind === b.kind ? a.sort.localeCompare(b.sort) : a.kind === "department" ? -1 : 1
    );
  }, [data.items, locale]);

  const setLeadFilter = (lead: string | null) => {
    const next: CanvasState = { ...state, lead };
    setState(next);
    applyUrl(next, view, false);
  };

  const dataView = React.useMemo<NavigatorData>(() => {
    if (!state.lead) return data;
    const [kindChar, leadId] = state.lead.split(":");
    const kind = kindChar === "d" ? "department" : "entity";
    return {
      ...data,
      items: data.items.filter((i) =>
        i.leads.some((l) => l.role === "lead" && l.kind === kind && l.id === leadId)
      ),
    };
  }, [data, state.lead]);

  return (
    <div ref={frameRef} className="relative">
      {/* edition switch, lead filter, and view toggle */}
      <div className="mb-5 flex flex-wrap items-center justify-end gap-2">
        {/* CR05 2.2: the Lead filter (departments first, then entities) */}
        {leadOptions.length && view !== "lead" ? (
          <select
            value={state.lead ?? ""}
            onChange={(e) => setLeadFilter(e.target.value || null)}
            aria-label={t("canvas.leadFilterAria")}
            data-testid="lead-filter"
            className="h-7.5 max-w-56 rounded-lg border border-sand-300 bg-white px-2 text-xs text-ink-900 focus:border-maroon-500 focus:outline-none"
          >
            <option value="">{t("canvas.allLeads")}</option>
            <optgroup label={t("canvas.leadDepartments")}>
              {leadOptions
                .filter((o) => o.kind === "department")
                .map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
            </optgroup>
            <optgroup label={t("canvas.leadEntities")}>
              {leadOptions
                .filter((o) => o.kind === "entity")
                .map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
            </optgroup>
          </select>
        ) : null}
        <span className="inline-flex items-center gap-0.5 rounded-lg bg-sand-100 p-0.5">
          {data.editions.map((e) => (
            <button
              key={e.code}
              onClick={() => {
                if (e.code === data.edition.code) return;
                router.push((e.isDefault ? "/strategy" : `/strategy/${e.code}`) as never);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer",
                e.code === data.edition.code
                  ? "bg-white font-medium text-maroon-900 shadow-sm"
                  : "text-ink-600 hover:text-ink-900"
              )}
            >
              {e.code.toUpperCase()}
              {e.status === "live" ? (
                <span className="ms-1 inline-block h-1.5 w-1.5 rounded-full bg-ok align-middle" />
              ) : null}
            </button>
          ))}
        </span>
        <span className="inline-flex items-center gap-0.5 rounded-lg bg-sand-100 p-0.5">
          <button
            onClick={() => switchView("canvas")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer",
              view === "canvas" ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
            )}
          >
            <CircleDot className="size-3.5" /> {t("nav.outcomes")}
          </button>
          <button
            onClick={() => switchView("map")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer",
              view === "map" ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
            )}
          >
            <MapIcon className="size-3.5" /> {t("nav.map")}
          </button>
          {/* CR05 2.2: the By-lead view */}
          <button
            onClick={() => switchView("lead")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer",
              view === "lead" ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
            )}
            data-testid="bylead-toggle"
          >
            <Building2 className="size-3.5" /> {t("canvas.byLead")}
          </button>
        </span>
      </div>

      {archived ? (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-sand-300 bg-sand-100 px-4 py-2.5 text-sm text-ink-600" data-testid="archive-banner">
          <Archive className="size-4 shrink-0" />
          {t("archiveBanner", { name: bi(locale, data.edition.nameEn, data.edition.nameAr) })}
        </div>
      ) : null}

      {view === "lead" ? (
        <ByLeadView data={data} onOpen={openItem} />
      ) : view === "map" ? (
        <StrategyMap
          data={dataView}
          selection={{ outcomeId: outcome?.id ?? null, targetId: target?.id ?? null }}
          onSelect={(next) => {
            const o = next.outcomeId ? data.outcomes.find((x) => x.id === next.outcomeId) : null;
            const tg = next.targetId ? data.targets.find((x) => x.id === next.targetId) : null;
            const nextState: CanvasState = {
              o: o?.slug ?? null,
              t: tg?.slug ?? null,
              item: null,
              itemKind: null,
              lead: state.lead,
            };
            setState(nextState);
            setView("canvas");
            applyUrl(nextState, "canvas", true);
          }}
          onOpen={(id) => {
            const navItem = data.items.find((x) => x.id === id);
            if (navItem) openItem(navItem);
          }}
        />
      ) : (
        <>
          {/* CR04 2.2.1: QNV pillars strip */}
          {!archived ? (
            <div className="relative" data-testid="qnv-pillars">
              <div
                className="flex flex-wrap items-center justify-center gap-x-10 gap-y-1"
                role="list"
                aria-label={t("canvas.pillarsAria")}
              >
                {PILLAR_ORDER.map((key, i) => (
                  <span
                    key={key}
                    ref={(el) => {
                      pillarRefs.current[i] = el;
                    }}
                    role="listitem"
                    tabIndex={0}
                    onMouseEnter={() => setHoverPillar(key)}
                    onMouseLeave={() => setHoverPillar(null)}
                    onFocus={() => setHoverPillar(key)}
                    onBlur={() => setHoverPillar(null)}
                    className={cn(
                      "cursor-default rounded px-1 text-xs font-semibold uppercase tracking-[0.12em] transition-colors",
                      hoverPillar === key ? "text-maroon-900" : "text-ink-600"
                    )}
                    style={{ fontFamily: "inherit" }}
                  >
                    {t(`canvas.pillars.${key}` as never)}
                  </span>
                ))}
              </div>
              {/* connector lines down to the medallions */}
              <svg
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-6 hidden lg:block"
                width="100%"
                height={connectorH}
                style={{ overflow: "visible" }}
              >
                {connectors.map((l, i) => {
                  const lit = hoverPillar === l.pillar;
                  return (
                    <path
                      key={i}
                      d={`M ${l.x1} 0 C ${l.x1} ${connectorH * 0.5}, ${l.x2} ${connectorH * 0.45}, ${l.x2} ${connectorH}`}
                      fill="none"
                      stroke={lit ? "rgba(138, 21, 56, 0.6)" : "var(--connection)"}
                      strokeWidth={lit ? 1.5 : 1}
                      style={{ transition: "stroke 200ms" }}
                    />
                  );
                })}
              </svg>
            </div>
          ) : null}

          {/* CR04 2.2.2: at-a-glance numbers */}
          <section
            className="mt-8 rounded-2xl bg-sand-100 px-7 py-5 lg:mt-10"
            aria-label={t("glance.band")}
            data-testid="glance-band"
          >
            <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
              {data.glance.targetsTotal > 0 ? (
                <div className="digit-tick">
                  <p className="flex items-baseline gap-1.5">
                    <span className="font-semibold text-maroon-900 tnum" style={{ fontFamily: "var(--font-display)", fontSize: 44, lineHeight: 1 }}>
                      <CountUp value={data.glance.targetsOnTrack} />
                    </span>
                    <span className="text-sm text-ink-600 tnum">
                      {t("glance.ofTotal", { total: data.glance.targetsTotal })}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-ink-600">{t("glance.targetsOnTrack")}</p>
                </div>
              ) : null}
              <div className="digit-tick">
                <p className="font-semibold text-maroon-900 tnum" style={{ fontFamily: "var(--font-display)", fontSize: 44, lineHeight: 1 }}>
                  <CountUp value={data.glance.initiatives} />
                </p>
                <p className="mt-1 text-xs text-ink-600">{t("glance.initiatives")}</p>
              </div>
              <div className="digit-tick">
                <p className="font-semibold text-maroon-900 tnum" style={{ fontFamily: "var(--font-display)", fontSize: 44, lineHeight: 1 }}>
                  <CountUp value={data.glance.projects} />
                </p>
                <p className="mt-1 text-xs text-ink-600">{t("glance.projects")}</p>
              </div>
              <div className="ms-auto">
                <Sparkline values={data.glance.updatesPerMonth} labelId="glance-spark-label" />
                <p id="glance-spark-label" className="mt-1 text-[11px] text-ink-600">
                  {t("glance.updatesSpark")}
                </p>
              </div>
            </div>
          </section>

          {/* CR04 2.2.3: the 2024-2030 timeline strip */}
          {!archived ? (
            <section
              className="mt-6 px-2"
              aria-label={t("canvas.timelineAria")}
              data-testid="delivery-strip"
            >
              <div className="relative h-1 rounded-full bg-sand-200">
                <span
                  className="absolute inset-y-0 start-0 rounded-full bg-maroon-300/60"
                  style={{ width: `${todayPct * 100}%` }}
                  aria-hidden
                />
                {/* today */}
                <span
                  className="absolute -top-1 size-3 -translate-x-1/2 rounded-full bg-maroon-700 rtl:translate-x-1/2"
                  style={{ insetInlineStart: `${todayPct * 100}%` }}
                  aria-hidden
                />
                <span
                  className="absolute top-3 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-maroon-900 rtl:translate-x-1/2"
                  style={{ insetInlineStart: `${todayPct * 100}%` }}
                >
                  {t("canvas.today")} · <span className="tnum">{formatDate(new Date().toISOString(), locale, { style: "short" })}</span>
                </span>
              </div>
              <div className="relative mt-6 flex justify-between">
                {years.map((y) => {
                  const entry = projectsByYear.get(y)!;
                  const isMid = y === 2027;
                  const isHorizon = y === 2030;
                  return (
                    <div
                      key={y}
                      className="relative flex flex-col items-center gap-1"
                      onMouseEnter={() => setYearTip(y)}
                      onMouseLeave={() => setYearTip(null)}
                    >
                      <span className={cn("h-2 w-px", isMid || isHorizon ? "bg-maroon-500" : "bg-sand-300")} aria-hidden />
                      <span className={cn("text-[11px] tnum", isMid || isHorizon ? "font-semibold text-maroon-900" : "text-ink-600")}>
                        {y}
                      </span>
                      {isMid ? (
                        <span className="text-[9px] uppercase tracking-wider text-maroon-700">{t("canvas.midterm")}</span>
                      ) : isHorizon ? (
                        <span className="text-[9px] uppercase tracking-wider text-maroon-700">{t("canvas.horizon")}</span>
                      ) : null}
                      {/* faint start/end bars */}
                      <span className="flex items-end gap-0.5" aria-hidden style={{ height: 16 }}>
                        <span
                          className="w-1.5 rounded-t-sm bg-gulf-400/30"
                          style={{ height: `${(entry.starting.length / maxYearCount) * 16}px` }}
                        />
                        <span
                          className="w-1.5 rounded-t-sm bg-maroon-300/40"
                          style={{ height: `${(entry.ending.length / maxYearCount) * 16}px` }}
                        />
                      </span>
                      {yearTip === y && (entry.starting.length || entry.ending.length) ? (
                        <span className="absolute top-full z-30 mt-1 w-64 -translate-x-0">
                          <span className="card block p-3 text-start text-xs shadow-[var(--shadow-pop)]">
                            {entry.starting.length ? (
                              <>
                                <span className="mb-0.5 block font-medium text-gulf-600">
                                  {t("canvas.yearStarting", { count: entry.starting.length })}
                                </span>
                                {entry.starting.slice(0, 4).map((i) => (
                                  <span key={i.id} className="block truncate text-ink-600">
                                    {i.code} · {bi(locale, i.titleEn, i.titleAr)}
                                  </span>
                                ))}
                              </>
                            ) : null}
                            {entry.ending.length ? (
                              <>
                                <span className="mb-0.5 mt-1.5 block font-medium text-maroon-700">
                                  {t("canvas.yearEnding", { count: entry.ending.length })}
                                </span>
                                {entry.ending.slice(0, 4).map((i) => (
                                  <span key={i.id} className="block truncate text-ink-600">
                                    {i.code} · {bi(locale, i.titleEn, i.titleAr)}
                                  </span>
                                ))}
                              </>
                            ) : null}
                          </span>
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* the medallion arc */}
          <section
            ref={arcRef}
            className="mt-8 lg:mt-10"
            aria-label={t("nav.outcomes")}
            data-testid="medallion-arc"
          >
            <div className="grid grid-cols-2 gap-x-2 gap-y-8 sm:grid-cols-3 lg:grid-cols-7 lg:gap-x-0">
              {data.outcomes.map((o, i) => (
                <div key={o.id} className="flex justify-center">
                  <div
                    ref={(el) => {
                      medallionRefs.current[i] = el;
                    }}
                    className="lg:translate-y-[var(--arc)]"
                    style={{ "--arc": `${outcome ? 0 : ARC_OFFSETS[i % 7]}px`, transition: "transform 300ms var(--ease-paper)" } as React.CSSProperties}
                  >
                    <OutcomeMedallion
                      outcome={o}
                      index={i}
                      selected={outcome?.id === o.id}
                      glow={
                        hoverPillar !== null &&
                        (pillars.find((p) => p.key === hoverPillar)?.outcomes ?? []).includes(
                          Number(outcomeNumber(o.code)) || 0
                        )
                      }
                      onClick={() => openOutcome(o)}
                      onHover={() => void prefetchChapter(o.code ?? "", locale)}
                      size={data.outcomes.length > 7 ? 152 : 176}
                    />
                  </div>
                </div>
              ))}
            </div>
            {!outcome ? <div className="hidden lg:block" style={{ height: 44 }} aria-hidden /> : null}
          </section>

          {/* the outcome panel beneath the arc (CR04 2.3) */}
          <div ref={panelAnchorRef} className="relative scroll-mt-24">
            {/* the tapered pointer slides to the selected medallion */}
            {outcome && pointerX !== null ? (
              <span
                aria-hidden
                className="absolute -top-2.5 z-10 hidden lg:block"
                style={{ left: pointerX - 12, transition: reduced ? undefined : "left 300ms var(--ease-paper)" }}
              >
                <span
                  className="block size-6 rotate-45 rounded-[3px] bg-sand-100"
                  style={{ borderTop: "1px solid var(--color-sand-300)", borderLeft: "1px solid var(--color-sand-300)" }}
                />
              </span>
            ) : null}
            <AnimatePresence initial={false}>
              {outcome ? (
                <motion.div
                  key="panel"
                  initial={reduced ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduced ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-visible"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={outcome.id}
                      initial={reduced ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={reduced ? undefined : { opacity: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      <OutcomePanel
                        data={dataView}
                        extras={extras}
                        outcomeId={outcome.id}
                        expandedTarget={target?.id ?? null}
                        onToggleTarget={toggleTarget}
                        onOpenItem={openItem}
                        onCopyLink={() => copyLink({ o: outcome.slug, t: null, item: null, itemKind: null, lead: null })}
                        onCopyTargetLink={(slug) => copyLink({ o: outcome.slug, t: slug, item: null, itemKind: null, lead: null })}
                        onClose={() => closeLevel({ o: null, t: null, item: null, itemKind: null, lead: state.lead })}
                        pillarsOf={pillarsOf}
                      />
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* the sticky ring rail (CR04 2.3) */}
      <AnimatePresence>
        {railVisible && view === "canvas" ? (
          <motion.div
            initial={reduced ? false : { y: -48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduced ? undefined : { y: -48, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-16 z-30 flex justify-center"
            data-testid="outcome-rail"
          >
            <div
              className="flex items-center gap-2 rounded-b-2xl border border-t-0 border-sand-300 bg-white/95 px-4 py-2 shadow-[var(--shadow-paper)] backdrop-blur"
              role="toolbar"
              aria-label={t("canvas.railAria")}
            >
              <span className="rounded-md bg-sand-100 px-2 py-0.5 text-[10px] font-semibold text-ink-600">
                {data.edition.code.toUpperCase()}
              </span>
              {data.outcomes.map((o) => {
                const isSel = outcome?.id === o.id;
                const value = Math.min(1, Math.max(0, o.progress));
                const r = 16;
                const c = 2 * Math.PI * r;
                return (
                  <button
                    key={o.id}
                    onClick={() => {
                      if (!isSel) openOutcome(o);
                      panelAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    aria-label={`${o.code} ${bi(locale, o.titleEn, o.titleAr)}`}
                    aria-pressed={isSel}
                    className="relative size-10 cursor-pointer rounded-full transition-transform hover:-translate-y-0.5"
                  >
                    <svg width={40} height={40} aria-hidden style={{ direction: "ltr" }}>
                      <circle cx={20} cy={20} r={r} fill={isSel ? "var(--color-maroon-700)" : "none"} stroke="var(--color-sand-300)" strokeWidth={3} />
                      <circle
                        cx={20}
                        cy={20}
                        r={r}
                        fill="none"
                        stroke={isSel ? "var(--color-maroon-700)" : "var(--color-maroon-500)"}
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeDasharray={c}
                        strokeDashoffset={c * (1 - value)}
                        transform="rotate(-90 20 20)"
                      />
                    </svg>
                    <span
                      className={cn(
                        "absolute inset-0 flex items-center justify-center text-xs font-semibold tnum",
                        isSel ? "text-white" : "text-maroon-900"
                      )}
                    >
                      {outcomeNumber(o.code)}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* the drawer (CR04 2.4) */}
      <AnimatePresence>
        {item ? (
          <NodeDrawer
            key="drawer"
            nodeId={item.id}
            siblings={siblings}
            onNavigate={drawerNavigate}
            onClose={() => closeLevel({ ...state, item: null, itemKind: null })}
            onCopyLink={() => copyLink(state)}
          />
        ) : null}
      </AnimatePresence>

      <p className="mt-5 hidden text-[11px] text-ink-600 lg:block">{t("targetCard.keyboard")}</p>
    </div>
  );
}
