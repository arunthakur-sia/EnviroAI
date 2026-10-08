"use client";
// CR08 2.3: the Ask EnviroAI panel. Slides in from the end side (480px, full width
// under 640px) over the page content behind a scrim that leaves the rail
// usable. It stays mounted in the shell and its thread lives in panel-store,
// so route changes, Escape and Ctrl+K never lose the conversation. Contents:
// the header (Ask EnviroAI, Expand, close), the current page item as a removable
// chip, three first suggestions about that item, the same answer workspace as
// /ask/c/[id] in its compact layout, recent conversations while no thread is
// open, and the composer. Sending goes through the analyst stream exactly as
// the conversation page does, with the page item passed as extra context.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  CornerDownLeft,
  Maximize2,
  MessageCircleQuestion,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn, bi } from "@/lib/utils";
import { relativeTime } from "@/lib/format";
import { EmptyState, Skeleton, Textarea } from "@/components/ui/primitives";
import { AnalystAnswer, useAnalyst, type AnalystTurnData } from "@/components/nexus/Workspace";
import { useAskContext, type AskContextItem } from "./context-store";
import { askPanel, contextKey, useAskPanelState } from "./panel-store";
import { KIND_ICON, contextPayload, legacyContext, suggestionsFor } from "./suggestions";

const EASE = [0.22, 1, 0.36, 1] as const;
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type RecentRow = { id: string; title: string | null; isShared: number; updatedAt: string };
type RecentState =
  | { status: "idle" | "loading" }
  | { status: "ready"; rows: RecentRow[] }
  | { status: "error" };

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal",
        className
      )}
    >
      {children}
    </p>
  );
}

