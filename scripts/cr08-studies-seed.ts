/* eslint-disable no-console */
// CR08 2.2: studies (documents of type study, research, evaluation) so the
// Studies page has a designed listing. Owned by the Experts and Studies
// agent. Idempotent: the two missing knowledge types are added once; the
// eight illustrative documents are keyed by their English title and only
// created while fewer than eight study-like documents exist.
//
// Every document below is illustrative content written for the prototype:
// its summary says so and its source_ref carries the marker the Studies
// page turns into the "Illustrative" chip.
import { DATA_DIR } from "./lib/paths.mjs";
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import fs from "node:fs";
import path from "node:path";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { ulid } from "ulid";

const ILLUSTRATIVE_SOURCE_REF = "cr08-illustrative";
const now = () => new Date().toISOString();

type Study = {
  titleEn: string;
  titleAr: string;
  type: "study" | "research" | "evaluation";
  year: number;
  unit: string;
  classification: 1 | 2;
  outcomes: string[];
  topics: string[];
  summaryEn: string;
  summaryAr: string;
  keyFacts: { text_en: string; text_ar: string; page: number | null }[];
  /** one entry per page; English pages first, then the Arabic summary page */
  pages: string[];
};

const MARK_EN = "Illustrative study prepared for the EnviroAI prototype. ";
const MARK_AR = "دراسة توضيحية أُعدت لنموذج EnviroAI الأولي. ";

