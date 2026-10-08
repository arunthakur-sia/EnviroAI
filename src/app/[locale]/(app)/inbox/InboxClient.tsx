"use client";
// CR08 9.2: the two-pane Inbox. Left, conversations grouped by the item they
// are about (unread dots, filters, search, arrow-key navigation); right, the
// thread with the item chip and deep link, bubbles with sender monograms, the
// reply composer with an attachment picker, "Convert to question" and "Mark
// done". Under 768px it is one pane with a back action.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Copy,
  ExternalLink,
  HelpCircle,
  Inbox,
  MessageSquarePlus,
  RotateCcw,
  Search,
  Send,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Avatar, Button, Chip, EmptyState, NativeSelect, Skeleton, Textarea } from "@/components/ui/primitives";
import { Tip } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { formatDate, relativeTime } from "@/lib/format";
import { bi, cn } from "@/lib/utils";
import { ComposeMessageDialog } from "@/components/nexus/people/ComposeMessageDialog";
import { AttachmentChips, AttachmentPicker } from "@/components/nexus/people/AttachmentPicker";
import { OwnerControlCompact } from "@/components/nexus/people/OwnerControl";
import type { PickedDocument } from "@/components/nexus/people/types";
import type { ListFilter, ThreadDetail, ThreadListItem } from "@/server/services/messaging";

type Me = { id: string; nameEn: string; nameAr: string; avatarColor: string };

const FILTERS: Exclude<ListFilter, "mine">[] = ["all", "unread", "done", "delegate"];
const ITEM_TYPES = new Set([
  "project", "initiative", "outcome", "target", "document", "indicator", "index", "council_node",
  "unit", "lesson", "process", "report", "study", "policy", "expert",
]);

/** The clock on a bubble. The numbering system is pinned the way
    `formatDate` in @/lib/format pins it, otherwise an Arabic thread showed
    Arabic-Indic times above Latin date dividers. */
function timeOf(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-SA-u-nu-latn", {
    timeStyle: "short",
  }).format(d);
}

function groupKey(t: ThreadListItem): string {
  return t.resource ? `${t.resource.type}:${t.resource.id}` : "none";
}

/** "3 hours ago" differs between the server render and the client a second
    later, which breaks hydration; the server paints the date, the client
    switches to the relative form once mounted. */
function RelativeTime({ iso, locale }: { iso: string; locale: string }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return <>{mounted ? relativeTime(iso, locale) : formatDate(iso, locale, { style: "short" })}</>;
}

