// AI Mock Mode: deterministic, well-formed results for every capability.
// Used when ANTHROPIC_API_KEY is missing, when Settings > AI > Mock mode is on,
// and by the seed for reproducible content. All screens work fully on these.
import type { RetrievedChunk } from "@/server/search/hybrid";
import { isArabicText } from "@/lib/utils";

/* ---------------- helpers ---------------- */

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!؟?۔])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && s.length < 400);
}

function cleanFilename(name: string): string {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/%20/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b(www|com|qa|http|https)\b/gi, "")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ---------------- enrichment ---------------- */

export type MockEnrichInput = {
  filename: string;
  text: string;
  pages: { page: number; text: string }[];
  lang: string;
  terms: { code: string; nameEn: string; nameAr: string; dimension: string }[];
  sourceOrigin?: string;
};

export type EnrichResult = {
  title_en: string;
  title_ar: string;
  summary_en: string;
  summary_ar: string;
  key_facts: { text_en: string; text_ar: string; page: number | null }[];
  knowledge_type_code: string;
  outcome_codes: string[];
  sector_codes: string[];
  topic_codes: string[];
  classification_level: number;
  classification_reason: string;
  language_original: string;
  publish_year: number | null;
  machine: boolean;
};

export function mockEnrich(input: MockEnrichInput): EnrichResult {
  const title = cleanFilename(input.filename) || "Untitled document";
  const sents = sentences(input.text);
  const summary = sents.slice(0, 4).join(" ").slice(0, 1100);

  // key facts: sentences containing numbers, with their page
  const facts: { text_en: string; text_ar: string; page: number | null }[] = [];
  for (const p of input.pages) {
    for (const s of sentences(p.text)) {
      if (/\d/.test(s) && facts.length < 5 && s.length < 260) {
        const isAr = isArabicText(s);
        facts.push({
          text_en: isAr ? "" : s,
          text_ar: isAr ? s : "",
          page: p.page,
        });
      }
    }
    if (facts.length >= 5) break;
  }

  // tags via keyword matching against taxonomy names
  const lower = (input.text.slice(0, 20000) + " " + input.filename).toLowerCase();
  const match = (dimension: string, max: number) =>
    input.terms
      .filter((t) => t.dimension === dimension)
      .filter(
        (t) =>
          lower.includes(t.nameEn.toLowerCase()) ||
          (t.nameAr && input.text.slice(0, 20000).includes(t.nameAr))
      )
      .slice(0, max)
      .map((t) => t.code);

  let knowledgeType = "report";
  if (/strategy|استراتيجية/i.test(lower)) knowledgeType = "strategy";
  else if (/polic|سياسة/i.test(lower)) knowledgeType = "policy";
  else if (/bulletin|release|نشرة|statistics|إحصاء/i.test(lower)) knowledgeType = "statistical_release";
  else if (/guide|دليل|guidebook/i.test(lower)) knowledgeType = "guideline";
  else if (/census|تعداد/i.test(lower)) knowledgeType = "study";
  else if (/\.csv|dataset/i.test(input.filename.toLowerCase())) knowledgeType = "dataset";
  const knownTypes = new Set(
    input.terms.filter((t) => t.dimension === "knowledge_type").map((t) => t.code)
  );
  if (!knownTypes.has(knowledgeType)) knowledgeType = knownTypes.values().next().value ?? "report";

  const yearMatch = /20(0[8-9]|1[0-9]|2[0-9])/.exec(input.filename + " " + input.text.slice(0, 3000));

  const isArDoc = input.lang === "ar";
  return {
    title_en: isArDoc ? "" : title,
    title_ar: isArDoc ? title : "",
    summary_en: isArDoc ? "" : summary,
    summary_ar: isArDoc ? summary : "",
    key_facts: facts,
    knowledge_type_code: knowledgeType,
    outcome_codes: match("outcome", 2),
    sector_codes: match("sector", 2),
    topic_codes: match("topic", 5),
    classification_level: input.sourceOrigin === "npc" ? 1 : 2,
    classification_reason:
      input.sourceOrigin === "npc"
        ? "Publicly released NPC material"
        : "Working material, internal by default",
    language_original: input.lang,
    publish_year: yearMatch ? Number(yearMatch[0]) : null,
    machine: true,
  };
}

/* ---------------- answers ---------------- */

export type MockAnswer = {
  markdown: string;
  citations: {
    n: number;
    chunk_id: string;
    resource_type: string;
    resource_id: string;
    title: string;
    page: number | null;
    excerpt: string;
    lang: string;
  }[];
  confidence: "high" | "medium" | "low";
};

