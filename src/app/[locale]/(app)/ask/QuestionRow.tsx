"use client";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { MessageCircle, Award } from "lucide-react";
import { bi } from "@/lib/utils";
import { relativeTime } from "@/lib/format";
import { Avatar, Chip } from "@/components/ui/primitives";

export function QuestionRow({
  q,
}: {
  q: {
    id: string;
    titleEn: string;
    titleAr: string;
    status: string;
    createdAt: string;
    authorNameEn: string;
    authorNameAr: string;
    authorColor: string;
    answerCount: number;
    bountyId?: string | null;
  };
}) {
  const locale = useLocale();
  const tc = useTranslations("common");
  const statusTone: Record<string, "mist" | "teal" | "ok" | "warn" | "info"> = {
    open: "warn",
    ai_answered: "info",
    routed: "teal",
    answered: "teal",
    verified: "ok",
    closed: "mist",
  };
  return (
    <Link href={`/ask/${q.id}` as never} className="flex items-center gap-3 px-4 py-3 hover:bg-navy-50">
      <Avatar name={q.authorNameEn} color={q.authorColor} size={30} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">
          {bi(locale, q.titleEn, q.titleAr)}
        </p>
        <p className="text-xs text-ink-400">
          {bi(locale, q.authorNameEn, q.authorNameAr)} · {relativeTime(q.createdAt, locale)}
        </p>
      </div>
      {q.bountyId ? (
        <Award className="size-4 shrink-0 text-aqua-500" />
      ) : null}
      <span className="flex shrink-0 items-center gap-1 text-xs text-ink-400 tnum">
        <MessageCircle className="size-3.5" /> {q.answerCount}
      </span>
      <Chip tone={statusTone[q.status] ?? "mist"}>{tc(`status.${q.status}` as never)}</Chip>
    </Link>
  );
}
