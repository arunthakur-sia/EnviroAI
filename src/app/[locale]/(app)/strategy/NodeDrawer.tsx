"use client";
// CR04 2.4: the slide-over drawer for initiatives and projects. 520px from
// the end side over a 20 percent scrim; the page keeps its scroll and state.
// Content loads with a skeleton; Previous and Next move between siblings in
// the same lane with a crossfade (arrow keys too); Escape closes.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Link as LinkIcon,
  MessageCircleQuestion,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn, bi } from "@/lib/utils";
import { formatDate, formatNumber } from "@/lib/format";
import { Avatar, Chip, RagDot, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { Shelf, type ShelfDoc } from "@/components/nexus/Shelf";
import { LeadChips, LeadChipPill } from "@/components/nexus/LeadChips";
import { OwnerControl } from "@/components/nexus/people/OwnerControl";
import type { ItemRef, OwnerRef } from "@/components/nexus/people/OwnerControl";
import { StakeholdersSection } from "@/components/nexus/Stakeholders";
import type { LeadChip as LeadChipData, StakeholderRow } from "@/server/services/strategy";
import { BriefDialog } from "@/components/nexus/BriefDialog";
import { ReportButton } from "@/components/nexus/ReportButton";
import { KpiSection } from "./[id]/KpiSection";

export type DrawerPayload = {
  node: {
    id: string;
    code: string | null;
    nodeType: string;
    titleEn: string;
    titleAr: string;
    descriptionEn: string | null;
    descriptionAr: string | null;
    status: string;
    budgetQar: number | null;
    startDate: string | null;
    endDate: string | null;
  };
  /* CR05 2.2: lead chips (joint leads = several) and supporting entities */
  leads: LeadChipData[];
  /* CR08 9.1: the node's owner, and every person the drawer names by id */
  owner: OwnerRef | null;
  owners: Record<string, OwnerRef>;
  /* CR05 3.2: the stakeholder section before the actions */
  stakeholders: StakeholderRow[];
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
    ownerUserId: string | null;
  }[];
  kpiValues: { kpiId: string; period: string; actual: number | null; target: number | null; note: string | null }[];
  deliverables: {
    id: string;
    documentId: string;
    deliverableCode: string;
    milestone: string | null;
    dueDate: string | null;
    deliveredDate: string | null;
    acceptanceStatus: string;
    titleEn: string;
    titleAr: string;
    status: string;
  }[];
  deliverableShelf: ShelfDoc[];
  lessons: { id: string; titleEn: string; titleAr: string; learningEn: string | null; learningAr: string | null; category: string; status: string; reuseCount: number }[];
  experts: { id: string; nameEn: string; nameAr: string; positionEn: string | null; positionAr: string | null; avatarColor: string }[];
  signals: { id: string; titleEn: string; titleAr: string; publisher: string | null; publishedAt: string | null; impact: string; horizon: string; triageStatus: string }[];
  updates: { id: string; status: string; progressPct: number | null; summaryEn: string | null; summaryAr: string | null; period: string | null; createdAt: string; authorNameEn: string | null; authorNameAr: string | null }[];
  lineage: ({ id: string; relation: string; forward: boolean; nodeId: string; titleEn: string; titleAr: string; editionCode: string } | null)[];
};

const cardCache = new Map<string, DrawerPayload>();

export async function fetchNodeCard(id: string): Promise<DrawerPayload | null> {
  if (cardCache.has(id)) return cardCache.get(id)!;
  try {
    const res = await fetch(`/api/v1/strategy/node-card?id=${encodeURIComponent(id)}`);
    const json = await res.json();
    if (res.ok && json.data) {
      cardCache.set(id, json.data as DrawerPayload);
      return json.data as DrawerPayload;
    }
  } catch {
    /* drawer shows the error state */
  }
  return null;
}

function timelinePct(start: string | null, end: string | null, at?: string): number | null {
  if (!start || !end) return null;
  const s = Date.parse(start);
  const e = Date.parse(end);
  const p = at ? Date.parse(at) : Date.now();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s || !Number.isFinite(p)) return null;
  return Math.max(0, Math.min(1, (p - s) / (e - s)));
}

function DrawerSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-5" aria-busy>
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

