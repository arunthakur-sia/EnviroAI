"use client";
// CR08 9: one-person picker over GET /api/v1/people?q= (compose recipient,
// the profile delegate). Debounced search, keyboard list, a chip once picked.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { Avatar, Input } from "@/components/ui/primitives";
import { bi, cn } from "@/lib/utils";
import type { PickedPerson } from "./types";

export function PersonPicker({
  value,
  onChange,
  id,
  autoFocus,
  testId = "person-picker",
}: {
  value: PickedPerson | null;
  onChange: (person: PickedPerson | null) => void;
  id?: string;
  autoFocus?: boolean;
  testId?: string;
}) {
  const t = useTranslations("people.picker");
  const locale = useLocale();
  const [q, setQ] = React.useState("");
  const [rows, setRows] = React.useState<PickedPerson[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/v1/people?q=${encodeURIComponent(q)}&limit=8`);
        const json = await res.json();
        setRows(Array.isArray(json.data) ? json.data : []);
        setActive(0);
      } catch {
        setRows([]);
      } finally {
        setBusy(false);
      }
    }, 180);
    return () => clearTimeout(handle);
  }, [q, open]);

  if (value) {
    return (
      <div
        className="flex h-9.5 items-center gap-2 rounded-lg border border-sand-300 bg-sand-50 ps-2 pe-1"
        data-testid={`${testId}-selected`}
      >
        <Avatar name={value.nameEn} color={value.avatarColor} size={22} />
        <span className="min-w-0 flex-1 truncate text-sm text-ink-900">{bi(locale, value.nameEn, value.nameAr)}</span>
        {value.unitEn || value.unitAr ? (
          <span className="hidden truncate text-xs text-ink-400 sm:inline">{bi(locale, value.unitEn ?? "", value.unitAr ?? "")}</span>
        ) : null}
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQ("");
            setOpen(true);
          }}
          className="rounded-md p-1 text-ink-400 hover:bg-sand-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-gold-500 cursor-pointer"
          aria-label={t("remove", { name: bi(locale, value.nameEn, value.nameAr) })}
          data-testid={`${testId}-clear`}
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
      <Input
        id={id}
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!rows?.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(rows.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            onChange(rows[active]);
            setOpen(false);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={t("placeholder")}
        className="ps-8"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        data-testid={`${testId}-input`}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-sand-300 bg-white p-1 shadow-[var(--shadow-pop)]"
        >
          {rows === null || (busy && !rows.length) ? (
            <li className="px-3 py-2 text-xs text-ink-400">{t("searching")}</li>
          ) : rows.length === 0 ? (
            <li className="px-3 py-2 text-xs text-ink-400">{t("noResults")}</li>
          ) : (
            rows.map((p, i) => (
              <li
                key={p.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(p);
                  setOpen(false);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                  i === active ? "bg-maroon-100/60 text-maroon-900" : "text-ink-900"
                )}
                data-testid={`${testId}-option`}
              >
                <Avatar name={p.nameEn} color={p.avatarColor} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{bi(locale, p.nameEn, p.nameAr)}</span>
                  <span className="block truncate text-xs text-ink-400">
                    {[bi(locale, p.positionEn ?? "", p.positionAr ?? ""), bi(locale, p.unitEn ?? "", p.unitAr ?? "")]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
