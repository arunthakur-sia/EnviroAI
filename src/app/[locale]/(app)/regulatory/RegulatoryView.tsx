"use client";
// EnviroAI Regulatory Overview: the regulator directory (a card filters the
// table), the key regulatory timeline and the regulations table. Every
// regulation is loaded once; the card and type chips filter in the client.
// Rows flagged is_illustrative carry an Illustrative chip: they are layout
// placeholders, never presented as verified instruments.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Coins,
  ExternalLink,
  FileText,
  Info,
  Landmark,
  Megaphone,
  PawPrint,
  Recycle,
  Scale,
  ShieldCheck,
  Sprout,
  X,
} from "lucide-react";
import { bi, cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Chip, EmptyState } from "@/components/ui/primitives";
import type {
  InstrumentType,
  Regulation,
  Regulator,
  RegulatoryOverview,
  TimelineEvent,
  TimelineKind,
} from "@/server/services/regulatory-types";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  landmark: Landmark,
  "shield-check": ShieldCheck,
  "paw-print": PawPrint,
  sprout: Sprout,
  recycle: Recycle,
  coins: Coins,
};

const KIND_ICON: Record<TimelineKind, React.ComponentType<{ className?: string }>> = {
  decision: Landmark,
  law: Scale,
  event: Megaphone,
};

/* node ground per kind: decisions teal, laws navy, events aqua, all in tokens */
const KIND_NODE: Record<TimelineKind, string> = {
  decision: "bg-teal-600 text-white",
  law: "bg-navy-900 text-white ring-4 ring-aqua-300/60",
  event: "bg-aqua-500 text-ink-900",
};

const ROW_GRID =
  "grid grid-cols-[minmax(16rem,2.2fr)_minmax(8rem,1fr)_minmax(10rem,1.3fr)_minmax(6rem,0.8fr)_minmax(8rem,1fr)]";

const FILTERS: ("all" | InstrumentType)[] = [
  "all",
  "law",
  "royal_decree",
  "cabinet_resolution",
  "executive_regulation",
  "strategy",
  "library",
];

