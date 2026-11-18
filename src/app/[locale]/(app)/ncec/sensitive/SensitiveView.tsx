"use client";
// Sensitive Environmental Data (L3): approval banner, KPIs, charts and the
// violations table, all server-filtered to the caller's active grant, with a
// watermark and export disabled (brief s8.3; ui-plan.md s2.2). Reporter
// contact arrives already masked unless the grant includes personal data.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpDown, CheckCircle2, ClipboardList, Clock, Coins, Database, Download, Gavel, Info, Lock, Table2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Chip } from "@/components/ui/primitives";
import { formatNumber } from "@/lib/format";
import { translateValue } from "@/server/ncec/vocab";
import { DummyDataBanner } from "@/components/ncec/DummyDataBanner";
import { ApprovalBanner } from "@/components/ncec/ApprovalBanner";
import { Watermark } from "@/components/ncec/Watermark";
import { NcecKpiTile } from "@/components/ncec/NcecKpiTile";
import { HorizontalBarList } from "@/components/ncec/HorizontalBarList";
import { KsaPointMap, type MapLegendItem, type MapPoint } from "@/components/ncec/KsaPointMap";
import type { SensitiveDashboard, ViolationRow } from "@/server/ncec/dashboards";
import type { CatalogueDataset } from "@/server/ncec/types";

const SEVERITY: Record<string, { tone: "danger" | "warn" | "ok"; dot: string }> = {
  جسيمة: { tone: "danger", dot: "var(--color-danger)" },
  متوسطة: { tone: "warn", dot: "var(--color-amber-500)" },
  بسيطة: { tone: "ok", dot: "var(--color-ok)" },
};
const STATUS: Record<string, { tone: "ok" | "warn" | "mist"; Icon: typeof CheckCircle2 }> = {
  سارية: { tone: "ok", Icon: CheckCircle2 },
  "قيد المراجعة": { tone: "warn", Icon: Clock },
  مغلقة: { tone: "mist", Icon: XCircle },
};

/** colour classes for the region bubbles, low to high, as in the mockup legend */
const BUCKET_COLORS = ["var(--color-amber-300)", "var(--color-amber-500)", "var(--color-amber-700)", "var(--color-danger)"];

/** four count classes scaled to the data (the mockup's fixed <10 / 10-49 /
    50-99 / >=100 would put every region of the dummy data in one class) */
function bucketsFor(max: number): number[] {
  const t1 = Math.max(2, Math.ceil(max * 0.25));
  const t2 = Math.max(t1 + 1, Math.ceil(max * 0.5));
  const t3 = Math.max(t2 + 1, Math.ceil(max * 0.75));
  return [t1, t2, t3];
}

type SortKey = "violationNo" | "facility" | "region" | "type" | "severity" | "penalty" | "status";
const SEVERITY_RANK: Record<string, number> = { جسيمة: 3, متوسطة: 2, بسيطة: 1 };

