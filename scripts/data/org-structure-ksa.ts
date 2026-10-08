// The illustrative organisational structure of the Programme Office (the
// Office) that steers the Saudi National Environment Strategy. Everything here
// is fictional and illustrative: head names are invented, mandates are short
// original descriptions, and no decree or regulation numbers are cited.
// scripts/cr07-org-seed.ts reads this module and scripts/fetch-cr07-sources.ts
// writes it out as sources/org/org-structure.json (no network involved).

export type OrgUnitJson = {
  code: string;
  level: string;
  parent_code: string | null;
  name_en: string;
  name_ar: string;
  head_name_en: string | null;
  head_name_ar: string | null;
  head_title_en: string | null;
  head_title_ar: string | null;
  mandate_en: string;
  mandate_ar: string;
  source_url: string;
  source_url_ar: string;
  fetched_at: string;
  sort: number;
};

export type OrgStructurePayload = {
  source: string;
  source_ar: string;
  authority: string;
  fetched_at: string;
  units: OrgUnitJson[];
};

const FETCHED_AT = "2026-01-01T00:00:00.000Z";

type Row = [
  code: string,
  level: "office" | "sector" | "department",
  parent: string | null,
  nameEn: string,
  nameAr: string,
  headEn: string,
  headAr: string,
  mandateEn: string,
  mandateAr: string,
];

const TITLE: Record<string, [string, string]> = {
  office: ["Head of Office", "رئيس المكتب"],
  sector: ["Sector Head", "رئيس القطاع"],
  department: ["Department Director", "مدير الإدارة"],
};

