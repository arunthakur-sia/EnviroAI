// CR08 6.2: the external access link. Outside the app shell, like the
// invitation page: the checklist, add item (text and upload), the optional
// interview, no rail. The token is the whole authentication.
import { getTranslations } from "next-intl/server";
import { SiaLogo } from "@/components/nexus/Logo";
import { EmptyState } from "@/components/ui/primitives";
import { getTokenWorkspace } from "@/server/services/handover";
import { TokenWorkspaceClient } from "./TokenWorkspaceClient";

export const dynamic = "force-dynamic";

export default async function HandoverAccessPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { token, locale } = await params;
  const t = await getTranslations("handover.token");
  const workspace = await getTokenWorkspace(token);
  if (!workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist-50 px-6">
        <div className="card w-full max-w-md px-8 py-10">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <SiaLogo variant="full" height={36} />
          </div>
          <EmptyState title={t("invalid")} hint={t("invalidHint")} />
        </div>
      </div>
    );
  }
  return <TokenWorkspaceClient token={token} initial={workspace} locale={locale} />;
}
