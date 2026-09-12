import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { db, schema } from "@/server/db/client";
import { Reveal } from "@/components/motion";
import { ImportFlow } from "./ImportFlow";

export const dynamic = "force-dynamic";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (!can(user, "create", "statistics")) redirect(`/${locale}/statistics`);
  const t = await getTranslations("import");

  const indicators = await db
    .select({
      id: schema.indicators.id,
      nameEn: schema.indicators.nameEn,
      nameAr: schema.indicators.nameAr,
      unit: schema.indicators.unit,
    })
    .from(schema.indicators)
    .orderBy(schema.indicators.nameEn);

  return (
    <Reveal>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-600">{t("subtitle")}</p>
        <ImportFlow indicators={indicators} />
      </div>
    </Reveal>
  );
}
