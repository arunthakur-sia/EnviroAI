// CR02 2.2: /strategy/{edition}/{outcome} renders the navigator with the
// outcome selected.
import { renderNavigator } from "../../navigator-server";

export const dynamic = "force-dynamic";

export default async function StrategyOutcomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string; outcome: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { locale, id, outcome } = await params;
  const sp = await searchParams;
  return renderNavigator({
    locale,
    editionCode: id,
    outcomeSlug: outcome,
    view: sp.view,
  });
}
