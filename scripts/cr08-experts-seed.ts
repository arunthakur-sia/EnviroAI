/* eslint-disable no-console */
// CR08 3: external experts (type, organisation, availability, country,
// engagements) so the External Experts view has real rows. Owned by the
// Experts agent. Idempotent: an expert is keyed by its English name; the
// country backfill touches only rows whose country is still null; the unit
// check assigns a department only to an internal expert whose user has none.
//
// Every profile below is fictional and clearly illustrative (the bio says so);
// the organisations are real institutions NPC works with.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { and, eq, inArray, isNull } from "drizzle-orm";
import { ulid } from "ulid";

const now = () => new Date().toISOString();

type Engagement = {
  title: string;
  year: number;
  role: string;
  outcomeEn: string;
  outcomeAr: string;
  rating?: number;
  unit?: string;
};

type ExternalExpert = {
  nameEn: string;
  nameAr: string;
  type: "government" | "academic" | "consultant" | "international";
  organisationEn: string;
  organisationAr: string;
  positionEn: string;
  positionAr: string;
  country: string;
  nationality: string;
  availability: "available" | "limited" | "unavailable";
  yearsExperience: number;
  languages: string[];
  bioEn: string;
  bioAr: string;
  domains: string[];
  skills?: string[];
  education?: { degree: string; institution: string; year: number | null }[];
  engagements: Engagement[];
  verified: boolean;
  avatarColor: "gulf" | "gold" | "maroon";
};

const ILLUSTRATIVE_EN = " Illustrative profile for the SiaNexus prototype.";
const ILLUSTRATIVE_AR = " ملف تعريفي توضيحي لنموذج سيا نكسس الأولي.";

