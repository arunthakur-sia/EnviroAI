"use client";
// CR03 3.3: the Signal Briefing under the radar. Highest-impact feature row,
// collapsible category lanes ordered by impact (with a by-outcome regrouping
// toggle), active filter chips that drive both radar and briefing, and a
// two-way hover connection between cards and radar blips.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  Compass,
  Cpu,
  ExternalLink,
  FlaskConical,
  Globe2,
  Landmark,
  Leaf,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Button, Chip } from "@/components/ui/primitives";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { SignalRadar } from "./SignalRadar";
import { IMPACT_SCORE, type BoardSignal } from "./board-types";

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  policy: Landmark,
  market: TrendingUp,
  technology: Cpu,
  social: Users,
  environment: Leaf,
  geopolitical: Globe2,
  index: BarChart3,
  research: FlaskConical,
};

const SENTIMENT_FILL: Record<string, string> = {
  positive: "var(--color-gulf-600)",
  negative: "rgba(179, 38, 30, 0.8)",
  neutral: "var(--color-ink-400)",
  mixed: "var(--color-warn)",
};

function ImpactMeter({ impact }: { impact: string }) {
  const t = useTranslations("trends");
  const level = IMPACT_SCORE[impact] ?? 1;
  return (
    <span
      className="flex items-end gap-0.5"
      role="img"
      aria-label={t(`impact.${impact}` as never)}
    >
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn("w-1.5 rounded-sm", i <= level ? "bg-maroon-700" : "bg-sand-300")}
          style={{ height: 4 + i * 4 }}
        />
      ))}
    </span>
  );
}

function useTriage() {
  const t = useTranslations("trends");
  const tc = useTranslations("common");
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  async function triage(
    signalId: string,
    action: "accept" | "dismiss" | "convert",
    target?: string,
    onDone?: (status: string) => void
  ) {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/signals/${signalId}/triage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, target }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (action === "accept") {
        onDone?.("accepted");
        toast(json.data.points ? t("acceptedPoints", { points: json.data.points }) : t("accepted"), "points");
      } else if (action === "dismiss") {
        onDone?.("dismissed");
        toast(t("dismissed"), "info");
      } else {
        onDone?.("converted");
        toast(t("converted"), "success");
        const rid = json.data.resourceId;
        if (target === "lesson") router.push(`/lessons/${rid}` as never);
        if (target === "document") router.push(`/vault/${rid}` as never);
      }
      router.refresh();
    } catch (e) {
      toast(
        (e as Error)?.message === "no_url" ? t("noUrlToConvert") : tc("error"),
        "error"
      );
    } finally {
      setBusy(false);
    }
  }
  return { triage, busy };
}

function TriageStrip({ signal }: { signal: BoardSignal }) {
  const t = useTranslations("trends");
  const { triage, busy } = useTriage();
  const [status, setStatus] = React.useState(signal.triageStatus);
  if (status !== "new") {
    return (
      <Chip tone={status === "accepted" ? "ok" : status === "converted" ? "gulf" : "ghost"}>
        {t(`triage.${status}` as never)}
      </Chip>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => triage(signal.id, "accept", undefined, setStatus)}>
        <Check className="text-ok" /> {t("accept")}
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => triage(signal.id, "dismiss", undefined, setStatus)}>
        <X /> {t("dismiss")}
      </Button>
      <Dropdown>
        <DropdownTrigger asChild>
          <Button size="sm" variant="ghost" disabled={busy}>
            <ArrowUpRight /> {t("convert")}
          </Button>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownItem onSelect={() => triage(signal.id, "convert", "lesson", setStatus)}>
            {t("convertLesson")}
          </DropdownItem>
          <DropdownItem onSelect={() => triage(signal.id, "convert", "risk", setStatus)}>
            {t("convertRisk")}
          </DropdownItem>
          <DropdownItem onSelect={() => triage(signal.id, "convert", "document", setStatus)}>
            {t("convertDocument")}
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
    </span>
  );
}

