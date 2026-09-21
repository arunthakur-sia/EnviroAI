// CR07 2.6: illustrative content for the Council Strategy, part A.
// This module carries the hand written bilingual words of NPC's own institutional
// strategy: the strategic direction, the situation analysis, governance, the risk
// register, and the results chain down to outputs. Part B carries the projects,
// activities and indicator cards that hang beneath these outputs.
//
// IMPORTANT: the content below is ILLUSTRATIVE. It is a plausible internal strategy
// written to exercise the Council Strategy screens, not the real approved strategy of
// the National Planning Council. Everything seeded from this file is marked
// is_illustrative = true and carries the "Illustrative" chip in the product until the
// real strategy replaces it. Organisational unit codes, NDS3 outcome codes and the
// results chain codes are real and must not be edited here without updating the seed.

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
  nameEn: "NPC Institutional Strategy 2025 to 2030",
  nameAr: "الاستراتيجية المؤسسية للمجلس الوطني للتخطيط 2025 - 2030",
  periodFrom: "2025-01-01",
  periodTo: "2030-12-31",
  approvedOn: "2025-03-16",
  visionEn:
    "A reference institution whose planning, statistics and foresight set the professional standard for government work in Qatar.",
  visionAr:
    "مؤسسة مرجعية يضع تخطيطها وإحصاؤها واستشرافها المعيار المهني للعمل الحكومي في دولة قطر.",
  missionEn:
    "We prepare the national development strategy, monitor its delivery, produce Qatar's official statistics and read the future, so that national choices rest on evidence rather than assumption. We work alongside every government entity, and with partners in the private sector, universities and the community, to turn national priorities into plans that are delivered and measured.",
  missionAr:
    "نُعِدّ استراتيجية التنمية الوطنية ونتابع تنفيذها، ونُنتج الإحصاءات الرسمية لدولة قطر، ونستشرف المستقبل، لتستند الخيارات الوطنية إلى الأدلة لا إلى الافتراضات. ونعمل جنباً إلى جنب مع الجهات الحكومية كافة، ومع شركائنا في القطاع الخاص والجامعات والمجتمع، لتحويل الأولويات الوطنية إلى خطط قابلة للتنفيذ والقياس.",
  ownerUnitCode: "IDP",
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
        "We publish statistics and assessments as the numbers read them, without softening a message to suit any party. That independence is precisely what makes our figures usable by everyone.",
      descriptionAr:
        "ننشر الإحصاءات والتقييمات كما تدل عليها الأرقام، دون تطويع الرسالة لصالح أي جهة. وهذه الاستقلالية هي بالذات ما يجعل أرقامنا صالحة للاستخدام لدى الجميع.",
    },
    {
      nameEn: "Partnership in delivery",
      nameAr: "الشراكة في التنفيذ",
      descriptionEn:
        "We do not hand a plan over and step away; we sit with the entity that carries it until the obstacles are named and cleared. Our success is measured by what the country delivers, not by the number of documents we issue.",
      descriptionAr:
        "لا نُسلّم الخطة ثم ننصرف، بل نجلس مع الجهة المنفذة حتى تُحدَّد العوائق وتُذلَّل. ويُقاس نجاحنا بما تُنجزه الدولة لا بعدد الوثائق التي نُصدرها.",
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
        "What a colleague learns becomes an asset of the Council: recorded, findable and ready for the next team to reuse. We hand over knowledge deliberately so that a departure never costs us a capability.",
      descriptionAr:
        "ما يتعلمه الزميل يصبح أصلاً من أصول المجلس: موثقاً وقابلاً للاسترجاع وجاهزاً لإعادة استخدامه من الفريق التالي. ونُسلّم المعرفة بشكل منظم حتى لا يكلفنا خروج موظف فقدان قدرة مؤسسية.",
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
      "A clear legal mandate to prepare and monitor the national development strategy, which gives the Council standing to convene every government entity around one plan.",
    textAr:
      "ولاية قانونية واضحة لإعداد استراتيجية التنمية الوطنية ومتابعة تنفيذها، تمنح المجلس الصفة التي تتيح له جمع الجهات الحكومية كافة حول خطة واحدة.",
  },
  {
    quadrant: "strength",
    textEn:
      "Custody of the national statistical system through the National Statistics Center, including the census, the price indices, the labour force survey and the statistical business register.",
    textAr:
      "الإشراف على المنظومة الإحصائية الوطنية من خلال مركز الإحصاء الوطني، بما يشمل التعداد والأرقام القياسية للأسعار ومسح القوى العاملة والسجل الإحصائي للمنشآت.",
  },
  {
    quadrant: "strength",
    textEn:
      "A dedicated foresight and national visions function, still uncommon in the region, that connects Qatar National Vision 2030 work to live policy questions.",
    textAr:
      "وجود قطاع مخصص لاستشراف المستقبل والرؤى الوطنية، وهو أمر لا يزال نادراً إقليمياً، يربط أعمال رؤية قطر الوطنية 2030 بالقضايا السياساتية الآنية.",
  },
  {
    quadrant: "strength",
    textEn:
      "A direct reporting line to the Council of Ministers, so analysis reaches the decision table without passing through intermediaries who reshape it.",
    textAr:
      "خط رفع مباشر إلى مجلس الوزراء، بما يتيح وصول التحليل إلى طاولة القرار دون وسطاء يعيدون صياغته.",
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
      "The monitoring picture depends on what entities submit, so the Council's view of national delivery is only as current as its slowest reporting partner.",
    textAr:
      "تعتمد صورة المتابعة على ما ترفعه الجهات، ما يجعل رؤية المجلس للإنجاز الوطني لا تتجاوز في حداثتها أبطأ الجهات في رفع تقاريرها.",
  },
  {
    quadrant: "weakness",
    textEn:
      "Statistical production still passes through ageing systems and manual steps, which stretches the distance between the reference period and the published figure.",
    textAr:
      "لا يزال الإنتاج الإحصائي يمر عبر أنظمة قديمة وخطوات يدوية، ما يُطيل المسافة بين الفترة المرجعية وتاريخ نشر الرقم.",
  },
  {
    quadrant: "weakness",
    textEn:
      "Results based planning is applied thoroughly by some Council departments and treated as a form filling exercise by others, so internal plans are not comparable.",
    textAr:
      "يُطبَّق التخطيط القائم على النتائج بعمق في بعض إدارات المجلس ويُتعامل معه في أخرى بوصفه تعبئة نماذج، ما يجعل الخطط الداخلية غير قابلة للمقارنة.",
  },
  {
    quadrant: "weakness",
    textEn:
      "Specialist posts in national accounts, statistical modelling and foresight are slow to fill and hard to retain, and several remain vacant across a full planning cycle.",
    textAr:
      "يصعب شغل الوظائف التخصصية في الحسابات القومية والنمذجة الإحصائية والاستشراف ويصعب الاحتفاظ بشاغليها، ويبقى عدد منها شاغراً طوال دورة تخطيطية كاملة.",
  },
  {
    quadrant: "weakness",
    textEn:
      "Method and context sit in the heads of experienced analysts rather than in documented procedures, so when they move the method often moves with them.",
    textAr:
      "تستقر المنهجية والسياق في أذهان المحللين ذوي الخبرة بدل أن تكون في إجراءات موثقة، فإذا انتقلوا انتقلت المنهجية معهم في الغالب.",
  },
  {
    quadrant: "opportunity",
    textEn:
      "The NDS3 delivery cycle to 2030 gives the Council a standing mandate and sustained leadership attention that can be used to institutionalise planning discipline.",
    textAr:
      "تمنح دورة تنفيذ استراتيجية التنمية الوطنية الثالثة حتى عام 2030 المجلسَ ولاية مستمرة واهتماماً قيادياً متواصلاً يمكن توظيفهما لترسيخ انضباط التخطيط مؤسسياً.",
  },
  {
    quadrant: "opportunity",
    textEn:
      "The national data agenda and the digital government programme open the way to replacing costly survey collection with governed administrative data.",
    textAr:
      "تفتح الأجندة الوطنية للبيانات وبرنامج الحكومة الرقمية الطريق أمام استبدال جمع البيانات المكلف عبر المسوح ببيانات إدارية محكومة.",
  },
  {
    quadrant: "opportunity",
    textEn:
      "Entities are increasingly asking for policy simulation and behavioural testing before they commit, which creates real demand for the Policy Lab and the simulation models.",
    textAr:
      "يتزايد طلب الجهات لمحاكاة السياسات واختبارها سلوكياً قبل الالتزام بها، ما يخلق طلباً حقيقياً على مختبر السياسات ونماذج المحاكاة.",
  },
  {
    quadrant: "opportunity",
    textEn:
      "Qatar's position in global indices gives the Council leverage to improve national data sources while raising the country's standing in international reporting.",
    textAr:
      "يمنح موقع دولة قطر في المؤشرات العالمية المجلسَ قدرة على تحسين مصادر البيانات الوطنية وترقية مكانة الدولة في التقارير الدولية في الوقت نفسه.",
  },
  {
    quadrant: "opportunity",
    textEn:
      "National universities and research centres are ready to co produce studies and to second researchers, which extends analytical capacity without new posts.",
    textAr:
      "تُبدي الجامعات ومراكز البحوث الوطنية استعداداً لإنتاج الدراسات بالشراكة ولإعارة الباحثين، ما يوسّع القدرة التحليلية دون استحداث وظائف جديدة.",
  },
  {
    quadrant: "threat",
    textEn:
      "Competition for scarce statistical, economic and data science talent from other government entities and from the private sector keeps salary expectations above the Council's grades.",
    textAr:
      "تُبقي المنافسة على الكفاءات النادرة في الإحصاء والاقتصاد وعلوم البيانات، من جهات حكومية أخرى ومن القطاع الخاص، توقعات الرواتب أعلى من درجات المجلس.",
  },
  {
    quadrant: "threat",
    textEn:
      "Frequent turnover of planning focal points inside entities resets relationships and capability, so each training cycle starts partly from the beginning.",
    textAr:
      "يؤدي التغيّر المتكرر لضباط الاتصال المعنيين بالتخطيط داخل الجهات إلى إعادة بناء العلاقات والقدرات من جديد، فتبدأ كل دورة تدريبية من نقطة قريبة من الصفر.",
  },
  {
    quadrant: "threat",
    textEn:
      "Regional and global economic volatility can force mid cycle re planning and pull leadership attention away from the longer term goals of the strategy.",
    textAr:
      "قد يفرض التقلب الاقتصادي الإقليمي والعالمي إعادة تخطيط في منتصف الدورة ويصرف اهتمام القيادة عن الأهداف بعيدة المدى في الاستراتيجية.",
  },
  {
    quadrant: "threat",
    textEn:
      "A confidentiality or cyber incident affecting microdata would damage respondent trust and depress response rates across every survey for years.",
    textAr:
      "من شأن أي حادثة تتعلق بالسرية أو الأمن السيبراني تمس البيانات الجزئية أن تضر بثقة المستجيبين وتخفض معدلات الاستجابة في المسوح كافة لسنوات.",
  },
  {
    quadrant: "threat",
    textEn:
      "Unofficial figures published by entities, consultancies and media compete with official statistics and blur which number the public should rely on.",
    textAr:
      "تنافس الأرقام غير الرسمية التي تنشرها جهات وشركات استشارية ووسائل إعلام الإحصاءاتِ الرسمية وتُربك الجمهور بشأن الرقم الذي ينبغي الاعتماد عليه.",
  },
];

