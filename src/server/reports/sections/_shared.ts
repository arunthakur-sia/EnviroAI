// CR08 5.3: helpers every section shares. Period arithmetic, number and
// status wording in both languages, the AI prose call with its grounding
// guard and the deterministic fallback, and the SectionContent assembly.
// Nothing here touches the database; scope resolution lives in _scope.ts.
import { callJson } from "@/server/ai/client";
import {
  bi,
  type BiText,
  type Block,
  type Rag,
  type ReportPeriod,
  type SectionContent,
  type SectionContext,
  type SectionLayout,
  type SourceItem,
  type Trend,
} from "../spec";

/* ------------------------------------------------------------------ */
/* per-build memo (one request object per build, so a WeakMap on it)   */
/* ------------------------------------------------------------------ */

const memos = new WeakMap<object, Map<string, Promise<unknown>>>();

/** Runs `fn` once per build for `key`; sections share expensive loads. */
export function memo<T>(ctx: SectionContext, key: string, fn: () => Promise<T>): Promise<T> {
  let m = memos.get(ctx.request);
  if (!m) {
    m = new Map();
    memos.set(ctx.request, m);
  }
  if (!m.has(key)) m.set(key, fn());
  return m.get(key) as Promise<T>;
}

/* ------------------------------------------------------------------ */
/* period                                                               */
/* ------------------------------------------------------------------ */

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
const QUARTER_AR = ["الربع الأول", "الربع الثاني", "الربع الثالث", "الربع الرابع"];

function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
const pad = (n: number) => String(n).padStart(2, "0");

/** Inclusive ISO date bounds of the period. */
export function periodBounds(p: ReportPeriod): { from: string; to: string } {
  if (p.kind === "range" && p.from && p.to) return { from: p.from.slice(0, 10), to: p.to.slice(0, 10) };
  if (p.kind === "quarter" && p.quarter) {
    const m0 = (p.quarter - 1) * 3 + 1;
    return {
      from: `${p.year}-${pad(m0)}-01`,
      to: `${p.year}-${pad(m0 + 2)}-${pad(lastDay(p.year, m0 + 2))}`,
    };
  }
  if (p.kind === "month" && p.month) {
    return {
      from: `${p.year}-${pad(p.month)}-01`,
      to: `${p.year}-${pad(p.month)}-${pad(lastDay(p.year, p.month))}`,
    };
  }
  return { from: `${p.year}-01-01`, to: `${p.year}-12-31` };
}

/** The bilingual label the builder stores; recomputed here so the label
    never drifts from the bounds. */
export function periodLabel(p: ReportPeriod): BiText {
  if (p.kind === "quarter" && p.quarter) {
    return bi(`Q${p.quarter} ${p.year}`, `${QUARTER_AR[p.quarter - 1]} ${p.year}`);
  }
  if (p.kind === "month" && p.month) {
    return bi(`${MONTHS_EN[p.month - 1]} ${p.year}`, `${MONTHS_AR[p.month - 1]} ${p.year}`);
  }
  if (p.kind === "range" && p.from && p.to) {
    return bi(`${p.from.slice(0, 10)} to ${p.to.slice(0, 10)}`, `من ${p.from.slice(0, 10)} إلى ${p.to.slice(0, 10)}`);
  }
  return bi(String(p.year), String(p.year));
}

/** The huge numeral on the cover. */
export function yearMarkOf(p: ReportPeriod): string {
  if (p.kind === "quarter" && p.quarter) return `Q${p.quarter} ${p.year}`;
  if (p.kind === "month" && p.month) return `${MONTHS_EN[p.month - 1].slice(0, 3)} ${p.year}`;
  return String(p.year);
}

/** Whether an ISO date or datetime falls inside the period (null passes). */
export function inPeriod(date: string | null | undefined, p: ReportPeriod): boolean {
  if (!date) return true;
  const { from, to } = periodBounds(p);
  const d = date.slice(0, 10);
  return d >= from && d <= to;
}

/** Strict variant: a missing date fails. */
export function dated(date: string | null | undefined, p: ReportPeriod): boolean {
  return Boolean(date) && inPeriod(date, p);
}

/** The period key the KPI, indicator and council series use. */
export function periodKey(p: ReportPeriod): string {
  if (p.kind === "quarter" && p.quarter) return `${p.year}-Q${p.quarter}`;
  if (p.kind === "month" && p.month) return `${p.year}-${pad(p.month)}`;
  return String(p.year);
}

export function cadenceOf(p: ReportPeriod): "monthly" | "quarterly" | "yearly" {
  if (p.kind === "quarter") return "quarterly";
  if (p.kind === "month") return "monthly";
  return "yearly";
}

