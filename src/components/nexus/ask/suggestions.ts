"use client";
// CR08 2.3: per-kind helpers for the Ask NPC panel: the glyph of each item
// kind, the deterministic first suggestions about the current item, and the
// legacy analyst context the conversation API already understands.
import type { ComponentType } from "react";
import {
  BarChart3,
  BookOpen,
  Compass,
  FileOutput,
  FileText,
  Globe2,
  HeartHandshake,
  Lightbulb,
  Network,
  ScrollText,
  Target,
  UserRound,
  Workflow,
} from "lucide-react";
import type { AskContextItem, AskContextItemKind } from "./context-store";

export const KIND_ICON: Record<AskContextItemKind, ComponentType<{ className?: string }>> = {
  project: Compass,
  initiative: Compass,
  outcome: Target,
  target: Target,
  document: FileText,
  indicator: BarChart3,
  index: Globe2,
  council_node: Target,
  unit: Network,
  lesson: Lightbulb,
  expert: UserRound,
  process: Workflow,
  report: FileOutput,
  study: BookOpen,
  policy: ScrollText,
  handover: HeartHandshake,
};

/** The short name the question refers to: the code when there is one. */
export function itemLabel(item: AskContextItem, locale: string): string {
  const title = locale === "ar" ? item.titleAr || item.titleEn : item.titleEn || item.titleAr;
  return item.code ? item.code : title;
}

export type Translate = (key: string, values?: Record<string, string>) => string;

/** Three deterministic suggestions about the item, in the reader's language. */
export function suggestionsFor(t: Translate, item: AskContextItem, locale: string): string[] {
  const label = itemLabel(item, locale);
  return ["a", "b", "c"].map((slot) => t(`suggestions.${item.kind}.${slot}`, { label }));
}

/** The pre-CR08 analyst context shape, for the kinds it already covers. */
export function legacyContext(item: AskContextItem | null): { type: string; id: string } | null {
  if (!item) return null;
  switch (item.kind) {
    case "document":
      return { type: "document", id: item.id };
    case "project":
    case "initiative":
    case "outcome":
    case "target":
      return { type: "node", id: item.id };
    case "indicator":
      return { type: "indicator", id: item.id };
    default:
      return null;
  }
}

/** What the analyst receives about the current item. */
export function contextPayload(
  item: AskContextItem | null,
  locale: string
): { kind: string; id: string; code: string | null; title: string } | null {
  if (!item) return null;
  return {
    kind: item.kind,
    id: item.id,
    code: item.code ?? null,
    title: locale === "ar" ? item.titleAr || item.titleEn : item.titleEn || item.titleAr,
  };
}