export function InboxClient({
  me,
  initialThreads,
  initialFilter,
  initialThreadId,
}: {
  me: Me;
  initialThreads: ThreadListItem[];
  initialFilter: ListFilter;
  initialThreadId: string | null;
}) {
  const t = useTranslations("inbox");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const reduced = useReducedMotion();

  const [threads, setThreads] = React.useState<ThreadListItem[]>(initialThreads);
  const [filter, setFilter] = React.useState<ListFilter>(initialFilter);
  const [q, setQ] = React.useState("");
  /* CR08 9.2: "filters (unread, by item type, by person)". Unread, done and
     as-delegate are server filters (the tab row); the item kind and the person
     narrow the list the server already sent. */
  const [itemType, setItemType] = React.useState("");
  const [personId, setPersonId] = React.useState("");
  const [listBusy, setListBusy] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(initialThreadId);
  const [detail, setDetail] = React.useState<ThreadDetail | null>(null);
  const [detailState, setDetailState] = React.useState<"idle" | "loading" | "missing" | "error">(initialThreadId ? "loading" : "idle");
  const [compose, setCompose] = React.useState(false);
  const [reply, setReply] = React.useState("");
  const [replyDocs, setReplyDocs] = React.useState<PickedDocument[]>([]);
  const [sending, setSending] = React.useState(false);
  const [acting, setActing] = React.useState<"done" | "convert" | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const listSeq = React.useRef(0);

  /* ---- list ---- */
  const loadList = React.useCallback(
    async (f: ListFilter, quiet = false) => {
      // responses may land out of order while the route compiles: only the
      // newest request may write the list
      const seq = ++listSeq.current;
      if (!quiet) setListBusy(true);
      try {
        const res = await fetch(`/api/v1/messages?filter=${f}`);
        const json = await res.json();
        if (seq === listSeq.current && Array.isArray(json.data)) setThreads(json.data);
      } catch {
        /* keep what we have */
      } finally {
        if (seq === listSeq.current) setListBusy(false);
      }
    },
    []
  );

  function changeFilter(f: ListFilter) {
    setFilter(f);
    loadList(f);
    const url = new URL(window.location.href);
    if (f === "all") url.searchParams.delete("filter");
    else url.searchParams.set("filter", f);
    window.history.replaceState(null, "", url.toString());
  }

  const itemLabel = React.useCallback(
    (type: string | undefined) => t(`itemTypes.${type && ITEM_TYPES.has(type) ? type : "other"}` as never),
    [t]
  );

  /** the item kinds and the people this Inbox actually holds */
  const itemTypeOptions = React.useMemo(() => {
    const kinds = new Set<string>();
    for (const th of threads) if (th.resource) kinds.add(th.resource.type);
    return [...kinds].sort((a, b) => itemLabel(a).localeCompare(itemLabel(b), locale));
  }, [threads, locale, itemLabel]);

  const personOptions = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const th of threads) {
      for (const o of th.others) map.set(o.id, { id: o.id, name: bi(locale, o.nameEn, o.nameAr) });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [threads, locale]);

  const visible = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return threads.filter((th) => {
      if (itemType && th.resource?.type !== itemType) return false;
      if (personId && !th.others.some((o) => o.id === personId)) return false;
      if (!needle) return true;
      return [th.subject, th.resource?.titleEn, th.resource?.titleAr, th.lastSnippet, ...th.others.flatMap((o) => [o.nameEn, o.nameAr])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [threads, q, itemType, personId]);

  const groups = React.useMemo(() => {
    const map = new Map<string, { key: string; resource: ThreadListItem["resource"]; threads: ThreadListItem[]; latest: string }>();
    for (const th of visible) {
      const key = groupKey(th);
      const g = map.get(key) ?? { key, resource: th.resource, threads: [], latest: "" };
      g.threads.push(th);
      if (th.lastMessageAt > g.latest) g.latest = th.lastMessageAt;
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => (a.latest < b.latest ? 1 : -1));
  }, [visible]);

  /* ---- detail ---- */
  const loadDetail = React.useCallback(
    async (id: string) => {
      setDetailState("loading");
      try {
        const res = await fetch(`/api/v1/messages/${encodeURIComponent(id)}`);
        if (res.status === 404 || res.status === 403) {
          setDetail(null);
          setDetailState("missing");
          return;
        }
        const json = await res.json();
        if (!json.data) throw new Error("empty");
        setDetail(json.data);
        setDetailState("idle");
        let wasUnread = false;
        setThreads((rows) =>
          rows.map((r) => {
            if (r.id === id && r.unread) wasUnread = true;
            return r.id === id ? { ...r, unread: false } : r;
          })
        );
        // the bar badge is server rendered; refresh it once a thread was read
        setTimeout(() => {
          if (wasUnread) router.refresh();
        }, 0);
      } catch {
        setDetail(null);
        setDetailState("error");
      }
    },
    [router]
  );

  React.useEffect(() => {
    if (initialThreadId) loadDetail(initialThreadId);
    // initial deep link only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (detail && bottomRef.current) {
      bottomRef.current.scrollIntoView({ block: "end", behavior: reduced ? "auto" : "smooth" });
    }
  }, [detail?.id, detail?.messages.length, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  function select(id: string | null) {
    setSelectedId(id);
    setReply("");
    setReplyDocs([]);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("thread", id);
    else url.searchParams.delete("thread");
    window.history.replaceState(null, "", url.toString());
    if (id) loadDetail(id);
    else {
      setDetail(null);
      setDetailState("idle");
    }
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-thread-row]") ?? []);
    if (!rows.length) return;
    e.preventDefault();
    const current = rows.findIndex((r) => r === document.activeElement);
    let next = current;
    if (e.key === "ArrowDown") next = Math.min(rows.length - 1, current + 1);
    if (e.key === "ArrowUp") next = Math.max(0, current - 1);
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = rows.length - 1;
    rows[next]?.focus();
  }

  /* ---- actions ---- */
  async function sendReply() {
    if (!detail || !reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/v1/messages/${encodeURIComponent(detail.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reply", body: reply.trim(), attachments: replyDocs.map((d) => ({ documentId: d.id })) }),
      });
      if (!res.ok) throw new Error("reply");
      setReply("");
      setReplyDocs([]);
      toast(t("replySent"), "success");
      await loadDetail(detail.id);
      loadList(filter, true);
    } catch {
      toast(t("replyFailed"), "error");
    } finally {
      setSending(false);
    }
  }

  async function toggleDone() {
    if (!detail) return;
    const done = detail.status !== "done";
    setActing("done");
    try {
      const res = await fetch(`/api/v1/messages/${encodeURIComponent(detail.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: done ? "done" : "reopen" }),
      });
      if (!res.ok) throw new Error("done");
      setDetail({ ...detail, status: done ? "done" : "open" });
      toast(done ? t("doneToast") : t("reopenToast"), "success");
      loadList(filter, true);
      router.refresh();
    } catch {
      toast(t("replyFailed"), "error");
    } finally {
      setActing(null);
    }
  }

  async function convert() {
    if (!detail || detail.questionId) return;
    setActing("convert");
    try {
      const res = await fetch(`/api/v1/messages/${encodeURIComponent(detail.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "convert" }),
      });
      const json = await res.json().catch(() => ({ data: null }));
      if (!res.ok || !json.data?.questionId) throw new Error("convert");
      setDetail({ ...detail, questionId: json.data.questionId });
      setThreads((rows) => rows.map((r) => (r.id === detail.id ? { ...r, questionId: json.data.questionId } : r)));
      toast(t("converted"), "success");
    } catch {
      toast(t("replyFailed"), "error");
    } finally {
      setActing(null);
    }
  }

  async function copyThreadLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast(t("linkCopied"), "success");
    } catch {
      /* clipboard blocked */
    }
  }

  /* ---- render ---- */
  return (
    <div className="flex flex-col gap-5" data-testid="inbox">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink-600">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setCompose(true)} data-testid="inbox-new">
          <MessageSquarePlus /> {t("newMessage")}
        </Button>
      </div>

      {/* grid-cols-1 is minmax(0,1fr): without it the single phone column is
          sized to its content and the card runs past the viewport */}
      <div className="card grid min-h-[560px] grid-cols-1 overflow-hidden md:h-[calc(100vh-14rem)] md:grid-cols-[360px_minmax(0,1fr)]">
        {/* ---- list pane ---- */}
        <aside
          className={cn("flex min-h-0 min-w-0 flex-col border-mist-200 md:border-e", selectedId ? "hidden md:flex" : "flex")}
          aria-label={t("listLabel")}
        >
          <div className="flex flex-col gap-2.5 border-b border-mist-100 p-3">
            <div className="flex items-center gap-1 rounded-xl bg-mist-100 p-1" role="tablist" aria-label={t("filterLabel")}>
              {FILTERS.map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => changeFilter(f)}
                  className={cn(
                    "flex-1 whitespace-nowrap rounded-lg px-1.5 py-1.5 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-aqua-500",
                    filter === f ? "bg-white text-navy-900 shadow-sm" : "text-ink-600 hover:text-ink-900"
                  )}
                  data-testid={`inbox-filter-${f}`}
                >
                  {t(`filters.${f}` as never)}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="h-9 w-full rounded-lg border border-mist-300 bg-white ps-8 pe-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100"
                aria-label={t("searchPlaceholder")}
                data-testid="inbox-search"
              />
            </div>
            {/* CR08 9.2: by item type, by person */}
            {itemTypeOptions.length > 1 || personOptions.length > 1 ? (
              <div className="grid grid-cols-2 gap-2">
                <NativeSelect
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value)}
                  aria-label={t("byItemType")}
                  className="h-8 text-xs"
                  data-testid="inbox-filter-item"
                >
                  <option value="">{t("allItemTypes")}</option>
                  {itemTypeOptions.map((k) => (
                    <option key={k} value={k}>
                      {itemLabel(k)}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect
                  value={personId}
                  onChange={(e) => setPersonId(e.target.value)}
                  aria-label={t("byPerson")}
                  className="h-8 text-xs"
                  data-testid="inbox-filter-person"
                >
                  <option value="">{t("allPeople")}</option>
                  {personOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-[11px] text-ink-400 tnum">
                {t("threadCount", { count: visible.length })}
                <span className="hidden md:inline"> · {t("kbdHint")}</span>
              </p>
              {itemType || personId ? (
                <button
                  type="button"
                  onClick={() => {
                    setItemType("");
                    setPersonId("");
                  }}
                  className="rounded-md text-[11px] font-medium text-navy-700 hover:text-navy-900 cursor-pointer focus-visible:outline-2 focus-visible:outline-aqua-500"
                  data-testid="inbox-filter-clear"
                >
                  {t("clearFilters")}
                </button>
              ) : null}
            </div>
          </div>

          <div
            ref={listRef}
            role="list"
            className="min-h-0 flex-1 overflow-y-auto"
            onKeyDown={onListKeyDown}
            data-testid="inbox-list"
          >
            {listBusy && !threads.length ? (
              <div className="space-y-3 p-3" aria-busy>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<Inbox />}
                  title={threads.length ? t("noMatchTitle") : t("emptyTitle")}
                  hint={threads.length ? t("noMatchHint") : t("emptyHint")}
                  action={
                    threads.length ? null : (
                      <Button size="sm" variant="secondary" onClick={() => setCompose(true)}>
                        {t("newMessage")}
                      </Button>
                    )
                  }
                  className="py-8"
                />
              </div>
            ) : (
              groups.map((g) => (
                <section key={g.key} className="border-b border-mist-100 last:border-0" data-testid="inbox-group">
                  <header className="sticky top-0 z-10 flex items-center gap-2 bg-mist-50/95 px-3 py-1.5 backdrop-blur">
                    <Chip tone={g.resource ? "teal" : "ghost"} className="shrink-0">
                      {g.resource ? itemLabel(g.resource.type) : t("noItem")}
                    </Chip>
                    {g.resource ? (
                      <span className="truncate text-xs font-medium text-ink-900">{bi(locale, g.resource.titleEn, g.resource.titleAr)}</span>
                    ) : null}
                  </header>
                  {g.threads.map((th) => {
                    const other = th.others[0];
                    const selected = th.id === selectedId;
                    return (
                      <button
                        key={th.id}
                        type="button"
                        role="listitem"
                        data-thread-row
                        data-testid="inbox-thread-row"
                        data-unread={th.unread ? "1" : "0"}
                        tabIndex={selected || (!selectedId && th === visible[0]) ? 0 : -1}
                        onClick={() => select(th.id)}
                        aria-current={selected ? "true" : undefined}
                        className={cn(
                          "flex w-full items-start gap-3 border-s-2 px-3 py-3 text-start transition-colors cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-aqua-500",
                          selected ? "border-navy-700 bg-navy-100/50" : "border-transparent hover:bg-mist-50"
                        )}
                      >
                        <span className="relative shrink-0">
                          {other ? <Avatar name={other.nameEn} color={other.avatarColor} size={36} /> : <Avatar name={me.nameEn} color={me.avatarColor} size={36} />}
                          {th.unread ? (
                            <span className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full bg-aqua-500 ring-2 ring-white" aria-label={t("unread")} data-testid="inbox-unread-dot" />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className={cn("min-w-0 truncate text-sm", th.unread ? "font-semibold text-ink-900" : "font-medium text-ink-900")} dir="auto">
                              {th.subject}
                            </span>
                            <span className="shrink-0 text-[11px] text-ink-400 tnum">
                              <RelativeTime iso={th.lastMessageAt} locale={locale} />
                            </span>
                          </span>
                          {/* two spans, each truncating on its own: one
                              truncating parent would clip an English snippet
                              at its start inside the Arabic list */}
                          <span className="mt-0.5 flex min-w-0 items-baseline gap-1 text-xs">
                            <span className="max-w-[55%] shrink-0 truncate text-ink-600">
                              {th.others.map((o) => bi(locale, o.nameEn, o.nameAr)).join(", ")}
                            </span>
                            {th.lastSnippet ? (
                              <>
                                <span className="shrink-0 text-ink-400" aria-hidden>
                                  ·
                                </span>
                                <span dir="auto" className="min-w-0 flex-1 truncate text-ink-400">
                                  {th.lastSnippet}
                                </span>
                              </>
                            ) : null}
                          </span>
                          {th.asDelegateFor || th.status === "done" || th.questionId ? (
                            <span className="mt-1.5 flex flex-wrap gap-1">
                              {th.asDelegateFor ? (
                                <Chip tone="aqua" data-testid="delegate-chip">
                                  {t("asDelegate", { name: bi(locale, th.asDelegateFor.nameEn, th.asDelegateFor.nameAr) })}
                                </Chip>
                              ) : null}
                              {th.status === "done" ? (
                                <Chip tone="ok">
                                  <Check className="size-3" /> {t("done")}
                                </Chip>
                              ) : null}
                              {th.questionId ? <Chip tone="navy">{t("converted")}</Chip> : null}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </section>
              ))
            )}
          </div>
        </aside>

        {/* ---- thread pane ---- */}
        <section className={cn("flex min-h-0 min-w-0 flex-col", selectedId ? "flex" : "hidden md:flex")} data-testid="inbox-thread">
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <EmptyState icon={<Inbox />} title={t("selectTitle")} hint={t("selectHint")} className="w-full max-w-md border-0 bg-transparent" />
            </div>
          ) : detailState === "loading" ? (
            <div className="flex flex-col gap-4 p-5" aria-busy>
              <button
                type="button"
                onClick={() => select(null)}
                className="inline-flex w-fit items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900 md:hidden cursor-pointer focus-visible:outline-2 focus-visible:outline-aqua-500"
                data-testid="inbox-back"
              >
                <ArrowLeft className="size-4 flip-rtl" /> {t("back")}
              </button>
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <div className="mt-4 space-y-4">
                <Skeleton className="h-16 w-3/4 rounded-2xl" />
                <Skeleton className="ms-auto h-12 w-2/3 rounded-2xl" />
                <Skeleton className="h-20 w-3/4 rounded-2xl" />
              </div>
            </div>
          ) : detailState !== "idle" || !detail ? (
            <div className="p-6">
              <button
                type="button"
                onClick={() => select(null)}
                className="mb-4 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900 md:hidden cursor-pointer"
              >
                <ArrowLeft className="size-4 flip-rtl" /> {t("back")}
              </button>
              <EmptyState title={detailState === "missing" ? t("notFound") : t("loadError")} />
            </div>
          ) : (
            <>
              <header className="border-b border-mist-100 px-5 py-4">
                <button
                  type="button"
                  onClick={() => select(null)}
                  className="mb-2 inline-flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900 md:hidden cursor-pointer focus-visible:outline-2 focus-visible:outline-aqua-500"
                  data-testid="inbox-back"
                >
                  <ArrowLeft className="size-4 flip-rtl" /> {t("back")}
                </button>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-lg leading-snug text-ink-900" dir="auto">
                      {detail.subject}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-600">
                      {detail.resource ? (
                        <>
                          <Chip tone="teal">{itemLabel(detail.resource.type)}</Chip>
                          {detail.resource.link ? (
                            <Link href={detail.resource.link as never} className="link-draw inline-flex items-center gap-1 font-medium text-navy-700" data-testid="inbox-item-link">
                              {bi(locale, detail.resource.titleEn, detail.resource.titleAr)}
                              <ExternalLink className="size-3" aria-hidden />
                            </Link>
                          ) : (
                            <span>{bi(locale, detail.resource.titleEn, detail.resource.titleAr)}</span>
                          )}
                        </>
                      ) : (
                        <Chip tone="ghost">{t("noItem")}</Chip>
                      )}
                      {detail.asDelegateFor ? (
                        <Chip tone="aqua" data-testid="delegate-chip">
                          {t("asDelegate", { name: bi(locale, detail.asDelegateFor.nameEn, detail.asDelegateFor.nameAr) })}
                        </Chip>
                      ) : null}
                      {detail.status === "done" ? (
                        <Chip tone="ok">
                          <Check className="size-3" /> {t("done")}
                        </Chip>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                      {detail.participants.map((p) => (
                        <span key={p.id} className="inline-flex items-center gap-1.5 text-xs text-ink-600">
                          {p.id === me.id ? (
                            <>
                              <Avatar name={p.nameEn} color={p.avatarColor} size={20} />
                              {t("you")}
                            </>
                          ) : (
                            <OwnerControlCompact owner={p} item={detail.resource ? { type: detail.resource.type, id: detail.resource.id, titleEn: detail.resource.titleEn, titleAr: detail.resource.titleAr, href: detail.resource.link } : null} />
                          )}
                          {p.isDelegateFor ? (
                            <span className="text-[11px] text-ink-400">({t("asDelegate", { name: bi(locale, p.isDelegateFor.nameEn, p.isDelegateFor.nameAr) })})</span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Tip content={t("copyLink")}>
                      <Button size="icon" variant="ghost" onClick={copyThreadLink} aria-label={t("copyLink")}>
                        <Copy />
                      </Button>
                    </Tip>
                    {detail.questionId ? (
                      <Link
                        href={`/ask/${detail.questionId}` as never}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-aqua-300 bg-aqua-100 px-3 text-xs font-medium text-navy-900 hover:bg-aqua-300/40 focus-visible:outline-2 focus-visible:outline-aqua-500"
                        data-testid="inbox-view-question"
                      >
                        <HelpCircle className="size-4" /> {t("viewQuestion")}
                      </Link>
                    ) : (
                      <Tip content={t("convertHint")}>
                        <Button size="sm" variant="secondary" onClick={convert} loading={acting === "convert"} data-testid="inbox-convert">
                          <HelpCircle /> {t("convert")}
                        </Button>
                      </Tip>
                    )}
                    <Button size="sm" variant={detail.status === "done" ? "ghost" : "aqua"} onClick={toggleDone} loading={acting === "done"} data-testid="inbox-done">
                      {detail.status === "done" ? <RotateCcw /> : <CheckCheck />}
                      {detail.status === "done" ? t("reopen") : t("markDone")}
                    </Button>
                  </div>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto bg-mist-50/60 px-5 py-4" data-testid="inbox-messages">
                <ol className="flex flex-col gap-4">
                  {detail.messages.map((m, i) => {
                    const mine = m.senderId === me.id;
                    const prev = detail.messages[i - 1];
                    const newDay = !prev || prev.createdAt.slice(0, 10) !== m.createdAt.slice(0, 10);
                    return (
                      <React.Fragment key={m.id}>
                        {newDay ? (
                          <li className="flex items-center gap-3 text-[11px] text-ink-400 tnum" aria-hidden>
                            <span className="h-px flex-1 bg-mist-200" />
                            {formatDate(m.createdAt, locale, { style: "medium" })}
                            <span className="h-px flex-1 bg-mist-200" />
                          </li>
                        ) : null}
                        <li className={cn("flex items-end gap-2.5", mine && "flex-row-reverse")} data-testid="inbox-message" data-mine={mine ? "1" : "0"}>
                          <Avatar name={m.sender.nameEn} color={m.sender.avatarColor} size={28} className="mb-0.5" />
                          <div
                            className={cn(
                              "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                              mine
                                ? "rounded-ee-md bg-navy-100 text-navy-900"
                                : "rounded-es-md border border-mist-200 bg-white text-ink-900 shadow-[var(--shadow-paper)]"
                            )}
                          >
                            <p className={cn("mb-1 flex items-baseline gap-2 text-[11px]", mine ? "text-navy-700/80" : "text-ink-400")}>
                              <span className="font-medium">{mine ? t("you") : bi(locale, m.sender.nameEn, m.sender.nameAr)}</span>
                              <span className="tnum">{timeOf(m.createdAt, locale)}</span>
                            </p>
                            <p className="whitespace-pre-wrap break-words" dir="auto">
                              {m.body}
                            </p>
                            {m.attachments.length ? (
                              <div className="mt-2 flex flex-wrap gap-1.5" data-testid="inbox-attachment">
                                {m.attachments.map((a) => (
                                  <Link key={a.documentId} href={`/vault/${a.documentId}` as never} className="focus-visible:outline-2 focus-visible:outline-aqua-500">
                                    <AttachmentChips value={[{ id: a.documentId, titleEn: a.titleEn, titleAr: a.titleAr }]} />
                                  </Link>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </li>
                      </React.Fragment>
                    );
                  })}
                </ol>
                <div ref={bottomRef} />
              </div>

              <form
                className="border-t border-mist-100 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendReply();
                }}
                data-testid="inbox-reply"
              >
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={t("replyPlaceholder")}
                  rows={2}
                  className="min-h-16"
                  dir="auto"
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                  aria-label={t("replyPlaceholder")}
                  data-testid="inbox-reply-text"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <AttachmentPicker value={replyDocs} onChange={setReplyDocs} compact testId="inbox-attach" />
                  <div className="flex items-center gap-3">
                    <span className="hidden text-[11px] text-ink-400 sm:inline">{t("sendShortcut")}</span>
                    <Button type="submit" size="sm" loading={sending} disabled={!reply.trim()} data-testid="inbox-reply-send">
                      <Send className="flip-rtl" /> {t("send")}
                    </Button>
                  </div>
                </div>
              </form>
            </>
          )}
        </section>
      </div>

      <ComposeMessageDialog
        open={compose}
        onOpenChange={setCompose}
        onSent={async (id) => {
          await loadList(filter, true);
          select(id);
          router.refresh();
        }}
      />
    </div>
  );
}
