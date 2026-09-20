"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Bell } from "lucide-react";
import { relativeTime } from "@/lib/format";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
} from "@/components/ui/overlays";

type Notification = {
  id: string;
  kind: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string | null;
  bodyAr: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationsMenu({ unreadCount }: { unreadCount: number }) {
  const t = useTranslations("shell");
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = React.useState<Notification[] | null>(null);
  const [count, setCount] = React.useState(unreadCount);

  async function load() {
    try {
      const res = await fetch("/api/v1/notifications");
      const json = await res.json();
      setItems(json.data ?? []);
    } catch {
      setItems([]);
    }
  }

  async function markAllRead() {
    setCount(0);
    await fetch("/api/v1/notifications", { method: "PATCH" }).catch(() => {});
  }

  return (
    <Dropdown
      onOpenChange={(open) => {
        if (open) {
          load();
          if (count > 0) markAllRead();
        }
      }}
    >
      <DropdownTrigger asChild>
        <button
          className="relative rounded-lg p-2 text-bar-ink hover:bg-white/15 cursor-pointer"
          // the count is drawn in the badge, so the name has to carry it too or
          // the visible text and the accessible name disagree
          aria-label={t("notificationsUnread", { count })}
        >
          <Bell className="size-5" />
          {count > 0 ? (
            <span className="absolute -top-0.5 -end-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-semibold text-ink-900">
              {count > 9 ? "9+" : count}
            </span>
          ) : null}
        </button>
      </DropdownTrigger>
      <DropdownContent align="end" className="w-96 p-0">
        <p className="border-b border-sand-100 px-4 py-2.5 text-sm font-medium text-ink-900">
          {t("notifications")}
        </p>
        <div className="max-h-96 overflow-y-auto">
          {items === null ? (
            <p className="px-4 py-6 text-center text-sm text-ink-400">…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-400">{t("noNotifications")}</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => n.link && router.push(n.link)}
                className="flex w-full flex-col items-start gap-0.5 border-b border-sand-100 px-4 py-3 text-start last:border-0 hover:bg-maroon-100/40"
              >
                <span className="text-sm text-ink-900">
                  {locale === "ar" ? n.titleAr : n.titleEn}
                </span>
                {(locale === "ar" ? n.bodyAr : n.bodyEn) ? (
                  <span className="line-clamp-2 text-xs text-ink-600">
                    {locale === "ar" ? n.bodyAr : n.bodyEn}
                  </span>
                ) : null}
                <span className="text-[11px] text-ink-400">
                  {relativeTime(n.createdAt, locale)}
                </span>
              </button>
            ))
          )}
        </div>
      </DropdownContent>
    </Dropdown>
  );
}
