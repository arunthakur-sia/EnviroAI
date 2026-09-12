"use client";
// CR02 3.3: the four lesson categories as a segmented control with counts.
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const CATEGORIES = ["delivery", "external", "expert", "institutional"] as const;

export function CategoryTabs({
  counts,
}: {
  counts: Record<string, number>;
}) {
  const t = useTranslations("lessons");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const active = sp.get("category") ?? "";
  const total = CATEGORIES.reduce((s, c) => s + (counts[c] ?? 0), 0);

  function setCategory(value: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set("category", value);
    else next.delete("category");
    router.push(`${pathname}?${next.toString()}` as never, { scroll: false });
  }

  return (
    <div
      className="inline-flex flex-wrap items-center gap-0.5 rounded-xl bg-sand-100 p-1"
      role="tablist"
      data-testid="category-tabs"
    >
      <button
        role="tab"
        aria-selected={!active}
        onClick={() => setCategory(null)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors cursor-pointer",
          !active ? "bg-white font-medium text-maroon-900 shadow-sm" : "text-ink-600 hover:text-ink-900"
        )}
      >
        {t("categoriesAll")}
        <span className="text-[11px] text-ink-600 tnum">{total}</span>
      </button>
      {CATEGORIES.map((c) => (
        <button
          key={c}
          role="tab"
          aria-selected={active === c}
          onClick={() => setCategory(c)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors cursor-pointer",
            active === c
              ? "bg-white font-medium text-maroon-900 shadow-sm"
              : "text-ink-600 hover:text-ink-900"
          )}
        >
          {t(`categories.${c}`)}
          <span className="text-[11px] text-ink-600 tnum">{counts[c] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}
