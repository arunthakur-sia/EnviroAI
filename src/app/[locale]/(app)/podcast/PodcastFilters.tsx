"use client";
// CR02 4.6: library filters by outcome, focus, and language.
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { cn, bi } from "@/lib/utils";
import { NativeSelect } from "@/components/ui/primitives";

export function PodcastFilters({
  outcomes,
}: {
  outcomes: { code: string; nameEn: string; nameAr: string }[];
}) {
  const t = useTranslations("podcast");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}` as never, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        value={sp.get("outcome") ?? ""}
        onChange={(e) => setParam("outcome", e.target.value || null)}
        className={cn("w-auto max-w-52", sp.get("outcome") && "border-navy-300")}
        aria-label={t("filterOutcome")}
      >
        <option value="">{t("filterOutcome")}</option>
        {outcomes.map((o) => (
          <option key={o.code} value={o.code}>
            {bi(locale, o.nameEn, o.nameAr)}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        value={sp.get("focus") ?? ""}
        onChange={(e) => setParam("focus", e.target.value || null)}
        className={cn("w-auto", sp.get("focus") && "border-navy-300")}
        aria-label={t("filterFocus")}
      >
        <option value="">{t("filterFocus")}</option>
        {(["overview", "lessons", "numbers", "risks"] as const).map((f) => (
          <option key={f} value={f}>
            {t(`focus.${f}`)}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        value={sp.get("language") ?? ""}
        onChange={(e) => setParam("language", e.target.value || null)}
        className={cn("w-auto", sp.get("language") && "border-navy-300")}
        aria-label={t("filterLanguage")}
      >
        <option value="">{t("filterLanguage")}</option>
        <option value="ar">{t("langNames.ar")}</option>
        <option value="en">{t("langNames.en")}</option>
      </NativeSelect>
    </div>
  );
}
