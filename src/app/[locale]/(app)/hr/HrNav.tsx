"use client";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TABS: { href: string; key: string; exact?: boolean }[] = [
  { href: "/hr", key: "overview", exact: true },
  { href: "/hr/departments", key: "departments" },
  { href: "/hr/people", key: "people" },
  { href: "/hr/handovers", key: "handovers" },
  { href: "/hr/risks", key: "risks" },
];

export function HrNav() {
  const t = useTranslations("hr.nav");
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1 border-b border-mist-300" aria-label={t("aria")}>
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.key}
            href={tab.href as never}
            className={cn(
              "-mb-px border-b-2 px-3.5 py-2 text-sm transition-colors",
              active
                ? "border-navy-700 font-medium text-navy-700"
                : "border-transparent text-ink-600 hover:text-ink-900"
            )}
            aria-current={active ? "page" : undefined}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
