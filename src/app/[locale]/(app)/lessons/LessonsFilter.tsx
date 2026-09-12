"use client";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { cn, bi } from "@/lib/utils";
import { NativeSelect } from "@/components/ui/primitives";

export function LessonsFilter({
  outcomes,
  hasClusters,
}: {
  outcomes: { code: string; nameEn: string; nameAr: string }[];
  hasClusters: boolean;
}) {
  const t = useTranslations("lessons");
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

  const view = sp.get("view") ?? "feed";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasClusters ? (
        <div className="inline-flex items-center gap-0.5 rounded-xl bg-sand-100 p-1">
          {(["feed", "clusters"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setParam("view", mode === "feed" ? null : mode)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm transition-colors cursor-pointer",
                view === mode ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600"
              )}
            >
              {t(`views.${mode}`)}
            </button>
          ))}
        </div>
      ) : null}
      <NativeSelect
        value={sp.get("outcome") ?? ""}
        onChange={(e) => setParam("outcome", e.target.value || null)}
        className={cn("w-auto max-w-52", sp.get("outcome") && "border-maroon-300")}
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
        value={sp.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value || null)}
        className={cn("w-auto", sp.get("status") && "border-maroon-300")}
        aria-label={t("filterStatus")}
      >
        <option value="">{t("filterStatus")}</option>
        <option value="published">{t("statusPublished")}</option>
        <option value="verified">{t("statusVerified")}</option>
      </NativeSelect>
    </div>
  );
}
