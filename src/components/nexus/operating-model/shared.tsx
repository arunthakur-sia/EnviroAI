"use client";
// CR08 10.2: the small pieces every operating-model section shares. The
// section band (eyebrow, display heading, hint, actions), the envelope-aware
// fetch helper, the viewer's numeral preference as a context, and the kind
// colour scales that the ring calendar, the chord and the legends agree on.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatDate, formatNumber } from "@/lib/format";
import type { CalendarKind, FlowKind, GovernanceConnectorKind, RaciRole, Rag } from "@/server/services/operating-model";

export const EASE = [0.22, 1, 0.36, 1] as const;

/** The display face, Fraunces in English and Noto Kufi in Arabic. */
export function displayFont(locale: string): string {
  return locale === "ar" ? "var(--font-kufi)" : "var(--font-display)";
}

/* ------------------------------------------------------------------ */
/* the envelope fetch                                                   */
/* ------------------------------------------------------------------ */

export type Envelope<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  detail?: Record<string, unknown>;
};

export async function omFetch<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<Envelope<T>> {
  try {
    const res = await fetch(path, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    let json: { data?: T; error?: string | null; detail?: Record<string, unknown> } = {};
    try {
      json = (await res.json()) as typeof json;
    } catch {
      json = {};
    }
    return {
      ok: res.ok,
      status: res.status,
      data: (json.data ?? null) as T | null,
      error: json.error ?? (res.ok ? null : `http_${res.status}`),
      detail: json.detail,
    };
  } catch {
    return { ok: false, status: 0, data: null, error: "network" };
  }
}

/* ------------------------------------------------------------------ */
/* the viewer's numerals                                                */
/* ------------------------------------------------------------------ */

const NumeralsContext = React.createContext<string>("western");

export function NumeralsProvider({ numerals, children }: { numerals: string; children: React.ReactNode }) {
  return <NumeralsContext.Provider value={numerals}>{children}</NumeralsContext.Provider>;
}

/** Locale plus numeral aware formatters. */
export function useFmt() {
  const locale = useLocale();
  const numerals = React.useContext(NumeralsContext);
  return React.useMemo(
    () => ({
      locale,
      n: (value: number | null | undefined, decimals = 1) =>
        value == null || Number.isNaN(value) ? "" : formatNumber(value, locale, { decimals, numerals }),
      d: (iso: string | null | undefined, style: "long" | "medium" | "short" = "medium") =>
        iso ? formatDate(iso, locale, { style, numerals }) : "",
      /** "Sep 2026" from "2026-09" */
      period: (period: string) => {
        if (!/^\d{4}-\d{2}$/.test(period)) return period;
        const [y, m] = period.split("-").map(Number);
        const tag = `${locale === "ar" ? "ar-QA" : "en-QA"}-u-nu-${numerals === "eastern" ? "arab" : "latn"}`;
        return new Intl.DateTimeFormat(tag, { month: "short", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1)));
      },
      /** the month name alone, short or long */
      month: (monthIndex: number, style: "short" | "long" = "long") => {
        const tag = locale === "ar" ? "ar-QA" : "en-QA";
        return new Intl.DateTimeFormat(tag, { month: style }).format(new Date(Date.UTC(2026, monthIndex, 1)));
      },
      /** "19 Sep" without the year */
      dayMonth: (iso: string) => {
        const tag = `${locale === "ar" ? "ar-QA" : "en-QA"}-u-nu-${numerals === "eastern" ? "arab" : "latn"}`;
        return new Intl.DateTimeFormat(tag, { day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00Z`));
      },
      /** a year with no grouping separator */
      year: (y: number) => {
        const tag = `${locale === "ar" ? "ar-QA" : "en-QA"}-u-nu-${numerals === "eastern" ? "arab" : "latn"}`;
        return new Intl.NumberFormat(tag, { useGrouping: false }).format(y);
      },
    }),
    [locale, numerals]
  );
}

/* ------------------------------------------------------------------ */
/* cadence words                                                        */
/* ------------------------------------------------------------------ */

/* An interface keeps ONE cadence column and ONE service level column, not a
   pair of language columns (the change request's table), so the vocabulary
   the seed writes is translated here and anything an editor types by hand
   reads as written. Add an entry to `cadenceWords` or `serviceLevelWords` in
   both message fragments plus its key below and it is picked up. */
function phraseKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const CADENCE_WORDS = new Set([
  "weekly",
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
  "per_planning_cycle",
  "per_survey",
  "per_release",
  "per_handover",
  "per_agreement",
  "per_dataset",
  "per_index",
  "per_submission",
]);

const SERVICE_LEVEL_WORDS = new Set([
  "same_day",
  "on_release_day",
  "by_08_00_on_release_day",
  "one_working_day_before_release",
  "four_weeks_before_fieldwork",
  "within_ten_working_days_of_fieldwork_close",
  "ten_working_days_after_quarter_end",
  "by_the_eighth_of_the_month",
  "by_the_tenth_of_the_month",
  "provisioned_within_three_working_days",
  "within_five_working_days",
  "within_five_working_days_of_the_request",
  "filed_before_the_cycle_launch",
  "review_within_fifteen_working_days",
  "delivered_two_weeks_before_drafting",
  "within_ten_working_days",
  "within_two_working_days",
  "ten_working_days_before_the_publisher_deadline",
  "five_working_days_after_the_window_closes",
]);

function usePhrase(group: "cadenceWords" | "serviceLevelWords", known: Set<string>) {
  const t = useTranslations("operatingModel");
  return React.useCallback(
    (raw: string | null | undefined): string => {
      const value = (raw ?? "").trim();
      if (!value) return "";
      const key = phraseKey(value);
      return known.has(key) ? t(`${group}.${key}` as never) : value;
    },
    [t, group, known]
  );
}

export function useCadenceWord() {
  return usePhrase("cadenceWords", CADENCE_WORDS);
}

export function useServiceLevelWord() {
  return usePhrase("serviceLevelWords", SERVICE_LEVEL_WORDS);
}

/* ------------------------------------------------------------------ */
/* the section band                                                     */
/* ------------------------------------------------------------------ */

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal", className)}>
      {children}
    </p>
  );
}

export function SectionBand({
  id,
  n,
  eyebrow,
  title,
  hint,
  aside,
  children,
  testId,
  className,
}: {
  id: string;
  n: number;
  eyebrow: string;
  title: string;
  hint: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  testId: string;
  className?: string;
}) {
  const locale = useLocale();
  return (
    <section
      id={id}
      data-om-section={id}
      data-testid={testId}
      aria-labelledby={`${id}-heading`}
      className={cn("scroll-mt-28", className)}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-3xl">
          <Eyebrow>
            <span className="tnum">{eyebrow}</span>
          </Eyebrow>
          <h2
            id={`${id}-heading`}
            className="mt-1 flex items-baseline gap-3 text-[24px] leading-tight text-ink-900 sm:text-[28px]"
            style={{ fontFamily: displayFont(locale) }}
          >
            <span className="text-maroon-300 tnum" aria-hidden>
              {String(n).padStart(2, "0")}
            </span>
            <span>{title}</span>
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{hint}</p>
        </div>
        {aside ? <div className="flex flex-wrap items-center gap-2">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function SubLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400 rtl:tracking-normal", className)}>
      {children}
    </p>
  );
}

/** A quiet designed empty line inside a section, lighter than EmptyState. */
export function EmptyLine({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <p
      className="rounded-lg border border-dashed border-sand-300 bg-sand-50 px-3 py-4 text-center text-xs text-ink-600"
      data-testid={testId}
    >
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* colour scales                                                        */
/* ------------------------------------------------------------------ */

export const RACI_TONE: Record<RaciRole, "maroon" | "gulf" | "gold" | "sand"> = {
  A: "maroon",
  R: "gulf",
  C: "gold",
  I: "sand",
};

export const RAG_VAR: Record<Rag, string> = {
  on_target: "var(--color-ok)",
  at_risk: "var(--color-warn)",
  behind: "var(--color-danger)",
  no_data: "var(--color-ink-200)",
};

export const RAG_CHIP: Record<Rag, "ok" | "warn" | "danger" | "sand"> = {
  on_target: "ok",
  at_risk: "warn",
  behind: "danger",
  no_data: "sand",
};

/** Eight calendar kinds, each on its own token so the legend and the ring agree. */
export const CALENDAR_KIND_VAR: Record<CalendarKind, string> = {
  strategy_review: "var(--color-maroon-700)",
  nds_review: "var(--color-maroon-300)",
  council_meeting: "var(--color-ink-900)",
  budget: "var(--color-gold-500)",
  statistical_release: "var(--color-gulf-600)",
  report_deadline: "var(--color-info)",
  forum: "var(--color-warn)",
  other: "var(--color-ink-400)",
};

export const CALENDAR_KIND_ORDER: CalendarKind[] = [
  "council_meeting",
  "strategy_review",
  "nds_review",
  "budget",
  "statistical_release",
  "report_deadline",
  "forum",
  "other",
];

export const FLOW_TONE: Record<FlowKind, "gulf" | "sand" | "maroon" | "gold" | "info"> = {
  data: "gulf",
  input: "sand",
  approval: "maroon",
  review: "gold",
  deliverable: "info",
};

export const FLOW_ORDER: FlowKind[] = ["data", "input", "approval", "review", "deliverable"];

export const CONNECTOR_STYLE: Record<
  GovernanceConnectorKind,
  { stroke: string; dash?: string; width: number }
> = {
  reports_to: { stroke: "var(--color-maroon-700)", width: 1.8 },
  escalates_to: { stroke: "var(--color-warn)", width: 1.8 },
  advises: { stroke: "var(--color-gulf-600)", dash: "6 4", width: 1.5 },
  delegates_to: { stroke: "var(--color-info)", dash: "2 4", width: 1.8 },
  informs: { stroke: "var(--color-ink-400)", dash: "4 4", width: 1.2 },
};

export const CONNECTOR_ORDER: GovernanceConnectorKind[] = ["reports_to", "escalates_to", "advises", "delegates_to", "informs"];

/** Twelve distinct unit colours for the chord, cycled in org order. */
export const UNIT_PALETTE = [
  "var(--color-maroon-700)",
  "var(--color-gulf-600)",
  "var(--color-gold-500)",
  "var(--color-info)",
  "var(--color-ok)",
  "var(--color-warn)",
  "var(--color-cloth-plum)",
  "var(--color-maroon-300)",
  "var(--color-gulf-400)",
  "var(--color-cloth-umber)",
  "var(--color-cloth-slate)",
  "var(--color-cloth-olive)",
  "var(--color-danger)",
  "var(--color-cloth-ink)",
  "var(--color-cloth-sand)",
  "var(--color-ink-600)",
];

/** A monogram + name placeholder for a person named only by a string. */
export function NamePlaceholder({ name, size = 22, className }: { name: string; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span className={cn("flex min-w-0 max-w-full items-center gap-2", className)}>
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full border border-sand-300 bg-sand-100 font-semibold text-ink-600"
        style={{ width: size, height: size, fontSize: Math.max(9, size * 0.38) }}
        aria-hidden
      >
        {initials}
      </span>
      <span className="min-w-0 truncate text-xs text-ink-900" title={name}>
        {name}
      </span>
    </span>
  );
}
