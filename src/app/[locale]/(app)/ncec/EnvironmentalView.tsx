"use client";
// NCEC Environmental Data (L2), composed from server-computed data only.
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Building2, Database, Factory, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { translateValue } from "@/server/ncec/vocab";
import { Chip } from "@/components/ui/primitives";
import { DummyDataBanner } from "@/components/ncec/DummyDataBanner";
import { NcecKpiTile } from "@/components/ncec/NcecKpiTile";
import { KsaPointMap, type MapLegendItem, type MapPoint } from "@/components/ncec/KsaPointMap";
import { DatasetCatalogue } from "@/components/ncec/DatasetCatalogue";
import type { EnvironmentalDashboard } from "@/server/ncec/dashboards";
import type { CatalogueDataset } from "@/server/ncec/types";

const SECTOR_COLORS = [
  "var(--color-teal-500)",
  "var(--color-aqua-500)",
  "var(--color-navy-500)",
  "var(--color-amber-500)",
  "var(--color-info)",
  "var(--color-ok)",
];

const STATUS_TONE: Record<EnvironmentalDashboard["facilitiesTable"][number]["displayStatus"], "ok" | "mist" | "danger"> = {
  active: "ok",
  renewal: "mist",
  expired: "danger",
};

export function EnvironmentalView({
  dashboard,
  catalogue,
}: {
  dashboard: EnvironmentalDashboard;
  catalogue: CatalogueDataset[];
}) {
  const t = useTranslations("ksaNcec");
  const locale = useLocale();

  const sectorEntries = dashboard.facilitiesBySector
    .map((s, i) => ({ ...s, color: SECTOR_COLORS[i % SECTOR_COLORS.length] }))
    .sort((a, b) => b.count - a.count);
  const points: MapPoint[] = sectorEntries.flatMap((s) =>
    s.points.map((p, i) => ({
      key: `${s.sector}-${i}`,
      label: i === 0 ? translateValue(locale, s.sector) : "",
      count: 1,
      lat: p.lat,
      lng: p.lng,
      colorVar: s.color,
    }))
  );
  const legend: MapLegendItem[] = sectorEntries.map((s) => ({
    key: s.sector,
    label: `${translateValue(locale, s.sector)} (${s.count})`,
    colorVar: s.color,
  }));

  return (
    <div data-testid="ncec-environmental-page">
      <header className="mb-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal-100 text-teal-700">
            <Database className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl">{t("environmental.title")}</h1>
            <p className="text-sm text-ink-600">{t("environmental.subtitle")}</p>
          </div>
        </div>
      </header>

      <DummyDataBanner />

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="ncec-environmental-kpis">
        <NcecKpiTile icon={<Factory className="size-3.5" />} label={t("environmental.kpis.permittedFacilities")} value={dashboard.kpis.permittedFacilities} />
        <NcecKpiTile icon={<Database className="size-3.5" />} label={t("environmental.kpis.activePermits")} value={dashboard.kpis.activePermits} tone="ok" />
        <NcecKpiTile
          icon={<AlertTriangle className="size-3.5" />}
          label={t("environmental.kpis.expiringIn90Days")}
          value={dashboard.kpis.expiringIn90Days}
          tone={dashboard.kpis.expiringIn90Days > 0 ? "amber" : "navy"}
        />
        <NcecKpiTile icon={<Layers className="size-3.5" />} label={t("environmental.kpis.contaminatedSites")} value={dashboard.kpis.contaminatedSites} />
      </section>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="card p-4 lg:col-span-3" aria-labelledby="ncec-map-title">
          <h2 id="ncec-map-title" className="mb-3 text-lg">
            {t("environmental.mapTitle")}
          </h2>
          <KsaPointMap points={points} legend={legend} />
        </section>
        <section className="card p-4 lg:col-span-2" aria-labelledby="ncec-catalogue-title">
          <h2 id="ncec-catalogue-title" className="mb-3 text-lg">
            {t("environmental.catalogueTitle")}
          </h2>
          <DatasetCatalogue datasets={catalogue} />
        </section>
      </div>

      <section className="card p-4" aria-labelledby="ncec-facilities-title">
        <h2 id="ncec-facilities-title" className="mb-3 text-lg">
          {t("environmental.tableTitle")}
        </h2>
        <div className="overflow-x-auto">
          <div role="table" aria-label={t("environmental.tableTitle")} className="min-w-[760px]" data-testid="ncec-facilities-table">
            <div role="rowgroup">
              <div role="row" className="grid grid-cols-7 text-xs font-semibold text-ink-600">
                {(["facility", "city", "region", "sector", "permitType", "expiry", "status"] as const).map((c) => (
                  <div key={c} role="columnheader" className="px-3 py-2 text-start">
                    {t(`environmental.columns.${c}`)}
                  </div>
                ))}
              </div>
            </div>
            <div role="rowgroup">
              {dashboard.facilitiesTable.map((r) => (
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
                  <div role="cell" className="px-3 py-2.5">
                    {translateValue(locale, r.sector)}
                  </div>
                  <div role="cell" className="px-3 py-2.5">
                    {translateValue(locale, r.permitType)}
                  </div>
                  <div role="cell" className="px-3 py-2.5 tnum">
                    <bdi dir="ltr">{formatDate(r.expiry, locale)}</bdi>
                  </div>
                  <div role="cell" className="px-3 py-2.5">
                    <Chip tone={STATUS_TONE[r.displayStatus]} title={r.statusMismatch ? t("environmental.statusMismatchNote") : undefined}>
                      {t(`environmental.status.${r.displayStatus}`)}
                    </Chip>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-ink-400">{t("environmental.lockedColumnNote")}</p>
      </section>

      <footer className="mt-4 flex items-center gap-1.5 text-xs text-ink-400">
        <Building2 className={cn("size-3.5")} aria-hidden />
        {t("environmental.footer")}
      </footer>
    </div>
  );
}
