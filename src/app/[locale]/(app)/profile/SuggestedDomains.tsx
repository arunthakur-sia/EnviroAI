"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Sparkles, Check, X } from "lucide-react";
import { bi } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

export function SuggestedDomains({
  suggestions,
}: {
  suggestions: { id: string; nameEn: string; nameAr: string }[];
}) {
  const t = useTranslations("profile");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = React.useState(suggestions);

  async function act(id: string, action: "accept" | "dismiss") {
    setItems((prev) => prev.filter((i) => i.id !== id));
    const res = await fetch("/api/v1/profile/domains", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domainId: id, action }),
    });
    if (res.ok && action === "accept") toast(t("domainAccepted"), "points");
    router.refresh();
  }

  if (!items.length) return null;
  return (
    <div className="mb-6 rounded-xl border border-gold-300 bg-gold-100/40 p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-maroon-900">
        <Sparkles className="size-4 text-gold-500" /> {t("suggestedDomains")}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((s) => (
          <span
            key={s.id}
            className="flex items-center gap-1.5 rounded-lg border border-sand-300 bg-white px-2.5 py-1.5 text-sm text-ink-900"
          >
            {bi(locale, s.nameEn, s.nameAr)}
            <button
              onClick={() => act(s.id, "accept")}
              className="rounded p-0.5 text-ok hover:bg-ok-light cursor-pointer"
              aria-label={t("acceptDomain")}
            >
              <Check className="size-3.5" />
            </button>
            <button
              onClick={() => act(s.id, "dismiss")}
              className="rounded p-0.5 text-ink-400 hover:bg-danger-light hover:text-danger cursor-pointer"
              aria-label={t("dismissDomain")}
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
