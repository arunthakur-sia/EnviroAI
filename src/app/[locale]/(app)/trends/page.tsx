// CR03 3: Trends and Signals reordered: the Signals Radar first, then the
// Signal Briefing (feature row + lanes), then the risk heat map and the
// international index tracker (unchanged, moved below). The CR02 refresh
// controls stay at the top.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import {
  listSignals,
  relatedSignalCounts,
  lastScanInfo,
  canTriage,
  type SignalListItem,
} from "@/server/services/signals";
import { outcomeNodeMap } from "@/server/scan/extract";
import { Reveal } from "@/components/motion";
import { formatDate } from "@/lib/format";
import { SectionTitle } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { Globe2 } from "lucide-react";
import { ReportButton } from "@/components/nexus/ReportButton";
import { RiskHeatmap } from "../foresight/RiskHeatmap";
import { ForesightForms } from "../foresight/ForesightForms";
import { TrendsToolbar } from "./TrendsToolbar";
import { TrendsBoard } from "./TrendsBoard";
import type { BoardSignal } from "./board-types";

export const dynamic = "force-dynamic";

async function toBoardSignals(rows: SignalListItem[]): Promise<BoardSignal[]> {
  const outcomeByNode = new Map<string, string>(); // nodeId -> taxonomy code
  for (const [tax, nodeId] of await outcomeNodeMap()) outcomeByNode.set(nodeId, tax);
  return rows.map((s) => ({
    id: s.id,
    titleEn: s.titleEn,
    titleAr: s.titleAr,
    descriptionEn: s.descriptionEn,
    descriptionAr: s.descriptionAr,
    whyEn: s.whyItMattersEn,
    whyAr: s.whyItMattersAr,
    publisher: s.publisher,
    publishedAt: s.publishedAt,
    createdAt: s.createdAt,
    sourceKind: s.sourceKind,
    url: s.url,
    signalType: s.signalType,
    impact: s.impact,
    horizon: s.horizon,
    sentiment: s.sentiment,
    confidence: s.confidence,
    triageStatus: s.triageStatus,
    outcomes: s.links
      .filter((l) => l.resourceType === "node" && outcomeByNode.has(l.resourceId))
      .map((l) => ({
        nodeId: l.resourceId,
        code: l.code ?? "",
        taxCode: outcomeByNode.get(l.resourceId) ?? null,
        nameEn: l.titleEn,
        nameAr: l.titleAr,
      })),
  }));
}

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

  const [signals, risks, lastRun] = await Promise.all([
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
      limit: 120,
    }),
    db.select().from(schema.risks).limit(20),
    lastScanInfo(),
  ]);
  const riskCounts = await relatedSignalCounts("risk", risks.map((r) => r.id));

  const board = await toBoardSignals(signals);
  // the radar shows accepted signals of the last 180 days (CR03 3.2)
  const cutoff = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  const radarSignals = board.filter(
    (s) =>
      (s.triageStatus === "accepted" || s.triageStatus === "converted") &&
      (s.publishedAt ?? s.createdAt.slice(0, 10)) >= cutoff
  );

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
              <span className="ms-2 text-xs text-ink-600">
                {t("lastScan")}{" "}
                <span className="tnum">{formatDate(lastRun.startedAt, locale)}</span>
                {lastRun.status === "running" ? ` · ${t("scanRunning")}` : ""}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* CR02 7.1: report over the current signal filters */}
          <ReportButton
            scope={{
              kind: "signals",
              ids: [],
              labelEn: "Trends and Signals",
              labelAr: "الاتجاهات والإشارات",
              filters: Object.fromEntries(
                Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]
              ),
            }}
          />
          {canAdd ? <ForesightForms /> : null}
        </div>
      </div>

      {/* CR03 3.3.6: refresh, progress card, and Last refreshed stay on top */}
      <TrendsToolbar canScan={mayScan} canAdd={canAdd} />

      {/* Sections 1 and 2: radar + briefing */}
      <TrendsBoard signals={board} radarSignals={radarSignals} canTriage={mayTriage} />

      {/* Section 3: risk heat map (unchanged, moved below) */}
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

      {/* CR05 4.1: the index tracker moved to its own module */}
      <div className="mt-10">
        <Link
          href="/indices"
          className="link-draw inline-flex items-center gap-1.5 text-sm font-medium text-navy-700"
          data-testid="see-indices-link"
        >
          <Globe2 className="size-4" /> {t("seeIndices")}
        </Link>
      </div>
    </Reveal>
  );
}
