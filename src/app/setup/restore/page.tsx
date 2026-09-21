/**
 * The one-time restore page. It exists only while SETUP_TOKEN is set, needs no
 * login, and works against an empty database, because it is what fills one.
 *
 * The operator opens it, types the token, picks the bundle, and deletes
 * SETUP_TOKEN in Railway afterwards, which removes this page on the next
 * deploy. See src/server/setup.ts for the rules it enforces.
 */
import { notFound } from "next/navigation";
import { setupEnabled } from "@/server/setup";
import { RestoreClient } from "./RestoreClient";

export const dynamic = "force-dynamic";

export default async function RestorePage() {
  if (!setupEnabled()) notFound();
  return <RestoreClient />;
}
