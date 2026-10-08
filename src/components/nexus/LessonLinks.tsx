"use client";
// CR07 1.3: the links between a lesson and the strategy. The card shows the
// primary node; the expanded lesson shows every link with the control to add
// another, promote one to primary, or unlink. A lesson with no link at all
// says so and offers the same control.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Link2, Plus, Search, Star, X } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Chip, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

export type LessonLinkView = {
  id: string;
  nodeId: string;
  nodeKind: "nes" | "council";
  isPrimary: boolean;
  code: string | null;
  titleEn: string;
  titleAr: string;
  level: string;
  edition: string | null;
};

type Hit = {
  id: string;
  code: string | null;
  titleEn: string;
  titleAr: string;
  level: string;
  kind: "nes" | "council";
  edition: string | null;
};

/** The single chip that rides on a lesson card. */
export function PrimaryNodeChip({
  links,
  className,
}: {
  links: LessonLinkView[];
  className?: string;
}) {
  const t = useTranslations("lessons.links");
  const locale = useLocale();
  const primary = links.find((l) => l.isPrimary) ?? links[0];
  if (!primary) return null;
  const extra = links.length - 1;
  return (
    <span className={cn("inline-flex items-center gap-1", className)} data-testid="lesson-primary-chip">
      <Chip tone={primary.nodeKind === "council" ? "teal" : "mist"}>
        {primary.code ?? bi(locale, primary.titleEn, primary.titleAr)}
      </Chip>
      {primary.nodeKind === "council" ? <Chip tone="navy">{t("internal")}</Chip> : null}
      {extra > 0 ? (
        <span className="text-[10px] text-ink-600 tnum" title={t("moreLinks", { count: extra })}>
          +{extra}
        </span>
      ) : null}
    </span>
  );
}

