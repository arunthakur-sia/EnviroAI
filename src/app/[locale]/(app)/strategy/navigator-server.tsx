// CR03 2: shared server renderer for the Living Strategy routes.
// Level 1 (no outcome) renders the medallion overview with the map toggle;
// an outcome slug renders the target cards page; a target slug renders the
// target's detail page. URLs stay exactly as CR02 introduced them.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import {
  getEditions,
  getEditionByCode,
  getNavigator,
  getCanvasExtras,
} from "@/server/services/strategy";
import { getOwnerRefs } from "@/server/services/people";
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
    /* CR08 9.1: one bulk resolve for every person the page will name */
    const targetOwners = await getOwnerRefs([
      outcome.ownerUserId,
      ...data.items.filter((i) => i.outcomeId === outcome.id).map((i) => i.ownerUserId),
    ]);
    return (
      <Reveal>
        <OutcomeTargets data={data} outcomeId={outcome.id} owners={targetOwners} />
      </Reveal>
    );
  }

  // CR04 2: the Strategy Canvas (one page, everything in place)
  const extras = await getCanvasExtras(edition.id);
  /* CR08 9.1: the canvas names owners on the outcome panel, the lane cards
     and the outcome stakeholder groups. Every id the canvas can show is
     resolved once here, so no client component reaches for a person. */
  const owners = await getOwnerRefs([
    ...data.outcomes.map((o) => o.ownerUserId),
    ...data.items.map((i) => i.ownerUserId),
    ...Object.values(extras.outcomeStakeholders).flatMap((s) => [
      s.departmentOwner?.head?.id ?? null,
      ...s.experts.map((p) => p.userId),
      ...s.leaders.sponsor.map((p) => p.userId),
      ...s.leaders.owner.map((p) => p.userId),
      ...s.leaders.manager.map((p) => p.userId),
    ]),
  ]);
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
        owners={owners}
        canEdit={can(user, "create", "strategy")}
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
