"use client";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Lightbulb, BadgeCheck, Recycle } from "lucide-react";
import { bi } from "@/lib/utils";
import { Chip } from "@/components/ui/primitives";

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
};

/* CR02 3.1: one tone per category, consistent everywhere. */
export const CATEGORY_TONES: Record<string, "maroon" | "gulf" | "gold" | "sand"> = {
  delivery: "maroon",
  external: "gulf",
  expert: "gold",
  institutional: "sand",
};

export function LessonCard({
  lesson,
  showCategory = false,
}: {
  lesson: LessonCardData;
  showCategory?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("lessons");
  const category = lesson.category ?? null;
  return (
    <Link href={`/lessons/${lesson.id}` as never} className="card card-hover flex h-full flex-col gap-2 p-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="size-4 shrink-0 text-gold-500" />
        <p className="line-clamp-2 flex-1 font-medium leading-snug text-ink-900">
          {bi(locale, lesson.titleEn, lesson.titleAr)}
        </p>
        {lesson.status === "verified" ? (
          <BadgeCheck className="size-4 shrink-0 text-gulf-600" />
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
                <span className="ms-1.5 whitespace-nowrap font-medium text-maroon-700">
                  {t("readMore")}
                </span>
              ) : null}
            </p>
          );
        })()
      ) : null}
      {(lesson.recommendationEn || lesson.recommendationAr) ? (
        <p className="line-clamp-2 rounded-lg bg-gulf-100/50 px-2.5 py-1.5 text-xs leading-relaxed text-gulf-600">
          {bi(locale, lesson.recommendationEn ?? "", lesson.recommendationAr ?? "")}
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {showCategory && category ? (
          <Chip tone={CATEGORY_TONES[category] ?? "sand"}>
            {t(`categories.${category}` as never)}
          </Chip>
        ) : null}
        {lesson.nodeCode ? (
          <Chip tone="sand">{lesson.nodeCode}</Chip>
        ) : lesson.outcomeNameEn ? (
          <Chip tone="maroon">{bi(locale, lesson.outcomeNameEn, lesson.outcomeNameAr ?? "")}</Chip>
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
