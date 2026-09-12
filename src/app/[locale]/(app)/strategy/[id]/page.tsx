// The route doubles as /strategy/{edition}: an edition code renders the
// Level 1 overview; anything else is a node id and renders the detail page
// (CR03 2.4 restyled it; the shared renderer lives in ../node-detail.tsx).
import { getEditionByCode } from "@/server/services/strategy";
import { renderNavigator } from "../navigator-server";
import { NodeDetail } from "../node-detail";

export const dynamic = "force-dynamic";

export default async function NodePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;

  // /strategy/nds3 and friends: the overview, not a node
  const asEdition = await getEditionByCode(id);
  if (asEdition) {
    return renderNavigator({ locale, editionCode: id, view: sp.view });
  }

  return <NodeDetail locale={locale} id={id} />;
}