export function mockAnswer(
  query: string,
  chunks: RetrievedChunk[],
  locale: string,
  topSimilarity: number
): MockAnswer {
  const ar = locale === "ar" || isArabicText(query);
  if (!chunks.length || topSimilarity < 0.3) {
    return {
      markdown: ar
        ? "لم أجد مصدراً موثوقاً من المجلس الوطني للتخطيط لهذه المسألة. هل ترغب في توجيه السؤال إلى خبير؟"
        : "I could not find a reliable NPC source for this. Route it to an expert?",
      citations: [],
      confidence: "low",
    };
  }
  const top = chunks.slice(0, 4);
  const citations = top.map((c, i) => ({
    n: i + 1,
    chunk_id: c.chunkId,
    resource_type: "document",
    resource_id: c.documentId,
    title: ar ? c.documentTitleAr || c.documentTitleEn : c.documentTitleEn || c.documentTitleAr,
    page: c.page,
    excerpt: c.text.slice(0, 300),
    lang: c.lang,
  }));
  const intro = ar
    ? `وفق مصادر المجلس الوطني للتخطيط، إليك أبرز ما ورد حول "${query}":`
    : `From NPC sources, here is what the knowledge base holds on "${query}":`;
  const bullets = top.map((c, i) => {
    const excerpt = sentences(c.text).slice(0, 2).join(" ").slice(0, 320) || c.text.slice(0, 320);
    return `- ${excerpt} [${i + 1}]`;
  });
  const outro = ar
    ? "هذه مقتطفات مباشرة من الوثائق المسترجعة. افتح المصادر أدناه للاطلاع على السياق الكامل."
    : "These are direct excerpts from the retrieved documents. Open the sources below for full context.";
  const verifiedCount = top.filter((c) => c.verified).length;
  const confidence: MockAnswer["confidence"] =
    topSimilarity >= 0.55 && verifiedCount >= 2
      ? "high"
      : topSimilarity >= 0.35
        ? "medium"
        : "low";
  return {
    markdown: [intro, "", ...bullets, "", outro].join("\n"),
    citations,
    confidence,
  };
}

/* ---------------- other capabilities ---------------- */

export function mockNarrate(
  ind: {
    nameEn: string;
    nameAr: string;
    unit: string | null;
    direction: string;
    decimals: number;
  },
  values: { period: string; value: number }[],
  target?: { value: number; year: number } | null
): { narration_en: string; narration_ar: string } {
  if (!values.length) {
    return {
      narration_en: `No values are recorded yet for ${ind.nameEn}.`,
      narration_ar: `لا توجد قيم مسجلة بعد لمؤشر ${ind.nameAr}.`,
    };
  }
  const sorted = [...values].sort((a, b) => a.period.localeCompare(b.period));
  const latest = sorted[sorted.length - 1];
  const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  const unit = ind.unit ?? "";
  const fmt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: ind.decimals });
  const fmtAr = (v: number) => v.toLocaleString("ar-QA-u-nu-latn", { maximumFractionDigits: ind.decimals });
  let trendEn = `${ind.nameEn} stands at ${fmt(latest.value)} ${unit} for ${latest.period}.`;
  let trendAr = `بلغ ${ind.nameAr} ${fmtAr(latest.value)} ${unit} في ${latest.period}.`;
  if (prev) {
    const delta = latest.value - prev.value;
    const pct = prev.value !== 0 ? (delta / Math.abs(prev.value)) * 100 : 0;
    const goodDir = ind.direction === "down_good" ? delta < 0 : delta > 0;
    const wordEn = delta === 0 ? "unchanged" : goodDir ? "an improvement" : "a setback";
    const wordAr = delta === 0 ? "دون تغيير" : goodDir ? "وهو تحسن" : "وهو تراجع";
    trendEn += ` That is ${delta >= 0 ? "up" : "down"} ${fmt(Math.abs(delta))} ${unit} (${pct.toFixed(1)} percent) from ${prev.period}, ${wordEn} for this indicator.`;
    trendAr += ` أي ${delta >= 0 ? "بزيادة" : "بانخفاض"} قدره ${fmtAr(Math.abs(delta))} ${unit} (${Math.abs(pct).toFixed(1)} بالمئة) مقارنة بـ ${prev.period}، ${wordAr} لهذا المؤشر.`;
  }
  if (target) {
    trendEn += ` The linked target is ${fmt(target.value)} ${unit} by ${target.year}.`;
    trendAr += ` والمستهدف المرتبط هو ${fmtAr(target.value)} ${unit} بحلول ${target.year}.`;
  }
  return { narration_en: trendEn, narration_ar: trendAr };
}

export function mockWhatChanged(
  updates: { nodeTitleEn: string; nodeTitleAr: string; status: string; progressPct: number; createdAt: string }[],
  kpiDeltas: { kpiNameEn: string; kpiNameAr: string; from: number | null; to: number; period: string }[]
): {
  summary_en: string;
  summary_ar: string;
  highlights: { text_en: string; text_ar: string; kind: string }[];
} {
  const highlights: { text_en: string; text_ar: string; kind: string }[] = [];
  for (const u of updates.slice(0, 2)) {
    const risky = u.status === "at_risk" || u.status === "delayed";
    highlights.push({
      kind: risky ? "risk" : "progress",
      text_en: `${u.nodeTitleEn}: reported ${u.status.replace("_", " ")} at ${u.progressPct} percent progress.`,
      text_ar: `${u.nodeTitleAr}: الحالة ${statusAr(u.status)} بنسبة إنجاز ${u.progressPct} بالمئة.`,
    });
  }
  for (const k of kpiDeltas.slice(0, 2)) {
    highlights.push({
      kind: "kpi",
      text_en: `${k.kpiNameEn} moved ${k.from !== null ? `from ${k.from} ` : ""}to ${k.to} in ${k.period}.`,
      text_ar: `تغير ${k.kpiNameAr} ${k.from !== null ? `من ${k.from} ` : ""}إلى ${k.to} في ${k.period}.`,
    });
  }
  highlights.sort((a, b) => (a.kind === "risk" ? -1 : 0) - (b.kind === "risk" ? -1 : 0));
  const summary_en = highlights.length
    ? `${updates.length} status update${updates.length === 1 ? "" : "s"} and ${kpiDeltas.length} KPI change${kpiDeltas.length === 1 ? "" : "s"} in the period. ${highlights[0]?.text_en ?? ""}`
    : "A quiet period: no status updates or KPI changes were recorded.";
  const summary_ar = highlights.length
    ? `${updates.length} تحديث حالة و${kpiDeltas.length} تغير في مؤشرات الأداء خلال الفترة. ${highlights[0]?.text_ar ?? ""}`
    : "فترة هادئة: لم تسجل تحديثات حالة أو تغيرات في مؤشرات الأداء.";
  return { summary_en, summary_ar, highlights: highlights.slice(0, 3) };
}

