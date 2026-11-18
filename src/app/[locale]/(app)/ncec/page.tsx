// NCEC Environmental Data (brief s8.2, ui-plan.md s2.1): KPIs, the facilities
// map, a featured slice of the dataset catalogue and the facilities table,
// all server-filtered for the caller's layer before this page ever renders.
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/motion";
import { getNcecPrincipal } from "@/server/ncec/principal";
import { getEnvironmentalDashboard } from "@/server/ncec/dashboards";
import { getCatalogue } from "@/server/ncec/catalogue";
import { todayIso } from "@/lib/ids";
import { EnvironmentalView } from "./EnvironmentalView";

export const dynamic = "force-dynamic";

/** the mockup's catalogue card: three open datasets with dummy data, then
    the two L3 datasets an L2 caller is most likely to ask for */
const FEATURED = ["DS-001", "DS-022", "DS-027", "DS-016", "DS-015"];

export default async function NcecEnvironmentalPage() {
  const principal = await getNcecPrincipal();
  if (!principal) notFound(); // defensive; ncec/layout.tsx already gates this
  await getTranslations("ksaNcec");
  const [dashboard, catalogue] = await Promise.all([
    getEnvironmentalDashboard(todayIso()),
    getCatalogue(principal, "core_environmental"),
  ]);
  const featured = FEATURED.map((id) => catalogue.find((d) => d.datasetId === id)).filter((d) => d !== undefined);
  return (
    <Reveal>
      <EnvironmentalView dashboard={dashboard} catalogue={featured} catalogueTotal={catalogue.length} />
    </Reveal>
  );
}
