// CR08 5.1: portal gate. A hidden Reports portal answers with the friendly 404.
import { requirePortal } from "@/server/auth/portal";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requirePortal("reports");
  return children;
}
