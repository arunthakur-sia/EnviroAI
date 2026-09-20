"use client";
// CR08 8: browser-side helpers shared by the Knowledge of the Week pieces:
// the seen/read PATCH, the one-per-page id lookup for ribbons, and the
// Monday arithmetic the set dialog needs without importing the service.

export type KowPatchResult = { ok: boolean; first?: boolean; readCount?: number; points?: number };

export async function kowPatch(action: "seen" | "read", kowId: string): Promise<KowPatchResult> {
  try {
    const res = await fetch("/api/v1/knowledge-of-week", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, kowId }),
      keepalive: true,
    });
    const json = (await res.json().catch(() => ({ data: null }))) as { data: KowPatchResult | null };
    return json.data ?? { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

/* One request per page for every ribbon on it, remembered for a minute. */
let idsMemo: { at: number; promise: Promise<Set<string>> } | null = null;
const IDS_TTL = 60_000;

export function fetchKowIds(): Promise<Set<string>> {
  if (idsMemo && Date.now() - idsMemo.at < IDS_TTL) return idsMemo.promise;
  const promise = fetch("/api/v1/knowledge-of-week?view=ids")
    .then((r) => (r.ok ? r.json() : { data: [] }))
    .then((json: { data?: string[] }) => new Set(json.data ?? []))
    .catch(() => new Set<string>());
  idsMemo = { at: Date.now(), promise };
  return promise;
}

export function resetKowIds(): void {
  idsMemo = null;
}

/** The Monday of the week that holds `date`, YYYY-MM-DD, in local time. */
export function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
