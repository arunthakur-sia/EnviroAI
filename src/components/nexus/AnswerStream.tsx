"use client";
// Streams an Ask EnviroAI answer: breathing caret, citation chips as they arrive,
// confidence meter, source list, feedback and routing actions.
import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ThumbsUp,
  ThumbsDown,
  Send,
  FileText,
  BarChart3,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Chip, Avatar } from "@/components/ui/primitives";
import { Tip } from "@/components/ui/overlays";
import { OwnerControlCompact } from "@/components/nexus/people/OwnerControl";
import type { OwnerRef, OwnerRole } from "@/components/nexus/people/types";

export type Citation = {
  n: number;
  resource_type?: string;
  resource_id: string;
  title: string;
  page: number | null;
  excerpt: string;
  lang?: string;
  edition?: string | null;
  verified?: boolean;
  classification?: number;
  /* CR08 9.1: the person behind the cited item. OPTIONAL for good: answers
     are persisted with their citations and older rows carry none. */
  owner?: (OwnerRef & { role: OwnerRole }) | null;
};

export function citationHref(c: Citation): string {
  switch (c.resource_type) {
    case "indicator":
      return `/statistics/${c.resource_id}`;
    case "node":
      return `/strategy/${c.resource_id}`;
    case "lesson":
      return `/lessons/${c.resource_id}`;
    /* CR04 5: theme citations open the Learning Room */
    case "lesson_theme":
      return `/lessons`;
    /* CR05 4.9: indices are a source type; resource_id is the index code */
    case "index":
    case "index_forecast":
      return `/indices/${c.resource_id}`;
    case "signal":
      return `/trends/${c.resource_id}`;
    case "expert":
      return `/experts/${c.resource_id}`;
    case "question":
    case "answer":
      return `/ask`;
    case "podcast_episode":
      return `/podcast/${c.resource_id}`;
    default:
      return `/vault/${c.resource_id}${c.page ? `?page=${c.page}` : ""}`;
  }
}

export type SuggestedExpert = {
  id: string;
  nameEn: string;
  nameAr: string;
  positionEn: string | null;
  positionAr: string | null;
  organisationEn: string | null;
  availability: string;
  reasonEn: string;
  reasonAr: string;
  /* CR08 3: Office staff are internal, everyone else external */
  kind?: "internal" | "external";
};

export type AskFinal = {
  markdown: string;
  citations: Citation[];
  confidence: "high" | "medium" | "low";
  suggestedExperts: SuggestedExpert[];
  /* CR08 3: the same suggestions in two labelled groups, internal first */
  suggestedExpertGroups?: { internal: SuggestedExpert[]; external: SuggestedExpert[] };
  includesSecret: boolean;
};

export function useAsk() {
  const [text, setText] = React.useState("");
  const [final, setFinal] = React.useState<AskFinal | null>(null);
  const [citations, setCitations] = React.useState<Citation[]>([]);
  const [streaming, setStreaming] = React.useState(false);
  const [conversationId, setConversationId] = React.useState<string | null>(null);

  const ask = React.useCallback(
    async (query: string, locale: string, scopeDocumentIds?: string[]) => {
      setText("");
      setFinal(null);
      setCitations([]);
      setStreaming(true);
      try {
        const res = await fetch("/api/v1/ai/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query, locale, scopeDocumentIds, conversationId: conversationId ?? undefined }),
        });
        if (!res.ok || !res.body) throw new Error("ask_failed");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const raw of events) {
            const eventMatch = /^event: (\w+)$/m.exec(raw);
            const dataMatch = /^data: (.*)$/m.exec(raw);
            if (!eventMatch || !dataMatch) continue;
            const kind = eventMatch[1];
            const data = JSON.parse(dataMatch[1]);
            if (kind === "meta" && data.conversationId) setConversationId(data.conversationId);
            if (kind === "sources") setCitations(data.citations ?? []);
            if (kind === "delta") setText((t) => t + data.text);
            if (kind === "final") {
              setFinal(data);
              setText(data.markdown);
              setCitations(data.citations ?? []);
            }
          }
        }
      } catch {
        setFinal((f) => f);
      } finally {
        setStreaming(false);
      }
    },
    [conversationId]
  );

  return { text, final, citations, streaming, ask, conversationId };
}

