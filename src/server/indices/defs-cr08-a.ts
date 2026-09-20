// CR08 4.1: index definitions for the SDGs, Gallup, Human Development and
// Society, and Governance and Institutions groups (research agent A). The
// competitiveness, environment, peace, digital and national groups live in
// defs-cr08-b.ts. Every def names the research file that carries its real
// published observations (sources/indices/research/cr08-<code>.json, one
// file per index, the CR05 research-file shape) so the fetcher's research
// loader can pick it up next to the CR05 <code>.extracted.json files.
//
// Membership of indices that already exist in INDEX_DEFS (the seed maps
// these, they are not redefined here): hdi -> human; cpi, wjp, egdi ->
// governance.
import type { IndexDef } from "./fetcher";

export type Cr08IndexDef = IndexDef & {
  groups: string[];
  sdgGoal?: number;
  sdgColour?: string;
  forecastMode?: "rank" | "score" | "target_gap";
  forecastEnabled?: boolean;
  researchFile?: string;
};

const SDSN = {
  publisher: "SDSN Sustainable Development Report",
  publisherUrl: "https://dashboards.sdgindex.org/",
  frequency: "annual",
} satisfies Partial<Cr08IndexDef>;

const GALLUP = {
  publisher: "Gallup",
  frequency: "annual",
  category: "society",
} satisfies Partial<Cr08IndexDef>;

const WGI = {
  publisher: "World Bank",
  publisherUrl: "https://www.worldbank.org/en/publication/worldwide-governance-indicators",
  scale: "score",
  scoreMin: 0,
  scoreMax: 100,
  higherIsBetter: true,
  frequency: "annual",
  category: "governance",
  groups: ["governance"],
  forecastMode: "score",
  forecastEnabled: true,
} satisfies Partial<Cr08IndexDef>;

/* ------------------------------------------------------------------ */
/* SDGs                                                                 */
/* ------------------------------------------------------------------ */

type GoalSpec = {
  n: number;
  en: string;
  ar: string;
  colour: string;
  category: IndexDef["category"];
  entity: string;
  keywords: string[];
};

