// CR02 2.2: shared server renderer for the column navigator routes.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import {
  getEditions,
  getEditionByCode,
  getNavigator,
} from "@/server/services/strategy";
import { Reveal } from "@/components/motion";
import { bi } from "@/lib/utils";
import { StrategyNavigator } from "./StrategyNavigator";

export async function renderNavigator({
  locale,
  editionCode,
  outcomeSlug,
  targetSlug,
  view,
}: {
  locale: string;
  editionCode?: string;
  outcomeSlug?: string;
  targetSlug?: string;
  view?: string;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("strategy");

  const editions = await getEditions();
  const code =
    editionCode ?? editions.find((e) => e.isDefault)?.code ?? editions[0]?.code;
  const edition = code ? await getEditionByCode(code) : null;
  if (!edition) redirect(`/${locale}/home`);

  const data = await getNavigator(edition.id);
  const outcome = outcomeSlug
    ? data.outcomes.find((o) => o.slug === outcomeSlug) ?? null
    : null;
  const target =
    outcome && targetSlug
      ? data.targets.find(
          (tg) => tg.outcomeId === outcome.id && tg.slug === targetSlug
        ) ?? null
      : null;

  return (
    <Reveal>
      <div className="mb-4">
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="mt-1 max-w-xl text-sm text-ink-600">
          {bi(locale, edition.summaryEn ?? "", edition.summaryAr ?? "")}
        </p>
      </div>
      <StrategyNavigator
        data={data}
        initial={{ outcomeId: outcome?.id ?? null, targetId: target?.id ?? null }}
        initialView={view === "map" ? "map" : "columns"}
      />
    </Reveal>
  );
}
