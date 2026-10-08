"use client";
// CR08 10.1: the small pieces every processes component shares: the policy
// tab constants and their book cloths, chips for levels and units, the
// process detail cache behind the panel, and the ShelfDoc conversion of a
// policy document.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn, bi } from "@/lib/utils";
import { Chip } from "@/components/ui/primitives";
import type { ShelfDoc } from "@/components/nexus/Shelf";
import type { PolicyDoc, ProcessDetail, ProcessLevel, UnitRef } from "@/server/services/operating-model";
import type { PolicyTab } from "@/server/services/organisation";

export const EASE = [0.22, 1, 0.36, 1] as const;

/* the four tabs, in order; kept local so the client never imports the service */
export const POLICY_TABS: readonly PolicyTab[] = ["policy_internal", "procedure", "form_template", "service"];

/** Book cloth per tab, the same mapping the Organisation's policy tabs use. */
export const CLOTH_FOR: Record<PolicyTab, string> = {
  policy_internal: "policy",
  procedure: "guideline",
  form_template: "circular",
  service: "report",
};

export const SCOPE_TONE: Record<string, "teal" | "mist" | "warn"> = {
  all_staff: "teal",
  unit_only: "mist",
  restricted: "warn",
};

/** The display face, Sora in English and Noto Kufi in Arabic. */
export function displayFont(locale: string): string {
  return locale === "ar" ? "var(--font-kufi)" : "var(--font-display)";
}

export function processHref(code: string): string {
  return `/processes?p=${encodeURIComponent(code)}`;
}

export function unitHref(code: string): string {
  return `/organisation?unit=${encodeURIComponent(code)}`;
}

/** The number a Level 0 code carries ("P4" gives "4"). */
export function levelNumber(code: string): string {
  const m = code.match(/\d+/);
  return m ? m[0] : code;
}

export function SubHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn("mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600 rtl:tracking-normal", className)}
      style={{ fontFamily: "inherit" }}
    >
      {children}
    </p>
  );
}

export function LevelChip({ level }: { level: ProcessLevel }) {
  const t = useTranslations("processes");
  return <Chip tone={level === 0 ? "navy" : level === 1 ? "teal" : "mist"}>{t(`levelName.${level}` as never)}</Chip>;
}

/** A unit as a small chip; a link to the Organisation unless it sits inside a button. */
export function UnitChip({
  unit,
  link = true,
  className,
}: {
  unit: UnitRef;
  link?: boolean;
  className?: string;
}) {
  const locale = useLocale();
  const name = bi(locale, unit.nameEn, unit.nameAr);
  const classes = cn(
    "inline-flex max-w-full items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[11px] font-medium leading-4 text-navy-700 shadow-sm",
    link && "link-draw hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500",
    className
  );
  const body = (
    <>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-400 tnum rtl:tracking-normal">{unit.code}</span>
      <span className="truncate">{name}</span>
    </>
  );
  if (!link) return <span className={classes} title={name}>{body}</span>;
  return (
    <Link href={unitHref(unit.code)} className={classes} title={name} data-testid="unit-chip">
      {body}
    </Link>
  );
}

/* The operating model's cadences and KPI units are single free text tokens in
   the data, written in English. They are a closed vocabulary in practice, so
   the UI names the known ones in the reader's language and prints anything
   else as it was recorded. */
const CADENCE_KEYS = [
  "annual",
  "semi_annual",
  "quarterly",
  "monthly",
  "weekly",
  "daily",
  "continuous",
  "on_request",
  "per_agreement",
  "per_dataset",
  "per_handover",
  "per_index",
  "per_planning_cycle",
  "per_release",
  "per_submission",
  "per_survey",
];
const UNIT_KEYS = ["percent", "count", "days", "weeks", "months", "hours"];

const vocabKey = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, "_");

/** Names a cadence ("per release") and a KPI unit ("percent") in the reader's language. */
export function useVocabulary() {
  const t = useTranslations("processes");
  const name = (group: "cadence" | "unit", keys: string[], value: string | null | undefined) => {
    if (!value) return "";
    const key = vocabKey(value);
    return keys.includes(key) ? t(`vocab.${group}.${key}` as never) : value;
  };
  return {
    cadence: (value: string | null | undefined) => name("cadence", CADENCE_KEYS, value),
    unit: (value: string | null | undefined) => name("unit", UNIT_KEYS, value),
  };
}