/** Days from the period start to today, for the "last N days" list filters. */
export function daysSincePeriodStart(p: ReportPeriod): number {
  const { from } = periodBounds(p);
  const ms = Date.now() - new Date(`${from}T00:00:00Z`).getTime();
  return Math.max(30, Math.ceil(ms / 86400000));
}

/** "The year" / "the quarter" / "the month" / "the period" wording. */
export function periodWord(p: ReportPeriod): BiText {
  if (p.kind === "quarter") return bi("the quarter", "الربع");
  if (p.kind === "month") return bi("the month", "الشهر");
  if (p.kind === "range") return bi("the period", "الفترة");
  return bi("the year", "العام");
}

/* ------------------------------------------------------------------ */
/* numbers and wording                                                  */
/* ------------------------------------------------------------------ */

export function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null || Number.isNaN(n)) return "n/a";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Picks sensible decimals for a value the caller does not know. */
export function fmtAuto(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "n/a";
  const abs = Math.abs(n);
  const decimals = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return fmt(n, Number.isInteger(n) ? 0 : decimals);
}

export function pct(share: number | null | undefined, decimals = 0): string {
  if (share == null || Number.isNaN(share)) return "n/a";
  return `${fmt(share * 100, decimals)}%`;
}

export function signed(n: number | null | undefined, decimals = 1): string {
  if (n == null || Number.isNaN(n)) return "n/a";
  const s = fmt(Math.abs(n), decimals);
  return n > 0 ? `+${s}` : n < 0 ? `-${s}` : s;
}

const STATUS_WORDS: Record<string, BiText> = {
  on_track: bi("on track", "على المسار"),
  at_risk: bi("at risk", "معرض للخطر"),
  delayed: bi("delayed", "متأخر"),
  behind: bi("behind", "متأخر"),
  completed: bi("completed", "مكتمل"),
  complete: bi("complete", "مكتمل"),
  not_started: bi("not started", "لم يبدأ"),
  in_progress: bi("in progress", "قيد التنفيذ"),
  active: bi("active", "نشط"),
  planned: bi("planned", "مخطط"),
  cancelled: bi("cancelled", "ملغى"),
  paused: bi("paused", "متوقف مؤقتاً"),
  on_target: bi("on target", "ضمن المستهدف"),
  no_data: bi("no data", "لا بيانات"),
  pending: bi("pending", "قيد الانتظار"),
  accepted: bi("accepted", "مقبول"),
  rejected: bi("rejected", "مرفوض"),
  under_review: bi("under review", "قيد المراجعة"),
  verified: bi("verified", "موثق"),
  published: bi("published", "منشور"),
  draft: bi("draft", "مسودة"),
  high: bi("high", "مرتفع"),
  medium: bi("medium", "متوسط"),
  low: bi("low", "منخفض"),
  critical: bi("critical", "حرج"),
  short: bi("short term", "قصير الأجل"),
  mid: bi("medium term", "متوسط الأجل"),
  long: bi("long term", "طويل الأجل"),
  up: bi("improving", "في تحسن"),
  down: bi("declining", "في تراجع"),
  stable: bi("stable", "مستقر"),
  flat: bi("stable", "مستقر"),
};

export function statusText(status: string | null | undefined): BiText {
  if (!status) return bi("n/a", "غير متاح");
  return STATUS_WORDS[status] ?? bi(status.replace(/_/g, " "), status.replace(/_/g, " "));
}

const NODE_TYPE_WORDS: Record<string, BiText> = {
  outcome: bi("outcome", "النتيجة"),
  target: bi("target", "المستهدف"),
  initiative: bi("initiative", "المبادرة"),
  project: bi("project", "المشروع"),
  sector_strategy: bi("sector strategy", "الاستراتيجية القطاعية"),
  enabler: bi("enabler", "الممكّن"),
  cluster: bi("cluster", "المجموعة"),
};
export function nodeTypeText(t: string | null | undefined): BiText {
  return (t ? NODE_TYPE_WORDS[t] : undefined) ?? bi(t ?? "item", t ?? "عنصر");
}

/** "3 items" style counts, both languages, with Arabic dual and plural. */
export function countText(n: number, one: BiText, many: BiText, two?: BiText): BiText {
  if (n === 1) return bi(`1 ${one.en}`, `${one.ar} واحد`);
  if (n === 2 && two) return bi(`2 ${many.en}`, two.ar);
  if (n >= 3 && n <= 10) return bi(`${n} ${many.en}`, `${n} ${many.ar}`);
  return bi(`${fmt(n)} ${many.en}`, `${fmt(n)} ${one.ar}`);
}

