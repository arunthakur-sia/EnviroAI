// CR08 6.2: the Handover portal gate (hidden portals answer the friendly 404).
import { requirePortal } from "@/server/auth/portal";

export default async function HandoverLayout({ children }: { children: React.ReactNode }) {
  await requirePortal("handover");
  return children;
}