const EXTERNALS: ExternalExpert[] = [
  /* ---- academia ---- */
  {
    nameEn: "Dr. Noora Al-Kuwari",
    nameAr: "د. نورة الكواري",
    type: "academic",
    organisationEn: "Qatar University",
    organisationAr: "جامعة قطر",
    positionEn: "Associate Professor of Economics",
    positionAr: "أستاذ مشارك في الاقتصاد",
    country: "QA",
    nationality: "Qatari",
    availability: "available",
    yearsExperience: 14,
    languages: ["Arabic", "English"],
    bioEn:
      "Researches economic diversification and productivity measurement in hydrocarbon economies, with published work on non-oil growth accounting for the GCC. Advises on the indicators behind the NDS3 diversification targets." +
      ILLUSTRATIVE_EN,
    bioAr:
      "تبحث في التنويع الاقتصادي وقياس الإنتاجية في الاقتصادات الهيدروكربونية، ولها أعمال منشورة في محاسبة النمو غير النفطي لدول مجلس التعاون. تقدم المشورة في مؤشرات أهداف التنويع في استراتيجية التنمية الوطنية الثالثة." +
      ILLUSTRATIVE_AR,
    domains: ["economic_diversification", "national_accounts", "labour_market"],
    skills: ["Growth accounting", "Panel econometrics"],
    education: [{ degree: "PhD Economics", institution: "London School of Economics", year: 2012 }],
    engagements: [
      {
        title: "Review of the non-oil GDP contribution indicators",
        year: 2024,
        role: "Technical reviewer",
        outcomeEn: "Indicator definitions aligned with the SNA 2008 treatment of non-oil sectors",
        outcomeAr: "مواءمة تعريفات المؤشرات مع معالجة نظام الحسابات القومية 2008 للقطاعات غير النفطية",
        rating: 5,
        unit: "EDP",
      },
      {
        title: "Diversification index methodology workshop",
        year: 2023,
        role: "Lead facilitator",
        outcomeEn: "Composite index weights agreed with the Economic Development Planning team",
        outcomeAr: "الاتفاق على أوزان المؤشر المركب مع فريق تخطيط التنمية الاقتصادية",
        rating: 4,
        unit: "EDP",
      },
    ],
    verified: true,
    avatarColor: "gulf",
  },
  {
    nameEn: "Dr. Khalid Al-Marri",
    nameAr: "د. خالد المري",
    type: "academic",
    organisationEn: "Qatar University, Social and Economic Survey Research Institute",
    organisationAr: "جامعة قطر، معهد البحوث الاجتماعية والاقتصادية المسحية",
    positionEn: "Professor of Survey Methodology",
    positionAr: "أستاذ منهجيات المسوح",
    country: "QA",
    nationality: "Qatari",
    availability: "limited",
    yearsExperience: 19,
    languages: ["Arabic", "English"],
    bioEn:
      "Leads household survey design and non-response research for Qatar. Long collaboration with the National Statistics Center on sampling frames and mixed-mode collection." +
      ILLUSTRATIVE_EN,
    bioAr:
      "يقود تصميم المسوح الأسرية وبحوث عدم الاستجابة في قطر. تعاون طويل مع المركز الوطني للإحصاء في أطر المعاينة والجمع متعدد الأنماط." +
      ILLUSTRATIVE_AR,
    domains: ["household_surveys", "census_methodology", "social_statistics"],
    skills: ["Sampling design", "Non-response adjustment"],
    education: [{ degree: "PhD Statistics", institution: "University of Michigan", year: 2007 }],
    engagements: [
      {
        title: "Non-response study for the 2025 household expenditure survey",
        year: 2025,
        role: "Principal investigator",
        outcomeEn: "Weighting adjustments adopted; response rate model documented",
        outcomeAr: "اعتماد تعديلات الترجيح وتوثيق نموذج معدل الاستجابة",
        rating: 5,
        unit: "SOA",
      },
    ],
    verified: true,
    avatarColor: "maroon",
  },
  {
    nameEn: "Dr. Layla Al-Thani",
    nameAr: "د. ليلى آل ثاني",
    type: "academic",
    organisationEn: "Hamad Bin Khalifa University, College of Public Policy",
    organisationAr: "جامعة حمد بن خليفة، كلية السياسات العامة",
    positionEn: "Assistant Professor of Public Policy",
    positionAr: "أستاذ مساعد في السياسات العامة",
    country: "QA",
    nationality: "Qatari",
    availability: "available",
    yearsExperience: 8,
    languages: ["Arabic", "English", "French"],
    bioEn:
      "Works on programme evaluation and results-based management in Gulf public administrations, including theory-of-change design for national strategies." +
      ILLUSTRATIVE_EN,
    bioAr:
      "تعمل في تقييم البرامج والإدارة القائمة على النتائج في الإدارات العامة الخليجية، بما في ذلك تصميم نظرية التغيير للاستراتيجيات الوطنية." +
      ILLUSTRATIVE_AR,
    domains: ["evaluation_methods", "results_frameworks", "me_monitoring"],
    skills: ["Theory of change", "Contribution analysis"],
    education: [{ degree: "PhD Public Policy", institution: "Sciences Po", year: 2017 }],
    engagements: [
      {
        title: "Evaluation framework for the NDS3 mid-term review",
        year: 2025,
        role: "Methodological advisor",
        outcomeEn: "Evaluation questions and evidence matrix adopted for the mid-term review",
        outcomeAr: "اعتماد أسئلة التقييم ومصفوفة الأدلة لمراجعة منتصف المدة",
        rating: 4,
        unit: "MIF",
      },
    ],
    verified: true,
    avatarColor: "gold",
  },
  {
    nameEn: "Dr. Reem Al-Sulaiti",
    nameAr: "د. ريم السليطي",
    type: "academic",
    organisationEn: "Qatar Foundation, Research, Development and Innovation",
    organisationAr: "مؤسسة قطر، البحث والتطوير والابتكار",
    positionEn: "Director of Research Programmes",
    positionAr: "مديرة برامج البحث",
    country: "QA",
    nationality: "Qatari",
    availability: "limited",
    yearsExperience: 16,
    languages: ["Arabic", "English"],
    bioEn:
      "Directs national research programmes in foresight and education, and sits on advisory panels on the future of skills in Qatar." +
      ILLUSTRATIVE_EN,
    bioAr:
      "تدير برامج بحثية وطنية في الاستشراف والتعليم، وتشارك في لجان استشارية حول مستقبل المهارات في قطر." +
      ILLUSTRATIVE_AR,
    domains: ["foresight_methods", "scenario_planning", "education_stats"],
    education: [{ degree: "PhD Education Policy", institution: "University College London", year: 2010 }],
    engagements: [],
    verified: true,
    avatarColor: "gulf",
  },

  /* ---- other government entities ---- */
  {
    nameEn: "Eng. Fahad Al-Naimi",
    nameAr: "م. فهد النعيمي",
    type: "government",
    organisationEn: "Ministry of Public Health",
    organisationAr: "وزارة الصحة العامة",
    positionEn: "Director of Health Information Systems",
    positionAr: "مدير نظم المعلومات الصحية",
    country: "QA",
    nationality: "Qatari",
    availability: "available",
    yearsExperience: 17,
    languages: ["Arabic", "English"],
    bioEn:
      "Owns the national health information architecture and the data-sharing agreements that feed the health statistics programme." +
      ILLUSTRATIVE_EN,
    bioAr:
      "يتولى بنية المعلومات الصحية الوطنية واتفاقيات تبادل البيانات التي تغذي برنامج الإحصاءات الصحية." +
      ILLUSTRATIVE_AR,
    domains: ["health_stats", "data_governance", "data_quality"],
    skills: ["Health registries", "Data sharing agreements"],
    engagements: [
      {
        title: "Health statistics data-sharing agreement",
        year: 2024,
        role: "Counterpart lead",
        outcomeEn: "Quarterly registry extracts flowing to the statistics programme",
        outcomeAr: "تدفق مستخرجات السجلات الفصلية إلى برنامج الإحصاءات",
        rating: 5,
        unit: "SOA",
      },
      {
        title: "Data quality review of vital statistics feeds",
        year: 2025,
        role: "Joint reviewer",
        outcomeEn: "Completeness thresholds agreed for births and deaths registration",
        outcomeAr: "الاتفاق على عتبات الاكتمال لتسجيل المواليد والوفيات",
        rating: 4,
        unit: "NDA",
      },
    ],
    verified: true,
    avatarColor: "maroon",
  },
  {
    nameEn: "Mariam Al-Hajri",
    nameAr: "مريم الهاجري",
    type: "government",
    organisationEn: "Ministry of Education and Higher Education",
    organisationAr: "وزارة التربية والتعليم والتعليم العالي",
    positionEn: "Head of Planning and Quality",
    positionAr: "رئيسة التخطيط والجودة",
    country: "QA",
    nationality: "Qatari",
    availability: "limited",
    yearsExperience: 12,
    languages: ["Arabic", "English"],
    bioEn:
      "Coordinates the education sector's contribution to national strategy indicators and the annual education statistics release." +
      ILLUSTRATIVE_EN,
    bioAr:
      "تنسق مساهمة قطاع التعليم في مؤشرات الاستراتيجية الوطنية والإصدار السنوي لإحصاءات التعليم." +
      ILLUSTRATIVE_AR,
    domains: ["education_stats", "kpi_design", "strategy_delivery"],
    engagements: [
      {
        title: "Education outcome indicators alignment",
        year: 2025,
        role: "Sector focal point",
        outcomeEn: "Sector KPIs mapped to the NDS3 human development outcome",
        outcomeAr: "ربط مؤشرات القطاع بنتيجة التنمية البشرية في الاستراتيجية الوطنية",
        rating: 4,
        unit: "SDP",
      },
    ],
    verified: true,
    avatarColor: "gold",
  },
  {
    nameEn: "Abdulla Al-Mohannadi",
    nameAr: "عبدالله المهندي",
    type: "government",
    organisationEn: "Ministry of Municipality",
    organisationAr: "وزارة البلدية",
    positionEn: "Director of Urban Planning Studies",
    positionAr: "مدير دراسات التخطيط العمراني",
    country: "QA",
    nationality: "Qatari",
    availability: "available",
    yearsExperience: 15,
    languages: ["Arabic", "English"],
    bioEn:
      "Leads the studies behind the national spatial framework and the environmental baselines used in municipal planning." +
      ILLUSTRATIVE_EN,
    bioAr:
      "يقود الدراسات التي يقوم عليها الإطار المكاني الوطني وخطوط الأساس البيئية المستخدمة في التخطيط البلدي." +
      ILLUSTRATIVE_AR,
    domains: ["construction_stats", "environment_stats", "public_investment"],
    engagements: [],
    verified: false,
    avatarColor: "gulf",
  },

  /* ---- consultants ---- */
  {
    nameEn: "Omar Nasser",
    nameAr: "عمر ناصر",
    type: "consultant",
    organisationEn: "Doha Delivery Partners (illustrative)",
    organisationAr: "شركاء التنفيذ بالدوحة (توضيحي)",
    positionEn: "Managing Partner",
    positionAr: "شريك إداري",
    country: "QA",
    nationality: "Jordanian",
    availability: "available",
    yearsExperience: 21,
    languages: ["Arabic", "English"],
    bioEn:
      "Delivery-unit practitioner who has set up KPI cascades and quarterly performance dialogues for several Qatari entities." +
      ILLUSTRATIVE_EN,
    bioAr:
      "ممارس في وحدات التنفيذ أنشأ تسلسلات مؤشرات الأداء وحوارات الأداء الفصلية لعدد من الجهات القطرية." +
      ILLUSTRATIVE_AR,
    domains: ["strategy_delivery", "kpi_design", "results_frameworks"],
    skills: ["Delivery units", "Performance dialogues"],
    engagements: [
      {
        title: "KPI cascade design for NDS3 outcome owners",
        year: 2022,
        role: "Lead consultant",
        outcomeEn: "Three-level KPI cascade adopted across eight outcomes",
        outcomeAr: "اعتماد تسلسل مؤشرات ثلاثي المستويات عبر ثماني نتائج",
        rating: 4,
        unit: "IDP",
      },
      {
        title: "Quarterly performance dialogue facilitation",
        year: 2024,
        role: "Facilitator",
        outcomeEn: "Dialogue format standardised; escalation paths documented",
        outcomeAr: "توحيد صيغة الحوار وتوثيق مسارات التصعيد",
        rating: 5,
        unit: "MIF",
      },
      {
        title: "Delivery risk review, first half 2025",
        year: 2025,
        role: "Reviewer",
        outcomeEn: "Twelve at-risk projects re-planned with owners",
        outcomeAr: "إعادة تخطيط اثني عشر مشروعاً معرضاً للخطر مع مالكيها",
        rating: 4,
        unit: "MIF",
      },
    ],
    verified: true,
    avatarColor: "maroon",
  },
  {
    nameEn: "Hanna Lindqvist",
    nameAr: "هانا ليندكفيست",
    type: "consultant",
    organisationEn: "Gulf Evaluation Studio (illustrative)",
    organisationAr: "استوديو الخليج للتقييم (توضيحي)",
    positionEn: "Principal Evaluator",
    positionAr: "مقيّمة رئيسية",
    country: "AE",
    nationality: "Swedish",
    availability: "limited",
    yearsExperience: 13,
    languages: ["English", "Swedish"],
    bioEn:
      "Independent evaluator of public programmes in the Gulf, specialising in mixed-methods designs and beneficiary surveys." +
      ILLUSTRATIVE_EN,
    bioAr:
      "مقيّمة مستقلة للبرامج العامة في الخليج، متخصصة في التصاميم مختلطة الأساليب ومسوح المستفيدين." +
      ILLUSTRATIVE_AR,
    domains: ["evaluation_methods", "me_monitoring", "household_surveys"],
    engagements: [
      {
        title: "Evaluation of the digital services uptake programme",
        year: 2024,
        role: "Evaluation lead",
        outcomeEn: "Final evaluation report with six recommendations, four adopted",
        outcomeAr: "تقرير تقييم نهائي بست توصيات اعتُمدت أربع منها",
        rating: 4,
        unit: "MIF",
      },
    ],
    verified: true,
    avatarColor: "gold",
  },
  {
    nameEn: "Youssef El-Sayed",
    nameAr: "يوسف السيد",
    type: "consultant",
    organisationEn: "Northline Strategy Consulting (illustrative)",
    organisationAr: "نورث لاين للاستشارات الاستراتيجية (توضيحي)",
    positionEn: "Senior Advisor, Public Finance",
    positionAr: "مستشار أول، المالية العامة",
    country: "EG",
    nationality: "Egyptian",
    availability: "unavailable",
    yearsExperience: 24,
    languages: ["Arabic", "English"],
    bioEn:
      "Former ministry of finance official advising on medium-term fiscal frameworks and debt sustainability analysis." +
      ILLUSTRATIVE_EN,
    bioAr:
      "مسؤول سابق في وزارة المالية يقدم المشورة في الأطر المالية متوسطة المدى وتحليل استدامة الدين." +
      ILLUSTRATIVE_AR,
    domains: ["fiscal_policy", "public_finance", "debt_management"],
    engagements: [
      {
        title: "Fiscal sustainability scenario review",
        year: 2023,
        role: "External reviewer",
        outcomeEn: "Scenario assumptions benchmarked against IMF Article IV projections",
        outcomeAr: "مقارنة افتراضات السيناريوهات بتوقعات مشاورات المادة الرابعة لصندوق النقد الدولي",
        rating: 3,
        unit: "SF",
      },
    ],
    verified: true,
    avatarColor: "gulf",
  },

  /* ---- international advisors ---- */
  {
    nameEn: "Dr. Elena Marchetti",
    nameAr: "د. إيلينا ماركيتي",
    type: "international",
    organisationEn: "World Bank",
    organisationAr: "البنك الدولي",
    positionEn: "Senior Economist, Middle East and North Africa",
    positionAr: "خبيرة اقتصادية أولى، الشرق الأوسط وشمال أفريقيا",
    country: "US",
    nationality: "Italian",
    availability: "limited",
    yearsExperience: 18,
    languages: ["English", "Italian", "French"],
    bioEn:
      "Covers private sector development and diversification for the Gulf in the World Bank's regional economic updates." +
      ILLUSTRATIVE_EN,
    bioAr:
      "تغطي تنمية القطاع الخاص والتنويع في الخليج ضمن التحديثات الاقتصادية الإقليمية للبنك الدولي." +
      ILLUSTRATIVE_AR,
    domains: ["economic_diversification", "sme_policy", "fdi"],
    education: [{ degree: "PhD Economics", institution: "Bocconi University", year: 2008 }],
    engagements: [
      {
        title: "Peer review of the diversification composite index",
        year: 2024,
        role: "Peer reviewer",
        outcomeEn: "Index methodology note published with reviewer comments addressed",
        outcomeAr: "نشر مذكرة منهجية المؤشر مع معالجة ملاحظات المراجعين",
        rating: 5,
        unit: "EDP",
      },
      {
        title: "SME finance indicator advisory",
        year: 2025,
        role: "Advisor",
        outcomeEn: "Two indicators added to the business environment target card",
        outcomeAr: "إضافة مؤشرين إلى بطاقة هدف بيئة الأعمال",
        rating: 4,
        unit: "EDP",
      },
    ],
    verified: true,
    avatarColor: "gold",
  },
  {
    nameEn: "Dr. Pieter van der Berg",
    nameAr: "د. بيتر فان دير بيرغ",
    type: "international",
    organisationEn: "Organisation for Economic Co-operation and Development (OECD)",
    organisationAr: "منظمة التعاون الاقتصادي والتنمية",
    positionEn: "Head of Unit, Public Governance Directorate",
    positionAr: "رئيس وحدة، مديرية الحوكمة العامة",
    country: "FR",
    nationality: "Dutch",
    availability: "available",
    yearsExperience: 20,
    languages: ["English", "Dutch", "French"],
    bioEn:
      "Leads OECD work on centre-of-government capacity and strategic planning systems, including reviews for MENA governments." +
      ILLUSTRATIVE_EN,
    bioAr:
      "يقود أعمال المنظمة في قدرات مركز الحكومة ونظم التخطيط الاستراتيجي، بما فيها مراجعات لحكومات المنطقة." +
      ILLUSTRATIVE_AR,
    domains: ["gov_services", "institutional_excellence", "digital_transformation"],
    engagements: [
      {
        title: "Centre-of-government capacity review",
        year: 2025,
        role: "Review lead",
        outcomeEn: "Peer review findings presented to the Council leadership",
        outcomeAr: "عرض نتائج مراجعة الأقران على قيادة المجلس",
        rating: 5,
        unit: "IDP",
      },
    ],
    verified: true,
    avatarColor: "maroon",
  },
  {
    nameEn: "Amina Diallo",
    nameAr: "أمينة ديالو",
    type: "international",
    organisationEn: "United Nations Development Programme (UNDP)",
    organisationAr: "برنامج الأمم المتحدة الإنمائي",
    positionEn: "Policy Specialist, Sustainable Development Goals",
    positionAr: "أخصائية سياسات، أهداف التنمية المستدامة",
    country: "US",
    nationality: "Senegalese",
    availability: "limited",
    yearsExperience: 11,
    languages: ["English", "French", "Arabic"],
    bioEn:
      "Supports national SDG localisation and voluntary national reviews, with a focus on indicator frameworks and data gaps." +
      ILLUSTRATIVE_EN,
    bioAr:
      "تدعم توطين أهداف التنمية المستدامة والمراجعات الوطنية الطوعية، مع تركيز على أطر المؤشرات وفجوات البيانات." +
      ILLUSTRATIVE_AR,
    domains: ["index_monitoring", "results_frameworks", "social_protection"],
    engagements: [
      {
        title: "SDG indicator gap assessment",
        year: 2024,
        role: "Technical advisor",
        outcomeEn: "Gap assessment informed the national indicator roadmap",
        outcomeAr: "أسهم تقييم الفجوات في خارطة طريق المؤشرات الوطنية",
        rating: 4,
        unit: "IIC",
      },
    ],
    verified: true,
    avatarColor: "gulf",
  },
  {
    nameEn: "Dr. Hiroshi Tanaka",
    nameAr: "د. هيروشي تاناكا",
    type: "international",
    organisationEn: "Independent international advisor (formerly UN ESCWA)",
    organisationAr: "مستشار دولي مستقل (الإسكوا سابقاً)",
    positionEn: "Advisor on statistical standards",
    positionAr: "مستشار في المعايير الإحصائية",
    country: "JP",
    nationality: "Japanese",
    availability: "available",
    yearsExperience: 27,
    languages: ["English", "Japanese"],
    bioEn:
      "Former director of statistics at a UN regional commission, advising national statistical offices on SDMX adoption and metadata standards." +
      ILLUSTRATIVE_EN,
    bioAr:
      "مدير سابق للإحصاء في لجنة إقليمية أممية، يقدم المشورة للمكاتب الإحصائية الوطنية في اعتماد SDMX ومعايير البيانات الوصفية." +
      ILLUSTRATIVE_AR,
    domains: ["national_accounts", "data_standards", "metadata"],
    engagements: [],
    verified: false,
    avatarColor: "gold",
  },
];

