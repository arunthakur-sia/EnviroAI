import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getHrHandover } from "@/server/services/hr";
import { Reveal } from "@/components/motion";
import { HandoverDetailClient } from "./HandoverDetailClient";

export const dynamic = "force-dynamic";

export default async function HandoverPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const data = await getHrHandover(user, id);
  if (!data) notFound();
  return (
    <Reveal>
      <HandoverDetailClient data={data} />
    </Reveal>
  );
}
