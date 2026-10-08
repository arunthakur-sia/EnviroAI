"use client";
// CR03 4.4.4: What changed in NES as a compact timeline: a vertical navy
// hairline with dots, each change one short line with the outcome chip and a
// delta or status change; hovering shows the full update card. The rows
// highlight when a lesson of their outcome is hovered elsewhere on the page.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Chip, RagDot } from "@/components/ui/primitives";
import { useConnections } from "./connections";

export type ChangedRow = {
  kind: "status" | "kpi";
  date: string;
  titleEn: string;
  titleAr: string;
  nodeCode: string | null;
  status: string | null;
  deltaEn: string | null;
  deltaAr: string | null;
  detailEn: string;
  detailAr: string;
  outcome: string | null; // taxonomy code
  outcomeCode: string | null; // O1..O7
};

export function ChangedTimeline({ rows }: { rows: ChangedRow[] }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const conn = useConnections();
  const hovered = conn?.hovered ?? null;

  return (
    <div className="bento-card flex h-full flex-col p-5" data-testid="what-changed">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink-600" style={{ fontFamily: "inherit" }}>
        {t("whatChanged")}
      </p>
      {rows.length ? (
        <ol className="relative flex flex-1 flex-col gap-3.5 border-s border-navy-100 ps-4">
          {rows.map((row, i) => {
            const lit = hovered !== null && row.outcome === hovered;
            return (
              <li
                key={i}
                className={cn(
                  "group/row relative rounded-lg px-2 py-1 transition-colors duration-300 -ms-2",
                  lit && "bg-navy-100/70"
                )}
                onMouseEnter={() => row.outcome && conn?.setHovered(row.outcome)}
                onMouseLeave={() => conn?.setHovered(null)}
              >
                <span
                  aria-hidden
                  className="absolute top-2.5 size-2 rounded-full bg-navy-700"
                  style={{ insetInlineStart: -21 }}
                />
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-snug text-ink-900">
                  {row.outcomeCode ? <Chip tone="navy">{row.outcomeCode}</Chip> : null}
                  <span className="min-w-0 flex-1 truncate">{bi(locale, row.titleEn, row.titleAr)}</span>
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-600">
                  {row.status ? <RagDot status={row.status} /> : null}
                  {row.deltaEn ? (
                    <span className="tnum">{bi(locale, row.deltaEn ?? "", row.deltaAr ?? "")}</span>
                  ) : null}
                  <span className="tnum">{formatDate(row.date, locale, { style: "short" })}</span>
                </p>
                {/* full update card on hover */}
                {(row.detailEn || row.detailAr) ? (
                  <span className="pointer-events-none invisible absolute start-4 top-full z-30 mt-1 w-80 opacity-0 transition-all duration-200 group-hover/row:visible group-hover/row:opacity-100">
                    <span className="card block p-3 text-xs leading-relaxed text-ink-600 shadow-[var(--shadow-pop)]">
                      <span className="mb-0.5 block font-medium text-ink-900">
                        {bi(locale, row.titleEn, row.titleAr)}
                      </span>
                      <span className="line-clamp-4 block">{bi(locale, row.detailEn, row.detailAr)}</span>
                    </span>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm leading-relaxed text-ink-600">{t("changedEmpty")}</p>
      )}
      <div className="mt-3 text-end">
        <Link
          href="/strategy"
          className="card-action link-draw inline-flex items-center gap-1 text-sm font-medium text-navy-700"
        >
          {t("seeAllChanges")} <ArrowRight className="size-3.5 flip-rtl" />
        </Link>
      </div>
    </div>
  );
}
