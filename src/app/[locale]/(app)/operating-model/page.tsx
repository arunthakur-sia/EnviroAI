// CR08 10.2: the Operating Model. One page, seven sections: principles,
// governance and decision rights, the Level 0 process landscape, the RACI
// matrix, the annual ring calendar, the external and internal interfaces
// with the chord diagram, and the operational KPI scorecard. The whole model
// is read once through the service; ?year= picks the calendar year.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getOperatingModel } from "@/server/services/operating-model";
import { Reveal } from "@/components/motion";
import { OperatingModelPage } from "./OperatingModelPage";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ year?: string; section?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const yearRaw = Number(sp.year);
  const year = Number.isInteger(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100 ? yearRaw : undefined;
  const model = await getOperatingModel(user, { year });

  return (
    <Reveal>
      <OperatingModelPage
        model={model}
        viewer={{ id: user.id, numerals: user.numeralsPref }}
        initialSection={sp.section ?? null}
      />
    </Reveal>
  );
}
