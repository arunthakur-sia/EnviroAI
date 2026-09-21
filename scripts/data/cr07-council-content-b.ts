// CR07 2.6: illustrative content module B for the Council Strategy, the projects,
// activities and performance indicators of the NPC Institutional Strategy 2025 to 2030.
// Module A carries the strategy header, the goals, the intermediate outcomes and the
// outputs; this module attaches 45 projects to the 30 output codes and 80 indicators
// to goals, intermediate outcomes, outputs and projects.
//
// All content here is ILLUSTRATIVE seed material written for the prototype. Names,
// budgets, baselines and targets are plausible but invented, and none of them should
// be read as an official figure of the National Planning Council.

import type { ProjectSeed, IndicatorSeed } from "./cr07-council-types";

export const PROJECTS: ProjectSeed[] = [
  /* ---------- G1.IO1.OP1 results based planning manual and templates ---------- */
  {
    code: "CP-01",
    outputCode: "G1.IO1.OP1",
    titleEn: "Third edition of the national results based planning manual",
    titleAr: "الإصدار الثالث من الدليل الوطني للتخطيط القائم على النتائج",
    descriptionEn:
      "Rewrites the national planning manual around one results chain of goals, intermediate outcomes, outputs and projects, replacing the four legacy templates entities still use. The edition was issued to all government entities after clearance by Council Affairs.",
    descriptionAr:
      "يعيد صياغة الدليل الوطني للتخطيط حول سلسلة نتائج واحدة تضم الأهداف والنتائج الوسيطة والمخرجات والمشاريع، بما يحل محل النماذج الأربعة القديمة التي ما زالت الجهات تستخدمها. وقد صدر الإصدار إلى جميع الجهات الحكومية بعد اعتماده من قطاع شؤون المجلس.",
    ownerUnitCode: "NPD",
    status: "completed",
    priorityImpact: 5,
    priorityFeasibility: 4,
    budgetQar: 850000,
    inputsEn:
      "Consumes the 2019 manual, international results based management guidance, and written review comments from twenty two government entities.",
    inputsAr:
      "يستهلك دليل عام 2019 والأدلة الدولية للإدارة القائمة على النتائج وملاحظات المراجعة المكتوبة الواردة من اثنتين وعشرين جهة حكومية.",
    people: 7,
    systemsEn: ["Strategy Management System", "Council Document Repository"],
    systemsAr: ["نظام إدارة الاستراتيجية", "مستودع وثائق المجلس"],
    activities: [
      {
        titleEn: "Gap analysis of the 2019 manual against current international practice",
        titleAr: "تحليل الفجوة بين دليل عام 2019 والممارسات الدولية الحالية",
        status: "completed",
      },
      {
        titleEn: "Drafting and bilingual editing of the eleven new chapters",
        titleAr: "صياغة الفصول الأحد عشر الجديدة وتحريرها باللغتين",
        status: "completed",
      },
      {
        titleEn: "Consultation workshops with entity planning teams",
        titleAr: "ورش تشاورية مع فرق التخطيط في الجهات",
        status: "completed",
      },
      {
        titleEn: "Approval and circulation of the final edition",
        titleAr: "اعتماد الإصدار النهائي وتعميمه",
        status: "completed",
      },
    ],
  },
  {
    code: "CP-02",
    outputCode: "G1.IO1.OP1",
    titleEn: "Digital template library for strategies and annual plans",
    titleAr: "مكتبة النماذج الرقمية للاستراتيجيات والخطط السنوية",
    descriptionEn:
      "Turns the manual annexes into eighteen guided digital forms that validate codes, baselines and targets as an entity types them. Submissions arrive already structured, which removes most of the rework the planning department used to do by hand.",
    descriptionAr:
      "يحول ملاحق الدليل إلى ثمانية عشر نموذجا رقميا موجها تتحقق من الرموز وخطوط الأساس والمستهدفات أثناء إدخال الجهة لها. وتصل الطلبات منظمة مسبقا، وهو ما يلغي معظم أعمال إعادة المعالجة اليدوية في إدارة التخطيط.",
    ownerUnitCode: "PQI",
    status: "on_track",
    priorityImpact: 4,
    priorityFeasibility: 5,
    budgetQar: 420000,
    inputsEn:
      "Consumes the manual annexes, the entity code list, and two analyst months of form design and testing.",
    inputsAr:
      "يستهلك ملاحق الدليل وقائمة رموز الجهات وشهرين من عمل المحللين في تصميم النماذج واختبارها.",
    people: 5,
    systemsEn: ["Strategy Management System", "Government Forms Platform"],
    systemsAr: ["نظام إدارة الاستراتيجية", "منصة النماذج الحكومية"],
    activities: [
      {
        titleEn: "Mapping every manual annex to a form and a validation rule",
        titleAr: "ربط كل ملحق في الدليل بنموذج وقاعدة تحقق",
        status: "completed",
      },
      {
        titleEn: "Building and piloting the forms with six entities",
        titleAr: "بناء النماذج وتجربتها مع ست جهات",
        status: "on_track",
      },
      {
        titleEn: "Publishing the library and retiring the spreadsheet templates",
        titleAr: "نشر المكتبة وإيقاف نماذج الجداول الإلكترونية",
        status: "on_track",
      },
    ],
  },

  /* ---------- G1.IO1.OP2 planning capability programme ---------- */
  {
    code: "CP-03",
    outputCode: "G1.IO1.OP2",
    titleEn: "Certified government planner programme",
    titleAr: "برنامج المخطط الحكومي المعتمد",
    descriptionEn:
      "A four module certification covering results chains, costing, indicator design and delivery monitoring, run for entity planning teams with an external examiner. Twelve cohorts are planned to 2030 with an Arabic and English stream in each.",
    descriptionAr:
      "برنامج اعتماد من أربع وحدات يغطي سلاسل النتائج والتكلفة وتصميم المؤشرات ومتابعة التنفيذ، ينفذ لفرق التخطيط في الجهات مع ممتحن خارجي. ومن المخطط تنفيذ اثنتي عشرة دفعة حتى عام 2030 بمسارين عربي وإنجليزي في كل دفعة.",
    ownerUnitCode: "SDT",
    status: "on_track",
    priorityImpact: 5,
    priorityFeasibility: 3,
    budgetQar: 3200000,
    inputsEn:
      "Consumes trainer contracts, the accredited curriculum, examination fees and four weeks of classroom time per cohort.",
    inputsAr:
      "يستهلك عقود المدربين والمنهج المعتمد ورسوم الامتحانات وأربعة أسابيع من الوقت الصفي لكل دفعة.",
    people: 9,
    systemsEn: ["Learning Management System", "Certification Register", "Strategy Management System"],
    systemsAr: ["نظام إدارة التعلم", "سجل الاعتماد المهني", "نظام إدارة الاستراتيجية"],
    activities: [
      {
        titleEn: "Accrediting the curriculum with an international planning institute",
        titleAr: "اعتماد المنهج لدى معهد تخطيط دولي",
        status: "completed",
      },
      {
        titleEn: "Delivering the first four cohorts in Arabic and English",
        titleAr: "تنفيذ الدفعات الأربع الأولى باللغتين العربية والإنجليزية",
        status: "on_track",
      },
      {
        titleEn: "Adding a practical assignment graded on a live entity plan",
        titleAr: "إضافة مشروع تطبيقي يقيم على خطة فعلية لإحدى الجهات",
        status: "on_track",
      },
    ],
  },
  {
    code: "CP-04",
    outputCode: "G1.IO1.OP2",
    titleEn: "Community of practice for government planners",
    titleAr: "مجتمع الممارسة للمخططين الحكوميين",
    descriptionEn:
      "A standing network that meets every quarter so entity planners can bring live problems, compare indicator definitions and reuse each other's work. It runs on existing staff time and an internal collaboration space rather than a budget line.",
    descriptionAr:
      "شبكة دائمة تجتمع كل ربع سنة ليطرح فيها مخططو الجهات مشكلاتهم الفعلية ويقارنوا تعريفات المؤشرات ويفيدوا من أعمال بعضهم. ويعتمد المجتمع على وقت الموظفين الحالي ومساحة تعاون داخلية بدلا من بند مالي مستقل.",
    ownerUnitCode: "NPD",
    status: "on_track",
    priorityImpact: 2,
    priorityFeasibility: 5,
    budgetQar: 0,
    inputsEn:
      "Consumes half a day of facilitator time per quarter, meeting rooms already booked for Council events, and the shared collaboration space.",
    inputsAr:
      "يستهلك نصف يوم من وقت الميسر كل ربع سنة وقاعات اجتماعات محجوزة أصلا لفعاليات المجلس ومساحة التعاون المشتركة.",
    people: 4,
    systemsEn: ["Collaboration Workspace", "Council Document Repository"],
    systemsAr: ["مساحة العمل التشاركية", "مستودع وثائق المجلس"],
    activities: [
      {
        titleEn: "Setting the charter and the standing quarterly agenda",
        titleAr: "إقرار ميثاق المجتمع وجدول الأعمال الفصلي الدائم",
        status: "completed",
      },
      {
        titleEn: "Running the quarterly clinics and publishing the notes",
        titleAr: "تنفيذ العيادات الفصلية ونشر محاضرها",
        status: "on_track",
      },
    ],
  },

  /* ---------- G1.IO1.OP3 quality assured strategy reviews ---------- */
  {
    code: "CP-05",
    outputCode: "G1.IO1.OP3",
    titleEn: "Strategy quality review gateway",
    titleAr: "بوابة مراجعة جودة الاستراتيجيات",
    descriptionEn:
      "A single entry point where every sector and entity strategy is reviewed against a published checklist before it goes to Council for endorsement. Each review returns a scored report and a short remediation list within sixty days.",
    descriptionAr:
      "نقطة دخول واحدة تراجع فيها كل استراتيجية قطاعية أو مؤسسية وفق قائمة تحقق منشورة قبل رفعها إلى المجلس للاعتماد. وتنتهي كل مراجعة بتقرير مقيم بالدرجات وقائمة قصيرة بالمعالجات خلال ستين يوما.",
    ownerUnitCode: "PQI",
    status: "on_track",
    priorityImpact: 5,
    priorityFeasibility: 4,
    budgetQar: 1150000,
    inputsEn:
      "Consumes reviewer time from three sectors, the published review checklist, and a case tracking workflow.",
    inputsAr:
      "يستهلك وقت المراجعين من ثلاثة قطاعات وقائمة التحقق المنشورة للمراجعة ومسار عمل لتتبع الحالات.",
    people: 8,
    systemsEn: ["Strategy Management System", "Review Case Tracker"],
    systemsAr: ["نظام إدارة الاستراتيجية", "نظام تتبع حالات المراجعة"],
    activities: [
      {
        titleEn: "Publishing the review checklist and the scoring scale",
        titleAr: "نشر قائمة تحقق المراجعة وسلم التقييم",
        status: "completed",
      },
      {
        titleEn: "Training and rostering the cross sector reviewer pool",
        titleAr: "تدريب فريق المراجعين من القطاعات وجدولة مناوباتهم",
        status: "completed",
      },
      {
        titleEn: "Clearing the backlog of strategies waiting for review",
        titleAr: "تصريف الأعمال المتراكمة من الاستراتيجيات المنتظرة للمراجعة",
        status: "on_track",
      },
      {
        titleEn: "Publishing an annual summary of common review findings",
        titleAr: "نشر ملخص سنوي لأبرز ملاحظات المراجعة المتكررة",
        status: "on_track",
      },
    ],
  },
  {
    code: "CP-06",
    outputCode: "G1.IO1.OP3",
    titleEn: "Alignment audit of sector strategies against NDS3",
    titleAr: "تدقيق مواءمة الاستراتيجيات القطاعية مع استراتيجية التنمية الوطنية الثالثة",
    descriptionEn:
      "Traces every sector strategy objective back to an NDS3 outcome and flags the objectives that sit outside the national framework or duplicate another sector. Progress is slow because four sectors have not released their current strategy documents.",
    descriptionAr:
      "يتتبع كل هدف في الاستراتيجيات القطاعية وصولا إلى إحدى نتائج استراتيجية التنمية الوطنية الثالثة، ويرصد الأهداف الواقعة خارج الإطار الوطني أو المكررة مع قطاع آخر. ويسير العمل ببطء لأن أربعة قطاعات لم تسلم بعد وثائق استراتيجياتها السارية.",
    ownerUnitCode: "NPD",
    status: "at_risk",
    priorityImpact: 4,
    priorityFeasibility: 2,
    budgetQar: 980000,
    inputsEn:
      "Consumes sector strategy documents, the NDS3 outcome tree, and analyst time to code objectives against it.",
    inputsAr:
      "يستهلك وثائق الاستراتيجيات القطاعية وشجرة نتائج استراتيجية التنمية الوطنية الثالثة ووقت المحللين لترميز الأهداف وفقها.",
    people: 6,
    systemsEn: ["Strategy Management System", "Alignment Matrix Workbook"],
    systemsAr: ["نظام إدارة الاستراتيجية", "مصنف مصفوفة المواءمة"],
    activities: [
      {
        titleEn: "Collecting the current strategy document from every sector",
        titleAr: "جمع وثيقة الاستراتيجية السارية من كل قطاع",
        status: "at_risk",
      },
      {
        titleEn: "Coding objectives against the NDS3 outcome tree",
        titleAr: "ترميز الأهداف وفق شجرة نتائج استراتيجية التنمية الوطنية الثالثة",
        status: "on_track",
      },
      {
        titleEn: "Reporting gaps and overlaps to the sector planning committees",
        titleAr: "رفع الفجوات والتداخلات إلى لجان التخطيط القطاعية",
        status: "at_risk",
      },
    ],
  },

  /* ---------- G1.IO2.OP1 NDS3 monitoring framework ---------- */
  {
    code: "CP-07",
    outputCode: "G1.IO2.OP1",
    titleEn: "Refresh of the NDS3 monitoring framework",
    titleAr: "تحديث إطار متابعة استراتيجية التنمية الوطنية الثالثة",
    descriptionEn:
      "Rebuilt the monitoring framework so every NDS3 outcome carries a named owning entity, an agreed indicator set and a fixed reporting cycle. The refreshed framework was signed off by all implementing entities before the 2025 reporting year opened.",
    descriptionAr:
      "أعاد بناء إطار المتابعة بحيث تحمل كل نتيجة في استراتيجية التنمية الوطنية الثالثة جهة مالكة محددة ومجموعة مؤشرات متفقا عليها ودورة رفع تقارير ثابتة. وقد اعتمدت جميع الجهات المنفذة الإطار المحدث قبل بدء سنة التقارير 2025.",
    ownerUnitCode: "MIF",
    status: "completed",
    priorityImpact: 5,
    priorityFeasibility: 4,
    budgetQar: 1650000,
    inputsEn:
      "Consumes the NDS3 outcome tree, entity indicator submissions, and a series of bilateral sign off sessions with implementing entities.",
    inputsAr:
      "يستهلك شجرة نتائج استراتيجية التنمية الوطنية الثالثة وبيانات المؤشرات المقدمة من الجهات وسلسلة جلسات اعتماد ثنائية مع الجهات المنفذة.",
    people: 10,
    systemsEn: ["NDS3 Monitoring System", "Strategy Management System"],
    systemsAr: ["نظام متابعة استراتيجية التنمية الوطنية الثالثة", "نظام إدارة الاستراتيجية"],
    activities: [
      {
        titleEn: "Assigning an owning entity to each NDS3 outcome",
        titleAr: "إسناد جهة مالكة لكل نتيجة من نتائج الاستراتيجية",
        status: "completed",
      },
      {
        titleEn: "Agreeing indicator definitions and reporting dates with entities",
        titleAr: "الاتفاق مع الجهات على تعريفات المؤشرات ومواعيد رفع التقارير",
        status: "completed",
      },
      {
        titleEn: "Loading the framework into the monitoring system",
        titleAr: "تحميل الإطار في نظام المتابعة",
        status: "completed",
      },
    ],
  },
  {
    code: "CP-08",
    outputCode: "G1.IO2.OP1",
    titleEn: "Production line for the annual NDS3 progress report",
    titleAr: "خط إنتاج التقرير السنوي لتقدم استراتيجية التنمية الوطنية الثالثة",
    descriptionEn:
      "Converts the annual progress report from a manual document assembly into a scheduled production line with fixed data cut off, drafting, verification and translation steps. The 2025 edition was produced five weeks earlier than the previous one.",
    descriptionAr:
      "يحول التقرير السنوي للتقدم من عملية تجميع يدوية إلى خط إنتاج مجدول بخطوات ثابتة لإقفال البيانات والصياغة والتحقق والترجمة. وقد أنجز إصدار عام 2025 قبل موعد الإصدار السابق بخمسة أسابيع.",
    ownerUnitCode: "FAI",
    status: "on_track",
    priorityImpact: 4,
    priorityFeasibility: 4,
    budgetQar: 700000,
    inputsEn:
      "Consumes entity monitoring returns, verified statistics from the National Statistics Center, and editorial and translation capacity.",
    inputsAr:
      "يستهلك بيانات المتابعة الواردة من الجهات والإحصاءات المدققة من مركز الإحصاء الوطني وطاقة التحرير والترجمة.",
    people: 6,
    systemsEn: ["NDS3 Monitoring System", "Publication Workflow"],
    systemsAr: ["نظام متابعة استراتيجية التنمية الوطنية الثالثة", "مسار عمل الإصدارات"],
    activities: [
      {
        titleEn: "Fixing the production calendar and the data cut off date",
        titleAr: "تثبيت تقويم الإنتاج وتاريخ إقفال البيانات",
        status: "completed",
      },
      {
        titleEn: "Automating the standard charts and outcome summary pages",
        titleAr: "أتمتة الرسوم البيانية القياسية وصفحات ملخص النتائج",
        status: "on_track",
      },
      {
        titleEn: "Running a parallel Arabic drafting track instead of late translation",
        titleAr: "تشغيل مسار صياغة عربي متواز بدلا من الترجمة المتأخرة",
        status: "on_track",
      },
    ],
  },

  /* ---------- G1.IO2.OP2 implementation support packages ---------- */
  {
    code: "CP-09",
    outputCode: "G1.IO2.OP2",
    titleEn: "Delivery clinics for lagging national initiatives",
    titleAr: "عيادات التنفيذ للمبادرات الوطنية المتعثرة",
    descriptionEn:
      "Brings the owner of a stalled NDS3 initiative into a structured working session that diagnoses the blockage and leaves with a dated recovery plan. Take up is uneven because some entities treat the clinic as an audit rather than a support service.",
    descriptionAr:
      "يجمع مالك المبادرة المتعثرة في استراتيجية التنمية الوطنية الثالثة في جلسة عمل منظمة تشخص سبب التعثر وتخرج بخطة تعاف محددة التواريخ. والإقبال متفاوت لأن بعض الجهات تتعامل مع العيادة بوصفها تدقيقا لا خدمة دعم.",
    ownerUnitCode: "SIE",
    status: "at_risk",
    priorityImpact: 5,
    priorityFeasibility: 2,
    budgetQar: 1400000,
    inputsEn:
      "Consumes delivery specialist time, monitoring data on the stalled initiative, and facilitation materials for the clinic.",
    inputsAr:
      "يستهلك وقت أخصائيي التنفيذ وبيانات المتابعة الخاصة بالمبادرة المتعثرة ومواد تيسير الجلسة.",
    people: 7,
    systemsEn: ["NDS3 Monitoring System", "Delivery Case File"],
    systemsAr: ["نظام متابعة استراتيجية التنمية الوطنية الثالثة", "ملف حالة التنفيذ"],
    activities: [
      {
        titleEn: "Defining the clinic method and the recovery plan template",
        titleAr: "تحديد منهجية العيادة ونموذج خطة التعافي",
        status: "completed",
      },
      {
        titleEn: "Running clinics with the ten most delayed initiatives",
        titleAr: "تنفيذ العيادات مع أكثر عشر مبادرات تأخرا",
        status: "at_risk",
      },
      {
        titleEn: "Tracking whether recovery plans actually change the delivery curve",
        titleAr: "تتبع أثر خطط التعافي الفعلي على منحنى التنفيذ",
        status: "at_risk",
      },
    ],
  },
  {
    code: "CP-10",
    outputCode: "G1.IO2.OP2",
    titleEn: "Implementation support toolkit for human and social programmes",
    titleAr: "حقيبة دعم التنفيذ لبرامج التنمية البشرية والاجتماعية",
    descriptionEn:
      "Packages the practical instruments that health, education and social entities keep asking for, including beneficiary tracking templates, joint delivery agreements and a short guide to sequencing multi entity programmes.",
    descriptionAr:
      "يجمع الأدوات العملية التي تطلبها جهات الصحة والتعليم والشؤون الاجتماعية باستمرار، ومنها نماذج تتبع المستفيدين واتفاقيات التنفيذ المشترك ودليل موجز لترتيب تسلسل البرامج متعددة الجهات.",
    ownerUnitCode: "SIH",
    status: "on_track",
    priorityImpact: 4,
    priorityFeasibility: 3,
    budgetQar: 620000,
    inputsEn:
      "Consumes lessons captured from twelve delivery reviews, entity feedback sessions, and bilingual instructional design time.",
    inputsAr:
      "يستهلك الدروس المستخلصة من اثنتي عشرة مراجعة تنفيذ وجلسات ملاحظات الجهات ووقت التصميم التعليمي باللغتين.",
    people: 5,
    systemsEn: ["Knowledge Portal", "NDS3 Monitoring System"],
    systemsAr: ["بوابة المعرفة", "نظام متابعة استراتيجية التنمية الوطنية الثالثة"],
    activities: [
      {
        titleEn: "Collecting the instruments entities request most often",
        titleAr: "حصر الأدوات الأكثر طلبا من الجهات",
        status: "completed",
      },
      {
        titleEn: "Piloting the toolkit with three social sector programmes",
        titleAr: "تجربة الحقيبة مع ثلاثة برامج في القطاع الاجتماعي",
        status: "on_track",
      },
      {
        titleEn: "Publishing the toolkit on the knowledge portal",
        titleAr: "نشر الحقيبة على بوابة المعرفة",
        status: "on_track",
      },
    ],
  },

  /* ---------- G1.IO2.OP3 integrated delivery dashboard ---------- */
  {
    code: "CP-11",
    outputCode: "G1.IO2.OP3",
    titleEn: "Integrated national delivery dashboard",
    titleAr: "لوحة المتابعة الوطنية المتكاملة للتنفيذ",
    descriptionEn:
      "One leadership view that joins NDS3 outcome indicators, entity initiative progress and the Council's own performance in a single refreshed picture. Feeds come directly from source systems so the view no longer depends on emailed spreadsheets.",
    descriptionAr:
      "عرض قيادي واحد يجمع مؤشرات نتائج استراتيجية التنمية الوطنية الثالثة وتقدم مبادرات الجهات وأداء المجلس نفسه في صورة واحدة محدثة. وتأتي التغذية مباشرة من نظم المصدر بحيث لم يعد العرض معتمدا على جداول ترسل بالبريد.",
    ownerUnitCode: "TO",
    status: "on_track",
    priorityImpact: 5,
    priorityFeasibility: 3,
    budgetQar: 5800000,
    inputsEn:
      "Consumes indicator feeds from twelve source systems, a data integration platform licence, and design time for the leadership views.",
    inputsAr:
      "يستهلك تدفقات المؤشرات من اثني عشر نظام مصدر ورخصة منصة تكامل البيانات ووقت التصميم لواجهات القيادة.",
    people: 12,
    systemsEn: ["Delivery Dashboard", "Data Integration Platform", "NDS3 Monitoring System"],
    systemsAr: ["لوحة متابعة التنفيذ", "منصة تكامل البيانات", "نظام متابعة استراتيجية التنمية الوطنية الثالثة"],
    activities: [
      {
        titleEn: "Agreeing the leadership question set the dashboard must answer",
        titleAr: "الاتفاق على أسئلة القيادة التي يجب أن تجيب عنها اللوحة",
        status: "completed",
      },
      {
        titleEn: "Building automated feeds from the twelve source systems",
        titleAr: "بناء تغذية آلية من نظم المصدر الاثني عشر",
        status: "on_track",
      },
      {
        titleEn: "Adding drill down from outcome to initiative to project",
        titleAr: "إضافة التنقل التفصيلي من النتيجة إلى المبادرة إلى المشروع",
        status: "on_track",
      },
      {
        titleEn: "Running the dashboard alongside the old report for one cycle",
        titleAr: "تشغيل اللوحة بالتوازي مع التقرير القديم لدورة واحدة",
        status: "on_track",
      },
    ],
  },
  {
    code: "CP-12",
    outputCode: "G1.IO2.OP3",
    titleEn: "Leadership briefing room and decision wall",
    titleAr: "غرفة الإحاطة القيادية وجدار القرار",
    descriptionEn:
      "Fits out a dedicated room where the Secretary General and sector heads review delivery against the dashboard and record decisions on the spot. Fit out slipped two quarters after the original space was reassigned to the statistics sector.",
    descriptionAr:
      "يجهز غرفة مخصصة يراجع فيها الأمين العام ورؤساء القطاعات التنفيذ أمام اللوحة ويسجلون القرارات في حينها. وقد تأخر التجهيز ربعين بعد إعادة تخصيص المساحة الأصلية لقطاع الإحصاء.",
    ownerUnitCode: "OSG",
    status: "delayed",
    priorityImpact: 3,
    priorityFeasibility: 3,
    budgetQar: 2300000,
    inputsEn:
      "Consumes the allocated room, display and audio visual hardware, and the dashboard views built by the delivery dashboard project.",
    inputsAr:
      "يستهلك القاعة المخصصة وأجهزة العرض والوسائط السمعية والبصرية وواجهات اللوحة التي بناها مشروع لوحة متابعة التنفيذ.",
    people: 5,
    systemsEn: ["Delivery Dashboard", "Decision Log"],
    systemsAr: ["لوحة متابعة التنفيذ", "سجل القرارات"],
    activities: [
      {
        titleEn: "Securing and preparing the replacement room",
        titleAr: "تأمين القاعة البديلة وتهيئتها",
        status: "delayed",
      },
      {
        titleEn: "Installing the display wall and the decision logging station",
        titleAr: "تركيب جدار العرض ومحطة تسجيل القرارات",
        status: "not_started",
      },
      {
        titleEn: "Piloting the monthly delivery review in the new format",
        titleAr: "تجربة المراجعة الشهرية للتنفيذ بالصيغة الجديدة",
        status: "delayed",
      },
    ],
  },
  /* ---------- G1.IO3.OP1 policy simulation models ---------- */
  {
    code: "CP-13",
    outputCode: "G1.IO3.OP1",
    titleEn: "Qatar macroeconomic policy simulation model",
    titleAr: "نموذج المحاكاة الكلية للسياسات الاقتصادية في قطر",
    descriptionEn:
      "Builds a computable general equilibrium model of the Qatari economy so fiscal, energy and diversification options can be tested before they reach Council. The technical build is demanding and depends on national accounts detail that is still being assembled.",
    descriptionAr:
      "يبني نموذج توازن عام قابلا للحساب للاقتصاد القطري لاختبار الخيارات المالية والطاقية وخيارات التنويع قبل عرضها على المجلس. والبناء الفني صعب ويعتمد على تفاصيل الحسابات القومية التي ما زال تجميعها جاريا.",
    ownerUnitCode: "SPS",
    status: "on_track",
    priorityImpact: 5,
    priorityFeasibility: 1,
    budgetQar: 7400000,
    inputsEn:
      "Consumes national accounts series, a social accounting matrix, modelling software licences and specialist econometric expertise.",
    inputsAr:
      "يستهلك سلاسل الحسابات القومية ومصفوفة المحاسبة الاجتماعية ورخص برمجيات النمذجة وخبرة اقتصادية قياسية متخصصة.",
    people: 11,
    systemsEn: ["Policy Simulation Platform", "National Accounts Database", "Statistical Computing Environment"],
    systemsAr: ["منصة محاكاة السياسات", "قاعدة بيانات الحسابات القومية", "بيئة الحوسبة الإحصائية"],
    activities: [
      {
        titleEn: "Compiling the social accounting matrix for the base year",
        titleAr: "إعداد مصفوفة المحاسبة الاجتماعية لسنة الأساس",
        status: "completed",
      },
      {
        titleEn: "Calibrating the model against historical national accounts",
        titleAr: "معايرة النموذج مقابل الحسابات القومية التاريخية",
        status: "on_track",
      },
      {
        titleEn: "Independent peer review of the model structure",
        titleAr: "مراجعة نظيرة مستقلة لبنية النموذج",
        status: "on_track",
      },
      {
        titleEn: "Training economists in the Council to run policy scenarios",
        titleAr: "تدريب اقتصاديي المجلس على تشغيل سيناريوهات السياسات",
        status: "on_track",
      },
    ],
  },
  {
    code: "CP-14",
    outputCode: "G1.IO3.OP1",
    titleEn: "Labour market and skills microsimulation model",
    titleAr: "نموذج المحاكاة الجزئية لسوق العمل والمهارات",
    descriptionEn:
      "Simulates how qualification, nationalisation and wage policies move the composition of the workforce over a ten year horizon. Progress is at risk because two administrative labour registers have not yet been linked at record level.",
    descriptionAr:
      "يحاكي أثر سياسات المؤهلات والتوطين والأجور في تركيبة القوى العاملة على مدى عشر سنوات. والتقدم معرض للخطر لأن سجلين إداريين لسوق العمل لم يربطا بعد على مستوى السجل الفردي.",
    ownerUnitCode: "SPS",
    status: "at_risk",
    priorityImpact: 4,
    priorityFeasibility: 2,
    budgetQar: 3900000,
    inputsEn:
      "Consumes labour force survey microdata, two administrative labour registers, and microsimulation modelling expertise.",
    inputsAr:
      "يستهلك البيانات الجزئية لمسح القوى العاملة وسجلين إداريين لسوق العمل وخبرة في نمذجة المحاكاة الجزئية.",
    people: 8,
    systemsEn: ["Policy Simulation Platform", "Secure Microdata Enclave"],
    systemsAr: ["منصة محاكاة السياسات", "البيئة الآمنة للبيانات الجزئية"],
    activities: [
      {
        titleEn: "Negotiating record level access to the labour registers",
        titleAr: "التفاوض على الوصول إلى سجلات سوق العمل على مستوى السجل الفردي",
        status: "at_risk",
      },
      {
        titleEn: "Building the synthetic population for the base year",
        titleAr: "بناء السكان التركيبيين لسنة الأساس",
        status: "on_track",
      },
      {
        titleEn: "Validating the model against observed workforce transitions",
        titleAr: "التحقق من النموذج مقابل التحولات المرصودة في القوى العاملة",
        status: "at_risk",
      },
    ],
  },

  /* ---------- G1.IO3.OP2 policy lab evaluations ---------- */
  {
    code: "CP-15",
    outputCode: "G1.IO3.OP2",
    titleEn: "Rapid evaluation service of the policy lab",
    titleAr: "خدمة التقييم السريع في مختبر السياسات",
    descriptionEn:
      "Gives any entity a thirty working day route to an independent evidence review of a proposed intervention, covering the theory of change, the evidence base and the likely cost. Demand has grown faster than the team expected.",
    descriptionAr:
      "يتيح لأي جهة مسارا مدته ثلاثون يوم عمل للحصول على مراجعة أدلة مستقلة لتدخل مقترح، تغطي نظرية التغيير وقاعدة الأدلة والتكلفة المرجحة. وقد نما الطلب أسرع مما توقعه الفريق.",
    ownerUnitCode: "PL",
    status: "on_track",
    priorityImpact: 4,
    priorityFeasibility: 4,
    budgetQar: 1750000,
    inputsEn:
      "Consumes the evidence library subscription, analyst time from the policy lab, and access to entity programme documents.",
    inputsAr:
      "يستهلك اشتراك مكتبة الأدلة ووقت محللي مختبر السياسات والوصول إلى وثائق برامج الجهات.",
    people: 7,
    systemsEn: ["Evidence Library", "Policy Lab Case Tracker"],
    systemsAr: ["مكتبة الأدلة", "نظام تتبع حالات مختبر السياسات"],
    activities: [
      {
        titleEn: "Publishing the service standard and the intake form",
        titleAr: "نشر معيار الخدمة ونموذج الاستقبال",
        status: "completed",
      },
      {
        titleEn: "Completing the first twenty evaluation requests",
        titleAr: "إنجاز أول عشرين طلب تقييم",
        status: "on_track",
      },
      {
        titleEn: "Tracking which recommendations entities actually adopt",
        titleAr: "تتبع التوصيات التي تتبناها الجهات فعليا",
        status: "on_track",
      },
    ],
  },
  {
    code: "CP-16",
    outputCode: "G1.IO3.OP2",
    titleEn: "Regulatory impact assessment pilot for draft policies",
    titleAr: "المشروع التجريبي لتقييم الأثر التنظيمي لمسودات السياسات",
    descriptionEn:
      "Will test a light regulatory impact assessment on fifteen draft policies before they go to the legislative track, estimating compliance cost and distributional effects. The pilot waits on a legal mandate that Legal Affairs is still drafting.",
    descriptionAr:
      "سيختبر نموذجا مبسطا لتقييم الأثر التنظيمي على خمس عشرة مسودة سياسة قبل إحالتها إلى المسار التشريعي، بتقدير كلفة الامتثال والآثار التوزيعية. وينتظر المشروع التجريبي تفويضا قانونيا ما زالت الشؤون القانونية تعده.",
    ownerUnitCode: "PL",
    status: "not_started",
    priorityImpact: 4,
    priorityFeasibility: 2,
    budgetQar: 540000,
    inputsEn:
      "Consumes draft policy texts, a legal mandate from Legal Affairs, and assessment templates adapted from international practice.",
    inputsAr:
      "يستهلك نصوص مسودات السياسات وتفويضا قانونيا من الشؤون القانونية ونماذج تقييم مقتبسة من الممارسات الدولية.",
    people: 4,
    systemsEn: ["Policy Lab Case Tracker", "Legal Drafting System"],
    systemsAr: ["نظام تتبع حالات مختبر السياسات", "نظام الصياغة القانونية"],
    activities: [
      {
        titleEn: "Securing the legal mandate for assessment before adoption",
        titleAr: "تأمين التفويض القانوني لإجراء التقييم قبل الاعتماد",
        status: "not_started",
      },
      {
        titleEn: "Adapting the assessment template to the Qatari legislative process",
        titleAr: "مواءمة نموذج التقييم مع مسار التشريع القطري",
        status: "not_started",
      },
      {
        titleEn: "Running the pilot on fifteen draft policies",
        titleAr: "تنفيذ التجربة على خمس عشرة مسودة سياسة",
        status: "not_started",
      },
    ],
  },

  /* ---------- G2.IO1.OP1 statistical quality assurance framework ---------- */
  {
    code: "CP-17",
    outputCode: "G2.IO1.OP1",
    titleEn: "National statistical quality assurance framework",
    titleAr: "الإطار الوطني لضمان جودة الإحصاءات",
    descriptionEn:
      "Sets one quality framework for every official statistic produced in Qatar, covering relevance, accuracy, timeliness, coherence and accessibility with a documented assessment method per domain. Twenty two statistical domains are in scope by 2030.",
    descriptionAr:
      "يضع إطار جودة موحدا لكل إحصاء رسمي ينتج في قطر، يغطي الملاءمة والدقة والتوقيت والاتساق وسهولة الوصول، مع منهجية تقييم موثقة لكل مجال. ويشمل النطاق اثنين وعشرين مجالا إحصائيا بحلول عام 2030.",
    ownerUnitCode: "SQ",
    status: "on_track",
    priorityImpact: 5,
    priorityFeasibility: 3,
    budgetQar: 1900000,
    inputsEn:
      "Consumes the United Nations national quality assurance framework template, domain documentation, and assessor time from the quality department.",
    inputsAr:
      "يستهلك النموذج الأممي للإطار الوطني لضمان الجودة ووثائق المجالات الإحصائية ووقت المقيمين في إدارة الجودة.",
    people: 9,
    systemsEn: ["Quality Assessment Register", "Statistical Metadata Repository"],
    systemsAr: ["سجل تقييم الجودة", "مستودع البيانات الوصفية الإحصائية"],
    activities: [
      {
        titleEn: "Adapting the international framework to the Qatari statistical system",
        titleAr: "مواءمة الإطار الدولي مع النظام الإحصائي القطري",
        status: "completed",
      },
      {
        titleEn: "Writing the assessment method for each quality dimension",
        titleAr: "إعداد منهجية التقييم لكل بعد من أبعاد الجودة",
        status: "completed",
      },
      {
        titleEn: "Assessing the first eight statistical domains",
        titleAr: "تقييم المجالات الإحصائية الثمانية الأولى",
        status: "on_track",
      },
    ],
  },
  {
    code: "CP-18",
    outputCode: "G2.IO1.OP1",
    titleEn: "Quality self assessment and peer review cycle",
    titleAr: "دورة التقييم الذاتي والمراجعة النظيرة للجودة",
    descriptionEn:
      "Established a repeating cycle in which each statistical department scores itself against the framework and is then reviewed by colleagues from another domain. The first full cycle closed with an agreed improvement plan for every department.",
    descriptionAr:
      "أرسى دورة متكررة تقيم فيها كل إدارة إحصائية نفسها وفق الإطار ثم يراجعها زملاء من مجال آخر. وقد أقفلت الدورة الكاملة الأولى بخطة تحسين متفق عليها لكل إدارة.",
    ownerUnitCode: "SQ",
    status: "completed",
    priorityImpact: 3,
    priorityFeasibility: 5,
    budgetQar: 460000,
    inputsEn:
      "Consumes the quality framework criteria, two days of departmental time per assessment, and a trained internal peer reviewer pool.",
    inputsAr:
      "يستهلك معايير إطار الجودة ويومين من وقت الإدارة لكل تقييم وفريقا داخليا مدربا من المراجعين النظراء.",
    people: 5,
    systemsEn: ["Quality Assessment Register"],
    systemsAr: ["سجل تقييم الجودة"],
    activities: [
      {
        titleEn: "Training the internal peer reviewer pool",
        titleAr: "تدريب فريق المراجعين النظراء الداخليين",
        status: "completed",
      },
      {
        titleEn: "Running self assessments in all statistical departments",
        titleAr: "تنفيذ التقييم الذاتي في جميع الإدارات الإحصائية",
        status: "completed",
      },
      {
        titleEn: "Consolidating the results into departmental improvement plans",
        titleAr: "تجميع النتائج في خطط تحسين على مستوى الإدارات",
        status: "completed",
      },
    ],
  },

  /* ---------- G2.IO1.OP2 modernised statistical production ---------- */
  {
    code: "CP-19",
    outputCode: "G2.IO1.OP2",
    titleEn: "Integrated statistical production platform",
    titleAr: "المنصة المتكاملة للإنتاج الإحصائي",
    descriptionEn:
      "Replaces a decade of separate survey and processing tools with one platform covering collection, editing, imputation, estimation and dissemination along the generic statistical business process model. It is the largest technical undertaking in the strategy.",
    descriptionAr:
      "يستبدل بعقد كامل من أدوات المسوح والمعالجة المنفصلة منصة واحدة تغطي الجمع والتدقيق والاستكمال والتقدير والنشر وفق النموذج العام لعمليات الأعمال الإحصائية. وهو أكبر عمل فني في الاستراتيجية.",
    ownerUnitCode: "SSD",
    status: "at_risk",
    priorityImpact: 5,
    priorityFeasibility: 1,
    budgetQar: 11800000,
    inputsEn:
      "Consumes the platform licence and implementation contract, legacy process documentation, and migration effort from every statistical department.",
    inputsAr:
      "يستهلك رخصة المنصة وعقد التنفيذ ووثائق العمليات القديمة وجهد الترحيل من كل إدارة إحصائية.",
    people: 14,
    systemsEn: ["Statistical Production Platform", "Statistical Metadata Repository", "Secure Microdata Enclave"],
    systemsAr: ["منصة الإنتاج الإحصائي", "مستودع البيانات الوصفية الإحصائية", "البيئة الآمنة للبيانات الجزئية"],
    activities: [
      {
        titleEn: "Documenting the current production process for each domain",
        titleAr: "توثيق عملية الإنتاج الحالية لكل مجال إحصائي",
        status: "completed",
      },
      {
        titleEn: "Migrating the price and trade statistics as the first wave",
        titleAr: "ترحيل إحصاءات الأسعار والتجارة في الموجة الأولى",
        status: "at_risk",
      },
      {
        titleEn: "Retraining statisticians on the new production environment",
        titleAr: "إعادة تدريب الإحصائيين على بيئة الإنتاج الجديدة",
        status: "on_track",
      },
      {
        titleEn: "Decommissioning the legacy processing tools per domain",
        titleAr: "إيقاف أدوات المعالجة القديمة لكل مجال",
        status: "at_risk",
      },
    ],
  },
  {
    code: "CP-20",
    outputCode: "G2.IO1.OP2",
    titleEn: "Modernisation of mobile field data collection",
    titleAr: "تحديث جمع البيانات الميدانية عبر الأجهزة المحمولة",
    descriptionEn:
      "Moves household and establishment surveys onto tablet based collection with built in edit checks, geolocation of sampling units and same day upload. Field cost per completed questionnaire has already fallen in the pilot governorates.",
    descriptionAr:
      "ينقل مسوح الأسر والمنشآت إلى الجمع عبر الأجهزة اللوحية مع قواعد تدقيق مدمجة وتحديد مواقع وحدات المعاينة والرفع في اليوم نفسه. وقد انخفضت بالفعل الكلفة الميدانية لكل استمارة مكتملة في البلديات التجريبية.",
    ownerUnitCode: "SOA",
    status: "on_track",
    priorityImpact: 4,
    priorityFeasibility: 4,
    budgetQar: 4600000,
    inputsEn:
      "Consumes tablet devices and connectivity for the field force, questionnaire authoring time, and enumerator retraining.",
    inputsAr:
      "يستهلك الأجهزة اللوحية وخدمات الاتصال للفريق الميداني ووقت إعداد الاستمارات وإعادة تدريب الباحثين الميدانيين.",
    people: 10,
    systemsEn: ["Field Data Collection System", "Statistical Production Platform"],
    systemsAr: ["نظام جمع البيانات الميدانية", "منصة الإنتاج الإحصائي"],
    activities: [
      {
        titleEn: "Authoring the digital questionnaires with embedded edit rules",
        titleAr: "إعداد الاستمارات الرقمية بقواعد تدقيق مدمجة",
        status: "completed",
      },
      {
        titleEn: "Equipping and retraining the field enumerator force",
        titleAr: "تجهيز الباحثين الميدانيين وإعادة تدريبهم",
        status: "on_track",
      },
      {
        titleEn: "Rolling the approach out across all household surveys",
        titleAr: "تعميم المنهجية على جميع مسوح الأسر",
        status: "on_track",
      },
    ],
  },

  /* ---------- G2.IO1.OP3 metadata and classifications ---------- */
  {
    code: "CP-21",
    outputCode: "G2.IO1.OP3",
    titleEn: "Update of national statistical classifications",
    titleAr: "تحديث التصنيفات الإحصائية الوطنية",
    descriptionEn:
      "Will bring the national activity, product and occupation classifications onto the current international versions and publish the correspondence tables. The work is scheduled to start once the production platform migration frees the subject matter statisticians.",
    descriptionAr:
      "سيحدث التصنيفات الوطنية للأنشطة والمنتجات والمهن إلى الإصدارات الدولية الحالية مع نشر جداول التناظر. ومن المقرر بدء العمل بعد أن يفرغ ترحيل منصة الإنتاج إحصائيي المجالات الموضوعية.",
    ownerUnitCode: "ECS",
    status: "not_started",
    priorityImpact: 2,
    priorityFeasibility: 1,
    budgetQar: 0,
    inputsEn:
      "Consumes the current international classification releases and subject matter statistician time from four economic statistics departments.",
    inputsAr:
      "يستهلك الإصدارات الدولية الحالية للتصنيفات ووقت إحصائيي المجالات في أربع إدارات للإحصاءات الاقتصادية.",
    people: 6,
    systemsEn: ["Classification Register", "Statistical Metadata Repository"],
    systemsAr: ["سجل التصنيفات", "مستودع البيانات الوصفية الإحصائية"],
    activities: [
      {
        titleEn: "Mapping the national classifications to the new international versions",
        titleAr: "مطابقة التصنيفات الوطنية مع الإصدارات الدولية الجديدة",
        status: "not_started",
      },
      {
        titleEn: "Building and publishing the correspondence tables",
        titleAr: "إعداد جداول التناظر ونشرها",
        status: "not_started",
      },
    ],
  },
  {
    code: "CP-22",
    outputCode: "G2.IO1.OP3",
    titleEn: "Statistical metadata repository and SDMX adoption",
    titleAr: "مستودع البيانات الوصفية الإحصائية وتبني معيار تبادل البيانات الإحصائية",
    descriptionEn:
      "Creates a single repository holding concepts, code lists, methodology notes and quality reports, exposed through the statistical data and metadata exchange standard. Delivery slipped after the supplier changed the integration approach mid contract.",
    descriptionAr:
      "ينشئ مستودعا واحدا يضم المفاهيم وقوائم الرموز ومذكرات المنهجية وتقارير الجودة، ويتيحها وفق معيار تبادل البيانات والبيانات الوصفية الإحصائية. وقد تأخر التسليم بعد أن غير المورد نهج التكامل في منتصف العقد.",
    ownerUnitCode: "NDA",
    status: "delayed",
    priorityImpact: 4,
    priorityFeasibility: 2,
    budgetQar: 3400000,
    inputsEn:
      "Consumes existing methodology documentation, the repository software contract, and metadata authoring time in each statistical domain.",
    inputsAr:
      "يستهلك وثائق المنهجية الحالية وعقد برمجيات المستودع ووقت إعداد البيانات الوصفية في كل مجال إحصائي.",
    people: 8,
    systemsEn: ["Statistical Metadata Repository", "Statistical Production Platform"],
    systemsAr: ["مستودع البيانات الوصفية الإحصائية", "منصة الإنتاج الإحصائي"],
    activities: [
      {
        titleEn: "Agreeing the concept and code list model with the domains",
        titleAr: "الاتفاق مع المجالات على نموذج المفاهيم وقوائم الرموز",
        status: "completed",
      },
      {
        titleEn: "Resolving the supplier change to the integration approach",
        titleAr: "معالجة تغيير المورد لنهج التكامل",
        status: "delayed",
      },
      {
        titleEn: "Loading metadata for the first ten statistical products",
        titleAr: "تحميل البيانات الوصفية لأول عشرة منتجات إحصائية",
        status: "delayed",
      },
    ],
  },

  /* ---------- G2.IO2.OP1 data governance and sharing ---------- */
  {
    code: "CP-23",
    outputCode: "G2.IO2.OP1",
    titleEn: "National data governance policy and steward network",
    titleAr: "سياسة حوكمة البيانات الوطنية وشبكة أمناء البيانات",
    descriptionEn:
      "Issues the national data governance policy and appoints a named data steward in every government entity with a defined mandate over classification, quality and sharing. The network meets quarterly under National Data Affairs.",
    descriptionAr:
      "يصدر سياسة حوكمة البيانات الوطنية ويعين أمين بيانات محددا في كل جهة حكومية بولاية واضحة على التصنيف والجودة والمشاركة. وتجتمع الشبكة فصليا برئاسة شؤون البيانات الوطنية.",
    ownerUnitCode: "NDA",
    status: "on_track",
    priorityImpact: 5,
    priorityFeasibility: 3,
    budgetQar: 1250000,
    inputsEn:
      "Consumes legal review capacity, entity nomination decisions, and policy drafting and consultation time.",
    inputsAr:
      "يستهلك طاقة المراجعة القانونية وقرارات ترشيح الجهات ووقت صياغة السياسة والتشاور بشأنها.",
    people: 8,
    systemsEn: ["Data Governance Portal", "Council Document Repository"],
    systemsAr: ["بوابة حوكمة البيانات", "مستودع وثائق المجلس"],
    activities: [
      {
        titleEn: "Drafting and clearing the national data governance policy",
        titleAr: "صياغة سياسة حوكمة البيانات الوطنية واعتمادها",
        status: "completed",
      },
      {
        titleEn: "Securing the nomination of a data steward in each entity",
        titleAr: "تأمين ترشيح أمين بيانات في كل جهة",
        status: "on_track",
      },
      {
        titleEn: "Running the first year of quarterly steward network meetings",
        titleAr: "تنفيذ السنة الأولى من الاجتماعات الفصلية لشبكة الأمناء",
        status: "on_track",
      },
    ],
  },
  {
    code: "CP-24",
    outputCode: "G2.IO2.OP1",
    titleEn: "Programme of administrative data sharing agreements",
    titleAr: "برنامج اتفاقيات تبادل البيانات الإدارية",
    descriptionEn:
      "Negotiates standing agreements that give the National Statistics Center recurring access to priority administrative registers instead of one off extracts. Several negotiations are stalled on privacy conditions that need a legal opinion.",
    descriptionAr:
      "يتفاوض على اتفاقيات دائمة تتيح لمركز الإحصاء الوطني وصولا متكررا إلى السجلات الإدارية ذات الأولوية بدلا من الاستخراج لمرة واحدة. وقد تعثرت عدة مفاوضات بسبب شروط الخصوصية التي تحتاج إلى رأي قانوني.",
    ownerUnitCode: "NDA",
    status: "at_risk",
    priorityImpact: 5,
    priorityFeasibility: 2,
    budgetQar: 780000,
    inputsEn:
      "Consumes the model sharing agreement, legal opinions on privacy conditions, and negotiation time with register owners.",
    inputsAr:
      "يستهلك الاتفاقية النموذجية للمشاركة والآراء القانونية بشأن شروط الخصوصية ووقت التفاوض مع مالكي السجلات.",
    people: 6,
    systemsEn: ["Data Governance Portal", "Agreement Register"],
    systemsAr: ["بوابة حوكمة البيانات", "سجل الاتفاقيات"],
    activities: [
      {
        titleEn: "Publishing the model data sharing agreement",
        titleAr: "نشر الاتفاقية النموذجية لتبادل البيانات",
        status: "completed",
      },
      {
        titleEn: "Obtaining the legal opinion on recurring register access",
        titleAr: "استصدار الرأي القانوني بشأن الوصول المتكرر إلى السجلات",
        status: "at_risk",
      },
      {
        titleEn: "Signing agreements for the twenty priority registers",
        titleAr: "توقيع اتفاقيات السجلات العشرين ذات الأولوية",
        status: "at_risk",
      },
    ],
  },
  /* ---------- G2.IO2.OP2 unified national data catalogue ---------- */
  {
    code: "CP-25",
    outputCode: "G2.IO2.OP2",
    titleEn: "Unified national data catalogue",
    titleAr: "الفهرس الوطني الموحد للبيانات",
    descriptionEn:
      "Publishes one searchable inventory of the datasets held across government, each entry carrying an owner, an update frequency, a sensitivity class and the terms on which it can be reused. Entities register their holdings through a guided onboarding flow.",
    descriptionAr:
      "ينشر جردا واحدا قابلا للبحث لمجموعات البيانات الموجودة لدى الجهات الحكومية، ويحمل كل سجل جهة مالكة ودورية تحديث ودرجة حساسية وشروط إعادة الاستخدام. وتسجل الجهات ما لديها عبر مسار تسجيل موجه.",
    ownerUnitCode: "NDA",
    status: "on_track",
    priorityImpact: 4,
    priorityFeasibility: 3,
    budgetQar: 6200000,
    inputsEn:
      "Consumes the catalogue platform licence, entity dataset inventories, and the metadata standard agreed with the steward network.",
    inputsAr:
      "يستهلك رخصة منصة الفهرس وجرد مجموعات البيانات لدى الجهات ومعيار البيانات الوصفية المتفق عليه مع شبكة الأمناء.",
    people: 11,
    systemsEn: ["National Data Catalogue", "Data Governance Portal", "Statistical Metadata Repository"],
    systemsAr: ["الفهرس الوطني للبيانات", "بوابة حوكمة البيانات", "مستودع البيانات الوصفية الإحصائية"],
    activities: [
      {
        titleEn: "Agreeing the minimum metadata standard for a catalogue entry",
        titleAr: "الاتفاق على الحد الأدنى لمعيار البيانات الوصفية لسجل الفهرس",
        status: "completed",
      },
      {
        titleEn: "Onboarding the first twelve entities and their holdings",
        titleAr: "إدراج أول اثنتي عشرة جهة وما لديها من بيانات",
        status: "on_track",
      },
      {
        titleEn: "Adding automated harvesting from source system registries",
        titleAr: "إضافة الحصاد الآلي من سجلات نظم المصدر",
        status: "on_track",
      },
      {
        titleEn: "Opening the public search view of non sensitive entries",
        titleAr: "إتاحة واجهة البحث العامة للسجلات غير الحساسة",
        status: "on_track",
      },
    ],
  },
  {
    code: "CP-26",
    outputCode: "G2.IO2.OP2",
    titleEn: "Data quality scorecards for source registers",
    titleAr: "بطاقات قياس جودة البيانات لسجلات المصدر",
    descriptionEn:
      "Will score the administrative registers that feed official statistics on completeness, timeliness, duplication and coverage, and return a scorecard to each register owner every quarter. It starts once enough registers are in the catalogue to score.",
    descriptionAr:
      "سيقيم السجلات الإدارية التي تغذي الإحصاءات الرسمية على الاكتمال والتوقيت والتكرار والتغطية، ويعيد بطاقة قياس إلى كل مالك سجل كل ربع سنة. ويبدأ العمل حين يتوافر في الفهرس عدد كاف من السجلات القابلة للتقييم.",
    ownerUnitCode: "SQ",
    status: "not_started",
    priorityImpact: 3,
    priorityFeasibility: 3,
    budgetQar: 890000,
    inputsEn:
      "Consumes register extracts, the catalogue entries for each register, and quality rule definitions from the assurance framework.",
    inputsAr:
      "يستهلك مستخرجات السجلات وسجلاتها في الفهرس وتعريفات قواعد الجودة المستمدة من إطار ضمان الجودة.",
    people: 5,
    systemsEn: ["National Data Catalogue", "Quality Assessment Register"],
    systemsAr: ["الفهرس الوطني للبيانات", "سجل تقييم الجودة"],
    activities: [
      {
        titleEn: "Defining the scoring rules for each quality dimension",
        titleAr: "تحديد قواعد التقييم لكل بعد من أبعاد الجودة",
        status: "not_started",
      },
      {
        titleEn: "Building the automated scorecard and its distribution",
        titleAr: "بناء بطاقة القياس الآلية وآلية توزيعها",
        status: "not_started",
      },
    ],
  },

  /* ---------- G2.IO3.OP1 open data and dissemination ---------- */
  {
    code: "CP-27",
    outputCode: "G2.IO3.OP1",
    titleEn: "Redesign of the open data portal",
    titleAr: "إعادة تصميم بوابة البيانات المفتوحة",
    descriptionEn:
      "Rebuilt the public statistics portal around what users actually look for, with bilingual search, downloadable tables in open formats and an indicator explorer. Time to find a published figure dropped sharply in the post launch user testing.",
    descriptionAr:
      "أعاد بناء بوابة الإحصاءات العامة حول ما يبحث عنه المستخدمون فعلا، مع بحث ثنائي اللغة وجداول قابلة للتنزيل بصيغ مفتوحة ومستكشف للمؤشرات. وقد انخفض زمن العثور على رقم منشور انخفاضا حادا في اختبارات المستخدمين بعد الإطلاق.",
    ownerUnitCode: "NSC",
    status: "completed",
    priorityImpact: 4,
    priorityFeasibility: 4,
    budgetQar: 3100000,
    inputsEn:
      "Consumes the portal development contract, published statistical series, and user research with researchers, media and businesses.",
    inputsAr:
      "يستهلك عقد تطوير البوابة والسلاسل الإحصائية المنشورة وبحوث المستخدمين مع الباحثين والإعلام وقطاع الأعمال.",
    people: 9,
    systemsEn: ["Open Data Portal", "Statistical Metadata Repository"],
    systemsAr: ["بوابة البيانات المفتوحة", "مستودع البيانات الوصفية الإحصائية"],
    activities: [
      {
        titleEn: "User research with researchers, media and business users",
        titleAr: "بحوث المستخدمين مع الباحثين والإعلاميين ومستخدمي قطاع الأعمال",
        status: "completed",
      },
      {
        titleEn: "Rebuilding bilingual search and the indicator explorer",
        titleAr: "إعادة بناء البحث ثنائي اللغة ومستكشف المؤشرات",
        status: "completed",
      },
      {
        titleEn: "Migrating the published series and retiring the old portal",
        titleAr: "ترحيل السلاسل المنشورة وإيقاف البوابة القديمة",
        status: "completed",
      },
    ],
  },
  {
    code: "CP-28",
    outputCode: "G2.IO3.OP1",
    titleEn: "Statistical API and machine readable release service",
    titleAr: "خدمة واجهات برمجة التطبيقات الإحصائية والإصدار المقروء آليا",
    descriptionEn:
      "Exposes every published series through a documented application programming interface so ministries, banks and researchers can consume figures directly instead of copying them from reports. Release files are published in open formats at the same moment.",
    descriptionAr:
      "يتيح كل سلسلة منشورة عبر واجهة برمجة تطبيقات موثقة بحيث تستهلك الوزارات والمصارف والباحثون الأرقام مباشرة بدلا من نسخها من التقارير. وتنشر ملفات الإصدار بصيغ مفتوحة في اللحظة نفسها.",
    ownerUnitCode: "SSD",
    status: "on_track",
    priorityImpact: 4,
    priorityFeasibility: 3,
    budgetQar: 2450000,
    inputsEn:
      "Consumes the published series store, the metadata repository, and developer time for the interface and its documentation.",
    inputsAr:
      "يستهلك مخزن السلاسل المنشورة ومستودع البيانات الوصفية ووقت المطورين لبناء الواجهة وتوثيقها.",
    people: 7,
    systemsEn: ["Statistical API Gateway", "Open Data Portal"],
    systemsAr: ["بوابة واجهات البرمجة الإحصائية", "بوابة البيانات المفتوحة"],
    activities: [
      {
        titleEn: "Designing the interface contract and the version policy",
        titleAr: "تصميم عقد الواجهة وسياسة الإصدارات",
        status: "completed",
      },
      {
        titleEn: "Publishing developer documentation and a sandbox key",
        titleAr: "نشر وثائق المطورين ومفتاح بيئة التجربة",
        status: "on_track",
      },
      {
        titleEn: "Onboarding the first ten institutional consumers",
        titleAr: "إدراج أول عشر جهات مستهلكة للبيانات",
        status: "on_track",
      },
    ],
  },

  /* ---------- G2.IO3.OP2 statistical literacy and user support ---------- */
  {
    code: "CP-29",
    outputCode: "G2.IO3.OP2",
    titleEn: "Statistical literacy programme for schools and universities",
    titleAr: "برنامج الثقافة الإحصائية للمدارس والجامعات",
    descriptionEn:
      "Puts Qatari official statistics into classrooms through teaching packs, a schools data competition and undergraduate modules built with national universities. Reach is behind plan because the schools calendar allows only two delivery windows a year.",
    descriptionAr:
      "يدخل الإحصاءات الرسمية القطرية إلى الصفوف الدراسية عبر حقائب تعليمية ومسابقة بيانات للمدارس ومقررات جامعية تعد بالشراكة مع الجامعات الوطنية. والانتشار دون الخطة لأن التقويم المدرسي لا يتيح سوى نافذتي تنفيذ في السنة.",
    ownerUnitCode: "SDT",
    status: "at_risk",
    priorityImpact: 3,
    priorityFeasibility: 4,
    budgetQar: 1320000,
    inputsEn:
      "Consumes teaching pack development, trainer time, competition prizes, and cooperation agreements with the education sector.",
    inputsAr:
      "يستهلك إعداد الحقائب التعليمية ووقت المدربين وجوائز المسابقة واتفاقيات التعاون مع قطاع التعليم.",
    people: 6,
    systemsEn: ["Learning Management System", "Open Data Portal"],
    systemsAr: ["نظام إدارة التعلم", "بوابة البيانات المفتوحة"],
    activities: [
      {
        titleEn: "Producing the bilingual teaching packs for secondary schools",
        titleAr: "إنتاج الحقائب التعليمية ثنائية اللغة للمرحلة الثانوية",
        status: "completed",
      },
      {
        titleEn: "Running the national schools data competition",
        titleAr: "تنظيم المسابقة الوطنية للبيانات على مستوى المدارس",
        status: "on_track",
      },
      {
        titleEn: "Agreeing undergraduate modules with national universities",
        titleAr: "الاتفاق على مقررات جامعية مع الجامعات الوطنية",
        status: "at_risk",
      },
    ],
  },
  {
    code: "CP-30",
    outputCode: "G2.IO3.OP2",
    titleEn: "Statistics help desk and microdata access service",
    titleAr: "مكتب مساعدة مستخدمي الإحصاء وخدمة الوصول إلى البيانات الجزئية",
    descriptionEn:
      "Creates one route for statistical enquiries and a controlled path for accredited researchers to work on anonymised microdata inside a secure enclave. Launch slipped because the accreditation rules had to be redrafted after legal review.",
    descriptionAr:
      "ينشئ مسارا واحدا للاستفسارات الإحصائية ومسارا منضبطا يتيح للباحثين المعتمدين العمل على بيانات جزئية مجهولة الهوية داخل بيئة آمنة. وقد تأخر الإطلاق لأن قواعد الاعتماد استلزمت إعادة صياغة بعد المراجعة القانونية.",
    ownerUnitCode: "NSC",
    status: "delayed",
    priorityImpact: 1,
    priorityFeasibility: 4,
    budgetQar: 670000,
    inputsEn:
      "Consumes help desk staffing, the secure enclave environment, and the researcher accreditation rules cleared by Legal Affairs.",
    inputsAr:
      "يستهلك كوادر مكتب المساعدة والبيئة الآمنة للبيانات الجزئية وقواعد اعتماد الباحثين المعتمدة من الشؤون القانونية.",
    people: 5,
    systemsEn: ["Service Desk System", "Secure Microdata Enclave"],
    systemsAr: ["نظام مكتب الخدمة", "البيئة الآمنة للبيانات الجزئية"],
    activities: [
      {
        titleEn: "Redrafting the researcher accreditation rules after legal review",
        titleAr: "إعادة صياغة قواعد اعتماد الباحثين بعد المراجعة القانونية",
        status: "delayed",
      },
      {
        titleEn: "Opening the single enquiry channel with a two day standard",
        titleAr: "فتح قناة الاستفسار الموحدة بمعيار يومي عمل",
        status: "on_track",
      },
      {
        titleEn: "Admitting the first cohort of accredited researchers",
        titleAr: "قبول الدفعة الأولى من الباحثين المعتمدين",
        status: "delayed",
      },
    ],
  },

  /* ---------- G2.IO3.OP3 release calendar and revisions policy ---------- */
  {
    code: "CP-31",
    outputCode: "G2.IO3.OP3",
    titleEn: "Advance release calendar and published revisions policy",
    titleAr: "التقويم المسبق للإصدارات وسياسة المراجعات المنشورة",
    descriptionEn:
      "Published a twelve month advance calendar giving the exact date and hour of every statistical release, together with a policy that states when a figure may be revised and how the revision is announced. Both are now standing commitments of the Council.",
    descriptionAr:
      "نشر تقويما مسبقا لاثني عشر شهرا يحدد تاريخ وساعة كل إصدار إحصائي، مع سياسة تبين متى يجوز مراجعة الرقم وكيف يعلن عن المراجعة. وقد أصبح الاثنان التزامين دائمين على المجلس.",
    ownerUnitCode: "SQ",
    status: "completed",
    priorityImpact: 4,
    priorityFeasibility: 5,
    budgetQar: 240000,
    inputsEn:
      "Consumes the production schedules of every statistical domain and an editorial review of past revision practice.",
    inputsAr:
      "يستهلك جداول الإنتاج لكل مجال إحصائي ومراجعة تحريرية لممارسات المراجعة السابقة.",
    people: 4,
    systemsEn: ["Open Data Portal", "Publication Workflow"],
    systemsAr: ["بوابة البيانات المفتوحة", "مسار عمل الإصدارات"],
    activities: [
      {
        titleEn: "Collecting and reconciling domain production schedules",
        titleAr: "جمع جداول الإنتاج في المجالات ومواءمتها",
        status: "completed",
      },
      {
        titleEn: "Drafting and issuing the revisions policy",
        titleAr: "صياغة سياسة المراجعات وإصدارها",
        status: "completed",
      },
      {
        titleEn: "Publishing the calendar and monitoring adherence to it",
        titleAr: "نشر التقويم ومتابعة الالتزام به",
        status: "completed",
      },
    ],
  },

  /* ---------- G3.IO1.OP1 foresight scanning ---------- */
  {
    code: "CP-32",
    outputCode: "G3.IO1.OP1",
    titleEn: "National horizon scanning system",
    titleAr: "النظام الوطني لمسح الأفق",
    descriptionEn:
      "Runs a continuous scan of research, policy and market sources for signals that could change Qatar's development path, with a panel that validates each signal before it enters the register. Signals are tagged to the NDS3 outcomes they would affect.",
    descriptionAr:
      "ينفذ مسحا مستمرا لمصادر البحث والسياسات والأسواق بحثا عن إشارات قد تغير مسار التنمية في قطر، مع لجنة تتحقق من كل إشارة قبل إدراجها في السجل. وترتبط كل إشارة بنتائج استراتيجية التنمية الوطنية الثالثة التي قد تتأثر بها.",
    ownerUnitCode: "SF",
    status: "on_track",
    priorityImpact: 4,
    priorityFeasibility: 3,
    budgetQar: 2800000,
    inputsEn:
      "Consumes source subscriptions, a scanning and tagging platform, and the time of the expert validation panel.",
    inputsAr:
      "يستهلك اشتراكات المصادر ومنصة المسح والوسم ووقت لجنة التحقق من الخبراء.",
    people: 8,
    systemsEn: ["Horizon Scanning Platform", "Foresight Signal Register"],
    systemsAr: ["منصة مسح الأفق", "سجل إشارات الاستشراف"],
    activities: [
      {
        titleEn: "Selecting the source set and the scanning taxonomy",
        titleAr: "اختيار مجموعة المصادر وتصنيف المسح",
        status: "completed",
      },
      {
        titleEn: "Standing up the validation panel and its cadence",
        titleAr: "تشكيل لجنة التحقق وتحديد دورية اجتماعاتها",
        status: "completed",
      },
      {
        titleEn: "Tagging validated signals to NDS3 outcomes",
        titleAr: "وسم الإشارات المتحقق منها بنتائج الاستراتيجية",
        status: "on_track",
      },
    ],
  },

  /* ---------- G3.IO1.OP2 strategic risk briefings ---------- */
  {
    code: "CP-33",
    outputCode: "G3.IO1.OP2",
    titleEn: "Quarterly strategic risk briefing service",
    titleAr: "خدمة الإحاطة الفصلية بالمخاطر الاستراتيجية",
    descriptionEn:
      "Produces a short quarterly briefing for the Secretary General and the Council on the three or four risks most likely to disturb national delivery, each with a named follow up owner. It is delivered from existing foresight staff time.",
    descriptionAr:
      "ينتج إحاطة فصلية موجزة للأمين العام والمجلس عن ثلاثة أو أربعة مخاطر هي الأرجح في الإخلال بالتنفيذ الوطني، ولكل منها جهة متابعة محددة. وينفذ من وقت كوادر الاستشراف الحالي.",
    ownerUnitCode: "SF",
    status: "on_track",
    priorityImpact: 3,
    priorityFeasibility: 5,
    budgetQar: 0,
    inputsEn:
      "Consumes validated signals from the scanning register, monitoring data on affected outcomes, and two analyst weeks per quarter.",
    inputsAr:
      "يستهلك الإشارات المتحقق منها من سجل المسح وبيانات متابعة النتائج المتأثرة وأسبوعين من عمل المحللين كل ربع سنة.",
    people: 4,
    systemsEn: ["Foresight Signal Register", "Decision Log"],
    systemsAr: ["سجل إشارات الاستشراف", "سجل القرارات"],
    activities: [
      {
        titleEn: "Fixing the briefing format and the risk selection rule",
        titleAr: "تثبيت صيغة الإحاطة وقاعدة اختيار المخاطر",
        status: "completed",
      },
      {
        titleEn: "Delivering the briefing in every quarter of the cycle",
        titleAr: "تقديم الإحاطة في كل ربع من دورة العمل",
        status: "on_track",
      },
      {
        titleEn: "Tracking follow up actions until they are closed",
        titleAr: "متابعة إجراءات المعالجة حتى إقفالها",
        status: "on_track",
      },
    ],
  },

  /* ---------- G3.IO2.OP1 scenarios for the national vision ---------- */
  {
    code: "CP-34",
    outputCode: "G3.IO2.OP1",
    titleEn: "Qatar 2040 scenario programme",
    titleAr: "برنامج سيناريوهات قطر 2040",
    descriptionEn:
      "Develops four contrasting national scenarios to 2040 covering energy transition, demography, technology and regional stability, and tests the resilience of current strategies against each. Aligning the participating entities on one scenario set is proving difficult.",
    descriptionAr:
      "يطور أربعة سيناريوهات وطنية متباينة حتى عام 2040 تغطي تحول الطاقة والتركيبة السكانية والتقنية والاستقرار الإقليمي، ويختبر صلابة الاستراتيجيات الحالية أمام كل منها. وتبين أن مواءمة الجهات المشاركة على مجموعة سيناريوهات واحدة أمر صعب.",
    ownerUnitCode: "NV",
    status: "at_risk",
    priorityImpact: 5,
    priorityFeasibility: 2,
    budgetQar: 4200000,
    inputsEn:
      "Consumes long range demographic and energy projections, expert workshop facilitation, and senior time from fourteen entities.",
    inputsAr:
      "يستهلك الإسقاطات السكانية وإسقاطات الطاقة طويلة المدى وتيسير ورش الخبراء ووقت القيادات في أربع عشرة جهة.",
    people: 9,
    systemsEn: ["Foresight Signal Register", "Scenario Workbench"],
    systemsAr: ["سجل إشارات الاستشراف", "منصة إعداد السيناريوهات"],
    activities: [
      {
        titleEn: "Agreeing the critical uncertainties with national experts",
        titleAr: "الاتفاق مع الخبراء الوطنيين على أوجه عدم اليقين الحرجة",
        status: "completed",
      },
      {
        titleEn: "Writing and quantifying the four scenario narratives",
        titleAr: "كتابة السرديات الأربعة للسيناريوهات وتكميمها",
        status: "at_risk",
      },
      {
        titleEn: "Stress testing current sector strategies against each scenario",
        titleAr: "اختبار صلابة الاستراتيجيات القطاعية الحالية أمام كل سيناريو",
        status: "at_risk",
      },
    ],
  },

  /* ---------- G3.IO2.OP2 behavioural trials ---------- */
  {
    code: "CP-35",
    outputCode: "G3.IO2.OP2",
    titleEn: "Behavioural trials for national priorities",
    titleAr: "التجارب السلوكية للأولويات الوطنية",
    descriptionEn:
      "Will run controlled behavioural trials on a small number of national priorities such as energy saving, survey response and preventive health appointments. Design is complete but the first trials await partner entity approval of the evaluation protocol.",
    descriptionAr:
      "سينفذ تجارب سلوكية مضبوطة على عدد محدود من الأولويات الوطنية مثل ترشيد الطاقة والاستجابة للمسوح ومواعيد الصحة الوقائية. وقد اكتمل التصميم غير أن التجارب الأولى تنتظر موافقة الجهات الشريكة على بروتوكول التقييم.",
    ownerUnitCode: "BSN",
    status: "not_started",
    priorityImpact: 3,
    priorityFeasibility: 4,
    budgetQar: 1580000,
    inputsEn:
      "Consumes partner service channels, trial design and ethics review, and measurement data from the participating entities.",
    inputsAr:
      "يستهلك قنوات خدمة الجهات الشريكة وتصميم التجارب ومراجعة أخلاقياتها وبيانات القياس من الجهات المشاركة.",
    people: 6,
    systemsEn: ["Behavioural Trial Register", "Secure Microdata Enclave"],
    systemsAr: ["سجل التجارب السلوكية", "البيئة الآمنة للبيانات الجزئية"],
    activities: [
      {
        titleEn: "Obtaining partner approval of the evaluation protocol",
        titleAr: "الحصول على موافقة الشركاء على بروتوكول التقييم",
        status: "not_started",
      },
      {
        titleEn: "Running the first three trials with a control group",
        titleAr: "تنفيذ التجارب الثلاث الأولى بمجموعة ضابطة",
        status: "not_started",
      },
      {
        titleEn: "Publishing the results including the trials that fail",
        titleAr: "نشر النتائج بما فيها التجارب التي لا تحقق أثرا",
        status: "not_started",
      },
    ],
  },

  /* ---------- G3.IO2.OP3 foresight capability network ---------- */
  {
    code: "CP-36",
    outputCode: "G3.IO2.OP3",
    titleEn: "Government foresight network and practitioner academy",
    titleAr: "شبكة الاستشراف الحكومي وأكاديمية الممارسين",
    descriptionEn:
      "Trains a foresight focal point in every major entity and links them in a network that feeds signals back to the Council. Recruitment of focal points slowed when several entities left the nominated post vacant.",
    descriptionAr:
      "يدرب ضابط ارتباط للاستشراف في كل جهة رئيسية ويربطهم في شبكة تعيد تغذية المجلس بالإشارات. وقد تباطأ ترشيح ضباط الارتباط بعد أن تركت عدة جهات الوظيفة المرشحة شاغرة.",
    ownerUnitCode: "SF",
    status: "delayed",
    priorityImpact: 2,
    priorityFeasibility: 2,
    budgetQar: 940000,
    inputsEn:
      "Consumes entity nominations, the foresight curriculum, and trainer time for four academy cohorts a year.",
    inputsAr:
      "يستهلك ترشيحات الجهات ومنهج الاستشراف ووقت المدربين لأربع دفعات سنويا في الأكاديمية.",
    people: 5,
    systemsEn: ["Learning Management System", "Foresight Signal Register"],
    systemsAr: ["نظام إدارة التعلم", "سجل إشارات الاستشراف"],
    activities: [
      {
        titleEn: "Securing a nominated focal point in each major entity",
        titleAr: "تأمين ترشيح ضابط ارتباط في كل جهة رئيسية",
        status: "delayed",
      },
      {
        titleEn: "Delivering the foresight practitioner academy cohorts",
        titleAr: "تنفيذ دفعات أكاديمية ممارسي الاستشراف",
        status: "at_risk",
      },
      {
        titleEn: "Opening the network channel for entity contributed signals",
        titleAr: "فتح قناة الشبكة لاستقبال الإشارات من الجهات",
        status: "delayed",
      },
    ],
  },
  /* ---------- G4.IO1.OP1 institutional excellence ---------- */
  {
    code: "CP-37",
    outputCode: "G4.IO1.OP1",
    titleEn: "Implementation of the institutional excellence model",
    titleAr: "تطبيق نموذج التميز المؤسسي",
    descriptionEn:
      "Adopts a recognised excellence model across the Council, with a self assessment every year, a single register of improvement actions and published service standards for the services entities receive. The second assessment cycle is under way.",
    descriptionAr:
      "يعتمد نموذج تميز معترفا به على مستوى المجلس، مع تقييم ذاتي سنوي وسجل موحد لإجراءات التحسين ومعايير خدمة منشورة للخدمات التي تتلقاها الجهات. وتجري حاليا دورة التقييم الثانية.",
    ownerUnitCode: "PQI",
    status: "on_track",
    priorityImpact: 4,
    priorityFeasibility: 4,
    budgetQar: 1450000,
    inputsEn:
      "Consumes assessor certification, department evidence files, and management time in the annual self assessment workshops.",
    inputsAr:
      "يستهلك اعتماد المقيمين وملفات الأدلة في الإدارات ووقت الإدارة في ورش التقييم الذاتي السنوية.",
    people: 7,
    systemsEn: ["Excellence Assessment System", "Service Desk System"],
    systemsAr: ["نظام تقييم التميز", "نظام مكتب الخدمة"],
    activities: [
      {
        titleEn: "Certifying an internal assessor team against the model",
        titleAr: "اعتماد فريق مقيمين داخليين وفق النموذج",
        status: "completed",
      },
      {
        titleEn: "Publishing service standards for the services entities receive",
        titleAr: "نشر معايير الخدمة للخدمات التي تتلقاها الجهات",
        status: "completed",
      },
      {
        titleEn: "Running the second annual self assessment cycle",
        titleAr: "تنفيذ دورة التقييم الذاتي السنوية الثانية",
        status: "on_track",
      },
      {
        titleEn: "Closing improvement actions from the first cycle",
        titleAr: "إقفال إجراءات التحسين الناتجة عن الدورة الأولى",
        status: "on_track",
      },
    ],
  },

  /* ---------- G4.IO1.OP2 knowledge management and continuity ---------- */
  {
    code: "CP-38",
    outputCode: "G4.IO1.OP2",
    titleEn: "Council knowledge management and role continuity programme",
    titleAr: "برنامج إدارة المعرفة واستمرارية الأدوار في المجلس",
    descriptionEn:
      "Captures what senior planners, statisticians and foresight specialists know before they move on, through documented handover files, recorded method walkthroughs and a mentoring pairing. Progress depends on release time that departments find hard to give.",
    descriptionAr:
      "يوثق ما يعرفه كبار المخططين والإحصائيين وأخصائيي الاستشراف قبل انتقالهم، عبر ملفات تسليم موثقة وتسجيلات لشرح المنهجيات وبرنامج إرشاد مهني ثنائي. ويتوقف التقدم على وقت التفرغ الذي تجد الإدارات صعوبة في إتاحته.",
    ownerUnitCode: "HR",
    status: "at_risk",
    priorityImpact: 3,
    priorityFeasibility: 3,
    budgetQar: 0,
    inputsEn:
      "Consumes release time from subject matter experts, the existing knowledge portal, and the critical role list from workforce planning.",
    inputsAr:
      "يستهلك وقت تفرغ خبراء المجالات وبوابة المعرفة القائمة وقائمة الأدوار الحرجة الواردة من تخطيط القوى العاملة.",
    people: 6,
    systemsEn: ["Knowledge Portal", "Human Resources System"],
    systemsAr: ["بوابة المعرفة", "نظام الموارد البشرية"],
    activities: [
      {
        titleEn: "Agreeing the critical role list and the handover file standard",
        titleAr: "إقرار قائمة الأدوار الحرجة ومعيار ملف التسليم",
        status: "completed",
      },
      {
        titleEn: "Recording method walkthroughs with senior specialists",
        titleAr: "تسجيل شروح المنهجيات مع كبار الأخصائيين",
        status: "at_risk",
      },
      {
        titleEn: "Pairing every critical role with a named successor in training",
        titleAr: "إقران كل دور حرج بخلف مسمى قيد الإعداد",
        status: "at_risk",
      },
    ],
  },

  /* ---------- G4.IO2.OP1 digital workplace ---------- */
  {
    code: "CP-39",
    outputCode: "G4.IO2.OP1",
    titleEn: "Unified digital workplace and process automation",
    titleAr: "بيئة العمل الرقمية الموحدة وأتمتة الإجراءات",
    descriptionEn:
      "Brings correspondence, approvals, meetings, tasks and document management into one workspace and automates the forty internal processes that consume the most staff time. Paper based routing is being removed process by process.",
    descriptionAr:
      "يجمع المراسلات والاعتمادات والاجتماعات والمهام وإدارة الوثائق في بيئة عمل واحدة، ويؤتمت الإجراءات الأربعين الأكثر استهلاكا لوقت الموظفين. ويجري إلغاء التوجيه الورقي إجراء بعد آخر.",
    ownerUnitCode: "IS",
    status: "on_track",
    priorityImpact: 4,
    priorityFeasibility: 3,
    budgetQar: 8600000,
    inputsEn:
      "Consumes platform licences, process analysis of the forty priority procedures, and change management across every department.",
    inputsAr:
      "يستهلك رخص المنصة وتحليل الإجراءات الأربعين ذات الأولوية وإدارة التغيير في جميع الإدارات.",
    people: 12,
    systemsEn: ["Digital Workplace Platform", "Process Automation Engine", "Council Document Repository"],
    systemsAr: ["منصة بيئة العمل الرقمية", "محرك أتمتة الإجراءات", "مستودع وثائق المجلس"],
    activities: [
      {
        titleEn: "Mapping and prioritising the forty internal processes",
        titleAr: "توصيف الإجراءات الداخلية الأربعين وترتيب أولوياتها",
        status: "completed",
      },
      {
        titleEn: "Migrating correspondence and approvals to the platform",
        titleAr: "ترحيل المراسلات والاعتمادات إلى المنصة",
        status: "completed",
      },
      {
        titleEn: "Automating the first twenty prioritised processes",
        titleAr: "أتمتة الإجراءات العشرين الأولى حسب الأولوية",
        status: "on_track",
      },
      {
        titleEn: "Withdrawing the paper routing forms department by department",
        titleAr: "سحب نماذج التوجيه الورقية إدارة تلو الأخرى",
        status: "on_track",
      },
    ],
  },

  /* ---------- G4.IO2.OP2 security and continuity ---------- */
  {
    code: "CP-40",
    outputCode: "G4.IO2.OP2",
    titleEn: "Information security and business continuity uplift",
    titleAr: "الارتقاء بأمن المعلومات واستمرارية الأعمال",
    descriptionEn:
      "Raises the Council to the national information assurance standard and proves it can keep statistical production and monitoring running through a disruption, with tested recovery for the systems classified as critical.",
    descriptionAr:
      "يرفع المجلس إلى مستوى المعيار الوطني لضمان أمن المعلومات ويثبت قدرته على إبقاء الإنتاج الإحصائي والمتابعة قيد التشغيل خلال أي انقطاع، مع اختبار فعلي لاستعادة النظم المصنفة حرجة.",
    ownerUnitCode: "IFS",
    status: "on_track",
    priorityImpact: 5,
    priorityFeasibility: 3,
    budgetQar: 5300000,
    inputsEn:
      "Consumes security tooling and monitoring services, an external assurance audit, and continuity exercise time from system owners.",
    inputsAr:
      "يستهلك أدوات الأمن وخدمات المراقبة وتدقيقا خارجيا للضمان ووقت مالكي النظم في تمارين الاستمرارية.",
    people: 9,
    systemsEn: ["Security Operations Platform", "Business Continuity Register"],
    systemsAr: ["منصة عمليات الأمن السيبراني", "سجل استمرارية الأعمال"],
    activities: [
      {
        titleEn: "Classifying systems and data against the national standard",
        titleAr: "تصنيف النظم والبيانات وفق المعيار الوطني",
        status: "completed",
      },
      {
        titleEn: "Closing the high severity findings from the assurance audit",
        titleAr: "إقفال الملاحظات عالية الخطورة الواردة من تدقيق الضمان",
        status: "on_track",
      },
      {
        titleEn: "Running a full recovery exercise for the critical systems",
        titleAr: "تنفيذ تمرين استعادة كامل للنظم الحرجة",
        status: "on_track",
      },
    ],
  },

  /* ---------- G4.IO2.OP3 internal performance reporting ---------- */
  {
    code: "CP-41",
    outputCode: "G4.IO2.OP3",
    titleEn: "Internal performance reporting cockpit",
    titleAr: "قمرة التقارير الداخلية للأداء",
    descriptionEn:
      "Gives each sector head a live view of their own unit indicators, budget execution and service levels drawn from the finance, human resources and service systems. The build is late because the finance interface was rescheduled twice.",
    descriptionAr:
      "يتيح لكل رئيس قطاع عرضا حيا لمؤشرات وحدته وتنفيذ الميزانية ومستويات الخدمة مستمدا من نظم المالية والموارد البشرية والخدمة. وقد تأخر البناء لأن واجهة النظام المالي أعيدت جدولتها مرتين.",
    ownerUnitCode: "TO",
    status: "delayed",
    priorityImpact: 2,
    priorityFeasibility: 3,
    budgetQar: 1150000,
    inputsEn:
      "Consumes indicator feeds from the finance, human resources and service desk systems and analyst time for the unit level views.",
    inputsAr:
      "يستهلك تدفقات المؤشرات من النظم المالية ونظم الموارد البشرية ومكتب الخدمة ووقت المحللين لإعداد عروض مستوى الوحدات.",
    people: 5,
    systemsEn: ["Delivery Dashboard", "Financial Management System", "Human Resources System"],
    systemsAr: ["لوحة متابعة التنفيذ", "نظام الإدارة المالية", "نظام الموارد البشرية"],
    activities: [
      {
        titleEn: "Agreeing the internal indicator set with the sector heads",
        titleAr: "الاتفاق مع رؤساء القطاعات على مجموعة المؤشرات الداخلية",
        status: "completed",
      },
      {
        titleEn: "Building the interface to the financial management system",
        titleAr: "بناء الواجهة مع نظام الإدارة المالية",
        status: "delayed",
      },
      {
        titleEn: "Releasing the unit views to all sector heads",
        titleAr: "إتاحة عروض الوحدات لجميع رؤساء القطاعات",
        status: "delayed",
      },
    ],
  },

  /* ---------- G5.IO1.OP1 partnership programme ---------- */
  {
    code: "CP-42",
    outputCode: "G5.IO1.OP1",
    titleEn: "Research partnership programme with Qatari universities",
    titleAr: "برنامج الشراكة البحثية مع الجامعات القطرية",
    descriptionEn:
      "Commissions applied research on questions the Council genuinely needs answered, from population projections to productivity measurement, under agreements that include data access and joint publication. Two agreements are held up in contract review.",
    descriptionAr:
      "يكلف بإجراء بحوث تطبيقية على أسئلة يحتاج المجلس فعلا إلى إجابتها، من الإسقاطات السكانية إلى قياس الإنتاجية، وفق اتفاقيات تشمل الوصول إلى البيانات والنشر المشترك. وقد تعطلت اتفاقيتان في مرحلة المراجعة التعاقدية.",
    ownerUnitCode: "IIC",
    status: "delayed",
    priorityImpact: 3,
    priorityFeasibility: 4,
    budgetQar: 2100000,
    inputsEn:
      "Consumes research grants, the Council research question list, and supervised access to anonymised microdata.",
    inputsAr:
      "يستهلك المنح البحثية وقائمة الأسئلة البحثية لدى المجلس والوصول المشرف عليه إلى البيانات الجزئية مجهولة الهوية.",
    people: 6,
    systemsEn: ["Agreement Register", "Secure Microdata Enclave"],
    systemsAr: ["سجل الاتفاقيات", "البيئة الآمنة للبيانات الجزئية"],
    activities: [
      {
        titleEn: "Publishing the Council research question list",
        titleAr: "نشر قائمة الأسئلة البحثية لدى المجلس",
        status: "completed",
      },
      {
        titleEn: "Concluding the framework agreements with the universities",
        titleAr: "إبرام الاتفاقيات الإطارية مع الجامعات",
        status: "delayed",
      },
      {
        titleEn: "Commissioning the first six applied research projects",
        titleAr: "التكليف بالمشاريع البحثية التطبيقية الستة الأولى",
        status: "delayed",
      },
    ],
  },

  /* ---------- G5.IO1.OP2 international cooperation ---------- */
  {
    code: "CP-43",
    outputCode: "G5.IO1.OP2",
    titleEn: "Global indicators engagement and reporting unit",
    titleAr: "وحدة الارتباط بالمؤشرات العالمية وإعداد التقارير",
    descriptionEn:
      "Gives Qatar one coordinated voice towards the international bodies that rank and score countries, checking the national figures they use and submitting validated data on time. Several submission deadlines are tight because source entities respond late.",
    descriptionAr:
      "يمنح قطر صوتا منسقا واحدا تجاه الجهات الدولية التي تصنف الدول وتقيمها، بالتحقق من الأرقام الوطنية التي تستخدمها وتقديم بيانات مدققة في موعدها. وعدد من مواعيد التقديم ضيق بسبب تأخر استجابة الجهات المصدر.",
    ownerUnitCode: "IIC",
    status: "at_risk",
    priorityImpact: 4,
    priorityFeasibility: 2,
    budgetQar: 1680000,
    inputsEn:
      "Consumes international questionnaires and methodology notes, national source data from entities, and translation and verification effort.",
    inputsAr:
      "يستهلك الاستبانات الدولية ومذكرات المنهجية وبيانات المصدر الوطنية من الجهات وجهد الترجمة والتحقق.",
    people: 7,
    systemsEn: ["International Indicators Register", "Open Data Portal"],
    systemsAr: ["سجل المؤشرات الدولية", "بوابة البيانات المفتوحة"],
    activities: [
      {
        titleEn: "Mapping every global index to its national data owner",
        titleAr: "ربط كل مؤشر عالمي بجهة البيانات الوطنية المالكة له",
        status: "completed",
      },
      {
        titleEn: "Challenging estimated values used in place of national data",
        titleAr: "الاعتراض على القيم التقديرية المستخدمة بدلا من البيانات الوطنية",
        status: "at_risk",
      },
      {
        titleEn: "Meeting the submission deadlines of the priority indices",
        titleAr: "الالتزام بمواعيد التقديم للمؤشرات ذات الأولوية",
        status: "at_risk",
      },
    ],
  },

  /* ---------- G5.IO2.OP1 communication and publications ---------- */
  {
    code: "CP-44",
    outputCode: "G5.IO2.OP1",
    titleEn: "Integrated communication and publications plan",
    titleAr: "الخطة المتكاملة للاتصال والإصدارات",
    descriptionEn:
      "Replaces ad hoc announcements with one annual plan that sequences statistical releases, strategy milestones and foresight products across channels, with a plain language standard for every public product.",
    descriptionAr:
      "يستبدل بالإعلانات المتفرقة خطة سنوية واحدة ترتب تسلسل الإصدارات الإحصائية ومحطات الاستراتيجية ومنتجات الاستشراف عبر القنوات، مع معيار لغة ميسرة لكل منتج يوجه إلى الجمهور.",
    ownerUnitCode: "PR",
    status: "on_track",
    priorityImpact: 3,
    priorityFeasibility: 4,
    budgetQar: 2750000,
    inputsEn:
      "Consumes the statistical release calendar, strategy milestone dates, design and media production capacity, and audience research.",
    inputsAr:
      "يستهلك تقويم الإصدارات الإحصائية وتواريخ محطات الاستراتيجية وطاقة التصميم والإنتاج الإعلامي وبحوث الجمهور.",
    people: 8,
    systemsEn: ["Publication Workflow", "Media Monitoring Service", "Open Data Portal"],
    systemsAr: ["مسار عمل الإصدارات", "خدمة رصد الإعلام", "بوابة البيانات المفتوحة"],
    activities: [
      {
        titleEn: "Building the annual plan from the release and milestone calendars",
        titleAr: "بناء الخطة السنوية من تقويمي الإصدارات والمحطات",
        status: "completed",
      },
      {
        titleEn: "Issuing the plain language standard for public products",
        titleAr: "إصدار معيار اللغة الميسرة للمنتجات الموجهة للجمهور",
        status: "on_track",
      },
      {
        titleEn: "Measuring reach and comprehension for each major release",
        titleAr: "قياس الانتشار والفهم لكل إصدار رئيسي",
        status: "on_track",
      },
    ],
  },

  /* ---------- G5.IO2.OP2 Council sessions and decision follow up ---------- */
  {
    code: "CP-45",
    outputCode: "G5.IO2.OP2",
    titleEn: "Council sessions and decision follow up service",
    titleAr: "خدمة جلسات المجلس ومتابعة قراراته",
    descriptionEn:
      "Standardised how session papers are prepared, how minutes are cleared and how every decision is tracked to an owner and a due date. Decisions now close against a register rather than in correspondence, and the service runs on existing staff.",
    descriptionAr:
      "وحد طريقة إعداد أوراق الجلسات واعتماد المحاضر وتتبع كل قرار إلى جهة مالكة وتاريخ استحقاق. وتقفل القرارات الآن مقابل سجل معتمد لا عبر المراسلات، وتنفذ الخدمة بالكوادر الحالية.",
    ownerUnitCode: "CSA",
    status: "completed",
    priorityImpact: 4,
    priorityFeasibility: 5,
    budgetQar: 0,
    inputsEn:
      "Consumes session papers from the sectors, secretariat time around each session, and the existing decision log.",
    inputsAr:
      "يستهلك أوراق الجلسات الواردة من القطاعات ووقت الأمانة حول كل جلسة وسجل القرارات القائم.",
    people: 5,
    systemsEn: ["Decision Log", "Council Document Repository"],
    systemsAr: ["سجل القرارات", "مستودع وثائق المجلس"],
    activities: [
      {
        titleEn: "Standardising the session paper and minutes templates",
        titleAr: "توحيد نموذجي ورقة الجلسة والمحضر",
        status: "completed",
      },
      {
        titleEn: "Assigning an owner and a due date to every decision",
        titleAr: "إسناد جهة مالكة وتاريخ استحقاق لكل قرار",
        status: "completed",
      },
      {
        titleEn: "Reporting overdue decisions to the Secretary General monthly",
        titleAr: "رفع تقرير شهري بالقرارات المتأخرة إلى الأمين العام",
        status: "completed",
      },
    ],
  },
];

