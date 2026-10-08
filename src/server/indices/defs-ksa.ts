// Index definitions added for the Saudi environment, water and agriculture
// benchmark: the ND-GAIN Country Index, the WRI Aqueduct baseline water stress
// score and ten World Bank WDI series (water, food, land, climate, air). The
// publishers are the ones listed in the Global Indices and Global Data Portals
// tabs of the KSA data-source databank. Values come from the bulk files read
// by ./sources-ksa.ts when the fetch job runs; this module holds no values.
// Responsible entities are Saudi bodies matched by English name against the
// entities register (an unmatched name leaves the owner empty).
import type { Cr08IndexDef } from "./defs-cr08";
import { WDI_SERIES } from "./sources-ksa";

const MEWA = "Ministry of Environment, Water and Agriculture";
const NCEC = "National Center for Environmental Compliance";
const NCW = "National Center for Wildlife";
const NCVC = "National Center for Vegetation Cover Development and Combating Desertification";

const WB = {
  publisher: "World Bank, World Development Indicators",
  publisherUrl: "https://databank.worldbank.org/source/world-development-indicators",
  scale: "score",
  frequency: "annual",
  forecastMode: "score",
  forecastEnabled: true,
} satisfies Partial<Cr08IndexDef>;

const WDI_NOTE =
  "World Bank WDI public indicators API, every country the series covers (aggregates excluded). Values are the published annual values; ranks are derived by sorting those values within each year, ties sharing a rank, and rank 1 is the best performer in the direction shown. A year the series does not carry stays absent.";
const WDI_NOTE_AR =
  "واجهة مؤشرات التنمية العالمية العامة للبنك الدولي لكل دولة تغطيها السلسلة (من دون التجمعات). القيم هي القيم السنوية المنشورة، أما الترتيب فمشتق بفرز القيم داخل كل سنة مع مشاركة الرتبة عند التساوي، والمرتبة 1 للأفضل أداءً بحسب الاتجاه المبين.";

const wdi = (
  code: string,
  d: Pick<
    Cr08IndexDef,
    | "nameEn"
    | "nameAr"
    | "methodologyEn"
    | "methodologyAr"
    | "scoreMin"
    | "scoreMax"
    | "category"
    | "responsibleEntityName"
    | "linkedTargetKeywords"
    | "groups"
  >
): Cr08IndexDef => ({
  ...WB,
  code,
  ...d,
  higherIsBetter: WDI_SERIES[code].higherIsBetter,
  sourceNotes: `${WDI_NOTE} Indicator ${WDI_SERIES[code].wb}.`,
  methodologyAr: `${d.methodologyAr} ${WDI_NOTE_AR}`,
});

