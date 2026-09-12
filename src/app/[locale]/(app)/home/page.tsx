// CR02 1.3: the new Home. One focal point (the Ask box), three purposeful
// rows (Today, Lessons learned, Explore with Your progress), 48px rhythm,
// one staggered entrance, content max width 1200px.
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
import { HomeToday } from "./HomeToday";
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
    <div className="mx-auto max-w-[1200px]">
      <Stagger className="flex flex-col gap-12" step={0.05}>
        {/* Hero: quiet greeting, the Ask box, chips, word of the day caption */}
        <section>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-xl">{t(`greeting.${greetingKey}`, { name: firstName })}</h1>
            <p className="text-sm text-ink-600">
              <span className="tnum">
                {formatDate(todayIso, locale, { style: "long", numerals: user.numeralsPref })}
              </span>
              <span className="ms-2 text-xs text-ink-400">· {formatHijri(todayIso, locale)}</span>
            </p>
          </div>
          <HomeAsk
            examples={data.exampleQuestions}
            continueConversation={data.todayConversation}
            word={data.word}
          />
        </section>

        {/* Today: exactly three equal cards */}
        <section>
          <SectionEyebrow label={t("todayEyebrow")} />
          <HomeToday
            card={data.card}
            changed={data.changed}
            episode={data.latestEpisode}
            quiet={data.quietMode}
          />
        </section>

        {/* Lessons learned: four cards, category chips, Add Knowledge */}
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
                <LessonCard key={l.id} lesson={l} showCategory />
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
          <div className="mt-3 text-end">
            <Link
              href="/lessons"
              className="text-xs font-medium text-maroon-700 hover:underline"
            >
              {t("seeAll")}
            </Link>
          </div>
        </section>

        {/* Explore + Your progress */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div data-testid="newest-shelf">
            <SectionEyebrow
              label={t("exploreEyebrow")}
              action={
                <Link
                  href="/vault"
                  className="text-xs font-medium text-maroon-700 hover:underline"
                >
                  {t("openVault")}
                </Link>
              }
            />
            <p className="mb-2 text-sm text-ink-600">{t("newestShelf")}</p>
            {data.newestShelf.length ? (
              <Shelf docs={data.newestShelf} />
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
          <div>
            <SectionEyebrow label={t("progressEyebrow")} />
            <ProgressPanel progress={data.progress} quiet={data.quietMode} />
          </div>
        </section>
      </Stagger>
    </div>
  );
}
