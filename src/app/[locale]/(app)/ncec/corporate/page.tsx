// NCEC Corporate Data (brief s8.4, ui-plan.md s2.3/s7): catalogue only in
// Step 1. None of the 73 corporate datasets has dummy records, so every
// tile here is honestly marked "Catalogue only" (decision #8, option A).
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/motion";
import { getNcecPrincipal } from "@/server/ncec/principal";
import { getCatalogue, groupCorporate } from "@/server/ncec/catalogue";
import { CorporateView } from "./CorporateView";

export const dynamic = "force-dynamic";

export default async function NcecCorporatePage() {
  const principal = await getNcecPrincipal();
  if (!principal) notFound(); // defensive; ncec/layout.tsx already gates this
  await getTranslations("ksaNcec");
  const catalogue = await getCatalogue(principal, "corporate_support");
  const groups = groupCorporate(catalogue);
  return (
    <Reveal>
      <CorporateView groups={groups} />
    </Reveal>
  );
}
