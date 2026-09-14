// CR05 5.6.1: the HR overview: three rings, risk counts, the department heat
// strip, the top 10 risks with act-on links, and Recompute.
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getHrOverview } from "@/server/services/hr";
import { Reveal } from "@/components/motion";
import { HrOverviewClient } from "./HrOverviewClient";

export const dynamic = "force-dynamic";

export default async function HrPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const data = await getHrOverview(user);
  if (!data) notFound();
  return (
    <Reveal>
      <HrOverviewClient data={data} />
    </Reveal>
  );
}
