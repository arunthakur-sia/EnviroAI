// CR08 5: the contract between the three halves of the Reports module.
//
//   sections/*.ts   load data and write SectionContent (AI or mock)
//   template/*.ts   render a ReportDocumentModel to a designed docx
//   build.ts        the report_build job that runs the two in order
//
// Everything in a SectionContent is BILINGUAL (BiText) so one model renders
// an English document, an Arabic document, or both, without re-generation.
// Nothing here touches the database.
import type { CurrentUser } from "@/server/auth/session";

export type Lang = "en" | "ar";
export type LanguageMode = "en" | "ar" | "both";
export type ReportFamily = "public" | "internal" | "custom";
export type ScopeKind = "npc" | "outcome" | "department" | "project" | "period";
export type Audience = "leadership" | "working" | "public";

export type BiText = { en: string; ar: string };
export const bi = (en: string, ar: string): BiText => ({ en, ar });

/** The reporting period, as the builder collects it. */
export type ReportPeriod = {
  kind: "year" | "quarter" | "month" | "range";
  year: number;
  quarter?: number; // 1..4
  month?: number; // 1..12
  from?: string; // ISO date, range only
  to?: string;
  label: BiText;
};

/** What the report is about. `id` is the outcome, unit or project row id. */
export type ReportScope = {
  kind: ScopeKind;
  id?: string | null;
  code?: string | null;
  label: BiText;
};

/** One report request, stored on `reports` (period_json, scope_json, sections_json). */
export type ReportRequest = {
  reportId: string;
  typeCode: string;
  family: ReportFamily;
  period: ReportPeriod;
  scope: ReportScope;
  audience: Audience;
  languageMode: LanguageMode;
  sectionCodes: string[];
  classification: number; // 1 public .. 4 secret
  requestedBy: string;
};

/* ------------------------------------------------------------------ */
/* Blocks: what a section is made of                                   */
/* ------------------------------------------------------------------ */

export type Tone = "maroon" | "gulf" | "gold" | "ink";
export type Rag = "green" | "amber" | "red" | "none";
export type Trend = "up" | "down" | "flat";

export type KpiTile = {
  label: BiText;
  value: string; // already formatted, e.g. "72.4" or "1,204"
  unit?: string;
  delta?: string; // "+2.1 pts vs 2024"
  tone?: Tone;
};

export type ChartSeries = {
  name: BiText;
  points: { x: string; y: number | null }[];
  /** primary maroon, comparison gulf, target gold, forecast dashed maroon */
  role?: "primary" | "comparison" | "target" | "forecast";
};

export type ChartSpec = {
  type: "line" | "bar" | "area" | "stacked";
  title: BiText;
  unit?: string;
  series: ChartSeries[];
  note?: BiText;
  source?: BiText;
  /** optional y-axis bounds */
  yMin?: number;
  yMax?: number;
};

export type SourceItem = {
  n: number;
  title: string;
  detail?: string; // publisher, page, period
  url?: string;
};

export type Block =
  | { kind: "heading"; level: 2 | 3; text: BiText }
  | { kind: "paragraph"; text: BiText; style?: "body" | "lead" | "note" }
  | { kind: "bullets"; items: BiText[] }
  | { kind: "numbered"; items: BiText[] }
  | { kind: "kpis"; items: KpiTile[] }
  | {
      kind: "table";
      caption?: BiText;
      columns: BiText[];
      rows: BiText[][];
      /** column alignments, default start; numbers are usually "end" */
      align?: ("start" | "end" | "center")[];
      source?: BiText;
    }
  | {
      kind: "scorecard";
      caption?: BiText;
      columns: BiText[];
      rows: { label: BiText; cells: { text: string; rag?: Rag; trend?: Trend }[] }[];
      source?: BiText;
    }
  | { kind: "chart"; chart: ChartSpec }
  | { kind: "quote"; text: BiText; attribution?: BiText }
  | { kind: "callout"; title?: BiText; text: BiText; tone?: Tone }
  | { kind: "keyFigure"; value: string; label: BiText }
  | {
      kind: "figure";
      caption: BiText;
      source?: BiText;
      /** an SVG string the template rasterises, or a ready PNG */
      svg?: string;
      pngBase64?: string;
      widthPx?: number;
      heightPx?: number;
    }
  | { kind: "sources"; items: SourceItem[] }
  | { kind: "pageBreak" };

