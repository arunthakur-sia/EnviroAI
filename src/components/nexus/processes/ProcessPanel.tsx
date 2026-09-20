"use client";
// CR08 10.1: the process panel. 520px from the end side over a scrim, the
// same motion as the Council's project drawer. Purpose in both languages,
// the owner unit with its head (OwnerControl when the head holds an account,
// a placeholder block otherwise), the numbered steps with unit and system,
// inputs and outputs as two columns, the governing policies and SOPs as a
// mini shelf, KPIs, the interfaces linked to it, the RACI row and its editor,
// the ancestors as breadcrumbs, and "Ask about this process", which opens the
// Ask NPC panel with the process attached. Escape closes it.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Cpu,
  ExternalLink,
  Link as LinkIcon,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn, bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Avatar, Button, Chip, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { AskContextItem } from "@/components/nexus/ask/AskContextItem";
import { useAskPanel } from "@/components/nexus/ask/panel-store";
import { OwnerControl } from "@/components/nexus/people/OwnerControl";
import type { ProcessDetail, ProcessSummary, UnitRef } from "@/server/services/operating-model";
import type { UnitHeadRef } from "@/server/services/operating-model-unit";
import { PolicyMiniShelf } from "./PolicyMiniShelf";
import { RaciRow } from "./RaciRow";
import { LevelChip, SubHeading, UnitChip, cachedProcess, displayFont, fetchProcess, primeProcess, processHref, unitHref, useVocabulary } from "./shared";

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-5" aria-busy>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

function OwnerBlock({ unit, head, item }: { unit: UnitRef | null; head: UnitHeadRef | null; item: { type: string; id: string; titleEn: string; titleAr: string; href: string } }) {
  const t = useTranslations("processes");
  const locale = useLocale();
  if (!unit) return null;
  const published = head ? bi(locale, head.publishedNameEn ?? "", head.publishedNameAr ?? "") : "";
  const publishedTitle = head ? bi(locale, head.publishedTitleEn ?? "", head.publishedTitleAr ?? "") : "";
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl bg-sand-50 px-3.5 py-3" data-testid="process-owner">
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">{t("panel.owner")}</span>
        <Link
          href={unitHref(unit.code)}
          aria-label={t("panel.openUnit")}
          className="link-draw block text-sm font-medium text-maroon-700 hover:text-maroon-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
        >
          <span className="me-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-400 tnum rtl:tracking-normal">{unit.code}</span>
          {bi(locale, unit.nameEn, unit.nameAr)}
        </Link>
      </span>
      {head?.account ? (
        <OwnerControl owner={head.account} role="unit_head" item={item} size="sm" align="start" />
      ) : (
        <span className="flex items-center gap-2.5" data-testid="owner-placeholder">
          {published ? (
            <Avatar name={published} color="maroon" size={28} />
          ) : (
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-ink-200 text-xs text-ink-200" aria-hidden>
              ?
            </span>
          )}
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">{t("panel.unitHead")}</span>
            <span className={cn("block truncate text-[13px] leading-tight", published ? "font-medium text-ink-900" : "text-ink-400")}>
              {published || t("panel.headVacant")}
            </span>
            {publishedTitle ? <span className="block truncate text-[11px] text-ink-600">{publishedTitle}</span> : null}
          </span>
        </span>
      )}
    </div>
  );
}

