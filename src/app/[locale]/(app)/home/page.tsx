import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Quote, Lightbulb as LightbulbIcon, ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { getHomeData } from "@/server/services/home";
import { bi } from "@/lib/utils";
import { formatDate, formatHijri } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { Reveal, Stagger } from "@/components/motion";
import { Avatar, Chip, RagDot } from "@/components/ui/primitives";
import { Shelf } from "@/components/nexus/Shelf";
import { LessonCard } from "@/components/nexus/LessonCard";
import { DailyFactCard } from "./DailyFactCard";
import { FootprintCard } from "./FootprintCard";
import { MysteryCard } from "./MysteryCard";
import { HomeAsk } from "./HomeAsk";

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

  return (
    <div>
      {/* Greeting + word of the day */}
      <Reveal>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-[28px]">{t(`greeting.${greetingKey}`, { name: firstName })}</h1>
          <p className="text-sm text-ink-400">
            <span className="tnum">{formatDate(todayIso, locale, { style: "long", numerals: user.numeralsPref })}</span>
            <span className="ms-2 text-xs">· {formatHijri(todayIso, locale)}</span>
          </p>
        </div>
        {data.word ? (
          <div
            className="mb-6 flex items-start gap-2.5 border-s-2 border-gold-500 ps-3 text-sm text-ink-600"
            data-testid="word-strip"
          >
            <Quote className="mt-0.5 size-3.5 shrink-0 text-gold-500" aria-hidden />
            <p className="leading-relaxed">
              {bi(locale, data.word.textEn, data.word.textAr)}
              {(data.word.attributionEn || data.word.attributionAr) ? (
                <span className="ms-1.5 text-xs text-ink-400">
                  · {bi(locale, data.word.attributionEn ?? "", data.word.attributionAr ?? "")}
                </span>
              ) : null}
            </p>
          </div>
        ) : null}
      </Reveal>

      {/* Ask SiaNexus (CR01 3.2) */}
      <Reveal delay={0.03}>
        <HomeAsk
          examples={data.exampleQuestions}
          continueConversation={data.todayConversation}
        />
      </Reveal>

      {/* Hero row: daily fact + for you */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {data.card ? (
            <DailyFactCard card={data.card} quiet={data.quietMode} />
          ) : null}
        </div>
        <Reveal delay={0.08} className="flex flex-col">
          <div className="card flex h-full flex-col p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
              {t("forYou")}
            </p>
            <div className="flex flex-col gap-3.5">
              {data.forYou.map((item, i) => (
                <Link key={i} href={item.link as never} className="group">
                  <p className="text-[11px] font-medium text-gulf-600">
                    {bi(locale, item.hintEn, item.hintAr)}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-ink-900 group-hover:text-maroon-900">
                    {bi(locale, item.titleEn, item.titleAr)}
                  </p>
                </Link>
              ))}
              {data.forYou.length === 0 ? (
                <p className="text-sm text-ink-400">{t("forYouEmpty")}</p>
              ) : null}
            </div>
          </div>
        </Reveal>
      </div>

      {/* What changed in NDS3 */}
      {data.changed?.highlights.length ? (
        <Reveal delay={0.1}>
          <div className="card mb-6 p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                {t("whatChanged")}
              </p>
              <Link
                href="/strategy"
                className="flex items-center gap-1 text-xs font-medium text-maroon-700 hover:underline"
              >
                {t("openStrategy")} <ArrowRight className="size-3 flip-rtl" />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {data.changed.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-xl bg-sand-50 px-3.5 py-3">
                  <RagDot status={h.kind === "risk" ? "at_risk" : "on_track"} className="mt-1.5" />
                  <p className="text-sm leading-relaxed text-ink-900">
                    {locale === "ar" ? h.text_ar : h.text_en}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      ) : null}

      {/* Lessons + footprint */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2" data-testid="home-lessons">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
              {t("latestLessons")}
            </p>
            <Link href="/lessons" className="text-xs font-medium text-maroon-700 hover:underline">
              {t("allLessons")}
            </Link>
          </div>
          <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-3" step={0.05}>
            {data.lessons.map((l) => (
              <LessonCard key={l.id} lesson={l} />
            ))}
          </Stagger>
        </div>
        {!data.quietMode ? (
          <FootprintCard footprint={data.footprint} />
        ) : null}
      </div>

      {/* Mystery + spotlight */}
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {data.mystery ? (
          <div className="lg:col-span-2">
            <MysteryCard mystery={data.mystery} />
          </div>
        ) : null}
        {data.spotlight ? (
          <Reveal delay={0.12}>
            <div className="card flex h-full flex-col justify-center gap-3 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gold-500">
                {t("spotlight")}
              </p>
              <div className="flex items-center gap-3">
                <Avatar name={data.spotlight.nameEn} color={data.spotlight.color} size={44} />
                <div>
                  <p className="font-medium text-ink-900">
                    {bi(locale, data.spotlight.nameEn, data.spotlight.nameAr)}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink-600">
                    {bi(locale, data.spotlight.blurbEn ?? "", data.spotlight.blurbAr ?? "")}
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        ) : null}
      </div>

      {/* Newest shelf */}
      {data.newestShelf.length ? (
        <Reveal delay={0.14}>
          <div className="mb-2 flex items-center justify-between" data-testid="newest-shelf">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
              {t("newestShelf")}
            </p>
            <Link href="/vault" className="text-xs font-medium text-maroon-700 hover:underline">
              {t("openVault")}
            </Link>
          </div>
          <Shelf docs={data.newestShelf} />
        </Reveal>
      ) : null}
    </div>
  );
}
