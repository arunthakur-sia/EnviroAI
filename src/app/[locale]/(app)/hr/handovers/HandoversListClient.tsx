"use client";
// CR08 6.1: the HR handover list: kind chips, the person, the recipients,
// the two progress bars, due and last working day, filters, and Start.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, CircleDashed, Plus, Users } from "lucide-react";
import { Avatar, Button, Chip, EmptyState, NativeSelect } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { bi, cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { HandoverListRow } from "@/server/services/handover";
import { Countdown, KindChip, ProgressBar, StatusChip } from "../../handover/_components/bits";
import { StartHandoverDialog } from "./StartHandoverDialog";

const KINDS = ["leaving", "transferring", "long_leave", "engagement_ending"] as const;
const STATUSES = ["open", "in_progress", "overdue", "complete"] as const;

export function HandoversListClient({ rows, scopeAll }: { rows: HandoverListRow[]; scopeAll: boolean }) {
  const t = useTranslations("handover.list");
  const th = useTranslations("handover");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [kind, setKind] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [unit, setUnit] = React.useState("all");
  const [open, setOpen] = React.useState(false);

  const units = [...new Map(rows.filter((r) => r.person.departmentCode).map((r) => [r.person.departmentCode!, r.person])).values()];
  const filtered = rows.filter(
    (r) => (kind === "all" || r.kind === kind) && (status === "all" || r.status === status) && (unit === "all" || r.person.departmentCode === unit || (unit === "external" && r.personKind === "external"))
  );
  const openCount = rows.filter((r) => r.status !== "complete").length;

  return (
    <div data-testid="hr-handovers">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="me-auto">
          <h2 className="font-display text-xl text-ink-900">{t("title")}</h2>
          <p className="text-xs text-ink-600 tnum">{t("counts", { open: openCount, total: rows.length })}</p>
        </div>
        <NativeSelect value={kind} onChange={(e) => setKind(e.target.value)} className="w-auto" aria-label={t("filterKind")} data-testid="filter-kind">
          <option value="all">{t("allKinds")}</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {th(`kinds.${k}`)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto" aria-label={t("filterStatus")} data-testid="filter-status">
          <option value="all">{t("allStatuses")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {th(`status.${s}`)}
            </option>
          ))}
        </NativeSelect>
        {scopeAll ? (
          <NativeSelect value={unit} onChange={(e) => setUnit(e.target.value)} className="w-auto" aria-label={t("filterUnit")} data-testid="filter-unit">
            <option value="all">{t("allUnits")}</option>
            {units.map((p) => (
              <option key={p.departmentCode!} value={p.departmentCode!}>
                {bi(locale, p.departmentNameEn ?? "", p.departmentNameAr ?? "")}
              </option>
            ))}
            <option value="external">{th("personKinds.external")}</option>
          </NativeSelect>
        ) : null}
        <Button onClick={() => setOpen(true)} data-testid="start-handover">
          <Plus /> {t("start")}
        </Button>
      </div>

      {!filtered.length ? (
        <EmptyState icon={<Users />} title={rows.length ? t("noMatch") : t("empty")} hint={rows.length ? t("noMatchHint") : t("emptyHint")} action={rows.length ? null : <Button onClick={() => setOpen(true)}>{t("start")}</Button>} />
      ) : (
        <div className="card divide-y divide-sand-100" role="table" aria-label={t("title")} data-testid="handover-table">
          <div role="row" className="hidden grid-cols-[minmax(220px,1.4fr)_minmax(150px,1fr)_minmax(200px,1.2fr)_minmax(150px,1fr)_120px] gap-4 px-4 py-2 text-[11px] font-semibold uppercase text-ink-400 md:grid">
            <span role="columnheader">{t("columns.person")}</span>
            <span role="columnheader">{t("columns.recipients")}</span>
            <span role="columnheader">{t("columns.progress")}</span>
            <span role="columnheader">{t("columns.dates")}</span>
            <span role="columnheader">{t("columns.status")}</span>
          </div>
          {filtered.map((h) => (
            <Link
              key={h.id}
              href={`/hr/handovers/${h.id}` as never}
              role="row"
              className="grid grid-cols-1 gap-3 px-4 py-3 transition-colors hover:bg-maroon-50/50 focus-visible:outline-2 focus-visible:outline-gold-500 md:grid-cols-[minmax(220px,1.4fr)_minmax(150px,1fr)_minmax(200px,1.2fr)_minmax(150px,1fr)_120px] md:items-center md:gap-4"
              data-testid="handover-row"
              data-kind={h.kind}
            >
              <span role="cell" className="flex min-w-0 items-center gap-3">
                <Avatar name={h.person.nameEn} color={h.person.avatarColor} size={36} />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink-900">{bi(locale, h.person.nameEn, h.person.nameAr)}</span>
                    <KindChip kind={h.kind} />
                    {h.illustrative ? <Chip tone="sand">{tc("illustrative")}</Chip> : null}
                  </span>
                  <span className="block truncate text-xs text-ink-600">
                    {h.personKind === "external" ? bi(locale, h.person.organisationEn ?? "", h.person.organisationAr ?? "") || th("personKinds.external") : bi(locale, h.person.departmentNameEn ?? "", h.person.departmentNameAr ?? "")}
                  </span>
                </span>
              </span>
              <span role="cell" className="flex items-center gap-1.5 text-xs text-ink-600">
                {h.recipients.length ? (
                  <>
                    <span className="flex -space-x-1.5 rtl:space-x-reverse">
                      {h.recipients.slice(0, 3).map((r) => (
                        <Avatar key={r.id} name={r.nameEn} color={r.avatarColor} size={24} className="ring-2 ring-white" />
                      ))}
                    </span>
                    <span className="truncate">{h.recipients.length === 1 ? bi(locale, h.recipients[0].nameEn, h.recipients[0].nameAr) : t("recipientsCount", { count: h.recipients.length })}</span>
                  </>
                ) : (
                  <Chip tone="gulf">{th("recipientKinds.system")}</Chip>
                )}
              </span>
              <span role="cell" className="flex flex-col gap-1.5">
                <ProgressBar value={h.items.pct} label={th("progress.items")} detail={`${h.items.done}/${h.items.total}`} />
                <ProgressBar value={h.interviews.pct} label={th("progress.interviews")} detail={`${h.interviews.complete}/${h.interviews.total}`} tone="gulf" />
              </span>
              <span role="cell" className="flex flex-col gap-0.5 text-xs text-ink-600">
                <Countdown days={h.daysToLastWorkingDay} lastWorkingDay={h.lastWorkingDay} compact />
                {h.dueDate ? (
                  <span className="tnum">
                    {th("dueDate")}: {formatDate(h.dueDate, locale)}
                  </span>
                ) : null}
              </span>
              <span role="cell" className="flex items-center gap-2">
                <StatusChip status={h.status} />
                {h.status !== "complete" ? (
                  h.readiness ? <CheckCircle2 className="size-4 text-ok" aria-label={t("ready")} /> : <CircleDashed className={cn("size-4 text-ink-400")} aria-label={t("notReady")} />
                ) : null}
              </span>
            </Link>
          ))}
        </div>
      )}
      <StartHandoverDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
