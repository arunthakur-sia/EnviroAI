// CR07 2.6: illustrative content for the Programme Strategy, part A.
// This module carries the hand written bilingual words of the Programme Office's own
// institutional strategy: the strategic direction, the situation analysis, governance,
// the risk register, and the results chain down to outputs. Part B carries the projects,
// activities and indicator cards that hang beneath these outputs.
//
// IMPORTANT: the content below is ILLUSTRATIVE. It is a plausible internal strategy
// written to exercise the Programme Strategy screens, not the real approved strategy of
// any organisation. Everything seeded from this file is marked
// is_illustrative = true and carries the "Illustrative" chip in the product until the
// real strategy replaces it. Organisational unit codes, theme codes (O1 to O7) and the
// results chain codes must not be edited here without updating the seed.

import type {
  StrategyMeta,
  SwotItem,
  StakeholderItem,
  ChallengeItem,
  BaselineItem,
  GovernanceBody,
  RiskItem,
  GoalSeed,
  IntermediateOutcomeSeed,
  OutputSeed,
} from "./cr07-council-types";

/* ------------------------------------------------------------------ */
/* 1. Strategy header and strategic direction                          */
/* ------------------------------------------------------------------ */

export const STRATEGY_META: StrategyMeta = {
  nameEn: "Programme Office Institutional Strategy 2025 to 2030",
  nameAr: "الاستراتيجية المؤسسية لمكتب البرنامج 2025 - 2030",
  periodFrom: "2025-01-01",
  periodTo: "2030-12-31",
  approvedOn: "2025-03-16",
  visionEn:
    "A reference institution whose strategy, environmental data and foresight set the professional standard for environment, water and agriculture work in Saudi Arabia.",
  visionAr:
    "مؤسسة مرجعية تضع استراتيجيتها وبياناتها البيئية واستشرافها المعيار المهني لأعمال البيئة والمياه والزراعة في المملكة العربية السعودية.",
  missionEn:
    "We steer the National Environment Strategy, monitor its delivery, keep environmental data trustworthy and read the future, so that choices on water, food, climate, land, waste and air rest on evidence rather than assumption. We work alongside every entity in the sector, and with partners in universities, the private sector and the community, to turn national priorities into plans that are delivered and measured.",
  missionAr:
    "نقود الاستراتيجية الوطنية للبيئة ونتابع تنفيذها، ونحافظ على موثوقية البيانات البيئية ونستشرف المستقبل، لتستند الخيارات في المياه والغذاء والمناخ والأراضي والنفايات والهواء إلى الأدلة لا إلى الافتراضات. ونعمل جنباً إلى جنب مع جهات القطاع كافة، ومع شركائنا في الجامعات والقطاع الخاص والمجتمع، لتحويل الأولويات الوطنية إلى خطط قابلة للتنفيذ والقياس.",
  ownerUnitCode: "SPD",
  values: [
    {
      nameEn: "Evidence first",
      nameAr: "الأدلة أولاً",
      descriptionEn:
        "Every recommendation we issue rests on data whose source can be traced and a method that can be explained to anyone who asks. Where the evidence is thin we say so plainly instead of closing the gap with opinion.",
      descriptionAr:
        "تستند كل توصية نصدرها إلى بيانات يمكن تتبع مصدرها ومنهجية يمكن شرحها لكل من يسأل عنها. وحين تكون الأدلة ضعيفة نُصرّح بذلك بوضوح بدل سدّ الفجوة بالانطباعات.",
    },
    {
      nameEn: "Professional independence",
      nameAr: "الاستقلالية المهنية",
      descriptionEn:
        "We publish assessments and figures as the data reads them, without softening a message to suit any party. That independence is precisely what makes our work usable by everyone.",
      descriptionAr:
        "ننشر التقييمات والأرقام كما تدل عليها البيانات، دون تطويع الرسالة لصالح أي جهة. وهذه الاستقلالية هي بالذات ما يجعل عملنا صالحاً للاستخدام لدى الجميع.",
    },
    {
      nameEn: "Partnership in delivery",
      nameAr: "الشراكة في التنفيذ",
      descriptionEn:
        "We do not hand a plan over and step away; we sit with the entity that carries it until the obstacles are named and cleared. Our success is measured by what the sector delivers, not by the number of documents we issue.",
      descriptionAr:
        "لا نُسلّم الخطة ثم ننصرف، بل نجلس مع الجهة المنفذة حتى تُحدَّد العوائق وتُذلَّل. ويُقاس نجاحنا بما يُنجزه القطاع لا بعدد الوثائق التي نُصدرها.",
    },
    {
      nameEn: "Foresight as a habit",
      nameAr: "الاستشراف عادة مؤسسية",
      descriptionEn:
        "We look past the current planning cycle and treat an early signal as work that begins today. Preparing for what is likely, and for what is merely possible, belongs in every plan we write.",
      descriptionAr:
        "ننظر إلى ما وراء دورة التخطيط الحالية ونتعامل مع الإشارة المبكرة بوصفها عملاً يبدأ اليوم. والاستعداد لما هو مرجّح، ولما هو ممكن فحسب، جزء أصيل من كل خطة نُعِدّها.",
    },
    {
      nameEn: "Knowledge that stays",
      nameAr: "معرفة تبقى في المؤسسة",
      descriptionEn:
        "What a colleague learns becomes an asset of the Office: recorded, findable and ready for the next team to reuse. We hand over knowledge deliberately so that a departure never costs us a capability.",
      descriptionAr:
        "ما يتعلمه الزميل يصبح أصلاً من أصول المكتب: موثقاً وقابلاً للاسترجاع وجاهزاً لإعادة استخدامه من الفريق التالي. ونُسلّم المعرفة بشكل منظم حتى لا يكلفنا خروج موظف فقدان قدرة مؤسسية.",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 2. Situation analysis                                               */
/* ------------------------------------------------------------------ */

export const SWOT: SwotItem[] = [
  {
    quadrant: "strength",
    textEn:
      "A clear mandate to steer the National Environment Strategy, which gives the Office standing to convene every entity in the sector around one plan.",
    textAr:
      "تكليف واضح بقيادة الاستراتيجية الوطنية للبيئة، يمنح المكتب الصفة التي تتيح له جمع جهات القطاع كافة حول خطة واحدة.",
  },
  {
    quadrant: "strength",
    textEn:
      "A dedicated data and knowledge sector that brings together environmental data affairs, data operations, systems, quality and governance under one roof.",
    textAr:
      "قطاع مخصص للبيانات والمعرفة يجمع شؤون البيانات البيئية وعمليات البيانات والنظم والجودة والحوكمة تحت مظلة واحدة.",
  },
  {
    quadrant: "strength",
    textEn:
      "A dedicated foresight and risk function, still uncommon in the sector, that connects Saudi Vision 2030 environmental work to live policy questions.",
    textAr:
      "وجود إدارة مخصصة للاستشراف والمخاطر، وهو أمر لا يزال نادراً في القطاع، تربط أعمال رؤية السعودية 2030 البيئية بالقضايا السياساتية الآنية.",
  },
  {
    quadrant: "strength",
    textEn:
      "A direct reporting line to the Programme Steering Committee, so analysis reaches the decision table without passing through intermediaries who reshape it.",
    textAr:
      "خط رفع مباشر إلى اللجنة التوجيهية للبرنامج، بما يتيح وصول التحليل إلى طاولة القرار دون وسطاء يعيدون صياغته.",
  },
  {
    quadrant: "strength",
    textEn:
      "An implementation support function that works inside entities on delivery problems rather than only collecting progress reports from them.",
    textAr:
      "وجود وظيفة لدعم التنفيذ تعمل داخل الجهات على معالجة مشكلات الإنجاز، لا على جمع تقارير التقدم منها فحسب.",
  },
  {
    quadrant: "weakness",
    textEn:
      "The monitoring picture depends on what entities submit, so the Office's view of delivery is only as timely and complete as their returns.",
    textAr:
      "تعتمد صورة المتابعة على ما ترفعه الجهات، فلا تكون نظرة المكتب إلى الإنجاز أسرع أو أكمل من تقاريرها.",
  },
  {
    quadrant: "weakness",
    textEn:
      "Environmental data is produced on separate systems with uneven documentation, so combining water, agriculture, climate and waste figures still takes manual effort.",
    textAr:
      "تُنتج البيانات البيئية على نظم منفصلة وبتوثيق متفاوت، فيظل الجمع بين أرقام المياه والزراعة والمناخ والنفايات جهداً يدوياً.",
  },
  {
    quadrant: "weakness",
    textEn:
      "Knowledge sits with individuals and in personal folders, so a change of role can remove context that the next team needs.",
    textAr:
      "تتركز المعرفة لدى الأفراد وفي مجلدات شخصية، فقد يؤدي تغيير الدور إلى فقدان سياق يحتاجه الفريق التالي.",
  },
  {
    quadrant: "weakness",
    textEn:
      "Specialist skills in modelling, remote sensing and data science are concentrated in a few people, which limits how many initiatives can run in parallel.",
    textAr:
      "تتركز المهارات المتخصصة في النمذجة والاستشعار عن بعد وعلوم البيانات لدى قلة من الأفراد، مما يحدّ من عدد المبادرات التي تُنفَّذ بالتوازي.",
  },
  {
    quadrant: "weakness",
    textEn:
      "Regulatory changes reach the Office through informal channels, so impact on plans and indicators is often assessed after the fact.",
    textAr:
      "تصل التغييرات التنظيمية إلى المكتب عبر قنوات غير رسمية، فيجري تقدير أثرها على الخطط والمؤشرات في الغالب بعد وقوعها.",
  },
  {
    quadrant: "opportunity",
    textEn:
      "Growing national attention to water security, food security and climate commitments raises demand for a trusted, shared evidence base.",
    textAr:
      "يرفع تنامي الاهتمام الوطني بالأمن المائي والغذائي والالتزامات المناخية الطلب على قاعدة أدلة موثوقة ومشتركة.",
  },
  {
    quadrant: "opportunity",
    textEn:
      "Satellite imagery, sensor networks and open geospatial data make it possible to measure land, water and air conditions more often and at lower cost than field surveys alone.",
    textAr:
      "تتيح صور الأقمار الصناعية وشبكات المستشعرات والبيانات المكانية المفتوحة قياس أحوال الأراضي والمياه والهواء بوتيرة أعلى وتكلفة أقل من المسوح الميدانية وحدها.",
  },
  {
    quadrant: "opportunity",
    textEn:
      "Research capacity in Saudi universities and research centres offers a ready partner base for modelling, simulation and applied studies.",
    textAr:
      "توفر القدرات البحثية في الجامعات ومراكز الأبحاث السعودية قاعدة شركاء جاهزة للنمذجة والمحاكاة والدراسات التطبيقية.",
  },
  {
    quadrant: "opportunity",
    textEn:
      "Machine assisted search and summarisation can make the Office's regulatory and institutional knowledge findable in seconds, with sources cited.",
    textAr:
      "يمكن للبحث والتلخيص بمساعدة الآلة أن يجعل المعرفة التنظيمية والمؤسسية للمكتب متاحة خلال ثوانٍ مع الإشارة إلى المصادر.",
  },
  {
    quadrant: "opportunity",
    textEn:
      "International reporting on sustainable development, climate and biodiversity is converging on common indicators, which lets one data effort serve several audiences.",
    textAr:
      "يتجه الإبلاغ الدولي عن التنمية المستدامة والمناخ والتنوع الأحيائي نحو مؤشرات مشتركة، مما يتيح لجهد بيانات واحد أن يخدم جهات متعددة.",
  },
  {
    quadrant: "threat",
    textEn:
      "Competing priorities among entities can push shared data and reporting duties down the agenda, leaving the national picture incomplete.",
    textAr:
      "قد تدفع الأولويات المتنافسة بين الجهات واجبات مشاركة البيانات والإبلاغ إلى مراتب متأخرة، فتبقى الصورة الوطنية ناقصة.",
  },
  {
    quadrant: "threat",
    textEn:
      "Competition for scarce data, modelling and digital talent from the private sector and giga projects makes retention difficult.",
    textAr:
      "تصعّب المنافسة على الكفاءات النادرة في البيانات والنمذجة والتقنية من القطاع الخاص والمشاريع الكبرى الاحتفاظَ بالمواهب.",
  },
  {
    quadrant: "threat",
    textEn:
      "A cyber incident or a data breach would damage trust in environmental data and could suspend shared services for a period.",
    textAr:
      "قد يضرّ حادث سيبراني أو اختراق للبيانات بالثقة في البيانات البيئية ويعلّق الخدمات المشتركة لفترة.",
  },
  {
    quadrant: "threat",
    textEn:
      "Unofficial or poorly sourced environmental figures circulate faster than official ones and can shape public debate before the Office responds.",
    textAr:
      "تنتشر الأرقام البيئية غير الرسمية أو ضعيفة التوثيق أسرع من الأرقام الرسمية، وقد تشكّل النقاش العام قبل أن يرد المكتب.",
  },
  {
    quadrant: "threat",
    textEn:
      "Climate and water shocks, such as prolonged drought or extreme heat, can force re-planning mid cycle and absorb capacity meant for long term work.",
    textAr:
      "قد تفرض الصدمات المناخية والمائية، كالجفاف الممتد أو الحرارة الشديدة، إعادة التخطيط في منتصف الدورة وتستنزف قدرات مخصصة لعمل طويل الأجل.",
  },
];

/* ------------------------------------------------------------------ */
/* 3. Stakeholders                                                     */
/* ------------------------------------------------------------------ */

export const STAKEHOLDERS: StakeholderItem[] = [
  {
    nameEn: "Programme Steering Committee",
    nameAr: "اللجنة التوجيهية للبرنامج",
    interest: 5,
    influence: 5,
    roleEn:
      "Approves the direction of the National Environment Strategy, receives its progress reports and decides on the policy options the Office puts forward. It is the primary audience for the delivery dashboard and the annual assessment.",
    roleAr:
      "تعتمد توجه الاستراتيجية الوطنية للبيئة وتتلقى تقارير تقدمها وتبت في خيارات السياسات التي يرفعها المكتب. وهي الجمهور الأول للوحة المتابعة التنفيذية وللتقييم السنوي.",
  },
  {
    nameEn: "Ministry of Environment, Water and Agriculture (MEWA)",
    nameAr: "وزارة البيئة والمياه والزراعة",
    interest: 5,
    influence: 5,
    roleEn:
      "Leads sector policy and holds much of the water, agriculture and environment data the Office relies on. Engagement is continuous, on strategy alignment, data sharing and delivery of shared initiatives.",
    roleAr:
      "تقود سياسات القطاع وتحتفظ بجانب كبير من بيانات المياه والزراعة والبيئة التي يعتمد عليها المكتب. والتفاعل معها مستمر في مواءمة الاستراتيجية ومشاركة البيانات وتنفيذ المبادرات المشتركة.",
  },
  {
    nameEn: "Environmental regulators and sector centres (NCEC, NCW, NCVC, MWAN)",
    nameAr: "الجهات التنظيمية والمراكز القطاعية البيئية (المركز الوطني للرقابة على الالتزام البيئي، المركز الوطني للحياة الفطرية، المركز الوطني لتنمية الغطاء النباتي ومكافحة التصحر، المركز الوطني لإدارة النفايات)",
    interest: 4,
    influence: 4,
    roleEn:
      "Own regulation, permitting, monitoring and enforcement within their mandates. They supply administrative records and regulatory changes and carry many of the outputs the strategy tracks.",
    roleAr:
      "تتولى التنظيم والترخيص والرصد والرقابة في نطاق اختصاصاتها. وتمد المكتب بالسجلات الإدارية والتغييرات التنظيمية وتنفذ كثيراً من المخرجات التي تتابعها الاستراتيجية.",
  },
  {
    nameEn: "Water sector entities (SWA, NWC)",
    nameAr: "جهات قطاع المياه (الهيئة السعودية للمياه، شركة المياه الوطنية)",
    interest: 4,
    influence: 4,
    roleEn:
      "Regulate and operate water supply, sanitation and reuse. They provide operational data for the water security theme and are central to demand and supply policy testing.",
    roleAr:
      "تنظم وتشغّل إمدادات المياه والصرف الصحي وإعادة الاستخدام. وتوفر بيانات تشغيلية لمحور الأمن المائي، وهي محورية في اختبار سياسات الطلب والإمداد.",
  },
  {
    nameEn: "General Authority for Statistics (GASTAT)",
    nameAr: "الهيئة العامة للإحصاء",
    interest: 4,
    influence: 3,
    roleEn:
      "Sets national statistical standards and publishes official statistics. The Office aligns its environmental statistics, classifications and release practice with it.",
    roleAr:
      "تضع المعايير الإحصائية الوطنية وتنشر الإحصاءات الرسمية. ويواءم المكتب إحصاءاته البيئية وتصنيفاته وممارسات النشر لديه معها.",
  },
  {
    nameEn: "Saudi Data and AI Authority (SDAIA)",
    nameAr: "الهيئة السعودية للبيانات والذكاء الاصطناعي",
    interest: 3,
    influence: 4,
    roleEn:
      "Sets national direction on data governance and artificial intelligence. The Office follows its guidance in data sharing, classification and responsible use of analytics.",
    roleAr:
      "تحدد التوجه الوطني لحوكمة البيانات والذكاء الاصطناعي. ويتبع المكتب إرشاداتها في مشاركة البيانات وتصنيفها والاستخدام المسؤول للتحليلات.",
  },
  {
    nameEn: "Universities and research centres (KAUST, KFUPM, KACST)",
    nameAr: "الجامعات ومراكز الأبحاث (كاوست، جامعة الملك فهد للبترول والمعادن، مدينة الملك عبدالعزيز للعلوم والتقنية)",
    interest: 4,
    influence: 2,
    roleEn:
      "Provide research, modelling expertise and independent review. They are partners for simulation models, scenario work and capability building.",
    roleAr:
      "توفر الأبحاث والخبرة في النمذجة والمراجعة المستقلة. وهي شريك في نماذج المحاكاة وأعمال السيناريوهات وبناء القدرات.",
  },
  {
    nameEn: "International organisations (FAO, UNEP, World Bank)",
    nameAr: "المنظمات الدولية (منظمة الأغذية والزراعة، برنامج الأمم المتحدة للبيئة، البنك الدولي)",
    interest: 3,
    influence: 3,
    roleEn:
      "Define global indicators and reporting frameworks and offer technical benchmarks. Engagement is through reporting, methodological exchange and joint studies.",
    roleAr:
      "تحدد المؤشرات العالمية وأطر الإبلاغ وتقدم مرجعيات فنية. ويتم التفاعل عبر الإبلاغ وتبادل المنهجيات والدراسات المشتركة.",
  },
];

/* ------------------------------------------------------------------ */
/* 4. Challenges                                                       */
/* ------------------------------------------------------------------ */

export const CHALLENGES: ChallengeItem[] = [
  {
    titleEn: "Plans written to different standards",
    titleAr: "خطط مُعدّة وفق معايير متباينة",
    descriptionEn:
      "Entity and sector strategies arrive in different structures, with objectives that mix outcomes, outputs and activities in the same list. The Office then spends review time reconstructing the results chain instead of judging the substance, and the resulting plans cannot be compared or aggregated into a national picture.",
    descriptionAr:
      "تصل استراتيجيات الجهات والقطاعات بهياكل مختلفة، وبأهداف تخلط النتائج والمخرجات والأنشطة في قائمة واحدة. فيستهلك المكتب وقت المراجعة في إعادة بناء سلسلة النتائج بدل الحكم على المضمون، وتبقى الخطط الناتجة غير قابلة للمقارنة أو للتجميع في صورة وطنية واحدة.",
    goalCode: "G1",
  },
  {
    titleEn: "Environmental data held in silos",
    titleAr: "بيانات بيئية محتجزة في صوامع",
    descriptionEn:
      "Much of the data the Office needs already exists inside entity systems, but access depends on personal relationships and case by case correspondence. Without standing agreements and a shared governance model, collection is repeated for data the sector already holds.",
    descriptionAr:
      "يوجد جانب كبير من البيانات التي يحتاجها المكتب داخل نظم الجهات، لكن الوصول إليها يعتمد على العلاقات الشخصية والمراسلات في كل حالة على حدة. ومن دون اتفاقيات دائمة ونموذج حوكمة مشترك يتكرر جمع بيانات يملكها القطاع أصلاً.",
    goalCode: "G2",
  },
  {
    titleEn: "Data that arrives after the decision",
    titleAr: "بيانات تصل بعد اتخاذ القرار",
    descriptionEn:
      "Environmental data is often released weeks or months after the period it describes, and revisions are not always explained. Decision makers turn to faster but less reliable sources, and the Office's figures lose influence at the moment they matter most.",
    descriptionAr:
      "تُنشر البيانات البيئية في الغالب بعد أسابيع أو أشهر من الفترة التي تصفها، ولا تُشرح المراجعات دائماً. فيلجأ صناع القرار إلى مصادر أسرع وأقل موثوقية، وتفقد أرقام المكتب أثرها في اللحظة التي تكون فيها الأهم.",
    goalCode: "G2",
  },
  {
    titleEn: "Foresight that is read but not used",
    titleAr: "استشراف يُقرأ ولا يُستخدم",
    descriptionEn:
      "Scans, scenarios and risk notes are produced but rarely tied to a decision on the calendar. Without a route into planning cycles and committee agendas, early signals about water, climate or land remain interesting reading rather than prompts for action.",
    descriptionAr:
      "تُنتج المسوح والسيناريوهات ومذكرات المخاطر لكنها نادراً ما ترتبط بقرار مدرج في الروزنامة. ومن دون مسار إلى دورات التخطيط وجداول أعمال اللجان، تبقى الإشارات المبكرة عن المياه والمناخ والأراضي مادة للقراءة لا دافعاً للعمل.",
    goalCode: "G3",
  },
  {
    titleEn: "Regulation and internal work carried by spreadsheets",
    titleAr: "التنظيمات والعمل الداخلي محمولان على الجداول الإلكترونية",
    descriptionEn:
      "Regulatory changes, approvals, reporting and internal performance figures are tracked in spreadsheets and email threads. Context is lost when people change roles, and nobody can see at a glance which regulation affects which plan or indicator.",
    descriptionAr:
      "تُتابَع التغييرات التنظيمية والموافقات والتقارير وأرقام الأداء الداخلي في جداول إلكترونية وسلاسل بريد. ويضيع السياق عند تغيير الأدوار، ولا يستطيع أحد أن يرى بنظرة واحدة أي تنظيم يؤثر في أي خطة أو مؤشر.",
    goalCode: "G4",
  },
  {
    titleEn: "A sector story told in fragments",
    titleAr: "رواية قطاعية مجزأة",
    descriptionEn:
      "Entities, the Office and international bodies each tell part of the environmental story with different figures and different timing. Without one coordinated voice and an agreed set of headline messages, public and partner understanding stays partial.",
    descriptionAr:
      "تروي الجهات والمكتب والهيئات الدولية كل منها جزءاً من القصة البيئية بأرقام وتوقيتات مختلفة. ومن دون صوت منسّق واحد ورسائل رئيسية متفق عليها يظل فهم الجمهور والشركاء جزئياً.",
    goalCode: "G5",
  },
];

/* ------------------------------------------------------------------ */
/* 5. Baselines (illustrative starting positions)                      */
/* ------------------------------------------------------------------ */

export const BASELINES: BaselineItem[] = [
  {
    textEn:
      "Illustrative baseline: in 2024, about 60 percent of entities submitted their annual implementation plans by the published deadline, and a number of entities submitted after the national report had been drafted.",
    textAr:
      "خط أساس توضيحي: في عام 2024 رفعت نحو 60 بالمئة من الجهات خططها التنفيذية السنوية في الموعد المعلن، فيما رفعت جهات أخرى خططها بعد إعداد مسودة التقرير الوطني.",
  },
  {
    textEn:
      "Illustrative baseline: in 2024, around 70 percent of scheduled data releases were published on the date announced in the advance release calendar.",
    textAr:
      "خط أساس توضيحي: في عام 2024 نُشر نحو 70 بالمئة من إصدارات البيانات المجدولة في التاريخ المعلن في روزنامة النشر المسبقة.",
  },
  {
    textEn:
      "Illustrative baseline: the average gap between the end of the reference period and publication for quarterly environmental indicators was about 90 days in 2024, against a good practice target the Office has set at 60 days.",
    textAr:
      "خط أساس توضيحي: بلغ متوسط الفجوة بين نهاية الفترة المرجعية والنشر للمؤشرات البيئية الربعية نحو 90 يوماً في عام 2024، مقابل مستهدف الممارسة الجيدة الذي وضعه المكتب عند 60 يوماً.",
  },
  {
    textEn:
      "Illustrative baseline: at the end of 2024, fewer than half of the priority administrative data sources identified by the Office were covered by a signed data sharing agreement.",
    textAr:
      "خط أساس توضيحي: في نهاية عام 2024 كان أقل من نصف مصادر البيانات الإدارية ذات الأولوية التي حددها المكتب مغطى باتفاقية مشاركة بيانات موقّعة.",
  },
  {
    textEn:
      "Illustrative baseline: NES monitoring covered a few hundred initiatives in 2024, of which roughly one third submitted a complete evidence pack with their progress report.",
    textAr:
      "خط أساس توضيحي: غطّت متابعة الاستراتيجية الوطنية للبيئة بضع مئات من المبادرات في عام 2024، قدّم نحو ثلثها حزمة أدلة مكتملة مع تقرير التقدم.",
  },
  {
    textEn:
      "Illustrative baseline: staff turnover at the Office was in the low teens in percentage terms in 2024 and higher in specialist data and modelling roles, with filling a specialist vacancy taking about six months on average.",
    textAr:
      "خط أساس توضيحي: بلغ دوران الموظفين في المكتب نسبة تقارب العشرة بالمئة وما فوقها قليلاً في عام 2024، وارتفع في أدوار البيانات والنمذجة المتخصصة، مع استغراق شغل الشاغر المتخصص نحو ستة أشهر في المتوسط.",
  },
  {
    textEn:
      "Illustrative baseline: by mid 2025, only a small minority of the planning staff working in entities had completed certified training in results based planning.",
    textAr:
      "خط أساس توضيحي: بحلول منتصف عام 2025 لم يكن قد أتمّ التدريب المعتمد على التخطيط القائم على النتائج سوى أقلية صغيرة من العاملين في التخطيط داخل الجهات.",
  },
  {
    textEn:
      "Illustrative baseline: the open data portal held a few hundred published datasets at the end of 2024, and less than half of user support requests were answered within five working days.",
    textAr:
      "خط أساس توضيحي: ضمّت بوابة البيانات المفتوحة بضع مئات من مجموعات البيانات المنشورة في نهاية عام 2024، وأُجيب عن أقل من نصف طلبات دعم المستخدمين خلال خمسة أيام عمل.",
  },
  {
    textEn:
      "Illustrative baseline: at the start of 2025 the Office operated a small number of policy simulation models and delivered two strategic risk briefings to leadership during 2024.",
    textAr:
      "خط أساس توضيحي: في بداية عام 2025 كان المكتب يشغّل عدداً محدوداً من نماذج محاكاة السياسات، وقدّم إحاطتين استراتيجيتين عن المخاطر إلى القيادة خلال عام 2024.",
  },
  {
    textEn:
      "Illustrative baseline: at the start of 2025 only a handful of the Office's core internal processes were automated end to end, and most internal performance reporting was still compiled manually in spreadsheets.",
    textAr:
      "خط أساس توضيحي: في بداية عام 2025 لم يكن مؤتمتاً من البداية إلى النهاية سوى عدد قليل من العمليات الداخلية الأساسية للمكتب، وظل معظم تقارير الأداء الداخلي يُعدّ يدوياً في جداول إلكترونية.",
  },
];

/* ------------------------------------------------------------------ */
/* 6. Governance                                                       */
/* ------------------------------------------------------------------ */

export const GOVERNANCE: GovernanceBody[] = [
  {
    bodyNameEn: "Strategy Steering Committee",
    bodyNameAr: "لجنة توجيه الاستراتيجية",
    roleEn:
      "Chaired by the Programme Director, the committee owns the institutional strategy: it approves the annual targets, reviews the scorecard and the risk register each quarter, decides on the reallocation of budget and people between projects, and escalates blockers that departments cannot resolve on their own.",
    roleAr:
      "برئاسة مدير البرنامج، تتولى اللجنة ملكية الاستراتيجية المؤسسية: تعتمد المستهدفات السنوية، وتستعرض بطاقة الأداء وسجل المخاطر كل ربع سنة، وتبت في إعادة توزيع الموازنة والكوادر بين المشاريع، وتعالج المعوقات التي تعجز الإدارات عن حلها بمفردها.",
    cadence: "quarterly",
    members: [
      { en: "Programme Director, Chair", ar: "مدير البرنامج، رئيساً" },
      {
        en: "Head of the Strategy and Performance Sector",
        ar: "رئيس قطاع الاستراتيجية والأداء",
      },
      {
        en: "Head of the Data and Knowledge Sector",
        ar: "رئيس قطاع البيانات والمعرفة",
      },
      {
        en: "Head of the Regulatory Affairs Sector",
        ar: "رئيس قطاع الشؤون التنظيمية",
      },
      {
        en: "Head of the Corporate Services Sector",
        ar: "رئيس قطاع الخدمات المؤسسية",
      },
      {
        en: "Director of Strategy Development, Rapporteur",
        ar: "مدير إدارة تطوير الاستراتيجية، مقرراً",
      },
    ],
  },
  {
    bodyNameEn: "Strategy Office",
    bodyNameAr: "مكتب الاستراتيجية",
    roleEn:
      "The Strategy Development department acts as the Strategy Office. It maintains the results chain and the indicator cards, collects actuals on each indicator's cadence, challenges the quality of the evidence behind a reported figure, prepares the quarterly pack for the steering committee, and keeps the change log of every amendment to the strategy.",
    roleAr:
      "تقوم إدارة تطوير الاستراتيجية بدور مكتب الاستراتيجية. فتتعهد سلسلة النتائج وبطاقات المؤشرات، وتجمع القيم الفعلية وفق دورية كل مؤشر، وتراجع جودة الأدلة وراء أي رقم مرفوع، وتُعدّ الحزمة الربعية للجنة التوجيهية، وتحتفظ بسجل التغييرات لكل تعديل على الاستراتيجية.",
    cadence: "monthly",
    members: [
      {
        en: "Director of Strategy Development, Head of the Strategy Office",
        ar: "مدير إدارة تطوير الاستراتيجية، رئيساً لمكتب الاستراتيجية",
      },
      {
        en: "Strategy and institutional performance analysts",
        ar: "محللو الاستراتيجية والأداء المؤسسي",
      },
      {
        en: "Representative of Planning Quality and Standards",
        ar: "ممثل إدارة جودة الخطط والمعايير",
      },
      {
        en: "Representative of Programme Monitoring",
        ar: "ممثل إدارة متابعة البرنامج",
      },
      {
        en: "Representative of Finance and Administration for the budget link",
        ar: "ممثل إدارة المالية والشؤون الإدارية للربط مع الموازنة",
      },
    ],
  },
  {
    bodyNameEn: "Department Focal Points Network",
    bodyNameAr: "شبكة ضباط الاتصال في الإدارات",
    roleEn:
      "One named focal point in every department carries the strategy inside the department: updating project and activity status, entering actuals against indicators the department owns, and raising risks and dependencies early. The network meets monthly and is the Strategy Office's working channel into the departments.",
    roleAr:
      "يتولى ضابط اتصال مسمّى في كل إدارة حمل الاستراتيجية داخل إدارته: تحديث حالة المشاريع والأنشطة، وإدخال القيم الفعلية للمؤشرات التي تملكها الإدارة، ورفع المخاطر والاعتماديات مبكراً. وتجتمع الشبكة شهرياً وهي قناة عمل مكتب الاستراتيجية مع الإدارات.",
    cadence: "monthly",
    members: [
      {
        en: "Focal points of the departments of the Strategy and Performance Sector",
        ar: "ضباط الاتصال في إدارات قطاع الاستراتيجية والأداء",
      },
      {
        en: "Focal points of the departments of the Data and Knowledge Sector",
        ar: "ضباط الاتصال في إدارات قطاع البيانات والمعرفة",
      },
      {
        en: "Focal points of the departments of the Regulatory Affairs Sector",
        ar: "ضباط الاتصال في إدارات قطاع الشؤون التنظيمية",
      },
      {
        en: "Focal points of the theme departments for water, agriculture, climate, land, waste and air",
        ar: "ضباط الاتصال في إدارات المحاور للمياه والزراعة والمناخ والأراضي والنفايات والهواء",
      },
      {
        en: "Focal points of the departments of the Corporate Services Sector",
        ar: "ضباط الاتصال في إدارات قطاع الخدمات المؤسسية",
      },
      {
        en: "Focal points of the Office of the Programme Director departments",
        ar: "ضباط الاتصال في إدارات مكتب مدير البرنامج",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* 7. Risk register (20 risks, R-01 to R-20)                           */
/* ------------------------------------------------------------------ */

export const RISKS: RiskItem[] = [
  {
    code: "R-01",
    titleEn: "Entities submit progress data late or incomplete",
    titleAr: "تأخر الجهات في رفع بيانات التقدم أو نقصها",
    descriptionEn:
      "Quarterly progress submissions from entities arrive after the consolidation window or without the supporting evidence, so the national delivery picture is built on partial returns and has to be revised after publication.",
    descriptionAr:
      "تصل تقارير التقدم الربعية من الجهات بعد نافذة التجميع أو من دون الأدلة الداعمة، فتُبنى صورة الإنجاز الوطني على بيانات ناقصة ويُضطر المكتب إلى تعديلها بعد النشر.",
    likelihood: 5,
    impact: 4,
    mitigationEn:
      "Publish a binding reporting calendar with an automated reminder sequence, give each entity a named implementation support officer, and report submission compliance by entity to the Programme Steering Committee alongside the progress figures.",
    mitigationAr:
      "إصدار روزنامة ملزمة لرفع التقارير مع سلسلة تذكيرات آلية، وتخصيص ضابط دعم تنفيذ مسمّى لكل جهة، ورفع مستوى الالتزام بالرفع لكل جهة إلى اللجنة التوجيهية للبرنامج إلى جانب أرقام التقدم.",
    status: "open",
    nodeCode: "G1.IO2",
  },
  {
    code: "R-02",
    titleEn: "Cyber incident exposing sensitive environmental data",
    titleAr: "حادثة سيبرانية تكشف بيانات بيئية حساسة",
    descriptionEn:
      "An intrusion or a mishandled transfer exposes restricted records held for analysis, such as facility level compliance data or licensing records, breaching the confidentiality terms under which entities share them.",
    descriptionAr:
      "اختراق أو نقل خاطئ يكشف سجلات مقيّدة محتفظاً بها للتحليل، مثل بيانات الامتثال على مستوى المنشآت أو سجلات التراخيص، بما يخل بشروط السرية التي تشارك الجهات بياناتها بموجبها.",
    likelihood: 2,
    impact: 5,
    mitigationEn:
      "Segregate the restricted data environment with no external egress, enforce role based access with quarterly recertification, encrypt every transfer, and run an annual breach simulation with the incident response team.",
    mitigationAr:
      "عزل بيئة البيانات المقيّدة دون منافذ خروج خارجية، وتطبيق صلاحيات قائمة على الأدوار مع إعادة اعتماد ربعية، وتشفير كل عملية نقل، وإجراء محاكاة سنوية للاختراق مع فريق الاستجابة للحوادث.",
    status: "mitigating",
    nodeCode: "G4.IO2.OP2",
  },
  {
    code: "R-03",
    titleEn: "Loss of specialist data and modelling staff",
    titleAr: "فقدان الكوادر المتخصصة في البيانات والنمذجة",
    descriptionEn:
      "Experienced staff in environmental accounts, remote sensing and quantitative modelling leave for better paid roles, and the methods they hold personally are not documented well enough for a successor to continue without a gap.",
    descriptionAr:
      "يغادر أصحاب الخبرة في الحسابات البيئية والاستشعار عن بعد والنمذجة الكمية إلى وظائف أعلى أجراً، ولا تكون المنهجيات التي يحتفظون بها شخصياً موثقة بما يكفي ليواصل خلفهم العمل دون انقطاع.",
    likelihood: 4,
    impact: 4,
    mitigationEn:
      "Run a retention review for critical roles with the Human Resources department, require a documented method file and a named deputy for every data product, and build a standing pool of trained successors through capability development.",
    mitigationAr:
      "إجراء مراجعة للاحتفاظ بالأدوار الحرجة مع إدارة الموارد البشرية، واشتراط ملف منهجية موثق ونائب مسمّى لكل منتج بيانات، وبناء رصيد دائم من الخلفاء المدرَّبين عبر إدارة تنمية القدرات.",
    status: "mitigating",
    nodeCode: "G2",
  },
  {
    code: "R-04",
    titleEn: "Data systems modernisation overruns",
    titleAr: "تجاوز مشروع تحديث نظم البيانات للمدة والكلفة",
    descriptionEn:
      "The replacement of the environmental data production platform slips beyond its planned window, forcing teams to run the old and new systems in parallel and delaying the releases that depend on the migration.",
    descriptionAr:
      "يتأخر استبدال منصة إنتاج البيانات البيئية عن نافذته المخططة، فتضطر الفرق إلى تشغيل النظامين القديم والجديد بالتوازي وتتأخر الإصدارات المعتمدة على الترحيل.",
    likelihood: 3,
    impact: 4,
    mitigationEn:
      "Migrate one data domain at a time with a tested rollback for each, hold release dates on the legacy system until the new one has produced two clean cycles, and review the vendor plan monthly against milestones.",
    mitigationAr:
      "ترحيل مجال بيانات واحد في كل مرة مع خطة تراجع مجرّبة لكل منها، والإبقاء على مواعيد الإصدار على النظام القديم حتى ينتج الجديد دورتين سليمتين، ومراجعة خطة المورّد شهرياً قياساً بالمراحل.",
    status: "open",
    nodeCode: "G2.IO1.OP2",
  },
  {
    code: "R-05",
    titleEn: "Data sharing agreements stall on legal grounds",
    titleAr: "تعثر اتفاقيات تبادل البيانات لأسباب نظامية",
    descriptionEn:
      "Entities decline or delay signature because their own rules restrict disclosure, so priority administrative sources remain unavailable and costly separate collection continues.",
    descriptionAr:
      "ترفض جهات التوقيع أو تؤجله لأن أنظمتها تقيّد الإفصاح، فتظل مصادر البيانات الإدارية ذات الأولوية غير متاحة ويستمر جمع منفصل مرتفع الكلفة.",
    likelihood: 4,
    impact: 3,
    mitigationEn:
      "Issue a standard agreement cleared in advance by legal advisers, offer a restricted access tier for sensitive fields, and escalate the remaining cases through the Data Governance Board rather than bilaterally.",
    mitigationAr:
      "إصدار اتفاقية نموذجية يُجاز نصها مسبقاً من المستشارين القانونيين، وإتاحة مستوى وصول مقيّد للحقول الحساسة، ورفع الحالات المتبقية عبر مجلس حوكمة البيانات بدل المعالجة الثنائية.",
    status: "open",
    nodeCode: "G2.IO2.OP1",
  },
  {
    code: "R-06",
    titleEn: "Gaps in field monitoring coverage and response",
    titleAr: "فجوات في تغطية الرصد الميداني والاستجابة له",
    descriptionEn:
      "Monitoring stations, field surveys and reporting entities cover less ground, or respond less completely, than planned, which raises uncertainty, forces heavier estimation and weakens confidence in the published figures.",
    descriptionAr:
      "تغطي محطات الرصد والمسوح الميدانية والجهات المبلِّغة نطاقاً أقل مما هو مخطط، أو تستجيب بصورة أقل اكتمالاً، مما يرفع عدم اليقين ويفرض تقديراً أكبر ويضعف الثقة في الأرقام المنشورة.",
    likelihood: 3,
    impact: 4,
    mitigationEn:
      "Combine ground measurement with satellite and administrative sources where they are available, simplify reporting templates, and tell reporting entities how their data is protected and used.",
    mitigationAr:
      "الجمع بين القياس الميداني ومصادر الأقمار الصناعية والبيانات الإدارية متى توفرت، وتبسيط نماذج الإبلاغ، وإعلام الجهات المبلِّغة بكيفية حماية بياناتها واستخدامها.",
    status: "mitigating",
    nodeCode: "G2.IO1",
  },
  {
    code: "R-07",
    titleEn: "Foresight products do not reach decisions",
    titleAr: "عدم وصول منتجات الاستشراف إلى القرار",
    descriptionEn:
      "Scenario sets and scanning reports are circulated but arrive outside the planning and budget calendar, so they inform discussion without changing any commitment.",
    descriptionAr:
      "تُوزَّع مجموعات السيناريوهات وتقارير المسح لكنها تصل خارج روزنامة التخطيط والموازنة، فتثري النقاش دون أن تغيّر أي التزام.",
    likelihood: 3,
    impact: 3,
    mitigationEn:
      "Fix the foresight calendar to the planning and budget cycle, require a foresight annex in every sector strategy review, and close each briefing with named decisions and owners rather than with a discussion.",
    mitigationAr:
      "ربط روزنامة الاستشراف بدورة التخطيط والموازنة، واشتراط ملحق استشرافي في كل مراجعة لاستراتيجية قطاعية، وإنهاء كل إحاطة بقرارات ومسؤولين مسمّين لا بنقاش.",
    status: "open",
    nodeCode: "G3",
  },
  {
    code: "R-08",
    titleEn: "Mid cycle reduction of the Programme Office budget",
    titleAr: "خفض موازنة مكتب البرنامج في منتصف الدورة",
    descriptionEn:
      "A fiscal correction cuts the operating and capital envelope during the strategy period, which would stop the systems modernisation and the monitoring programme at the same time.",
    descriptionAr:
      "تخفض مراجعة مالية سقف الإنفاق التشغيلي والرأسمالي خلال فترة الاستراتيجية، مما قد يوقف تحديث النظم وبرنامج الرصد في آن واحد.",
    likelihood: 1,
    impact: 5,
    mitigationEn:
      "Maintain a ranked list of projects with the minimum viable scope of each, agree the core monitoring programme as a protected line with the Ministry of Finance, and phase contracts so that commitments can be paused at defined points.",
    mitigationAr:
      "الاحتفاظ بقائمة مرتبة للمشاريع مع الحد الأدنى القابل للتنفيذ من كل منها، والاتفاق مع وزارة المالية على برنامج الرصد الأساسي بوصفه بنداً محمياً، وتجزئة العقود بحيث يمكن إيقاف الالتزامات عند نقاط محددة.",
    status: "open",
    nodeCode: null,
  },
  {
    code: "R-09",
    titleEn: "Shift in national priorities forces re-planning",
    titleAr: "تغير الأولويات الوطنية يفرض إعادة التخطيط",
    descriptionEn:
      "A change in national direction or an urgent environmental mandate, such as a drought response, redirects the Office's capacity to unplanned work, and the institutional strategy is quietly deprioritised while the new demand is served.",
    descriptionAr:
      "يؤدي تغير التوجه الوطني أو تكليف بيئي عاجل، كالاستجابة للجفاف، إلى تحويل طاقة المكتب نحو عمل غير مخطط، فتتراجع الاستراتيجية المؤسسية بهدوء في سلّم الأولويات أثناء تلبية الطلب الجديد.",
    likelihood: 3,
    impact: 4,
    mitigationEn:
      "Reserve a defined share of departmental capacity for unplanned national tasking, and require the steering committee to record formally which targets are deferred whenever new work is absorbed.",
    mitigationAr:
      "تخصيص حصة محددة من طاقة الإدارات للتكليفات الوطنية غير المخططة، واشتراط أن تسجّل اللجنة التوجيهية رسمياً المستهدفات المؤجلة كلما استُوعب عمل جديد.",
    status: "open",
    nodeCode: null,
  },
  {
    code: "R-10",
    titleEn: "The results framework manual is adopted formally but not in practice",
    titleAr: "اعتماد دليل إطار النتائج شكلياً دون تطبيق فعلي",
    descriptionEn:
      "Entities fill in the new templates while keeping their old habit of listing activities as objectives, so documents look compliant and the results chain behind them remains broken.",
    descriptionAr:
      "تملأ الجهات النماذج الجديدة مع إبقاء عادتها القديمة في سرد الأنشطة بوصفها أهدافاً، فتبدو الوثائق ملتزمة وتبقى سلسلة النتائج خلفها مكسورة.",
    likelihood: 4,
    impact: 2,
    mitigationEn:
      "Score every submitted strategy against a published quality checklist, return non compliant documents with written findings, and pair the manual with coaching clinics for entity planning teams during drafting.",
    mitigationAr:
      "تقييم كل استراتيجية مرفوعة وفق قائمة تحقق معلنة للجودة، وإعادة الوثائق غير المستوفية مع ملاحظات مكتوبة، وربط الدليل بعيادات إرشاد لفرق التخطيط في الجهات أثناء الصياغة.",
    status: "mitigating",
    nodeCode: "G1.IO1.OP1",
  },
  {
    code: "R-11",
    titleEn: "Unofficial figures compete with official environmental data",
    titleAr: "منافسة الأرقام غير الرسمية للبيانات البيئية الرسمية",
    descriptionEn:
      "Entities, consultancies and media publish their own estimates for the same phenomena, and users are left with several numbers and no way to tell which is authoritative.",
    descriptionAr:
      "تنشر الجهات وشركات الاستشارات ووسائل الإعلام تقديراتها الخاصة للظواهر نفسها، فيجد المستخدمون أمامهم أرقاماً متعددة ولا سبيل لمعرفة أيها المرجع.",
    likelihood: 5,
    impact: 2,
    mitigationEn:
      "Publish an official data mark and a single reference page per indicator, shorten release lag so the official figure arrives first, and agree a clearance rule with entities before any national figure is released.",
    mitigationAr:
      "إصدار علامة للبيانات الرسمية وصفحة مرجعية واحدة لكل مؤشر، وتقصير فجوة النشر ليصل الرقم الرسمي أولاً، والاتفاق مع الجهات على قاعدة إجازة قبل إصدار أي رقم وطني.",
    status: "open",
    nodeCode: "G2.IO3",
  },
  {
    code: "R-12",
    titleEn: "Low adoption of the digital workplace",
    titleAr: "ضعف تبني بيئة العمل الرقمية",
    descriptionEn:
      "Staff continue to work through email attachments and personal spreadsheets after the new platform is delivered, so the promised single version of a document never materialises.",
    descriptionAr:
      "يواصل الموظفون العمل عبر مرفقات البريد والجداول الشخصية بعد تسليم المنصة الجديدة، فلا تتحقق النسخة الواحدة الموعودة للوثيقة.",
    likelihood: 3,
    impact: 2,
    mitigationEn:
      "Move the processes that matter most to each department first, retire the old channel for those processes on a published date, and track adoption per department in the monthly focal points meeting.",
    mitigationAr:
      "نقل العمليات الأهم في كل إدارة أولاً، وإيقاف القناة القديمة لتلك العمليات في تاريخ معلن، ومتابعة التبني لكل إدارة في اجتماع ضباط الاتصال الشهري.",
    status: "mitigating",
    nodeCode: "G4.IO2.OP1",
  },
  {
    code: "R-13",
    titleEn: "Dependence on a single vendor for analytics platforms",
    titleAr: "الاعتماد على مورّد وحيد لمنصات التحليل",
    descriptionEn:
      "Several reporting and analytics products rest on one supplier's stack, which concentrates renewal risk and limits the Office's room to negotiate or to move.",
    descriptionAr:
      "تعتمد عدة منتجات للتقارير والتحليل على حزمة مورّد واحد، مما يركّز مخاطر التجديد ويحدّ من مساحة المكتب للتفاوض أو للانتقال.",
    likelihood: 2,
    impact: 3,
    mitigationEn:
      "Keep all source data and transformation logic inside stores owned by the Office, require export in open formats in every contract, and stagger renewal dates so no two critical platforms expire together.",
    mitigationAr:
      "إبقاء كل البيانات المصدرية ومنطق التحويل داخل مخازن يملكها المكتب، واشتراط التصدير بصيغ مفتوحة في كل عقد، وتوزيع مواعيد التجديد بحيث لا تنتهي منصتان حرجتان معاً.",
    status: "open",
    nodeCode: null,
  },
  {
    code: "R-14",
    titleEn: "Late submissions to international indicator bodies",
    titleAr: "التأخر في الرفع إلى جهات المؤشرات الدولية",
    descriptionEn:
      "A national data return misses an international compilation deadline, and Saudi Arabia is shown with an older figure or with an estimate produced by the compiling organisation.",
    descriptionAr:
      "تفوت بيانات وطنية موعد تجميع دولياً، فتظهر المملكة بأرقام أقدم أو بتقدير تعدّه المنظمة المجمِّعة.",
    likelihood: 2,
    impact: 2,
    mitigationEn:
      "Maintain a calendar of every international submission with an owner and a two week buffer, and pre clear recurring returns with the source entities at the start of each year.",
    mitigationAr:
      "الاحتفاظ بروزنامة لكل رفع دولي مع مسؤول وهامش أسبوعين، وإجازة التقارير المتكررة مسبقاً مع الجهات المصدرية في مطلع كل عام.",
    status: "open",
    nodeCode: "G5.IO1.OP2",
  },
  {
    code: "R-15",
    titleEn: "Turnover in the department focal points network",
    titleAr: "دوران أعضاء شبكة ضباط الاتصال في الإدارات",
    descriptionEn:
      "Focal points change frequently and their replacements arrive without induction, so data quality in the strategy system drops and the Strategy Office absorbs the correction work.",
    descriptionAr:
      "يتغير ضباط الاتصال بكثرة ويصل بدلاؤهم دون تهيئة، فتنخفض جودة البيانات في منظومة الاستراتيجية ويتحمل مكتب الاستراتيجية عبء التصحيح.",
    likelihood: 4,
    impact: 2,
    mitigationEn:
      "Name a deputy focal point in every department, publish a one hour induction pack and a short guide, and require a handover note before any focal point is replaced.",
    mitigationAr:
      "تسمية نائب لضابط الاتصال في كل إدارة، ونشر حزمة تهيئة مدتها ساعة ودليل موجز، واشتراط مذكرة تسليم قبل استبدال أي ضابط اتصال.",
    status: "open",
    nodeCode: null,
  },
  {
    code: "R-16",
    titleEn: "Business continuity arrangements untested",
    titleAr: "عدم اختبار ترتيبات استمرارية الأعمال",
    descriptionEn:
      "Continuity plans exist on paper but have not been exercised against a real disruption, so recovery times for the data release chain and the leadership dashboard are unproven.",
    descriptionAr:
      "توجد خطط الاستمرارية على الورق لكنها لم تُجرَّب أمام تعطل فعلي، فتبقى أزمنة التعافي لسلسلة إصدار البيانات ولوحة القيادة غير مثبتة.",
    likelihood: 2,
    impact: 4,
    mitigationEn:
      "Run two continuity exercises a year covering a data centre failure and the loss of a key system, publish the recovery times achieved, and close every gap found with a dated action.",
    mitigationAr:
      "إجراء تمرينين للاستمرارية سنوياً يغطيان تعطل مركز البيانات وفقدان نظام رئيسي، ونشر أزمنة التعافي المتحققة، وإغلاق كل فجوة تُكتشف بإجراء مؤرخ.",
    status: "mitigating",
    nodeCode: null,
  },
  {
    code: "R-17",
    titleEn: "Policy lab trials return inconclusive results",
    titleAr: "خروج تجارب مختبر السياسات بنتائج غير حاسمة",
    descriptionEn:
      "A behavioural or policy trial is run on too small a sample or without a clean comparison group, so the finding cannot support a recommendation either way.",
    descriptionAr:
      "تُجرى تجربة سلوكية أو سياساتية على عينة صغيرة أو دون مجموعة مقارنة نظيفة، فلا تدعم النتيجة أي توصية في أي اتجاه.",
    likelihood: 2,
    impact: 2,
    mitigationEn:
      "Require a pre registered design with a power calculation before any trial starts, and publish null results as findings so that the learning is kept rather than repeated.",
    mitigationAr:
      "اشتراط تصميم مسجّل مسبقاً مع حساب القوة الإحصائية قبل بدء أي تجربة، ونشر النتائج الصفرية بوصفها مخرجات حتى يُحفظ التعلم ولا يتكرر.",
    status: "open",
    nodeCode: "G1.IO3.OP2",
  },
  {
    code: "R-18",
    titleEn: "Misinterpretation of environmental figures in public coverage",
    titleAr: "إساءة تفسير الأرقام البيئية في التغطية العامة",
    descriptionEn:
      "A release is reported without its definitions or its revision status, a misleading headline spreads, and the Office spends the following weeks correcting the record instead of explaining the substance.",
    descriptionAr:
      "يُنقل إصدار دون تعريفاته أو حالة مراجعته، فينتشر عنوان مضلل، ويقضي المكتب الأسابيع التالية في تصحيح السجل بدل شرح المضمون.",
    likelihood: 3,
    impact: 2,
    mitigationEn:
      "Issue a plain language summary and a chart pack with every major release, brief editors ahead of sensitive publications, and keep a standing correction procedure with a named spokesperson.",
    mitigationAr:
      "إصدار ملخص بلغة مبسطة وحزمة رسوم مع كل إصدار رئيسي، وإحاطة المحررين قبل المنشورات الحساسة، والاحتفاظ بإجراء تصحيح دائم مع متحدث مسمّى.",
    status: "open",
    nodeCode: null,
  },
  {
    code: "R-19",
    titleEn: "Disruption from the office relocation",
    titleAr: "اضطراب ناتج عن الانتقال إلى المقر الجديد",
    descriptionEn:
      "The move of departments to the new premises during 2025 was expected to interrupt monitoring operations and the release schedule for several weeks.",
    descriptionAr:
      "كان يُتوقع أن يعطّل انتقال الإدارات إلى المقر الجديد خلال عام 2025 عمليات الرصد وجدول الإصدار لعدة أسابيع.",
    likelihood: 1,
    impact: 1,
    mitigationEn:
      "The move was phased outside the release peaks with remote working kept available throughout, and no release date was missed, so the risk was closed after the final department relocated.",
    mitigationAr:
      "جرى الانتقال على مراحل خارج ذرى الإصدار مع إبقاء العمل عن بُعد متاحاً طوال الوقت، ولم يفُت أي موعد إصدار، فأُغلقت المخاطرة بعد انتقال آخر إدارة.",
    status: "closed",
    nodeCode: null,
  },
  {
    code: "R-20",
    titleEn: "Delay in approving the institutional strategy",
    titleAr: "تأخر اعتماد الاستراتيجية المؤسسية",
    descriptionEn:
      "Approval of the strategy was at risk of slipping past the start of the 2025 planning year, which would have left departments planning against an unapproved results chain.",
    descriptionAr:
      "كان اعتماد الاستراتيجية معرّضاً للتأخر عن بداية سنة التخطيط 2025، مما كان سيترك الإدارات تخطط وفق سلسلة نتائج غير معتمدة.",
    likelihood: 1,
    impact: 2,
    mitigationEn:
      "The draft was reviewed with the sectors ahead of submission and approved on 16 March 2025, and departmental plans were aligned within the same quarter, so the risk was closed.",
    mitigationAr:
      "روجعت المسودة مع القطاعات قبل رفعها واعتُمدت في 16 مارس 2025، ووُوئمت خطط الإدارات في الربع نفسه، فأُغلقت المخاطرة.",
    status: "closed",
    nodeCode: null,
  },
];

/* ------------------------------------------------------------------ */
/* 8. Goals (G1 to G5)                                                 */
/* ------------------------------------------------------------------ */

export const GOALS: GoalSeed[] = [
  {
    code: "G1",
    titleEn: "Excellence in environmental strategy and delivery",
    titleAr: "التميز في الاستراتيجية البيئية وتنفيذها",
    descriptionEn:
      "The Office makes environmental planning a disciplined craft: one results based method, one set of templates, and a technical review that every sector and entity strategy passes before it is adopted. It supports the delivery of the National Environment Strategy with evidence and hands on implementation help rather than correspondence, and it tests major policies through simulation and trials before they are committed. The goal is achieved when plans across the sector are comparable, monitorable and actually delivered.",
    descriptionAr:
      "يجعل المكتب التخطيط البيئي ممارسة منضبطة تقوم على منهجية موحدة قائمة على النتائج، ونماذج معتمدة، ومراجعة فنية تمر بها كل استراتيجية قطاعية ومؤسسية قبل اعتمادها. ويدعم تنفيذ الاستراتيجية الوطنية للبيئة بالأدلة وبالدعم الميداني المباشر لا بالمراسلات، ويختبر السياسات الكبرى عبر المحاكاة والتجارب قبل الالتزام بها. ويتحقق الهدف حين تصبح خطط القطاع قابلة للمقارنة والمتابعة والإنجاز الفعلي.",
    ownerUnitCode: "SPD",
    alignment: [
      {
        targetKind: "nes_node",
        targetCode: "O7",
        labelEn: "Regulatory Compliance",
        labelAr: "الامتثال التنظيمي",
        noteEn:
          "A single planning standard and quality assured reviews keep entity plans consistent with the regulatory framework they must deliver under, and make gaps visible early.",
        noteAr:
          "يحافظ توحيد معيار التخطيط ومراجعات ضمان الجودة على اتساق خطط الجهات مع الإطار التنظيمي الذي تنفذ في ظله، ويكشف الفجوات مبكراً.",
      },
      {
        targetKind: "nes_node",
        targetCode: "O1",
        labelEn: "Water Security",
        labelAr: "الأمن المائي",
        noteEn:
          "Water initiatives reach their targets faster when their plans are properly specified and when simulation exposes weak assumptions before money is committed.",
        noteAr:
          "تبلغ مبادرات المياه مستهدفاتها بوتيرة أسرع حين تكون خططها محددة بدقة وحين تكشف المحاكاة الافتراضات الضعيفة قبل الالتزام بالإنفاق.",
      },
      {
        targetKind: "nes_node",
        targetCode: "O2",
        labelEn: "Agriculture and Food Security",
        labelAr: "الأمن الغذائي والزراعة",
        noteEn:
          "Testing policies before adoption and linking plans to costed outputs reduces spending on initiatives that would not have produced the intended result for farming and food systems.",
        noteAr:
          "يقلّص اختبار السياسات قبل اعتمادها وربط الخطط بمخرجات مُكلّفة الإنفاقَ على مبادرات ما كانت لتحقق النتيجة المقصودة للمزارع والنظم الغذائية.",
      },
    ],
  },
  {
    code: "G2",
    titleEn: "Trusted environmental data and statistics",
    titleAr: "بيانات وإحصاءات بيئية موثوقة",
    descriptionEn:
      "The Office builds the environmental evidence base the sector relies on: data that meets international quality standards, is governed and shared as an asset across entities, and is easy for users to find, trust and reuse. It modernises how monitoring data is captured and produced, publishes on a predictable calendar and explains every revision. The goal is achieved when decision makers reach for the Office's figures first.",
    descriptionAr:
      "يبني المكتب قاعدة الأدلة البيئية التي يعتمد عليها القطاع: بيانات تستوفي المعايير الدولية للجودة، وتُحوكَم وتُشارَك بين الجهات بوصفها أصلاً، ويسهل على المستخدمين إيجادها والوثوق بها وإعادة استخدامها. ويحدّث طريقة التقاط بيانات الرصد وإنتاجها، وينشر وفق روزنامة متوقعة ويشرح كل مراجعة. ويتحقق الهدف حين يلجأ صناع القرار إلى أرقام المكتب أولاً.",
    ownerUnitCode: "EDA",
    alignment: [
      {
        targetKind: "nes_node",
        targetCode: "O3",
        labelEn: "Climate and Environment",
        labelAr: "المناخ والبيئة",
        noteEn:
          "Trusted emissions, land and environmental condition data is the base for climate reporting and for tracking environmental commitments.",
        noteAr:
          "تشكل بيانات الانبعاثات والأراضي والأحوال البيئية الموثوقة القاعدة للإبلاغ المناخي ولمتابعة الالتزامات البيئية.",
      },
      {
        targetKind: "data_strategy_initiative",
        targetCode: "environmental-data-strategy",
        labelEn: "Environmental Data Strategy",
        labelAr: "استراتيجية البيانات البيئية",
        noteEn:
          "Data governance, sharing agreements, a unified catalogue and quality standards are the core of the environmental data strategy and are delivered through this goal.",
        noteAr:
          "تشكل حوكمة البيانات واتفاقيات المشاركة والفهرس الموحد ومعايير الجودة جوهر استراتيجية البيانات البيئية، وتُنفَّذ عبر هذا الهدف.",
      },
      {
        targetKind: "nes_node",
        targetCode: "O1",
        labelEn: "Water Security",
        labelAr: "الأمن المائي",
        noteEn:
          "Consistent water supply, demand and quality data lets the water theme be steered on shared figures instead of entity by entity estimates.",
        noteAr:
          "تتيح بيانات العرض والطلب وجودة المياه المتسقة توجيه محور المياه بأرقام مشتركة بدل تقديرات كل جهة على حدة.",
      },
    ],
  },
  {
    code: "G3",
    titleEn: "Foresight and readiness for environmental risk",
    titleAr: "الاستشراف والجاهزية للمخاطر البيئية",
    descriptionEn:
      "The Office scans for emerging risks and opportunities, briefs leadership every quarter and builds scenarios for Saudi Vision 2030 environmental targets and beyond. It tests how people respond to water and waste policies through behavioural trials, and grows a foresight network across entities. The goal is achieved when long term choices on water, climate and land visibly change because of what foresight showed.",
    descriptionAr:
      "يرصد المكتب المخاطر والفرص الناشئة، ويُطلع القيادة كل ربع سنة، ويبني سيناريوهات لمستهدفات رؤية السعودية 2030 البيئية وما بعدها. ويختبر استجابة الناس لسياسات المياه والنفايات عبر التجارب السلوكية، وينمّي شبكة استشراف عبر الجهات. ويتحقق الهدف حين تتغير الخيارات الطويلة الأجل في المياه والمناخ والأراضي بشكل ملموس بفضل ما أظهره الاستشراف.",
    ownerUnitCode: "FRS",
    alignment: [
      {
        targetKind: "nes_node",
        targetCode: "O3",
        labelEn: "Climate and Environment",
        labelAr: "المناخ والبيئة",
        noteEn:
          "Early signals on climate impacts and environmental pressure give the climate theme time to adapt its plans before shocks arrive.",
        noteAr:
          "تمنح الإشارات المبكرة عن الآثار المناخية والضغوط البيئية محور المناخ وقتاً لتكييف خططه قبل وقوع الصدمات.",
      },
      {
        targetKind: "nes_node",
        targetCode: "O4",
        labelEn: "Biodiversity and Land",
        labelAr: "التنوع الأحيائي والأراضي",
        noteEn:
          "Scenarios on land degradation, desertification and habitat pressure help the land and biodiversity theme choose where to act first.",
        noteAr:
          "تساعد السيناريوهات عن تدهور الأراضي والتصحر وضغوط الموائل محور الأراضي والتنوع الأحيائي على اختيار مواضع التدخل الأولى.",
      },
      {
        targetKind: "nes_node",
        targetCode: "O6",
        labelEn: "Air Quality",
        labelAr: "جودة الهواء",
        noteEn:
          "Horizon scanning on emission sources and exposure trends supports earlier action on air quality.",
        noteAr:
          "يدعم مسح الأفق لمصادر الانبعاثات واتجاهات التعرض اتخاذ إجراءات أبكر بشأن جودة الهواء.",
      },
    ],
  },
  {
    code: "G4",
    titleEn: "Regulatory clarity and institutional excellence",
    titleAr: "الوضوح التنظيمي والتميز المؤسسي",
    descriptionEn:
      "The Office keeps regulation and institutional knowledge current and findable, and runs its own work on modern digital platforms. A regulatory register tracks changes and their effect on plans and indicators, knowledge is captured so a change of role never removes context, and information security and continuity are built in. The goal is achieved when anyone in the Office can find the current rule, its source and its impact in minutes.",
    descriptionAr:
      "يُبقي المكتب الأنظمة والمعرفة المؤسسية محدّثة وسهلة الاسترجاع، ويدير عمله على منصات رقمية حديثة. يتتبع سجل تنظيمي التغييرات وأثرها على الخطط والمؤشرات، وتُوثَّق المعرفة فلا يزيل تغيير الدور سياقاً، وتُبنى أمن المعلومات والاستمرارية في صلب العمل. ويتحقق الهدف حين يستطيع أي موظف في المكتب إيجاد النظام الحالي ومصدره وأثره خلال دقائق.",
    ownerUnitCode: "RCM",
    alignment: [
      {
        targetKind: "nes_node",
        targetCode: "O7",
        labelEn: "Regulatory Compliance",
        labelAr: "الامتثال التنظيمي",
        noteEn:
          "A current regulatory register and change tracking is the working core of the regulatory compliance theme.",
        noteAr:
          "يشكل السجل التنظيمي المحدّث وتتبع التغييرات الجوهر العملي لمحور الامتثال التنظيمي.",
      },
      {
        targetKind: "nes_node",
        targetCode: "O5",
        labelEn: "Waste and Circular Economy",
        labelAr: "النفايات والاقتصاد الدائري",
        noteEn:
          "Clear and findable rules on waste and recycling help entities and operators comply and help the Office see where requirements overlap or conflict.",
        noteAr:
          "تساعد القواعد الواضحة وسهلة الاسترجاع بشأن النفايات وإعادة التدوير الجهات والمشغّلين على الامتثال، وتُظهر للمكتب مواضع تداخل المتطلبات أو تعارضها.",
      },
      {
        targetKind: "data_strategy_initiative",
        targetCode: "environmental-data-strategy",
        labelEn: "Environmental Data Strategy",
        labelAr: "استراتيجية البيانات البيئية",
        noteEn:
          "Unified digital platforms and data driven performance reporting are the internal systems on which the environmental data strategy runs.",
        noteAr:
          "تشكل المنصات الرقمية الموحدة وتقارير الأداء القائمة على البيانات النظم الداخلية التي تقوم عليها استراتيجية البيانات البيئية.",
      },
    ],
  },
  {
    code: "G5",
    titleEn: "Partnerships and communication",
    titleAr: "الشراكات والاتصال",
    descriptionEn:
      "The Office extends its reach through structured partnerships with entities, universities and international organisations, and tells the environmental story with one clear voice. It engages the global indicator frameworks the Kingdom reports against, publishes on a coordinated plan and runs steering committee sessions that end in decisions with owners. The goal is achieved when partners and the public understand the national picture and what is being done about it.",
    descriptionAr:
      "يوسّع المكتب أثره عبر شراكات منظمة مع الجهات والجامعات والمنظمات الدولية، ويروي القصة البيئية بصوت واحد واضح. ويتفاعل مع أطر المؤشرات العالمية التي تُبلّغ المملكة عنها، وينشر وفق خطة منسقة، ويدير جلسات اللجنة التوجيهية بحيث تنتهي بقرارات لها مسؤولون. ويتحقق الهدف حين يفهم الشركاء والجمهور الصورة الوطنية وما يُعمل بشأنها.",
    ownerUnitCode: "PAR",
    alignment: [
      {
        targetKind: "nes_node",
        targetCode: "O3",
        labelEn: "Climate and Environment",
        labelAr: "المناخ والبيئة",
        noteEn:
          "International cooperation and consistent public messages support the Kingdom's climate and environmental commitments and its standing in global reporting.",
        noteAr:
          "يدعم التعاون الدولي والرسائل العامة المتسقة التزامات المملكة المناخية والبيئية ومكانتها في الإبلاغ العالمي.",
      },
      {
        targetKind: "nes_node",
        targetCode: "O1",
        labelEn: "Water Security",
        labelAr: "الأمن المائي",
        noteEn:
          "Research and international partnerships bring methods and benchmarks that water entities can use for planning and demand management.",
        noteAr:
          "تجلب الشراكات البحثية والدولية منهجيات ومرجعيات تستفيد منها جهات المياه في التخطيط وإدارة الطلب.",
      },
      {
        targetKind: "nes_node",
        targetCode: "O2",
        labelEn: "Agriculture and Food Security",
        labelAr: "الأمن الغذائي والزراعة",
        noteEn:
          "Cooperation with international and academic partners brings evidence on sustainable farming and food systems into national planning.",
        noteAr:
          "يُدخل التعاون مع الشركاء الدوليين والأكاديميين أدلة عن الزراعة المستدامة والنظم الغذائية في التخطيط الوطني.",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* 9. Intermediate outcomes                                            */
/* ------------------------------------------------------------------ */

export const INTERMEDIATE_OUTCOMES: IntermediateOutcomeSeed[] = [
  {
    code: "G1.IO1",
    goalCode: "G1",
    titleEn: "Environment strategies and plans follow one national standard",
    titleAr: "اتباع استراتيجيات البيئة وخططها معياراً وطنياً موحداً",
    descriptionEn:
      "Every sector and entity strategy follows the same results chain, uses the same templates and carries indicator cards that meet a published quality checklist. Planning teams across the sector are trained and certified in the method, so compliance comes from capability rather than from correction.",
    descriptionAr:
      "تتبع كل استراتيجية قطاعية ومؤسسية سلسلة النتائج ذاتها وتستخدم النماذج ذاتها وتتضمن بطاقات مؤشرات مستوفية لقائمة تحقق معلنة للجودة. وتُدرَّب فرق التخطيط في القطاع وتُعتمد في المنهجية، فيأتي الالتزام من القدرة لا من التصحيح اللاحق.",
    ownerUnitCode: "PQS",
  },
  {
    code: "G1.IO2",
    goalCode: "G1",
    titleEn: "NES delivery is monitored and supported with evidence",
    titleAr: "متابعة تنفيذ الاستراتيجية الوطنية للبيئة ودعمه بالأدلة",
    descriptionEn:
      "Progress on National Environment Strategy initiatives is reported on a fixed cycle against verifiable evidence, and lagging initiatives receive hands on support. Leadership sees one integrated picture of delivery and can act on it before delays become failures.",
    descriptionAr:
      "يُبلَّغ عن التقدم في مبادرات الاستراتيجية الوطنية للبيئة وفق دورة ثابتة وبأدلة يمكن التحقق منها، وتتلقى المبادرات المتأخرة دعماً مباشراً. وترى القيادة صورة واحدة متكاملة للإنجاز وتستطيع التصرف قبل أن يتحول التأخر إلى إخفاق.",
    ownerUnitCode: "PMD",
  },
  {
    code: "G1.IO3",
    goalCode: "G1",
    titleEn: "Policies and regulations are tested before they are adopted",
    titleAr: "اختبار السياسات والأنظمة قبل اعتمادها",
    descriptionEn:
      "Major policy proposals on water, agriculture and climate pass through simulation or a controlled trial before they reach the decision table. Decision makers see likely effects, costs and trade-offs in advance, and weak proposals are improved or dropped early.",
    descriptionAr:
      "تمر مقترحات السياسات الكبرى في المياه والزراعة والمناخ عبر المحاكاة أو تجربة مضبوطة قبل وصولها إلى طاولة القرار. ويرى صناع القرار الآثار المرجحة والتكاليف والمفاضلات مسبقاً، وتُحسَّن المقترحات الضعيفة أو تُسقَط مبكراً.",
    ownerUnitCode: "PLB",
  },
  {
    code: "G2.IO1",
    goalCode: "G2",
    titleEn: "Environmental data meets international quality standards",
    titleAr: "استيفاء البيانات البيئية للمعايير الدولية للجودة",
    descriptionEn:
      "Environmental data is produced under a documented quality framework, on modern monitoring and production systems, with accredited metadata and classifications. Quality is assessed against international practice and the results are published.",
    descriptionAr:
      "تُنتج البيانات البيئية في إطار جودة موثق، وعلى نظم رصد وإنتاج حديثة، مع بيانات وصفية وتصنيفات معتمدة. وتُقيَّم الجودة قياساً إلى الممارسات الدولية وتُنشر النتائج.",
    ownerUnitCode: "DQS",
  },
  {
    code: "G2.IO2",
    goalCode: "G2",
    titleEn: "Environmental data is shared and governed as an asset",
    titleAr: "مشاركة البيانات البيئية وحوكمتها بوصفها أصلاً",
    descriptionEn:
      "Standing agreements, clear ownership and one catalogue let entities share the data they hold with confidence. Priority administrative sources flow to the Office on agreed terms, and users can see what exists, who owns it and under what conditions it can be used.",
    descriptionAr:
      "تتيح الاتفاقيات الدائمة والملكية الواضحة وفهرس واحد للجهات مشاركة ما تحتفظ به من بيانات بثقة. وتصل مصادر البيانات الإدارية ذات الأولوية إلى المكتب وفق شروط متفق عليها، ويرى المستخدمون ما هو موجود ومن يملكه وبأي شروط يمكن استخدامه.",
    ownerUnitCode: "DGS",
  },
  {
    code: "G2.IO3",
    goalCode: "G2",
    titleEn: "Users find, trust and reuse Office data",
    titleAr: "إيجاد المستخدمين لبيانات المكتب والوثوق بها وإعادة استخدامها",
    descriptionEn:
      "Open data and dissemination services are easy to use, releases follow a published calendar, and revisions are explained. Users are supported to understand and apply the data, and reuse by entities, researchers and the public grows year on year.",
    descriptionAr:
      "تتسم خدمات البيانات المفتوحة والنشر بسهولة الاستخدام، وتتبع الإصدارات روزنامة معلنة، وتُشرح المراجعات. ويُدعم المستخدمون لفهم البيانات وتطبيقها، وينمو استخدامها من الجهات والباحثين والجمهور عاماً بعد عام.",
    ownerUnitCode: "DOP",
  },
  {
    code: "G3.IO1",
    goalCode: "G3",
    titleEn: "Emerging risks and opportunities are detected early",
    titleAr: "رصد المخاطر والفرص الناشئة مبكراً",
    descriptionEn:
      "A standing scanning system tracks signals across water, agriculture, climate, land, waste and air, and leadership receives a short strategic risk briefing every quarter with proposed responses and owners.",
    descriptionAr:
      "يتتبع نظام مسح دائم الإشارات في المياه والزراعة والمناخ والأراضي والنفايات والهواء، وتتلقى القيادة إحاطة موجزة عن المخاطر الاستراتيجية كل ربع سنة مع الاستجابات المقترحة والمسؤولين.",
    ownerUnitCode: "SCN",
  },
  {
    code: "G3.IO2",
    goalCode: "G3",
    titleEn: "Long term environmental choices are informed by foresight",
    titleAr: "استنارة الخيارات البيئية الطويلة الأجل بالاستشراف",
    descriptionEn:
      "Scenario sets, behavioural insight and a network of foresight practitioners across entities feed into planning cycles and policy choices, so that long term options are weighed before they are closed off.",
    descriptionAr:
      "تغذي مجموعات السيناريوهات والرؤى السلوكية وشبكة ممارسي الاستشراف في الجهات دورات التخطيط والخيارات السياساتية، فتُوزن الخيارات الطويلة الأجل قبل أن تُغلق.",
    ownerUnitCode: "FRS",
  },
  {
    code: "G4.IO1",
    goalCode: "G4",
    titleEn: "Regulation and institutional knowledge are kept current and findable",
    titleAr: "إبقاء الأنظمة والمعرفة المؤسسية محدّثة وسهلة الاسترجاع",
    descriptionEn:
      "A regulatory register records each rule in force, its source and its changes, and links it to the plans and indicators it affects. Knowledge from projects, studies and departing colleagues is captured and findable, so the Office does not relearn what it already knew.",
    descriptionAr:
      "يسجّل سجل تنظيمي كل نظام ساري ومصدره وتعديلاته، ويربطه بالخطط والمؤشرات التي يؤثر فيها. وتُحفظ المعرفة المستمدة من المشاريع والدراسات والزملاء المغادرين وتُتاح للاسترجاع، فلا يعيد المكتب تعلّم ما كان يعرفه.",
    ownerUnitCode: "RCM",
  },
  {
    code: "G4.IO2",
    goalCode: "G4",
    titleEn: "Digital platforms carry the Office's core work",
    titleAr: "حمل المنصات الرقمية لأعمال المكتب الأساسية",
    descriptionEn:
      "Core processes run on a unified digital workplace with automation where it pays back, information security and business continuity are tested, and internal performance reporting is produced from data rather than compiled by hand.",
    descriptionAr:
      "تُدار العمليات الأساسية على بيئة عمل رقمية موحدة مع أتمتة حيث يكون العائد مجدياً، وتُختبر أمن المعلومات واستمرارية الأعمال، وتُنتج تقارير الأداء الداخلي من البيانات بدل جمعها يدوياً.",
    ownerUnitCode: "DIG",
  },
  {
    code: "G5.IO1",
    goalCode: "G5",
    titleEn: "Partnerships extend the Office's reach",
    titleAr: "توسيع الشراكات لنطاق عمل المكتب",
    descriptionEn:
      "A structured programme with entities, universities and international organisations brings in research, methods and benchmarks the Office could not build alone, and keeps national reporting against global indicators timely and consistent.",
    descriptionAr:
      "يجلب برنامج منظم مع الجهات والجامعات والمنظمات الدولية الأبحاث والمنهجيات والمرجعيات التي لا يستطيع المكتب بناءها بمفرده، ويحافظ على انتظام الإبلاغ الوطني مقابل المؤشرات العالمية واتساقه.",
    ownerUnitCode: "PAR",
  },
  {
    code: "G5.IO2",
    goalCode: "G5",
    titleEn: "The Office communicates clearly with the public",
    titleAr: "تواصل المكتب بوضوح مع الجمهور",
    descriptionEn:
      "One integrated communication and publication plan sets the headline messages and the calendar, and steering committee sessions are run so that every decision is recorded, owned and followed up.",
    descriptionAr:
      "تحدد خطة اتصال ونشر متكاملة الرسائل الرئيسية والروزنامة، وتُدار جلسات اللجنة التوجيهية بحيث يُسجَّل كل قرار ويُسنَد إلى مسؤول ويُتابَع.",
    ownerUnitCode: "COM",
  },
];

/* ------------------------------------------------------------------ */
/* 10. Outputs                                                         */
/* ------------------------------------------------------------------ */

export const OUTPUTS: OutputSeed[] = [
  {
    code: "G1.IO1.OP1",
    intermediateCode: "G1.IO1",
    titleEn: "Updated results framework manual and templates",
    titleAr: "دليل إطار النتائج المحدّث ونماذجه",
    descriptionEn:
      "A revised manual covering the full results chain from strategic goals to activities, issued in both languages with ready to use templates for strategy documents, indicator cards, implementation plans and risk registers.",
    descriptionAr:
      "دليل منقّح يغطي سلسلة النتائج كاملة من الأهداف الاستراتيجية إلى الأنشطة، يصدر باللغتين مصحوباً بنماذج جاهزة للاستخدام لوثائق الاستراتيجيات وبطاقات المؤشرات والخطط التنفيذية وسجلات المخاطر.",
    ownerUnitCode: "PQS",
  },
  {
    code: "G1.IO1.OP2",
    intermediateCode: "G1.IO1",
    titleEn: "Planning capability programme for entity programme teams",
    titleAr: "برنامج تنمية قدرات التخطيط لفرق البرامج في الجهات",
    descriptionEn:
      "A certified training and coaching programme that builds results based planning skills in the programme teams of entities, with practical clinics held while strategies are being drafted.",
    descriptionAr:
      "برنامج تدريب وإرشاد معتمد يبني مهارات التخطيط القائم على النتائج لدى فرق البرامج في الجهات، مع عيادات تطبيقية تُعقد أثناء صياغة الاستراتيجيات.",
    ownerUnitCode: "CAP",
  },
  {
    code: "G1.IO1.OP3",
    intermediateCode: "G1.IO1",
    titleEn: "Quality assured reviews of sector and entity strategies",
    titleAr: "مراجعات مضمونة الجودة لاستراتيجيات القطاعات والجهات",
    descriptionEn:
      "A technical review service that scores each submitted strategy against a published checklist, returns written findings and confirms alignment with the National Environment Strategy before adoption.",
    descriptionAr:
      "خدمة مراجعة فنية تقيّم كل استراتيجية مرفوعة وفق قائمة تحقق معلنة، وتعيد ملاحظات مكتوبة، وتؤكد المواءمة مع الاستراتيجية الوطنية للبيئة قبل الاعتماد.",
    ownerUnitCode: "SPD",
  },
  {
    code: "G1.IO2.OP1",
    intermediateCode: "G1.IO2",
    titleEn: "NES monitoring framework and reporting cycle",
    titleAr: "إطار متابعة الاستراتيجية الوطنية للبيئة ودورة الإبلاغ",
    descriptionEn:
      "A monitoring framework with defined indicators, evidence requirements and a fixed reporting cycle, so that every initiative reports in the same way and on the same dates.",
    descriptionAr:
      "إطار متابعة بمؤشرات محددة ومتطلبات أدلة ودورة إبلاغ ثابتة، بحيث تبلّغ كل مبادرة بالطريقة نفسها وفي المواعيد نفسها.",
    ownerUnitCode: "PMD",
  },
  {
    code: "G1.IO2.OP2",
    intermediateCode: "G1.IO2",
    titleEn: "Implementation support packages for lagging initiatives",
    titleAr: "حزم دعم التنفيذ للمبادرات المتأخرة",
    descriptionEn:
      "Targeted support for initiatives that fall behind: a diagnosis of blockers, a recovery plan with owners and dates, and a named support officer who stays with the initiative until it is back on track.",
    descriptionAr:
      "دعم موجّه للمبادرات المتأخرة: تشخيص للعوائق، وخطة تعافٍ بمسؤولين ومواعيد، وضابط دعم مسمّى يرافق المبادرة حتى تعود إلى المسار.",
    ownerUnitCode: "ISU",
  },
  {
    code: "G1.IO2.OP3",
    intermediateCode: "G1.IO2",
    titleEn: "Integrated delivery dashboard for leadership",
    titleAr: "لوحة متابعة تنفيذية متكاملة للقيادة",
    descriptionEn:
      "One dashboard that brings progress, risks, indicators and evidence status together for leadership, refreshed on the reporting cycle and drillable down to the initiative.",
    descriptionAr:
      "لوحة واحدة تجمع التقدم والمخاطر والمؤشرات وحالة الأدلة للقيادة، وتُحدَّث وفق دورة الإبلاغ ويمكن التعمق منها حتى مستوى المبادرة.",
    ownerUnitCode: "PMD",
  },
  {
    code: "G1.IO3.OP1",
    intermediateCode: "G1.IO3",
    titleEn: "Policy simulation models for water, agriculture and climate",
    titleAr: "نماذج محاكاة السياسات للمياه والزراعة والمناخ",
    descriptionEn:
      "A set of documented simulation models for water demand and supply, agricultural water use and climate related policy options, developed with research partners and maintained by the Office.",
    descriptionAr:
      "مجموعة نماذج محاكاة موثقة للطلب على المياه والإمداد، واستخدام المياه الزراعي، وخيارات السياسات المرتبطة بالمناخ، تُطوَّر مع شركاء بحثيين ويتولى المكتب صيانتها.",
    ownerUnitCode: "PLB",
  },
  {
    code: "G1.IO3.OP2",
    intermediateCode: "G1.IO3",
    titleEn: "Policy lab evaluations of proposed interventions",
    titleAr: "تقييمات مختبر السياسات للتدخلات المقترحة",
    descriptionEn:
      "Structured evaluations of proposed interventions, using pilots and controlled comparisons where feasible, reported with their limits so that decision makers know how far the evidence goes.",
    descriptionAr:
      "تقييمات منظمة للتدخلات المقترحة، باستخدام التجارب الرائدة والمقارنات المضبوطة حيثما أمكن، وتُعرض مع حدودها ليعرف صناع القرار مدى ما تدعمه الأدلة.",
    ownerUnitCode: "PLB",
  },
  {
    code: "G2.IO1.OP1",
    intermediateCode: "G2.IO1",
    titleEn: "Environmental data quality assurance framework",
    titleAr: "إطار ضمان جودة البيانات البيئية",
    descriptionEn:
      "A quality framework with dimensions, checks and scoring applied to every data product, with a published self assessment and an independent review cycle against international practice.",
    descriptionAr:
      "إطار جودة بأبعاد وفحوص وتقييم يُطبَّق على كل منتج بيانات، مع تقييم ذاتي منشور ودورة مراجعة مستقلة قياساً إلى الممارسات الدولية.",
    ownerUnitCode: "DQS",
  },
  {
    code: "G2.IO1.OP2",
    intermediateCode: "G2.IO1",
    titleEn: "Modernised monitoring and data production systems",
    titleAr: "نظم الرصد وإنتاج البيانات الحديثة",
    descriptionEn:
      "A modern platform for capturing monitoring data, remote sensing products and administrative records, and for producing, validating and releasing environmental data with full lineage.",
    descriptionAr:
      "منصة حديثة لالتقاط بيانات الرصد ومنتجات الاستشعار عن بعد والسجلات الإدارية، ولإنتاج البيانات البيئية والتحقق منها وإصدارها مع تتبع كامل للمصدر.",
    ownerUnitCode: "DSY",
  },
  {
    code: "G2.IO1.OP3",
    intermediateCode: "G2.IO1",
    titleEn: "Accredited metadata and classifications",
    titleAr: "بيانات وصفية وتصنيفات معتمدة",
    descriptionEn:
      "Metadata and classifications for environmental data aligned with national and international standards, reviewed on a fixed cycle and published for reuse by entities.",
    descriptionAr:
      "بيانات وصفية وتصنيفات للبيانات البيئية متوائمة مع المعايير الوطنية والدولية، تُراجَع وفق دورة ثابتة وتُنشر لإعادة استخدامها من الجهات.",
    ownerUnitCode: "DQS",
  },
  {
    code: "G2.IO2.OP1",
    intermediateCode: "G2.IO2",
    titleEn: "Data governance and sharing agreements",
    titleAr: "حوكمة البيانات واتفاقيات المشاركة",
    descriptionEn:
      "A data governance model with named owners and stewards, a standard sharing agreement with tiers for sensitive fields, and a pipeline of agreements signed with priority source entities.",
    descriptionAr:
      "نموذج حوكمة بيانات بملاك ووكلاء بيانات مسمّين، واتفاقية مشاركة نموذجية بمستويات للحقول الحساسة، ومسار اتفاقيات يجري توقيعها مع الجهات المصدرية ذات الأولوية.",
    ownerUnitCode: "DGS",
  },
  {
    code: "G2.IO2.OP2",
    intermediateCode: "G2.IO2",
    titleEn: "Unified environmental data catalogue",
    titleAr: "فهرس موحد للبيانات البيئية",
    descriptionEn:
      "One searchable catalogue of environmental datasets held by the Office and by partner entities, showing owner, definition, update frequency, quality status and conditions of use.",
    descriptionAr:
      "فهرس واحد قابل للبحث لمجموعات البيانات البيئية التي يحتفظ بها المكتب والجهات الشريكة، يُظهر المالك والتعريف وتكرار التحديث وحالة الجودة وشروط الاستخدام.",
    ownerUnitCode: "EDA",
  },
  {
    code: "G2.IO3.OP1",
    intermediateCode: "G2.IO3",
    titleEn: "Redesigned open data and dissemination services",
    titleAr: "خدمات البيانات المفتوحة والنشر بتصميم جديد",
    descriptionEn:
      "A redesigned open data portal and delivery channels with interactive tools, machine readable downloads and programmatic access, built around the tasks users actually perform.",
    descriptionAr:
      "بوابة بيانات مفتوحة وقنوات نشر بتصميم جديد تضم أدوات تفاعلية وتنزيلات مقروءة آلياً ووصولاً برمجياً، مبنية حول المهام التي ينفذها المستخدمون فعلاً.",
    ownerUnitCode: "DSY",
  },
  {
    code: "G2.IO3.OP2",
    intermediateCode: "G2.IO3",
    titleEn: "Data literacy and user support programme",
    titleAr: "برنامج الإلمام بالبيانات ودعم المستخدمين",
    descriptionEn:
      "Guides, training sessions and a user support desk that help policy teams, researchers and journalists interpret environmental data correctly and apply it in their work.",
    descriptionAr:
      "أدلة وجلسات تدريب ومكتب دعم للمستخدمين يساعد فرق السياسات والباحثين والصحفيين على تفسير البيانات البيئية تفسيراً صحيحاً وتطبيقها في أعمالهم.",
    ownerUnitCode: "CAP",
  },
  {
    code: "G2.IO3.OP3",
    intermediateCode: "G2.IO3",
    titleEn: "Faster release calendar with a published revisions policy",
    titleAr: "روزنامة إصدار أسرع مع سياسة مراجعات معلنة",
    descriptionEn:
      "A release calendar announced in advance with shorter lags between the reference period and publication, and a revisions policy that explains when and why published figures change.",
    descriptionAr:
      "روزنامة إصدار تُعلن مسبقاً مع فجوات أقصر بين الفترة المرجعية والنشر، وسياسة مراجعات تشرح متى ولماذا تتغير الأرقام المنشورة.",
    ownerUnitCode: "DOP",
  },
  {
    code: "G3.IO1.OP1",
    intermediateCode: "G3.IO1",
    titleEn: "Environmental horizon scanning system",
    titleAr: "نظام مسح الأفق البيئي",
    descriptionEn:
      "A standing system that collects, rates and tracks weak signals on water, agriculture, climate, land, waste and air from public sources, partners and expert networks, and routes them to the right team.",
    descriptionAr:
      "نظام دائم يجمع الإشارات الضعيفة عن المياه والزراعة والمناخ والأراضي والنفايات والهواء من المصادر العامة والشركاء وشبكات الخبراء، ويقيّمها ويتتبعها ويوجّهها إلى الفريق المناسب.",
    ownerUnitCode: "SCN",
  },
  {
    code: "G3.IO1.OP2",
    intermediateCode: "G3.IO1",
    titleEn: "Quarterly strategic risk briefings for leadership",
    titleAr: "إحاطات ربعية عن المخاطر الاستراتيجية للقيادة",
    descriptionEn:
      "A short, regular briefing that sets out the leading risks and opportunities, their likely timing and effect, and proposed responses with named owners.",
    descriptionAr:
      "إحاطة موجزة ومنتظمة تعرض أبرز المخاطر والفرص وتوقيتها وأثرها المرجح والاستجابات المقترحة مع مسؤولين مسمّين.",
    ownerUnitCode: "SCN",
  },
  {
    code: "G3.IO2.OP1",
    intermediateCode: "G3.IO2",
    titleEn: "Scenario sets for Saudi Vision 2030 environmental targets and beyond",
    titleAr: "مجموعات سيناريوهات لمستهدفات رؤية السعودية 2030 البيئية وما بعدها",
    descriptionEn:
      "A maintained set of scenarios on water, climate, land and food that stress test the environmental targets of Saudi Vision 2030 and show what choices matter beyond 2030.",
    descriptionAr:
      "مجموعة سيناريوهات محدّثة عن المياه والمناخ والأراضي والغذاء تختبر تحمّل المستهدفات البيئية لرؤية السعودية 2030 وتُظهر الخيارات المهمة بعد عام 2030.",
    ownerUnitCode: "SCN",
  },
  {
    code: "G3.IO2.OP2",
    intermediateCode: "G3.IO2",
    titleEn: "Behavioural insight trials for water and waste priorities",
    titleAr: "تجارب الرؤى السلوكية لأولويات المياه والنفايات",
    descriptionEn:
      "Trials that test how messages, defaults and incentives change household and business behaviour on water use and waste, reported with their design and limits.",
    descriptionAr:
      "تجارب تختبر كيف تغيّر الرسائل والخيارات الافتراضية والحوافز سلوك الأسر والأعمال في استخدام المياه والنفايات، وتُعرض مع تصميمها وحدودها.",
    ownerUnitCode: "BIN",
  },
  {
    code: "G3.IO2.OP3",
    intermediateCode: "G3.IO2",
    titleEn: "Foresight capability network across entities",
    titleAr: "شبكة قدرات الاستشراف عبر الجهات",
    descriptionEn:
      "A network of foresight practitioners in entities with shared methods, a common library of scenarios and regular sessions, so that foresight is practised across the sector and not only in the Office.",
    descriptionAr:
      "شبكة ممارسي استشراف في الجهات بمنهجيات مشتركة ومكتبة سيناريوهات موحدة وجلسات منتظمة، ليُمارَس الاستشراف في القطاع كله لا في المكتب وحده.",
    ownerUnitCode: "FRS",
  },
  {
    code: "G4.IO1.OP1",
    intermediateCode: "G4.IO1",
    titleEn: "Regulatory register and change tracking service",
    titleAr: "السجل التنظيمي وخدمة تتبع التغييرات",
    descriptionEn:
      "A register of environmental, water and agriculture regulation with source, status and effective dates, and a service that tracks changes and tells owners which plans and indicators are affected.",
    descriptionAr:
      "سجل للأنظمة البيئية والمائية والزراعية بمصدرها وحالتها وتواريخ نفاذها، وخدمة تتتبع التغييرات وتُخبر المسؤولين بالخطط والمؤشرات المتأثرة.",
    ownerUnitCode: "RLR",
  },
  {
    code: "G4.IO1.OP2",
    intermediateCode: "G4.IO1",
    titleEn: "Knowledge management and continuity programme",
    titleAr: "برنامج إدارة المعرفة والاستمرارية",
    descriptionEn:
      "A programme that captures lessons, methods and decisions, maintains role handover notes, and makes institutional memory searchable so that a change of role does not remove context.",
    descriptionAr:
      "برنامج يوثّق الدروس والمنهجيات والقرارات، ويحتفظ بمذكرات تسليم الأدوار، ويجعل الذاكرة المؤسسية قابلة للبحث بحيث لا يزيل تغيير الدور السياق.",
    ownerUnitCode: "KMD",
  },
  {
    code: "G4.IO2.OP1",
    intermediateCode: "G4.IO2",
    titleEn: "Unified digital workplace and process automation",
    titleAr: "بيئة عمل رقمية موحدة وأتمتة العمليات",
    descriptionEn:
      "One digital workplace for documents, approvals and collaboration, with the highest volume processes automated end to end and the old channels retired on published dates.",
    descriptionAr:
      "بيئة عمل رقمية واحدة للوثائق والموافقات والتعاون، مع أتمتة العمليات الأعلى حجماً من البداية إلى النهاية وإيقاف القنوات القديمة في تواريخ معلنة.",
    ownerUnitCode: "DIG",
  },
  {
    code: "G4.IO2.OP2",
    intermediateCode: "G4.IO2",
    titleEn: "Information security and business continuity uplift",
    titleAr: "رفع مستوى أمن المعلومات واستمرارية الأعمال",
    descriptionEn:
      "Stronger access control, encryption and monitoring, together with tested continuity plans and regular exercises for the systems that carry the Office's core work.",
    descriptionAr:
      "ضوابط وصول وتشفير ومراقبة أقوى، إلى جانب خطط استمرارية مجرّبة وتمارين منتظمة للنظم التي تحمل أعمال المكتب الأساسية.",
    ownerUnitCode: "DGS",
  },
  {
    code: "G4.IO2.OP3",
    intermediateCode: "G4.IO2",
    titleEn: "Data driven internal performance reporting",
    titleAr: "تقارير الأداء الداخلي القائمة على البيانات",
    descriptionEn:
      "Internal performance reports produced automatically from source systems, with one definition per measure, replacing figures compiled by hand in spreadsheets.",
    descriptionAr:
      "تقارير أداء داخلية تُنتج آلياً من النظم المصدرية بتعريف واحد لكل مقياس، بديلاً عن أرقام تُجمع يدوياً في جداول إلكترونية.",
    ownerUnitCode: "DTO",
  },
  {
    code: "G5.IO1.OP1",
    intermediateCode: "G5.IO1",
    titleEn: "Structured partnership programme with entities and academia",
    titleAr: "برنامج شراكات منظم مع الجهات والأوساط الأكاديمية",
    descriptionEn:
      "A programme of agreements and joint work plans with entities, universities and research centres, with named counterparts, shared deliverables and an annual review of what each partnership produced.",
    descriptionAr:
      "برنامج اتفاقيات وخطط عمل مشتركة مع الجهات والجامعات ومراكز الأبحاث، بنظراء مسمّين ومخرجات مشتركة ومراجعة سنوية لما أنتجته كل شراكة.",
    ownerUnitCode: "PAR",
  },
  {
    code: "G5.IO1.OP2",
    intermediateCode: "G5.IO1",
    titleEn: "International cooperation and global indicator engagement",
    titleAr: "التعاون الدولي والتفاعل مع المؤشرات العالمية",
    descriptionEn:
      "A coordinated route for engaging international organisations and for reporting on global indicators, including sustainable development, climate and food, with an owner and calendar for each return.",
    descriptionAr:
      "مسار منسق للتفاعل مع المنظمات الدولية والإبلاغ عن المؤشرات العالمية، بما فيها التنمية المستدامة والمناخ والغذاء، مع مسؤول وروزنامة لكل تقرير.",
    ownerUnitCode: "PAR",
  },
  {
    code: "G5.IO2.OP1",
    intermediateCode: "G5.IO2",
    titleEn: "Integrated communication and publication plan",
    titleAr: "خطة اتصال ونشر متكاملة",
    descriptionEn:
      "One annual plan that sets headline messages, publications, events and channels, and keeps the Office's public voice consistent with that of partner entities.",
    descriptionAr:
      "خطة سنوية واحدة تحدد الرسائل الرئيسية والمنشورات والفعاليات والقنوات، وتُبقي صوت المكتب العام متسقاً مع صوت الجهات الشريكة.",
    ownerUnitCode: "COM",
  },
  {
    code: "G5.IO2.OP2",
    intermediateCode: "G5.IO2",
    titleEn: "Steering committee sessions and decision follow up service",
    titleAr: "جلسات اللجنة التوجيهية وخدمة متابعة القرارات",
    descriptionEn:
      "Preparation, secretariat and follow up for steering committee sessions, so that papers arrive on time, each decision has an owner and a date, and progress on decisions is reported at the next session.",
    descriptionAr:
      "إعداد جلسات اللجنة التوجيهية وأمانتها ومتابعتها، بحيث تصل الأوراق في وقتها ولكل قرار مسؤول وموعد، ويُعرض التقدم في القرارات في الجلسة التالية.",
    ownerUnitCode: "PSA",
  },
];
