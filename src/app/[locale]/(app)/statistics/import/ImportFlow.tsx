"use client";
// Import flow: choose indicator, drop a csv/xlsx, review the AI mapping proposal
// and validation, confirm. Values land as provisional.
import * as React from "react";
import { useDropzone } from "react-dropzone";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { FileSpreadsheet, CircleAlert, Check } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Button, NativeSelect, Label, Chip } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

type Preview = {
  columns: string[];
  rowCount: number;
  mapping: {
    period_column: string;
    value_column: string;
    period_format: string;
    confidence: number;
    warnings: string[];
  };
  preview: { period: string | null; value: number | null; raw: string[] }[];
  allRows: string[][];
};

export function ImportFlow({
  indicators,
}: {
  indicators: { id: string; nameEn: string; nameAr: string; unit: string | null }[];
}) {
  const t = useTranslations("import");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [indicatorId, setIndicatorId] = React.useState("");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  const onDrop = React.useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setLoading(true);
      setPreview(null);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("indicatorId", indicatorId);
        const res = await fetch("/api/v1/indicators/import", { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setPreview(json.data);
      } catch {
        toast(t("parseFailed"), "error");
      } finally {
        setLoading(false);
      }
    },
    [indicatorId, t, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: !indicatorId,
  });

  function remapPreview(periodCol: string, valueCol: string) {
    if (!preview) return;
    const pIdx = preview.columns.indexOf(periodCol);
    const vIdx = preview.columns.indexOf(valueCol);
    const normalize = (raw: string): string | null => {
      const s = raw.trim();
      if (/^\d{4}$/.test(s)) return s;
      if (/^\d{4}-\d{2}$/.test(s)) return s;
      if (/^\d{4}-Q[1-4]$/i.test(s)) return s.toUpperCase();
      const q = /^Q([1-4])[\s-]*(\d{4})$/i.exec(s);
      if (q) return `${q[2]}-Q${q[1]}`;
      const ymd = /^(\d{4})-(\d{2})-\d{2}/.exec(s);
      if (ymd) return `${ymd[1]}-${ymd[2]}`;
      return null;
    };
    setPreview({
      ...preview,
      mapping: { ...preview.mapping, period_column: periodCol, value_column: valueCol },
      preview: preview.allRows.slice(0, 60).map((r) => ({
        period: normalize(String(r[pIdx] ?? "")),
        value: (() => {
          const n = Number(String(r[vIdx] ?? "").replace(/,/g, ""));
          return Number.isNaN(n) ? null : n;
        })(),
        raw: r.slice(0, 6),
      })),
    });
  }

  async function confirm() {
    if (!preview || !indicatorId) return;
    const pIdx = preview.columns.indexOf(preview.mapping.period_column);
    const vIdx = preview.columns.indexOf(preview.mapping.value_column);
    const rows = preview.allRows
      .map((r) => {
        const s = String(r[pIdx] ?? "").trim();
        let period: string | null = null;
        if (/^\d{4}$/.test(s)) period = s;
        else if (/^\d{4}-\d{2}$/.test(s)) period = s;
        else if (/^\d{4}-Q[1-4]$/i.test(s)) period = s.toUpperCase();
        else {
          const q = /^Q([1-4])[\s-]*(\d{4})$/i.exec(s);
          if (q) period = `${q[2]}-Q${q[1]}`;
          const ymd = /^(\d{4})-(\d{2})-\d{2}/.exec(s);
          if (ymd) period = `${ymd[1]}-${ymd[2]}`;
        }
        const n = Number(String(r[vIdx] ?? "").replace(/,/g, ""));
        return period && !Number.isNaN(n) ? { period, value: n } : null;
      })
      .filter(Boolean) as { period: string; value: number }[];
    if (!rows.length) {
      toast(t("nothingToImport"), "error");
      return;
    }
    setConfirming(true);
    try {
      const res = await fetch("/api/v1/indicators/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ indicatorId, rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast(t("importedToast", { count: json.data.written }), "points");
      router.push(`/statistics/${indicatorId}` as never);
    } catch {
      toast(tc("error"), "error");
    } finally {
      setConfirming(false);
    }
  }

  const validRows = preview?.preview.filter((p) => p.period && p.value !== null).length ?? 0;

  return (
    <div className="mt-6 flex flex-col gap-5">
      <div>
        <Label>{t("chooseIndicator")}</Label>
        <NativeSelect value={indicatorId} onChange={(e) => setIndicatorId(e.target.value)}>
          <option value="">{t("chooseIndicatorPlaceholder")}</option>
          {indicators.map((i) => (
            <option key={i.id} value={i.id}>
              {bi(locale, i.nameEn, i.nameAr)}
              {i.unit ? ` (${i.unit})` : ""}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-sand-300 bg-white px-6 py-10 text-center transition-colors",
          isDragActive && "border-maroon-500 bg-maroon-50",
          !indicatorId && "opacity-50"
        )}
      >
        <input {...getInputProps()} aria-label={t("dropLabel")} />
        <FileSpreadsheet className="size-8 text-gulf-600" />
        <p className="text-sm font-medium text-ink-900">
          {indicatorId ? t("dropTitle") : t("chooseFirst")}
        </p>
        <p className="text-xs text-ink-600">{t("dropHint")}</p>
      </div>

      {loading ? <p className="text-sm text-ink-600">{t("analysing")}</p> : null}

      {preview ? (
        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-ink-900">{t("mappingTitle")}</p>
            <Chip tone={preview.mapping.confidence >= 0.7 ? "ok" : "warn"}>
              {t("confidence", { pct: Math.round(preview.mapping.confidence * 100) })}
            </Chip>
            <span className="ms-auto text-xs text-ink-400 tnum">
              {t("rowCount", { count: preview.rowCount })}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t("periodColumn")}</Label>
              <NativeSelect
                value={preview.mapping.period_column}
                onChange={(e) => remapPreview(e.target.value, preview.mapping.value_column)}
              >
                {preview.columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>{t("valueColumn")}</Label>
              <NativeSelect
                value={preview.mapping.value_column}
                onChange={(e) => remapPreview(preview.mapping.period_column, e.target.value)}
              >
                {preview.columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          {preview.mapping.warnings.length ? (
            <div className="mt-3 space-y-1">
              {preview.mapping.warnings.map((w, i) => (
                <p key={i} className="flex items-center gap-1.5 text-xs text-warn">
                  <CircleAlert className="size-3.5" /> {w}
                </p>
              ))}
            </div>
          ) : null}

          <div className="mt-4 max-h-64 overflow-auto rounded-xl border border-sand-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-sand-50">
                <tr>
                  <th className="px-3 py-2 text-start text-xs font-semibold text-ink-600">{t("period")}</th>
                  <th className="px-3 py-2 text-end text-xs font-semibold text-ink-600">{t("value")}</th>
                  <th className="px-3 py-2 text-start text-xs font-semibold text-ink-600">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((p, i) => (
                  <tr key={i} className="border-t border-sand-100">
                    <td className="px-3 py-1.5 tnum">{p.period ?? "—"}</td>
                    <td className="px-3 py-1.5 text-end tnum">{p.value ?? "—"}</td>
                    <td className="px-3 py-1.5">
                      {p.period && p.value !== null ? (
                        <Check className="size-4 text-ok" />
                      ) : (
                        <span className="text-xs text-danger">{t("skipped")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-ink-600">{t("provisionalNote")}</p>
            <Button loading={confirming} onClick={confirm} disabled={validRows === 0}>
              {t("confirmCta", { count: validRows })}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
