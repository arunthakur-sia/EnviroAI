// CR08 7.2: an administrator's shortcut to the same Gamification settings
// tab that Settings > Gamification shows (rules on or off the boards, the
// role exclusions, the quiet-mode rule, Refresh now). Super Admin only; the
// friendly 404 for everyone else so the route reveals nothing.
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/motion";
import { GamificationSettingsTab } from "../../settings/GamificationSettingsTab";

export const dynamic = "force-dynamic";

export default async function LeaderboardSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (!can(user, "manage", "settings")) notFound();
  const t = await getTranslations("settings");
  const tl = await getTranslations("leaderboard");

  return (
    <Reveal>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">
            {tl("title")}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-maroon-900">
            {t("tabs.gamification")}
          </h1>
        </div>
        <Link
          href={"/leaderboard" as never}
          className="link-draw flex items-center gap-1 text-sm font-medium text-maroon-700"
          data-testid="board-settings-back"
        >
          <ArrowLeft className="size-4 flip-rtl" aria-hidden /> {tl("backToBoard")}
        </Link>
      </div>
      <GamificationSettingsTab />
    </Reveal>
  );
}
