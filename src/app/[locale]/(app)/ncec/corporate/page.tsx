// NCEC Corporate Data (brief s8.4): department tiles from the register plus
// KPIs, charts and a department summary computed server-side from the
// generated corporate dummy records (src/server/ncec/corporate.ts).
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/motion";
import { getNcecPrincipal } from "@/server/ncec/principal";
import { getCatalogue, groupCorporate } from "@/server/ncec/catalogue";
import { getCorporateDashboard } from "@/server/ncec/corporate";
import { CorporateView } from "./CorporateView";

export const dynamic = "force-dynamic";

export default async function NcecCorporatePage() {
  const principal = await getNcecPrincipal();
  if (!principal) notFound(); // defensive; ncec/layout.tsx already gates this
  await getTranslations("ksaNcec");
  const [catalogue, dashboard] = await Promise.all([getCatalogue(principal, "corporate_support"), getCorporateDashboard(principal)]);
  return (
    <Reveal>
      <CorporateView groups={groupCorporate(catalogue)} dashboard={dashboard} />
    </Reveal>
  );
}
