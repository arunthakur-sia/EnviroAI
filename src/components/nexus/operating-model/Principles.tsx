"use client";
// CR08 10.2 section 1: the operating principles as an editorial band. Five to
// seven numbered statements in the display face with the reason beneath each;
// editors edit in place, add up to seven and remove.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { bi, cn } from "@/lib/utils";
import { Button, Chip, EmptyState, Input, Label, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { Principle } from "@/server/services/operating-model";
import { EASE, SectionBand, displayFont, omFetch } from "./shared";

const MAX_PRINCIPLES = 7;

type Draft = { titleEn: string; titleAr: string; textEn: string; textAr: string };

function draftOf(p: Principle | null): Draft {
  return {
    titleEn: p?.titleEn ?? "",
    titleAr: p?.titleAr ?? "",
    textEn: p?.textEn ?? "",
    textAr: p?.textAr ?? "",
  };
}

function PrincipleForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: Draft;
  busy: boolean;
  onSave: (draft: Draft) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("operatingModel");
  const [draft, setDraft] = React.useState<Draft>(initial);
  const firstRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    firstRef.current?.focus();
  }, []);
  const valid = draft.titleEn.trim().length > 0 && draft.titleAr.trim().length > 0;
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      data-testid="principle-form"
    >
      <div>
        <Label htmlFor="pr-title-en">{t("principles.titleEn")}</Label>
        <Input
          id="pr-title-en"
          ref={firstRef}
          value={draft.titleEn}
          onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })}
          dir="ltr"
          maxLength={200}
          data-testid="principle-title-en"
        />
      </div>
      <div>
        <Label htmlFor="pr-title-ar">{t("principles.titleAr")}</Label>
        <Input
          id="pr-title-ar"
          value={draft.titleAr}
          onChange={(e) => setDraft({ ...draft, titleAr: e.target.value })}
          dir="rtl"
          maxLength={200}
          data-testid="principle-title-ar"
        />
      </div>
      <div>
        <Label htmlFor="pr-text-en">{t("principles.textEn")}</Label>
        <Textarea
          id="pr-text-en"
          value={draft.textEn}
          onChange={(e) => setDraft({ ...draft, textEn: e.target.value })}
          dir="ltr"
          maxLength={1000}
          className="min-h-20"
        />
      </div>
      <div>
        <Label htmlFor="pr-text-ar">{t("principles.textAr")}</Label>
        <Textarea
          id="pr-text-ar"
          value={draft.textAr}
          onChange={(e) => setDraft({ ...draft, textAr: e.target.value })}
          dir="rtl"
          maxLength={1000}
          className="min-h-20"
        />
      </div>
      <div className="flex items-center gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={!valid} loading={busy} data-testid="principle-save">
          {t("actions.save")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {t("actions.cancel")}
        </Button>
        {!valid ? <span className="text-xs text-ink-400">{t("actions.required")}</span> : null}
      </div>
    </form>
  );
}