function IoList({ items, label, empty, icon }: { items: ProcessDetail["inputs"]; label: string; empty: string; icon: React.ReactNode }) {
  const t = useTranslations("processes");
  const locale = useLocale();
  return (
    <div className="rounded-xl bg-sand-50 p-3">
      <SubHeading className="flex items-center gap-1.5">
        <span className="text-maroon-700 [&_svg]:size-3.5" aria-hidden>
          {icon}
        </span>
        {label}
      </SubHeading>
      {items.length ? (
        <ul className="flex flex-col gap-1.5">
          {items.map((io, i) => (
            <li key={i} className="text-[13px] leading-snug text-ink-900">
              {bi(locale, io.textEn, io.textAr)}
              {io.fromUnit ? (
                <span className="ms-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-400 tnum rtl:tracking-normal">
                  {t("panel.from", { unit: io.fromUnit.code })}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-600">{empty}</p>
      )}
    </div>
  );
}

export function ProcessPanel({
  code,
  initial = null,
  unitHeads,
  units,
  canEditRaci,
  canAddChild,
  keyboardLocked,
  refreshKey,
  onNavigate,
  onClose,
  onEdit,
  onDelete,
  onAddChild,
  onChanged,
}: {
  code: string;
  /** the server-loaded process of a deep link, so the first paint is complete */
  initial?: ProcessDetail | null;
  unitHeads: Record<string, UnitHeadRef>;
  units: UnitRef[];
  canEditRaci: boolean;
  /** the reader may add a process beneath this one (given its owner unit) */
  canAddChild: (detail: ProcessDetail) => boolean;
  /** an editor dialog is open above the panel: Escape belongs to it */
  keyboardLocked: boolean;
  /** bumps after a write so the panel refetches */
  refreshKey: number;
  onNavigate: (code: string) => void;
  onClose: () => void;
  onEdit: (detail: ProcessDetail) => void;
  onDelete: (detail: ProcessDetail) => void;
  onAddChild: (detail: ProcessDetail) => void;
  onChanged: () => void;
}) {
  const t = useTranslations("processes");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const { toast } = useToast();
  const ask = useAskPanel();
  const vocab = useVocabulary();
  const [detail, setDetail] = React.useState<ProcessDetail | null>(() => {
    if (initial && initial.code.toLowerCase() === code.toLowerCase()) {
      primeProcess(initial);
      return initial;
    }
    return cachedProcess(code);
  });
  const [failed, setFailed] = React.useState(false);
  const bodyRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(
    (force: boolean) => {
      let alive = true;
      setFailed(false);
      if (!force) {
        const cached = cachedProcess(code);
        if (cached) setDetail(cached);
      }
      void fetchProcess(code, force).then((data) => {
        if (!alive) return;
        if (data) setDetail(data);
        else setFailed(true);
      });
      return () => {
        alive = false;
      };
    },
    [code]
  );

  React.useEffect(() => load(refreshKey > 0), [load, refreshKey]);

  /* a new process starts at the top of the panel */
  React.useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [code]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      /* a dialog over the panel owns Escape: it marks the keystroke as handled
         (defaultPrevented) before this listener sees it, and the prop covers
         the render that has already dropped the dialog */
      if (keyboardLocked || e.defaultPrevented) return;
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, keyboardLocked]);

  const copyLink = () => {
    const url = `${window.location.origin}/${locale}${processHref(code)}`;
    void navigator.clipboard?.writeText(url);
    toast(t("panel.linkCopied"), "success");
  };

  const item = detail
    ? { type: "process", id: detail.id, titleEn: detail.nameEn, titleAr: detail.nameAr, href: processHref(detail.code) }
    : null;
  const name = detail ? bi(locale, detail.nameEn, detail.nameAr) : "";
  const purpose = detail ? bi(locale, detail.purposeEn ?? "", detail.purposeAr ?? "") : "";
  const purposeOther = detail ? (locale === "ar" ? detail.purposeEn : detail.purposeAr) : null;
  const canEdit = detail?.canEdit ?? false;
  const canDelete = canEdit && (detail?.children.length ?? 0) === 0;

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label={t("panel.aria")}
      data-testid="process-panel"
      data-code={code}
      data-ask-context={detail ? `process:${detail.code}` : undefined}
    >
      {/* The person card of the owner unit head is portalled to the body at
          z-50, beneath this panel (z-60), so it would open invisibly behind
          it. Lift it while the panel is mounted: radix reads the content's
          computed z-index and copies it onto its positioning wrapper. */}
      <style>{'[data-testid="person-card-popover"]{z-index:80}'}</style>
      <motion.button
        type="button"
        aria-label={t("panel.close")}
        className="absolute inset-0 cursor-pointer bg-ink-900/20"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduced ? undefined : { opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        className="absolute inset-y-0 end-0 flex w-full max-w-[520px] flex-col bg-white shadow-[var(--shadow-pop)]"
        initial={reduced ? false : { x: locale === "ar" ? "-100%" : "100%" }}
        animate={{ x: 0 }}
        exit={reduced ? undefined : { x: locale === "ar" ? "-100%" : "100%" }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* header bar: the Internal chip travels with the module */}
        <div className="flex items-center gap-1.5 border-b border-sand-100 px-4 py-3">
          <Chip tone="maroon" title={t("internalTitle")} data-testid="internal-chip">
            {t("internal")}
          </Chip>
          {detail?.isIllustrative ? (
            <Chip tone="gold" title={t("illustrativeTitle")} data-testid="illustrative-chip">
              {t("illustrative")}
            </Chip>
          ) : null}
          <span className="min-w-0 flex-1" />
          {detail && canEdit ? (
            <>
              <button
                type="button"
                onClick={() => onEdit(detail)}
                aria-label={t("panel.edit")}
                title={t("panel.edit")}
                data-testid="process-edit"
                className="cursor-pointer rounded-lg p-1.5 text-ink-600 hover:bg-sand-100 hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => (canDelete ? onDelete(detail) : toast(t("panel.deleteBlocked"), "error"))}
                aria-label={t("panel.delete")}
                title={canDelete ? t("panel.delete") : t("panel.deleteBlocked")}
                aria-disabled={!canDelete}
                data-testid="process-delete"
                className={cn(
                  "cursor-pointer rounded-lg p-1.5 text-ink-600 hover:bg-sand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500",
                  canDelete ? "hover:text-danger" : "opacity-40"
                )}
              >
                <Trash2 className="size-4" />
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={copyLink}
            aria-label={t("panel.copyLink")}
            className="cursor-pointer rounded-lg p-1.5 text-ink-600 hover:bg-sand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
          >
            <LinkIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("panel.close")}
            data-testid="process-panel-close"
            className="cursor-pointer rounded-lg p-1.5 text-ink-600 hover:bg-sand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* pb-16: the floating Ask NPC pill sits over the bottom end corner */}
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto pb-16">
          {!detail && !failed ? (
            <PanelSkeleton />
          ) : failed || !detail ? (
            <div className="p-6">
              <p className="text-sm text-ink-600">{t("panel.notFound")}</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => load(true)}>
                {t("panel.retry")}
              </Button>
            </div>
          ) : (
            <motion.div
              key={detail.id}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.16 }}
              className="flex flex-col gap-5 p-5"
            >
              {/* CR08 2.3: the Ask NPC launcher knows this process while the panel is open */}
              <AskContextItem
                item={{ kind: "process", id: detail.id, code: detail.code, titleEn: detail.nameEn, titleAr: detail.nameAr, href: processHref(detail.code) }}
              />

              {/* where this sits */}
              {detail.ancestors.length ? (
                <nav aria-label={t("panel.breadcrumb")} className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] text-ink-600" data-testid="process-breadcrumb">
                  {detail.ancestors.map((a: ProcessSummary) => (
                    <React.Fragment key={a.id}>
                      <button
                        type="button"
                        onClick={() => onNavigate(a.code)}
                        className="link-draw cursor-pointer rounded text-ink-600 hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
                      >
                        <span className="tnum">{a.code}</span> {bi(locale, a.nameEn, a.nameAr)}
                      </button>
                      <ArrowRight className="size-3 shrink-0 text-ink-400 flip-rtl" aria-hidden />
                    </React.Fragment>
                  ))}
                  <span className="tnum font-medium text-ink-900">{detail.code}</span>
                </nav>
              ) : null}

              {/* identity */}
              <div>
                <p className="flex flex-wrap items-center gap-2 text-xs text-ink-600">
                  <LevelChip level={detail.level} />
                  <span className="tnum font-semibold text-maroon-700">{detail.code}</span>
                  <Chip tone={detail.status === "active" ? "ok" : detail.status === "draft" ? "sand" : "ghost"}>
                    {t(`panel.status.${detail.status}` as never)}
                  </Chip>
                </p>
                <h2 className="mt-1.5 text-xl leading-snug" style={{ fontFamily: displayFont(locale) }} data-testid="process-title">
                  {name}
                </h2>
                {purpose ? (
                  <div className="mt-2">
                    <SubHeading>{t("panel.purpose")}</SubHeading>
                    <p className="text-sm leading-relaxed text-ink-900">{purpose}</p>
                    {purposeOther ? (
                      <p
                        dir={locale === "ar" ? "ltr" : "rtl"}
                        lang={locale === "ar" ? "en" : "ar"}
                        data-testid="purpose-other"
                        /* text-start: the quoted language governs the block, so
                           its label sits at the start of the quote, not at the
                           start of the page */
                        className="mt-1.5 rounded-lg bg-sand-50 px-3 py-2 text-start text-[13px] leading-relaxed text-ink-600"
                      >
                        <span className="mb-0.5 block text-start text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                          {locale === "ar" ? t("panel.inEnglish") : t("panel.inArabic")}
                        </span>
                        {purposeOther}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* owner unit and its head */}
              <OwnerBlock unit={detail.ownerUnit} head={detail.ownerUnit ? unitHeads[detail.ownerUnit.id] ?? null : null} item={item!} />

              {/* ask about this process */}
              <Button variant="secondary" onClick={() => ask.open({ focus: true })} data-testid="process-ask" className="self-start">
                <Sparkles className="text-gold-500" /> {t("panel.ask")}
              </Button>

              {/* steps */}
              <div>
                <SubHeading>{t("panel.steps")}</SubHeading>
                {detail.steps.length ? (
                  <ol className="relative ms-3 flex flex-col gap-3 border-s border-sand-300 ps-5" data-testid="process-steps">
                    {detail.steps.map((s) => (
                      <li key={s.n} className="relative" data-testid="process-step" aria-label={t("panel.stepAria", { n: s.n })}>
                        <span
                          className="absolute -start-8 top-0 flex size-6 items-center justify-center rounded-full bg-maroon-700 text-[11px] font-semibold text-white tnum ring-2 ring-white"
                          aria-hidden
                        >
                          {s.n}
                        </span>
                        <p className="text-sm leading-relaxed text-ink-900">{bi(locale, s.textEn, s.textAr)}</p>
                        {s.roleUnit || s.system ? (
                          <p className="mt-1 flex flex-wrap items-center gap-1.5">
                            {s.roleUnit ? <UnitChip unit={s.roleUnit} className="bg-sand-50" /> : null}
                            {s.system ? (
                              <Chip tone="gulf" title={t("panel.system")}>
                                <Cpu className="size-3" aria-hidden />
                                {s.system}
                              </Chip>
                            ) : null}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="rounded-lg border border-dashed border-sand-300 bg-sand-50 px-3 py-4 text-center text-xs text-ink-600">{t("panel.noSteps")}</p>
                )}
              </div>

              {/* inputs and outputs */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="process-io">
                <IoList items={detail.inputs} label={t("panel.inputs")} empty={t("panel.noInputs")} icon={<ArrowDownToLine />} />
                <IoList items={detail.outputs} label={t("panel.outputs")} empty={t("panel.noOutputs")} icon={<ArrowUpFromLine />} />
              </div>

              {/* governing policies and SOPs */}
              <div>
                <SubHeading>{t("panel.documents")}</SubHeading>
                <PolicyMiniShelf policies={detail.policies} sops={detail.sops} />
              </div>

              {/* systems and KPIs */}
              {detail.systems.length ? (
                <div>
                  <SubHeading>{t("panel.systems")}</SubHeading>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.systems.map((s, i) => (
                      <Chip key={i} tone="gulf">
                        <Cpu className="size-3" aria-hidden />
                        {bi(locale, s.nameEn, s.nameAr)}
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : null}
              <div>
                <SubHeading>{t("panel.kpis")}</SubHeading>
                {detail.kpis.length ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="process-kpis">
                    {detail.kpis.map((k, i) => (
                      <div key={i} className="rounded-xl border border-sand-200 bg-white px-3 py-2.5">
                        <p className="text-[13px] font-medium leading-snug text-ink-900">{bi(locale, k.nameEn, k.nameAr)}</p>
                        {k.target ? (
                          <p className="mt-1 text-xs text-maroon-900 tnum">
                            {t("panel.target", { target: `${k.target}${k.unit ? ` ${vocab.unit(k.unit)}` : ""}` })}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-ink-600">{t("panel.noKpis")}</p>
                )}
              </div>

              {/* interfaces */}
              <div data-testid="process-interfaces">
                <SubHeading>{t("panel.interfaces")}</SubHeading>
                {detail.interfaces.internal.length || detail.interfaces.external.length ? (
                  <div className="flex flex-col gap-3">
                    {detail.interfaces.internal.length ? (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400 rtl:tracking-normal">{t("panel.internal")}</p>
                        <ul className="flex flex-col gap-1.5">
                          {detail.interfaces.internal.map((i) => (
                            <li key={i.id} className="rounded-lg bg-sand-50 px-3 py-2 text-[13px] text-ink-900">
                              <span className="flex flex-wrap items-center gap-1.5">
                                <span className="font-medium">{i.fromUnit.code}</span>
                                <ArrowRight className="size-3.5 text-ink-400 flip-rtl" aria-hidden />
                                <span className="font-medium">{i.toUnit.code}</span>
                                <Chip tone="sand">{t(`panel.flow.${i.flowKind}` as never)}</Chip>
                                {i.cadence ? <span className="text-[11px] text-ink-600">{vocab.cadence(i.cadence)}</span> : null}
                              </span>
                              {i.descriptionEn || i.descriptionAr ? (
                                <span className="mt-0.5 block text-xs leading-snug text-ink-600">{bi(locale, i.descriptionEn ?? "", i.descriptionAr ?? "")}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {detail.interfaces.external.length ? (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400 rtl:tracking-normal">{t("panel.external")}</p>
                        <ul className="flex flex-col gap-1.5">
                          {detail.interfaces.external.map((e) => (
                            <li key={e.id} className="rounded-lg bg-sand-50 px-3 py-2 text-[13px] text-ink-900">
                              <span className="font-medium">
                                {bi(locale, e.entity.shortNameEn ?? e.entity.nameEn, e.entity.shortNameAr ?? e.entity.nameAr)}
                              </span>
                              {e.providesEn || e.providesAr ? (
                                <span className="mt-0.5 block text-xs leading-snug text-ink-600">
                                  <span className="font-semibold text-ink-900">{t("panel.provides")}: </span>
                                  {bi(locale, e.providesEn ?? "", e.providesAr ?? "")}
                                </span>
                              ) : null}
                              {e.receivesEn || e.receivesAr ? (
                                <span className="mt-0.5 block text-xs leading-snug text-ink-600">
                                  <span className="font-semibold text-ink-900">{t("panel.receives")}: </span>
                                  {bi(locale, e.receivesEn ?? "", e.receivesAr ?? "")}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <Link
                      href="/operating-model?section=interfaces"
                      className="link-draw inline-flex items-center gap-1 self-start text-[11px] font-medium text-maroon-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
                    >
                      <ExternalLink className="size-3" aria-hidden /> {t("panel.openInterfaces")}
                    </Link>
                  </div>
                ) : (
                  <p className="text-xs text-ink-600">{t("panel.noInterfaces")}</p>
                )}
              </div>

              {/* RACI */}
              <div>
                <SubHeading>{t("panel.raci")}</SubHeading>
                <RaciRow processId={detail.id} raci={detail.raci} units={units} canEdit={canEditRaci} onChanged={onChanged} />
              </div>

              {/* beneath it */}
              {detail.children.length || canAddChild(detail) ? (
                <div>
                  <SubHeading>{t("panel.children")}</SubHeading>
                  {detail.children.length ? (
                    <ul className="flex flex-col gap-1" data-testid="process-children">
                      {detail.children.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => onNavigate(c.code)}
                            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[13px] text-ink-900 hover:bg-sand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
                          >
                            <span className="shrink-0 text-[11px] font-semibold text-maroon-700 tnum">{c.code}</span>
                            <span className="min-w-0 flex-1 truncate">{bi(locale, c.nameEn, c.nameAr)}</span>
                            <ArrowRight className="size-3.5 shrink-0 text-ink-400 flip-rtl" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {canAddChild(detail) && detail.level < 2 ? (
                    <Button size="sm" variant="ghost" className="mt-1" onClick={() => onAddChild(detail)} data-testid="process-add-child">
                      <Plus /> {detail.level === 0 ? t("l0.addLevel1") : t("l0.addLevel2")}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <p className="text-[11px] text-ink-400 tnum">{t("panel.updated", { date: formatDate(detail.updatedAt, locale, { style: "medium" }) })}</p>
            </motion.div>
          )}
        </div>
      </motion.aside>
      {/* a dialog opened from the panel floats above it (z-75): dim the panel
          the way that dialog's own overlay dims the page behind it */}
      {keyboardLocked ? <span aria-hidden className="absolute inset-0 bg-ink-900/25 backdrop-blur-[2px]" /> : null}
    </div>
  );
}
