import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getHrDepartments } from "@/server/services/hr";
import { Reveal } from "@/components/motion";
import { HrDepartmentsClient } from "./HrDepartmentsClient";

export const dynamic = "force-dynamic";

export default async function HrDepartmentsPage({
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
  const data = await getHrDepartments(user);
  if (!data) notFound();
  return (
    <Reveal>
      <HrDepartmentsClient data={data} focusCode={sp.focus ?? null} />
    </Reveal>
  );
}
