"use client";
// Filter rail + view toggle for the Vault. All state lives in the URL.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, Rows3, BookCopy, X } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { NativeSelect, Button } from "@/components/ui/primitives";

type Term = { id: string; code: string; nameEn: string; nameAr: string };

export function VaultToolbar({
  terms,
  departments,
}: {
  terms: Record<string, Term[]>;
  departments: { code: string; nameEn: string; nameAr: string }[];
}) {
  const t = useTranslations("vault");
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

  const view = sp.get("view") ?? "shelves";
  const activeFilters = ["type", "outcome", "sector", "topic", "department", "status", "classification", "language", "year"].filter((k) => sp.get(k));

  const select = (key: string, list: Term[], placeholder: string) => (
    <NativeSelect
      value={sp.get(key) ?? ""}
      onChange={(e) => setParam(key, e.target.value || null)}
      className={cn("w-auto min-w-32 max-w-44", sp.get(key) && "border-maroon-300 text-maroon-900")}
      aria-label={placeholder}
    >
      <option value="">{placeholder}</option>
      {list.map((term) => (
        <option key={term.code} value={term.code}>
          {bi(locale, term.nameEn, term.nameAr)}
        </option>
      ))}
    </NativeSelect>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-0.5 rounded-xl bg-sand-100 p-1" role="tablist" aria-label={t("viewToggle")}>
        {(
          [
            ["shelves", BookCopy],
            ["grid", LayoutGrid],
            ["list", Rows3],
          ] as const
        ).map(([mode, Icon]) => (
          <button
            key={mode}
            role="tab"
            aria-selected={view === mode}
            onClick={() => setParam("view", mode === "shelves" ? null : mode)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors cursor-pointer",
              view === mode ? "bg-white text-maroon-900 shadow-sm" : "text-ink-600 hover:text-ink-900"
            )}
          >
            <Icon className="size-4" /> {t(`views.${mode}`)}
          </button>
        ))}
      </div>

      {/* CR03 1.1: the shelf order is fixed by knowledge type, so the old
          group-by select is gone. */}
      {select("type", terms.knowledge_type ?? [], t("filterType"))}
      {select("outcome", terms.outcome ?? [], t("filterOutcome"))}
      {select("sector", terms.sector ?? [], t("filterSector"))}
      {select("topic", terms.topic ?? [], t("filterTopic"))}
      <NativeSelect
        value={sp.get("department") ?? ""}
        onChange={(e) => setParam("department", e.target.value || null)}
        className={cn("w-auto min-w-32 max-w-44", sp.get("department") && "border-maroon-300")}
        aria-label={t("filterDepartment")}
      >
        <option value="">{t("filterDepartment")}</option>
        {departments.map((d) => (
          <option key={d.code} value={d.code}>
            {bi(locale, d.nameEn, d.nameAr)}
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
        {["verified", "draft", "under_review", "archived"].map((s) => (
          <option key={s} value={s}>
            {t(`statuses.${s}`)}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        value={sp.get("sort") ?? "newest"}
        onChange={(e) => setParam("sort", e.target.value === "newest" ? null : e.target.value)}
        className="w-auto"
        aria-label={t("sortLabel")}
      >
        <option value="newest">{t("sort.newest")}</option>
        <option value="reused">{t("sort.reused")}</option>
        <option value="viewed">{t("sort.viewed")}</option>
        <option value="review_due">{t("sort.review_due")}</option>
      </NativeSelect>

      {activeFilters.length ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const next = new URLSearchParams();
            const view = sp.get("view");
            if (view) next.set("view", view);
            router.push(`${pathname}?${next.toString()}` as never, { scroll: false });
          }}
        >
          <X /> {t("clearFilters")}
        </Button>
      ) : null}
    </div>
  );
}
