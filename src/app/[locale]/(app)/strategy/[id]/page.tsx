// Node detail page, reorganised per CR02 2.2: header, status and KPIs,
// deliverables (initiatives and projects; children for outcomes and targets),
// lessons tab, documents, experts, signals, updates, lineage, Brief me.
// The route doubles as /strategy/{edition}: an edition code renders the
// column navigator instead.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Archive, ArrowRight, Headphones, Plus } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { getNodeDetail, getEditionByCode, slugOfCode } from "@/server/services/strategy";
import { listDeliverables } from "@/server/services/deliverables";
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
  Button,
} from "@/components/ui/primitives";
import { Shelf } from "@/components/nexus/Shelf";
import { BriefDialog } from "@/components/nexus/BriefDialog";
import { SignalCard } from "@/components/nexus/SignalCard";
import { toSignalCardData } from "@/components/nexus/signal-card-data";
import { LessonCard } from "@/components/nexus/LessonCard";
import { listSignals, canTriage } from "@/server/services/signals";
import { ReportButton } from "@/components/nexus/ReportButton";
import { renderNavigator } from "../navigator-server";
import { KpiSection } from "./KpiSection";
import { StatusTimeline } from "./StatusTimeline";
import { NodeActions } from "./NodeActions";
import { NodeTabs } from "./NodeTabs";
import { DeliverablesSection } from "./DeliverablesSection";

export const dynamic = "force-dynamic";