function statusAr(s: string): string {
  const map: Record<string, string> = {
    not_started: "لم يبدأ",
    on_track: "على المسار",
    at_risk: "معرض للخطر",
    delayed: "متأخر",
    completed: "مكتمل",
  };
  return map[s] ?? s;
}

export type BriefSubject = {
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  numbers: { label_en: string; label_ar: string; value: string }[];
};

export function mockBrief(subject: BriefSubject) {
  const para = (t: string) => sentences(t).slice(0, 4).join(" ") || t.slice(0, 500);
  return {
    title_en: `Brief: ${subject.titleEn}`,
    title_ar: `موجز: ${subject.titleAr}`,
    sections: [
      {
        heading_en: "What it is",
        heading_ar: "ما هو",
        body_en: para(subject.bodyEn),
        body_ar: para(subject.bodyAr) || "ملخص تنفيذي مستخرج من المادة المتاحة.",
      },
      {
        heading_en: "What the numbers say",
        heading_ar: "ماذا تقول الأرقام",
        body_en:
          subject.numbers.map((n) => `${n.label_en}: ${n.value}.`).join(" ") ||
          "No numeric series is attached to this subject yet.",
        body_ar:
          subject.numbers.map((n) => `${n.label_ar}: ${n.value}.`).join(" ") ||
          "لا توجد سلاسل رقمية مرتبطة بهذا الموضوع بعد.",
      },
      {
        heading_en: "What leadership should know",
        heading_ar: "ما ينبغي أن تعرفه القيادة",
        body_en:
          "This brief was assembled without the live AI service; it stitches the stored summary and numbers. Verify against the sources before circulation.",
        body_ar:
          "أعد هذا الموجز دون خدمة الذكاء الاصطناعي الحية؛ وهو يجمع الملخص والأرقام المخزنة. يرجى التحقق من المصادر قبل التعميم.",
      },
    ],
    key_numbers: subject.numbers.slice(0, 5),
    recommended_actions: [
      {
        text_en: "Review the underlying sources linked on the page.",
        text_ar: "مراجعة المصادر الأصلية المرتبطة في الصفحة.",
      },
      {
        text_en: "Ask the owner for the latest status before any decision.",
        text_ar: "التواصل مع الجهة المالكة للاطلاع على آخر مستجدات الحالة قبل أي قرار.",
      },
    ],
  };
}

export function mockExpertReasons(
  experts: {
    id: string;
    nameEn: string;
    domains: string[];
    topEngagement: string | null;
    contributions: number;
  }[]
) {
  return {
    reasons: experts.map((e) => ({
      expert_id: e.id,
      reason_en:
        [
          e.domains.length ? `Domain match: ${e.domains.slice(0, 2).join(", ")}` : null,
          e.topEngagement ? `worked on ${e.topEngagement}` : null,
          e.contributions ? `${e.contributions} verified contributions` : null,
        ]
          .filter(Boolean)
          .join("; ") || "Closest available profile by similarity.",
      reason_ar:
        [
          e.domains.length ? `تطابق في المجالات: ${e.domains.slice(0, 2).join("، ")}` : null,
          e.topEngagement ? `شارك في ${e.topEngagement}` : null,
          e.contributions ? `${e.contributions} مساهمة موثقة` : null,
        ]
          .filter(Boolean)
          .join("؛ ") || "أقرب ملف متاح حسب التشابه.",
    })),
  };
}

export function mockLessonStructure(rough: string) {
  const sents = sentences(rough);
  const third = Math.max(1, Math.ceil(sents.length / 3));
  const ctx = sents.slice(0, third).join(" ") || rough.slice(0, 200);
  const learn = sents.slice(third, third * 2).join(" ") || rough.slice(200, 400) || ctx;
  const rec = sents.slice(third * 2).join(" ") || "Apply this learning at the next comparable milestone.";
  const isAr = isArabicText(rough);
  const title = (isAr ? rough : rough).split(/[.؟!]/)[0].slice(0, 80);
  return {
    title_en: isAr ? "" : title,
    title_ar: isAr ? title : "",
    context_en: isAr ? "" : ctx,
    context_ar: isAr ? ctx : "",
    learning_en: isAr ? "" : learn,
    learning_ar: isAr ? learn : "",
    recommendation_en: isAr ? "" : rec,
    recommendation_ar: isAr ? rec : "",
    suggested_outcome_codes: [],
    suggested_topic_codes: [],
  };
}

