"use client";
// CR08 6: the administrator's view of one handover. The inventory with
// scope ticks, items and tacit topics, the recipient decision per item
// (a person, the system, mixed); the filing report with approve and apply;
// the interviews with read-only transcripts; the learning paths per
// recipient; the access link card; the close panel with the readiness
// checklist, the override reason, the explicit cut-off and the report.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  FileText,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  Sparkles,
  UserCheck,
  XCircle,
} from "lucide-react";
import { Avatar, Button, Chip, EmptyState, Input, Label, NativeSelect, ProgressRing, Textarea } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { Link, useRouter } from "@/i18n/navigation";
import { bi, cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { CATEGORIES, type ItemCategory } from "@/lib/handover-constants";
import type { HandoverDetail, InterviewView, ItemView } from "@/server/services/handover";
import { api, Countdown, FilingChip, KindChip, PersonLine, ProgressBar, StatusChip, useRequiredLabels } from "../../../handover/_components/bits";
import { Checklist } from "../../../handover/_components/Checklist";
import { InterviewPanel } from "../../../handover/_components/InterviewPanel";

type UserOpt = { id: string; nameEn: string; nameAr: string; departmentId: string | null };

export function HandoverAdminClient({ initial, users }: { initial: HandoverDetail; users: UserOpt[] }) {
  const t = useTranslations("handover.admin");
  const th = useTranslations("handover");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const requiredLabel = useRequiredLabels();
  const [detail, setDetail] = React.useState(initial);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState("inventory");
  const closed = detail.status === "complete";
  const illustrative = (detail.notes ?? "").startsWith("[Illustrative]");

  const reload = React.useCallback(async () => {
    const res = await api<HandoverDetail>(`/api/v1/handover/${initial.id}`);
    if (res.ok && res.data) setDetail(res.data);
  }, [initial.id]);

  async function act<T = unknown>(key: string, body: Record<string, unknown>, okMessage?: string): Promise<T | null> {
    setBusy(key);
    try {
      const res = await api<T>(`/api/v1/handover/${detail.id}`, { method: "PATCH", body: JSON.stringify(body) });
      if (!res.ok) {
        toast(res.error === "not_ready" ? t("close.notReadyToast") : res.error === "recipient_is_person" ? t("recipientIsPerson") : tc("error"), "error");
        return null;
      }
      if (okMessage) toast(okMessage, "success");
      await reload();
      return res.data;
    } finally {
      setBusy(null);
    }
  }

  const readyChecks = detail.readiness.checks.filter((c) => c.ok).length;

  return (
    <div className="flex flex-col gap-5" data-testid="handover-admin">
      {/* header */}
      <section className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <KindChip kind={detail.kind} />
              <Chip tone="mist">{th(`personKinds.${detail.personKind}`)}</Chip>
              <StatusChip status={detail.status} />
              {detail.interviewRequired ? <Chip tone="aqua">{th("interview.mandatory")}</Chip> : null}
              {detail.cutOffAt ? (
                <Chip tone="danger">
                  <Lock className="size-3" aria-hidden /> {t("cutOffChip", { date: formatDate(detail.cutOffAt, locale) })}
                </Chip>
              ) : null}
              {illustrative ? <Chip tone="mist">{tc("illustrative")}</Chip> : null}
            </div>
            <div className="mt-3">
              <PersonLine person={detail.person} size={48} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-ink-400">{th("lastWorkingDay")}</dt>
                <dd>
                  <Countdown days={detail.daysToLastWorkingDay} lastWorkingDay={detail.lastWorkingDay} compact />
                </dd>
              </div>
              <div>
                <dt className="text-ink-400">{th("dueDate")}</dt>
                <dd className="text-ink-900 tnum">{detail.dueDate ? formatDate(detail.dueDate, locale) : th("notSet")}</dd>
              </div>
              <div>
                <dt className="text-ink-400">{th("defaultRecipient")}</dt>
                <dd className="text-ink-900">{detail.defaultRecipient ? bi(locale, detail.defaultRecipient.nameEn, detail.defaultRecipient.nameAr) : th("recipientKinds.system")}</dd>
              </div>
              <div>
                <dt className="text-ink-400">{t("startedBy")}</dt>
                <dd className="text-ink-900">{detail.createdBy ? bi(locale, detail.createdBy.nameEn, detail.createdBy.nameAr) : "-"}</dd>
              </div>
            </dl>
            {detail.reason ? (
              <p className="mt-2 text-sm text-ink-600">
                {th("reason")}: <span className="text-ink-900">{detail.reason}</span>
              </p>
            ) : null}
          </div>
          <div className="flex w-full shrink-0 items-center gap-4 rounded-xl bg-mist-50 p-4 lg:w-96">
            <ProgressRing value={readyChecks / detail.readiness.checks.length} size={72} stroke={7} color={detail.readiness.ok ? "var(--color-ok)" : "var(--color-aqua-500)"}>
              <span className="text-sm font-semibold text-ink-900 tnum">{readyChecks}/{detail.readiness.checks.length}</span>
            </ProgressRing>
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <ProgressBar value={detail.progress.items.pct} label={th("progress.items")} detail={`${detail.progress.items.done}/${detail.progress.items.total}`} testId="admin-progress-items" />
              <ProgressBar value={detail.progress.interviews.pct} label={th("progress.interviews")} detail={`${detail.progress.interviews.complete}/${detail.progress.interviews.total}`} tone="teal" testId="admin-progress-interviews" />
              <ProgressBar value={detail.progress.paths.total ? Math.round((100 * detail.progress.paths.signedOff) / detail.progress.paths.total) : 0} label={th("progress.paths")} detail={`${detail.progress.paths.signedOff}/${detail.progress.paths.total}`} tone="aqua" />
            </div>
          </div>
        </div>
        {detail.required.length && !closed ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-mist-100 pt-3" data-testid="admin-required">
            <span className="text-xs font-medium text-ink-600">{t("stillRequired")}</span>
            {detail.required.map((code) => (
              <Chip key={code} tone="mist">
                {requiredLabel(code)}
              </Chip>
            ))}
          </div>
        ) : null}
      </section>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap" aria-label={t("tabsAria")}>
          <TabsTrigger value="inventory" data-testid="tab-inventory">
            {t("tabs.inventory")} <span className="ms-1 text-xs text-ink-400 tnum">{detail.items.length}</span>
          </TabsTrigger>
          <TabsTrigger value="filing" data-testid="tab-filing">
            {t("tabs.filing")} <span className="ms-1 text-xs text-ink-400 tnum">{detail.filing.items.length}</span>
          </TabsTrigger>
          <TabsTrigger value="interviews" data-testid="tab-interviews">
            {t("tabs.interviews")} <span className="ms-1 text-xs text-ink-400 tnum">{detail.interviews.length}</span>
          </TabsTrigger>
          <TabsTrigger value="paths" data-testid="tab-paths">
            {t("tabs.paths")} <span className="ms-1 text-xs text-ink-400 tnum">{detail.recipients.length}</span>
          </TabsTrigger>
          {detail.personKind === "external" ? (
            <TabsTrigger value="access" data-testid="tab-access">
              {t("tabs.access")}
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="close" data-testid="tab-close">
            {t("tabs.close")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-4 focus:outline-none">
          <InventoryTab detail={detail} users={users} closed={closed} busy={busy} act={act} onNote={async (itemId, note) => void (await act(`note-${itemId}`, { action: "note", itemId, note }, th("checklist.noteSaved")))} />
        </TabsContent>
        <TabsContent value="filing" className="mt-4 focus:outline-none">
          <FilingTab detail={detail} closed={closed} busy={busy} act={act} />
        </TabsContent>
        <TabsContent value="interviews" className="mt-4 focus:outline-none">
          <InterviewsTab detail={detail} closed={closed} onChange={reload} />
        </TabsContent>
        <TabsContent value="paths" className="mt-4 focus:outline-none">
          <PathsTab detail={detail} closed={closed} busy={busy} act={act} />
        </TabsContent>
        {detail.personKind === "external" ? (
          <TabsContent value="access" className="mt-4 focus:outline-none">
            <AccessTab detail={detail} closed={closed} busy={busy} act={act} />
          </TabsContent>
        ) : null}
        <TabsContent value="close" className="mt-4 focus:outline-none">
          <CloseTab detail={detail} busy={busy} act={act} onClosed={() => router.refresh()} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type Act = <T = unknown>(key: string, body: Record<string, unknown>, okMessage?: string) => Promise<T | null>;

/* ---------------- inventory ---------------- */

function InventoryTab({ detail, users, closed, busy, act, onNote }: { detail: HandoverDetail; users: UserOpt[]; closed: boolean; busy: string | null; act: Act; onNote: (itemId: string, note: string) => Promise<void> }) {
  const t = useTranslations("handover.admin");
  const th = useTranslations("handover");
  const locale = useLocale();
  const [add, setAdd] = React.useState({ title: "", category: "tacit_topic" as ItemCategory, note: "" });
  const undecided = detail.items.filter((i) => i.inScope && !i.recipientKind && i.status !== "not_needed").length;

  const controls = (item: ItemView) => (
    <>
      <input
        type="checkbox"
        className="size-4 cursor-pointer accent-navy-700 disabled:cursor-default"
        checked={item.inScope}
        disabled={closed}
        onChange={(e) => act(`scope-${item.id}`, { action: "scope", itemId: item.id, inScope: e.target.checked })}
        aria-label={t("scopeFor", { title: item.title })}
        data-testid="scope-tick"
      />
      <NativeSelect
        value={item.recipientKind === "system" ? "system" : item.recipientKind === "person" && item.recipient ? item.recipient.id : ""}
        disabled={closed || !item.inScope}
        onChange={(e) => {
          const v = e.target.value;
          act(`recipient-${item.id}`, { action: "set_recipient", itemId: item.id, recipientKind: v === "" ? null : v === "system" ? "system" : "person", recipientUserId: v === "" || v === "system" ? null : v });
        }}
        className="h-8 w-48 text-xs"
        aria-label={t("recipientFor", { title: item.title })}
        data-testid="recipient-select"
      >
        <option value="">{th("recipientKinds.undecided")}</option>
        <option value="system">{th("recipientKinds.system")}</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {bi(locale, u.nameEn, u.nameAr)}
          </option>
        ))}
      </NativeSelect>
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      {!closed ? (
        <div className="card flex flex-wrap items-center gap-2 p-4" data-testid="inventory-toolbar">
          <span className="text-sm text-ink-600 tnum">{t("undecided", { count: undecided })}</span>
          {detail.defaultRecipient ? (
            <Button size="sm" variant="secondary" loading={busy === "bulk-person"} disabled={!undecided} onClick={() => act("bulk-person", { action: "bulk_recipient", recipientKind: "person", recipientUserId: detail.defaultRecipient!.id }, t("bulkDone"))} data-testid="bulk-person">
              <UserCheck /> {t("bulkToDefault", { name: bi(locale, detail.defaultRecipient.nameEn, detail.defaultRecipient.nameAr) })}
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" loading={busy === "bulk-system"} disabled={!undecided} onClick={() => act("bulk-system", { action: "bulk_recipient", recipientKind: "system" }, t("bulkDone"))} data-testid="bulk-system">
            <Database /> {t("bulkToSystem")}
          </Button>
        </div>
      ) : null}

      <Checklist categories={detail.categories} canEditNotes={!closed} onSaveNote={onNote} renderControls={closed ? undefined : controls} showRecipient={closed} showUnderstood />

      {!closed ? (
        <section className="card p-4" data-testid="admin-add-item">
          <h3 className="font-display text-base text-ink-900">{t("addItemTitle")}</h3>
          <p className="mb-3 text-xs text-ink-600">{t("addItemHint")}</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto]">
            <div>
              <Label htmlFor="admin-add-title">{t("addItemLabel")}</Label>
              <Input id="admin-add-title" value={add.title} onChange={(e) => setAdd({ ...add, title: e.target.value })} data-testid="admin-add-title" />
            </div>
            <div>
              <Label htmlFor="admin-add-category">{t("addItemCategory")}</Label>
              <NativeSelect id="admin-add-category" value={add.category} onChange={(e) => setAdd({ ...add, category: e.target.value as ItemCategory })} data-testid="admin-add-category">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {th(`categories.${c}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex items-end gap-2">
              <Button loading={busy === "add"} disabled={!add.title.trim()} onClick={async () => { const ok = await act("add", { action: "add_item", title: add.title, category: add.category, note: add.note || null }, t("added")); if (ok) setAdd({ title: "", category: add.category, note: "" }); }} data-testid="admin-add-submit">
                <Plus /> {t("addItem")}
              </Button>
              <Button variant="aqua" loading={busy === "add-topic"} disabled={!add.title.trim()} onClick={async () => { const ok = await act("add-topic", { action: "add_item", title: add.title, category: "tacit_topic", note: add.note || null }, t("added")); if (ok) setAdd({ title: "", category: add.category, note: "" }); }} data-testid="admin-add-topic">
                <Sparkles /> {t("addTacitTopic")}
              </Button>
            </div>
            <div className="sm:col-span-3">
              <Label htmlFor="admin-add-note">{th("checklist.note")}</Label>
              <Textarea id="admin-add-note" rows={2} dir="auto" value={add.note} onChange={(e) => setAdd({ ...add, note: e.target.value })} />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

/* ---------------- filing ---------------- */

function FilingTab({ detail, closed, busy, act }: { detail: HandoverDetail; closed: boolean; busy: string | null; act: Act }) {
  const t = useTranslations("handover.admin.filing");
  const th = useTranslations("handover");
  const locale = useLocale();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const items = detail.filing.items;
  const proposedIds = items.filter((i) => i.filingStatus === "proposed").map((i) => i.id);

  if (!items.length) return <EmptyState icon={<Database />} title={t("empty")} hint={t("emptyHint")} />;

  return (
    <div className="flex flex-col gap-4" data-testid="filing-report">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        {(["pending", "proposed", "approved", "applied"] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-sm">
            <FilingChip status={k === "pending" ? "none" : k} />
            <span className="font-semibold tnum">{detail.filing[k]}</span>
          </span>
        ))}
        {!closed ? (
          <span className="ms-auto flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" loading={busy === "propose-all"} disabled={!detail.filing.pending} onClick={() => act("propose-all", { action: "propose_filing" }, t("proposedToast"))} data-testid="propose-all">
              <Sparkles /> {t("proposeAll")}
            </Button>
            <Button size="sm" variant="secondary" loading={busy === "approve"} disabled={!selected.size} onClick={async () => { await act("approve", { action: "approve_filing", itemIds: [...selected] }, t("approvedToast")); setSelected(new Set()); }} data-testid="approve-selected">
              <Check /> {t("approveSelected", { count: selected.size })}
            </Button>
            <Button size="sm" loading={busy === "apply"} disabled={!detail.filing.approved} onClick={() => act("apply", { action: "apply_filing" }, t("appliedToast"))} data-testid="apply-filing">
              <Database /> {t("apply")}
            </Button>
          </span>
        ) : null}
      </div>
      {proposedIds.length && !closed ? (
        <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-600">
          <input type="checkbox" className="size-4 accent-navy-700" checked={proposedIds.every((id) => selected.has(id))} onChange={(e) => setSelected(e.target.checked ? new Set(proposedIds) : new Set())} data-testid="select-all-proposed" />
          {t("selectAllProposed", { count: proposedIds.length })}
        </label>
      ) : null}
      <div className="card divide-y divide-mist-100" role="table" aria-label={t("title")}>
        <div role="row" className="hidden grid-cols-[28px_minmax(180px,1.3fr)_minmax(160px,1fr)_minmax(140px,0.8fr)_minmax(200px,1.4fr)_110px] gap-3 px-4 py-2 text-[11px] font-semibold uppercase text-ink-400 md:grid">
          {/* the cell must exist in the grid; only its label is hidden, or
              every header shifts one column to the start */}
          <span role="columnheader">
            <span className="sr-only">{t("select")}</span>
          </span>
          <span role="columnheader">{t("columns.item")}</span>
          <span role="columnheader">{t("columns.location")}</span>
          <span role="columnheader">{t("columns.custodian")}</span>
          <span role="columnheader">{t("columns.rationale")}</span>
          <span role="columnheader">{t("columns.status")}</span>
        </div>
        {items.map((i) => {
          const p = i.filingProposal;
          return (
            <div key={i.id} role="row" className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-[28px_minmax(180px,1.3fr)_minmax(160px,1fr)_minmax(140px,0.8fr)_minmax(200px,1.4fr)_110px] md:items-center md:gap-3" data-testid="filing-row" data-filing={i.filingStatus}>
              <span role="cell">
                {i.filingStatus === "proposed" && !closed ? (
                  <input type="checkbox" className="size-4 cursor-pointer accent-navy-700" checked={selected.has(i.id)} onChange={(e) => { const n = new Set(selected); if (e.target.checked) n.add(i.id); else n.delete(i.id); setSelected(n); }} aria-label={t("selectFor", { title: i.title })} data-testid="filing-select" />
                ) : null}
              </span>
              <span role="cell" className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink-900">{i.title}</span>
                <span className="block text-xs text-ink-600">{th(`categories.${i.category}`)}</span>
              </span>
              <span role="cell" className="text-xs text-ink-900">
                {p ? (
                  <>
                    <span className="block font-medium">{t(`modules.${p.location.module}`)}</span>
                    <span className="block text-ink-600">{[bi(locale, p.location.unitNameEn ?? "", p.location.unitNameAr ?? ""), p.location.shelf, p.location.category].filter(Boolean).join(" · ")}</span>
                  </>
                ) : !closed ? (
                  <Button size="sm" variant="ghost" loading={busy === `propose-${i.id}`} onClick={() => act(`propose-${i.id}`, { action: "propose_filing", itemId: i.id })} data-testid="propose-one">
                    <Sparkles /> {t("propose")}
                  </Button>
                ) : (
                  <span className="text-ink-400">-</span>
                )}
              </span>
              <span role="cell" className="text-xs text-ink-900">{p?.custodianNameEn ? bi(locale, p.custodianNameEn, p.custodianNameAr ?? p.custodianNameEn) : "-"}</span>
              <span role="cell" className="text-xs leading-relaxed text-ink-600" dir="auto">
                {p ? bi(locale, p.rationaleEn, p.rationaleAr) : t("noProposal")}
                {p ? <span className="ms-1 text-[10px] text-ink-400">{p.live ? t("byAi") : t("byRule")}</span> : null}
              </span>
              <span role="cell">
                <FilingChip status={i.filingStatus} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- interviews ---------------- */

function InterviewsTab({ detail, closed, onChange }: { detail: HandoverDetail; closed: boolean; onChange: () => void }) {
  const t = useTranslations("handover.admin");
  const th = useTranslations("handover.interview");
  const locale = useLocale();
  const [open, setOpen] = React.useState<string | null>(null);
  const questionText = (e: { en?: string; ar?: string; text: string }) => (locale === "ar" ? e.ar ?? e.text : e.en ?? e.text);
  return (
    <div className="flex flex-col gap-4">
      {detail.personKind === "external" && !closed ? (
        <div className="rounded-xl border border-teal-100 bg-teal-100/40 px-4 py-3 text-sm text-ink-900">{t("interviewOnBehalf")}</div>
      ) : null}
      {detail.personKind === "external" ? (
        <InterviewPanel mode={{ kind: "user", handoverId: detail.id }} topics={detail.topics} interviews={detail.interviews} required={detail.interviewRequired} readOnly={closed} onChange={onChange} />
      ) : null}
      {!detail.interviews.length ? (
        detail.personKind === "external" ? null : <EmptyState title={th("noneYet")} hint={th("noneYetHint")} />
      ) : (
        <div className="card divide-y divide-mist-100" data-testid="admin-interviews">
          {detail.interviews.map((iv: InterviewView) => (
            <div key={iv.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-900">{iv.topic}</span>
                  <span className="block text-xs text-ink-600 tnum">{th("answersCount", { count: iv.answers })} · {formatDate(iv.updatedAt, locale)}</span>
                </span>
                {iv.insightLessonId ? (
                  <Link href={`/lessons?lesson=${iv.insightLessonId}` as never} className="link-draw text-xs font-medium text-navy-700">
                    {th("openInsight")}
                  </Link>
                ) : null}
                <Chip tone={iv.status === "complete" ? "ok" : iv.status === "in_progress" ? "teal" : "mist"}>{th(`state.${iv.status}` as never)}</Chip>
                <button type="button" onClick={() => setOpen(open === iv.id ? null : iv.id)} className="cursor-pointer text-xs font-medium text-ink-600 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-aqua-500" aria-expanded={open === iv.id} data-testid="admin-transcript-toggle">
                  {th("transcript")}
                </button>
              </div>
              {open === iv.id && iv.transcript ? (
                <ol className="mt-3 flex flex-col gap-1.5" data-testid="admin-transcript">
                  {iv.transcript.map((e, i) => (
                    <li key={i} className={cn("max-w-[92%] rounded-lg px-3 py-2 text-sm leading-relaxed", e.role === "ai" ? "bg-mist-50 text-ink-900" : "ms-auto bg-navy-100/60 text-navy-900")} dir="auto">
                      {e.role === "ai" ? questionText(e) : e.text}
                    </li>
                  ))}
                </ol>
              ) : null}
              {iv.structured ? (
                <p className="mt-2 text-xs leading-relaxed text-ink-600" dir="auto">
                  {bi(locale, iv.structured.summaryEn, iv.structured.summaryAr)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- learning paths ---------------- */

function PathsTab({ detail, closed, busy, act }: { detail: HandoverDetail; closed: boolean; busy: string | null; act: Act }) {
  const t = useTranslations("handover.admin.paths");
  const locale = useLocale();
  if (!detail.recipients.length) return <EmptyState icon={<UserCheck />} title={t("empty")} hint={t("emptyHint")} />;
  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="admin-paths">
      {detail.recipients.map((r) => {
        const pct = r.path?.progress.pct ?? 0;
        return (
          <div key={r.user.id} className="card flex flex-col gap-3 p-5" data-testid="admin-path" data-signed={r.path?.signedOffAt ? "1" : "0"}>
            <div className="flex items-center gap-3">
              <Avatar name={r.user.nameEn} color={r.user.avatarColor} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink-900">{bi(locale, r.user.nameEn, r.user.nameAr)}</p>
                <p className="text-xs text-ink-600 tnum">{t("itemsUnderstood", { understood: r.understood, items: r.items })}</p>
              </div>
              <ProgressRing value={pct / 100} size={48} stroke={5} color={pct === 100 ? "var(--color-ok)" : "var(--color-navy-700)"}>
                <span className="text-[11px] font-semibold text-ink-900 tnum">{pct}%</span>
              </ProgressRing>
            </div>
            {r.path ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {r.path.signedOffAt ? (
                    <Chip tone="ok">
                      <CheckCircle2 className="size-3" aria-hidden /> {t("signedOff", { date: formatDate(r.path.signedOffAt, locale) })}
                    </Chip>
                  ) : (
                    <Chip tone="mist">{t("notSigned")}</Chip>
                  )}
                  <span className="text-xs text-ink-600 tnum">{t("modules", { count: r.path.modules.length })}</span>
                </div>
                <ul className="flex flex-col gap-1">
                  {r.path.modules.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 text-sm text-ink-900">
                      <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full", m.understoodAt ? "bg-ok text-white" : "border border-mist-300")} aria-hidden>
                        {m.understoodAt ? <Check className="size-3" /> : null}
                      </span>
                      <span className="truncate">{bi(locale, m.topic, m.topicAr)}</span>
                      {m.episodeId ? <span className="text-[10px] text-ink-400">{t("episode")}</span> : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-ink-600">{t("noPath")}</p>
            )}
            {!closed ? (
              <div className="mt-auto flex items-center gap-2">
                <Button size="sm" variant={r.path ? "secondary" : "primary"} loading={busy === `path-${r.user.id}`} onClick={() => act(`path-${r.user.id}`, { action: "build_path", recipientUserId: r.user.id }, t("built"))} data-testid="build-path">
                  {r.path ? <RefreshCw /> : <Sparkles />} {r.path ? t("rebuild") : t("build")}
                </Button>
                <Link href={`/handover/${detail.id}` as never} className="text-xs font-medium text-ink-600 hover:text-ink-900">
                  {t("openAsRecipient")}
                </Link>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- access link ---------------- */

function AccessTab({ detail, closed, busy, act }: { detail: HandoverDetail; closed: boolean; busy: string | null; act: Act }) {
  const t = useTranslations("handover.admin.access");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const [link, setLink] = React.useState<{ url: string; expiresAt: string } | null>(null);
  const status = detail.access.revokedAt ? "revoked" : detail.access.active ? "active" : detail.access.created ? "expired" : "none";

  async function create() {
    const res = await act<{ token: string; url: string; expiresAt: string }>("access", { action: "access_link" }, t("createdToast"));
    if (res) setLink({ url: `${window.location.origin}/${locale}${res.url}`, expiresAt: res.expiresAt });
  }

  return (
    <div className="card max-w-2xl p-5" data-testid="access-card">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600">
          <KeyRound className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg text-ink-900">{t("title")}</h3>
          <p className="mt-1 text-sm text-ink-600">{t("hint")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip tone={status === "active" ? "ok" : status === "revoked" ? "danger" : status === "expired" ? "warn" : "mist"} data-testid="access-status">
              {t(`status.${status}`)}
            </Chip>
            {detail.access.expiresAt ? (
              // the link dies at the end of the last working day: show that
              // day, not the next one the UTC instant falls into locally
              <span className="text-xs text-ink-600 tnum">
                {t("expires")}: {formatDate(detail.access.expiresAt.slice(0, 10), locale)}
              </span>
            ) : null}
          </div>
          {link ? (
            <div className="mt-3 rounded-lg border border-aqua-300 bg-aqua-100/40 p-3" data-testid="access-link">
              <p className="text-xs font-medium text-ink-900">{t("shownOnce")}</p>
              <div className="mt-1 flex items-center gap-2">
                <Input readOnly value={link.url} dir="ltr" className="font-mono text-xs" aria-label={t("title")} data-testid="access-link-url" />
                <Button size="sm" variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(link.url); toast(t("copied"), "success"); } catch { toast(tc("error"), "error"); } }} aria-label={tc("copy")} data-testid="access-copy">
                  <Copy /> {tc("copy")}
                </Button>
              </div>
            </div>
          ) : null}
          {!closed && !detail.cutOffAt ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" loading={busy === "access"} onClick={create} data-testid="access-create">
                <KeyRound /> {status === "active" ? t("regenerate") : t("create")}
              </Button>
              {status === "active" ? (
                <Button size="sm" variant="danger" loading={busy === "revoke"} onClick={async () => { await act("revoke", { action: "revoke" }, t("revokedToast")); setLink(null); }} data-testid="access-revoke">
                  <XCircle /> {t("revoke")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------------- close ---------------- */

function CloseTab({ detail, busy, act, onClosed }: { detail: HandoverDetail; busy: string | null; act: Act; onClosed: () => void }) {
  const t = useTranslations("handover.admin.close");
  const th = useTranslations("handover");
  const locale = useLocale();
  const [override, setOverride] = React.useState("");
  const [confirmCut, setConfirmCut] = React.useState(false);
  const closed = detail.status === "complete";

  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="close-panel">
      <section className="card p-5">
        <h3 className="font-display text-lg text-ink-900">{t("readinessTitle")}</h3>
        <ul className="mt-3 flex flex-col gap-2" data-testid="readiness-checks">
          {detail.readiness.checks.map((c) => (
            <li key={c.code} className="flex items-center gap-3 text-sm" data-check={c.code} data-ok={c.ok ? "1" : "0"}>
              {c.ok ? <CheckCircle2 className="size-4 shrink-0 text-ok" aria-hidden /> : <XCircle className="size-4 shrink-0 text-danger" aria-hidden />}
              <span className="min-w-0 flex-1 text-ink-900">{t(`checks.${c.code}`)}</span>
              <span className="text-xs text-ink-600 tnum">{c.count}/{c.total}</span>
            </li>
          ))}
        </ul>
        {closed ? (
          <div className="mt-4 rounded-lg bg-ok-light/60 px-3 py-2 text-sm text-ink-900" data-testid="closed-line">
            <CheckCircle2 className="me-1 inline size-4 text-ok" aria-hidden /> {t("closedOn", { date: formatDate(detail.completedAt ?? "", locale) })}
            {detail.overrideReason ? (
              <p className="mt-1 text-xs text-ink-600">
                <AlertTriangle className="me-1 inline size-3.5 text-warn" aria-hidden /> {t("overrideLogged", { name: detail.overrideBy ? bi(locale, detail.overrideBy.nameEn, detail.overrideBy.nameAr) : "" })}: {detail.overrideReason}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-4">
            {!detail.readiness.ok ? (
              <div>
                <Label htmlFor="override-reason">{t("overrideLabel")}</Label>
                <Textarea id="override-reason" rows={2} dir="auto" value={override} onChange={(e) => setOverride(e.target.value)} placeholder={t("overridePlaceholder")} data-testid="override-reason" />
                <p className="mt-1 text-[11px] text-ink-400">{t("overrideHint")}</p>
              </div>
            ) : (
              <p className="text-sm text-ink-600">{t("readyHint")}</p>
            )}
            <div className="mt-3">
              <Button loading={busy === "close"} disabled={!detail.readiness.ok && override.trim().length < 3} onClick={async () => { const r = await act("close", { action: "close", override: override.trim() || null }, t("closedToast")); if (r) onClosed(); }} data-testid="close-button">
                <Check /> {detail.readiness.ok ? t("close") : t("closeWithOverride")}
              </Button>
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-4">
        <section className="card p-5" data-testid="cut-off-card">
          <h3 className="flex items-center gap-2 font-display text-lg text-ink-900">
            <Lock className="size-4 text-navy-700" aria-hidden /> {t("cutOffTitle")}
          </h3>
          <p className="mt-1 text-sm text-ink-600">{detail.personKind === "external" ? t("cutOffHintExternal") : t("cutOffHintEmployee")}</p>
          {detail.cutOffAt ? (
            <p className="mt-3 text-sm text-ink-900" data-testid="cut-off-done">
              <Lock className="me-1 inline size-4 text-danger" aria-hidden /> {t("cutOffDone", { date: formatDate(detail.cutOffAt, locale) })}
            </p>
          ) : confirmCut ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-danger-light/60 p-3">
              <span className="text-sm text-ink-900">{t("cutOffConfirm")}</span>
              <Button size="sm" variant="danger" loading={busy === "cut_off"} onClick={async () => { await act("cut_off", { action: "cut_off" }, t("cutOffToast")); setConfirmCut(false); }} data-testid="cut-off-confirm">
                {t("cutOffButton")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmCut(false)}>
                {th("cancelAction")}
              </Button>
            </div>
          ) : (
            <div className="mt-3">
              <Button variant="secondary" onClick={() => setConfirmCut(true)} data-testid="cut-off-button">
                <Lock /> {t("cutOffButton")}
              </Button>
            </div>
          )}
        </section>

        <section className="card p-5" data-testid="report-card">
          <h3 className="flex items-center gap-2 font-display text-lg text-ink-900">
            <FileText className="size-4 text-navy-700" aria-hidden /> {t("reportTitle")}
          </h3>
          {detail.reportDocumentId ? (
            <div className="mt-2 flex flex-col gap-2 text-sm">
              <Link href={`/vault/${detail.reportDocumentId}` as never} className="link-draw font-medium text-navy-700" data-testid="report-vault-link">
                {t("openInVault")}
              </Link>
              <div className="flex flex-wrap gap-2">
                {(["en", "ar"] as const).map((lang) => (
                  <a key={lang} href={`/api/v1/handover/${detail.id}/report?lang=${lang}`} className="inline-flex items-center gap-1.5 rounded-lg border border-mist-300 px-3 py-1.5 text-xs font-medium text-ink-900 transition-colors hover:border-navy-300 hover:text-navy-700 focus-visible:outline-2 focus-visible:outline-aqua-500" data-testid={`report-download-${lang}`}>
                    <Download className="size-3.5" aria-hidden /> {t(`download.${lang}`)}
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm text-ink-600">{closed ? t("reportMissing") : t("reportHint")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
