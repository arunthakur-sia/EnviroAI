// EnviroAI Source Library: a searchable, filterable catalogue of the KSA
// environment, water and agriculture data source databank.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { getSourcesPage } from "@/server/services/sources";
import { Reveal } from "@/components/motion";
import { SourcesView } from "./SourcesView";

export const dynamic = "force-dynamic";

export default async function SourcesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  await getTranslations("ksaSources");
  // the whole catalogue (about 180 rows) is sent once; search and chips filter in the client
  const data = await getSourcesPage();
  return (
    <Reveal>
      <SourcesView data={data} />
    </Reveal>
  );
}
