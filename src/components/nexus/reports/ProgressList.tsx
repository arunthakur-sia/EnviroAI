"use client";
// CR08 5: the per-section progress of a report build: a ring and a bar for
// the whole, one row per section (pending, writing, ready, edited, failed)
// and the last notes of the build's note stream. Polled by the report page.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Circle, Loader2, PenLine, X } from "lucide-react";
import { bi, cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { ProgressRing } from "@/components/ui/primitives";
import type { ReportSectionView } from "@/server/services/reports";
import type { ProgressState } from "@/server/reports/build";

function StatusIcon({ status }: { status: string }) {
  if (status === "generating") return <Loader2 className="size-4 animate-spin text-info" aria-hidden />;
  if (status === "ready") return <Check className="size-4 text-ok" aria-hidden />;
  if (status === "edited") return <PenLine className="size-4 text-warn" aria-hidden />;
  if (status === "failed") return <X className="size-4 text-danger" aria-hidden />;
  return <Circle className="size-3.5 text-ink-200" aria-hidden />;
}

function timeOf(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d);
}

export function ProgressList({
  sections,
  progress,
  failed = false,
  error,
}: {
  sections: ReportSectionView[];
  progress: ProgressState | null;
  /** the whole build failed (status failed) */
  failed?: boolean;
  error?: string | null;
}) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const total = progress?.total || sections.length || 1;
  const done = Math.min(total, progress?.done ?? sections.filter((s) => s.status === "ready" || s.status === "edited").length);
  const notes = progress?.notes ?? [];
  const stageName = (() => {
    const stage = progress?.stage;
    if (!stage) return null;
    const section = sections.find((s) => s.code === stage);
    if (section) return bi(locale, section.name.en, section.name.ar);
    return stage;
  })();

  return (
    <section
      className={cn("card p-5", failed && "border-danger/40")}
      data-testid="progress-list"
      data-stage={progress?.stage ?? ""}
      aria-live="polite"
      aria-busy={!failed}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg text-ink-900">{failed ? t("report.failedTitle") : t("report.generatingTitle")}</h2>
          <p className="mt-0.5 text-sm text-ink-600">{failed ? t("report.failedHint") : t("report.generatingHint")}</p>
          {!failed && stageName ? (
            <p className="mt-1.5 text-xs text-ink-600">
              <span className="text-ink-400">{t("hub.stage", { stage: stageName })}</span>
            </p>
          ) : null}
          {failed && error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
        </div>
        <ProgressRing value={done / total} size={52} color={failed ? "var(--color-danger)" : undefined}>
          <span className="text-[11px] font-semibold text-ink-900 tnum">
            {done}/{total}
          </span>
        </ProgressRing>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-mist-200" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div
          className={cn("h-full rounded-full transition-[width] duration-300 ease-[var(--ease-paper)]", failed ? "bg-danger" : "bg-navy-700")}
          style={{ width: `${Math.round((done / total) * 100)}%` }}
        />
      </div>
      <ol className="mt-4 grid grid-cols-1 gap-1 sm:grid-cols-2">
        {sections.map((s) => (
          <li
            key={s.code}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm",
              s.status === "generating" && "bg-info-light/60"
            )}
            data-testid="progress-section"
            data-section-code={s.code}
            data-section-status={s.status}
          >
            <StatusIcon status={s.status} />
            <span className="min-w-0 flex-1 truncate text-ink-900">{bi(locale, s.name.en, s.name.ar)}</span>
            <span className="shrink-0 text-[11px] text-ink-400">{t(`sectionStatus.${s.status as "pending" | "generating" | "ready" | "edited" | "failed"}`)}</span>
          </li>
        ))}
      </ol>
      {notes.length ? (
        <div className="mt-4 rounded-xl bg-mist-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">{t("report.notes")}</p>
          <ul className="mt-1.5 space-y-1 text-xs text-ink-600" data-testid="progress-notes">
            {notes.slice(-6).map((n, i) => (
              <li key={`${n.at}-${i}`} className="flex gap-2">
                <span className="shrink-0 text-ink-400 tnum" title={formatDate(n.at, locale)}>
                  {timeOf(n.at, locale)}
                </span>
                <span className="min-w-0">{bi(locale, n.en, n.ar)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
