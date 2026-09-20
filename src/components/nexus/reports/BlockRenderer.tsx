"use client";
// CR08 5: the React renderer for a section's SectionContent blocks (the same
// contract the docx template renders). Headings, paragraphs, lists, KPI tiles,
// tables and scorecards as CSS grids with ARIA table roles, charts through
// Recharts, quotes, callouts, key figures, figures, sources and page breaks.
import * as React from "react";
import { useTranslations } from "next-intl";
import { ArrowDownRight, ArrowUpRight, ExternalLink, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BiText, Block, Lang, Rag, SourceItem, Trend } from "@/server/reports/spec";
import { ReportChart } from "./ReportChart";
import { TONE_TEXT, TONE_WASH, pick } from "./shared";

const ALIGN: Record<string, string> = { start: "text-start", end: "text-end", center: "text-center" };
const RAG_CELL: Record<Rag, string> = {
  green: "bg-ok-light text-ok",
  amber: "bg-warn-light text-warn",
  red: "bg-danger-light text-danger",
  none: "text-ink-600",
};

function TrendGlyph({ trend }: { trend: Trend }) {
  const t = useTranslations("reports");
  const Icon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  return <Icon className="inline size-3.5 shrink-0 flip-rtl" aria-label={t(`report.trend.${trend}`)} />;
}

/** A source line under a table, chart or figure. */
function SourceLine({ source, lang }: { source?: BiText; lang: Lang }) {
  const t = useTranslations("reports");
  if (!source) return null;
  return <p className="mt-1.5 text-xs text-ink-400">{t("report.source", { source: pick(lang, source) })}</p>;
}

