"use client";
// The end-side EnviroAI Intelligence panel: the document summary, suggested
// actions (each one asks the shared analyst, scoped to this document), the
// answer, key facts, and a free question box. The analyst hook lives in the
// reader workspace so the action chips above the page feed the same answer.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  BadgeCheck,
  BarChart3,
  CalendarClock,
  CornerDownLeft,
  Files,
  FileText,
  Lightbulb,
  PenLine,
  Sparkles,
  Table2,
  Users,
} from "lucide-react";
import { bi } from "@/lib/utils";
import { Button, Chip, Input } from "@/components/ui/primitives";
import { AnalystAnswer, type useAnalyst } from "@/components/nexus/Workspace";

export type ReaderKeyFact = { text: string; page: number | null };

const SUGGESTIONS = [
  { key: "summarize", icon: FileText },
  { key: "extractKpis", icon: BarChart3 },
  { key: "explainTerms", icon: Lightbulb },
  { key: "obligations", icon: CalendarClock },
  { key: "entities", icon: Users },
  { key: "comparison", icon: Table2 },
  { key: "briefing", icon: PenLine },
  { key: "related", icon: Files },
] as const;

export function AiPanel({
  documentId,
  summaryEn,
  summaryAr,
  summaryMachine,
  verified,
  keyFacts,
  analyst,
  onAsk,
  onGoToPage,
}: {
  documentId: string;
  summaryEn: string | null;
  summaryAr: string | null;
  summaryMachine: boolean;
  verified: boolean;
  keyFacts: ReaderKeyFact[];
  analyst: ReturnType<typeof useAnalyst>;
  onAsk: (question: string) => void;
  onGoToPage: (page: number) => void;
}) {
  const t = useTranslations("reader");
  const tk = useTranslations("ksaReader");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [drafting, setDrafting] = React.useState(false);

  const summary = bi(locale, summaryEn ?? "", summaryAr ?? "");

  async function draftLesson() {
    setDrafting(true);
    try {
      const res = await fetch(`/api/v1/documents/${documentId}/content?kind=text`);
      const json = await res.json();
      const rough = (json.data?.text ?? "").slice(0, 2500);
      sessionStorage.setItem("enviroai-lesson-draft", rough);
      router.push("/add?from=reader" as never);
    } finally {
      setDrafting(false);
    }
  }

  const turn =
    analyst.final ??
    (analyst.streaming || analyst.text
      ? {
          role: "assistant" as const,
          content: analyst.text,
          citations: analyst.citations,
          workspace: analyst.workspace,
        }
      : null);

  return (
    <aside id="reader-intelligence" className="lg:sticky lg:top-20 lg:h-fit" data-testid="intelligence-panel">
      <div className="card flex max-h-[calc(100vh-7rem)] flex-col overflow-y-auto p-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
          <Sparkles className="size-4 text-teal-600" aria-hidden /> {t("aiPanel")}
        </p>

        {summary ? (
          <div className="mb-4 rounded-lg border border-mist-300 bg-mist-50 p-3">
            <p className="text-sm leading-relaxed text-ink-900">{summary}</p>
            {summaryMachine ? (
              <Chip tone="aqua" className="mt-1.5">
                {tc("aiTranslation")}
              </Chip>
            ) : null}
          </div>
        ) : null}

        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-400">{tk("panel.suggested")}</p>
        <div className="mb-4 grid grid-cols-1 gap-1.5" data-testid="suggested-actions">
          {SUGGESTIONS.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              disabled={analyst.streaming}
              onClick={() => onAsk(tk(`prompts.${key}` as never))}
              data-testid={`suggestion-${key}`}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-mist-300 bg-white px-3 py-2 text-start text-sm text-ink-900 transition-colors hover:border-teal-600/60 hover:bg-aqua-100/40 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-aqua-500"
            >
              <Icon className="size-4 shrink-0 text-teal-600" aria-hidden />
              {tk(`suggestions.${key}` as never)}
            </button>
          ))}
          <Button variant="ghost" size="sm" className="justify-start" onClick={draftLesson} loading={drafting}>
            <Lightbulb /> {t("draftLesson")}
          </Button>
        </div>

        {turn ? (
          <div className="mb-4 border-t border-mist-100 pt-3 text-sm" data-testid="intelligence-answer">
            <AnalystAnswer
              turn={turn}
              streaming={analyst.streaming}
              chips={analyst.chips}
              onFollowUp={(f) => onAsk(f)}
              compact
            />
          </div>
        ) : null}

        {keyFacts.length ? (
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">{tk("panel.keyFacts")}</p>
              {verified ? (
                <Chip tone="teal" className="shrink-0 whitespace-nowrap">
                  <BadgeCheck className="size-3" aria-hidden /> {tk("panel.verified")}
                </Chip>
              ) : null}
            </div>
            <ul className="space-y-2 text-xs leading-relaxed text-ink-900">
              {keyFacts.map((f, i) => (
                <li key={i} className="rounded-lg bg-aqua-100/60 px-2.5 py-2">
                  {f.text}
                  {f.page ? (
                    <button
                      type="button"
                      onClick={() => onGoToPage(f.page as number)}
                      className="ms-1 cursor-pointer text-ink-400 underline-offset-2 tnum hover:text-navy-700 hover:underline focus-visible:outline-2 focus-visible:outline-aqua-500"
                    >
                      ({f.page})
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!query.trim()) return;
            onAsk(query);
            setQuery("");
          }}
          className="relative mt-auto"
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("askAboutDoc")}
            aria-label={t("askAboutDoc")}
            className="pe-9"
          />
          <button
            type="submit"
            aria-label={t("askCta")}
            className="absolute end-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-ink-400 hover:text-navy-700"
          >
            <CornerDownLeft className="size-4 flip-rtl" />
          </button>
        </form>
        <p className="mt-1.5 text-[11px] text-ink-400">{tk("panel.scopeNote")}</p>
      </div>
    </aside>
  );
}
