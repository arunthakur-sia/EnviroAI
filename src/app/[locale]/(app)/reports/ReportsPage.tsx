"use client";
// CR08 5.1: the Reports page. The hero with the Request report entry, the
// cover gallery of published reports with its filters (family, type, period,
// scope, search), the viewer's own requests with build progress, and for the
// Super Admin every report with a status filter and the custom-report entry.
// Builds in progress are polled every three seconds.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FilePlus2, Files, Inbox, Search, Wand2, X } from "lucide-react";
import { bi, cn } from "@/lib/utils";
import { Button, Chip, EmptyState, Input, NativeSelect } from "@/components/ui/primitives";
import type { ReportListItem, ReportTypeView } from "@/server/services/reports";
import { CoverCard } from "@/components/nexus/reports/CoverCard";
import { OwnerControlCompact } from "@/components/nexus/people/OwnerControl";
import { ButtonLink } from "@/components/nexus/reports/ButtonLink";
import { TimeAgo } from "@/components/nexus/reports/TimeAgo";
import {
  FAMILY_TONE,
  REPORT_STATUSES,
  STATUS_TONE,
  type LibraryItem,
  type ReportStatus,
} from "@/components/nexus/reports/shared";

type Family = "all" | "public" | "internal";
type FamilyKey = "public" | "internal" | "custom";
type StatusKey = ReportStatus;

function periodSortKey(r: ReportListItem): number {
  const p = r.period;
  return p.year * 1000 + (p.month ?? 0) * 10 + (p.quarter ?? 0);
}

function scopeKey(r: ReportListItem): string {
  return r.scope.kind === "period" ? "npc" : r.scope.kind;
}

function updatedAt(r: ReportListItem): string {
  return r.updatedAt ?? r.createdAt;
}

/* ------------------------------------------------------------------ */
/* request rows (my requests, all reports)                              */
/* ------------------------------------------------------------------ */

