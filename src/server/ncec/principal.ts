// The single seam that decides who the current NCEC caller is (ui-plan.md
// s3.1). Today it reads the demo persona cookie; replacing the demo with
// real NCEC SSO and access grants means rewriting this file only. Every NCEC
// page and API route calls getNcecPrincipal() and nothing else.
import "server-only";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/server/auth/session";
import type { NcecPrincipal } from "./types";
import {
  DEMO_GRANT_ALLOW_EXPORT,
  DEMO_GRANT_DATASET_IDS,
  DEMO_GRANT_DURATION_DAYS,
  DEMO_GRANT_INCLUDE_PERSONAL_DATA,
  DEMO_PERSONA_LAYER,
  isDemoModeEnabled,
  isDemoPersonaKey,
  type DemoPersonaKey,
} from "./demo/personas";

export const DEMO_PERSONA_COOKIE = "ncec_demo_persona";

type CookieValue = { persona: DemoPersonaKey; l3StartedAt?: string };

function readCookie(raw: string | undefined): CookieValue {
  if (raw) {
    try {
      const v = JSON.parse(raw) as Partial<CookieValue>;
      if (isDemoPersonaKey(v.persona)) {
        return { persona: v.persona, l3StartedAt: typeof v.l3StartedAt === "string" ? v.l3StartedAt : undefined };
      }
    } catch {
      /* a broken cookie is treated as L1, never as an error */
    }
  }
  return { persona: "l1" };
}

function l2Principal(userId: string): NcecPrincipal {
  return {
    userId,
    baseLayer: 2,
    grantedDatasetIds: [],
    includePersonalData: false,
    allowExport: false,
    grantExpiresAt: null,
    source: "demo",
  };
}

/** Resolves the current NCEC caller, or null when they have no NCEC access
    at all (an L1 persona, demo mode off, or no signed-in user). A null
    principal must make every NCEC page and endpoint behave exactly as if
    the route did not exist (decision #2: no trace for public users). */
export async function getNcecPrincipal(): Promise<NcecPrincipal | null> {
  const user = await getCurrentUser();
  if (!user) return null; // the (app) layout already sends an anonymous visitor to /login
  if (!isDemoModeEnabled()) return null; // no SSO/real grants exist yet outside demo mode

  const { persona, l3StartedAt } = readCookie((await cookies()).get(DEMO_PERSONA_COOKIE)?.value);
  const layer = DEMO_PERSONA_LAYER[persona];
  if (layer === 1) return null;
  if (layer === 2) return l2Principal(user.id);

  // brief R4: L3 is a per-dataset elevation on top of the L2 login, never a
  // second identity, so baseLayer stays 2 and only grantedDatasetIds grows.
  const startedAt = l3StartedAt ?? new Date().toISOString();
  const expiresAt = new Date(Date.parse(startedAt) + DEMO_GRANT_DURATION_DAYS * 86400000).toISOString();
  if (Date.parse(expiresAt) < Date.now()) {
    // the demo grant has lapsed: fall back to L2 rather than silently reviving L3
    return l2Principal(user.id);
  }
  return {
    userId: user.id,
    baseLayer: 2,
    grantedDatasetIds: [...DEMO_GRANT_DATASET_IDS],
    includePersonalData: DEMO_GRANT_INCLUDE_PERSONAL_DATA,
    allowExport: DEMO_GRANT_ALLOW_EXPORT,
    grantExpiresAt: expiresAt,
    source: "demo",
  };
}