export function mockIntent(query: string): { intent: string; lang: string } {
  const ar = isArabicText(query);
  const lang = ar ? "ar" : /[؀-ۿ]/.test(query) ? "mixed" : "en";
  const q = query.toLowerCase();
  if (/^(who|من\s|من\b)/.test(q) || /يعرف|خبير|expert/.test(q)) return { intent: "person", lang };
  if (/^(what is|ما هو|ما هي|تعريف|define)/.test(q)) return { intent: "definition", lang };
  if (/status|progress|حالة|تقدم|إنجاز/.test(q)) return { intent: "status", lang };
  if (/rate|growth|population|inflation|gdp|كم|معدل|نسبة|عدد|إحصاء|سكان|تضخم|\d{4}/.test(q))
    return { intent: "number", lang };
  if (/report|document|strategy|وثيقة|تقرير|استراتيجية/.test(q)) return { intent: "document", lang };
  return { intent: "mixed", lang };
}

/* ---------------- scanning (CR01) ---------------- */

type FixtureSignal = {
  title_en: string;
  title_ar: string;
  summary_en: string;
  summary_ar: string;
  why_en: string;
  why_ar: string;
  publisher: string;
  url: string;
  days_ago: number;
  signal_type: string;
  sentiment: string;
  impact: string;
  horizon: string;
  confidence: number;
  outcome_codes: string[];
  indicator_codes: string[];
};

let fixtureCache: FixtureSignal[] | null = null;

function loadScanFixture(): FixtureSignal[] {
  if (fixtureCache) return fixtureCache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodePath = require("node:path") as typeof import("node:path");
    const raw = fs.readFileSync(
      nodePath.resolve(process.cwd(), "scripts", "seed-content", "cr01.json"),
      "utf8"
    );
    fixtureCache = (JSON.parse(raw).mock_scan_fixture ?? []) as FixtureSignal[];
  } catch {
    fixtureCache = [];
  }
  return fixtureCache;
}

/** Mock scan run: 12 plausible signals with dates rotated to look fresh. */
export function mockScanCandidates() {
  const fixture = loadScanFixture();
  const today = Date.now();
  return fixture.map((f, i) => ({
    title_en: f.title_en,
    title_ar: f.title_ar,
    summary_en: f.summary_en,
    summary_ar: f.summary_ar,
    why_en: f.why_en,
    why_ar: f.why_ar,
    url: f.url || null,
    publisher: f.publisher || "seeded",
    published_at: new Date(today - ((f.days_ago + i) % 7) * 86400000)
      .toISOString()
      .slice(0, 10),
    signal_type: f.signal_type,
    impact: f.impact,
    horizon: f.horizon,
    sentiment: f.sentiment,
    confidence: f.confidence,
    outcome_codes: f.outcome_codes ?? [],
    indicator_codes: f.indicator_codes ?? [],
    source_excerpt: null as string | null,
  }));
}

/** Mock extraction for manual URL/PDF submissions: one extractive signal. */
export function mockManualSignal(
  text: string,
  title: string | null,
  url: string | null,
  publisher: string | null
) {
  const sents = sentences(text);
  const isAr = isArabicText(text);
  const cleanTitle = (title || sents[0] || "Manual signal").slice(0, 120);
  const summary = sents.slice(0, 2).join(" ").slice(0, 400) || text.slice(0, 300);
  return {
    title_en: isAr ? "" : cleanTitle,
    title_ar: isAr ? cleanTitle : "",
    summary_en: isAr ? "" : summary,
    summary_ar: isAr ? summary : "",
    why_en: "Submitted manually for triage against NDS3 relevance.",
    why_ar: "أُدرجت يدوياً للفرز وفق صلتها باستراتيجية التنمية الوطنية الثالثة.",
    url,
    publisher: publisher || (url ? new URL(url).hostname.replace(/^www\./, "") : "manual"),
    published_at: new Date().toISOString().slice(0, 10),
    signal_type: "research",
    impact: "medium",
    horizon: "mid",
    sentiment: "neutral",
    confidence: 0.5,
    outcome_codes: [],
    indicator_codes: [],
    source_excerpt: text.slice(0, 600),
  };
}

/* ---------------- analyst (CR01 4.8) ---------------- */

export type MockPlannedTool = { name: string; input: Record<string, unknown> };

const OUTCOME_HINTS: [RegExp, string][] = [
  [/fiscal|budget|revenue|مالي|الموازنة|إيراد/i, "fiscal_sust"],
  [/qatariz|labou?r|workforce|employ|skills|توطين|تقطير|عمل|قوى عاملة|مهارات/i, "workforce"],
  [/environment|emission|renewable|solar|climate|بيئ|انبعاث|شمسي|مناخ/i, "env_sust"],
  [/health|education|quality of life|housing|صحة|تعليم|جودة الحياة|إسكان/i, "quality_life"],
  [/social|family|cohesi|culture|مجتمع|أسرة|تماسك|ثقافة/i, "cohesive_society"],
  [/government|digital service|e-gov|حكوم|خدمات رقمية/i, "gov_excellence"],
  [/econom|gdp|fdi|invest|diversif|tourism|اقتصاد|ناتج|استثمار|تنويع|سياحة/i, "eco_growth"],
];

function inferOutcome(q: string): string | null {
  for (const [re, code] of OUTCOME_HINTS) if (re.test(q)) return code;
  return null;
}

/**
 * Mock planner: keyword rules pick tools (numbers -> indicators; "how many" ->
 * query_strategy with count; "who" -> experts; otherwise search). The tools are
 * real; only the model is mocked.
 */