/* The country of an existing external expert, from its organisation when it
   is an international body, otherwise from the nationality on file. */
const ORG_COUNTRY: [RegExp, string][] = [
  [/world bank|international monetary fund|united nations statistics|undp/i, "US"],
  [/oecd|organisation for economic/i, "FR"],
  [/escwa/i, "LB"],
  [/qatar|doha|georgetown university in qatar|hamad bin khalifa|ministry|central bank/i, "QA"],
];
const NATIONALITY_COUNTRY: Record<string, string> = {
  Qatari: "QA",
  American: "US",
  British: "GB",
  Colombian: "CO",
  French: "FR",
  German: "DE",
  Ghanaian: "GH",
  Indian: "IN",
  Jordanian: "JO",
  Lebanese: "LB",
  Nigerian: "NG",
  Omani: "OM",
  Portuguese: "PT",
  "South Korean": "KR",
  Tunisian: "TN",
  Egyptian: "EG",
  Swedish: "SE",
  Italian: "IT",
  Dutch: "NL",
  Senegalese: "SN",
  Japanese: "JP",
};

function countryFor(organisation: string | null, nationality: string | null): string | null {
  for (const [re, code] of ORG_COUNTRY) if (organisation && re.test(organisation)) return code;
  if (nationality && NATIONALITY_COUNTRY[nationality]) return NATIONALITY_COUNTRY[nationality];
  return null;
}

