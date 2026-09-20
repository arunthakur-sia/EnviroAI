// CR08 7.2: the compact "Top 5 this month" block for Home, with the
// viewer's own rank line and a link to the board. A server component: it
// reads the materialised table through the service and renders nothing for
// a viewer in quiet mode (the board is hidden from their own view).
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowUpRight, Trophy } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { CurrentUser } from "@/server/auth/session";
import { getHomeLeaderboard } from "@/server/services/leaderboard";
import { bi, cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { periodLabel } from "@/lib/leaderboard-math";
import { Chip } from "@/components/ui/primitives";
import { MedalAvatar } from "./MedalAvatar";

export async function LeaderboardHomePanel({ user }: { user: CurrentUser }) {
  const data = await getHomeLeaderboard(user);
  if (data.hidden) return null;
  const t = await getTranslations("leaderboard");
  const locale = await getLocale();
  const fmt = (v: number) => formatNumber(v, locale, { numerals: user.numeralsPref, decimals: 0 });
  const boardHref = "/leaderboard?board=people&window=month&category=overall";

  return (
    <div className="bento-card flex h-full flex-col gap-3 p-5" data-testid="home-leaderboard">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">
            {t("home.eyebrow")}
          </p>
          <h2 className="font-display text-lg text-maroon-900">{t("home.title")}</h2>
        </div>
        <span className="shrink-0 text-xs text-ink-400">
          {periodLabel("month", data.periodKey, locale)}
        </span>
      </div>

      {data.notBuilt ? (
        <p className="text-sm text-ink-600">{t("home.notBuilt")}</p>
      ) : data.top.length === 0 ? (
        <p className="text-sm text-ink-600">{t("home.empty")}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-sand-100" data-testid="home-leaderboard-list">
          {data.top.map((row) => (
            <li
              key={row.subjectId}
              className={cn(
                "flex items-center gap-3 py-2",
                row.isMe && "-mx-2 rounded-lg bg-maroon-50/70 px-2"
              )}
            >
              <span className="w-5 shrink-0 font-display text-base font-semibold text-ink-900 tnum">
                {fmt(row.rank)}
              </span>
              <MedalAvatar name={row.nameEn} color={row.avatarColor} size={28} rank={row.rank} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink-900">
                  {bi(locale, row.nameEn, row.nameAr)}
                </span>
                <span className="block truncate text-[11px] text-ink-600">
                  {bi(locale, row.unitEn, row.unitAr)}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-maroon-900 tnum">{fmt(row.points)}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-sand-100 pt-3">
        <span className="flex items-center gap-1.5 text-xs text-ink-600" data-testid="home-leaderboard-mine">
          <Trophy className="size-3.5 text-gold-500" aria-hidden />
          {data.mine ? (
            <>
              {t("home.yourRank", { rank: fmt(data.mine.rank) })}
              <Chip tone="gold" className="tnum">
                {t("points", { count: data.mine.points })}
              </Chip>
            </>
          ) : data.excludedViewer ? (
            t("home.excluded")
          ) : (
            t("home.unranked")
          )}
        </span>
        <Link
          href={boardHref as never}
          className="link-draw flex items-center gap-1 text-xs font-medium text-maroon-700"
          data-testid="home-leaderboard-open"
        >
          {t("home.open")} <ArrowUpRight className="size-3.5 flip-rtl" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