// Official UN goal titles (English and Arabic) and the official SDG palette.
const SDG_GOALS: GoalSpec[] = [
  { n: 1, en: "No Poverty", ar: "القضاء على الفقر", colour: "#E5243B", category: "human", entity: "Ministry of Social Development and Family", keywords: ["poverty", "social protection"] },
  { n: 2, en: "Zero Hunger", ar: "القضاء التام على الجوع", colour: "#DDA63A", category: "human", entity: "Ministry of Municipality", keywords: ["food security", "nutrition", "agriculture"] },
  { n: 3, en: "Good Health and Well-being", ar: "الصحة الجيدة والرفاه", colour: "#4C9F38", category: "human", entity: "Ministry of Public Health", keywords: ["health", "healthy"] },
  { n: 4, en: "Quality Education", ar: "التعليم الجيد", colour: "#C5192D", category: "human", entity: "Ministry of Education and Higher Education", keywords: ["education", "learning", "students"] },
  { n: 5, en: "Gender Equality", ar: "المساواة بين الجنسين", colour: "#FF3A21", category: "human", entity: "Ministry of Social Development and Family", keywords: ["women", "gender"] },
  { n: 6, en: "Clean Water and Sanitation", ar: "المياه النظيفة والنظافة الصحية", colour: "#26BDE2", category: "environment", entity: "Qatar General Electricity and Water Corporation (Kahramaa)", keywords: ["water", "sanitation"] },
  { n: 7, en: "Affordable and Clean Energy", ar: "طاقة نظيفة وبأسعار معقولة", colour: "#FCC30B", category: "environment", entity: "QatarEnergy", keywords: ["energy", "renewable", "solar"] },
  { n: 8, en: "Decent Work and Economic Growth", ar: "العمل اللائق ونمو الاقتصاد", colour: "#A21942", category: "economy", entity: "Ministry of Labour", keywords: ["employment", "economic growth", "labour"] },
  { n: 9, en: "Industry, Innovation and Infrastructure", ar: "الصناعة والابتكار والهياكل الأساسية", colour: "#FD6925", category: "economy", entity: "Ministry of Communications and Information Technology", keywords: ["infrastructure", "innovation", "industry"] },
  { n: 10, en: "Reduced Inequalities", ar: "الحد من أوجه عدم المساواة", colour: "#DD1367", category: "human", entity: "Ministry of Social Development and Family", keywords: ["inequality", "inclusion", "inclusive"] },
  { n: 11, en: "Sustainable Cities and Communities", ar: "مدن ومجتمعات محلية مستدامة", colour: "#FD9D24", category: "society", entity: "Ministry of Municipality", keywords: ["cities", "urban", "housing", "transport"] },
  { n: 12, en: "Responsible Consumption and Production", ar: "الاستهلاك والإنتاج المسؤولان", colour: "#BF8B2E", category: "environment", entity: "Ministry of Environment and Climate Change", keywords: ["consumption", "waste", "recycling"] },
  { n: 13, en: "Climate Action", ar: "العمل المناخي", colour: "#3F7E44", category: "environment", entity: "Ministry of Environment and Climate Change", keywords: ["climate", "emissions"] },
  { n: 14, en: "Life Below Water", ar: "الحياة تحت الماء", colour: "#0A97D9", category: "environment", entity: "Ministry of Environment and Climate Change", keywords: ["marine", "fisheries", "coastal"] },
  { n: 15, en: "Life on Land", ar: "الحياة في البر", colour: "#56C02B", category: "environment", entity: "Ministry of Environment and Climate Change", keywords: ["biodiversity", "land", "ecosystem"] },
  { n: 16, en: "Peace, Justice and Strong Institutions", ar: "السلام والعدل والمؤسسات القوية", colour: "#00689D", category: "governance", entity: "Ministry of Justice", keywords: ["justice", "institutions", "governance"] },
  { n: 17, en: "Partnerships for the Goals", ar: "عقد الشراكات لتحقيق الأهداف", colour: "#19486A", category: "governance", entity: "Ministry of Foreign Affairs", keywords: ["partnership", "international cooperation"] },
];

const sdgGoalDefs: Cr08IndexDef[] = SDG_GOALS.map((g) => ({
  code: `sdg_${String(g.n).padStart(2, "0")}`,
  nameEn: `SDG ${g.n}: ${g.en}`,
  nameAr: `الهدف ${g.n}: ${g.ar}`,
  ...SDSN,
  methodologyEn: `Goal ${g.n} score of the Sustainable Development Report's SDG Index: the average of the goal's normalized indicators on a 0 to 100 scale, 100 meaning the SDG target is met. Published for every UN member state with data, annually; no goal-level rank is published.`,
  methodologyAr: `درجة الهدف ${g.n} (${g.ar}) في مؤشر أهداف التنمية المستدامة الصادر عن شبكة حلول التنمية المستدامة: متوسط المؤشرات المعيارية للهدف على مقياس من 0 إلى 100، حيث تعني 100 بلوغ الغاية الأممية. تُنشر سنويًا لكل دولة عضو تتوافر لها بيانات، من دون ترتيب على مستوى الهدف.`,
  scale: "score",
  scoreMin: 0,
  scoreMax: 100,
  higherIsBetter: true,
  category: g.category,
  responsibleEntityName: g.entity,
  linkedTargetKeywords: g.keywords,
  sourceNotes:
    "Edition databases of the Sustainable Development Report 2020 to 2026 (the 2026 file from the live download, 2022 to 2025 from Wayback copies of the publisher's files, 2021 from the SDSN GitHub repository, 2020 from sdsna.github.io); goal ranks are derived by sorting the official goal scores, as CR05 does for HDI.",
  groups: ["sdg"],
  sdgGoal: g.n,
  sdgColour: g.colour,
  forecastMode: "score",
  forecastEnabled: true,
  researchFile: `cr08-sdg_${String(g.n).padStart(2, "0")}.json`,
}));