/** Maps the council RAG vocabulary onto the docx scorecard colours. */
export function ragOfCouncil(r: string | null | undefined): Rag {
  if (r === "on_target") return "green";
  if (r === "at_risk") return "amber";
  if (r === "behind") return "red";
  return "none";
}

/** RAG for a node status. */
export function ragOfStatus(status: string | null | undefined): Rag {
  if (status === "on_track" || status === "completed" || status === "complete") return "green";
  if (status === "at_risk" || status === "paused") return "amber";
  if (status === "delayed" || status === "behind" || status === "cancelled") return "red";
  return "none";
}

/** Direction-aware trend of the latest value against the previous one. */
export function trendOf(
  previous: number | null | undefined,
  latest: number | null | undefined,
  direction = "up_good"
): Trend | undefined {
  if (previous == null || latest == null) return undefined;
  const tolerance = Math.abs(previous) * 0.005;
  if (Math.abs(latest - previous) <= tolerance) return "flat";
  const better = direction === "down_good" ? latest < previous : latest > previous;
  return better ? "up" : "down";
}

/* ------------------------------------------------------------------ */
/* the indices board                                                    */
/* ------------------------------------------------------------------ */

type BoardLike = { sdgGoal: number | null; statistics: unknown; change: number | null; gccPosition: number | null };

/** CR08 4.1 put the SDG goal records and the national indicators on the
    same board; a report's "international indices" are the ones an external
    publisher ranks, so the goal records and the national series are left
    to the Statistics section. */
export function internationalCards<T extends BoardLike>(cards: T[]): T[] {
  return cards.filter((c) => c.sdgGoal == null && !c.statistics);
}

/** The board's summary counts, recomputed for a subset of cards. */
export function summaryOf<T extends BoardLike>(cards: T[]): { improving: number; stable: number; declining: number; gccLead: number } {
  return {
    improving: cards.filter((c) => (c.change ?? 0) > 0).length,
    declining: cards.filter((c) => (c.change ?? 0) < 0).length,
    stable: cards.filter((c) => !c.change).length,
    gccLead: cards.filter((c) => c.gccPosition === 1).length,
  };
}

/* ------------------------------------------------------------------ */
/* AI prose with a grounding guard, deterministic fallback otherwise    */
/* ------------------------------------------------------------------ */

export type Prose = {
  lead?: BiText;
  paragraphs: BiText[];
  bullets?: BiText[];
  callout?: { title?: BiText; text: BiText };
};

export type SectionBrief = {
  /** what the section is for, one or two sentences */
  purpose: string;
  /** the structure the writer should follow */
  structure: string;
  /** voice notes, e.g. "first person plural, the Secretary General's voice" */
  tone?: string;
  paragraphs?: number;
  bullets?: number;
  callout?: boolean;
  lead?: boolean;
};

type RawBi = { en?: unknown; ar?: unknown };
type RawProse = {
  lead?: RawBi;
  paragraphs?: RawBi[];
  bullets?: RawBi[];
  callout?: { title?: RawBi; text?: RawBi };
};

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
function westernDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

/* U+2013 and U+2014, built from char codes so this file never carries them. */
const DASH_RUN = new RegExp(`\\s*[${String.fromCharCode(0x2013, 0x2014)}]\\s*`, "g");

/** The repository rule: no em or en dashes in anything we author. */
export function noDashes(s: string): string {
  return s.replace(DASH_RUN, ", ").replace(/\s+,/g, ",");
}

function cleanBi(raw: RawBi | undefined): BiText | null {
  if (!raw || typeof raw.en !== "string" || typeof raw.ar !== "string") return null;
  const en = noDashes(raw.en.trim());
  const ar = noDashes(raw.ar.trim());
  if (!en || !ar) return null;
  return { en, ar };
}

/** Every number of two or more digits in the prose (years excepted) must
    appear in the facts the writer was given. */
function grounded(text: BiText, factsDigits: Set<string>): boolean {
  const numbers = (westernDigits(text.en) + " " + westernDigits(text.ar)).match(/\d[\d,]*\.?\d*/g) ?? [];
  for (const raw of numbers) {
    const n = raw.replace(/,/g, "").replace(/\.$/, "");
    if (n.length < 2) continue;
    if (/^(19|20)\d\d$/.test(n)) continue;
    if (!factsDigits.has(n)) return false;
  }
  return true;
}

