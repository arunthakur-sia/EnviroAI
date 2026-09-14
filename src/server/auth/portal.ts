// CR05 6.1: the route gate for hidden portals. A hidden portal's routes
// return the app's friendly 404 (never a 403, so hidden portals are not
// revealed).
import { notFound } from "next/navigation";
import { getCurrentUser } from "./session";
import { canSeePortal } from "./permissions";
import type { Portal } from "@/server/db/json";

export async function requirePortal(portal: Portal): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return; // the (app) layout redirects to login
  if (!canSeePortal(user, portal)) notFound();
}
