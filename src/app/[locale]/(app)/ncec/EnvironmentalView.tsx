"use client";
// NCEC Environmental Data (L2), composed from server-computed data only.
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Building2, CheckCircle2, Database, Factory, FileText, Layers, RefreshCw, Table2, XCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import { translateValue } from "@/server/ncec/vocab";
import { Chip } from "@/components/ui/primitives";
import { DummyDataBanner } from "@/components/ncec/DummyDataBanner";
import { NcecKpiTile } from "@/components/ncec/NcecKpiTile";
import { KsaPointMap, type MapLegendItem, type MapPoint } from "@/components/ncec/KsaPointMap";
import { DatasetCatalogue } from "@/components/ncec/DatasetCatalogue";
import type { EnvironmentalDashboard, FacilityRow } from "@/server/ncec/dashboards";
import type { CatalogueDataset } from "@/server/ncec/types";

/** fixed per sector (register values), so a sector keeps its colour on the map and in the table */
const SECTOR_COLORS: Record<string, string> = {
  "الطاقة والبتروكيماويات": "var(--color-navy-700)",
  "الصناعة والتعدين": "var(--color-aqua-500)",
  "النقل والخدمات اللوجستية": "var(--color-teal-600)",
  "الموارد الطبيعية": "var(--color-ok)",
  "التطوير الحضري": "var(--color-teal-400)",
};
const sectorColor = (s: string) => SECTOR_COLORS[s] ?? "var(--color-amber-500)";

const STATUS: Record<FacilityRow["displayStatus"], { tone: "ok" | "warn" | "danger"; Icon: typeof CheckCircle2 }> = {
  active: { tone: "ok", Icon: CheckCircle2 },
  renewal: { tone: "warn", Icon: RefreshCw },
  expired: { tone: "danger", Icon: XCircle },
};

const TABLE_ROWS = 10;

export function EnvironmentalView({
  dashboard,
  catalogue,
  catalogueTotal,
}: {
  dashboard: EnvironmentalDashboard;
  catalogue: CatalogueDataset[];
  catalogueTotal: number;
}) {
  const t = useTranslations("ksaNcec");
  const locale = useLocale();

  const sectors = [...dashboard.facilitiesBySector].sort((a, b) => b.count - a.count);
  const points: MapPoint[] = sectors.flatMap((s) =>
    s.points.map((p, i) => ({
      key: `${s.sector}-${i}`,
      label: translateValue(locale, s.sector),
      count: 1,
      lat: p.lat,
      lng: p.lng,
      colorVar: sectorColor(s.sector),
    }))
  );
  const legend: MapLegendItem[] = sectors.map((s) => ({
    key: s.sector,
    label: `${translateValue(locale, s.sector)} (${s.count})`,
    colorVar: sectorColor(s.sector),
  }));
  const rows = dashboard.facilitiesTable.slice(0, TABLE_ROWS);

  return (
    <div data-testid="ncec-environmental-page">
      <header className="mb-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-teal-100 text-teal-700">
            <Database className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl">{t("environmental.title")}</h1>
            <p className="text-sm text-ink-600">{t("environmental.subtitle")}</p>
          </div>
        </div>
      </header>

      <DummyDataBanner />

      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="ncec-environmental-kpis">
        <NcecKpiTile icon={<Factory />} label={t("environmental.kpis.permittedFacilities")} value={dashboard.kpis.permittedFacilities} tone="teal" />
        <NcecKpiTile icon={<FileText />} label={t("environmental.kpis.activePermits")} value={dashboard.kpis.activePermits} tone="ok" />
        <NcecKpiTile icon={<AlertTriangle />} label={t("environmental.kpis.expiringIn90Days")} value={dashboard.kpis.expiringIn90Days} tone="amber" />
        <NcecKpiTile icon={<Layers />} label={t("environmental.kpis.contaminatedSites")} value={dashboard.kpis.contaminatedSites} tone="teal" />
      </section>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="card p-4 lg:col-span-3" aria-labelledby="ncec-map-title">
          <h2 id="ncec-map-title" className="mb-3 text-lg">
            {t("environmental.mapTitle")}
          </h2>
          <KsaPointMap points={points} legend={legend} legendTitle={t("environmental.mapLegendTitle")} />
        </section>
        <section className="card flex flex-col p-4 lg:col-span-2" aria-labelledby="ncec-catalogue-title">
          <h2 id="ncec-catalogue-title" className="mb-3 text-lg">
            {t("environmental.catalogueTitle")}
          </h2>
          <DatasetCatalogue datasets={catalogue} variant="list" />
          <Link
            href={"/ncec/datasets" as never}
            className="mt-3 text-sm font-medium text-teal-700 hover:underline"
            data-testid="ncec-view-all-datasets"
          >
            {t("environmental.viewAllDatasets", { count: catalogueTotal })}
          </Link>
        </section>
      </div>

      <section className="card p-4" aria-labelledby="ncec-facilities-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="ncec-facilities-title" className="flex items-center gap-2 text-lg">
            <Table2 className="size-5 text-teal-700" aria-hidden />
            {t("environmental.tableTitle")}
          </h2>
          <Link href={"/ncec/datasets/DS-001" as never} className="text-sm font-medium text-teal-700 hover:underline">
            {t("environmental.viewAllRecords", { count: dashboard.facilitiesTable.length })}
          </Link>
        </div>
        <div className="overflow-x-auto">
          <div role="table" aria-label={t("environmental.tableTitle")} className="min-w-[820px]" data-testid="ncec-facilities-table">
            <div role="rowgroup">
              <div role="row" className="grid grid-cols-7 rounded-md bg-mist-50 text-xs font-semibold text-ink-600">
                {(["facility", "city", "region", "sector", "permitType", "expiry", "status"] as const).map((c) => (
                  <div key={c} role="columnheader" className="px-3 py-2 text-start">
                    {t(`environmental.columns.${c}`)}
                  </div>
                ))}
              </div>
            </div>
            <div role="rowgroup">
              {rows.map((r) => {
                const s = STATUS[r.displayStatus];
                return (
                  <div role="row" key={r.recordId} className="grid grid-cols-7 border-t border-mist-100 text-sm">
                    <div role="cell" className="px-3 py-2.5 font-medium text-ink-900">
                      {translateValue(locale, r.facility)}
                    </div>
                    <div role="cell" className="px-3 py-2.5">
                      {r.city}
                    </div>
                    <div role="cell" className="px-3 py-2.5">
                      {translateValue(locale, r.region)}
                    </div>
                    <div role="cell" className="flex items-center gap-1.5 px-3 py-2.5">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: sectorColor(r.sector) }} aria-hidden />
                      {translateValue(locale, r.sector)}
                    </div>
                    <div role="cell" className="px-3 py-2.5">
                      {translateValue(locale, r.permitType)}
                    </div>
                    <div role="cell" className="px-3 py-2.5 tnum">
                      <bdi dir="ltr">{formatDate(r.expiry, locale)}</bdi>
                    </div>
                    <div role="cell" className="px-3 py-2">
                      <Chip tone={s.tone} className="gap-1" title={r.statusMismatch ? t("environmental.statusMismatchNote") : undefined}>
                        <s.Icon className="size-3.5" aria-hidden />
                        {t(`environmental.status.${r.displayStatus}`)}
                      </Chip>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-ink-400">{t("environmental.lockedColumnNote")}</p>
      </section>

      <footer className="mt-4 flex items-center gap-1.5 text-xs text-ink-400">
        <Building2 className="size-3.5" aria-hidden />
        {t("environmental.footer")}
      </footer>
    </div>
  );
}
