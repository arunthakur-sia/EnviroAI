// CR07 2.6: illustrative content module B for the Programme Strategy, the projects
// and activities of the Programme Office Institutional Strategy 2025 to 2030.
// Module A carries the strategy header, the goals, the intermediate outcomes and the
// outputs; this module attaches 45 projects to the 30 output codes.
//
// All content here is ILLUSTRATIVE seed material written for the prototype. Names,
// budgets, baselines and targets are plausible but invented, and none of them should
// be read as an official figure of any Saudi public entity.

import type { ProjectSeed } from "./cr07-council-types";

export const PROJECTS: ProjectSeed[] = [
  /* ---------- G1.IO1.OP1 results framework manual and templates ---------- */
  {
    code: "CP-01",
    outputCode: "G1.IO1.OP1",
    titleEn: "Second edition of the NES results framework manual",
    titleAr: "الإصدار الثاني من دليل إطار النتائج للاستراتيجية الوطنية للبيئة",
    descriptionEn:
      "Rewrites the results framework manual around one results chain of goals, intermediate outcomes, outputs and projects, replacing the legacy templates that entity programme teams still use. The edition was issued to all participating entities after clearance by the Strategy Steering Committee.",
    descriptionAr:
      "يعيد صياغة دليل إطار النتائج حول سلسلة نتائج واحدة تضم الأهداف والنتائج الوسيطة والمخرجات والمشاريع، بما يحل محل النماذج القديمة التي ما زالت فرق البرامج في الجهات تستخدمها. وقد صدر الإصدار إلى جميع الجهات المشاركة بعد اعتماده من لجنة توجيه الاستراتيجية.",
    ownerUnitCode: "SPS",
    status: "completed",
    priorityImpact: 5,
    priorityFeasibility: 4,
    budgetQar: 850000,
    inputsEn:
      "Consumes the first edition of the manual, international results based management guidance, and written review comments from participating entities.",
    inputsAr:
      "يستهلك الإصدار الأول من الدليل والأدلة الدولية للإدارة القائمة على النتائج وملاحظات المراجعة المكتوبة الواردة من الجهات المشاركة.",
    people: 7,
    systemsEn: ["Strategy Management System", "Programme Document Repository"],
    systemsAr: ["نظام إدارة الاستراتيجية", "مستودع وثائق البرنامج"],
    activities: [
      {
        titleEn: "Gap analysis of the first edition against current international practice",
        titleAr: "تحليل الفجوة بين الإصدار الأول والممارسات الدولية الحالية",
        status: "completed",
      },
      {
        titleEn: "Drafting and bilingual editing of the new chapters",
        titleAr: "صياغة الفصول الجديدة وتحريرها باللغتين",
        status: "completed",
      },
      {
        titleEn: "Consultation workshops with entity programme teams",
        titleAr: "ورش تشاورية مع فرق البرامج في الجهات",
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
      "Turns the manual annexes into guided digital forms that validate codes, baselines and targets as an entity types them. Submissions arrive already structured, which removes most of the rework the planning quality team used to do by hand.",
    descriptionAr:
      "يحول ملاحق الدليل إلى نماذج رقمية موجهة تتحقق من الرموز وخطوط الأساس والمستهدفات أثناء إدخال الجهة لها. وتصل الطلبات منظمة مسبقا، وهو ما يلغي معظم أعمال إعادة المعالجة اليدوية في إدارة جودة الخطط والمعايير.",
    ownerUnitCode: "PQS",
    status: "on_track",
    priorityImpact: 4,
    priorityFeasibility: 5,
    budgetQar: 420000,
    inputsEn:
      "Consumes the manual annexes, the entity code list, and two analyst months of form design and testing.",
    inputsAr:
      "يستهلك ملاحق الدليل وقائمة رموز الجهات وشهرين من عمل المحللين في تصميم النماذج واختبارها.",
    people: 5,
    systemsEn: ["Strategy Management System", "Digital Forms Platform"],
    systemsAr: ["نظام إدارة الاستراتيجية", "منصة النماذج الرقمية"],
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
    titleEn: "Certified environment programme planner course",
    titleAr: "برنامج المخطط المعتمد للبرامج البيئية",
    descriptionEn:
      "A modular certification for planners in the entities that deliver the National Environment Strategy, covering results chains, indicators, costing and evidence use. Cohorts combine classroom sessions with a live planning assignment from the participant's own entity.",
    descriptionAr:
      "شهادة مهنية مرنة للمخططين في الجهات المنفذة للاستراتيجية الوطنية للبيئة، تغطي سلاسل النتائج والمؤشرات وتقدير التكلفة واستخدام الأدلة. وتجمع كل دفعة بين الجلسات التدريبية ومهمة تخطيط حقيقية من جهة المشارك.",
    ownerUnitCode: "CAP",
    status: "on_track",
    priorityImpact: 5,
    priorityFeasibility: 3,
    budgetQar: 3200000,
    inputsEn:
      "Consumes the manual and templates, a competency framework for planners, and trainer time from the Strategy Office and partner universities.",
    inputsAr:
      "يستهلك الدليل والنماذج وإطار كفايات المخططين ووقت المدربين من مكتب الاستراتيجية والجامعات الشريكة.",
    people: 9,
    systemsEn: ["Learning Management System", "Certification Register", "Strategy Management System"],
    systemsAr: ["نظام إدارة التعلم", "سجل الشهادات", "نظام إدارة الاستراتيجية"],
    activities: [
      {
        titleEn: "Competency framework and curriculum design",
        titleAr: "تصميم إطار الكفايات والمنهج",
        status: "completed",
      },
      {
        titleEn: "Delivery of the second cohort",
        titleAr: "تنفيذ الدفعة الثانية",
        status: "on_track",
      },
      {
        titleEn: "Accreditation of the certificate with partner universities",
        titleAr: "اعتماد الشهادة مع الجامعات الشريكة",
        status: "on_track",
      },
    ],
  },
  {
    code: "CP-04",
    outputCode: "G1.IO1.OP2",
    titleEn: "Community of practice for entity programme planners",
    titleAr: "مجتمع الممارسة لمخططي البرامج في الجهات",
    descriptionEn:
      "A standing network of planners across the environment, water and agriculture entities that meets quarterly to share templates, review difficult cases and test new guidance before it is issued. It costs staff time only.",
    descriptionAr:
      "شبكة دائمة من المخططين في جهات البيئة والمياه والزراعة تجتمع كل ربع سنة لتبادل النماذج ومراجعة الحالات الصعبة واختبار الإرشادات الجديدة قبل إصدارها. ولا تتطلب إلا وقت الموظفين.",
    ownerUnitCode: "SPS",
    status: "on_track",
    priorityImpact: 2,
    priorityFeasibility: 5,
    budgetQar: 0,
    inputsEn:
      "Consumes a shared workspace, quarterly meeting slots and short case notes prepared by member entities.",
    inputsAr:
      "يستهلك مساحة عمل مشتركة ومواعيد اجتماعات ربع سنوية وملاحظات قصيرة عن الحالات تعدها الجهات الأعضاء.",
    people: 4,
    systemsEn: ["Collaboration Workspace", "Programme Document Repository"],
    systemsAr: ["مساحة العمل التعاونية", "مستودع وثائق البرنامج"],
    activities: [
      {
        titleEn: "Founding charter and member nominations",
        titleAr: "ميثاق التأسيس وترشيح الأعضاء",
        status: "completed",
      },
      {
        titleEn: "Quarterly clinics on indicators and baselines",
        titleAr: "عيادات ربع سنوية حول المؤشرات وخطوط الأساس",
        status: "on_track",
      },
    ],
  },

  /* ---------- G1.IO1.OP3 quality assured reviews ---------- */
  {
    code: "CP-05",
    outputCode: "G1.IO1.OP3",
    titleEn: "Strategy quality review gateway",
    titleAr: "بوابة مراجعة جودة الاستراتيجيات",
    descriptionEn:
      "Puts every draft sector and entity strategy through a standard review against the manual before it goes to the Programme Steering Committee. Reviewers score alignment, evidence and deliverability, and the entity receives a written decision with required changes.",
    descriptionAr:
      "يخضع كل مسودة استراتيجية قطاعية أو استراتيجية جهة لمراجعة معيارية وفق الدليل قبل رفعها إلى اللجنة التوجيهية للبرنامج. ويقيم المراجعون الاتساق والأدلة وقابلية التنفيذ، وتتسلم الجهة قرارا مكتوبا بالتعديلات المطلوبة.",
    ownerUnitCode: "PQS",
    status: "on_track",
    priorityImpact: 5,
    priorityFeasibility: 4,
    budgetQar: 1150000,
    inputsEn:
      "Consumes the review checklist, the strategy submissions from entities, and a pool of trained reviewers drawn from the planning quality team.",
    inputsAr:
      "يستهلك قائمة المراجعة وطلبات الاستراتيجيات الواردة من الجهات ومجموعة مراجعين مدربين من فريق جودة الخطط والمعايير.",
    people: 8,
    systemsEn: ["Strategy Management System", "Review Case Tracker"],
    systemsAr: ["نظام إدارة الاستراتيجية", "متتبع حالات المراجعة"],
    activities: [
      {
        titleEn: "Design of the review checklist and scoring rubric",
        titleAr: "تصميم قائمة المراجعة ومعيار التقييم",
        status: "completed",
      },
      {
        titleEn: "Pilot reviews of four entity strategies",
        titleAr: "مراجعات تجريبية لأربع استراتيجيات جهات",
        status: "completed",
      },
      {
        titleEn: "Reviewer calibration sessions",
        titleAr: "جلسات معايرة المراجعين",
        status: "on_track",
      },
      {
        titleEn: "Rollout of the gateway to all new strategies",
        titleAr: "تعميم البوابة على جميع الاستراتيجيات الجديدة",
        status: "on_track",
      },
    ],
  },
  {
    code: "CP-06",
    outputCode: "G1.IO1.OP3",
    titleEn: "Alignment audit of sector strategies against the NES",
    titleAr: "تدقيق اتساق الاستراتيجيات القطاعية مع الاستراتيجية الوطنية للبيئة",
    descriptionEn:
      "Maps the targets of each sector strategy to the NES themes and flags gaps, overlaps and conflicting targets. The first pass found several water and agriculture targets with no matching indicator, and entity responses are slower than planned.",
    descriptionAr:
      "يربط مستهدفات كل استراتيجية قطاعية بمحاور الاستراتيجية الوطنية للبيئة ويرصد الفجوات والتداخلات والمستهدفات المتعارضة. وكشفت الجولة الأولى عدة مستهدفات في المياه والزراعة بلا مؤشر مقابل، وتأتي استجابات الجهات أبطأ من المخطط.",
    ownerUnitCode: "SPS",
    status: "at_risk",
    priorityImpact: 4,
    priorityFeasibility: 2,
    budgetQar: 980000,
    inputsEn:
      "Consumes the sector strategies, the NES target list, and clarification meetings with entity focal points.",
    inputsAr:
      "يستهلك الاستراتيجيات القطاعية وقائمة مستهدفات الاستراتيجية الوطنية للبيئة واجتماعات التوضيح مع منسقي الجهات.",
    people: 6,
    systemsEn: ["Strategy Management System", "Alignment Matrix Workbook"],
    systemsAr: ["نظام إدارة الاستراتيجية", "مصنف مصفوفة الاتساق"],
    activities: [
      {
        titleEn: "Alignment matrix for the first sector strategies",
        titleAr: "مصفوفة الاتساق للاستراتيجيات القطاعية الأولى",
        status: "at_risk",
      },
      {
        titleEn: "Clarification meetings with entity focal points",
        titleAr: "اجتماعات التوضيح مع منسقي الجهات",
        status: "on_track",
      },
      {
        titleEn: "Consolidated gap report to the Strategy Steering Committee",
        titleAr: "تقرير الفجوات الموحد إلى لجنة توجيه الاستراتيجية",
        status: "at_risk",
      },
    ],
  },

  /* ---------- G1.IO2.OP1 monitoring framework and reporting cycle ---------- */
  {
    code: "CP-07",
    outputCode: "G1.IO2.OP1",
    titleEn: "Refresh of the NES monitoring framework",
    titleAr: "تحديث إطار متابعة الاستراتيجية الوطنية للبيئة",
    descriptionEn:
      "Re-baselines the indicator set of the National Environment Strategy, fixes owners and data sources for each indicator, and sets the reporting rhythm. The refreshed framework is the single reference for the programme's progress reports.",
    descriptionAr:
      "يعيد تحديد خطوط الأساس لمؤشرات الاستراتيجية الوطنية للبيئة ويحدد مالكا ومصدر بيانات لكل مؤشر ويضبط إيقاع إعداد التقارير. ويمثل الإطار المحدث المرجع الوحيد لتقارير تقدم البرنامج.",
    ownerUnitCode: "PMD",
    status: "completed",
    priorityImpact: 5,
    priorityFeasibility: 4,
    budgetQar: 1650000,
    inputsEn:
      "Consumes the approved NES results framework, entity indicator submissions, and data availability assessments from GASTAT and the environment regulators.",
    inputsAr:
      "يستهلك إطار نتائج الاستراتيجية الوطنية للبيئة المعتمد ومدخلات المؤشرات من الجهات وتقييمات توافر البيانات من الهيئة العامة للإحصاء والجهات التنظيمية البيئية.",
    people: 10,
    systemsEn: ["NES Monitoring System", "Strategy Management System"],
    systemsAr: ["نظام متابعة الاستراتيجية الوطنية للبيئة", "نظام إدارة الاستراتيجية"],
    activities: [
      {
        titleEn: "Indicator review and re-baselining",
        titleAr: "مراجعة المؤشرات وإعادة تحديد خطوط الأساس",
        status: "completed",
      },
      {
        titleEn: "Assignment of owners and data sources",
        titleAr: "تحديد المالكين ومصادر البيانات",
        status: "completed",
      },
      {
        titleEn: "Approval of the refreshed framework",
        titleAr: "اعتماد الإطار المحدث",
        status: "completed",
      },
    ],
  },
  {
    code: "CP-08",
    outputCode: "G1.IO2.OP1",
    titleEn: "Production line for the annual NES progress report",
    titleAr: "خط إنتاج التقرير السنوي لتقدم الاستراتيجية الوطنية للبيئة",
    descriptionEn:
      "Standardises how the annual progress report is produced, from indicator collection and validation to narrative drafting and clearance. A fixed calendar and shared templates replace the ad hoc drafting of earlier years.",
    descriptionAr:
      "يوحد طريقة إعداد التقرير السنوي لمتابعة التقدم، من جمع المؤشرات والتحقق منها إلى صياغة السرد والاعتماد. ويحل تقويم ثابت ونماذج مشتركة محل الإعداد المرتجل في السنوات السابقة.",
    ownerUnitCode: "PEV",
    status: "on_track",
    priorityImpact: 4,
    priorityFeasibility: 4,
    budgetQar: 700000,
    inputsEn:
      "Consumes validated indicator values, theme narratives from the sector departments, and the report template.",
    inputsAr:
      "يستهلك قيم المؤشرات المعتمدة والسرديات الموضوعية من إدارات المحاور وقالب التقرير.",
    people: 6,
    systemsEn: ["NES Monitoring System", "Publication Workflow"],
    systemsAr: ["نظام متابعة الاستراتيجية الوطنية للبيئة", "سير عمل النشر"],
    activities: [
      {
        titleEn: "Production calendar and roles for each report stage",
        titleAr: "تقويم الإنتاج وأدوار كل مرحلة من مراحل التقرير",
        status: "completed",
      },
      {
        titleEn: "Automated indicator tables and chart pack",
        titleAr: "جداول المؤشرات الآلية وحزمة الرسوم البيانية",
        status: "on_track",
      },
      {
        titleEn: "Editorial review and clearance cycle",
        titleAr: "دورة المراجعة التحريرية والاعتماد",
        status: "on_track",
      },
    ],
  },

  /* ---------- G1.IO2.OP2 implementation support packages ---------- */
  {
    code: "CP-09",
    outputCode: "G1.IO2.OP2",
    titleEn: "Delivery clinics for lagging national environment initiatives",
    titleAr: "عيادات التنفيذ للمبادرات البيئية الوطنية المتعثرة",
    descriptionEn:
      "Short, structured interventions for initiatives that fall behind plan. A clinic diagnoses the blockage, agrees a recovery plan with the owning entity, and follows it for ninety days. Entities are slow to release the staff the clinics need.",
    descriptionAr:
      "تدخلات قصيرة ومنظمة للمبادرات المتأخرة عن الخطة. تشخص العيادة سبب التعثر وتتفق مع الجهة المالكة على خطة تعافٍ وتتابعها تسعين يوما. وتتأخر الجهات في توفير الموظفين الذين تحتاج إليهم العيادات.",
    ownerUnitCode: "ISU",
    status: "at_risk",
    priorityImpact: 5,
    priorityFeasibility: 2,
    budgetQar: 1400000,
    inputsEn:
      "Consumes the monitoring flags for lagging initiatives, entity delivery data, and facilitators from the implementation support team.",
    inputsAr:
      "يستهلك مؤشرات المتابعة للمبادرات المتأخرة وبيانات التنفيذ من الجهات وميسرين من فريق دعم التنفيذ.",
    people: 7,
    systemsEn: ["NES Monitoring System", "Delivery Case File"],
    systemsAr: ["نظام متابعة الاستراتيجية الوطنية للبيئة", "ملف حالة التنفيذ"],
    activities: [
      {
        titleEn: "Clinic method and diagnostic toolkit",
        titleAr: "منهجية العيادة وأدوات التشخيص",
        status: "completed",
      },
      {
        titleEn: "Clinics for the first group of lagging initiatives",
        titleAr: "عيادات لأول مجموعة من المبادرات المتأخرة",
        status: "at_risk",
      },
      {
        titleEn: "Ninety day follow up and closure reports",
        titleAr: "المتابعة لمدة تسعين يوما وتقارير الإغلاق",
        status: "at_risk",
      },
    ],
  },
  {
    code: "CP-10",
    outputCode: "G1.IO2.OP2",
    titleEn: "Implementation support toolkit for water and agriculture programmes",
    titleAr: "حزمة دعم التنفيذ لبرامج المياه والزراعة",
    descriptionEn:
      "A toolkit of delivery plans, risk logs, stakeholder maps and progress checklists tailored to programmes that depend on several entities and on farmers or utilities in the field. It is tested first on water efficiency and agricultural support programmes.",
    descriptionAr:
      "حزمة من خطط التنفيذ وسجلات المخاطر وخرائط أصحاب المصلحة وقوائم متابعة التقدم، مصممة للبرامج التي تعتمد على عدة جهات وعلى المزارعين أو مشغلي المرافق في الميدان. وتجرب أولا على برامج كفاءة المياه ودعم الزراعة.",
    ownerUnitCode: "ISU",
    status: "on_track",
    priorityImpact: 4,
    priorityFeasibility: 3,
    budgetQar: 620000,
    inputsEn:
      "Consumes lessons from past delivery clinics, entity programme plans, and interviews with programme managers.",
    inputsAr:
      "يستهلك الدروس المستفادة من عيادات التنفيذ السابقة وخطط برامج الجهات ومقابلات مع مديري البرامج.",
    people: 5,
    systemsEn: ["NES Monitoring System", "Strategy Management System"],
    systemsAr: ["نظام متابعة الاستراتيجية الوطنية للبيئة", "نظام إدارة الاستراتيجية"],
    activities: [
      {
        titleEn: "Interviews with water and agriculture programme managers",
        titleAr: "مقابلات مع مديري برامج المياه والزراعة",
        status: "completed",
      },
      {
        titleEn: "Drafting and testing of the toolkit templates",
        titleAr: "صياغة قوالب الحزمة واختبارها",
        status: "on_track",
      },
      {
        titleEn: "Training of entity programme teams on the toolkit",
        titleAr: "تدريب فرق برامج الجهات على الحزمة",
        status: "on_track",
      },
    ],
  },

  /* ---------- G1.IO2.OP3 integrated delivery dashboard ---------- */
  {
    code: "CP-11",
    outputCode: "G1.IO2.OP3",
    titleEn: "Integrated national environment delivery dashboard",
    titleAr: "لوحة التنفيذ البيئي الوطنية المتكاملة",
    descriptionEn:
      "Brings indicator values, initiative milestones and budget execution into one leadership dashboard with drill down from theme to project. It replaces the separate packs each unit sent to the Programme Director.",
    descriptionAr:
      "يجمع قيم المؤشرات ومراحل المبادرات وتنفيذ الميزانية في لوحة واحدة للقيادة مع إمكانية التعمق من المحور إلى المشروع. وتحل اللوحة محل الحزم المنفصلة التي كانت ترسلها كل وحدة إلى مدير البرنامج.",
    ownerUnitCode: "DTO",
    status: "on_track",
    priorityImpact: 5,
    priorityFeasibility: 3,
    budgetQar: 5800000,
    inputsEn:
      "Consumes the NES monitoring data, project portfolio records, financial execution extracts, and the data integration platform.",
    inputsAr:
      "يستهلك بيانات متابعة الاستراتيجية الوطنية للبيئة وسجلات محفظة المشاريع واستخراجات التنفيذ المالي ومنصة تكامل البيانات.",
    people: 12,
    systemsEn: ["Delivery Dashboard", "Data Integration Platform", "NES Monitoring System"],
    systemsAr: ["لوحة التنفيذ", "منصة تكامل البيانات", "نظام متابعة الاستراتيجية الوطنية للبيئة"],
    activities: [
      {
        titleEn: "Requirements and dashboard design with leadership",
        titleAr: "المتطلبات وتصميم اللوحة مع القيادة",
        status: "completed",
      },
      {
        titleEn: "Data feeds from monitoring, projects and finance",
        titleAr: "تغذية البيانات من المتابعة والمشاريع والمالية",
        status: "on_track",
      },
      {
        titleEn: "Build of the drill down views",
        titleAr: "بناء شاشات التعمق",
        status: "on_track",
      },
      {
        titleEn: "User acceptance testing and launch",
        titleAr: "اختبار قبول المستخدمين والإطلاق",
        status: "on_track",
      },
    ],
  },
  {
    code: "CP-12",
    outputCode: "G1.IO2.OP3",
    titleEn: "Leadership briefing room and decision wall",
    titleAr: "غرفة إحاطة القيادة وجدار القرارات",
    descriptionEn:
      "Fits out a briefing room where the Programme Director and the Executive Committee of the Office review the dashboard and track open decisions on a shared wall. The fit out is behind schedule because the room allocation is unresolved.",
    descriptionAr:
      "يجهز غرفة إحاطة يراجع فيها مدير البرنامج واللجنة التنفيذية للمكتب اللوحة ويتتبعون القرارات المفتوحة على جدار مشترك. ويتأخر التجهيز بسبب عدم حسم تخصيص الغرفة.",
    ownerUnitCode: "OPD",
    status: "delayed",
    priorityImpact: 3,
    priorityFeasibility: 3,
    budgetQar: 2300000,
    inputsEn:
      "Consumes the dashboard views, a room allocation decision, and audiovisual equipment procurement.",
    inputsAr:
      "يستهلك شاشات اللوحة وقرار تخصيص الغرفة وتوريد التجهيزات السمعية والبصرية.",
    people: 5,
    systemsEn: ["Delivery Dashboard", "Decision Log"],
    systemsAr: ["لوحة التنفيذ", "سجل القرارات"],
    activities: [
      {
        titleEn: "Room allocation and layout approval",
        titleAr: "تخصيص الغرفة واعتماد التصميم",
        status: "delayed",
      },
      {
        titleEn: "Procurement of display and meeting equipment",
        titleAr: "توريد أجهزة العرض والاجتماعات",
        status: "not_started",
      },
      {
        titleEn: "Installation and briefing protocol",
        titleAr: "التركيب وبروتوكول الإحاطة",
        status: "delayed",
      },
    ],
  },

  /* ---------- G1.IO3.OP1 policy simulation models ---------- */
  {
    code: "CP-13",
    outputCode: "G1.IO3.OP1",
    titleEn: "Water demand and supply policy simulation model",
    titleAr: "نموذج محاكاة سياسات الطلب على المياه والعرض",
    descriptionEn:
      "Builds a simulation model of water demand and supply by sector and region, so that tariff, efficiency and reuse options can be compared before they are proposed. The model is calibrated on administrative and statistical series and documented for independent review.",
    descriptionAr:
      "يبني نموذج محاكاة للطلب على المياه والعرض حسب القطاع والمنطقة، بما يتيح المقارنة بين خيارات التعرفة والكفاءة وإعادة الاستخدام قبل اقتراحها. ويعاير النموذج على السلاسل الإدارية والإحصائية ويوثق للمراجعة المستقلة.",
    ownerUnitCode: "PLB",
    status: "on_track",
    priorityImpact: 5,
    priorityFeasibility: 1,
    budgetQar: 7400000,
    inputsEn:
      "Consumes water balance series, sector consumption data, tariff schedules, and modelling specialists from the Policy Lab and partner universities.",
    inputsAr:
      "يستهلك سلاسل الميزان المائي وبيانات الاستهلاك القطاعي وجداول التعرفة ومتخصصي النمذجة من مختبر السياسات والجامعات الشريكة.",
    people: 11,
    systemsEn: ["Policy Simulation Platform", "Environmental Accounts Database", "Statistical Computing Environment"],
    systemsAr: ["منصة محاكاة السياسات", "قاعدة بيانات الحسابات البيئية", "بيئة الحوسبة الإحصائية"],
    activities: [
      {
        titleEn: "Model specification and data inventory",
        titleAr: "مواصفات النموذج وحصر البيانات",
        status: "completed",
      },
      {
        titleEn: "Calibration of the water demand and supply blocks",
        titleAr: "معايرة كتل الطلب على المياه والعرض",
        status: "on_track",
      },
      {
        titleEn: "Scenario library for tariff and efficiency options",
        titleAr: "مكتبة سيناريوهات لخيارات التعرفة والكفاءة",
        status: "on_track",
      },
      {
        titleEn: "Independent technical review and handover",
        titleAr: "المراجعة الفنية المستقلة والتسليم",
        status: "on_track",
      },
    ],
  },
  {
    code: "CP-14",
    outputCode: "G1.IO3.OP1",
    titleEn: "Agricultural water use and crop policy simulation model",
    titleAr: "نموذج محاكاة سياسات استخدام المياه الزراعية والمحاصيل",
    descriptionEn:
      "A simulation model linking crop choice, irrigation practice and water use at farm and regional level, to test support and pricing options for agriculture. Access to farm level records is the main constraint and has slowed the calibration.",
    descriptionAr:
      "نموذج محاكاة يربط اختيار المحاصيل وممارسات الري واستخدام المياه على مستوى المزرعة والمنطقة، لاختبار خيارات الدعم والتسعير في الزراعة. ويمثل الوصول إلى سجلات المزارع القيد الرئيس وقد أبطأ المعايرة.",
    ownerUnitCode: "PLB",
    status: "at_risk",
    priorityImpact: 4,
    priorityFeasibility: 2,
    budgetQar: 3900000,
    inputsEn:
      "Consumes agricultural census and survey data, irrigation records, and a secure data environment for farm level data.",
    inputsAr:
      "يستهلك بيانات التعداد والمسوح الزراعية وسجلات الري وبيئة بيانات آمنة لبيانات المزارع.",
    people: 8,
    systemsEn: ["Policy Simulation Platform", "Secure Data Enclave"],
    systemsAr: ["منصة محاكاة السياسات", "بيئة البيانات الآمنة"],
    activities: [
      {
        titleEn: "Data access agreements for farm level records",
        titleAr: "اتفاقيات الوصول إلى سجلات المزارع",
        status: "at_risk",
      },
      {
        titleEn: "Prototype of the crop and irrigation module",
        titleAr: "نموذج أولي لوحدة المحاصيل والري",
        status: "on_track",
      },
      {
        titleEn: "Calibration and validation against observed water use",
        titleAr: "المعايرة والتحقق مقابل استخدام المياه المرصود",
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
      "Gives entities a fast, light evaluation of a proposed or running intervention, delivered in six to eight weeks with a short evidence brief. The service draws on pre built evidence summaries and standard designs.",
    descriptionAr:
      "تتيح للجهات تقييما سريعا ومخففا لتدخل مقترح أو قائم، يسلم خلال ستة إلى ثمانية أسابيع مع موجز أدلة قصير. وتعتمد الخدمة على ملخصات أدلة جاهزة وتصاميم معيارية.",
    ownerUnitCode: "PLB",
    status: "on_track",
    priorityImpact: 4,
    priorityFeasibility: 4,
    budgetQar: 1750000,
    inputsEn:
      "Consumes entity evaluation requests, an evidence library, and evaluators from the Policy Lab.",
    inputsAr:
      "يستهلك طلبات التقييم من الجهات ومكتبة الأدلة ومقيمين من مختبر السياسات.",
    people: 7,
    systemsEn: ["Evidence Library", "Policy Lab Case Tracker"],
    systemsAr: ["مكتبة الأدلة", "متتبع حالات مختبر السياسات"],
    activities: [
      {
        titleEn: "Service design and intake criteria",
        titleAr: "تصميم الخدمة ومعايير القبول",
        status: "completed",
      },
      {
        titleEn: "First wave of rapid evaluations",
        titleAr: "الموجة الأولى من التقييمات السريعة",
        status: "on_track",
      },
      {
        titleEn: "Evidence brief template and publication rules",
        titleAr: "قالب موجز الأدلة وقواعد النشر",
        status: "on_track",
      },
    ],
  },
  {
    code: "CP-16",
    outputCode: "G1.IO3.OP2",
    titleEn: "Regulatory impact assessment pilot for draft environmental regulations",
    titleAr: "تجربة تقييم الأثر التنظيمي لمسودات اللوائح البيئية",
    descriptionEn:
      "Pilots a standard impact assessment on a small number of draft environmental regulations before they are issued, covering costs, benefits, compliance burden and enforcement feasibility. The pilot has not started and awaits agreement with the Regulatory Review Panel on candidate drafts.",
    descriptionAr:
      "يجرب تقييما معياريا للأثر على عدد محدود من مسودات اللوائح البيئية قبل إصدارها، يشمل التكاليف والمنافع وعبء الامتثال وجدوى الإنفاذ. ولم تبدأ التجربة بعد وهي بانتظار اتفاق لجنة المراجعة التنظيمية على المسودات المرشحة.",
    ownerUnitCode: "PLB",
    status: "not_started",
    priorityImpact: 4,
    priorityFeasibility: 2,
    budgetQar: 540000,
    inputsEn:
      "Consumes draft regulation texts supplied by entities, a standard assessment template, and Policy Lab analysts.",
    inputsAr:
      "يستهلك نصوص مسودات اللوائح التي تقدمها الجهات وقالب تقييم معياري ومحللين من مختبر السياسات.",
    people: 4,
    systemsEn: ["Policy Lab Case Tracker", "Legal Drafting System"],
    systemsAr: ["متتبع حالات مختبر السياسات", "نظام الصياغة القانونية"],
    activities: [
      {
        titleEn: "Selection of pilot draft regulations with the review panel",
        titleAr: "اختيار مسودات اللوائح التجريبية مع لجنة المراجعة",
        status: "not_started",
      },
      {
        titleEn: "Assessment template and cost benefit guidance",
        titleAr: "قالب التقييم وإرشادات التكلفة والمنفعة",
        status: "not_started",
      },
      {
        titleEn: "Pilot assessments and lessons report",
        titleAr: "التقييمات التجريبية وتقرير الدروس",
        status: "not_started",
      },
    ],
  },

  /* ---------- G2.IO1.OP1 data quality assurance framework ---------- */
  {
    code: "CP-17",
    outputCode: "G2.IO1.OP1",
    titleEn: "Environmental data quality assurance framework",
    titleAr: "إطار ضمان جودة البيانات البيئية",
    descriptionEn:
      "Defines the quality dimensions, checks and sign off rules that every environmental dataset of the Office must pass before release. The framework is aligned with international data quality guidance and applies to monitoring, administrative and survey sources.",
    descriptionAr:
      "يحدد أبعاد الجودة والفحوص وقواعد الاعتماد التي يجب أن تجتازها كل مجموعة بيانات بيئية لدى المكتب قبل إصدارها. ويتوافق الإطار مع الإرشادات الدولية لجودة البيانات ويسري على مصادر الرصد والسجلات الإدارية والمسوح.",
    ownerUnitCode: "DQS",
    status: "on_track",
    priorityImpact: 5,
    priorityFeasibility: 3,
    budgetQar: 1900000,
    inputsEn:
      "Consumes international quality guidance, current release practices, and quality leads from each data producing unit.",
    inputsAr:
      "يستهلك الإرشادات الدولية للجودة وممارسات الإصدار الحالية ومسؤولي الجودة في كل وحدة منتجة للبيانات.",
    people: 9,
    systemsEn: ["Quality Assessment Register", "Environmental Metadata Repository"],
    systemsAr: ["سجل تقييم الجودة", "مستودع البيانات الوصفية البيئية"],
    activities: [
      {
        titleEn: "Review of international quality guidance and current practice",
        titleAr: "مراجعة إرشادات الجودة الدولية والممارسة الحالية",
        status: "completed",
      },
      {
        titleEn: "Drafting of the framework and sign off rules",
        titleAr: "صياغة الإطار وقواعد الاعتماد",
        status: "completed",
      },
      {
        titleEn: "Adoption by the data producing units",
        titleAr: "اعتماد الإطار في الوحدات المنتجة للبيانات",
        status: "on_track",
      },
    ],
  },
  {
    code: "CP-18",
    outputCode: "G2.IO1.OP1",
    titleEn: "Quality self assessment and peer review cycle",
    titleAr: "دورة التقييم الذاتي للجودة ومراجعة النظراء",
    descriptionEn:
      "An annual cycle in which each data producing unit assesses itself against the framework and is then reviewed by a peer unit. The first full cycle is complete and the results fed the improvement plans of each unit.",
    descriptionAr:
      "دورة سنوية تقيم فيها كل وحدة منتجة للبيانات نفسها وفق الإطار ثم تراجعها وحدة نظيرة. وقد اكتملت الدورة الأولى الكاملة وغذت نتائجها خطط التحسين في كل وحدة.",
    ownerUnitCode: "DQS",
    status: "completed",
    priorityImpact: 3,
    priorityFeasibility: 5,
    budgetQar: 460000,
    inputsEn:
      "Consumes the self assessment questionnaire, peer reviewer time, and the quality assessment register.",
    inputsAr:
      "يستهلك استبيان التقييم الذاتي ووقت مراجعي النظراء وسجل تقييم الجودة.",
    people: 5,
    systemsEn: ["Quality Assessment Register"],
    systemsAr: ["سجل تقييم الجودة"],
    activities: [
      {
        titleEn: "Self assessment questionnaire and scoring guide",
        titleAr: "استبيان التقييم الذاتي ودليل التقييم",
        status: "completed",
      },
      {
        titleEn: "Peer review visits",
        titleAr: "زيارات مراجعة النظراء",
        status: "completed",
      },
      {
        titleEn: "Consolidated findings and improvement plans",
        titleAr: "النتائج الموحدة وخطط التحسين",
        status: "completed",
      },
    ],
  },

  /* ---------- G2.IO1.OP2 modernised production systems ---------- */
  {
    code: "CP-19",
    outputCode: "G2.IO1.OP2",
    titleEn: "Integrated environmental data production platform",
    titleAr: "منصة إنتاج البيانات البيئية المتكاملة",
    descriptionEn:
      "Replaces separate production tools with one platform that ingests monitoring feeds, remote sensing products and administrative records from entities such as MEWA, NCEC and NCW, applies validation rules, and prepares datasets for release. It is the largest build in the portfolio and is behind plan on the integration work.",
    descriptionAr:
      "يستبدل أدوات الإنتاج المنفصلة بمنصة واحدة تستقبل تغذيات الرصد ومنتجات الاستشعار عن بعد والسجلات الإدارية من جهات مثل وزارة البيئة والمياه والزراعة والمركز الوطني للرقابة على الالتزام البيئي والمركز الوطني للحياة الفطرية، وتطبق قواعد التحقق وتجهز مجموعات البيانات للإصدار. وهو أكبر مشروع بناء في المحفظة ويتأخر عن الخطة في أعمال التكامل.",
    ownerUnitCode: "DSY",
    status: "at_risk",
    priorityImpact: 5,
    priorityFeasibility: 1,
    budgetQar: 11800000,
    inputsEn:
      "Consumes the current production tools, data feeds from partner entities, a systems integrator, and the metadata repository.",
    inputsAr:
      "يستهلك أدوات الإنتاج الحالية وتغذيات البيانات من الجهات الشريكة ومتعهد تكامل ومستودع البيانات الوصفية.",
    people: 14,
    systemsEn: ["Environmental Data Production Platform", "Environmental Metadata Repository", "Data Integration Platform"],
    systemsAr: ["منصة إنتاج البيانات البيئية", "مستودع البيانات الوصفية البيئية", "منصة تكامل البيانات"],
    activities: [
      {
        titleEn: "Architecture, requirements and vendor selection",
        titleAr: "البنية والمتطلبات واختيار المورد",
        status: "completed",
      },
      {
        titleEn: "Integration of entity data feeds",
        titleAr: "تكامل تغذيات البيانات من الجهات",
        status: "at_risk",
      },
      {
        titleEn: "Migration of the first data domains",
        titleAr: "ترحيل أول نطاقات البيانات",
        status: "on_track",
      },
      {
        titleEn: "Parallel run and cutover",
        titleAr: "التشغيل المتوازي والتحول",
        status: "at_risk",
      },
    ],
  },
  {
    code: "CP-20",
    outputCode: "G2.IO1.OP2",
    titleEn: "Modernisation of field monitoring and sensor data capture",
    titleAr: "تحديث الرصد الميداني والتقاط بيانات المستشعرات",
    descriptionEn:
      "Moves field teams from paper and spreadsheets to mobile capture with validation at source, and connects station and sensor feeds to the production platform. It covers water, air and land monitoring in the first phase.",
    descriptionAr:
      "ينقل الفرق الميدانية من الورق والجداول الإلكترونية إلى التقاط البيانات عبر الأجهزة المحمولة مع التحقق من المصدر، ويربط تغذيات المحطات والمستشعرات بمنصة الإنتاج. ويشمل رصد المياه والهواء والأراضي في المرحلة الأولى.",
    ownerUnitCode: "DOP",
    status: "on_track",
    priorityImpact: 4,
    priorityFeasibility: 4,
    budgetQar: 4600000,
    inputsEn:
      "Consumes mobile devices, a field data capture application, sensor interface specifications, and field team training.",
    inputsAr:
      "يستهلك أجهزة محمولة وتطبيقا لالتقاط البيانات الميدانية ومواصفات واجهات المستشعرات وتدريب الفرق الميدانية.",
    people: 10,
    systemsEn: ["Field Data Collection System", "Environmental Data Production Platform"],
    systemsAr: ["نظام جمع البيانات الميدانية", "منصة إنتاج البيانات البيئية"],
    activities: [
      {
        titleEn: "Field capture application and forms",
        titleAr: "تطبيق التقاط البيانات الميدانية ونماذجه",
        status: "completed",
      },
      {
        titleEn: "Rollout to water and air monitoring teams",
        titleAr: "التعميم على فرق رصد المياه والهواء",
        status: "on_track",
      },
      {
        titleEn: "Sensor feed connection and data checks",
        titleAr: "ربط تغذيات المستشعرات وفحوص البيانات",
        status: "on_track",
      },
    ],
  },

  /* ---------- G2.IO1.OP3 accredited metadata and classifications ---------- */
  {
    code: "CP-21",
    outputCode: "G2.IO1.OP3",
    titleEn: "Update of environmental classifications",
    titleAr: "تحديث التصنيفات البيئية",
    descriptionEn:
      "Updates the classifications used across Office datasets, including land cover, water use, waste categories and environmental activity classes, to the current international versions. The work has not started and carries no dedicated budget.",
    descriptionAr:
      "يحدّث التصنيفات المستخدمة في مجموعات بيانات المكتب، ومنها الغطاء الأرضي واستخدام المياه وفئات النفايات وفئات الأنشطة البيئية، إلى الإصدارات الدولية الحالية. ولم يبدأ العمل ولا توجد له ميزانية مخصصة.",
    ownerUnitCode: "EAS",
    status: "not_started",
    priorityImpact: 2,
    priorityFeasibility: 1,
    budgetQar: 0,
    inputsEn:
      "Consumes the current international classification versions, a crosswalk to existing codes, and part time experts from the accounts and statistics team.",
    inputsAr:
      "يستهلك الإصدارات الدولية الحالية للتصنيفات وجدول مطابقة مع الرموز القائمة وخبراء بدوام جزئي من فريق الحسابات والإحصاءات.",
    people: 6,
    systemsEn: ["Classification Register", "Environmental Metadata Repository"],
    systemsAr: ["سجل التصنيفات", "مستودع البيانات الوصفية البيئية"],
    activities: [
      {
        titleEn: "Inventory of classifications in use and their versions",
        titleAr: "حصر التصنيفات المستخدمة وإصداراتها",
        status: "not_started",
      },
      {
        titleEn: "Crosswalk to current international versions",
        titleAr: "مطابقة الإصدارات الدولية الحالية",
        status: "not_started",
      },
    ],
  },
  {
    code: "CP-22",
    outputCode: "G2.IO1.OP3",
    titleEn: "Environmental metadata repository and SDMX adoption",
    titleAr: "مستودع البيانات الوصفية البيئية واعتماد معيار SDMX",
    descriptionEn:
      "Creates one repository for dataset definitions, concepts and code lists, published in the SDMX standard so that partner systems can exchange data without manual mapping. The build is delayed by a vendor change and unclear ownership of some definitions.",
    descriptionAr:
      "ينشئ مستودعا واحدا لتعريفات مجموعات البيانات والمفاهيم وقوائم الرموز، منشورا وفق معيار SDMX ليتبادل الشركاء البيانات بين أنظمتهم دون مطابقة يدوية. ويتأخر البناء بسبب تغيير المورد وعدم وضوح ملكية بعض التعريفات.",
    ownerUnitCode: "EDA",
    status: "delayed",
    priorityImpact: 4,
    priorityFeasibility: 2,
    budgetQar: 3400000,
    inputsEn:
      "Consumes existing data dictionaries, the SDMX specifications, and technical staff from the data systems team.",
    inputsAr:
      "يستهلك قواميس البيانات القائمة ومواصفات SDMX وكوادر فنية من فريق نظم البيانات.",
    people: 8,
    systemsEn: ["Environmental Metadata Repository", "Environmental Data Production Platform"],
    systemsAr: ["مستودع البيانات الوصفية البيئية", "منصة إنتاج البيانات البيئية"],
    activities: [
      {
        titleEn: "Inventory of dictionaries and concept ownership",
        titleAr: "حصر القواميس وملكية المفاهيم",
        status: "completed",
      },
      {
        titleEn: "Repository build and SDMX publishing",
        titleAr: "بناء المستودع والنشر وفق SDMX",
        status: "delayed",
      },
      {
        titleEn: "Onboarding of partner systems",
        titleAr: "ضم أنظمة الشركاء",
        status: "delayed",
      },
    ],
  },

  /* ---------- G2.IO2.OP1 data governance and sharing agreements ---------- */
  {
    code: "CP-23",
    outputCode: "G2.IO2.OP1",
    titleEn: "Environmental data governance policy and steward network",
    titleAr: "سياسة حوكمة البيانات البيئية وشبكة مسؤولي البيانات",
    descriptionEn:
      "Issues a data governance policy for the Office and its partner entities and names a data steward in each, so that ownership, access and quality duties are clear. The Data Governance Board oversees the network.",
    descriptionAr:
      "يصدر سياسة لحوكمة البيانات للمكتب والجهات الشريكة ويسمي مسؤول بيانات في كل جهة، لتتضح مسؤوليات الملكية والوصول والجودة. ويشرف مجلس حوكمة البيانات على الشبكة.",
    ownerUnitCode: "EDA",
    status: "on_track",
    priorityImpact: 5,
    priorityFeasibility: 3,
    budgetQar: 1250000,
    inputsEn:
      "Consumes the draft policy, nominations from entities, and guidance from SDAIA on national data management.",
    inputsAr:
      "يستهلك مسودة السياسة وترشيحات الجهات وإرشادات الهيئة السعودية للبيانات والذكاء الاصطناعي بشأن إدارة البيانات الوطنية.",
    people: 8,
    systemsEn: ["Data Governance Portal", "Programme Document Repository"],
    systemsAr: ["بوابة حوكمة البيانات", "مستودع وثائق البرنامج"],
    activities: [
      {
        titleEn: "Policy drafting and Data Governance Board approval",
        titleAr: "صياغة السياسة واعتمادها من مجلس حوكمة البيانات",
        status: "completed",
      },
      {
        titleEn: "Nomination and induction of data stewards",
        titleAr: "ترشيح مسؤولي البيانات وتهيئتهم",
        status: "on_track",
      },
      {
        titleEn: "Stewardship reporting to the Board",
        titleAr: "تقارير الإشراف على البيانات إلى المجلس",
        status: "on_track",
      },
    ],
  },
  {
    code: "CP-24",
    outputCode: "G2.IO2.OP1",
    titleEn: "Programme of data sharing agreements with partner entities",
    titleAr: "برنامج اتفاقيات تبادل البيانات مع الجهات الشريكة",
    descriptionEn:
      "Negotiates standard data sharing agreements with the entities that hold administrative and monitoring records the Office needs. Several agreements are stuck on confidentiality terms and on who may redistribute the data.",
    descriptionAr:
      "يتفاوض على اتفاقيات معيارية لتبادل البيانات مع الجهات التي تحتفظ بسجلات إدارية وسجلات رصد يحتاجها المكتب. وتتعثر عدة اتفاقيات عند بنود السرية وتحديد من يحق له إعادة نشر البيانات.",
    ownerUnitCode: "EDA",
    status: "at_risk",
    priorityImpact: 5,
    priorityFeasibility: 2,
    budgetQar: 780000,
    inputsEn:
      "Consumes the standard agreement template, a register of data needs, and negotiation time from legal and data staff.",
    inputsAr:
      "يستهلك نموذج الاتفاقية المعياري وسجل احتياجات البيانات ووقت التفاوض من الكوادر القانونية وكوادر البيانات.",
    people: 6,
    systemsEn: ["Data Governance Portal", "Agreement Register"],
    systemsAr: ["بوابة حوكمة البيانات", "سجل الاتفاقيات"],
    activities: [
      {
        titleEn: "Standard agreement template and clause library",
        titleAr: "نموذج الاتفاقية المعياري ومكتبة البنود",
        status: "completed",
      },
      {
        titleEn: "Negotiation with priority data holders",
        titleAr: "التفاوض مع أبرز جهات حيازة البيانات",
        status: "at_risk",
      },
      {
        titleEn: "Agreement register and renewal calendar",
        titleAr: "سجل الاتفاقيات وتقويم التجديد",
        status: "at_risk",
      },
    ],
  },

  /* ---------- G2.IO2.OP2 unified data catalogue ---------- */
  {
    code: "CP-25",
    outputCode: "G2.IO2.OP2",
    titleEn: "Unified environmental data catalogue",
    titleAr: "فهرس البيانات البيئية الموحد",
    descriptionEn:
      "A single searchable catalogue of environmental datasets held by the Office and its partner entities, with owner, quality rating, update frequency and access terms for each. It is the discovery layer for analysts and for the open data portal.",
    descriptionAr:
      "فهرس واحد قابل للبحث لمجموعات البيانات البيئية لدى المكتب والجهات الشريكة، مع المالك وتقييم الجودة وتواتر التحديث وشروط الوصول لكل مجموعة. وهو طبقة الاكتشاف للمحللين ولبوابة البيانات المفتوحة.",
    ownerUnitCode: "EDA",
    status: "on_track",
    priorityImpact: 4,
    priorityFeasibility: 3,
    budgetQar: 6200000,
    inputsEn:
      "Consumes the dataset inventories of partner entities, the metadata repository, and the platform vendor.",
    inputsAr:
      "يستهلك حصر مجموعات البيانات لدى الجهات الشريكة ومستودع البيانات الوصفية ومورد المنصة.",
    people: 11,
    systemsEn: ["Environmental Data Catalogue", "Data Governance Portal", "Environmental Metadata Repository"],
    systemsAr: ["فهرس البيانات البيئية", "بوابة حوكمة البيانات", "مستودع البيانات الوصفية البيئية"],
    activities: [
      {
        titleEn: "Dataset inventory across partner entities",
        titleAr: "حصر مجموعات البيانات لدى الجهات الشريكة",
        status: "completed",
      },
      {
        titleEn: "Catalogue platform configuration",
        titleAr: "إعداد منصة الفهرس",
        status: "on_track",
      },
      {
        titleEn: "Loading of the first thousand dataset records",
        titleAr: "تحميل أول ألف سجل لمجموعات البيانات",
        status: "on_track",
      },
      {
        titleEn: "Search, access request and user feedback features",
        titleAr: "ميزات البحث وطلب الوصول وملاحظات المستخدمين",
        status: "on_track",
      },
    ],
  },
  {
    code: "CP-26",
    outputCode: "G2.IO2.OP2",
    titleEn: "Data quality scorecards for source registers",
    titleAr: "بطاقات جودة البيانات للسجلات المصدرية",
    descriptionEn:
      "Publishes a quality scorecard for each administrative and monitoring register that feeds the Office, showing completeness, timeliness and consistency. The scorecards give partner entities a concrete basis for fixing their records.",
    descriptionAr:
      "ينشر بطاقة جودة لكل سجل إداري وسجل رصد يغذي المكتب، تبين الاكتمال والتوقيت والاتساق. وتمنح البطاقات الجهات الشريكة أساسا ملموسا لإصلاح سجلاتها.",
    ownerUnitCode: "DQS",
    status: "not_started",
    priorityImpact: 3,
    priorityFeasibility: 3,
    budgetQar: 890000,
    inputsEn:
      "Consumes the quality framework, register extracts from partner entities, and analyst time from the data quality team.",
    inputsAr:
      "يستهلك إطار الجودة واستخراجات السجلات من الجهات الشريكة ووقت المحللين من فريق جودة البيانات.",
    people: 5,
    systemsEn: ["Environmental Data Catalogue", "Quality Assessment Register"],
    systemsAr: ["فهرس البيانات البيئية", "سجل تقييم الجودة"],
    activities: [
      {
        titleEn: "Scorecard dimensions and thresholds",
        titleAr: "أبعاد البطاقة وحدودها",
        status: "not_started",
      },
      {
        titleEn: "First scorecards for priority registers",
        titleAr: "أولى البطاقات للسجلات ذات الأولوية",
        status: "not_started",
      },
    ],
  },

  /* ---------- G2.IO3.OP1 open data and dissemination services ---------- */
  {
    code: "CP-27",
    outputCode: "G2.IO3.OP1",
    titleEn: "Redesign of the open data portal",
    titleAr: "إعادة تصميم بوابة البيانات المفتوحة",
    descriptionEn:
      "Rebuilds the public portal around user tasks, with clearer search, interactive indicator views, bilingual content and accessibility improvements. The redesigned portal is live and traffic from first time visitors has grown.",
    descriptionAr:
      "يعيد بناء البوابة العامة حول مهام المستخدمين، مع بحث أوضح وعروض تفاعلية للمؤشرات ومحتوى ثنائي اللغة وتحسينات في سهولة الوصول. وقد أطلقت البوابة المعاد تصميمها وارتفعت زيارات المستخدمين الجدد.",
    ownerUnitCode: "DKS",
    status: "completed",
    priorityImpact: 4,
    priorityFeasibility: 4,
    budgetQar: 3100000,
    inputsEn:
      "Consumes user research, the dataset catalogue, a design agency, and content from the data departments.",
    inputsAr:
      "يستهلك أبحاث المستخدمين وفهرس مجموعات البيانات ووكالة تصميم ومحتوى من إدارات البيانات.",
    people: 9,
    systemsEn: ["Open Data Portal", "Publication Workflow"],
    systemsAr: ["بوابة البيانات المفتوحة", "سير عمل النشر"],
    activities: [
      {
        titleEn: "User research and information architecture",
        titleAr: "أبحاث المستخدمين وهيكلة المعلومات",
        status: "completed",
      },
      {
        titleEn: "Design, build and accessibility testing",
        titleAr: "التصميم والبناء واختبار سهولة الوصول",
        status: "completed",
      },
      {
        titleEn: "Launch and migration of existing content",
        titleAr: "الإطلاق وترحيل المحتوى القائم",
        status: "completed",
      },
    ],
  },
  {
    code: "CP-28",
    outputCode: "G2.IO3.OP1",
    titleEn: "Data API and machine readable release service",
    titleAr: "واجهة برمجية للبيانات وخدمة الإصدار المقروء آليا",
    descriptionEn:
      "Releases Office datasets through a documented API and in open machine readable formats, so that researchers, entities and developers can pull data directly. Usage keys and fair use limits are managed through the portal.",
    descriptionAr:
      "يتيح مجموعات بيانات المكتب عبر واجهة برمجية موثقة وبصيغ مفتوحة مقروءة آليا، ليسحب الباحثون والجهات والمطورون البيانات مباشرة. وتدار مفاتيح الاستخدام وحدود الاستخدام العادل عبر البوابة.",
    ownerUnitCode: "DSY",
    status: "on_track",
    priorityImpact: 4,
    priorityFeasibility: 3,
    budgetQar: 2450000,
    inputsEn:
      "Consumes release datasets, API specifications, and engineering staff from the data systems team.",
    inputsAr:
      "يستهلك مجموعات بيانات الإصدار ومواصفات الواجهات البرمجية وكوادر هندسية من فريق نظم البيانات.",
    people: 7,
    systemsEn: ["Data API Gateway", "Open Data Portal"],
    systemsAr: ["بوابة الواجهات البرمجية للبيانات", "بوابة البيانات المفتوحة"],
    activities: [
      {
        titleEn: "API design and documentation",
        titleAr: "تصميم الواجهة البرمجية وتوثيقها",
        status: "completed",
      },
      {
        titleEn: "Gateway build and key management",
        titleAr: "بناء البوابة وإدارة المفاتيح",
        status: "on_track",
      },
      {
        titleEn: "Release of the first datasets through the API",
        titleAr: "إتاحة أولى مجموعات البيانات عبر الواجهة",
        status: "on_track",
      },
    ],
  },

  /* ---------- G2.IO3.OP2 data literacy and user support ---------- */
  {
    code: "CP-29",
    outputCode: "G2.IO3.OP2",
    titleEn: "Environmental data literacy programme for schools and universities",
    titleAr: "برنامج الثقافة البيانية البيئية للمدارس والجامعات",
    descriptionEn:
      "Teaching resources, workshops and student challenges that build the skills to read and use environmental data, delivered with schools and universities. One partner university has paused its part of the programme.",
    descriptionAr:
      "موارد تعليمية وورش عمل وتحديات للطلاب تبني مهارات قراءة البيانات البيئية واستخدامها، تنفذ بالتعاون مع المدارس والجامعات. وقد أوقفت إحدى الجامعات الشريكة مؤقتا مشاركتها في البرنامج.",
    ownerUnitCode: "CAP",
    status: "at_risk",
    priorityImpact: 3,
    priorityFeasibility: 4,
    budgetQar: 1320000,
    inputsEn:
      "Consumes open datasets from the portal, teaching materials, and facilitators from the capability development team.",
    inputsAr:
      "يستهلك مجموعات البيانات المفتوحة من البوابة ومواد تعليمية وميسرين من فريق تنمية القدرات.",
    people: 6,
    systemsEn: ["Learning Management System", "Open Data Portal"],
    systemsAr: ["نظام إدارة التعلم", "بوابة البيانات المفتوحة"],
    activities: [
      {
        titleEn: "Teaching resource pack on environmental indicators",
        titleAr: "حزمة موارد تعليمية عن المؤشرات البيئية",
        status: "completed",
      },
      {
        titleEn: "Workshops in partner schools",
        titleAr: "ورش عمل في المدارس الشريكة",
        status: "on_track",
      },
      {
        titleEn: "University student data challenge",
        titleAr: "تحدي البيانات لطلاب الجامعات",
        status: "at_risk",
      },
    ],
  },
  {
    code: "CP-30",
    outputCode: "G2.IO3.OP2",
    titleEn: "Data help desk and restricted data access service",
    titleAr: "مكتب مساعدة البيانات وخدمة الوصول إلى البيانات المقيدة",
    descriptionEn:
      "A help desk that answers data questions and a controlled service for approved researchers to analyse restricted records in a secure environment. Request handling has slowed because the secure environment is not yet fully staffed.",
    descriptionAr:
      "مكتب مساعدة يجيب عن استفسارات البيانات وخدمة خاضعة للرقابة تتيح للباحثين المعتمدين تحليل السجلات المقيدة في بيئة آمنة. وتباطأت معالجة الطلبات لأن البيئة الآمنة لم تكتمل كوادرها بعد.",
    ownerUnitCode: "DKS",
    status: "delayed",
    priorityImpact: 1,
    priorityFeasibility: 4,
    budgetQar: 670000,
    inputsEn:
      "Consumes user requests, access approval rules, and analysts able to vet outputs from the secure environment.",
    inputsAr:
      "يستهلك طلبات المستخدمين وقواعد اعتماد الوصول ومحللين قادرين على فحص مخرجات البيئة الآمنة.",
    people: 5,
    systemsEn: ["Service Desk System", "Secure Data Enclave"],
    systemsAr: ["نظام مكتب الخدمة", "بيئة البيانات الآمنة"],
    activities: [
      {
        titleEn: "Request categories and response standards",
        titleAr: "فئات الطلبات ومعايير الاستجابة",
        status: "delayed",
      },
      {
        titleEn: "Researcher accreditation procedure",
        titleAr: "إجراء اعتماد الباحثين",
        status: "on_track",
      },
      {
        titleEn: "Output checking service for the secure environment",
        titleAr: "خدمة فحص المخرجات للبيئة الآمنة",
        status: "delayed",
      },
    ],
  },

  /* ---------- G2.IO3.OP3 release calendar and revisions policy ---------- */
  {
    code: "CP-31",
    outputCode: "G2.IO3.OP3",
    titleEn: "Advance release calendar and published revisions policy",
    titleAr: "تقويم الإصدار المسبق وسياسة المراجعات المنشورة",
    descriptionEn:
      "Publishes the release dates of Office datasets a year ahead and sets out when and how published figures may be revised. Users now know when to expect data and what a revision means.",
    descriptionAr:
      "ينشر مواعيد إصدار مجموعات بيانات المكتب قبل عام ويحدد متى وكيف يجوز تنقيح الأرقام المنشورة. ويعرف المستخدمون الآن متى يتوقعون البيانات وما يعنيه التنقيح.",
    ownerUnitCode: "DQS",
    status: "completed",
    priorityImpact: 4,
    priorityFeasibility: 5,
    budgetQar: 240000,
    inputsEn:
      "Consumes release schedules from each data unit and international guidance on revisions practice.",
    inputsAr:
      "يستهلك جداول الإصدار من كل وحدة بيانات والإرشادات الدولية لممارسات التنقيح.",
    people: 4,
    systemsEn: ["Open Data Portal", "Publication Workflow"],
    systemsAr: ["بوابة البيانات المفتوحة", "سير عمل النشر"],
    activities: [
      {
        titleEn: "Consolidated release schedule from all units",
        titleAr: "جدول الإصدار الموحد من جميع الوحدات",
        status: "completed",
      },
      {
        titleEn: "Revisions policy drafting and approval",
        titleAr: "صياغة سياسة المراجعات واعتمادها",
        status: "completed",
      },
      {
        titleEn: "Calendar publication on the portal",
        titleAr: "نشر التقويم على البوابة",
        status: "completed",
      },
    ],
  },

  /* ---------- G3.IO1.OP1 horizon scanning ---------- */
  {
    code: "CP-32",
    outputCode: "G3.IO1.OP1",
    titleEn: "National environmental horizon scanning system",
    titleAr: "منظومة الاستشراف الوطنية للمخاطر والفرص البيئية",
    descriptionEn:
      "A standing system that collects weak signals on climate, water, agriculture and technology, rates them and routes the strong ones to decision makers. It combines a signal register, analyst review and a monthly signal digest.",
    descriptionAr:
      "منظومة دائمة تجمع الإشارات المبكرة في المناخ والمياه والزراعة والتقنية وتقيمها وتوجه القوية منها إلى صناع القرار. وتجمع بين سجل للإشارات ومراجعة المحللين وملخص شهري للإشارات.",
    ownerUnitCode: "SCN",
    status: "on_track",
    priorityImpact: 4,
    priorityFeasibility: 3,
    budgetQar: 2800000,
    inputsEn:
      "Consumes open sources and partner feeds, a signal taxonomy, and analysts from the scenarios and signals team.",
    inputsAr:
      "يستهلك المصادر المفتوحة وتغذيات الشركاء وتصنيفا للإشارات ومحللين من فريق السيناريوهات والإشارات.",
    people: 8,
    systemsEn: ["Horizon Scanning Platform", "Foresight Signal Register"],
    systemsAr: ["منصة المسح الاستشرافي", "سجل الإشارات الاستشرافية"],
    activities: [
      {
        titleEn: "Signal taxonomy and scanning sources",
        titleAr: "تصنيف الإشارات ومصادر المسح",
        status: "completed",
      },
      {
        titleEn: "Platform build and signal register",
        titleAr: "بناء المنصة وسجل الإشارات",
        status: "completed",
      },
      {
        titleEn: "Monthly signal digest for leadership",
        titleAr: "الملخص الشهري للإشارات للقيادة",
        status: "on_track",
      },
    ],
  },

  /* ---------- G3.IO1.OP2 quarterly risk briefings ---------- */
  {
    code: "CP-33",
    outputCode: "G3.IO1.OP2",
    titleEn: "Quarterly strategic risk briefing service",
    titleAr: "خدمة الإحاطات ربع السنوية للمخاطر الاستراتيجية",
    descriptionEn:
      "Each quarter the foresight team briefs the Executive Committee of the Office on the strategic risks to the National Environment Strategy, with the signals behind each risk and the options to respond. It runs on existing staff time.",
    descriptionAr:
      "في كل ربع سنة يقدم فريق الاستشراف إحاطة إلى اللجنة التنفيذية للمكتب عن المخاطر الاستراتيجية التي تهدد الاستراتيجية الوطنية للبيئة، مع الإشارات وراء كل خطر وخيارات الاستجابة. ويعمل الفريق ضمن وقت الموظفين القائمين.",
    ownerUnitCode: "SCN",
    status: "on_track",
    priorityImpact: 3,
    priorityFeasibility: 5,
    budgetQar: 0,
    inputsEn:
      "Consumes the signal register, the strategic risk register, and one analyst week each quarter.",
    inputsAr:
      "يستهلك سجل الإشارات وسجل المخاطر الاستراتيجية وأسبوع عمل لمحلل كل ربع سنة.",
    people: 4,
    systemsEn: ["Foresight Signal Register", "Decision Log"],
    systemsAr: ["سجل الإشارات الاستشرافية", "سجل القرارات"],
    activities: [
      {
        titleEn: "Briefing format and risk rating method",
        titleAr: "صيغة الإحاطة وطريقة تقييم المخاطر",
        status: "completed",
      },
      {
        titleEn: "Quarterly briefing to the Executive Committee",
        titleAr: "الإحاطة ربع السنوية للجنة التنفيذية",
        status: "on_track",
      },
      {
        titleEn: "Follow up on actions agreed at each briefing",
        titleAr: "متابعة الإجراءات المتفق عليها في كل إحاطة",
        status: "on_track",
      },
    ],
  },

  /* ---------- G3.IO2.OP1 scenario sets ---------- */
  {
    code: "CP-34",
    outputCode: "G3.IO2.OP1",
    titleEn: "Saudi Vision 2030 environmental scenario programme",
    titleAr: "برنامج السيناريوهات البيئية لرؤية السعودية 2030",
    descriptionEn:
      "Develops a small set of plausible scenarios for water, agriculture, climate and land to 2030 and beyond, and tests the Vision 2030 environmental targets against them. Workshops with entities are behind plan and the scenario narratives are not yet agreed.",
    descriptionAr:
      "يطور مجموعة محدودة من السيناريوهات المحتملة للمياه والزراعة والمناخ والأراضي حتى 2030 وما بعدها، ويختبر المستهدفات البيئية لرؤية السعودية 2030 في ضوئها. وتتأخر الورش مع الجهات عن الخطة ولم تُعتمد بعد سرديات السيناريوهات.",
    ownerUnitCode: "SCN",
    status: "at_risk",
    priorityImpact: 5,
    priorityFeasibility: 2,
    budgetQar: 4200000,
    inputsEn:
      "Consumes the signal register, theme data series, expert panels, and a scenario workbench.",
    inputsAr:
      "يستهلك سجل الإشارات والسلاسل البيانية للمحاور وفرق الخبراء ومصنف السيناريوهات.",
    people: 9,
    systemsEn: ["Foresight Signal Register", "Scenario Workbench"],
    systemsAr: ["سجل الإشارات الاستشرافية", "مصنف السيناريوهات"],
    activities: [
      {
        titleEn: "Scenario framing and driver selection",
        titleAr: "تأطير السيناريوهات واختيار المحركات",
        status: "completed",
      },
      {
        titleEn: "Scenario workshops with entities",
        titleAr: "ورش السيناريوهات مع الجهات",
        status: "at_risk",
      },
      {
        titleEn: "Stress test of Vision 2030 environmental targets",
        titleAr: "اختبار تحمل المستهدفات البيئية لرؤية 2030",
        status: "at_risk",
      },
    ],
  },

  /* ---------- G3.IO2.OP2 behavioural insight trials ---------- */
  {
    code: "CP-35",
    outputCode: "G3.IO2.OP2",
    titleEn: "Behavioural trials for water and waste priorities",
    titleAr: "التجارب السلوكية لأولويات المياه والنفايات",
    descriptionEn:
      "Runs small randomised trials of nudges and messages on household water use and waste sorting, to find what changes behaviour before a policy is scaled. Not started, pending trial protocols and ethics review.",
    descriptionAr:
      "ينفذ تجارب عشوائية صغيرة للتنبيهات والرسائل بشأن استهلاك المياه المنزلي وفرز النفايات، لمعرفة ما يغير السلوك قبل توسيع السياسة. لم يبدأ بعد بانتظار بروتوكولات التجارب والمراجعة الأخلاقية.",
    ownerUnitCode: "BIN",
    status: "not_started",
    priorityImpact: 3,
    priorityFeasibility: 4,
    budgetQar: 1580000,
    inputsEn:
      "Consumes trial protocols, partner utility and municipal access, and behavioural scientists from the insights team.",
    inputsAr:
      "يستهلك بروتوكولات التجارب وإتاحة التعاون مع مشغلي المرافق والبلديات وعلماء السلوك من فريق الرؤى.",
    people: 6,
    systemsEn: ["Behavioural Trial Register", "Secure Data Enclave"],
    systemsAr: ["سجل التجارب السلوكية", "بيئة البيانات الآمنة"],
    activities: [
      {
        titleEn: "Selection of trial topics with the water and waste departments",
        titleAr: "اختيار موضوعات التجارب مع إدارتي المياه والنفايات",
        status: "not_started",
      },
      {
        titleEn: "Trial protocols and ethics review",
        titleAr: "بروتوكولات التجارب والمراجعة الأخلاقية",
        status: "not_started",
      },
      {
        titleEn: "Field trials and results report",
        titleAr: "التجارب الميدانية وتقرير النتائج",
        status: "not_started",
      },
    ],
  },

  /* ---------- G3.IO2.OP3 foresight network ---------- */
  {
    code: "CP-36",
    outputCode: "G3.IO2.OP3",
    titleEn: "Environmental foresight network and practitioner academy",
    titleAr: "شبكة الاستشراف البيئي وأكاديمية الممارسين",
    descriptionEn:
      "A network of foresight practitioners across the entities with a short academy course in scenario and signal methods. Entity nominations have been slow and the first academy cohort has slipped.",
    descriptionAr:
      "شبكة من ممارسي الاستشراف في الجهات مع دورة أكاديمية قصيرة في أساليب السيناريوهات والإشارات. وقد تأخرت ترشيحات الجهات وتأجلت الدفعة الأولى من الأكاديمية.",
    ownerUnitCode: "SCN",
    status: "delayed",
    priorityImpact: 2,
    priorityFeasibility: 2,
    budgetQar: 940000,
    inputsEn:
      "Consumes academy course material, entity nominations, and trainer time from the foresight team.",
    inputsAr:
      "يستهلك مواد الدورة الأكاديمية وترشيحات الجهات ووقت المدربين من فريق الاستشراف.",
    people: 5,
    systemsEn: ["Learning Management System", "Foresight Signal Register"],
    systemsAr: ["نظام إدارة التعلم", "سجل الإشارات الاستشرافية"],
    activities: [
      {
        titleEn: "Network charter and entity nominations",
        titleAr: "ميثاق الشبكة وترشيحات الجهات",
        status: "delayed",
      },
      {
        titleEn: "Academy curriculum and trainer pool",
        titleAr: "منهج الأكاديمية ومجموعة المدربين",
        status: "at_risk",
      },
      {
        titleEn: "First academy cohort",
        titleAr: "الدفعة الأولى من الأكاديمية",
        status: "delayed",
      },
    ],
  },

  /* ---------- G4.IO1.OP1 regulatory register ---------- */
  {
    code: "CP-37",
    outputCode: "G4.IO1.OP1",
    titleEn: "Regulatory register and change tracking service",
    titleAr: "سجل الأنظمة وخدمة تتبع التغييرات التنظيمية",
    descriptionEn:
      "Maintains one register of the environmental, water and agricultural regulations that bind the entities in scope, with the issuing body, scope, status and obligations in practitioner terms. A change tracking service flags amendments and new instruments and routes them to the Regulatory Review Panel.",
    descriptionAr:
      "يحتفظ بسجل واحد للأنظمة البيئية والمائية والزراعية الملزمة للجهات ضمن النطاق، يبين الجهة المصدرة والنطاق والحالة والالتزامات بلغة الممارسين. وترصد خدمة تتبع التغييرات التعديلات والصكوك الجديدة وتحيلها إلى لجنة المراجعة التنظيمية.",
    ownerUnitCode: "RLR",
    status: "on_track",
    priorityImpact: 4,
    priorityFeasibility: 4,
    budgetQar: 1450000,
    inputsEn:
      "Consumes official publications of MEWA, NCEC, NCW, NCVC and MWAN, legal review time, and analysts from the regulatory team.",
    inputsAr:
      "يستهلك المنشورات الرسمية لوزارة البيئة والمياه والزراعة والمركز الوطني للرقابة على الالتزام البيئي والمركز الوطني للحياة الفطرية والمركز الوطني لتنمية الغطاء النباتي ومكافحة التصحر والمركز الوطني لإدارة النفايات، ووقت المراجعة القانونية ومحللين من الفريق التنظيمي.",
    people: 7,
    systemsEn: ["Regulatory Register", "Source Library"],
    systemsAr: ["سجل الأنظمة", "مكتبة المصادر"],
    activities: [
      {
        titleEn: "Scope and structure of the register",
        titleAr: "نطاق السجل وهيكله",
        status: "completed",
      },
      {
        titleEn: "Loading and review of priority instruments",
        titleAr: "تحميل الصكوك ذات الأولوية ومراجعتها",
        status: "completed",
      },
      {
        titleEn: "Change tracking alerts and panel routing",
        titleAr: "تنبيهات تتبع التغييرات والإحالة إلى اللجنة",
        status: "on_track",
      },
      {
        titleEn: "Quarterly register review with the Regulatory Review Panel",
        titleAr: "المراجعة ربع السنوية للسجل مع لجنة المراجعة التنظيمية",
        status: "on_track",
      },
    ],
  },

  /* ---------- G4.IO1.OP2 knowledge management and continuity ---------- */
  {
    code: "CP-38",
    outputCode: "G4.IO1.OP2",
    titleEn: "Office knowledge management and role continuity programme",
    titleAr: "برنامج إدارة المعرفة واستمرارية الأدوار في المكتب",
    descriptionEn:
      "Captures the know how of each critical role in handover notes, decision records and lessons, so that the Office keeps its institutional memory when people move. Adoption is uneven because unit heads have not yet made handover notes mandatory.",
    descriptionAr:
      "يوثق خبرة كل دور حرج في مذكرات التسليم وسجلات القرارات والدروس المستفادة، ليحتفظ المكتب بذاكرته المؤسسية عند انتقال الموظفين. ويتفاوت الالتزام لأن رؤساء الوحدات لم يجعلوا مذكرات التسليم إلزامية بعد.",
    ownerUnitCode: "KMD",
    status: "at_risk",
    priorityImpact: 3,
    priorityFeasibility: 3,
    budgetQar: 0,
    inputsEn:
      "Consumes the critical roles list, handover note templates, and the institutional memory repository.",
    inputsAr:
      "يستهلك قائمة الأدوار الحرجة وقوالب مذكرات التسليم ومستودع الذاكرة المؤسسية.",
    people: 6,
    systemsEn: ["Knowledge Portal", "Human Resources System"],
    systemsAr: ["بوابة المعرفة", "نظام الموارد البشرية"],
    activities: [
      {
        titleEn: "Critical roles list and handover note template",
        titleAr: "قائمة الأدوار الحرجة وقالب مذكرة التسليم",
        status: "completed",
      },
      {
        titleEn: "Handover notes for critical roles in each unit",
        titleAr: "مذكرات التسليم للأدوار الحرجة في كل وحدة",
        status: "at_risk",
      },
      {
        titleEn: "Lessons learned sessions and knowledge portal updates",
        titleAr: "جلسات الدروس المستفادة وتحديثات بوابة المعرفة",
        status: "at_risk",
      },
    ],
  },

  /* ---------- G4.IO2.OP1 digital workplace ---------- */
  {
    code: "CP-39",
    outputCode: "G4.IO2.OP1",
    titleEn: "Unified digital workplace and process automation",
    titleAr: "بيئة العمل الرقمية الموحدة وأتمتة العمليات",
    descriptionEn:
      "Brings messaging, documents, approvals and workflow into one digital workplace and automates the high volume processes of the Office, such as correspondence, procurement requests and leave. Phased by unit.",
    descriptionAr:
      "يجمع المراسلة والمستندات والموافقات وسير العمل في بيئة عمل رقمية واحدة ويؤتمت العمليات عالية الحجم في المكتب، مثل المراسلات وطلبات الشراء والإجازات. وينفذ على مراحل حسب الوحدات.",
    ownerUnitCode: "DIG",
    status: "on_track",
    priorityImpact: 4,
    priorityFeasibility: 3,
    budgetQar: 8600000,
    inputsEn:
      "Consumes process maps, the digital workplace licences, and a systems integrator.",
    inputsAr:
      "يستهلك خرائط العمليات وتراخيص بيئة العمل الرقمية ومتعهد تكامل.",
    people: 12,
    systemsEn: ["Digital Workplace Platform", "Process Automation Engine", "Programme Document Repository"],
    systemsAr: ["منصة بيئة العمل الرقمية", "محرك أتمتة العمليات", "مستودع وثائق البرنامج"],
    activities: [
      {
        titleEn: "Process mapping and automation priorities",
        titleAr: "تحديد العمليات وأولويات الأتمتة",
        status: "completed",
      },
      {
        titleEn: "Platform deployment and document migration",
        titleAr: "نشر المنصة وترحيل المستندات",
        status: "completed",
      },
      {
        titleEn: "Automation of correspondence and approval workflows",
        titleAr: "أتمتة مسارات المراسلات والموافقات",
        status: "on_track",
      },
      {
        titleEn: "Rollout to the remaining units and user training",
        titleAr: "التعميم على بقية الوحدات وتدريب المستخدمين",
        status: "on_track",
      },
    ],
  },

  /* ---------- G4.IO2.OP2 information security and continuity ---------- */
  {
    code: "CP-40",
    outputCode: "G4.IO2.OP2",
    titleEn: "Information security and business continuity uplift",
    titleAr: "رفع مستوى أمن المعلومات واستمرارية الأعمال",
    descriptionEn:
      "Strengthens security monitoring, access control and recovery capability for the systems that carry the Office's data and decisions, and tests continuity plans for the critical services. Controls follow the national cybersecurity requirements that apply to the Office.",
    descriptionAr:
      "يعزز مراقبة الأمن وضبط الوصول وقدرة التعافي للأنظمة التي تحمل بيانات المكتب وقراراته، ويختبر خطط الاستمرارية للخدمات الحرجة. وتتبع الضوابط متطلبات الأمن السيبراني الوطنية السارية على المكتب.",
    ownerUnitCode: "DGS",
    status: "on_track",
    priorityImpact: 5,
    priorityFeasibility: 3,
    budgetQar: 5300000,
    inputsEn:
      "Consumes the security assessment, a security operations service, and continuity plan owners in each unit.",
    inputsAr:
      "يستهلك تقييم الأمن وخدمة عمليات أمنية وأصحاب خطط الاستمرارية في كل وحدة.",
    people: 9,
    systemsEn: ["Security Operations Platform", "Business Continuity Register"],
    systemsAr: ["منصة العمليات الأمنية", "سجل استمرارية الأعمال"],
    activities: [
      {
        titleEn: "Security gap assessment",
        titleAr: "تقييم الفجوات الأمنية",
        status: "completed",
      },
      {
        titleEn: "Security monitoring and access control upgrades",
        titleAr: "تطوير مراقبة الأمن وضبط الوصول",
        status: "on_track",
      },
      {
        titleEn: "Continuity plan testing for critical services",
        titleAr: "اختبار خطط الاستمرارية للخدمات الحرجة",
        status: "on_track",
      },
    ],
  },

  /* ---------- G4.IO2.OP3 internal performance reporting ---------- */
  {
    code: "CP-41",
    outputCode: "G4.IO2.OP3",
    titleEn: "Internal performance reporting cockpit",
    titleAr: "لوحة الأداء الداخلي للمكتب",
    descriptionEn:
      "A management cockpit that reports the Office's own performance, including delivery, budget, people and service levels, from the operational systems. Delayed because source data in finance and human resources is not yet consistent.",
    descriptionAr:
      "لوحة إدارية تعرض أداء المكتب نفسه، ويشمل التنفيذ والميزانية والكوادر ومستويات الخدمة، من الأنظمة التشغيلية. وتأخرت لأن بيانات المصدر في المالية والموارد البشرية لم تتسق بعد.",
    ownerUnitCode: "DTO",
    status: "delayed",
    priorityImpact: 2,
    priorityFeasibility: 3,
    budgetQar: 1150000,
    inputsEn:
      "Consumes extracts from the finance, human resources and service desk systems.",
    inputsAr:
      "يستهلك استخراجات من أنظمة المالية والموارد البشرية ومكتب الخدمة.",
    people: 5,
    systemsEn: ["Delivery Dashboard", "Financial Management System", "Human Resources System"],
    systemsAr: ["لوحة التنفيذ", "نظام الإدارة المالية", "نظام الموارد البشرية"],
    activities: [
      {
        titleEn: "Measures and definitions for internal performance",
        titleAr: "المقاييس والتعريفات للأداء الداخلي",
        status: "completed",
      },
      {
        titleEn: "Data alignment between finance and human resources",
        titleAr: "مواءمة البيانات بين المالية والموارد البشرية",
        status: "delayed",
      },
      {
        titleEn: "Cockpit build and release",
        titleAr: "بناء اللوحة وإطلاقها",
        status: "delayed",
      },
    ],
  },

  /* ---------- G5.IO1.OP1 partnership programme ---------- */
  {
    code: "CP-42",
    outputCode: "G5.IO1.OP1",
    titleEn: "Research partnership programme with Saudi universities",
    titleAr: "برنامج الشراكة البحثية مع الجامعات السعودية",
    descriptionEn:
      "Frames joint research and secondment arrangements with Saudi universities and research centres, including KAUST, KFUPM and KACST, on questions the Programme Strategy needs answered. Agreements with two partners are delayed by intellectual property terms.",
    descriptionAr:
      "يحدد ترتيبات البحث المشترك والإعارة مع الجامعات ومراكز البحث السعودية، ومنها جامعة الملك عبدالله للعلوم والتقنية وجامعة الملك فهد للبترول والمعادن ومدينة الملك عبدالعزيز للعلوم والتقنية، حول الأسئلة التي تحتاج استراتيجية المكتب إلى إجابتها. وتتأخر اتفاقيات مع شريكين بسبب بنود الملكية الفكرية.",
    ownerUnitCode: "PAR",
    status: "delayed",
    priorityImpact: 3,
    priorityFeasibility: 4,
    budgetQar: 2100000,
    inputsEn:
      "Consumes a research agenda, partner agreements, and a small grant pool.",
    inputsAr:
      "يستهلك أجندة بحثية واتفاقيات الشراكة ومخصصا صغيرا للمنح.",
    people: 6,
    systemsEn: ["Agreement Register", "Collaboration Workspace"],
    systemsAr: ["سجل الاتفاقيات", "مساحة العمل التعاونية"],
    activities: [
      {
        titleEn: "Research agenda with the theme departments",
        titleAr: "الأجندة البحثية مع إدارات المحاور",
        status: "completed",
      },
      {
        titleEn: "Framework agreements with partner universities",
        titleAr: "الاتفاقيات الإطارية مع الجامعات الشريكة",
        status: "delayed",
      },
      {
        titleEn: "First joint research projects and secondments",
        titleAr: "أولى المشاريع البحثية المشتركة وترتيبات الإعارة",
        status: "delayed",
      },
    ],
  },

  /* ---------- G5.IO1.OP2 international cooperation ---------- */
  {
    code: "CP-43",
    outputCode: "G5.IO1.OP2",
    titleEn: "Global indicators engagement and reporting unit",
    titleAr: "وحدة التفاعل مع المؤشرات العالمية وإعداد تقاريرها",
    descriptionEn:
      "A small unit that tracks how Saudi Arabia is represented in international indicators, keeps contact with the custodian agencies (SDG custodians, UNEP, FAO, World Bank) and prepares the Office's input to reports. Request volumes are rising and the unit is stretched.",
    descriptionAr:
      "وحدة صغيرة ترصد تمثيل السعودية في المؤشرات الدولية وتحافظ على التواصل مع الوكالات الوصية (الجهات الوصية على أهداف التنمية المستدامة وبرنامج الأمم المتحدة للبيئة ومنظمة الأغذية والزراعة والبنك الدولي) وتعد مدخلات المكتب للتقارير. وترتفع أحجام الطلبات والوحدة تعمل بطاقة مشدودة.",
    ownerUnitCode: "PAR",
    status: "at_risk",
    priorityImpact: 4,
    priorityFeasibility: 2,
    budgetQar: 1680000,
    inputsEn:
      "Consumes custodian agency questionnaires, national data from GASTAT and the regulators, and analyst time.",
    inputsAr:
      "يستهلك استبيانات الوكالات الوصية والبيانات الوطنية من الهيئة العامة للإحصاء والجهات التنظيمية ووقت المحللين.",
    people: 7,
    systemsEn: ["International Indicators Register", "Open Data Portal"],
    systemsAr: ["سجل المؤشرات الدولية", "بوابة البيانات المفتوحة"],
    activities: [
      {
        titleEn: "Register of international indicators and custodians",
        titleAr: "سجل المؤشرات الدولية والجهات الوصية",
        status: "completed",
      },
      {
        titleEn: "Coordinated responses to custodian questionnaires",
        titleAr: "الردود المنسقة على استبيانات الجهات الوصية",
        status: "at_risk",
      },
      {
        titleEn: "Annual brief on Saudi Arabia's position in global indicators",
        titleAr: "الموجز السنوي عن موقع السعودية في المؤشرات العالمية",
        status: "at_risk",
      },
    ],
  },

  /* ---------- G5.IO2.OP1 communication and publication plan ---------- */
  {
    code: "CP-44",
    outputCode: "G5.IO2.OP1",
    titleEn: "Integrated communication and publications plan",
    titleAr: "خطة الاتصال والمنشورات المتكاملة",
    descriptionEn:
      "One annual plan for publications, media, events and digital channels, so that the Office speaks with a consistent voice and releases land on the published calendar. It includes the annual environment statistical digest and the Saudi Green Initiative Forum contribution.",
    descriptionAr:
      "خطة سنوية واحدة للمنشورات والإعلام والفعاليات والقنوات الرقمية، ليتحدث المكتب بصوت متسق وتصدر الإصدارات وفق التقويم المنشور. وتشمل الموجز الإحصائي البيئي السنوي والمساهمة في منتدى مبادرة السعودية الخضراء.",
    ownerUnitCode: "COM",
    status: "on_track",
    priorityImpact: 3,
    priorityFeasibility: 4,
    budgetQar: 2750000,
    inputsEn:
      "Consumes the release calendar, publication drafts from the units, and communication agency support.",
    inputsAr:
      "يستهلك تقويم الإصدار ومسودات المنشورات من الوحدات ودعم وكالة الاتصال.",
    people: 8,
    systemsEn: ["Publication Workflow", "Media Monitoring Service", "Open Data Portal"],
    systemsAr: ["سير عمل النشر", "خدمة رصد الإعلام", "بوابة البيانات المفتوحة"],
    activities: [
      {
        titleEn: "Communication strategy and annual calendar",
        titleAr: "استراتيجية الاتصال والتقويم السنوي",
        status: "completed",
      },
      {
        titleEn: "Publication production and media engagement",
        titleAr: "إنتاج المنشورات والتواصل الإعلامي",
        status: "on_track",
      },
      {
        titleEn: "Media monitoring and quarterly reach review",
        titleAr: "رصد الإعلام ومراجعة الانتشار ربع السنوية",
        status: "on_track",
      },
    ],
  },

  /* ---------- G5.IO2.OP2 steering committee sessions and follow up ---------- */
  {
    code: "CP-45",
    outputCode: "G5.IO2.OP2",
    titleEn: "Steering committee sessions and decision follow up service",
    titleAr: "خدمة جلسات اللجنة التوجيهية ومتابعة القرارات",
    descriptionEn:
      "Prepares the sessions of the Programme Steering Committee, circulates papers on time, records decisions and follows each one to closure. The decision log is now the single record used by the Programme Director.",
    descriptionAr:
      "يعد جلسات اللجنة التوجيهية للبرنامج ويعمم الأوراق في موعدها ويسجل القرارات ويتابع كل قرار حتى إغلاقه. ويمثل سجل القرارات الآن السجل الوحيد الذي يعتمد عليه مدير البرنامج.",
    ownerUnitCode: "PSA",
    status: "completed",
    priorityImpact: 4,
    priorityFeasibility: 5,
    budgetQar: 0,
    inputsEn:
      "Consumes committee agendas, paper submissions from the units, and the decision log.",
    inputsAr:
      "يستهلك جداول أعمال اللجنة والأوراق المقدمة من الوحدات وسجل القرارات.",
    people: 5,
    systemsEn: ["Decision Log", "Programme Document Repository"],
    systemsAr: ["سجل القرارات", "مستودع وثائق البرنامج"],
    activities: [
      {
        titleEn: "Paper submission rules and circulation timetable",
        titleAr: "قواعد تقديم الأوراق وجدول التعميم",
        status: "completed",
      },
      {
        titleEn: "Decision log and action tracking",
        titleAr: "سجل القرارات وتتبع الإجراءات",
        status: "completed",
      },
      {
        titleEn: "Quarterly decision follow up report",
        titleAr: "تقرير المتابعة ربع السنوي للقرارات",
        status: "completed",
      },
    ],
  },
];
