import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Archive, ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { getNodeDetail } from "@/server/services/strategy";
import { whatChanged } from "@/server/ai";
import { toShelfDocs } from "@/server/services/documents";
import { Reveal } from "@/components/motion";
import { bi } from "@/lib/utils";
import { formatDate, formatNumber } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import {
  EmptyState,
  Chip,
  RagDot,
  Avatar,
  SectionTitle,
} from "@/components/ui/primitives";
import { Shelf } from "@/components/nexus/Shelf";
import { BriefDialog } from "@/components/nexus/BriefDialog";
import { SignalCard } from "@/components/nexus/SignalCard";
import { toSignalCardData } from "@/components/nexus/signal-card-data";
import { listSignals, canTriage } from "@/server/services/signals";
import { KpiSection } from "./KpiSection";
import { StatusTimeline } from "./StatusTimeline";
import { NodeActions } from "./NodeActions";

export const dynamic = "force-dynamic";

export default async function NodePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("strategy");
  const tc = await getTranslations("common");

  const detail = await getNodeDetail(user, id);
  if (!detail) return <EmptyState title={tc("notFound")} className="mt-12" />;
  const {
    node,
    edition,
    parent,
    children,
    kpis,
    kpiValues,
    updates,
    linkedDocs,
    linkedExperts,
    lessons,
    deps,
    depNodes,
    lineage,
    lineageNodes,
    editions,
  } = detail;

  const isArchived = edition?.status === "archived";
  const canUpdate = !isArchived && can(user, "create", "strategy");
  const changed = await whatChanged([id], 30);
  const shelfDocs = await toShelfDocs(linkedDocs.slice(0, 12));
  const editionById = new Map(editions.map((e) => [e.id, e]));
  // CR01 2.8: accepted signals linked to this node, last 90 days
  const nodeSignals = (
    await listSignals(user, { nodeId: id, triage: "accepted", days: 90, limit: 6 })
  ).concat(
    await listSignals(user, { nodeId: id, triage: "converted", days: 90, limit: 3 })
  );

  return (
    <Reveal>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
          <Link href={(edition?.isDefault ? "/strategy" : `/strategy?edition=${edition?.code}`) as never} className="hover:text-maroon-700">
            {edition ? bi(locale, edition.nameEn, edition.nameAr) : ""}
          </Link>
          {parent ? (
            <>
              <span>/</span>
              <Link href={`/strategy/${parent.id}` as never} className="hover:text-maroon-700">
                {bi(locale, parent.titleEn, parent.titleAr)}
              </Link>
            </>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h1 className="flex items-center gap-2.5 text-2xl">
              <RagDot status={node.status} className="h-3 w-3" />
              {node.code ? <span className="text-base text-ink-400 tnum">{node.code}</span> : null}
              {bi(locale, node.titleEn, node.titleAr)}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Chip tone="maroon">{t(`nodeType.${node.nodeType}` as never)}</Chip>
              <Chip tone="sand">{tc(`status.${node.status}` as never)}</Chip>
              {isArchived ? (
                <Chip tone="sand">
                  <Archive className="size-3" /> {t("archiveChip")}
                </Chip>
              ) : null}
              {node.verified === 0 ? <Chip tone="warn">{tc("toVerify")}</Chip> : null}
              {node.ownerEntityName ? <Chip tone="gulf">{node.ownerEntityName}</Chip> : null}
              {node.budgetQar ? (
                <span className="text-xs text-ink-600 tnum">
                  {t("budget")}: {formatNumber(node.budgetQar, locale, { compact: true })} QAR
                </span>
              ) : null}
              {node.startDate || node.endDate ? (
                <span className="text-xs text-ink-400 tnum">
                  {formatDate(node.startDate, locale, { style: "short" })} –{" "}
                  {formatDate(node.endDate, locale, { style: "short" })}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            {canUpdate ? <NodeActions nodeId={id} kpis={kpis.map((k) => ({ id: k.id, nameEn: k.nameEn, nameAr: k.nameAr, unit: k.unit }))} /> : null}
            <BriefDialog resourceType="node" resourceId={id} />
          </div>
        </div>
        {(node.descriptionEn || node.descriptionAr) ? (
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-600">
            {bi(locale, node.descriptionEn ?? "", node.descriptionAr ?? "")}
          </p>
        ) : null}
        {node.sourceRef ? (
          <p className="mt-1.5 text-[11px] text-ink-400">
            {t("sourceRef")}: {node.sourceRef}
          </p>
        ) : null}
      </div>

      {/* Lineage strip */}
      {lineage.length ? (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-gulf-100 bg-gulf-100/40 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gulf-600">
            {t("lineage")}
          </p>
          {lineage.map((l) => {
            const otherId = l.fromNodeId === id ? l.toNodeId : l.fromNodeId;
            const other = lineageNodes.find((n) => n.id === otherId);
            if (!other) return null;
            const otherEdition = editionById.get(other.editionId);
            const forward = l.fromNodeId === id;
            return (
              <Link
                key={l.id}
                href={`/strategy/${otherId}` as never}
                className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs text-ink-900 shadow-sm hover:text-gulf-600"
              >
                <Chip tone="gulf">{otherEdition?.code.toUpperCase()}</Chip>
                {!forward ? <ArrowRight className="size-3 flip-rtl text-ink-400" /> : null}
                <span className="max-w-52 truncate">{bi(locale, other.titleEn, other.titleAr)}</span>
                {forward ? <ArrowRight className="size-3 flip-rtl text-ink-400" /> : null}
                <span className="text-ink-400">{t(`lineageKind.${l.relation}` as never)}</span>
              </Link>
            );
          })}
        </div>
      ) : null}

      {/* What changed */}
      {(changed.highlights.length || updates.length) ? (
        <div className="mb-8 rounded-xl border border-gold-300 bg-gold-100/40 px-5 py-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-maroon-900">
            {t("whatChanged")}
          </p>
          <p className="text-sm leading-relaxed text-ink-900">
            {locale === "ar" ? changed.summary_ar : changed.summary_en}
          </p>
        </div>
      ) : null}

      {/* KPIs */}
      {kpis.length ? (
        <KpiSection
          kpis={kpis.map((k) => ({
            id: k.id,
            nameEn: k.nameEn,
            nameAr: k.nameAr,
            unit: k.unit,
            direction: k.direction,
            baselineValue: k.baselineValue,
            baselineYear: k.baselineYear,
            targetValue: k.targetValue,
            targetYear: k.targetYear,
            indicatorId: k.indicatorId,
          }))}
          values={kpiValues.map((v) => ({
            kpiId: v.kpiId,
            period: v.period,
            actual: v.actualValue,
            target: v.targetForPeriod,
            note: v.note,
          }))}
        />
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {/* Status updates timeline */}
          <SectionTitle>{t("statusUpdates")}</SectionTitle>
          <StatusTimeline
            updates={updates.map((u) => ({
              id: u.id,
              status: u.status,
              progressPct: u.progressPct,
              summaryEn: u.summaryEn,
              summaryAr: u.summaryAr,
              risksJson: u.risksJson,
              nextStepsJson: u.nextStepsJson,
              period: u.period,
              createdAt: u.createdAt,
              authorNameEn: u.authorNameEn,
              authorNameAr: u.authorNameAr,
              authorColor: u.authorColor,
            }))}
          />

          {/* Children */}
          {children.length ? (
            <div className="mt-8">
              <SectionTitle>{t("children")}</SectionTitle>
              <div className="card divide-y divide-sand-100">
                {children.map((c) => (
                  <Link
                    key={c.id}
                    href={`/strategy/${c.id}` as never}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-maroon-50"
                  >
                    <RagDot status={c.status} />
                    {c.code ? <span className="text-[10px] text-ink-400 tnum">{c.code}</span> : null}
                    <span className="min-w-0 flex-1 truncate text-ink-900">
                      {bi(locale, c.titleEn, c.titleAr)}
                    </span>
                    <Chip tone="ghost">{t(`nodeType.${c.nodeType}` as never)}</Chip>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {/* Linked documents shelf */}
          {shelfDocs.length ? (
            <div className="mt-8">
              <SectionTitle>{t("linkedDocuments")}</SectionTitle>
              <Shelf docs={shelfDocs} />
            </div>
          ) : null}
        </div>

        <aside className="space-y-6">
          {/* Experts */}
          {linkedExperts.length ? (
            <div>
              <SectionTitle>{t("linkedExperts")}</SectionTitle>
              <div className="card divide-y divide-sand-100">
                {linkedExperts.slice(0, 5).map((e) => (
                  <Link
                    key={e.id}
                    href={`/experts/${e.id}` as never}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-maroon-50"
                  >
                    <Avatar name={e.nameEn} color={e.avatarColor} size={30} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink-900">
                        {bi(locale, e.nameEn, e.nameAr)}
                      </span>
                      <span className="block truncate text-xs text-ink-600">
                        {bi(locale, e.positionEn ?? "", e.positionAr ?? "")}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {/* Lessons */}
          {lessons.length ? (
            <div>
              <SectionTitle>{t("linkedLessons")}</SectionTitle>
              <div className="flex flex-col gap-2">
                {lessons.map((l) => (
                  <Link key={l.id} href={`/lessons/${l.id}` as never} className="card card-hover p-3.5">
                    <p className="line-clamp-2 text-sm font-medium text-ink-900">
                      {bi(locale, l.titleEn, l.titleAr)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-ink-600">
                      {bi(locale, l.learningEn ?? "", l.learningAr ?? "")}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {/* Signals (CR01 2.8) */}
          {nodeSignals.length ? (
            <div>
              <SectionTitle>{t("linkedSignals")}</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {nodeSignals.slice(0, 6).map((s) => (
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

          {/* Dependencies */}
          {deps.length ? (
            <div>
              <SectionTitle>{t("dependencies")}</SectionTitle>
              <div className="card divide-y divide-sand-100">
                {deps.map((d) => {
                  const otherId = d.nodeId === id ? d.dependsOnNodeId : d.nodeId;
                  const other = depNodes.find((n) => n.id === otherId);
                  if (!other) return null;
                  const dependsOn = d.nodeId === id;
                  return (
                    <Link
                      key={d.id}
                      href={`/strategy/${otherId}` as never}
                      className="block px-4 py-2.5 text-sm hover:bg-maroon-50"
                    >
                      <span className="block text-[11px] text-ink-400">
                        {dependsOn ? t("dependsOn") : t("neededBy")}
                      </span>
                      <span className="flex items-center gap-2 text-ink-900">
                        <RagDot status={other.status} />
                        <span className="truncate">{bi(locale, other.titleEn, other.titleAr)}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </Reveal>
  );
}
