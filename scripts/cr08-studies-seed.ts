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

const MARK_EN = "Illustrative study prepared for the SiaNexus prototype. ";
const MARK_AR = "دراسة توضيحية أُعدت لنموذج سيا نكسس الأولي. ";

const STUDIES: Study[] = [
  {
    titleEn: "Labour Market Transitions of Qatari Graduates, 2019 to 2024",
    titleAr: "انتقال الخريجين القطريين إلى سوق العمل، 2019 إلى 2024",
    type: "study",
    year: 2025,
    unit: "SDP",
    classification: 1,
    outcomes: ["workforce"],
    topics: ["labour_market", "qatarization", "education_stats"],
    summaryEn:
      MARK_EN +
      "Tracks five graduate cohorts from university exit into first employment using linked administrative records. Median time to first job fell from 9.1 to 6.4 months; private-sector first placements rose from 18 to 27 percent; STEM graduates enter faster but change employers more often.",
    summaryAr:
      MARK_AR +
      "تتبع خمس دفعات من الخريجين من التخرج الجامعي حتى أول وظيفة باستخدام سجلات إدارية مترابطة. انخفض متوسط الزمن حتى أول وظيفة من 9.1 إلى 6.4 شهراً، وارتفعت نسبة التعيين الأول في القطاع الخاص من 18 إلى 27 في المئة، ويدخل خريجو العلوم والتقنية أسرع لكنهم يغيرون أصحاب العمل أكثر.",
    keyFacts: [
      { text_en: "Median time to first job: 6.4 months for the 2024 cohort, down from 9.1 in 2019", text_ar: "متوسط الزمن حتى أول وظيفة: 6.4 شهراً لدفعة 2024 مقابل 9.1 في 2019", page: 2 },
      { text_en: "Private-sector first placements: 27 percent of the 2024 cohort", text_ar: "التعيين الأول في القطاع الخاص: 27 في المئة من دفعة 2024", page: 2 },
      { text_en: "STEM graduates change employer within two years at twice the rate of other fields", text_ar: "يغير خريجو العلوم والتقنية صاحب العمل خلال سنتين بضعف معدل التخصصات الأخرى", page: 3 },
    ],
    pages: [
      "1. Purpose and data. This study follows five cohorts of Qatari graduates, from the 2019 to the 2024 academic years, from the month they left university to the month of their first recorded employment. It links the higher education graduate register to the social insurance and civil service payroll extracts held by the statistics programme, giving a monthly view of transitions for 11,400 graduates. Fields of study are grouped into six families and employers into public, government-related and private categories. The study answers three questions: how long the transition takes, where graduates go first, and how stable the first placement is.",
      "2. Findings on speed and destination. The median time to first employment fell from 9.1 months for the 2019 cohort to 6.4 months for the 2024 cohort, with the sharpest fall between 2021 and 2022 when placement programmes were expanded. Private-sector first placements rose from 18 to 27 percent of the cohort, while direct entry into ministries fell from 51 to 42 percent. Female graduates now transition in the same median time as male graduates; five years earlier the gap was 2.3 months. Graduates in health and education fields show the shortest transitions because of sector recruitment agreements signed on graduation.",
      "3. Stability and recommendations. Two-year retention with the first employer stands at 71 percent overall. STEM graduates change employer within two years at twice the rate of other fields, mostly moving within the private sector towards larger firms. The study recommends that the workforce outcome indicators add a retention measure alongside the placement rate, that placement programmes report private-sector share quarterly, and that the graduate register carry a stable person identifier so future cohorts can be followed without record linkage passes.",
      "ملخص تنفيذي. تتبع هذه الدراسة خمس دفعات من الخريجين القطريين من التخرج حتى أول وظيفة مسجلة عبر ربط سجل الخريجين ببيانات التأمينات الاجتماعية والرواتب الحكومية لنحو 11,400 خريج. انخفض متوسط الزمن حتى أول وظيفة من 9.1 إلى 6.4 شهراً، وارتفعت حصة القطاع الخاص في التعيين الأول من 18 إلى 27 في المئة، وتساوى زمن الانتقال بين الخريجات والخريجين بعد أن كانت الفجوة 2.3 شهراً. يبلغ الاحتفاظ بصاحب العمل الأول خلال سنتين 71 في المئة. توصي الدراسة بإضافة مؤشر للاحتفاظ إلى جانب معدل التعيين، وبتقارير فصلية عن حصة القطاع الخاص، وبمعرّف ثابت للشخص في سجل الخريجين.",
    ],
  },
  {
    titleEn: "Measuring Economic Diversification: A Composite Index for Qatar",
    titleAr: "قياس التنويع الاقتصادي: مؤشر مركب لدولة قطر",
    type: "research",
    year: 2024,
    unit: "EDP",
    classification: 1,
    outcomes: ["eco_growth"],
    topics: ["economic_diversification", "national_accounts", "kpi_design"],
    summaryEn:
      MARK_EN +
      "Proposes a composite diversification index from four components: non-hydrocarbon share of GDP, export concentration, private-sector employment share and revenue concentration. Backcast to 2011, the index rises 14 points, most of it after 2017, with export concentration the slowest-moving component.",
    summaryAr:
      MARK_AR +
      "تقترح مؤشراً مركباً للتنويع من أربعة مكونات: حصة القطاعات غير الهيدروكربونية من الناتج، وتركّز الصادرات، وحصة العمالة في القطاع الخاص، وتركّز الإيرادات. عند إعادة حسابه إلى 2011 يرتفع المؤشر 14 نقطة، معظمها بعد 2017، ويبقى تركّز الصادرات المكون الأبطأ.",
    keyFacts: [
      { text_en: "Four components, equal weights after a principal-component check", text_ar: "أربعة مكونات بأوزان متساوية بعد فحص المكونات الرئيسية", page: 1 },
      { text_en: "Index up 14 points between 2011 and 2023, from 41 to 55", text_ar: "ارتفاع المؤشر 14 نقطة بين 2011 و2023، من 41 إلى 55", page: 2 },
      { text_en: "Export concentration (HHI) improved only 0.04 over the period", text_ar: "تحسن تركّز الصادرات (مؤشر هيرفندال) 0.04 فقط خلال الفترة", page: 2 },
    ],
    pages: [
      "1. Why a composite index. The NDS3 diversification target is expressed through several indicators that move at different speeds and are reported on different cadences. This paper proposes one composite index so that the direction of travel can be read at a glance and decomposed when needed. Four components are used: the non-hydrocarbon share of real GDP, a Herfindahl index of merchandise export concentration, the private-sector share of total employment, and the non-hydrocarbon share of government revenue. Each component is normalised to a 0 to 100 scale against a fixed 2011 baseline and a 2030 aspiration, and a principal-component analysis confirms that equal weights lose little information.",
      "2. Results. Backcast to 2011, the index rises from 41 to 55 by 2023. Most of the gain arrives after 2017, driven by the non-hydrocarbon GDP share and by private-sector employment. Export concentration is the slowest-moving component: the Herfindahl index improved by only 0.04 over the period because liquefied natural gas remains the dominant export line. Revenue concentration improved in years of lower hydrocarbon prices and reversed in years of higher prices, which argues for reading that component over a three-year average.",
      "3. Use in the strategy. The paper recommends that the index be published annually with its four components, that the export concentration component be tracked quarterly from customs data, and that the 2030 aspiration values be revisited when the national accounts rebase to a new reference year. A sensitivity annex shows the index is robust to alternative weights within a two-point band. Data sources: national accounts, customs statistics, the labour force survey, and the fiscal accounts.",
      "ملخص. تقترح هذه الورقة مؤشراً مركباً للتنويع الاقتصادي من أربعة مكونات بأوزان متساوية، تم التحقق منها بتحليل المكونات الرئيسية. يرتفع المؤشر من 41 في 2011 إلى 55 في 2023، ويأتي معظم التحسن بعد 2017 من حصة الناتج غير الهيدروكربوني والعمالة في القطاع الخاص، بينما يبقى تركّز الصادرات المكون الأبطأ لهيمنة الغاز الطبيعي المسال. توصي الورقة بنشر المؤشر سنوياً مع مكوناته، وبمتابعة تركّز الصادرات فصلياً، وبمراجعة قيم 2030 عند إعادة تأسيس الحسابات القومية.",
    ],
  },
  {
    titleEn: "Mid-term Evaluation of the National Data Governance Programme",
    titleAr: "تقييم منتصف المدة لبرنامج حوكمة البيانات الوطنية",
    type: "evaluation",
    year: 2025,
    unit: "NDA",
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
      "1. Scope and method. This mid-term evaluation covers the first two years of the National Data Governance Programme. It uses the programme's own results framework, administrative records from the National Data Agency, a survey of the twenty-two participating entities and eighteen key-informant interviews. Evaluation questions cover relevance, effectiveness, efficiency and early signs of sustainability. The evaluation was conducted internally with an external methodological advisor and follows the results-based planning manual's evaluation guidance.",
      "2. Effectiveness. Fourteen of the twenty-two entities have appointed data stewards and published their data inventories, against a mid-term target of sixteen. The standard data-sharing agreement template is the programme's clearest success: the median negotiation time for a new agreement fell from seven months to eleven weeks, and forty-one agreements are now in force. Entities cite legal review capacity, not willingness, as the remaining bottleneck. The stewards network meets monthly and its attendance has held above eighty percent.",
      "3. Data quality and recommendations. Quality scoring is live for thirty-one of the sixty priority datasets. Scores improved for twenty-four of them within two quarters of first publication, which suggests that visibility itself drives improvement. The evaluation recommends extending the template approach to metadata standards, funding a shared legal review pool for the smaller entities, and publishing the quality scores openly from 2026. Two risks are flagged: steward turnover and the absence of a sanctions mechanism for non-participation.",
      "ملخص التقييم. يغطي تقييم منتصف المدة السنتين الأوليين من برنامج حوكمة البيانات الوطنية عبر إطار نتائجه وسجلاته الإدارية ومسح للجهات المشاركة ومقابلات مع المطلعين. عيّنت 14 من 22 جهة مسؤولي بيانات ونشرت جرودها مقابل هدف 16. قلّص القالب الموحد لاتفاقيات التبادل زمن التفاوض من سبعة أشهر إلى أحد عشر أسبوعاً، وتسري الآن 41 اتفاقية. يعمل تقييم الجودة لـ31 من 60 مجموعة بيانات، وتحسنت 24 منها خلال فصلين من النشر. يوصي التقييم بتوسيع نهج القوالب إلى معايير البيانات الوصفية، وبتمويل مجمع مشترك للمراجعة القانونية، وبنشر درجات الجودة علناً من 2026.",
    ],
  },
  {
    titleEn: "Household Survey Response Rates: Drivers and Remedies",
    titleAr: "معدلات الاستجابة في المسوح الأسرية: العوامل والمعالجات",
    type: "study",
    year: 2023,
    unit: "SOA",
    classification: 1,
    outcomes: ["gov_excellence"],
    topics: ["household_surveys", "census_methodology", "data_quality"],
    summaryEn:
      MARK_EN +
      "Explains the decline in household survey response from 84 to 71 percent between 2015 and 2022 using paradata from 46,000 sample addresses, and tests four remedies in a split-sample experiment. Evening visits and a web-first option together recovered nine points.",
    summaryAr:
      MARK_AR +
      "تفسر تراجع الاستجابة في المسوح الأسرية من 84 إلى 71 في المئة بين 2015 و2022 باستخدام بيانات ميدانية لـ46,000 عنوان في العينة، وتختبر أربع معالجات في تجربة بعينة مقسمة. استعادت الزيارات المسائية وخيار الإنترنت أولاً تسع نقاط معاً.",
    keyFacts: [
      { text_en: "Response fell from 84 to 71 percent between 2015 and 2022", text_ar: "تراجعت الاستجابة من 84 إلى 71 في المئة بين 2015 و2022", page: 1 },
      { text_en: "Non-contact, not refusal, explains two thirds of the decline", text_ar: "عدم التواصل، لا الرفض، يفسر ثلثي التراجع", page: 2 },
      { text_en: "Evening visits plus web-first collection recovered 9 points", text_ar: "الزيارات المسائية مع الجمع عبر الإنترنت أولاً استعادت 9 نقاط", page: 3 },
    ],
    pages: [
      "1. The problem. Household survey response in Qatar fell from 84 percent in 2015 to 71 percent in 2022, with the steepest drop in high-rise districts of Doha and among households of single working adults. This study uses interviewer paradata from 46,000 sample addresses across four survey rounds to separate non-contact from refusal, and to identify the address, household and fieldwork characteristics associated with each.",
      "2. Drivers. Non-contact, not refusal, explains about two thirds of the decline. Gated compounds and tower buildings with concierge access account for most of the non-contact growth; refusal rates have been stable at around eight percent. Daytime visits reach fewer than half of single-adult households on the first attempt. Interviewer experience matters: teams with more than three years of field experience achieve contact rates twelve points higher than new teams in the same districts.",
      "3. Remedies tested. A split-sample experiment in 2022 tested four remedies: evening and weekend visit windows, a web-first invitation with interviewer follow-up, building-management liaison letters, and a small unconditional incentive. Evening visits and the web-first option together recovered nine points of response; liaison letters helped in towers only; the incentive had no measurable effect. The study recommends adopting evening windows and web-first collection as the standard design and reporting response rates by dwelling type in every survey release.",
      "ملخص. تراجعت الاستجابة في المسوح الأسرية من 84 إلى 71 في المئة بين 2015 و2022، ويفسر عدم التواصل نحو ثلثي هذا التراجع، خصوصاً في المجمعات المسوّرة والأبراج السكنية، بينما بقيت معدلات الرفض مستقرة عند ثمانية في المئة. اختبرت تجربة بعينة مقسمة أربع معالجات، فاستعادت الزيارات المسائية والخيار الإلكتروني أولاً تسع نقاط، وأفادت رسائل التنسيق مع إدارات المباني في الأبراج فقط، ولم يكن للحافز أثر يُذكر. توصي الدراسة باعتماد النوافذ المسائية والجمع الإلكتروني أولاً تصميماً معيارياً، وبنشر معدلات الاستجابة بحسب نوع المسكن.",
    ],
  },
  {
    titleEn: "Fiscal Sustainability under Energy Transition: Scenarios to 2040",
    titleAr: "الاستدامة المالية في ظل التحول في الطاقة: سيناريوهات حتى 2040",
    type: "research",
    year: 2026,
    unit: "SF",
    classification: 2,
    outcomes: ["fiscal_sust"],
    topics: ["scenario_planning", "fiscal_policy", "foresight_methods"],
    summaryEn:
      MARK_EN +
      "Builds three demand scenarios for liquefied natural gas to 2040 and traces their fiscal consequences. Under the accelerated-transition scenario, hydrocarbon revenue falls to 46 percent of the total by 2040 and the non-hydrocarbon primary balance must improve by 3.2 points of GDP to keep the buffer rule intact.",
    summaryAr:
      MARK_AR +
      "يبني ثلاثة سيناريوهات للطلب على الغاز الطبيعي المسال حتى 2040 ويتتبع آثارها المالية. في سيناريو التحول المتسارع تنخفض الإيرادات الهيدروكربونية إلى 46 في المئة من الإجمالي بحلول 2040، ويجب أن يتحسن الرصيد الأولي غير الهيدروكربوني بمقدار 3.2 نقطة من الناتج للحفاظ على قاعدة الاحتياطي.",
    keyFacts: [
      { text_en: "Three LNG demand scenarios: baseline, delayed transition, accelerated transition", text_ar: "ثلاثة سيناريوهات للطلب على الغاز: أساسي، تحول متأخر، تحول متسارع", page: 1 },
      { text_en: "Hydrocarbon revenue share by 2040: 61, 68 and 46 percent respectively", text_ar: "حصة الإيرادات الهيدروكربونية بحلول 2040: 61 و68 و46 في المئة على التوالي", page: 2 },
      { text_en: "Accelerated transition needs a 3.2-point improvement in the non-hydrocarbon primary balance", text_ar: "يحتاج التحول المتسارع إلى تحسن 3.2 نقطة في الرصيد الأولي غير الهيدروكربوني", page: 3 },
    ],
    pages: [
      "1. Scenarios. The paper builds three scenarios for global liquefied natural gas demand to 2040: a baseline that follows announced policies, a delayed transition in which Asian coal-to-gas switching continues into the 2030s, and an accelerated transition in which European and East Asian demand peaks before 2030. Each scenario is expressed as a price and volume path for Qatar's exports, drawing on published agency outlooks and on the expansion schedule of the North Field.",
      "2. Fiscal consequences. Hydrocarbon revenue remains 61 percent of total revenue in 2040 under the baseline, 68 percent under a delayed transition and 46 percent under an accelerated transition. Non-hydrocarbon revenue grows in every scenario but cannot on its own replace the lost hydrocarbon income in the accelerated case. The stabilisation buffer stays above its floor in the baseline and delayed scenarios throughout the period; in the accelerated scenario it breaches the floor in 2034 unless policy adjusts.",
      "3. What it would take. Keeping the buffer rule intact under the accelerated transition needs a 3.2-point-of-GDP improvement in the non-hydrocarbon primary balance by 2034, achievable through a combination of broadened revenue measures and slower current-spending growth. The paper suggests an early-warning indicator set built from LNG contract renewal prices, the European carbon price and Asian gas-to-coal spreads, and recommends that the foresight function report the indicator set twice a year to the fiscal sustainability outcome owner.",
      "ملخص. يبني البحث ثلاثة سيناريوهات للطلب العالمي على الغاز الطبيعي المسال حتى 2040 ويتتبع آثارها المالية. تبقى الإيرادات الهيدروكربونية 61 في المئة من الإجمالي في السيناريو الأساسي، و68 في المئة في التحول المتأخر، و46 في المئة في التحول المتسارع. يخترق احتياطي الاستقرار حدّه الأدنى في 2034 في السيناريو المتسارع ما لم تتعدل السياسة، ويتطلب الحفاظ على القاعدة تحسناً قدره 3.2 نقطة من الناتج في الرصيد الأولي غير الهيدروكربوني. يقترح البحث مجموعة مؤشرات إنذار مبكر وتقريراً نصف سنوي لمالك نتيجة الاستدامة المالية.",
    ],
  },
  {
    titleEn: "Evaluation of Digital Government Services Uptake, 2021 to 2024",
    titleAr: "تقييم الإقبال على الخدمات الحكومية الرقمية، 2021 إلى 2024",
    type: "evaluation",
    year: 2024,
    unit: "MIF",
    classification: 1,
    outcomes: ["gov_excellence"],
    topics: ["digital_transformation", "gov_services", "evaluation_methods"],
    summaryEn:
      MARK_EN +
      "Evaluates whether the digital services programme moved transactions online and improved satisfaction. Online completion rose from 54 to 79 percent of eligible transactions; satisfaction rose six points; the remaining offline demand concentrates in five services that require in-person identity checks.",
    summaryAr:
      MARK_AR +
      "يقيّم ما إذا كان برنامج الخدمات الرقمية قد نقل المعاملات إلى الإنترنت وحسّن الرضا. ارتفع الإنجاز الإلكتروني من 54 إلى 79 في المئة من المعاملات المؤهلة، وارتفع الرضا ست نقاط، ويتركز الطلب الحضوري المتبقي في خمس خدمات تتطلب تحقق الهوية حضورياً.",
    keyFacts: [
      { text_en: "Online completion: 79 percent of eligible transactions in 2024, up from 54", text_ar: "الإنجاز الإلكتروني: 79 في المئة من المعاملات المؤهلة في 2024 مقابل 54", page: 2 },
      { text_en: "Satisfaction up six points to 82 percent", text_ar: "ارتفاع الرضا ست نقاط إلى 82 في المئة", page: 2 },
      { text_en: "Five services with in-person identity checks hold 61 percent of remaining offline demand", text_ar: "خمس خدمات تتطلب تحقق الهوية حضورياً تستأثر بـ61 في المئة من الطلب الحضوري المتبقي", page: 3 },
    ],
    pages: [
      "1. Questions and evidence. The evaluation asks whether the digital services programme moved transactions online, whether service satisfaction improved, and who was left behind. It combines transaction logs from the national services portal, four rounds of the user satisfaction survey, and interviews with eleven service owners. The analysis covers 214 services that were eligible for full online completion by the end of 2024.",
      "2. Uptake and satisfaction. Online completion rose from 54 percent of eligible transactions in 2021 to 79 percent in 2024. The steepest gains came from the single sign-on rollout and from redesigning the twelve highest-volume services. Satisfaction rose six points to 82 percent, with the largest improvement among users over sixty once assisted digital counters opened in service centres. Complaints about status visibility fell by half after the tracking feature was added.",
      "3. Who is left and what to do. Remaining offline demand concentrates in five services that still require an in-person identity check; together they hold 61 percent of offline transactions. The evaluation recommends a remote identity verification standard, a target for the twelve services with the lowest online share, and a quarterly uptake dashboard owned by the monitoring function. It rates the programme as effective, with efficiency gains not yet quantified because unit costs were not recorded before 2022.",
      "ملخص التقييم. ارتفع الإنجاز الإلكتروني للمعاملات المؤهلة من 54 في المئة في 2021 إلى 79 في المئة في 2024، بفضل الدخول الموحد وإعادة تصميم أعلى اثنتي عشرة خدمة حجماً. ارتفع الرضا ست نقاط إلى 82 في المئة، وكان التحسن الأكبر بين المستخدمين فوق الستين بعد افتتاح منصات الدعم الرقمي. يتركز الطلب الحضوري المتبقي في خمس خدمات تتطلب تحقق الهوية حضورياً. يوصي التقييم بمعيار للتحقق من الهوية عن بُعد، وهدف للخدمات الأقل إنجازاً إلكترونياً، ولوحة فصلية للإقبال تملكها وظيفة الرصد.",
    ],
  },
  {
    titleEn: "Population Ageing and Social Protection Needs to 2040",
    titleAr: "شيخوخة السكان واحتياجات الحماية الاجتماعية حتى 2040",
    type: "study",
    year: 2022,
    unit: "SDP",
    classification: 1,
    outcomes: ["cohesive_society", "quality_life"],
    topics: ["population_stats", "social_statistics", "social_protection"],
    summaryEn:
      MARK_EN +
      "Projects the Qatari population aged 65 and over to 2040 under three fertility and longevity assumptions and estimates the resulting demand for pensions, long-term care places and home-care hours. The 65-plus population roughly triples, and long-term care demand outpaces the current expansion plan by 2033.",
    summaryAr:
      MARK_AR +
      "تتوقع أعداد القطريين بعمر 65 سنة فأكثر حتى 2040 وفق ثلاثة افتراضات للخصوبة وطول العمر، وتقدّر الطلب الناتج على المعاشات وأماكن الرعاية طويلة الأمد وساعات الرعاية المنزلية. يتضاعف السكان فوق 65 ثلاث مرات تقريباً، ويتجاوز الطلب على الرعاية طويلة الأمد خطة التوسع الحالية بحلول 2033.",
    keyFacts: [
      { text_en: "Qatari population aged 65 and over roughly triples by 2040 in the central scenario", text_ar: "يتضاعف عدد القطريين بعمر 65 فأكثر ثلاث مرات تقريباً بحلول 2040 في السيناريو الأوسط", page: 1 },
      { text_en: "Long-term care demand exceeds the planned capacity from 2033", text_ar: "يتجاوز الطلب على الرعاية طويلة الأمد الطاقة المخططة من 2033", page: 2 },
      { text_en: "Home-care hours needed grow 2.6 times by 2040", text_ar: "تنمو ساعات الرعاية المنزلية المطلوبة 2.6 مرة بحلول 2040", page: 3 },
    ],
    pages: [
      "1. Projection. Using the 2020 census base and three combinations of fertility and longevity assumptions, the study projects the Qatari population by single year of age to 2040. In the central scenario the population aged 65 and over roughly triples, and the share of the Qatari population in that group rises from six to fourteen percent. The old-age dependency ratio for Qatari nationals doubles over the same period.",
      "2. Demand for services. Applying age-specific utilisation rates from the health and social protection registers, the study estimates demand for pension payments, residential long-term care places and home-care hours. Long-term care demand exceeds the planned capacity expansion from 2033 in the central scenario and from 2030 in the high-longevity scenario. Pension expenditure remains within the actuarial envelope in all scenarios because contribution reforms already enacted mature over the period.",
      "3. Recommendations. The study recommends a home-care-first policy, because home-care hours needed grow 2.6 times by 2040 while costing a third of residential care per person; a workforce plan for geriatric nursing; and a five-yearly refresh of the projection tied to each census and mid-decade population estimate. It also proposes that the quality-of-life outcome adopt an indicator on the share of older people receiving care at home.",
      "ملخص. تتوقع الدراسة، انطلاقاً من قاعدة تعداد 2020 وثلاثة افتراضات للخصوبة وطول العمر، أن يتضاعف عدد القطريين بعمر 65 سنة فأكثر ثلاث مرات تقريباً بحلول 2040، وأن ترتفع حصتهم من ستة إلى أربعة عشر في المئة. يتجاوز الطلب على الرعاية طويلة الأمد الطاقة المخططة من 2033، بينما يبقى الإنفاق على المعاشات ضمن الغلاف الاكتواري. توصي الدراسة بسياسة الرعاية المنزلية أولاً، وبخطة للقوى العاملة في تمريض المسنين، وبتحديث التوقعات كل خمس سنوات، وبمؤشر لحصة كبار السن الذين يتلقون الرعاية في منازلهم.",
    ],
  },
  {
    titleEn: "Qatar in International Indices: Drivers of Movement, 2018 to 2025",
    titleAr: "قطر في المؤشرات الدولية: محركات التغير، 2018 إلى 2025",
    type: "research",
    year: 2026,
    unit: "IIC",
    classification: 1,
    outcomes: ["gov_excellence", "eco_growth"],
    topics: ["index_monitoring", "kpi_design", "institutional_excellence"],
    summaryEn:
      MARK_EN +
      "Decomposes Qatar's rank changes in twelve international indices into three sources: changes in Qatar's own scores, changes in peers' scores, and methodology revisions. Methodology revisions explain 38 percent of rank movements, more than Qatar's own score changes for five of the twelve indices.",
    summaryAr:
      MARK_AR +
      "يفكك تغيرات ترتيب قطر في اثني عشر مؤشراً دولياً إلى ثلاثة مصادر: تغير درجات قطر نفسها، وتغير درجات الأقران، وتعديلات المنهجية. تفسر تعديلات المنهجية 38 في المئة من تحركات الترتيب، وهو أكثر من تغير درجات قطر في خمسة من المؤشرات الاثني عشر.",
    keyFacts: [
      { text_en: "Twelve indices, 2018 to 2025, decomposed rank by rank", text_ar: "اثنا عشر مؤشراً من 2018 إلى 2025 بتفكيك الترتيب سنة بسنة", page: 1 },
      { text_en: "Methodology revisions explain 38 percent of rank movements", text_ar: "تفسر تعديلات المنهجية 38 في المئة من تحركات الترتيب", page: 2 },
      { text_en: "Own-score improvement drove the gains in the e-government and logistics indices", text_ar: "قاد تحسن الدرجات الذاتية المكاسب في مؤشري الحكومة الإلكترونية والخدمات اللوجستية", page: 2 },
    ],
    pages: [
      "1. Method. For each of twelve international indices tracked in the Indices module, the paper reconstructs the full ranked field for every edition from 2018 to 2025 and decomposes each year's rank change into three sources: the change in Qatar's own score, the change in peers' scores holding Qatar constant, and the effect of methodology revisions identified from publisher notes. Where publishers restate prior years, the restated series is used so that revisions are not counted as score changes.",
      "2. Findings. Methodology revisions explain 38 percent of Qatar's rank movements across the twelve indices, more than Qatar's own score changes for five of them. Own-score improvement drove the gains in the e-government and logistics indices, where sustained programmes changed the underlying inputs. Peer movement explains most of the volatility in the innovation and talent indices, where a small number of countries cluster within a few points. Rank targets expressed as a fixed position are therefore fragile for those indices.",
      "3. Implications for targets. The paper recommends stating targets as score bands where the index publishes scores, treating rank as a reported outcome rather than a target for the clustered indices, and annotating every rank change in the module with its decomposition so that readers see whether Qatar moved or the ruler did. It also recommends a standing methodology watch that reads publisher notes before each release and flags revisions to outcome owners.",
      "ملخص. يعيد البحث بناء الترتيب الكامل لاثني عشر مؤشراً دولياً لكل إصدار من 2018 إلى 2025، ويفكك تغير ترتيب قطر إلى تغير درجاتها، وتغير درجات الأقران، وأثر تعديلات المنهجية. تفسر تعديلات المنهجية 38 في المئة من التحركات، وهو أكثر من أثر درجات قطر في خمسة مؤشرات. قاد التحسن الذاتي المكاسب في مؤشري الحكومة الإلكترونية والخدمات اللوجستية، بينما يفسر تحرك الأقران معظم التذبذب في مؤشري الابتكار والمواهب. يوصي البحث بصياغة الأهداف كنطاقات درجات، ومعاملة الترتيب كنتيجة مبلّغة في المؤشرات المتقاربة، وبإرفاق التفكيك بكل تغير في الترتيب.",
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
    .where(eq(schema.users.email, "knowledge@npc.qa"))
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

  const dataDir = path.join(process.cwd(), "data");
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
      sourceOrigin: "npc",
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