const STUDIES: Study[] = [
  {
    titleEn: "Irrigation Water Use and Crop Choice: Evidence from Administrative Records, 2019 to 2024",
    titleAr: "استخدام مياه الري واختيار المحاصيل: أدلة من السجلات الإدارية، 2019 إلى 2024",
    type: "study",
    year: 2025,
    unit: "AFD",
    classification: 1,
    outcomes: ["fiscal_sust"],
    topics: ["irrigation_efficiency", "food_security", "water_resources"],
    summaryEn:
      MARK_EN +
      "Links farm-level irrigation records to crop declarations for five seasons and compares water use per tonne across crop groups. Illustrative findings: fodder crops account for the largest share of irrigation volume, drip adoption lowers water per tonne for vegetables, and farms with metered wells report more consistently.",
    summaryAr:
      MARK_AR +
      "تربط سجلات الري على مستوى المزرعة بإقرارات المحاصيل لخمسة مواسم وتقارن استخدام المياه لكل طن بين مجموعات المحاصيل. النتائج توضيحية: تستحوذ محاصيل الأعلاف على أكبر حصة من حجم الري، ويخفض الري بالتنقيط المياه المستخدمة لكل طن من الخضروات، وتُبلّغ المزارع ذات الآبار المزودة بعدادات بانتظام أكبر.",
    keyFacts: [
      { text_en: "Five seasons of linked irrigation and crop declaration records (illustrative sample)", text_ar: "خمسة مواسم من سجلات الري وإقرارات المحاصيل المترابطة (عينة توضيحية)", page: 1 },
      { text_en: "Water per tonne differs several-fold across crop groups; fodder dominates total volume", text_ar: "يتفاوت استخدام المياه لكل طن عدة أضعاف بين مجموعات المحاصيل وتهيمن الأعلاف على الحجم الإجمالي", page: 2 },
      { text_en: "Metered wells improve reporting completeness and enable seasonal water budgets", text_ar: "تحسّن عدادات الآبار اكتمال التبليغ وتتيح ميزانيات مائية موسمية", page: 3 },
    ],
    pages: [
      "1. Purpose and data. This illustrative study asks how irrigation water use varies with crop choice and irrigation technology. It links farm-level irrigation records held by the agriculture programme to seasonal crop declarations for five seasons, and groups crops into fodder, cereals, vegetables, fruit and date palms. Water use is expressed per tonne harvested and per hectare. The design follows the national water accounting concepts described in the General Authority for Statistics methodology and quality report for water accounts, so that results can be reconciled with the official accounts.",
      "2. Findings. Water per tonne differs several-fold across crop groups, and fodder crops account for the largest share of irrigation volume in the sample. Farms using drip irrigation for vegetables use markedly less water per tonne than farms using flood methods, while the gap for date palms is smaller. Seasonal variation is large and tracks groundwater pumping costs more closely than rainfall. The findings are indicative only because the sample and values in this document are illustrative.",
      "3. Recommendations. The study recommends metering all irrigation wells above a size threshold so that seasonal water budgets can be set per farm, reporting water per tonne by crop group in the Agriculture and Food Security theme, and testing a crop advisory service that shows each farm its position against peers. It also proposes that irrigation records adopt the same crop classification as the crop declarations so that linkage no longer needs a manual matching pass.",
      "ملخص. تبحث هذه الدراسة التوضيحية في كيفية تباين استخدام مياه الري بحسب المحصول وتقنية الري. تربط سجلات الري على مستوى المزرعة بإقرارات المحاصيل الموسمية لخمسة مواسم، وتصنف المحاصيل إلى أعلاف وحبوب وخضروات وفاكهة ونخيل. تتفاوت المياه المستخدمة لكل طن عدة أضعاف بين المجموعات، وتستحوذ الأعلاف على أكبر حصة من الحجم. توصي الدراسة بتركيب عدادات على الآبار الكبيرة لوضع ميزانيات مائية موسمية، وبنشر المياه لكل طن بحسب مجموعة المحصول في محور الأمن الغذائي والزراعة، وبتجريب خدمة إرشاد للمزارعين، وبتوحيد تصنيف المحاصيل بين سجلات الري والإقرارات.",
    ],
  },
  {
    titleEn: "Measuring Water Security: A Composite Index for Saudi Arabia",
    titleAr: "قياس الأمن المائي: مؤشر مركب للمملكة العربية السعودية",
    type: "research",
    year: 2024,
    unit: "WSD",
    classification: 1,
    outcomes: ["eco_growth"],
    topics: ["water_resources", "kpi_design", "groundwater"],
    summaryEn:
      MARK_EN +
      "Proposes a composite water security index from four components aligned with the National Water Strategy 2030 themes: supply reliability, demand efficiency, groundwater sustainability and wastewater reuse. A backcast on illustrative inputs shows the direction of travel and which component moves slowest.",
    summaryAr:
      MARK_AR +
      "تقترح مؤشراً مركباً للأمن المائي من أربعة مكونات تتوافق مع محاور الاستراتيجية الوطنية للمياه 2030: موثوقية الإمداد، وكفاءة الطلب، واستدامة المياه الجوفية، وإعادة استخدام المياه المعالجة. يُظهر الحساب الرجعي على مدخلات توضيحية اتجاه التحسن والمكون الأبطأ.",
    keyFacts: [
      { text_en: "Four components aligned with the National Water Strategy 2030 themes", text_ar: "أربعة مكونات تتوافق مع محاور الاستراتيجية الوطنية للمياه 2030", page: 1 },
      { text_en: "Equal weights after a principal-component check (illustrative)", text_ar: "أوزان متساوية بعد فحص المكونات الرئيسية (توضيحي)", page: 1 },
      { text_en: "Groundwater sustainability is the slowest-moving component", text_ar: "استدامة المياه الجوفية هي المكون الأبطأ تحسناً", page: 2 },
    ],
    pages: [
      "1. Why a composite index. The National Environment Strategy tracks water security through several indicators that move at different speeds and are reported on different cadences. This paper proposes one composite index so that the direction of travel can be read at a glance and decomposed when needed. Four components are used, aligned with the themes of the National Water Strategy 2030 published by the Ministry of Environment, Water and Agriculture: supply reliability, demand efficiency, groundwater sustainability and wastewater reuse. Each component is normalised to a 0 to 100 scale against a fixed baseline and a 2030 aspiration, and a principal-component check confirms that equal weights lose little information.",
      "2. Results. A backcast on illustrative inputs shows the index rising over the period, with most of the gain coming from supply reliability and demand efficiency. Groundwater sustainability is the slowest-moving component because aquifer recovery operates over decades, so the paper recommends reading it over a rolling five-year window. Wastewater reuse improves in steps that follow treatment capacity coming online. All values here are illustrative and are not official statistics.",
      "3. Use in the strategy. The paper recommends that the index be published annually with its four components, that the groundwater component draw on the Saudi Geological Survey and Saudi Water Authority records, and that the aspiration values be revisited when the national water accounts are revised. A sensitivity annex shows the index is robust to alternative weights within a narrow band.",
      "ملخص. تقترح هذه الورقة مؤشراً مركباً للأمن المائي من أربعة مكونات تتوافق مع محاور الاستراتيجية الوطنية للمياه 2030 الصادرة عن وزارة البيئة والمياه والزراعة: موثوقية الإمداد، وكفاءة الطلب، واستدامة المياه الجوفية، وإعادة استخدام المياه المعالجة، بأوزان متساوية جرى التحقق منها بتحليل المكونات الرئيسية. يُظهر الحساب الرجعي على مدخلات توضيحية تحسناً معظمه من موثوقية الإمداد وكفاءة الطلب، بينما تبقى استدامة المياه الجوفية الأبطأ. توصي الورقة بنشر المؤشر سنوياً مع مكوناته، وبقراءة المكون الجوفي على نافذة متحركة من خمس سنوات.",
    ],
  },
  {
    titleEn: "Mid-term Evaluation of the Environmental Data Governance Programme",
    titleAr: "تقييم منتصف المدة لبرنامج حوكمة البيانات البيئية",
    type: "evaluation",
    year: 2025,
    unit: "EDA",
    classification: 2,
    outcomes: ["gov_excellence"],
    topics: ["data_governance", "data_quality", "data_sharing"],
    summaryEn:
      MARK_EN +
      "Assesses the first two years of the programme against its results framework. Fourteen of twenty-two entities have appointed data stewards and published data inventories; the sharing agreement template cut negotiation time from a median of seven months to eleven weeks; quality scoring is live for 31 of 60 priority datasets.",
    summaryAr:
      MARK_AR +
      "يقيّم السنتين الأوليين من البرنامج مقابل إطار نتائجه. عيّنت أربع عشرة جهة من اثنتين وعشرين مسؤولي بيانات ونشرت جرود البيانات، وقلّص قالب اتفاقية التبادل زمن التفاوض من سبعة أشهر إلى أحد عشر أسبوعاً، ويعمل تقييم الجودة لإحدى وثلاثين من ستين مجموعة بيانات ذات أولوية.",
    keyFacts: [
      { text_en: "14 of 22 entities have appointed data stewards", text_ar: "14 من 22 جهة عيّنت مسؤولي بيانات", page: 2 },
      { text_en: "Sharing agreement negotiation: median 11 weeks, down from 7 months", text_ar: "التفاوض على اتفاقيات التبادل: 11 أسبوعاً بدلاً من 7 أشهر", page: 2 },
      { text_en: "Quality scores live for 31 of 60 priority datasets", text_ar: "درجات الجودة متاحة لـ31 من 60 مجموعة بيانات ذات أولوية", page: 3 },
    ],
    pages: [
      "1. Scope and method. This mid-term evaluation covers the first two years of the Environmental Data Governance Programme. It uses the programme's own results framework, administrative records from the Environmental Data Affairs unit, a survey of the twenty-two participating entities and eighteen key-informant interviews. Evaluation questions cover relevance, effectiveness, efficiency and early signs of sustainability. The evaluation was conducted internally with an external methodological advisor and follows the evaluation guidance in the NES results framework manual.",
      "2. Effectiveness. Fourteen of the twenty-two entities have appointed data stewards and published their data inventories, against a mid-term target of sixteen. The standard data-sharing agreement template is the programme's clearest success: the median negotiation time for a new agreement fell from seven months to eleven weeks, and forty-one agreements are now in force. Entities cite legal review capacity, not willingness, as the remaining bottleneck. The stewards network meets monthly and its attendance has held above eighty percent.",
      "3. Data quality and recommendations. Quality scoring is live for thirty-one of the sixty priority datasets. Scores improved for twenty-four of them within two quarters of first publication, which suggests that visibility itself drives improvement. The evaluation recommends extending the template approach to metadata standards, funding a shared legal review pool for the smaller entities, and publishing the quality scores openly from 2026. Two risks are flagged: steward turnover and the absence of a sanctions mechanism for non-participation. All figures are illustrative.",
      "ملخص التقييم. يغطي تقييم منتصف المدة السنتين الأوليين من برنامج حوكمة البيانات البيئية عبر إطار نتائجه وسجلاته الإدارية ومسح للجهات المشاركة ومقابلات مع المطلعين. عيّنت 14 من 22 جهة مسؤولي بيانات ونشرت جرودها مقابل هدف 16. قلّص القالب الموحد لاتفاقيات التبادل زمن التفاوض من سبعة أشهر إلى أحد عشر أسبوعاً، وتسري الآن 41 اتفاقية. يعمل تقييم الجودة لـ31 من 60 مجموعة بيانات، وتحسنت 24 منها خلال فصلين من النشر. يوصي التقييم بتوسيع نهج القوالب إلى معايير البيانات الوصفية، وبتمويل مجمع مشترك للمراجعة القانونية، وبنشر درجات الجودة علناً من 2026.",
    ],
  },
  {
    titleEn: "Remote Sensing and Administrative Records for Biodiversity and Land Monitoring: Coverage Gaps and Remedies",
    titleAr: "الاستشعار عن بعد والسجلات الإدارية في رصد التنوع الأحيائي والأراضي: فجوات التغطية والمعالجات",
    type: "study",
    year: 2023,
    unit: "DOP",
    classification: 1,
    outcomes: ["env_sust"],
    topics: ["biodiversity", "desertification", "environment_stats", "data_quality"],
    summaryEn:
      MARK_EN +
      "Reviews how the Office combines satellite products with administrative records from the National Center for Wildlife and the National Center for Vegetation Cover Development and Combating Desertification, identifies where coverage is thin, and tests remedies in a pilot. Illustrative result: combining sources closes most gaps, and a shared land cover classification is the main enabler.",
    summaryAr:
      MARK_AR +
      "تراجع كيفية جمع المكتب بين منتجات الأقمار الصناعية والسجلات الإدارية للمركز الوطني للحياة الفطرية والمركز الوطني لتنمية الغطاء النباتي ومكافحة التصحر، وتحدد مواضع ضعف التغطية، وتختبر معالجات في مشروع تجريبي. النتيجة توضيحية: يسد الجمع بين المصادر معظم الفجوات، ويشكل تصنيف الغطاء الأرضي الموحد العامل الأهم.",
    keyFacts: [
      { text_en: "Satellite products and agency records combined for biodiversity and land indicators", text_ar: "الجمع بين منتجات الأقمار الصناعية وسجلات الجهات لمؤشرات التنوع الأحيائي والأراضي", page: 1 },
      { text_en: "Coverage is thinnest for species records outside protected areas", text_ar: "تضعف التغطية أكثر في سجلات الأنواع خارج المحميات", page: 2 },
      { text_en: "A shared land cover classification is the main enabler of linkage", text_ar: "تصنيف الغطاء الأرضي الموحد هو العامل الأهم لتحقيق الربط", page: 3 },
    ],
    pages: [
      "1. The problem. Biodiversity and land indicators depend on two kinds of evidence: satellite and remote-sensing products, and administrative or field records held by agencies. This illustrative study reviews how the Office combines them for the Biodiversity and Land theme, using records from the National Center for Wildlife and the National Center for Vegetation Cover Development and Combating Desertification, and the national reporting prepared for the UN Convention to Combat Desertification. The aim is to find where coverage is thin and what it would take to close the gaps.",
      "2. Coverage gaps. Coverage is strongest inside declared protected areas, where survey and monitoring effort is concentrated, and thinnest for species records and vegetation condition outside them. Satellite products give consistent wall-to-wall land cover but cannot report species presence. Agency records carry the species detail but follow different spatial units and classification schemes, so linking them needs manual matching. Revisit cycles for field surveys are long relative to the pace of land change in coastal and peri-urban zones. All values and findings here are illustrative.",
      "3. Remedies tested. A pilot tested three remedies: a shared land cover classification applied to both satellite and administrative layers, a common spatial grid for reporting, and a metadata template stating survey date and method for every record. The shared classification closed most of the linkage gaps in the pilot area. The study recommends adopting the classification and grid as standards, publishing the metadata template through the data governance board, and reporting coverage by zone with every release.",
      "ملخص. تعتمد مؤشرات التنوع الأحيائي والأراضي على نوعين من الأدلة: منتجات الأقمار الصناعية والاستشعار عن بعد، والسجلات الإدارية والميدانية لدى الجهات. تراجع هذه الدراسة التوضيحية كيفية جمع المكتب بينهما، وتجد أن التغطية أقوى داخل المحميات المعلنة وأضعف خارجها. تعطي الأقمار الصناعية غطاءً أرضياً متسقاً لكنها لا تبلّغ عن وجود الأنواع، بينما تحمل سجلات الجهات تفاصيل الأنواع بوحدات مكانية وتصنيفات مختلفة. أغلق تصنيف الغطاء الأرضي الموحد معظم فجوات الربط في المنطقة التجريبية. توصي الدراسة باعتماد التصنيف والشبكة المكانية معياراً، ونشر قالب البيانات الوصفية، والإبلاغ عن التغطية بحسب المنطقة.",
    ],
  },
  {
    titleEn: "Climate Transition Scenarios to 2040: Implications for Environmental Targets",
    titleAr: "سيناريوهات التحول المناخي حتى 2040: الانعكاسات على الأهداف البيئية",
    type: "research",
    year: 2026,
    unit: "FRS",
    classification: 2,
    outcomes: ["env_sust"],
    topics: ["scenario_planning", "ghg_emissions", "climate_adaptation", "foresight_methods"],
    summaryEn:
      MARK_EN +
      "Builds three illustrative climate transition scenarios to 2040 and traces what each means for emissions, water demand and the Saudi Green Initiative targets. The accelerated scenario brings forward renewable build-out but raises cooling and desalination demand; the delayed scenario leaves more adaptation cost for the 2030s.",
    summaryAr:
      MARK_AR +
      "تبني ثلاثة سيناريوهات توضيحية للتحول المناخي حتى 2040 وتتتبع معنى كل منها للانبعاثات والطلب على المياه وأهداف مبادرة السعودية الخضراء. يقدّم السيناريو المتسارع التوسع في الطاقة المتجددة لكنه يرفع الطلب على التبريد والتحلية، ويترك السيناريو المتأخر تكلفة تكيف أكبر لثلاثينيات هذا القرن.",
    keyFacts: [
      { text_en: "Three scenarios: baseline, delayed transition, accelerated transition", text_ar: "ثلاثة سيناريوهات: أساسي، تحول متأخر، تحول متسارع", page: 1 },
      { text_en: "Accelerated transition raises cooling and desalination demand alongside the emissions gains", text_ar: "يرفع التحول المتسارع الطلب على التبريد والتحلية إلى جانب مكاسب الانبعاثات", page: 2 },
      { text_en: "An early-warning indicator set is proposed for twice-yearly foresight reporting", text_ar: "يُقترح إطار مؤشرات إنذار مبكر لتقرير استشرافي نصف سنوي", page: 3 },
    ],
    pages: [
      "1. Scenarios. The paper builds three illustrative scenarios to 2040: a baseline that follows announced policies, a delayed transition in which fossil generation and cooling demand stay high into the 2030s, and an accelerated transition in which renewable build-out and efficiency standards move faster than planned. Each scenario is expressed as a path for emissions, electricity and cooling demand, and desalination demand, and is read against the Saudi Green Initiative and Middle East Green Initiative commitments and the Saudi Vision 2030 environmental targets.",
      "2. Implications. In the accelerated scenario, emissions intensity falls faster but cooling and desalination demand still rise with population and heat, so the water and energy themes are tightly coupled and must be planned together. In the delayed scenario, adaptation cost shifts into the 2030s and the exposure of coastal infrastructure and agricultural areas rises. Neither scenario is a forecast, and all quantities in this document are illustrative.",
      "3. Early warning and use. The paper proposes an early-warning indicator set built from renewable capacity additions, cooling-degree trends and desalination output, and recommends that the foresight function report it twice a year to the theme owners. It also recommends that targets for the Climate and Environment theme be tested against all three scenarios before each annual progress review.",
      "ملخص. يبني البحث ثلاثة سيناريوهات توضيحية للتحول المناخي حتى 2040: أساسي، وتحول متأخر، وتحول متسارع، ويقرأ كلاً منها في ضوء التزامات مبادرة السعودية الخضراء ومبادرة الشرق الأوسط الأخضر وأهداف رؤية السعودية 2030 البيئية. في السيناريو المتسارع تنخفض كثافة الانبعاثات أسرع لكن الطلب على التبريد والتحلية يستمر في الارتفاع، ما يستلزم تخطيط محوري المياه والطاقة معاً. يقترح البحث إطار مؤشرات إنذار مبكر وتقريراً نصف سنوي لمالكي المحاور، واختبار أهداف محور المناخ والبيئة مقابل السيناريوهات الثلاثة.",
    ],
  },
  {
    titleEn: "Evaluation of Regulatory Compliance Monitoring Services, 2021 to 2024",
    titleAr: "تقييم خدمات رصد الامتثال التنظيمي، 2021 إلى 2024",
    type: "evaluation",
    year: 2024,
    unit: "PMD",
    classification: 1,
    outcomes: ["gov_excellence"],
    topics: ["regulatory_compliance", "environmental_law", "evaluation_methods", "air_quality", "waste_management"],
    summaryEn:
      MARK_EN +
      "Evaluates whether the Office's compliance monitoring service gave leadership a timely view of permit, emissions and waste licence status across entities. Illustrative findings: coverage and timeliness improved, most overdue items sit in a few facility types, and the main gap is a shared definition of a closed finding.",
    summaryAr:
      MARK_AR +
      "يقيّم ما إذا كانت خدمة رصد الامتثال لدى المكتب قد وفّرت للقيادة رؤية في الوقت المناسب لحالة التراخيص والانبعاثات وتراخيص النفايات لدى الجهات. النتائج توضيحية: تحسنت التغطية والتوقيت، وتتركز معظم البنود المتأخرة في أنواع قليلة من المنشآت، وتتمثل الفجوة الرئيسية في غياب تعريف مشترك للملاحظة المغلقة.",
    keyFacts: [
      { text_en: "Compliance status covers permits, air emissions and waste licences", text_ar: "تغطي حالة الامتثال التراخيص وانبعاثات الهواء وتراخيص النفايات", page: 1 },
      { text_en: "Most overdue items concentrate in a few facility types", text_ar: "تتركز معظم البنود المتأخرة في أنواع قليلة من المنشآت", page: 2 },
      { text_en: "A shared definition of a closed finding is the main gap", text_ar: "الفجوة الرئيسية هي غياب تعريف مشترك للملاحظة المغلقة", page: 3 },
    ],
    pages: [
      "1. Questions and evidence. The evaluation asks whether the compliance monitoring service gave leadership a timely and consistent view of environmental permit, air emission and waste licence status, and who was left out. It combines the service's own status log, quarterly reports shared by participating entities, including data from the National Center for Environmental Compliance and the National Center for Waste Management, and interviews with service owners. All figures and findings in this document are illustrative.",
      "2. Coverage and timeliness. Reporting coverage and timeliness improved over the period as entities moved from ad hoc submissions to a quarterly cycle. Most overdue items concentrate in a small number of facility types, and entities report that renewal reminders reach the wrong contact when facility ownership changes. Air emission exceedances were easier to track than waste licence conditions because monitoring data arrives in a structured form.",
      "3. Recommendations. The evaluation recommends a shared definition of a closed finding across entities, a facility contact register maintained by the Regulatory Compliance Monitoring unit, and a quarterly dashboard owned by the monitoring function. It rates the service as effective for coverage, with efficiency gains not yet quantified because staff time was not recorded before the service started.",
      "ملخص التقييم. يسأل التقييم عما إذا كانت خدمة رصد الامتثال قد وفّرت للقيادة رؤية متسقة وفي الوقت المناسب لحالة التراخيص البيئية وانبعاثات الهواء وتراخيص النفايات. تحسنت التغطية والتوقيت مع انتقال الجهات من تقارير متفرقة إلى دورة فصلية، وتتركز معظم البنود المتأخرة في أنواع قليلة من المنشآت. يوصي التقييم بتعريف مشترك للملاحظة المغلقة، وبسجل لجهات الاتصال في المنشآت تديره إدارة متابعة الامتثال التنظيمي، ولوحة فصلية تملكها وظيفة الرصد.",
    ],
  },
  {
    titleEn: "Saudi Arabia in International Environmental Indices: Drivers of Movement, 2018 to 2025",
    titleAr: "السعودية في المؤشرات البيئية الدولية: محركات التغير، 2018 إلى 2025",
    type: "research",
    year: 2026,
    unit: "PAR",
    classification: 1,
    outcomes: ["gov_excellence", "env_sust"],
    topics: ["index_monitoring", "kpi_design", "institutional_excellence"],
    summaryEn:
      MARK_EN +
      "Proposes a method to decompose rank changes in international environmental indices, such as the Environmental Performance Index, the ND-GAIN Country Index and the SDG Index, into own-score change, peer change and methodology revisions. The method is illustrated on synthetic data and no actual ranks are claimed.",
    summaryAr:
      MARK_AR +
      "تقترح منهجية لتفكيك تغيرات الترتيب في المؤشرات البيئية الدولية، مثل مؤشر الأداء البيئي ومؤشر ND-GAIN ومؤشر أهداف التنمية المستدامة، إلى تغير الدرجة الذاتية وتغير الأقران وتعديلات المنهجية. تُوضح المنهجية على بيانات اصطناعية ولا تُنسب أي مراتب فعلية.",
    keyFacts: [
      { text_en: "Rank change split into own score, peer movement and methodology revisions", text_ar: "تفكيك تغير الترتيب إلى الدرجة الذاتية وحركة الأقران وتعديلات المنهجية", page: 1 },
      { text_en: "Method demonstrated on synthetic data, not on published ranks", text_ar: "تُوضح المنهجية على بيانات اصطناعية لا على مراتب منشورة", page: 2 },
      { text_en: "Targets are better stated as score bands than as fixed ranks", text_ar: "الأفضل صياغة الأهداف نطاقات درجات لا مراتب ثابتة", page: 3 },
    ],
    pages: [
      "1. Method. For each international index tracked in the Indices module, such as the Environmental Performance Index, the ND-GAIN Country Index and the Sustainable Development Report SDG Index, the paper proposes to reconstruct the ranked field for every edition and decompose each year's rank change into three sources: the change in Saudi Arabia's own score, the change in peers' scores holding Saudi Arabia constant, and the effect of methodology revisions identified from publisher notes. Where publishers restate prior years, the restated series is used so that revisions are not counted as score changes.",
      "2. Illustration. The method is demonstrated here on synthetic data only, to show how the decomposition reads. No actual ranks, scores or editions are reported in this document, and the shares quoted in the key facts are not findings about any real index. Applied to published data, the method would show whether movement came from the Kingdom's own performance, from peers, or from the ruler changing.",
      "3. Implications for targets. The paper recommends stating targets as score bands where the index publishes scores, treating rank as a reported outcome rather than a target for indices where many countries cluster within a few points, and annotating every rank change in the module with its decomposition. It also recommends a standing methodology watch that reads publisher notes before each release and flags revisions to theme owners.",
      "ملخص. تقترح الورقة منهجية لإعادة بناء الترتيب الكامل لكل إصدار من المؤشرات البيئية الدولية، مثل مؤشر الأداء البيئي ومؤشر ND-GAIN ومؤشر أهداف التنمية المستدامة، وتفكيك تغير ترتيب السعودية إلى تغير درجاتها الذاتية وتغير درجات الأقران وأثر تعديلات المنهجية. تُوضح المنهجية على بيانات اصطناعية فقط ولا تُورد أي مراتب أو درجات فعلية. توصي الورقة بصياغة الأهداف نطاقات درجات، ومعاملة الترتيب نتيجة مبلّغة في المؤشرات المتقاربة، وبمتابعة دائمة لمنهجيات الجهات المصدرة.",
    ],
  },
];

