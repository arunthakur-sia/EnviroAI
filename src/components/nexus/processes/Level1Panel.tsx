"use client";
// CR08 10.1: the panel that opens beneath the chain for one Level 0 process,
// in the language of the Office's goal panel: a sand surface, the big faint
// number, the eyebrow, the purpose and the owner, then every Level 1 process
// as a row with its Level 2 procedures nested. Any row opens the process
// panel; arrow keys move within a level, Escape closes.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, ExternalLink, Plus, X } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Button, Chip } from "@/components/ui/primitives";
import { OwnerControl } from "@/components/nexus/people/OwnerControl";
import type { ProcessMapNode, ProcessSummary } from "@/server/services/operating-model";
import type { UnitHeadAccount, UnitHeadRef } from "@/server/services/operating-model-unit";
import { SubHeading, UnitChip, displayFont, levelNumber, processHref } from "./shared";

/** CR08 9.1: the process as the item a person card is opened for. */
function processItem(node: { id: string; code: string; nameEn: string; nameAr: string }) {
  return { type: "process", id: node.id, titleEn: node.nameEn, titleAr: node.nameAr, href: processHref(node.code) };
}

function Level2Row({ node, onOpen }: { node: ProcessSummary; onOpen: () => void }) {
  const t = useTranslations("processes");
  const locale = useLocale();
  const name = bi(locale, node.nameEn, node.nameAr);
  const docs = node.counts.policies + node.counts.sops;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        data-process-level="2"
        data-testid="process-l2-row"
        data-code={node.code}
        aria-label={t("l0.openRow", { code: node.code, title: name })}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-mist-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
      >
        <span className="shrink-0 rounded-md bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-600 tnum">{node.code}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink-900">{name}</span>
        {node.ownerUnit ? (
          <span className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-400 tnum sm:inline rtl:tracking-normal">
            {node.ownerUnit.code}
          </span>
        ) : null}
        {docs > 0 ? <Chip tone="mist">{t("map.docCount", { count: docs })}</Chip> : null}
        <ChevronRight className="size-3.5 shrink-0 text-ink-400 flip-rtl" aria-hidden />
      </button>
    </li>
  );
}

