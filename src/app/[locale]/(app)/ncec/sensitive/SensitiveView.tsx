"use client";
// Sensitive Environmental Data (L3): approval banner, KPIs, charts and the
// violations table, all server-filtered to the active demo grant, with a
// watermark and export disabled (brief s8.3; ui-plan.md s2.2).
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Banknote, Factory, Gavel, ShieldAlert } from "lucide-react";
import { Chip } from "@/components/ui/primitives";
import { formatNumber } from "@/lib/format";
import { translateValue } from "@/server/ncec/vocab";
import { DummyDataBanner } from "@/components/ncec/DummyDataBanner";
import { ApprovalBanner } from "@/components/ncec/ApprovalBanner";
import { Watermark } from "@/components/ncec/Watermark";
import { NcecKpiTile } from "@/components/ncec/NcecKpiTile";
import { HorizontalBarList } from "@/components/ncec/HorizontalBarList";
import { KsaPointMap, type MapPoint } from "@/components/ncec/KsaPointMap";
import type { SensitiveDashboard } from "@/server/ncec/dashboards";
import type { CatalogueDataset } from "@/server/ncec/types";

const SEVERITY_TONE: Record<string, "danger" | "warn" | "mist"> = {
  جسيمة: "danger",
  متوسطة: "warn",
  بسيطة: "mist",
};

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

  const byType = dashboard.violationsByType.map((v) => ({ key: v.type, label: translateValue(locale, v.type), count: v.count }));
  const byRegionPoints: MapPoint[] = dashboard.violationsByRegion
    .filter((r) => r.point)
    .map((r) => ({
      key: r.region,
      label: `${translateValue(locale, r.region)} (${r.count})`,
      count: r.count,
      lat: r.point!.lat,
      lng: r.point!.lng,
      colorVar: "var(--color-danger)",
    }));

  return (
    <div className="relative" data-testid="ncec-sensitive-page">
      <Watermark userName={userName} stampedAt={stampedAt} />
      <header className="mb-4 flex items-center gap-2.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700">
          <ShieldAlert className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl">{t("sensitive.title")}</h1>
          <p className="text-sm text-ink-600">{t("sensitive.subtitle")}</p>
        </div>
      </header>

      <ApprovalBanner
        datasets={grantedDatasets}
        approverNameAr={dashboard.grantApproverNameAr}
        approverNameEn={dashboard.grantApproverNameEn}
        expiresAt={expiresAt}
        includePersonalData={includePersonalData}
      />
      <DummyDataBanner />

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="ncec-sensitive-kpis">
        <NcecKpiTile icon={<Gavel className="size-3.5" />} label={t("sensitive.kpis.violations2026")} value={dashboard.kpis.violations2026} tone="amber" />
        <NcecKpiTile
          icon={<Banknote className="size-3.5" />}
          label={t("sensitive.kpis.totalPenalties")}
          value={dashboard.kpis.penalties2026}
          suffix="SAR"
          tone="danger"
        />
        <div className="card flex flex-col gap-1.5 p-4" data-testid="ncec-kpi-coverage">
          <p className="text-xs font-medium text-ink-600">{t("sensitive.kpis.inspectionCoverage")}</p>
          <p className="font-[family-name:var(--font-display)] text-[26px] font-semibold leading-none text-navy-900 tnum">
            {formatNumber(dashboard.kpis.inspectionCoveragePct, locale, { decimals: 0 })}%
          </p>
          <p className="text-[11px] text-ink-400">
            {t("sensitive.inspectionsVisited", { visited: dashboard.kpis.inspectionsVisited, total: dashboard.kpis.inspectionsTotal })}
          </p>
        </div>
        <NcecKpiTile icon={<Factory className="size-3.5" />} label={t("sensitive.kpis.facilitiesWithViolation")} value={dashboard.kpis.facilitiesWithViolation} />
      </section>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card p-4" aria-labelledby="ncec-by-type-title">
          <h2 id="ncec-by-type-title" className="mb-3 text-lg">
            {t("sensitive.byTypeTitle")}
          </h2>
          <HorizontalBarList items={byType} barColor="var(--color-amber-500)" />
        </section>
        <section className="card p-4" aria-labelledby="ncec-by-region-title">
          <h2 id="ncec-by-region-title" className="mb-3 text-lg">
            {t("sensitive.byRegionTitle")}
          </h2>
          <KsaPointMap points={byRegionPoints} />
        </section>
      </div>

      <section className="card p-4" aria-labelledby="ncec-violations-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="ncec-violations-title" className="text-lg">
            {t("sensitive.tableTitle")}
          </h2>
          <button
            type="button"
            disabled={!allowExport}
            title={allowExport ? undefined : t("common.exportDisabled")}
            className="cursor-not-allowed rounded-lg border border-mist-300 bg-white px-3 py-1.5 text-xs font-medium text-ink-400"
          >
            {t("common.export")}
          </button>
        </div>
        <div className="overflow-x-auto">
          <div role="table" aria-label={t("sensitive.tableTitle")} className="min-w-[760px]" data-testid="ncec-violations-table">
            <div role="rowgroup">
              <div role="row" className="grid grid-cols-6 text-xs font-semibold text-ink-600">
                {(["violationNo", "facility", "region", "type", "severity", "penalty"] as const).map((c) => (
                  <div key={c} role="columnheader" className="px-3 py-2 text-start">
                    {t(`sensitive.columns.${c}`)}
                  </div>
                ))}
              </div>
            </div>
            <div role="rowgroup">
              {dashboard.violationsTable.map((r) => (
                <div role="row" key={r.recordId} className="grid grid-cols-6 border-t border-mist-100 text-sm">
                  <div role="cell" className="px-3 py-2.5 tnum">
                    {r.violationNo}
                  </div>
                  <div role="cell" className="px-3 py-2.5 font-medium text-ink-900">
                    {translateValue(locale, r.facility)}
                  </div>
                  <div role="cell" className="px-3 py-2.5">
                    {translateValue(locale, r.region)}
                  </div>
                  <div role="cell" className="px-3 py-2.5">
                    {translateValue(locale, r.type)}
                  </div>
                  <div role="cell" className="px-3 py-2.5">
                    <Chip tone={SEVERITY_TONE[r.severity] ?? "mist"}>{translateValue(locale, r.severity)}</Chip>
                  </div>
                  <div role="cell" className="px-3 py-2.5 tnum">
                    {formatNumber(r.penalty, locale, { decimals: 0 })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {!allowExport ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-400">
          <AlertTriangle className="size-3.5" aria-hidden /> {t("common.exportDisabled")}
        </p>
      ) : null}
    </div>
  );
}
