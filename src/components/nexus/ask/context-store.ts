"use client";
// CR08 2.3: the item the reader is looking at, so the Ask EnviroAI panel can open
// context-aware ("Ask about this project"). A tiny module store: pages mount
// <AskContextItem item={...} /> and the launcher/panel subscribe here.
import { useSyncExternalStore } from "react";

export type AskContextItemKind =
  | "project"
  | "initiative"
  | "outcome"
  | "target"
  | "document"
  | "indicator"
  | "index"
  | "council_node"
  | "unit"
  | "lesson"
  | "expert"
  | "process"
  | "report"
  | "study"
  | "policy"
  /* CR08 6: a handover, so the reader can ask about the one on screen */
  | "handover";

export type AskContextItem = {
  kind: AskContextItemKind;
  id: string;
  code?: string | null;
  titleEn: string;
  titleAr: string;
  /** locale-less app path, e.g. "/strategy/abc" */
  href: string;
};

let current: AskContextItem | null = null;
const listeners = new Set<() => void>();

export function setAskContext(item: AskContextItem | null): void {
  if (current === item) return;
  if (current && item && current.kind === item.kind && current.id === item.id) return;
  current = item;
  for (const l of listeners) l();
}

/** Clears only when the given item is still the current one. */
export function clearAskContext(item: AskContextItem): void {
  if (current && current.kind === item.kind && current.id === item.id) setAskContext(null);
}

export function getAskContext(): AskContextItem | null {
  return current;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useAskContext(): AskContextItem | null {
  return useSyncExternalStore(subscribe, getAskContext, () => null);
}