export const STAKEHOLDERS: StakeholderItem[] = [
  {
    nameEn: "The Amiri Diwan",
    nameAr: "الديوان الأميري",
    interest: 3,
    influence: 5,
    roleEn:
      "Sets the national direction the strategy serves and receives the Council's major foresight and national vision work. Engagement is at the level of briefings on the strategic picture rather than delivery detail.",
    roleAr:
      "يحدد التوجه الوطني الذي تخدمه الاستراتيجية ويتلقى أعمال المجلس الكبرى في الاستشراف والرؤى الوطنية. ويكون التفاعل على مستوى الإحاطات بالصورة الاستراتيجية لا بتفاصيل التنفيذ.",
  },
  {
    nameEn: "The Council of Ministers",
    nameAr: "مجلس الوزراء",
    interest: 5,
    influence: 5,
    roleEn:
      "Approves the national development strategy, receives its progress reports and decides on the policy options the Council puts forward. It is the primary audience for the delivery dashboard and the annual assessment.",
    roleAr:
      "يعتمد استراتيجية التنمية الوطنية ويتلقى تقارير تقدمها ويبت في خيارات السياسات التي يرفعها المجلس. وهو الجمهور الأول للوحة المتابعة التنفيذية وللتقييم السنوي.",
  },
  {
    nameEn: "Ministries and government entities",
    nameAr: "الوزارات والجهات الحكومية",
    interest: 4,
    influence: 4,
    roleEn:
      "Own the sector strategies and the initiatives the Council monitors, and supply the administrative data and progress evidence behind the national picture. They are both the Council's clients and the source of its inputs.",
    roleAr:
      "تملك الاستراتيجيات القطاعية والمبادرات التي يتابعها المجلس، وتزوّده بالبيانات الإدارية وأدلة الإنجاز التي تُبنى عليها الصورة الوطنية. وهي عملاء المجلس ومصدر مدخلاته في آن واحد.",
  },
  {
    nameEn: "Ministry of Finance",
    nameAr: "وزارة المالية",
    interest: 2,
    influence: 5,
    roleEn:
      "Controls the budget envelope that decides which initiatives can move, so its cycle shapes what any plan can promise. Its day to day interest in the Council's institutional strategy is limited, which makes early alignment on the budget calendar essential.",
    roleAr:
      "تتحكم في سقف الموازنة الذي يحدد المبادرات القابلة للتنفيذ، فتُشكّل دورتها المالية حدود ما تستطيع أي خطة الالتزام به. واهتمامها اليومي بالاستراتيجية المؤسسية للمجلس محدود، ما يجعل التنسيق المبكر حول الروزنامة المالية أمراً جوهرياً.",
  },
  {
    nameEn: "Private sector and the chambers",
    nameAr: "القطاع الخاص والغرف",
    interest: 4,
    influence: 2,
    roleEn:
      "Uses official statistics for investment and market decisions and responds to the establishment surveys that produce them. Its influence on the Council's institutional choices is indirect but its interest in timely economic data is high.",
    roleAr:
      "يستخدم الإحصاءات الرسمية في قرارات الاستثمار والسوق ويستجيب لمسوح المنشآت التي تُنتجها. وتأثيره في الخيارات المؤسسية للمجلس غير مباشر، غير أن اهتمامه بالبيانات الاقتصادية في وقتها مرتفع.",
  },
  {
    nameEn: "Universities and research centres",
    nameAr: "الجامعات ومراكز البحوث",
    interest: 5,
    influence: 2,
    roleEn:
      "Depend on access to microdata and national classifications for their research and are the Council's partners in studies, scenario work and secondments. They ask a great deal of the Council but hold little formal authority over it.",
    roleAr:
      "تعتمد على الوصول إلى البيانات الجزئية والتصنيفات الوطنية في بحوثها، وهي شريك المجلس في الدراسات وأعمال السيناريوهات والإعارات. وهي كثيرة المطالب تجاه المجلس وإن كانت سلطتها الرسمية عليه محدودة.",
  },
  {
    nameEn: "International organisations",
    nameAr: "المنظمات الدولية",
    interest: 3,
    influence: 3,
    roleEn:
      "Set the statistical standards the Council adheres to and compile the global indices in which Qatar appears, drawing on data the Council submits. They give technical weight to quality reforms and expect regular reporting in return.",
    roleAr:
      "تضع المعايير الإحصائية التي يلتزم بها المجلس وتُعِدّ المؤشرات العالمية التي تظهر فيها دولة قطر اعتماداً على البيانات التي يرفعها. وتمنح إصلاحات الجودة ثقلاً فنياً وتتوقع في المقابل رفع تقارير منتظمة.",
  },
  {
    nameEn: "The public and the media",
    nameAr: "الجمهور ووسائل الإعلام",
    interest: 4,
    influence: 1,
    roleEn:
      "Reads and reuses the Council's releases and judges whether national plans are working. Coverage shapes public trust in official numbers even though it carries no formal authority over the Council.",
    roleAr:
      "يقرأ إصدارات المجلس ويعيد استخدامها ويحكم على مدى نجاح الخطط الوطنية. وتُشكّل التغطية الإعلامية ثقة الجمهور بالأرقام الرسمية وإن لم تكن لها أي سلطة رسمية على المجلس.",
  },
];

export const CHALLENGES: ChallengeItem[] = [
  {
    titleEn: "Plans written to different standards",
    titleAr: "خطط مُعدّة وفق معايير متباينة",
    descriptionEn:
      "Entity and sector strategies arrive in different structures, with objectives that mix outcomes, outputs and activities in the same list. The Council then spends review time reconstructing the results chain instead of judging the substance, and the resulting plans cannot be compared or aggregated into a national picture.",
    descriptionAr:
      "تصل استراتيجيات الجهات والقطاعات بهياكل مختلفة، وبأهداف تخلط النتائج والمخرجات والأنشطة في قائمة واحدة. فيستهلك المجلس وقت المراجعة في إعادة بناء سلسلة النتائج بدل الحكم على المضمون، وتبقى الخطط الناتجة غير قابلة للمقارنة أو للتجميع في صورة وطنية واحدة.",
    goalCode: "G1",
  },
  {
    titleEn: "Administrative data held in silos",
    titleAr: "بيانات إدارية محتجزة في صوامع",
    descriptionEn:
      "Much of the data the national statistical system needs already exists inside entity systems, but access depends on personal relationships and case by case correspondence. Without standing agreements and a shared governance model, the Council repeats expensive collection for data the state already holds.",
    descriptionAr:
      "يوجد جزء كبير من البيانات التي تحتاجها المنظومة الإحصائية الوطنية داخل أنظمة الجهات بالفعل، غير أن الوصول إليها يعتمد على العلاقات الشخصية والمراسلات حالة بحالة. ومن دون اتفاقيات دائمة ونموذج حوكمة مشترك، يكرر المجلس جمعاً مكلفاً لبيانات تملكها الدولة أصلاً.",
    goalCode: "G2",
  },
  {
    titleEn: "Releases that arrive after the decision",
    titleAr: "إصدارات تصل بعد اتخاذ القرار",
    descriptionEn:
      "Users increasingly need quarterly economic and social figures within weeks, not months, and turn to unofficial estimates when the official release is still being compiled. Every week of delay reduces the practical value of a statistic that is otherwise accurate and well documented.",
    descriptionAr:
      "بات المستخدمون يحتاجون الأرقام الاقتصادية والاجتماعية الربعية خلال أسابيع لا أشهر، ويلجأون إلى تقديرات غير رسمية ما دام الإصدار الرسمي قيد الإعداد. وكل أسبوع تأخير يقلّص القيمة العملية لإحصاء دقيق وموثّق في الأصل.",
    goalCode: "G2",
  },
  {
    titleEn: "Foresight that is read but not used",
    titleAr: "استشراف يُقرأ ولا يُستخدم",
    descriptionEn:
      "Scenario and horizon scanning products are well received yet rarely change a budget line or a project design, because they are produced outside the planning and budgeting calendar. Foresight has to enter the cycle at the moment decisions are framed if it is to alter them.",
    descriptionAr:
      "تلقى منتجات السيناريوهات ومسح الأفق قبولاً حسناً لكنها نادراً ما تغيّر بنداً في الموازنة أو تصميماً لمشروع، لأنها تُنتَج خارج روزنامة التخطيط وإعداد الموازنة. ولا بد أن يدخل الاستشراف الدورة في اللحظة التي تُصاغ فيها القرارات حتى يكون قادراً على تغييرها.",
    goalCode: "G3",
  },
  {
    titleEn: "Internal work carried by spreadsheets",
    titleAr: "عمل داخلي محمول على الجداول الإلكترونية",
    descriptionEn:
      "The Council advises government on digital transformation while running much of its own reporting, approvals and knowledge capture through email attachments and spreadsheets. The result is duplicated effort, versions that disagree, and a leadership report that is out of date on the day it is circulated.",
    descriptionAr:
      "يقدّم المجلس المشورة للحكومة في التحول الرقمي بينما يدير جانباً كبيراً من تقاريره واعتماداته وتوثيق معرفته عبر مرفقات البريد والجداول الإلكترونية. فينتج عن ذلك ازدواج في الجهد ونسخ متعارضة وتقرير للقيادة يفقد حداثته يوم تعميمه.",
    goalCode: "G4",
  },
  {
    titleEn: "A national story told in fragments",
    titleAr: "رواية وطنية مجزأة",
    descriptionEn:
      "Public understanding of the national development strategy and of how official statistics are produced remains limited, and each entity communicates its own part separately. The Council needs one coherent narrative, published on a predictable calendar, so that progress is understood as a national effort rather than a series of announcements.",
    descriptionAr:
      "لا يزال إدراك الجمهور لاستراتيجية التنمية الوطنية ولكيفية إنتاج الإحصاءات الرسمية محدوداً، وتتواصل كل جهة بشأن جزئها على حدة. ويحتاج المجلس إلى رواية واحدة متماسكة تُنشر وفق روزنامة معلومة ليُفهم التقدم بوصفه جهداً وطنياً لا سلسلة إعلانات متفرقة.",
    goalCode: "G5",
  },
];

export const BASELINES: BaselineItem[] = [
  {
    textEn:
      "In 2024, 62 percent of government entities submitted their annual implementation plans by the published deadline, and 11 entities submitted after the national report had been drafted.",
    textAr:
      "في عام 2024 رفعت 62 بالمئة من الجهات الحكومية خططها التنفيذية السنوية في الموعد المعلن، فيما رفعت 11 جهة خططها بعد إعداد مسودة التقرير الوطني.",
  },
  {
    textEn:
      "In 2024, 71 percent of scheduled statistical releases were published on the date announced in the advance release calendar.",
    textAr:
      "في عام 2024 نُشر 71 بالمئة من الإصدارات الإحصائية المجدولة في التاريخ المعلن في روزنامة النشر المسبقة.",
  },
  {
    textEn:
      "The average gap between the end of the reference period and publication for quarterly economic statistics was 96 days in 2024, against an international good practice range of 60 to 75 days.",
    textAr:
      "بلغ متوسط الفجوة بين نهاية الفترة المرجعية وتاريخ النشر للإحصاءات الاقتصادية الربعية 96 يوماً في عام 2024، مقابل نطاق الممارسات الدولية الجيدة الذي يتراوح بين 60 و75 يوماً.",
  },
  {
    textEn:
      "At the end of 2024, 18 of the 42 priority administrative data sources identified by the National Statistics Center were covered by a signed data sharing agreement.",
    textAr:
      "بنهاية عام 2024 كان 18 مصدراً من أصل 42 مصدراً للبيانات الإدارية ذات الأولوية التي حددها مركز الإحصاء الوطني مشمولاً باتفاقية موقّعة لتبادل البيانات.",
  },
  {
    textEn:
      "NDS3 monitoring covered 214 initiatives in 2024, of which 37 percent submitted a complete evidence pack with their progress report.",
    textAr:
      "شملت متابعة استراتيجية التنمية الوطنية الثالثة 214 مبادرة في عام 2024، رفعت 37 بالمئة منها حزمة أدلة مكتملة مرفقة بتقرير التقدم.",
  },
  {
    textEn:
      "Staff turnover at the Council was 14 percent in 2024, rising to 21 percent in specialist statistical and modelling roles, with an average of 187 days to fill a specialist vacancy.",
    textAr:
      "بلغ معدل دوران الموظفين في المجلس 14 بالمئة في عام 2024، وارتفع إلى 21 بالمئة في الوظائف التخصصية في الإحصاء والنمذجة، بمتوسط 187 يوماً لشغل الوظيفة التخصصية الشاغرة.",
  },
  {
    textEn:
      "By mid 2025, only 9 percent of the planning staff working in government entities had completed certified training in results based planning.",
    textAr:
      "بحلول منتصف عام 2025 لم يكن قد أكمل التدريب المعتمد على التخطيط القائم على النتائج سوى 9 بالمئة من موظفي التخطيط العاملين في الجهات الحكومية.",
  },
  {
    textEn:
      "The open data portal held 310 published datasets at the end of 2024 and recorded 48,000 dataset downloads during the year, with 46 percent of user support requests answered within five working days.",
    textAr:
      "ضمّت بوابة البيانات المفتوحة 310 مجموعات بيانات منشورة بنهاية عام 2024 وسجّلت 48,000 عملية تحميل خلال العام، مع الرد على 46 بالمئة من طلبات دعم المستخدمين خلال خمسة أيام عمل.",
  },
  {
    textEn:
      "At the start of 2025 the Council operated 3 policy simulation models, covering the macroeconomy, the labour market and population, and delivered 2 strategic risk briefings to leadership during 2024.",
    textAr:
      "في مطلع عام 2025 كان المجلس يشغّل 3 نماذج لمحاكاة السياسات تغطي الاقتصاد الكلي وسوق العمل والسكان، وقدّم إحاطتين بالمخاطر الاستراتيجية للقيادة خلال عام 2024.",
  },
  {
    textEn:
      "Of the Council's 31 core internal processes, 5 were automated end to end at the start of 2025, and 68 percent of internal performance reporting was still compiled manually in spreadsheets.",
    textAr:
      "من أصل 31 إجراءً داخلياً جوهرياً في المجلس، كانت 5 إجراءات مؤتمتة من طرف إلى طرف في مطلع عام 2025، وكان 68 بالمئة من تقارير الأداء الداخلي لا يزال يُعدّ يدوياً عبر الجداول الإلكترونية.",
  },
];

