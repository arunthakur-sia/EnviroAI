// CR03 4: the Home that wins the decision. A disciplined bento on a 12-column
// grid (24px gutters, 1240px max width) over the knowledge constellation:
// Row A greeting + Ask hero, Row B the leadership quote band, Row C Qatar in
// numbers + Daily challenge + Podcast with What changed beneath, Row D the
// four lessons, Row E the mini library beside Your progress. One staggered
// entrance; the constellation fades in last.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Lightbulb, Plus } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { getHomeData } from "@/server/services/home";
import { can } from "@/server/auth/permissions";
import { bi } from "@/lib/utils";
import { formatDate, formatHijri } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { Stagger } from "@/components/motion";
import { EmptyState, Button } from "@/components/ui/primitives";
import { Shelf } from "@/components/nexus/Shelf";
import { LessonCard } from "@/components/nexus/LessonCard";
import { HomeAsk } from "./HomeAsk";
import { HomeBoard } from "./HomeBoard";
import { Connected } from "./connections";
import { QuoteBand } from "./QuoteBand";
import { QatarNumbers } from "./QatarNumbers";
import { DailyChallenge } from "./DailyChallenge";
import { ChangedTimeline } from "./ChangedTimeline";
import { PodcastCard } from "./PodcastCard";
import { ProgressPanel } from "./ProgressPanel";
import { SectionEyebrow } from "./SectionEyebrow";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("home");

  const data = await getHomeData(user);
  const now = new Date();
  const hour = now.getHours();
  const greetingKey = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const firstName = bi(locale, user.nameEn, user.nameAr).split(/\s+/)[0];
  const todayIso = now.toISOString();
  const canAdd = can(user, "create", "lessons");

  return (
    <HomeBoard constellation={data.constellation}>
      <Stagger className="flex flex-col gap-6" step={0.04}>
        {/* Row A: greeting (4) + Ask hero (8) */}
        <section className="grid grid-cols-12 items-center gap-6">
          <div className="col-span-12 lg:col-span-4">
            <h1 style={{ fontSize: 36, lineHeight: 1.15 }}>
              {t(`greeting.${greetingKey}`, { name: firstName })}
            </h1>
            <p className="mt-1.5 text-sm text-ink-600">
              <span className="tnum">
                {formatDate(todayIso, locale, { style: "long", numerals: user.numeralsPref })}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-ink-600">{formatHijri(todayIso, locale)}</p>
          </div>
          <div className="col-span-12 lg:col-span-8">
            <HomeAsk
              examples={data.exampleQuestions}
              continueConversation={data.todayConversation}
            />
          </div>
        </section>

        {/* Row B: Words that guide us */}
        <QuoteBand quotes={data.quotes} />

        {/* Row C: Qatar in numbers (5, tall) + quiz (3) + podcast (4), What changed (7) beneath */}
        <section className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-5 lg:row-span-2">
            {data.qatarNumber ? (
              <Connected outcome={null} className="h-full">
                <QatarNumbers data={data.qatarNumber} />
              </Connected>
            ) : (
              <EmptyState title={t("factEmpty")} className="h-full" />
            )}
          </div>
          <div className="col-span-12 min-h-56 sm:col-span-6 lg:col-span-3">
            <DailyChallenge
              card={data.card}
              streak={data.progress.dailyStreak}
              quiet={data.quietMode}
            />
          </div>
          <div className="col-span-12 sm:col-span-6 lg:col-span-4">
            <PodcastCard episode={data.latestEpisode} />
          </div>
          <div className="col-span-12 lg:col-span-7 lg:col-start-6">
            <ChangedTimeline rows={data.changedTimeline} />
          </div>
        </section>

        {/* Row D: Lessons learned */}
        <section data-testid="home-lessons">
          <SectionEyebrow
            label={t("lessonsEyebrow")}
            action={
              canAdd ? (
                <Link href={"/add" as never}>
                  <Button size="sm" variant="secondary">
                    <Plus /> {t("addKnowledge")}
                  </Button>
                </Link>
              ) : undefined
            }
          />
          {data.lessons.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.lessons.map((l) => (
                <Connected key={l.id} outcome={l.outcome}>
                  <LessonCard lesson={l} showCategory />
                </Connected>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Lightbulb />}
              title={t("lessonsEmpty")}
              action={
                canAdd ? (
                  <Link href={"/add" as never}>
                    <Button size="sm">
                      <Plus /> {t("addKnowledge")}
                    </Button>
                  </Link>
                ) : undefined
              }
            />
          )}
          <div className="mt-2 text-end">
            <Link href="/lessons" className="link-draw text-xs font-medium text-maroon-700">
              {t("seeAll")}
            </Link>
          </div>
        </section>

        {/* Row E: the mini library (8) + Your progress (4) */}
        <section className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8" data-testid="newest-shelf">
            <SectionEyebrow
              label={t("newestShelf")}
              action={
                <Link href="/vault" className="link-draw text-xs font-medium text-maroon-700">
                  {t("openVault")}
                </Link>
              }
            />
            {data.newestShelf.length ? (
              <Shelf docs={data.newestShelf} height={184} className="mb-0" />
            ) : (
              <EmptyState
                title={t("shelfEmpty")}
                action={
                  <Link href="/vault">
                    <Button size="sm" variant="secondary">{t("openVault")}</Button>
                  </Link>
                }
              />
            )}
          </div>
          <div className="col-span-12 lg:col-span-4">
            <SectionEyebrow label={t("progressEyebrow")} />
            <ProgressPanel progress={data.progress} quiet={data.quietMode} />
          </div>
        </section>
      </Stagger>
    </HomeBoard>
  );
}
