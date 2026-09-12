import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { termsByDimension } from "@/server/services/taxonomy";
import { db, schema } from "@/server/db/client";
import { UploadFlow } from "./UploadFlow";
import { Reveal } from "@/components/motion";

export const dynamic = "force-dynamic";

export default async function UploadPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (!can(user, "create", "vault")) redirect(`/${locale}/vault`);
  const t = await getTranslations("upload");
  const terms = await termsByDimension();
  const collections = await db
    .select({
      id: schema.collections.id,
      nameEn: schema.collections.nameEn,
      nameAr: schema.collections.nameAr,
    })
    .from(schema.collections);

  return (
    <Reveal>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-600">{t("subtitle")}</p>
        <UploadFlow
          terms={{
            knowledge_type: terms.knowledge_type ?? [],
            outcome: terms.outcome ?? [],
            sector: terms.sector ?? [],
            topic: terms.topic ?? [],
          }}
          collections={collections}
        />
      </div>
    </Reveal>
  );
}
