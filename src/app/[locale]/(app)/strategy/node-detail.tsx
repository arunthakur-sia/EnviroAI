// CR03 2.4: the shared node detail renderer. Outcomes and targets open with
// the hero band (watermark number, title, description, progress ring, count
// chips); initiatives and projects open with a header band plus a horizontal
// timeline bar with milestone dots and deliverables as a mini shelf of books.
// Content and order stay from CR02: KPIs, delivery lanes (targets), tabs
// (Deliverables | Lessons | Documents), updates, lineage, experts, signals,
// dependencies, Brief me. Used by /strategy/[id] and the target slug route.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { inArray } from "drizzle-orm";
import { Archive, ArrowRight, Headphones, Plus } from "lucide-react";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { getNodeDetail, slugOfCode, loadLeadsFor } from "@/server/services/strategy";
import { getOwnerRefs } from "@/server/services/people";
import { listDeliverables } from "@/server/services/deliverables";
import { whatChanged } from "@/server/ai";
import { toShelfDocs } from "@/server/services/documents";
import { Reveal } from "@/components/motion";
import { bi, cn } from "@/lib/utils";
import { formatDate, formatNumber } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import {
  EmptyState,
  Chip,
  RagDot,
  Avatar,
  SectionTitle,
  Button,
  ProgressRing,
} from "@/components/ui/primitives";
import { Shelf } from "@/components/nexus/Shelf";
import { LeadChips } from "@/components/nexus/LeadChips";
import { OwnerControl } from "@/components/nexus/people/OwnerControl";
import { StakeholdersSection } from "@/components/nexus/Stakeholders";
import { BriefDialog } from "@/components/nexus/BriefDialog";
import { SignalCard } from "@/components/nexus/SignalCard";
import { toSignalCardData } from "@/components/nexus/signal-card-data";
import { LessonCard } from "@/components/nexus/LessonCard";
import { listSignals, canTriage } from "@/server/services/signals";
import { ReportButton } from "@/components/nexus/ReportButton";
import { KpiSection } from "./[id]/KpiSection";
import { StatusTimeline } from "./[id]/StatusTimeline";
import { NodeActions } from "./[id]/NodeActions";
import { NodeTabs } from "./[id]/NodeTabs";
import { DeliverablesSection } from "./[id]/DeliverablesSection";

const STATUS_ORDER = ["delayed", "at_risk", "on_track", "completed", "not_started"];

function outcomeNumber(code: string | null): string {
  const m = code?.match(/\d+/);
  return m ? m[0] : code ?? "";
}

function timelinePct(start: string | null, end: string | null, at?: string): number | null {
  if (!start || !end) return null;
  const s = Date.parse(start);
  const e = Date.parse(end);
  const p = at ? Date.parse(at) : Date.now();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s || !Number.isFinite(p)) return null;
  return Math.max(0, Math.min(1, (p - s) / (e - s)));
}

