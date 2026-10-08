// CR08 4.1: index definitions for the SDGs, Human Development and Society
// (Social Progress) and Governance and Institutions groups (research agent
// A), re-targeted to the Saudi environment, water and agriculture benchmark.
// The climate performance index lives in defs-cr08-b.ts and the
// water, agriculture and climate additions in defs-ksa.ts. Every def names the research file that carries its real
// published observations (sources/indices/research/cr08-<code>.json, one
// file per index, the CR05 research-file shape) so the fetcher's research
// loader can pick it up next to the CR05 <code>.extracted.json files.
//
// Membership of indices that already exist in INDEX_DEFS (the seed maps
// these, they are not redefined here): hdi -> human; cpi ->
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
  { n: 1, en: "No Poverty", ar: "القضاء على الفقر", colour: "#E5243B", category: "human", entity: "Ministry of Human Resources and Social Development", keywords: ["poverty", "social protection"] },
  { n: 2, en: "Zero Hunger", ar: "القضاء التام على الجوع", colour: "#DDA63A", category: "human", entity: "Ministry of Environment, Water and Agriculture", keywords: ["food security", "nutrition", "agriculture"] },
  { n: 3, en: "Good Health and Well-being", ar: "الصحة الجيدة والرفاه", colour: "#4C9F38", category: "human", entity: "Ministry of Health", keywords: ["health", "healthy"] },
  { n: 4, en: "Quality Education", ar: "التعليم الجيد", colour: "#C5192D", category: "human", entity: "Ministry of Education", keywords: ["education", "learning", "students"] },
  { n: 5, en: "Gender Equality", ar: "المساواة بين الجنسين", colour: "#FF3A21", category: "human", entity: "Ministry of Human Resources and Social Development", keywords: ["women", "gender"] },
  { n: 6, en: "Clean Water and Sanitation", ar: "المياه النظيفة والنظافة الصحية", colour: "#26BDE2", category: "environment", entity: "Ministry of Environment, Water and Agriculture", keywords: ["water", "sanitation"] },
  { n: 7, en: "Affordable and Clean Energy", ar: "طاقة نظيفة وبأسعار معقولة", colour: "#FCC30B", category: "environment", entity: "Ministry of Energy", keywords: ["energy", "renewable", "solar"] },
  { n: 8, en: "Decent Work and Economic Growth", ar: "العمل اللائق ونمو الاقتصاد", colour: "#A21942", category: "economy", entity: "Ministry of Human Resources and Social Development", keywords: ["employment", "economic growth", "labour"] },
  { n: 9, en: "Industry, Innovation and Infrastructure", ar: "الصناعة والابتكار والهياكل الأساسية", colour: "#FD6925", category: "economy", entity: "Ministry of Industry and Mineral Resources", keywords: ["infrastructure", "innovation", "industry"] },
  { n: 10, en: "Reduced Inequalities", ar: "الحد من أوجه عدم المساواة", colour: "#DD1367", category: "human", entity: "Ministry of Human Resources and Social Development", keywords: ["inequality", "inclusion", "inclusive"] },
  { n: 11, en: "Sustainable Cities and Communities", ar: "مدن ومجتمعات محلية مستدامة", colour: "#FD9D24", category: "society", entity: "Ministry of Municipal, Rural Affairs and Housing", keywords: ["cities", "urban", "housing", "transport"] },
  { n: 12, en: "Responsible Consumption and Production", ar: "الاستهلاك والإنتاج المسؤولان", colour: "#BF8B2E", category: "environment", entity: "National Center for Waste Management", keywords: ["consumption", "waste", "recycling"] },
  { n: 13, en: "Climate Action", ar: "العمل المناخي", colour: "#3F7E44", category: "environment", entity: "Ministry of Environment, Water and Agriculture", keywords: ["climate", "emissions"] },
  { n: 14, en: "Life Below Water", ar: "الحياة تحت الماء", colour: "#0A97D9", category: "environment", entity: "National Center for Wildlife", keywords: ["marine", "fisheries", "coastal"] },
  { n: 15, en: "Life on Land", ar: "الحياة في البر", colour: "#56C02B", category: "environment", entity: "National Center for Vegetation Cover Development and Combating Desertification", keywords: ["biodiversity", "land", "ecosystem"] },
  { n: 16, en: "Peace, Justice and Strong Institutions", ar: "السلام والعدل والمؤسسات القوية", colour: "#00689D", category: "governance", entity: "Ministry of Justice", keywords: ["justice", "institutions", "governance"] },
  { n: 17, en: "Partnerships for the Goals", ar: "عقد الشراكات لتحقيق الأهداف", colour: "#19486A", category: "governance", entity: "Ministry of Foreign Affairs", keywords: ["partnership", "international cooperation"] },
];

// the goals that also belong to a thematic group of the Saudi benchmark
const SDG_EXTRA_GROUPS: Record<number, string[]> = {
  2: ["agriculture"],
  6: ["water"],
  7: ["climate"],
  12: ["environment"],
  13: ["climate"],
  14: ["environment"],
  15: ["environment", "agriculture"],
};

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
  groups: ["sdg", ...(SDG_EXTRA_GROUPS[g.n] ?? [])],
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
    responsibleEntityName: "General Authority for Statistics",
    linkedTargetKeywords: ["sustainable development", "sustainability", "sdg"],
    sourceNotes:
      "Full ranked field of editions 2020 to 2026 from the publisher's edition databases (2026 live download; 2022 to 2025 Wayback copies of the publisher's files, cited as read; 2021 SDSN GitHub; 2020 sdsna.github.io). Saudi Arabia is read from the same files.",
    groups: ["sdg"],
    forecastMode: "score",
    forecastEnabled: true,
    researchFile: "cr08-sdg_index.json",
  },
  ...sdgGoalDefs,

  /* Human Development and Society (hdi already exists) */
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
    responsibleEntityName: "General Authority for Statistics",
    linkedTargetKeywords: ["quality of life", "wellbeing", "social"],
    sourceNotes:
      "2025: full ranking from the publisher's report PDF (every ranked country). 2026: only the ranks the publisher's press release states (no scores). Earlier editions sit behind the publisher's premium access. Forecasting off until a second scored edition is public.",
    groups: ["human"],
    forecastMode: "score",
    forecastEnabled: false,
    researchFile: "cr08-social_progress.json",
  },

  /* Governance and Institutions (cpi already exists) */
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
    responsibleEntityName: "Ministry of Economy and Planning",
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
    responsibleEntityName: "Ministry of Commerce",
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
];