export function RegulatoryView({ data }: { data: RegulatoryOverview }) {
  const t = useTranslations("ksaRegulatory");
  const locale = useLocale();
  const [regulator, setRegulator] = React.useState<string | null>(null);
  const [type, setType] = React.useState<"all" | InstrumentType>("all");

  const byCode = React.useMemo(() => new Map(data.regulators.map((r) => [r.code, r])), [data.regulators]);
  const rows = React.useMemo(
    () =>
      data.regulations.filter(
        (r) => (!regulator || r.regulatorCode === regulator) && (type === "all" || r.instrumentType === type)
      ),
    [data.regulations, regulator, type]
  );
  const typeCount = React.useMemo(() => {
    const base = regulator ? data.regulations.filter((r) => r.regulatorCode === regulator) : data.regulations;
    const m: Record<string, number> = { all: base.length };
    for (const r of base) m[r.instrumentType] = (m[r.instrumentType] ?? 0) + 1;
    return m;
  }, [data.regulations, regulator]);
  const selected = regulator ? byCode.get(regulator) : null;

  return (
    <div data-testid="regulatory-page">
      <header className="mb-5">
        <h1 className="text-2xl">
          {t("title")} <span className="text-ink-400">/</span> <span lang={locale === "ar" ? "en" : "ar"}>{t("titleAlt")}</span>
        </h1>
        <p className="mt-1 text-sm text-ink-600">{t("subtitle")}</p>
        <p className="mt-3 flex max-w-3xl items-start gap-2 rounded-lg border border-aqua-300 bg-aqua-100/50 px-3 py-2 text-xs text-ink-900" data-testid="illustrative-banner">
          <Info className="mt-0.5 size-3.5 shrink-0 text-teal-600" aria-hidden /> {t("illustrativeBanner")}
        </p>
      </header>

      {/* Regulator directory */}
      <section className="card mb-5 p-4" aria-labelledby="reg-directory">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="reg-directory" className="text-lg">{t("directory.title")}</h2>
          {selected ? (
            <button
              type="button"
              onClick={() => setRegulator(null)}
              className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-navy-700 hover:bg-navy-50 focus-visible:outline-2 focus-visible:outline-aqua-500"
              data-testid="regulator-clear"
            >
              <X className="size-3.5" aria-hidden /> {t("directory.clear")}
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" data-testid="regulator-directory">
          {data.regulators.map((r) => (
            <RegulatorCard
              key={r.code}
              r={r}
              locale={locale}
              active={regulator === r.code}
              onPick={() => setRegulator(regulator === r.code ? null : r.code)}
            />
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section className="card mb-5 p-4" aria-labelledby="reg-timeline">
        <h2 id="reg-timeline" className="mb-4 text-lg">{t("timeline.title")}</h2>
        {data.timeline.length === 0 ? (
          <p className="text-sm text-ink-600">{t("timeline.empty")}</p>
        ) : (
          <div className="overflow-x-auto pb-2">
            <ol className="flex min-w-[900px] items-stretch" data-testid="regulatory-timeline">
              {data.timeline.map((e, i) => (
                <TimelineNode key={e.id} e={e} locale={locale} first={i === 0} last={i === data.timeline.length - 1} />
              ))}
            </ol>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-end gap-x-5 gap-y-1 rounded-lg border border-mist-300 px-3 py-2 text-xs text-ink-600" aria-label={t("timeline.legend")}>
          {(["decision", "law", "event"] as const).map((k) => {
            const Icon = KIND_ICON[k];
            return (
              <span key={k} className="flex items-center gap-1.5">
                <Icon className="size-4 text-teal-600" aria-hidden /> {t(`timeline.kinds.${k}` as never)}
              </span>
            );
          })}
        </div>
      </section>

      {/* Regulations table */}
      <section className="card p-4" aria-labelledby="reg-table">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id="reg-table" className="text-lg">{t("table.title")}</h2>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("table.filterLabel")} data-testid="regulation-filters">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setType(f)}
                aria-pressed={type === f}
                data-testid={`reg-filter-${f}`}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-aqua-500",
                  type === f
                    ? "border-aqua-300 bg-aqua-100 text-navy-900"
                    : "border-mist-300 bg-white text-ink-600 hover:border-teal-600/50"
                )}
              >
                {t(`filters.${f}` as never)}
                <span className="tnum text-ink-400">{typeCount[f] ?? 0}</span>
              </button>
            ))}
          </div>
          {selected ? (
            <Chip tone="teal" data-testid="regulator-active">
              {t("directory.active", { name: bi(locale, selected.shortEn, selected.shortAr) })}
            </Chip>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={<FileText />} title={t("table.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <div role="table" aria-label={t("table.title")} className="min-w-[820px]" data-testid="regulations-table">
              <div role="rowgroup">
                <div role="row" className={cn(ROW_GRID, "text-xs font-semibold text-ink-600")}>
                  {(["title2", "body", "type", "status", "actions"] as const).map((c) => (
                    <div key={c} role="columnheader" className="px-3 py-2 text-start">{t(`table.${c}` as never)}</div>
                  ))}
                </div>
              </div>
              <div role="rowgroup">
                {rows.map((r) => (
                  <RegulationRow key={r.id} r={r} regulator={r.regulatorCode ? byCode.get(r.regulatorCode) : undefined} locale={locale} />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function RegulatorCard({ r, locale, active, onPick }: { r: Regulator; locale: string; active: boolean; onPick: () => void }) {
  const t = useTranslations("ksaRegulatory");
  const Icon = ICONS[r.icon] ?? Landmark;
  const nameEn = r.roleEn ? r.shortEn : r.nameEn;
  const nameAr = r.roleAr ? r.shortAr : r.nameAr;
  const short = bi(locale, r.shortEn, r.shortAr);
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      aria-label={t("directory.select", { name: short })}
      data-testid={`regulator-${r.code}`}
      data-count={r.regulationCount}
      className={cn(
        "flex cursor-pointer flex-col rounded-xl border p-3 text-start transition-all focus-visible:outline-2 focus-visible:outline-aqua-500",
        active
          ? "border-teal-600 bg-aqua-100/50 shadow-sm ring-1 ring-teal-600"
          : "border-mist-300 bg-white hover:border-navy-300 hover:shadow-sm"
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", active ? "bg-teal-600 text-white" : "bg-navy-100 text-navy-900")}>
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-navy-900">{r.shortEn}</p>
        </div>
      </div>
      <div className="mt-2 min-h-[4.5rem] text-xs leading-snug text-ink-600">
        {r.roleEn ? (
          <>
            <p>{locale === "ar" ? r.roleAr : r.roleEn}</p>
            <p className="mt-1" dir={locale === "ar" ? "ltr" : "rtl"} lang={locale === "ar" ? "en" : "ar"}>
              {r.shortAr}
            </p>
          </>
        ) : (
          <>
            <p lang="en" dir="ltr" className={locale === "ar" ? "text-start" : undefined}>{nameEn}</p>
            <p lang="ar" dir="rtl" className="mt-1">{nameAr}</p>
          </>
        )}
      </div>
      <span className={cn("mt-2 rounded-md px-2 py-1 text-center text-xs font-medium tnum", active ? "bg-aqua-100 text-navy-900" : "bg-mist-100 text-ink-600")}>
        {t("directory.count", { count: r.regulationCount })}
      </span>
    </button>
  );
}

function TimelineNode({ e, locale, first, last }: { e: TimelineEvent; locale: string; first: boolean; last: boolean }) {
  const t = useTranslations("ksaRegulatory");
  const Icon = KIND_ICON[e.kind];
  return (
    <li className="flex min-w-0 flex-1 flex-col items-stretch px-1.5" data-testid="timeline-event" data-kind={e.kind}>
      <div className="flex-1 rounded-lg border border-mist-300 bg-white px-3 py-2 text-xs">
        <p className="font-semibold text-navy-900 tnum">
          {e.hijriDate ? <bdi dir="ltr">{`${e.hijriDate}${t("table.hijri")}`}</bdi> : null}
          {e.hijriDate && e.gregorianDate ? " · " : null}
          {e.gregorianDate ? <bdi dir="ltr">{formatDate(e.gregorianDate, locale)}</bdi> : null}
        </p>
        <p className="mt-1 text-ink-900">{bi(locale, e.titleEn, e.titleAr)}</p>
        {e.isIllustrative ? <Chip tone="aqua" className="mt-1.5">{t("illustrative")}</Chip> : null}
      </div>
      <div className="relative mt-3 flex h-12 items-center justify-center">
        <span aria-hidden className={cn("absolute top-1/2 h-1 -translate-y-1/2 bg-gradient-to-r from-teal-600 to-aqua-500", first ? "start-1/2 end-0" : last ? "start-0 end-1/2" : "inset-x-0")} />
        <span className={cn("relative grid size-11 place-items-center rounded-full shadow", KIND_NODE[e.kind])}>
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
      <p className="mt-1.5 text-center text-xs font-semibold text-ink-900">{t(`timeline.kinds.${e.kind}` as never)}</p>
    </li>
  );
}

function RegulationRow({ r, regulator, locale }: { r: Regulation; regulator?: Regulator; locale: string }) {
  const t = useTranslations("ksaRegulatory");
  const Icon = regulator ? ICONS[regulator.icon] ?? Landmark : Landmark;
  const body = regulator ? bi(locale, regulator.shortEn, regulator.shortAr) : r.issuerLabel ?? "-";
  const title = bi(locale, r.titleEn, r.titleAr);
  // the other language, shown beside the title the way the product shows both
  const alt = locale === "ar" ? r.titleEn : r.titleAr;
  const hasUrl = Boolean(r.documentUrl && /^https?:\/\//i.test(r.documentUrl));
  return (
    <div role="row" className={cn(ROW_GRID, "border-t border-mist-100")} data-testid="regulation-row" data-illustrative={r.isIllustrative ? "1" : "0"}>
      <div role="cell" className="max-w-[22rem] px-3 py-2.5">
        <p className="font-medium text-ink-900">
          {title}
          {alt && alt !== title ? (
            <span className="ms-2 text-xs font-normal text-ink-400" lang={locale === "ar" ? "en" : "ar"}>{alt}</span>
          ) : null}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {r.isIllustrative ? (
            <Chip tone="aqua" title={t("illustrativeHint")} data-testid="illustrative-chip">{t("illustrative")}</Chip>
          ) : null}
          {r.sourceId ? <Chip tone="mist">{t("table.fromSources")}</Chip> : null}
        </div>
      </div>
      <div role="cell" className="px-3 py-2.5">
        <Chip tone="mist" className="gap-1.5 py-1">
          <Icon className="size-3.5 text-teal-600" aria-hidden /> {body}
        </Chip>
      </div>
      <div role="cell" className="px-3 py-2.5 text-ink-900">
        <p>{t(`types.${r.instrumentType}` as never)}{r.reference ? ` ${r.reference.replace(/^Royal Decree\s*/i, "")}` : ""}</p>
        <p className="text-xs text-ink-600 tnum">
          {r.gregorianDate || r.hijriDate ? (
            <>
              {r.hijriDate ? <bdi dir="ltr">{`${r.hijriDate}${t("table.hijri")}`}</bdi> : null}
              {r.hijriDate && r.gregorianDate ? " · " : null}
              {r.gregorianDate ? <bdi dir="ltr">{formatDate(r.gregorianDate, locale)}</bdi> : null}
            </>
          ) : (
            t("table.dateTbc")
          )}
        </p>
      </div>
      <div role="cell" className="px-3 py-2.5">
        <Chip tone={r.status === "active" ? "ok" : "mist"} className="px-3 py-1">{t(`status.${r.status}` as never)}</Chip>
      </div>
      <div role="cell" className="px-3 py-2.5">
        {hasUrl ? (
          <a
            href={r.documentUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-navy-700 hover:underline focus-visible:outline-2 focus-visible:outline-aqua-500"
          >
            {t("table.viewDocument")} <ExternalLink className="size-3.5 flip-rtl" aria-hidden />
          </a>
        ) : (
          <span className="text-xs text-ink-400">{t("table.noDocument")}</span>
        )}
      </div>
    </div>
  );
}