/** The full control inside an expanded lesson. */
export function LessonLinksSection({
  lessonId,
  links: initial,
  canEdit,
  onChanged,
}: {
  lessonId: string;
  links: LessonLinkView[];
  canEdit: boolean;
  onChanged?: () => void;
}) {
  const t = useTranslations("lessons.links");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [links, setLinks] = React.useState(initial);
  const [adding, setAdding] = React.useState(false);
  const [store, setStore] = React.useState<"nes" | "council">("nes");
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<Hit[]>([]);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setLinks(initial), [initial]);

  React.useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/v1/lessons/links?q=${encodeURIComponent(query.trim())}&store=${store}`
        );
        const json = await res.json();
        setHits(json.data ?? []);
      } catch {
        setHits([]);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, store]);

  async function add(hit: Hit) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/lessons/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonId, nodeId: hit.id, nodeKind: hit.kind }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setLinks((current) => [
          ...current,
          {
            id: json.data.id,
            nodeId: hit.id,
            nodeKind: hit.kind,
            isPrimary: current.length === 0,
            code: hit.code,
            titleEn: hit.titleEn,
            titleAr: hit.titleAr,
            level: hit.level,
            edition: hit.edition,
          },
        ]);
        setQuery("");
        setHits([]);
        setAdding(false);
        toast(t("linked"), "success");
        onChanged?.();
        router.refresh();
      } else {
        toast(json.error === "already_linked" ? t("alreadyLinked") : tc("error"), "error");
      }
    } finally {
      setBusy(false);
    }
  }

  async function makePrimary(linkId: string) {
    const res = await fetch("/api/v1/lessons/links", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ linkId }),
    });
    if (res.ok) {
      setLinks((current) => current.map((l) => ({ ...l, isPrimary: l.id === linkId })));
      toast(t("primarySet"), "success");
      onChanged?.();
      router.refresh();
    } else toast(tc("error"), "error");
  }

  async function remove(linkId: string) {
    const res = await fetch(`/api/v1/lessons/links?linkId=${encodeURIComponent(linkId)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setLinks((current) => {
        const rest = current.filter((l) => l.id !== linkId);
        // the server promotes the oldest remaining link; mirror that here
        if (!rest.some((l) => l.isPrimary) && rest[0]) rest[0] = { ...rest[0], isPrimary: true };
        return rest;
      });
      toast(t("unlinked"), "success");
      onChanged?.();
      router.refresh();
    } else toast(tc("error"), "error");
  }

  const href = (link: LessonLinkView) =>
    link.nodeKind === "council"
      ? (`/council-strategy?p=${link.code ?? link.nodeId}` as never)
      : (`/strategy/${link.nodeId}` as never);

  return (
    <section className="mt-4" data-testid="lesson-links">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600"
          style={{ fontFamily: "inherit" }}
        >
          {t("title")}
        </p>
        {canEdit ? (
          <button
            onClick={() => setAdding((a) => !a)}
            className="flex items-center gap-1 rounded-lg border border-mist-300 bg-white px-2 py-1 text-xs font-medium text-ink-600 hover:border-navy-300 hover:text-navy-700 cursor-pointer"
            data-testid="lesson-link-add"
          >
            {adding ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {adding ? tc("cancel") : t("add")}
          </button>
        ) : null}
      </div>

      {links.length ? (
        <ul className="flex flex-col gap-1.5">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex items-center gap-2 rounded-lg border border-mist-100 bg-white px-2.5 py-1.5"
              data-testid="lesson-link-row"
            >
              <Link2 className="size-3.5 shrink-0 text-ink-400" aria-hidden />
              <Link href={href(link)} className="min-w-0 flex-1 truncate text-sm text-ink-900 hover:text-navy-700">
                {link.code ? <span className="me-1.5 text-xs text-ink-600 tnum">{link.code}</span> : null}
                {bi(locale, link.titleEn, link.titleAr)}
              </Link>
              {link.nodeKind === "council" ? <Chip tone="navy">{t("internal")}</Chip> : null}
              {link.edition ? <Chip tone="mist">{link.edition.toUpperCase()}</Chip> : null}
              {link.isPrimary ? (
                <Chip tone="aqua" data-testid="lesson-link-primary">
                  {t("primary")}
                </Chip>
              ) : canEdit ? (
                <button
                  onClick={() => makePrimary(link.id)}
                  className="rounded-lg p-1 text-ink-400 hover:bg-mist-100 hover:text-aqua-500 cursor-pointer"
                  aria-label={t("makePrimary")}
                  title={t("makePrimary")}
                >
                  <Star className="size-3.5" />
                </button>
              ) : null}
              {canEdit ? (
                <button
                  onClick={() => remove(link.id)}
                  className="rounded-lg p-1 text-ink-400 hover:bg-mist-100 hover:text-danger cursor-pointer"
                  aria-label={t("unlink")}
                  title={t("unlink")}
                  data-testid="lesson-link-remove"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-600" data-testid="lesson-not-linked">
          {t("notLinked")}
        </p>
      )}

      {adding && canEdit ? (
        <div className="card mt-2 flex flex-col gap-2 p-3" data-testid="lesson-link-form">
          <span className="inline-flex w-fit items-center gap-0.5 rounded-lg bg-mist-100 p-0.5">
            {(["nes", "council"] as const).map((key) => (
              <button
                key={key}
                onClick={() => setStore(key)}
                aria-pressed={store === key}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer",
                  store === key ? "bg-white font-medium text-navy-900 shadow-sm" : "text-ink-600"
                )}
              >
                {key === "nes" ? t("storeNes") : t("storeCouncil")}
              </button>
            ))}
          </span>
          <span className="relative">
            <Search
              className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-400"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="ps-8"
            />
          </span>
          {hits.length ? (
            <div className="overflow-hidden rounded-xl border border-mist-300 bg-white">
              {hits.map((hit) => (
                <button
                  key={`${hit.kind}:${hit.id}`}
                  onClick={() => add(hit)}
                  disabled={busy}
                  className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-navy-100/50 cursor-pointer"
                >
                  {hit.code ? <span className="text-xs text-ink-600 tnum">{hit.code}</span> : null}
                  <span className="min-w-0 flex-1 truncate">{bi(locale, hit.titleEn, hit.titleAr)}</span>
                  <Chip tone={hit.kind === "council" ? "teal" : "mist"}>
                    {hit.edition ? hit.edition.toUpperCase() : t("storeCouncil")}
                  </Chip>
                </button>
              ))}
            </div>
          ) : query.trim().length >= 2 ? (
            <p className="text-xs text-ink-600">{t("noMatches")}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
