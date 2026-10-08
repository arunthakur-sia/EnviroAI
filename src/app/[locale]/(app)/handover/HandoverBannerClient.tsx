"use client";
// CR08 6.3: the dismissible recipient banner (dismissal remembered per
// handover in this browser; the persistent Handover page keeps the state).
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, X } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { HandoverKind } from "@/server/services/handover";

type Item = { id: string; kind: HandoverKind; nameEn: string; nameAr: string; avatarColor: string; lastWorkingDay: string | null; pct: number | null; items: number };

const KEY = "enviroai.handover.banner.dismissed";

export function HandoverBannerClient({ items }: { items: Item[] }) {
  const t = useTranslations("handover.banner");
  const th = useTranslations("handover");
  const locale = useLocale();
  // The banner renders on the server so it is present in the first paint
  // (the common case is "not dismissed"); the effect then hides the ones this
  // browser has already dismissed.
  const [dismissed, setDismissed] = React.useState<string[]>([]);

  React.useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
      if (Array.isArray(stored) && stored.length) {
        setDismissed(stored.filter((x): x is string => typeof x === "string"));
      }
    } catch {
      /* private mode: nothing is remembered */
    }
  }, []);

  const visible = items.filter((i) => !dismissed.includes(i.id));
  if (!visible.length) return null;

  function dismiss(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  }

  return (
    <div className="flex flex-col gap-2" data-testid="handover-banner">
      {visible.map((h) => (
        <div key={h.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-aqua-300 bg-aqua-100/50 px-4 py-3" role="status">
          <Avatar name={h.nameEn} color={h.avatarColor} size={32} />
          <p className="min-w-0 flex-1 text-sm text-ink-900">
            <span className="font-medium">{t("title")}</span>{" "}
            <span className="text-ink-600">
              {t("line", { name: bi(locale, h.nameEn, h.nameAr), kind: th(`kinds.${h.kind}`), count: h.items })}
              {h.lastWorkingDay ? ` ${t("until", { date: formatDate(h.lastWorkingDay, locale) })}` : ""}
              {h.pct !== null ? ` ${t("progress", { pct: h.pct })}` : ""}
            </span>
          </p>
          <Link
            href={`/handover/${h.id}` as never}
            className="inline-flex items-center gap-1.5 rounded-lg bg-navy-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-navy-900 focus-visible:outline-2 focus-visible:outline-aqua-500"
            data-testid="handover-banner-open"
          >
            {t("open")} <ArrowRight className="size-3.5 flip-rtl" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => dismiss(h.id)}
            className="cursor-pointer rounded-md p-1 text-ink-400 hover:bg-mist-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-aqua-500"
            aria-label={t("dismiss")}
            data-testid="handover-banner-dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
