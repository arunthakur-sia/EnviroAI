// CR08 5.2: the report type catalogue. The seed upserts these rows into
// `report_types` by code; the service reads the table, never this file, so an
// administrator can retire or reorder a type without a deploy. The custom
// type (family "custom") is the Super Admin's free selection of sections.
import type { Audience, ReportFamily, ScopeKind, SectionCode } from "./spec";

export type ReportCadence = "annual" | "quarterly" | "monthly" | "on_demand" | "on_closure";

export type ReportTypeSpec = {
  code: string;
  family: ReportFamily;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  defaultSections: SectionCode[];
  optionalSections: SectionCode[];
  scopeKind: ScopeKind;
  classificationDefault: number;
  audienceDefault: Audience;
  cadence: ReportCadence;
  sort: number;
};

export const CUSTOM_TYPE_CODE = "custom";

export const REPORT_TYPES: ReportTypeSpec[] = [
  /* ---------------------------------------------------------------- */
  /* Public                                                             */
  /* ---------------------------------------------------------------- */
  {
    code: "npc_annual_report",
    family: "public",
    nameEn: "NPC Annual Report",
    nameAr: "التقرير السنوي للمجلس الوطني للتخطيط",
    descriptionEn:
      "The Council's year in one designed volume: the mandate, the NDS3 outcomes, delivery progress, the statistical picture, Qatar's standing in international indices, partnerships and the outlook.",
    descriptionAr:
      "عام المجلس في مجلد واحد مصمم: الولاية، ونتائج استراتيجية التنمية الوطنية الثالثة، وتقدم التنفيذ، والصورة الإحصائية، ومكانة قطر في المؤشرات الدولية، والشراكات، والآفاق المقبلة.",
    defaultSections: [
      "cover",
      "contents",
      "foreword",
      "year_at_a_glance",
      "mandate_governance",
      "nds3_outcomes_overview",
      "initiatives_progress",
      "statistics_highlights",
      "international_indices",
      "events_partnerships",
      "outlook",
      "sources_appendix",
      "closing",
    ],
    optionalSections: [
      "outcome_deep_dive",
      "targets_scorecard",
      "deliverables_received",
      "index_forecasts",
      "signals_implications",
      "lessons_themes",
    ],
    scopeKind: "npc",
    classificationDefault: 1,
    audienceDefault: "public",
    cadence: "annual",
    sort: 10,
  },
  {
    code: "nds3_progress_public",
    family: "public",
    nameEn: "NDS3 Progress Report (public edition)",
    nameAr: "تقرير التقدم في استراتيجية التنمية الوطنية الثالثة (النسخة العامة)",
    descriptionEn:
      "Progress against the seven national outcomes and their targets, written for the public: where delivery stands, what moved, and what comes next.",
    descriptionAr:
      "التقدم المحرز في النتائج الوطنية السبع ومستهدفاتها، بصياغة موجهة إلى الجمهور: أين يقف التنفيذ، وما الذي تغير، وما المقبل.",
    defaultSections: [
      "cover",
      "contents",
      "foreword",
      "year_at_a_glance",
      "nds3_outcomes_overview",
      "targets_scorecard",
      "initiatives_progress",
      "outlook",
      "sources_appendix",
      "closing",
    ],
    optionalSections: [
      "outcome_deep_dive",
      "deliverables_received",
      "international_indices",
      "lessons_themes",
    ],
    scopeKind: "npc",
    classificationDefault: 1,
    audienceDefault: "public",
    cadence: "annual",
    sort: 20,
  },
  {
    code: "indices_annual",
    family: "public",
    nameEn: "Qatar in International Indices",
    nameAr: "قطر في المؤشرات الدولية",
    descriptionEn:
      "The annual reading of Qatar's movements across the tracked international indices, the GCC benchmark, the SiaNexus forecasts with their method note, and the signals behind them.",
    descriptionAr:
      "القراءة السنوية لتحركات قطر في المؤشرات الدولية المتابعة، والمقارنة الخليجية، وتنبؤات سيا نكسس مع ملاحظة المنهجية، والإشارات الكامنة وراءها.",
    defaultSections: [
      "cover",
      "contents",
      "foreword",
      "year_at_a_glance",
      "international_indices",
      "index_forecasts",
      "signals_implications",
      "outlook",
      "sources_appendix",
      "closing",
    ],
    optionalSections: ["statistics_highlights", "lessons_themes"],
    scopeKind: "npc",
    classificationDefault: 1,
    audienceDefault: "public",
    cadence: "annual",
    sort: 30,
  },
  {
    code: "statistical_highlights",
    family: "public",
    nameEn: "Statistical Highlights",
    nameAr: "أبرز الإحصاءات",
    descriptionEn:
      "The quarter in figures: population, economy, labour, prices and trade from the official series, with the indices that moved and the releases ahead.",
    descriptionAr:
      "الربع بالأرقام: السكان والاقتصاد والعمل والأسعار والتجارة من السلاسل الرسمية، مع المؤشرات التي تحركت والإصدارات المقبلة.",
    defaultSections: [
      "cover",
      "contents",
      "year_at_a_glance",
      "statistics_highlights",
      "international_indices",
      "outlook",
      "sources_appendix",
      "closing",
    ],
    optionalSections: ["foreword", "signals_implications"],
    scopeKind: "period",
    classificationDefault: 1,
    audienceDefault: "public",
    cadence: "quarterly",
    sort: 40,
  },

  /* ---------------------------------------------------------------- */
  /* Internal                                                           */
  /* ---------------------------------------------------------------- */
  {
    code: "council_performance",
    family: "internal",
    nameEn: "Council Strategy Performance Report",
    nameAr: "تقرير أداء استراتيجية المجلس",
    descriptionEn:
      "The quarterly scorecard of the Council's own institutional strategy: goals by RAG, the outputs behind, the decisions the leadership needs to take, and the lessons of the quarter.",
    descriptionAr:
      "بطاقة الأداء الربع سنوية لاستراتيجية المجلس المؤسسية: الأهداف بحسب حالة الأداء، والمخرجات المتأخرة، والقرارات المطلوبة من القيادة، ودروس الربع.",
    defaultSections: [
      "cover",
      "contents",
      "year_at_a_glance",
      "council_scorecard",
      "outputs_behind",
      "lessons_themes",
      "outlook",
      "sources_appendix",
      "closing",
    ],
    optionalSections: ["foreword", "knowledge_continuity", "signals_implications"],
    scopeKind: "npc",
    classificationDefault: 2,
    audienceDefault: "working",
    cadence: "quarterly",
    sort: 50,
  },
  {
    code: "nds3_delivery_monthly",
    family: "internal",
    nameEn: "NDS3 Delivery Report",
    nameAr: "تقرير تنفيذ استراتيجية التنمية الوطنية الثالثة",
    descriptionEn:
      "The monthly delivery view of one national outcome: its targets, the initiatives and projects with their status updates, the deliverables received, and the signals and lessons that touch it.",
    descriptionAr:
      "عرض التنفيذ الشهري لنتيجة وطنية واحدة: مستهدفاتها، ومبادراتها ومشاريعها مع تحديثات حالتها، والمخرجات المستلمة، والإشارات والدروس المتصلة بها.",
    defaultSections: [
      "cover",
      "contents",
      "outcome_deep_dive",
      "targets_scorecard",
      "initiatives_progress",
      "deliverables_received",
      "signals_implications",
      "lessons_themes",
      "outlook",
      "sources_appendix",
      "closing",
    ],
    optionalSections: ["foreword", "year_at_a_glance", "international_indices"],
    scopeKind: "outcome",
    classificationDefault: 2,
    audienceDefault: "working",
    cadence: "monthly",
    sort: 60,
  },
  {
    code: "leadership_briefing",
    family: "internal",
    nameEn: "Leadership Briefing Pack",
    nameAr: "حزمة الإحاطة القيادية",
    descriptionEn:
      "The confidential pack for the Secretary General and the leadership: the state of NDS3 and the Council strategy, what is behind, the indices, the signals, and the decisions ahead.",
    descriptionAr:
      "الحزمة السرية للأمين العام والقيادة: حالة استراتيجية التنمية الوطنية الثالثة واستراتيجية المجلس، وما تأخر، والمؤشرات، والإشارات، والقرارات المقبلة.",
    defaultSections: [
      "cover",
      "contents",
      "year_at_a_glance",
      "nds3_outcomes_overview",
      "council_scorecard",
      "outputs_behind",
      "international_indices",
      "signals_implications",
      "outlook",
      "sources_appendix",
      "closing",
    ],
    optionalSections: [
      "foreword",
      "targets_scorecard",
      "index_forecasts",
      "lessons_themes",
      "knowledge_continuity",
      "statistics_highlights",
    ],
    scopeKind: "npc",
    classificationDefault: 3,
    audienceDefault: "leadership",
    cadence: "quarterly",
    sort: 70,
  },
  {
    code: "signals_foresight_monthly",
    family: "internal",
    nameEn: "Signals and Foresight Brief",
    nameAr: "موجز الإشارات والاستشراف",
    descriptionEn:
      "The month's accepted signals with their implications for the outcomes, the current index forecasts, and the outlook the foresight team should carry into planning.",
    descriptionAr:
      "الإشارات المقبولة خلال الشهر ودلالاتها على النتائج، وتنبؤات المؤشرات الحالية، والآفاق التي ينبغي لفريق الاستشراف حملها إلى التخطيط.",
    defaultSections: [
      "cover",
      "contents",
      "signals_implications",
      "index_forecasts",
      "outlook",
      "sources_appendix",
      "closing",
    ],
    optionalSections: ["year_at_a_glance", "international_indices", "lessons_themes"],
    scopeKind: "npc",
    classificationDefault: 2,
    audienceDefault: "working",
    cadence: "monthly",
    sort: 80,
  },
  {
    code: "lessons_digest_quarterly",
    family: "internal",
    nameEn: "Lessons Learned Digest",
    nameAr: "خلاصة الدروس المستفادة",
    descriptionEn:
      "The quarter's lessons grouped by theme and outcome, the recommendations that recur, and where they should land in the next planning cycle.",
    descriptionAr:
      "دروس الربع مصنفة بحسب المحور والنتيجة، والتوصيات المتكررة، وأين ينبغي أن تستقر في دورة التخطيط المقبلة.",
    defaultSections: [
      "cover",
      "contents",
      "year_at_a_glance",
      "lessons_themes",
      "outlook",
      "sources_appendix",
      "closing",
    ],
    optionalSections: ["foreword", "outcome_deep_dive", "initiatives_progress"],
    scopeKind: "npc",
    classificationDefault: 2,
    audienceDefault: "working",
    cadence: "quarterly",
    sort: 90,
  },
  {
    code: "index_forecast_report",
    family: "internal",
    nameEn: "Index Forecast Report",
    nameAr: "تقرير تنبؤات المؤشرات",
    descriptionEn:
      "The SiaNexus forecasts for every tracked index at one, three and five years, the ranges and confidence, the method note, and the signals that moved the numbers.",
    descriptionAr:
      "تنبؤات سيا نكسس لكل مؤشر متابع على آفاق سنة وثلاث وخمس سنوات، والنطاقات ودرجة الثقة، وملاحظة المنهجية، والإشارات التي حركت الأرقام.",
    defaultSections: [
      "cover",
      "contents",
      "international_indices",
      "index_forecasts",
      "signals_implications",
      "outlook",
      "sources_appendix",
      "closing",
    ],
    optionalSections: ["foreword", "year_at_a_glance"],
    scopeKind: "npc",
    classificationDefault: 2,
    audienceDefault: "working",
    cadence: "annual",
    sort: 100,
  },
  {
    code: "department_continuity",
    family: "internal",
    nameEn: "Department Knowledge and Continuity Report",
    nameAr: "تقرير المعرفة والاستمرارية للإدارة",
    descriptionEn:
      "One unit's mandate, the knowledge it holds, its readiness and continuity scores, the open risks, the lessons it authored and the deliverables it produced.",
    descriptionAr:
      "ولاية وحدة واحدة، والمعرفة التي تحتفظ بها، ودرجات الجاهزية والاستمرارية، والمخاطر المفتوحة، والدروس التي دونتها، والمخرجات التي أنتجتها.",
    defaultSections: [
      "cover",
      "contents",
      "mandate_governance",
      "knowledge_continuity",
      "lessons_themes",
      "deliverables_received",
      "outlook",
      "sources_appendix",
      "closing",
    ],
    optionalSections: ["foreword", "initiatives_progress"],
    scopeKind: "department",
    classificationDefault: 2,
    audienceDefault: "working",
    cadence: "annual",
    sort: 110,
  },
  {
    code: "project_closure",
    family: "internal",
    nameEn: "Project Closure Report",
    nameAr: "تقرير إقفال المشروع",
    descriptionEn:
      "The closing record of one project: what it set out to do, the deliverables and results, the stakeholders, and the lessons it leaves for the next one.",
    descriptionAr:
      "السجل الختامي لمشروع واحد: ما سعى إليه، والمخرجات والنتائج، وأصحاب المصلحة، والدروس التي يخلفها للمشروع التالي.",
    defaultSections: [
      "cover",
      "contents",
      "project_closure",
      "deliverables_received",
      "lessons_themes",
      "sources_appendix",
      "closing",
    ],
    optionalSections: [
      "targets_scorecard",
      "initiatives_progress",
      "events_partnerships",
      "signals_implications",
    ],
    scopeKind: "project",
    classificationDefault: 2,
    audienceDefault: "working",
    cadence: "on_closure",
    sort: 120,
  },

  /* ---------------------------------------------------------------- */
  /* Custom (Super Admin only)                                          */
  /* ---------------------------------------------------------------- */
  {
    code: CUSTOM_TYPE_CODE,
    family: "custom",
    nameEn: "Custom report",
    nameAr: "تقرير مخصص",
    descriptionEn:
      "Any selection of sections from the library, on any scope and period. Built by the Super Admin.",
    descriptionAr: "أي اختيار من أقسام المكتبة، على أي نطاق وفترة. يبنيه المشرف العام.",
    defaultSections: ["cover", "contents", "closing"],
    optionalSections: [
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
    ],
    scopeKind: "npc",
    classificationDefault: 2,
    audienceDefault: "working",
    cadence: "on_demand",
    sort: 900,
  },
];

export function reportTypeSpec(code: string): ReportTypeSpec | null {
  return REPORT_TYPES.find((t) => t.code === code) ?? null;
}