export function SensitiveView({
  dashboard,
  grantedDatasets,
  includePersonalData,
  allowExport,
  expiresAt,
  userName,
  stampedAt,
}: {
  dashboard: SensitiveDashboard;
  grantedDatasets: CatalogueDataset[];
  includePersonalData: boolean;
  allowExport: boolean;
  expiresAt: string | null;
  userName: string;
  stampedAt: string;
}) {
  const t = useTranslations("ksaNcec");
  const locale = useLocale();
  const fmt = (n: number, decimals = 0) => formatNumber(n, locale, { decimals });

  const byType = dashboard.violationsByType.map((v) => ({ key: v.type, label: translateValue(locale, v.type), count: v.count }));

  const regions = dashboard.violationsByRegion.filter((r) => r.point);
  const [b1, b2, b3] = bucketsFor(Math.max(1, ...regions.map((r) => r.count)));
  const bucketOf = (n: number) => (n < b1 ? 0 : n < b2 ? 1 : n < b3 ? 2 : 3);
  const regionPoints: MapPoint[] = regions.map((r) => ({
    key: r.region,
    label: `${translateValue(locale, r.region)}: ${r.count}`,
    count: r.count,
    lat: r.point!.lat,
    lng: r.point!.lng,
    colorVar: BUCKET_COLORS[bucketOf(r.count)],
  }));
  const regionLegend: MapLegendItem[] = [
    { key: "b0", label: `< ${b1}`, colorVar: BUCKET_COLORS[0] },
    { key: "b1", label: `${b1} - ${b2 - 1}`, colorVar: BUCKET_COLORS[1] },
    { key: "b2", label: `${b2} - ${b3 - 1}`, colorVar: BUCKET_COLORS[2] },
    { key: "b3", label: `≥ ${b3}`, colorVar: BUCKET_COLORS[3] },
  ];

  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "violationNo", dir: 1 });
  const rows = React.useMemo(() => {
    const val = (r: ViolationRow): string | number =>
      sort.key === "penalty" ? r.penalty : sort.key === "severity" ? SEVERITY_RANK[r.severity] ?? 0 : String(r[sort.key] ?? "");
    return [...dashboard.violationsTable].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [dashboard.violationsTable, sort]);
  const toggleSort = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }));

  const coverage = dashboard.kpis.inspectionCoveragePct;
  const penaltiesCompact = `${t("sensitive.currency")} ${formatNumber(dashboard.kpis.penalties2026, locale, { compact: true, decimals: 1 })}`;

  const COLS: Array<{ key: SortKey | "contact"; align?: "end" }> = [
    { key: "violationNo" },
    { key: "facility" },
    { key: "region" },
    { key: "type" },
    { key: "severity" },
    { key: "penalty", align: "end" },
    { key: "status" },
    { key: "contact" },
  ];

  return (
    <div className="relative" data-testid="ncec-sensitive-page">
      <Watermark userName={userName} stampedAt={stampedAt} />
      <ApprovalBanner
        datasets={grantedDatasets}
        approverNameAr={dashboard.grantApproverNameAr}
        approverNameEn={dashboard.grantApproverNameEn}
        expiresAt={expiresAt}
        includePersonalData={includePersonalData}
      />
      <header className="mb-4 flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-aqua-100 text-navy-700">
          <Database className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl">{t("sensitive.title")}</h1>
          <p className="text-sm text-ink-600">{t("sensitive.subtitle")}</p>
        </div>
      </header>
      <DummyDataBanner />

      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="ncec-sensitive-kpis">
        <NcecKpiTile icon={<Gavel />} label={t("sensitive.kpis.violations2026")} value={dashboard.kpis.violations2026} tone="amberIcon" />
        <NcecKpiTile
          icon={<Coins />}
          label={t("sensitive.kpis.totalPenalties")}
          value={dashboard.kpis.penalties2026}
          display={penaltiesCompact}
          note={t("sensitive.penaltiesExact", { amount: fmt(dashboard.kpis.penalties2026) })}
          tone="ok"
        />
        <NcecKpiTile
          icon={<CoverageRing pct={coverage} />}
          label={t("sensitive.kpis.inspectionCoverage")}
          value={coverage}
          display={`${fmt(coverage)}%`}
          note={t("sensitive.inspectionsVisited", { visited: dashboard.kpis.inspectionsVisited, total: dashboard.kpis.inspectionsTotal })}
          tone="plain"
        />
        <NcecKpiTile icon={<ClipboardList />} label={t("sensitive.kpis.openCorrectivePlans")} value={dashboard.kpis.openCorrectivePlans} tone="teal" />
      </section>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card p-4" aria-labelledby="ncec-by-type-title">
          <h2 id="ncec-by-type-title" className="mb-3 text-lg">
            {t("sensitive.byTypeTitle")}
          </h2>
          <HorizontalBarList items={byType} axisLabel={t("sensitive.axisViolations")} />
        </section>
        <section className="card p-4" aria-labelledby="ncec-by-region-title">
          <h2 id="ncec-by-region-title" className="mb-3 text-lg">
            {t("sensitive.byRegionTitle")}
          </h2>
          <KsaPointMap points={regionPoints} mode="bubbles" legend={regionLegend} legendTitle={t("sensitive.legendTitle")} />
        </section>
      </div>

      <section className="card p-4" aria-labelledby="ncec-violations-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="ncec-violations-title" className="flex items-center gap-2 text-lg">
            <Table2 className="size-5 text-teal-700" aria-hidden />
            {t("sensitive.tableTitle")}
          </h2>
          <div className="flex items-center gap-2">
            {!allowExport ? (
              <span className="flex items-center gap-1.5 rounded-lg border border-mist-300 px-2.5 py-1.5 text-xs text-ink-600">
                <Info className="size-3.5" aria-hidden /> {t("common.exportDisabled")}
              </span>
            ) : null}
            <Button variant="secondary" size="sm" disabled={!allowExport} title={allowExport ? undefined : t("common.exportDisabled")}>
              <Download className="size-4" aria-hidden /> {t("common.export")}
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div role="table" aria-label={t("sensitive.tableTitle")} className="min-w-[1080px]" data-testid="ncec-violations-table">
            <div role="rowgroup">
              <div role="row" className="grid grid-cols-[1.3fr_1.1fr_1fr_1.8fr_0.9fr_0.9fr_1fr_1.2fr] rounded-md bg-mist-50 text-xs font-semibold text-ink-600">
                {COLS.map((c) => (
                  <div key={c.key} role="columnheader" className={cn("px-3 py-2", c.align === "end" ? "text-end" : "text-start")}>
                    {c.key === "contact" ? (
                      t("sensitive.columns.contact")
                    ) : (
                      <button type="button" onClick={() => toggleSort(c.key as SortKey)} className="inline-flex items-center gap-1 hover:text-ink-900">
                        {t(`sensitive.columns.${c.key}`)}
                        <ArrowUpDown className="size-3" aria-hidden />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div role="rowgroup">
              {rows.map((r) => {
                const sev = SEVERITY[r.severity];
                const st = STATUS[r.status];
                return (
                  <div role="row" key={r.recordId} className="grid grid-cols-[1.3fr_1.1fr_1fr_1.8fr_0.9fr_0.9fr_1fr_1.2fr] border-t border-mist-100 text-sm">
                    <div role="cell" className="px-3 py-2.5 tnum">
                      {r.violationNo}
                    </div>
                    <div role="cell" className="px-3 py-2.5 text-ink-900">
                      {translateValue(locale, r.facility)}
                    </div>
                    <div role="cell" className="px-3 py-2.5">
                      {translateValue(locale, r.region)}
                    </div>
                    <div role="cell" className="px-3 py-2.5">
                      {translateValue(locale, r.type)}
                    </div>
                    <div role="cell" className="px-3 py-2">
                      <Chip tone={sev?.tone ?? "mist"} className="gap-1.5">
                        <span className="size-2 rounded-full" style={{ background: sev?.dot ?? "var(--color-ink-400)" }} aria-hidden />
                        {translateValue(locale, r.severity)}
                      </Chip>
                    </div>
                    <div role="cell" className="px-3 py-2.5 text-end tnum">
                      {fmt(r.penalty)}
                    </div>
                    <div role="cell" className="px-3 py-2">
                      {r.status ? (
                        <Chip tone={st?.tone ?? "mist"} className="gap-1">
                          {st ? <st.Icon className="size-3.5" aria-hidden /> : null}
                          {translateValue(locale, r.status)}
                        </Chip>
                      ) : null}
                    </div>
                    <div role="cell" className="flex items-center justify-between gap-2 px-3 py-2">
                      {r.reporterContact === null ? (
                        <Lock className="size-4 text-ink-400" aria-label={t("common.locked")} />
                      ) : (
                        <>
                          <span className="tracking-widest">{r.reporterContact}</span>
                          {!includePersonalData ? (
                            <Button variant="secondary" size="sm" disabled title={t("common.notAvailableStep1")} className="gap-1">
                              <Lock className="size-3" aria-hidden /> {t("common.reveal")}
                            </Button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function CoverageRing({ pct }: { pct: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const len = (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg viewBox="0 0 48 48" className="size-12" aria-hidden>
      <circle cx={24} cy={24} r={r} fill="none" stroke="var(--color-mist-200)" strokeWidth={7} />
      <circle
        cx={24}
        cy={24}
        r={r}
        fill="none"
        stroke="var(--color-amber-500)"
        strokeWidth={7}
        strokeDasharray={`${len} ${c - len}`}
        transform="rotate(-90 24 24)"
        strokeLinecap="round"
      />
    </svg>
  );
}
