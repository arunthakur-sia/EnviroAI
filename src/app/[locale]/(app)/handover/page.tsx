// CR08 6: /handover sends the person to My Handover, a recipient to their
// learning path, and everyone else to a calm empty state.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { getMyHandover, getMyRecipientHandovers } from "@/server/services/handover";
import { EmptyState } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion";

export const dynamic = "force-dynamic";

export default async function HandoverIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const mine = await getMyHandover(user);
  if (mine && mine.status !== "complete") redirect(`/${locale}/handover/mine`);
  const recipient = await getMyRecipientHandovers(user);
  const open = recipient.find((r) => r.status !== "complete") ?? recipient[0];
  if (open) redirect(`/${locale}/handover/${open.id}`);
  if (mine) redirect(`/${locale}/handover/mine`);
  const t = await getTranslations("handover");
  return (
    <Reveal>
      <div className="mb-6">
        <h1 className="text-2xl">{t("title")}</h1>
      </div>
      <EmptyState title={t("none.title")} hint={t("none.hint")} />
    </Reveal>
  );
}
