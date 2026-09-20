// CR08 4.1: index definitions of the second research agent: Competitiveness
// additions (Index of Economic Freedom, Global Financial Centres Index),
// Environment and Climate (Climate Change Performance Index), Peace and
// Security (Global Terrorism Index, Safe Cities Index) and Digital and AI
// (Government AI Readiness Index, IMD World Digital Competitiveness, GovTech
// Maturity Index). Every value the fetcher stores for these comes from a
// publisher file it downloads (Heritage data workbooks, the World Bank
// GovTech workbook) or from sources/indices/research/cr08-<code>.json, each
// observation carrying the URL it was read from. Nothing is invented; the
// gaps are recorded in sources/indices/research/cr08-coverage-b.md.
import type { Cr08IndexDef } from "./defs-cr08";

export const CR08_INDEX_DEFS_B: Cr08IndexDef[] = [
  {
    code: "economic_freedom",
    nameEn: "Index of Economic Freedom",
    nameAr: "مؤشر الحرية الاقتصادية",
    publisher: "The Heritage Foundation",
    publisherUrl: "https://economicfreedom.heritage.org/",
    methodologyEn:
      "Twelve quantitative and qualitative factors in four pillars (rule of law, government size, regulatory efficiency, open markets), each scored 0-100 and averaged with equal weight. Annual, about 176 graded economies of 184.",
    methodologyAr:
      "اثنا عشر عاملًا كميًا ونوعيًا في أربع ركائز (سيادة القانون، وحجم الحكومة، والكفاءة التنظيمية، وانفتاح الأسواق)، يُقيَّم كل منها من 0 إلى 100 ويُحسب متوسطها بأوزان متساوية. يصدر سنويًا ويغطي نحو 176 اقتصادًا مصنفًا من أصل 184.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 100,
    higherIsBetter: true,
    frequency: "annual",
    category: "economy",
    responsibleEntityName: "Ministry of Commerce and Industry",
    linkedTargetKeywords: ["business environment", "competitiveness", "investment"],
    sourceNotes:
      "Publisher data workbooks 2024-2026 (static.heritage.org, every graded economy; ranks derived by sorting the official overall scores, ties sharing a rank, and cross-checked with Qatar's published world rank in the country profiles). Qatar 2019-2023 scores read from the Heritage country profile trend charts; the 2023 rank from Global Finance's reproduction of the 2023 table (secondary). Heritage breaks score ties on unrounded values, so Qatar's published 2025 rank (27) is kept over the derived 26.",
    groups: ["competitiveness"],
    forecastMode: "score",
  },
  {
    code: "gfci",
    nameEn: "Global Financial Centres Index",
    nameAr: "مؤشر المراكز المالية العالمية",
    publisher: "Z/Yen Group and China Development Institute",
    publisherUrl: "https://www.longfinance.net/programmes/financial-centre-futures/global-financial-centres-index/",
    methodologyEn:
      "Ranks about 120 financial centres twice a year (March and September) from instrumental factors and a practitioner questionnaire; ratings are on a 1,000-point scale and rebased each edition, so the rank is the comparable headline. SiaNexus stores the September edition of each year and, for the benchmark countries, the country's highest-ranked centre in that edition (Doha for Qatar; Dubai, Riyadh, Kuwait City, Bahrain, New York, London, Singapore, Seoul, Istanbul, Casablanca, Frankfurt, Paris, Tokyo, Shanghai, GIFT City or Mumbai).",
    methodologyAr:
      "يرتب نحو 120 مركزًا ماليًا مرتين في السنة (مارس وسبتمبر) اعتمادًا على عوامل كمية واستبيان للممارسين؛ التقييم على مقياس من 1,000 نقطة يُعاد ضبطه في كل إصدار، ولذلك يبقى الترتيب هو المؤشر القابل للمقارنة. يحفظ سيا نكسس إصدار سبتمبر من كل عام، ولدول المقارنة المركز الأعلى ترتيبًا في تلك الدولة (الدوحة لقطر).",
    scale: "both",
    scoreMin: 0,
    scoreMax: 1000,
    higherIsBetter: true,
    frequency: "semi-annual",
    category: "economy",
    responsibleEntityName: "Qatar Financial Centre Authority",
    linkedTargetKeywords: ["financial", "finance", "fintech"],
    sourceNotes:
      "Official GFCI report PDFs (Long Finance): GFCI 32 (September 2022), 34 (2023), 36 (2024), 38 (2025) and 40 (2026), Table 1 ranks and ratings. Oman, Egypt and Jordan have no centre in the index. The March editions are noted in the research file but not stored (one row per year).",
    groups: ["competitiveness"],
    forecastMode: "rank",
  },
  {
    code: "ccpi",
    nameEn: "Climate Change Performance Index",
    nameAr: "مؤشر أداء تغير المناخ",
    publisher: "Germanwatch, NewClimate Institute and Climate Action Network",
    publisherUrl: "https://ccpi.org/",
    methodologyEn:
      "Fourteen indicators in four categories (greenhouse gas emissions 40 percent, renewable energy 20, energy use 20, climate policy 20) for 63 countries plus the EU that together emit about 90 percent of global greenhouse gases; score 0-100, published each year at the COP. The first three ranks are left empty because no country performs at the very-high level in every category. Qatar is not among the assessed countries.",
    methodologyAr:
      "أربعة عشر مؤشرًا في أربع فئات (انبعاثات غازات الدفيئة 40 بالمئة، والطاقة المتجددة 20، واستخدام الطاقة 20، وسياسات المناخ 20) لثلاث وستين دولة والاتحاد الأوروبي تمثل معًا نحو 90 بالمئة من الانبعاثات العالمية؛ الدرجة من 0 إلى 100 ويصدر سنويًا عند مؤتمر الأطراف. تُترك المراتب الثلاث الأولى شاغرة لأن أي دولة لا تبلغ المستوى المرتفع جدًا في كل الفئات. قطر ليست ضمن الدول المقيَّمة.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 100,
    higherIsBetter: true,
    frequency: "annual",
    category: "environment",
    responsibleEntityName: "Ministry of Environment and Climate Change",
    linkedTargetKeywords: ["climate", "emissions", "renewable"],
    sourceNotes:
      "Official CCPI results PDFs 2023-2026 (partner-hosted copies of the Germanwatch results publications, cited per row). Qatar is not covered, so the record carries only the benchmark countries (Saudi Arabia, the UAE from the 2024 edition, the United States, the United Kingdom, South Korea, Türkiye, Egypt, Morocco, Germany, France, Japan, China, India). The CCPI 2022 results PDF was not reachable through the corporate proxy.",
    groups: ["environment"],
    forecastEnabled: false,
  },
  {
    code: "gti",
    nameEn: "Global Terrorism Index",
    nameAr: "مؤشر الإرهاب العالمي",
    publisher: "Institute for Economics and Peace",
    publisherUrl: "https://www.visionofhumanity.org/maps/global-terrorism-index/",
    methodologyEn:
      "Composite score 0-10 of the impact of terrorism over the past five years (incidents, deaths, injuries, hostages, weighted toward recent years) for 163 countries. A LOWER score is better and 0 means no impact; the published rank counts from the most impacted country (rank 1) down, so countries with no impact share the last rank. Qatar has scored 0 in every edition stored.",
    methodologyAr:
      "درجة مركبة من 0 إلى 10 لأثر الإرهاب خلال السنوات الخمس الماضية (الحوادث والوفيات والإصابات والرهائن مع ترجيح السنوات الأحدث) لـ163 دولة. الدرجة الأدنى أفضل والصفر يعني انعدام الأثر؛ ويبدأ الترتيب المنشور من الدولة الأكثر تأثرًا (المرتبة 1) نزولًا، فتتقاسم الدول التي لا أثر فيها المرتبة الأخيرة. سجلت قطر صفرًا في كل الإصدارات المحفوظة.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 10,
    higherIsBetter: false,
    frequency: "annual",
    category: "society",
    responsibleEntityName: "Ministry of Interior",
    linkedTargetKeywords: ["security", "safety"],
    sourceNotes:
      "Official IEP report PDFs (GTI 2022, 2025 and 2026 results tables; the 2023 and 2024 reports exceed the fetch tool's 10 MB limit and were not read). Rank semantics are the publisher's (1 = most impacted); the forecast runs on the score so the rank direction does not mislead it.",
    groups: ["peace"],
    forecastMode: "score",
  },
  {
    code: "safe_cities",
    nameEn: "Safe Cities Index",
    nameAr: "مؤشر المدن الآمنة",
    publisher: "Economist Impact (Economist Intelligence Unit), sponsored by NEC",
    publisherUrl: "https://impact.economist.com/projects/safe-cities/",
    methodologyEn:
      "City-level index of digital, health, infrastructure, personal and (since 2021) environmental security, score 0-100, for 50 cities in 2015 and 60 cities in 2017, 2019 and 2021. SiaNexus stores each country's best-placed assessed city: Doha for Qatar (assessed in 2015 and 2017 only), Abu Dhabi, Kuwait City, Riyadh, New York or Washington DC, London, Singapore, Seoul, Istanbul, Casablanca, Cairo, Frankfurt, Paris, Tokyo, Shanghai or Beijing, Delhi or Mumbai.",
    methodologyAr:
      "مؤشر على مستوى المدن للأمن الرقمي والصحي وأمن البنية التحتية والأمن الشخصي (والبيئي منذ 2021)، بدرجة من 0 إلى 100، لخمسين مدينة في 2015 وستين مدينة في 2017 و2019 و2021. يحفظ سيا نكسس المدينة الأفضل ترتيبًا من كل دولة: الدوحة لقطر (قُيِّمت في 2015 و2017 فقط).",
    scale: "both",
    scoreMin: 0,
    scoreMax: 100,
    higherIsBetter: true,
    frequency: "biennial",
    category: "society",
    responsibleEntityName: "Ministry of Interior",
    linkedTargetKeywords: ["safety", "security", "quality of life"],
    sourceNotes:
      "2015 from the EIU white paper (Appendix 1, copy hosted by the Global Disaster Preparedness Center) and 2019 from the EIU results table (newspaper-hosted copy of the report page); Doha was dropped from the 2019 and 2021 editions, so Qatar's series ends in 2015 in this store. The 2017 report (which placed Doha) is served only from safecities.economist.com, which the fetch tools cannot reach, so it is recorded as a gap rather than copied from press summaries. Forecasting is off: no current Qatar coverage.",
    groups: ["peace"],
    forecastEnabled: false,
  },
  {
    code: "ai_readiness",
    nameEn: "Government AI Readiness Index",
    nameAr: "مؤشر جاهزية الحكومات للذكاء الاصطناعي",
    publisher: "Oxford Insights",
    publisherUrl: "https://oxfordinsights.com/ai-readiness/",
    methodologyEn:
      "Measures how ready governments are to implement AI in public services: 2025 uses 69 indicators in 14 dimensions and six pillars (policy capacity, governance, AI infrastructure, public sector adoption, development and diffusion, resilience), score 0-100, 195 countries. Annual since 2017; the 2025 edition was re-issued in January 2026 with validated data.",
    methodologyAr:
      "يقيس جاهزية الحكومات لتطبيق الذكاء الاصطناعي في الخدمات العامة: تستخدم نسخة 2025 تسعة وستين مؤشرًا في أربعة عشر بعدًا وست ركائز (القدرة على السياسات، والحوكمة، وبنية الذكاء الاصطناعي، وتبني القطاع العام، والتطوير والانتشار، والمرونة)، بدرجة من 0 إلى 100 لـ195 دولة. يصدر سنويًا منذ 2017؛ وأُعيد إصدار نسخة 2025 في يناير 2026 ببيانات مدققة.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 100,
    higherIsBetter: true,
    frequency: "annual",
    category: "technology",
    responsibleEntityName: "Ministry of Communications and Information Technology",
    linkedTargetKeywords: ["digital", "artificial intelligence", "technology", "government excellence"],
    sourceNotes:
      "Official Oxford Insights report PDFs 2021-2025. 2021-2023 and 2025 ranks as printed; 2024 ranks derived by sorting the report's full country table (188 countries; the printed top five confirmed). The January 2026 re-issue of the 2025 report prints ranks and pillar scores but overall scores only in the narrative, so 2025 overall scores exist for the countries the report states (United States, France, United Kingdom, Saudi Arabia, India, Türkiye).",
    groups: ["digital"],
  },
  {
    code: "imd_digital",
    nameEn: "IMD World Digital Competitiveness Ranking",
    nameAr: "تصنيف IMD للتنافسية الرقمية العالمية",
    publisher: "IMD World Competitiveness Center",
    publisherUrl: "https://www.imd.org/centers/wcc/world-competitiveness-center/rankings/world-digital-competitiveness-ranking/",
    methodologyEn:
      "Ranks 69 economies (2025) on the capacity to adopt and explore digital technologies across three factors (knowledge, technology, future readiness) from hard statistics and the executive opinion survey. The score is an index rebased to the leader (100) each year, so the rank is the comparable series. Annual since 2017; Qatar entered in 2020.",
    methodologyAr:
      "يرتب 69 اقتصادًا (2025) وفق القدرة على تبني التقنيات الرقمية واستكشافها عبر ثلاثة عوامل (المعرفة، والتقنية، والجاهزية للمستقبل) من إحصاءات صلبة واستطلاع آراء المديرين التنفيذيين. الدرجة مؤشر يُعاد ضبطه إلى المتصدر (100) كل عام، ولذلك يبقى الترتيب هو السلسلة القابلة للمقارنة. يصدر سنويًا منذ 2017؛ ودخلته قطر في 2020.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 100,
    higherIsBetter: true,
    frequency: "annual",
    category: "technology",
    responsibleEntityName: "Ministry of Communications and Information Technology",
    linkedTargetKeywords: ["digital", "technology", "competitiveness"],
    sourceNotes:
      "Official IMD report PDFs: 2025 (imd.widen.net), 2024 and 2023 (institutional copies of the IMD report), overall tables with scores; 2021-2022 ranks from the five-year table in the 2025 report (no scores). Egypt and Morocco are not covered.",
    groups: ["digital"],
    forecastMode: "rank",
  },
  {
    code: "govtech",
    nameEn: "GovTech Maturity Index",
    nameAr: "مؤشر نضج التقنية الحكومية",
    publisher: "World Bank",
    publisherUrl: "https://www.worldbank.org/en/programs/govtech/gtmi-data-info",
    methodologyEn:
      "Composite 0-1 of four sub-indices (core government systems, public service delivery, digital citizen engagement, GovTech enablers) from a survey of 197-198 economies, published in 2020, 2022 and 2025 with maturity groups A (very high) to D (low). The Bank publishes scores and groups, not ranks; SiaNexus derives ranks by sorting the official scores.",
    methodologyAr:
      "مؤشر مركب من 0 إلى 1 لأربعة مؤشرات فرعية (الأنظمة الحكومية الأساسية، وتقديم الخدمات العامة، ومشاركة المواطنين الرقمية، وممكّنات التقنية الحكومية) من مسح يغطي 197 إلى 198 اقتصادًا، صدر في 2020 و2022 و2025 مع مجموعات نضج من A (مرتفع جدًا) إلى D (منخفض). ينشر البنك الدرجات والمجموعات لا الترتيب؛ ويستخرج سيا نكسس الترتيب بفرز الدرجات الرسمية.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 1,
    higherIsBetter: true,
    frequency: "biennial",
    category: "technology",
    responsibleEntityName: "Ministry of Communications and Information Technology",
    linkedTargetKeywords: ["digital", "government excellence", "services", "e-government"],
    sourceNotes:
      "World Bank GovTech Dataset, December 2025 workbook (sheet GTMI_Data carries the 2020, 2022 and 2025 editions for every economy), downloaded whole from the Data Catalog; ranks derived by sorting the official GTMI scores (Qatar's derived 2022 rank, 16 of 198, matches the MCIT announcement).",
    groups: ["digital"],
  },
];