const ROWS: Row[] = [
  ["OPD", "office", null, "Office of the Programme Director", "مكتب مدير البرنامج",
    "Faisal Al-Harbi", "فيصل الحربي",
    "Leads the Office, chairs its executive committee and answers to the Programme Steering Committee for delivery of the National Environment Strategy. Sets priorities across sectors and represents the Office with national entities.",
    "يقود المكتب ويرأس لجنته التنفيذية ويرفع إلى اللجنة التوجيهية للبرنامج عن تنفيذ الاستراتيجية الوطنية للبيئة. يحدد الأولويات بين القطاعات ويمثل المكتب لدى الجهات الوطنية."],
  ["SPS", "sector", "OPD", "Strategy and Performance Sector", "قطاع الاستراتيجية والأداء",
    "Noura Al-Qahtani", "نورة القحطاني",
    "Oversees strategy development, planning standards, programme monitoring and evaluation, and the theme teams for water, agriculture, climate, biodiversity, waste and air quality.",
    "يشرف على تطوير الاستراتيجية ومعايير التخطيط ومتابعة البرنامج وتقييمه وفرق المحاور للمياه والزراعة والمناخ والتنوع الأحيائي والنفايات وجودة الهواء."],
  ["SPD", "department", "SPS", "Strategy Development", "إدارة تطوير الاستراتيجية",
    "Abdulaziz Al-Dosari", "عبدالعزيز الدوسري",
    "Owns the Programme Strategy of the Office (the Strategy Office). Maintains its goals, results chain and change log, and prepares the annual review.",
    "تملك استراتيجية مكتب البرنامج (مكتب الاستراتيجية). تحافظ على أهدافها وسلسلة نتائجها وسجل تغييراتها وتعد المراجعة السنوية."],
  ["PQS", "department", "SPS", "Planning Quality and Standards", "إدارة جودة الخطط والمعايير",
    "Reem Al-Shehri", "ريم الشهري",
    "Issues the results framework manual and templates, and reviews the quality of sector and entity strategies against them.",
    "تصدر دليل إطار النتائج ونماذجه، وتراجع جودة استراتيجيات القطاعات والجهات وفقاً له."],
  ["PMD", "department", "SPS", "Programme Monitoring", "إدارة متابعة البرنامج",
    "Saud Al-Otaibi", "سعود العتيبي",
    "Runs the monitoring framework and the reporting cycle for the National Environment Strategy, and consolidates progress from entities into the delivery dashboard.",
    "تدير إطار المتابعة ودورة إعداد التقارير للاستراتيجية الوطنية للبيئة، وتجمع تقدم الجهات في لوحة متابعة التنفيذ."],
  ["PEV", "department", "SPS", "Programme Evaluation", "إدارة تقييم البرنامج",
    "Hessa Al-Mutairi", "حصة المطيري",
    "Commissions and conducts evaluations of initiatives and outcomes, and feeds the lessons learned back into planning.",
    "تكلف بتقييمات المبادرات والنتائج وتجريها، وتعيد الدروس المستفادة إلى عملية التخطيط."],
  ["ISU", "department", "SPS", "Implementation Support", "إدارة دعم التنفيذ",
    "Majed Al-Ghamdi", "ماجد الغامدي",
    "Supports entities whose initiatives are lagging with diagnostics, troubleshooting sessions and tailored support packages.",
    "تدعم الجهات المتأخرة مبادراتها بالتشخيص وجلسات معالجة المعوقات وحزم الدعم المخصصة."],
  ["SCN", "department", "SPS", "Scenarios and Signals", "إدارة السيناريوهات والإشارات",
    "Lama Al-Zahrani", "لمى الزهراني",
    "Builds scenario sets for the environmental targets of Saudi Vision 2030 and tracks weak signals that may change the planning context.",
    "تبني مجموعات سيناريوهات للمستهدفات البيئية في رؤية السعودية 2030 وترصد الإشارات المبكرة التي قد تغير سياق التخطيط."],
  ["FRS", "department", "SPS", "Foresight and Risk", "إدارة الاستشراف والمخاطر",
    "Turki Al-Anazi", "تركي العنزي",
    "Scans the horizon for environmental risks and opportunities and prepares the quarterly strategic risk briefing for leadership.",
    "تمسح الأفق بحثاً عن المخاطر والفرص البيئية وتعد إحاطة المخاطر الاستراتيجية الربع سنوية للقيادة."],
  ["PLB", "department", "SPS", "Policy Lab", "مختبر السياسات",
    "Dalal Al-Subaie", "دلال السبيعي",
    "Tests proposed policies and regulations with simulation models and structured trials before they are adopted.",
    "يختبر السياسات والأنظمة المقترحة بنماذج المحاكاة والتجارب المنظمة قبل اعتمادها."],
  ["BIN", "department", "SPS", "Behavioural Insights", "إدارة الرؤى السلوكية",
    "Wafa Al-Rashidi", "وفاء الرشيدي",
    "Designs and evaluates behavioural trials on water use, waste and other priorities where behaviour drives results.",
    "تصمم تجارب سلوكية وتقيمها في مجالات استهلاك المياه والنفايات وغيرها مما يؤثر فيه السلوك في النتائج."],
  ["WSD", "department", "SPS", "Water Security", "إدارة الأمن المائي",
    "Khalid Al-Salem", "خالد السالم",
    "Supports the water security theme: demand and supply balance, resource efficiency and coordination with water sector entities.",
    "تدعم محور الأمن المائي: التوازن بين الطلب والإمداد وكفاءة الموارد والتنسيق مع جهات قطاع المياه."],
  ["AFD", "department", "SPS", "Agriculture and Food Security", "إدارة الأمن الغذائي والزراعة",
    "Maha Al-Yami", "مها اليامي",
    "Supports the agriculture and food security theme: sustainable production, agricultural water use and food supply resilience.",
    "تدعم محور الأمن الغذائي والزراعة: الإنتاج المستدام واستخدام المياه الزراعية ومرونة الإمداد الغذائي."],
  ["CLD", "department", "SPS", "Climate and Environment", "إدارة المناخ والبيئة",
    "Bandar Al-Shammari", "بندر الشمري",
    "Supports the climate and environment theme: emissions, adaptation, and alignment with national and international climate commitments.",
    "تدعم محور المناخ والبيئة: الانبعاثات والتكيف والمواءمة مع الالتزامات المناخية الوطنية والدولية."],
  ["BLD", "department", "SPS", "Biodiversity and Land", "إدارة التنوع الأحيائي والأراضي",
    "Sarah Al-Juhani", "سارة الجهني",
    "Supports the biodiversity and land theme: habitat protection, vegetation cover and land degradation.",
    "تدعم محور التنوع الأحيائي والأراضي: حماية الموائل والغطاء النباتي وتدهور الأراضي."],
  ["WCD", "department", "SPS", "Waste and Circular Economy", "إدارة النفايات والاقتصاد الدائري",
    "Yousef Al-Maliki", "يوسف المالكي",
    "Supports the waste and circular economy theme: waste reduction, recovery and recycling, and circular practices across sectors.",
    "تدعم محور النفايات والاقتصاد الدائري: خفض النفايات واستردادها وتدويرها والممارسات الدائرية في القطاعات."],
  ["AQD", "department", "SPS", "Air Quality", "إدارة جودة الهواء",
    "Anwar Al-Harthi", "أنور الحارثي",
    "Supports the air quality theme: monitoring networks, emission sources and progress against air quality objectives.",
    "تدعم محور جودة الهواء: شبكات الرصد ومصادر الانبعاثات والتقدم نحو أهداف جودة الهواء."],
  ["RAS", "sector", "OPD", "Regulatory Affairs Sector", "قطاع الشؤون التنظيمية",
    "Abeer Al-Tamimi", "عبير التميمي",
    "Oversees how environmental regulation is tracked, reviewed and understood across the Office and its partner entities.",
    "يشرف على كيفية تتبع الأنظمة البيئية ومراجعتها وفهمها داخل المكتب والجهات الشريكة."],
  ["RCM", "department", "RAS", "Regulatory Compliance Monitoring", "إدارة متابعة الامتثال التنظيمي",
    "Nasser Al-Khaldi", "ناصر الخالدي",
    "Maintains the regulatory register, tracks changes to environmental regulations and reports compliance status to leadership.",
    "تحافظ على السجل التنظيمي وتتتبع التغييرات في الأنظمة البيئية وترفع حالة الامتثال إلى القيادة."],
  ["RLR", "department", "RAS", "Regulatory and Legislative Review", "إدارة المراجعة التنظيمية والتشريعية",
    "Joud Al-Bishi", "جود البيشي",
    "Reviews draft environmental regulations and their impact, and supports the Regulatory Review Panel.",
    "تراجع مشاريع الأنظمة البيئية وأثرها، وتدعم لجنة المراجعة التنظيمية."],
  ["DKS", "sector", "OPD", "Data and Knowledge Sector", "قطاع البيانات والمعرفة",
    "Fahad Al-Zayed", "فهد الزايد",
    "Oversees environmental data production, governance and dissemination, and the knowledge management of the Office.",
    "يشرف على إنتاج البيانات البيئية وحوكمتها ونشرها، وعلى إدارة المعرفة في المكتب."],
  ["EDA", "department", "DKS", "Environmental Data Affairs", "إدارة شؤون البيانات البيئية",
    "Ghada Al-Mansour", "غادة المنصور",
    "Owns the strategy for trusted environmental data and statistics and coordinates data requests and partnerships with entities.",
    "تملك استراتيجية البيانات والإحصاءات البيئية الموثوقة وتنسق طلبات البيانات والشراكات مع الجهات."],
  ["DOP", "department", "DKS", "Data Operations", "إدارة عمليات البيانات",
    "Ibrahim Al-Sudairi", "إبراهيم السديري",
    "Runs environmental monitoring data collection, remote sensing feeds and administrative records intake, and the open data release calendar.",
    "تدير جمع بيانات الرصد البيئي وتغذيات الاستشعار عن بعد واستلام السجلات الإدارية وتقويم إصدار البيانات المفتوحة."],
  ["DSY", "department", "DKS", "Data Systems", "إدارة نظم البيانات",
    "Mishal Al-Dawsari", "مشعل الدوسري",
    "Builds and operates the data platforms, catalogues and pipelines that serve the Office.",
    "تبني وتشغل منصات البيانات والفهارس وخطوط المعالجة التي تخدم المكتب."],
  ["DQS", "department", "DKS", "Data Quality and Standards", "إدارة جودة البيانات والمعايير",
    "Shaima Al-Fayez", "شيماء الفايز",
    "Defines quality assurance rules, metadata standards and classifications, and signs off datasets before release.",
    "تحدد قواعد ضمان الجودة ومعايير البيانات الوصفية والتصنيفات، وتعتمد مجموعات البيانات قبل إصدارها."],
  ["EAS", "department", "DKS", "Environmental Accounts and Statistics", "إدارة الحسابات والإحصاءات البيئية",
    "Rakan Al-Sharif", "راكان الشريف",
    "Compiles environmental accounts and the Annual Environment Statistical Digest (illustrative) from entity and survey sources.",
    "تعد الحسابات البيئية وملخص الإحصاءات البيئية السنوي (توضيحي) من مصادر الجهات والمسوح."],
  ["DGS", "department", "DKS", "Data Governance and Security", "إدارة حوكمة البيانات وأمنها",
    "Lujain Al-Obaidi", "لجين العبيدي",
    "Sets the data governance policies, information classification and security rules, and supports the Data Governance Board.",
    "تضع سياسات حوكمة البيانات وتصنيف المعلومات وقواعد الأمن، وتدعم مجلس حوكمة البيانات."],
  ["KMD", "department", "DKS", "Knowledge Management", "إدارة المعرفة",
    "Hind Al-Ajmi", "هند العجمي",
    "Stewards institutional memory: the document library, handover of knowledge when roles change, and expert and lessons registers.",
    "تتولى رعاية الذاكرة المؤسسية: مكتبة الوثائق وتسليم المعرفة عند تغير الأدوار وسجلات الخبراء والدروس المستفادة."],
  ["DIG", "department", "CSS", "Digital", "إدارة الرقمنة",
    "Osama Al-Rumaih", "أسامة الرميح",
    "Runs the Office's digital workplace, infrastructure, information security operations and business continuity.",
    "تدير بيئة العمل الرقمية والبنية التحتية وعمليات أمن المعلومات واستمرارية الأعمال في المكتب."],
  ["DTO", "office", "OPD", "Digital Transformation Office", "مكتب التحول الرقمي",
    "Ahmed Al-Nafisi", "أحمد النفيسي",
    "Coordinates the Office's digital transformation portfolio and process automation across units.",
    "ينسق محفظة التحول الرقمي في المكتب وأتمتة العمليات بين الوحدات."],
  ["PAR", "department", "OPD", "Partnerships and International Commitments", "إدارة الشراكات والالتزامات الدولية",
    "Latifa Al-Moammar", "لطيفة المعمر",
    "Manages partnerships with entities, universities and international organisations, and engagement with global indicators and commitments.",
    "تدير الشراكات مع الجهات والجامعات والمنظمات الدولية، والتعامل مع المؤشرات والالتزامات العالمية."],
  ["COM", "department", "OPD", "Communications", "إدارة الاتصال",
    "Badr Al-Hazmi", "بدر الحازمي",
    "Plans and delivers the Office's publications, public communication and media relations.",
    "تخطط لإصدارات المكتب وتواصله مع الجمهور وعلاقاته الإعلامية وتنفذها."],
  ["CSS", "sector", "OPD", "Corporate Services Sector", "قطاع الخدمات المؤسسية",
    "Ziyad Al-Habib", "زياد الحبيب",
    "Oversees capability development, human resources, finance, administration and secretariat services of the Office.",
    "يشرف على تنمية القدرات والموارد البشرية والمالية والشؤون الإدارية وخدمات الأمانة في المكتب."],
  ["CAP", "department", "CSS", "Capability Development", "إدارة تنمية القدرات",
    "Amal Al-Rowaili", "أمل الرويلي",
    "Designs training and development programmes for Office staff and for the planning teams of partner entities.",
    "تصمم برامج التدريب والتطوير لموظفي المكتب ولفرق التخطيط في الجهات الشريكة."],
  ["HR", "department", "CSS", "Human Resources", "إدارة الموارد البشرية",
    "Sultan Al-Buraik", "سلطان البريك",
    "Manages recruitment, employee relations, performance and the HR policies of the Office, including Saudization planning where it applies.",
    "تدير الاستقطاب وعلاقات الموظفين والأداء وسياسات الموارد البشرية في المكتب، بما في ذلك تخطيط التوطين حيثما ينطبق."],
  ["FIN", "department", "CSS", "Finance and Administration", "إدارة المالية والشؤون الإدارية",
    "Mansour Al-Qarni", "منصور القرني",
    "Prepares and controls the Office budget, procurement and administrative services.",
    "تعد ميزانية المكتب وتراقبها وتدير المشتريات والخدمات الإدارية."],
  ["PSA", "department", "CSS", "Programme Secretariat Affairs", "إدارة شؤون الأمانة",
    "Danah Al-Sulaiman", "دانة السليمان",
    "Runs the secretariat of the Programme Steering Committee and the Office committees, and follows up their decisions.",
    "تتولى أمانة اللجنة التوجيهية للبرنامج ولجان المكتب وتتابع قراراتها."],
];

export const ORG_STRUCTURE_KSA: OrgStructurePayload = {
  source: "illustrative",
  source_ar: "illustrative",
  authority: "Illustrative structure of the Programme Office (fictional, for demonstration)",
  fetched_at: FETCHED_AT,
  units: ROWS.map(
    ([code, level, parent, nameEn, nameAr, headEn, headAr, mandateEn, mandateAr], i) => ({
      code,
      level,
      parent_code: parent,
      name_en: nameEn,
      name_ar: nameAr,
      head_name_en: headEn,
      head_name_ar: headAr,
      head_title_en: TITLE[level][0],
      head_title_ar: TITLE[level][1],
      mandate_en: mandateEn,
      mandate_ar: mandateAr,
      source_url: "",
      source_url_ar: "",
      fetched_at: FETCHED_AT,
      sort: i + 1,
    })
  ),
};
