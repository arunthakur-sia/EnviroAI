// Sensitive data (L3) (brief s8.3, ui-plan.md s2.2). An L2 visitor (no
// active grant) sees a locked access view naming the datasets they could
// request, never any sensitive value. A granted L3 visitor sees the full
// dashboard with the approval banner and watermark.
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { getNcecPrincipal } from "@/server/ncec/principal";
import { getSensitiveDashboard } from "@/server/ncec/dashboards";
import { getCatalogue } from "@/server/ncec/catalogue";
import { nowIso } from "@/lib/ids";
import { Reveal } from "@/components/motion";
import { SensitiveAccessView } from "./SensitiveAccessView";
import { SensitiveView } from "./SensitiveView";

export const dynamic = "force-dynamic";

export default async function NcecSensitivePage() {
  const [principal, user] = await Promise.all([getNcecPrincipal(), getCurrentUser()]);
  if (!principal || !user) notFound(); // defensive; ncec/layout.tsx already gates this
  await getTranslations("ksaNcec");

  if (principal.grantedDatasetIds.length === 0) {
    const catalogue = await getCatalogue(principal, "core_environmental");
    const requestable = catalogue.filter((d) => d.locked);
    return (
      <Reveal>
        <SensitiveAccessView datasets={requestable} />
      </Reveal>
    );
  }

  const [dashboard, catalogue] = await Promise.all([
    getSensitiveDashboard(principal),
    getCatalogue(principal, "core_environmental"),
  ]);
  const grantedDatasets = catalogue.filter((d) => principal.grantedDatasetIds.includes(d.datasetId));
  const userName = user.nameEn || user.nameAr;

  return (
    <Reveal>
      <SensitiveView
        dashboard={dashboard}
        grantedDatasets={grantedDatasets}
        includePersonalData={principal.includePersonalData}
        allowExport={principal.allowExport}
        expiresAt={principal.grantExpiresAt}
        userName={userName}
        stampedAt={nowIso()}
      />
    </Reveal>
  );
}
