"use client";
// The mystery shelf: one spine, a hook line, and the pull of curiosity.
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Sparkles } from "lucide-react";
import { bi } from "@/lib/utils";
import { Reveal } from "@/components/motion";

export function MysteryCard({
  mystery,
}: {
  mystery: { id: string; hookEn: string; hookAr: string };
}) {
  const t = useTranslations("home");
  const locale = useLocale();
  const router = useRouter();

  async function open() {
    fetch("/api/v1/gamification/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "mystery_shelf_opened",
        resourceType: "document",
        resourceId: mystery.id,
      }),
    }).catch(() => {});
    router.push(`/vault/${mystery.id}` as never);
  }

  return (
    <Reveal delay={0.12}>
      <button
        onClick={open}
        className="card card-hover flex h-full w-full items-center gap-5 p-5 text-start cursor-pointer"
        data-testid="mystery"
      >
        {/* mystery spine */}
        <span className="relative flex h-32 w-9 shrink-0 items-center justify-center rounded-t-[3px] rounded-b-[2px] bg-gradient-to-b from-maroon-700 to-maroon-900 shadow-md">
          <span className="font-[family-name:var(--font-display)] text-xl font-semibold text-gold-300">
            ?
          </span>
        </span>
        <span>
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-maroon-700">
            <Sparkles className="size-3.5 text-gold-500" /> {t("mysteryShelf")}
          </span>
          <span className="mt-1.5 block text-[15px] leading-relaxed text-ink-900">
            {bi(locale, mystery.hookEn, mystery.hookAr)}
          </span>
          <span className="mt-1 block text-xs text-ink-400">{t("mysteryHint")}</span>
        </span>
      </button>
    </Reveal>
  );
}