function BuildBar({ report, library }: { report: ReportListItem; library: LibraryItem[] }) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const p = report.progress;
  const total = p?.total || report.sectionCount || 1;
  const done = Math.min(total, p?.done ?? 0);
  const stage = p?.stage ?? "";
  const stageItem = library.find((l) => l.code === stage);
  const stageLabel = stageItem ? bi(locale, stageItem.name.en, stageItem.name.ar) : stage;
  return (
    <div className="mt-2" data-testid="row-progress">
      <div className="h-1.5 overflow-hidden rounded-full bg-sand-200" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div className="h-full rounded-full bg-maroon-700 transition-[width] duration-300 ease-[var(--ease-paper)]" style={{ width: `${Math.round((done / total) * 100)}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-ink-600">
        <span className="tnum">{t("hub.progressOf", { done, total })}</span>
        {stageLabel ? <span className="text-ink-400">{` · ${t("hub.stage", { stage: stageLabel })}`}</span> : null}
      </p>
    </div>
  );
}

function ReportRows({
  items,
  library,
  showRequester,
  testId,
}: {
  items: ReportListItem[];
  library: LibraryItem[];
  showRequester: boolean;
  testId: string;
}) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const cols = showRequester
    ? "md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_7.5rem]"
    : "md:grid-cols-[minmax(0,2.6fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_7.5rem]";
  return (
    <div role="table" className="card overflow-hidden" data-testid={testId}>
      <div
        role="row"
        className={cn(
          "hidden gap-3 border-b border-sand-200 bg-sand-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal md:grid",
          cols
        )}
      >
        <div role="columnheader">{t("hub.columns.report")}</div>
        <div role="columnheader">{t("hub.columns.period")}</div>
        <div role="columnheader">{t("hub.columns.scope")}</div>
        <div role="columnheader">{showRequester ? t("hub.columns.requester") : t("hub.columns.updated")}</div>
        <div role="columnheader" className="md:text-end">
          {t("hub.columns.status")}
        </div>
      </div>
      {items.map((r) => {
        const title = bi(locale, r.titleEn, r.titleAr);
        const scope =
          r.scope.kind === "npc" || r.scope.kind === "period" ? t(`scopeKinds.${r.scope.kind}`) : bi(locale, r.scope.label.en, r.scope.label.ar);
        return (
          /* CR08 9.1: the requester is a person chip, a button of its own, so
             the row is no longer one link: the title carries the link and
             stretches over the row (::after), the chip sits above it */
          <div
            key={r.id}
            role="row"
            data-testid="report-row"
            data-report-id={r.id}
            data-status={r.status}
            className={cn(
              "relative grid grid-cols-1 gap-2 border-b border-sand-200 px-4 py-3 transition-colors last:border-b-0 hover:bg-maroon-50 md:items-center md:gap-3",
              cols
            )}
          >
            <div role="cell" className="min-w-0">
              <Link
                href={`/reports/${r.id}`}
                aria-label={t("hub.openReport", { title })}
                className="block rounded-md after:absolute after:inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-500"
              >
                <p className="truncate text-sm font-medium text-ink-900">{title}</p>
              </Link>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-600">
                <Chip tone={FAMILY_TONE[r.family] ?? "sand"}>{t(`families.${r.family as FamilyKey}`)}</Chip>
                <span className="truncate">{bi(locale, r.typeNameEn, r.typeNameAr)}</span>
              </p>
              {r.status === "generating" ? <BuildBar report={r} library={library} /> : null}
              {r.status === "failed" ? <p className="mt-1 text-xs text-danger">{t("hub.failedLine")}</p> : null}
            </div>
            <div role="cell" className="text-sm text-ink-900 tnum">
              {bi(locale, r.period.label.en, r.period.label.ar)}
            </div>
            <div role="cell" className="truncate text-sm text-ink-600">
              {scope}
            </div>
            <div role="cell" className="min-w-0 truncate text-xs text-ink-600">
              {showRequester ? (
                <>
                  {/* CR08 9.1: the requester, with the person card */}
                  {r.requestedBy && r.requesterColor && r.requesterNameEn ? (
                    <OwnerControlCompact
                      owner={{
                        id: r.requestedBy,
                        nameEn: r.requesterNameEn,
                        nameAr: r.requesterNameAr ?? r.requesterNameEn,
                        avatarColor: r.requesterColor,
                      }}
                      item={{ type: "report", id: r.id, titleEn: r.titleEn, titleAr: r.titleAr, href: `/reports/${r.id}` }}
                      className="relative z-[1] max-w-full"
                    />
                  ) : r.requesterNameEn ? (
                    bi(locale, r.requesterNameEn, r.requesterNameAr)
                  ) : null}
                  <TimeAgo iso={updatedAt(r)} className="block text-ink-400" />
                </>
              ) : (
                <>
                  <TimeAgo iso={updatedAt(r)} />
                  <span className="ms-1.5 text-ink-400 tnum">{t("hub.version", { n: r.version })}</span>
                </>
              )}
            </div>
            <div role="cell" className="flex items-center gap-1.5 md:justify-end">
              <Chip tone={STATUS_TONE[r.status] ?? "sand"}>{t(`statuses.${r.status as StatusKey}`)}</Chip>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the page                                                             */
/* ------------------------------------------------------------------ */

export function ReportsPage({
  types,
  reports: initial,
  library,
  userId,
  isSuperAdmin,
}: {
  types: ReportTypeView[];
  reports: ReportListItem[];
  library: LibraryItem[];
  userId: string;
  isSuperAdmin: boolean;
}) {
  const t = useTranslations("reports");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [reports, setReports] = React.useState(initial);
  const [family, setFamily] = React.useState<Family>("all");
  const [type, setType] = React.useState("");
  const [period, setPeriod] = React.useState("");
  const [scope, setScope] = React.useState("");
  const [q, setQ] = React.useState("");
  const [adminStatus, setAdminStatus] = React.useState<"all" | StatusKey>("all");

  /* builds in progress: poll the list until they land */
  const polling = reports.some((r) => r.status === "generating" && (isSuperAdmin || r.requestedBy === userId));
  React.useEffect(() => {
    if (!polling) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/v1/report-builder", { cache: "no-store" });
        const j = await res.json();
        if (alive && Array.isArray(j?.data?.reports)) setReports(j.data.reports);
      } catch {
        /* the next tick retries */
      }
    };
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [polling]);

  const published = React.useMemo(() => reports.filter((r) => r.status === "published"), [reports]);
  const typeOptions = React.useMemo(() => types.filter((tp) => published.some((r) => r.typeCode === tp.code)), [types, published]);
  const periodOptions = React.useMemo(() => {
    const seen = new Map<string, ReportListItem>();
    for (const r of published) if (!seen.has(r.period.label.en)) seen.set(r.period.label.en, r);
    return [...seen.values()].sort((a, b) => periodSortKey(b) - periodSortKey(a));
  }, [published]);
  const scopeOptions = React.useMemo(() => [...new Set(published.map(scopeKey))], [published]);

  const needle = q.trim().toLowerCase();
  const filtered = published.filter((r) => {
    if (family !== "all" && r.family !== family) return false;
    if (type && r.typeCode !== type) return false;
    if (period && r.period.label.en !== period) return false;
    if (scope && scopeKey(r) !== scope) return false;
    if (needle) {
      const hay = [r.titleEn, r.titleAr, r.typeNameEn, r.typeNameAr, r.scope.label.en, r.scope.label.ar, r.period.label.en, r.period.label.ar]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
  const hasFilters = family !== "all" || Boolean(type) || Boolean(period) || Boolean(scope) || Boolean(needle);
  const clearFilters = () => {
    setFamily("all");
    setType("");
    setPeriod("");
    setScope("");
    setQ("");
  };

  const byUpdated = (a: ReportListItem, b: ReportListItem) => updatedAt(b).localeCompare(updatedAt(a));
  const mine = reports.filter((r) => r.requestedBy === userId && r.status !== "published").sort(byUpdated);
  const everything = [...reports].sort(byUpdated);
  const adminRows = adminStatus === "all" ? everything : everything.filter((r) => r.status === adminStatus);
  const statusCounts = new Map<string, number>();
  for (const r of everything) statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1);

  return (
    <div data-testid="reports-hub">
      {/* hero */}
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">{t("hub.eyebrow")}</p>
          <h1 className="mt-1 font-display text-3xl text-ink-900">{t("hub.title")}</h1>
          <p className="mt-1.5 text-sm leading-6 text-ink-600">{t("hub.lede")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSuperAdmin ? (
            <ButtonLink href="/reports/new?type=custom" variant="secondary" data-testid="build-custom">
              <Wand2 /> {t("hub.custom")}
            </ButtonLink>
          ) : null}
          <ButtonLink href="/reports/new" data-testid="request-report">
            <FilePlus2 /> {t("hub.request")}
          </ButtonLink>
        </div>
      </header>

      {/* cover gallery */}
      <section className="mb-10" data-testid="cover-gallery" aria-labelledby="gallery-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="gallery-heading" className="font-display text-xl text-ink-900">
                {t("hub.gallery")}
              </h2>
              <Chip tone="sand" title={t("hub.illustrativeHint")}>
                {tc("illustrative")}
              </Chip>
            </div>
            <p className="mt-0.5 text-xs text-ink-400">{t("hub.illustrativeHint")}</p>
          </div>
          <p className="text-sm text-ink-600 tnum" data-testid="gallery-count">
            {t("hub.galleryCount", { count: filtered.length })}
          </p>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2" data-testid="gallery-filters">
          <div role="tablist" aria-label={t("hub.filters.family")} className="inline-flex items-center gap-1 rounded-xl bg-sand-100 p-1">
            {(["all", "public", "internal"] as Family[]).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={family === f}
                onClick={() => setFamily(f)}
                data-testid={`family-tab-${f}`}
                className={cn(
                  "cursor-pointer rounded-lg px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-gold-500",
                  family === f ? "bg-white text-maroon-900 shadow-sm" : "text-ink-600 hover:text-ink-900"
                )}
              >
                {f === "all" ? tc("all") : t(`families.${f}`)}
              </button>
            ))}
          </div>
          <NativeSelect value={type} onChange={(e) => setType(e.target.value)} className="w-auto min-w-40 max-w-[260px]" aria-label={t("hub.filters.type")} data-testid="filter-type">
            <option value="">{t("hub.filters.anyType")}</option>
            {typeOptions.map((tp) => (
              <option key={tp.code} value={tp.code}>
                {bi(locale, tp.nameEn, tp.nameAr)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect value={period} onChange={(e) => setPeriod(e.target.value)} className="w-auto min-w-32" aria-label={t("hub.filters.period")} data-testid="filter-period">
            <option value="">{t("hub.filters.anyPeriod")}</option>
            {periodOptions.map((r) => (
              <option key={r.period.label.en} value={r.period.label.en}>
                {bi(locale, r.period.label.en, r.period.label.ar)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect value={scope} onChange={(e) => setScope(e.target.value)} className="w-auto min-w-32" aria-label={t("hub.filters.scope")} data-testid="filter-scope">
            <option value="">{t("hub.filters.anyScope")}</option>
            {scopeOptions.map((k) => (
              <option key={k} value={k}>
                {t(`scopeKinds.${k as "npc" | "outcome" | "department" | "project"}`)}
              </option>
            ))}
          </NativeSelect>
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("hub.filters.search")}
              aria-label={t("hub.filters.search")}
              className="ps-9"
              data-testid="filter-search"
            />
          </div>
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="clear-filters">
              <X /> {tc("clearFilters")}
            </Button>
          ) : null}
        </div>

        {filtered.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-testid="cover-grid">
            {filtered.map((r, i) => (
              <CoverCard key={r.id} report={r} index={i} />
            ))}
          </div>
        ) : published.length ? (
          <EmptyState
            icon={<Search />}
            title={t("hub.emptyFiltered")}
            hint={t("hub.emptyFilteredHint")}
            action={
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                {tc("clearFilters")}
              </Button>
            }
          />
        ) : (
          <EmptyState icon={<Files />} title={t("hub.emptyGallery")} hint={t("hub.emptyGalleryHint")} />
        )}
      </section>

      {/* my requests */}
      <section className="mb-10" data-testid="my-requests" aria-labelledby="mine-heading">
        <div className="mb-3">
          <h2 id="mine-heading" className="font-display text-xl text-ink-900">
            {t("hub.mine")}
          </h2>
          <p className="mt-0.5 text-sm text-ink-600">{t("hub.mineHint")}</p>
        </div>
        {mine.length ? (
          <ReportRows items={mine} library={library} showRequester={false} testId="my-requests-table" />
        ) : (
          <EmptyState
            icon={<Inbox />}
            title={t("hub.emptyMine")}
            hint={t("hub.emptyMineHint")}
            action={
              <ButtonLink href="/reports/new" size="sm">
                <FilePlus2 /> {t("hub.request")}
              </ButtonLink>
            }
          />
        )}
      </section>

      {/* every report, Super Admin */}
      {isSuperAdmin ? (
        <section className="mb-6" data-testid="all-reports" aria-labelledby="all-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="all-heading" className="font-display text-xl text-ink-900">
                {t("hub.all")}
              </h2>
              <p className="mt-0.5 text-sm text-ink-600">{t("hub.allHint")}</p>
            </div>
            <ButtonLink href="/reports/new?type=custom" variant="gold" size="sm">
              <Wand2 /> {t("hub.custom")}
            </ButtonLink>
          </div>
          <div role="tablist" aria-label={t("hub.columns.status")} className="mb-3 flex flex-wrap gap-1.5" data-testid="status-filters">
            {(["all", ...REPORT_STATUSES] as ("all" | StatusKey)[]).map((s) => {
              const count = s === "all" ? everything.length : statusCounts.get(s) ?? 0;
              const active = adminStatus === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setAdminStatus(s)}
                  data-testid={`status-tab-${s}`}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-gold-500",
                    active ? "border-maroon-700 bg-maroon-700 text-white" : "border-sand-300 bg-white text-ink-600 hover:border-maroon-300 hover:text-maroon-700"
                  )}
                >
                  {s === "all" ? tc("all") : t(`statuses.${s}`)}
                  <span className={cn("tnum", active ? "text-white/80" : "text-ink-400")}>{count}</span>
                </button>
              );
            })}
          </div>
          {adminRows.length ? (
            <ReportRows items={adminRows} library={library} showRequester testId="all-reports-table" />
          ) : (
            <EmptyState icon={<Files />} title={t("hub.emptyAll")} />
          )}
        </section>
      ) : null}
    </div>
  );
}
