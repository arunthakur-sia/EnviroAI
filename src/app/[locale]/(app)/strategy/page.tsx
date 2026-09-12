// CR02 2.2: the Living Strategy opens as the column navigator (the tree-first
// page it replaces lived here; OutcomeArc and TreeGraphSection are stubs now).
import { redirect } from "next/navigation";
import { renderNavigator } from "./navigator-server";

export const dynamic = "force-dynamic";

export default async function StrategyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ edition?: string; view?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  // legacy links used ?edition=; the path is canonical now
  if (sp.edition) redirect(`/${locale}/strategy/${sp.edition}`);
  return renderNavigator({ locale, view: sp.view });
}
