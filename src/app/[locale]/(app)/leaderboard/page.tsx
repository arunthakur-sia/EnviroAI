// CR08 7.2: the Leaderboard. People and Departments boards over the
// materialised leaderboard_periods table, never the events ledger. Deep-link
// state arrives in the query string (?board=&window=&category=).
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getLeaderboard } from "@/server/services/leaderboard";
import { isBoardKind, isCategory, isPeriodKind } from "@/lib/leaderboard-math";
import { Reveal } from "@/components/motion";
import { LeaderboardBoard } from "./LeaderboardBoard";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ board?: string; window?: string; category?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const query = {
    board: isBoardKind(sp.board) ? sp.board : "people",
    window: isPeriodKind(sp.window) ? sp.window : "month",
    category: isCategory(sp.category) ? sp.category : "overall",
  } as const;
  const initial = await getLeaderboard(user, query);

  return (
    <Reveal>
      <LeaderboardBoard
        initial={initial}
        viewer={{
          id: user.id,
          numerals: user.numeralsPref,
          departmentId: user.departmentId,
        }}
      />
    </Reveal>
  );
}