function FeatureSignalCard({
  signal,
  primary,
  canTriage,
  hovered,
  highlighted,
  onHover,
}: {
  signal: BoardSignal;
  primary: boolean;
  canTriage: boolean;
  hovered: boolean;
  highlighted: boolean;
  onHover: (id: string | null) => void;
}) {
  const t = useTranslations("trends");
  const locale = useLocale();
  return (
    <div
      id={`signal-card-${signal.id}`}
      onMouseEnter={() => onHover(signal.id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        "card relative flex h-full flex-col gap-2 overflow-hidden p-4 pt-5 transition-all duration-200 ease-[var(--ease-paper)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]",
        (hovered || highlighted) && "border-maroon-300 shadow-[var(--shadow-lift)]"
      )}
      data-testid="feature-signal"
    >
      {primary ? (
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-maroon-100" />
      ) : null}
      <p className="flex items-center gap-2 text-[11px] text-ink-600">
        <span className="truncate font-medium">
          {signal.publisher ?? t(`sourceKinds.${signal.sourceKind}` as never)}
        </span>
        {signal.publishedAt ? (
          <span className="tnum shrink-0">{formatDate(signal.publishedAt, locale)}</span>
        ) : null}
        <span
          className="ms-auto inline-block size-2.5 shrink-0 rounded-full"
          style={{ background: SENTIMENT_FILL[signal.sentiment] ?? SENTIMENT_FILL.neutral }}
          title={t(`radar.sentiment.${signal.sentiment}` as never)}
        />
      </p>
      <Link
        href={`/trends/${signal.id}` as never}
        className="line-clamp-3 font-semibold leading-snug text-ink-900 hover:text-maroon-900"
        style={{ fontFamily: locale === "ar" ? "var(--font-kufi)" : "var(--font-display)", fontSize: 20 }}
      >
        {bi(locale, signal.titleEn, signal.titleAr)}
      </Link>
      {(signal.whyEn || signal.whyAr) ? (
        <p className="line-clamp-3 rounded-lg bg-gold-100/60 px-2.5 py-1.5 text-xs leading-relaxed text-maroon-900">
          {bi(locale, signal.whyEn ?? "", signal.whyAr ?? "")}
        </p>
      ) : null}
      <p className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <ImpactMeter impact={signal.impact} />
        <Chip tone="sand">{t(`horizon.${signal.horizon}` as never)}</Chip>
        {signal.outcomes.slice(0, 2).map((o) => (
          <Link key={o.nodeId} href={`/strategy/${o.nodeId}` as never}>
            <Chip tone="maroon" className="hover:bg-maroon-700 hover:text-white">
              {o.code}
            </Chip>
          </Link>
        ))}
        {signal.url ? (
          <a
            href={signal.url}
            target="_blank"
            rel="noreferrer"
            className="ms-auto inline-flex items-center gap-1 text-[11px] text-gulf-600 hover:underline"
          >
            <ExternalLink className="size-3" /> {t("source")}
          </a>
        ) : null}
      </p>
      <div className="flex items-center gap-1.5 border-t border-sand-100 pt-2.5">
        {canTriage ? <TriageStrip signal={signal} /> : (
          <Chip tone={signal.triageStatus === "accepted" ? "ok" : signal.triageStatus === "converted" ? "gulf" : "ghost"}>
            {t(`triage.${signal.triageStatus}` as never)}
          </Chip>
        )}
      </div>
    </div>
  );
}