function Level1Row({
  node,
  head,
  onOpen,
  onOpenChild,
}: {
  node: ProcessMapNode["children"][number];
  /** the head of the owner unit, when they hold an account (CR08 9.1) */
  head: UnitHeadAccount | null;
  onOpen: () => void;
  onOpenChild: (code: string) => void;
}) {
  const t = useTranslations("processes");
  const locale = useLocale();
  const name = bi(locale, node.nameEn, node.nameAr);
  const docs = node.counts.policies + node.counts.sops;
  return (
    <div
      className="rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-paper)] transition-shadow duration-200 hover:shadow-[var(--shadow-lift)]"
      data-testid="process-l1-card"
      data-code={node.code}
    >
      <button
        type="button"
        onClick={onOpen}
        data-process-level="1"
        data-testid="process-l1-row"
        data-code={node.code}
        aria-label={t("l0.openRow", { code: node.code, title: name })}
        className="flex w-full cursor-pointer items-start gap-3 rounded-[var(--radius-card)] px-4 py-3 text-start outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
      >
        <span className="mt-0.5 flex h-6 shrink-0 items-center justify-center rounded-md bg-navy-100 px-1.5 text-[11px] font-semibold text-navy-900 tnum">
          {node.code}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium leading-snug text-ink-900">{name}</span>
          {/* spacing rather than middots: a separator that wraps to the end of
              a line reads as a typo */}
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-600 tnum">
            {node.ownerUnit ? <UnitChip unit={node.ownerUnit} link={false} /> : null}
            <span>{t("map.procedureCount", { count: node.counts.procedures })}</span>
            <span>{t("map.docCount", { count: docs })}</span>
            <span>{t("map.raciCount", { count: node.counts.raci })}</span>
            {node.isIllustrative ? <Chip tone="aqua">{t("illustrative")}</Chip> : null}
          </span>
        </span>
        <ChevronRight className="mt-1 size-4 shrink-0 text-ink-400 flip-rtl" aria-hidden />
      </button>
      {/* CR08 9.1: the head of the owner unit, a sibling of the row button
          (a person card opens from a button and may never sit inside one) */}
      {head ? (
        <div className="border-t border-mist-100 px-4 py-2" data-testid="process-l1-owner">
          <OwnerControl owner={head} role="unit_head" size="sm" align="start" item={processItem(node)} />
        </div>
      ) : null}
      {node.children.length ? (
        <div className="border-t border-mist-100 px-2.5 py-2">
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400 rtl:tracking-normal">{t("l0.procedures")}</p>
          <ul className="flex flex-col gap-0.5">
            {node.children.map((child) => (
              <Level2Row key={child.id} node={child} onOpen={() => onOpenChild(child.code)} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function Level1Panel({
  node,
  unitHeads,
  onOpen,
  onClose,
  canAdd,
  onAdd,
}: {
  node: ProcessMapNode;
  /** CR08 9.1: the heads of the owner units, keyed by unit id, as the process panel takes them */
  unitHeads: Record<string, UnitHeadRef>;
  onOpen: (code: string) => void;
  onClose: () => void;
  /** the reader may add a Level 1 process beneath this one */
  canAdd: boolean;
  onAdd: () => void;
}) {
  const t = useTranslations("processes");
  const locale = useLocale();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const name = bi(locale, node.nameEn, node.nameAr);
  const purpose = bi(locale, node.purposeEn ?? "", node.purposeAr ?? "");
  const headOf = (unitId: string | null | undefined): UnitHeadAccount | null =>
    (unitId ? unitHeads[unitId]?.account : null) ?? null;

  /* arrows move within a level, Escape closes the panel */
  function onKeyDown(e: React.KeyboardEvent) {
    const active = document.activeElement as HTMLElement | null;
    const level = active?.getAttribute("data-process-level");
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (!level || !["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const rows = [...(panelRef.current?.querySelectorAll<HTMLElement>(`[data-process-level="${level}"]`) ?? [])];
    const index = rows.indexOf(active as HTMLElement);
    if (index < 0) return;
    const forwardKey = locale === "ar" ? "ArrowLeft" : "ArrowRight";
    const delta = e.key === "ArrowDown" || e.key === forwardKey ? 1 : -1;
    const next = rows[index + delta];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  }

  return (
    <div
      ref={panelRef}
      onKeyDown={onKeyDown}
      className="relative overflow-hidden rounded-2xl bg-mist-100"
      data-testid="level1-panel"
      data-code={node.code}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-1 start-4 select-none font-semibold text-navy-100"
        style={{ fontFamily: "var(--font-display)", fontSize: 96, lineHeight: 1 }}
      >
        {levelNumber(node.code)}
      </span>

      <div className="relative px-5 py-6 sm:px-7">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 max-w-2xl flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-navy-700 tnum rtl:tracking-normal">
              {t("l0.eyebrow", { code: node.code })}
            </p>
            <h2 className="mt-1 text-2xl leading-tight sm:text-[30px]" style={{ fontFamily: displayFont(locale) }}>
              {name}
            </h2>
            {purpose ? <p className="mt-2 text-sm leading-relaxed text-ink-600">{purpose}</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {node.ownerUnit ? <UnitChip unit={node.ownerUnit} /> : null}
              {node.isIllustrative ? (
                <Chip tone="aqua" title={t("illustrativeTitle")}>
                  {t("illustrative")}
                </Chip>
              ) : null}
              <Chip tone="mist">{t("map.interfaceCount", { count: node.counts.interfaces })}</Chip>
            </div>
            {/* CR08 9.1: the head of the unit that owns this Level 0 process */}
            {headOf(node.ownerUnit?.id) ? (
              <div className="mt-3" data-testid="level1-panel-owner">
                <OwnerControl owner={headOf(node.ownerUnit?.id)!} role="unit_head" size="sm" align="start" item={processItem(node)} />
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => onOpen(node.code)} data-testid="level1-open-l0">
              <ExternalLink /> {t("l0.open", { code: node.code })}
            </Button>
            {canAdd ? (
              <Button size="sm" variant="ghost" onClick={onAdd} data-testid="level1-add">
                <Plus /> {t("l0.addLevel1")}
              </Button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label={t("l0.close")}
              data-testid="level1-close"
              className="cursor-pointer rounded-lg p-1.5 text-ink-600 hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-5">
          <SubHeading>{t("l0.level1")}</SubHeading>
          {node.children.length ? (
            <div className={cn("grid grid-cols-1 gap-3", node.children.length > 1 && "lg:grid-cols-2")}>
              {node.children.map((child) => (
                <Level1Row
                  key={child.id}
                  node={child}
                  head={headOf(child.ownerUnit?.id)}
                  onOpen={() => onOpen(child.code)}
                  onOpenChild={onOpen}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-mist-300 bg-mist-50 px-3 py-6 text-center text-sm text-ink-600">
              {t("l0.noLevel1", { code: node.code })}
            </p>
          )}
        </div>
        <p className="mt-4 hidden text-[11px] text-ink-600 lg:block">{t("l0.keyboard")}</p>
      </div>
    </div>
  );
}
