// The single gate for every /ncec/* route (ui-plan.md s3.2): a caller with
// no NCEC access at all (an L1 persona, or demo mode off) gets the app's
// plain 404, with no hint that the route exists (decision #2). Individual
// pages add their own narrower checks (e.g. the Sensitive page distinguishes
// an L2 visitor from a granted L3 one).
import { notFound } from "next/navigation";
import { getNcecPrincipal } from "@/server/ncec/principal";

export default async function NcecLayout({ children }: { children: React.ReactNode }) {
  const principal = await getNcecPrincipal();
  if (!principal) notFound();
  return children;
}
