import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { termsByDimension } from "@/server/services/taxonomy";
import { Reveal } from "@/components/motion";
import { AddKnowledgeClient } from "./AddKnowledgeClient";

export const dynamic = "force-dynamic";

export default async function AddKnowledgePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("addKnowledge");
  const terms = await termsByDimension();

  return (
    <Reveal>
      <div className="mb-6">
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-600">{t("subtitle")}</p>
      </div>
      <AddKnowledgeClient
        topics={(terms.topic ?? []).map((topic) => ({
          code: topic.code,
          nameEn: topic.nameEn,
          nameAr: topic.nameAr,
        }))}
      />
    </Reveal>
  );
}