export function NodeDrawer({
  nodeId,
  siblings,
  onNavigate,
  onClose,
  onCopyLink,
}: {
  nodeId: string;
  /** ordered ids of the same lane, for Previous and Next */
  siblings: string[];
  onNavigate: (id: string) => void;
  onClose: () => void;
  onCopyLink: () => void;
}) {
  const t = useTranslations("strategy");
  const tc = useTranslations("common");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const { toast } = useToast();
  const [payload, setPayload] = React.useState<DrawerPayload | null>(cardCache.get(nodeId) ?? null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setPayload(cardCache.get(nodeId) ?? null);
    setFailed(false);
    fetchNodeCard(nodeId).then((data) => {
      if (!alive) return;
      if (data) setPayload(data);
      else setFailed(true);
    });
    // siblings prefetch so Next feels instant (CR04 2.4)
    const index = siblings.indexOf(nodeId);
    for (const sib of [siblings[index - 1], siblings[index + 1]]) {
      if (sib) void fetchNodeCard(sib);
    }
    return () => {
      alive = false;
    };
  }, [nodeId, siblings]);

  const index = siblings.indexOf(nodeId);
  const prevId = index > 0 ? siblings[index - 1] : null;
  const nextId = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      /* CR08 9.1: an overlay opened from inside the drawer (a person card, a
         dialog) is the layer on top, so it owns Escape and the arrow keys
         until it is dismissed (DECISIONS 117) */
      if (
        e.defaultPrevented ||
        document.querySelector('[data-testid="person-card-popover"], [role="dialog"][data-state="open"]')
      ) {
        return;
      }
      if (e.key === "Escape") onClose();
      const back = locale === "ar" ? "ArrowRight" : "ArrowLeft";
      const fwd = locale === "ar" ? "ArrowLeft" : "ArrowRight";
      if (e.key === back && prevId) onNavigate(prevId);
      if (e.key === fwd && nextId) onNavigate(nextId);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNavigate, prevId, nextId, locale]);

  const node = payload?.node;
  const todayPct = node ? timelinePct(node.startDate, node.endDate) : null;
  const milestones = (payload?.deliverables ?? [])
    .map((d) => ({
      code: d.deliverableCode,
      date: d.deliveredDate ?? d.dueDate,
      done: Boolean(d.deliveredDate),
    }))
    .filter((m) => m.date)
    .map((m) => ({ ...m, pct: node ? timelinePct(node.startDate, node.endDate, m.date!) : null }))
    .filter((m) => m.pct !== null);
  /* CR08 9.1: what a person card is opened for inside this drawer */
  const drawerItem: ItemRef | null = node
    ? { type: node.nodeType, id: node.id, titleEn: node.titleEn, titleAr: node.titleAr, href: `/strategy/${node.id}` }
    : null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" data-testid="node-drawer">
      {/* scrim at 20 percent; the page beneath keeps its state */}
      <motion.button
        aria-label={tc("close")}
        className="absolute inset-0 bg-ink-900/20"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduced ? undefined : { opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        className="absolute inset-y-0 end-0 flex w-full max-w-[520px] flex-col bg-white shadow-[var(--shadow-pop)]"
        initial={reduced ? false : { x: locale === "ar" ? "-100%" : "100%" }}
        animate={{ x: 0 }}
        exit={reduced ? undefined : { x: locale === "ar" ? "-100%" : "100%" }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* header */}
        <div className="flex items-center gap-1.5 border-b border-mist-100 px-4 py-3">
          <button
            onClick={() => prevId && onNavigate(prevId)}
            disabled={!prevId}
            aria-label={t("canvas.prev")}
            className="rounded-lg p-1.5 text-ink-600 hover:bg-mist-100 disabled:opacity-30 cursor-pointer"
          >
            <ChevronLeft className="size-4 flip-rtl" />
          </button>
          <button
            onClick={() => nextId && onNavigate(nextId)}
            disabled={!nextId}
            aria-label={t("canvas.next")}
            className="rounded-lg p-1.5 text-ink-600 hover:bg-mist-100 disabled:opacity-30 cursor-pointer"
          >
            <ChevronRight className="size-4 flip-rtl" />
          </button>
          <span className="min-w-0 flex-1" />
          <button
            onClick={() => {
              onCopyLink();
              toast(t("canvas.linkCopied"), "success");
            }}
            aria-label={t("canvas.copyLink")}
            className="rounded-lg p-1.5 text-ink-600 hover:bg-mist-100 cursor-pointer"
          >
            <LinkIcon className="size-4" />
          </button>
          <button
            onClick={onClose}
            aria-label={tc("close")}
            className="rounded-lg p-1.5 text-ink-600 hover:bg-mist-100 cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={nodeId + (payload ? "-ready" : "-loading")}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              {!payload && !failed ? (
                <DrawerSkeleton />
              ) : failed ? (
                <p className="p-6 text-sm text-ink-600">{tc("error")}</p>
              ) : node ? (
                <div className="flex flex-col gap-5 p-5">
                  {/* header block */}
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-ink-600">
                      <Chip tone="navy">{t(`nodeType.${node.nodeType}` as never)}</Chip>
                      {node.code ? <span className="tnum">{node.code}</span> : null}
                      <RagDot status={node.status} />
                      <span>{tc(`status.${node.status}` as never)}</span>
                    </p>
                    <h2 className="mt-1.5 text-xl leading-snug">{bi(locale, node.titleEn, node.titleAr)}</h2>
                    {(node.descriptionEn || node.descriptionAr) ? (
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                        {bi(locale, node.descriptionEn ?? "", node.descriptionAr ?? "")}
                      </p>
                    ) : null}
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600">
                      <LeadChips leads={payload.leads ?? []} max={3} />
                      {node.budgetQar ? (
                        <span className="tnum">
                          {t("budget")}: {formatNumber(node.budgetQar, locale, { compact: true })} QAR
                        </span>
                      ) : null}
                    </p>
                    {/* CR08 9.1: the owner, after the lead chips (which name
                        organisations, not people) */}
                    {payload.owner ? (
                      <div className="mt-2.5">
                        <OwnerControl
                          owner={payload.owner}
                          role={
                            node.nodeType === "project" || node.nodeType === "initiative"
                              ? "project_owner"
                              : "owner"
                          }
                          item={drawerItem}
                          align="start"
                        />
                      </div>
                    ) : null}
                    {/* CR05 2.2: supporting entities under the lead chips */}
                    {(payload.leads ?? []).some((l) => l.role === "supporting") ? (
                      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-600" data-testid="supporting-leads">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                          {t("supporting")}
                        </span>
                        {(payload.leads ?? [])
                          .filter((l) => l.role === "supporting")
                          .map((l) => (
                            <LeadChipPill key={`${l.kind}:${l.id}`} lead={l} />
                          ))}
                      </p>
                    ) : null}
                  </div>

                  {/* timeline bar with milestones */}
                  {todayPct !== null ? (
                    <div>
                      <div className="relative h-1.5 rounded-full bg-mist-300/80">
                        <span
                          className="absolute inset-y-0 start-0 rounded-full bg-teal-400"
                          style={{ width: `${Math.round(todayPct * 100)}%` }}
                        />
                        <span
                          className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-navy-700"
                          style={{ insetInlineStart: `${Math.round(todayPct * 100)}%` }}
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

                  {/* KPIs */}
                  {payload.kpis.length ? (
                    <KpiSection
                      kpis={payload.kpis}
                      values={payload.kpiValues}
                      owners={payload.owners}
                      nodeHref={`/strategy/${node.id}`}
                    />
                  ) : null}

                  {/* deliverables: the mini shelf plus the compact list */}
                  {payload.deliverableShelf.length ? (
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600" style={{ fontFamily: "inherit" }}>
                        {t("deliverables")}
                      </p>
                      <Shelf docs={payload.deliverableShelf} height={140} className="mb-2" />
                      <div className="flex flex-col gap-1">
                        {payload.deliverables.map((d) => (
                          <Link
                            key={d.id}
                            href={`/vault/${d.documentId}` as never}
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-navy-50"
                          >
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-navy-100 text-[10px] font-semibold text-navy-900 tnum">
                              {d.deliverableCode}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-ink-900">
                              {bi(locale, d.titleEn, d.titleAr)}
                            </span>
                            <span className="shrink-0 text-[10px] text-ink-600">
                              {t(`acceptance.${d.acceptanceStatus}` as never)}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* lessons */}
                  {payload.lessons.length ? (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600" style={{ fontFamily: "inherit" }}>
                        {t("lessonsTab")}
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {payload.lessons.map((l) => (
                          <Link
                            key={l.id}
                            href={`/lessons/${l.id}` as never}
                            className="rounded-lg border border-mist-100 px-3 py-2 text-sm hover:border-navy-100 hover:bg-navy-50"
                          >
                            <span className="line-clamp-1 font-medium text-ink-900">
                              {bi(locale, l.titleEn, l.titleAr)}
                            </span>
                            {(l.learningEn || l.learningAr) ? (
                              <span className="line-clamp-2 text-xs text-ink-600">
                                {bi(locale, l.learningEn ?? "", l.learningAr ?? "")}
                              </span>
                            ) : null}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* experts */}
                  {payload.experts.length ? (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600" style={{ fontFamily: "inherit" }}>
                        {t("linkedExperts")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {payload.experts.map((e) => (
                          <Link
                            key={e.id}
                            href={`/experts/${e.id}` as never}
                            className="flex items-center gap-2 rounded-lg border border-mist-100 px-2.5 py-1.5 text-xs hover:border-navy-100 hover:bg-navy-50"
                          >
                            <Avatar name={e.nameEn} color={e.avatarColor} size={22} />
                            <span className="text-ink-900">{bi(locale, e.nameEn, e.nameAr)}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* signals */}
                  {payload.signals.length ? (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600" style={{ fontFamily: "inherit" }}>
                        {t("linkedSignals")}
                      </p>
                      <div className="flex flex-col gap-1">
                        {payload.signals.map((s) => (
                          <Link
                            key={s.id}
                            href={`/trends/${s.id}` as never}
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-navy-50"
                          >
                            <span className="min-w-0 flex-1 truncate text-ink-900">
                              {bi(locale, s.titleEn, s.titleAr)}
                            </span>
                            <span className="shrink-0 text-[10px] text-ink-600">{s.publisher ?? ""}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* status updates */}
                  {payload.updates.length ? (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600" style={{ fontFamily: "inherit" }}>
                        {t("statusUpdates")}
                      </p>
                      <ol className="flex flex-col gap-2 border-s border-navy-100 ps-3">
                        {payload.updates.map((u) => (
                          <li key={u.id} className="text-xs">
                            <p className="flex items-center gap-2">
                              <RagDot status={u.status} />
                              {u.progressPct != null ? (
                                <span className="font-medium text-ink-900 tnum">{u.progressPct}%</span>
                              ) : null}
                              <span className="text-ink-600 tnum">
                                {formatDate(u.createdAt, locale, { style: "short" })}
                              </span>
                            </p>
                            {(u.summaryEn || u.summaryAr) ? (
                              <p className="mt-0.5 line-clamp-2 leading-relaxed text-ink-600">
                                {bi(locale, u.summaryEn ?? "", u.summaryAr ?? "")}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  {/* lineage */}
                  {payload.lineage.filter(Boolean).length ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {payload.lineage.filter(Boolean).map((l) => (
                        <Link
                          key={l!.id}
                          href={`/strategy/${l!.nodeId}` as never}
                          className="flex items-center gap-1.5 rounded-lg bg-teal-100/50 px-2 py-1 text-[11px] text-ink-900 hover:text-teal-600"
                        >
                          <Chip tone="teal">{l!.editionCode}</Chip>
                          <span className="max-w-44 truncate">{bi(locale, l!.titleEn, l!.titleAr)}</span>
                        </Link>
                      ))}
                    </div>
                  ) : null}

                  {/* CR05 3.2: stakeholders at the end, before the actions */}
                  {(payload.stakeholders ?? []).length ? (
                    <StakeholdersSection
                      nodeId={node.id}
                      rows={payload.stakeholders}
                      canEdit={false}
                      compact
                      owners={payload.owners}
                      item={drawerItem}
                    />
                  ) : null}

                  {/* actions */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-mist-100 pt-4">
                    <BriefDialog resourceType="node" resourceId={node.id} />
                    <Link
                      href={`/ask/c/new?q=${encodeURIComponent(`Tell me about ${node.code ?? ""} ${node.titleEn}`.trim())}` as never}
                      className="inline-flex h-9.5 items-center gap-2 rounded-lg border border-mist-300 bg-white px-4 text-sm font-medium text-ink-900 hover:border-navy-300 hover:text-navy-700"
                    >
                      <MessageCircleQuestion className="size-4" /> {t("canvas.askAboutThis")}
                    </Link>
                    <ReportButton
                      scope={{
                        kind: "node",
                        ids: [node.id],
                        labelEn: `${node.code ? node.code + " " : ""}${node.titleEn}`,
                        labelAr: `${node.code ? node.code + " " : ""}${node.titleAr}`,
                      }}
                    />
                    <Link
                      href={`/strategy/${node.id}` as never}
                      className="link-draw ms-auto inline-flex items-center gap-1 text-xs font-medium text-ink-600"
                      data-testid="open-full-page"
                    >
                      <ExternalLink className="size-3" /> {t("canvas.openFullPage")}
                    </Link>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.aside>
    </div>
  );
}
