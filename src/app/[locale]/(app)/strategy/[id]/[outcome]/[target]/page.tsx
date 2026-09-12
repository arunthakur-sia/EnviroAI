// CR02 2.2: /strategy/{edition}/{outcome}/{target} renders the navigator
// with the outcome and target selected.
import { renderNavigator } from "../../../navigator-server";

export const dynamic = "force-dynamic";

export default async function StrategyTargetPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string; outcome: string; target: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { locale, id, outcome, target } = await params;
  const sp = await searchParams;
  return renderNavigator({
    locale,
    editionCode: id,
    outcomeSlug: outcome,
    targetSlug: target,
    view: sp.view,
  });
}
