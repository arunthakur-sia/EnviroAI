"use client";
// The sticky end-side AI panel: summary, reading companion actions, and the
// analyst workspace scoped to this document (CR01 4.5: same workspace component).
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Sparkles, SearchCode, Calculator, Lightbulb, CornerDownLeft } from "lucide-react";
import { bi } from "@/lib/utils";
import { Button, Input, Chip } from "@/components/ui/primitives";
import { useAnalyst, AnalystAnswer } from "@/components/nexus/Workspace";

export function AiPanel({
  documentId,
  summaryEn,
  summaryAr,
  summaryMachine,
}: {
  documentId: string;
  summaryEn: string | null;
  summaryAr: string | null;
  summaryMachine: boolean;
}) {
  const t = useTranslations("reader");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const analyst = useAnalyst();
  const [query, setQuery] = React.useState("");
  const [drafting, setDrafting] = React.useState(false);

  const summary = bi(locale, summaryEn ?? "", summaryAr ?? "");

  function scopedAsk(q: string) {
    if (!q.trim() || analyst.streaming) return;
    analyst.send({
      message: q,
      locale,
      conversationId: analyst.conversationId,
      context: { type: "document", id: documentId },
    });
  }

  async function draftLesson() {
    setDrafting(true);
    try {
      const res = await fetch(`/api/v1/documents/${documentId}/content?kind=text`);
      const json = await res.json();
      const rough = (json.data?.text ?? "").slice(0, 2500);
      sessionStorage.setItem("nexus-lesson-draft", rough);
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
    <aside className="lg:sticky lg:top-20 lg:h-fit">
      <div className="card p-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-400">
          <Sparkles className="size-3.5 text-gold-500" /> {t("aiPanel")}
        </p>

        {summary ? (
          <div className="mb-4">
            <p className="text-sm leading-relaxed text-ink-900">{summary}</p>
            {summaryMachine ? (
              <Chip tone="gold" className="mt-1.5">
                {tc("aiTranslation")}
              </Chip>
            ) : null}
          </div>
        ) : null}

        <div className="mb-4 grid grid-cols-1 gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => scopedAsk(locale === "ar" ? "استخرج الأرقام الرئيسية في هذه الوثيقة" : "Extract the key numbers in this document")}
          >
            <Calculator /> {t("extractNumbers")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => scopedAsk(locale === "ar" ? "اشرح المصطلحات الأساسية في هذه الوثيقة" : "Explain the key terms used in this document")}
          >
            <SearchCode /> {t("explainTerms")}
          </Button>
          <Button variant="ghost" size="sm" className="justify-start" onClick={draftLesson} loading={drafting}>
            <Lightbulb /> {t("draftLesson")}
          </Button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            scopedAsk(query);
          }}
          className="relative"
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("askAboutDoc")}
            className="pe-9"
          />
          <button
            type="submit"
            aria-label={t("askCta")}
            className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-maroon-700 cursor-pointer"
          >
            <CornerDownLeft className="size-4" />
          </button>
        </form>

        {turn ? (
          <div className="mt-4 border-t border-sand-100 pt-3 text-sm">
            <AnalystAnswer
              turn={turn}
              streaming={analyst.streaming}
              chips={analyst.chips}
              onFollowUp={(f) => scopedAsk(f)}
            />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
