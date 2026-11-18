// The demo persona switcher (ui-plan.md s4): since real NCEC SSO and the
// access-grant workflow are out of scope for Step 1, a signed-in app user can
// pick which NCEC layer they read at. This module holds only the demo
// constants; principal.ts is the only place that reads them.
import "server-only";

export type DemoPersonaKey = "l1" | "l2" | "l3";
export const DEMO_PERSONA_KEYS: readonly DemoPersonaKey[] = ["l1", "l2", "l3"];

export function isDemoPersonaKey(v: unknown): v is DemoPersonaKey {
  return v === "l1" || v === "l2" || v === "l3";
}

export const DEMO_PERSONA_LAYER: Record<DemoPersonaKey, 1 | 2 | 3> = {
  l1: 1,
  l2: 2,
  l3: 3,
};

/** The Step 1 demo grant (brief s4; ui-plan.md decisions #6, #11): fixed
    datasets, 30 days from the moment L3 is selected, no personal data, no
    export. DS-038 is included so the generic dataset view can demonstrate
    real masking on a personal-data field, not just on the violations table. */
export const DEMO_GRANT_DATASET_IDS = ["DS-015", "DS-016", "DS-038"] as const;
export const DEMO_GRANT_DURATION_DAYS = 30;
export const DEMO_GRANT_INCLUDE_PERSONAL_DATA = false;
export const DEMO_GRANT_ALLOW_EXPORT = false;

/** Demo mode is on outside production, or when explicitly turned on. Never
    enable it on a shared or production deployment that might hold real NCEC
    data (brief R7): any signed-in user can become L3 while it is on. */
export function isDemoModeEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.NCEC_DEMO_PERSONAS === "on";
}
