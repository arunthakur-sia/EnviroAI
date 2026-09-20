"use client";
// CR08 10.2 section 7: the operational KPI scorecard. Five tiles: the value
// with its unit, the target, a RAG ring of attainment, a trend arrow read in
// the KPI's good direction, and a twelve-point sparkline from the series.
// Editors enter a monthly value through POST /kpis.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDownRight, ArrowUpRight, Gauge, Info, Minus, Plus } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { bi, cn } from "@/lib/utils";
import { Button, Chip, EmptyState, Input, Label, ProgressRing } from "@/components/ui/primitives";
import { Dialog, DialogContent, Tip } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import type { OpsKpiCard, OpsKpiPoint } from "@/server/services/operating-model";
import { RAG_CHIP, RAG_VAR, SectionBand, displayFont, omFetch, useFmt } from "./shared";

const SPARK_W = 120;
const SPARK_H = 32;

function Sparkline({ series, colour, label }: { series: OpsKpiPoint[]; colour: string; label: string }) {
  const points = series.slice(-12).filter((p) => p.value != null) as { period: string; value: number }[];
  if (points.length < 2) return <div className="h-8" aria-hidden />;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = SPARK_W / (points.length - 1);
  const coords = points.map((p, i) => [i * step, SPARK_H - 3 - ((p.value - min) / span) * (SPARK_H - 6)] as const);
  const path = coords.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${path} L ${coords[coords.length - 1][0].toFixed(1)} ${SPARK_H} L 0 ${SPARK_H} Z`;
  const last = coords[coords.length - 1];
  return (
    <svg
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className="h-8 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      style={{ direction: "ltr" }}
      data-testid="kpi-sparkline"
    >
      <path d={area} fill={colour} fillOpacity={0.08} />
      <path d={path} fill="none" stroke={colour} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r={2.4} fill={colour} stroke="#ffffff" strokeWidth={1} />
    </svg>
  );
}

function KpiTile({ kpi, canEdit, onEnter }: { kpi: OpsKpiCard; canEdit: boolean; onEnter: () => void }) {
  const t = useTranslations("operatingModel");
  const locale = useLocale();
  const fmt = useFmt();
  const name = bi(locale, kpi.nameEn, kpi.nameAr);
  const definition = bi(locale, kpi.definitionEn, kpi.definitionAr);
  const unitKey = kpi.unit === "percent" || kpi.unit === "days" || kpi.unit === "count" ? kpi.unit : null;
  const unitShort = unitKey ? t(`kpis.unit.${unitKey}` as never) : kpi.unit ?? "";
  /** "95%" keeps the symbol against the number, "10 days" takes a space. */
  const withUnit = (text: string) => (!unitShort ? text : /^[A-Za-z؀-ۿ]/.test(unitShort) ? `${text} ${unitShort}` : `${text}${unitShort}`);
  const value = kpi.latest?.value ?? null;
  const colour = RAG_VAR[kpi.rag];
  const attainment = kpi.attainment == null ? 0 : Math.min(1, Math.max(0, kpi.attainment));
  const trendIcon =
    kpi.trend === "up" ? <ArrowUpRight className="size-3.5" aria-hidden /> : kpi.trend === "down" ? <ArrowDownRight className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />;
  const trendClass = kpi.improving == null ? "text-ink-400" : kpi.improving ? "text-ok" : "text-danger";
  const previous = kpi.previous?.value != null ? withUnit(fmt.n(kpi.previous.value)) : null;
  const trendText =
    previous == null || !kpi.trend
      ? t("kpis.trend.none")
      : kpi.trend === "up"
        ? t("kpis.trend.up", { previous })
        : kpi.trend === "down"
          ? t("kpis.trend.down", { previous })
          : t("kpis.trend.flat", { previous });

  return (
    <article className="card card-hover flex flex-col gap-3 p-4" data-testid="kpi-tile" data-code={kpi.code} data-rag={kpi.rag}>
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-2 min-h-10 text-sm font-medium leading-snug text-ink-900">{name}</h4>
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            <Chip tone={kpi.sourceKind === "auto" ? "gulf" : "sand"} title={t(`kpis.sourceTitle.${kpi.sourceKind}` as never)}>
              {t(`kpis.source.${kpi.sourceKind}` as never)}
            </Chip>
            <Chip tone={RAG_CHIP[kpi.rag]}>{t(`kpis.rag.${kpi.rag}` as never)}</Chip>
          </p>
        </div>
        {definition ? (
          <Tip content={<span className="block max-w-64 leading-relaxed">{definition}</span>}>
            <button type="button" aria-label={`${t("kpis.definition")}: ${name}`} className="cursor-help rounded-md p-1 text-ink-400 hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-gold-500">
              <Info className="size-4" aria-hidden />
            </button>
          </Tip>
        ) : null}
      </header>
      <div className="flex items-center gap-3">
        <ProgressRing value={attainment} size={56} stroke={5} color={colour} track="var(--color-sand-200)">
          <span className="text-[10px] font-semibold text-ink-600 tnum">{kpi.attainment == null ? "" : `${Math.round(kpi.attainment * 100)}%`}</span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-1">
            <span className="text-[30px] font-semibold leading-none text-maroon-900 tnum" style={{ fontFamily: displayFont(locale) }} data-testid="kpi-value">
              {value == null ? t("kpis.noValue") : fmt.n(value)}
            </span>
            {value != null && unitShort ? <span className="text-sm text-ink-600">{unitShort}</span> : null}
          </p>
          <p className="mt-1 text-[11px] text-ink-600 tnum">
            {kpi.target != null ? t("kpis.target", { value: withUnit(fmt.n(kpi.target)) }) : t("kpis.noTarget")}
          </p>
          <p className={cn("mt-0.5 flex items-start gap-1 text-[11px] leading-tight tnum", trendClass)} title={trendText}>
            <span className="mt-px shrink-0">{trendIcon}</span>
            <span className="line-clamp-2">{trendText}</span>
          </p>
        </div>
      </div>
      <Sparkline series={kpi.series} colour={colour} label={t("kpis.sparklineAria", { name, count: Math.min(12, kpi.series.length) })} />
      <footer className="flex items-center justify-between gap-2 text-[11px] text-ink-400 tnum">
        <span>{kpi.latest ? t("kpis.latest", { period: fmt.period(kpi.latest.period) }) : t("kpis.noValue")}</span>
        {canEdit ? (
          <button
            type="button"
            onClick={onEnter}
            aria-label={t("kpis.enterAria", { name })}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 font-medium text-maroon-700 hover:bg-maroon-100/60 focus-visible:outline-2 focus-visible:outline-gold-500"
            data-testid="kpi-enter"
          >
            <Plus className="size-3" aria-hidden /> {t("kpis.enter")}
          </button>
        ) : null}
      </footer>
    </article>
  );
}

function EnterDialog({ kpi, onClose, onSaved }: { kpi: OpsKpiCard; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("operatingModel");
  const locale = useLocale();
  const { toast } = useToast();
  const [period, setPeriod] = React.useState(new Date().toISOString().slice(0, 7));
  const [value, setValue] = React.useState(kpi.latest?.value != null ? String(kpi.latest.value) : "");
  const [busy, setBusy] = React.useState(false);
  const num = Number(value);
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(period) && value.trim() !== "" && Number.isFinite(num);
  async function save() {
    setBusy(true);
    const res = await omFetch("/api/v1/operating-model/kpis", { method: "POST", body: { kpiId: kpi.id, period, value: num } });
    setBusy(false);
    if (res.ok) {
      toast(t("kpis.dialog.saved"), "success");
      onSaved();
      onClose();
    } else {
      toast(res.status === 403 ? t("actions.forbidden") : t("actions.failed"), "error");
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`${t("kpis.dialog.title")}: ${bi(locale, kpi.nameEn, kpi.nameAr)}`} data-testid="kpi-dialog">
        <p className="mb-3 text-xs text-ink-600">{t("kpis.dialog.hint")}</p>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) void save();
          }}
        >
          <div>
            <Label htmlFor="kpi-period">{t("kpis.dialog.period")}</Label>
            <Input id="kpi-period" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} data-testid="kpi-period" />
          </div>
          <div>
            <Label htmlFor="kpi-value">{t("kpis.dialog.value")}</Label>
            <Input id="kpi-value" type="number" step="0.1" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus data-testid="kpi-value-input" />
          </div>
          {!valid && (value || period) ? <p className="text-xs text-danger sm:col-span-2">{t("kpis.dialog.invalid")}</p> : null}
          <div className="mt-1 flex items-center gap-2 sm:col-span-2">
            <Button type="submit" disabled={!valid} loading={busy} data-testid="kpi-save">
              {t("kpis.dialog.save")}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("actions.cancel")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function KpiScorecard({ kpis, canEdit, n }: { kpis: OpsKpiCard[]; canEdit: boolean; n: number }) {
  const t = useTranslations("operatingModel");
  const router = useRouter();
  const [entering, setEntering] = React.useState<OpsKpiCard | null>(null);
  return (
    <SectionBand id="om-kpis" n={n} eyebrow={t("section.n", { n })} title={t("kpis.title")} hint={t("kpis.hint")} testId="om-kpis">
      {kpis.length === 0 ? (
        <EmptyState icon={<Gauge />} title={t("kpis.empty")} hint={t("kpis.emptyHint")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" data-testid="kpi-scorecard">
          {kpis.map((k) => (
            <KpiTile key={k.id} kpi={k} canEdit={canEdit} onEnter={() => setEntering(k)} />
          ))}
        </div>
      )}
      {entering ? <EnterDialog kpi={entering} onClose={() => setEntering(null)} onSaved={() => router.refresh()} /> : null}
    </SectionBand>
  );
}
