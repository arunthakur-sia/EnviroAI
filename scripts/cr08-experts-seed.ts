/* eslint-disable no-console */
// CR08 3: external experts (type, organisation, availability, country,
// engagements) so the External Experts view has real rows. Owned by the
// Experts agent. Idempotent: an expert is keyed by its English name; the
// country backfill touches only rows whose country is still null; the unit
// check assigns a department only to an internal expert whose user has none.
//
// Every profile below is fictional and clearly illustrative (the bio says so);
// the organisations are real public institutions the Office works with; the
// people are fictional.
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
  avatarColor: "teal" | "aqua" | "navy";
};

const ILLUSTRATIVE_EN = " Illustrative profile for the EnviroAI prototype. The person is fictional; the institution is real.";
const ILLUSTRATIVE_AR = " ملف تعريفي توضيحي لنموذج EnviroAI الأولي. الشخصية افتراضية والمؤسسة حقيقية.";

const EXTERNALS: ExternalExpert[] = [
  /* ---- academia ---- */
  {
    nameEn: "Dr. Faisal Al-Harbi",
    nameAr: "د. فيصل الحربي",
    type: "academic",
    organisationEn: "King Abdullah University of Science and Technology (KAUST)",
    organisationAr: "جامعة الملك عبدالله للعلوم والتقنية (كاوست)",
    positionEn: "Associate Professor of Water Resources Engineering",
    positionAr: "أستاذ مشارك في هندسة الموارد المائية",
    country: "SA",
    nationality: "Saudi",
    availability: "available",
    yearsExperience: 14,
    languages: ["Arabic", "English"],
    bioEn:
      "Researches desalination energy efficiency, treated wastewater reuse and groundwater depletion in arid regions. Advises on the indicators behind the water security theme." +
      ILLUSTRATIVE_EN,
    bioAr:
      "يبحث في كفاءة الطاقة في تحلية المياه وإعادة استخدام المياه المعالجة واستنزاف المياه الجوفية في المناطق الجافة. يقدم المشورة في المؤشرات الداعمة لمحور الأمن المائي." +
      ILLUSTRATIVE_AR,
    domains: ["environment_stats", "data_quality", "index_monitoring"],
    skills: ["Water balance modelling", "Desalination energy analysis"],
    education: [{ degree: "PhD Civil and Environmental Engineering", institution: "Stanford University", year: 2012 }],
    engagements: [
      {
        title: "Review of the water supply and demand indicators",
        year: 2024,
        role: "Technical reviewer",
        outcomeEn: "Indicator definitions aligned with a single water balance method",
        outcomeAr: "مواءمة تعريفات المؤشرات مع منهجية موحدة للميزان المائي",
        rating: 5,
        unit: "WSD",
      },
      {
        title: "Water balance methodology workshop",
        year: 2023,
        role: "Lead facilitator",
        outcomeEn: "Groundwater and desalination accounting rules agreed with the Water Security team",
        outcomeAr: "الاتفاق على قواعد احتساب المياه الجوفية والتحلية مع فريق الأمن المائي",
        rating: 4,
        unit: "WSD",
      },
    ],
    verified: true,
    avatarColor: "teal",
  },
  {
    nameEn: "Dr. Huda Al-Otaibi",
    nameAr: "د. هدى العتيبي",
    type: "academic",
    organisationEn: "King Fahd University of Petroleum and Minerals (KFUPM), Environmental Engineering",
    organisationAr: "جامعة الملك فهد للبترول والمعادن، الهندسة البيئية",
    positionEn: "Professor of Air Quality and Atmospheric Science",
    positionAr: "أستاذ جودة الهواء وعلوم الغلاف الجوي",
    country: "SA",
    nationality: "Saudi",
    availability: "limited",
    yearsExperience: 19,
    languages: ["Arabic", "English"],
    bioEn:
      "Leads research on particulate matter, dust events and ambient air monitoring network design. Long collaboration with environmental regulators on station siting and data validation." +
      ILLUSTRATIVE_EN,
    bioAr:
      "تقود بحوثاً في الجسيمات العالقة والعواصف الغبارية وتصميم شبكات رصد جودة الهواء المحيط. تعاون طويل مع الجهات التنظيمية البيئية في اختيار مواقع المحطات والتحقق من البيانات." +
      ILLUSTRATIVE_AR,
    domains: ["environment_stats", "data_quality", "data_standards"],
    skills: ["Air quality monitoring design", "Dust source attribution"],
    education: [{ degree: "PhD Atmospheric Science", institution: "University of Michigan", year: 2007 }],
    engagements: [
      {
        title: "Air quality station network validation study",
        year: 2025,
        role: "Principal investigator",
        outcomeEn: "Validation rules adopted and a station siting checklist documented",
        outcomeAr: "اعتماد قواعد التحقق وتوثيق قائمة فحص لاختيار مواقع المحطات",
        rating: 5,
        unit: "AQD",
      },
    ],
    verified: true,
    avatarColor: "navy",
  },
  {
    nameEn: "Dr. Saad Al-Dossary",
    nameAr: "د. سعد الدوسري",
    type: "academic",
    organisationEn: "King Saud University, College of Food and Agriculture Sciences",
    organisationAr: "جامعة الملك سعود، كلية علوم الأغذية والزراعة",
    positionEn: "Assistant Professor of Agricultural Economics",
    positionAr: "أستاذ مساعد في الاقتصاد الزراعي",
    country: "SA",
    nationality: "Saudi",
    availability: "available",
    yearsExperience: 8,
    languages: ["Arabic", "English", "French"],
    bioEn:
      "Works on crop water productivity, agricultural water pricing and food security policy in Gulf economies, including results frameworks for national strategies." +
      ILLUSTRATIVE_EN,
    bioAr:
      "يعمل في إنتاجية المياه للمحاصيل وتسعير المياه الزراعية وسياسات الأمن الغذائي في الاقتصادات الخليجية، بما في ذلك أطر النتائج للاستراتيجيات الوطنية." +
      ILLUSTRATIVE_AR,
    domains: ["evaluation_methods", "results_frameworks", "me_monitoring"],
    skills: ["Agricultural policy analysis", "Contribution analysis"],
    education: [{ degree: "PhD Agricultural Economics", institution: "Wageningen University", year: 2017 }],
    engagements: [
      {
        title: "Evaluation framework for the NES mid-term review",
        year: 2025,
        role: "Methodological advisor",
        outcomeEn: "Evaluation questions and evidence matrix adopted for the agriculture theme",
        outcomeAr: "اعتماد أسئلة التقييم ومصفوفة الأدلة لمحور الزراعة",
        rating: 4,
        unit: "PMD",
      },
    ],
    verified: true,
    avatarColor: "aqua",
  },
  {
    nameEn: "Dr. Abeer Al-Ghamdi",
    nameAr: "د. عبير الغامدي",
    type: "academic",
    organisationEn: "King Abdulaziz University, Faculty of Marine Sciences",
    organisationAr: "جامعة الملك عبدالعزيز، كلية علوم البحار",
    positionEn: "Associate Professor of Marine Biodiversity",
    positionAr: "أستاذ مشارك في التنوع الأحيائي البحري",
    country: "SA",
    nationality: "Saudi",
    availability: "limited",
    yearsExperience: 16,
    languages: ["Arabic", "English"],
    bioEn:
      "Directs Red Sea coral reef and mangrove monitoring programmes and sits on advisory panels on coastal biodiversity baselines." +
      ILLUSTRATIVE_EN,
    bioAr:
      "تدير برامج رصد الشعاب المرجانية وأشجار المانغروف في البحر الأحمر، وتشارك في لجان استشارية حول خطوط الأساس للتنوع الأحيائي الساحلي." +
      ILLUSTRATIVE_AR,
    domains: ["environment_stats", "foresight_methods", "scenario_planning"],
    education: [{ degree: "PhD Marine Biology", institution: "University of Southampton", year: 2010 }],
    engagements: [],
    verified: true,
    avatarColor: "teal",
  },

  /* ---- government entities ---- */
  {
    nameEn: "Eng. Turki Al-Shehri",
    nameAr: "م. تركي الشهري",
    type: "government",
    organisationEn: "Ministry of Environment, Water and Agriculture (MEWA)",
    organisationAr: "وزارة البيئة والمياه والزراعة",
    positionEn: "Director of Water Resources Planning",
    positionAr: "مدير تخطيط الموارد المائية",
    country: "SA",
    nationality: "Saudi",
    availability: "available",
    yearsExperience: 17,
    languages: ["Arabic", "English"],
    bioEn:
      "Owns the sector water information architecture and the data-sharing agreements that feed the national water statistics." +
      ILLUSTRATIVE_EN,
    bioAr:
      "يتولى بنية المعلومات المائية للقطاع واتفاقيات تبادل البيانات التي تغذي الإحصاءات الوطنية للمياه." +
      ILLUSTRATIVE_AR,
    domains: ["environment_stats", "data_governance", "data_quality"],
    skills: ["Water information systems", "Data sharing agreements"],
    engagements: [
      {
        title: "Water statistics data-sharing agreement",
        year: 2024,
        role: "Counterpart lead",
        outcomeEn: "Quarterly water extraction and supply extracts flowing to the Office",
        outcomeAr: "تدفق مستخرجات السحب والإمداد المائي الفصلية إلى المكتب",
        rating: 5,
        unit: "DOP",
      },
      {
        title: "Data quality review of metering feeds",
        year: 2025,
        role: "Joint reviewer",
        outcomeEn: "Completeness thresholds agreed for utility and well metering returns",
        outcomeAr: "الاتفاق على عتبات الاكتمال لبيانات القياس لدى المرافق والآبار",
        rating: 4,
        unit: "EDA",
      },
    ],
    verified: true,
    avatarColor: "navy",
  },
  {
    nameEn: "Mona Al-Qahtani",
    nameAr: "منى القحطاني",
    type: "government",
    organisationEn: "National Center for Environmental Compliance (NCEC)",
    organisationAr: "المركز الوطني للرقابة على الالتزام البيئي",
    positionEn: "Head of Compliance Monitoring",
    positionAr: "رئيسة متابعة الامتثال",
    country: "SA",
    nationality: "Saudi",
    availability: "limited",
    yearsExperience: 12,
    languages: ["Arabic", "English"],
    bioEn:
      "Coordinates the compliance monitoring contribution to national strategy indicators and the annual inspection and permit data release." +
      ILLUSTRATIVE_EN,
    bioAr:
      "تنسق مساهمة متابعة الامتثال في مؤشرات الاستراتيجية الوطنية والإصدار السنوي لبيانات التفتيش والتراخيص." +
      ILLUSTRATIVE_AR,
    domains: ["kpi_design", "strategy_delivery", "institutional_excellence"],
    engagements: [
      {
        title: "Compliance outcome indicators alignment",
        year: 2025,
        role: "Sector focal point",
        outcomeEn: "Inspection and permit KPIs mapped to the regulatory compliance theme",
        outcomeAr: "ربط مؤشرات التفتيش والتراخيص بمحور الامتثال التنظيمي",
        rating: 4,
        unit: "RCM",
      },
    ],
    verified: true,
    avatarColor: "aqua",
  },
  {
    nameEn: "Abdulaziz Al-Zahrani",
    nameAr: "عبدالعزيز الزهراني",
    type: "government",
    organisationEn: "National Center for Wildlife (NCW)",
    organisationAr: "المركز الوطني لتنمية الحياة الفطرية",
    positionEn: "Director of Species Monitoring",
    positionAr: "مدير رصد الأنواع",
    country: "SA",
    nationality: "Saudi",
    availability: "available",
    yearsExperience: 15,
    languages: ["Arabic", "English"],
    bioEn:
      "Leads the monitoring studies behind protected area baselines and species recovery reporting." +
      ILLUSTRATIVE_EN,
    bioAr:
      "يقود دراسات الرصد التي تقوم عليها خطوط الأساس للمناطق المحمية والتقارير الخاصة بتعافي الأنواع." +
      ILLUSTRATIVE_AR,
    domains: ["environment_stats", "public_investment", "index_monitoring"],
    engagements: [],
    verified: false,
    avatarColor: "teal",
  },

  /* ---- consultants (fictional firms) ---- */
  {
    nameEn: "Omar Nasser",
    nameAr: "عمر ناصر",
    type: "consultant",
    organisationEn: "Najd Delivery Partners (illustrative)",
    organisationAr: "شركاء نجد للتنفيذ (توضيحي)",
    positionEn: "Managing Partner",
    positionAr: "شريك إداري",
    country: "SA",
    nationality: "Jordanian",
    availability: "available",
    yearsExperience: 21,
    languages: ["Arabic", "English"],
    bioEn:
      "Delivery-unit practitioner who has set up KPI cascades and quarterly performance dialogues for several Saudi entities." +
      ILLUSTRATIVE_EN,
    bioAr:
      "ممارس في وحدات التنفيذ أنشأ تسلسلات مؤشرات الأداء وحوارات الأداء الفصلية لعدد من الجهات السعودية." +
      ILLUSTRATIVE_AR,
    domains: ["strategy_delivery", "kpi_design", "results_frameworks"],
    skills: ["Delivery units", "Performance dialogues"],
    engagements: [
      {
        title: "KPI cascade design for NES theme owners",
        year: 2022,
        role: "Lead consultant",
        outcomeEn: "Three-level KPI cascade adopted across seven themes",
        outcomeAr: "اعتماد تسلسل مؤشرات ثلاثي المستويات عبر سبعة محاور",
        rating: 4,
        unit: "SPD",
      },
      {
        title: "Quarterly performance dialogue facilitation",
        year: 2024,
        role: "Facilitator",
        outcomeEn: "Dialogue format standardised; escalation paths documented",
        outcomeAr: "توحيد صيغة الحوار وتوثيق مسارات التصعيد",
        rating: 5,
        unit: "PMD",
      },
      {
        title: "Delivery risk review, first half 2025",
        year: 2025,
        role: "Reviewer",
        outcomeEn: "Twelve at-risk projects re-planned with owners",
        outcomeAr: "إعادة تخطيط اثني عشر مشروعاً معرضاً للخطر مع مالكيها",
        rating: 4,
        unit: "PMD",
      },
    ],
    verified: true,
    avatarColor: "navy",
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
    domains: ["evaluation_methods", "me_monitoring", "kpi_design"],
    engagements: [
      {
        title: "Evaluation of the digital services uptake programme",
        year: 2024,
        role: "Evaluation lead",
        outcomeEn: "Final evaluation report with six recommendations, four adopted",
        outcomeAr: "تقرير تقييم نهائي بست توصيات اعتُمدت أربع منها",
        rating: 4,
        unit: "PMD",
      },
    ],
    verified: true,
    avatarColor: "aqua",
  },
  {
    nameEn: "Youssef El-Sayed",
    nameAr: "يوسف السيد",
    type: "consultant",
    organisationEn: "Northline Strategy Consulting (illustrative)",
    organisationAr: "نورث لاين للاستشارات الاستراتيجية (توضيحي)",
    positionEn: "Senior Advisor, Environmental Finance",
    positionAr: "مستشار أول، التمويل البيئي",
    country: "EG",
    nationality: "Egyptian",
    availability: "unavailable",
    yearsExperience: 24,
    languages: ["Arabic", "English"],
    bioEn:
      "Former finance ministry official advising on medium-term funding frameworks for environmental programmes and on the economics of water and agriculture subsidies." +
      ILLUSTRATIVE_EN,
    bioAr:
      "مسؤول سابق في وزارة المالية يقدم المشورة في أطر التمويل متوسطة المدى للبرامج البيئية وفي اقتصاديات دعم المياه والزراعة." +
      ILLUSTRATIVE_AR,
    domains: ["fiscal_policy", "public_finance", "public_investment"],
    engagements: [
      {
        title: "Funding scenario review",
        year: 2023,
        role: "External reviewer",
        outcomeEn: "Scenario assumptions benchmarked against published multilateral projections",
        outcomeAr: "مقارنة افتراضات السيناريوهات بتوقعات منشورة للمؤسسات متعددة الأطراف",
        rating: 3,
        unit: "SCN",
      },
    ],
    verified: true,
    avatarColor: "teal",
  },

  /* ---- international advisors ---- */
  {
    nameEn: "Dr. Elena Marchetti",
    nameAr: "د. إيلينا ماركيتي",
    type: "international",
    organisationEn: "World Bank",
    organisationAr: "البنك الدولي",
    positionEn: "Senior Water Economist, Middle East and North Africa",
    positionAr: "خبيرة اقتصاد المياه الأولى، الشرق الأوسط وشمال أفريقيا",
    country: "US",
    nationality: "Italian",
    availability: "limited",
    yearsExperience: 18,
    languages: ["English", "Italian", "French"],
    bioEn:
      "Covers water sector reform and utility performance for the Gulf in the World Bank's regional work." +
      ILLUSTRATIVE_EN,
    bioAr:
      "تغطي إصلاح قطاع المياه وأداء المرافق في الخليج ضمن أعمال البنك الدولي الإقليمية." +
      ILLUSTRATIVE_AR,
    domains: ["economic_diversification", "public_investment", "index_monitoring"],
    education: [{ degree: "PhD Economics", institution: "Bocconi University", year: 2008 }],
    engagements: [
      {
        title: "Peer review of the water security composite index",
        year: 2024,
        role: "Peer reviewer",
        outcomeEn: "Index methodology note published with reviewer comments addressed",
        outcomeAr: "نشر مذكرة منهجية المؤشر مع معالجة ملاحظات المراجعين",
        rating: 5,
        unit: "WSD",
      },
      {
        title: "Utility performance indicator advisory",
        year: 2025,
        role: "Advisor",
        outcomeEn: "Two indicators added to the water security target card",
        outcomeAr: "إضافة مؤشرين إلى بطاقة هدف الأمن المائي",
        rating: 4,
        unit: "WSD",
      },
    ],
    verified: true,
    avatarColor: "aqua",
  },
  {
    nameEn: "Dr. Pieter van der Berg",
    nameAr: "د. بيتر فان دير بيرغ",
    type: "international",
    organisationEn: "Food and Agriculture Organization of the United Nations (FAO)",
    organisationAr: "منظمة الأغذية والزراعة للأمم المتحدة (الفاو)",
    positionEn: "Senior Land and Water Officer",
    positionAr: "كبير موظفي الأراضي والمياه",
    country: "IT",
    nationality: "Dutch",
    availability: "available",
    yearsExperience: 20,
    languages: ["English", "Dutch", "French"],
    bioEn:
      "Leads FAO work on water accounting, irrigation efficiency and food security monitoring, including reviews for MENA governments." +
      ILLUSTRATIVE_EN,
    bioAr:
      "يقود أعمال المنظمة في المحاسبة المائية وكفاءة الري ورصد الأمن الغذائي، بما فيها مراجعات لحكومات المنطقة." +
      ILLUSTRATIVE_AR,
    domains: ["environment_stats", "institutional_excellence", "data_standards"],
    engagements: [
      {
        title: "Agricultural water use accounting review",
        year: 2025,
        role: "Review lead",
        outcomeEn: "Review findings presented to the Office leadership",
        outcomeAr: "عرض نتائج المراجعة على قيادة المكتب",
        rating: 5,
        unit: "AFD",
      },
    ],
    verified: true,
    avatarColor: "navy",
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
    domains: ["index_monitoring", "results_frameworks", "environment_stats"],
    engagements: [
      {
        title: "SDG indicator gap assessment",
        year: 2024,
        role: "Technical advisor",
        outcomeEn: "Gap assessment informed the national indicator roadmap",
        outcomeAr: "أسهم تقييم الفجوات في خارطة طريق المؤشرات الوطنية",
        rating: 4,
        unit: "PAR",
      },
    ],
    verified: true,
    avatarColor: "teal",
  },
  {
    nameEn: "Dr. Hiroshi Tanaka",
    nameAr: "د. هيروشي تاناكا",
    type: "international",
    organisationEn: "Independent international advisor (formerly UN ESCWA)",
    organisationAr: "مستشار دولي مستقل (الإسكوا سابقاً)",
    positionEn: "Advisor on environmental statistical standards",
    positionAr: "مستشار في المعايير الإحصائية البيئية",
    country: "JP",
    nationality: "Japanese",
    availability: "available",
    yearsExperience: 27,
    languages: ["English", "Japanese"],
    bioEn:
      "Former director of statistics at a UN regional commission, advising national statistical offices on SDMX adoption, environmental accounting and metadata standards." +
      ILLUSTRATIVE_EN,
    bioAr:
      "مدير سابق للإحصاء في لجنة إقليمية أممية، يقدم المشورة للمكاتب الإحصائية الوطنية في اعتماد SDMX والمحاسبة البيئية ومعايير البيانات الوصفية." +
      ILLUSTRATIVE_AR,
    domains: ["environment_stats", "data_standards", "metadata"],
    engagements: [],
    verified: false,
    avatarColor: "aqua",
  },
];

/* The country of an existing external expert, from its organisation when it
   is an international body, otherwise from the nationality on file. */
const ORG_COUNTRY: [RegExp, string][] = [
  [/world bank|international monetary fund|united nations statistics|undp/i, "US"],
  [/\bfao\b|food and agriculture organi[sz]ation/i, "IT"],
  [/oecd|organisation for economic/i, "FR"],
  [/escwa/i, "LB"],
  [/kaust|king abdullah|kfupm|king fahd|king saud|king abdulaziz|kacst|kapsarc|\bmewa\b|\bncec\b|\bncw\b|ministry|national center|saudi|riyadh/i, "SA"],
];
const NATIONALITY_COUNTRY: Record<string, string> = {
  Saudi: "SA",
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
    .where(eq(schema.users.email, "knowledge@enviroai.demo"))
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
