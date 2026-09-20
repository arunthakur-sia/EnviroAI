"use client";
// CR08 1.2: what the Settings > Organisation sections share: the payload
// types, the editor API client, the impact list (what moves with a unit, what
// sits beneath it) and the ten-deep undo stack of inverse operations.
import * as React from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/primitives";

export type Unit = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  level: string;
  parentId: string | null;
  headUserId: string | null;
  headNameEn: string | null;
  headNameAr: string | null;
  headTitleEn: string | null;
  headTitleAr: string | null;
  mandateEn: string | null;
  mandateAr: string | null;
  responsibilitiesEn: string | null;
  responsibilitiesAr: string | null;
  sort: number;
  isActive: boolean;
  headcount: number;
  memberCount: number;
};

export type UserLite = {
  id: string;
  nameEn: string;
  nameAr: string;
  email: string;
  departmentId: string | null;
};

export type LevelDef = { id: string; code: string; nameEn: string; nameAr: string; sort: number };

export type StructurePayload = {
  units: Unit[];
  users: UserLite[];
  levels: string[];
  levelDefs: LevelDef[];
  canManage: boolean;
  canEditStructure: boolean;
};

export type ImpactCounts = {
  people: number;
  documents: number;
  policies: number;
  ownedItems: number;
  indicators: number;
  lessons: number;
  openHandovers: number;
  hrRisks: number;
  processes: number;
  other: number;
};

export type Impact = {
  unit: { id: string; code: string; nameEn: string; nameAr: string; level: string };
  subUnits: { id: string; code: string; nameEn: string; nameAr: string; level: string }[];
  counts: ImpactCounts;
  total: number;
};

export type SnapshotMeta = {
  id: string;
  takenAt: string;
  takenBy: string | null;
  takenByName: string | null;
  note: string | null;
  unitCount: number;
};

export type ChangeRequestRow = {
  id: string;
  unitId: string;
  unitCode: string;
  unitNameEn: string;
  unitNameAr: string;
  requestedBy: string;
  requesterEn: string;
  requesterAr: string;
  what: string;
  why: string | null;
  status: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

/** An inverse operation as the API returns it; applying it is one POST. */
export type Inverse = { action: string } & Record<string, unknown>;

export type UndoEntry = { label: string; inverse: Inverse };

export const UNDO_LIMIT = 10;

export type EditorResult<T = Record<string, unknown>> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
};

/** One POST to the editor route. Never throws. */
export async function editorCall<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<EditorResult<T>> {
  try {
    const res = await fetch("/api/v1/organisation/editor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as { data?: T; error?: string } | null;
    return { ok: res.ok, status: res.status, data: json?.data ?? null, error: json?.error ?? (res.ok ? null : "error") };
  } catch {
    return { ok: false, status: 0, data: null, error: "network" };
  }
}

export async function editorGet<T>(view: string, params: Record<string, string> = {}): Promise<T | null> {
  try {
    const qs = new URLSearchParams({ view, ...params }).toString();
    const res = await fetch(`/api/v1/organisation/editor?${qs}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: T };
    return json.data ?? null;
  } catch {
    return null;
  }
}

/** The ten most recent inverse operations of this session. */
export function useUndoStack() {
  const [stack, setStack] = React.useState<UndoEntry[]>([]);
  const push = React.useCallback((entry: UndoEntry) => {
    setStack((prev) => [...prev, entry].slice(-UNDO_LIMIT));
  }, []);
  const pop = React.useCallback(() => {
    setStack((prev) => prev.slice(0, -1));
  }, []);
  return { stack, push, pop, last: stack[stack.length - 1] ?? null };
}

const IMPACT_KEYS: (keyof ImpactCounts)[] = [
  "people",
  "documents",
  "policies",
  "ownedItems",
  "indicators",
  "lessons",
  "openHandovers",
  "hrRisks",
  "processes",
  "other",
];

/** The counts beneath a unit as a compact list; loading and empty states included. */
export function ImpactList({ impact, loading }: { impact: Impact | null; loading: boolean }) {
  const t = useTranslations("settings.organisationTab");
  if (loading) {
    return (
      <div className="flex flex-col gap-1.5" aria-busy aria-label={t("impact.loading")}>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-40" />
      </div>
    );
  }
  if (!impact) return null;
  const lines: { key: string; text: string }[] = [];
  if (impact.subUnits.length) lines.push({ key: "subUnits", text: t("impact.subUnits", { count: impact.subUnits.length }) });
  // literal keys so the message types check the ICU plural argument
  const label = (key: keyof ImpactCounts, count: number): string => {
    switch (key) {
      case "people":
        return t("impact.people", { count });
      case "documents":
        return t("impact.documents", { count });
      case "policies":
        return t("impact.policies", { count });
      case "ownedItems":
        return t("impact.ownedItems", { count });
      case "indicators":
        return t("impact.indicators", { count });
      case "lessons":
        return t("impact.lessons", { count });
      case "openHandovers":
        return t("impact.openHandovers", { count });
      case "hrRisks":
        return t("impact.hrRisks", { count });
      case "processes":
        return t("impact.processes", { count });
      default:
        return t("impact.other", { count });
    }
  };
  for (const key of IMPACT_KEYS) {
    const n = impact.counts[key];
    if (n > 0) lines.push({ key, text: label(key, n) });
  }
  if (!lines.length) {
    return <p className="text-sm text-ink-600">{t("impact.nothing")}</p>;
  }
  return (
    <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2" data-testid="org-impact-list">
      {lines.map((line) => (
        <li key={line.key} className="flex items-center gap-2 text-sm text-ink-900" data-testid="org-impact-item">
          <span className="size-1.5 shrink-0 rounded-full bg-maroon-500" aria-hidden />
          <span className="tnum">{line.text}</span>
        </li>
      ))}
    </ul>
  );
}
