"use client";
// CR08 7.2: the Leaderboard page body. A hero strip with the period label
// and the three podium cards, then the board switch (People, Departments),
// the window chips, the category tabs and the list as a CSS grid with ARIA
// table roles. The viewer's own row is pinned at the bottom. Everything is
// read from the materialised table through /api/v1/leaderboard; the first
// view arrives from the server so the page never flashes empty.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  CalendarDays,
  Minus,
  Moon,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { bi, cn } from "@/lib/utils";
import { formatNumber, relativeTime } from "@/lib/format";
import { Button, Chip, EmptyState, Skeleton } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger, Tip } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import {
  BOARDS,
  CATEGORIES,
  PERIOD_KINDS,
  periodLabel,
  type BoardCategory,
  type BoardKind,
  type PeriodKind,
  type Trend,
} from "@/lib/leaderboard-math";
import type { LeaderboardView, PersonRow, UnitRow } from "@/server/services/leaderboard";
import { MedalAvatar, MEDAL_BG, medalOf, type Medal } from "./MedalAvatar";

const EASE = [0.22, 1, 0.36, 1] as const;

type Query = { board: BoardKind; window: PeriodKind; category: BoardCategory };

export type Viewer = { id: string; numerals: string; departmentId: string | null };

function queryString(q: Query): string {
  const params = new URLSearchParams();
  params.set("board", q.board);
  params.set("window", q.window);
  params.set("category", q.category);
  return `?${params.toString()}`;
}

/* ------------------------------------------------------------------ */
/* small marks                                                           */
/* ------------------------------------------------------------------ */

/** "Refreshed 3 minutes ago": relative time is the one text that legitimately
    differs between the server render and a late hydration, so the mismatch
    is suppressed on this span and the label re-renders every minute. */
function RefreshedCaption({ at, locale }: { at: string | null; locale: string }) {
  const t = useTranslations("leaderboard");
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="tnum" data-testid="refreshed-at" suppressHydrationWarning>
      {at ? t("refreshedAt", { time: relativeTime(at, locale) }) : t("neverRefreshed")}
    </span>
  );
}

function TrendMark({
  trend,
  previousRank,
  className,
}: {
  trend: Trend;
  previousRank: number | null;
  className?: string;
}) {
  const t = useTranslations("leaderboard");
  const label = t(`trend.${trend}`, { rank: previousRank ?? 0 });
  const icon =
    trend === "up" ? (
      <ArrowUp className="size-4 text-ok" />
    ) : trend === "down" ? (
      <ArrowDown className="size-4 text-danger" />
    ) : trend === "new" ? (
      <Sparkles className="size-4 text-aqua-500" />
    ) : (
      <Minus className="size-4 text-ink-400" />
    );
  return (
    <Tip content={label}>
      <span
        className={cn("inline-flex items-center justify-center", className)}
        role="img"
        aria-label={label}
        tabIndex={0}
        data-trend={trend}
      >
        {icon}
      </span>
    </Tip>
  );
}

function LevelChip({ row }: { row: PersonRow }) {
  const t = useTranslations("leaderboard");
  const locale = useLocale();
  if (row.levelOrder == null) return <span className="text-xs text-ink-400">·</span>;
  const label = t("level", { n: row.levelOrder });
  const descriptor = bi(locale, row.descriptorEn, row.descriptorAr);
  const chip = (
    <Chip tone="navy" className="tnum">
      {label}
    </Chip>
  );
  if (!descriptor) return chip;
  return (
    <Tip content={descriptor}>
      <span className="inline-flex cursor-default" tabIndex={0} aria-label={`${label}: ${descriptor}`}>
        {chip}
      </span>
    </Tip>
  );
}

function MedalBar({ place }: { place: Medal }) {
  return (
    <span
      className={cn("absolute inset-x-0 top-0 h-1 rounded-t-2xl", MEDAL_BG[place])}
      aria-hidden
    />
  );
}

/* ------------------------------------------------------------------ */
/* the podium                                                            */
/* ------------------------------------------------------------------ */