export default async function seedCr08Experts(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const stamp = now();

  const [owner] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, "knowledge@npc.qa"))
    .limit(1);
  const terms = await db
    .select({ id: schema.taxonomyTerms.id, code: schema.taxonomyTerms.code })
    .from(schema.taxonomyTerms);
  const termId = new Map(terms.map((t) => [t.code, t.id]));
  const units = await db
    .select({ id: schema.orgUnits.id, code: schema.orgUnits.code, level: schema.orgUnits.level })
    .from(schema.orgUnits);
  const unitId = new Map(units.map((u) => [u.code, u.id]));

  /* 1. the new externals, keyed by English name */
  const existing = await db
    .select({ id: schema.experts.id, nameEn: schema.experts.nameEn })
    .from(schema.experts);
  const byName = new Map(existing.map((e) => [e.nameEn.toLowerCase(), e.id]));
  let inserted = 0;
  const newIds: string[] = [];
  for (const e of EXTERNALS) {
    if (byName.has(e.nameEn.toLowerCase())) continue;
    const id = ulid();
    await db.insert(schema.experts).values({
      id,
      userId: null,
      type: e.type,
      nameEn: e.nameEn,
      nameAr: e.nameAr,
      avatarColor: e.avatarColor,
      organisationEn: e.organisationEn,
      organisationAr: e.organisationAr,
      positionEn: e.positionEn,
      positionAr: e.positionAr,
      bioEn: e.bioEn,
      bioAr: e.bioAr,
      nationality: e.nationality,
      country: e.country,
      languagesJson: JSON.stringify(e.languages),
      yearsExperience: e.yearsExperience,
      educationJson: JSON.stringify(e.education ?? []),
      availability: e.availability,
      clearanceLevel: 1,
      ownerUserId: owner?.id ?? null,
      isVerified: e.verified ? 1 : 0,
      visibilityClassification: 2,
      createdAt: stamp,
      updatedAt: stamp,
    });
    for (const code of e.domains) {
      const tid = termId.get(code);
      if (!tid) continue;
      await db.insert(schema.expertDomains).values({
        id: ulid(),
        expertId: id,
        termId: tid,
        level: "expert",
        source: "self",
        accepted: 1,
      });
    }
    for (const skill of e.skills ?? []) {
      await db.insert(schema.expertSkills).values({ id: ulid(), expertId: id, skill, level: "expert" });
    }
    for (const g of e.engagements) {
      await db.insert(schema.expertEngagements).values({
        id: ulid(),
        expertId: id,
        title: g.title,
        year: g.year,
        role: g.role,
        departmentId: g.unit ? unitId.get(g.unit) ?? null : null,
        outcomeEn: g.outcomeEn,
        outcomeAr: g.outcomeAr,
        rating: g.rating ?? null,
      });
    }
    inserted++;
    newIds.push(id);
  }
  console.log(`cr08 experts: ${inserted} external experts inserted (${EXTERNALS.length - inserted} already present)`);

  /* 2. country backfill for externals that predate the column */
  const missing = await db
    .select({
      id: schema.experts.id,
      organisationEn: schema.experts.organisationEn,
      nationality: schema.experts.nationality,
    })
    .from(schema.experts)
    .where(and(isNull(schema.experts.userId), isNull(schema.experts.country)));
  let filled = 0;
  for (const m of missing) {
    const code = countryFor(m.organisationEn, m.nationality);
    if (!code) continue;
    await db.update(schema.experts).set({ country: code }).where(eq(schema.experts.id, m.id));
    filled++;
  }
  console.log(`cr08 experts: country filled on ${filled} existing external experts`);

  /* 3. every internal expert reaches its unit through users.department_id */
  const internals = await db
    .select({ expertId: schema.experts.id, userId: schema.users.id, departmentId: schema.users.departmentId })
    .from(schema.experts)
    .innerJoin(schema.users, eq(schema.users.id, schema.experts.userId));
  const departments = units.filter((u) => u.level === "department").sort((a, b) => a.code.localeCompare(b.code));
  let assigned = 0;
  for (const i of internals) {
    if (i.departmentId || !departments.length) continue;
    // deterministic: the unit is chosen by the user id so a rerun agrees
    let h = 0;
    for (const ch of i.userId) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const dept = departments[Math.abs(h) % departments.length];
    await db.update(schema.users).set({ departmentId: dept.id }).where(eq(schema.users.id, i.userId));
    assigned++;
  }
  console.log(`cr08 experts: ${internals.length} internal experts checked, ${assigned} units assigned`);

  /* 4. the search index (semantic + FTS) for the new rows; the network may
        be unavailable, so a failure is logged and never fatal */
  if (newIds.length) {
    try {
      const { embedStructuredRecords } = await import("../src/server/search/records");
      for (const id of newIds) await embedStructuredRecords("expert", id);
      console.log(`cr08 experts: ${newIds.length} search index rows written`);
    } catch (e) {
      console.warn("cr08 experts: search index skipped:", String((e as Error)?.message ?? e).slice(0, 120));
    }
  }

  const rows = await db
    .select({ type: schema.experts.type })
    .from(schema.experts)
    .where(inArray(schema.experts.type, ["government", "academic", "consultant", "international"]));
  console.log(`cr08 experts: ${rows.length} external experts in total`);
}

const isMain = process.argv[1] && /cr08-experts-seed\.ts$/.test(process.argv[1]);
if (isMain) {
  seedCr08Experts()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