export const KSA_INDEX_DEFS: Cr08IndexDef[] = [
  {
    code: "nd_gain",
    nameEn: "ND-GAIN Country Index",
    nameAr: "مؤشر ND-GAIN للقدرة على التكيف المناخي",
    publisher: "University of Notre Dame Global Adaptation Initiative (ND-GAIN)",
    publisherUrl: "https://gain.nd.edu/",
    methodologyEn:
      "Summarises a country's vulnerability to climate change and other global challenges together with its readiness to improve resilience, from 45 indicators (36 for vulnerability, 9 for readiness). Score 0 to 100, higher is better, annual back to 1995.",
    methodologyAr:
      "يلخص مدى تعرض الدولة لتغير المناخ وغيره من التحديات العالمية مع جاهزيتها لتعزيز القدرة على الصمود، اعتمادًا على 45 مؤشرًا (36 للتعرض و9 للجاهزية). الدرجة من 0 إلى 100، والأعلى أفضل، وتصدر سنويًا منذ عام 1995.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 100,
    higherIsBetter: true,
    frequency: "annual",
    category: "environment",
    responsibleEntityName: MEWA,
    linkedTargetKeywords: ["climate", "adaptation", "resilience"],
    sourceNotes:
      "Country index download of the publisher (zip, gain/gain.csv, every country, 1995 onward). Ranks are derived by sorting the published scores within each year, ties sharing a rank.",
    groups: ["climate", "environment"],
    forecastMode: "score",
    forecastEnabled: true,
  },
  {
    code: "aqueduct_bws",
    nameEn: "Aqueduct Baseline Water Stress",
    nameAr: "الإجهاد المائي الأساسي (Aqueduct)",
    publisher: "World Resources Institute (WRI), Aqueduct 4.0",
    publisherUrl: "https://www.wri.org/aqueduct",
    methodologyEn:
      "Ratio of total annual water withdrawals to available renewable surface and groundwater supply, averaged over 1979 to 2019 and weighted by total water demand. Score 0 to 5, higher means more stress; the ranking here puts the least stressed country first. One baseline release (2023), so no trend and no forecast.",
    methodologyAr:
      "نسبة إجمالي السحب السنوي للمياه إلى المعروض المتجدد من المياه السطحية والجوفية، بمتوسط للفترة 1979 إلى 2019 ومرجحة بإجمالي الطلب على المياه. الدرجة من 0 إلى 5، وكلما ارتفعت زاد الإجهاد؛ ويضع الترتيب هنا الدولة الأقل إجهادًا أولًا. إصدار أساسي واحد (2023) ولذلك لا اتجاه ولا تنبؤ.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 5,
    higherIsBetter: false,
    frequency: "irregular",
    category: "environment",
    responsibleEntityName: MEWA,
    linkedTargetKeywords: ["water", "water security", "scarcity"],
    sourceNotes:
      "WRI Aqueduct 4.0 country rankings workbook (country_baseline sheet, indicator bws, weighted by total demand), release 2023. Ranks are derived by sorting the published scores, ties sharing a rank.",
    groups: ["water", "environment"],
    forecastMode: "score",
    forecastEnabled: false,
  },
  wdi("wdi_freshwater_withdrawal", {
    nameEn: "Freshwater Withdrawals (% of internal resources)",
    nameAr: "السحب السنوي للمياه العذبة (٪ من الموارد الداخلية)",
    methodologyEn:
      "Annual freshwater withdrawals as a share of renewable internal freshwater resources, as compiled by FAO AQUASTAT. Values above 100 mean withdrawals exceed renewable internal supply (met by groundwater drawdown, desalination and reuse). Lower is better.",
    methodologyAr:
      "السحب السنوي للمياه العذبة كنسبة من الموارد الداخلية المتجددة للمياه العذبة، كما تجمعها منظمة الأغذية والزراعة (أكواستات). تعني القيم الأعلى من 100 أن السحب يتجاوز المعروض الداخلي المتجدد (ويُسد بالسحب من المياه الجوفية والتحلية وإعادة الاستخدام). الأقل أفضل.",
    scoreMin: 0,
    scoreMax: 2000,
    category: "environment",
    responsibleEntityName: MEWA,
    linkedTargetKeywords: ["water", "groundwater", "withdrawal"],
    groups: ["water"],
  }),
  wdi("wdi_basic_water", {
    nameEn: "People Using at Least Basic Drinking Water (%)",
    nameAr: "السكان المستخدمون لخدمات مياه الشرب الأساسية على الأقل (٪)",
    methodologyEn:
      "Share of the population using at least basic drinking water services, from the WHO and UNICEF Joint Monitoring Programme. Higher is better.",
    methodologyAr:
      "نسبة السكان الذين يستخدمون خدمات مياه الشرب الأساسية على الأقل، من البرنامج المشترك للرصد التابع لمنظمة الصحة العالمية واليونيسف الأعلى أفضل.",
    scoreMin: 0,
    scoreMax: 100,
    category: "society",
    responsibleEntityName: MEWA,
    linkedTargetKeywords: ["water", "drinking water", "sanitation"],
    groups: ["water"],
  }),
  wdi("wdi_water_per_capita", {
    nameEn: "Renewable Internal Freshwater per Capita (m³)",
    nameAr: "نصيب الفرد من الموارد الداخلية المتجددة للمياه العذبة (م³)",
    methodologyEn:
      "Renewable internal freshwater resources (internal river flows and groundwater from rainfall) per person, from FAO AQUASTAT. Higher means more natural water per person; the usual scarcity line is 1,000 cubic metres.",
    methodologyAr:
      "الموارد الداخلية المتجددة للمياه العذبة (جريان الأنهار الداخلية والمياه الجوفية الناتجة عن الأمطار) للفرد الواحد، من أكواستات التابع لمنظمة الأغذية والزراعة. كلما ارتفعت زادت المياه الطبيعية المتاحة للفرد؛ وخط الندرة المعتاد هو 1000 متر مكعب.",
    scoreMin: 0,
    scoreMax: 100000,
    category: "environment",
    responsibleEntityName: MEWA,
    linkedTargetKeywords: ["water", "scarcity", "water security"],
    groups: ["water"],
  }),
  wdi("wdi_food_production", {
    nameEn: "Food Production Index (2014-2016 = 100)",
    nameAr: "الرقم القياسي لإنتاج الأغذية (2014-2016 = 100)",
    methodologyEn:
      "Index of food crop and livestock production relative to the 2014 to 2016 average, from FAO. Higher means more food produced relative to the base period.",
    methodologyAr:
      "رقم قياسي لإنتاج المحاصيل الغذائية والثروة الحيوانية نسبة إلى متوسط 2014 إلى 2016، من منظمة الأغذية والزراعة. كلما ارتفع زاد الإنتاج الغذائي قياسًا بفترة الأساس.",
    scoreMin: 0,
    scoreMax: 300,
    category: "economy",
    responsibleEntityName: MEWA,
    linkedTargetKeywords: ["food security", "agriculture", "production"],
    groups: ["agriculture"],
  }),
  wdi("wdi_cereal_yield", {
    nameEn: "Cereal Yield (kg per hectare)",
    nameAr: "إنتاجية الحبوب (كجم للهكتار)",
    methodologyEn:
      "Harvested cereal production per hectare of harvested land, from FAO. Higher is better.",
    methodologyAr:
      "إنتاج الحبوب المحصودة لكل هكتار من الأرض المحصودة، من منظمة الأغذية والزراعة. الأعلى أفضل.",
    scoreMin: 0,
    scoreMax: 15000,
    category: "economy",
    responsibleEntityName: MEWA,
    linkedTargetKeywords: ["agriculture", "yield", "food security"],
    groups: ["agriculture"],
  }),
  wdi("wdi_protected_land", {
    nameEn: "Terrestrial Protected Areas (% of land)",
    nameAr: "المناطق البرية المحمية (٪ من مساحة اليابسة)",
    methodologyEn:
      "Totally or partially protected terrestrial areas of at least 1,000 hectares as a share of total land area, from Protected Planet, the World Database on Protected Areas (UNEP-WCMC). Higher is better.",
    methodologyAr:
      "المناطق البرية المحمية كليًا أو جزئيًا التي لا تقل مساحتها عن 1000 هكتار كنسبة من إجمالي مساحة اليابسة، من قاعدة البيانات العالمية للمناطق المحمية (كوكب محمي، UNEP-WCMC). الأعلى أفضل.",
    scoreMin: 0,
    scoreMax: 100,
    category: "environment",
    responsibleEntityName: NCW,
    linkedTargetKeywords: ["biodiversity", "protected areas", "conservation"],
    groups: ["environment"],
  }),
  wdi("wdi_forest_area", {
    nameEn: "Forest Area (% of land)",
    nameAr: "مساحة الغابات (٪ من مساحة اليابسة)",
    methodologyEn:
      "Land under natural or planted stands of trees of at least five metres, as a share of land area, from FAOSTAT. Higher is better.",
    methodologyAr:
      "الأراضي المغطاة بأشجار طبيعية أو مزروعة لا يقل ارتفاعها عن خمسة أمتار، كنسبة من مساحة اليابسة، من قاعدة بيانات فاوستات التابعة لمنظمة الأغذية والزراعة. الأعلى أفضل.",
    scoreMin: 0,
    scoreMax: 100,
    category: "environment",
    responsibleEntityName: NCVC,
    linkedTargetKeywords: ["forest", "vegetation", "desertification", "afforestation"],
    groups: ["environment", "agriculture"],
  }),
  wdi("wdi_renewables_share", {
    nameEn: "Renewable Energy Share of Final Energy (%)",
    nameAr: "حصة الطاقة المتجددة من الاستهلاك النهائي للطاقة (٪)",
    methodologyEn:
      "Renewable energy consumption as a share of total final energy consumption, from IEA energy statistics as compiled by the World Bank. Higher is better.",
    methodologyAr:
      "استهلاك الطاقة المتجددة كنسبة من إجمالي الاستهلاك النهائي للطاقة، من إحصاءات وكالة الطاقة الدولية كما يجمعها البنك الدولي. الأعلى أفضل.",
    scoreMin: 0,
    scoreMax: 100,
    category: "environment",
    responsibleEntityName: "Ministry of Energy",
    linkedTargetKeywords: ["renewable", "energy", "solar"],
    groups: ["climate"],
  }),
  wdi("wdi_ghg_per_capita", {
    nameEn: "Greenhouse Gas Emissions per Capita (t CO2e)",
    nameAr: "انبعاثات غازات الدفيئة للفرد (طن مكافئ ثاني أكسيد الكربون)",
    methodologyEn:
      "Total greenhouse gas emissions excluding land use, land-use change and forestry, per person, in tonnes of CO2 equivalent (AR5 global warming potentials), from the EDGAR community GHG database of the European Commission Joint Research Centre. Lower is better.",
    methodologyAr:
      "إجمالي انبعاثات غازات الدفيئة باستثناء استخدام الأراضي وتغيّر استخدامها والحراجة، للفرد الواحد، بالطن المكافئ لثاني أكسيد الكربون (باستخدام إمكانات الاحترار العالمي في التقرير التقييمي الخامس)، من قاعدة بيانات إيدغار التابعة للمفوضية الأوروبية. الأقل أفضل.",
    scoreMin: 0,
    scoreMax: 60,
    category: "environment",
    responsibleEntityName: NCEC,
    linkedTargetKeywords: ["emissions", "greenhouse", "climate"],
    groups: ["climate"],
  }),
  wdi("wdi_pm25", {
    nameEn: "PM2.5 Air Pollution, Mean Annual Exposure (µg/m³)",
    nameAr: "تلوث الهواء بالجسيمات PM2.5، متوسط التعرض السنوي (ميكروغرام/م³)",
    methodologyEn:
      "Population-weighted mean annual concentration of fine particles smaller than 2.5 microns, from the Global Burden of Disease Study 2023 air pollution exposure estimates (IHME). Lower is better; desert dust raises the value in arid countries.",
    methodologyAr:
      "المتوسط السنوي المرجح بالسكان لتركيز الجسيمات الدقيقة التي يقل قطرها عن 2.5 ميكرون، من تقديرات التعرض لتلوث الهواء في دراسة العبء العالمي للمرض 2023 (IHME). الأقل أفضل؛ ويرفع غبار الصحراء القيمة في الدول القاحلة.",
    scoreMin: 0,
    scoreMax: 150,
    category: "environment",
    responsibleEntityName: NCEC,
    linkedTargetKeywords: ["air quality", "pollution", "emissions"],
    groups: ["environment"],
  }),
];
