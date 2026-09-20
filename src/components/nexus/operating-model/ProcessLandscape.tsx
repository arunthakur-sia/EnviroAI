"use client";
// CR08 10.2 section 3: the Level 0 chain embedded on the Operating Model.
// The sibling Processes page owns the full chain component
// (src/components/nexus/processes/ProcessChain); until it lands this file
// draws a minimal chain of its own with the same data and the same links
// (/processes?p=CODE), so the coordinator can swap the import in one place.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, ChevronRight, Workflow } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { bi, cn } from "@/lib/utils";
import { Chip, EmptyState } from "@/components/ui/primitives";
import type { ProcessMapNode } from "@/server/services/operating-model";
import { SectionBand, displayFont } from "./shared";

function processHref(code: string): string {
  return `/processes?p=${encodeURIComponent(code)}`;
}

function levelNumber(code: string): string {
  const m = code.match(/\d+/);
  return m ? m[0] : code;
}

function ChainCard({ node, index }: { node: ProcessMapNode; index: number }) {
  const t = useTranslations("operatingModel");
  const locale = useLocale();
  const name = bi(locale, node.nameEn, node.nameAr);
  return (
    <Link
      href={processHref(node.code) as never}
      aria-label={t("processes.openAria", { code: node.code, name })}
      data-testid="chain-card"
      data-code={node.code}
      className="card card-hover group/chain relative flex w-[236px] shrink-0 snap-start flex-col gap-2 px-4 py-3.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
    >
      <span className="flex items-center gap-2">
        <span
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-maroon-100 text-[15px] font-semibold text-maroon-900 tnum"
          style={{ fontFamily: displayFont(locale) }}
          aria-hidden
        >
          {levelNumber(node.code) || index + 1}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400 tnum rtl:tracking-normal">{node.code}</span>
        <ArrowRight className="ms-auto size-4 text-ink-200 transition-colors group-hover/chain:text-maroon-700 flip-rtl" aria-hidden />
      </span>
      <span className="line-clamp-2 min-h-10 text-sm font-medium leading-snug text-ink-900 group-hover/chain:text-maroon-900">{name}</span>
      <span className="text-[11px] text-ink-600">
        {node.ownerUnit ? (
          <>
            <span className="text-ink-400">{t("processes.owner")}: </span>
            <span className="font-medium text-ink-900">{node.ownerUnit.code}</span>
          </>
        ) : (
          t("processes.noOwner")
        )}
      </span>
      <span className="text-[11px] text-ink-600 tnum">
        {t("processes.level1", { count: node.children.length })}
        {node.counts.procedures ? <>, {t("processes.procedures", { count: node.counts.procedures })}</> : null}
      </span>
      {node.children.length ? (
        <span className="mt-0.5 flex flex-col gap-0.5 border-t border-sand-100 pt-2" aria-hidden>
          {node.children.slice(0, 3).map((c) => (
            <span key={c.id} className="truncate text-[11px] text-ink-600">
              <span className="text-ink-400 tnum">{c.code}</span> {bi(locale, c.nameEn, c.nameAr)}
            </span>
          ))}
        </span>
      ) : null}
    </Link>
  );
}

export function ProcessLandscape({ chain, n }: { chain: ProcessMapNode[]; n: number }) {
  const t = useTranslations("operatingModel");
  return (
    <SectionBand
      id="om-processes"
      n={n}
      eyebrow={t("section.n", { n })}
      title={t("processes.title")}
      hint={t("processes.hint")}
      testId="om-processes"
      aside={
        <Link
          href={"/processes" as never}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-sand-300 bg-white px-3 text-xs font-medium text-ink-900 transition-colors hover:border-maroon-300 hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
          data-testid="processes-open-page"
        >
          <Workflow className="size-3.5" aria-hidden /> {t("processes.openPage")}
        </Link>
      }
    >
      {chain.length === 0 ? (
        <EmptyState icon={<Workflow />} title={t("processes.empty")} hint={t("processes.emptyHint")} />
      ) : (
        <div
          className="-mx-1 overflow-x-auto px-1 pb-3"
          style={{ overscrollBehaviorX: "contain" }}
          data-testid="process-chain"
        >
          <ol className="flex snap-x items-stretch gap-1 py-1" aria-label={t("processes.chainAria")}>
            {chain.map((node, i) => (
              <li key={node.id} className="flex items-center gap-1">
                <ChainCard node={node} index={i} />
                {i < chain.length - 1 ? (
                  <span className={cn("flex w-6 shrink-0 items-center justify-center text-sand-300")} aria-hidden>
                    <ChevronRight className="size-5 flip-rtl" />
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      )}
      {chain.some((c) => c.isIllustrative) ? (
        <p className="mt-1 flex items-center gap-2 text-[11px] text-ink-400">
          <Chip tone="sand">{t("illustrative")}</Chip>
          {t("illustrativeTitle")}
        </p>
      ) : null}
    </SectionBand>
  );
}
