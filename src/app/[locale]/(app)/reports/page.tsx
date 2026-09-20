// CR08 5.1: the Reports page of the Knowledge Hub: the cover gallery of
// published reports, the viewer's own requests, and for the Super Admin every
// report with its state. Data comes from the reports service; the client
// component filters and polls builds in progress.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { isSuperAdmin, listModuleReports, listReportTypes, listSectionLibrary } from "@/server/services/reports";
import { Reveal } from "@/components/motion";
import { ReportsPage } from "./ReportsPage";

export const dynamic = "force-dynamic";

export default async function ReportsHubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const [types, reports] = await Promise.all([listReportTypes(user), listModuleReports(user)]);
  return (
    <Reveal>
      <ReportsPage
        types={types}
        reports={reports}
        library={listSectionLibrary()}
        userId={user.id}
        isSuperAdmin={isSuperAdmin(user)}
      />
    </Reveal>
  );
}