export const INDICATORS: IndicatorSeed[] = [
  /* ================= goal level, all yearly ================= */
  {
    code: "CI-001",
    nodeCode: "G1",
    nameEn: "Entity strategies conforming to the national planning standard",
    nameAr: "نسبة استراتيجيات الجهات المطابقة لمعيار التخطيط الوطني",
    definitionEn:
      "Counts government entities whose current strategy was assessed as fully conforming to the national results based planning standard, as a share of all entities required to hold a strategy.",
    definitionAr:
      "يحصي الجهات الحكومية التي قيمت استراتيجيتها السارية على أنها مطابقة تماما لمعيار التخطيط الوطني القائم على النتائج، منسوبة إلى جميع الجهات الملزمة بإعداد استراتيجية.",
    formulaEn:
      "Number of entities assessed as fully conforming divided by the number of entities required to hold a strategy, times 100.",
    formulaAr:
      "عدد الجهات المقيمة على أنها مطابقة تماما مقسوما على عدد الجهات الملزمة بإعداد استراتيجية، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "yearly",
    baselineValue: 38,
    targetValue2030: 95,
    dataSourceEn: "Strategy quality review gateway records held by Planning Quality and Innovation.",
    dataSourceAr: "سجلات بوابة مراجعة جودة الاستراتيجيات لدى إدارة جودة التخطيط والابتكار.",
    meansOfVerificationEn: "Signed review reports and the annual conformity register published with the planning report.",
    meansOfVerificationAr: "تقارير المراجعة الموقعة وسجل المطابقة السنوي المنشور مع تقرير التخطيط.",
    notesEn: "An entity counts only once even if it holds more than one sector strategy.",
    notesAr: "تحتسب الجهة مرة واحدة فقط حتى لو كانت تملك أكثر من استراتيجية قطاعية.",
    performance: "on_target",
  },
  {
    code: "CI-002",
    nodeCode: "G1",
    nameEn: "NDS3 initiative delivery rate against the annual plan",
    nameAr: "معدل تنفيذ مبادرات استراتيجية التنمية الوطنية الثالثة مقارنة بالخطة السنوية",
    definitionEn:
      "Measures how much of the planned annual delivery of NDS3 initiatives was actually achieved, weighted by each initiative's planned milestones for the year.",
    definitionAr:
      "يقيس ما تحقق فعليا من التنفيذ السنوي المخطط لمبادرات استراتيجية التنمية الوطنية الثالثة، مرجحا بمحطات كل مبادرة المقررة للسنة.",
    formulaEn:
      "Sum of milestones completed in the year divided by the sum of milestones planned for the year, times 100.",
    formulaAr:
      "مجموع المحطات المنجزة خلال السنة مقسوما على مجموع المحطات المخططة للسنة، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "yearly",
    baselineValue: 61,
    targetValue2030: 90,
    dataSourceEn: "NDS3 monitoring system returns submitted by implementing entities.",
    dataSourceAr: "بيانات نظام متابعة استراتيجية التنمية الوطنية الثالثة المقدمة من الجهات المنفذة.",
    meansOfVerificationEn: "Annual NDS3 progress report and the verification sample audited by Follow up Affairs.",
    meansOfVerificationAr: "التقرير السنوي لتقدم الاستراتيجية وعينة التحقق التي تدققها شؤون المتابعة.",
    notesEn: "Milestones cancelled by a formal Council decision are removed from both the numerator and the denominator.",
    notesAr: "تستبعد المحطات الملغاة بقرار رسمي من المجلس من البسط والمقام معا.",
    performance: "at_risk",
  },
  {
    code: "CI-003",
    nodeCode: "G2",
    nameEn: "Compliance of official statistics with international quality standards",
    nameAr: "امتثال الإحصاءات الرسمية للمعايير الدولية للجودة",
    definitionEn:
      "Counts assessed statistical domains that meet all mandatory criteria of the national quality assurance framework, as a share of all assessed domains.",
    definitionAr:
      "يحصي المجالات الإحصائية المقيمة التي تستوفي جميع المعايير الإلزامية في الإطار الوطني لضمان الجودة، منسوبة إلى جميع المجالات المقيمة.",
    formulaEn:
      "Number of domains meeting all mandatory criteria divided by the number of domains assessed, times 100.",
    formulaAr:
      "عدد المجالات المستوفية لجميع المعايير الإلزامية مقسوما على عدد المجالات المقيمة، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "yearly",
    baselineValue: 72,
    targetValue2030: 95,
    dataSourceEn: "Quality assessment register of the Statistics Quality Department.",
    dataSourceAr: "سجل تقييم الجودة لدى إدارة جودة الإحصاء.",
    meansOfVerificationEn: "Domain assessment reports plus the periodic external peer review.",
    meansOfVerificationAr: "تقارير تقييم المجالات إضافة إلى المراجعة النظيرة الخارجية الدورية.",
    notesEn: "Domains are reassessed on a three year rolling cycle, so the yearly figure covers the latest assessment on record.",
    notesAr: "تعاد تقييم المجالات وفق دورة متجددة مدتها ثلاث سنوات، لذا يغطي الرقم السنوي أحدث تقييم مسجل.",
    performance: "on_target",
  },
  {
    code: "CI-004",
    nodeCode: "G2",
    nameEn: "Public trust in official statistics",
    nameAr: "ثقة الجمهور في الإحصاءات الرسمية",
    definitionEn:
      "Average rating given by respondents to the annual users and public survey when asked how far they trust the statistics published by the Council.",
    definitionAr:
      "متوسط التقييم الذي يمنحه المستجيبون في المسح السنوي للمستخدمين والجمهور عند سؤالهم عن مدى ثقتهم في الإحصاءات التي ينشرها المجلس.",
    formulaEn:
      "Sum of all trust ratings divided by the number of valid responses, reported on a zero to ten scale.",
    formulaAr:
      "مجموع تقييمات الثقة مقسوما على عدد الاستجابات الصالحة، ويعرض على مقياس من صفر إلى عشرة.",
    unit: "score",
    direction: "up_good",
    frequency: "yearly",
    baselineValue: 6.8,
    targetValue2030: 8.5,
    dataSourceEn: "Annual survey of statistics users and the general public.",
    dataSourceAr: "المسح السنوي لمستخدمي الإحصاء وعامة الجمهور.",
    meansOfVerificationEn: "Survey microdata and the published methodology and weighting note.",
    meansOfVerificationAr: "البيانات الجزئية للمسح ومذكرة المنهجية والترجيح المنشورة.",
    notesEn: "The scale runs from zero, meaning no trust at all, to ten, meaning complete trust.",
    notesAr: "يمتد المقياس من صفر بمعنى انعدام الثقة إلى عشرة بمعنى الثقة الكاملة.",
    performance: "on_target",
  },
  {
    code: "CI-005",
    nodeCode: "G3",
    nameEn: "National risks identified at least one year before they materialise",
    nameAr: "المخاطر الوطنية المرصودة قبل وقوعها بسنة على الأقل",
    definitionEn:
      "Counts the risks that actually affected national delivery in the year and that had already been logged in the foresight signal register at least twelve months earlier.",
    definitionAr:
      "يحصي المخاطر التي أثرت فعليا في التنفيذ الوطني خلال السنة والتي كانت مسجلة في سجل إشارات الاستشراف قبل ذلك باثني عشر شهرا على الأقل.",
    formulaEn:
      "Number of materialised risks logged twelve or more months in advance divided by the total number of materialised risks, times 100.",
    formulaAr:
      "عدد المخاطر التي وقعت وكانت مسجلة قبل اثني عشر شهرا أو أكثر مقسوما على إجمالي المخاطر التي وقعت، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "yearly",
    baselineValue: 30,
    targetValue2030: 75,
    dataSourceEn: "Foresight signal register and the annual strategic risk review.",
    dataSourceAr: "سجل إشارات الاستشراف والمراجعة السنوية للمخاطر الاستراتيجية.",
    meansOfVerificationEn: "Dated signal entries matched against the risk events recorded in the annual review.",
    meansOfVerificationAr: "قيود الإشارات المؤرخة مطابقة بأحداث المخاطر المسجلة في المراجعة السنوية.",
    notesEn: "A risk counts once in the year it materialises, using the date of its first validated signal entry.",
    notesAr: "يحتسب الخطر مرة واحدة في سنة وقوعه، اعتمادا على تاريخ أول قيد إشارة متحقق منه.",
    performance: "at_risk",
  },
  {
    code: "CI-006",
    nodeCode: "G3",
    nameEn: "National decisions informed by a foresight product",
    nameAr: "القرارات الوطنية المستندة إلى منتج استشرافي",
    definitionEn:
      "Counts decisions taken by the Council or by an implementing entity whose supporting paper explicitly cites a scenario set, a risk briefing or a validated signal produced by the Council.",
    definitionAr:
      "يحصي القرارات الصادرة عن المجلس أو عن جهة منفذة التي تستشهد أوراقها المساندة صراحة بمجموعة سيناريوهات أو إحاطة مخاطر أو إشارة متحقق منها من إنتاج المجلس.",
    formulaEn: "Count of decisions in the year whose supporting paper cites a Council foresight product.",
    formulaAr: "عدد القرارات خلال السنة التي تستشهد أوراقها المساندة بمنتج استشرافي للمجلس.",
    unit: "number",
    direction: "up_good",
    frequency: "yearly",
    baselineValue: 9,
    targetValue2030: 40,
    dataSourceEn: "Council decision log and entity decision papers collected by Foresight Affairs.",
    dataSourceAr: "سجل قرارات المجلس وأوراق قرارات الجهات التي تجمعها شؤون الاستشراف.",
    meansOfVerificationEn: "Citation extract from each decision paper held in the decision log.",
    meansOfVerificationAr: "مستخرج الاستشهاد من كل ورقة قرار محفوظة في سجل القرارات.",
    notesEn: "A decision that cites more than one foresight product is still counted once.",
    notesAr: "يحتسب القرار الذي يستشهد بأكثر من منتج استشرافي مرة واحدة فقط.",
    performance: "on_target",
  },
  {
    code: "CI-007",
    nodeCode: "G4",
    nameEn: "Institutional excellence assessment score",
    nameAr: "درجة تقييم التميز المؤسسي",
    definitionEn:
      "The total score awarded to the Council in the annual excellence self assessment, validated by certified assessors across the enabler and results criteria.",
    definitionAr:
      "مجموع الدرجات الممنوحة للمجلس في التقييم الذاتي السنوي للتميز، ويعتمدها مقيمون معتمدون عبر معايير الممكنات والنتائج.",
    formulaEn:
      "Sum of the weighted criterion scores awarded by the assessment panel, reported on a zero to one thousand scale.",
    formulaAr:
      "مجموع درجات المعايير المرجحة التي يمنحها فريق التقييم، ويعرض على مقياس من صفر إلى ألف.",
    unit: "score",
    direction: "up_good",
    frequency: "yearly",
    baselineValue: 540,
    targetValue2030: 700,
    dataSourceEn: "Excellence assessment system records and the assessor consensus report.",
    dataSourceAr: "سجلات نظام تقييم التميز وتقرير توافق المقيمين.",
    meansOfVerificationEn: "Signed assessor consensus report and the supporting evidence files per criterion.",
    meansOfVerificationAr: "تقرير توافق المقيمين الموقع وملفات الأدلة المساندة لكل معيار.",
    notesEn: "The scale runs from zero to one thousand points across nine weighted criteria.",
    notesAr: "يمتد المقياس من صفر إلى ألف نقطة موزعة على تسعة معايير مرجحة.",
    performance: "on_target",
  },
  {
    code: "CI-008",
    nodeCode: "G4",
    nameEn: "Core Council processes delivered on digital platforms",
    nameAr: "إجراءات المجلس الأساسية المنفذة على المنصات الرقمية",
    definitionEn:
      "Counts the Council's identified core processes that run end to end on a digital platform with no paper step, as a share of all identified core processes.",
    definitionAr:
      "يحصي إجراءات المجلس الأساسية المحددة التي تنفذ من البداية إلى النهاية على منصة رقمية دون أي خطوة ورقية، منسوبة إلى جميع الإجراءات الأساسية المحددة.",
    formulaEn:
      "Number of core processes running fully digitally divided by the total number of identified core processes, times 100.",
    formulaAr:
      "عدد الإجراءات الأساسية التي تعمل رقميا بالكامل مقسوما على إجمالي الإجراءات الأساسية المحددة، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "yearly",
    baselineValue: 44,
    targetValue2030: 92,
    dataSourceEn: "Process register maintained by the Information Systems Department.",
    dataSourceAr: "سجل الإجراءات لدى إدارة نظم المعلومات.",
    meansOfVerificationEn: "Process walkthrough records and platform transaction logs for each process.",
    meansOfVerificationAr: "محاضر معاينة الإجراءات وسجلات المعاملات على المنصة لكل إجراء.",
    notesEn: "A process with any remaining wet signature step is not counted as fully digital.",
    notesAr: "لا يعد الإجراء رقميا بالكامل إذا بقيت فيه أي خطوة توقيع ورقي.",
    performance: "on_target",
  },
  {
    code: "CI-009",
    nodeCode: "G5",
    nameEn: "Active formal partnerships of the Council",
    nameAr: "الشراكات الرسمية النشطة للمجلس",
    definitionEn:
      "Counts signed partnership agreements with government entities, universities and international bodies that produced at least one agreed deliverable during the year.",
    definitionAr:
      "يحصي اتفاقيات الشراكة الموقعة مع الجهات الحكومية والجامعات والمنظمات الدولية التي أنتجت مخرجا متفقا عليه واحدا على الأقل خلال السنة.",
    formulaEn: "Count of signed agreements with at least one deliverable completed in the year.",
    formulaAr: "عدد الاتفاقيات الموقعة التي أنجز في إطارها مخرج واحد على الأقل خلال السنة.",
    unit: "number",
    direction: "up_good",
    frequency: "yearly",
    baselineValue: 14,
    targetValue2030: 45,
    dataSourceEn: "Agreement register maintained by International Indicators and International Cooperation.",
    dataSourceAr: "سجل الاتفاقيات لدى إدارة المؤشرات الدولية والتعاون الدولي.",
    meansOfVerificationEn: "Signed agreement documents and the deliverable acceptance notes filed against each.",
    meansOfVerificationAr: "وثائق الاتفاقيات الموقعة ومحاضر قبول المخرجات المرفقة بكل منها.",
    notesEn: "Agreements that are signed but dormant for a full year are excluded from the count.",
    notesAr: "تستبعد من العد الاتفاقيات الموقعة التي تظل خاملة سنة كاملة.",
    performance: "on_target",
  },
  {
    code: "CI-010",
    nodeCode: "G5",
    nameEn: "Public reach of Council publications and statistical releases",
    nameAr: "الانتشار الجماهيري لإصدارات المجلس ونشراته الإحصائية",
    definitionEn:
      "Counts unique users who viewed or downloaded a Council publication or statistical release across the portal and official channels during the year.",
    definitionAr:
      "يحصي المستخدمين الفريدين الذين اطلعوا على إصدار أو نشرة إحصائية للمجلس أو حملوها عبر البوابة والقنوات الرسمية خلال السنة.",
    formulaEn: "Count of deduplicated unique users recorded across the portal and the official channels in the year.",
    formulaAr: "عدد المستخدمين الفريدين بعد إزالة التكرار المسجلين عبر البوابة والقنوات الرسمية خلال السنة.",
    unit: "number",
    direction: "up_good",
    frequency: "yearly",
    baselineValue: 480000,
    targetValue2030: 2000000,
    dataSourceEn: "Open data portal analytics and the official channel reporting of Public Relations.",
    dataSourceAr: "تحليلات بوابة البيانات المفتوحة وتقارير القنوات الرسمية لدى العلاقات العامة.",
    meansOfVerificationEn: "Quarterly analytics extracts retained with the annual communication report.",
    meansOfVerificationAr: "مستخرجات التحليلات الفصلية المحفوظة مع تقرير الاتصال السنوي.",
    notesEn: "Internal Council traffic is excluded by filtering the institutional network range.",
    notesAr: "تستبعد الزيارات الداخلية للمجلس عبر ترشيح نطاق الشبكة المؤسسية.",
    performance: "on_target",
  },

  /* ================= intermediate outcome level ================= */
  {
    code: "CI-011",
    nodeCode: "G1.IO1",
    nameEn: "Entity strategies rated compliant with the results based planning standard",
    nameAr: "استراتيجيات الجهات المقيمة مطابقة لمعيار التخطيط القائم على النتائج",
    definitionEn:
      "Counts strategies reviewed in the year that scored at least eighty out of one hundred on the gateway checklist, as a share of strategies reviewed.",
    definitionAr:
      "يحصي الاستراتيجيات المراجعة خلال السنة التي حصلت على ثمانين من مئة على الأقل في قائمة تحقق البوابة، منسوبة إلى الاستراتيجيات المراجعة.",
    formulaEn:
      "Number of strategies scoring eighty or more divided by the number of strategies reviewed, times 100.",
    formulaAr:
      "عدد الاستراتيجيات الحاصلة على ثمانين فأكثر مقسوما على عدد الاستراتيجيات المراجعة، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "yearly",
    baselineValue: 38,
    targetValue2030: 95,
    dataSourceEn: "Review case tracker of the strategy quality review gateway.",
    dataSourceAr: "نظام تتبع حالات بوابة مراجعة جودة الاستراتيجيات.",
    meansOfVerificationEn: "Scored review reports signed by the lead reviewer for each strategy.",
    meansOfVerificationAr: "تقارير المراجعة المقيمة بالدرجات وموقعة من المراجع الرئيسي لكل استراتيجية.",
    notesEn: "Resubmitted strategies count against the score of their latest review only.",
    notesAr: "تحتسب الاستراتيجيات المعاد تقديمها وفق درجة أحدث مراجعة لها فقط.",
    performance: "on_target",
  },
  {
    code: "CI-012",
    nodeCode: "G1.IO1",
    nameEn: "Entity plans submitted by the published deadline",
    nameAr: "خطط الجهات المقدمة في الموعد المنشور",
    definitionEn:
      "Counts entity annual plans and strategy submissions received on or before the date published in the planning calendar, as a share of all submissions due in the quarter.",
    definitionAr:
      "يحصي الخطط السنوية ووثائق الاستراتيجيات الواردة من الجهات في التاريخ المنشور في تقويم التخطيط أو قبله، منسوبة إلى جميع الوثائق المستحقة خلال الربع.",
    formulaEn:
      "Number of submissions received on or before the deadline divided by the number of submissions due, times 100.",
    formulaAr:
      "عدد الوثائق الواردة في الموعد أو قبله مقسوما على عدد الوثائق المستحقة، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 55,
    targetValue2030: 95,
    dataSourceEn: "Submission timestamps in the strategy management system.",
    dataSourceAr: "طوابع وقت التقديم في نظام إدارة الاستراتيجية.",
    meansOfVerificationEn: "System submission log compared with the published planning calendar.",
    meansOfVerificationAr: "سجل التقديم في النظام مقارنا بتقويم التخطيط المنشور.",
    notesEn: "Extensions approved in writing by the sector move the deadline for that submission.",
    notesAr: "التمديدات المعتمدة خطيا من القطاع تغير الموعد النهائي لتلك الوثيقة.",
    performance: "on_target",
  },
  {
    code: "CI-013",
    nodeCode: "G1.IO2",
    nameEn: "NDS3 outcomes rated green in the annual progress report",
    nameAr: "نتائج استراتيجية التنمية الوطنية الثالثة المصنفة خضراء في التقرير السنوي",
    definitionEn:
      "Counts NDS3 outcomes whose composite progress rating was green at the annual assessment, as a share of all NDS3 outcomes.",
    definitionAr:
      "يحصي نتائج الاستراتيجية التي بلغ تصنيف تقدمها المركب اللون الأخضر في التقييم السنوي، منسوبة إلى جميع نتائج الاستراتيجية.",
    formulaEn: "Number of outcomes rated green divided by the total number of NDS3 outcomes, times 100.",
    formulaAr: "عدد النتائج المصنفة خضراء مقسوما على إجمالي نتائج الاستراتيجية، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "yearly",
    baselineValue: 48,
    targetValue2030: 85,
    dataSourceEn: "NDS3 monitoring system composite ratings.",
    dataSourceAr: "التصنيفات المركبة في نظام متابعة استراتيجية التنمية الوطنية الثالثة.",
    meansOfVerificationEn: "Annual progress report ratings table and the underlying indicator evidence.",
    meansOfVerificationAr: "جدول التصنيفات في التقرير السنوي للتقدم والأدلة المؤشرية المستند إليها.",
    notesEn: "The composite rating combines indicator performance with the delivery status of the linked initiatives.",
    notesAr: "يجمع التصنيف المركب بين أداء المؤشرات وحالة تنفيذ المبادرات المرتبطة.",
    performance: "at_risk",
  },
  {
    code: "CI-014",
    nodeCode: "G1.IO2",
    nameEn: "Lagging initiatives returned to plan after a support package",
    nameAr: "المبادرات المتعثرة التي عادت إلى الخطة بعد حزمة دعم",
    definitionEn:
      "Counts initiatives that were behind schedule, received an implementation support package, and were back on their approved schedule within two quarters.",
    definitionAr:
      "يحصي المبادرات التي كانت متأخرة عن جدولها وتلقت حزمة دعم للتنفيذ وعادت إلى جدولها المعتمد خلال ربعين.",
    formulaEn:
      "Number of supported initiatives back on schedule within two quarters divided by the number of initiatives that received a support package, times 100.",
    formulaAr:
      "عدد المبادرات المدعومة التي عادت إلى جدولها خلال ربعين مقسوما على عدد المبادرات التي تلقت حزمة دعم، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 28,
    targetValue2030: 70,
    dataSourceEn: "Delivery case files held by Implementation Support and the NDS3 monitoring system.",
    dataSourceAr: "ملفات حالات التنفيذ لدى دعم التنفيذ ونظام متابعة الاستراتيجية.",
    meansOfVerificationEn: "Recovery plan closure notes matched with the schedule variance in the monitoring system.",
    meansOfVerificationAr: "محاضر إقفال خطط التعافي مطابقة بانحراف الجدول في نظام المتابعة.",
    notesEn: "An initiative rebaselined rather than recovered is not counted as returned to plan.",
    notesAr: "لا تحتسب المبادرة التي أعيد ضبط خط أساسها بدلا من تعافيها ضمن العائدة إلى الخطة.",
    performance: "behind",
  },
  {
    code: "CI-015",
    nodeCode: "G1.IO3",
    nameEn: "Major policy proposals tested before adoption",
    nameAr: "مقترحات السياسات الكبرى المختبرة قبل اعتمادها",
    definitionEn:
      "Counts major policy proposals submitted to Council that were supported by a simulation run or a policy lab evaluation before the decision was taken.",
    definitionAr:
      "يحصي مقترحات السياسات الكبرى المرفوعة إلى المجلس والمسندة بتشغيل نموذج محاكاة أو بتقييم من مختبر السياسات قبل اتخاذ القرار.",
    formulaEn:
      "Number of major proposals with a simulation or evaluation attached divided by the total number of major proposals submitted, times 100.",
    formulaAr:
      "عدد المقترحات الكبرى المرفقة بمحاكاة أو تقييم مقسوما على إجمالي المقترحات الكبرى المرفوعة، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "yearly",
    baselineValue: 12,
    targetValue2030: 70,
    dataSourceEn: "Council session papers and the policy lab case tracker.",
    dataSourceAr: "أوراق جلسات المجلس ونظام تتبع حالات مختبر السياسات.",
    meansOfVerificationEn: "Session paper annexes showing the simulation or evaluation reference.",
    meansOfVerificationAr: "ملاحق أوراق الجلسات التي تبين مرجع المحاكاة أو التقييم.",
    notesEn: "Major proposals are those with a national fiscal or regulatory effect as defined in the planning manual.",
    notesAr: "المقترحات الكبرى هي ذات الأثر المالي أو التنظيمي الوطني وفق تعريف دليل التخطيط.",
    performance: "at_risk",
  },
  {
    code: "CI-016",
    nodeCode: "G1.IO3",
    nameEn: "Policy lab evaluations delivered within the service window",
    nameAr: "تقييمات مختبر السياسات المنجزة ضمن نافذة الخدمة",
    definitionEn:
      "Counts rapid evaluation requests closed within thirty working days of acceptance, as a share of all requests closed in the quarter.",
    definitionAr:
      "يحصي طلبات التقييم السريع المقفلة خلال ثلاثين يوم عمل من قبولها، منسوبة إلى جميع الطلبات المقفلة خلال الربع.",
    formulaEn:
      "Number of requests closed within thirty working days divided by the number of requests closed, times 100.",
    formulaAr:
      "عدد الطلبات المقفلة خلال ثلاثين يوم عمل مقسوما على عدد الطلبات المقفلة، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 60,
    targetValue2030: 92,
    dataSourceEn: "Policy lab case tracker timestamps.",
    dataSourceAr: "طوابع الوقت في نظام تتبع حالات مختبر السياسات.",
    meansOfVerificationEn: "Case records showing the acceptance date and the delivery date of each evaluation.",
    meansOfVerificationAr: "سجلات الحالات التي تبين تاريخ القبول وتاريخ تسليم كل تقييم.",
    notesEn: "Time spent waiting for data from the requesting entity is excluded from the elapsed count.",
    notesAr: "يستبعد من حساب المدة الوقت المنقضي في انتظار بيانات من الجهة الطالبة.",
    performance: "on_target",
  },
  {
    code: "CI-017",
    nodeCode: "G2.IO1",
    nameEn: "Statistical products meeting the national quality criteria",
    nameAr: "المنتجات الإحصائية المستوفية لمعايير الجودة الوطنية",
    definitionEn:
      "Counts published statistical products that satisfy every mandatory criterion of the national quality assurance framework at their most recent assessment.",
    definitionAr:
      "يحصي المنتجات الإحصائية المنشورة التي تستوفي كل معيار إلزامي في الإطار الوطني لضمان الجودة عند أحدث تقييم لها.",
    formulaEn:
      "Number of products meeting all mandatory criteria divided by the number of published statistical products, times 100.",
    formulaAr:
      "عدد المنتجات المستوفية لجميع المعايير الإلزامية مقسوما على عدد المنتجات الإحصائية المنشورة، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "yearly",
    baselineValue: 66,
    targetValue2030: 95,
    dataSourceEn: "Quality assessment register and the statistical product catalogue.",
    dataSourceAr: "سجل تقييم الجودة وفهرس المنتجات الإحصائية.",
    meansOfVerificationEn: "Product level assessment sheets and the quality reports published with each product.",
    meansOfVerificationAr: "استمارات التقييم على مستوى المنتج وتقارير الجودة المنشورة مع كل منتج.",
    notesEn: "Products discontinued during the year are removed from the denominator.",
    notesAr: "تستبعد من المقام المنتجات التي أوقف إصدارها خلال السنة.",
    performance: "on_target",
  },
  {
    code: "CI-018",
    nodeCode: "G2.IO1",
    nameEn: "Statistical outputs produced on the modernised platform",
    nameAr: "المخرجات الإحصائية المنتجة على المنصة المحدثة",
    definitionEn:
      "Counts statistical outputs released in the quarter whose full production chain ran on the integrated statistical production platform.",
    definitionAr:
      "يحصي المخرجات الإحصائية الصادرة خلال الربع التي نفذت سلسلة إنتاجها كاملة على المنصة المتكاملة للإنتاج الإحصائي.",
    formulaEn:
      "Number of outputs produced fully on the platform divided by the number of outputs released in the quarter, times 100.",
    formulaAr:
      "عدد المخرجات المنتجة بالكامل على المنصة مقسوما على عدد المخرجات الصادرة خلال الربع، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 18,
    targetValue2030: 85,
    dataSourceEn: "Statistical production platform process logs.",
    dataSourceAr: "سجلات العمليات في منصة الإنتاج الإحصائي.",
    meansOfVerificationEn: "Platform run records reconciled with the release calendar entries.",
    meansOfVerificationAr: "سجلات التشغيل على المنصة مطابقة بقيود تقويم الإصدارات.",
    notesEn: "A partial migration where estimation still runs outside the platform does not count.",
    notesAr: "لا يحتسب الترحيل الجزئي الذي ما زالت فيه عملية التقدير تنفذ خارج المنصة.",
    performance: "at_risk",
  },
  {
    code: "CI-019",
    nodeCode: "G2.IO2",
    nameEn: "Priority administrative sources covered by a sharing agreement",
    nameAr: "مصادر البيانات الإدارية ذات الأولوية المشمولة باتفاقية مشاركة",
    definitionEn:
      "Counts the priority administrative registers for which a signed and currently valid data sharing agreement is in force with the Council.",
    definitionAr:
      "يحصي السجلات الإدارية ذات الأولوية التي توجد بشأنها اتفاقية مشاركة بيانات موقعة وسارية مع المجلس.",
    formulaEn:
      "Number of priority registers with a valid agreement divided by the number of registers on the priority list, times 100.",
    formulaAr:
      "عدد السجلات ذات الأولوية التي لها اتفاقية سارية مقسوما على عدد السجلات المدرجة في قائمة الأولوية، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "yearly",
    baselineValue: 31,
    targetValue2030: 90,
    dataSourceEn: "Agreement register of National Data Affairs.",
    dataSourceAr: "سجل الاتفاقيات لدى شؤون البيانات الوطنية.",
    meansOfVerificationEn: "Signed agreement copies with their validity dates and scope annexes.",
    meansOfVerificationAr: "نسخ الاتفاقيات الموقعة مع تواريخ سريانها وملاحق نطاقها.",
    notesEn: "An expired agreement stops counting on the day it lapses, even if renewal is under way.",
    notesAr: "تتوقف الاتفاقية المنتهية عن الاحتساب من يوم انقضائها حتى لو كان التجديد جاريا.",
    performance: "at_risk",
  },
  {
    code: "CI-020",
    nodeCode: "G2.IO2",
    nameEn: "Catalogue datasets with complete metadata",
    nameAr: "مجموعات بيانات الفهرس المستوفية للبيانات الوصفية",
    definitionEn:
      "Counts datasets registered in the unified national data catalogue that carry every mandatory metadata field, as a share of all registered datasets.",
    definitionAr:
      "يحصي مجموعات البيانات المسجلة في الفهرس الوطني الموحد التي تحمل جميع حقول البيانات الوصفية الإلزامية، منسوبة إلى جميع المجموعات المسجلة.",
    formulaEn:
      "Number of datasets with all mandatory metadata fields populated divided by the number of registered datasets, times 100.",
    formulaAr:
      "عدد المجموعات التي استوفيت فيها جميع حقول البيانات الوصفية الإلزامية مقسوما على عدد المجموعات المسجلة، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 22,
    targetValue2030: 90,
    dataSourceEn: "National data catalogue completeness report.",
    dataSourceAr: "تقرير اكتمال البيانات في الفهرس الوطني للبيانات.",
    meansOfVerificationEn: "Automated catalogue completeness extract retained each quarter.",
    meansOfVerificationAr: "مستخرج اكتمال الفهرس الآلي المحفوظ كل ربع سنة.",
    notesEn: "The mandatory field set is the minimum metadata standard agreed with the data steward network.",
    notesAr: "مجموعة الحقول الإلزامية هي الحد الأدنى لمعيار البيانات الوصفية المتفق عليه مع شبكة أمناء البيانات.",
    performance: "on_target",
  },
  {
    code: "CI-021",
    nodeCode: "G2.IO3",
    nameEn: "User satisfaction with the statistical services of the Council",
    nameAr: "رضا المستخدمين عن الخدمات الإحصائية للمجلس",
    definitionEn:
      "Average satisfaction rating given by statistics users in the annual user survey, covering finding data, understanding it and getting support.",
    definitionAr:
      "متوسط درجة الرضا التي يمنحها مستخدمو الإحصاء في المسح السنوي للمستخدمين، ويشمل العثور على البيانات وفهمها والحصول على الدعم.",
    formulaEn: "Sum of satisfaction ratings divided by the number of valid responses, reported on a zero to ten scale.",
    formulaAr: "مجموع درجات الرضا مقسوما على عدد الاستجابات الصالحة، ويعرض على مقياس من صفر إلى عشرة.",
    unit: "score",
    direction: "up_good",
    frequency: "yearly",
    baselineValue: 6.4,
    targetValue2030: 8.5,
    dataSourceEn: "Annual statistics user survey run by the National Statistics Center.",
    dataSourceAr: "المسح السنوي لمستخدمي الإحصاء الذي ينفذه مركز الإحصاء الوطني.",
    meansOfVerificationEn: "Survey response file and the published results note.",
    meansOfVerificationAr: "ملف استجابات المسح ومذكرة النتائج المنشورة.",
    notesEn: "The scale runs from zero, meaning not satisfied at all, to ten, meaning fully satisfied.",
    notesAr: "يمتد المقياس من صفر بمعنى عدم الرضا إطلاقا إلى عشرة بمعنى الرضا التام.",
    performance: "on_target",
  },
  {
    code: "CI-022",
    nodeCode: "G2.IO3",
    nameEn: "Statistical releases published on the announced date",
    nameAr: "الإصدارات الإحصائية المنشورة في الموعد المعلن",
    definitionEn:
      "Counts statistical releases published on the exact date shown in the advance release calendar, as a share of releases scheduled in the quarter.",
    definitionAr:
      "يحصي الإصدارات الإحصائية المنشورة في التاريخ المحدد بالضبط في التقويم المسبق للإصدارات، منسوبة إلى الإصدارات المجدولة خلال الربع.",
    formulaEn:
      "Number of releases published on the scheduled date divided by the number of releases scheduled, times 100.",
    formulaAr:
      "عدد الإصدارات المنشورة في التاريخ المجدول مقسوما على عدد الإصدارات المجدولة، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 74,
    targetValue2030: 98,
    dataSourceEn: "Advance release calendar and the publication workflow records.",
    dataSourceAr: "التقويم المسبق للإصدارات وسجلات مسار عمل النشر.",
    meansOfVerificationEn: "Portal publication timestamps compared with the calendar entries.",
    meansOfVerificationAr: "طوابع وقت النشر على البوابة مقارنة بقيود التقويم.",
    notesEn: "A release brought forward without notice counts as off calendar just as a delay does.",
    notesAr: "يعد الإصدار المقدم دون إشعار خارجا عن التقويم شأنه شأن التأخير.",
    performance: "on_target",
  },
  {
    code: "CI-023",
    nodeCode: "G3.IO1",
    nameEn: "Validated signals escalated to leadership within one quarter",
    nameAr: "الإشارات المتحقق منها المرفوعة إلى القيادة خلال ربع سنة",
    definitionEn:
      "Counts signals rated high relevance by the validation panel that reached a leadership briefing within one quarter of validation.",
    definitionAr:
      "يحصي الإشارات التي صنفتها لجنة التحقق عالية الأهمية ووصلت إلى إحاطة قيادية خلال ربع سنة من تاريخ التحقق.",
    formulaEn:
      "Number of high relevance signals briefed within one quarter divided by the number of high relevance signals validated, times 100.",
    formulaAr:
      "عدد الإشارات عالية الأهمية التي عرضت في إحاطة خلال ربع سنة مقسوما على عدد الإشارات عالية الأهمية المتحقق منها، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "yearly",
    baselineValue: 35,
    targetValue2030: 80,
    dataSourceEn: "Foresight signal register and the strategic risk briefing archive.",
    dataSourceAr: "سجل إشارات الاستشراف وأرشيف إحاطات المخاطر الاستراتيجية.",
    meansOfVerificationEn: "Signal validation dates matched with the briefing in which each appeared.",
    meansOfVerificationAr: "تواريخ التحقق من الإشارات مطابقة بالإحاطة التي ظهرت فيها كل إشارة.",
    notesEn: "Only signals rated high relevance enter this calculation; watch list signals are excluded.",
    notesAr: "تدخل في الحساب الإشارات المصنفة عالية الأهمية فقط، وتستبعد إشارات قائمة المراقبة.",
    performance: "on_target",
  },
  {
    code: "CI-024",
    nodeCode: "G3.IO1",
    nameEn: "Strategic risk briefings delivered on schedule",
    nameAr: "إحاطات المخاطر الاستراتيجية المقدمة في موعدها",
    definitionEn:
      "Counts scheduled strategic risk briefings delivered to the Secretary General within the planned week of the quarter.",
    definitionAr:
      "يحصي إحاطات المخاطر الاستراتيجية المجدولة التي قدمت إلى الأمين العام خلال الأسبوع المخطط من الربع.",
    formulaEn:
      "Number of briefings delivered in the planned week divided by the number of briefings scheduled, times 100.",
    formulaAr:
      "عدد الإحاطات المقدمة في الأسبوع المخطط مقسوما على عدد الإحاطات المجدولة، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 50,
    targetValue2030: 100,
    dataSourceEn: "Office of the Secretary General briefing schedule.",
    dataSourceAr: "جدول الإحاطات لدى مكتب الأمين العام.",
    meansOfVerificationEn: "Dated briefing packs filed in the decision log.",
    meansOfVerificationAr: "حقائب الإحاطة المؤرخة المحفوظة في سجل القرارات.",
    notesEn: "A briefing issued as a written note when the meeting is cancelled still counts as delivered.",
    notesAr: "تحتسب الإحاطة الصادرة كمذكرة مكتوبة عند إلغاء الاجتماع ضمن الإحاطات المقدمة.",
    performance: "on_target",
  },
  {
    code: "CI-025",
    nodeCode: "G3.IO2",
    nameEn: "National strategies and visions citing a Council scenario set",
    nameAr: "الاستراتيجيات والرؤى الوطنية التي تستشهد بمجموعة سيناريوهات المجلس",
    definitionEn:
      "Counts approved national, sector or entity strategies whose text cites a scenario set produced by the Council as an input to its assumptions.",
    definitionAr:
      "يحصي الاستراتيجيات الوطنية أو القطاعية أو المؤسسية المعتمدة التي يستشهد نصها بمجموعة سيناريوهات من إنتاج المجلس كمدخل لافتراضاتها.",
    formulaEn: "Cumulative count of approved strategies citing a Council scenario set since 2025.",
    formulaAr: "العدد التراكمي للاستراتيجيات المعتمدة التي تستشهد بمجموعة سيناريوهات للمجلس منذ عام 2025.",
    unit: "number",
    direction: "up_good",
    frequency: "yearly",
    baselineValue: 3,
    targetValue2030: 18,
    dataSourceEn: "Strategy quality review gateway records and the National Visions Department register.",
    dataSourceAr: "سجلات بوابة مراجعة جودة الاستراتيجيات وسجل إدارة الرؤى الوطنية.",
    meansOfVerificationEn: "Citation extract from the approved strategy text held with the review file.",
    meansOfVerificationAr: "مستخرج الاستشهاد من نص الاستراتيجية المعتمدة المحفوظ مع ملف المراجعة.",
    notesEn: "A revised strategy is counted again only if it cites a newer scenario set.",
    notesAr: "لا تحتسب الاستراتيجية المنقحة من جديد إلا إذا استشهدت بمجموعة سيناريوهات أحدث.",
    performance: "at_risk",
  },
  {
    code: "CI-026",
    nodeCode: "G3.IO2",
    nameEn: "Behavioural trials completed with a measured effect",
    nameAr: "التجارب السلوكية المكتملة بأثر مقاس",
    definitionEn:
      "Counts behavioural trials closed in the quarter that reported a measured effect size against a control group, whether the effect was positive or not.",
    definitionAr:
      "يحصي التجارب السلوكية المقفلة خلال الربع التي أبلغت عن حجم أثر مقاس مقابل مجموعة ضابطة، سواء كان الأثر إيجابيا أو غير ذلك.",
    formulaEn: "Count of trials closed in the quarter with a reported effect size and a control comparison.",
    formulaAr: "عدد التجارب المقفلة خلال الربع التي تتضمن حجم أثر معلنا ومقارنة بمجموعة ضابطة.",
    unit: "number",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 1,
    targetValue2030: 6,
    dataSourceEn: "Behavioural trial register of the Behavioural Science and Nudge Lab.",
    dataSourceAr: "سجل التجارب السلوكية لدى مختبر العلوم السلوكية والتحفيز.",
    meansOfVerificationEn: "Published trial reports including the pre registered analysis plan.",
    meansOfVerificationAr: "تقارير التجارب المنشورة بما فيها خطة التحليل المسجلة مسبقا.",
    notesEn: "Trials abandoned before the measurement window are not counted.",
    notesAr: "لا تحتسب التجارب التي أوقفت قبل نافذة القياس.",
    performance: "on_target",
  },
  {
    code: "CI-027",
    nodeCode: "G4.IO1",
    nameEn: "Voluntary turnover of specialist staff",
    nameAr: "معدل الدوران الطوعي للكوادر المتخصصة",
    definitionEn:
      "Counts specialist staff in planning, statistics and foresight roles who resigned voluntarily during the year, as a share of the average specialist headcount.",
    definitionAr:
      "يحصي الكوادر المتخصصة في وظائف التخطيط والإحصاء والاستشراف الذين استقالوا طوعا خلال السنة، منسوبين إلى متوسط عدد الكوادر المتخصصة.",
    formulaEn:
      "Number of voluntary resignations among specialist staff divided by the average specialist headcount for the year, times 100.",
    formulaAr:
      "عدد الاستقالات الطوعية بين الكوادر المتخصصة مقسوما على متوسط عددهم خلال السنة، مضروبا في 100.",
    unit: "percent",
    direction: "down_good",
    frequency: "yearly",
    baselineValue: 13.5,
    targetValue2030: 7,
    dataSourceEn: "Human resources system separation records.",
    dataSourceAr: "سجلات إنهاء الخدمة في نظام الموارد البشرية.",
    meansOfVerificationEn: "Separation files with the reason code and the exit interview record.",
    meansOfVerificationAr: "ملفات إنهاء الخدمة مع رمز السبب ومحضر مقابلة المغادرة.",
    notesEn: "Retirements, transfers on secondment and end of contract exits are excluded.",
    notesAr: "تستبعد حالات التقاعد والنقل بالإعارة وانتهاء العقد.",
    performance: "at_risk",
  },
  {
    code: "CI-028",
    nodeCode: "G4.IO1",
    nameEn: "Internal service requests closed within the service level",
    nameAr: "طلبات الخدمة الداخلية المقفلة ضمن مستوى الخدمة",
    definitionEn:
      "Counts internal service requests to shared services, information systems and human resources that were closed within the published service level time.",
    definitionAr:
      "يحصي طلبات الخدمة الداخلية الموجهة إلى الخدمات المشتركة ونظم المعلومات والموارد البشرية التي أقفلت ضمن الزمن المنشور لمستوى الخدمة.",
    formulaEn:
      "Number of requests closed within the service level divided by the number of requests closed in the quarter, times 100.",
    formulaAr:
      "عدد الطلبات المقفلة ضمن مستوى الخدمة مقسوما على عدد الطلبات المقفلة خلال الربع، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 68,
    targetValue2030: 95,
    dataSourceEn: "Service desk system ticket records.",
    dataSourceAr: "سجلات التذاكر في نظام مكتب الخدمة.",
    meansOfVerificationEn: "Service desk report showing open and close timestamps per ticket.",
    meansOfVerificationAr: "تقرير مكتب الخدمة الذي يبين طابعي فتح التذكرة وإقفالها.",
    notesEn: "Tickets paused while waiting on the requester are excluded from the elapsed time.",
    notesAr: "يستبعد من الزمن المنقضي وقت تعليق التذكرة في انتظار مقدم الطلب.",
    performance: "on_target",
  },
  {
    code: "CI-029",
    nodeCode: "G4.IO2",
    nameEn: "Information security maturity level",
    nameAr: "مستوى نضج أمن المعلومات",
    definitionEn:
      "The maturity level assessed against the national information assurance standard across governance, protection, detection and recovery domains.",
    definitionAr:
      "مستوى النضج المقيم وفق المعيار الوطني لضمان أمن المعلومات عبر مجالات الحوكمة والحماية والكشف والتعافي.",
    formulaEn:
      "Average of the maturity levels awarded to each control domain, reported on a one to five scale.",
    formulaAr:
      "متوسط مستويات النضج الممنوحة لكل مجال ضوابط، ويعرض على مقياس من واحد إلى خمسة.",
    unit: "score",
    direction: "up_good",
    frequency: "yearly",
    baselineValue: 2.6,
    targetValue2030: 4.5,
    dataSourceEn: "Annual assurance audit conducted for the Information Security Department.",
    dataSourceAr: "تدقيق الضمان السنوي المنفذ لصالح إدارة أمن المعلومات.",
    meansOfVerificationEn: "Signed audit report with the domain scoring sheet.",
    meansOfVerificationAr: "تقرير التدقيق الموقع مع استمارة تقييم المجالات.",
    notesEn: "The scale runs from one, meaning initial and undocumented, to five, meaning optimising.",
    notesAr: "يمتد المقياس من واحد بمعنى مبدئي وغير موثق إلى خمسة بمعنى محسن باستمرار.",
    performance: "on_target",
  },
  {
    code: "CI-030",
    nodeCode: "G4.IO2",
    nameEn: "Recurrent cost avoided through process automation",
    nameAr: "الكلفة المتكررة المتجنبة نتيجة أتمتة الإجراءات",
    definitionEn:
      "Values the staff time and printing, courier and storage cost removed by automated processes, accumulated within the financial year.",
    definitionAr:
      "يقدر قيمة وقت الموظفين وكلفة الطباعة والنقل والتخزين التي ألغتها الإجراءات المؤتمتة، تراكميا خلال السنة المالية.",
    formulaEn:
      "Sum over automated processes of hours saved times the average loaded hourly cost, plus the direct cost lines removed, expressed in QAR million.",
    formulaAr:
      "مجموع الساعات الموفرة في الإجراءات المؤتمتة مضروبة في متوسط الكلفة المحملة للساعة، مضافا إليها بنود الكلفة المباشرة الملغاة، ويعبر عنه بمليون ريال قطري.",
    unit: "QAR million",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 1.2,
    targetValue2030: 22,
    dataSourceEn: "Process automation engine measurements and financial management system cost lines.",
    dataSourceAr: "قياسات محرك أتمتة الإجراءات وبنود الكلفة في نظام الإدارة المالية.",
    meansOfVerificationEn: "Benefit realisation sheet per automated process signed by the process owner.",
    meansOfVerificationAr: "استمارة تحقق المنافع لكل إجراء مؤتمت موقعة من مالك الإجراء.",
    notesEn: "The figure accumulates within the financial year and resets at the start of each year.",
    notesAr: "يتراكم الرقم خلال السنة المالية ويعاد ضبطه في بداية كل سنة.",
    performance: "on_target",
  },
  {
    code: "CI-031",
    nodeCode: "G5.IO1",
    nameEn: "Joint products delivered with partners",
    nameAr: "المنتجات المشتركة المنجزة مع الشركاء",
    definitionEn:
      "Counts studies, datasets, tools and publications completed in the quarter under a partnership agreement with an entity, a university or an international body.",
    definitionAr:
      "يحصي الدراسات ومجموعات البيانات والأدوات والإصدارات المنجزة خلال الربع في إطار اتفاقية شراكة مع جهة أو جامعة أو منظمة دولية.",
    formulaEn: "Count of joint products accepted in the quarter under an active partnership agreement.",
    formulaAr: "عدد المنتجات المشتركة المقبولة خلال الربع في إطار اتفاقية شراكة سارية.",
    unit: "number",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 4,
    targetValue2030: 24,
    dataSourceEn: "Agreement register deliverable records.",
    dataSourceAr: "سجلات المخرجات في سجل الاتفاقيات.",
    meansOfVerificationEn: "Acceptance note signed by both parties for each joint product.",
    meansOfVerificationAr: "محضر القبول الموقع من الطرفين لكل منتج مشترك.",
    notesEn: "Products delivered outside a signed agreement are excluded, however useful they are.",
    notesAr: "تستبعد المنتجات المنجزة خارج اتفاقية موقعة مهما بلغت فائدتها.",
    performance: "on_target",
  },
  {
    code: "CI-032",
    nodeCode: "G5.IO1",
    nameEn: "Global indicator submissions delivered before the deadline",
    nameAr: "بيانات المؤشرات العالمية المقدمة قبل الموعد النهائي",
    definitionEn:
      "Counts national submissions to international indicator and index bodies that were sent with validated data before the published deadline.",
    definitionAr:
      "يحصي البيانات الوطنية المرسلة إلى الجهات الدولية للمؤشرات والتصنيفات ببيانات مدققة قبل الموعد النهائي المنشور.",
    formulaEn:
      "Number of submissions sent before the deadline divided by the number of submissions due in the quarter, times 100.",
    formulaAr:
      "عدد البيانات المرسلة قبل الموعد النهائي مقسوما على عدد البيانات المستحقة خلال الربع، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 62,
    targetValue2030: 100,
    dataSourceEn: "International indicators register of the cooperation department.",
    dataSourceAr: "سجل المؤشرات الدولية لدى إدارة التعاون.",
    meansOfVerificationEn: "Submission acknowledgements received from the international bodies.",
    meansOfVerificationAr: "إشعارات الاستلام الواردة من الجهات الدولية.",
    notesEn: "A submission accepted late by the receiving body still counts as missed.",
    notesAr: "تعد البيانات المقبولة متأخرة من الجهة المتلقية ضمن الفائتة للموعد.",
    performance: "at_risk",
  },
  {
    code: "CI-033",
    nodeCode: "G5.IO2",
    nameEn: "Media and public enquiries answered within two working days",
    nameAr: "استفسارات الإعلام والجمهور المجاب عنها خلال يومي عمل",
    definitionEn:
      "Counts enquiries received through the official channels that received a substantive answer within two working days of receipt.",
    definitionAr:
      "يحصي الاستفسارات الواردة عبر القنوات الرسمية التي تلقت إجابة موضوعية خلال يومي عمل من ورودها.",
    formulaEn:
      "Number of enquiries answered within two working days divided by the number of enquiries received, times 100.",
    formulaAr:
      "عدد الاستفسارات المجاب عنها خلال يومي عمل مقسوما على عدد الاستفسارات الواردة، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 58,
    targetValue2030: 95,
    dataSourceEn: "Service desk system and the Public Relations enquiry inbox.",
    dataSourceAr: "نظام مكتب الخدمة وصندوق استفسارات العلاقات العامة.",
    meansOfVerificationEn: "Enquiry log showing receipt and first substantive response timestamps.",
    meansOfVerificationAr: "سجل الاستفسارات الذي يبين طابعي الورود وأول رد موضوعي.",
    notesEn: "An acknowledgement of receipt does not count as a substantive answer.",
    notesAr: "لا يعد إشعار الاستلام إجابة موضوعية.",
    performance: "on_target",
  },
  {
    code: "CI-034",
    nodeCode: "G5.IO2",
    nameEn: "Council decisions closed by their due date",
    nameAr: "قرارات المجلس المقفلة في تاريخ استحقاقها",
    definitionEn:
      "Counts decisions recorded in the decision log that were marked complete by the owning unit on or before the agreed due date.",
    definitionAr:
      "يحصي القرارات المسجلة في سجل القرارات التي أشرت الوحدة المالكة على إنجازها في تاريخ الاستحقاق المتفق عليه أو قبله.",
    formulaEn:
      "Number of decisions closed on or before the due date divided by the number of decisions due in the quarter, times 100.",
    formulaAr:
      "عدد القرارات المقفلة في تاريخ الاستحقاق أو قبله مقسوما على عدد القرارات المستحقة خلال الربع، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 64,
    targetValue2030: 95,
    dataSourceEn: "Council decision log maintained by Council Sessions Affairs.",
    dataSourceAr: "سجل قرارات المجلس لدى إدارة شؤون جلسات المجلس.",
    meansOfVerificationEn: "Closure evidence attached to each decision record in the log.",
    meansOfVerificationAr: "أدلة الإقفال المرفقة بكل قيد قرار في السجل.",
    notesEn: "A due date may be extended only by a further decision of the Council.",
    notesAr: "لا يجوز تمديد تاريخ الاستحقاق إلا بقرار لاحق من المجلس.",
    performance: "on_target",
  },

  /* ================= output level ================= */
  {
    code: "CI-035",
    nodeCode: "G1.IO1.OP1",
    nameEn: "Entity submissions using the current manual templates",
    nameAr: "وثائق الجهات المقدمة على نماذج الدليل الحالي",
    definitionEn:
      "Counts planning submissions received on the templates of the current manual edition, as a share of all planning submissions received in the quarter.",
    definitionAr:
      "يحصي وثائق التخطيط الواردة على نماذج الإصدار الحالي من الدليل، منسوبة إلى جميع وثائق التخطيط الواردة خلال الربع.",
    formulaEn:
      "Number of submissions on current templates divided by the number of submissions received, times 100.",
    formulaAr:
      "عدد الوثائق المقدمة على النماذج الحالية مقسوما على عدد الوثائق الواردة، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 0,
    targetValue2030: 100,
    dataSourceEn: "Strategy management system submission records.",
    dataSourceAr: "سجلات التقديم في نظام إدارة الاستراتيجية.",
    meansOfVerificationEn: "Template version stamp carried by each submitted document.",
    meansOfVerificationAr: "ختم إصدار النموذج المرفق بكل وثيقة مقدمة.",
    notesEn: "The baseline is zero because the third edition templates were issued at the start of the strategy period.",
    notesAr: "خط الأساس صفر لأن نماذج الإصدار الثالث صدرت مع بداية فترة الاستراتيجية.",
    performance: "on_target",
  },
  {
    code: "CI-036",
    nodeCode: "G1.IO1.OP2",
    nameEn: "Entity planners certified under the capability programme",
    nameAr: "مخططو الجهات المعتمدون ضمن برنامج بناء القدرات",
    definitionEn:
      "Counts planning staff from government entities who completed all four modules and passed the examination of the certified government planner programme.",
    definitionAr:
      "يحصي موظفي التخطيط في الجهات الحكومية الذين أكملوا الوحدات الأربع واجتازوا امتحان برنامج المخطط الحكومي المعتمد.",
    formulaEn: "Cumulative count of participants awarded the certificate since the programme began.",
    formulaAr: "العدد التراكمي للمشاركين الحاصلين على الشهادة منذ بدء البرنامج.",
    unit: "number",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 0,
    targetValue2030: 350,
    dataSourceEn: "Certification register of the Statistical and Data Training Center.",
    dataSourceAr: "سجل الاعتماد لدى مركز التدريب الإحصائي وتدريب البيانات.",
    meansOfVerificationEn: "Examination results and the issued certificate numbers.",
    meansOfVerificationAr: "نتائج الامتحانات وأرقام الشهادات الصادرة.",
    notesEn: "Participants who complete the modules but fail the examination are not counted.",
    notesAr: "لا يحتسب المشاركون الذين أكملوا الوحدات ولم يجتازوا الامتحان.",
    performance: "on_target",
  },
  {
    code: "CI-037",
    nodeCode: "G1.IO1.OP3",
    nameEn: "Strategies passed through the quality review gateway",
    nameAr: "الاستراتيجيات التي مرت عبر بوابة مراجعة الجودة",
    definitionEn:
      "Counts sector and entity strategies that completed a full gateway review and received a scored report during the quarter.",
    definitionAr:
      "يحصي الاستراتيجيات القطاعية والمؤسسية التي أكملت مراجعة كاملة عبر البوابة وتسلمت تقريرا مقيما بالدرجات خلال الربع.",
    formulaEn: "Cumulative count of strategies with a completed gateway review report.",
    formulaAr: "العدد التراكمي للاستراتيجيات التي اكتمل لها تقرير مراجعة عبر البوابة.",
    unit: "number",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 6,
    targetValue2030: 90,
    dataSourceEn: "Review case tracker of Planning Quality and Innovation.",
    dataSourceAr: "نظام تتبع حالات المراجعة لدى إدارة جودة التخطيط والابتكار.",
    meansOfVerificationEn: "Signed review reports with the reviewer roster for each case.",
    meansOfVerificationAr: "تقارير المراجعة الموقعة مع كشف المراجعين لكل حالة.",
    notesEn: "A strategy returning for a second review is counted once only.",
    notesAr: "تحتسب الاستراتيجية العائدة لمراجعة ثانية مرة واحدة فقط.",
    performance: "at_risk",
  },
  {
    code: "CI-038",
    nodeCode: "G1.IO2.OP1",
    nameEn: "Monitoring returns received complete and on time",
    nameAr: "بيانات المتابعة الواردة كاملة وفي موعدها",
    definitionEn:
      "Counts entity monitoring returns that arrived by the reporting deadline with every mandatory field populated, as a share of returns due.",
    definitionAr:
      "يحصي بيانات المتابعة الواردة من الجهات في موعد رفع التقارير وقد استوفيت فيها جميع الحقول الإلزامية، منسوبة إلى البيانات المستحقة.",
    formulaEn:
      "Number of returns received on time and complete divided by the number of returns due, times 100.",
    formulaAr:
      "عدد البيانات الواردة في موعدها وكاملة مقسوما على عدد البيانات المستحقة، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 57,
    targetValue2030: 95,
    dataSourceEn: "NDS3 monitoring system return records.",
    dataSourceAr: "سجلات البيانات الواردة في نظام متابعة الاستراتيجية.",
    meansOfVerificationEn: "System completeness check report generated at the reporting cut off.",
    meansOfVerificationAr: "تقرير فحص الاكتمال الآلي الصادر عند إقفال فترة رفع التقارير.",
    notesEn: "A return that arrives on time but fails the completeness check counts as not received.",
    notesAr: "تعد البيانات الواردة في موعدها والفاشلة في فحص الاكتمال غير واردة.",
    performance: "on_target",
  },
  {
    code: "CI-039",
    nodeCode: "G1.IO2.OP2",
    nameEn: "Lagging entities receiving a tailored support package",
    nameAr: "الجهات المتعثرة التي تلقت حزمة دعم مصممة لها",
    definitionEn:
      "Counts entities identified as lagging in the monitoring cycle that received a documented implementation support package within the following quarter.",
    definitionAr:
      "يحصي الجهات التي رصدت متعثرة في دورة المتابعة وتلقت حزمة دعم موثقة للتنفيذ خلال الربع التالي.",
    formulaEn: "Cumulative count of entities with a documented support package delivered since 2025.",
    formulaAr: "العدد التراكمي للجهات التي سلمت لها حزمة دعم موثقة منذ عام 2025.",
    unit: "number",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 3,
    targetValue2030: 30,
    dataSourceEn: "Delivery case files of the implementation support departments.",
    dataSourceAr: "ملفات حالات التنفيذ لدى إدارات دعم التنفيذ.",
    meansOfVerificationEn: "Support package handover note countersigned by the receiving entity.",
    meansOfVerificationAr: "محضر تسليم حزمة الدعم موقعا من الجهة المتلقية.",
    notesEn: "An entity supported in more than one cycle is counted once in the cumulative figure.",
    notesAr: "تحتسب الجهة المدعومة في أكثر من دورة مرة واحدة في الرقم التراكمي.",
    performance: "behind",
  },
  {
    code: "CI-040",
    nodeCode: "G1.IO2.OP3",
    nameEn: "Dashboard indicators refreshed automatically from source",
    nameAr: "مؤشرات اللوحة المحدثة آليا من المصدر",
    definitionEn:
      "Counts indicators shown on the delivery dashboard whose values arrive through an automated feed rather than manual entry.",
    definitionAr:
      "يحصي المؤشرات المعروضة على لوحة متابعة التنفيذ التي تصل قيمها عبر تغذية آلية بدلا من الإدخال اليدوي.",
    formulaEn:
      "Number of indicators fed automatically divided by the total number of indicators on the dashboard, times 100.",
    formulaAr:
      "عدد المؤشرات المغذاة آليا مقسوما على إجمالي المؤشرات على اللوحة، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 15,
    targetValue2030: 90,
    dataSourceEn: "Data integration platform feed configuration.",
    dataSourceAr: "إعدادات التغذية في منصة تكامل البيانات.",
    meansOfVerificationEn: "Feed inventory extract listing the source system for each indicator.",
    meansOfVerificationAr: "مستخرج جرد التغذية الذي يبين نظام المصدر لكل مؤشر.",
    notesEn: "A feed that runs automatically but needs manual approval before display still counts as automated.",
    notesAr: "تعد التغذية التي تعمل آليا وتتطلب اعتمادا يدويا قبل العرض ضمن التغذية الآلية.",
    performance: "on_target",
  },
  {
    code: "CI-041",
    nodeCode: "G1.IO3.OP1",
    nameEn: "Priority sectors covered by an accredited simulation model",
    nameAr: "القطاعات ذات الأولوية المغطاة بنموذج محاكاة معتمد",
    definitionEn:
      "Counts priority sectors for which a simulation model has passed independent peer review and been accepted for policy use.",
    definitionAr:
      "يحصي القطاعات ذات الأولوية التي اجتاز نموذج المحاكاة الخاص بها مراجعة نظيرة مستقلة واعتمد للاستخدام في السياسات.",
    formulaEn: "Cumulative count of priority sectors with a peer reviewed and accepted model.",
    formulaAr: "العدد التراكمي للقطاعات ذات الأولوية التي لها نموذج مراجع نظيرا ومعتمد.",
    unit: "number",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 1,
    targetValue2030: 7,
    dataSourceEn: "Model register of the Strategy and Policy Simulation Department.",
    dataSourceAr: "سجل النماذج لدى إدارة محاكاة الاستراتيجيات والسياسات.",
    meansOfVerificationEn: "Peer review report and the acceptance memorandum for each model.",
    meansOfVerificationAr: "تقرير المراجعة النظيرة ومذكرة الاعتماد لكل نموذج.",
    notesEn: "A model still in calibration is not counted even if it produces provisional results.",
    notesAr: "لا يحتسب النموذج الذي ما زال في مرحلة المعايرة حتى لو أنتج نتائج أولية.",
    performance: "at_risk",
  },
  {
    code: "CI-042",
    nodeCode: "G1.IO3.OP2",
    nameEn: "Adoption ratio of policy lab recommendations",
    nameAr: "نسبة تبني توصيات مختبر السياسات",
    definitionEn:
      "Compares the number of policy lab recommendations that the requesting entity accepted in writing with the number of recommendations issued.",
    definitionAr:
      "يقارن عدد توصيات مختبر السياسات التي قبلتها الجهة الطالبة خطيا بعدد التوصيات الصادرة.",
    formulaEn: "Number of recommendations accepted in writing divided by the number of recommendations issued.",
    formulaAr: "عدد التوصيات المقبولة خطيا مقسوما على عدد التوصيات الصادرة.",
    unit: "ratio",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 0.4,
    targetValue2030: 0.8,
    dataSourceEn: "Policy lab case tracker recommendation records.",
    dataSourceAr: "سجلات التوصيات في نظام تتبع حالات مختبر السياسات.",
    meansOfVerificationEn: "Written acceptance response from the requesting entity held against each case.",
    meansOfVerificationAr: "رد القبول الخطي من الجهة الطالبة المحفوظ مع كل حالة.",
    notesEn: "The ratio runs from zero to one; partial acceptance counts as half a recommendation.",
    notesAr: "تتراوح النسبة بين صفر وواحد، ويحتسب القبول الجزئي نصف توصية.",
    performance: "on_target",
  },
  {
    code: "CI-043",
    nodeCode: "G2.IO1.OP1",
    nameEn: "Statistical domains assessed against the quality framework",
    nameAr: "المجالات الإحصائية المقيمة وفق إطار الجودة",
    definitionEn:
      "Counts statistical domains that have completed a full assessment against the national quality assurance framework with a signed report.",
    definitionAr:
      "يحصي المجالات الإحصائية التي أكملت تقييما كاملا وفق الإطار الوطني لضمان الجودة بتقرير موقع.",
    formulaEn: "Cumulative count of domains with a completed and signed assessment report.",
    formulaAr: "العدد التراكمي للمجالات التي اكتمل لها تقرير تقييم موقع.",
    unit: "number",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 4,
    targetValue2030: 22,
    dataSourceEn: "Quality assessment register of the Statistics Quality Department.",
    dataSourceAr: "سجل تقييم الجودة لدى إدارة جودة الإحصاء.",
    meansOfVerificationEn: "Signed assessment reports with the evidence pack for each domain.",
    meansOfVerificationAr: "تقارير التقييم الموقعة مع حقيبة الأدلة لكل مجال.",
    notesEn: "Reassessments of an already assessed domain do not increase the cumulative count.",
    notesAr: "لا تزيد إعادة تقييم مجال سبق تقييمه من العدد التراكمي.",
    performance: "on_target",
  },
  {
    code: "CI-044",
    nodeCode: "G2.IO1.OP2",
    nameEn: "Statistical production processes migrated to the platform",
    nameAr: "عمليات الإنتاج الإحصائي المرحلة إلى المنصة",
    definitionEn:
      "Counts statistical production processes that run fully on the integrated platform, as a share of the processes in the migration scope.",
    definitionAr:
      "يحصي عمليات الإنتاج الإحصائي التي تعمل بالكامل على المنصة المتكاملة، منسوبة إلى العمليات المشمولة بنطاق الترحيل.",
    formulaEn:
      "Number of processes fully migrated divided by the number of processes in the migration scope, times 100.",
    formulaAr:
      "عدد العمليات المرحلة بالكامل مقسوما على عدد العمليات في نطاق الترحيل، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 12,
    targetValue2030: 85,
    dataSourceEn: "Migration plan tracker of the Statistical Systems Department.",
    dataSourceAr: "متتبع خطة الترحيل لدى إدارة النظم الإحصائية.",
    meansOfVerificationEn: "Process sign off records confirming that the legacy tool was decommissioned.",
    meansOfVerificationAr: "محاضر اعتماد العمليات التي تؤكد إيقاف الأداة القديمة.",
    notesEn: "A process is only counted once its legacy tool has been switched off.",
    notesAr: "لا تحتسب العملية إلا بعد إيقاف أداتها القديمة.",
    performance: "behind",
  },
  {
    code: "CI-045",
    nodeCode: "G2.IO1.OP3",
    nameEn: "Classifications aligned to the current international standard",
    nameAr: "التصنيفات المواءمة مع المعيار الدولي الحالي",
    definitionEn:
      "Counts national statistical classifications published at the current international version with a correspondence table, as a share of the classifications in use.",
    definitionAr:
      "يحصي التصنيفات الإحصائية الوطنية المنشورة وفق الإصدار الدولي الحالي مع جدول تناظر، منسوبة إلى التصنيفات المستخدمة.",
    formulaEn:
      "Number of classifications at the current international version divided by the number of classifications in use, times 100.",
    formulaAr:
      "عدد التصنيفات المطابقة للإصدار الدولي الحالي مقسوما على عدد التصنيفات المستخدمة، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 45,
    targetValue2030: 100,
    dataSourceEn: "Classification register held with the statistical metadata repository.",
    dataSourceAr: "سجل التصنيفات المحفوظ مع مستودع البيانات الوصفية الإحصائية.",
    meansOfVerificationEn: "Published classification version notes and the correspondence tables.",
    meansOfVerificationAr: "مذكرات إصدار التصنيفات المنشورة وجداول التناظر.",
    notesEn: "A classification without a published correspondence table does not count as aligned.",
    notesAr: "لا يعد التصنيف مواءما ما لم ينشر له جدول تناظر.",
    performance: "at_risk",
  },
  {
    code: "CI-046",
    nodeCode: "G2.IO2.OP1",
    nameEn: "Data sharing agreements in force with government entities",
    nameAr: "اتفاقيات تبادل البيانات السارية مع الجهات الحكومية",
    definitionEn:
      "Counts signed data sharing agreements that are currently valid and give the Council recurring access to a named administrative source.",
    definitionAr:
      "يحصي اتفاقيات تبادل البيانات الموقعة السارية حاليا والتي تمنح المجلس وصولا متكررا إلى مصدر إداري محدد.",
    formulaEn: "Count of valid signed agreements in force at the end of the quarter.",
    formulaAr: "عدد الاتفاقيات الموقعة السارية في نهاية الربع.",
    unit: "number",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 11,
    targetValue2030: 60,
    dataSourceEn: "Agreement register of National Data Affairs.",
    dataSourceAr: "سجل الاتفاقيات لدى شؤون البيانات الوطنية.",
    meansOfVerificationEn: "Signed agreement copies with their validity period and named data source.",
    meansOfVerificationAr: "نسخ الاتفاقيات الموقعة مع فترة سريانها ومصدر البيانات المحدد فيها.",
    notesEn: "One agreement covering several sources is counted once per named source.",
    notesAr: "تحتسب الاتفاقية الواحدة التي تغطي عدة مصادر مرة عن كل مصدر محدد فيها.",
    performance: "behind",
  },
  {
    code: "CI-047",
    nodeCode: "G2.IO2.OP2",
    nameEn: "Catalogue entries with a named data steward",
    nameAr: "سجلات الفهرس التي لها أمين بيانات محدد",
    definitionEn:
      "Counts entries in the national data catalogue that name an individual data steward who is currently in post, as a share of all entries.",
    definitionAr:
      "يحصي السجلات في الفهرس الوطني للبيانات التي تحدد أمين بيانات بالاسم ويشغل الوظيفة حاليا، منسوبة إلى جميع السجلات.",
    formulaEn:
      "Number of entries with an in post named steward divided by the total number of catalogue entries, times 100.",
    formulaAr:
      "عدد السجلات التي لها أمين بيانات محدد وقائم على رأس العمل مقسوما على إجمالي سجلات الفهرس، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 25,
    targetValue2030: 95,
    dataSourceEn: "National data catalogue stewardship report.",
    dataSourceAr: "تقرير أمانة البيانات في الفهرس الوطني للبيانات.",
    meansOfVerificationEn: "Catalogue extract cross checked against the entity nomination letters.",
    meansOfVerificationAr: "مستخرج الفهرس مطابقا بخطابات ترشيح الجهات.",
    notesEn: "An entry naming only an organisational unit rather than a person does not count.",
    notesAr: "لا يحتسب السجل الذي يذكر وحدة تنظيمية فقط دون شخص محدد.",
    performance: "on_target",
  },
  {
    code: "CI-048",
    nodeCode: "G2.IO3.OP1",
    nameEn: "Open data downloads and interface calls",
    nameAr: "تنزيلات البيانات المفتوحة واستدعاءات الواجهة البرمجية",
    definitionEn:
      "Counts file downloads from the open data portal plus successful calls to the statistical application programming interface during the quarter.",
    definitionAr:
      "يحصي تنزيلات الملفات من بوابة البيانات المفتوحة إضافة إلى الاستدعاءات الناجحة لواجهة برمجة التطبيقات الإحصائية خلال الربع.",
    formulaEn: "Number of portal file downloads plus the number of successful interface calls in the quarter.",
    formulaAr: "عدد تنزيلات الملفات من البوابة مضافا إليه عدد الاستدعاءات الناجحة للواجهة خلال الربع.",
    unit: "number",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 120000,
    targetValue2030: 900000,
    dataSourceEn: "Open data portal analytics and the statistical interface gateway logs.",
    dataSourceAr: "تحليلات بوابة البيانات المفتوحة وسجلات بوابة الواجهات الإحصائية.",
    meansOfVerificationEn: "Quarterly analytics and gateway log extracts retained by the systems department.",
    meansOfVerificationAr: "مستخرجات التحليلات وسجلات البوابة الفصلية المحفوظة لدى إدارة النظم.",
    notesEn: "Automated monitoring traffic and failed calls are filtered out before counting.",
    notesAr: "ترشح حركة المراقبة الآلية والاستدعاءات الفاشلة قبل العد.",
    performance: "on_target",
  },
  {
    code: "CI-049",
    nodeCode: "G2.IO3.OP2",
    nameEn: "Participants completing statistical literacy courses",
    nameAr: "المشاركون الذين أكملوا دورات الثقافة الإحصائية",
    definitionEn:
      "Counts students, teachers and public users who completed a statistical literacy course or workshop and passed its final exercise.",
    definitionAr:
      "يحصي الطلبة والمعلمين والمستخدمين من الجمهور الذين أكملوا دورة أو ورشة في الثقافة الإحصائية واجتازوا تمرينها الختامي.",
    formulaEn: "Cumulative count of participants recorded as completing a course since 2025.",
    formulaAr: "العدد التراكمي للمشاركين المسجلين على أنهم أكملوا دورة منذ عام 2025.",
    unit: "number",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 220,
    targetValue2030: 2500,
    dataSourceEn: "Learning management system completion records.",
    dataSourceAr: "سجلات الإتمام في نظام إدارة التعلم.",
    meansOfVerificationEn: "Attendance lists and completion certificates issued per cohort.",
    meansOfVerificationAr: "كشوف الحضور وشهادات الإتمام الصادرة لكل دفعة.",
    notesEn: "A participant who attends more than one course is counted once per course completed.",
    notesAr: "يحتسب المشارك الذي يحضر أكثر من دورة مرة عن كل دورة أكملها.",
    performance: "at_risk",
  },
  {
    code: "CI-050",
    nodeCode: "G2.IO3.OP3",
    nameEn: "Days from the end of the reference period to first release",
    nameAr: "عدد الأيام من نهاية الفترة المرجعية حتى أول إصدار",
    definitionEn:
      "Measures the average number of calendar days between the close of the reference period of a statistical product and its first publication.",
    definitionAr:
      "يقيس متوسط عدد الأيام التقويمية بين إقفال الفترة المرجعية للمنتج الإحصائي وأول نشر له.",
    formulaEn:
      "Sum of days between reference period end and first release across products divided by the number of products released.",
    formulaAr:
      "مجموع الأيام بين نهاية الفترة المرجعية وأول إصدار لكل المنتجات مقسوما على عدد المنتجات الصادرة.",
    unit: "days",
    direction: "down_good",
    frequency: "monthly",
    baselineValue: 62,
    targetValue2030: 30,
    dataSourceEn: "Publication workflow records and the advance release calendar.",
    dataSourceAr: "سجلات مسار عمل النشر والتقويم المسبق للإصدارات.",
    meansOfVerificationEn: "Portal publication timestamps compared with the reference period recorded in the metadata.",
    meansOfVerificationAr: "طوابع وقت النشر على البوابة مقارنة بالفترة المرجعية المسجلة في البيانات الوصفية.",
    notesEn: "Annual products with a statutory compilation period are reported separately and excluded here.",
    notesAr: "تعرض المنتجات السنوية ذات فترة التجميع النظامية بصورة منفصلة وتستبعد من هذا المؤشر.",
    performance: "on_target",
  },
  {
    code: "CI-051",
    nodeCode: "G3.IO1.OP1",
    nameEn: "New validated signals entered in the scanning register",
    nameAr: "الإشارات الجديدة المتحقق منها المدرجة في سجل المسح",
    definitionEn:
      "Counts signals that the validation panel accepted and entered in the foresight signal register during the month.",
    definitionAr:
      "يحصي الإشارات التي قبلتها لجنة التحقق وأدرجتها في سجل إشارات الاستشراف خلال الشهر.",
    formulaEn: "Count of signals accepted by the validation panel and registered in the month.",
    formulaAr: "عدد الإشارات التي قبلتها لجنة التحقق وسجلت خلال الشهر.",
    unit: "number",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 12,
    targetValue2030: 45,
    dataSourceEn: "Foresight signal register of the Strategic Foresight Department.",
    dataSourceAr: "سجل إشارات الاستشراف لدى إدارة الاستشراف الاستراتيجي.",
    meansOfVerificationEn: "Validation panel minutes listing the accepted signals each month.",
    meansOfVerificationAr: "محاضر لجنة التحقق التي تسرد الإشارات المقبولة كل شهر.",
    notesEn: "Signals rejected by the panel are archived but not counted.",
    notesAr: "تؤرشف الإشارات المرفوضة من اللجنة ولا تحتسب.",
    performance: "on_target",
  },
  {
    code: "CI-052",
    nodeCode: "G3.IO1.OP2",
    nameEn: "Briefing items with an assigned follow up owner",
    nameAr: "بنود الإحاطة التي أسند لها مسؤول متابعة",
    definitionEn:
      "Counts items raised in the strategic risk briefings that were recorded with a named follow up owner and a due date.",
    definitionAr:
      "يحصي البنود المثارة في إحاطات المخاطر الاستراتيجية التي سجلت باسم مسؤول متابعة محدد وتاريخ استحقاق.",
    formulaEn:
      "Number of briefing items with a named owner and a due date divided by the number of briefing items raised, times 100.",
    formulaAr:
      "عدد بنود الإحاطة التي لها مسؤول محدد وتاريخ استحقاق مقسوما على عدد البنود المثارة، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 55,
    targetValue2030: 95,
    dataSourceEn: "Decision log entries created from the briefing packs.",
    dataSourceAr: "قيود سجل القرارات المنشأة من حقائب الإحاطة.",
    meansOfVerificationEn: "Decision log extract showing the owner and due date for each briefing item.",
    meansOfVerificationAr: "مستخرج سجل القرارات الذي يبين المسؤول وتاريخ الاستحقاق لكل بند إحاطة.",
    notesEn: "Items recorded for information only are excluded from the denominator.",
    notesAr: "تستبعد من المقام البنود المسجلة للعلم فقط.",
    performance: "on_target",
  },
  {
    code: "CI-053",
    nodeCode: "G3.IO2.OP1",
    nameEn: "Scenario workshops held with national entities",
    nameAr: "ورش السيناريوهات المنفذة مع الجهات الوطنية",
    definitionEn:
      "Counts facilitated scenario workshops delivered with government entities during the month as part of the national scenario programme.",
    definitionAr:
      "يحصي ورش السيناريوهات الميسرة المنفذة مع الجهات الحكومية خلال الشهر ضمن برنامج السيناريوهات الوطني.",
    formulaEn: "Count of facilitated scenario workshops completed in the month.",
    formulaAr: "عدد ورش السيناريوهات الميسرة المكتملة خلال الشهر.",
    unit: "number",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 1,
    targetValue2030: 5,
    dataSourceEn: "Workshop schedule of the National Visions Department.",
    dataSourceAr: "جدول الورش لدى إدارة الرؤى الوطنية.",
    meansOfVerificationEn: "Workshop attendance sheets and the output notes filed with the scenario workbench.",
    meansOfVerificationAr: "كشوف حضور الورش ومذكرات المخرجات المحفوظة مع منصة إعداد السيناريوهات.",
    notesEn: "Internal preparation meetings are not counted as workshops.",
    notesAr: "لا تحتسب اجتماعات التحضير الداخلية ضمن الورش.",
    performance: "at_risk",
  },
  {
    code: "CI-054",
    nodeCode: "G3.IO2.OP2",
    nameEn: "Behavioural nudges live in national services",
    nameAr: "التدخلات السلوكية المطبقة في الخدمات الوطنية",
    definitionEn:
      "Counts behavioural interventions that completed a trial and are now running permanently inside a live government service.",
    definitionAr:
      "يحصي التدخلات السلوكية التي أكملت تجربتها وأصبحت تعمل بصفة دائمة داخل خدمة حكومية قائمة.",
    formulaEn: "Cumulative count of tested interventions adopted permanently into a live service.",
    formulaAr: "العدد التراكمي للتدخلات المختبرة التي اعتمدت بصفة دائمة في خدمة قائمة.",
    unit: "number",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 2,
    targetValue2030: 24,
    dataSourceEn: "Behavioural trial register and partner entity confirmations.",
    dataSourceAr: "سجل التجارب السلوكية وتأكيدات الجهات الشريكة.",
    meansOfVerificationEn: "Adoption confirmation letter from the service owning entity.",
    meansOfVerificationAr: "خطاب تأكيد التبني من الجهة المالكة للخدمة.",
    notesEn: "An intervention withdrawn from service is removed from the cumulative count.",
    notesAr: "يحذف التدخل الذي سحب من الخدمة من العدد التراكمي.",
    performance: "on_target",
  },
  {
    code: "CI-055",
    nodeCode: "G3.IO2.OP3",
    nameEn: "Entities with a trained foresight focal point",
    nameAr: "الجهات التي لديها ضابط ارتباط مدرب للاستشراف",
    definitionEn:
      "Counts government entities that have nominated a foresight focal point who has completed the practitioner academy and is still in post.",
    definitionAr:
      "يحصي الجهات الحكومية التي رشحت ضابط ارتباط للاستشراف أكمل أكاديمية الممارسين وما زال على رأس العمل.",
    formulaEn: "Count of entities with a trained focal point currently in post.",
    formulaAr: "عدد الجهات التي لديها ضابط ارتباط مدرب قائم على رأس العمل.",
    unit: "number",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 5,
    targetValue2030: 45,
    dataSourceEn: "Foresight network roster and the learning management system records.",
    dataSourceAr: "كشف شبكة الاستشراف وسجلات نظام إدارة التعلم.",
    meansOfVerificationEn: "Entity nomination letters matched with academy completion records.",
    meansOfVerificationAr: "خطابات ترشيح الجهات مطابقة بسجلات إتمام الأكاديمية.",
    notesEn: "An entity whose focal point leaves the post stops counting until a replacement is trained.",
    notesAr: "تتوقف الجهة عن الاحتساب إذا ترك ضابط ارتباطها الوظيفة حتى يدرب بديل عنه.",
    performance: "behind",
  },
  {
    code: "CI-056",
    nodeCode: "G4.IO1.OP1",
    nameEn: "Excellence and audit findings closed within the agreed period",
    nameAr: "ملاحظات التميز والتدقيق المقفلة ضمن المدة المتفق عليها",
    definitionEn:
      "Counts improvement actions raised by the excellence self assessment or by internal audit that were closed by their agreed date.",
    definitionAr:
      "يحصي إجراءات التحسين الناشئة عن التقييم الذاتي للتميز أو عن التدقيق الداخلي التي أقفلت في تاريخها المتفق عليه.",
    formulaEn:
      "Number of findings closed by the agreed date divided by the number of findings due in the month, times 100.",
    formulaAr:
      "عدد الملاحظات المقفلة في التاريخ المتفق عليه مقسوما على عدد الملاحظات المستحقة خلال الشهر، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 61,
    targetValue2030: 95,
    dataSourceEn: "Excellence assessment system and the internal audit follow up register.",
    dataSourceAr: "نظام تقييم التميز وسجل متابعة التدقيق الداخلي.",
    meansOfVerificationEn: "Closure evidence reviewed and accepted by the assessor or the auditor.",
    meansOfVerificationAr: "أدلة الإقفال التي راجعها المقيم أو المدقق وقبلها.",
    notesEn: "A finding closed without accepted evidence is treated as still open.",
    notesAr: "تعامل الملاحظة المقفلة دون أدلة مقبولة على أنها ما زالت مفتوحة.",
    performance: "on_target",
  },
  {
    code: "CI-057",
    nodeCode: "G4.IO1.OP2",
    nameEn: "Critical roles with a documented handover file",
    nameAr: "الأدوار الحرجة التي لها ملف تسليم موثق",
    definitionEn:
      "Counts roles on the critical role list that hold a current handover file meeting the agreed content standard.",
    definitionAr:
      "يحصي الأدوار المدرجة في قائمة الأدوار الحرجة التي لها ملف تسليم محدث يستوفي معيار المحتوى المتفق عليه.",
    formulaEn:
      "Number of critical roles with a current compliant handover file divided by the number of critical roles, times 100.",
    formulaAr:
      "عدد الأدوار الحرجة التي لها ملف تسليم محدث ومطابق مقسوما على عدد الأدوار الحرجة، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 30,
    targetValue2030: 95,
    dataSourceEn: "Knowledge portal handover file library and the human resources role list.",
    dataSourceAr: "مكتبة ملفات التسليم في بوابة المعرفة وقائمة الأدوار في الموارد البشرية.",
    meansOfVerificationEn: "File review checklist completed by the knowledge management team.",
    meansOfVerificationAr: "قائمة تحقق مراجعة الملفات التي يكملها فريق إدارة المعرفة.",
    notesEn: "A handover file older than twelve months is treated as not current.",
    notesAr: "يعد ملف التسليم الذي مضى عليه أكثر من اثني عشر شهرا غير محدث.",
    performance: "at_risk",
  },
  {
    code: "CI-058",
    nodeCode: "G4.IO2.OP1",
    nameEn: "Paper based transactions remaining in core processes",
    nameAr: "المعاملات الورقية المتبقية في الإجراءات الأساسية",
    definitionEn:
      "Counts transactions in the Council's core processes that still required a printed form or a wet signature during the month.",
    definitionAr:
      "يحصي المعاملات في إجراءات المجلس الأساسية التي ما زالت تتطلب نموذجا مطبوعا أو توقيعا ورقيا خلال الشهر.",
    formulaEn: "Count of transactions completed with a printed form or a wet signature in the month.",
    formulaAr: "عدد المعاملات المنجزة بنموذج مطبوع أو توقيع ورقي خلال الشهر.",
    unit: "number",
    direction: "down_good",
    frequency: "monthly",
    baselineValue: 180,
    targetValue2030: 10,
    dataSourceEn: "Registry records and the process automation engine exception log.",
    dataSourceAr: "سجلات الديوان وسجل الاستثناءات في محرك أتمتة الإجراءات.",
    meansOfVerificationEn: "Monthly registry count reconciled with the automation exception report.",
    meansOfVerificationAr: "عد الديوان الشهري مطابقا بتقرير استثناءات الأتمتة.",
    notesEn: "Documents that must be paper by law are listed separately and excluded from the count.",
    notesAr: "تدرج الوثائق التي يوجب القانون أن تكون ورقية في قائمة منفصلة وتستبعد من العد.",
    performance: "on_target",
  },
  {
    code: "CI-059",
    nodeCode: "G4.IO2.OP2",
    nameEn: "Unresolved high severity security findings",
    nameAr: "الملاحظات الأمنية عالية الخطورة غير المعالجة",
    definitionEn:
      "Counts security findings rated high or critical that remain open beyond their remediation deadline at the end of the month.",
    definitionAr:
      "يحصي الملاحظات الأمنية المصنفة عالية أو حرجة التي تظل مفتوحة بعد انقضاء موعد معالجتها في نهاية الشهر.",
    formulaEn: "Count of high or critical findings open past their remediation deadline at month end.",
    formulaAr: "عدد الملاحظات العالية أو الحرجة المفتوحة بعد موعد معالجتها في نهاية الشهر.",
    unit: "number",
    direction: "down_good",
    frequency: "monthly",
    baselineValue: 14,
    targetValue2030: 0,
    dataSourceEn: "Security operations platform finding register.",
    dataSourceAr: "سجل الملاحظات في منصة عمليات الأمن السيبراني.",
    meansOfVerificationEn: "Monthly security posture report signed by the information security manager.",
    meansOfVerificationAr: "تقرير الوضع الأمني الشهري الموقع من مدير أمن المعلومات.",
    notesEn: "A finding with a formally accepted risk still counts until the underlying weakness is fixed.",
    notesAr: "تظل الملاحظة محتسبة حتى لو قبلت المخاطرة رسميا وذلك إلى حين معالجة الضعف الأساسي.",
    performance: "on_target",
  },
  {
    code: "CI-060",
    nodeCode: "G4.IO2.OP3",
    nameEn: "Internal indicators updated on time in the cockpit",
    nameAr: "المؤشرات الداخلية المحدثة في موعدها في القمرة",
    definitionEn:
      "Counts Council internal performance indicators whose value for the month was entered or refreshed by the agreed update date.",
    definitionAr:
      "يحصي مؤشرات الأداء الداخلية للمجلس التي أدخلت قيمتها الشهرية أو حدثت في تاريخ التحديث المتفق عليه.",
    formulaEn:
      "Number of indicators updated by the agreed date divided by the number of indicators due for update, times 100.",
    formulaAr:
      "عدد المؤشرات المحدثة في التاريخ المتفق عليه مقسوما على عدد المؤشرات المستحقة التحديث، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 52,
    targetValue2030: 95,
    dataSourceEn: "Internal performance cockpit update log.",
    dataSourceAr: "سجل التحديث في قمرة الأداء الداخلية.",
    meansOfVerificationEn: "System update timestamps compared with the agreed monthly update calendar.",
    meansOfVerificationAr: "طوابع وقت التحديث في النظام مقارنة بتقويم التحديث الشهري المتفق عليه.",
    notesEn: "Indicators fed automatically count as updated when the feed runs successfully.",
    notesAr: "تعد المؤشرات المغذاة آليا محدثة عند نجاح تشغيل التغذية.",
    performance: "on_target",
  },
  {
    code: "CI-061",
    nodeCode: "G5.IO1.OP1",
    nameEn: "Active partnership agreements with measurable deliverables",
    nameAr: "اتفاقيات الشراكة النشطة ذات مخرجات قابلة للقياس",
    definitionEn:
      "Counts partnership agreements in force whose annex lists at least one dated and measurable deliverable for the current year.",
    definitionAr:
      "يحصي اتفاقيات الشراكة السارية التي يتضمن ملحقها مخرجا واحدا على الأقل محدد التاريخ وقابلا للقياس للسنة الجارية.",
    formulaEn: "Count of agreements in force with at least one dated measurable deliverable for the year.",
    formulaAr: "عدد الاتفاقيات السارية التي لها مخرج واحد على الأقل محدد التاريخ وقابل للقياس خلال السنة.",
    unit: "number",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 6,
    targetValue2030: 30,
    dataSourceEn: "Agreement register maintained by the cooperation department.",
    dataSourceAr: "سجل الاتفاقيات لدى إدارة التعاون.",
    meansOfVerificationEn: "Agreement annexes listing the deliverables and their dates.",
    meansOfVerificationAr: "ملاحق الاتفاقيات التي تسرد المخرجات وتواريخها.",
    notesEn: "Memoranda of understanding without deliverables are excluded from this count.",
    notesAr: "تستبعد من هذا العد مذكرات التفاهم التي لا تتضمن مخرجات.",
    performance: "on_target",
  },
  {
    code: "CI-062",
    nodeCode: "G5.IO1.OP2",
    nameEn: "Global questionnaires answered with validated national data",
    nameAr: "الاستبانات الدولية المجاب عنها ببيانات وطنية مدققة",
    definitionEn:
      "Counts international indicator questionnaires answered using national figures verified by the National Statistics Center rather than external estimates.",
    definitionAr:
      "يحصي استبانات المؤشرات الدولية المجاب عنها بأرقام وطنية مدققة من مركز الإحصاء الوطني بدلا من التقديرات الخارجية.",
    formulaEn:
      "Number of questionnaires answered with verified national data divided by the number of questionnaires answered, times 100.",
    formulaAr:
      "عدد الاستبانات المجاب عنها ببيانات وطنية مدققة مقسوما على عدد الاستبانات المجاب عنها، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 68,
    targetValue2030: 100,
    dataSourceEn: "International indicators register and the statistics verification notes.",
    dataSourceAr: "سجل المؤشرات الدولية ومذكرات التحقق الإحصائي.",
    meansOfVerificationEn: "Verification note signed by the responsible statistical department for each answer.",
    meansOfVerificationAr: "مذكرة التحقق الموقعة من الإدارة الإحصائية المسؤولة عن كل إجابة.",
    notesEn: "Questions left blank because no national data exists are excluded from the denominator.",
    notesAr: "تستبعد من المقام الأسئلة المتروكة فارغة لعدم توافر بيانات وطنية.",
    performance: "at_risk",
  },
  {
    code: "CI-063",
    nodeCode: "G5.IO2.OP1",
    nameEn: "Publications issued against the annual publication plan",
    nameAr: "الإصدارات الصادرة وفق خطة الإصدارات السنوية",
    definitionEn:
      "Counts publications issued in the month that were listed in the annual communication and publication plan, as a share of those planned for the month.",
    definitionAr:
      "يحصي الإصدارات الصادرة خلال الشهر والمدرجة في الخطة السنوية للاتصال والإصدارات، منسوبة إلى المخطط لها في الشهر.",
    formulaEn:
      "Number of planned publications issued in the month divided by the number planned for that month, times 100.",
    formulaAr:
      "عدد الإصدارات المخطط لها والصادرة خلال الشهر مقسوما على العدد المخطط له في ذلك الشهر، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 72,
    targetValue2030: 98,
    dataSourceEn: "Publication workflow records of Public Relations and Communication.",
    dataSourceAr: "سجلات مسار عمل الإصدارات لدى إدارة العلاقات العامة والاتصال.",
    meansOfVerificationEn: "Issued publication list compared with the approved annual plan.",
    meansOfVerificationAr: "قائمة الإصدارات الصادرة مقارنة بالخطة السنوية المعتمدة.",
    notesEn: "Unplanned publications are reported separately and do not raise this figure.",
    notesAr: "ترفع الإصدارات غير المخطط لها في تقرير منفصل ولا ترفع هذا الرقم.",
    performance: "on_target",
  },
  {
    code: "CI-064",
    nodeCode: "G5.IO2.OP2",
    nameEn: "Days from a Council session to circulation of approved minutes",
    nameAr: "عدد الأيام من جلسة المجلس حتى تعميم المحضر المعتمد",
    definitionEn:
      "Measures the average number of working days between a Council session and the circulation of its approved minutes to members.",
    definitionAr:
      "يقيس متوسط عدد أيام العمل بين انعقاد جلسة المجلس وتعميم محضرها المعتمد على الأعضاء.",
    formulaEn:
      "Sum of working days between each session and the circulation of its approved minutes divided by the number of sessions held.",
    formulaAr:
      "مجموع أيام العمل بين كل جلسة وتعميم محضرها المعتمد مقسوما على عدد الجلسات المنعقدة.",
    unit: "days",
    direction: "down_good",
    frequency: "monthly",
    baselineValue: 12,
    targetValue2030: 3,
    dataSourceEn: "Council Sessions Affairs minutes register.",
    dataSourceAr: "سجل المحاضر لدى إدارة شؤون جلسات المجلس.",
    meansOfVerificationEn: "Session dates and minute circulation timestamps held in the document repository.",
    meansOfVerificationAr: "تواريخ الجلسات وطوابع وقت تعميم المحاضر المحفوظة في مستودع الوثائق.",
    notesEn: "The clock stops when the approved minutes are sent, not when the draft is prepared.",
    notesAr: "يتوقف احتساب المدة عند إرسال المحضر المعتمد لا عند إعداد المسودة.",
    performance: "on_target",
  },
  /* ================= project level ================= */
  {
    code: "CI-065",
    nodeCode: "CP-01",
    nameEn: "Manual chapters issued in final bilingual form",
    nameAr: "فصول الدليل الصادرة بصيغتها النهائية باللغتين",
    definitionEn:
      "Counts chapters of the third edition planning manual approved and published in both Arabic and English, as a share of the planned chapters.",
    definitionAr:
      "يحصي فصول الإصدار الثالث من دليل التخطيط المعتمدة والمنشورة بالعربية والإنجليزية معا، منسوبة إلى الفصول المخططة.",
    formulaEn:
      "Number of chapters published in both languages divided by the total number of planned chapters, times 100.",
    formulaAr:
      "عدد الفصول المنشورة باللغتين مقسوما على إجمالي الفصول المخططة، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 0,
    targetValue2030: 100,
    dataSourceEn: "Council document repository version records for the manual.",
    dataSourceAr: "سجلات إصدارات الدليل في مستودع وثائق المجلس.",
    meansOfVerificationEn: "Published manual chapters with their approval memoranda.",
    meansOfVerificationAr: "فصول الدليل المنشورة مع مذكرات اعتمادها.",
    notesEn: "A chapter published in one language only is not counted.",
    notesAr: "لا يحتسب الفصل المنشور بلغة واحدة فقط.",
    performance: "on_target",
  },
  {
    code: "CI-066",
    nodeCode: "CP-02",
    nameEn: "Planning templates available as validated digital forms",
    nameAr: "نماذج التخطيط المتاحة كنماذج رقمية بقواعد تحقق",
    definitionEn:
      "Counts manual annex templates that are live as digital forms with their validation rules active on the forms platform.",
    definitionAr:
      "يحصي نماذج ملاحق الدليل المتاحة فعليا كنماذج رقمية مع تفعيل قواعد التحقق الخاصة بها على منصة النماذج.",
    formulaEn: "Cumulative count of templates live as digital forms with active validation rules.",
    formulaAr: "العدد التراكمي للنماذج المتاحة رقميا مع قواعد تحقق مفعلة.",
    unit: "number",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 0,
    targetValue2030: 18,
    dataSourceEn: "Government forms platform configuration records.",
    dataSourceAr: "سجلات الإعداد في منصة النماذج الحكومية.",
    meansOfVerificationEn: "Form release notes showing the validation rules enabled for each template.",
    meansOfVerificationAr: "مذكرات إطلاق النماذج التي تبين قواعد التحقق المفعلة لكل نموذج.",
    notesEn: "A form published without its validation rules counts only when the rules go live.",
    notesAr: "لا يحتسب النموذج المنشور دون قواعد تحققه إلا عند تفعيل تلك القواعد.",
    performance: "on_target",
  },
  {
    code: "CI-067",
    nodeCode: "CP-03",
    nameEn: "Cohorts completing the certified planner programme",
    nameAr: "الدفعات المكملة لبرنامج المخطط المعتمد",
    definitionEn:
      "Counts cohorts that finished all four modules and sat the final examination of the certified government planner programme.",
    definitionAr:
      "يحصي الدفعات التي أنهت الوحدات الأربع وأدت الامتحان النهائي لبرنامج المخطط الحكومي المعتمد.",
    formulaEn: "Cumulative count of cohorts that completed all modules and the final examination.",
    formulaAr: "العدد التراكمي للدفعات التي أكملت جميع الوحدات والامتحان النهائي.",
    unit: "number",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 0,
    targetValue2030: 12,
    dataSourceEn: "Learning management system cohort records.",
    dataSourceAr: "سجلات الدفعات في نظام إدارة التعلم.",
    meansOfVerificationEn: "Cohort closure report with the examination results attached.",
    meansOfVerificationAr: "تقرير إقفال الدفعة مرفقا به نتائج الامتحان.",
    notesEn: "The Arabic and English streams of one intake count as a single cohort.",
    notesAr: "يعد المساران العربي والإنجليزي للدفعة الواحدة دفعة واحدة.",
    performance: "on_target",
  },
  {
    code: "CI-068",
    nodeCode: "CP-04",
    nameEn: "Community of practice sessions held with entity planners",
    nameAr: "جلسات مجتمع الممارسة المنفذة مع مخططي الجهات",
    definitionEn:
      "Counts quarterly community of practice sessions actually held with entity planners, with attendance recorded and notes published.",
    definitionAr:
      "يحصي الجلسات الفصلية لمجتمع الممارسة التي عقدت فعليا مع مخططي الجهات وسجل حضورها ونشرت محاضرها.",
    formulaEn: "Cumulative count of sessions held with recorded attendance and published notes since 2025.",
    formulaAr: "العدد التراكمي للجلسات المعقودة بحضور مسجل ومحاضر منشورة منذ عام 2025.",
    unit: "number",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 0,
    targetValue2030: 20,
    dataSourceEn: "Collaboration workspace session records.",
    dataSourceAr: "سجلات الجلسات في مساحة العمل التشاركية.",
    meansOfVerificationEn: "Attendance lists and the session notes published to the workspace.",
    meansOfVerificationAr: "كشوف الحضور ومحاضر الجلسات المنشورة على مساحة العمل.",
    notesEn: "A session with fewer than five entities represented is recorded but not counted.",
    notesAr: "تسجل الجلسة التي يقل تمثيل الجهات فيها عن خمس جهات ولا تحتسب.",
    performance: "on_target",
  },
  {
    code: "CI-069",
    nodeCode: "CP-05",
    nameEn: "Strategy reviews completed within the sixty day window",
    nameAr: "مراجعات الاستراتيجيات المنجزة ضمن نافذة الستين يوما",
    definitionEn:
      "Counts gateway reviews that returned a scored report within sixty calendar days of accepting the strategy for review.",
    definitionAr:
      "يحصي مراجعات البوابة التي أعادت تقريرا مقيما بالدرجات خلال ستين يوما تقويميا من قبول الاستراتيجية للمراجعة.",
    formulaEn:
      "Number of reviews returned within sixty days divided by the number of reviews completed in the quarter, times 100.",
    formulaAr:
      "عدد المراجعات المعادة خلال ستين يوما مقسوما على عدد المراجعات المنجزة خلال الربع، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 45,
    targetValue2030: 95,
    dataSourceEn: "Review case tracker timestamps.",
    dataSourceAr: "طوابع الوقت في نظام تتبع حالات المراجعة.",
    meansOfVerificationEn: "Case records showing the acceptance date and the report issue date.",
    meansOfVerificationAr: "سجلات الحالات التي تبين تاريخ القبول وتاريخ إصدار التقرير.",
    notesEn: "Time waiting for missing annexes from the entity is excluded from the sixty days.",
    notesAr: "يستبعد من الستين يوما الوقت المنقضي في انتظار الملاحق الناقصة من الجهة.",
    performance: "at_risk",
  },
  {
    code: "CI-070",
    nodeCode: "CP-06",
    nameEn: "Sector strategies audited for alignment with NDS3",
    nameAr: "الاستراتيجيات القطاعية المدققة لمواءمتها مع الاستراتيجية الوطنية",
    definitionEn:
      "Counts sector strategies for which every objective has been coded against the NDS3 outcome tree and an alignment report issued.",
    definitionAr:
      "يحصي الاستراتيجيات القطاعية التي رمزت جميع أهدافها وفق شجرة نتائج الاستراتيجية الوطنية وصدر لها تقرير مواءمة.",
    formulaEn: "Cumulative count of sector strategies with a completed alignment report.",
    formulaAr: "العدد التراكمي للاستراتيجيات القطاعية التي اكتمل لها تقرير مواءمة.",
    unit: "number",
    direction: "up_good",
    frequency: "quarterly",
    baselineValue: 2,
    targetValue2030: 18,
    dataSourceEn: "Alignment matrix workbook and the strategy management system.",
    dataSourceAr: "مصنف مصفوفة المواءمة ونظام إدارة الاستراتيجية.",
    meansOfVerificationEn: "Alignment report issued to the sector planning committee for each strategy.",
    meansOfVerificationAr: "تقرير المواءمة المرفوع إلى لجنة التخطيط القطاعية عن كل استراتيجية.",
    notesEn: "A partially coded strategy is not counted until every objective has been mapped.",
    notesAr: "لا تحتسب الاستراتيجية المرمزة جزئيا حتى يربط كل هدف من أهدافها.",
    performance: "behind",
  },
  {
    code: "CI-071",
    nodeCode: "CP-07",
    nameEn: "Monitoring framework elements signed off by owning entities",
    nameAr: "عناصر إطار المتابعة المعتمدة من الجهات المالكة",
    definitionEn:
      "Counts NDS3 outcomes whose owner, indicator set and reporting dates have all been confirmed in writing by the owning entity.",
    definitionAr:
      "يحصي نتائج الاستراتيجية الوطنية التي أكدت الجهة المالكة خطيا مالكها ومجموعة مؤشراتها ومواعيد رفع تقاريرها.",
    formulaEn:
      "Number of outcomes with a written sign off divided by the total number of NDS3 outcomes, times 100.",
    formulaAr:
      "عدد النتائج التي لها اعتماد خطي مقسوما على إجمالي نتائج الاستراتيجية الوطنية، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 0,
    targetValue2030: 100,
    dataSourceEn: "NDS3 monitoring system framework records.",
    dataSourceAr: "سجلات الإطار في نظام متابعة الاستراتيجية الوطنية.",
    meansOfVerificationEn: "Signed sign off letters filed against each outcome.",
    meansOfVerificationAr: "خطابات الاعتماد الموقعة المحفوظة مع كل نتيجة.",
    notesEn: "A verbal confirmation in a meeting does not count as a sign off.",
    notesAr: "لا يعد التأكيد الشفوي في اجتماع اعتمادا.",
    performance: "on_target",
  },
  {
    code: "CI-072",
    nodeCode: "CP-08",
    nameEn: "Progress report production milestones met on schedule",
    nameAr: "محطات إنتاج تقرير التقدم المنجزة في موعدها",
    definitionEn:
      "Counts production milestones of the annual progress report, such as data cut off, first draft and translation, completed on the planned date.",
    definitionAr:
      "يحصي محطات إنتاج تقرير التقدم السنوي، مثل إقفال البيانات والمسودة الأولى والترجمة، المنجزة في التاريخ المخطط.",
    formulaEn:
      "Number of milestones met on the planned date divided by the number of milestones due in the month, times 100.",
    formulaAr:
      "عدد المحطات المنجزة في التاريخ المخطط مقسوما على عدد المحطات المستحقة خلال الشهر، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 70,
    targetValue2030: 100,
    dataSourceEn: "Publication workflow schedule for the progress report.",
    dataSourceAr: "جدول مسار عمل النشر الخاص بتقرير التقدم.",
    meansOfVerificationEn: "Workflow completion records for each production milestone.",
    meansOfVerificationAr: "سجلات إنجاز مسار العمل لكل محطة إنتاج.",
    notesEn: "A milestone completed early counts as met.",
    notesAr: "تعد المحطة المنجزة قبل موعدها محققة.",
    performance: "on_target",
  },
  {
    code: "CI-073",
    nodeCode: "CP-09",
    nameEn: "Delivery clinics held with lagging initiative owners",
    nameAr: "عيادات التنفيذ المنعقدة مع مالكي المبادرات المتعثرة",
    definitionEn:
      "Counts structured delivery clinics held with the owner of a lagging initiative that closed with a dated recovery plan.",
    definitionAr:
      "يحصي عيادات التنفيذ المنظمة المنعقدة مع مالك مبادرة متعثرة والتي انتهت بخطة تعاف محددة التواريخ.",
    formulaEn: "Cumulative count of clinics closed with a dated recovery plan since 2025.",
    formulaAr: "العدد التراكمي للعيادات المقفلة بخطة تعاف محددة التواريخ منذ عام 2025.",
    unit: "number",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 0,
    targetValue2030: 60,
    dataSourceEn: "Delivery case files of the economic and environmental implementation support department.",
    dataSourceAr: "ملفات حالات التنفيذ لدى إدارة دعم تنفيذ الخطط الاقتصادية والبيئية.",
    meansOfVerificationEn: "Recovery plan signed by the initiative owner at the end of the clinic.",
    meansOfVerificationAr: "خطة التعافي الموقعة من مالك المبادرة في ختام العيادة.",
    notesEn: "A clinic that ends without a signed recovery plan is not counted.",
    notesAr: "لا تحتسب العيادة التي تنتهي دون خطة تعاف موقعة.",
    performance: "behind",
  },
  {
    code: "CI-074",
    nodeCode: "CP-10",
    nameEn: "Entities using the human and social implementation toolkit",
    nameAr: "الجهات المستخدمة لحقيبة دعم التنفيذ البشري والاجتماعي",
    definitionEn:
      "Counts human and social sector entities that have applied at least one instrument from the implementation support toolkit in a live programme.",
    definitionAr:
      "يحصي جهات قطاعي التنمية البشرية والاجتماعية التي طبقت أداة واحدة على الأقل من حقيبة دعم التنفيذ في برنامج قائم.",
    formulaEn: "Cumulative count of entities confirmed to have applied at least one toolkit instrument.",
    formulaAr: "العدد التراكمي للجهات التي ثبت تطبيقها أداة واحدة على الأقل من الحقيبة.",
    unit: "number",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 0,
    targetValue2030: 22,
    dataSourceEn: "Knowledge portal download records and implementation support follow up notes.",
    dataSourceAr: "سجلات التنزيل في بوابة المعرفة ومذكرات متابعة دعم التنفيذ.",
    meansOfVerificationEn: "Follow up note confirming the instrument in use in a named programme.",
    meansOfVerificationAr: "مذكرة المتابعة التي تؤكد استخدام الأداة في برنامج محدد بالاسم.",
    notesEn: "Downloading the toolkit without applying an instrument does not count.",
    notesAr: "لا يحتسب تنزيل الحقيبة دون تطبيق أي أداة منها.",
    performance: "on_target",
  },
  {
    code: "CI-075",
    nodeCode: "CP-11",
    nameEn: "Data feeds connected to the national delivery dashboard",
    nameAr: "تدفقات البيانات الموصولة بلوحة المتابعة الوطنية",
    definitionEn:
      "Counts automated data feeds from source systems that are live and refreshing dashboard content on their agreed schedule.",
    definitionAr:
      "يحصي تدفقات البيانات الآلية من نظم المصدر التي تعمل فعليا وتحدث محتوى اللوحة وفق جدولها المتفق عليه.",
    formulaEn: "Count of live feeds refreshing on schedule at the end of the month.",
    formulaAr: "عدد التدفقات العاملة التي تحدث وفق جدولها في نهاية الشهر.",
    unit: "number",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 3,
    targetValue2030: 48,
    dataSourceEn: "Data integration platform feed monitor.",
    dataSourceAr: "مراقب التدفقات في منصة تكامل البيانات.",
    meansOfVerificationEn: "Feed monitor report showing the last successful refresh for each feed.",
    meansOfVerificationAr: "تقرير مراقب التدفقات الذي يبين آخر تحديث ناجح لكل تدفق.",
    notesEn: "A feed that has failed for more than two consecutive cycles stops counting as live.",
    notesAr: "يتوقف احتساب التدفق عاملا إذا أخفق أكثر من دورتين متتاليتين.",
    performance: "on_target",
  },
  {
    code: "CI-076",
    nodeCode: "CP-12",
    nameEn: "Leadership delivery reviews held in the briefing room",
    nameAr: "مراجعات التنفيذ القيادية المنعقدة في غرفة الإحاطة",
    definitionEn:
      "Counts delivery review meetings held in the leadership briefing room using the dashboard, with decisions recorded in the decision log.",
    definitionAr:
      "يحصي اجتماعات مراجعة التنفيذ المنعقدة في غرفة الإحاطة القيادية باستخدام اللوحة، مع تسجيل قراراتها في سجل القرارات.",
    formulaEn: "Cumulative count of delivery reviews held in the room with logged decisions since 2025.",
    formulaAr: "العدد التراكمي لمراجعات التنفيذ المنعقدة في الغرفة مع تسجيل قراراتها منذ عام 2025.",
    unit: "number",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 0,
    targetValue2030: 55,
    dataSourceEn: "Office of the Secretary General meeting schedule and the decision log.",
    dataSourceAr: "جدول اجتماعات مكتب الأمين العام وسجل القرارات.",
    meansOfVerificationEn: "Meeting records linked to the decisions logged in the same session.",
    meansOfVerificationAr: "سجلات الاجتماعات مرتبطة بالقرارات المسجلة في الجلسة نفسها.",
    notesEn: "Reviews held elsewhere while the room is being fitted out are not counted.",
    notesAr: "لا تحتسب المراجعات المنعقدة في مكان آخر أثناء تجهيز الغرفة.",
    performance: "behind",
  },
  {
    code: "CI-077",
    nodeCode: "CP-13",
    nameEn: "Model equations validated against historical national accounts",
    nameAr: "معادلات النموذج المتحقق منها مقابل الحسابات القومية التاريخية",
    definitionEn:
      "Counts behavioural and accounting equations of the macroeconomic model whose fit against the historical series meets the agreed validation criteria.",
    definitionAr:
      "يحصي المعادلات السلوكية والمحاسبية في النموذج الاقتصادي الكلي التي يستوفي تطابقها مع السلاسل التاريخية معايير التحقق المتفق عليها.",
    formulaEn:
      "Number of equations meeting the validation criteria divided by the total number of model equations, times 100.",
    formulaAr:
      "عدد المعادلات المستوفية لمعايير التحقق مقسوما على إجمالي معادلات النموذج، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 0,
    targetValue2030: 100,
    dataSourceEn: "Policy simulation platform validation logs.",
    dataSourceAr: "سجلات التحقق في منصة محاكاة السياسات.",
    meansOfVerificationEn: "Validation output sheets reviewed by the modelling lead and the peer reviewer.",
    meansOfVerificationAr: "استمارات مخرجات التحقق التي يراجعها رئيس فريق النمذجة والمراجع النظير.",
    notesEn: "Equations still under calibration count as not validated.",
    notesAr: "تعد المعادلات التي ما زالت قيد المعايرة غير متحقق منها.",
    performance: "at_risk",
  },
  {
    code: "CI-078",
    nodeCode: "CP-14",
    nameEn: "Labour market scenarios produced and reviewed",
    nameAr: "سيناريوهات سوق العمل المنتجة والمراجعة",
    definitionEn:
      "Counts labour market scenarios run on the microsimulation model and reviewed by the technical advisory group before release.",
    definitionAr:
      "يحصي سيناريوهات سوق العمل المشغلة على نموذج المحاكاة الجزئية والمراجعة من الفريق الاستشاري الفني قبل إصدارها.",
    formulaEn: "Cumulative count of scenarios run and signed off by the technical advisory group.",
    formulaAr: "العدد التراكمي للسيناريوهات المشغلة والمعتمدة من الفريق الاستشاري الفني.",
    unit: "number",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 0,
    targetValue2030: 9,
    dataSourceEn: "Policy simulation platform scenario register.",
    dataSourceAr: "سجل السيناريوهات في منصة محاكاة السياسات.",
    meansOfVerificationEn: "Technical advisory group minutes recording the review of each scenario.",
    meansOfVerificationAr: "محاضر الفريق الاستشاري الفني التي توثق مراجعة كل سيناريو.",
    notesEn: "Exploratory runs used to test the model are not counted as scenarios.",
    notesAr: "لا تحتسب عمليات التشغيل الاستكشافية المستخدمة لاختبار النموذج سيناريوهات.",
    performance: "at_risk",
  },
  {
    code: "CI-079",
    nodeCode: "CP-15",
    nameEn: "Rapid evaluation requests completed within thirty working days",
    nameAr: "طلبات التقييم السريع المنجزة خلال ثلاثين يوم عمل",
    definitionEn:
      "Counts policy lab rapid evaluation requests delivered to the requesting entity within thirty working days of acceptance.",
    definitionAr:
      "يحصي طلبات التقييم السريع في مختبر السياسات المسلمة إلى الجهة الطالبة خلال ثلاثين يوم عمل من قبولها.",
    formulaEn:
      "Number of requests delivered within thirty working days divided by the number of requests delivered in the month, times 100.",
    formulaAr:
      "عدد الطلبات المسلمة خلال ثلاثين يوم عمل مقسوما على عدد الطلبات المسلمة خلال الشهر، مضروبا في 100.",
    unit: "percent",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 50,
    targetValue2030: 90,
    dataSourceEn: "Policy lab case tracker delivery records.",
    dataSourceAr: "سجلات التسليم في نظام تتبع حالات مختبر السياسات.",
    meansOfVerificationEn: "Delivery confirmation from the requesting entity held against each case.",
    meansOfVerificationAr: "تأكيد التسليم من الجهة الطالبة المحفوظ مع كل حالة.",
    notesEn: "Requests withdrawn by the entity before delivery are excluded from the denominator.",
    notesAr: "تستبعد من المقام الطلبات التي تسحبها الجهة قبل التسليم.",
    performance: "on_target",
  },
  {
    code: "CI-080",
    nodeCode: "CP-16",
    nameEn: "Draft policies screened for regulatory impact",
    nameAr: "مسودات السياسات المفحوصة لتقييم الأثر التنظيمي",
    definitionEn:
      "Counts draft policies that completed a light regulatory impact assessment, with compliance cost and distributional effects estimated, before entering the legislative track.",
    definitionAr:
      "يحصي مسودات السياسات التي أكملت تقييما مبسطا للأثر التنظيمي بتقدير كلفة الامتثال والآثار التوزيعية قبل دخولها المسار التشريعي.",
    formulaEn: "Cumulative count of draft policies with a completed regulatory impact assessment.",
    formulaAr: "العدد التراكمي لمسودات السياسات التي اكتمل لها تقييم الأثر التنظيمي.",
    unit: "number",
    direction: "up_good",
    frequency: "monthly",
    baselineValue: 0,
    targetValue2030: 15,
    dataSourceEn: "Policy lab case tracker and the legal drafting system.",
    dataSourceAr: "نظام تتبع حالات مختبر السياسات ونظام الصياغة القانونية.",
    meansOfVerificationEn: "Assessment note attached to the draft policy file before legislative referral.",
    meansOfVerificationAr: "مذكرة التقييم المرفقة بملف مسودة السياسة قبل الإحالة التشريعية.",
    notesEn: "An assessment completed after the policy was referred does not count.",
    notesAr: "لا يحتسب التقييم المنجز بعد إحالة السياسة.",
    performance: "behind",
  },
];