export function Principles({
  principles,
  canEdit,
  isIllustrative,
  n,
}: {
  principles: Principle[];
  canEdit: boolean;
  isIllustrative: boolean;
  n: number;
}) {
  const t = useTranslations("operatingModel");
  const locale = useLocale();
  const router = useRouter();
  const reduced = useReducedMotion();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<string | "new" | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function save(id: string | null, draft: Draft) {
    setBusy(true);
    const body = {
      ...(id ? { id } : {}),
      titleEn: draft.titleEn.trim(),
      titleAr: draft.titleAr.trim(),
      textEn: draft.textEn.trim() || null,
      textAr: draft.textAr.trim() || null,
    };
    const res = await omFetch("/api/v1/operating-model/principles", { method: id ? "PATCH" : "POST", body });
    setBusy(false);
    if (res.ok) {
      toast(t("principles.saved"), "success");
      setEditing(null);
      router.refresh();
    } else {
      toast(res.status === 403 ? t("actions.forbidden") : t("actions.failed"), "error");
    }
  }

  async function remove(p: Principle) {
    if (!window.confirm(t("principles.deleteConfirm"))) return;
    const res = await omFetch(`/api/v1/operating-model/principles?id=${encodeURIComponent(p.id)}`, { method: "DELETE" });
    if (res.ok) {
      toast(t("principles.deleted"), "success");
      router.refresh();
    } else {
      toast(res.status === 403 ? t("actions.forbidden") : t("actions.failed"), "error");
    }
  }

  const atMax = principles.length >= MAX_PRINCIPLES;

  return (
    <SectionBand
      id="om-principles"
      n={n}
      eyebrow={t("section.n", { n })}
      title={t("principles.title")}
      hint={t("principles.hint")}
      testId="om-principles"
      aside={
        <>
          <Chip tone="sand" className="tnum" data-testid="principles-count">
            {t("principles.count", { count: principles.length })}
          </Chip>
          {canEdit ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEditing("new")}
              disabled={atMax || editing === "new"}
              title={atMax ? t("principles.max") : undefined}
              data-testid="principle-add"
            >
              <Plus /> {t("principles.add")}
            </Button>
          ) : null}
        </>
      }
    >
      {principles.length === 0 && editing !== "new" ? (
        <EmptyState
          title={t("principles.empty")}
          hint={t("principles.emptyHint")}
          action={
            canEdit ? (
              <Button size="sm" onClick={() => setEditing("new")}>
                <Plus /> {t("principles.add")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-2xl bg-sand-100 px-5 py-6 sm:px-7 sm:py-8" data-testid="principles-band">
          <ol className="grid gap-x-10 gap-y-7 md:grid-cols-2 xl:grid-cols-3" data-testid="principles-list">
            {principles.map((p, i) => {
              const isEditing = editing === p.id;
              return (
                <li
                  key={p.id}
                  className={cn("relative min-w-0", isEditing && "md:col-span-2 xl:col-span-3")}
                  data-testid="om-principle"
                >
                  <AnimatePresence initial={false} mode="wait">
                    {isEditing ? (
                      <motion.div
                        key="form"
                        initial={reduced ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={reduced ? undefined : { opacity: 0 }}
                        transition={{ duration: 0.2, ease: EASE }}
                        className="rounded-xl border border-maroon-300 bg-white p-4"
                      >
                        <PrincipleForm
                          initial={draftOf(p)}
                          busy={busy}
                          onSave={(d) => void save(p.id, d)}
                          onCancel={() => setEditing(null)}
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="read"
                        initial={reduced ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={reduced ? undefined : { opacity: 0 }}
                        transition={{ duration: 0.2, ease: EASE }}
                        className="group/principle flex gap-4"
                      >
                        <span
                          className="mt-0.5 shrink-0 select-none text-[34px] font-semibold leading-none text-maroon-300 tnum"
                          style={{ fontFamily: displayFont(locale) }}
                          aria-hidden
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-[19px] leading-snug text-ink-900 sm:text-[21px]"
                            style={{ fontFamily: displayFont(locale) }}
                          >
                            <span className="sr-only">{i + 1}. </span>
                            {bi(locale, p.titleEn, p.titleAr)}
                          </p>
                          {p.textEn || p.textAr ? (
                            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{bi(locale, p.textEn, p.textAr)}</p>
                          ) : null}
                          {canEdit ? (
                            <div className="mt-2 flex items-center gap-1 opacity-70 transition-opacity group-hover/principle:opacity-100 focus-within:opacity-100">
                              <button
                                type="button"
                                onClick={() => setEditing(p.id)}
                                aria-label={t("principles.editAria", { n: i + 1 })}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-ink-600 hover:bg-white hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-gold-500"
                                data-testid="principle-edit"
                              >
                                <Pencil className="size-3.5" aria-hidden /> {t("actions.edit")}
                              </button>
                              <button
                                type="button"
                                onClick={() => void remove(p)}
                                aria-label={t("principles.deleteAria", { n: i + 1 })}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-ink-600 hover:bg-white hover:text-danger focus-visible:outline-2 focus-visible:outline-gold-500"
                                data-testid="principle-delete"
                              >
                                <Trash2 className="size-3.5" aria-hidden /> {t("actions.delete")}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
            {editing === "new" ? (
              <li className="md:col-span-2 xl:col-span-3">
                <div className="rounded-xl border border-maroon-300 bg-white p-4">
                  <PrincipleForm
                    initial={draftOf(null)}
                    busy={busy}
                    onSave={(d) => void save(null, d)}
                    onCancel={() => setEditing(null)}
                  />
                </div>
              </li>
            ) : null}
          </ol>
          {isIllustrative && principles.some((p) => p.isIllustrative) ? (
            <p className="mt-6 text-[11px] text-ink-400">{t("illustrativeTitle")}</p>
          ) : null}
        </div>
      )}
    </SectionBand>
  );
}