function MiniSignalCard({
  signal,
  hovered,
  highlighted,
  onHover,
}: {
  signal: BoardSignal;
  hovered: boolean;
  highlighted: boolean;
  onHover: (id: string | null) => void;
}) {
  const t = useTranslations("trends");
  const locale = useLocale();
  return (
    <Link
      id={`signal-card-${signal.id}`}
      href={`/trends/${signal.id}` as never}
      onMouseEnter={() => onHover(signal.id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        "card flex w-64 shrink-0 flex-col gap-1.5 p-3.5 transition-all duration-200 ease-[var(--ease-paper)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]",
        (hovered || highlighted) && "border-maroon-300 shadow-[var(--shadow-lift)]"
      )}
      data-testid="mini-signal"
    >
      <span className="flex items-center gap-2 text-[10px] text-ink-600">
        <span className="truncate font-medium">
          {signal.publisher ?? t(`sourceKinds.${signal.sourceKind}` as never)}
        </span>
        {signal.publishedAt ? (
          <span className="tnum shrink-0">{formatDate(signal.publishedAt, locale)}</span>
        ) : null}
        <span
          className="ms-auto inline-block size-2 shrink-0 rounded-full"
          style={{ background: SENTIMENT_FILL[signal.sentiment] ?? SENTIMENT_FILL.neutral }}
          aria-hidden
        />
      </span>
      <span className="line-clamp-2 min-h-9 text-sm font-medium leading-snug text-ink-900">
        {bi(locale, signal.titleEn, signal.titleAr)}
      </span>
      <span className="mt-auto flex items-center gap-2">
        <ImpactMeter impact={signal.impact} />
        <span className="text-[10px] text-ink-600">{t(`horizon.${signal.horizon}` as never)}</span>
        {signal.outcomes[0] ? (
          <span className="ms-auto text-[10px] font-medium text-maroon-700 tnum">
            {signal.outcomes[0].code}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

type LaneDef = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }> | null;
  signals: BoardSignal[];
  score: number;
};

export function TrendsBoard({
  signals,
  radarSignals,
  canTriage,
}: {
  signals: BoardSignal[];
  radarSignals: BoardSignal[];
  canTriage: boolean;
}) {
  const t = useTranslations("trends");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [highlightId, setHighlightId] = React.useState<string | null>(null);
  const [grouping, setGrouping] = React.useState<"category" | "outcome">("category");
  const [openLanes, setOpenLanes] = React.useState<Record<string, boolean> | null>(null);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}` as never, { scroll: false });
  }

  const openSignal = React.useCallback((id: string) => {
    setHighlightId(id);
    document.getElementById(`signal-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setHighlightId(null), 2600);
  }, []);

  /* Highest impact this month: the newest month that has signals */
  const featured = React.useMemo(() => {
    if (!signals.length) return [];
    const dateOf = (s: BoardSignal) => s.publishedAt ?? s.createdAt.slice(0, 10);
    const latestMonth = signals.map((s) => dateOf(s).slice(0, 7)).sort().at(-1)!;
    return signals
      .filter((s) => dateOf(s).startsWith(latestMonth))
      .sort(
        (a, b) =>
          (IMPACT_SCORE[b.impact] ?? 0) - (IMPACT_SCORE[a.impact] ?? 0) ||
          dateOf(b).localeCompare(dateOf(a))
      )
      .slice(0, 3);
  }, [signals]);

  /* lanes */
  const lanes: LaneDef[] = React.useMemo(() => {
    const sortCards = (list: BoardSignal[]) =>
      [...list].sort(
        (a, b) =>
          (IMPACT_SCORE[b.impact] ?? 0) - (IMPACT_SCORE[a.impact] ?? 0) ||
          (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt)
      );
    if (grouping === "category") {
      const byType = new Map<string, BoardSignal[]>();
      for (const s of signals) {
        (byType.get(s.signalType) ?? byType.set(s.signalType, []).get(s.signalType)!).push(s);
      }
      return [...byType.entries()]
        .map(([key, list]) => ({
          key,
          label: t(`types.${key}` as never),
          icon: TYPE_ICON[key] ?? null,
          signals: sortCards(list),
          score: list.reduce((sum, s) => sum + (IMPACT_SCORE[s.impact] ?? 0), 0),
        }))
        .sort((a, b) => b.score - a.score);
    }
    const byOutcome = new Map<string, { label: string; list: BoardSignal[] }>();
    for (const s of signals) {
      const key = s.outcomes[0]?.code ?? "zz-other";
      const label = s.outcomes[0]
        ? `${s.outcomes[0].code} · ${bi(locale, s.outcomes[0].nameEn, s.outcomes[0].nameAr)}`
        : t("radarTitle");
      (byOutcome.get(key) ?? byOutcome.set(key, { label, list: [] }).get(key)!).list.push(s);
    }
    return [...byOutcome.entries()]
      .map(([key, { label, list }]) => ({
        key,
        label,
        icon: Compass,
        signals: sortCards(list),
        score: list.length,
      }))
      .sort((a, b) => b.score - a.score);
  }, [signals, grouping, t, locale]);

  const laneOpen = (key: string, index: number) =>
    openLanes?.[`${grouping}:${key}`] ?? index < 3;
  const toggleLane = (key: string, index: number) =>
    setOpenLanes((prev) => ({
      ...(prev ?? {}),
      [`${grouping}:${key}`]: !laneOpen(key, index),
    }));

  const FILTER_KEYS = ["outcome", "type", "impact", "horizon", "source", "triage", "days", "riskId", "rankingId"];
  const active = FILTER_KEYS.filter((k) => sp.get(k));
  const filterLabel = (k: string): string => {
    const v = sp.get(k)!;
    switch (k) {
      case "type":
        return t(`types.${v}` as never);
      case "impact":
        return t(`impact.${v}` as never);
      case "horizon":
        return t(`horizon.${v}` as never);
      case "outcome":
        return t(`outcomes.${v}` as never);
      case "source":
        return t(`sourceKinds.${v}` as never);
      case "triage":
        return t(`triage.${v}` as never);
      case "days":
        return v === "7" ? t("days7") : v === "30" ? t("days30") : t("days90");
      default:
        return v.slice(0, 12);
    }
  };

  return (
    <div>
      {/* 1. the radar */}
      <section className="card mt-6 p-5" aria-label={t("radar.title")}>
        <h2 className="mb-3 text-lg">{t("radar.title")}</h2>
        <SignalRadar
          signals={radarSignals}
          hoveredId={hoveredId}
          onHoverSignal={setHoveredId}
          onOpenSignal={openSignal}
          onFilterBand={(band) => setParam("horizon", sp.get("horizon") === band ? null : band)}
          onFilterWedge={(type) => setParam("type", sp.get("type") === type ? null : type)}
        />
      </section>

      {/* 2. the briefing */}
      <section className="mt-10" aria-label={t("briefing.title")} data-testid="signal-briefing">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg">{t("briefing.title")}</h2>
          <span className="inline-flex items-center gap-0.5 rounded-lg bg-sand-100 p-0.5">
            <button
              onClick={() => setGrouping("category")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer",
                grouping === "category" ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
              )}
            >
              {t("briefing.byCategory")}
            </button>
            <button
              onClick={() => setGrouping("outcome")}
              data-testid="by-outcome-toggle"
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer",
                grouping === "outcome" ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
              )}
            >
              {t("briefing.byOutcome")}
            </button>
          </span>
        </div>

        {/* active filter chips with clear actions (CR03 3.2) */}
        {active.length ? (
          <div className="mb-4 flex flex-wrap items-center gap-1.5" data-testid="filter-chips">
            <span className="text-[11px] text-ink-600">{t("briefing.activeFilters")}</span>
            {active.map((k) => (
              <button
                key={k}
                onClick={() => setParam(k, null)}
                aria-label={t("briefing.clearOne", { name: filterLabel(k) })}
                className="inline-flex items-center gap-1 rounded-md bg-maroon-100 px-2 py-0.5 text-[11px] font-medium text-maroon-900 transition-colors hover:bg-maroon-700 hover:text-white cursor-pointer"
              >
                {filterLabel(k)} <X className="size-3" />
              </button>
            ))}
            <button
              onClick={() => router.push(pathname as never, { scroll: false })}
              className="text-[11px] font-medium text-ink-600 underline-offset-2 hover:text-maroon-700 hover:underline cursor-pointer"
            >
              {t("clearFilters")}
            </button>
          </div>
        ) : null}

        {/* 2.1 highest impact this month */}
        {featured.length ? (
          <div className="mb-8">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600" style={{ fontFamily: "inherit" }}>
              {t("briefing.topMonth")}
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-testid="feature-row">
              {featured.map((s, i) => (
                <FeatureSignalCard
                  key={s.id}
                  signal={s}
                  primary={i === 0}
                  canTriage={canTriage}
                  hovered={hoveredId === s.id}
                  highlighted={highlightId === s.id}
                  onHover={setHoveredId}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* 2.2 lanes */}
        <div className="flex flex-col gap-5" data-testid="briefing-lanes">
          {lanes.map((lane, index) => {
            const open = laneOpen(lane.key, index);
            const avg = lane.signals.length
              ? (
                  lane.signals.reduce((sum, s) => sum + (IMPACT_SCORE[s.impact] ?? 0), 0) /
                  lane.signals.length
                ).toFixed(1)
              : "0";
            const Icon = lane.icon;
            return (
              <div key={`${grouping}:${lane.key}`}>
                <button
                  onClick={() => toggleLane(lane.key, index)}
                  aria-expanded={open}
                  aria-label={open ? t("briefing.collapseLane", { name: lane.label }) : t("briefing.expandLane", { name: lane.label })}
                  className="group/lane flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-start hover:bg-sand-100/70 cursor-pointer"
                >
                  {Icon ? <Icon className="size-4 shrink-0 text-maroon-700" /> : null}
                  <span className="text-sm font-medium text-ink-900">{lane.label}</span>
                  <span className="text-xs text-ink-600 tnum">
                    {t("briefing.signalsCount", { count: lane.signals.length })}
                  </span>
                  <span className="text-[11px] text-ink-600 tnum">
                    · {avg} {t("briefing.avgImpact")}
                  </span>
                  <span className="mx-2 h-px flex-1 bg-sand-300/70" aria-hidden />
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-ink-400 transition-transform duration-200",
                      !open && "-rotate-90 rtl:rotate-90"
                    )}
                    aria-hidden
                  />
                </button>
                {open ? (
                  <div className="mt-2 flex gap-3 overflow-x-auto pb-2" style={{ overscrollBehaviorX: "contain" }}>
                    {lane.signals.map((s) => (
                      <MiniSignalCard
                        key={s.id}
                        signal={s}
                        hovered={hoveredId === s.id}
                        highlighted={highlightId === s.id}
                        onHover={setHoveredId}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
