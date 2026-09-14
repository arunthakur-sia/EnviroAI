"use client";
// The single most prominent control in the app: 560px, centred, instant grouped
// suggestions at 300ms debounce, Enter runs the full hybrid search.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Search, FileText, BarChart3, Compass, Users, MessageCircleQuestion, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

type Suggestion = {
  type: string;
  id: string;
  title: string;
  hint?: string;
};

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  document: FileText,
  indicator: BarChart3,
  node: Compass,
  expert: Users,
  question: MessageCircleQuestion,
  lesson: Lightbulb,
};

const TYPE_HREF: Record<string, (id: string) => string> = {
  document: (id) => `/vault/${id}`,
  indicator: (id) => `/statistics/${id}`,
  node: (id) => `/strategy/${id}`,
  expert: (id) => `/experts/${id}`,
  question: (id) => `/ask/${id}`,
  lesson: (id) => `/lessons/${id}`,
};

export function GlobalSearch() {
  const t = useTranslations("shell");
  const locale = useLocale();
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [groups, setGroups] = React.useState<Record<string, Suggestion[]>>({});
  const [loading, setLoading] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  React.useEffect(() => {
    if (q.trim().length < 2) {
      setGroups({});
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/v1/search/suggest?q=${encodeURIComponent(q)}&locale=${locale}`
        );
        const json = await res.json();
        setGroups(json.data ?? {});
        setOpen(true);
      } catch {
        setGroups({});
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [q, locale]);

  function submit() {
    if (!q.trim()) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  const hasResults = Object.values(groups).some((g) => g.length);

  return (
    <div ref={boxRef} className="relative w-full max-w-[560px]">
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => q.length >= 2 && setOpen(true)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder={t("searchPlaceholder")}
        // CR05 1.3: translucent field on the maroon bar; on focus it turns
        // white with ink text and a 2px gold ring
        className="peer h-10.5 w-full rounded-xl border border-white/20 bg-bar-field ps-10 pe-14 text-sm text-bar-ink transition-all placeholder:text-white/72 focus:border-transparent focus:bg-bar-field-focus focus:text-ink-900 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:placeholder:text-ink-400"
        role="combobox"
        aria-expanded={open}
        aria-controls="global-search-suggestions"
        aria-label={t("searchPlaceholder")}
      />
      <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-white/70 peer-focus:text-ink-400" />
      <kbd className="pointer-events-none absolute end-3 top-1/2 hidden -translate-y-1/2 rounded border border-white/25 bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70 peer-focus:border-sand-300 peer-focus:bg-sand-50 peer-focus:text-ink-400 md:block">
        Ctrl K
      </kbd>

      {open && (hasResults || loading) ? (
        <div
          id="global-search-suggestions"
          className="absolute top-12 z-50 w-full overflow-hidden rounded-xl border border-sand-300 bg-white shadow-[var(--shadow-pop)]"
        >
          {loading && !hasResults ? (
            <div className="px-4 py-3 text-sm text-ink-400">{t("searching")}</div>
          ) : null}
          {Object.entries(groups).map(([type, items]) =>
            items.length ? (
              <div key={type} className="border-b border-sand-100 last:border-0">
                <p className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                  {t(`types.${type}`)}
                </p>
                {items.map((s) => {
                  const Icon = TYPE_ICON[type] ?? FileText;
                  return (
                    <button
                      key={s.id}
                      className="flex w-full items-center gap-3 px-4 py-2 text-start text-sm hover:bg-maroon-100/50"
                      onClick={() => {
                        setOpen(false);
                        setQ("");
                        router.push(TYPE_HREF[type]?.(s.id) ?? "/search");
                      }}
                    >
                      <Icon className="size-4 shrink-0 text-ink-400" />
                      <span className="truncate text-ink-900">{s.title}</span>
                      {s.hint ? (
                        <span className={cn("ms-auto shrink-0 text-xs text-ink-400")}>{s.hint}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null
          )}
          <button
            className="flex w-full items-center gap-2 bg-sand-50 px-4 py-2.5 text-sm font-medium text-maroon-700 hover:bg-maroon-100/50"
            onClick={submit}
          >
            <Search className="size-4" />
            {t("seeAllResults", { q })}
          </button>
        </div>
      ) : null}
    </div>
  );
}
