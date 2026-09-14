// CR03 2: shared server renderer for the Living Strategy routes.
// Level 1 (no outcome) renders the medallion overview with the map toggle;
// an outcome slug renders the target cards page; a target slug renders the
// target's detail page. URLs stay exactly as CR02 introduced them.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import {
  getEditions,
  getEditionByCode,
  getNavigator,
  getCanvasExtras,
} from "@/server/services/strategy";
import { Reveal } from "@/components/motion";
import { bi } from "@/lib/utils";
import { StrategyCanvas } from "./StrategyCanvas";
import { OutcomeTargets } from "./OutcomeTargets";
import { NodeDetail } from "./node-detail";

export async function renderNavigator({
  locale,
  editionCode,
  outcomeSlug,
  targetSlug,
  view,
  canvasState,
}: {
  locale: string;
  editionCode?: string;
  outcomeSlug?: string;
  targetSlug?: string;
  view?: string;
  /* CR04 2.5: deep-link state from the query string (CR05 adds l = lead) */
  canvasState?: { o?: string; t?: string; i?: string; p?: string; l?: string };
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

  // CR03 2.4: the target slug is the target's detail page
  if (target) {
    return <NodeDetail locale={locale} id={target.id} />;
  }

  // CR03 2.3: one outcome's targets
  if (outcome) {
    return (
      <Reveal>
        <OutcomeTargets data={data} outcomeId={outcome.id} />
      </Reveal>
    );
  }

  // CR04 2: the Strategy Canvas (one page, everything in place)
  const extras = await getCanvasExtras(edition.id);
  return (
    <Reveal>
      <div className="mb-4">
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="mt-1 max-w-xl text-sm text-ink-600">
          {bi(locale, edition.summaryEn ?? "", edition.summaryAr ?? "")}
        </p>
      </div>
      <StrategyCanvas
        data={data}
        extras={extras}
        initialView={view === "map" ? "map" : view === "lead" ? "lead" : "canvas"}
        initialState={{
          o: canvasState?.o ?? null,
          t: canvasState?.t ?? null,
          itemKind: canvasState?.i ? "i" : canvasState?.p ? "p" : null,
          item: canvasState?.i ?? canvasState?.p ?? null,
          lead: canvasState?.l ?? null,
        }}
      />
    </Reveal>
  );
}
