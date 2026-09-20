// CR08 10.2: portal gate. A hidden operating_model portal 404s for the user.
import { requirePortal } from "@/server/auth/portal";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requirePortal("operating_model");
  return children;
}
