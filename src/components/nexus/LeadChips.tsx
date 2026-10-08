"use client";
// CR05 2.2: lead and supporting chips for initiatives and projects. The kind
// glyph: the Sia mark for internal departments, a building for ministries, and
// close cousins for the other register kinds.
import * as React from "react";
import { useLocale } from "next-intl";
import { Building2, Globe2, Briefcase, Landmark } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import type { LeadChip as LeadChipData } from "@/server/services/strategy";

export function KindGlyph({ lead }: { lead: LeadChipData }) {
  if (lead.kind === "department") {
    return (
      // the Sia slash mark
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/brand/EnviroAI_mark.svg"
        alt=""
        aria-hidden
        className="size-3 shrink-0 select-none object-contain"
        draggable={false}
      />
    );
  }
  const cls = "size-3 shrink-0";
  switch (lead.entityKind) {
    case "ministry":
      return <Building2 className={cls} aria-hidden />;
    case "international":
      return <Globe2 className={cls} aria-hidden />;
    case "company":
      return <Briefcase className={cls} aria-hidden />;
    default:
      return <Landmark className={cls} aria-hidden />;
  }
}

export function LeadChipPill({
  lead,
  full = false,
  className,
}: {
  lead: LeadChipData;
  full?: boolean;
  className?: string;
}) {
  const locale = useLocale();
  const short = bi(locale, lead.shortEn, lead.shortAr);
  const name = bi(locale, lead.nameEn, lead.nameAr);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-4",
        lead.role === "lead"
          ? "border-teal-100 bg-teal-100 text-teal-600"
          : "border-mist-300 bg-mist-100 text-ink-600",
        className
      )}
      title={name}
      data-testid="lead-chip"
      data-role={lead.role}
    >
      <KindGlyph lead={lead} />
      <span className="truncate">{full ? name : short}</span>
    </span>
  );
}

/** The lead chips row: lead roles only, joint leads render as several chips. */
export function LeadChips({
  leads,
  max = 2,
  className,
}: {
  leads: LeadChipData[];
  max?: number;
  className?: string;
}) {
  const leadOnly = leads.filter((l) => l.role === "lead");
  if (!leadOnly.length) return null;
  const shown = leadOnly.slice(0, max);
  const extra = leadOnly.length - shown.length;
  return (
    <span className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}>
      {shown.map((l) => (
        <LeadChipPill key={`${l.kind}:${l.id}`} lead={l} />
      ))}
      {extra > 0 ? (
        <span className="text-[10px] text-ink-600 tnum">+{extra}</span>
      ) : null}
    </span>
  );
}
