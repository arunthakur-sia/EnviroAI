// CR08 9.2: the Inbox portal gate (hidden portals answer the friendly 404).
import { requirePortal } from "@/server/auth/portal";

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  await requirePortal("inbox");
  return children;
}
