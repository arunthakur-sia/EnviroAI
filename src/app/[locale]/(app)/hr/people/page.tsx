import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getHrPeople } from "@/server/services/hr";
import { Reveal } from "@/components/motion";
import { HrPeopleClient } from "./HrPeopleClient";

export const dynamic = "force-dynamic";

export default async function HrPeoplePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ focus?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const data = await getHrPeople(user);
  if (!data) notFound();
  return (
    <Reveal>
      <HrPeopleClient data={data} focusId={sp.focus ?? null} />
    </Reveal>
  );
}
