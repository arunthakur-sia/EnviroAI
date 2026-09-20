// CR08 6.1: the administrator's handover list with the start form.
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { listHandovers } from "@/server/services/handover";
import { Reveal } from "@/components/motion";
import { HandoversListClient } from "./HandoversListClient";

export const dynamic = "force-dynamic";

export default async function HrHandoversPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const data = await listHandovers(user);
  if (!data) notFound();
  return (
    <Reveal>
      <HandoversListClient rows={data.rows} scopeAll={data.scopeAll} />
    </Reveal>
  );
}
