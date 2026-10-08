// EnviroAI Regulatory Overview: regulator directory, key regulatory timeline
// and the regulations table. Rows the source databank does not back are
// flagged Illustrative.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { getRegulatoryOverview } from "@/server/services/regulatory";
import { Reveal } from "@/components/motion";
import { RegulatoryView } from "./RegulatoryView";

export const dynamic = "force-dynamic";

export default async function RegulatoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  await getTranslations("ksaRegulatory");
  // every regulation is sent once; the regulator card and type chips filter in the client
  const data = await getRegulatoryOverview();
  return (
    <Reveal>
      <RegulatoryView data={data} />
    </Reveal>
  );
}