/* ------------------------------------------------------------------ */
/* 3. Governance                                                       */
/* ------------------------------------------------------------------ */

export const GOVERNANCE: GovernanceBody[] = [
  {
    bodyNameEn: "Strategy Steering Committee",
    bodyNameAr: "اللجنة التوجيهية للاستراتيجية",
    roleEn:
      "Chaired by the Secretary General, the committee owns the institutional strategy: it approves the annual targets, reviews the scorecard and the risk register each quarter, decides on the reallocation of budget and people between projects, and escalates blockers that departments cannot resolve on their own.",
    roleAr:
      "برئاسة الأمين العام، تتولى اللجنة ملكية الاستراتيجية المؤسسية: تعتمد المستهدفات السنوية، وتستعرض بطاقة الأداء وسجل المخاطر كل ربع سنة، وتبت في إعادة توزيع الموازنة والكوادر بين المشاريع، وتعالج المعوقات التي تعجز الإدارات عن حلها بمفردها.",
    cadence: "quarterly",
    members: [
      { en: "Secretary General, Chair", ar: "الأمين العام، رئيساً" },
      {
        en: "Assistant Secretary General for National Planning and Development Policy Affairs",
        ar: "مساعد الأمين العام لشؤون التخطيط وسياسات التنمية الوطنية",
      },
      {
        en: "Assistant Secretary General for the National Statistics Center",
        ar: "مساعد الأمين العام لشؤون مركز الإحصاء الوطني",
      },
      {
        en: "Assistant Secretary General for Future Foresight and National Visions Affairs",
        ar: "مساعد الأمين العام لشؤون استشراف المستقبل والرؤى الوطنية",
      },
      {
        en: "Assistant Secretary General for Follow up Affairs and Implementation Support",
        ar: "مساعد الأمين العام لشؤون المتابعة ودعم التنفيذ",
      },
      {
        en: "Director of Institutional Development and Modernization Planning and Policies, Rapporteur",
        ar: "مدير إدارة تخطيط وسياسات التطوير المؤسسي والتحديث، مقرراً",
      },
    ],
  },
  {
    bodyNameEn: "Strategy Office",
    bodyNameAr: "مكتب الاستراتيجية",
    roleEn:
      "The Department of Institutional Development and Modernization Planning and Policies acts as the Strategy Office. It maintains the results chain and the indicator cards, collects actuals on each indicator's cadence, challenges the quality of the evidence behind a reported figure, prepares the quarterly pack for the steering committee, and keeps the change log of every amendment to the strategy.",
    roleAr:
      "تقوم إدارة تخطيط وسياسات التطوير المؤسسي والتحديث بدور مكتب الاستراتيجية. فتتعهد سلسلة النتائج وبطاقات المؤشرات، وتجمع القيم الفعلية وفق دورية كل مؤشر، وتراجع جودة الأدلة خلف الرقم المرفوع، وتُعِدّ الحزمة الربعية للجنة التوجيهية، وتحتفظ بسجل التغييرات لكل تعديل يطرأ على الاستراتيجية.",
    cadence: "monthly",
    members: [
      {
        en: "Director of Institutional Development and Modernization Planning and Policies, Head of the Strategy Office",
        ar: "مدير إدارة تخطيط وسياسات التطوير المؤسسي والتحديث، رئيساً لمكتب الاستراتيجية",
      },
      {
        en: "Strategy and institutional performance analysts",
        ar: "محللو الاستراتيجية والأداء المؤسسي",
      },
      {
        en: "Representative of Planning Quality and Innovation",
        ar: "ممثل إدارة جودة التخطيط والابتكار",
      },
      {
        en: "Representative of Monitoring and Implementation Follow up",
        ar: "ممثل إدارة الرصد ومتابعة التنفيذ",
      },
      {
        en: "Representative of Financial and Administrative Affairs for the budget link",
        ar: "ممثل إدارة الشؤون المالية والإدارية للربط مع الموازنة",
      },
    ],
  },
  {
    bodyNameEn: "Department Focal Points Network",
    bodyNameAr: "شبكة ضباط الاتصال في الإدارات",
    roleEn:
      "One named focal point in every department carries the strategy inside the department: updating project and activity status, entering actuals against indicators owned by the department, raising new risks and lessons, and confirming that reported evidence exists before the Strategy Office consolidates it.",
    roleAr:
      "يتولى ضابط اتصال مسمّى في كل إدارة حمل الاستراتيجية داخل إدارته: تحديث حالة المشاريع والأنشطة، وإدخال القيم الفعلية للمؤشرات التي تملكها الإدارة، ورفع المخاطر والدروس المستفادة الجديدة، وتأكيد وجود الأدلة المرفوعة قبل أن يوحّدها مكتب الاستراتيجية.",
    cadence: "monthly",
    members: [
      {
        en: "Focal points of the departments of National Planning and Development Policy Affairs",
        ar: "ضباط الاتصال في إدارات قطاع شؤون التخطيط وسياسات التنمية الوطنية",
      },
      {
        en: "Focal points of the departments of the National Statistics Center",
        ar: "ضباط الاتصال في إدارات مركز الإحصاء الوطني",
      },
      {
        en: "Focal points of the departments of Future Foresight and National Visions Affairs",
        ar: "ضباط الاتصال في إدارات قطاع شؤون استشراف المستقبل والرؤى الوطنية",
      },
      {
        en: "Focal points of the departments of Follow up Affairs and Implementation Support",
        ar: "ضباط الاتصال في إدارات قطاع شؤون المتابعة ودعم التنفيذ",
      },
      {
        en: "Focal points of the departments of Shared Services Affairs",
        ar: "ضباط الاتصال في إدارات قطاع شؤون الخدمات المشتركة",
      },
      {
        en: "Focal points of the Office of the Secretary General departments",
        ar: "ضباط الاتصال في إدارات مكتب الأمين العام",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* 4. Risk register                                                    */
/* ------------------------------------------------------------------ */

export const RISKS: RiskItem[] = [
  {
    code: "R-01",
    titleEn: "Entities submit progress data late or incomplete",
    titleAr: "تأخر الجهات في رفع بيانات التقدم أو نقصها",
    descriptionEn:
      "Quarterly progress submissions from government entities arrive after the consolidation window or without the supporting evidence, so the national delivery picture is built on partial returns and has to be revised after publication.",
    descriptionAr:
      "تصل تقارير التقدم الربعية من الجهات الحكومية بعد نافذة التجميع أو من دون الأدلة الداعمة، فتُبنى صورة الإنجاز الوطني على بيانات ناقصة ويُضطر المجلس إلى تعديلها بعد النشر.",
    likelihood: 5,
    impact: 4,
    mitigationEn:
      "Publish a binding reporting calendar with an automated reminder sequence, give each entity a named implementation support officer, and report submission compliance by entity to the Council of Ministers alongside the progress figures.",
    mitigationAr:
      "إصدار روزنامة ملزمة لرفع التقارير مع سلسلة تذكيرات آلية، وتخصيص ضابط دعم تنفيذ مسمّى لكل جهة، ورفع مستوى الالتزام بالرفع لكل جهة إلى مجلس الوزراء إلى جانب أرقام التقدم.",
    status: "open",
    nodeCode: "G1.IO2",
  },
  {
    code: "R-02",
    titleEn: "Cyber incident exposing statistical microdata",
    titleAr: "حادثة سيبرانية تكشف البيانات الإحصائية الجزئية",
    descriptionEn:
      "An intrusion or a mishandled transfer exposes identifiable respondent records held for statistical production, breaching the confidentiality pledge on which every survey depends.",
    descriptionAr:
      "يؤدي اختراق أو نقل غير آمن إلى كشف سجلات مستجيبين قابلة للتعريف محفوظة لأغراض الإنتاج الإحصائي، بما يخل بتعهد السرية الذي تقوم عليه كل المسوح.",
    likelihood: 2,
    impact: 5,
    mitigationEn:
      "Segregate the microdata environment with no external egress, enforce role based access with quarterly recertification, encrypt every transfer, and run an annual breach simulation with the incident response team.",
    mitigationAr:
      "عزل بيئة البيانات الجزئية ومنع أي نفاذ خارجي منها، وتطبيق صلاحيات مبنية على الأدوار مع إعادة اعتماد ربع سنوية، وتشفير كل عمليات النقل، وإجراء محاكاة سنوية لاختراق البيانات مع فريق الاستجابة للحوادث.",
    status: "mitigating",
    nodeCode: "G4.IO2.OP2",
  },
  {
    code: "R-03",
    titleEn: "Loss of specialist statistical and modelling staff",
    titleAr: "فقدان الكوادر التخصصية في الإحصاء والنمذجة",
    descriptionEn:
      "Experienced staff in national accounts, sampling and econometric modelling leave for better paid roles, and the methods they hold personally are not documented well enough for a successor to continue without a gap.",
    descriptionAr:
      "يغادر الموظفون ذوو الخبرة في الحسابات القومية وتصميم العينات والنمذجة القياسية إلى وظائف أعلى أجراً، ولا تكون المنهجيات التي يحملونها شخصياً موثقة بما يكفي ليواصل الخلف العمل دون انقطاع.",
    likelihood: 4,
    impact: 4,
    mitigationEn:
      "Run a retention review for critical roles with the Human Resources department, require a documented method file and a named deputy for every statistical product, and build a standing pool of trained successors through the training centre.",
    mitigationAr:
      "إجراء مراجعة للاستبقاء في الوظائف الحرجة بالتعاون مع إدارة الموارد البشرية، واشتراط ملف منهجية موثق ونائب مسمّى لكل منتج إحصائي، وبناء مخزون دائم من الخلفاء المدربين عبر مركز التدريب.",
    status: "mitigating",
    nodeCode: "G2",
  },
  {
    code: "R-04",
    titleEn: "Statistical systems modernisation overruns",
    titleAr: "تجاوز مشروع تحديث الأنظمة الإحصائية للمدة والكلفة",
    descriptionEn:
      "The replacement of the statistical production platform slips beyond its planned window, forcing teams to run the old and new systems in parallel and delaying the releases that depend on the migration.",
    descriptionAr:
      "ينزلق استبدال منصة الإنتاج الإحصائي إلى ما بعد المدة المخططة، فتضطر الفرق إلى تشغيل النظامين القديم والجديد بالتوازي وتتأخر الإصدارات المرتبطة بعملية الترحيل.",
    likelihood: 3,
    impact: 4,
    mitigationEn:
      "Migrate one statistical domain at a time with a tested rollback for each, hold release dates on the legacy system until the new one has produced two clean cycles, and review the vendor plan monthly against milestones.",
    mitigationAr:
      "ترحيل مجال إحصائي واحد في كل مرة مع خطة تراجع مُختبرة لكل مجال، والإبقاء على مواعيد النشر عبر النظام القديم حتى ينتج النظام الجديد دورتين سليمتين، ومراجعة خطة المورّد شهرياً مقابل المحطات الرئيسة.",
    status: "open",
    nodeCode: "G2.IO1.OP2",
  },
  {
    code: "R-05",
    titleEn: "Data sharing agreements stall on legal grounds",
    titleAr: "تعثر اتفاقيات تبادل البيانات لأسباب قانونية",
    descriptionEn:
      "Entities decline or delay signature because their own legislation restricts disclosure, so priority administrative sources remain unavailable and survey based collection continues at full cost.",
    descriptionAr:
      "تمتنع جهات عن التوقيع أو تؤجله لأن تشريعاتها تقيّد الإفصاح، فتظل المصادر الإدارية ذات الأولوية غير متاحة ويستمر الجمع عبر المسوح بكامل كلفته.",
    likelihood: 4,
    impact: 3,
    mitigationEn:
      "Issue a standard agreement cleared in advance by Legal Affairs, offer a restricted access tier for sensitive fields, and escalate the remaining cases through the national data governance committee rather than bilaterally.",
    mitigationAr:
      "إصدار اتفاقية نموذجية مُجازة مسبقاً من إدارة الشؤون القانونية، وإتاحة مستوى وصول مقيّد للحقول الحساسة، ورفع الحالات المتبقية عبر لجنة حوكمة البيانات الوطنية بدل معالجتها ثنائياً.",
    status: "open",
    nodeCode: "G2.IO2.OP1",
  },
  {
    code: "R-06",
    titleEn: "Declining survey response rates",
    titleAr: "تراجع معدلات الاستجابة في المسوح",
    descriptionEn:
      "Households and establishments respond less often and less completely, which raises sampling error, forces heavier imputation and weakens confidence in the published estimates.",
    descriptionAr:
      "تتراجع استجابة الأسر والمنشآت من حيث التكرار والاكتمال، ما يرفع خطأ المعاينة ويزيد الاعتماد على التقدير ويضعف الثقة في التقديرات المنشورة.",
    likelihood: 3,
    impact: 4,
    mitigationEn:
      "Shorten questionnaires by substituting administrative data where it is available, add multi mode collection with online first contact, and run a respondent communication campaign explaining how the data is protected and used.",
    mitigationAr:
      "تقصير الاستمارات عبر إحلال البيانات الإدارية حيثما توفرت، واعتماد الجمع متعدد الأساليب مع بدء الاتصال إلكترونياً، وتنفيذ حملة تواصل مع المستجيبين تشرح كيفية حماية بياناتهم وأوجه استخدامها.",
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
      "تُعمَّم حزم السيناريوهات وتقارير المسح لكنها تصل خارج روزنامة التخطيط وإعداد الموازنة، فتُغذّي النقاش دون أن تغيّر أي التزام.",
    likelihood: 3,
    impact: 3,
    mitigationEn:
      "Fix the foresight calendar to the planning and budget cycle, require a foresight annex in every sector strategy review, and close each briefing with named decisions and owners rather than with a discussion.",
    mitigationAr:
      "ربط روزنامة الاستشراف بدورة التخطيط والموازنة، واشتراط ملحق استشرافي في مراجعة كل استراتيجية قطاعية، وإنهاء كل إحاطة بقرارات محددة وجهات مسؤولة عنها بدل الاكتفاء بالنقاش.",
    status: "open",
    nodeCode: "G3",
  },
  {
    code: "R-08",
    titleEn: "Mid cycle reduction of the Council budget",
    titleAr: "خفض موازنة المجلس في منتصف الدورة",
    descriptionEn:
      "A fiscal correction cuts the operating and capital envelope during the strategy period, which would stop the systems modernisation and the survey programme at the same time.",
    descriptionAr:
      "يؤدي تصحيح مالي إلى خفض الاعتمادات التشغيلية والرأسمالية خلال فترة الاستراتيجية، بما يوقف تحديث الأنظمة وبرنامج المسوح في آن واحد.",
    likelihood: 1,
    impact: 5,
    mitigationEn:
      "Maintain a ranked list of projects with the minimum viable scope of each, agree the statutory statistical programme as a protected core with the Ministry of Finance, and phase contracts so that commitments can be paused at defined points.",
    mitigationAr:
      "الاحتفاظ بقائمة مرتبة للمشاريع مع الحد الأدنى القابل للتنفيذ من نطاق كل منها، والاتفاق مع وزارة المالية على اعتبار البرنامج الإحصائي الإلزامي نواة محمية، وتقسيم العقود إلى مراحل تتيح إيقاف الالتزامات عند نقاط محددة.",
    status: "open",
    nodeCode: null,
  },
  {
    code: "R-09",
    titleEn: "Shift in national priorities forces re planning",
    titleAr: "تغير الأولويات الوطنية يفرض إعادة التخطيط",
    descriptionEn:
      "A change in national direction or an urgent mandate redirects Council capacity to unplanned work, and the institutional strategy is quietly deprioritised while the new demand is served.",
    descriptionAr:
      "يؤدي تغير في التوجه الوطني أو تكليف عاجل إلى تحويل قدرات المجلس نحو أعمال غير مخططة، فتتراجع أولوية الاستراتيجية المؤسسية بهدوء ريثما تُلبّى المهمة الجديدة.",
    likelihood: 3,
    impact: 4,
    mitigationEn:
      "Reserve a defined share of departmental capacity for unplanned national tasking, and require the steering committee to record formally which targets are deferred whenever new work is absorbed.",
    mitigationAr:
      "حجز نسبة محددة من قدرة الإدارات للتكليفات الوطنية غير المخططة، وإلزام اللجنة التوجيهية بتوثيق المستهدفات المؤجلة رسمياً عند استيعاب أي أعمال جديدة.",
    status: "open",
    nodeCode: null,
  },
  {
    code: "R-10",
    titleEn: "The planning manual is adopted formally but not in practice",
    titleAr: "اعتماد دليل التخطيط شكلياً دون تطبيق فعلي",
    descriptionEn:
      "Entities fill in the new templates while keeping their old habit of listing activities as objectives, so documents look compliant and the results chain behind them remains broken.",
    descriptionAr:
      "تعبّئ الجهات النماذج الجديدة مع الإبقاء على عادتها القديمة في إدراج الأنشطة بوصفها أهدافاً، فتبدو الوثائق مطابقة بينما تظل سلسلة النتائج خلفها مختلة.",
    likelihood: 4,
    impact: 2,
    mitigationEn:
      "Score every submitted strategy against a published quality checklist, return non compliant documents with written findings, and pair the manual with coaching clinics for entity planning teams during drafting.",
    mitigationAr:
      "تقييم كل استراتيجية مرفوعة وفق قائمة تحقق معلنة للجودة، وإعادة الوثائق غير المطابقة مصحوبة بملاحظات مكتوبة، ومرافقة الدليل بعيادات إرشادية لفرق التخطيط في الجهات أثناء مرحلة الصياغة.",
    status: "mitigating",
    nodeCode: "G1.IO1.OP1",
  },
  {
    code: "R-11",
    titleEn: "Unofficial figures compete with official statistics",
    titleAr: "منافسة الأرقام غير الرسمية للإحصاءات الرسمية",
    descriptionEn:
      "Entities, consultancies and media publish their own estimates for the same phenomena, and the public is left with several numbers and no way to tell which is authoritative.",
    descriptionAr:
      "تنشر جهات وشركات استشارية ووسائل إعلام تقديراتها الخاصة للظواهر نفسها، فيجد الجمهور أمامه أرقاماً عدة دون وسيلة لتمييز الرقم المرجعي بينها.",
    likelihood: 5,
    impact: 2,
    mitigationEn:
      "Publish an official statistics mark and a single reference page per indicator, shorten release lag so the official figure arrives first, and agree a clearance rule with entities before any national figure is released.",
    mitigationAr:
      "اعتماد علامة للإحصاءات الرسمية وصفحة مرجعية واحدة لكل مؤشر، وتقصير فترة التأخر في النشر ليصل الرقم الرسمي أولاً، والاتفاق مع الجهات على قاعدة إجازة مسبقة قبل إصدار أي رقم وطني.",
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
      "يواصل الموظفون العمل عبر مرفقات البريد والجداول الشخصية بعد تسليم المنصة الجديدة، فلا تتحقق النسخة الواحدة الموحدة للوثيقة التي وُعد بها.",
    likelihood: 3,
    impact: 2,
    mitigationEn:
      "Move the processes that matter most to each department first, retire the old channel for those processes on a published date, and track adoption per department in the monthly focal points meeting.",
    mitigationAr:
      "نقل الإجراءات الأكثر أهمية لكل إدارة أولاً، وإيقاف القناة القديمة لتلك الإجراءات في تاريخ معلن، وتتبع نسبة التبني لكل إدارة في اجتماع ضباط الاتصال الشهري.",
    status: "mitigating",
    nodeCode: "G4.IO2.OP1",
  },
  {
    code: "R-13",
    titleEn: "Dependence on a single vendor for analytics platforms",
    titleAr: "الاعتماد على مورّد وحيد لمنصات التحليل",
    descriptionEn:
      "Several reporting and analytics products rest on one supplier's stack, which concentrates renewal risk and limits the Council's room to negotiate or to move.",
    descriptionAr:
      "تعتمد عدة منتجات للتقارير والتحليل على منظومة مورّد واحد، ما يركّز مخاطر التجديد ويحد من هامش المجلس في التفاوض أو الانتقال.",
    likelihood: 2,
    impact: 3,
    mitigationEn:
      "Keep all source data and transformation logic inside Council owned stores, require export in open formats in every contract, and stagger renewal dates so no two critical platforms expire together.",
    mitigationAr:
      "الاحتفاظ بجميع البيانات المصدرية ومنطق المعالجة داخل مستودعات يملكها المجلس، واشتراط التصدير بصيغ مفتوحة في كل عقد، وتوزيع مواعيد التجديد بحيث لا ينتهي عقدا منصتين حرجتين في وقت واحد.",
    status: "open",
    nodeCode: null,
  },
  {
    code: "R-14",
    titleEn: "Late submissions to international indicator bodies",
    titleAr: "التأخر في الرفع إلى جهات المؤشرات الدولية",
    descriptionEn:
      "A national data return misses an international compilation deadline, and Qatar is scored on an older figure or on an estimate produced by the compiling organisation.",
    descriptionAr:
      "يفوت أحد الردود الوطنية موعد التجميع لدى جهة دولية، فتُقيَّم دولة قطر على رقم أقدم أو على تقدير تُعِدّه الجهة المُجمِّعة.",
    likelihood: 2,
    impact: 2,
    mitigationEn:
      "Maintain a calendar of every international submission with an owner and a two week buffer, and pre clear recurring returns with the source entities at the start of each year.",
    mitigationAr:
      "الاحتفاظ بروزنامة لكل عمليات الرفع الدولية مع جهة مسؤولة وهامش أمان مدته أسبوعان، والحصول على إجازة مسبقة للردود المتكررة من الجهات المصدرية في مطلع كل عام.",
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
      "يتغير ضباط الاتصال بوتيرة متكررة ويأتي خلفاؤهم دون تهيئة، فتتراجع جودة البيانات في نظام الاستراتيجية ويتحمل مكتب الاستراتيجية عبء التصحيح.",
    likelihood: 4,
    impact: 2,
    mitigationEn:
      "Name a deputy focal point in every department, publish a one hour induction pack and a short guide, and require a handover note before any focal point is replaced.",
    mitigationAr:
      "تسمية ضابط اتصال مناوب في كل إدارة، ونشر حزمة تهيئة مدتها ساعة واحدة مع دليل مختصر، واشتراط مذكرة تسليم قبل استبدال أي ضابط اتصال.",
    status: "open",
    nodeCode: null,
  },
  {
    code: "R-16",
    titleEn: "Business continuity arrangements untested",
    titleAr: "عدم اختبار ترتيبات استمرارية الأعمال",
    descriptionEn:
      "Continuity plans exist on paper but have not been exercised against a real disruption, so recovery times for the statistical release chain and the leadership dashboard are unproven.",
    descriptionAr:
      "توجد خطط الاستمرارية على الورق دون أن تُختبر في مواجهة انقطاع حقيقي، فتبقى أزمنة التعافي لسلسلة النشر الإحصائي ولوحة متابعة القيادة غير مثبتة.",
    likelihood: 2,
    impact: 4,
    mitigationEn:
      "Run two continuity exercises a year covering a data centre failure and the loss of a key system, publish the recovery times achieved, and close every gap found with a dated action.",
    mitigationAr:
      "إجراء تمرينين للاستمرارية سنوياً يغطيان تعطل مركز بيانات وفقدان نظام رئيس، ونشر أزمنة التعافي المتحققة، ومعالجة كل فجوة مكتشفة بإجراء محدد بتاريخ.",
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
      "تُنفَّذ تجربة سلوكية أو سياساتية على عينة صغيرة أو دون مجموعة مقارنة سليمة، فلا تصلح النتيجة لدعم توصية في أي اتجاه.",
    likelihood: 2,
    impact: 2,
    mitigationEn:
      "Require a pre registered design with a power calculation before any trial starts, and publish null results as findings so that the learning is kept rather than repeated.",
    mitigationAr:
      "اشتراط تصميم مُسجّل مسبقاً مع حساب للقوة الإحصائية قبل بدء أي تجربة، ونشر النتائج غير الدالة بوصفها نتائج حتى تُحفظ المعرفة بدل تكرار التجربة.",
    status: "open",
    nodeCode: "G1.IO3.OP2",
  },
  {
    code: "R-18",
    titleEn: "Misinterpretation of statistics in public coverage",
    titleAr: "إساءة تفسير الإحصاءات في التغطية العامة",
    descriptionEn:
      "A release is reported without its definitions or its revision status, a misleading headline spreads, and the Council spends the following weeks correcting the record instead of explaining the substance.",
    descriptionAr:
      "يُنقل أحد الإصدارات دون تعريفاته أو دون بيان حالة مراجعته، فينتشر عنوان مضلل ويقضي المجلس الأسابيع التالية في تصحيح المعلومة بدل شرح مضمونها.",
    likelihood: 3,
    impact: 2,
    mitigationEn:
      "Issue a plain language summary and a chart pack with every major release, brief editors ahead of sensitive publications, and keep a standing correction procedure with a named spokesperson.",
    mitigationAr:
      "إصدار ملخص بلغة مبسطة وحزمة رسوم بيانية مع كل إصدار رئيس، وإحاطة المحررين قبل النشرات الحساسة، واعتماد إجراء دائم للتصحيح مع متحدث رسمي مسمّى.",
    status: "open",
    nodeCode: null,
  },
  {
    code: "R-19",
    titleEn: "Disruption from the office relocation",
    titleAr: "اضطراب ناتج عن الانتقال إلى المقر الجديد",
    descriptionEn:
      "The move of Council departments to the new premises during 2025 was expected to interrupt survey operations and the release schedule for several weeks.",
    descriptionAr:
      "كان من المتوقع أن يؤدي انتقال إدارات المجلس إلى المقر الجديد خلال عام 2025 إلى تعطيل عمليات المسوح وجدول النشر لعدة أسابيع.",
    likelihood: 1,
    impact: 1,
    mitigationEn:
      "The move was phased outside the release peaks with remote working kept available throughout, and no release date was missed, so the risk was closed after the final department relocated.",
    mitigationAr:
      "نُفّذ الانتقال على مراحل خارج ذروات النشر مع إبقاء العمل عن بُعد متاحاً طوال المدة، ولم يفت أي موعد نشر، فأُغلق الخطر بعد انتقال آخر إدارة.",
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
      "كان اعتماد الاستراتيجية معرضاً للتأخر إلى ما بعد بداية السنة التخطيطية 2025، بما كان سيترك الإدارات تخطط استناداً إلى سلسلة نتائج غير معتمدة.",
    likelihood: 1,
    impact: 2,
    mitigationEn:
      "The draft was reviewed with the sectors ahead of submission and approved on 16 March 2025, and departmental plans were aligned within the same quarter, so the risk was closed.",
    mitigationAr:
      "روجعت المسودة مع القطاعات قبل الرفع واعتُمدت في 16 مارس 2025، وجرت مواءمة خطط الإدارات خلال الربع نفسه، فأُغلق الخطر.",
    status: "closed",
    nodeCode: null,
  },
];

/* ------------------------------------------------------------------ */
/* 5. Results chain: goals                                             */
/* ------------------------------------------------------------------ */

export const GOALS: GoalSeed[] = [
  {
    code: "G1",
    titleEn: "Excellence in national development planning",
    titleAr: "التميز في التخطيط التنموي الوطني",
    descriptionEn:
      "The Council makes national planning a disciplined craft: one results based method, one set of templates, and a technical review that every sector and entity strategy passes before it is adopted. It supports the delivery of NDS3 with evidence and hands on implementation help rather than correspondence, and it tests major policies through simulation and trials before they are committed. The goal is achieved when plans across government are comparable, monitorable and actually delivered.",
    descriptionAr:
      "يجعل المجلس التخطيط الوطني ممارسة منضبطة تقوم على منهجية موحدة قائمة على النتائج، ونماذج معتمدة، ومراجعة فنية تمر بها كل استراتيجية قطاعية ومؤسسية قبل اعتمادها. ويدعم تنفيذ استراتيجية التنمية الوطنية الثالثة بالأدلة وبالدعم الميداني المباشر لا بالمراسلات، ويختبر السياسات الكبرى عبر المحاكاة والتجارب قبل الالتزام بها. ويتحقق الهدف حين تصبح خطط الجهات قابلة للمقارنة والمتابعة والإنجاز الفعلي.",
    ownerUnitCode: "NPD",
    alignment: [
      {
        targetKind: "nds_node",
        targetCode: "O7",
        labelEn: "Government Excellence",
        labelAr: "التميز الحكومي",
        noteEn:
          "A single planning standard, quality assured reviews and evidence based follow up raise the planning and delivery capability of every government entity, which is the operating core of government excellence.",
        noteAr:
          "يرفع توحيد معيار التخطيط ومراجعات ضمان الجودة والمتابعة القائمة على الأدلة قدرةَ كل جهة حكومية على التخطيط والإنجاز، وهي جوهر التميز الحكومي في التشغيل.",
      },
      {
        targetKind: "nds_node",
        targetCode: "O1",
        labelEn: "Sustainable Economic Growth",
        labelAr: "النمو الاقتصادي المستدام",
        noteEn:
          "Economic initiatives reach their targets faster when their plans are properly specified and when simulation exposes weak assumptions before money is committed.",
        noteAr:
          "تبلغ المبادرات الاقتصادية مستهدفاتها بوتيرة أسرع حين تكون خططها محددة بدقة وحين تكشف المحاكاة الافتراضات الضعيفة قبل الالتزام بالإنفاق.",
      },
      {
        targetKind: "nds_node",
        targetCode: "O2",
        labelEn: "Fiscal Sustainability",
        labelAr: "الاستدامة المالية",
        noteEn:
          "Testing policies before adoption and linking plans to costed outputs reduces spending on initiatives that would not have produced the intended result.",
        noteAr:
          "يقلّص اختبار السياسات قبل اعتمادها وربط الخطط بمخرجات مُكلّفة الإنفاقَ على مبادرات ما كانت لتحقق النتيجة المقصودة.",
      },
    ],
  },
  {
    code: "G2",
    titleEn: "Trusted official statistics and national data",
    titleAr: "إحصاءات رسمية وبيانات وطنية موثوقة",
    descriptionEn:
      "Official statistics are produced to international quality standards, released on a published calendar, and documented so that any user can judge how a figure was made and when it may be revised. National data is governed as a shared public asset, with standing sharing agreements and one catalogue that tells a user what exists and how to obtain it. Trust is the real outcome: the figures the country argues with should be the Council's figures.",
    descriptionAr:
      "تُنتَج الإحصاءات الرسمية وفق معايير الجودة الدولية وتُنشر وفق روزنامة معلنة وتُوثَّق بحيث يستطيع أي مستخدم الحكم على كيفية إنتاج الرقم وموعد مراجعته المحتمل. وتُحكَم البيانات الوطنية بوصفها أصلاً عاماً مشتركاً، باتفاقيات تبادل دائمة ودليل موحد يخبر المستخدم بما هو متاح وبكيفية الحصول عليه. والثقة هي المحصلة الحقيقية: أن تكون أرقام المجلس هي المرجع الذي يستند إليه الجميع.",
    ownerUnitCode: "NSC",
    alignment: [
      {
        targetKind: "nds_node",
        targetCode: "O7",
        labelEn: "Government Excellence",
        labelAr: "التميز الحكومي",
        noteEn:
          "Government decisions, budgets and performance reports all draw on official statistics, so the quality and timeliness of those statistics set a ceiling on the quality of government decision making.",
        noteAr:
          "تستند قرارات الحكومة وموازناتها وتقارير أدائها إلى الإحصاءات الرسمية، ومن ثم فإن جودة تلك الإحصاءات وحداثتها تضعان سقفاً لجودة صنع القرار الحكومي.",
      },
      {
        targetKind: "data_strategy_initiative",
        targetCode: "national-data-statistics-strategy",
        labelEn: "National Data and Statistics Strategy",
        labelAr: "الاستراتيجية الوطنية للبيانات والإحصاء",
        noteEn:
          "The quality framework, the data sharing agreements and the unified catalogue are the Council's direct contribution to the national data and statistics agenda.",
        noteAr:
          "يمثل إطار الجودة واتفاقيات تبادل البيانات والدليل الموحد إسهام المجلس المباشر في الأجندة الوطنية للبيانات والإحصاء.",
      },
      {
        targetKind: "nds_node",
        targetCode: "O1",
        labelEn: "Sustainable Economic Growth",
        labelAr: "النمو الاقتصادي المستدام",
        noteEn:
          "Investors, firms and analysts price risk from official economic statistics, so faster and better documented releases improve the information base of the whole economy.",
        noteAr:
          "يقيس المستثمرون والشركات والمحللون المخاطر انطلاقاً من الإحصاءات الاقتصادية الرسمية، فتُحسّن الإصدارات الأسرع والأفضل توثيقاً القاعدةَ المعلوماتية للاقتصاد بأكمله.",
      },
    ],
  },
  {
    code: "G3",
    titleEn: "Foresight and readiness for national risks",
    titleAr: "الاستشراف والجاهزية للمخاطر الوطنية",
    descriptionEn:
      "The Council watches the horizon on the country's behalf: it scans for signals of change, turns them into scenarios that leadership can act on, and keeps a live reading of the risks that could knock national plans off course. Foresight is scheduled into the planning and budget cycle so that it shapes commitments rather than commenting on them. Over the period, the capability spreads beyond the Council into a network of trained foresight practitioners across government.",
    descriptionAr:
      "يرصد المجلس الأفق نيابة عن الدولة: يمسح إشارات التغيير، ويحوّلها إلى سيناريوهات قابلة للتحرك من قبل القيادة، ويحتفظ بقراءة حيّة للمخاطر التي قد تحرف الخطط الوطنية عن مسارها. ويُدرَج الاستشراف ضمن دورة التخطيط والموازنة ليصوغ الالتزامات لا ليعلّق عليها بعد إقرارها. وخلال فترة الاستراتيجية تمتد هذه القدرة خارج المجلس لتصبح شبكة من ممارسي الاستشراف المدرَّبين في الجهات الحكومية.",
    ownerUnitCode: "FFV",
    alignment: [
      {
        targetKind: "nds_node",
        targetCode: "O7",
        labelEn: "Government Excellence",
        labelAr: "التميز الحكومي",
        noteEn:
          "Anticipating disruption and preparing options in advance is what separates a government that reacts from one that is ready, and readiness is the part of excellence that only shows under stress.",
        noteAr:
          "استباق الاضطرابات وإعداد الخيارات مسبقاً هو ما يفصل بين حكومة تتفاعل مع الأحداث وأخرى جاهزة لها، والجاهزية هي وجه التميز الذي لا يظهر إلا تحت الضغط.",
      },
      {
        targetKind: "nds_node",
        targetCode: "O6",
        labelEn: "Environmental Sustainability",
        labelAr: "الاستدامة البيئية",
        noteEn:
          "Climate, water and energy transition risks unfold over decades, so scenario work is the main instrument for bringing them into decisions taken today.",
        noteAr:
          "تمتد مخاطر المناخ والمياه وتحول الطاقة على مدى عقود، ما يجعل أعمال السيناريوهات الأداة الرئيسة لإدخالها في القرارات التي تُتخذ اليوم.",
      },
      {
        targetKind: "nds_node",
        targetCode: "O3",
        labelEn: "Future-Ready Workforce",
        labelAr: "قوة عاملة جاهزة للمستقبل",
        noteEn:
          "Scenarios of technology and labour market change tell education and training entities which skills to build before the demand for them arrives.",
        noteAr:
          "تُبيّن سيناريوهات التغير التقني وتحولات سوق العمل لجهات التعليم والتدريب المهاراتِ الواجب بناؤها قبل أن يظهر الطلب عليها.",
      },
    ],
  },
  {
    code: "G4",
    titleEn: "Institutional and digital excellence",
    titleAr: "التميز المؤسسي والرقمي",
    descriptionEn:
      "The Council holds itself to the standard it asks of others: clear processes, measured service quality, knowledge that survives the departure of the person who created it, and digital platforms that carry the real work instead of sitting beside it. Internal performance is reported from data the systems already hold, not assembled by hand each quarter. This goal is the enabler beneath the other four.",
    descriptionAr:
      "يُخضِع المجلس نفسه للمعيار الذي يطلبه من غيره: إجراءات واضحة، وجودة خدمة مُقاسة، ومعرفة تبقى بعد مغادرة من أنتجها، ومنصات رقمية تحمل العمل الحقيقي بدل أن تقف على هامشه. ويُرفع الأداء الداخلي من البيانات التي تحتفظ بها الأنظمة أصلاً لا بتجميع يدوي كل ربع سنة. وهذا الهدف هو الممكّن الذي تقوم عليه الأهداف الأربعة الأخرى.",
    ownerUnitCode: "IDP",
    alignment: [
      {
        targetKind: "nds_node",
        targetCode: "O7",
        labelEn: "Government Excellence",
        labelAr: "التميز الحكومي",
        noteEn:
          "An institution that advises government on modernisation has to model it, so the Council's own process automation, service quality system and continuity arrangements are a direct contribution to the excellence agenda.",
        noteAr:
          "على المؤسسة التي تقدّم المشورة للحكومة في التحديث أن تكون قدوة فيه، ومن ثم تمثل أتمتة إجراءات المجلس ونظام جودة خدماته وترتيبات استمراريته إسهاماً مباشراً في أجندة التميز الحكومي.",
      },
      {
        targetKind: "nds_node",
        targetCode: "O3",
        labelEn: "Future-Ready Workforce",
        labelAr: "قوة عاملة جاهزة للمستقبل",
        noteEn:
          "Building analytical, statistical and foresight careers inside the Council, with documented methods and structured handover, adds to the national stock of advanced skills.",
        noteAr:
          "يضيف بناء المسارات المهنية في التحليل والإحصاء والاستشراف داخل المجلس، مع توثيق المنهجيات وتنظيم التسليم، إلى الرصيد الوطني من المهارات المتقدمة.",
      },
      {
        targetKind: "data_strategy_initiative",
        targetCode: "national-data-statistics-strategy",
        labelEn: "National Data and Statistics Strategy",
        labelAr: "الاستراتيجية الوطنية للبيانات والإحصاء",
        noteEn:
          "Internal data platforms, security controls and automated reporting give the national data agenda a working reference implementation inside the Council itself.",
        noteAr:
          "تمنح المنصات الداخلية للبيانات وضوابط الأمن والتقارير المؤتمتة الأجندةَ الوطنية للبيانات تطبيقاً مرجعياً عاملاً داخل المجلس نفسه.",
      },
    ],
  },
  {
    code: "G5",
    titleEn: "Partnerships and national communication",
    titleAr: "الشراكات والتواصل الوطني",
    descriptionEn:
      "The Council extends its reach through structured partnerships with government entities, universities, the private sector and international organisations, so that analytical capacity is shared rather than duplicated. At the same time it explains national plans and official statistics to the public in language people can use, on a predictable calendar. The goal is a Council that is both connected and understood.",
    descriptionAr:
      "يوسّع المجلس أثره عبر شراكات منظمة مع الجهات الحكومية والجامعات والقطاع الخاص والمنظمات الدولية، بحيث تُتقاسم القدرة التحليلية بدل تكرارها. ويشرح في الوقت نفسه الخطط الوطنية والإحصاءات الرسمية للجمهور بلغة قابلة للاستخدام ووفق روزنامة معلومة. والغاية أن يكون المجلس موصولاً بشركائه ومفهوماً لدى جمهوره في آن واحد.",
    ownerUnitCode: "CA",
    alignment: [
      {
        targetKind: "nds_node",
        targetCode: "O7",
        labelEn: "Government Excellence",
        labelAr: "التميز الحكومي",
        noteEn:
          "Coordinated partnerships and clear public reporting on national progress are how government demonstrates that it is accountable for what it promised.",
        noteAr:
          "تمثل الشراكات المنسقة والتقارير العامة الواضحة عن التقدم الوطني الوسيلةَ التي تُظهر بها الحكومة مساءلتها عما التزمت به.",
      },
      {
        targetKind: "nds_node",
        targetCode: "O4",
        labelEn: "Cohesive Society",
        labelAr: "مجتمع متماسك",
        noteEn:
          "When people can see the national plan and the evidence behind it in their own language, participation in national goals rests on understanding rather than on announcement.",
        noteAr:
          "حين يتمكن الناس من الاطلاع على الخطة الوطنية والأدلة التي تسندها بلغتهم، تقوم المشاركة في الأهداف الوطنية على الفهم لا على الإعلان.",
      },
      {
        targetKind: "nds_node",
        targetCode: "O5",
        labelEn: "Quality of Life",
        labelAr: "جودة الحياة",
        noteEn:
          "Publishing accessible social and living standards statistics lets residents and service providers see where quality of life is improving and where it is not.",
        noteAr:
          "يتيح نشر الإحصاءات الاجتماعية وإحصاءات مستويات المعيشة بصورة ميسّرة للسكان ومقدمي الخدمات رؤية المجالات التي تتحسن فيها جودة الحياة وتلك التي لا تتحسن.",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* 6. Results chain: intermediate outcomes                             */
/* ------------------------------------------------------------------ */

export const INTERMEDIATE_OUTCOMES: IntermediateOutcomeSeed[] = [
  {
    code: "G1.IO1",
    goalCode: "G1",
    titleEn: "Strategies and plans are prepared to a single national standard",
    titleAr: "إعداد الاستراتيجيات والخطط وفق معيار وطني موحد",
    descriptionEn:
      "Every sector and entity strategy follows the same results chain, uses the same templates and carries indicator cards that meet a published quality checklist. Planning teams across government are trained and certified in the method, so compliance comes from capability rather than from correction.",
    descriptionAr:
      "تتبع كل استراتيجية قطاعية ومؤسسية سلسلة النتائج ذاتها وتستخدم النماذج ذاتها وتتضمن بطاقات مؤشرات مستوفية لقائمة تحقق معلنة للجودة. وتُدرَّب فرق التخطيط في الجهات وتُعتمد في المنهجية، فيأتي الالتزام من القدرة لا من التصحيح اللاحق.",
    ownerUnitCode: "PQI",
  },
  {
    code: "G1.IO2",
    goalCode: "G1",
    titleEn: "NDS3 delivery is monitored and supported with evidence",
    titleAr: "متابعة تنفيذ استراتيجية التنمية الوطنية الثالثة ودعمه بالأدلة",
    descriptionEn:
      "Progress on NDS3 initiatives is reported on a fixed cycle against verifiable evidence, and leadership sees one integrated picture rather than a set of entity submissions. Entities that fall behind receive targeted implementation support instead of another request for a report.",
    descriptionAr:
      "يُرفع التقدم في مبادرات استراتيجية التنمية الوطنية الثالثة وفق دورة ثابتة واستناداً إلى أدلة قابلة للتحقق، وترى القيادة صورة واحدة متكاملة بدل مجموعة من تقارير الجهات المنفصلة. وتتلقى الجهات المتعثرة دعماً تنفيذياً موجّهاً بدل طلب تقرير إضافي.",
    ownerUnitCode: "FAI",
  },
  {
    code: "G1.IO3",
    goalCode: "G1",
    titleEn: "Policies are tested before they are adopted",
    titleAr: "اختبار السياسات قبل اعتمادها",
    descriptionEn:
      "Major policy proposals pass through simulation or a controlled trial before they reach the decision table, so their expected effects and trade offs are stated in numbers. Where a proposal does not survive the test, the finding is recorded and reused rather than rediscovered.",
    descriptionAr:
      "تمر مقترحات السياسات الكبرى بالمحاكاة أو بتجربة محكومة قبل وصولها إلى طاولة القرار، بحيث تُعرض آثارها المتوقعة ومفاضلاتها بالأرقام. وحين لا يصمد المقترح أمام الاختبار تُوثَّق النتيجة ويُعاد استخدامها بدل اكتشافها من جديد.",
    ownerUnitCode: "SPS",
  },
  {
    code: "G2.IO1",
    goalCode: "G2",
    titleEn: "Official statistics meet international quality standards",
    titleAr: "استيفاء الإحصاءات الرسمية لمعايير الجودة الدولية",
    descriptionEn:
      "Statistical production follows a documented quality assurance framework aligned to international principles, supported by modern systems and accredited classifications. Each statistical product carries a quality report that states its methods, its limits and its revision history.",
    descriptionAr:
      "يسير الإنتاج الإحصائي وفق إطار موثق لضمان الجودة متوائم مع المبادئ الدولية، ومسنود بأنظمة حديثة وتصنيفات معتمدة. ويحمل كل منتج إحصائي تقرير جودة يبيّن منهجياته وحدوده وسجل مراجعاته.",
    ownerUnitCode: "SQ",
  },
  {
    code: "G2.IO2",
    goalCode: "G2",
    titleEn: "National data is shared and governed as an asset",
    titleAr: "تبادل البيانات الوطنية وحوكمتها بوصفها أصلاً وطنياً",
    descriptionEn:
      "Priority administrative data flows to the national statistical system under standing agreements with clear custodianship, access tiers and protection rules. One national catalogue describes what data exists, who holds it and how it may be obtained.",
    descriptionAr:
      "تتدفق البيانات الإدارية ذات الأولوية إلى المنظومة الإحصائية الوطنية بموجب اتفاقيات دائمة تحدد الجهة الحافظة ومستويات الوصول وقواعد الحماية. ويصف دليل وطني واحد البيانات المتاحة والجهات المالكة لها وسبل الحصول عليها.",
    ownerUnitCode: "NDA",
  },
  {
    code: "G2.IO3",
    goalCode: "G2",
    titleEn: "Users find, trust and reuse NPC statistics",
    titleAr: "وصول المستخدمين إلى إحصاءات المجلس والثقة بها وإعادة استخدامها",
    descriptionEn:
      "Statistics are published on time through services designed around how people actually search, download and cite data, with definitions and revisions visible next to every figure. Users are supported and taught to read the numbers correctly, so reuse grows without misinterpretation.",
    descriptionAr:
      "تُنشر الإحصاءات في مواعيدها عبر خدمات مصممة وفق طريقة بحث المستخدمين وتحميلهم للبيانات واستشهادهم بها، مع إظهار التعريفات والمراجعات إلى جانب كل رقم. ويُدعم المستخدمون ويُدرَّبون على قراءة الأرقام قراءة صحيحة، فتتسع إعادة الاستخدام دون سوء تفسير.",
    ownerUnitCode: "SOA",
  },
  {
    code: "G3.IO1",
    goalCode: "G3",
    titleEn: "Emerging risks and opportunities are detected early",
    titleAr: "الرصد المبكر للمخاطر والفرص الناشئة",
    descriptionEn:
      "A standing scanning system collects and assesses signals of change from national and international sources and turns the significant ones into structured briefings. Leadership receives a regular reading of the strategic risk picture with options attached, not only a description.",
    descriptionAr:
      "تجمع منظومة مسح دائمة إشارات التغيير من مصادر وطنية ودولية وتقيّمها وتحوّل المهم منها إلى إحاطات منظمة. وتتلقى القيادة قراءة دورية لصورة المخاطر الاستراتيجية مصحوبة بخيارات للتعامل معها لا بالوصف وحده.",
    ownerUnitCode: "SF",
  },
  {
    code: "G3.IO2",
    goalCode: "G3",
    titleEn: "National visions and long term choices are informed by foresight",
    titleAr: "استناد الرؤى الوطنية والخيارات بعيدة المدى إلى الاستشراف",
    descriptionEn:
      "Scenario sets, behavioural evidence and long range analysis feed directly into Qatar National Vision work and into the design of national priorities. The capability is shared with entities so that foresight becomes a normal part of how plans are written across government.",
    descriptionAr:
      "تغذي حزم السيناريوهات والأدلة السلوكية والتحليلات بعيدة المدى أعمالَ رؤية قطر الوطنية وتصميمَ الأولويات الوطنية مباشرة. وتُتقاسم هذه القدرة مع الجهات ليصبح الاستشراف جزءاً معتاداً من طريقة إعداد الخطط في العمل الحكومي.",
    ownerUnitCode: "NV",
  },
  {
    code: "G4.IO1",
    goalCode: "G4",
    titleEn: "The Council works as one modern institution",
    titleAr: "عمل المجلس كمؤسسة حديثة واحدة",
    descriptionEn:
      "Processes, service standards and internal quality are defined once and applied across all sectors, with performance reviewed openly rather than defended department by department. Knowledge produced anywhere in the Council is captured, owned and handed over so that experience accumulates instead of leaking.",
    descriptionAr:
      "تُحدَّد الإجراءات ومعايير الخدمة والجودة الداخلية مرة واحدة وتُطبَّق في القطاعات كافة، ويُستعرض الأداء بشفافية بدل الدفاع عنه إدارة بإدارة. وتُوثَّق المعرفة المنتَجة في أي موقع من المجلس وتُسنَد إلى مالك وتُسلَّم، فتتراكم الخبرة بدل أن تتسرب.",
    ownerUnitCode: "IDP",
  },
  {
    code: "G4.IO2",
    goalCode: "G4",
    titleEn: "Digital platforms carry the Council's core work",
    titleAr: "منصات رقمية تحمل الأعمال الجوهرية للمجلس",
    descriptionEn:
      "The Council's main processes run on integrated digital platforms with automated workflow, protected data and tested continuity arrangements. Internal performance reporting is generated from those platforms, so leadership reads current data rather than a compiled snapshot.",
    descriptionAr:
      "تعمل إجراءات المجلس الرئيسة على منصات رقمية متكاملة بمسارات عمل مؤتمتة وبيانات محمية وترتيبات استمرارية مُختبرة. وتُولَّد تقارير الأداء الداخلي من تلك المنصات، فتقرأ القيادة بيانات حيّة لا لقطة مُجمّعة يدوياً.",
    ownerUnitCode: "IS",
  },
  {
    code: "G5.IO1",
    goalCode: "G5",
    titleEn: "Partnerships extend the Council's reach",
    titleAr: "شراكات توسّع أثر المجلس",
    descriptionEn:
      "Agreements with entities, universities, research centres and international organisations give the Council access to expertise, data and joint research capacity it does not need to build alone. Each partnership carries a defined purpose, named owners and products that can be pointed to.",
    descriptionAr:
      "تمنح الاتفاقيات مع الجهات والجامعات ومراكز البحوث والمنظمات الدولية المجلسَ نفاذاً إلى خبرات وبيانات وقدرة بحثية مشتركة لا يحتاج إلى بنائها وحده. ولكل شراكة غرض محدد وجهات مسؤولة مسماة ومنتجات يمكن الإشارة إليها.",
    ownerUnitCode: "IIC",
  },
  {
    code: "G5.IO2",
    goalCode: "G5",
    titleEn: "The Council communicates clearly with the public",
    titleAr: "تواصل واضح مع الجمهور",
    descriptionEn:
      "National plans, progress and statistics are explained in both languages through a planned publication calendar, in formats people can read, quote and reuse. Council sessions and the decisions that follow them are documented and tracked so that commitments do not disappear after the meeting.",
    descriptionAr:
      "تُشرح الخطط الوطنية والتقدم المحرز والإحصاءات باللغتين وفق روزنامة نشر مخططة وبصيغ يمكن للناس قراءتها والاستشهاد بها وإعادة استخدامها. وتُوثَّق جلسات المجلس والقرارات الصادرة عنها وتُتابَع حتى لا تتلاشى الالتزامات بعد انتهاء الاجتماع.",
    ownerUnitCode: "PR",
  },
];

/* ------------------------------------------------------------------ */
/* 7. Results chain: outputs                                           */
/* ------------------------------------------------------------------ */

export const OUTPUTS: OutputSeed[] = [
  {
    code: "G1.IO1.OP1",
    intermediateCode: "G1.IO1",
    titleEn: "Updated results based planning manual and templates",
    titleAr: "دليل التخطيط القائم على النتائج المحدّث ونماذجه",
    descriptionEn:
      "A revised national manual covering the full results chain from strategic goals to activities, issued in both languages with ready to use templates for strategy documents, indicator cards, implementation plans and risk registers.",
    descriptionAr:
      "دليل وطني منقّح يغطي سلسلة النتائج كاملة من الأهداف الاستراتيجية إلى الأنشطة، يصدر باللغتين مصحوباً بنماذج جاهزة للاستخدام لوثائق الاستراتيجيات وبطاقات المؤشرات والخطط التنفيذية وسجلات المخاطر.",
    ownerUnitCode: "PQI",
  },
  {
    code: "G1.IO1.OP2",
    intermediateCode: "G1.IO1",
    titleEn: "Planning capability programme for entity planning teams",
    titleAr: "برنامج بناء القدرات التخطيطية لفرق التخطيط في الجهات",
    descriptionEn:
      "A certified training track of workshops, applied case exercises and a practitioner handbook, delivered to the planning teams of government entities and closed with an assessed certificate of competence.",
    descriptionAr:
      "مسار تدريبي معتمد يضم ورش عمل وتمارين على حالات تطبيقية ودليلاً للممارسين، يُقدَّم لفرق التخطيط في الجهات الحكومية ويُختتم بشهادة كفاءة قائمة على تقييم.",
    ownerUnitCode: "SDT",
  },
  {
    code: "G1.IO1.OP3",
    intermediateCode: "G1.IO1",
    titleEn: "Quality assured reviews of sector and entity strategies",
    titleAr: "مراجعات مضمونة الجودة لاستراتيجيات القطاعات والجهات",
    descriptionEn:
      "Written technical review reports issued for each sector and entity strategy before adoption, scoring the document against the published checklist and listing the amendments required.",
    descriptionAr:
      "تقارير مراجعة فنية مكتوبة تصدر لكل استراتيجية قطاعية ومؤسسية قبل اعتمادها، تقيّم الوثيقة وفق قائمة التحقق المعلنة وتحصر التعديلات المطلوبة.",
    ownerUnitCode: "EDP",
  },
  {
    code: "G1.IO2.OP1",
    intermediateCode: "G1.IO2",
    titleEn: "NDS3 monitoring framework and reporting cycle",
    titleAr: "إطار متابعة استراتيجية التنمية الوطنية الثالثة ودورة رفع التقارير",
    descriptionEn:
      "A published monitoring framework with the indicator set, evidence requirements, submission calendar and validation rules that every entity follows when reporting on NDS3 initiatives.",
    descriptionAr:
      "إطار متابعة معلن يتضمن مجموعة المؤشرات ومتطلبات الأدلة وروزنامة الرفع وقواعد التحقق التي تلتزم بها كل جهة عند رفع تقاريرها عن مبادرات الاستراتيجية.",
    ownerUnitCode: "MIF",
  },
  {
    code: "G1.IO2.OP2",
    intermediateCode: "G1.IO2",
    titleEn: "Implementation support packages for lagging entities",
    titleAr: "حزم دعم التنفيذ للجهات المتعثرة",
    descriptionEn:
      "A tailored support package per entity containing a diagnosis of the delivery bottleneck, an agreed recovery plan with dates, and on site assistance from the implementation support teams.",
    descriptionAr:
      "حزمة دعم مصممة لكل جهة تتضمن تشخيصاً لعنق الزجاجة في التنفيذ، وخطة تعافٍ متفقاً عليها بمواعيد محددة، ومساندة ميدانية من فرق دعم التنفيذ.",
    ownerUnitCode: "SIE",
  },
  {
    code: "G1.IO2.OP3",
    intermediateCode: "G1.IO2",
    titleEn: "Integrated delivery dashboard for leadership",
    titleAr: "لوحة متابعة تنفيذية متكاملة للقيادة",
    descriptionEn:
      "One dashboard that brings NDS3 outcomes, targets, initiatives and their indicators into a single current view, with drill down to the entity and the evidence behind each status.",
    descriptionAr:
      "لوحة واحدة تجمع نتائج استراتيجية التنمية الوطنية الثالثة ومستهدفاتها ومبادراتها ومؤشراتها في عرض واحد محدّث، مع إمكانية التعمق حتى مستوى الجهة والأدلة التي تسند كل حالة.",
    ownerUnitCode: "MIF",
  },
  {
    code: "G1.IO3.OP1",
    intermediateCode: "G1.IO3",
    titleEn: "Policy simulation models for priority sectors",
    titleAr: "نماذج محاكاة السياسات للقطاعات ذات الأولوية",
    descriptionEn:
      "Documented and validated simulation models for the macroeconomy, population, labour market, energy and water, each with a user interface that lets analysts run policy options and compare results.",
    descriptionAr:
      "نماذج محاكاة موثقة ومُتحقق من صحتها للاقتصاد الكلي والسكان وسوق العمل والطاقة والمياه، لكل منها واجهة استخدام تتيح للمحللين تشغيل خيارات السياسات ومقارنة نتائجها.",
    ownerUnitCode: "SPS",
  },
  {
    code: "G1.IO3.OP2",
    intermediateCode: "G1.IO3",
    titleEn: "Policy lab evaluations of proposed interventions",
    titleAr: "تقييمات مختبر السياسات للتدخلات المقترحة",
    descriptionEn:
      "Evaluation reports on proposed government interventions, each stating the design of the test, the measured effect and a clear recommendation to adopt, amend or drop the intervention.",
    descriptionAr:
      "تقارير تقييم للتدخلات الحكومية المقترحة، يبيّن كل منها تصميم الاختبار والأثر المقاس وتوصية واضحة باعتماد التدخل أو تعديله أو صرف النظر عنه.",
    ownerUnitCode: "PL",
  },
  {
    code: "G2.IO1.OP1",
    intermediateCode: "G2.IO1",
    titleEn: "National statistical quality assurance framework",
    titleAr: "الإطار الوطني لضمان جودة الإحصاءات",
    descriptionEn:
      "A published framework of quality dimensions, compliance criteria and self assessment tools, applied to every statistical product and accompanied by a quality report per release.",
    descriptionAr:
      "إطار معلن يحدد أبعاد الجودة ومعايير الالتزام وأدوات التقييم الذاتي، يُطبَّق على كل منتج إحصائي ويرافقه تقرير جودة مع كل إصدار.",
    ownerUnitCode: "SQ",
  },
  {
    code: "G2.IO1.OP2",
    intermediateCode: "G2.IO1",
    titleEn: "Modernised statistical production systems",
    titleAr: "أنظمة إنتاج إحصائي محدّثة",
    descriptionEn:
      "A replacement production platform covering collection, editing, imputation, estimation and dissemination, migrated domain by domain with automated validation replacing manual checks.",
    descriptionAr:
      "منصة إنتاج بديلة تغطي الجمع والتدقيق والتقدير للقيم الناقصة والاستدلال والنشر، تُرحَّل إليها المجالات الإحصائية واحداً تلو الآخر مع إحلال التحقق الآلي محل الفحص اليدوي.",
    ownerUnitCode: "SSD",
  },
  {
    code: "G2.IO1.OP3",
    intermediateCode: "G2.IO1",
    titleEn: "Accredited statistical metadata and classifications",
    titleAr: "بيانات وصفية وتصنيفات إحصائية معتمدة",
    descriptionEn:
      "A maintained national set of statistical classifications, concepts, variables and code lists, aligned to international standards and published as the reference every producer must use.",
    descriptionAr:
      "مجموعة وطنية متعهدة بالتحديث من التصنيفات والمفاهيم والمتغيرات وقوائم الترميز الإحصائية، متوائمة مع المعايير الدولية ومنشورة بوصفها المرجع الملزم لكل منتج للبيانات.",
    ownerUnitCode: "SOA",
  },
  {
    code: "G2.IO2.OP1",
    intermediateCode: "G2.IO2",
    titleEn: "National data governance and data sharing agreements",
    titleAr: "حوكمة البيانات الوطنية واتفاقيات تبادل البيانات",
    descriptionEn:
      "A governance model with defined custodianship, access tiers and protection rules, together with signed sharing agreements covering the priority administrative data sources.",
    descriptionAr:
      "نموذج حوكمة يحدد الجهات الحافظة ومستويات الوصول وقواعد الحماية، مصحوباً باتفاقيات موقّعة لتبادل البيانات تغطي مصادر البيانات الإدارية ذات الأولوية.",
    ownerUnitCode: "NDA",
  },
  {
    code: "G2.IO2.OP2",
    intermediateCode: "G2.IO2",
    titleEn: "Unified national data catalogue",
    titleAr: "الدليل الوطني الموحد للبيانات",
    descriptionEn:
      "A searchable catalogue describing national datasets, their custodians, coverage, update frequency and access conditions, kept current through automated harvesting from source systems.",
    descriptionAr:
      "دليل قابل للبحث يصف مجموعات البيانات الوطنية وجهاتها الحافظة وتغطيتها ودورية تحديثها وشروط الوصول إليها، ويُبقى محدّثاً عبر حصاد آلي من الأنظمة المصدرية.",
    ownerUnitCode: "NDA",
  },
  {
    code: "G2.IO3.OP1",
    intermediateCode: "G2.IO3",
    titleEn: "Redesigned open data and dissemination services",
    titleAr: "خدمات نشر وبيانات مفتوحة بتصميم جديد",
    descriptionEn:
      "A rebuilt statistics portal with data explorer, bulk download, an open application programming interface and bilingual indicator pages that show definitions and revision history next to every figure.",
    descriptionAr:
      "بوابة إحصائية معاد بناؤها تتضمن مستكشف بيانات وتحميلاً بالجملة وواجهة برمجة تطبيقات مفتوحة وصفحات مؤشرات ثنائية اللغة تعرض التعريفات وسجل المراجعات إلى جانب كل رقم.",
    ownerUnitCode: "SSD",
  },
  {
    code: "G2.IO3.OP2",
    intermediateCode: "G2.IO3",
    titleEn: "Statistical literacy and user support programme",
    titleAr: "برنامج الثقافة الإحصائية ودعم المستخدمين",
    descriptionEn:
      "A programme of training sessions, explanatory guides and a responsive user help desk for journalists, researchers, entity analysts and the interested public.",
    descriptionAr:
      "برنامج يضم جلسات تدريبية وأدلة تفسيرية ومكتب دعم سريع الاستجابة للمستخدمين من الصحفيين والباحثين ومحللي الجهات والجمهور المهتم.",
    ownerUnitCode: "SDT",
  },
  {
    code: "G2.IO3.OP3",
    intermediateCode: "G2.IO3",
    titleEn: "Faster release calendar with a published revisions policy",
    titleAr: "روزنامة نشر أسرع مع سياسة معلنة للمراجعات",
    descriptionEn:
      "An advance release calendar with shortened publication lags for the main economic and social statistics, issued alongside a written revisions policy that states when and why a figure may change.",
    descriptionAr:
      "روزنامة نشر مسبقة بفترات تأخر مختصرة لأبرز الإحصاءات الاقتصادية والاجتماعية، تصدر مصحوبة بسياسة مكتوبة للمراجعات تبيّن متى يتغير الرقم ولماذا.",
    ownerUnitCode: "SOA",
  },
  {
    code: "G3.IO1.OP1",
    intermediateCode: "G3.IO1",
    titleEn: "National foresight scanning system",
    titleAr: "منظومة المسح الاستشرافي الوطني",
    descriptionEn:
      "A working scanning platform and signal library that collects, classifies and rates signals of change from national and international sources, with a documented method for promoting a signal to a strategic issue.",
    descriptionAr:
      "منصة مسح عاملة ومكتبة إشارات تجمع إشارات التغيير من مصادر وطنية ودولية وتصنفها وتقيّمها، مع منهجية موثقة لترقية الإشارة إلى قضية استراتيجية.",
    ownerUnitCode: "SF",
  },
  {
    code: "G3.IO1.OP2",
    intermediateCode: "G3.IO1",
    titleEn: "Quarterly strategic risk briefings for leadership",
    titleAr: "إحاطات ربع سنوية بالمخاطر الاستراتيجية للقيادة",
    descriptionEn:
      "A quarterly briefing pack for senior leadership setting out the strategic risk picture, what has changed since the last quarter, and the response options with their implications.",
    descriptionAr:
      "حزمة إحاطة ربع سنوية للقيادة العليا تعرض صورة المخاطر الاستراتيجية، وما استجد منذ الربع السابق، وخيارات الاستجابة وتبعات كل منها.",
    ownerUnitCode: "SF",
  },
  {
    code: "G3.IO2.OP1",
    intermediateCode: "G3.IO2",
    titleEn: "Scenario sets for Qatar National Vision 2030 and beyond",
    titleAr: "حزم سيناريوهات لرؤية قطر الوطنية 2030 وما بعدها",
    descriptionEn:
      "Published scenario sets covering the economy, population, environment and society to 2040, each with implications for national priorities and a set of early warning indicators.",
    descriptionAr:
      "حزم سيناريوهات منشورة تغطي الاقتصاد والسكان والبيئة والمجتمع حتى عام 2040، يتضمن كل منها انعكاساته على الأولويات الوطنية ومجموعة من مؤشرات الإنذار المبكر.",
    ownerUnitCode: "NV",
  },
  {
    code: "G3.IO2.OP2",
    intermediateCode: "G3.IO2",
    titleEn: "Behavioural insight trials for national priorities",
    titleAr: "تجارب الرؤى السلوكية للأولويات الوطنية",
    descriptionEn:
      "Completed behavioural trials on priority national themes such as energy and water use, road safety and survey response, each reported with its design, its measured effect and a scale up recommendation.",
    descriptionAr:
      "تجارب سلوكية منجزة في موضوعات وطنية ذات أولوية مثل استهلاك الطاقة والمياه والسلامة المرورية والاستجابة للمسوح، يُرفع عن كل منها تقرير يبيّن تصميمها وأثرها المقاس وتوصية بشأن توسيع نطاقها.",
    ownerUnitCode: "BSN",
  },
  {
    code: "G3.IO2.OP3",
    intermediateCode: "G3.IO2",
    titleEn: "Foresight capability network across government entities",
    titleAr: "شبكة القدرات الاستشرافية في الجهات الحكومية",
    descriptionEn:
      "A trained network of foresight practitioners in government entities, supported by a shared toolkit, a community of practice and joint scanning exercises each year.",
    descriptionAr:
      "شبكة مدرَّبة من ممارسي الاستشراف في الجهات الحكومية، مسنودة بحقيبة أدوات مشتركة ومجتمع ممارسة وتمارين مسح مشتركة تُنفَّذ سنوياً.",
    ownerUnitCode: "SF",
  },
  {
    code: "G4.IO1.OP1",
    intermediateCode: "G4.IO1",
    titleEn: "Institutional excellence and service quality system",
    titleAr: "نظام التميز المؤسسي وجودة الخدمات",
    descriptionEn:
      "A documented process architecture with service standards, a customer satisfaction measurement cycle and an internal excellence assessment applied to every sector of the Council.",
    descriptionAr:
      "بنية إجراءات موثقة تتضمن معايير للخدمة ودورة لقياس رضا المستفيدين وتقييماً داخلياً للتميز يُطبَّق على قطاعات المجلس كافة.",
    ownerUnitCode: "PQI",
  },
  {
    code: "G4.IO1.OP2",
    intermediateCode: "G4.IO1",
    titleEn: "Knowledge management and continuity programme",
    titleAr: "برنامج إدارة المعرفة واستمرارية الخبرة",
    descriptionEn:
      "A knowledge base of documented methods, lessons learned and handover files, with a named knowledge owner for every critical product and a structured handover required before any departure.",
    descriptionAr:
      "قاعدة معرفية تضم المنهجيات الموثقة والدروس المستفادة وملفات التسليم، مع مالك معرفة مسمّى لكل منتج حرج وتسليم منظم يُشترط قبل مغادرة أي موظف.",
    ownerUnitCode: "HR",
  },
  {
    code: "G4.IO2.OP1",
    intermediateCode: "G4.IO2",
    titleEn: "Unified digital workplace and process automation",
    titleAr: "بيئة عمل رقمية موحدة وأتمتة الإجراءات",
    descriptionEn:
      "An integrated digital workplace carrying correspondence, approvals, documents and tasks, with the Council's core administrative processes automated end to end.",
    descriptionAr:
      "بيئة عمل رقمية متكاملة تحمل المراسلات والاعتمادات والوثائق والمهام، مع أتمتة الإجراءات الإدارية الجوهرية في المجلس من طرف إلى طرف.",
    ownerUnitCode: "IS",
  },
  {
    code: "G4.IO2.OP2",
    intermediateCode: "G4.IO2",
    titleEn: "Information security and business continuity uplift",
    titleAr: "الارتقاء بأمن المعلومات واستمرارية الأعمال",
    descriptionEn:
      "An upgraded security posture covering access control, microdata segregation, monitoring and incident response, together with tested continuity and recovery arrangements for critical systems.",
    descriptionAr:
      "وضع أمني مطوّر يغطي ضبط الصلاحيات وعزل البيانات الجزئية والرصد والاستجابة للحوادث، مع ترتيبات مُختبرة لاستمرارية الأعمال والتعافي للأنظمة الحرجة.",
    ownerUnitCode: "IFS",
  },
  {
    code: "G4.IO2.OP3",
    intermediateCode: "G4.IO2",
    titleEn: "Data driven internal performance reporting",
    titleAr: "تقارير الأداء الداخلي المبنية على البيانات",
    descriptionEn:
      "An internal performance reporting service generated automatically from source systems, giving each sector and department a current view of its indicators, projects and service levels.",
    descriptionAr:
      "خدمة لتقارير الأداء الداخلي تُولَّد آلياً من الأنظمة المصدرية، وتمنح كل قطاع وإدارة عرضاً محدّثاً لمؤشراته ومشاريعه ومستويات خدمته.",
    ownerUnitCode: "TO",
  },
  {
    code: "G5.IO1.OP1",
    intermediateCode: "G5.IO1",
    titleEn: "Structured partnership programme with entities and academia",
    titleAr: "برنامج شراكات منظم مع الجهات والأوساط الأكاديمية",
    descriptionEn:
      "A portfolio of signed partnership agreements with government entities, universities and research centres, each with an annual work plan, joint products and a named owner on both sides.",
    descriptionAr:
      "محفظة من اتفاقيات الشراكة الموقّعة مع الجهات الحكومية والجامعات ومراكز البحوث، لكل منها خطة عمل سنوية ومنتجات مشتركة وجهة مسؤولة مسماة لدى الطرفين.",
    ownerUnitCode: "IIC",
  },
  {
    code: "G5.IO1.OP2",
    intermediateCode: "G5.IO1",
    titleEn: "International cooperation and global indicator engagement",
    titleAr: "التعاون الدولي والمشاركة في المؤشرات العالمية",
    descriptionEn:
      "A managed programme of international submissions, technical cooperation and representation, with a calendar of every global index and reporting obligation and the national data behind each one.",
    descriptionAr:
      "برنامج مُدار للرفع الدولي والتعاون الفني والتمثيل، يتضمن روزنامة لكل مؤشر عالمي والتزام إبلاغي مع البيانات الوطنية التي يستند إليها كل منها.",
    ownerUnitCode: "IIC",
  },
  {
    code: "G5.IO2.OP1",
    intermediateCode: "G5.IO2",
    titleEn: "Integrated communication and publication plan",
    titleAr: "خطة تواصل ونشر متكاملة",
    descriptionEn:
      "An annual bilingual communication and publication plan covering releases, national progress reporting, digital channels and media engagement, with plain language summaries and chart packs for major products.",
    descriptionAr:
      "خطة سنوية للتواصل والنشر باللغتين تغطي الإصدارات والتقارير الوطنية عن التقدم والقنوات الرقمية والتفاعل الإعلامي، مع ملخصات بلغة مبسطة وحزم رسوم بيانية للمنتجات الرئيسة.",
    ownerUnitCode: "PR",
  },
  {
    code: "G5.IO2.OP2",
    intermediateCode: "G5.IO2",
    titleEn: "Council sessions and decision follow up service",
    titleAr: "خدمة جلسات المجلس ومتابعة القرارات",
    descriptionEn:
      "A managed service preparing Council session agendas and papers, recording decisions, and tracking each decision through to closure with the responsible unit and a due date.",
    descriptionAr:
      "خدمة مُدارة تتولى إعداد جداول أعمال جلسات المجلس وأوراقها، وتوثيق القرارات، وتتبع كل قرار حتى إغلاقه مع تحديد الوحدة المسؤولة وتاريخ الاستحقاق.",
    ownerUnitCode: "CSA",
  },
];
