"use client";
// The conversation workspace: turns with rich answer sections, a composer that
// keeps the conversation open, and share / export / pin / delete actions.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import {
  CornerDownLeft,
  Share2,
  FileDown,
  Pin,
  Trash2,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Button, Textarea, NativeSelect, Chip } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import {
  useAnalyst,
  AnalystAnswer,
  type AnalystTurnData,
} from "@/components/nexus/Workspace";

export function ConversationClient({
  conversationId: initialConversationId,
  title,
  turns: initialTurns,
  isOwner,
  isShared: initialShared,
  initialQuery,
  context,
}: {
  conversationId: string | null;
  title: string;
  turns: AnalystTurnData[];
  isOwner: boolean;
  isShared: boolean;
  initialQuery: string;
  context: { type: string; id: string } | null;
}) {
  const t = useTranslations("analyst");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const analyst = useAnalyst();
  const [conversationId, setConversationId] = React.useState(initialConversationId);
  const [turns, setTurns] = React.useState<AnalystTurnData[]>(initialTurns);
  const [query, setQuery] = React.useState("");
  const [shared, setShared] = React.useState(initialShared);
  const [collections, setCollections] = React.useState<{ id: string; nameEn: string; nameAr: string }[]>([]);
  const [pinOpen, setPinOpen] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const autoSubmitted = React.useRef(false);

  const send = React.useCallback(
    (message: string) => {
      if (!message.trim() || analyst.streaming) return;
      setTurns((prev) => [...prev, { role: "user", content: message.trim() }]);
      setQuery("");
      analyst.send({
        message: message.trim(),
        locale,
        conversationId,
        context,
        onConversation: (id) => {
          setConversationId(id);
          // land the URL on the conversation without a reload
          window.history.replaceState(null, "", window.location.pathname.replace(/\/c\/new.*/, `/c/${id}`));
        },
        onFinal: (turn) => {
          setTurns((prev) => [...prev, turn]);
        },
      });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
    },
    [analyst, conversationId, context, locale]
  );

  React.useEffect(() => {
    if (initialQuery && !autoSubmitted.current) {
      autoSubmitted.current = true;
      send(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleShare() {
    if (!conversationId) return;
    const next = !shared;
    setShared(next);
    const res = await fetch(`/api/v1/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ share: next }),
    });
    if (!res.ok) {
      setShared(!next);
      toast(tc("error"), "error");
      return;
    }
    if (next) {
      await navigator.clipboard
        .writeText(window.location.href)
        .catch(() => {});
      toast(t("sharedToast"), "success");
    } else {
      toast(t("unsharedToast"), "info");
    }
  }

  async function exportDocx() {
    if (!conversationId) return;
    const res = await fetch(`/api/v1/conversations/${conversationId}/export`);
    if (!res.ok) {
      toast(tc("error"), "error");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sianexus-answer.docx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function openPin() {
    if (!collections.length) {
      const cRes = await fetch("/api/v1/collections").catch(() => null);
      if (cRes?.ok) {
        const json = await cRes.json();
        setCollections(json.data ?? []);
      }
    }
    setPinOpen((v) => !v);
  }

  async function pinTo(collectionId: string) {
    if (!conversationId || !collectionId) return;
    const res = await fetch(`/api/v1/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pinToCollection: collectionId }),
    });
    if (res.ok) {
      toast(t("pinnedToast"), "success");
      setPinOpen(false);
    } else toast(tc("error"), "error");
  }

  async function remove() {
    if (!conversationId) return;
    const res = await fetch(`/api/v1/conversations/${conversationId}`, { method: "DELETE" });
    if (res.ok) {
      toast(t("deletedToast"), "info");
      router.push("/ask");
    } else toast(tc("error"), "error");
  }

  const liveTurn: AnalystTurnData | null =
    analyst.streaming || (analyst.text && !analyst.final)
      ? {
          role: "assistant",
          content: analyst.text,
          citations: analyst.citations,
          workspace: analyst.workspace,
          confidence: undefined,
        }
      : null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href="/ask"
          className="inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-maroon-900"
        >
          <ArrowLeft className="size-4 flip-rtl" /> {t("backToAsk")}
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg">{title || t("newConversation")}</h1>
        {shared ? <Chip tone="gulf">{t("sharedChip")}</Chip> : null}
        {isOwner && conversationId ? (
          <span className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={toggleShare} aria-label={t("share")}>
              <Share2 /> {shared ? t("unshare") : t("share")}
            </Button>
            <Button variant="ghost" size="sm" onClick={exportDocx}>
              <FileDown /> {t("export")}
            </Button>
            <span className="relative">
              <Button variant="ghost" size="sm" onClick={openPin}>
                <Pin /> {t("pin")}
              </Button>
              {pinOpen ? (
                <span className="absolute end-0 top-9 z-40 block w-56 rounded-xl border border-sand-300 bg-white p-2 shadow-[var(--shadow-pop)]">
                  {collections.length ? (
                    <NativeSelect
                      autoFocus
                      onChange={(e) => e.target.value && pinTo(e.target.value)}
                      aria-label={t("pinTo")}
                    >
                      <option value="">{t("pinTo")}</option>
                      {collections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {bi(locale, c.nameEn, c.nameAr)}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : (
                    <span className="block px-2 py-1 text-xs text-ink-400">{tc("loading")}</span>
                  )}
                </span>
              ) : null}
            </span>
            <Button variant="ghost" size="sm" onClick={remove} aria-label={tc("delete")}>
              <Trash2 />
            </Button>
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-6">
        {turns.map((turn, i) =>
          turn.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-ee-md bg-maroon-100 px-4 py-2.5 text-[15px] leading-relaxed text-maroon-900">
                {turn.content}
              </p>
            </div>
          ) : (
            <div key={i} className="card p-5" data-testid="workspace-turn">
              <AnalystAnswer
                turn={turn}
                onFollowUp={(f) => send(f)}
                showFollowUps={i === turns.length - 1 && isOwner && !analyst.streaming}
              />
            </div>
          )
        )}
        {liveTurn ? (
          <div className="card p-5" data-testid="workspace-live">
            <AnalystAnswer turn={liveTurn} streaming chips={analyst.chips} />
          </div>
        ) : null}
        {analyst.error ? (
          <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{tc("error")}</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {/* composer keeps the conversation open */}
      {isOwner ? (
        <div className="sticky bottom-4 mt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(query);
            }}
            className="card p-3 shadow-[var(--shadow-pop)]"
          >
            <div className="relative">
              <Sparkles className="pointer-events-none absolute start-3 top-3 size-4 text-gold-500" />
              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(query);
                  }
                }}
                placeholder={turns.length ? t("followUpPlaceholder") : t("placeholder")}
                rows={2}
                className="min-h-12 ps-10 pe-12"
                aria-label={t("placeholder")}
              />
              <button
                type="submit"
                disabled={analyst.streaming || !query.trim()}
                className={cn(
                  "absolute bottom-2 end-2 rounded-lg bg-maroon-700 p-2 text-white transition-colors hover:bg-maroon-900 disabled:opacity-40 cursor-pointer"
                )}
                aria-label={t("send")}
              >
                <CornerDownLeft className="size-4" />
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
