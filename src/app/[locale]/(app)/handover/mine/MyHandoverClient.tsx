"use client";
// CR08 6.2: My Handover. The hero with the kind, the last working day
// countdown and the two progress bars; what is still required; the
// checklist by category with the required note per item; Add to handover;
// the capture interview per project or topic.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, CheckCircle2, ListChecks } from "lucide-react";
import { Chip } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { bi, cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { HandoverDetail } from "@/server/services/handover";
import { api, Countdown, Eyebrow, KindChip, ProgressBar, StatusChip, useRequiredLabels } from "../_components/bits";
import { Checklist } from "../_components/Checklist";
import { AddToHandoverPanel } from "../_components/AddToHandoverPanel";
import { InterviewPanel } from "../_components/InterviewPanel";

export function MyHandoverClient({ initial }: { initial: HandoverDetail }) {
  const t = useTranslations("handover");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const requiredLabel = useRequiredLabels();
  const [detail, setDetail] = React.useState(initial);

  const reload = React.useCallback(async () => {
    const res = await api<HandoverDetail>(`/api/v1/handover/${initial.id}`);
    if (res.ok && res.data) setDetail(res.data);
  }, [initial.id]);

  async function saveNote(itemId: string, note: string) {
    const res = await api(`/api/v1/handover/${detail.id}`, { method: "PATCH", body: JSON.stringify({ action: "note", itemId, note }) });
    if (!res.ok) {
      toast(tc("error"), "error");
      return;
    }
    toast(t("checklist.noteSaved"), "success");
    await reload();
  }

  const closed = detail.status === "complete";
  const illustrative = (detail.notes ?? "").startsWith("[Illustrative]");
  /* the administrator's duties (filing, paths) are not this person's work */
  const mineRequired = detail.required.filter((r) => ["decide_recipients", "write_notes", "complete_interview"].includes(r));

  return (
    <div className="flex flex-col gap-6" data-testid="my-handover">
      {/* hero */}
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-5 p-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <Eyebrow>{t("mine.eyebrow")}</Eyebrow>
            <h1 className="mt-1 font-display text-3xl text-ink-900">{t("mine.title")}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <KindChip kind={detail.kind} />
              <StatusChip status={detail.status} />
              {detail.interviewRequired ? <Chip tone="aqua">{t("interview.mandatory")}</Chip> : null}
              {illustrative ? <Chip tone="mist">{tc("illustrative")}</Chip> : null}
            </div>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-600">{closed ? t("mine.closedIntro") : t("mine.intro")}</p>
            {detail.reason ? <p className="mt-2 text-sm text-ink-900">{t("reason")}: {detail.reason}</p> : null}
          </div>
          <div className="w-full shrink-0 md:w-80">
            <div className="rounded-xl bg-mist-50 p-4">
              <Eyebrow>{t("lastWorkingDay")}</Eyebrow>
              <div className="mt-1">
                <Countdown days={detail.daysToLastWorkingDay} lastWorkingDay={detail.lastWorkingDay} />
              </div>
              {detail.dueDate ? (
                <p className="mt-1 text-xs text-ink-600 tnum">
                  {t("dueDate")}: {formatDate(detail.dueDate, locale)}
                </p>
              ) : null}
              <div className="mt-4 flex flex-col gap-3">
                <ProgressBar value={detail.progress.items.pct} label={t("progress.items")} detail={`${detail.progress.items.done}/${detail.progress.items.total}`} testId="progress-items" />
                <ProgressBar value={detail.progress.interviews.pct} label={t("progress.interviews")} detail={`${detail.progress.interviews.complete}/${detail.progress.interviews.total}`} tone="teal" testId="progress-interviews" />
              </div>
            </div>
          </div>
        </div>
        {/* still required: only what this person can act on, so the strip
            never says "still required" with nothing beside it */}
        <div className={cn("border-t border-mist-100 px-6 py-4", mineRequired.length ? "bg-aqua-100/40" : "bg-ok-light/40")} data-testid="still-required">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-900">
              {mineRequired.length ? <AlertCircle className="size-4 text-warn" aria-hidden /> : <CheckCircle2 className="size-4 text-ok" aria-hidden />}
              {mineRequired.length ? t("mine.stillRequired") : t("mine.nothingRequired")}
            </span>
            {mineRequired.map((code) => (
              <Chip key={code} tone="mist">
                <ListChecks className="size-3" aria-hidden /> {requiredLabel(code)}
              </Chip>
            ))}
            {detail.defaultRecipient ? (
              <span className="ms-auto text-xs text-ink-600">
                {t("defaultRecipient")}: <span className="font-medium text-ink-900">{bi(locale, detail.defaultRecipient.nameEn, detail.defaultRecipient.nameAr)}</span>
              </span>
            ) : null}
          </div>
        </div>
      </section>

      {/* checklist */}
      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl text-ink-900">{t("mine.checklistTitle")}</h2>
          <p className="text-xs text-ink-600">{t("mine.checklistHint")}</p>
        </div>
        <Checklist categories={detail.categories} canEditNotes={!closed} onSaveNote={saveNote} />
      </section>

      {!closed ? <AddToHandoverPanel handoverId={detail.id} onAdded={reload} /> : null}

      <InterviewPanel mode={{ kind: "user", handoverId: detail.id }} topics={detail.topics} interviews={detail.interviews} required={detail.interviewRequired} readOnly={closed} onChange={reload} />
    </div>
  );
}
