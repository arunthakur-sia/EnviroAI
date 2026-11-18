"use client";
// A generic ARIA grid table for an NCEC dataset's records (ui-plan.md s3.2,
// s6 P7). It renders exactly the columns the server sent: a locked column
// shows its name and a lock icon but never a value for any row, because
// projectRecord on the server never put one in the row data to begin with.
// A masked personal-data value shows the mask the server sent plus a
// disabled Reveal control (brief R6; ui-plan.md decision #10).
import { useLocale, useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { bi, cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { translateValue } from "@/server/ncec/vocab";
import { PERSONAL_MASK, type ColumnMeta, type RecordRowView } from "@/server/ncec/types";

function Cell({ locale, col, raw, t }: { locale: string; col: ColumnMeta; raw: unknown; t: ReturnType<typeof useTranslations> }) {
  if (col.locked || raw === undefined) return <Lock className="size-3.5 text-ink-300" aria-hidden />;
  if (raw === PERSONAL_MASK) {
    return (
      <span className="flex items-center gap-2">
        <span className="font-mono tracking-widest text-ink-400">{PERSONAL_MASK}</span>
        <button
          type="button"
          disabled
          title={t("common.notAvailableStep1")}
          className="cursor-not-allowed rounded border border-mist-300 px-1.5 py-0.5 text-[10px] font-medium text-ink-400"
        >
          {t("common.reveal")}
        </button>
      </span>
    );
  }
  if (typeof raw === "number") return <span className="tnum">{formatNumber(raw, locale, { decimals: raw % 1 === 0 ? 0 : 2 })}</span>;
  return <span>{translateValue(locale, String(raw))}</span>;
}

export function NcecTable({
  columns,
  rows,
  caption,
}: {
  columns: ColumnMeta[];
  rows: RecordRowView[];
  caption: string;
}) {
  const locale = useLocale();
  const t = useTranslations("ksaNcec");
  if (!columns.length) return <p className="text-sm text-ink-600">{t("dataset.noColumnsVisible")}</p>;
  const gridTemplate = `repeat(${columns.length}, minmax(7.5rem, 1fr))`;

  return (
    <div className="overflow-x-auto">
      <div role="table" aria-label={caption} data-testid="ncec-table" style={{ minWidth: `${columns.length * 9}rem` }}>
        <div role="rowgroup">
          <div role="row" className="grid text-xs font-semibold text-ink-600" style={{ gridTemplateColumns: gridTemplate }}>
            {columns.map((c) => (
              <div
                key={c.assetId}
                role="columnheader"
                className={cn("flex items-center gap-1 px-3 py-2 text-start", c.locked && "bg-mist-100 text-ink-400")}
              >
                <span className="truncate">{bi(locale, c.nameEn, c.nameAr) || c.assetId}</span>
                {c.locked ? <Lock className="size-3 shrink-0" aria-hidden /> : null}
              </div>
            ))}
          </div>
        </div>
        <div role="rowgroup">
          {rows.length === 0 ? (
            <div role="row">
              <div role="cell" className="px-3 py-6 text-sm text-ink-600">
                {t("common.noResults")}
              </div>
            </div>
          ) : (
            rows.map((r) => (
              <div
                role="row"
                key={r.recordId}
                className="grid border-t border-mist-100 text-sm"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                {columns.map((c) => (
                  <div key={c.assetId} role="cell" className={cn("px-3 py-2.5", c.locked && "bg-mist-50")}>
                    <Cell locale={locale} col={c} raw={r.values[c.assetId]} t={t} />
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
