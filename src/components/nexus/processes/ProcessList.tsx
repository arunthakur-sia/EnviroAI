"use client";
// CR08 10.1: a list of processes as rows (level chip, code, name, counts).
// With onOpen the rows open the panel in place; without it each row is a link
// to /processes?p=CODE, which is how the Organisation unit panel uses it.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Chip } from "@/components/ui/primitives";
import type { ProcessSummary } from "@/server/services/operating-model";
import { LevelChip, processHref } from "./shared";

export function ProcessList({
  processes,
  onOpen,
  className,
}: {
  processes: ProcessSummary[];
  onOpen?: (code: string) => void;
  className?: string;
}) {
  const t = useTranslations("processes");
  const locale = useLocale();
  const sorted = [...processes].sort((a, b) => a.level - b.level || a.code.localeCompare(b.code, undefined, { numeric: true }));
  return (
    <ul className={cn("flex flex-col gap-1.5", className)} data-testid="process-list">
      {sorted.map((p) => {
        const name = bi(locale, p.nameEn, p.nameAr);
        const docs = p.counts.policies + p.counts.sops;
        const body = (
          <>
            <LevelChip level={p.level} />
            <span className="shrink-0 text-[11px] font-semibold text-navy-700 tnum">{p.code}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-ink-900">{name}</span>
            {/* the name carries the row: only the document count travels with
                it, since these lists sit in narrow columns and panels */}
            {docs > 0 ? (
              <span className="hidden shrink-0 items-center text-[11px] text-ink-600 tnum sm:flex">
                <Chip tone="mist">{t("map.docCount", { count: docs })}</Chip>
              </span>
            ) : null}
            <ChevronRight className="size-4 shrink-0 text-ink-400 flip-rtl" aria-hidden />
          </>
        );
        const classes =
          "flex w-full cursor-pointer items-center gap-2.5 rounded-xl bg-white px-3 py-2 text-start shadow-[var(--shadow-paper)] transition-all duration-200 ease-[var(--ease-paper)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500";
        return (
          <li key={p.id} data-testid="process-list-row" data-code={p.code}>
            {onOpen ? (
              <button type="button" onClick={() => onOpen(p.code)} aria-label={t("l0.openRow", { code: p.code, title: name })} title={name} className={classes}>
                {body}
              </button>
            ) : (
              <Link href={processHref(p.code)} aria-label={t("unitTab.open", { code: p.code })} title={name} className={classes}>
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