function digitsOf(facts: unknown): Set<string> {
  const text = westernDigits(JSON.stringify(facts));
  const set = new Set<string>();
  for (const raw of text.match(/\d[\d,]*\.?\d*/g) ?? []) {
    const n = raw.replace(/,/g, "").replace(/\.$/, "");
    set.add(n);
    // "72.4" is also cited as "72"; "1204" as "1,204" (commas already gone)
    if (n.includes(".")) set.add(n.split(".")[0]);
    const asNumber = Number(n);
    if (!Number.isNaN(asNumber)) {
      set.add(String(Math.round(asNumber)));
      set.add(asNumber.toFixed(1));
      set.add(asNumber.toFixed(2));
    }
  }
  return set;
}

/**
 * Writes the prose of one section. When the AI is live the model is asked
 * through the shared section prompt with the brief and the compact facts;
 * the answer is accepted only when every paragraph is bilingual, dash-free
 * and cites figures that exist in the facts. Otherwise, or in Mock Mode,
 * the section's deterministic mock is used.
 */
export async function writeProse(
  ctx: SectionContext,
  code: string,
  brief: SectionBrief,
  facts: unknown,
  mock: () => Prose
): Promise<{ prose: Prose; live: boolean }> {
  const fallback = () => ({ prose: mock(), live: false });
  if (!ctx.aiLive) return fallback();
  const request = {
    section: code,
    brief,
    languageMode: ctx.request.languageMode,
    audience: ctx.request.audience,
    reportType: ctx.request.typeCode,
    period: ctx.request.period.label,
    scope: { kind: ctx.request.scope.kind, label: ctx.request.scope.label },
    facts,
  };
  const content = JSON.stringify(request).slice(0, 60000);
  ctx.progress?.(`writing ${code}`);
  const raw = await callJson<RawProse>("system_report_section", content, { maxTokens: 5000 });
  if (!raw) return fallback();
  const factsDigits = digitsOf({ facts, period: ctx.request.period, scope: ctx.request.scope });
  const paragraphs = (raw.paragraphs ?? [])
    .map(cleanBi)
    .filter((p): p is BiText => Boolean(p))
    .filter((p) => grounded(p, factsDigits));
  if (!paragraphs.length) return fallback();
  const bullets = (raw.bullets ?? [])
    .map(cleanBi)
    .filter((p): p is BiText => Boolean(p))
    .filter((p) => grounded(p, factsDigits));
  const lead = cleanBi(raw.lead);
  const calloutText = cleanBi(raw.callout?.text);
  const calloutTitle = cleanBi(raw.callout?.title);
  const prose: Prose = {
    lead: lead && grounded(lead, factsDigits) ? lead : undefined,
    paragraphs,
    bullets: bullets.length ? bullets : undefined,
    callout:
      calloutText && grounded(calloutText, factsDigits)
        ? { title: calloutTitle ?? undefined, text: calloutText }
        : undefined,
  };
  // a mock lead keeps the opener designed when the model skipped it
  if (brief.lead && !prose.lead) prose.lead = mock().lead;
  return { prose, live: true };
}

/** The prose as blocks: paragraphs, then bullets, then the callout. */
export function proseBlocks(prose: Prose): Block[] {
  const blocks: Block[] = prose.paragraphs.map((text) => ({ kind: "paragraph", text }));
  if (prose.bullets?.length) blocks.push({ kind: "bullets", items: prose.bullets });
  if (prose.callout) {
    blocks.push({ kind: "callout", title: prose.callout.title, text: prose.callout.text, tone: "navy" });
  }
  return blocks;
}

/** A short honest note when a scope has nothing to report. */
export function noteBlock(en: string, ar: string): Block {
  return { kind: "paragraph", text: bi(en, ar), style: "note" };
}

/* ------------------------------------------------------------------ */
/* sources and assembly                                                 */
/* ------------------------------------------------------------------ */

export type SourceInput = { title: string; detail?: string; url?: string };

