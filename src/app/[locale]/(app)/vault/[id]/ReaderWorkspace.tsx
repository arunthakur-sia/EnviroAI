"use client";
// The three-column reading workspace: outline, page viewer with its action
// chips and bottom tabs, and the EnviroAI Intelligence panel. It owns the
// current page (so an outline click moves the viewer) and the analyst stream
// (so a chip above the page and a suggestion in the panel feed one answer).
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  BarChart3,
  ChevronDown,
  Headphones,
  Languages,
  Lightbulb,
  Quote,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Chip } from "@/components/ui/primitives";
import { BriefDialog } from "@/components/nexus/BriefDialog";
import { useAnalyst } from "@/components/nexus/Workspace";
import { Reader } from "./Reader";
import { AiPanel, type ReaderKeyFact } from "./AiPanel";
import { OutlinePanel, type OutlineEntry } from "./OutlinePanel";

type TableData = { caption: string | null; columns: string[]; rows: string[][] };
type TabKey = "sections" | "keyFacts" | "related" | "versions";

const OUTLINE_KEY = "enviroai:reader-outline-collapsed";

export function ReaderWorkspace({
  documentId,
  kind,
  pageCount,
  initialPage,
  tables,
  outline,
  keyFacts,
  tags,
  versions,
  summaryEn,
  summaryAr,
  summaryMachine,
  verified,
  numerals,
}: {
  documentId: string;
  kind: "pdf" | "html" | "tables" | "text";
  pageCount: number;
  initialPage: number;
  tables: TableData[];
  outline: OutlineEntry[];
  keyFacts: ReaderKeyFact[];
  tags: { id: string; label: string; tone: "navy" | "mist" }[];
  versions: { versionNo: number; createdAt: string; note: string | null }[];
  summaryEn: string | null;
  summaryAr: string | null;
  summaryMachine: boolean;
  verified: boolean;
  numerals: string;
}) {
  const t = useTranslations("ksaReader");
  const tr = useTranslations("reader");
  const locale = useLocale();
  const analyst = useAnalyst();
  const [page, setPage] = React.useState(Math.max(1, initialPage));
  const [outlineCollapsed, setOutlineCollapsed] = React.useState(false);
  const [tab, setTab] = React.useState<TabKey>("sections");
  const [tabsOpen, setTabsOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      setOutlineCollapsed(window.localStorage.getItem(OUTLINE_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);
  function toggleOutline() {
    setOutlineCollapsed((c) => {
      try {
        window.localStorage.setItem(OUTLINE_KEY, c ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !c;
    });
  }

  const ask = React.useCallback(
    (question: string) => {
      if (!question.trim() || analyst.streaming) return;
      analyst.send({
        message: question,
        locale,
        conversationId: analyst.conversationId,
        context: { type: "document", id: documentId },
      });
      // on narrow screens the panel sits below the page: bring the answer into view
      document.getElementById("reader-intelligence")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
    [analyst, locale, documentId]
  );

  const chip =
    "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700 [&_svg]:size-4 [&_svg]:shrink-0";
  const chipLive = "cursor-pointer border-mist-300 bg-white text-ink-900 hover:border-navy-300 hover:text-navy-700";
  const chipOff = "cursor-not-allowed border-mist-300 bg-mist-50 text-ink-400";
  const soon = t("actions.comingSoon");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "sections", label: t("tabs.sections") },
    { key: "keyFacts", label: t("tabs.keyFacts") },
    { key: "related", label: t("tabs.related") },
    { key: "versions", label: t("tabs.versions") },
  ];

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-5",
        outlineCollapsed ? "lg:grid-cols-[2.75rem_minmax(0,1fr)_320px]" : "lg:grid-cols-[280px_minmax(0,1fr)_320px]"
      )}
      data-testid="reader-workspace"
    >
      <aside className="hidden lg:block">
        <div className="sticky top-20">
          <OutlinePanel
            outline={outline}
            currentPage={page}
            totalPages={pageCount}
            onJump={setPage}
            collapsed={outlineCollapsed}
            onToggle={toggleOutline}
          />
        </div>
      </aside>

      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label={t("actions.row")} data-testid="reader-actions">
          <BriefDialog resourceType="document" resourceId={documentId} />
          <Link href={`/podcast/new?document=${documentId}` as never} className={cn(chip, chipLive)} data-testid="action-listen">
            <Headphones aria-hidden /> {t("actions.listen")}
          </Link>
          <button type="button" disabled title={soon} aria-label={`${t("actions.translate")}: ${soon}`} className={cn(chip, chipOff)} data-testid="action-translate">
            <Languages aria-hidden /> {t("actions.translate")}
          </button>
          <button
            type="button"
            disabled={analyst.streaming}
            onClick={() => ask(t("prompts.extractKpis"))}
            className={cn(chip, chipLive, "disabled:opacity-50")}
            data-testid="action-extract"
          >
            <BarChart3 aria-hidden /> {t("actions.extractFigures")}
          </button>
          <button
            type="button"
            disabled={analyst.streaming}
            onClick={() => ask(t("prompts.explainTerms"))}
            className={cn(chip, chipLive, "disabled:opacity-50")}
            data-testid="action-explain"
          >
            <Lightbulb aria-hidden /> {t("actions.explainTerms")}
          </button>
          <button type="button" disabled title={soon} aria-label={`${t("actions.compare")}: ${soon}`} className={cn(chip, chipOff)} data-testid="action-compare">
            <Scale aria-hidden /> {t("actions.compare")}
          </button>
          <button type="button" disabled title={soon} aria-label={`${t("actions.cite")}: ${soon}`} className={cn(chip, chipOff)} data-testid="action-cite">
            <Quote aria-hidden /> {t("actions.cite")}
          </button>
        </div>

        <Reader
          documentId={documentId}
          kind={kind}
          pageCount={pageCount}
          initialPage={page}
          tables={tables}
          page={kind === "pdf" ? page : undefined}
          onPageChange={kind === "pdf" ? setPage : undefined}
        />

        <div className="card mt-4 overflow-hidden" data-testid="reader-tabs">
          <div className="flex items-center justify-between gap-2 border-b border-mist-100 px-2">
            <div role="tablist" className="flex min-w-0 flex-wrap">
              {tabs.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === x.key}
                  onClick={() => {
                    setTab(x.key);
                    setTabsOpen(true);
                  }}
                  className={cn(
                    "cursor-pointer border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-aqua-500",
                    tab === x.key ? "border-teal-600 text-navy-900" : "border-transparent text-ink-600 hover:text-navy-900"
                  )}
                >
                  {x.label}
                </button>
              ))}
              <span className="px-3 py-2.5 text-sm text-ink-400" title={soon}>{t("tabs.entities")}</span>
              <span className="px-3 py-2.5 text-sm text-ink-400" title={soon}>{t("tabs.citations")}</span>
            </div>
            <button
              type="button"
              onClick={() => setTabsOpen((o) => !o)}
              aria-expanded={tabsOpen}
              aria-label={t("tabs.sections")}
              className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-ink-400 hover:bg-navy-50 hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-aqua-500"
            >
              <ChevronDown className={cn("size-4 transition-transform", tabsOpen && "rotate-180")} />
            </button>
          </div>
          {tabsOpen ? (
            <div className="max-h-64 overflow-y-auto p-4 text-sm" role="tabpanel">
              {tab === "sections" ? (
                outline.length ? (
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {outline.map((o, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => setPage(o.page)}
                          className="flex w-full cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-start text-ink-600 hover:bg-navy-50 hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-aqua-500"
                        >
                          <span className="truncate" dir="auto">{o.heading}</span>
                          <span className="text-xs text-ink-400 tnum">{o.page}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-ink-600">{t("noOutline")}</p>
                )
              ) : null}
              {tab === "keyFacts" ? (
                keyFacts.length ? (
                  <ul className="space-y-2">
                    {keyFacts.map((f, i) => (
                      <li key={i} className="rounded-lg bg-aqua-100/60 px-3 py-2 text-ink-900">
                        {f.text}
                        {f.page ? <span className="ms-1 text-ink-400 tnum">({f.page})</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-ink-600">{t("noKeyFacts")}</p>
                )
              ) : null}
              {tab === "related" ? (
                <div className="space-y-3">
                  <a href="#related-documents" className="font-medium text-navy-700 hover:underline">{tr("related")}</a>
                  {tags.length ? (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-400">{tr("tags")}</p>
                      <div className="flex flex-wrap gap-1">
                        {tags.map((tg) => (
                          <Chip key={tg.id} tone={tg.tone}>{tg.label}</Chip>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {tab === "versions" ? (
                versions.length > 1 ? (
                  <ul className="space-y-1.5">
                    {versions.map((v) => (
                      <li key={v.versionNo} className="flex flex-wrap items-baseline gap-x-3 text-ink-900">
                        <span className="font-medium tnum">{t("versionLine", { no: v.versionNo })}</span>
                        <span className="text-xs text-ink-600 tnum">{formatDate(v.createdAt, locale, { numerals })}</span>
                        {v.note ? <span className="text-xs text-ink-600">{v.note}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-ink-600">{t("noVersions")}</p>
                )
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <AiPanel
        documentId={documentId}
        summaryEn={summaryEn}
        summaryAr={summaryAr}
        summaryMachine={summaryMachine}
        verified={verified}
        keyFacts={keyFacts}
        analyst={analyst}
        onAsk={ask}
        onGoToPage={setPage}
      />
    </div>
  );
}
