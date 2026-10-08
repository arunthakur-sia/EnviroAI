"use client";
// CR08 5: one published report in the cover gallery: the first page preview
// at 3:4 with a hover lift, the family and classification chips, the type as
// the eyebrow, the title, the period and the scope.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { bi, cn } from "@/lib/utils";
import { Chip, ClassificationChip } from "@/components/ui/primitives";
import type { ReportListItem } from "@/server/services/reports";
import { FAMILY_TONE, previewUrl } from "./shared";

export function useClassificationLabels(): [string, string, string, string] {
  const tc = useTranslations("common");
  return [tc("classification.1"), tc("classification.2"), tc("classification.3"), tc("classification.4")];
}

/** The designed stand-in when a report has no rendered previews yet. */
export function PlaceholderCover({ title, period, className }: { title: string; period: string; className?: string }) {
  return (
    <div className={cn("flex h-full w-full flex-col justify-between bg-navy-900 p-4 text-white", className)} aria-hidden>
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70 rtl:tracking-normal">EnviroAI</span>
      <span className="font-display text-lg leading-snug">{title}</span>
      <span className="font-display text-3xl text-aqua-300 tnum">{period}</span>
    </div>
  );
}

export function CoverCard({ report, index = 0 }: { report: ReportListItem; index?: number }) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const labels = useClassificationLabels();
  const [broken, setBroken] = React.useState(false);
  const title = bi(locale, report.titleEn, report.titleAr);
  const period = bi(locale, report.period.label.en, report.period.label.ar);
  const scope =
    report.scope.kind === "org" || report.scope.kind === "period"
      ? t(`scopeKinds.${report.scope.kind}`)
      : bi(locale, report.scope.label.en, report.scope.label.ar);
  const hasCover = report.previewCount > 0 && !broken;
  const familyLabel = t(`families.${report.family as "public" | "internal" | "custom"}`);

  return (
    <Link
      href={`/reports/${report.id}`}
      className="card card-hover group/cover flex flex-col overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
      data-testid="cover-card"
      data-report-id={report.id}
      data-family={report.family}
      data-type={report.typeCode}
      /* No aria-label here: a cover card shows the family, the type, the title,
         the period and the scope, and a label can only ever repeat one of them,
         which leaves the name and the visible text disagreeing. The card's own
         text is the name. */
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-navy-900">
        {hasCover ? (
          // the preview is a PNG served by the module's own API (private, per user)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl(report.id, 0, { thumb: true })}
            alt=""
            /* A cover is a full page render of about 370 kB. Loading fifteen of
               them at once cost the gallery its largest contentful paint, so
               only the first row arrives with the page and the rest on scroll. */
            loading={index < 6 ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : index < 6 ? "auto" : "low"}
            decoding="async"
            width={600}
            height={800}
            onError={() => setBroken(true)}
            className="h-full w-full object-cover object-top transition-transform duration-300 ease-[var(--ease-paper)] group-hover/cover:scale-[1.02]"
          />
        ) : (
          <PlaceholderCover title={title} period={period} />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* the family chip only when it says something the classification does not */}
          {familyLabel !== labels[Math.min(3, Math.max(0, report.classification - 1))] ? (
            <Chip tone={FAMILY_TONE[report.family] ?? "mist"}>{familyLabel}</Chip>
          ) : null}
          <ClassificationChip level={report.classification} labels={labels} />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">
          {bi(locale, report.typeNameEn, report.typeNameAr)}
        </p>
        <h3 className="line-clamp-2 font-display text-[15px] leading-snug text-ink-900">{title}</h3>
        <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-1 text-xs text-ink-600">
          <span className="tnum">{period}</span>
          <span aria-hidden className="text-ink-200">
            |
          </span>
          <span className="line-clamp-1">{scope}</span>
        </p>
      </div>
    </Link>
  );
}
