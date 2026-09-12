import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { termsByDimension } from "@/server/services/taxonomy";
import { Reveal } from "@/components/motion";
import { NewExpertForm } from "./NewExpertForm";

export const dynamic = "force-dynamic";

export default async function NewExpertPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (!can(user, "create", "experts")) redirect(`/${locale}/experts`);
  const t = await getTranslations("experts");
  const terms = await termsByDimension();

  return (
    <Reveal>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl">{t("addExternal")}</h1>
        <p className="mt-1 text-sm text-ink-600">{t("addExternalHint")}</p>
        <NewExpertForm topics={[...(terms.topic ?? []), ...(terms.sector ?? [])]} />
      </div>
    </Reveal>
  );
}
