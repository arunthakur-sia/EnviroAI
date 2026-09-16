// CR07 3.4: the Organisation module. One page, one URL: the top-down chart of
// the published structure, and the unit panel that opens in place beneath it
// (mandate as published, people, what the unit owns, policies and procedures).
// Panel state lives in the query string as ?unit=<code>.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { getOrgTree, getUnitPanel } from "@/server/services/organisation";
import { Reveal } from "@/components/motion";
import { OrgChart } from "./OrgChart";

export const dynamic = "force-dynamic";

export default async function OrganisationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ unit?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("organisation");

  const tree = await getOrgTree(user);
  const panel = sp.unit ? await getUnitPanel(user, sp.unit) : null;

  return (
    <Reveal>
      <div className="mb-5">
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-600">{t("subtitle")}</p>
      </div>
      <OrgChart
        units={tree.units}
        rootId={tree.rootId}
        panel={panel}
        initialUnit={sp.unit ?? null}
      />
    </Reveal>
  );
}
