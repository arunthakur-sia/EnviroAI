// CR07 3.4: the Organisation module. One page, one URL: the top-down chart of
// the published structure, and the unit panel that opens beneath it (mandate
// as published, people, what the unit owns, policies and procedures). Panel
// state lives in the query string as ?unit=<code>.
// CR08 1.1: the chart sits in a fixed-height frame the reader can resize (the
// height is kept in their preferences) and the level labels come from the
// editable org_levels table.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { getOrgLevels, getOrgTree, getUnitPanel } from "@/server/services/organisation";
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

  const [tree, levels, panel] = await Promise.all([
    getOrgTree(user),
    getOrgLevels(),
    sp.unit ? getUnitPanel(user, sp.unit) : Promise.resolve(null),
  ]);

  // the chart height the reader chose last time
  let initialHeight: number | null = null;
  try {
    const prefs = user.prefsJson ? JSON.parse(user.prefsJson) : {};
    const stored = Number(prefs?.orgChartHeight);
    if (Number.isFinite(stored) && stored >= 480 && stored <= 1400) initialHeight = Math.round(stored);
  } catch {
    initialHeight = null;
  }

  return (
    <Reveal>
      <div className="mb-5">
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-600">{t("subtitle")}</p>
      </div>
      <OrgChart
        units={tree.units}
        rootId={tree.rootId}
        levels={levels}
        panel={panel}
        initialUnit={sp.unit ?? null}
        initialHeight={initialHeight}
      />
    </Reveal>
  );
}
