// CR08 5: shared vocabulary of the Reports module UI (the hub, the builder,
// the report page). Types are re-exported from the server contract as type-only
// imports; nothing here runs on the server.
import type * as React from "react";
import type { Chip } from "@/components/ui/primitives";
import type { BiText, Lang, ScopeKind, SectionCode, SectionLayout } from "@/server/reports/spec";

export type ChipTone = NonNullable<React.ComponentProps<typeof Chip>["tone"]>;

/** One row of the section library as the API's `library` field delivers it. */
export type LibraryItem = {
  code: SectionCode;
  name: BiText;
  description: BiText;
  layout: SectionLayout;
  estimatedPages: number;
  appliesTo: ScopeKind[] | "all";
};

export const REPORT_STATUSES = ["generating", "draft", "in_review", "approved", "published", "failed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const STATUS_TONE: Record<string, ChipTone> = {
  generating: "info",
  draft: "mist",
  in_review: "warn",
  approved: "ok",
  published: "navy",
  failed: "danger",
};

export const FAMILY_TONE: Record<string, ChipTone> = {
  public: "teal",
  internal: "mist",
  custom: "aqua",
};

export const SECTION_STATUS_TONE: Record<string, ChipTone> = {
  pending: "ghost",
  generating: "info",
  ready: "ok",
  edited: "aqua",
  failed: "danger",
  needsEditing: "warn",
};

/** The KPI tile and callout tones as text and wash classes (tokens only). */
export const TONE_TEXT: Record<string, string> = {
  navy: "text-navy-900",
  teal: "text-teal-600",
  // aqua-500 fails AA as text; the warn ink is the gold family's text pair
  aqua: "text-warn",
  ink: "text-ink-900",
};
export const TONE_WASH: Record<string, string> = {
  navy: "bg-navy-100 text-navy-900",
  teal: "bg-teal-100 text-teal-600",
  aqua: "bg-aqua-100 text-navy-900 border border-aqua-300",
  ink: "bg-mist-100 text-ink-900",
};

export function langOf(locale: string): Lang {
  return locale === "ar" ? "ar" : "en";
}

/** The text of a bilingual field for the rendering language, with the other
    language as the fallback so an unfinished draft never renders blank. */
export function pick(lang: Lang, text: BiText | null | undefined): string {
  if (!text) return "";
  return lang === "ar" ? text.ar || text.en || "" : text.en || text.ar || "";
}

export function previewUrl(reportId: string, n: number, opts: { thumb?: boolean } = {}): string {
  // thumb=1 asks for the gallery rendition; the route falls back to the full
  // page for a report rendered before thumbnails existed
  return `/api/v1/report-builder/${reportId}/preview/${n}${opts.thumb ? "?thumb=1" : ""}`;
}

export function downloadUrl(reportId: string, lang: Lang): string {
  return `/api/v1/report-builder/${reportId}/download?lang=${lang}`;
}

/** A status the builder's progress reports may be: a section code, a stage
    word or a free note from a loader. */
export function isFinalStatus(status: string): boolean {
  return status !== "generating";
}

export function classificationTone(level: number): ChipTone {
  return (["teal", "mist", "warn", "danger"] as const)[Math.min(3, Math.max(0, level - 1))];
}