/** Renders markdown-lite with [n] citation chips inline. */
export function AnswerMarkdown({
  text,
  citations,
  streaming,
  className,
}: {
  text: string;
  citations: Citation[];
  streaming?: boolean;
  className?: string;
}) {
  const parts = React.useMemo(() => text.split(/(\[\d+\])/g), [text]);
  const byN = React.useMemo(() => new Map(citations.map((c) => [c.n, c])), [citations]);
  return (
    <div className={cn("whitespace-pre-wrap text-[15px] leading-relaxed text-ink-900", className)}>
      {parts.map((part, i) => {
        const m = /^\[(\d+)\]$/.exec(part);
        if (m) {
          const c = byN.get(Number(m[1]));
          return <CitationChip key={i} n={Number(m[1])} citation={c} />;
        }
        // markdown-lite: bold + bullets render naturally via whitespace-pre-wrap
        return (
          <React.Fragment key={i}>
            {part.split(/(\*\*[^*]+\*\*)/g).map((seg, j) => {
              const bold = /^\*\*([^*]+)\*\*$/.exec(seg);
              return bold ? <strong key={j}>{bold[1]}</strong> : <React.Fragment key={j}>{seg}</React.Fragment>;
            })}
          </React.Fragment>
        );
      })}
      {streaming ? <span className="stream-caret" aria-hidden /> : null}
    </div>
  );
}

export function CitationChip({ n, citation }: { n: number; citation?: Citation }) {
  const chip = (
    <Link
      href={citation ? (citationHref(citation) as never) : ("#" as never)}
      className="mx-0.5 inline-flex h-4.5 min-w-4.5 translate-y-[-1px] cursor-pointer items-center justify-center rounded bg-navy-100 px-1 align-middle text-[10px] font-semibold text-navy-900 transition-colors hover:bg-navy-700 hover:text-white tnum"
    >
      {n}
    </Link>
  );
  if (!citation) return chip;
  return (
    <Tip
      content={
        <span className="block max-w-64">
          <span className="mb-0.5 block font-medium">{citation.title}</span>
          {citation.page ? <span className="block text-ink-400 tnum">p. {citation.page}</span> : null}
          <span className="mt-1 block text-ink-600">{citation.excerpt.slice(0, 160)}…</span>
        </span>
      }
    >
      {chip}
    </Tip>
  );
}

export function ConfidenceMeter({ level }: { level: "high" | "medium" | "low" }) {
  const t = useTranslations("common");
  const filled = level === "high" ? 3 : level === "medium" ? 2 : 1;
  const color = level === "high" ? "bg-ok" : level === "medium" ? "bg-warn" : "bg-danger";
  return (
    <span className="inline-flex items-center gap-1.5" title={t(`confidence.${level}`)}>
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn("h-2 w-4 rounded-sm", i < filled ? color : "bg-mist-200")}
          />
        ))}
      </span>
      <span className="text-xs text-ink-600">{t(`confidence.${level}`)}</span>
    </span>
  );
}

