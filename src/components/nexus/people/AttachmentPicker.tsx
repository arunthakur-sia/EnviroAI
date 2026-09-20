"use client";
// CR08 9.2: "optional attachment from Institutional Memory". A small search
// over GET /api/v1/documents?q= that adds document chips to a message.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileText, Paperclip, X } from "lucide-react";
import { Chip, Input } from "@/components/ui/primitives";
import { bi, cn } from "@/lib/utils";
import type { PickedDocument } from "./types";

export function AttachmentChips({
  value,
  onRemove,
}: {
  value: PickedDocument[];
  onRemove?: (id: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("people.picker");
  if (!value.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="attachment-chips">
      {value.map((d) => (
        <Chip key={d.id} tone="gulf" className="max-w-full">
          <FileText className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{bi(locale, d.titleEn, d.titleAr)}</span>
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(d.id)}
              className="ms-0.5 rounded p-0.5 hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-gold-500 cursor-pointer"
              aria-label={t("remove", { name: bi(locale, d.titleEn, d.titleAr) })}
            >
              <X className="size-3" />
            </button>
          ) : null}
        </Chip>
      ))}
    </div>
  );
}

export function AttachmentPicker({
  value,
  onChange,
  compact = false,
  testId = "attachment-picker",
}: {
  value: PickedDocument[];
  onChange: (docs: PickedDocument[]) => void;
  compact?: boolean;
  testId?: string;
}) {
  const t = useTranslations("people.picker");
  const tc = useTranslations("people.compose");
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [rows, setRows] = React.useState<PickedDocument[] | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open || q.trim().length < 2) {
      setRows(null);
      return;
    }
    const handle = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/v1/documents?q=${encodeURIComponent(q.trim())}&limit=8`);
        const json = await res.json();
        const docs = Array.isArray(json.data) ? json.data : [];
        setRows(
          docs.map((d: { id: string; titleEn: string; titleAr: string }) => ({
            id: d.id,
            titleEn: d.titleEn,
            titleAr: d.titleAr,
          }))
        );
      } catch {
        setRows([]);
      } finally {
        setBusy(false);
      }
    }, 220);
    return () => clearTimeout(handle);
  }, [q, open]);

  return (
    <div className="flex flex-col gap-2">
      <AttachmentChips value={value} onRemove={(id) => onChange(value.filter((d) => d.id !== id))} />
      {open ? (
        <div className="relative">
          <Paperclip className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <Input
            value={q}
            autoFocus
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder={t("docPlaceholder")}
            className="ps-8"
            data-testid={`${testId}-input`}
          />
          <ul
            role="listbox"
            className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-sand-300 bg-white p-1 shadow-[var(--shadow-paper)]"
          >
            {q.trim().length < 2 ? (
              <li className="px-3 py-2 text-xs text-ink-400">{t("docHint")}</li>
            ) : busy && !rows ? (
              <li className="px-3 py-2 text-xs text-ink-400">{t("searching")}</li>
            ) : rows && rows.length === 0 ? (
              <li className="px-3 py-2 text-xs text-ink-400">{t("docNoResults")}</li>
            ) : (
              (rows ?? []).map((d) => {
                const picked = value.some((v) => v.id === d.id);
                return (
                  <li key={d.id} role="option" aria-selected={picked}>
                    <button
                      type="button"
                      disabled={picked}
                      onClick={() => {
                        onChange([...value, d]);
                        setOpen(false);
                        setQ("");
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-sm text-ink-900 hover:bg-maroon-100/60 focus-visible:outline-2 focus-visible:outline-gold-500 cursor-pointer disabled:cursor-default disabled:opacity-50"
                      )}
                      data-testid={`${testId}-option`}
                    >
                      <FileText className="size-4 shrink-0 text-ink-400" aria-hidden />
                      <span className="truncate">{bi(locale, d.titleEn, d.titleAr)}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-lg text-xs font-medium text-maroon-700 hover:text-maroon-900 focus-visible:outline-2 focus-visible:outline-gold-500 cursor-pointer",
            compact ? "px-1.5 py-1" : "border border-dashed border-sand-300 px-2.5 py-1.5 hover:border-maroon-300"
          )}
          data-testid={`${testId}-open`}
        >
          <Paperclip className="size-3.5" aria-hidden />
          {compact ? tc("attachments") : tc("attach")}
        </button>
      )}
    </div>
  );
}
