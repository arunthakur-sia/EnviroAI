// The route doubles as /strategy/{edition}: an edition code renders the
// Level 1 overview; anything else is a node id and renders the detail page
// (CR03 2.4 restyled it; the shared renderer lives in ../node-detail.tsx).
import { getEditionByCode } from "@/server/services/strategy";
import { renderNavigator } from "../navigator-server";
import { NodeDetail } from "../node-detail";
import { AskContextItem } from "@/components/nexus/ask/AskContextItem";
import { strategyNodeAskContext } from "@/components/nexus/ask/context-loaders";

export const dynamic = "force-dynamic";

export default async function NodePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ view?: string; o?: string; t?: string; i?: string; p?: string; l?: string }>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;

  // /strategy/nds3 and friends: the canvas, not a node
  const asEdition = await getEditionByCode(id);
  if (asEdition) {
    return renderNavigator({
      locale,
      editionCode: id,
      view: sp.view,
      canvasState: { o: sp.o, t: sp.t, i: sp.i, p: sp.p, l: sp.l },
    });
  }

  // CR08 2.3: tell the Ask NPC launcher which node the reader is on
  const askItem = await strategyNodeAskContext(id);
  return (
    <>
      {askItem ? <AskContextItem item={askItem} /> : null}
      <NodeDetail locale={locale} id={id} />
    </>
  );
}