/* ------------------------------------------------------------------ */
/* the list                                                             */
/* ------------------------------------------------------------------ */

export const CR08_INDEX_DEFS_A: Cr08IndexDef[] = [
  /* SDGs */
  {
    code: "sdg_index",
    nameEn: "SDG Index",
    nameAr: "مؤشر أهداف التنمية المستدامة",
    ...SDSN,
    methodologyEn:
      "Overall score of the Sustainable Development Report's SDG Index: the average of the 17 goal scores, each an average of normalized indicators on a 0 to 100 scale where 100 means the SDG target is reached, for every UN member state with sufficient data (about 167). Annual, with a published rank.",
    methodologyAr:
      "الدرجة الكلية لمؤشر أهداف التنمية المستدامة في تقرير التنمية المستدامة: متوسط درجات الأهداف السبعة عشر، وكل منها متوسط مؤشرات معيارية على مقياس من 0 إلى 100 حيث تعني 100 بلوغ الغاية الأممية، لكل دولة عضو في الأمم المتحدة تتوافر لها بيانات كافية (نحو 167 دولة). يصدر سنويًا مع ترتيب منشور.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 100,
    higherIsBetter: true,
    category: "society",
    responsibleEntityName: "Planning and Statistics Authority",
    linkedTargetKeywords: ["sustainable development", "sustainability", "sdg"],
    sourceNotes:
      "Full ranked field of editions 2020 to 2026 from the publisher's edition databases (2026 live download; 2022 to 2025 Wayback copies of the publisher's files, cited as read; 2021 SDSN GitHub; 2020 sdsna.github.io). Qatar: 2020 rank 103, 2021 94, 2022 94, 2023 100, 2024 102, 2025 107, 2026 101.",
    groups: ["sdg"],
    forecastMode: "score",
    forecastEnabled: true,
    researchFile: "cr08-sdg_index.json",
  },
  ...sdgGoalDefs,

  /* Gallup */
  {
    code: "gallup_law_order",
    nameEn: "Gallup Law and Order Index",
    nameAr: "مؤشر غالوب للقانون والنظام",
    ...GALLUP,
    publisherUrl: "https://www.gallup.com/analytics/356963/gallup-global-law-and-order-report.aspx",
    methodologyEn:
      "Composite 0 to 100 score from four Gallup World Poll questions: confidence in the local police, feeling safe walking alone at night, and whether money or property was stolen or the respondent was assaulted in the past year. Higher means more of the population feels secure; about 140 countries a year.",
    methodologyAr:
      "درجة مركبة من 0 إلى 100 مبنية على أربعة أسئلة في استطلاع غالوب العالمي: الثقة في الشرطة المحلية، والشعور بالأمان عند السير منفردًا ليلًا، والتعرض للسرقة أو الاعتداء خلال العام الماضي. كلما ارتفعت الدرجة زادت نسبة السكان الذين يشعرون بالأمان؛ يغطي نحو 140 دولة سنويًا.",
    scale: "score",
    scoreMin: 0,
    scoreMax: 100,
    higherIsBetter: true,
    responsibleEntityName: "Ministry of Interior",
    linkedTargetKeywords: ["security", "safety", "police"],
    sourceNotes:
      "Full country tables of the official report PDFs (Global Law and Order 2019 to 2023, Global Safety 2024 and 2025), survey years 2018 to 2024. Gallup lists no Qatar value in any of these reports; Qatar stays missing (recorded honestly).",
    groups: ["gallup"],
    forecastMode: "score",
    forecastEnabled: false,
    researchFile: "cr08-gallup_law_order.json",
  },
  {
    code: "gallup_safe_night",
    nameEn: "Gallup: Feel Safe Walking Alone at Night",
    nameAr: "غالوب: الشعور بالأمان عند السير منفردًا ليلًا",
    ...GALLUP,
    publisherUrl: "https://www.gallup.com/analytics/356996/gallup-global-safety-research-center.aspx",
    methodologyEn:
      "Share of adults who answer yes to 'Do you feel safe walking alone at night in the city or area where you live?' in the Gallup World Poll, the measure Gallup reports for SDG 16. About 140 countries a year.",
    methodologyAr:
      "نسبة البالغين الذين يجيبون بنعم عن سؤال: هل تشعر بالأمان عند السير منفردًا ليلًا في المدينة أو المنطقة التي تعيش فيها؟ في استطلاع غالوب العالمي، وهو المقياس الذي تعتمده غالوب للهدف 16 من أهداف التنمية المستدامة. يغطي نحو 140 دولة سنويًا.",
    scale: "score",
    scoreMin: 0,
    scoreMax: 100,
    higherIsBetter: true,
    responsibleEntityName: "Ministry of Interior",
    linkedTargetKeywords: ["safety", "security", "cohesive society"],
    sourceNotes:
      "2024: the full table of the 2025 Global Safety Report; 2020 to 2023: only the countries Gallup listed among the safest and least safe in each report. No Qatar value is published.",
    groups: ["gallup"],
    forecastMode: "score",
    forecastEnabled: false,
    researchFile: "cr08-gallup_safe_night.json",
  },
  {
    code: "gallup_positive",
    nameEn: "Gallup Positive Experience Index",
    nameAr: "مؤشر غالوب للتجارب الإيجابية",
    ...GALLUP,
    publisherUrl: "https://www.gallup.com/analytics/349280/state-of-worlds-emotional-health.aspx",
    methodologyEn:
      "Mean share of yes answers to five questions about the previous day (felt well-rested, treated with respect, smiled or laughed a lot, learned or did something interesting, experienced enjoyment), 0 to 100. Published in the annual Global Emotions report.",
    methodologyAr:
      "متوسط نسبة الإجابات بنعم عن خمسة أسئلة عن اليوم السابق (الشعور بالراحة بعد النوم، والمعاملة باحترام، والابتسام أو الضحك كثيرًا، وتعلم شيء مثير للاهتمام أو القيام به، والاستمتاع)، على مقياس من 0 إلى 100. يُنشر في تقرير المشاعر العالمية السنوي.",
    scale: "score",
    scoreMin: 0,
    scoreMax: 100,
    higherIsBetter: true,
    responsibleEntityName: "Ministry of Public Health",
    linkedTargetKeywords: ["wellbeing", "quality of life", "happiness"],
    sourceNotes:
      "Gallup prints only the highest and lowest countries in each Global Emotions report (no full table); stored: every listed country, survey years 2018 to 2023. No Qatar value is published.",
    groups: ["gallup"],
    forecastMode: "score",
    forecastEnabled: false,
    researchFile: "cr08-gallup_positive.json",
  },
  {
    code: "gallup_negative",
    nameEn: "Gallup Negative Experience Index",
    nameAr: "مؤشر غالوب للتجارب السلبية",
    ...GALLUP,
    publisherUrl: "https://www.gallup.com/analytics/349280/state-of-worlds-emotional-health.aspx",
    methodologyEn:
      "Mean share of yes answers to five questions about the previous day (physical pain, worry, sadness, stress, anger), 0 to 100; lower is better. Published in the annual Global Emotions report.",
    methodologyAr:
      "متوسط نسبة الإجابات بنعم عن خمسة أسئلة عن اليوم السابق (الألم الجسدي، والقلق، والحزن، والتوتر، والغضب)، على مقياس من 0 إلى 100؛ الأدنى أفضل. يُنشر في تقرير المشاعر العالمية السنوي.",
    scale: "score",
    scoreMin: 0,
    scoreMax: 100,
    higherIsBetter: false,
    responsibleEntityName: "Ministry of Public Health",
    linkedTargetKeywords: ["wellbeing", "mental health", "quality of life"],
    sourceNotes:
      "Gallup prints only the highest and lowest countries in each Global Emotions report (no full table); stored: every listed country, survey years 2018 to 2023. No Qatar value is published.",
    groups: ["gallup"],
    forecastMode: "score",
    forecastEnabled: false,
    researchFile: "cr08-gallup_negative.json",
  },
  {
    code: "gallup_life_eval",
    nameEn: "Gallup Life Evaluation Index (thriving)",
    nameAr: "مؤشر غالوب لتقييم الحياة (نسبة المزدهرين)",
    ...GALLUP,
    publisherUrl: "https://www.gallup.com/394505/indicator-life-evaluation-index.aspx",
    methodologyEn:
      "Share of adults classified as thriving: they rate their current life 7 or higher and their life in five years 8 or higher on the 0 to 10 Cantril ladder in the Gallup World Poll.",
    methodologyAr:
      "نسبة البالغين المصنفين مزدهرين: من يقيّمون حياتهم الحالية بسبع درجات فأكثر وحياتهم بعد خمس سنوات بثماني درجات فأكثر على سلم كانتريل من 0 إلى 10 في استطلاع غالوب العالمي.",
    scale: "score",
    scoreMin: 0,
    scoreMax: 100,
    higherIsBetter: true,
    responsibleEntityName: "Ministry of Public Health",
    linkedTargetKeywords: ["wellbeing", "quality of life", "happiness"],
    sourceNotes:
      "Country values sit inside Gallup's paid World Poll; the only public Qatar figure is 56 percent of Qatari nationals thriving in 2010 (Gallup, Life Evaluations in the GCC). Nothing later is published for Qatar.",
    groups: ["gallup"],
    forecastMode: "score",
    forecastEnabled: false,
    researchFile: "cr08-gallup_life_eval.json",
  },

  /* Human Development and Society (hdi already exists) */
  {
    code: "gender_inequality",
    nameEn: "Gender Inequality Index",
    nameAr: "مؤشر عدم المساواة بين الجنسين",
    publisher: "UNDP",
    publisherUrl: "https://hdr.undp.org/data-center/thematic-composite-indices/gender-inequality-index",
    methodologyEn:
      "Composite of reproductive health (maternal mortality, adolescent births), empowerment (parliamentary seats and secondary education by sex) and labour-market participation by sex; 0 means women and men fare equally, 1 the worst inequality. Annual, with the Human Development Report.",
    methodologyAr:
      "مؤشر مركب من الصحة الإنجابية (وفيات الأمهات وولادات المراهقات)، والتمكين (المقاعد البرلمانية والتعليم الثانوي بحسب الجنس)، والمشاركة في سوق العمل بحسب الجنس؛ يعني الصفر تساوي المرأة والرجل، والواحد أسوأ درجات عدم المساواة. يصدر سنويًا مع تقرير التنمية البشرية.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 1,
    higherIsBetter: false,
    frequency: "annual",
    category: "human",
    responsibleEntityName: "Ministry of Social Development and Family",
    linkedTargetKeywords: ["women", "gender", "female"],
    sourceNotes:
      "HDR 2025 composite indices time series (the CR05 HDI file), data years 2010 to 2023; the 2023 rank is published, earlier ranks are derived by sorting the official values.",
    groups: ["human"],
    forecastMode: "score",
    forecastEnabled: true,
    researchFile: "cr08-gender_inequality.json",
  },
  {
    code: "gender_gap",
    nameEn: "Global Gender Gap Index",
    nameAr: "مؤشر الفجوة العالمية بين الجنسين",
    publisher: "World Economic Forum",
    publisherUrl: "https://www.weforum.org/publications/series/global-gender-gap-report/",
    methodologyEn:
      "Benchmarks the gap between women and men across four subindexes (economic participation and opportunity, educational attainment, health and survival, political empowerment) on a 0 to 1 scale where 1 is parity; about 146 economies, annual.",
    methodologyAr:
      "يقيس الفجوة بين المرأة والرجل عبر أربعة مؤشرات فرعية (المشاركة الاقتصادية والفرص، والتحصيل التعليمي، والصحة والبقاء، والتمكين السياسي) على مقياس من 0 إلى 1 حيث يعني الواحد التكافؤ التام؛ يغطي نحو 146 اقتصادًا ويصدر سنويًا.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 1,
    higherIsBetter: true,
    frequency: "annual",
    category: "human",
    responsibleEntityName: "Ministry of Social Development and Family",
    linkedTargetKeywords: ["women", "gender", "female participation"],
    sourceNotes:
      "Official report PDFs 2021 to 2025, full field (Table 1.1; the 2025 table is graphics-only so its values are read from the report's regional tables). Qatar covered 2021 to 2024 (rank 130 of 146 in 2024) and absent from the 2025 edition.",
    groups: ["human"],
    forecastMode: "score",
    forecastEnabled: true,
    researchFile: "cr08-gender_gap.json",
  },
  {
    code: "happiness",
    nameEn: "World Happiness Report",
    nameAr: "تقرير السعادة العالمي",
    publisher: "Wellbeing Research Centre, University of Oxford",
    publisherUrl: "https://worldhappiness.report/",
    methodologyEn:
      "National average of the Cantril ladder life evaluation (0 to 10) from the Gallup World Poll, averaged over the three years before each report, with a ranking of every country surveyed. Annual; year is the report edition.",
    methodologyAr:
      "المتوسط الوطني لتقييم الحياة على سلم كانتريل (من 0 إلى 10) في استطلاع غالوب العالمي، محسوبًا على السنوات الثلاث السابقة لكل تقرير، مع ترتيب لكل الدول المشمولة. يصدر سنويًا، والسنة هي سنة إصدار التقرير.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 10,
    higherIsBetter: true,
    frequency: "annual",
    category: "society",
    responsibleEntityName: "Ministry of Social Development and Family",
    linkedTargetKeywords: ["wellbeing", "quality of life", "happiness"],
    sourceNotes:
      "Publisher's WHR 2026 Figure 2.1 data file (every edition's ranking since 2012), cross-checked against the WHR 2020 to 2025 edition files with zero mismatches. Qatar was last ranked in the 2019 edition (29 of 156, 6.374); Gallup has not polled Qatar since, so forecasting is off.",
    groups: ["human"],
    forecastMode: "score",
    forecastEnabled: false,
    researchFile: "cr08-happiness.json",
  },
  {
    code: "social_progress",
    nameEn: "Social Progress Index",
    nameAr: "مؤشر التقدم الاجتماعي",
    publisher: "Social Progress Imperative",
    publisherUrl: "https://www.socialprogress.org/social-progress-index",
    methodologyEn:
      "Aggregates 57 social and environmental outcome indicators (no economic inputs) into Basic Human Needs, Foundations of Wellbeing and Opportunity, scored 0 to 100 for about 170 countries. Annual; the 2025 edition was published as the AlTi Global Social Progress Index.",
    methodologyAr:
      "يجمع 57 مؤشرًا لنتائج اجتماعية وبيئية (من دون مدخلات اقتصادية) في ثلاثة أبعاد: الاحتياجات الإنسانية الأساسية، وأسس الرفاه، والفرص، بدرجة من 0 إلى 100 لنحو 170 دولة. يصدر سنويًا؛ وصدرت نسخة 2025 باسم مؤشر AlTi العالمي للتقدم الاجتماعي.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 100,
    higherIsBetter: true,
    frequency: "annual",
    category: "society",
    responsibleEntityName: "Ministry of Social Development and Family",
    linkedTargetKeywords: ["quality of life", "wellbeing", "social"],
    sourceNotes:
      "2025: full ranking from the publisher's report PDF (Qatar 50 of 170, 73.19). 2026: only the ranks the publisher's press release states (no scores; Qatar not stated). Earlier editions sit behind the publisher's premium access. Forecasting off until a second scored edition is public.",
    groups: ["human"],
    forecastMode: "score",
    forecastEnabled: false,
    researchFile: "cr08-social_progress.json",
  },

  /* Governance and Institutions (cpi, wjp, egdi already exist) */
  {
    code: "wgi_voice",
    nameEn: "WGI: Voice and Accountability",
    nameAr: "مؤشرات الحوكمة العالمية: الصوت والمساءلة",
    ...WGI,
    methodologyEn:
      "Worldwide Governance Indicators: perceptions of the extent to which citizens can take part in selecting their government, and of freedom of expression, association and the media. Aggregated from many sources; the score is the published percentile rank (0 to 100), the estimate (about -2.5 to +2.5) is kept alongside. Annual, about 214 economies.",
    methodologyAr:
      "مؤشرات الحوكمة العالمية: مدركات مدى قدرة المواطنين على المشاركة في اختيار حكومتهم، وحرية التعبير وتكوين الجمعيات والإعلام. يُجمع من مصادر عديدة؛ الدرجة هي الرتبة المئوية المنشورة (من 0 إلى 100) ويُحفظ التقدير (من نحو -2.5 إلى +2.5) إلى جانبها. يصدر سنويًا ويغطي نحو 214 اقتصادًا.",
    responsibleEntityName: "Ministry of Justice",
    linkedTargetKeywords: ["governance", "participation", "transparency"],
    sourceNotes: "Official 2025 update workbook, data years 2010 to 2024, full field; ordinal ranks derived by sorting the published estimates.",
    researchFile: "cr08-wgi_voice.json",
  },
  {
    code: "wgi_stability",
    nameEn: "WGI: Political Stability and Absence of Violence",
    nameAr: "مؤشرات الحوكمة العالمية: الاستقرار السياسي وغياب العنف",
    ...WGI,
    methodologyEn:
      "Worldwide Governance Indicators: perceptions of the likelihood of political instability and politically motivated violence, including terrorism. The score is the published percentile rank (0 to 100). Annual, about 214 economies.",
    methodologyAr:
      "مؤشرات الحوكمة العالمية: مدركات احتمال عدم الاستقرار السياسي والعنف ذي الدوافع السياسية بما فيه الإرهاب. الدرجة هي الرتبة المئوية المنشورة (من 0 إلى 100). يصدر سنويًا ويغطي نحو 214 اقتصادًا.",
    responsibleEntityName: "Ministry of Interior",
    linkedTargetKeywords: ["security", "stability", "safety"],
    sourceNotes: "Official 2025 update workbook, data years 2010 to 2024, full field; ordinal ranks derived by sorting the published estimates.",
    researchFile: "cr08-wgi_stability.json",
  },
  {
    code: "wgi_effectiveness",
    nameEn: "WGI: Government Effectiveness",
    nameAr: "مؤشرات الحوكمة العالمية: فعالية الحكومة",
    ...WGI,
    methodologyEn:
      "Worldwide Governance Indicators: perceptions of the quality of public services and the civil service, its independence from political pressure, the quality of policy formulation and implementation, and the credibility of the government's commitment to its policies. The score is the published percentile rank (0 to 100). Annual, about 214 economies.",
    methodologyAr:
      "مؤشرات الحوكمة العالمية: مدركات جودة الخدمات العامة والخدمة المدنية واستقلالها عن الضغوط السياسية، وجودة صياغة السياسات وتنفيذها، ومصداقية التزام الحكومة بسياساتها. الدرجة هي الرتبة المئوية المنشورة (من 0 إلى 100). يصدر سنويًا ويغطي نحو 214 اقتصادًا.",
    responsibleEntityName: "Civil Service and Government Development Bureau",
    linkedTargetKeywords: ["government excellence", "public services", "efficiency"],
    sourceNotes: "Official 2025 update workbook, data years 2010 to 2024, full field; ordinal ranks derived by sorting the published estimates.",
    researchFile: "cr08-wgi_effectiveness.json",
  },
  {
    code: "wgi_regulatory",
    nameEn: "WGI: Regulatory Quality",
    nameAr: "مؤشرات الحوكمة العالمية: جودة التنظيم",
    ...WGI,
    methodologyEn:
      "Worldwide Governance Indicators: perceptions of the government's ability to formulate and implement sound policies and regulations that permit and promote private-sector development. The score is the published percentile rank (0 to 100). Annual, about 214 economies.",
    methodologyAr:
      "مؤشرات الحوكمة العالمية: مدركات قدرة الحكومة على صياغة سياسات ولوائح سليمة تتيح تنمية القطاع الخاص وتعززها وتنفيذها. الدرجة هي الرتبة المئوية المنشورة (من 0 إلى 100). يصدر سنويًا ويغطي نحو 214 اقتصادًا.",
    responsibleEntityName: "Ministry of Commerce and Industry",
    linkedTargetKeywords: ["business environment", "regulation", "private sector"],
    sourceNotes: "Official 2025 update workbook, data years 2010 to 2024, full field; ordinal ranks derived by sorting the published estimates.",
    researchFile: "cr08-wgi_regulatory.json",
  },
  {
    code: "wgi_rule_of_law",
    nameEn: "WGI: Rule of Law",
    nameAr: "مؤشرات الحوكمة العالمية: سيادة القانون",
    ...WGI,
    methodologyEn:
      "Worldwide Governance Indicators: perceptions of confidence in and abidance by the rules of society, in particular contract enforcement, property rights, the police and the courts, and the likelihood of crime and violence. The score is the published percentile rank (0 to 100). Annual, about 214 economies.",
    methodologyAr:
      "مؤشرات الحوكمة العالمية: مدركات الثقة في قواعد المجتمع والالتزام بها، ولا سيما إنفاذ العقود وحقوق الملكية والشرطة والمحاكم، واحتمال الجريمة والعنف. الدرجة هي الرتبة المئوية المنشورة (من 0 إلى 100). يصدر سنويًا ويغطي نحو 214 اقتصادًا.",
    responsibleEntityName: "Ministry of Justice",
    linkedTargetKeywords: ["rule of law", "justice", "governance"],
    sourceNotes: "Official 2025 update workbook, data years 2010 to 2024, full field; ordinal ranks derived by sorting the published estimates.",
    researchFile: "cr08-wgi_rule_of_law.json",
  },
  {
    code: "wgi_corruption",
    nameEn: "WGI: Control of Corruption",
    nameAr: "مؤشرات الحوكمة العالمية: مكافحة الفساد",
    ...WGI,
    methodologyEn:
      "Worldwide Governance Indicators: perceptions of the extent to which public power is exercised for private gain, including petty and grand corruption and capture of the state by elites and private interests. The score is the published percentile rank (0 to 100). Annual, about 214 economies.",
    methodologyAr:
      "مؤشرات الحوكمة العالمية: مدركات مدى استغلال السلطة العامة لتحقيق مكاسب خاصة، بما في ذلك الفساد الصغير والكبير واستحواذ النخب والمصالح الخاصة على الدولة. الدرجة هي الرتبة المئوية المنشورة (من 0 إلى 100). يصدر سنويًا ويغطي نحو 214 اقتصادًا.",
    responsibleEntityName: "Ministry of Justice",
    linkedTargetKeywords: ["integrity", "transparency", "corruption"],
    sourceNotes: "Official 2025 update workbook, data years 2010 to 2024, full field; ordinal ranks derived by sorting the published estimates.",
    researchFile: "cr08-wgi_corruption.json",
  },
];

/** Group memberships of indices that CR05 already defines (the seed maps them). */
export const CR08_EXISTING_MEMBERSHIPS_A: { code: string; groups: string[] }[] = [
  { code: "hdi", groups: ["human"] },
  { code: "cpi", groups: ["governance"] },
  { code: "wjp", groups: ["governance"] },
  { code: "egdi", groups: ["governance"] },
];
