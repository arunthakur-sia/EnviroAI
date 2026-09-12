import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { desc } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import {
  listSignals,
  radarByOutcome,
  relatedSignalCounts,
  lastScanInfo,
  canTriage,
} from "@/server/services/signals";
import { Reveal } from "@/components/motion";
import { bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Chip, SectionTitle, EmptyState } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { Radar } from "lucide-react";
import { SignalCard } from "@/components/nexus/SignalCard";
import { toSignalCardData } from "@/components/nexus/signal-card-data";
import { RiskHeatmap } from "../foresight/RiskHeatmap";
import { ForesightForms } from "../foresight/ForesightForms";
import { TrendsToolbar } from "./TrendsToolbar";
import { RadarStrip } from "./RadarStrip";

export const dynamic = "force-dynamic";

export default async function TrendsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("trends");

  const [signals, radar, risks, rankings, lastRun] = await Promise.all([
    listSignals(user, {
      outcome: sp.outcome,
      type: sp.type,
      impact: sp.impact,
      horizon: sp.horizon,
      source: sp.source,
      triage: sp.triage,
      days: sp.days ? Number(sp.days) : undefined,
      riskId: sp.riskId,
      rankingId: sp.rankingId,
      limit: 60,
    }),
    radarByOutcome(),
    db.select().from(schema.risks).limit(20),
    db.select().from(schema.indexRankings).orderBy(schema.indexRankings.indexNameEn),
    lastScanInfo(),
  ]);
  const [riskCounts, rankingCounts] = await Promise.all([
    relatedSignalCounts("risk", risks.map((r) => r.id)),
    relatedSignalCounts("ranking", rankings.map((r) => r.id)),
  ]);

  const mayTriage = canTriage(user);
  const mayScan = can(user, "verify", "foresight") || can(user, "manage", "foresight");
  const canAdd = can(user, "create", "foresight");

  return (
    <Reveal>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-600">
            {t("intro")}
            {lastRun ? (
              <span className="ms-2 text-xs text-ink-400">
                {t("lastScan")}{" "}
                <span className="tnum">{formatDate(lastRun.startedAt, locale)}</span>
                {lastRun.status === "running" ? ` · ${t("scanRunning")}` : ""}
              </span>
            ) : null}
          </p>
        </div>
        {canAdd ? <ForesightForms /> : null}
      </div>

      <TrendsToolbar canScan={mayScan} canAdd={canAdd} />

      {/* Section 1: signal stream */}
      <div className="mt-6">
        {signals.length === 0 ? (
          <EmptyState
            icon={<Radar />}
            title={t("emptyTitle")}
            hint={t("emptyHint")}
          />
        ) : (
          <div className="columns-1 gap-4 md:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
            {signals.map((s) => (
              <SignalCard key={s.id} signal={toSignalCardData(s)} canTriage={mayTriage} />
            ))}
          </div>
        )}
      </div>

      {/* Section 2: radar by outcome */}
      <div className="mt-10">
        <SectionTitle>{t("radarTitle")}</SectionTitle>
        <RadarStrip radar={radar} />
      </div>

      {/* Section 3: risk heat map */}
      <div className="mt-10">
        <SectionTitle>{t("riskRadar")}</SectionTitle>
        <RiskHeatmap
          risks={risks.map((r) => ({
            id: r.id,
            titleEn: r.titleEn,
            titleAr: r.titleAr,
            likelihood: r.likelihood,
            impact: r.impact,
            mitigationEn: r.mitigationEn,
            mitigationAr: r.mitigationAr,
            status: r.status,
          }))}
          signalCounts={Object.fromEntries(riskCounts)}
        />
      </div>

      {/* Section 4: international index tracker */}
      <div className="mt-10">
        <SectionTitle>{t("indexTracker")}</SectionTitle>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="bg-sand-50">
                <th className="px-4 py-2.5 text-start text-xs font-semibold text-ink-600">{t("indexName")}</th>
                <th className="px-4 py-2.5 text-start text-xs font-semibold text-ink-600">{t("publisher")}</th>
                <th className="px-4 py-2.5 text-end text-xs font-semibold text-ink-600">{t("year")}</th>
                <th className="px-4 py-2.5 text-end text-xs font-semibold text-ink-600">{t("rank")}</th>
                <th className="px-4 py-2.5 text-end text-xs font-semibold text-ink-600">{t("outOf")}</th>
                <th className="px-4 py-2.5 text-start text-xs font-semibold text-ink-600">{t("entity")}</th>
                <th className="px-4 py-2.5 text-start text-xs font-semibold text-ink-600">{t("signalsCol")}</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((r) => {
                const count = rankingCounts.get(r.id) ?? 0;
                return (
                  <tr key={r.id} className="border-t border-sand-100">
                    <td className="px-4 py-2.5 font-medium text-ink-900">
                      {bi(locale, r.indexNameEn, r.indexNameAr)}
                    </td>
                    <td className="px-4 py-2.5 text-ink-600">{r.publisher}</td>
                    <td className="px-4 py-2.5 text-end tnum">{r.year}</td>
                    <td className="px-4 py-2.5 text-end font-semibold text-maroon-900 tnum">
                      {r.rank ?? "-"}
                    </td>
                    <td className="px-4 py-2.5 text-end text-ink-400 tnum">{r.totalCountries ?? "-"}</td>
                    <td className="px-4 py-2.5 text-xs text-ink-600">{r.responsibleEntity}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2">
                        {count > 0 ? (
                          <Link
                            href={`/trends?rankingId=${r.id}` as never}
                            className="inline-flex items-center gap-1 rounded-md bg-gulf-100 px-2 py-0.5 text-[11px] font-medium text-gulf-600 hover:bg-gulf-600 hover:text-white tnum"
                          >
                            <Radar className="size-3" /> {count}
                          </Link>
                        ) : (
                          <span className="text-[11px] text-ink-400 tnum">0</span>
                        )}
                        {r.note?.includes("verify") ? <Chip tone="warn">{t("toVerify")}</Chip> : null}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Reveal>
  );
}
