// EnviroAI KSA modules: portal gate that tolerates a portal key the shell
// has not registered yet. Once "regulatory" and "sources" are in PORTALS the
// normal permission rules apply (a hidden portal 404s); until then the pages
// stay reachable so the modules can be built and tested on their own.
import { PORTALS, type Portal } from "@/server/db/json";
import type { CurrentUser } from "@/server/auth/session";
import { canSeePortal } from "@/server/auth/permissions";

export type KsaPortal = "regulatory" | "sources";

export function ksaPortalAllowed(user: CurrentUser | null, key: KsaPortal): boolean {
  if (!user) return false;
  if (!(PORTALS as readonly string[]).includes(key)) return true;
  return canSeePortal(user, key as Portal);
}
