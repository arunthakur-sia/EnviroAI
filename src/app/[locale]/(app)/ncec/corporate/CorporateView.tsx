"use client";
// NCEC Corporate Data (brief s8.4), laid out as in the mockup: department
// tiles from the register, KPIs, headcount charts and a department summary,
// all from server-computed figures. Picking a tile filters the KPIs, the
// donut and the table to that department; "All departments" (the default)
// shows the organization-wide totals. The by-department bar chart always
// compares every department, with the selected one highlighted. Headcount-
// derived figures arrive as null when the caller's layer is below the
// field's (R5) and render as locked, whichever department is selected.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Archive,
  Building2,
  Clock,
  Download,
  FileText,
  Globe2,
  GraduationCap,
  Layers,
  Lock,
  Monitor,
  Network,
  Search,
  ShieldCheck,
  Truck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { bi, cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { translateValue } from "@/server/ncec/vocab";
import { Button, Chip } from "@/components/ui/primitives";
import { DummyDataBanner } from "@/components/ncec/DummyDataBanner";
import { NcecKpiTile } from "@/components/ncec/NcecKpiTile";
import { DatasetCatalogue } from "@/components/ncec/DatasetCatalogue";
import type { CorporateGroup } from "@/server/ncec/catalogue";
import type { CorporateDashboard, CorporateDepartmentRow, YearPair } from "@/server/ncec/corporate";

const GROUP_ICONS: Record<string, LucideIcon> = {
  "NCEC-U19": Users,
  "NCEC-U29": GraduationCap,
  "NCEC-U28": FileText,
  "NCEC-U24": Monitor,
  "NCEC-U23": Truck,
  "NCEC-U32": Building2,
  "NCEC-U30": Layers,
  "NCEC-U27": Search,
  "NCEC-U21": Network,
  "NCEC-U31": Archive,
  "NCEC-U22": ShieldCheck,
};

const TYPE_COLORS = ["var(--color-teal-700)", "var(--color-aqua-500)", "var(--color-ok)", "var(--color-aqua-300)"];
const ALL = "__all__";

type Metric = "headcount" | "programmes" | "hours";

function trendOf(p: YearPair): number | null {
  return p.previous > 0 ? ((p.current - p.previous) / p.previous) * 100 : null;
}

export function CorporateView({ groups, dashboard }: { groups: CorporateGroup[]; dashboard: CorporateDashboard }) {
  const t = useTranslations("ksaNcec");
  const locale = useLocale();
  const fmt = (n: number, decimals = 0) => formatNumber(n, locale, { decimals });
  const vs = t("corporate.vsPrevious", { year: 2025 });
  const restricted = t("common.restrictedToL3");

  const [selected, setSelected] = React.useState<string>(ALL);
  const selectedGroup = groups.find((g) => g.key === selected);
  const selectedDept = dashboard.departments.find((d) => d.deptId === selected) ?? null;
  const [metric, setMetric] = React.useState<Metric>(dashboard.headcountVisible ? "headcount" : "programmes");

  // the KPIs, donut and table either show the organization-wide totals, or
  // the one selected department's own figures (the same shape either way)
  const view = selectedDept ?? {
    headcount: dashboard.kpis.headcount?.current ?? null,
    headcountTrendPct: dashboard.kpis.headcount ? trendOf(dashboard.kpis.headcount) : null,
    programmes: dashboard.kpis.programmes,
    trainingHours: { current: 0, previous: 0 }, // not shown at org level (hoursPer is the org KPI instead)
    hoursPer: dashboard.kpis.hoursPer,
    trainees: dashboard.kpis.trainees,
    employmentType: dashboard.byEmploymentType,
  };
  const headcountTotal = selectedDept ? selectedDept.headcount : dashboard.kpis.headcount?.current ?? null;

  const bars = dashboard.departments.map((d) => ({
    key: d.deptId,
    label: bi(locale, d.nameEn, d.nameAr),
    value: metric === "headcount" ? d.headcount ?? 0 : metric === "programmes" ? d.programmes.current : d.trainingHours.current,
  }));
  const maxBar = Math.max(1, ...bars.map((b) => b.value));

  return (
    <div data-testid="ncec-corporate-page">
      <DummyDataBanner />
      <header className="mb-4">
        <h1 className="text-2xl">{t("corporate.title")}</h1>
        <p className="text-sm text-ink-600">{t("corporate.subtitle")}</p>
      </header>

      {/* department tiles: "All departments" for the org-wide totals, then every
          corporate dataset in the register, grouped by owning department. Picking
          one filters the KPIs, donut and summary row to that department alone. */}
      <section className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-12" aria-label={t("corporate.departmentsLabel")} data-testid="ncec-corporate-tiles">
        <button
          type="button"
          onClick={() => setSelected(ALL)}
          aria-pressed={selected === ALL}
          className={cn(
            "flex flex-col items-center gap-1 rounded-xl border bg-white px-2 py-3 text-center transition-colors",
            selected === ALL ? "border-navy-700 bg-navy-50 ring-1 ring-navy-700" : "border-mist-200 hover:border-navy-500"
          )}
          data-testid="ncec-corp-tile-all"
        >
          <Globe2 className="size-6 text-navy-700" aria-hidden />
          <span className="text-sm font-semibold leading-tight text-ink-900">{t("corporate.allDepartments")}</span>
          <span className="text-xs text-ink-600">{t("corporate.datasetCount", { count: groups.reduce((n, g) => n + g.datasetCount, 0) })}</span>
        </button>
        {groups.map((g) => {
          const Icon = GROUP_ICONS[g.key] ?? Building2;
          const allLocked = g.datasets.every((d) => d.locked);
          const catalogueOnly = !g.datasets.some((d) => d.hasDummyData);
          const active = g.key === selected;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setSelected(g.key)}
              aria-pressed={active}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border bg-white px-2 py-3 text-center transition-colors",
                active ? "border-teal-500 bg-teal-100/40 ring-1 ring-teal-500" : "border-mist-200 hover:border-teal-400",
                allLocked && "bg-mist-50"
              )}
              data-testid={`ncec-corp-tile-${g.key}`}
            >
              {allLocked ? <Lock className="size-6 text-ink-400" aria-hidden /> : <Icon className="size-6 text-teal-700" aria-hidden />}
              <span className="line-clamp-2 text-sm font-semibold leading-tight text-ink-900">{bi(locale, g.deptNameEn, g.deptNameAr)}</span>
              <span className="text-xs text-ink-600">{t("corporate.datasetCount", { count: g.datasetCount })}</span>
              {catalogueOnly ? (
                <Chip tone="mist" className="mt-0.5 text-[10px]">
                  {t("common.catalogueOnly")}
                </Chip>
              ) : null}
            </button>
          );
        })}
      </section>

      <div className="mb-3 flex items-center gap-2 text-sm text-ink-600" data-testid="ncec-corp-scope">
        {selected === ALL ? (
          t("corporate.scopeAll")
        ) : (
          <>
            {t("corporate.scopeDept", { dept: bi(locale, selectedGroup?.deptNameEn, selectedGroup?.deptNameAr) })}
            <button type="button" onClick={() => setSelected(ALL)} className="font-medium text-teal-700 hover:underline">
              {t("corporate.clearScope")}
            </button>
          </>
        )}
      </div>

      <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="ncec-corporate-kpis">
        <NcecKpiTile
          icon={<Users />}
          label={t("corporate.kpis.headcount")}
          value={view.headcount ?? 0}
          trendPct={view.headcount !== null ? view.headcountTrendPct : null}
          trendLabel={vs}
          lockedLabel={view.headcount === null ? restricted : undefined}
        />
        <NcecKpiTile
          icon={<GraduationCap />}
          label={t("corporate.kpis.programmes", { year: 2026 })}
          value={view.programmes.current}
          trendPct={trendOf(view.programmes)}
          trendLabel={vs}
        />
        <NcecKpiTile
          icon={<Clock />}
          label={view.hoursPer.basis === "employee" ? t("corporate.kpis.hoursPerEmployee") : t("corporate.kpis.hoursPerParticipant")}
          value={view.hoursPer.current}
          trendPct={trendOf(view.hoursPer)}
          trendLabel={vs}
        />
        <NcecKpiTile icon={<UserPlus />} label={t("corporate.kpis.trainees")} value={view.trainees.current} trendPct={trendOf(view.trainees)} trendLabel={vs} />
      </section>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="card p-4 lg:col-span-3" aria-labelledby="ncec-corp-bars">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="ncec-corp-bars" className="text-lg">
              {t(`corporate.byDepartment.${metric}`)}
            </h2>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as Metric)}
              className="rounded-md border border-mist-300 bg-white px-2.5 py-1.5 text-sm"
              aria-label={t("corporate.metricLabel")}
            >
              {dashboard.headcountVisible ? <option value="headcount">{t("corporate.metric.headcount")}</option> : null}
              <option value="programmes">{t("corporate.metric.programmes")}</option>
              <option value="hours">{t("corporate.metric.hours")}</option>
            </select>
          </div>
          <div className="flex h-64 items-end gap-2 border-b border-mist-200 pb-0" data-testid="ncec-corp-bar-chart">
            {bars.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => setSelected(b.key)}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
              >
                <span className="mb-1 text-xs font-semibold text-ink-900 tnum">{fmt(b.value)}</span>
                <div
                  className="w-full max-w-14 rounded-t-sm"
                  style={{
                    height: `${Math.max(2, (b.value / maxBar) * 85)}%`,
                    background: b.key === selected ? "var(--color-amber-500)" : "var(--color-ok)",
                    opacity: selected === ALL || b.key === selected ? 0.9 : 0.4,
                  }}
                  title={`${b.label}: ${fmt(b.value)}`}
                />
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex gap-2">
            {bars.map((b) => (
              <span
                key={b.key}
                className={cn("line-clamp-2 min-w-0 flex-1 text-center text-[10px] leading-tight", b.key === selected ? "font-semibold text-ink-900" : "text-ink-600")}
              >
                {b.label}
              </span>
            ))}
          </div>
          {!dashboard.headcountVisible ? <p className="mt-2 text-[11px] text-ink-400">{t("corporate.headcountLockedNote")}</p> : null}
        </section>

        <section className="card p-4 lg:col-span-2" aria-labelledby="ncec-corp-donut">
          <h2 id="ncec-corp-donut" className="mb-3 text-lg">
            {t("corporate.byEmploymentType")}
          </h2>
          {view.employmentType && headcountTotal !== null ? (
            <EmploymentDonut items={view.employmentType} total={headcountTotal} fmt={fmt} totalLabel={t("corporate.total")} locale={locale} />
          ) : (
            <LockedPanel title={restricted} body={t("corporate.headcountLockedNote")} cta={t("common.requestAccess")} hint={t("common.notAvailableStep1")} />
          )}
        </section>
      </div>

      <section className="card mb-4 p-4" aria-labelledby="ncec-corp-summary">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="ncec-corp-summary" className="text-lg">
            {t("corporate.summaryTitle")}
          </h2>
          <Button variant="secondary" size="sm" disabled title={t("common.notAvailableStep1")}>
            <Download className="size-4" aria-hidden /> {t("common.export")}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <div role="table" aria-label={t("corporate.summaryTitle")} className="min-w-[860px]" data-testid="ncec-corp-summary-table">
            <div role="rowgroup">
              <div role="row" className="grid grid-cols-[2.2fr_repeat(6,1fr)] rounded-md bg-mist-50 text-xs font-semibold text-ink-600">
                {(["department", "headcount", "share", "programmes", "hours", "vacancies", "trend"] as const).map((c) => (
                  <div key={c} role="columnheader" className={cn("px-3 py-2", c === "department" ? "text-start" : "text-center")}>
                    {t(`corporate.columns.${c}`, { year: 2026, prev: 2025 })}
                  </div>
                ))}
              </div>
            </div>
            <div role="rowgroup">
              {dashboard.departments
                .filter((d) => selected === ALL || d.deptId === selected)
                .map((d: CorporateDepartmentRow) => (
                  <div role="row" key={d.deptId} className="grid grid-cols-[2.2fr_repeat(6,1fr)] border-t border-mist-100 text-sm">
                    <div role="cell" className="px-3 py-2.5 font-medium text-ink-900">
                      {bi(locale, d.nameEn, d.nameAr)}
                    </div>
                    <LockedOr value={d.headcount} render={(v) => fmt(v)} />
                    <LockedOr value={d.sharePct} render={(v) => `${fmt(v, 1)}%`} />
                    <div role="cell" className="px-3 py-2.5 text-center tnum">
                      {fmt(d.programmes.current)}
                    </div>
                    <div role="cell" className="px-3 py-2.5 text-center tnum">
                      {fmt(d.trainingHours.current)}
                    </div>
                    <LockedOr value={d.vacancies} render={(v) => fmt(v)} />
                    <LockedOr
                      value={d.headcountTrendPct}
                      render={(v) => (
                        <Chip tone={v >= 0 ? "ok" : "danger"}>
                          <bdi dir="ltr">
                            {v >= 0 ? "▲ +" : "▼ "}
                            {fmt(v, 1)}%
                          </bdi>
                        </Chip>
                      )}
                    />
                  </div>
                ))}
            </div>
          </div>
        </div>
      </section>

      {selectedGroup ? (
        <section className="card p-4" aria-labelledby="ncec-corp-datasets" data-testid="ncec-corp-datasets">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="ncec-corp-datasets" className="text-lg">
              {t("corporate.datasetsOf", { dept: bi(locale, selectedGroup.deptNameEn, selectedGroup.deptNameAr) })}
            </h2>
            <Chip tone="mist">{t("corporate.datasetCount", { count: selectedGroup.datasetCount })}</Chip>
          </div>
          <DatasetCatalogue datasets={selectedGroup.datasets} variant="list" />
        </section>
      ) : null}
    </div>
  );
}

