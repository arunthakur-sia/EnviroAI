// CR08 5.4: the report builder. Types, the section library and the scopes
// the requester may pick are loaded here; the client walks the four steps
// and posts the request.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { isSuperAdmin, listReportTypes, listSectionLibrary } from "@/server/services/reports";
import { Reveal } from "@/components/motion";
import { loadAllowedScopes } from "./scopes";
import { ReportBuilder } from "./ReportBuilder";

export const dynamic = "force-dynamic";

export default async function NewReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const [types, scopes] = await Promise.all([listReportTypes(user), loadAllowedScopes(user)]);
  return (
    <Reveal>
      <ReportBuilder
        types={types}
        library={listSectionLibrary()}
        scopes={scopes}
        isSuperAdmin={isSuperAdmin(user)}
        initialType={sp.type ?? null}
      />
    </Reveal>
  );
}