export function AskPanel() {
  const t = useTranslations("askEverywhere");
  const locale = useLocale();
  const router = useRouter();
  const reduced = useReducedMotion();
  const state = useAskPanelState();
  const pageItem = useAskContext();
  const analyst = useAnalyst();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const composerRef = React.useRef<HTMLTextAreaElement>(null);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const [recent, setRecent] = React.useState<RecentState>({ status: "idle" });
  const [opening, setOpening] = React.useState<string | null>(null);
  const [openError, setOpenError] = React.useState(false);
  const [railWidth, setRailWidth] = React.useState(72);

  const { open, turns, conversationId, draft } = state;
  const attached: AskContextItem | null =
    pageItem && state.detachedKey !== contextKey(pageItem) ? pageItem : null;
  const attachedRef = React.useRef(attached);
  attachedRef.current = attached;
  const attachedTitle = attached ? bi(locale, attached.titleEn, attached.titleAr) : "";
  const AttachedIcon = attached ? KIND_ICON[attached.kind] : null;

  const suggestions = React.useMemo(
    () => (attached ? suggestionsFor((k, v) => t(k as never, (v ?? {}) as never), attached, locale) : []),
    [attached, locale, t]
  );

  /* ---------------- the live turn while an answer streams ---------------- */
  const liveTurn: AnalystTurnData | null =
    !analyst.final && (analyst.streaming || analyst.text)
      ? {
          role: "assistant",
          content: analyst.text,
          citations: analyst.citations,
          workspace: analyst.workspace,
          confidence: undefined,
        }
      : null;
  const hasThread = turns.length > 0 || Boolean(liveTurn) || Boolean(conversationId);
  const lastChip = analyst.chips[analyst.chips.length - 1];
  const liveStatus = analyst.error
    ? t("error")
    : analyst.streaming
      ? lastChip
        ? bi(locale, lastChip.labelEn, lastChip.labelAr)
        : t("sending")
      : analyst.final
        ? t("answerReady")
        : "";

  /* ---------------- sending ---------------- */
  const scrollToEnd = React.useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "end" });
  }, [reduced]);

  const run = React.useCallback(
    (message: string, push: boolean) => {
      const text = message.trim();
      if (!text || analyst.streaming) return;
      if (push) {
        askPanel.pushTurn({ role: "user", content: text });
        askPanel.setDraft("");
      }
      const item = attachedRef.current;
      analyst.send({
        message: text,
        locale,
        conversationId: askPanel.get().conversationId,
        context: legacyContext(item),
        contextItem: contextPayload(item, locale),
        onConversation: (id) => askPanel.startConversation(id, text.slice(0, 120)),
        onFinal: (turn) => askPanel.pushTurn(turn),
      });
      setTimeout(scrollToEnd, 120);
    },
    [analyst, locale, scrollToEnd]
  );
  const send = React.useCallback((message: string) => run(message, true), [run]);
  const retry = React.useCallback(() => {
    const lastUser = [...askPanel.get().turns].reverse().find((x) => x.role === "user");
    if (lastUser) run(lastUser.content, false);
  }, [run]);

  // keep the newest streamed text in view when the reader is already near the end
  React.useEffect(() => {
    const body = bodyRef.current;
    if (!body || !analyst.streaming) return;
    const nearEnd = body.scrollHeight - body.scrollTop - body.clientHeight < 160;
    if (nearEnd) bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [analyst.text, analyst.chips.length, analyst.streaming]);

  /* ---------------- open and close side effects ---------------- */
  React.useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
    } else {
      const el = returnFocusRef.current;
      returnFocusRef.current = null;
      if (el && document.contains(el) && typeof el.focus === "function") el.focus();
      setRecent({ status: "idle" });
    }
  }, [open]);

  React.useEffect(() => {
    if (!open || !state.focusTick) return;
    const id = requestAnimationFrame(() => composerRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, state.focusTick]);

  // the scrim starts where the rail ends, whatever width the rail is today
  React.useEffect(() => {
    if (!open) return;
    const rail = document.querySelector<HTMLElement>('[data-testid="rail"]');
    if (!rail) {
      setRailWidth(0);
      return;
    }
    const measure = () => setRailWidth(Math.round(rail.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [open]);

  // Escape closes (and keeps the thread); Tab stays inside the panel
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        askPanel.close();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !panelRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  /* ---------------- recent conversations while no thread is open ---------------- */
  const showHome = !hasThread;
  React.useEffect(() => {
    if (!open || !showHome || recent.status !== "idle") return;
    let alive = true;
    setRecent({ status: "loading" });
    fetch("/api/v1/conversations")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error("recent_failed");
        if (alive) setRecent({ status: "ready", rows: (json.data ?? []) as RecentRow[] });
      })
      .catch(() => {
        if (alive) setRecent({ status: "error" });
      });
    return () => {
      alive = false;
    };
  }, [open, showHome, recent.status]);

  async function openConversation(row: RecentRow) {
    if (opening) return;
    setOpening(row.id);
    setOpenError(false);
    try {
      const res = await fetch(`/api/v1/conversations/${row.id}/messages`);
      const json = await res.json();
      if (!res.ok) throw new Error("open_failed");
      askPanel.loadConversation(row.id, json.data.title ?? "", json.data.turns ?? []);
      askPanel.focusComposer();
    } catch {
      setOpenError(true);
    } finally {
      setOpening(null);
    }
  }

  function expand() {
    const snapshot = askPanel.get();
    askPanel.close();
    if (snapshot.conversationId) {
      router.push(`/ask/c/${snapshot.conversationId}` as never);
    } else if (snapshot.draft.trim()) {
      router.push(`/ask/c/new?q=${encodeURIComponent(snapshot.draft.trim())}` as never);
    } else {
      router.push("/ask" as never);
    }
  }

  const shortcut =
    typeof navigator !== "undefined" && /mac/i.test(navigator.platform) ? "⌘K" : "Ctrl+K";
  const closedX = locale === "ar" ? "-112%" : "112%";

  return (
    /* CR08 Phase C: one viewport-sized clipper holds the scrim and the panel.
       The panel stays mounted while closed so a streaming answer survives, and
       it parks off-screen; a fixed element is not clipped by an ancestor, so
       parking it used to add its own width to the document and every Arabic
       page scrolled sideways by a few pixels. Inside this wrapper both are
       absolute, and `overflow-x: clip` swallows the parked panel without
       touching the vertical axis. */
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-x-clip">
      {/* the scrim covers the page, never the rail */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="ask-scrim"
            aria-hidden
            data-testid="ask-scrim"
            className="pointer-events-auto absolute inset-y-0 end-0 cursor-pointer bg-ink-900/20"
            style={{ insetInlineStart: railWidth }}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => askPanel.close()}
          />
        ) : null}
      </AnimatePresence>

      <motion.aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        aria-hidden={!open}
        inert={!open}
        data-testid="ask-panel"
        data-state={open ? "open" : "closed"}
        data-conversation-id={conversationId ?? ""}
        className="pointer-events-auto absolute inset-y-0 end-0 z-10 flex w-full flex-col bg-white shadow-[var(--shadow-pop)] sm:w-[480px] sm:border-s sm:border-mist-200"
        initial={false}
        animate={{ x: open ? "0%" : closedX }}
        transition={reduced ? { duration: 0 } : { duration: 0.24, ease: EASE }}
      >
        {/* header */}
        <div className="flex items-center gap-2 border-b border-mist-100 px-4 py-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy-700 text-aqua-300">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg leading-tight">{t("title")}</h2>
            {conversationId ? (
              <p className="truncate text-xs text-ink-600" data-testid="ask-panel-title">
                {state.title || t("untitled")}
              </p>
            ) : null}
          </div>
          {hasThread ? (
            <button
              type="button"
              onClick={() => askPanel.newConversation()}
              aria-label={t("newConversation")}
              title={t("newConversation")}
              className="rounded-lg p-2 text-ink-600 transition-colors hover:bg-mist-100 hover:text-ink-900 cursor-pointer"
              data-testid="ask-new"
            >
              <Plus className="size-4" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            onClick={expand}
            aria-label={t("expandAria")}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-mist-300 px-2.5 text-xs font-medium text-ink-900 transition-colors hover:border-navy-300 hover:text-navy-700 cursor-pointer"
            data-testid="ask-expand"
          >
            <Maximize2 className="size-3.5" aria-hidden /> {t("expand")}
          </button>
          <button
            type="button"
            onClick={() => askPanel.close()}
            aria-label={t("close")}
            className="rounded-lg p-2 text-ink-600 transition-colors hover:bg-mist-100 hover:text-ink-900 cursor-pointer"
            data-testid="ask-close"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {/* the page item, removable */}
        {attached && AttachedIcon ? (
          <div
            className="flex items-center gap-2 border-b border-mist-100 bg-mist-50 px-4 py-2"
            data-testid="ask-context-chip"
          >
            <Eyebrow className="shrink-0 text-ink-600">{t("askingAbout")}</Eyebrow>
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-navy-100 bg-white py-1 pe-1 ps-2 text-xs text-navy-900">
              <AttachedIcon className="size-3.5 shrink-0 text-navy-500" />
              <span className="truncate">
                {attached.code ? <span className="tnum font-semibold">{attached.code} </span> : null}
                {attachedTitle}
              </span>
              <button
                type="button"
                onClick={() => askPanel.detach(attached)}
                aria-label={t("removeContext", { title: attachedTitle })}
                className="rounded p-0.5 text-ink-400 transition-colors hover:bg-navy-100 hover:text-navy-900 cursor-pointer"
                data-testid="ask-context-remove"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          </div>
        ) : null}

        {/* body */}
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <p role="status" aria-live="polite" className="sr-only">
            {liveStatus}
          </p>

          {showHome ? (
            <div className="flex flex-col gap-6">
              {suggestions.length ? (
                <div>
                  <Eyebrow className="mb-2">{t("startWith")}</Eyebrow>
                  <div className="flex flex-col gap-1.5" data-testid="ask-suggestions">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => send(s)}
                        className="rounded-xl border border-mist-200 bg-white px-3 py-2 text-start text-sm leading-snug text-ink-900 transition-colors hover:border-navy-300 hover:bg-navy-50 hover:text-navy-900 cursor-pointer"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-ink-600">{t("intro")}</p>
              )}

              <div>
                <Eyebrow className="mb-2">{t("recent")}</Eyebrow>
                {recent.status === "idle" || recent.status === "loading" ? (
                  <div className="flex flex-col gap-2" aria-busy>
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-4/5" />
                  </div>
                ) : recent.status === "error" ? (
                  <div
                    role="alert"
                    className="flex items-center justify-between gap-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger"
                  >
                    <span>{t("recentError")}</span>
                    <button
                      type="button"
                      onClick={() => setRecent({ status: "idle" })}
                      className="rounded-md border border-danger/30 px-2 py-0.5 text-xs font-medium hover:bg-white cursor-pointer"
                    >
                      {t("retry")}
                    </button>
                  </div>
                ) : recent.status === "ready" && recent.rows.length ? (
                  <div className="card divide-y divide-mist-100" data-testid="ask-recent">
                    {recent.rows.slice(0, 8).map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => openConversation(row)}
                        disabled={Boolean(opening)}
                        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-start transition-colors first:rounded-t-[var(--radius-card)] last:rounded-b-[var(--radius-card)] hover:bg-navy-50 disabled:opacity-60 cursor-pointer"
                        data-testid="ask-recent-row"
                      >
                        <MessageCircleQuestion
                          className={cn(
                            "size-4 shrink-0 text-navy-500",
                            opening === row.id && "animate-pulse"
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-ink-900">
                          {row.title || t("untitled")}
                        </span>
                        <span className="shrink-0 text-[11px] text-ink-600 tnum">
                          {relativeTime(row.updatedAt, locale)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<MessageCircleQuestion />}
                    title={t("recentEmpty")}
                    hint={t("recentEmptyHint")}
                    className="py-8"
                  />
                )}
                {openError ? (
                  <p role="alert" className="mt-2 text-xs text-danger">
                    {t("loadError")}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4" data-testid="ask-thread">
              {turns.map((turn, i) =>
                turn.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <p
                      className="max-w-[88%] rounded-2xl rounded-ee-md bg-navy-100 px-3.5 py-2 text-[15px] leading-relaxed text-navy-900"
                      data-testid="ask-turn-user"
                    >
                      {turn.content}
                    </p>
                  </div>
                ) : (
                  <div key={i} className="card p-4" data-testid="ask-turn-assistant">
                    <Eyebrow className="mb-2 flex items-center gap-1.5">
                      <Sparkles className="size-3 text-aqua-500" aria-hidden /> {t("byline")}
                    </Eyebrow>
                    <AnalystAnswer
                      compact
                      turn={turn}
                      onFollowUp={(f) => send(f)}
                      showFollowUps={i === turns.length - 1 && !analyst.streaming}
                    />
                  </div>
                )
              )}
              {liveTurn ? (
                <div className="card p-4" data-testid="ask-turn-live">
                  <Eyebrow className="mb-2 flex items-center gap-1.5">
                    <Sparkles className="size-3 text-aqua-500" aria-hidden /> {t("byline")}
                  </Eyebrow>
                  <AnalystAnswer compact turn={liveTurn} streaming chips={analyst.chips} />
                </div>
              ) : null}
              {analyst.error && !analyst.streaming ? (
                <div
                  role="alert"
                  className="flex items-center justify-between gap-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger"
                  data-testid="ask-error"
                >
                  <span>{t("error")}</span>
                  <button
                    type="button"
                    onClick={retry}
                    className="rounded-md border border-danger/30 px-2 py-0.5 text-xs font-medium hover:bg-white cursor-pointer"
                  >
                    {t("retry")}
                  </button>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="border-t border-mist-100 bg-white p-3"
        >
          <div className="relative">
            <Textarea
              ref={composerRef}
              value={draft}
              onChange={(e) => askPanel.setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              placeholder={hasThread ? t("followUp") : t("placeholder")}
              rows={2}
              className="min-h-12 resize-none pe-12 text-[15px]"
              aria-label={t("placeholder")}
              data-testid="ask-composer"
            />
            <button
              type="submit"
              disabled={analyst.streaming || !draft.trim()}
              className="absolute bottom-2 end-2 rounded-lg bg-navy-700 p-2 text-white transition-colors hover:bg-navy-900 disabled:opacity-40 cursor-pointer"
              aria-label={t("send")}
              data-testid="ask-send"
            >
              <CornerDownLeft className="size-4 flip-rtl" aria-hidden />
            </button>
          </div>
          <p className="mt-2 flex items-center justify-between gap-3 text-[11px] leading-snug text-ink-600">
            <span>{t("disclaimer")}</span>
            <kbd className="shrink-0 rounded border border-mist-300 bg-mist-50 px-1.5 py-0.5 font-sans text-[11px] text-ink-600 tnum">
              {shortcut}
            </kbd>
          </p>
        </form>
      </motion.aside>
    </div>
  );
}