export async function NodeDetail({ locale, id }: { locale: string; id: string }) {
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
    leads,
    stakeholders,
    kpis,
    kpiValues,
    updates,
    linkedDocs,
    linkedExperts,
    lessons,
    lessonsAggregated,
    lessonCounts,
    deps,
    depNodes,
    lineage,
    lineageNodes,
    editions,
  } = detail;

  const isArchived = edition?.status === "archived";
  const canUpdate = !isArchived && can(user, "create", "strategy");
  const isDeliveryNode = node.nodeType === "initiative" || node.nodeType === "project";
  const isHeroNode = node.nodeType === "outcome" || node.nodeType === "target";
  const changed = await whatChanged([id], 30);
  const deliverables = isDeliveryNode ? await listDeliverables(user, id) : [];
  const deliverableDocIds = new Set(deliverables.map((d) => d.documentId));
  const shelfDocs = await toShelfDocs(
    linkedDocs.filter((d) => !deliverableDocIds.has(d.id)).slice(0, 12)
  );
  // CR03 2.4: deliverables as a mini shelf of books
  const deliverableDocs = deliverables.length
    ? await db
        .select()
        .from(schema.documents)
        .where(inArray(schema.documents.id, [...deliverableDocIds]))
    : [];
  const deliverableShelf = await toShelfDocs(deliverableDocs);
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

  // CR03 2.4: targets show their initiatives and projects grouped by status
  const grandchildren =
    node.nodeType === "target" && children.length
      ? await db
          .select()
          .from(schema.strategyNodes)
          .where(inArray(schema.strategyNodes.parentId, children.map((c) => c.id)))
      : [];
  const deliveryItems =
    node.nodeType === "target"
      ? [...children, ...grandchildren].filter(
          (n) => n.nodeType === "initiative" || n.nodeType === "project"
        )
      : [];
  // CR05 2.2: lead chips on the grouped delivery cards
  const itemLeads = Object.fromEntries(
    await loadLeadsFor(deliveryItems.map((n) => n.id))
  );
  const allDepartments = await db.select().from(schema.departments);

  /* CR08 9.1: the owner chip. The node's own person first; where none is
     recorded, the head of the department that leads the node, as the
     department owner. Nothing at all when neither exists (DECISIONS 121).
     One bulk resolve covers the header, the KPI custodians and the
     stakeholder rows. */
  const leadDepartment = leads.find((l) => l.kind === "department" && l.role === "lead") ?? null;
  const leadHeadUserId = leadDepartment
    ? allDepartments.find((d) => d.id === leadDepartment.id)?.headUserId ?? null
    : null;
  const ownerRefs = await getOwnerRefs([
    node.ownerUserId,
    leadHeadUserId,
    ...kpis.map((k) => k.ownerUserId),
    ...stakeholders.map((s) => s.userId),
  ]);
  const nodeOwner = node.ownerUserId ? ownerRefs[node.ownerUserId] ?? null : null;
  const headOwner = nodeOwner ? null : leadHeadUserId ? ownerRefs[leadHeadUserId] ?? null : null;
  const ownerItem = {
    type: node.nodeType,
    id: node.id,
    titleEn: node.titleEn,
    titleAr: node.titleAr,
    href: `/strategy/${node.id}`,
  };

  // hero progress: share of delivery descendants on track
  const heroPool =
    node.nodeType === "outcome"
      ? children.filter((c) => c.nodeType === "target")
      : deliveryItems;
  const heroProgress = heroPool.length
    ? heroPool.filter((c) => c.status === "on_track" || c.status === "completed").length /
      heroPool.length
    : 0;
  const heroPct = Math.round(heroProgress * 100);

  // milestones for delivery nodes: deliverable due/delivered dates on the bar
  const milestones = isDeliveryNode
    ? deliverables
        .map((d) => ({
          code: d.deliverableCode,
          date: d.deliveredDate ?? d.dueDate,
          done: Boolean(d.deliveredDate),
        }))
        .filter((m) => m.date)
        .map((m) => ({ ...m, pct: timelinePct(node.startDate, node.endDate, m.date!) }))
        .filter((m) => m.pct !== null)
    : [];
  const todayPct = timelinePct(node.startDate, node.endDate);

  // breadcrumb path back into the navigator
  const outcomeAncestor =
    node.nodeType === "outcome" ? node : parent?.nodeType === "outcome" ? parent : null;

  const tabs: { key: string; label: string; badge?: number; content: React.ReactNode }[] = [];
  if (isDeliveryNode) {
    tabs.push({
      key: "deliverables",
      label: t("deliverablesTab"),
      badge: deliverables.length,
      content: (
        <div>
          {deliverableShelf.length ? (
            <div className="mb-5" data-testid="deliverables-mini-shelf">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600" style={{ fontFamily: "inherit" }}>
                {t("deliverablesShelf")}
              </p>
              <Shelf docs={deliverableShelf} height={140} className="mb-2" />
            </div>
          ) : null}
          <DeliverablesSection
            nodeId={id}
            initial={deliverables}
            canUpload={!isArchived && can(user, "create", "vault")}
            classificationLabels={classificationLabels}
          />
        </div>
      ),
    });
  } else if (children.length && node.nodeType !== "target") {
    tabs.push({
      key: "contains",
      label: t("children"),
      badge: children.length,
      content: (
        <div className="card divide-y divide-mist-100">
          {children.map((c) => (
            <Link
              key={c.id}
              href={`/strategy/${c.id}` as never}
              className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-navy-50"
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
          {/* CR07 1.3: the counts say what is this node's own and what came
              from the nodes beneath it */}
          {lessonsAggregated ? (
            <p className="text-xs text-ink-600">
              {t("lessonSplit", {
                direct: lessonCounts.direct,
                inherited: lessonCounts.inherited,
              })}
            </p>
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
              <div key={l.id} className="flex flex-col gap-1">
                <LessonCard
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
                {l.inheritedFrom ? (
                  <p className="truncate ps-1 text-[11px] text-ink-400" data-testid="inherited-from">
                    {t("inheritedFrom", {
                      node: `${l.inheritedFrom.code ? `${l.inheritedFrom.code} ` : ""}${bi(
                        locale,
                        l.inheritedFrom.titleEn,
                        l.inheritedFrom.titleAr
                      )}`,
                    })}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-mist-300 bg-mist-50 px-4 py-6 text-center text-sm text-ink-600">
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
      <Shelf docs={shelfDocs} height={184} />
    ) : (
      <p className="rounded-xl border border-dashed border-mist-300 bg-mist-50 px-4 py-6 text-center text-sm text-ink-600">
        {tc("nothingHere")}
      </p>
    ),
  });

  const actions = (
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
          departments={allDepartments.map((d) => ({ id: d.id, nameEn: d.nameEn, nameAr: d.nameAr }))}
          canEditLeads={isDeliveryNode}
        />
      ) : null}
    </div>
  );

  return (
    <Reveal>
      {/* breadcrumb (CR03 2.5) */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-600">
        <Link
          href={(edition?.isDefault ? "/strategy" : `/strategy/${edition?.code}`) as never}
          className="hover:text-navy-700"
        >
          {edition ? bi(locale, edition.nameEn, edition.nameAr) : ""}
        </Link>
        {outcomeAncestor && edition && node.nodeType !== "outcome" ? (
          <>
            <span>/</span>
            <Link
              href={`/strategy/${edition.code}/${slugOfCode(outcomeAncestor.code, outcomeAncestor.id)}` as never}
              className="hover:text-navy-700"
            >
              {outcomeAncestor.code ?? bi(locale, outcomeAncestor.titleEn, outcomeAncestor.titleAr)}
            </Link>
          </>
        ) : null}
        {parent && parent.id !== outcomeAncestor?.id ? (
          <>
            <span>/</span>
            <Link href={`/strategy/${parent.id}` as never} className="hover:text-navy-700">
              {bi(locale, parent.titleEn, parent.titleAr)}
            </Link>
          </>
        ) : null}
      </div>

      {/* CR03 2.4: hero band */}
      <header
        className="relative mb-6 overflow-hidden rounded-2xl bg-mist-100 px-7 py-6"
        data-testid="node-hero"
      >
        {isHeroNode ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1 start-4 select-none font-semibold text-navy-100"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: node.nodeType === "outcome" ? 96 : 72,
              lineHeight: 1,
            }}
          >
            {node.nodeType === "outcome" ? outcomeNumber(node.code) : node.code}
          </span>
        ) : null}
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl flex-1">
            <h1
              className="flex flex-wrap items-center gap-2.5"
              style={{ fontSize: isHeroNode ? 32 : 26, lineHeight: 1.2 }}
            >
              <RagDot status={node.status} className="h-3 w-3" />
              {node.code ? (
                <span className="text-base text-ink-600 tnum">{node.code}</span>
              ) : null}
              {bi(locale, node.titleEn, node.titleAr)}
            </h1>
            {(node.descriptionEn || node.descriptionAr) ? (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
                {bi(locale, node.descriptionEn ?? "", node.descriptionAr ?? "")}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Chip tone="navy">{t(`nodeType.${node.nodeType}` as never)}</Chip>
              <Chip tone="mist">{tc(`status.${node.status}` as never)}</Chip>
              {isArchived ? (
                <Chip tone="mist">
                  <Archive className="size-3" /> {t("archiveChip")}
                </Chip>
              ) : null}
              {node.verified === 0 ? <Chip tone="warn">{tc("toVerify")}</Chip> : null}
              <LeadChips leads={leads} max={3} />
              {node.budgetQar ? (
                <span className="text-xs text-ink-600 tnum">
                  {t("budget")}: {formatNumber(node.budgetQar, locale, { compact: true })} QAR
                </span>
              ) : null}
              {isHeroNode && (node.startDate || node.endDate) ? (
                <span className="text-xs text-ink-600 tnum">
                  {formatDate(node.startDate, locale, { style: "short" })} {"-"}{" "}
                  {formatDate(node.endDate, locale, { style: "short" })}
                </span>
              ) : null}
            </div>

            {/* CR03 2.4: delivery timeline bar with milestone dots */}
            {isDeliveryNode && todayPct !== null ? (
              <div className="mt-4 max-w-xl" data-testid="delivery-timeline">
                <div className="relative h-1.5 rounded-full bg-mist-300/80">
                  <span
                    className="absolute inset-y-0 start-0 rounded-full bg-teal-400"
                    style={{ width: `${Math.round(todayPct * 100)}%` }}
                  />
                  <span
                    className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-navy-700"
                    style={{ insetInlineStart: `${Math.round(todayPct * 100)}%` }}
                    title={t("lanes.today")}
                  />
                  {milestones.map((m) => (
                    <span
                      key={m.code}
                      className={cn(
                        "absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 border-white",
                        m.done ? "bg-ok" : "bg-mist-300"
                      )}
                      style={{ insetInlineStart: `calc(${Math.round((m.pct ?? 0) * 100)}% - 5px)` }}
                      title={`${m.code} · ${formatDate(m.date, locale, { style: "short" })}`}
                    />
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-ink-600 tnum">
                  <span>{formatDate(node.startDate, locale, { style: "short" })}</span>
                  <span>{formatDate(node.endDate, locale, { style: "short" })}</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-end gap-3">
            {/* CR08 9.1: the owner at the end side of the header, beside the
                lead chips, which name organisations rather than people */}
            {nodeOwner ? (
              <OwnerControl
                owner={nodeOwner}
                role={isDeliveryNode ? "project_owner" : "owner"}
                item={ownerItem}
                align="end"
              />
            ) : headOwner ? (
              <OwnerControl owner={headOwner} role="department_owner" item={ownerItem} align="end" />
            ) : null}
            {actions}
            {isHeroNode && heroPool.length ? (
              <ProgressRing
                value={heroProgress}
                size={node.nodeType === "outcome" ? 110 : 92}
                stroke={8}
                aria-label={t("hero.progressAria", { pct: heroPct })}
              >
                <span className="text-lg font-semibold text-navy-900 tnum">{heroPct}%</span>
              </ProgressRing>
            ) : null}
          </div>
        </div>
        {node.sourceRef ? (
          <p className="relative mt-2 text-[11px] text-ink-600">
            {t("sourceRef")}: {node.sourceRef}
          </p>
        ) : null}
      </header>

      {/* What changed */}
      {(changed.highlights.length || updates.length) ? (
        <div className="mb-6 rounded-xl border border-aqua-300 bg-aqua-100/40 px-5 py-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-navy-900">
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
            /* CR08 9.1: the KPI's custodian */
            ownerUserId: k.ownerUserId,
          }))}
          values={kpiValues.map((v) => ({
            kpiId: v.kpiId,
            period: v.period,
            actual: v.actualValue,
            target: v.targetForPeriod,
            note: v.note,
          }))}
          owners={ownerRefs}
          nodeHref={`/strategy/${node.id}`}
        />
      ) : null}

      {/* CR03 2.4: target detail shows delivery lanes grouped by status */}
      {node.nodeType === "target" && deliveryItems.length ? (
        <div className="mt-8" data-testid="target-lanes">
          <SectionTitle>{t("nav.items")}</SectionTitle>
          <div className="flex flex-col gap-5">
            {STATUS_ORDER.filter((s) => deliveryItems.some((i) => i.status === s)).map((status) => (
              <div key={status}>
                <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600" style={{ fontFamily: "inherit" }}>
                  <RagDot status={status} /> {tc(`status.${status}` as never)}{" "}
                  <span className="tnum font-medium">
                    {deliveryItems.filter((i) => i.status === status).length}
                  </span>
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {deliveryItems
                    .filter((i) => i.status === status)
                    .map((i) => (
                      <Link
                        key={i.id}
                        href={`/strategy/${i.id}` as never}
                        className="card card-hover flex flex-col gap-1.5 px-4 py-3"
                      >
                        <span className="flex items-center gap-2">
                          {i.code ? (
                            <span className="text-[10px] text-ink-600 tnum">{i.code}</span>
                          ) : null}
                          <Chip tone="ghost">{t(`nodeType.${i.nodeType}` as never)}</Chip>
                        </span>
                        <span className="line-clamp-2 text-sm font-medium leading-snug text-ink-900">
                          {bi(locale, i.titleEn, i.titleAr)}
                        </span>
                        <LeadChips leads={itemLeads[i.id] ?? []} />
                      </Link>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Deliverables (or children), Lessons, Documents */}
      <div className="mt-8">
        <NodeTabs tabs={tabs} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
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

          {lineage.length ? (
            <div className="mt-8 flex flex-wrap items-center gap-2 rounded-xl border border-teal-100 bg-teal-100/40 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">
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
                    className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs text-ink-900 shadow-sm hover:text-teal-600"
                  >
                    <Chip tone="teal">{otherEdition?.code.toUpperCase()}</Chip>
                    {!forward ? <ArrowRight className="size-3 flip-rtl text-ink-600" /> : null}
                    <span className="max-w-52 truncate">{bi(locale, other.titleEn, other.titleAr)}</span>
                    {forward ? <ArrowRight className="size-3 flip-rtl text-ink-600" /> : null}
                    <span className="text-ink-600">{t(`lineageKind.${l.relation}` as never)}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}

          {/* CR05 3.2: stakeholders at the bottom of project and initiative
              pages, before the actions */}
          {isDeliveryNode ? (
            <StakeholdersSection
              nodeId={id}
              rows={stakeholders}
              canEdit={!isArchived && can(user, "create", "strategy")}
              owners={ownerRefs}
              item={ownerItem}
            />
          ) : null}

          <div className="mt-8">
            <BriefDialog resourceType="node" resourceId={id} />
          </div>
        </div>

        <aside className="space-y-6">
          {linkedExperts.length ? (
            <div>
              <SectionTitle>{t("linkedExperts")}</SectionTitle>
              <div className="card divide-y divide-mist-100">
                {linkedExperts.slice(0, 5).map((e) => (
                  <Link
                    key={e.id}
                    href={`/experts/${e.id}` as never}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-navy-50"
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

          {deps.length ? (
            <div>
              <SectionTitle>{t("dependencies")}</SectionTitle>
              <div className="card divide-y divide-mist-100">
                {deps.map((d) => {
                  const otherId = d.nodeId === id ? d.dependsOnNodeId : d.nodeId;
                  const other = depNodes.find((n) => n.id === otherId);
                  if (!other) return null;
                  const dependsOn = d.nodeId === id;
                  return (
                    <Link
                      key={d.id}
                      href={`/strategy/${otherId}` as never}
                      className="block px-4 py-2.5 text-sm hover:bg-navy-50"
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