function PodiumCard({
  place,
  person,
  unit,
  fmt,
}: {
  place: Medal;
  person: PersonRow | null;
  unit: UnitRow | null;
  fmt: (v: number) => string;
}) {
  const t = useTranslations("leaderboard");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const order = place === 1 ? "order-1 lg:order-2" : place === 2 ? "order-2 lg:order-1" : "order-3";
  const empty = !person && !unit;
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: place * 0.06, ease: EASE }}
      className={cn(
        "relative flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border bg-white px-3 pb-4 pt-5 text-center shadow-paper",
        place === 1 ? "border-aqua-300 lg:-translate-y-2" : "border-mist-200",
        order,
        empty && "opacity-70"
      )}
      data-testid={`podium-${place}`}
    >
      <MedalBar place={place} />
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">
        {t(`podium.${place === 1 ? "first" : place === 2 ? "second" : "third"}`)}
      </span>
      {person ? (
        <>
          <MedalAvatar
            name={person.nameEn}
            color={person.avatarColor}
            size={place === 1 ? 60 : 52}
            rank={place}
            label={t(`medal.${place === 1 ? "gold" : place === 2 ? "silver" : "bronze"}`)}
            className="mt-1"
          />
          <span className="mt-1 line-clamp-1 w-full text-sm font-medium text-ink-900">
            {bi(locale, person.nameEn, person.nameAr)}
          </span>
          <span className="line-clamp-1 w-full text-xs text-ink-600">
            {bi(locale, person.unitEn, person.unitAr) || " "}
          </span>
          <span className="font-display text-2xl font-semibold leading-none text-navy-900 tnum">
            {fmt(person.points)}
          </span>
          <TrendMark trend={person.trend} previousRank={person.previousRank} />
        </>
      ) : unit ? (
        <>
          <span
            className={cn(
              "mt-1 flex size-13 items-center justify-center rounded-full font-display text-2xl font-semibold ring-[3px] ring-offset-2 ring-offset-white",
              MEDAL_BG[place],
              place === 1 ? "ring-aqua-500" : place === 2 ? "ring-ink-400" : "ring-warn"
            )}
            aria-hidden
          >
            {place}
          </span>
          <span className="mt-1 line-clamp-2 w-full text-sm font-medium leading-snug text-ink-900">
            {bi(locale, unit.nameEn, unit.nameAr)}
          </span>
          <span className="font-display text-2xl font-semibold leading-none text-navy-900 tnum">
            {fmt(unit.pointsPerMember)}
          </span>
          <span className="text-xs text-ink-600">{t("perMemberShort")}</span>
          <TrendMark trend={unit.trend} previousRank={unit.previousRank} />
        </>
      ) : (
        <>
          <span className="mt-1 flex size-13 items-center justify-center rounded-full border border-dashed border-mist-300 text-ink-400">
            <Trophy className="size-5" />
          </span>
          <span className="text-xs text-ink-400">{t("podium.empty")}</span>
        </>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* the rows                                                              */
/* ------------------------------------------------------------------ */

const PEOPLE_COLS =
  "grid-cols-[2.5rem_2.75rem_minmax(0,1fr)_4.5rem_2.25rem] md:grid-cols-[3rem_2.75rem_minmax(0,1.3fr)_minmax(0,1fr)_5.5rem_5.5rem_3rem]";
const UNIT_COLS =
  "grid-cols-[2.5rem_minmax(0,1fr)_5rem_2.25rem] md:grid-cols-[3rem_minmax(0,1.3fr)_6rem_6rem_minmax(7rem,1fr)_3rem]";

function PersonLine({
  row,
  fmt,
  pinned,
  showUnitMark,
}: {
  row: PersonRow;
  fmt: (v: number) => string;
  pinned?: boolean;
  showUnitMark?: boolean;
}) {
  const t = useTranslations("leaderboard");
  const locale = useLocale();
  const medal = medalOf(row.rank);
  return (
    <div
      role="row"
      aria-rowindex={row.rank}
      className={cn(
        "grid items-center gap-3 px-4 py-2.5 transition-colors",
        PEOPLE_COLS,
        !pinned && "hover:bg-mist-50",
        !pinned && row.isMe && "bg-navy-50/70"
      )}
      data-testid={pinned ? "own-row" : "board-row"}
      data-rank={row.rank}
      data-me={row.isMe || undefined}
    >
      <span role="cell" className="font-display text-lg font-semibold text-ink-900 tnum">
        {fmt(row.rank)}
      </span>
      <span role="cell">
        <MedalAvatar
          name={row.nameEn}
          color={row.avatarColor}
          size={32}
          rank={row.rank}
          label={medal ? t(`medal.${medal === 1 ? "gold" : medal === 2 ? "silver" : "bronze"}`) : undefined}
        />
      </span>
      <span role="cell" className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-ink-900">
            {bi(locale, row.nameEn, row.nameAr)}
          </span>
          {row.isMe ? <Chip tone="aqua">{t("you")}</Chip> : null}
          {showUnitMark && row.inViewerUnit && !row.isMe ? (
            <Chip tone="mist" className="hidden md:inline-flex">
              {t("yourUnit")}
            </Chip>
          ) : null}
        </span>
        <span className="block truncate text-xs text-ink-600 md:hidden">
          {bi(locale, row.unitEn, row.unitAr)}
        </span>
      </span>
      <span role="cell" className="hidden truncate text-sm text-ink-600 md:block">
        {bi(locale, row.unitEn, row.unitAr) || "·"}
      </span>
      <span role="cell" className="hidden md:block">
        <LevelChip row={row} />
      </span>
      <span role="cell" className="text-end text-sm font-semibold text-ink-900 tnum">
        {fmt(row.points)}
      </span>
      <span role="cell" className="flex justify-center">
        <TrendMark trend={row.trend} previousRank={row.previousRank} />
      </span>
    </div>
  );
}

function UnitLine({
  row,
  fmt,
  pinned,
}: {
  row: UnitRow;
  fmt: (v: number) => string;
  pinned?: boolean;
}) {
  const t = useTranslations("leaderboard");
  const locale = useLocale();
  const medal = row.points > 0 ? medalOf(row.rank) : null;
  const pct = Math.round(row.activeShare * 100);
  return (
    <div
      role="row"
      aria-rowindex={row.rank}
      className={cn(
        "grid items-center gap-3 px-4 py-2.5 transition-colors",
        UNIT_COLS,
        !pinned && "hover:bg-mist-50",
        !pinned && row.isMine && "bg-navy-50/70"
      )}
      data-testid={pinned ? "own-unit-row" : "board-row"}
      data-rank={row.rank}
      data-mine={row.isMine || undefined}
    >
      <span role="cell" className="flex items-center gap-2">
        <span className="font-display text-lg font-semibold text-ink-900 tnum">{fmt(row.rank)}</span>
        {medal ? (
          <span
            className={cn("size-2.5 rounded-full", MEDAL_BG[medal])}
            role="img"
            aria-label={t(`medal.${medal === 1 ? "gold" : medal === 2 ? "silver" : "bronze"}`)}
          />
        ) : null}
      </span>
      <span role="cell" className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-ink-900">
            {bi(locale, row.nameEn, row.nameAr)}
          </span>
          {row.isMine ? <Chip tone="aqua">{t("yourUnit")}</Chip> : null}
        </span>
        <span className="block text-xs text-ink-400 tnum" dir="ltr">
          {row.code}
          <span className="md:hidden">
            {" · "}
            {t("membersShort", { count: row.members })}
          </span>
        </span>
      </span>
      <span role="cell" className="text-end text-sm font-semibold text-ink-900 tnum">
        {fmt(row.pointsPerMember)}
      </span>
      <span role="cell" className="hidden text-end text-sm text-ink-600 tnum md:block">
        {fmt(row.points)}
      </span>
      <span role="cell" className="hidden min-w-0 items-center gap-2 md:flex">
        <span
          className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-mist-200"
          aria-hidden
        >
          <span
            className="block h-full rounded-full bg-teal-600 transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className="w-16 shrink-0 text-xs text-ink-600 tnum">
          {t("activeOf", { active: row.activeMembers, members: row.members })}
        </span>
      </span>
      <span role="cell" className="flex justify-center">
        <TrendMark trend={row.trend} previousRank={row.previousRank} />
      </span>
    </div>
  );
}

function HeaderRow({ board }: { board: BoardKind }) {
  const t = useTranslations("leaderboard");
  const head = "text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal";
  if (board === "departments") {
    return (
      <div role="row" className={cn("grid items-center gap-3 border-b border-mist-200 px-4 py-2", UNIT_COLS)}>
        <span role="columnheader" className={head}>{t("columns.rank")}</span>
        <span role="columnheader" className={head}>{t("columns.unit")}</span>
        <span role="columnheader" className={cn(head, "text-end")}>{t("columns.perMember")}</span>
        <span role="columnheader" className={cn(head, "hidden text-end md:block")}>{t("columns.total")}</span>
        <span role="columnheader" className={cn(head, "hidden md:block")}>{t("columns.active")}</span>
        <span role="columnheader" className={cn(head, "text-center")}>{t("columns.trend")}</span>
      </div>
    );
  }
  return (
    <div role="row" className={cn("grid items-center gap-3 border-b border-mist-200 px-4 py-2", PEOPLE_COLS)}>
      <span role="columnheader" className={head}>{t("columns.rank")}</span>
      {/* the monogram column keeps its grid cell; only the label is visually hidden */}
      <span role="columnheader">
        <span className="sr-only">{t("columns.monogram")}</span>
      </span>
      <span role="columnheader" className={head}>{t("columns.person")}</span>
      <span role="columnheader" className={cn(head, "hidden md:block")}>{t("columns.unit")}</span>
      <span role="columnheader" className={cn(head, "hidden md:block")}>{t("columns.level")}</span>
      <span role="columnheader" className={cn(head, "text-end")}>{t("columns.points")}</span>
      <span role="columnheader" className={cn(head, "text-center")}>{t("columns.trend")}</span>
    </div>
  );
}

function RowsSkeleton({ board }: { board: BoardKind }) {
  return (
    <div className="divide-y divide-mist-100" aria-busy data-testid="board-skeleton">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={cn("grid items-center gap-3 px-4 py-3", board === "people" ? PEOPLE_COLS : UNIT_COLS)}
        >
          <Skeleton className="h-5 w-6 rounded" />
          {board === "people" ? <Skeleton className="size-8 rounded-full" /> : null}
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="hidden h-4 w-3/4 rounded md:block" />
          <Skeleton className="h-4 w-12 rounded" />
          <Skeleton className="h-4 w-8 rounded" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the page body                                                         */
/* ------------------------------------------------------------------ */

export function LeaderboardBoard({
  initial,
  viewer,
}: {
  initial: LeaderboardView;
  viewer: Viewer;
}) {
  const t = useTranslations("leaderboard");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const reduced = useReducedMotion();

  const [query, setQuery] = React.useState<Query>({
    board: initial.board,
    window: initial.window,
    category: initial.category,
  });
  const [view, setView] = React.useState<LeaderboardView>(initial);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const requestId = React.useRef(0);
  const first = React.useRef(true);

  const load = React.useCallback(
    async (q: Query) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`/api/v1/leaderboard${queryString(q)}`);
        const j = (await res.json()) as { data: LeaderboardView | null };
        if (id !== requestId.current) return;
        if (!res.ok || !j.data) {
          setError(true);
        } else {
          setView(j.data);
        }
      } catch {
        if (id === requestId.current) setError(true);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    []
  );

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.history.replaceState(null, "", `${window.location.pathname}${queryString(query)}`);
    void load(query);
  }, [query, load]);

  const fmt = React.useCallback(
    (v: number) => formatNumber(v, locale, { numerals: viewer.numerals, decimals: 1 }),
    [locale, viewer.numerals]
  );

  async function refreshNow() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/v1/leaderboard/refresh", { method: "POST" });
      const j = await res.json().catch(() => null);
      if (res.ok) {
        toast(t("refreshed", { rows: j?.data?.rows ?? 0 }), "success");
        await load(query);
      } else {
        toast(tc("error"), "error");
      }
    } finally {
      setRefreshing(false);
    }
  }

  const label = periodLabel(view.window, view.periodKey, locale);
  const isPeople = query.board === "people";
  const podiumPeople = isPeople ? view.people.slice(0, 3) : [];
  // a unit without points is listed but never on the podium
  const podiumUnits = !isPeople ? view.units.filter((u) => u.points > 0).slice(0, 3) : [];
  const hasRows = isPeople ? view.people.length > 0 : view.units.length > 0;

  /* ---- the states ---- */
  let body: React.ReactNode;
  if (view.hidden) {
    body = (
      <EmptyState
        icon={<Moon />}
        title={t("quietTitle")}
        hint={t("quietHint")}
        className="bg-white py-16"
        action={
          <Link href={"/profile" as never}>
            <Button size="sm" variant="secondary">{t("openProfile")}</Button>
          </Link>
        }
      />
    );
  } else if (error) {
    body = (
      <EmptyState
        title={t("loadError")}
        action={
          <Button size="sm" variant="secondary" onClick={() => load(query)}>
            {t("retry")}
          </Button>
        }
      />
    );
  } else if (loading) {
    body = (
      <div className="card overflow-hidden">
        <HeaderRow board={query.board} />
        <RowsSkeleton board={query.board} />
      </div>
    );
  } else if (view.notBuilt) {
    body = (
      <EmptyState
        icon={<Trophy />}
        title={t("notBuiltTitle")}
        hint={t("notBuiltHint")}
        action={
          view.canRefresh ? (
            <Button size="sm" loading={refreshing} onClick={refreshNow} data-testid="refresh-now">
              <RefreshCw /> {t("refreshNow")}
            </Button>
          ) : undefined
        }
      />
    );
  } else if (!hasRows) {
    body = (
      <EmptyState
        icon={<Trophy />}
        title={isPeople ? t("emptyTitle") : t("emptyUnitsTitle")}
        hint={t("emptyHint")}
      />
    );
  } else {
    body = (
      <div
        className="card overflow-hidden"
        role="table"
        aria-label={t("tableAria", {
          board: t(`boards.${query.board}`),
          category: t(`categories.${query.category}`),
          period: label,
        })}
        aria-rowcount={view.total}
        data-testid="board-table"
        data-board={query.board}
      >
        <HeaderRow board={query.board} />
        <div role="rowgroup" className="divide-y divide-mist-100">
          {isPeople
            ? view.people.map((row) => (
                <PersonLine key={row.subjectId} row={row} fmt={fmt} showUnitMark={view.scope === "unit"} />
              ))
            : view.units.map((row) => <UnitLine key={row.subjectId} row={row} fmt={fmt} />)}
        </div>
        {/* CR08 7.2: the viewer's own row, pinned. When there is no row to pin
            the strip carries a sentence instead, and a row group with no row in
            it is invalid, so the role goes with the row. */}
        <div
          role={(isPeople ? view.mine : view.mineUnit) ? "rowgroup" : undefined}
          className="sticky bottom-0 border-t-2 border-navy-300 bg-navy-50/95 backdrop-blur-sm"
        >
          {isPeople ? (
            view.mine ? (
              <PersonLine row={view.mine} fmt={fmt} pinned />
            ) : (
              <p className="px-4 py-3 text-sm text-ink-600" data-testid="own-row" data-empty>
                {view.excludedViewer ? t("excludedViewer") : t("noPointsYet")}
              </p>
            )
          ) : view.mineUnit ? (
            <UnitLine row={view.mineUnit} fmt={fmt} pinned />
          ) : (
            <p className="px-4 py-3 text-sm text-ink-600" data-testid="own-unit-row" data-empty>
              {t("noUnit")}
            </p>
          )}
        </div>
      </div>
    );
  }

  const scopeLine = isPeople
    ? view.scope === "full"
      ? t("scope.full", { count: view.total })
      : view.scope === "unit"
        ? t("scope.unit")
        : t("scope.top10")
    : t("scope.units", { count: view.total });

  return (
    <div className="flex flex-col gap-6" data-testid="leaderboard-page">
      {/* the hero strip: period, refresh, podium */}
      <section
        className="card overflow-hidden bg-[linear-gradient(135deg,var(--color-navy-50),white_58%)]"
        data-testid="leaderboard-hero"
      >
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-center lg:p-8">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">
              {t("eyebrow")}
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-navy-900">{t("title")}</h1>
            <p className="mt-2 max-w-md text-sm text-ink-600">{t("subtitle")}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Chip tone="navy" data-testid="period-label">
                <CalendarDays className="size-3" /> {label}
              </Chip>
              <Chip tone="mist">{t(`categories.${query.category}`)}</Chip>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-400">
              <RefreshedCaption at={view.refreshedAt} locale={locale} />
              <span className="hidden sm:inline">{t("refreshEvery")}</span>
              {view.canRefresh ? (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={refreshing}
                  onClick={refreshNow}
                  data-testid="refresh-now"
                >
                  <RefreshCw /> {t("refreshNow")}
                </Button>
              ) : null}
            </div>
          </div>
          {!view.hidden ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:pt-2" data-testid="podium">
              {([1, 2, 3] as Medal[]).map((place) => (
                <PodiumCard
                  key={`${query.board}-${place}`}
                  place={place}
                  person={podiumPeople[place - 1] ?? null}
                  unit={podiumUnits[place - 1] ?? null}
                  fmt={fmt}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* the controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label={t("boardSwitch")}
          className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-mist-100 p-1"
        >
          {BOARDS.map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={query.board === b}
              onClick={() => setQuery((q) => ({ ...q, board: b }))}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500",
                query.board === b ? "bg-white text-navy-900 shadow-sm" : "text-ink-600 hover:text-ink-900"
              )}
              data-testid={`board-${b}`}
            >
              {b === "people" ? <Users className="size-4" /> : <Building2 className="size-4" />}
              {t(`boards.${b}`)}
            </button>
          ))}
        </div>
        <div role="group" aria-label={t("windowSwitch")} className="flex flex-wrap gap-1.5">
          {PERIOD_KINDS.map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={query.window === w}
              onClick={() => setQuery((q) => ({ ...q, window: w }))}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500",
                query.window === w
                  ? "border-navy-700 bg-navy-700 text-white"
                  : "border-mist-300 bg-white text-ink-600 hover:border-navy-300 hover:text-navy-700"
              )}
              data-testid={`window-${w}`}
            >
              {t(`windows.${w}`)}
            </button>
          ))}
        </div>
      </div>

      <Tabs
        value={query.category}
        onValueChange={(v) => setQuery((q) => ({ ...q, category: v as BoardCategory }))}
      >
        <TabsList aria-label={t("categorySwitch")}>
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c} value={c} data-testid={`category-${c}`}>
              {t(`categories.${c}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-ink-600">
          <span>{t(`categoryHints.${query.category}`)}</span>
          {!view.hidden && !view.notBuilt && hasRows ? (
            <span className="text-ink-400 tnum" data-testid="scope-line">
              {scopeLine}
            </span>
          ) : null}
        </p>
        {/* Every trigger points at a panel through aria-controls, so every
            category needs one in the document; only the chosen one holds the
            board, the rest are mounted and hidden. */}
        {CATEGORIES.map((c) => (
          <TabsContent key={c} value={c} forceMount hidden={c !== query.category} className="mt-4">
            {c === query.category ? (
              <motion.section
                key={`${query.board}-${query.window}-${query.category}`}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: EASE }}
                data-testid="board-section"
              >
                {body}
              </motion.section>
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
