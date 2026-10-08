"use client";
// KPI charts: actual vs dashed aqua target, RAG colouring against the target path.
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { bi } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { IndicatorChart } from "@/components/nexus/IndicatorChart";
import { Chip, SectionTitle } from "@/components/ui/primitives";
import { OwnerControl } from "@/components/nexus/people/OwnerControl";
import type { OwnerRef } from "@/components/nexus/people/OwnerControl";

export function KpiSection({
  kpis,
  values,
  owners,
  nodeHref,
}: {
  kpis: {
    id: string;
    nameEn: string;
    nameAr: string;
    unit: string | null;
    direction: string;
    baselineValue: number | null;
    baselineYear: number | null;
    targetValue: number | null;
    targetYear: number | null;
    indicatorId: string | null;
    /** CR08 9.1: the KPI custodian, when one is recorded */
    ownerUserId?: string | null;
  }[];
  values: { kpiId: string; period: string; actual: number | null; target: number | null; note: string | null }[];
  /** CR08 9.1: user id -> person, resolved on the server */
  owners?: Record<string, OwnerRef>;
  /** where the person card links the KPI back to */
  nodeHref?: string;
}) {
  const t = useTranslations("strategy");
  const tc = useTranslations("common");
  const locale = useLocale();

  return (
    <div>
      <SectionTitle>{t("kpis")}</SectionTitle>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {kpis.map((kpi) => {
          const series = values
            .filter((v) => v.kpiId === kpi.id && v.actual !== null)
            .map((v) => ({ period: v.period, value: v.actual }));
          const latest = series.at(-1);
          const illustrative = values.some(
            (v) => v.kpiId === kpi.id && v.note?.includes("illustrative")
          );
          const onTrack =
            latest?.value !== null && latest?.value !== undefined && kpi.targetValue !== null
              ? kpi.direction === "down_good"
                ? latest.value <= kpi.targetValue * 1.15
                : latest.value >= kpi.targetValue * 0.7
              : null;
          const custodian = kpi.ownerUserId ? owners?.[kpi.ownerUserId] ?? null : null;
          return (
            <div key={kpi.id} className="card p-4">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-ink-900">
                  {bi(locale, kpi.nameEn, kpi.nameAr)}
                </p>
                {onTrack !== null ? (
                  <Chip tone={onTrack ? "ok" : "warn"}>
                    {onTrack ? tc("status.on_track") : tc("status.at_risk")}
                  </Chip>
                ) : null}
                {illustrative ? <Chip tone="warn">{tc("illustrative")}</Chip> : null}
                {/* CR08 9.1: the KPI custodian, at the end side of the head */}
                {custodian ? (
                  <OwnerControl
                    owner={custodian}
                    role="custodian"
                    size="sm"
                    align="end"
                    className="ms-auto"
                    item={{
                      type: "indicator",
                      id: kpi.id,
                      titleEn: kpi.nameEn,
                      titleAr: kpi.nameAr,
                      href: nodeHref ?? "/strategy",
                    }}
                  />
                ) : null}
              </div>
              <p className="mb-2 text-xs text-ink-400 tnum">
                {kpi.baselineValue !== null
                  ? `${t("baseline")}: ${formatNumber(kpi.baselineValue, locale, { decimals: 1 })}${kpi.baselineYear ? ` (${kpi.baselineYear})` : ""} · `
                  : ""}
                {kpi.targetValue !== null
                  ? `${t("target")}: ${formatNumber(kpi.targetValue, locale, { decimals: 1 })}${kpi.unit ? ` ${kpi.unit}` : ""}${kpi.targetYear ? ` (${kpi.targetYear})` : ""}`
                  : ""}
              </p>
              {series.length >= 2 ? (
                <IndicatorChart
                  data={series}
                  unit={kpi.unit}
                  target={kpi.targetValue}
                  decimals={1}
                  height={180}
                />
              ) : latest ? (
                <p className="py-4 text-center font-[family-name:var(--font-display)] text-3xl font-semibold text-navy-900 tnum">
                  {formatNumber(latest.value!, locale, { decimals: 1 })}
                  {kpi.unit ? <span className="ms-1 text-base text-ink-600">{kpi.unit}</span> : null}
                </p>
              ) : (
                <p className="py-6 text-center text-sm text-ink-400">{t("noKpiValues")}</p>
              )}
              {kpi.indicatorId ? (
                <Link
                  href={`/statistics/${kpi.indicatorId}` as never}
                  className="mt-2 inline-block text-xs font-medium text-teal-600 hover:underline"
                >
                  {t("openIndicator")}
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