function slugOf(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/* One chunk per page: a study here is three English sections and one Arabic
   summary, each a citable passage of its own (the generic chunker would
   merge them into one or two 1,900-character blocks). */
function pageChunks(pages: string[]) {
  return pages.map((text, i) => {
    const heading = /^(\d+)\.\s+([^.]{3,60})\./.exec(text)?.[0]?.replace(/\.$/, "") ?? null;
    const arabic = (text.match(/[؀-ۿ]/g) ?? []).length > text.length / 4;
    return {
      index: i,
      pageFrom: i + 1,
      pageTo: i + 1,
      heading,
      text,
      lang: arabic ? "ar" : "en",
      tokenCount: Math.ceil(text.length / 3.8),
    };
  });
}

/* Illustrative documents created by an earlier version of this seed carry
   merged chunks; rebuild them page by page so every seeded study has one
   chunk per section. Only documents that carry the illustrative marker are
   touched, and only when their chunk count differs from their page count. */
async function repairChunks(
  db: Awaited<typeof import("../src/server/db/client")>["db"],
  schema: Awaited<typeof import("../src/server/db/client")>["schema"],
  existingDocs: { id: string; titleEn: string }[]
): Promise<void> {
  const byTitle = new Map(STUDIES.map((s) => [s.titleEn.toLowerCase(), s]));
  let rebuilt = 0;
  for (const d of existingDocs) {
    const s = byTitle.get(d.titleEn.toLowerCase());
    if (!s) continue;
    const [doc] = await db
      .select({ sourceRef: schema.documents.sourceRef, versionId: schema.documents.currentVersionId })
      .from(schema.documents)
      .where(eq(schema.documents.id, d.id))
      .limit(1);
    if (!doc || doc.sourceRef !== ILLUSTRATIVE_SOURCE_REF) continue;
    const have = await db
      .select({ id: schema.documentChunks.id })
      .from(schema.documentChunks)
      .where(eq(schema.documentChunks.documentId, d.id));
    if (have.length === s.pages.length) continue;
    await db.delete(schema.documentChunks).where(eq(schema.documentChunks.documentId, d.id));
    for (const c of pageChunks(s.pages)) {
      await db.insert(schema.documentChunks).values({
        id: ulid(),
        documentId: d.id,
        versionId: doc.versionId,
        chunkIndex: c.index,
        pageFrom: c.pageFrom,
        pageTo: c.pageTo,
        heading: c.heading,
        text: c.text,
        lang: c.lang,
        tokenCount: c.tokenCount,
      });
    }
    try {
      const { embedDocumentChunks } = await import("../src/server/ingest/pipeline");
      await embedDocumentChunks(d.id);
    } catch (e) {
      console.warn("cr08 studies: re-embedding skipped:", String((e as Error)?.message ?? e).slice(0, 120));
    }
    rebuilt++;
  }
  if (rebuilt) console.log(`cr08 studies: chunks rebuilt page by page for ${rebuilt} documents`);
}

export default async function seedCr08Studies(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const stamp = now();

  /* 1. the two missing knowledge types */
  const [dim] = await db
    .select({ id: schema.taxonomyDimensions.id })
    .from(schema.taxonomyDimensions)
    .where(eq(schema.taxonomyDimensions.code, "knowledge_type"))
    .limit(1);
  if (!dim) throw new Error("knowledge_type dimension missing; run the base seed first");
  const typeTerms = await db
    .select({ id: schema.taxonomyTerms.id, code: schema.taxonomyTerms.code, sort: schema.taxonomyTerms.sort })
    .from(schema.taxonomyTerms)
    .where(eq(schema.taxonomyTerms.dimensionId, dim.id));
  const typeId = new Map(typeTerms.map((t) => [t.code, t.id]));
  const studySort = typeTerms.find((t) => t.code === "study")?.sort ?? 0;
  const wanted: { code: string; nameEn: string; nameAr: string; descriptionEn: string; descriptionAr: string }[] = [
    {
      code: "research",
      nameEn: "Research",
      nameAr: "بحث",
      descriptionEn: "A research paper or analytical study with a stated method and findings",
      descriptionAr: "ورقة بحثية أو دراسة تحليلية بمنهجية معلنة ونتائج",
    },
    {
      code: "evaluation",
      nameEn: "Evaluation",
      nameAr: "تقييم",
      descriptionEn: "An evaluation of a programme, project or policy against its results",
      descriptionAr: "تقييم لبرنامج أو مشروع أو سياسة مقابل نتائجه",
    },
  ];
  let termsAdded = 0;
  for (const w of wanted) {
    if (typeId.has(w.code)) continue;
    const id = ulid();
    await db.insert(schema.taxonomyTerms).values({
      id,
      dimensionId: dim.id,
      parentId: null,
      code: w.code,
      nameEn: w.nameEn,
      nameAr: w.nameAr,
      descriptionEn: w.descriptionEn,
      descriptionAr: w.descriptionAr,
      sort: studySort,
      isActive: 1,
    });
    typeId.set(w.code, id);
    termsAdded++;
  }
  console.log(`cr08 studies: ${termsAdded} knowledge types added (research, evaluation)`);

  /* 2. eight illustrative documents while fewer than eight exist */
  const studyTypeIds = ["study", "research", "evaluation"].map((c) => typeId.get(c)!).filter(Boolean);
  const existingDocs = await db
    .select({ id: schema.documents.id, titleEn: schema.documents.titleEn })
    .from(schema.documents)
    .where(and(inArray(schema.documents.knowledgeTypeTermId, studyTypeIds), isNull(schema.documents.deletedAt)));
  const haveTitle = new Set(existingDocs.map((d) => d.titleEn.toLowerCase()));
  if (existingDocs.length >= 8 && !STUDIES.some((s) => !haveTitle.has(s.titleEn.toLowerCase()))) {
    console.log(`cr08 studies: ${existingDocs.length} study-like documents already present, nothing to add`);
    await repairChunks(db, schema, existingDocs);
    return;
  }

  const [owner] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, "knowledge@enviroai.demo"))
    .limit(1);
  const allTerms = await db
    .select({
      id: schema.taxonomyTerms.id,
      code: schema.taxonomyTerms.code,
      dimension: schema.taxonomyDimensions.code,
    })
    .from(schema.taxonomyTerms)
    .innerJoin(schema.taxonomyDimensions, eq(schema.taxonomyDimensions.id, schema.taxonomyTerms.dimensionId));
  const termByKey = new Map(allTerms.map((t) => [`${t.dimension}:${t.code}`, t.id]));
  const units = await db.select({ id: schema.orgUnits.id, code: schema.orgUnits.code }).from(schema.orgUnits);
  const unitId = new Map(units.map((u) => [u.code, u.id]));

  const dataDir = DATA_DIR;
  let created = 0;
  const createdIds: string[] = [];
  for (const s of STUDIES) {
    if (haveTitle.has(s.titleEn.toLowerCase())) continue;
    const documentId = ulid();
    const versionId = ulid();
    const filename = `${slugOf(s.titleEn)}.txt`;
    const text = s.pages.join("\n\n");
    const uploadDir = path.join(dataDir, "uploads", documentId);
    fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, filename), text, "utf8");
    fs.writeFileSync(path.join(uploadDir, "extracted.txt"), text, "utf8");
    const storagePath = path.join("data", "uploads", documentId, filename).replace(/\\/g, "/");

    await db.insert(schema.documents).values({
      id: documentId,
      titleEn: s.titleEn,
      titleAr: s.titleAr,
      summaryEn: s.summaryEn,
      summaryAr: s.summaryAr,
      keyFactsJson: JSON.stringify(s.keyFacts),
      knowledgeTypeTermId: typeId.get(s.type) ?? null,
      classificationLevel: s.classification,
      departmentId: unitId.get(s.unit) ?? null,
      ownerUserId: owner?.id ?? null,
      languageOriginal: "en",
      status: "verified",
      verifiedBy: owner?.id ?? null,
      // verified dates spread so "latest verified" is deterministic
      verifiedAt: new Date(Date.UTC(s.year, 5, 15 + STUDIES.indexOf(s))).toISOString(),
      sourceOrigin: "org",
      publishYear: s.year,
      originalFilename: filename,
      mime: "text/plain",
      sizeBytes: Buffer.byteLength(text, "utf8"),
      pageCount: s.pages.length,
      storagePath,
      currentVersionId: versionId,
      reviewDueAt: new Date(Date.now() + 365 * 86400000).toISOString(),
      isSeeded: 1,
      sourceRef: ILLUSTRATIVE_SOURCE_REF,
      createdAt: stamp,
      updatedAt: stamp,
    });
    await db.insert(schema.documentVersions).values({
      id: versionId,
      documentId,
      versionNo: 1,
      storagePath,
      uploadedBy: owner?.id ?? null,
      note: "Illustrative seed",
      createdAt: stamp,
    });
    for (const code of s.outcomes) {
      const tid = termByKey.get(`outcome:${code}`);
      if (!tid) continue;
      await db.insert(schema.taggings).values({
        id: ulid(),
        resourceType: "document",
        resourceId: documentId,
        termId: tid,
        source: "human",
        createdBy: owner?.id ?? null,
        createdAt: stamp,
      });
    }
    for (const code of s.topics) {
      const tid = termByKey.get(`topic:${code}`) ?? termByKey.get(`sector:${code}`);
      if (!tid) continue;
      await db.insert(schema.taggings).values({
        id: ulid(),
        resourceType: "document",
        resourceId: documentId,
        termId: tid,
        source: "human",
        createdBy: owner?.id ?? null,
        createdAt: stamp,
      });
    }
    const chunks = pageChunks(s.pages);
    for (const c of chunks) {
      await db.insert(schema.documentChunks).values({
        id: ulid(),
        documentId,
        versionId,
        chunkIndex: c.index,
        pageFrom: c.pageFrom,
        pageTo: c.pageTo,
        heading: c.heading,
        text: c.text,
        lang: c.lang,
        tokenCount: c.tokenCount,
      });
    }
    created++;
    createdIds.push(documentId);
    console.log(`   ${s.type} ${s.year}: ${s.titleEn} (${chunks.length} chunks)`);
  }
  console.log(`cr08 studies: ${created} illustrative documents created`);
  await repairChunks(db, schema, existingDocs);

  /* 3. embeddings and the search index; the network may be unavailable */
  if (createdIds.length) {
    try {
      const { embedDocumentChunks } = await import("../src/server/ingest/pipeline");
      const { embedStructuredRecords } = await import("../src/server/search/records");
      for (const id of createdIds) {
        await embedDocumentChunks(id);
        await embedStructuredRecords("document", id);
      }
      console.log(`cr08 studies: ${createdIds.length} documents embedded and indexed`);
    } catch (e) {
      console.warn("cr08 studies: embedding skipped:", String((e as Error)?.message ?? e).slice(0, 120));
    }
  }
}

const isMain = process.argv[1] && /cr08-studies-seed\.ts$/.test(process.argv[1]);
if (isMain) {
  seedCr08Studies()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