/** Numbers the sources from 1 and drops duplicates (same title and detail). */
export function makeSources(items: SourceInput[]): SourceItem[] {
  const seen = new Set<string>();
  const out: SourceItem[] = [];
  for (const s of items) {
    const key = `${s.title}|${s.detail ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ n: out.length + 1, title: s.title, detail: s.detail, url: s.url });
  }
  return out;
}

/** The EnviroAI module citation lines, kept identical across sections. */
export const SRC = {
  strategy: (edition: string): SourceInput => ({
    title: "EnviroAI Living Strategy",
    detail: `edition ${edition}, nodes, KPIs and status updates`,
  }),
  council: (illustrative: boolean): SourceInput => ({
    title: illustrative ? "EnviroAI Programme Strategy, illustrative data" : "EnviroAI Programme Strategy",
    detail: "Internal",
  }),
  statistics: (): SourceInput => ({
    title: "General Authority for Statistics (GASTAT), official series",
    detail: "as held in the EnviroAI Statistics Hub",
  }),
  indices: (publisher: string, name: string, year?: number | null): SourceInput => ({
    title: `${publisher}: ${name}`,
    detail: year ? `${year} edition` : undefined,
  }),
  forecasts: (): SourceInput => ({
    title: "EnviroAI index forecasts",
    detail: "method v1, Monte Carlo over the index's own history; an estimate, not a published value",
  }),
  signals: (): SourceInput => ({ title: "EnviroAI Signals Radar", detail: "accepted signals" }),
  lessons: (): SourceInput => ({ title: "EnviroAI Learning Room", detail: "published and verified lessons" }),
  hr: (): SourceInput => ({ title: "EnviroAI HR Knowledge Dashboard", detail: "ownership inventory and continuity risks" }),
  organisation: (): SourceInput => ({ title: "Programme Office organisational structure", detail: "enviroai.demo, as recorded in EnviroAI" }),
  vault: (): SourceInput => ({ title: "EnviroAI Institutional Memory", detail: "documents and deliverables" }),
  podcast: (): SourceInput => ({ title: "EnviroAI Briefing Cast", detail: "published episodes" }),
};

export function section(
  code: string,
  title: BiText,
  layout: SectionLayout,
  opts: {
    lead?: BiText;
    blocks: Block[];
    sources?: SourceItem[];
    keyFigure?: { value: string; label: BiText };
    needsEditing?: boolean;
    meta?: Record<string, unknown>;
  }
): SectionContent {
  return {
    code,
    title,
    lead: opts.lead,
    keyFigure: opts.keyFigure,
    layout,
    blocks: opts.blocks,
    sources: opts.sources ?? [],
    needsEditing: opts.needsEditing,
    meta: opts.meta,
  };
}

/** Bilingual label helpers for tables. */
export const T = {
  code: bi("Code", "الرمز"),
  title: bi("Title", "العنوان"),
  name: bi("Name", "الاسم"),
  status: bi("Status", "الحالة"),
  latest: bi("Latest", "الأحدث"),
  target: bi("Target", "المستهدف"),
  unit: bi("Unit", "الوحدة"),
  period: bi("Period", "الفترة"),
  value: bi("Value", "القيمة"),
  change: bi("Change", "التغير"),
  rank: bi("Rank", "المرتبة"),
  score: bi("Score", "الدرجة"),
  year: bi("Year", "السنة"),
  lead: bi("Lead", "الجهة المسؤولة"),
  owner: bi("Owner", "المالك"),
  date: bi("Date", "التاريخ"),
  count: bi("Count", "العدد"),
  category: bi("Category", "الفئة"),
  type: bi("Type", "النوع"),
  impact: bi("Impact", "الأثر"),
  horizon: bi("Horizon", "الأفق"),
  publisher: bi("Publisher", "الناشر"),
  department: bi("Department", "الإدارة"),
  outcome: bi("Outcome", "النتيجة"),
  direction: bi("Direction", "الاتجاه"),
  progress: bi("Progress", "التقدم"),
  reported: bi("Reported", "المبلّغ عنها"),
  onTarget: bi("On target", "ضمن المستهدف"),
  atRisk: bi("At risk", "معرض للخطر"),
  behind: bi("Behind", "متأخر"),
  share: bi("Share on target", "نسبة ما هو ضمن المستهدف"),
  role: bi("Role", "الدور"),
  organisation: bi("Organisation", "الجهة"),
  milestone: bi("Milestone", "المعلم"),
  delivered: bi("Delivered", "تاريخ التسليم"),
  acceptance: bi("Acceptance", "القبول"),
  gcc: bi("GCC position", "الترتيب الخليجي"),
  low: bi("Low", "الحد الأدنى"),
  high: bi("High", "الحد الأعلى"),
  confidence: bi("Confidence", "الثقة"),
  readiness: bi("Readiness", "الجاهزية"),
  continuity: bi("Continuity", "الاستمرارية"),
  headcount: bi("Headcount", "عدد الموظفين"),
  risks: bi("Open risks", "المخاطر المفتوحة"),
  documents: bi("Documents", "الوثائق"),
  lessons: bi("Lessons", "الدروس"),
  deliverables: bi("Deliverables", "المخرجات"),
  duration: bi("Duration", "المدة"),
  focus: bi("Focus", "المحور"),
  theme: bi("Theme", "المحور"),
  initiatives: bi("Initiatives", "المبادرات"),
  projects: bi("Projects", "المشاريع"),
  targets: bi("Targets", "المستهدفات"),
};

export { bi };
export type { BiText, Block };
