// EnviroAI KSA modules: portal gate. A hidden portal's routes 404 for the
// user. Tolerates the portal key not being registered yet (see ksa-gate).
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { ksaPortalAllowed } from "@/server/services/ksa-gate";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user && !ksaPortalAllowed(user, "regulatory")) notFound();
  return children;
}