export function SourceList({ citations }: { citations: Citation[] }) {
  const t = useTranslations("ask");
  if (!citations.length) return null;
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-400">
        {t("sources")}
      </p>
      <div className="flex flex-col gap-1">
        {citations.map((c) => {
          const isIndicator = c.resource_type === "indicator";
          const Icon = isIndicator ? BarChart3 : FileText;
          return (
            /* CR08 9.1: the card is no longer one link: the title carries a
               stretched link and the person chip sits beside it, because the
               person card opens from a button */
            <div
              key={c.n}
              className="group relative flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-navy-50"
              data-testid="citation-row"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-navy-100 text-[10px] font-semibold text-navy-900 tnum">
                {c.n}
              </span>
              <Icon
                className={
                  isIndicator ? "size-3.5 shrink-0 text-teal-600" : "size-3.5 shrink-0 text-ink-400"
                }
              />
              <Link
                href={citationHref(c) as never}
                /* flex-1: the title takes the free space, so every tag and the
                   person chip keep to the end of the row */
                className="min-w-0 flex-1 truncate rounded text-ink-900 after:absolute after:inset-0 after:content-[''] group-hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
              >
                {c.title}
              </Link>
              {c.edition && c.edition !== "nes3" ? (
                <span className="shrink-0 rounded bg-mist-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-600">
                  {c.edition}
                </span>
              ) : null}
              {c.verified ? (
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-ok">
                  ✓
                </span>
              ) : null}
              {isIndicator ? (
                <span className="ms-auto shrink-0 text-[10px] font-medium uppercase tracking-wide text-teal-600">
                  {t("statisticTag")}
                </span>
              ) : c.resource_type === "index" || c.resource_type === "index_forecast" ? (
                <span className="ms-auto shrink-0 rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-teal-600">
                  {c.resource_type === "index_forecast" ? t("forecastTag") : t("indexTag")}
                </span>
              ) : c.resource_type === "podcast_episode" ? (
                <span className="ms-auto shrink-0 rounded bg-navy-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-navy-900">
                  {t("podcastTag")}
                </span>
              ) : c.title.startsWith("Deliverable ") ? (
                <span className="ms-auto shrink-0 rounded bg-navy-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-navy-900">
                  {t("deliverableTag")}
                </span>
              ) : c.page ? (
                <span className="ms-auto shrink-0 text-xs text-ink-400 tnum">p. {c.page}</span>
              ) : null}
              {/* z-[1]: above the stretched link that covers the card */}
              {c.owner ? (
                <span className="relative z-[1] shrink-0" data-testid="citation-owner">
                  <OwnerControlCompact
                    owner={c.owner}
                    align="end"
                    item={{
                      type: c.resource_type ?? "document",
                      id: c.resource_id,
                      titleEn: c.title,
                      titleAr: c.title,
                      href: citationHref(c),
                    }}
                  />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AnswerFooter({
  final,
  locale,
  onRoute,
  onFeedback,
}: {
  final: AskFinal;
  locale: string;
  onRoute?: (expertId: string) => void;
  onFeedback?: (helpful: boolean) => void;
}) {
  const t = useTranslations("ask");
  const te = useTranslations("experts");
  const [voted, setVoted] = React.useState<null | boolean>(null);
  // CR08 3: two labelled groups, internal first; older payloads without
  // groups or kinds fall back to one internal group
  const expertGroups = (
    [
      {
        key: "internal",
        items:
          final.suggestedExpertGroups?.internal ??
          final.suggestedExperts.filter((e) => e.kind !== "external"),
      },
      {
        key: "external",
        items:
          final.suggestedExpertGroups?.external ??
          final.suggestedExperts.filter((e) => e.kind === "external"),
      },
    ] as { key: "internal" | "external"; items: SuggestedExpert[] }[]
  ).filter((g) => g.items.length);
  return (
    <div className="mt-4 border-t border-mist-100 pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <ConfidenceMeter level={final.confidence} />
        {final.includesSecret ? (
          <Chip tone="danger">
            <ShieldAlert className="size-3" /> {t("includesSecret")}
          </Chip>
        ) : null}
        <span className="ms-auto flex items-center gap-1">
          <button
            aria-label={t("helpful")}
            onClick={() => {
              setVoted(true);
              onFeedback?.(true);
            }}
            className={cn(
              "rounded-lg p-1.5 text-ink-400 hover:bg-ok-light hover:text-ok cursor-pointer",
              voted === true && "bg-ok-light text-ok"
            )}
          >
            <ThumbsUp className="size-4" />
          </button>
          <button
            aria-label={t("notHelpful")}
            onClick={() => {
              setVoted(false);
              onFeedback?.(false);
            }}
            className={cn(
              "rounded-lg p-1.5 text-ink-400 hover:bg-danger-light hover:text-danger cursor-pointer",
              voted === false && "bg-danger-light text-danger"
            )}
          >
            <ThumbsDown className="size-4" />
          </button>
        </span>
      </div>

      {expertGroups.length ? (
        <div className="mt-3 rounded-xl bg-mist-50 p-3" data-testid="suggested-experts">
          <p className="mb-2 text-sm font-medium text-ink-900">
            {final.confidence === "low" ? t("routePrimary") : t("routeSecondary")}
          </p>
          <div className="flex flex-col gap-3">
            {expertGroups.map((g) => (
              <div key={g.key} className="flex flex-col gap-2" data-testid={`suggested-${g.key}`}>
                <p className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn("h-3 w-1 rounded-full", g.key === "internal" ? "bg-navy-700" : "bg-teal-600")}
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-600 rtl:tracking-normal">
                    {te(`groups.${g.key}`)}
                  </span>
                </p>
                {g.items.map((e) => (
                  <div key={e.id} className="flex items-center gap-3">
                    <Avatar name={e.nameEn} color={g.key === "internal" ? "navy" : "teal"} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">
                        {locale === "ar" ? e.nameAr : e.nameEn}
                      </p>
                      <p className="truncate text-xs text-ink-600">
                        {locale === "ar" ? e.reasonAr : e.reasonEn}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={final.confidence === "low" ? "primary" : "secondary"}
                      onClick={() => onRoute?.(e.id)}
                    >
                      <Send /> {t("route")}
                    </Button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
