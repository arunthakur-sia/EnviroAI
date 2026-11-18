// A generic NCEC dataset view (brief s8.2/8.3): works for any dataset in the
// catalogue, locked or open, with no dataset-specific code. This is also
// where the L2+L3 mixed-layer example (DS-018 ODS and HFC inventory) and the
// Air Quality dataset (ui-plan.md decision #17: no dedicated dashboard) are
// actually browsed.
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/motion";
import { getNcecPrincipal } from "@/server/ncec/principal";
import { getDatasetView } from "@/server/ncec/datasets";
import { DatasetDetailView } from "./DatasetDetailView";

export const dynamic = "force-dynamic";

export default async function NcecDatasetPage({ params }: { params: Promise<{ id: string }> }) {
  const principal = await getNcecPrincipal();
  if (!principal) notFound(); // defensive; ncec/layout.tsx already gates this
  const { id } = await params;
  await getTranslations("ksaNcec");
  const view = await getDatasetView(principal, id);
  if (!view) notFound();
  return (
    <Reveal>
      <DatasetDetailView view={view} />
    </Reveal>
  );
}
