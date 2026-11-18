// NCEC Environmental Data (brief s8.2, ui-plan.md s2.1): KPIs, a schematic
// facilities map, the dataset catalogue and the facilities table, all
// server-filtered for the caller's layer before this page ever renders.
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/motion";
import { getNcecPrincipal } from "@/server/ncec/principal";
import { getEnvironmentalDashboard } from "@/server/ncec/dashboards";
import { getCatalogue } from "@/server/ncec/catalogue";
import { todayIso } from "@/lib/ids";
import { EnvironmentalView } from "./EnvironmentalView";

export const dynamic = "force-dynamic";

export default async function NcecEnvironmentalPage() {
  const principal = await getNcecPrincipal();
  if (!principal) notFound(); // defensive; ncec/layout.tsx already gates this
  await getTranslations("ksaNcec");
  const [dashboard, catalogue] = await Promise.all([
    getEnvironmentalDashboard(todayIso()),
    getCatalogue(principal, "core_environmental"),
  ]);
  return (
    <Reveal>
      <EnvironmentalView dashboard={dashboard} catalogue={catalogue} />
    </Reveal>
  );
}
