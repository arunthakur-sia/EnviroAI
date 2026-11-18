// The single seam that decides who the current NCEC caller is (ui-plan.md
// s3.1): the signed-in user's row in ncec_user_access. Replacing it with
// real NCEC SSO and a grants workflow means rewriting this file only. Every
// NCEC page and API route calls getNcecPrincipal() and nothing else.
import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/server/auth/session";
import type { NcecPrincipal } from "./types";
import { getUserAccess } from "./repo";
import { principalFromAccess } from "./access";

/** Resolves the current NCEC caller, or null when they have no NCEC access
    at all. A null principal must make every NCEC page and endpoint behave
    exactly as if the route did not exist (decision #2: no trace for L1). */
export const getNcecPrincipal = cache(async (): Promise<NcecPrincipal | null> => {
  const user = await getCurrentUser();
  if (!user) return null; // the (app) layout already sends an anonymous visitor to /login
  return principalFromAccess(user.id, await getUserAccess(user.id));
});