export function GridTable({
  columns,
  rows,
  align,
  caption,
  source,
  lang,
  testId = "report-table",
}: {
  columns: BiText[];
  rows: BiText[][];
  align?: ("start" | "end" | "center")[];
  caption?: BiText;
  source?: BiText;
  lang: Lang;
  testId?: string;
}) {
  const template = columns.map((_, i) => (i === 0 ? "minmax(11rem, 2fr)" : "minmax(6rem, 1fr)")).join(" ");
  return (
    <figure className="my-4" data-testid={testId}>
      {caption ? <figcaption className="mb-2 text-sm font-medium text-ink-900">{pick(lang, caption)}</figcaption> : null}
      <div className="overflow-x-auto rounded-xl border border-sand-300">
        <div role="table" className="min-w-[32rem] text-sm" style={{ display: "grid", gridTemplateColumns: template }}>
          <div role="row" className="contents">
            {columns.map((c, i) => (
              <div
                key={i}
                role="columnheader"
                className={cn(
                  "bg-maroon-700 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white rtl:tracking-normal",
                  ALIGN[align?.[i] ?? "start"]
                )}
              >
                {pick(lang, c)}
              </div>
            ))}
          </div>
          {rows.map((r, ri) => (
            <div key={ri} role="row" className="contents">
              {columns.map((_, ci) => (
                <div
                  key={ci}
                  role="cell"
                  className={cn(
                    "border-t border-sand-200 px-3 py-2 text-ink-900",
                    ri % 2 === 1 && "bg-sand-50",
                    ALIGN[align?.[ci] ?? "start"],
                    ci > 0 && "tnum"
                  )}
                >
                  {pick(lang, r[ci])}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <SourceLine source={source} lang={lang} />
    </figure>
  );
}

function Scorecard({
  block,
  lang,
}: {
  block: Extract<Block, { kind: "scorecard" }>;
  lang: Lang;
}) {
  const t = useTranslations("reports");
  const template = ["minmax(14rem, 2.4fr)", ...block.columns.map(() => "minmax(6rem, 1fr)")].join(" ");
  return (
    <figure className="my-4" data-testid="report-scorecard">
      {block.caption ? <figcaption className="mb-2 text-sm font-medium text-ink-900">{pick(lang, block.caption)}</figcaption> : null}
      <div className="overflow-x-auto rounded-xl border border-sand-300">
        <div role="table" className="min-w-[36rem] text-sm" style={{ display: "grid", gridTemplateColumns: template }}>
          <div role="row" className="contents">
            <div role="columnheader" className="bg-maroon-700 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white rtl:tracking-normal">
              {/* the row label column: named for screen readers, blank by design */}
              <span className="sr-only">{t("report.rowLabel")}</span>
            </div>
            {block.columns.map((c, i) => (
              <div key={i} role="columnheader" className="bg-maroon-700 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-white rtl:tracking-normal">
                {pick(lang, c)}
              </div>
            ))}
          </div>
          {block.rows.map((r, ri) => (
            <div key={ri} role="row" className="contents">
              <div role="rowheader" className={cn("border-t border-sand-200 px-3 py-2 font-medium text-ink-900", ri % 2 === 1 && "bg-sand-50")}>
                {pick(lang, r.label)}
              </div>
              {block.columns.map((_, ci) => {
                const cell = r.cells[ci];
                const rag = cell?.rag ?? "none";
                return (
                  <div
                    key={ci}
                    role="cell"
                    className={cn(
                      "flex items-center justify-center gap-1 border-t border-sand-200 px-2 py-2 text-center tnum",
                      ri % 2 === 1 && rag === "none" && "bg-sand-50",
                      RAG_CELL[rag],
                      rag !== "none" && "font-medium"
                    )}
                    title={rag !== "none" ? t(`report.rag.${rag}`) : undefined}
                  >
                    {cell?.trend ? <TrendGlyph trend={cell.trend} /> : null}
                    <span>{cell?.text ?? ""}</span>
                    {rag !== "none" ? <span className="sr-only">{t(`report.rag.${rag}`)}</span> : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-600" aria-hidden>
        {(["green", "amber", "red"] as Rag[]).map((rag) => (
          <li key={rag} className="flex items-center gap-1">
            <span className={cn("inline-block size-2.5 rounded-sm", rag === "green" ? "bg-ok" : rag === "amber" ? "bg-warn" : "bg-danger")} />
            {t(`report.rag.${rag}`)}
          </li>
        ))}
      </ul>
      <SourceLine source={block.source} lang={lang} />
    </figure>
  );
}

/* The rendering language travels through context so the deep helpers stay
   free of prop drilling. */
const LangContext = React.createContext<Lang>("en");
function useLangFromContext(): Lang {
  return React.useContext(LangContext);
}

function Kpis({ items }: { items: Extract<Block, { kind: "kpis" }>["items"] }) {
  const lang = useLangFromContext();
  return (
    <div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="kpi-grid">
      {items.map((k, i) => (
        <div key={i} className="rounded-xl border border-sand-300 bg-white p-3.5">
          <p className={cn("font-display text-[26px] leading-none tnum", TONE_TEXT[k.tone ?? "ink"])} style={{ unicodeBidi: "plaintext" }}>
            {k.value}
            {k.unit ? <span className="ms-1 text-sm font-normal text-ink-600">{k.unit}</span> : null}
          </p>
          <p className="mt-2 text-xs font-medium text-ink-600">{pick(lang, k.label)}</p>
          {k.delta ? (
            <p className="mt-0.5 text-[11px] text-ink-400 tnum" style={{ unicodeBidi: "plaintext" }}>
              {k.delta}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Sources({ items }: { items: SourceItem[] }) {
  return (
    <ol className="my-3 space-y-1.5 text-sm" data-testid="report-sources">
      {items.map((s) => (
        <li key={s.n} className="flex gap-2.5">
          <span className="w-6 shrink-0 text-end font-semibold text-maroon-700 tnum">{s.n}</span>
          <span className="min-w-0">
            <span className="text-ink-900">{s.title}</span>
            {s.detail ? <span className="text-ink-600">, {s.detail}</span> : null}
            {s.url ? (
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="ms-1.5 inline-flex items-center gap-0.5 text-xs text-gulf-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-gold-500"
              >
                <ExternalLink className="size-3" aria-hidden />
                <span className="sr-only">{s.url}</span>
                <span aria-hidden>{hostOf(s.url)}</span>
              </a>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Figure({ block, lang }: { block: Extract<Block, { kind: "figure" }>; lang: Lang }) {
  const src = block.pngBase64
    ? `data:image/png;base64,${block.pngBase64}`
    : block.svg
      ? `data:image/svg+xml;utf8,${encodeURIComponent(block.svg)}`
      : null;
  return (
    <figure className="my-4">
      {src ? (
        // an inline data image; next/image cannot optimise a data URI
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={pick(lang, block.caption)}
          width={block.widthPx}
          height={block.heightPx}
          className="mx-auto h-auto max-w-full rounded-lg border border-sand-200 bg-white"
        />
      ) : null}
      <figcaption className="mt-2 text-xs text-ink-600">{pick(lang, block.caption)}</figcaption>
      <SourceLine source={block.source} lang={lang} />
    </figure>
  );
}

export function BlockRenderer({ blocks, lang }: { blocks: Block[]; lang: Lang }) {
  const t = useTranslations("reports");
  return (
    <LangContext.Provider value={lang}>
      <div className="report-blocks">
        {blocks.map((b, i) => {
          switch (b.kind) {
            case "heading":
              return b.level === 2 ? (
                <h3 key={i} className="mt-6 mb-2 font-display text-lg text-ink-900 first:mt-0">
                  {pick(lang, b.text)}
                </h3>
              ) : (
                <h4 key={i} className="mt-4 mb-1 text-sm font-semibold text-maroon-900">
                  {pick(lang, b.text)}
                </h4>
              );
            case "paragraph":
              return (
                <p
                  key={i}
                  className={cn(
                    "my-2.5",
                    b.style === "lead"
                      ? "font-display text-lg leading-relaxed text-ink-900"
                      : b.style === "note"
                        ? "text-sm text-ink-600"
                        : "text-[15px] leading-7 text-ink-900"
                  )}
                >
                  {pick(lang, b.text)}
                </p>
              );
            case "bullets":
              return (
                <ul key={i} className="my-2.5 list-disc space-y-1 ps-5 text-[15px] leading-7 text-ink-900 marker:text-maroon-500">
                  {b.items.map((it, j) => (
                    <li key={j}>{pick(lang, it)}</li>
                  ))}
                </ul>
              );
            case "numbered":
              return (
                <ol key={i} className="my-2.5 list-decimal space-y-1 ps-5 text-[15px] leading-7 text-ink-900 marker:font-semibold marker:text-maroon-700">
                  {b.items.map((it, j) => (
                    <li key={j}>{pick(lang, it)}</li>
                  ))}
                </ol>
              );
            case "kpis":
              return <Kpis key={i} items={b.items} />;
            case "table":
              return <GridTable key={i} columns={b.columns} rows={b.rows} align={b.align} caption={b.caption} source={b.source} lang={lang} />;
            case "scorecard":
              return <Scorecard key={i} block={b} lang={lang} />;
            case "chart":
              return (
                <figure key={i} className="my-4 rounded-xl border border-sand-300 bg-white p-4">
                  <figcaption className="mb-2 text-sm font-medium text-ink-900">
                    {pick(lang, b.chart.title)}
                    {b.chart.unit ? <span className="ms-2 text-xs font-normal text-ink-400">{t("report.chartUnit", { unit: b.chart.unit })}</span> : null}
                  </figcaption>
                  <ReportChart chart={b.chart} lang={lang} />
                  {b.chart.note ? <p className="mt-2 text-xs text-ink-600">{t("report.note", { note: pick(lang, b.chart.note) })}</p> : null}
                  <SourceLine source={b.chart.source} lang={lang} />
                </figure>
              );
            case "quote":
              return (
                <blockquote key={i} className="my-4 rounded-xl border-s-4 border-gold-500 bg-sand-50 px-5 py-4">
                  <p className="font-display text-lg leading-relaxed text-ink-900">{pick(lang, b.text)}</p>
                  {b.attribution ? <footer className="mt-2 text-xs text-ink-600">{pick(lang, b.attribution)}</footer> : null}
                </blockquote>
              );
            case "callout":
              return (
                <aside key={i} className={cn("my-4 rounded-xl px-4 py-3.5", TONE_WASH[b.tone ?? "maroon"])} data-testid="report-callout">
                  {b.title ? <p className="text-sm font-semibold">{pick(lang, b.title)}</p> : null}
                  <p className="mt-0.5 text-[15px] leading-7">{pick(lang, b.text)}</p>
                </aside>
              );
            case "keyFigure":
              return (
                <div key={i} className="my-4 inline-flex flex-col rounded-xl border border-sand-300 bg-white px-5 py-4">
                  <span className="font-display text-4xl leading-none text-maroon-900 tnum" style={{ unicodeBidi: "plaintext" }}>
                    {b.value}
                  </span>
                  <span className="mt-1.5 text-xs font-medium text-ink-600">{pick(lang, b.label)}</span>
                </div>
              );
            case "figure":
              return <Figure key={i} block={b} lang={lang} />;
            case "sources":
              return <Sources key={i} items={b.items} />;
            case "pageBreak":
              return <hr key={i} className="my-6 border-0 border-t border-dashed border-sand-300" aria-hidden />;
            default:
              return null;
          }
        })}
      </div>
    </LangContext.Provider>
  );
}
