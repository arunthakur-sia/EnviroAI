// CR05 4.5: one index, one page: header, history, pillars, signals, the
// forecast with its method section and what-if simulator, and benchmarking.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { getIndexPage } from "@/server/services/indices";
import { resolveOwner } from "@/server/services/owner-lookup";
import { assembleInputs } from "@/server/indices/compute";
import { EmptyState } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion";
import { IndexPage } from "./IndexPage";

export const dynamic = "force-dynamic";

export default async function IndexDetailPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const tc = await getTranslations("common");
  const data = await getIndexPage(user, code);
  if (!data) return <EmptyState title={tc("notFound")} className="mt-12" />;
  // the what-if simulator re-runs the engine in the browser over the same
  // assembled inputs at 1,000 runs (CR05 4.6.10); never stored
  const assembled = await assembleInputs(data.index.id, {}, 1000);
  // CR08 9.1: an index is published by an entity, which is an organisation and
  // not a person, so no owner is invented here. A national indicator that
  // reads a Statistics Hub series does have one: the head of that series'
  // department, exactly as the indicator page shows it.
  const statisticsOwner = data.statistics ? await resolveOwner("indicator", data.statistics.id) : null;

  return (
    <Reveal>
      <IndexPage data={data} whatIfInputs={assembled?.inputs ?? null} statisticsOwner={statisticsOwner} />
    </Reveal>
  );
}
