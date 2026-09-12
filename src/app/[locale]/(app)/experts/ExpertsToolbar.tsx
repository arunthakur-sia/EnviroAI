"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Input, NativeSelect } from "@/components/ui/primitives";

export function ExpertsToolbar({
  topics,
}: {
  topics: { code: string; nameEn: string; nameAr: string }[];
}) {
  const t = useTranslations("experts");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = React.useState(sp.get("q") ?? "");

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}` as never, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParam("q", q || null);
        }}
        className="relative w-full max-w-md"
      >
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="ps-9"
        />
      </form>
      <NativeSelect
        value={sp.get("type") ?? ""}
        onChange={(e) => setParam("type", e.target.value || null)}
        className={cn("w-auto", sp.get("type") && "border-maroon-300")}
        aria-label={t("filterType")}
      >
        <option value="">{t("filterType")}</option>
        {["npc_employee", "government", "academic", "consultant", "international"].map((v) => (
          <option key={v} value={v}>
            {t(`types.${v}` as never)}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        value={sp.get("domain") ?? ""}
        onChange={(e) => setParam("domain", e.target.value || null)}
        className={cn("w-auto max-w-48", sp.get("domain") && "border-maroon-300")}
        aria-label={t("filterDomain")}
      >
        <option value="">{t("filterDomain")}</option>
        {topics.map((topic) => (
          <option key={topic.code} value={topic.code}>
            {bi(locale, topic.nameEn, topic.nameAr)}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        value={sp.get("availability") ?? ""}
        onChange={(e) => setParam("availability", e.target.value || null)}
        className={cn("w-auto", sp.get("availability") && "border-maroon-300")}
        aria-label={t("filterAvailability")}
      >
        <option value="">{t("filterAvailability")}</option>
        {["available", "limited", "unavailable"].map((v) => (
          <option key={v} value={v}>
            {t(`availability.${v}` as never)}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
