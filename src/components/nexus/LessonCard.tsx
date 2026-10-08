"use client";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Lightbulb, BadgeCheck, Recycle } from "lucide-react";
import { bi } from "@/lib/utils";
import { Chip } from "@/components/ui/primitives";
import { KowRibbon } from "@/components/nexus/kow/KowRibbon";

export type LessonCardData = {
  id: string;
  titleEn: string;
  titleAr: string;
  contextEn?: string | null;
  contextAr?: string | null;
  learningEn?: string | null;
  learningAr?: string | null;
  recommendationEn?: string | null;
  recommendationAr?: string | null;
  status: string;
  reuseCount?: number;
  outcomeNameEn?: string | null;
  outcomeNameAr?: string | null;
  /* CR02 3.1 */
  category?: string | null;
  nodeCode?: string | null;
  nodeTitleEn?: string | null;
  nodeTitleAr?: string | null;
  /* CR08 8: this week's Knowledge of the Week; undefined lets the ribbon look itself up */
  kow?: boolean;
};

/* CR02 3.1: one tone per category, consistent everywhere. */
export const CATEGORY_TONES: Record<string, "navy" | "teal" | "aqua" | "mist"> = {
  delivery: "navy",
  external: "teal",
  expert: "aqua",
  institutional: "mist",
};

export function LessonCard({
  lesson,
  showCategory = false,
  kow,
}: {
  lesson: LessonCardData;
  showCategory?: boolean;
  /** CR08 8: pass when the server knows; omitted, the ribbon looks itself up */
  kow?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("lessons");
  const category = lesson.category ?? null;
  /* CR03 4.3: the category chip fills with its colour on hover */
  const chipFill: Record<string, string> = {
    delivery: "group-hover/lesson:bg-navy-700 group-hover/lesson:text-white",
    external: "group-hover/lesson:bg-teal-600 group-hover/lesson:text-white",
    expert: "group-hover/lesson:bg-aqua-500 group-hover/lesson:text-white",
    institutional: "group-hover/lesson:bg-mist-300 group-hover/lesson:text-ink-900",
  };
  return (
    <Link href={`/lessons/${lesson.id}` as never} className="group/lesson card card-hover flex h-full flex-col gap-2 p-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="size-4 shrink-0 text-aqua-500" />
        <p className="line-clamp-2 flex-1 font-medium leading-snug text-ink-900">
          {bi(locale, lesson.titleEn, lesson.titleAr)}
        </p>
        {lesson.status === "verified" ? (
          <BadgeCheck className="size-4 shrink-0 text-teal-600" />
        ) : null}
      </div>
      {(lesson.learningEn || lesson.learningAr) ? (
        (() => {
          // CR02 3.1: the card shows the first 240 characters with Read more
          const full = bi(locale, lesson.learningEn ?? "", lesson.learningAr ?? "");
          const long = full.length > 240;
          return (
            <p className="text-sm leading-relaxed text-ink-600">
              {long ? full.slice(0, 240).trimEnd() + "…" : full}
              {long ? (
                <span className="ms-1.5 whitespace-nowrap font-medium text-navy-700">
                  {t("readMore")}
                </span>
              ) : null}
            </p>
          );
        })()
      ) : null}
      {/* the clamp sits on an inner span: on the padded box it cuts at the
          padding edge and leaves a sliver of the third line showing */}
      {(lesson.recommendationEn || lesson.recommendationAr) ? (
        <p className="rounded-lg bg-teal-100/50 px-2.5 py-1.5 text-xs leading-relaxed text-teal-600">
          <span className="line-clamp-2 block">
            {bi(locale, lesson.recommendationEn ?? "", lesson.recommendationAr ?? "")}
          </span>
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {/* CR08 8: the aqua ribbon on this week's pick */}
        <KowRibbon resourceType="lesson" resourceId={lesson.id} active={kow ?? lesson.kow} />
        {showCategory && category ? (
          <Chip
            tone={CATEGORY_TONES[category] ?? "mist"}
            className={`transition-colors duration-200 ${chipFill[category] ?? ""}`}
          >
            {t(`categories.${category}` as never)}
          </Chip>
        ) : null}
        {/* CR03 4.3: the outcome dot pulses once on hover */}
        <span
          aria-hidden
          className="inline-block size-2 rounded-full bg-navy-500 group-hover/lesson:[animation:dot-once_600ms_ease-out]"
        />
        {lesson.nodeCode ? (
          <Chip tone="mist">{lesson.nodeCode}</Chip>
        ) : lesson.outcomeNameEn ? (
          <Chip tone="navy">{bi(locale, lesson.outcomeNameEn, lesson.outcomeNameAr ?? "")}</Chip>
        ) : null}
        {lesson.reuseCount ? (
          <span className="ms-auto flex items-center gap-1 text-[11px] text-ink-400 tnum">
            <Recycle className="size-3" /> {t("reused", { count: lesson.reuseCount })}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
