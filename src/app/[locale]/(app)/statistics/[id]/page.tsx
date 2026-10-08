import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { indicatorDetail } from "@/server/services/statistics";
import { EmptyState, Chip } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion";
import { bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { BriefDialog } from "@/components/nexus/BriefDialog";
import { SignalCard } from "@/components/nexus/SignalCard";
import { toSignalCardData } from "@/components/nexus/signal-card-data";
import { listSignals, canTriage } from "@/server/services/signals";
import { resolveOwner } from "@/server/services/owner-lookup";
import { OwnerControl } from "@/components/nexus/people/OwnerControl";
import { IndicatorDetailClient } from "./IndicatorDetailClient";
import { AskContextItem } from "@/components/nexus/ask/AskContextItem";

export const dynamic = "force-dynamic";

export default async function IndicatorPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("statistics");
  const tc = await getTranslations("common");

  const detail = await indicatorDetail(user, id);
  if (!detail) return <EmptyState title={tc("notFound")} className="mt-12" />;
  const { ind, values, dimensions, kpiLinks, linkedReleases } = detail;

  const canEnter = can(user, "create", "statistics");
  // CR08 9.1: an indicator records no owner of its own, so the person shown is
  // the head of its own department, the fallback the Ask EnviroAI owner tool uses.
  // No department, or a head with no account, shows nothing at all.
  const owner = await resolveOwner("indicator", id);
  // CR01 2.8: accepted signals linked to this indicator, last 90 days
  const indicatorSignals = (
    await listSignals(user, { indicatorId: id, triage: "accepted", days: 90, limit: 6 })
  ).concat(
    await listSignals(user, { indicatorId: id, triage: "converted", days: 90, limit: 3 })
  );

  return (
    <Reveal>
      {/* CR08 2.3: the Ask EnviroAI launcher knows this indicator */}
      <AskContextItem item={{ kind: "indicator", id, code: ind.code, titleEn: ind.nameEn, titleAr: ind.nameAr, href: `/statistics/${id}` }} />
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-2xl">{bi(locale, ind.nameEn, ind.nameAr)}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            {bi(locale, ind.definitionEn ?? "", ind.definitionAr ?? "")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-400">
            <Chip tone="mist">{t(`frequency.${ind.frequency}` as never)}</Chip>
            {ind.unit ? <Chip tone="mist">{ind.unit}</Chip> : null}
            <span>{bi(locale, ind.sourceEn ?? "", ind.sourceAr ?? "")}</span>
          </div>
        </div>
        {/* ms-auto: the owner and Brief me stay at the end side of the header,
            on the second line when the title block fills the first */}
        <div className="ms-auto flex flex-wrap items-center gap-4">
          {owner ? (
            <OwnerControl
              owner={owner}
              role="department_owner"
              size="md"
              align="end"
              item={{ type: "indicator", id, titleEn: ind.nameEn, titleAr: ind.nameAr, href: `/statistics/${id}` }}
            />
          ) : null}
          <BriefDialog resourceType="indicator" resourceId={id} />
        </div>
      </div>

      <IndicatorDetailClient
        indicator={{
          id: ind.id,
          nameEn: ind.nameEn,
          nameAr: ind.nameAr,
          unit: ind.unit,
          decimals: ind.decimals,
          direction: ind.direction,
          methodologyEn: ind.methodologyEn,
          methodologyAr: ind.methodologyAr,
        }}
        values={values.map((v) => ({
          period: v.period,
          value: v.value,
          dimensionKey: v.dimensionKey,
          status: v.status,
          note: v.note,
        }))}
        dimensions={dimensions.map((d) => ({
          code: d.code,
          values: (() => {
            try {
              return JSON.parse(d.valuesJson ?? "[]") as string[];
            } catch {
              return [];
            }
          })(),
        }))}
        target={
          kpiLinks[0]?.targetValue !== null && kpiLinks[0]?.targetValue !== undefined
            ? kpiLinks[0].targetValue
            : null
        }
        canEnter={canEnter}
      />

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {kpiLinks.length ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
              {t("linkedKpis")}
            </p>
            <div className="card divide-y divide-mist-100">
              {kpiLinks.map((k) => (
                <Link
                  key={k.kpiId}
                  href={`/strategy/${k.nodeId}` as never}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-navy-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink-900">
                      {bi(locale, k.nameEn, k.nameAr)}
                    </span>
                    <span className="block truncate text-xs text-ink-600">
                      {bi(locale, k.nodeTitleEn, k.nodeTitleAr)}
                    </span>
                  </span>
                  {k.targetValue !== null ? (
                    <span className="shrink-0 text-xs text-aqua-500 tnum">
                      {t("target")}: {k.targetValue}
                      {k.targetYear ? ` (${k.targetYear})` : ""}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {linkedReleases.length ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
              {t("linkedReleases")}
            </p>
            <div className="card divide-y divide-mist-100">
              {linkedReleases.slice(0, 8).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0 truncate text-ink-900">
                    {bi(locale, r.titleEn, r.titleAr)}
                  </span>
                  <span className="shrink-0 text-xs text-ink-400 tnum">
                    {formatDate(r.releaseDate, locale)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Signals (CR01 2.8) */}
      {indicatorSignals.length ? (
        <div className="mt-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
            {t("linkedSignals")}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {indicatorSignals.slice(0, 6).map((s) => (
              <SignalCard
                key={s.id}
                signal={toSignalCardData(s)}
                canTriage={canTriage(user)}
                compact
              />
            ))}
          </div>
        </div>
      ) : null}
    </Reveal>
  );
}
