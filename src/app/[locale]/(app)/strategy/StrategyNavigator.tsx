"use client";
// CR02 2.2: Finder-style three-pane column navigator for the Living Strategy,
// with breadcrumb, URL paths, keyboard navigation (mirrored in RTL), a map
// toggle, 180ms pane slides, and a stacked drill-down under 1024px.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  Archive,
  ChevronRight,
  FileStack,
  Map as MapIcon,
  Columns3,
} from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { Chip, ProgressRing, RagDot } from "@/components/ui/primitives";
import type { NavigatorData, NavItem, NavTarget } from "@/server/services/strategy";
import { StrategyMap } from "./StrategyMap";

type Selection = { outcomeId: string | null; targetId: string | null };
type SortMode = "status" | "code" | "progress";

const STATUS_RANK: Record<string, number> = {
  delayed: 0,
  at_risk: 1,
  not_started: 2,
  on_track: 3,
  completed: 4,
};

export function StrategyNavigator({
  data,
  initial,
  initialView,
}: {
  data: NavigatorData;
  initial: Selection;
  initialView: "columns" | "map";
}) {
  const t = useTranslations("strategy");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const isRtl = locale === "ar";
  const archived = data.edition.status === "archived";

  const [sel, setSel] = React.useState<Selection>(initial);
  const [view, setView] = React.useState<"columns" | "map">(initialView);
  const [sortMode, setSortMode] = React.useState<SortMode>("code");
  const [clusterId, setClusterId] = React.useState<string>("");
  const [stacked, setStacked] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setStacked(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const outcome = data.outcomes.find((o) => o.id === sel.outcomeId) ?? null;
  const target = data.targets.find((tg) => tg.id === sel.targetId) ?? null;

  /* URL reflects the path: /strategy/nds3/o3/o3-t1 (CR02 2.2). pushState keeps
     the drill instant; popstate restores the selection. */
  const pathFor = React.useCallback(
    (o: typeof outcome, tg: typeof target, v: "columns" | "map") => {
      let p = `/${locale}/strategy/${data.edition.code}`;
      if (o) p += `/${o.slug}`;
      if (o && tg) p += `/${tg.slug}`;
      return v === "map" ? `${p}?view=map` : p;
    },
    [locale, data.edition.code]
  );
  const navigate = React.useCallback(
    (next: Selection, v?: "columns" | "map") => {
      setSel(next);
      const o = data.outcomes.find((x) => x.id === next.outcomeId) ?? null;
      const tg = data.targets.find((x) => x.id === next.targetId) ?? null;
      window.history.pushState({}, "", pathFor(o, tg, v ?? view));
    },
    [data.outcomes, data.targets, pathFor, view]
  );
  React.useEffect(() => {
    function onPop() {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("strategy");
      const oSlug = parts[idx + 2] ?? null;
      const tSlug = parts[idx + 3] ?? null;
      const o = data.outcomes.find((x) => x.slug === oSlug) ?? null;
      const tg = data.targets.find((x) => x.slug === tSlug) ?? null;
      setSel({ outcomeId: o?.id ?? null, targetId: tg?.id ?? null });
      setView(new URLSearchParams(window.location.search).get("view") === "map" ? "map" : "columns");
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [data.outcomes, data.targets]);

  /* Pane 2 rows for the selected outcome */
  const targetRows = React.useMemo(() => {
    if (!outcome) return [];
    let rows = data.targets.filter((tg) => tg.outcomeId === outcome.id);
    if (clusterId) rows = rows.filter((tg) => tg.clusterIds.includes(clusterId));
    const progressOf = (tg: NavTarget) =>
      tg.kpi?.latest != null && tg.kpi.target ? tg.kpi.latest / tg.kpi.target : -1;
    if (sortMode === "status") {
      rows = [...rows].sort(
        (a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || a.sort - b.sort
      );
    } else if (sortMode === "progress") {
      rows = [...rows].sort((a, b) => progressOf(b) - progressOf(a));
    } else {
      rows = [...rows].sort((a, b) => (a.code ?? "").localeCompare(b.code ?? ""));
    }
    return rows;
  }, [data.targets, outcome, sortMode, clusterId]);

  /* Pane 3 groups */
  const pane3 = React.useMemo(() => {
    if (!outcome) return null;
    const inCluster = (i: NavItem) => !clusterId || i.clusterIds.includes(clusterId);
    if (target) {
      const items = data.items.filter((i) => i.targetId === target.id && inCluster(i));
      return {
        outcomeLevel: [] as NavItem[],
        initiatives: items.filter((i) => i.type === "initiative"),
        projects: items.filter((i) => i.type === "project"),
      };
    }
    const direct = data.items.filter(
      (i) => i.outcomeId === outcome.id && i.targetId === null && inCluster(i)
    );
    return {
      outcomeLevel: direct,
      initiatives: [] as NavItem[],
      projects: [] as NavItem[],
    };
  }, [data.items, outcome, target, clusterId]);

  /* Keyboard: arrows move in a pane, the drill key (right in LTR, left in
     RTL) goes deeper, the other one goes back, Enter opens the detail. */
  function onKeyDown(e: React.KeyboardEvent) {
    const drillKey = isRtl ? "ArrowLeft" : "ArrowRight";
    const backKey = isRtl ? "ArrowRight" : "ArrowLeft";
    const active = document.activeElement as HTMLElement | null;
    if (!active || !containerRef.current?.contains(active)) return;
    const pane = active.closest("[data-pane]") as HTMLElement | null;
    if (!pane) return;
    const rows = [...pane.querySelectorAll<HTMLElement>("[data-row]")];
    const idx = rows.indexOf(active);

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = rows[e.key === "ArrowDown" ? idx + 1 : idx - 1];
      next?.focus();
    } else if (e.key === drillKey) {
      e.preventDefault();
      active.click();
      const paneNo = Number(pane.dataset.pane);
      requestAnimationFrame(() => {
        const nextPane = containerRef.current?.querySelector<HTMLElement>(
          `[data-pane="${paneNo + 1}"] [data-row]`
        );
        nextPane?.focus();
      });
    } else if (e.key === backKey) {
      e.preventDefault();
      const paneNo = Number(pane.dataset.pane);
      if (paneNo === 3 && target) navigate({ outcomeId: sel.outcomeId, targetId: null });
      if (paneNo >= 2) {
        const prev = containerRef.current?.querySelector<HTMLElement>(
          `[data-pane="${Math.max(1, paneNo - 1)}"] [data-row][data-selected="true"]`
        ) ??
          containerRef.current?.querySelector<HTMLElement>(
            `[data-pane="${Math.max(1, paneNo - 1)}"] [data-row]`
          );
        prev?.focus();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const id = active.dataset.nodeId;
      if (id) router.push(`/strategy/${id}` as never);
    }
  }

  const showPane = (n: 1 | 2 | 3) => {
    if (!stacked) return true;
    const depth = target ? 3 : outcome ? 2 : 1;
    return depth === n;
  };

  const crumb = (
    <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-sm" aria-label={t("title")}>
      {/* Edition switch */}
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
      {outcome ? (
        <>
          <ChevronRight className="size-3.5 flip-rtl text-ink-400" aria-hidden />
          <button
            onClick={() => navigate({ outcomeId: outcome.id, targetId: null })}
            className="max-w-64 truncate font-medium text-maroon-700 hover:underline cursor-pointer"
          >
            {outcome.code ? `${outcome.code} · ` : ""}
            {bi(locale, outcome.titleEn, outcome.titleAr)}
          </button>
        </>
      ) : null}
      {target ? (
        <>
          <ChevronRight className="size-3.5 flip-rtl text-ink-400" aria-hidden />
          <span className="max-w-64 truncate font-medium text-ink-900">
            {target.code ? `${target.code} · ` : ""}
            {bi(locale, target.titleEn, target.titleAr)}
          </span>
        </>
      ) : null}
      <span className="ms-auto inline-flex items-center gap-0.5 rounded-lg bg-sand-100 p-0.5">
        <button
          onClick={() => {
            setView("columns");
            window.history.replaceState({}, "", pathFor(outcome, target, "columns"));
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer",
            view === "columns" ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
          )}
        >
          <Columns3 className="size-3.5" /> {t("nav.list")}
        </button>
        <button
          onClick={() => {
            setView("map");
            window.history.replaceState({}, "", pathFor(outcome, target, "map"));
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer",
            view === "map" ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
          )}
        >
          <MapIcon className="size-3.5" /> {t("nav.map")}
        </button>
      </span>
    </nav>
  );

  if (view === "map") {
    return (
      <div>
        {crumb}
        <StrategyMap
          data={data}
          selection={sel}
          onSelect={(next) => navigate(next)}
          onOpen={(id) => router.push(`/strategy/${id}` as never)}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} onKeyDown={onKeyDown}>
      {crumb}
      {archived ? (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-sand-300 bg-sand-100 px-4 py-2.5 text-sm text-ink-600" data-testid="archive-banner">
          <Archive className="size-4 shrink-0" />
          {t("archiveBanner", { name: bi(locale, data.edition.nameEn, data.edition.nameAr) })}
        </div>
      ) : null}
      <div
        className={cn(
          "grid gap-4",
          stacked ? "grid-cols-1" : "lg:grid-cols-[minmax(280px,340px)_minmax(280px,1fr)_minmax(300px,1.2fr)]"
        )}
        data-testid="strategy-panes"
      >
        {/* Pane 1: outcomes */}
        {showPane(1) ? (
          <section data-pane="1" aria-label={t("nav.outcomes")}>
            <PaneHeading>{t("nav.outcomes")}</PaneHeading>
            <div className="flex flex-col gap-2.5">
              {data.outcomes.map((o) => {
                const selected = o.id === sel.outcomeId;
                return (
                  <button
                    key={o.id}
                    data-row
                    data-node-id={o.id}
                    data-selected={selected}
                    onClick={() => navigate({ outcomeId: o.id, targetId: null })}
                    onDoubleClick={() => router.push(`/strategy/${o.id}` as never)}
                    className={cn(
                      "card flex items-center gap-3.5 p-3.5 text-start transition-colors cursor-pointer",
                      selected && "border-maroon-300 bg-maroon-50"
                    )}
                  >
                    <ProgressRing value={o.progress} size={44} stroke={4}>
                      <span className="text-[11px] font-semibold text-maroon-900 tnum">
                        {o.code ?? ""}
                      </span>
                    </ProgressRing>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <RagDot status={o.status} />
                        <span className="truncate text-sm font-medium text-ink-900">
                          {bi(locale, o.titleEn, o.titleAr)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-600 tnum">
                        {o.targetCount
                          ? t("nav.counts", {
                              targets: o.targetCount,
                              initiatives: o.initiativeCount,
                              projects: o.projectCount,
                            })
                          : t("nav.countsShort", {
                              initiatives: o.initiativeCount,
                              projects: o.projectCount,
                            })}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Pane 2: targets */}
        {showPane(2) ? (
          <section data-pane="2" aria-label={t("nav.targets")}>
            <PaneHeading
              aside={
                outcome ? (
                  <span className="flex items-center gap-1.5">
                    {stacked ? (
                      <BackButton onClick={() => navigate({ outcomeId: null, targetId: null })} label={t("nav.back")} />
                    ) : null}
                    <select
                      value={sortMode}
                      onChange={(e) => setSortMode(e.target.value as SortMode)}
                      className="rounded-md border border-sand-300 bg-white px-1.5 py-1 text-[11px] text-ink-600"
                      aria-label={t("nav.sortStatus")}
                    >
                      <option value="code">{t("nav.sortCode")}</option>
                      <option value="status">{t("nav.sortStatus")}</option>
                      <option value="progress">{t("nav.sortProgress")}</option>
                    </select>
                    {data.clusters.length ? (
                      <select
                        value={clusterId}
                        onChange={(e) => setClusterId(e.target.value)}
                        className="max-w-36 rounded-md border border-sand-300 bg-white px-1.5 py-1 text-[11px] text-ink-600"
                        aria-label={t("nav.filterCluster")}
                      >
                        <option value="">{t("nav.filterCluster")}</option>
                        {data.clusters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {bi(locale, c.titleEn, c.titleAr)}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </span>
                ) : undefined
              }
            >
              {t("nav.targets")}
            </PaneHeading>
            {!outcome ? (
              <PaneHint>{t("nav.selectOutcome")}</PaneHint>
            ) : targetRows.length === 0 ? (
              <PaneHint>{t("nav.noTargets")}</PaneHint>
            ) : (
              <div key={outcome.id} className="pane-slide flex flex-col gap-1.5">
                {targetRows.map((tg) => {
                  const selected = tg.id === sel.targetId;
                  const ratio =
                    tg.kpi?.latest != null && tg.kpi.target
                      ? Math.max(0, Math.min(1, tg.kpi.latest / tg.kpi.target))
                      : null;
                  return (
                    <button
                      key={tg.id}
                      data-row
                      data-node-id={tg.id}
                      data-selected={selected}
                      onClick={() => navigate({ outcomeId: outcome.id, targetId: tg.id })}
                      onDoubleClick={() => router.push(`/strategy/${tg.id}` as never)}
                      className={cn(
                        "card flex flex-col gap-1 px-3.5 py-2.5 text-start transition-colors cursor-pointer",
                        selected && "border-maroon-300 bg-maroon-50"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <RagDot status={tg.status} />
                        <span className="text-[11px] font-medium text-ink-600 tnum">{tg.code}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-ink-900">
                          {bi(locale, tg.titleEn, tg.titleAr)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2.5 ps-4">
                        {ratio != null && tg.kpi ? (
                          <>
                            <span
                              className="h-1.5 w-24 overflow-hidden rounded-full bg-sand-200"
                              role="img"
                              aria-label={`${tg.kpi.nameEn}: ${tg.kpi.latest} / ${tg.kpi.target} ${tg.kpi.unit ?? ""}`}
                            >
                              <span
                                className="block h-full rounded-full bg-maroon-500"
                                style={{ width: `${Math.round(ratio * 100)}%` }}
                              />
                            </span>
                            <span className="text-[11px] text-ink-600 tnum">
                              {formatNumber(tg.kpi.latest, locale, { compact: true })}
                              {" / "}
                              {formatNumber(tg.kpi.target, locale, { compact: true })}
                              {tg.kpi.unit ? ` ${tg.kpi.unit}` : ""}
                            </span>
                          </>
                        ) : null}
                        <span className="ms-auto text-[11px] text-ink-600 tnum">
                          {t("nav.countsShort", {
                            initiatives: tg.initiativeCount,
                            projects: tg.projectCount,
                          })}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {/* Pane 3: initiatives and projects */}
        {showPane(3) ? (
          <section data-pane="3" aria-label={t("nav.items")}>
            <PaneHeading
              aside={
                stacked && target ? (
                  <BackButton
                    onClick={() => navigate({ outcomeId: sel.outcomeId, targetId: null })}
                    label={t("nav.back")}
                  />
                ) : undefined
              }
            >
              {t("nav.items")}
            </PaneHeading>
            {!outcome ? (
              <PaneHint>{t("nav.selectOutcome")}</PaneHint>
            ) : !pane3 ||
              (pane3.outcomeLevel.length === 0 &&
                pane3.initiatives.length === 0 &&
                pane3.projects.length === 0) ? (
              <PaneHint>{target ? t("nav.noItems") : t("nav.selectTarget")}</PaneHint>
            ) : (
              <div key={target?.id ?? outcome.id} className="pane-slide flex flex-col gap-3">
                {pane3.outcomeLevel.length ? (
                  <ItemGroup
                    label={t("nav.outcomeLevel")}
                    items={pane3.outcomeLevel}
                    locale={locale}
                    t={t}
                    tc={tc}
                    onOpen={(id) => router.push(`/strategy/${id}` as never)}
                  />
                ) : null}
                {pane3.initiatives.length ? (
                  <ItemGroup
                    label={t("nav.initiatives")}
                    items={pane3.initiatives}
                    locale={locale}
                    t={t}
                    tc={tc}
                    onOpen={(id) => router.push(`/strategy/${id}` as never)}
                  />
                ) : null}
                {pane3.projects.length ? (
                  <ItemGroup
                    label={t("nav.projects")}
                    items={pane3.projects}
                    locale={locale}
                    t={t}
                    tc={tc}
                    onOpen={(id) => router.push(`/strategy/${id}` as never)}
                  />
                ) : null}
              </div>
            )}
          </section>
        ) : null}
      </div>
      <p className="mt-4 hidden text-[11px] text-ink-600 lg:block">{t("nav.keyboardHint")}</p>
    </div>
  );
}

function PaneHeading({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex min-h-7 items-center justify-between gap-2">
      <h2
        className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-600"
        style={{ fontFamily: "inherit" }}
      >
        {children}
      </h2>
      {aside}
    </div>
  );
}

function PaneHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-sand-300 bg-sand-50 px-4 py-8 text-center text-sm text-ink-600">
      {children}
    </p>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-sand-300 bg-white px-2 py-1 text-[11px] text-ink-600 hover:text-maroon-700 cursor-pointer"
    >
      {label}
    </button>
  );
}

function timelinePct(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  return Math.max(0, Math.min(1, (Date.now() - s) / (e - s)));
}

function ItemGroup({
  label,
  items,
  locale,
  t,
  tc,
  onOpen,
}: {
  label: string;
  items: NavItem[];
  locale: string;
  t: ReturnType<typeof useTranslations<"strategy">>;
  tc: ReturnType<typeof useTranslations<"common">>;
  onOpen: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
        {label}
      </p>
      <div className="flex flex-col gap-1.5">
        {items.map((i) => {
          const pct = timelinePct(i.startDate, i.endDate);
          return (
            <button
              key={i.id}
              data-row
              data-node-id={i.id}
              onClick={() => onOpen(i.id)}
              className="card card-hover flex flex-col gap-1 px-3.5 py-2.5 text-start cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <RagDot status={i.status} />
                {i.code ? (
                  <span className="text-[11px] text-ink-600 tnum">{i.code}</span>
                ) : null}
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">
                  {bi(locale, i.titleEn, i.titleAr)}
                </span>
                {i.targetId === null ? (
                  <Chip tone="sand">{t("nav.outcomeLevel")}</Chip>
                ) : null}
              </span>
              <span className="flex items-center gap-2.5 ps-4 text-[11px] text-ink-600">
                {i.ownerEntityName ? <span className="truncate">{i.ownerEntityName}</span> : null}
                <span>{tc(`status.${i.status}` as never)}</span>
                {pct != null ? (
                  <span className="h-1 w-16 overflow-hidden rounded-full bg-sand-200" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-gulf-400"
                      style={{ width: `${Math.round(pct * 100)}%` }}
                    />
                  </span>
                ) : null}
                {i.deliverableCount ? (
                  <span className="ms-auto flex items-center gap-1 tnum">
                    <FileStack className="size-3" aria-hidden />
                    {t("nav.deliverablesCount", { count: i.deliverableCount })}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