export function usePolicyTabLabels(): Record<PolicyTab, string> {
  const t = useTranslations("organisation");
  return {
    policy_internal: t("policies.tabs.policy_internal"),
    procedure: t("policies.tabs.procedure"),
    form_template: t("policies.tabs.form_template"),
    service: t("policies.tabs.service"),
  };
}

export function useScopeLabels(): Record<string, string> {
  const t = useTranslations("organisation");
  return {
    all_staff: t("policies.visibility.all_staff"),
    unit_only: t("policies.visibility.unit_only"),
    restricted: t("policies.visibility.restricted"),
  };
}

/** A policy document in the shape the Library's Book takes. */
export function toShelfDoc(doc: PolicyDoc, tabLabels: Record<PolicyTab, string>): ShelfDoc {
  return {
    id: doc.id,
    titleEn: doc.titleEn,
    titleAr: doc.titleAr,
    summaryEn: doc.summaryEn,
    summaryAr: doc.summaryAr,
    typeCode: CLOTH_FOR[doc.tab],
    typeNameEn: tabLabels[doc.tab],
    typeNameAr: tabLabels[doc.tab],
    classification: doc.classificationLevel,
    status: doc.status,
    publishYear: doc.effectiveFrom ? Number(doc.effectiveFrom.slice(0, 4)) || null : null,
    pageCount: null,
    updatedAt: doc.updatedAt,
    // CR08 9.1: the custodian, so the book's preview opens their card
    ownerUserId: doc.ownerUserId ?? null,
    ownerName: doc.owner?.nameEn ?? null,
    ownerNameAr: doc.owner?.nameAr ?? null,
    ownerColor: doc.owner?.avatarColor ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* the process detail cache behind the panel                            */
/* ------------------------------------------------------------------ */

const detailCache = new Map<string, ProcessDetail>();
/* one request per code at a time: React's development double effect and a
   quick reopen share the same promise instead of loading the process twice */
const inflight = new Map<string, Promise<ProcessDetail | null>>();

export function primeProcess(detail: ProcessDetail): void {
  detailCache.set(detail.code.toLowerCase(), detail);
}

export function cachedProcess(code: string): ProcessDetail | null {
  return detailCache.get(code.toLowerCase()) ?? null;
}

export function invalidateProcesses(): void {
  detailCache.clear();
}

export function fetchProcess(code: string, force = false): Promise<ProcessDetail | null> {
  const key = code.toLowerCase();
  if (force) detailCache.delete(key);
  else {
    const cached = detailCache.get(key);
    if (cached) return Promise.resolve(cached);
  }
  /* one request per code at a time, forced or not: after a write the panel
     reloads once, not once per effect pass */
  const pending = inflight.get(key);
  if (pending) return pending;
  const promise = (async () => {
    try {
      const res = await fetch(`/api/v1/processes/${encodeURIComponent(code)}`);
      const json = await res.json();
      if (res.ok && json.data) {
        detailCache.set(key, json.data as ProcessDetail);
        return json.data as ProcessDetail;
      }
    } catch {
      /* the panel shows its error state */
    }
    return null;
  })();
  inflight.set(key, promise);
  /* the slot is freed only by the request that took it */
  void promise.then(() => {
    if (inflight.get(key) === promise) inflight.delete(key);
  });
  return promise;
}

/** The JSON envelope every operating model route answers with. */
export type Envelope<T = unknown> = { data: T | null; error: string | null; detail?: Record<string, unknown> };

export async function callApi<T = unknown>(
  path: string,
  init: { method: string; body?: unknown }
): Promise<{ status: number; body: Envelope<T> }> {
  try {
    const res = await fetch(path, {
      method: init.method,
      headers: { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    let body: Envelope<T>;
    try {
      body = (await res.json()) as Envelope<T>;
    } catch {
      body = { data: null, error: `non-json ${res.status}` };
    }
    return { status: res.status, body };
  } catch {
    return { status: 0, body: { data: null, error: "network" } };
  }
}