export default async function NodePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;

  // /strategy/nds3 and friends: the navigator, not a node
  const asEdition = await getEditionByCode(id);
  if (asEdition) {
    return renderNavigator({ locale, editionCode: id, view: sp.view });
  }

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("strategy");
  const tc = await getTranslations("common");
  const tp = await getTranslations("podcast");

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
    lessonsAggregated,
    deps,
    depNodes,
    lineage,
    lineageNodes,
    editions,
  } = detail;

  const isArchived = edition?.status === "archived";
  const canUpdate = !isArchived && can(user, "create", "strategy");
  const isDeliveryNode = node.nodeType === "initiative" || node.nodeType === "project";
  const changed = await whatChanged([id], 30);
  const deliverables = isDeliveryNode ? await listDeliverables(user, id) : [];
  const deliverableDocIds = new Set(deliverables.map((d) => d.documentId));
  const shelfDocs = await toShelfDocs(
    linkedDocs.filter((d) => !deliverableDocIds.has(d.id)).slice(0, 12)
  );
  const editionById = new Map(editions.map((e) => [e.id, e]));
  const nodeSignals = (
    await listSignals(user, { nodeId: id, triage: "accepted", days: 90, limit: 6 })
  ).concat(
    await listSignals(user, { nodeId: id, triage: "converted", days: 90, limit: 3 })
  );
  const classificationLabels: [string, string, string, string] = [
    tc("classification.1" as never),
    tc("classification.2" as never),
    tc("classification.3" as never),
    tc("classification.4" as never),
  ];

  // breadcrumb path back into the navigator
  const outcomeAncestor =
    node.nodeType === "outcome"
      ? node
      : parent?.nodeType === "outcome"
        ? parent
        : null;

  const tabs: { key: string; label: string; badge?: number; content: React.ReactNode }[] = [];
  if (isDeliveryNode) {
    tabs.push({
      key: "deliverables",
      label: t("deliverablesTab"),
      badge: deliverables.length,
      content: (
        <DeliverablesSection
          nodeId={id}
          initial={deliverables}
          canUpload={!isArchived && can(user, "create", "vault")}
          classificationLabels={classificationLabels}
        />
      ),
    });
  } else if (children.length) {
    tabs.push({
      key: "contains",
      label: t("children"),
      badge: children.length,
      content: (
        <div className="card divide-y divide-sand-100">
          {children.map((c) => (
            <Link
              key={c.id}
              href={`/strategy/${c.id}` as never}
              className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-maroon-50"
            >
              <RagDot status={c.status} />
              {c.code ? <span className="text-[10px] text-ink-600 tnum">{c.code}</span> : null}
              <span className="min-w-0 flex-1 truncate text-ink-900">
                {bi(locale, c.titleEn, c.titleAr)}
              </span>
              <Chip tone="ghost">{t(`nodeType.${c.nodeType}` as never)}</Chip>
            </Link>
          ))}
        </div>
      ),
    });
  }
  tabs.push({
    key: "lessons",
    label: t("lessonsTab"),
    badge: lessons.length,
    content: (
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          {lessonsAggregated ? (
            <p className="text-xs text-ink-600">{t("aggregatedLessons")}</p>
          ) : (
            <span />
          )}
          {isDeliveryNode && can(user, "create", "lessons") ? (
            <Link href={`/add?node=${id}&category=delivery` as never}>
              <Button size="sm" variant="secondary">
                <Plus /> {t("addLesson")}
              </Button>
            </Link>
          ) : null}
        </div>
        {lessons.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lessons.map((l) => (
              <LessonCard
                key={l.id}
                lesson={{
                  id: l.id,
                  titleEn: l.titleEn,
                  titleAr: l.titleAr,
                  learningEn: l.learningEn,
                  learningAr: l.learningAr,
                  recommendationEn: l.recommendationEn,
                  recommendationAr: l.recommendationAr,
                  status: l.status,
                  reuseCount: l.reuseCount,
                  category: l.category,
                }}
                showCategory
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-sand-300 bg-sand-50 px-4 py-6 text-center text-sm text-ink-600">
            {t("noLessonsHere")}
          </p>
        )}
      </div>
    ),
  });
  tabs.push({
    key: "documents",
    label: t("documentsTab"),
    badge: shelfDocs.length,
    content: shelfDocs.length ? (
      <Shelf docs={shelfDocs} />
    ) : (
      <p className="rounded-xl border border-dashed border-sand-300 bg-sand-50 px-4 py-6 text-center text-sm text-ink-600">
        {tc("nothingHere")}
      </p>
    ),
  });

  return (
    <Reveal>
      {/* 1. Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-600">
          <Link
            href={(edition?.isDefault ? "/strategy" : `/strategy/${edition?.code}`) as never}
            className="hover:text-maroon-700"
          >
            {edition ? bi(locale, edition.nameEn, edition.nameAr) : ""}
          </Link>
          {outcomeAncestor && edition ? (
            <>
              <span>/</span>
              <Link
                href={`/strategy/${edition.code}/${slugOfCode(outcomeAncestor.code, outcomeAncestor.id)}` as never}
                className="hover:text-maroon-700"
              >
                {outcomeAncestor.code ?? bi(locale, outcomeAncestor.titleEn, outcomeAncestor.titleAr)}
              </Link>
            </>
          ) : null}
          {parent && parent.id !== outcomeAncestor?.id ? (
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
              {node.code ? <span className="text-base text-ink-600 tnum">{node.code}</span> : null}
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
                <span className="text-xs text-ink-600 tnum">
                  {formatDate(node.startDate, locale, { style: "short" })} {"-"}{" "}
                  {formatDate(node.endDate, locale, { style: "short" })}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* CR02 4.3: "Listen" opens the podcast composer pre-filled */}
            <Link href={`/podcast/new?node=${id}` as never}>
              <Button variant="secondary">
                <Headphones /> {tp("listen")}
              </Button>
            </Link>
            {/* CR02 7.1: report over the node and its children */}
            <ReportButton
              scope={{
                kind: "node",
                ids: [id],
                labelEn: `${node.code ? node.code + " " : ""}${node.titleEn}`,
                labelAr: `${node.code ? node.code + " " : ""}${node.titleAr}`,
              }}
            />
            {canUpdate ? (
              <NodeActions
                nodeId={id}
                kpis={kpis.map((k) => ({ id: k.id, nameEn: k.nameEn, nameAr: k.nameAr, unit: k.unit }))}
              />
            ) : null}
          </div>
        </div>
        {(node.descriptionEn || node.descriptionAr) ? (
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-600">
            {bi(locale, node.descriptionEn ?? "", node.descriptionAr ?? "")}
          </p>
        ) : null}
        {node.sourceRef ? (
          <p className="mt-1.5 text-[11px] text-ink-600">
            {t("sourceRef")}: {node.sourceRef}
          </p>
        ) : null}
      </div>

      {/* 2. Status and KPIs */}
      {(changed.highlights.length || updates.length) ? (
        <div className="mb-6 rounded-xl border border-gold-300 bg-gold-100/40 px-5 py-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-maroon-900">
            {t("whatChanged")}
          </p>
          <p className="text-sm leading-relaxed text-ink-900">
            {locale === "ar" ? changed.summary_ar : changed.summary_en}
          </p>
        </div>
      ) : null}
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

      {/* 3 to 5. Deliverables (or children), Lessons, Documents */}
      <div className="mt-8">
        <NodeTabs tabs={tabs} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {/* 8. Updates */}
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

          {/* 9. Lineage */}
          {lineage.length ? (
            <div className="mt-8 flex flex-wrap items-center gap-2 rounded-xl border border-gulf-100 bg-gulf-100/40 px-4 py-3">
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
                    {!forward ? <ArrowRight className="size-3 flip-rtl text-ink-600" /> : null}
                    <span className="max-w-52 truncate">{bi(locale, other.titleEn, other.titleAr)}</span>
                    {forward ? <ArrowRight className="size-3 flip-rtl text-ink-600" /> : null}
                    <span className="text-ink-600">{t(`lineageKind.${l.relation}` as never)}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}

          {/* 10. Brief me */}
          <div className="mt-8">
            <BriefDialog resourceType="node" resourceId={id} />
          </div>
        </div>

        <aside className="space-y-6">
          {/* 6. Experts */}
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

          {/* 7. Signals */}
          {nodeSignals.length ? (
            <div>
              <SectionTitle>{t("linkedSignals")}</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
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

          {/* Dependencies stay with their current content */}
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
                      <span className="block text-[11px] text-ink-600">
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