function LockedOr<T>({ value, render }: { value: T | null; render: (v: T) => React.ReactNode }) {
  return (
    <div role="cell" className="flex items-center justify-center px-3 py-2.5 tnum">
      {value === null ? <Lock className="size-4 text-ink-400" aria-label="L3" /> : render(value)}
    </div>
  );
}

function LockedPanel({ title, body, cta, hint }: { title: string; body: string; cta: string; hint: string }) {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-mist-300 bg-mist-50 p-4 text-center" data-locked="1">
      <Lock className="size-6 text-ink-400" aria-hidden />
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      <p className="max-w-xs text-xs text-ink-600">{body}</p>
      <Button variant="secondary" size="sm" disabled title={hint}>
        {cta}
      </Button>
    </div>
  );
}

function EmploymentDonut({
  items,
  total,
  fmt,
  totalLabel,
  locale,
}: {
  items: Array<{ type: string; count: number }>;
  total: number;
  fmt: (n: number, d?: number) => string;
  totalLabel: string;
  locale: string;
}) {
  const R = 60;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-5" data-testid="ncec-corp-donut-chart">
      <svg viewBox="0 0 160 160" className="size-40 shrink-0" role="img" aria-label={`${fmt(total)} ${totalLabel}`}>
        <g transform="rotate(-90 80 80)">
          {items.map((it, i) => {
            const len = total ? (it.count / total) * C : 0;
            const el = (
              <circle
                key={it.type}
                cx={80}
                cy={80}
                r={R}
                fill="none"
                stroke={TYPE_COLORS[i % TYPE_COLORS.length]}
                strokeWidth={24}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </g>
        <text x={80} y={80} textAnchor="middle" fontSize={26} fontWeight={700} fill="var(--color-navy-900)">
          {fmt(total)}
        </text>
        <text x={80} y={100} textAnchor="middle" fontSize={12} fill="var(--color-ink-600)">
          {totalLabel}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {items.map((it, i) => (
          <li key={it.type} className="flex items-center gap-2">
            <span className="size-3 shrink-0 rounded-sm" style={{ background: TYPE_COLORS[i % TYPE_COLORS.length] }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{translateValue(locale, it.type)}</span>
            <span className="w-12 text-end text-ink-600 tnum">{fmt(total ? (it.count / total) * 100 : 0)}%</span>
            <span className="w-10 text-end font-semibold tnum">{fmt(it.count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
