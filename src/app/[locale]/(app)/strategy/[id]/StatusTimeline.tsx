"use client";
import { useLocale, useTranslations } from "next-intl";
import { bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Avatar, Chip, RagDot, EmptyState } from "@/components/ui/primitives";

type Update = {
  id: string;
  status: string;
  progressPct: number;
  summaryEn: string | null;
  summaryAr: string | null;
  risksJson: string | null;
  nextStepsJson: string | null;
  period: string | null;
  createdAt: string;
  authorNameEn: string;
  authorNameAr: string;
  authorColor: string;
};

export function StatusTimeline({ updates }: { updates: Update[] }) {
  const t = useTranslations("strategy");
  const tc = useTranslations("common");
  const locale = useLocale();

  if (!updates.length) {
    return <EmptyState title={t("noUpdates")} hint={t("noUpdatesHint")} />;
  }

  return (
    <ol className="relative ms-2 space-y-5 border-s-2 border-mist-200 ps-5">
      {updates.map((u) => {
        let risks: { text_en: string; text_ar?: string }[] = [];
        let steps: { text_en: string; text_ar?: string }[] = [];
        try {
          risks = JSON.parse(u.risksJson ?? "[]");
        } catch { /* skip */ }
        try {
          steps = JSON.parse(u.nextStepsJson ?? "[]");
        } catch { /* skip */ }
        return (
          <li key={u.id} className="relative">
            <span className="absolute -start-[27px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-mist-100">
              <RagDot status={u.status} />
            </span>
            <div className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Avatar name={u.authorNameEn} color={u.authorColor} size={24} />
                <span className="text-sm font-medium text-ink-900">
                  {bi(locale, u.authorNameEn, u.authorNameAr)}
                </span>
                <Chip tone="mist">{tc(`status.${u.status}` as never)}</Chip>
                <span className="text-xs text-ink-600 tnum">{u.progressPct}%</span>
                <span className="ms-auto text-xs text-ink-400 tnum">
                  {u.period ?? formatDate(u.createdAt, locale, { style: "short" })}
                </span>
              </div>
              {(u.summaryEn || u.summaryAr) ? (
                <p className="mt-2 text-sm leading-relaxed text-ink-900">
                  {bi(locale, u.summaryEn ?? "", u.summaryAr ?? "")}
                </p>
              ) : null}
              {risks.length ? (
                <div className="mt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-warn">
                    {t("risks")}
                  </p>
                  <ul className="mt-0.5 text-xs text-ink-600">
                    {risks.map((r, i) => (
                      <li key={i}>· {bi(locale, r.text_en, r.text_ar ?? "")}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {steps.length ? (
                <div className="mt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-600">
                    {t("nextSteps")}
                  </p>
                  <ul className="mt-0.5 text-xs text-ink-600">
                    {steps.map((s, i) => (
                      <li key={i}>· {bi(locale, s.text_en, s.text_ar ?? "")}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
