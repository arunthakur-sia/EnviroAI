// CR07 2.4: the Council Strategy, the National Planning Council's own
// institutional strategy read as a results chain. Deep-link state arrives in
// the query string (?g=&io=&o=&p=&view=&period=&strategy=).
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Landmark } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import {
  buildScorecard,
  getCouncilPageData,
  getCouncilStrategies,
  periodFor,
  type Cadence,
  type Scorecard,
} from "@/server/services/council";
import { Reveal } from "@/components/motion";
import { EmptyState } from "@/components/ui/primitives";
import { CouncilStrategy, type CouncilInitialState } from "./CouncilStrategy";

export const dynamic = "force-dynamic";

const CADENCES: Cadence[] = ["monthly", "quarterly", "yearly"];

export default async function CouncilStrategyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    g?: string;
    io?: string;
    o?: string;
    p?: string;
    view?: string;
    period?: string;
    strategy?: string;
  }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("council");

  const [data, strategyRows] = await Promise.all([
    getCouncilPageData(user, sp.strategy),
    getCouncilStrategies(),
  ]);

  if (!data) {
    return (
      <Reveal>
        <EmptyState
          icon={<Landmark />}
          title={t("header.emptyTitle")}
          hint={t("header.emptyHint")}
          className="mt-10"
        />
      </Reveal>
    );
  }

  // CR07 2.4.3: buildScorecard reads the database through the service layer, so
  // the three cadences are computed here and the period switch picks between
  // them without a round trip.
  const scorecards = {} as Record<Cadence, Scorecard>;
  for (const cadence of CADENCES) {
    scorecards[cadence] = buildScorecard(data, periodFor(cadence), cadence);
  }

  const initialState: CouncilInitialState = {
    g: sp.g ?? null,
    io: sp.io ?? null,
    o: sp.o ?? null,
    p: sp.p ?? null,
    view: sp.view === "results" ? "results" : "chain",
    period:
      sp.period === "monthly" ? "monthly" : sp.period === "quarterly" ? "quarterly" : "yearly",
  };

  return (
    <Reveal>
      <CouncilStrategy
        data={data}
        strategies={strategyRows.map((s) => ({
          id: s.id,
          nameEn: s.nameEn,
          nameAr: s.nameAr,
          periodFrom: s.periodFrom,
          periodTo: s.periodTo,
        }))}
        scorecards={scorecards}
        initialState={initialState}
      />
    </Reveal>
  );
}
