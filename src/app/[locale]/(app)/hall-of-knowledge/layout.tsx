// CR08 8: the Hall of Knowledge lives with Institutional Memory; a hidden
// vault portal 404s here too.
import { requirePortal } from "@/server/auth/portal";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requirePortal("vault");
  return children;
}
