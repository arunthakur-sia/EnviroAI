// CR04 2: the Living Strategy opens as the Strategy Canvas. Deep-link state
// arrives in the query string (?o=&t=&i=|&p=).
import { redirect } from "next/navigation";
import { renderNavigator } from "./navigator-server";

export const dynamic = "force-dynamic";

export default async function StrategyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ edition?: string; view?: string; o?: string; t?: string; i?: string; p?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  // legacy links used ?edition=; the path is canonical now
  if (sp.edition) redirect(`/${locale}/strategy/${sp.edition}`);
  return renderNavigator({
    locale,
    view: sp.view,
    canvasState: { o: sp.o, t: sp.t, i: sp.i, p: sp.p },
  });
}