/** Which page design the template uses for the section. */
export type SectionLayout =
  | "cover"
  | "contents"
  | "opener" // large numeral, title, serif lead, maroon rule, optional key figure, then body
  | "glance" // KPI tiles four per row + narrative
  | "body" // two-column running text with run-in headings
  | "chart" // one full-width chart page per chart block
  | "scorecard" // RAG table page
  | "sources" // appendix
  | "closing";

export type SectionContent = {
  code: string;
  title: BiText;
  /** the serif lead under the title on an opener */
  lead?: BiText;
  /** "01", "02"... assigned by the builder in order */
  numeral?: string;
  keyFigure?: { value: string; label: BiText };
  layout: SectionLayout;
  blocks: Block[];
  sources?: SourceItem[];
  /** true when the writer drafted text a human must edit (the Foreword) */
  needsEditing?: boolean;
  /** free data the review UI may show (counts, periods used) */
  meta?: Record<string, unknown>;
};

/* ------------------------------------------------------------------ */
/* Section definitions (the library)                                   */
/* ------------------------------------------------------------------ */

export type SectionContext = {
  request: ReportRequest;
  /** the requesting user; every loader filters by their clearance */
  user: CurrentUser;
  /** true when the AI is live (key present and mock mode off) */
  aiLive: boolean;
  /** report progress, e.g. "loading statistics" */
  progress?: (note: string) => void;
};

export type SectionDefinition<TData = unknown> = {
  code: string;
  name: BiText;
  description: BiText;
  layout: SectionLayout;
  /** rough page count for the builder's structure preview */
  estimatedPages: number;
  /** which scopes the section makes sense for; "all" when any */
  appliesTo: ScopeKind[] | "all";
  /** gathers the facts, never calls the model */
  load: (ctx: SectionContext) => Promise<TData>;
  /** turns the facts into bilingual content: AI when live, deterministic mock otherwise */
  write: (ctx: SectionContext, data: TData) => Promise<SectionContent>;
};

/* ------------------------------------------------------------------ */
/* The document model the template renders                            */
/* ------------------------------------------------------------------ */

export type ReportDocumentModel = {
  request: ReportRequest;
  typeName: BiText;
  title: BiText;
  subtitle?: BiText;
  periodLabel: BiText;
  /** the huge numeral on the cover, e.g. "2026" or "Q3 2026" */
  yearMark: string;
  classification: number;
  generatedAt: string; // ISO
  /** "Generated by SiaNexus" plus the preparer name */
  preparedBy?: BiText;
  sections: SectionContent[];
  /** optional extra key figure for the cover */
  coverFigure?: { value: string; label: BiText };
};

export type RenderOptions = {
  lang: Lang;
  /** absolute path to write; when omitted the buffer is returned only */
  outPath?: string;
};

/** The section codes of the library, in the canonical reading order. */
export const SECTION_ORDER = [
  "cover",
  "contents",
  "foreword",
  "year_at_a_glance",
  "mandate_governance",
  "nds3_outcomes_overview",
  "outcome_deep_dive",
  "targets_scorecard",
  "initiatives_progress",
  "deliverables_received",
  "council_scorecard",
  "outputs_behind",
  "statistics_highlights",
  "international_indices",
  "index_forecasts",
  "signals_implications",
  "lessons_themes",
  "knowledge_continuity",
  "project_closure",
  "events_partnerships",
  "outlook",
  "sources_appendix",
  "closing",
] as const;
export type SectionCode = (typeof SECTION_ORDER)[number];

/** Classification labels the cover chip and the running footer use. */
export const CLASSIFICATION_LABEL: Record<number, BiText> = {
  1: bi("Public", "عام"),
  2: bi("Internal", "داخلي"),
  3: bi("Confidential", "سري"),
  4: bi("Secret", "سري للغاية"),
};
