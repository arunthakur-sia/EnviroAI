"use client";
// Chart with period selector and dimension breakdowns, AI narration, data table
// with CSV export, inline manual entry for contributors.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Sparkles, Download, Plus } from "lucide-react";
import { IndicatorChart } from "@/components/nexus/IndicatorChart";
import { Button, Chip, Input, NativeSelect, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn, bi } from "@/lib/utils";
import { formatNumber, formatPeriod } from "@/lib/format";

type ValueRow = {
  period: string;
  value: number;
  dimensionKey: string;
  status: string;
  note: string | null;
};

export function IndicatorDetailClient({
  indicator,
  values,
  dimensions,
  target,
  canEnter,
}: {
  indicator: {
    id: string;
    nameEn: string;
    nameAr: string;
    unit: string | null;
    decimals: number;
    direction: string;
    methodologyEn: string | null;
    methodologyAr: string | null;
  };
  values: ValueRow[];
  dimensions: { code: string; values: string[] }[];
  target: number | null;
  canEnter: boolean;
}) {
  const t = useTranslations("statistics");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();

  const totals = values.filter((v) => v.dimensionKey === "total");
  const [range, setRange] = React.useState<"all" | "24" | "12">("all");
  const [dimension, setDimension] = React.useState<string>("total");
  const [narration, setNarration] = React.useState<string | null>(null);
  const [narrating, setNarrating] = React.useState(false);
  const [showEntry, setShowEntry] = React.useState(false);
  const [newPeriod, setNewPeriod] = React.useState("");
  const [newValue, setNewValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const visibleTotals =
    range === "all" ? totals : totals.slice(-Number(range));

  // dimension breakdown: for the chosen dimension code, pick each distinct member's series
  const dimensionKeys = React.useMemo(() => {
    if (dimension === "total") return [];
    const keys = new Set(
      values
        .filter((v) => v.dimensionKey.startsWith(`${dimension}=`) || v.dimensionKey.includes(`${dimension}=`))
        .map((v) => v.dimensionKey)
    );
    return [...keys].slice(0, 6);
  }, [dimension, values]);

  const chartData = React.useMemo(() => {
    if (dimension === "total" || dimensionKeys.length === 0) {
      return visibleTotals.map((v) => ({ period: v.period, value: v.value }));
    }
    // one line per period; first two dimension members as value/compare
    const [a, b] = dimensionKeys;
    const byPeriod = new Map<string, { period: string; value: number | null; compare: number | null }>();
    for (const v of values) {
      if (v.dimensionKey !== a && v.dimensionKey !== b) continue;
      const row = byPeriod.get(v.period) ?? { period: v.period, value: null, compare: null };
      if (v.dimensionKey === a) row.value = v.value;
      else row.compare = v.value;
      byPeriod.set(v.period, row);
    }
    return [...byPeriod.values()].sort((x, y) => x.period.localeCompare(y.period));
  }, [dimension, dimensionKeys, values, visibleTotals]);

  const hasIllustrative = totals.some((v) => v.note?.includes("illustrative"));

  async function narrate() {
    setNarrating(true);
    try {
      const res = await fetch("/api/v1/ai/narrate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ indicatorId: indicator.id }),
      });
      const json = await res.json();
      setNarration(
        locale === "ar" ? json.data?.narration_ar : json.data?.narration_en
      );
    } finally {
      setNarrating(false);
    }
  }

  function exportCsv() {
    const rows = [["period", "dimension", "value", "status"]];
    for (const v of values) rows.push([v.period, v.dimensionKey, String(v.value), v.status]);
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${indicator.nameEn.replace(/\W+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function saveValue() {
    if (!newPeriod || !newValue) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/indicators/${indicator.id}/values`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ period: newPeriod, value: Number(newValue) }),
      });
      if (res.ok) {
        toast(t("valueSaved"), "success");
        window.location.reload();
      } else {
        toast(tc("error"), "error");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-0.5 rounded-xl bg-sand-100 p-1">
          {(["12", "24", "all"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs transition-colors cursor-pointer tnum",
                range === r ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
              )}
            >
              {r === "all" ? t("rangeAll") : t("rangeN", { count: Number(r) })}
            </button>
          ))}
        </div>
        {dimensions.length ? (
          <NativeSelect
            value={dimension}
            onChange={(e) => setDimension(e.target.value)}
            className="w-auto"
            aria-label={t("breakdown")}
          >
            <option value="total">{t("totalSeries")}</option>
            {dimensions.map((d) => (
              <option key={d.code} value={d.code}>
                {t(`dimensions.${d.code}` as never)}
              </option>
            ))}
          </NativeSelect>
        ) : null}
        {hasIllustrative ? <Chip tone="warn">{tc("illustrative")}</Chip> : null}
        <span className="ms-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={exportCsv}>
            <Download /> CSV
          </Button>
          {canEnter ? (
            <Button variant="secondary" size="sm" onClick={() => setShowEntry(!showEntry)}>
              <Plus /> {t("addValue")}
            </Button>
          ) : null}
        </span>
      </div>

      {showEntry ? (
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl bg-sand-50 p-3">
          <div>
            <label className="mb-1 block text-xs text-ink-600">{t("period")}</label>
            <Input
              value={newPeriod}
              onChange={(e) => setNewPeriod(e.target.value)}
              placeholder="2026-08"
              className="w-32"
              dir="ltr"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-600">{t("value")}</label>
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              type="number"
              className="w-36"
              dir="ltr"
            />
          </div>
          <Button size="sm" loading={saving} onClick={saveValue}>
            {tc("save")}
          </Button>
          <p className="w-full text-[11px] text-ink-400">{t("provisionalHint")}</p>
        </div>
      ) : null}

      <IndicatorChart
        data={chartData}
        unit={indicator.unit}
        target={target}
        decimals={indicator.decimals}
        compareLabel={dimensionKeys[1]}
      />
      {dimension !== "total" && dimensionKeys.length ? (
        <p className="mt-1 text-center text-[11px] text-ink-400">
          <span className="me-3 inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-maroon-700" /> {dimensionKeys[0]?.split("=").pop()}
          </span>
          {dimensionKeys[1] ? (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-0.5 w-4 bg-gulf-600" /> {dimensionKeys[1]?.split("=").pop()}
            </span>
          ) : null}
        </p>
      ) : null}

      {/* Narration */}
      <div className="mt-4 rounded-xl bg-sand-50 p-4">
        {narration ? (
          <p className="text-sm leading-relaxed text-ink-900">{narration}</p>
        ) : narrating ? (
          <div className="space-y-2" aria-busy>
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={narrate}>
            <Sparkles className="text-gold-500" /> {t("explainIndicator")}
          </Button>
        )}
      </div>

      {/* Data table */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-maroon-700">
          {t("dataTable")}
        </summary>
        <div className="mt-2 max-h-80 overflow-auto rounded-xl border border-sand-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-sand-50">
              <tr>
                <th className="px-3 py-2 text-start text-xs font-semibold text-ink-600">{t("period")}</th>
                <th className="px-3 py-2 text-start text-xs font-semibold text-ink-600">{t("breakdown")}</th>
                <th className="px-3 py-2 text-end text-xs font-semibold text-ink-600">{t("value")}</th>
                <th className="px-3 py-2 text-start text-xs font-semibold text-ink-600">{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {[...values].reverse().map((v, i) => (
                <tr key={i} className="border-t border-sand-100">
                  <td className="px-3 py-1.5 tnum">{formatPeriod(v.period, locale)}</td>
                  <td className="px-3 py-1.5 text-xs text-ink-600">{v.dimensionKey}</td>
                  <td className="px-3 py-1.5 text-end tnum">
                    {formatNumber(v.value, locale, { decimals: indicator.decimals })}
                  </td>
                  <td className="px-3 py-1.5">
                    <Chip tone={v.status === "final" ? "ok" : v.status === "revised" ? "info" : "warn"}>
                      {t(`valueStatus.${v.status}` as never)}
                    </Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {(indicator.methodologyEn || indicator.methodologyAr) ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-maroon-700">
            {t("methodology")}
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            {bi(locale, indicator.methodologyEn ?? "", indicator.methodologyAr ?? "")}
          </p>
        </details>
      ) : null}
    </div>
  );
}