export function mockAnalystPlan(
  query: string,
  lastUserMessage: string | null
): {
  lang: string;
  complexity: "simple" | "complex";
  rewritten: string;
  tools: MockPlannedTool[];
} {
  const short = query.trim().length < 28 || /^(and|but|what about|و|وماذا|وبالنسبة)/i.test(query.trim());
  const rewritten =
    short && lastUserMessage ? `${lastUserMessage} ${query.trim()}` : query.trim();
  const q = rewritten.toLowerCase();
  const lang = isArabicText(rewritten) ? "ar" : "en";
  const outcome = inferOutcome(rewritten);
  const tools: MockPlannedTool[] = [];
  let complexity: "simple" | "complex" = "simple";

  // CR02 2.3: "what did project PRJ-01a deliver?" routes to get_deliverables
  const nodeCodeMatch = /\b(prj-[\w-]+|ini-\d+)\b/i.exec(rewritten);
  const delivery = /deliver|deliverable|output|تسليم|مخرجات|ماذا سلم/i.test(q);

  const wantsCount = /how many|count of|كم عدد|عدد ال/i.test(q);
  const strategyNoun = /target|initiative|project|outcome|node|مستهدف|هدف|مبادر|مشروع|نتيجة/i.test(q);
  const performance =
    /how are we doing|how is .* going|progress on|on track for|كيف نسير|كيف أداؤنا|أين وصلنا|qatariz|توطين|تقطير/i.test(q);
  const numberish =
    performance ||
    /rate|inflation|population|gdp|unemployment|percent|latest|current|by sector|كم بلغ|معدل|نسبة|سكان|تضخم|بطالة|ناتج|حالي|حسب القطاع/i.test(q);
  const person = /^who|who should|من الذي|من ينبغي|من أسأل|خبير/i.test(q);
  const risk = /at risk|off track|behind|delayed|معرضة للخطر|متأخر|متعثر/i.test(q);
  const changed = /what changed|this quarter|this week|ماذا تغير|هذا الربع/i.test(q);
  const compare = /compare|versus| vs |قارن|مقارنة/i.test(q);
  const lessons = /learn|lesson|تعلمنا|دروس|ماذا استفدنا/i.test(q);
  const realistic = /realistic|achievable|feasible|واقعي|قابل للتحقيق/i.test(q);

  if (delivery && nodeCodeMatch) {
    tools.push({
      name: "get_deliverables",
      input: { node_code: nodeCodeMatch[1].toUpperCase() },
    });
    tools.push({ name: "get_node", input: { code: nodeCodeMatch[1].toUpperCase() } });
  } else if (compare) {
    complexity = "complex";
    const theme = rewritten
      .replace(/compare|nds\d|and|on|versus|قارن|مقارنة|بين/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    tools.push({ name: "compare_editions", input: { theme: theme || "labour" } });
  } else if (wantsCount && strategyNoun) {
    const nodeType = /initiative|مبادر/i.test(q)
      ? "initiative"
      : /project|مشروع/i.test(q)
        ? "project"
        : /outcome|نتيجة/i.test(q)
          ? "outcome"
          : "target";
    tools.push({ name: "query_strategy", input: { edition: "nds3", node_type: nodeType, count_by: "outcome" } });
  } else if (risk) {
    complexity = "complex";
    tools.push({ name: "query_strategy", input: { edition: "nds3", status: "at_risk" } });
    tools.push({ name: "what_changed", input: { days: 90 } });
  } else if (changed) {
    tools.push({
      name: "what_changed",
      input: outcome ? { outcome_code: outcome, days: 90 } : { days: 90 },
    });
  } else if (person) {
    tools.push({ name: "find_experts", input: { question: rewritten, limit: 3 } });
    tools.push({ name: "search_knowledge", input: { query: rewritten, types: ["answer", "lesson"], limit: 3 } });
  } else if (lessons) {
    tools.push({ name: "get_lessons", input: { text: rewritten.replace(/what did we learn from|ماذا تعلمنا من/gi, "").trim().slice(0, 60) } });
    tools.push({ name: "search_knowledge", input: { query: rewritten, types: ["decision", "document"], limit: 4 } });
  } else if (realistic) {
    complexity = "complex";
    tools.push({ name: "query_indicators", input: { text: rewritten.slice(0, 60) } });
    tools.push({ name: "search_knowledge", input: { query: rewritten, limit: 4 } });
    tools.push({ name: "get_signals", input: { text: rewritten.slice(0, 40), days: 90 } });
  } else if (numberish) {
    // indicators first, then supporting documents
    const topic = rewritten
      .replace(/how are we doing (in|on|with)?|what is|what's|the|current|latest|rate of|كيف نسير في|ما هو|ما هي|الحالي|كم بلغ|معدل/gi, " ")
      .replace(/[?؟]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50);
    tools.push({ name: "query_indicators", input: { text: topic || rewritten.slice(0, 40) } });
    tools.push({ name: "search_knowledge", input: { query: rewritten, limit: 3 } });
    if (performance || outcome === "workforce") {
      tools.push({ name: "query_strategy", input: { edition: "nds3", text: topic.split(" ")[0] ?? "", node_type: "target" } });
      tools.push({ name: "get_lessons", input: { text: topic.split(" ")[0] ?? "" } });
      tools.push({ name: "find_experts", input: { question: rewritten, limit: 3 } });
      tools.push({ name: "get_signals", input: { text: topic.split(" ")[0] ?? "", days: 90 } });
      complexity = "complex";
    }
  } else {
    tools.push({ name: "search_knowledge", input: { query: rewritten, limit: 6 } });
    if (outcome) tools.push({ name: "get_signals", input: { days: 90, text: rewritten.slice(0, 40) } });
  }
  return { lang, complexity, rewritten, tools: tools.slice(0, 8) };
}

const CTRL_CHARS = new RegExp("[" + String.fromCharCode(0) + "-" + String.fromCharCode(31) + String.fromCharCode(127) + "]", "g");
/** Mock writer: extractive stitch of the tool outputs' citable lines. */
export function mockAnalystAnswer(
  toolOutputs: { name: string; output: string }[],
  lang: string
): string {
  const lines: string[] = [];
  const keepable = (l: string) =>
    /^\[\d+\]/.test(l) || /^(Latest|Previous|Linked KPI target|Approx CAGR)/.test(l);
  for (const t of toolOutputs) {
    if (/^(No |Unknown|Tool .* failed|compute error)/.test(t.output)) continue;
    const firstLines = t.output
      .split("\n")
      .map((l) => l.replace(CTRL_CHARS, " ").replace(/\s+/g, " ").trim()) // strip control chars from legacy-font PDF extractions
      .filter((l) => l.length > 8 && keepable(l))
      .map((l) => l.slice(0, 320))
      .slice(0, t.name === "query_strategy" ? 9 : 3);
    lines.push(...firstLines);
    if (lines.length > 12) break;
  }
  if (!lines.length) {
    return lang === "ar"
      ? "لم أجد في سيا نكسس ما يجيب عن هذا السؤال مباشرة. جرب إعادة الصياغة أو وجّه السؤال إلى خبير."
      : "I could not find anything in SiaNexus that answers this directly. Try rephrasing, or route it to an expert.";
  }
  const intro =
    lang === "ar"
      ? "وفق بيانات سيا نكسس، هذا أبرز ما وجدته:"
      : "From SiaNexus data, here is what I found:";
  const outro =
    lang === "ar"
      ? "التفاصيل الكاملة في الأقسام أدناه."
      : "The full detail sits in the sections below.";
  return [intro, "", ...lines.slice(0, 12).map((l) => (l.startsWith("[") ? l : `- ${l}`)), "", outro].join("\n");
}

/** Deterministic follow-ups per tool mix (never generic). */
export function mockAnalystFollowUps(
  toolsUsed: string[],
  lang: string
): string[] {
  const ar = lang === "ar";
  const out: string[] = [];
  if (toolsUsed.includes("query_strategy")) {
    out.push(ar ? "أرني القائمة الكاملة" : "Show me the list");
    out.push(ar ? "كم منها على المسار الصحيح؟" : "How many are on track?");
  }
  if (toolsUsed.includes("get_indicator_series") || toolsUsed.includes("query_indicators")) {
    out.push(ar ? "هل تريد التفصيل حسب القطاع؟" : "Do you want the breakdown by sector?");
    out.push(ar ? "هل أعدّ موجزاً للقيادة؟" : "Should I brief this for leadership?");
  }
  if (toolsUsed.includes("find_experts")) {
    out.push(ar ? "أرسل السؤال إلى الخبير الأقرب" : "Send this to the closest expert");
  }
  if (toolsUsed.includes("compare_editions")) {
    out.push(ar ? "ما الذي استمر إلى الاستراتيجية الثالثة؟" : "What carried through into NDS3?");
    out.push(ar ? "أرني روابط النسب بين النسختين" : "Show me the lineage links between the editions");
  }
  if (toolsUsed.includes("what_changed")) {
    out.push(ar ? "ما أهم خطر ظهر في الفترة؟" : "What is the biggest risk in the period?");
  }
  if (toolsUsed.includes("get_lessons")) {
    out.push(ar ? "حوّل أهم درس إلى توصية قيادية" : "Turn the top lesson into a leadership recommendation");
  }
  if (out.length < 2) {
    out.push(ar ? "ابحث في الوثائق ذات الصلة" : "Search the related documents");
    if (out.length < 2) out.push(ar ? "من الخبير الأنسب لهذا الموضوع؟" : "Who is the right expert for this?");
  }
  return out.slice(0, 3);
}

/* ---------------- knowledge structurer (CR01 5.6) ---------------- */

/**
 * Mock structurer: splits text by paragraphs, first sentence becomes the title,
 * keyword-matches tags and NDS3 outcomes, returns one Lesson item per paragraph.
 * Image and file inputs each become one item from their filename.
 */
export function mockKnowledgeStructure(input: {
  notes: string;
  whereFrom: string;
  parsedFiles: { filename: string; text: string; mime: string }[];
  images: { filename: string; mediaType: string; base64: string }[];
  pages: { url: string; title: string; text: string }[];
}) {
  const items: import("./knowledge_structurer").KnowledgeItem[] = [];

  const makeLesson = (raw: string, titleHint?: string) => {
    const text = raw.trim();
    if (text.length < 30) return;
    const isAr = isArabicText(text);
    const sents = sentences(text);
    const title = (titleHint ?? sents[0] ?? text.slice(0, 80)).slice(0, 100);
    const third = Math.max(1, Math.ceil(sents.length / 3));
    const ctx = sents.slice(0, third).join(" ") || text.slice(0, 200);
    const learn = sents.slice(third, third * 2).join(" ") || ctx;
    const rec =
      sents.slice(third * 2).join(" ") ||
      (isAr ? "تطبيق هذا الدرس في المحطة المقبلة المماثلة." : "Apply this learning at the next comparable milestone.");
    const outcome = inferOutcome(text);
    items.push({
      types: ["lesson"],
      title_en: isAr ? "" : title,
      title_ar: isAr ? title : "",
      cleaned_en: isAr ? "" : text.slice(0, 2000),
      cleaned_ar: isAr ? text.slice(0, 2000) : "",
      lesson: {
        context_en: isAr ? "" : ctx,
        context_ar: isAr ? ctx : "",
        learning_en: isAr ? "" : learn,
        learning_ar: isAr ? learn : "",
        recommendation_en: isAr ? "" : rec,
        recommendation_ar: isAr ? rec : "",
      },
      topic_codes: [],
      outcome_links: outcome
        ? [
            {
              code: outcome,
              reason_en: "Keyword match to this national outcome.",
              reason_ar: "تطابق كلمات مفتاحية مع هذه النتيجة الوطنية.",
            },
          ]
        : [],
      indicator_codes: [],
      classification_level: 2,
      confidence: 0.5,
      next_step_en: "Review the AI translation flags, then share with your community.",
      next_step_ar: "راجع حقول الترجمة الآلية ثم شارك العنصر مع مجتمعك المعرفي.",
      machine: true,
    });
  };

  const paragraphs = input.notes
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 30)
    .slice(0, 4);
  for (const p of paragraphs) makeLesson(p);
  for (const f of input.parsedFiles.slice(0, 3)) makeLesson(f.text.slice(0, 1500), cleanFilename(f.filename));
  for (const p of input.pages.slice(0, 2)) makeLesson(p.text.slice(0, 1200), p.title);
  for (const img of input.images.slice(0, 2)) {
    items.push({
      types: ["lesson"],
      title_en: `Photo note: ${cleanFilename(img.filename)}`,
      title_ar: "",
      cleaned_en:
        "AI vision is unavailable in mock mode, so the photo text was not read. The image is attached; edit this item with what the note says.",
      cleaned_ar: "",
      lesson: {
        context_en: "A photographed note was submitted through Add Knowledge.",
        context_ar: "",
        learning_en: "[unclear in notes]",
        learning_ar: "",
        recommendation_en: "Type the key line from the photo into this item before publishing.",
        recommendation_ar: "",
      },
      topic_codes: [],
      outcome_links: [],
      indicator_codes: [],
      classification_level: 2,
      confidence: 0.3,
      next_step_en: "Transcribe the photo, then publish.",
      next_step_ar: "انسخ نص الصورة ثم انشر العنصر.",
      machine: true,
    });
  }
  if (!items.length) makeLesson(input.notes || "Empty submission with no readable content provided by the user.");
  return items;
}

export function mockHealth(metrics: Record<string, number | string>) {
  const lines = Object.entries(metrics)
    .slice(0, 8)
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
    .join(". ");
  return {
    narrative_en: `Weekly knowledge health, assembled without the live AI service. ${lines}. Verified coverage and contribution volume are the two levers to watch; keep the verification queue short and the gaps list active.`,
    narrative_ar: `الصحة المعرفية الأسبوعية، أعدت دون خدمة الذكاء الاصطناعي الحية. ${lines}. تغطية التوثيق وحجم المساهمات هما الرافعتان الأهم؛ حافظوا على قصر قائمة التحقق وتفعيل قائمة الفجوات.`,
    actions: [
      {
        text_en: "Clear the oldest items in the verification queue.",
        text_ar: "معالجة أقدم العناصر في قائمة انتظار التحقق.",
      },
      {
        text_en: "Post a bounty on the top zero-result search topic.",
        text_ar: "طرح مكافأة معرفية حول الموضوع الأكثر بحثاً دون نتائج.",
      },
    ],
  };
}

/* ---------------- podcast script (CR02 4.4 mock) ---------------- */

/**
 * Mock podcast script: deterministic two-voice episode built from the
 * gathered material's numbered source lines. Cold open, up to four Q and A
 * beats with spoken attributions, a numbers moment when digits exist, a
 * lesson to keep, and a sign-off, capped to the requested minutes.
 */
export function mockPodcastScript(input: {
  labelEn: string;
  labelAr: string;
  material: string;
  language: "ar" | "en";
  minutes: number;
  focus: string;
  /* CR04 3.6: the single-lesson episode template */
  template?: "lesson";
}): {
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  segments: { speaker: "mariam" | "hamad"; text: string; source_mention?: string | null }[];
} {
  const ar = input.language === "ar";
  const maxWords = input.minutes * (ar ? 130 : 150);
  const sourceLines = input.material
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\[\d+\]/.test(l))
    .map((l) => {
      const m = /^\[(\d+)\]\s*(?:[a-z_]+\s*)?"?([^":]{3,110})"?[^:]*:\s*(.+)$/.exec(l);
      return m ? { n: Number(m[1]), title: m[2].trim(), text: m[3].trim() } : null;
    })
    .filter((x): x is { n: number; title: string; text: string } => Boolean(x))
    .slice(0, 6);

  const segs: { speaker: "mariam" | "hamad"; text: string; source_mention?: string | null }[] = [];
  const w = (s: string) => s.split(/\s+/).filter(Boolean).length;
  let used = 0;
  const push = (speaker: "mariam" | "hamad", text: string, mention?: string | null) => {
    if (used + w(text) > maxWords) return false;
    segs.push({ speaker, text, source_mention: mention ?? null });
    used += w(text);
    return true;
  };

  /* CR04 4.2: every episode opens and signs off with the official name */
  if (input.template === "lesson") {
    // CR04 3.6: Hamad introduces the lesson and its source, Dr. Mariam
    // explains it and the recommendation, Hamad closes with where it applies.
    const first = sourceLines[0];
    const clean = (s: string | undefined, n: number) => (s ?? "").replace(/\s+/g, " ").slice(0, n);
    if (ar) {
      push(
        "hamad",
        `أهلاً بكم في بودكاست المعرفة من المجلس الوطني للتخطيط. حلقة قصيرة اليوم عن درس واحد يستحق دقيقتين من وقتكم: ${input.labelAr || input.labelEn}. دكتورة مريم، ما القصة؟`
      );
      if (first) {
        push("mariam", clean(first.text, 300), `كما سُجل في ${first.title}`);
      }
      push(
        "mariam",
        "والتوصية العملية: طبقوا هذا الدرس عند أول محطة قادمة مشابهة، ولا تنتظروا نهاية المشروع لتوثيق ما تعلمتم."
      );
      push(
        "hamad",
        `أين ينطبق هذا؟ في كل مشروع يمر بالمرحلة نفسها. ستجدون الدرس وروابطه في غرفة التعلم في سيا نكسس. كان هذا بودكاست المعرفة. إلى اللقاء.`
      );
    } else {
      push(
        "hamad",
        `Welcome to NPC Knowledge Cast, from the National Planning Council. A short one today: a single lesson worth two minutes of your time: ${input.labelEn}. Dr. Mariam, what is the story?`
      );
      if (first) {
        push("mariam", clean(first.text, 320), `as recorded in ${first.title}`);
      }
      push(
        "mariam",
        "And the working recommendation: apply this at the next comparable milestone, and do not wait for project close-out to write down what you learned."
      );
      push(
        "hamad",
        `Where does it apply? In every project passing through the same stage. You will find the lesson and its links in the Learning Room in SiaNexus. That was NPC Knowledge Cast. Until next time.`
      );
    }
  } else if (ar) {
    push(
      "hamad",
      `أهلاً بكم في بودكاست المعرفة من المجلس الوطني للتخطيط. حلقة اليوم عن ${input.labelAr || input.labelEn}، وسبب اهتمامنا بها أنها تمس عملنا اليومي في تنفيذ الاستراتيجية الوطنية. معي الدكتورة مريم. أهلاً دكتورة.`
    );
    push("mariam", "أهلاً حمد، وأهلاً بمستمعي البودكاست. المادة التي بين أيدينا اليوم غنية، فلنبدأ.");
    for (const s of sourceLines.slice(0, 4)) {
      if (!push("hamad", `حدثينا عن ${s.title}. ما الذي تقوله المادة هنا؟`)) break;
      const clean = s.text.replace(/\s+/g, " ").slice(0, 260);
      if (!push("mariam", `${clean}`, `كما ورد في ${s.title}`)) break;
    }
    const numeric = sourceLines.find((s) => /\d/.test(s.text));
    if (numeric) {
      push("hamad", "قبل أن نختم، لحظة الأرقام. ما أهم رقم يجب أن نحفظه من هذه الحلقة؟");
      const numClean = numeric.text.replace(/\s+/g, " ").slice(0, 200);
      push("mariam", `الرقم الأهم هنا: ${numClean}`, `بحسب ${numeric.title}`);
    }
    push(
      "mariam",
      "والدرس الذي أرجو أن نحتفظ به: المعرفة الموثقة في وقتها توفر على الفريق القادم شهوراً من إعادة الاكتشاف. سجلوا ما تعلمتم في سيا نكسس قبل أن ينساه المشروع."
    );
    push("hamad", "شكراً دكتورة مريم، وشكراً لكم على الاستماع. كان هذا بودكاست المعرفة. إلى اللقاء.");
  } else {
    push(
      "hamad",
      `Welcome to NPC Knowledge Cast, from the National Planning Council. Today we are talking about ${input.labelEn}, and it matters because it touches the daily work of delivering the national strategy. With me is Dr. Mariam. Welcome, doctor.`
    );
    push("mariam", "Thank you Hamad, and hello to everyone listening to the Cast. The material in front of us today is rich, so let us begin.");
    for (const s of sourceLines.slice(0, 4)) {
      if (!push("hamad", `Tell us about ${s.title}. What does the material say here?`)) break;
      const clean = s.text.replace(/\s+/g, " ").slice(0, 280);
      if (!push("mariam", clean, `as ${s.title} records`)) break;
    }
    const numeric = sourceLines.find((s) => /\d/.test(s.text));
    if (numeric) {
      push("hamad", "Before we close, the numbers moment. What is the one figure to remember from this episode?");
      const numClean = numeric.text.replace(/\s+/g, " ").slice(0, 220);
      push("mariam", `The figure to keep: ${numClean}`, `according to ${numeric.title}`);
    }
    push(
      "mariam",
      "And the lesson to keep: knowledge recorded in its moment saves the next team months of rediscovery. Capture what you learned in SiaNexus before the project forgets it."
    );
    push("hamad", "Thank you Dr. Mariam, and thank you for listening. That was NPC Knowledge Cast. Until next time.");
  }

  return {
    title_en: `${input.labelEn}: what the knowledge says`,
    title_ar: `${input.labelAr || input.labelEn}: ماذا تقول المعرفة`,
    description_en: `A short two-voice episode on ${input.labelEn}, grounded in the selected SiaNexus content.`,
    description_ar: `حلقة قصيرة بصوتين عن ${input.labelAr || input.labelEn}، مبنية على المحتوى المختار في سيا نكسس.`,
    segments: segs,
  };
}
