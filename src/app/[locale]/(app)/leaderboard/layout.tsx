// CR08 7.2: portal gate. A hidden portal's routes 404 for the user.
import { requirePortal } from "@/server/auth/portal";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requirePortal("leaderboard");
  return children;
}
