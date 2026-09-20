// CR08 6.2: My Handover, the leaving person's workspace.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { getMyHandover } from "@/server/services/handover";
import { EmptyState } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion";
import { MyHandoverClient } from "./MyHandoverClient";

export const dynamic = "force-dynamic";

export default async function MyHandoverPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const detail = await getMyHandover(user);
  const t = await getTranslations("handover");
  if (!detail) {
    return (
      <Reveal>
        <div className="mb-6">
          <h1 className="text-2xl">{t("mine.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-600">{t("mine.subtitle")}</p>
        </div>
        <EmptyState title={t("none.title")} hint={t("none.hint")} />
      </Reveal>
    );
  }
  return (
    <Reveal>
      <MyHandoverClient initial={detail} />
    </Reveal>
  );
}
