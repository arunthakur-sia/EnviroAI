import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getHrRisks } from "@/server/services/hr";
import { Reveal } from "@/components/motion";
import { HrRisksClient } from "./HrRisksClient";

export const dynamic = "force-dynamic";

export default async function HrRisksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const data = await getHrRisks(user);
  if (!data) notFound();
  return (
    <Reveal>
      <HrRisksClient data={data} />
    </Reveal>
  );
}
