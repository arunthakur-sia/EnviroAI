"use client";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FileText, BarChart3, Compass, Users, MessageCircleQuestion, Lightbulb } from "lucide-react";
import { bi, truncate } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  document: FileText,
  indicator: BarChart3,
  node: Compass,
  expert: Users,
  question: MessageCircleQuestion,
  lesson: Lightbulb,
};

const HREFS: Record<string, (id: string) => string> = {
  document: (id) => `/vault/${id}`,
  indicator: (id) => `/statistics/${id}`,
  node: (id) => `/strategy/${id}`,
  expert: (id) => `/experts/${id}`,
  question: (id) => `/ask/${id}`,
  lesson: (id) => `/lessons/${id}`,
};

export function RelatedStrip({
  related,
}: {
  related: {
    type: string;
    id: string;
    relation: string;
    source: string;
    titleEn: string;
    titleAr: string;
  }[];
}) {
  const t = useTranslations("reader");
  const locale = useLocale();
  const items = related.filter((r) => r.titleEn || r.titleAr);
  if (!items.length) return null;
  return (
    <div className="mt-10">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
        {t("related")}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.slice(0, 12).map((r, i) => {
          const Icon = ICONS[r.type] ?? FileText;
          return (
            <Link
              key={i}
              href={(HREFS[r.type]?.(r.id) ?? "#") as never}
              className="flex items-center gap-2 rounded-xl border border-mist-300 bg-white px-3 py-2 text-sm text-ink-900 transition-colors hover:border-navy-300 hover:text-navy-900"
            >
              <Icon className="size-4 shrink-0 text-ink-400" />
              <span>{truncate(bi(locale, r.titleEn, r.titleAr), 48)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
