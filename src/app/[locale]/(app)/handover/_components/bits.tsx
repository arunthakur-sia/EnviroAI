"use client";
// CR08 6: the small pieces every handover surface shares (chips, bars, the
// countdown, the person line, the fetch helper).
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Avatar, Chip } from "@/components/ui/primitives";
import { bi, cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { HandoverKind, PersonRef } from "@/server/services/handover";

export type Envelope<T> = { data: T | null; error: string | null };

export async function api<T>(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  const res = await fetch(path, {
    ...init,
    headers: init.body instanceof FormData ? init.headers : { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const json = (await res.json().catch(() => ({ data: null, error: "bad_json" }))) as Envelope<T>;
  return { ok: res.ok, status: res.status, data: json.data, error: json.error };
}

const KIND_TONE: Record<HandoverKind, "navy" | "teal" | "aqua" | "info"> = {
  leaving: "navy",
  transferring: "teal",
  long_leave: "aqua",
  engagement_ending: "info",
};

export function KindChip({ kind, className }: { kind: HandoverKind; className?: string }) {
  const t = useTranslations("handover");
  return (
    <Chip tone={KIND_TONE[kind] ?? "mist"} className={className} data-testid="handover-kind">
      {t(`kinds.${kind}`)}
    </Chip>
  );
}

const STATUS_TONE: Record<string, "ok" | "mist" | "teal" | "danger"> = {
  complete: "ok",
  open: "mist",
  in_progress: "teal",
  overdue: "danger",
};

export function StatusChip({ status }: { status: string }) {
  const t = useTranslations("handover");
  return <Chip tone={STATUS_TONE[status] ?? "mist"}>{t(`status.${status}` as never)}</Chip>;
}

const ITEM_TONE: Record<string, "mist" | "teal" | "ok" | "ghost"> = {
  pending: "mist",
  reassigned: "teal",
  captured: "ok",
  not_needed: "ghost",
};

export function ItemStatusChip({ status, inScope }: { status: string; inScope: boolean }) {
  const t = useTranslations("handover");
  if (!inScope) return <Chip tone="ghost">{t("itemStatus.out_of_scope")}</Chip>;
  return <Chip tone={ITEM_TONE[status] ?? "mist"}>{t(`itemStatus.${status}` as never)}</Chip>;
}

const FILING_TONE: Record<string, "mist" | "teal" | "aqua" | "ok"> = {
  none: "mist",
  proposed: "teal",
  approved: "aqua",
  applied: "ok",
};

export function FilingChip({ status }: { status: string }) {
  const t = useTranslations("handover");
  return <Chip tone={FILING_TONE[status] ?? "mist"}>{t(`filingStatus.${status}` as never)}</Chip>;
}

export function ProgressBar({
  value,
  label,
  detail,
  tone = "navy",
  testId,
}: {
  value: number; // 0..100
  label: string;
  detail?: string;
  tone?: "navy" | "teal" | "aqua";
  testId?: string;
}) {
  const fill = tone === "teal" ? "bg-teal-600" : tone === "aqua" ? "bg-aqua-500" : "bg-navy-700";
  return (
    <div data-testid={testId}>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium text-ink-900">{label}</span>
        <span className="tnum text-ink-600">{detail ?? `${value}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-mist-200" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cn("h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none", fill)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

export function Countdown({ days, lastWorkingDay, compact }: { days: number | null; lastWorkingDay: string | null; compact?: boolean }) {
  const t = useTranslations("handover");
  const locale = useLocale();
  if (!lastWorkingDay) return <span className="text-xs text-ink-400">{t("noLastWorkingDay")}</span>;
  const tone = days === null ? "text-ink-600" : days < 0 ? "text-danger" : days <= 7 ? "text-warn" : "text-ink-900";
  return (
    // narrow cells break between the countdown and the date, never inside them
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5", compact ? "text-xs" : "text-sm")} data-testid="handover-countdown">
      <span className={cn("whitespace-nowrap font-semibold tnum", tone)}>{days === null ? "" : days < 0 ? t("dayPassed") : t("daysLeft", { count: days })}</span>
      <span className="whitespace-nowrap text-ink-400 tnum">{formatDate(lastWorkingDay, locale)}</span>
    </span>
  );
}

export function PersonLine({ person, size = 40 }: { person: PersonRef; size?: number }) {
  const t = useTranslations("handover");
  const locale = useLocale();
  const sub =
    person.kind === "external"
      ? [bi(locale, person.organisationEn ?? "", person.organisationAr ?? ""), t("personKinds.external")].filter(Boolean).join(" · ")
      : [bi(locale, person.positionEn ?? "", person.positionAr ?? ""), bi(locale, person.departmentNameEn ?? "", person.departmentNameAr ?? "")].filter(Boolean).join(" · ");
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={person.nameEn} color={person.avatarColor} size={size} />
      <div className="min-w-0">
        <p className="truncate font-medium text-ink-900">{bi(locale, person.nameEn, person.nameAr)}</p>
        {sub ? <p className="truncate text-xs text-ink-600">{sub}</p> : null}
      </div>
    </div>
  );
}

/** Eyebrow label per the design rules (no letter-spacing in Arabic). */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  const locale = useLocale();
  return <p className={cn("text-[11px] font-semibold uppercase text-ink-400", locale === "ar" ? "" : "tracking-[0.12em]", className)}>{children}</p>;
}

export function useRequiredLabels(): (code: string) => string {
  const t = useTranslations("handover.required");
  return (code) => t(code as never);
}
