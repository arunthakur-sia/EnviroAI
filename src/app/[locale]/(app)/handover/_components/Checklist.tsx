"use client";
// CR08 6.2: the checklist by category with status chips, the recipient of
// each item and the required handover note. The administrator passes extra
// per-item controls (scope tick, recipient select); the person and the
// token holder edit the notes.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, Check, PencilLine, Database } from "lucide-react";
import { Avatar, Button, Chip, EmptyState, Textarea } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { bi, cn } from "@/lib/utils";
import type { HandoverDetail, ItemView } from "@/server/services/handover";
import { ItemStatusChip } from "./bits";

export function Checklist({
  categories,
  canEditNotes,
  onSaveNote,
  renderControls,
  showRecipient = true,
  showFiling = true,
  showUnderstood,
  compact,
}: {
  categories: HandoverDetail["categories"];
  canEditNotes: boolean;
  onSaveNote?: (itemId: string, note: string) => Promise<void>;
  renderControls?: (item: ItemView) => React.ReactNode;
  showRecipient?: boolean;
  /** the filing state is internal administration: the external person's
      token workspace never shows it */
  showFiling?: boolean;
  showUnderstood?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("handover");
  const locale = useLocale();
  if (!categories.length) return <EmptyState title={t("checklist.empty")} hint={t("checklist.emptyHint")} />;
  return (
    <div className="flex flex-col gap-5" data-testid="handover-checklist">
      {categories.map((cat) => {
        const inScope = cat.items.filter((i) => i.inScope && i.status !== "not_needed");
        const done = inScope.filter((i) => i.status !== "pending").length;
        return (
          <section key={cat.code} data-testid={`checklist-${cat.code}`}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="font-display text-base text-ink-900">
                {t(`categories.${cat.code}`)} <span className="ms-1 text-xs font-normal text-ink-600 tnum">{cat.items.length}</span>
              </h3>
              <span className="text-xs text-ink-600 tnum">{t("checklist.doneOf", { done, total: inScope.length })}</span>
            </div>
            <div className="card divide-y divide-sand-100" role="table" aria-label={t(`categories.${cat.code}`)}>
              <div role="row" className="sr-only">
                <span role="columnheader">{t("checklist.item")}</span>
                <span role="columnheader">{t("checklist.recipient")}</span>
                <span role="columnheader">{t("checklist.status")}</span>
              </div>
              {cat.items.map((item) => (
                <ChecklistRow
                  key={item.id}
                  item={item}
                  locale={locale}
                  canEditNotes={canEditNotes}
                  onSaveNote={onSaveNote}
                  controls={renderControls?.(item)}
                  showRecipient={showRecipient}
                  showFiling={showFiling}
                  showUnderstood={Boolean(showUnderstood)}
                  compact={Boolean(compact)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ChecklistRow({
  item,
  locale,
  canEditNotes,
  onSaveNote,
  controls,
  showRecipient,
  showFiling,
  showUnderstood,
  compact,
}: {
  item: ItemView;
  locale: string;
  canEditNotes: boolean;
  onSaveNote?: (itemId: string, note: string) => Promise<void>;
  controls?: React.ReactNode;
  showRecipient: boolean;
  showFiling: boolean;
  showUnderstood: boolean;
  compact: boolean;
}) {
  const t = useTranslations("handover");
  const tc = useTranslations("common");
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(item.note ?? "");
  const [saving, setSaving] = React.useState(false);
  const needsNote = item.inScope && item.recipientKind === "person" && !(item.note ?? "").trim();

  async function save() {
    if (!onSaveNote) return;
    setSaving(true);
    try {
      await onSaveNote(item.id, draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div role="row" className={cn("flex flex-col gap-2 px-4 py-3", !item.inScope && "opacity-60")} data-testid="checklist-item" data-item-id={item.id}>
      <div className="flex flex-wrap items-center gap-3">
        {controls}
        <div role="cell" className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 text-sm text-ink-900">
            {item.href ? (
              <Link href={item.href as never} className="link-draw truncate font-medium">
                {item.title}
              </Link>
            ) : (
              <span className="truncate font-medium">{item.title}</span>
            )}
            {item.href ? <ArrowUpRight className="size-3.5 shrink-0 text-ink-400 flip-rtl" aria-hidden /> : null}
          </p>
          {!compact && item.note && !editing ? (
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-600" dir="auto">
              {item.note}
            </p>
          ) : null}
        </div>
        {showRecipient ? (
          <div role="cell" className="flex items-center gap-1.5 text-xs text-ink-600">
            {item.recipientKind === "system" ? (
              <Chip tone="gulf">
                <Database className="size-3" aria-hidden /> {t("recipientKinds.system")}
              </Chip>
            ) : item.recipient ? (
              <>
                <Avatar name={item.recipient.nameEn} color={item.recipient.avatarColor} size={20} />
                <span className="max-w-32 truncate">{bi(locale, item.recipient.nameEn, item.recipient.nameAr)}</span>
              </>
            ) : (
              <Chip tone="warn">{t("recipientKinds.undecided")}</Chip>
            )}
          </div>
        ) : null}
        <div role="cell" className="flex items-center gap-1.5">
          {showUnderstood && item.understoodAt ? (
            <Chip tone="ok">
              <Check className="size-3" aria-hidden /> {t("checklist.understood")}
            </Chip>
          ) : null}
          {showFiling && item.filingStatus !== "none" ? <Chip tone={item.filingStatus === "applied" ? "ok" : "gold"}>{t(`filingStatus.${item.filingStatus}`)}</Chip> : null}
          <ItemStatusChip status={item.status} inScope={item.inScope} />
          {canEditNotes && !editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-gold-500",
                needsNote ? "bg-gold-100 text-maroon-900 hover:bg-gold-300/40" : "text-ink-600 hover:bg-sand-100 hover:text-ink-900"
              )}
              aria-label={t("checklist.editNoteFor", { title: item.title })}
              data-testid="note-edit"
            >
              <PencilLine className="size-3.5" aria-hidden /> {needsNote ? t("checklist.noteRequired") : t("checklist.note")}
            </button>
          ) : null}
        </div>
      </div>
      {editing ? (
        <div className="rounded-lg bg-sand-50 p-3" data-testid="note-editor">
          <Textarea rows={3} dir="auto" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("checklist.notePlaceholder")} className="bg-white" data-testid="note-input" />
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" onClick={save} loading={saving} data-testid="note-save">
              {tc("save")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setDraft(item.note ?? "");
              }}
            >
              {tc("cancel")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
