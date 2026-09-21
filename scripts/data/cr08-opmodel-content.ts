// CR08 10: illustrative content for the Operating Model and the process
// architecture. Hand written bilingual words; everything mechanical (ids,
// dates of recurring events, KPI histories) is generated in
// scripts/cr08-opmodel-seed.ts deterministically.
//
// IMPORTANT: the content below is ILLUSTRATIVE. It is a plausible operating
// model written to exercise the /processes and /operating-model screens, not
// the approved operating model of the National Planning Council. Every row
// seeded from this file is marked is_illustrative = 1 and shows the
// "Illustrative" chip until the real content replaces it. Unit codes are the
// published npc.qa codes and must not be edited here without checking
// sources/org/org-structure.json. Entity names must match the entities
// register (short_name_en). Policy references are the CR07 policy source refs.

export type Bi = { en: string; ar: string };

export type PrincipleSeed = { titleEn: string; titleAr: string; textEn: string; textAr: string };

export type GovernanceBodySeed = {
  key: string;
  nameEn: string;
  nameAr: string;
  roleEn: string;
  roleAr: string;
  decisionsEn: string[];
  decisionsAr: string[];
  cadence: string;
  members: Bi[];
  escalatesTo: string | null;
  escalationEn: string;
  escalationAr: string;
};

/** Decisions and the escalation path for the bodies the Council Strategy already carries. */
export type CouncilEnrichmentSeed = {
  matchNameEn: string;
  key: string;
  decisionsEn: string[];
  decisionsAr: string[];
  escalatesTo: string | null;
  escalationEn: string;
  escalationAr: string;
};

export type ConnectorKind = "reports_to" | "escalates_to" | "advises" | "delegates_to" | "informs";
export type ConnectorSeed = { from: string; to: string; kind: ConnectorKind };

export type StepSeed = { n: number; text_en: string; text_ar: string; role_unit_code?: string; system?: string };
export type IoSeed = { text_en: string; text_ar: string; from_unit_code?: string };
export type SystemSeed = { name_en: string; name_ar: string };
export type KpiSeed = { name_en: string; name_ar: string; target?: string; unit?: string };

export type ProcessSeed = {
  code: string;
  level: 0 | 1 | 2;
  parentCode: string | null;
  nameEn: string;
  nameAr: string;
  purposeEn: string;
  purposeAr: string;
  ownerUnitCode: string;
  inputs?: IoSeed[];
  outputs?: IoSeed[];
  steps?: StepSeed[];
  systems?: SystemSeed[];
  kpis?: KpiSeed[];
  /** CR07 policy source refs ("cr07 policy: HR/policy_internal/v2.0") */
  policyDocRefs?: string[];
  sopDocRefs?: string[];
};

export type RaciSeed = { processCode: string; A: string; R: string[]; C: string[]; I: string[] };

export type CalendarSeed = {
  kind: "strategy_review" | "budget" | "statistical_release" | "nds_review" | "council_meeting" | "report_deadline" | "forum" | "other";
  titleEn: string;
  titleAr: string;
  dateFrom: string;
  dateTo?: string;
  ownerUnitCode?: string;
  /** report_type: code; release: title_en; process: code; council_strategy: "default" */
  linked?: { type: "report_type" | "release" | "process" | "council_strategy"; ref: string };
  recurrence: "none" | "annual" | "quarterly" | "monthly";
};

export type FlowKind = "data" | "input" | "approval" | "review" | "deliverable";
export type UnitInterfaceSeed = {
  from: string;
  to: string;
  flowKind: FlowKind;
  descriptionEn: string;
  descriptionAr: string;
  triggerEn: string;
  triggerAr: string;
  cadence: string;
  serviceLevel: string;
  processCode: string;
  focalFromEmail?: string;
  focalToEmail?: string;
};

export type EntityInterfaceSeed = {
  entityShort: string;
  providesEn: string;
  providesAr: string;
  receivesEn: string;
  receivesAr: string;
  focalNpcUnitCode: string;
  focalEntityName: string;
  legalBasisEn: string;
  legalBasisAr: string;
  cadence: string;
  processCodes: string[];
};

export type OpsKpiSeed = {
  code: string;
  nameEn: string;
  nameAr: string;
  unit: string;
  direction: "up_good" | "down_good";
  sourceKind: "auto" | "manual";
  target: number;
  /** January to September 2026, oldest first */
  values: number[];
};

const step = (n: number, text_en: string, text_ar: string, role_unit_code?: string, system?: string): StepSeed => ({ n, text_en, text_ar, role_unit_code, system });
const io = (text_en: string, text_ar: string, from_unit_code?: string): IoSeed => ({ text_en, text_ar, from_unit_code });
const sys = (name_en: string, name_ar: string): SystemSeed => ({ name_en, name_ar });
const kpi = (name_en: string, name_ar: string, target?: string, unit?: string): KpiSeed => ({ name_en, name_ar, target, unit });

/* ------------------------------------------------------------------ */
/* 1. Operating principles                                              */
/* ------------------------------------------------------------------ */

export const PRINCIPLES: PrincipleSeed[] = [
  {
    titleEn: "Evidence-based planning",
    titleAr: "التخطيط المستند إلى الأدلة",
    textEn: "Every national plan, target and policy recommendation rests on data whose source is named and a method that can be explained; where the evidence is thin the plan says so.",
    textAr: "تستند كل خطة وطنية ومستهدف وتوصية سياساتية إلى بيانات محددة المصدر ومنهجية قابلة للشرح، وحين تكون الأدلة محدودة تُصرّح الخطة بذلك.",
  },
  {
    titleEn: "One national data source",
    titleAr: "مصدر وطني واحد للبيانات",
    textEn: "Official statistics are produced once, to one standard, and reused by every entity; no figure reaches a national decision through a parallel channel.",
    textAr: "تُنتج الإحصاءات الرسمية مرة واحدة وفق معيار واحد وتُعاد الاستفادة منها في كل جهة، ولا يصل أي رقم إلى قرار وطني عبر قناة موازية.",
  },
  {
    titleEn: "Results orientation",
    titleAr: "التوجه نحو النتائج",
    textEn: "Work is planned, budgeted and reported as a results chain from inputs to national outcomes, and progress is judged by what changed for the country, not by activity counts.",
    textAr: "يُخطط العمل ويُموَّل ويُرفع عنه التقرير بوصفه سلسلة نتائج من المدخلات إلى النتائج الوطنية، ويُقاس التقدم بما تغير للدولة لا بعدد الأنشطة.",
  },
  {
    titleEn: "Partnership with entities",
    titleAr: "الشراكة مع الجهات",
    textEn: "Government entities are partners in delivery, not recipients of instructions; every interface with an entity has a named focal point on both sides and an agreed cadence.",
    textAr: "الجهات الحكومية شريكة في التنفيذ لا متلقية للتعليمات، ولكل واجهة تعامل مع جهة منسق مسمّى من الطرفين ودورية متفق عليها.",
  },
  {
    titleEn: "Foresight before planning",
    titleAr: "الاستشراف قبل التخطيط",
    textEn: "Signals, scenarios and risks feed every planning cycle at its start, so that plans prepare for what is likely and for what is merely possible.",
    textAr: "تغذي الإشارات والسيناريوهات والمخاطر كل دورة تخطيط في بدايتها، لتستعد الخطط لما هو مرجّح ولما هو ممكن فحسب.",
  },
  {
    titleEn: "Institutional learning",
    titleAr: "التعلم المؤسسي",
    textEn: "Every process closes with a lesson recorded where the next team will find it, and every departure hands knowledge over deliberately so the Council never loses a capability with a person.",
    textAr: "تُختتم كل عملية بدرس يُدوَّن حيث يجده الفريق التالي، ويُسلَّم كل مغادر معرفته بشكل منظم حتى لا يفقد المجلس قدرة برحيل شخص.",
  },
];

/* ------------------------------------------------------------------ */
/* 2. Governance bodies beyond the Council Strategy's own three         */
/* ------------------------------------------------------------------ */

export const GOVERNANCE_BODIES: GovernanceBodySeed[] = [
  {
    key: "council",
    nameEn: "The National Planning Council",
    nameAr: "المجلس الوطني للتخطيط",
    roleEn: "The Council, under its Chairman, is the highest authority of the institution. It adopts the national development strategy and its reviews, approves the statistical programme and the annual report, and directs the Secretary General.",
    roleAr: "المجلس برئاسة رئيسه هو السلطة العليا للمؤسسة. يعتمد استراتيجية التنمية الوطنية ومراجعاتها، ويقر البرنامج الإحصائي والتقرير السنوي، ويوجه الأمين العام.",
    decisionsEn: ["Adoption of the national development strategy and its mid-term review", "Approval of the annual statistical programme and the census plan", "Approval of the annual report to the Council of Ministers", "Positions on matters escalated by the Secretary General"],
    decisionsAr: ["اعتماد استراتيجية التنمية الوطنية ومراجعتها النصفية", "إقرار البرنامج الإحصائي السنوي وخطة التعداد", "اعتماد التقرير السنوي المرفوع إلى مجلس الوزراء", "البت في الموضوعات التي يرفعها الأمين العام"],
    cadence: "quarterly",
    members: [{ en: "Chairman of the Council", ar: "رئيس المجلس" }, { en: "Members of the Council", ar: "أعضاء المجلس" }, { en: "Secretary General, Rapporteur", ar: "الأمين العام، مقرراً" }],
    escalatesTo: null,
    escalationEn: "Final authority within the institution; matters beyond its mandate go to the Council of Ministers.",
    escalationAr: "السلطة النهائية داخل المؤسسة، وما يتجاوز اختصاصها يُرفع إلى مجلس الوزراء.",
  },
  {
    key: "secretary_general",
    nameEn: "The Secretary General",
    nameAr: "الأمين العام",
    roleEn: "Directs the General Secretariat, chairs the Executive Committee and the Strategy Steering Committee, approves the operating model and its processes, and represents the Council before government entities.",
    roleAr: "يدير الأمانة العامة، ويرأس اللجنة التنفيذية ولجنة توجيه الاستراتيجية، ويعتمد نموذج التشغيل وعملياته، ويمثل المجلس أمام الجهات الحكومية.",
    decisionsEn: ["Approval of the operating model, the process architecture and the RACI", "Allocation of budget and people between sectors", "Release of statistical products that depart from the pre-announced calendar", "Escalations from the Executive Committee and the Strategy Steering Committee"],
    decisionsAr: ["اعتماد نموذج التشغيل وهيكل العمليات ومصفوفة المسؤوليات", "توزيع الموازنة والكوادر بين القطاعات", "الإذن بإصدار المنتجات الإحصائية الخارجة عن التقويم المعلن", "التصعيدات الواردة من اللجنة التنفيذية ولجنة توجيه الاستراتيجية"],
    cadence: "weekly",
    members: [{ en: "Secretary General", ar: "الأمين العام" }, { en: "Office of the Secretary General", ar: "مكتب الأمين العام" }, { en: "Technical Office and Decision Support", ar: "المكتب الفني ودعم اتخاذ القرار" }],
    escalatesTo: "council",
    escalationEn: "Matters of policy, mandate or national significance are escalated to the Council.",
    escalationAr: "تُرفع المسائل السياساتية أو المتعلقة بالاختصاص أو ذات الأهمية الوطنية إلى المجلس.",
  },
  {
    key: "executive_committee",
    nameEn: "Executive Committee",
    nameAr: "اللجنة التنفيذية",
    roleEn: "The Assistant Secretaries General with the Secretary General run the institution week to week: cross-sector priorities, the operating calendar, interface disputes between units and the operational KPI scorecard.",
    roleAr: "يدير مساعدو الأمين العام مع الأمين العام المؤسسة أسبوعاً بأسبوع: الأولويات العابرة للقطاعات، والتقويم التشغيلي، والخلافات على الواجهات بين الوحدات، وبطاقة مؤشرات الأداء التشغيلي.",
    decisionsEn: ["Approval of changes to unit-to-unit interfaces proposed by unit heads", "Monthly review of the operational KPI scorecard", "Sequencing of the annual planning and reporting calendar", "Resolution of ownership questions between sectors"],
    decisionsAr: ["اعتماد تعديلات الواجهات بين الوحدات المقترحة من رؤساء الوحدات", "المراجعة الشهرية لبطاقة مؤشرات الأداء التشغيلي", "ترتيب تقويم التخطيط والتقارير السنوي", "حسم مسائل الملكية بين القطاعات"],
    cadence: "monthly",
    members: [{ en: "Secretary General, Chair", ar: "الأمين العام، رئيساً" }, { en: "Assistant Secretary General, National Planning and Development Policy Affairs", ar: "مساعد الأمين العام لشؤون التخطيط والسياسات التنموية الوطنية" }, { en: "Director General, National Statistics Center", ar: "المدير العام لمركز الإحصاء الوطني" }, { en: "Assistant Secretary General, Follow-up Affairs and Implementation Support", ar: "مساعد الأمين العام لشؤون المتابعة ودعم التنفيذ" }, { en: "Assistant Secretary General, Future Foresight and National Visions Affairs", ar: "مساعد الأمين العام لشؤون استشراف المستقبل والرؤى الوطنية" }, { en: "Assistant Secretary General, Council Affairs", ar: "مساعد الأمين العام لشؤون المجلس" }, { en: "Assistant Secretary General, Shared Services Affairs", ar: "مساعد الأمين العام لشؤون الخدمات المشتركة" }],
    escalatesTo: "secretary_general",
    escalationEn: "Anything the committee cannot settle by consensus is decided by the Secretary General.",
    escalationAr: "ما تعجز اللجنة عن حسمه بالتوافق يبت فيه الأمين العام.",
  },
  {
    key: "statistics_committee",
    nameEn: "National Statistics Committee",
    nameAr: "لجنة الإحصاء الوطنية",
    roleEn: "Governs the national statistical system: the statistical programme, the release calendar, methodological changes, revisions policy and the confidentiality regime, with the data-producing entities represented.",
    roleAr: "تحكم المنظومة الإحصائية الوطنية: البرنامج الإحصائي، وتقويم الإصدار، والتغييرات المنهجية، وسياسة المراجعات، ونظام السرية، بتمثيل الجهات المنتجة للبيانات.",
    decisionsEn: ["The annual release calendar and any change to a published date", "Methodological changes to an official statistic", "Access to microdata beyond the standard service", "Quality findings requiring corrective action by an entity"],
    decisionsAr: ["تقويم الإصدار السنوي وأي تغيير في موعد معلن", "التغييرات المنهجية على إحصاء رسمي", "الوصول إلى البيانات الجزئية خارج الخدمة المعتادة", "نتائج الجودة التي تستوجب إجراءً تصحيحياً من جهة"],
    cadence: "quarterly",
    members: [{ en: "Director General, National Statistics Center, Chair", ar: "المدير العام لمركز الإحصاء الوطني، رئيساً" }, { en: "Directors of the statistical departments", ar: "مديرو الإدارات الإحصائية" }, { en: "Director of Statistics Quality", ar: "مدير إدارة جودة الإحصاءات" }, { en: "Representatives of the main data-producing entities", ar: "ممثلو الجهات الرئيسية المنتجة للبيانات" }],
    escalatesTo: "executive_committee",
    escalationEn: "Disagreements with an entity on data provision are escalated to the Executive Committee.",
    escalationAr: "تُرفع الخلافات مع الجهات بشأن توفير البيانات إلى اللجنة التنفيذية.",
  },
  {
    key: "data_governance_board",
    nameEn: "Data Governance Board",
    nameAr: "مجلس حوكمة البيانات",
    roleEn: "Owns the data standards, the classification scheme, the data-sharing agreements and the access controls across the Council and the entities it serves.",
    roleAr: "يملك معايير البيانات، ومخطط التصنيف، واتفاقيات تبادل البيانات، وضوابط الوصول على مستوى المجلس والجهات التي يخدمها.",
    decisionsEn: ["Adoption of data standards and common definitions", "Approval of data-sharing agreements with entities", "Classification of new datasets and exceptions to the access rules", "Remediation plans for data quality gaps"],
    decisionsAr: ["اعتماد معايير البيانات والتعاريف الموحدة", "اعتماد اتفاقيات تبادل البيانات مع الجهات", "تصنيف مجموعات البيانات الجديدة والاستثناءات من قواعد الوصول", "خطط معالجة فجوات جودة البيانات"],
    cadence: "monthly",
    members: [{ en: "Director of National Data Affairs, Chair", ar: "مدير إدارة شؤون البيانات والإحصاءات الوطنية، رئيساً" }, { en: "Director of Statistics Quality", ar: "مدير إدارة جودة الإحصاءات" }, { en: "Director of Statistical Systems", ar: "مدير إدارة الأنظمة الإحصائية" }, { en: "Director of Information Security", ar: "مدير إدارة أمن المعلومات" }, { en: "Director of Information Systems", ar: "مدير إدارة نظم المعلومات" }, { en: "Legal Affairs representative", ar: "ممثل إدارة الشؤون القانونية" }],
    escalatesTo: "statistics_committee",
    escalationEn: "Standards disputes and refusals to share data are escalated to the National Statistics Committee.",
    escalationAr: "تُرفع الخلافات على المعايير ورفض تبادل البيانات إلى لجنة الإحصاء الوطنية.",
  },
];

export const COUNCIL_ENRICHMENT: CouncilEnrichmentSeed[] = [
  {
    matchNameEn: "Strategy Steering Committee",
    key: "strategy_steering_committee",
    decisionsEn: ["Annual targets of the institutional strategy", "Quarterly scorecard and risk register review", "Reallocation of budget and people between council projects"],
    decisionsAr: ["المستهدفات السنوية للاستراتيجية المؤسسية", "المراجعة الربعية لبطاقة الأداء وسجل المخاطر", "إعادة توزيع الموازنة والكوادر بين مشاريع المجلس"],
    escalatesTo: "secretary_general",
    escalationEn: "Blockers the committee cannot clear go to the Secretary General.",
    escalationAr: "تُرفع المعوقات التي تعجز اللجنة عن تذليلها إلى الأمين العام.",
  },
  {
    matchNameEn: "Strategy Office",
    key: "strategy_office",
    decisionsEn: ["Maintenance of the results chain, the indicator cards and the process architecture", "Acceptance of a reported actual as evidenced", "Approval of interface changes on behalf of the Executive Committee"],
    decisionsAr: ["صيانة سلسلة النتائج وبطاقات المؤشرات وهيكل العمليات", "قبول القيمة الفعلية المرفوعة بوصفها موثقة بالأدلة", "اعتماد تعديلات الواجهات نيابة عن اللجنة التنفيذية"],
    escalatesTo: "strategy_steering_committee",
    escalationEn: "Amendments to goals, targets or ownership go to the Strategy Steering Committee.",
    escalationAr: "تُرفع تعديلات الأهداف أو المستهدفات أو الملكية إلى لجنة توجيه الاستراتيجية.",
  },
  {
    matchNameEn: "Department Focal Points Network",
    key: "focal_points",
    decisionsEn: ["Status of projects and activities inside the department", "Actuals entered for the department's own indicators", "New risks and lessons raised from the department"],
    decisionsAr: ["حالة المشاريع والأنشطة داخل الإدارة", "القيم الفعلية المدخلة لمؤشرات الإدارة", "المخاطر والدروس الجديدة المرفوعة من الإدارة"],
    escalatesTo: "strategy_office",
    escalationEn: "Evidence disputes and cross-department dependencies go to the Strategy Office.",
    escalationAr: "تُرفع الخلافات على الأدلة والاعتماديات بين الإدارات إلى مكتب الاستراتيجية.",
  },
];

export const CONNECTORS: ConnectorSeed[] = [
  { from: "secretary_general", to: "council", kind: "reports_to" },
  { from: "executive_committee", to: "secretary_general", kind: "escalates_to" },
  { from: "strategy_steering_committee", to: "secretary_general", kind: "escalates_to" },
  { from: "statistics_committee", to: "executive_committee", kind: "escalates_to" },
  { from: "data_governance_board", to: "statistics_committee", kind: "escalates_to" },
  { from: "strategy_office", to: "strategy_steering_committee", kind: "reports_to" },
  { from: "focal_points", to: "strategy_office", kind: "reports_to" },
  { from: "strategy_office", to: "executive_committee", kind: "advises" },
  { from: "data_governance_board", to: "strategy_office", kind: "informs" },
  { from: "secretary_general", to: "executive_committee", kind: "delegates_to" },
];

/* ------------------------------------------------------------------ */
/* 3. The process architecture: Level 0, Level 1, Level 2               */
/* ------------------------------------------------------------------ */

export const LEVEL0: ProcessSeed[] = [
  { code: "P1", level: 0, parentCode: null, ownerUnitCode: "NPD", nameEn: "National strategy development", nameAr: "إعداد الاستراتيجية الوطنية", purposeEn: "Turn the national vision into a development strategy with outcomes, targets and owners that every entity plans against.", purposeAr: "تحويل الرؤية الوطنية إلى استراتيجية تنموية بنتائج ومستهدفات ومالكين تخطط على أساسها كل جهة." },
  { code: "P2", level: 0, parentCode: null, ownerUnitCode: "NPD", nameEn: "Sector strategy support", nameAr: "دعم الاستراتيجيات القطاعية", purposeEn: "Help every government entity write, align and appraise its own strategy so that sector plans add up to the national one.", purposeAr: "مساعدة كل جهة حكومية على إعداد استراتيجيتها ومواءمتها وتقييمها حتى تتكامل الخطط القطاعية مع الخطة الوطنية." },
  { code: "P3", level: 0, parentCode: null, ownerUnitCode: "FAI", nameEn: "Monitoring and evaluation", nameAr: "الرصد والتقييم", purposeEn: "Track delivery of the national strategy, support entities that fall behind, and evaluate what worked.", purposeAr: "متابعة تنفيذ الاستراتيجية الوطنية، ودعم الجهات المتأخرة، وتقييم ما نجح." },
  { code: "P4", level: 0, parentCode: null, ownerUnitCode: "NSC", nameEn: "Statistics production and dissemination", nameAr: "إنتاج الإحصاءات ونشرها", purposeEn: "Produce Qatar's official statistics from censuses, surveys and administrative records, and release them on a pre-announced calendar.", purposeAr: "إنتاج الإحصاءات الرسمية لدولة قطر من التعدادات والمسوح والسجلات الإدارية ونشرها وفق تقويم معلن مسبقاً." },
  { code: "P5", level: 0, parentCode: null, ownerUnitCode: "NSC", nameEn: "Data governance", nameAr: "حوكمة البيانات", purposeEn: "Set the standards, the classification and the sharing rules that make national data one trusted source.", purposeAr: "وضع المعايير والتصنيف وقواعد التبادل التي تجعل البيانات الوطنية مصدراً واحداً موثوقاً." },
  { code: "P6", level: 0, parentCode: null, ownerUnitCode: "FFV", nameEn: "Foresight and risk", nameAr: "الاستشراف والمخاطر", purposeEn: "Read the future early: scan signals, build scenarios and assess national risks before they reach a plan.", purposeAr: "قراءة المستقبل مبكراً: رصد الإشارات وبناء السيناريوهات وتقييم المخاطر الوطنية قبل أن تبلغ الخطة." },
  { code: "P7", level: 0, parentCode: null, ownerUnitCode: "CA", nameEn: "International index monitoring", nameAr: "متابعة المؤشرات الدولية", purposeEn: "Track Qatar's position in international indices and work with entities on the improvements that move it.", purposeAr: "متابعة موقع دولة قطر في المؤشرات الدولية والعمل مع الجهات على التحسينات التي تحرك هذا الموقع." },
  { code: "P8", level: 0, parentCode: null, ownerUnitCode: "SS", nameEn: "Institutional development", nameAr: "التطوير المؤسسي", purposeEn: "Keep the Council itself capable: its plans, its people, its knowledge and its systems.", purposeAr: "الحفاظ على قدرة المجلس نفسه: خططه وكوادره ومعرفته وأنظمته." },
];

export const LEVEL1_A: ProcessSeed[] = [
  {
    code: "P1.1", level: 1, parentCode: "P1", ownerUnitCode: "EDP",
    nameEn: "Situation analysis and diagnostics", nameAr: "تحليل الوضع الراهن والتشخيص",
    purposeEn: "Establish the evidence base of a planning cycle: where the country stands on every outcome, what changed since the last strategy and why.",
    purposeAr: "تأسيس قاعدة الأدلة لدورة التخطيط: أين تقف الدولة في كل نتيجة، وما الذي تغير منذ الاستراتيجية السابقة ولماذا.",
    inputs: [io("Official statistics and indicator series", "الإحصاءات الرسمية وسلاسل المؤشرات", "NSC"), io("Evaluation findings of the previous strategy", "نتائج تقييم الاستراتيجية السابقة", "MIF"), io("Foresight briefs and scenario sets", "موجزات الاستشراف ومجموعات السيناريوهات", "SF")],
    outputs: [io("Situation analysis report per outcome", "تقرير تحليل الوضع الراهن لكل نتيجة"), io("Baseline table for every candidate indicator", "جدول خط الأساس لكل مؤشر مرشح")],
    steps: [
      step(1, "Agree the analytical frame and the outcome list with the sector departments.", "الاتفاق على الإطار التحليلي وقائمة النتائج مع الإدارات القطاعية.", "EDP", "SiaNexus Strategy Canvas"),
      step(2, "Request the indicator series and the latest releases from the National Statistics Center.", "طلب سلاسل المؤشرات وأحدث الإصدارات من مركز الإحصاء الوطني.", "EDP", "Statistics Hub"),
      step(3, "Draft the diagnostic per outcome with the human, social and environmental departments.", "صياغة التشخيص لكل نتيجة مع إدارات التنمية البشرية والاجتماعية والبيئية.", "HDP", "SiaNexus Vault"),
      step(4, "Integrate the foresight scenarios and the risk register into the diagnostic.", "دمج سيناريوهات الاستشراف وسجل المخاطر في التشخيص.", "SF", "Signals Radar"),
      step(5, "Review the draft with the Strategy Office and file it as the cycle's baseline document.", "مراجعة المسودة مع مكتب الاستراتيجية وإيداعها بوصفها وثيقة خط الأساس للدورة.", "IDP", "SiaNexus Vault"),
    ],
    systems: [sys("Statistics Hub", "مركز الإحصاءات"), sys("SiaNexus Vault", "مستودع سيانكسس"), sys("Signals Radar", "رادار الإشارات")],
    kpis: [kpi("Outcomes with a signed baseline before formulation starts", "النتائج ذات خط أساس معتمد قبل بدء الصياغة", "100", "percent"), kpi("Weeks from cycle launch to the diagnostic report", "الأسابيع من إطلاق الدورة إلى تقرير التشخيص", "10", "weeks")],
  },
  {
    code: "P1.2", level: 1, parentCode: "P1", ownerUnitCode: "IDP",
    nameEn: "Strategy formulation and results chain design", nameAr: "صياغة الاستراتيجية وتصميم سلسلة النتائج",
    purposeEn: "Write the national development strategy as a results chain: outcomes, targets, indicators, initiatives and the entity that leads each.",
    purposeAr: "كتابة استراتيجية التنمية الوطنية بوصفها سلسلة نتائج: نتائج ومستهدفات ومؤشرات ومبادرات والجهة القائدة لكل منها.",
    inputs: [io("Situation analysis and baselines", "تحليل الوضع الراهن وخطوط الأساس", "EDP"), io("Entity proposals and sector priorities", "مقترحات الجهات والأولويات القطاعية"), io("Qatar National Vision pillars", "ركائز رؤية قطر الوطنية", "NV")],
    outputs: [io("Draft strategy document with the results chain", "مسودة وثيقة الاستراتيجية مع سلسلة النتائج"), io("Indicator cards with targets to 2030", "بطاقات المؤشرات بمستهدفات حتى 2030"), io("Lead entity per initiative", "الجهة القائدة لكل مبادرة")],
    steps: [
      step(1, "Convene the sector working groups and agree the outcome statements.", "عقد مجموعات العمل القطاعية والاتفاق على صياغة النتائج.", "IDP", "SiaNexus Strategy Canvas"),
      step(2, "Design targets and indicator cards with the statistical departments.", "تصميم المستهدفات وبطاقات المؤشرات مع الإدارات الإحصائية.", "SES", "Statistics Hub"),
      step(3, "Run the policy simulations on the candidate targets.", "تشغيل محاكاة السياسات على المستهدفات المرشحة.", "SPS", "Policy simulation models"),
      step(4, "Assign a lead entity and a supporting entity to every initiative.", "إسناد جهة قائدة وجهة داعمة لكل مبادرة.", "IDP", "SiaNexus Strategy Canvas"),
      step(5, "Consolidate the draft and send it to the Secretary General for review.", "توحيد المسودة وإرسالها إلى الأمين العام للمراجعة.", "OSG", "SiaNexus Vault"),
      step(6, "Record every amendment in the change log under the change control policy.", "تسجيل كل تعديل في سجل التغيير وفق سياسة ضبط التغيير.", "IDP", "SiaNexus"),
    ],
    systems: [sys("SiaNexus Strategy Canvas", "لوحة الاستراتيجية في سيانكسس"), sys("Policy simulation models", "نماذج محاكاة السياسات")],
    kpis: [kpi("Initiatives with a named lead entity", "المبادرات ذات جهة قائدة مسماة", "100", "percent"), kpi("Indicators with a baseline and a 2030 target", "المؤشرات ذات خط أساس ومستهدف 2030", "100", "percent")],
    policyDocRefs: ["cr07 policy: IDP/policy_internal/v1.0"],
  },
  {
    code: "P1.3", level: 1, parentCode: "P1", ownerUnitCode: "OSG",
    nameEn: "Strategy approval and publication", nameAr: "اعتماد الاستراتيجية ونشرها",
    purposeEn: "Carry the draft strategy through the Council and the Council of Ministers and publish the approved text in both languages.",
    purposeAr: "تمرير مسودة الاستراتيجية عبر المجلس ومجلس الوزراء ونشر النص المعتمد باللغتين.",
    inputs: [io("Consolidated draft strategy", "مسودة الاستراتيجية الموحدة", "IDP"), io("Legal review of the text", "المراجعة القانونية للنص", "LA")],
    outputs: [io("Council decision adopting the strategy", "قرار المجلس باعتماد الاستراتيجية"), io("Published strategy in Arabic and English", "الاستراتيجية المنشورة بالعربية والإنجليزية")],
    steps: [
      step(1, "Prepare the Council session file with the draft and the summary of decisions required.", "إعداد ملف جلسة المجلس مع المسودة وملخص القرارات المطلوبة.", "CSA", "Council sessions system"),
      step(2, "Present the draft to the Council and record its decision and directions.", "عرض المسودة على المجلس وتسجيل قراره وتوجيهاته.", "OSG"),
      step(3, "Apply the Council's directions and obtain the legal opinion on the final text.", "تطبيق توجيهات المجلس والحصول على الرأي القانوني في النص النهائي.", "LA"),
      step(4, "Transmit the strategy to the Council of Ministers for adoption.", "إحالة الاستراتيجية إلى مجلس الوزراء للاعتماد.", "OSG"),
      step(5, "Publish the approved strategy and brief the entities through the communication plan.", "نشر الاستراتيجية المعتمدة وإحاطة الجهات عبر خطة الاتصال.", "PR", "npc.qa"),
    ],
    systems: [sys("Council sessions system", "نظام جلسات المجلس"), sys("npc.qa", "الموقع الرسمي npc.qa")],
    kpis: [kpi("Days from Council decision to publication", "الأيام من قرار المجلس إلى النشر", "30", "days")],
  },
  {
    code: "P2.1", level: 1, parentCode: "P2", ownerUnitCode: "IDP",
    nameEn: "Sector strategy guidance and templates", nameAr: "الإرشادات ونماذج الاستراتيجيات القطاعية",
    purposeEn: "Give entities one planning manual, one template and one worked example so their strategies arrive in a form that aligns.",
    purposeAr: "تزويد الجهات بدليل تخطيط واحد ونموذج واحد ومثال مطبق واحد حتى تصل استراتيجياتها بصيغة قابلة للمواءمة.",
    inputs: [io("Results-based planning manual", "دليل التخطيط المبني على النتائج"), io("Lessons from the previous submission round", "الدروس من جولة الطلبات السابقة", "MIF")],
    outputs: [io("Planning template and guidance note", "نموذج التخطيط والمذكرة الإرشادية"), io("Training clinics for entity planning teams", "جلسات إرشادية لفرق التخطيط في الجهات")],
    steps: [
      step(1, "Update the template and the guidance note after each planning round.", "تحديث النموذج والمذكرة الإرشادية بعد كل جولة تخطيط.", "IDP", "SiaNexus Vault"),
      step(2, "Prepare a fully worked example from one real sector.", "إعداد مثال مكتمل من قطاع حقيقي.", "SDP"),
      step(3, "Run the planning clinics with the entity focal points.", "عقد الجلسات الإرشادية مع منسقي الجهات.", "SDT", "Learning Room"),
      step(4, "Publish the template and open the submission window.", "نشر النموذج وفتح نافذة تقديم الطلبات.", "IDP", "Entity portal"),
    ],
    systems: [sys("Entity portal", "بوابة الجهات"), sys("Learning Room", "غرفة التعلم")],
    kpis: [kpi("Entities attending a clinic before submitting", "الجهات التي حضرت جلسة إرشادية قبل التقديم", "90", "percent")],
  },
  {
    code: "P2.2", level: 1, parentCode: "P2", ownerUnitCode: "SDP",
    nameEn: "Sector strategy review and alignment", nameAr: "مراجعة الاستراتيجيات القطاعية ومواءمتها",
    purposeEn: "Review every entity strategy against the national results chain and return an alignment opinion the entity can act on.",
    purposeAr: "مراجعة كل استراتيجية قطاعية مقابل سلسلة النتائج الوطنية وإعادة رأي مواءمة تستطيع الجهة العمل به.",
    inputs: [io("Entity strategy submission", "استراتيجية الجهة المقدمة"), io("National results chain and targets", "سلسلة النتائج الوطنية والمستهدفات", "IDP")],
    outputs: [io("Alignment opinion with required changes", "رأي المواءمة مع التعديلات المطلوبة"), io("Alignment register entry", "قيد في سجل المواءمة")],
    steps: [
      step(1, "Log the submission and assign the reviewing department by sector.", "تسجيل الطلب وإسناد الإدارة المراجعة حسب القطاع.", "SDP", "Entity portal"),
      step(2, "Map the entity's outcomes and initiatives onto the national chain.", "ربط نتائج الجهة ومبادراتها بسلسلة النتائج الوطنية.", "EDP", "SiaNexus Strategy Canvas"),
      step(3, "Check the indicators against the official statistics and flag the unmeasurable.", "فحص المؤشرات مقابل الإحصاءات الرسمية والتنبيه إلى ما لا يمكن قياسه.", "SES", "Statistics Hub"),
      step(4, "Issue the alignment opinion within twenty working days.", "إصدار رأي المواءمة خلال عشرين يوم عمل.", "SDP"),
      step(5, "Record the alignment in the register and notify the follow-up sector.", "تسجيل المواءمة في السجل وإبلاغ قطاع المتابعة.", "SDP", "SiaNexus"),
    ],
    systems: [sys("Entity portal", "بوابة الجهات"), sys("SiaNexus Strategy Canvas", "لوحة الاستراتيجية في سيانكسس")],
    kpis: [kpi("Opinions issued within twenty working days", "الآراء الصادرة خلال عشرين يوم عمل", "90", "percent"), kpi("Entity initiatives mapped to a national target", "مبادرات الجهات المرتبطة بمستهدف وطني", "95", "percent")],
  },
  {
    code: "P2.3", level: 1, parentCode: "P2", ownerUnitCode: "SPS",
    nameEn: "Policy simulation and impact appraisal", nameAr: "محاكاة السياسات وتقييم الأثر",
    purposeEn: "Model the effect of a proposed policy or target before it is adopted, so choices rest on projected outcomes.",
    purposeAr: "نمذجة أثر سياسة أو مستهدف مقترح قبل اعتماده حتى تستند الخيارات إلى النتائج المتوقعة.",
    inputs: [io("Policy proposal and its parameters", "مقترح السياسة ومعاييره"), io("Indicator series and economic accounts", "سلاسل المؤشرات والحسابات الاقتصادية", "ECS")],
    outputs: [io("Impact appraisal note with scenarios", "مذكرة تقييم الأثر مع السيناريوهات"), io("Recommended option", "الخيار الموصى به")],
    steps: [
      step(1, "Scope the question and the decision date with the requesting department.", "تحديد نطاق السؤال وتاريخ القرار مع الإدارة الطالبة.", "SPS"),
      step(2, "Assemble the data and calibrate the model.", "تجميع البيانات ومعايرة النموذج.", "SPS", "Policy simulation models"),
      step(3, "Run the baseline and the alternative scenarios.", "تشغيل السيناريو الأساسي والسيناريوهات البديلة.", "SPS", "Policy simulation models"),
      step(4, "Review the results with the sector department and the foresight department.", "مراجعة النتائج مع الإدارة القطاعية وإدارة الاستشراف.", "SF"),
      step(5, "Issue the appraisal note before the decision date.", "إصدار مذكرة التقييم قبل تاريخ القرار.", "SPS", "SiaNexus Vault"),
    ],
    systems: [sys("Policy simulation models", "نماذج محاكاة السياسات")],
    kpis: [kpi("Appraisals delivered before the decision date", "التقييمات المسلمة قبل تاريخ القرار", "100", "percent")],
  },
];

export const LEVEL1_B: ProcessSeed[] = [
  {
    code: "P3.1", level: 1, parentCode: "P3", ownerUnitCode: "MIF",
    nameEn: "Delivery monitoring and status reporting", nameAr: "رصد التنفيذ وتقارير الحالة",
    purposeEn: "Collect the status of every national initiative each month and turn it into the delivery report leadership reads.",
    purposeAr: "جمع حالة كل مبادرة وطنية شهرياً وتحويلها إلى تقرير التنفيذ الذي تقرؤه القيادة.",
    inputs: [io("Status updates from entity focal points", "تحديثات الحالة من منسقي الجهات"), io("Indicator actuals for the period", "القيم الفعلية للمؤشرات للفترة", "NSC")],
    outputs: [io("Monthly NDS3 delivery report", "تقرير تنفيذ الاستراتيجية الوطنية الشهري"), io("Watch list of initiatives at risk", "قائمة المراقبة للمبادرات المعرضة للخطر")],
    steps: [
      step(1, "Open the monthly reporting window and remind the entity focal points.", "فتح نافذة التقارير الشهرية وتذكير منسقي الجهات.", "MIF", "SiaNexus"),
      step(2, "Validate each status update against evidence and the milestone plan.", "التحقق من كل تحديث حالة مقابل الأدلة وخطة المعالم.", "MIF", "SiaNexus Strategy Canvas"),
      step(3, "Pull the period's indicator actuals from the Statistics Hub.", "سحب القيم الفعلية للمؤشرات للفترة من مركز الإحصاءات.", "MIF", "Statistics Hub"),
      step(4, "Assemble the delivery report and the watch list.", "تجميع تقرير التنفيذ وقائمة المراقبة.", "MIF", "Reports module"),
      step(5, "Brief the Secretary General and circulate to the sectors.", "إحاطة الأمين العام والتعميم على القطاعات.", "OSG", "Reports module"),
    ],
    systems: [sys("SiaNexus Strategy Canvas", "لوحة الاستراتيجية في سيانكسس"), sys("Reports module", "وحدة التقارير")],
    kpis: [kpi("Initiatives with a status update in the month", "المبادرات ذات تحديث حالة في الشهر", "95", "percent"), kpi("Working days from window close to report issue", "أيام العمل من إغلاق النافذة إلى إصدار التقرير", "5", "days")],
  },
  {
    code: "P3.2", level: 1, parentCode: "P3", ownerUnitCode: "SIE",
    nameEn: "Implementation support to entities", nameAr: "دعم التنفيذ لدى الجهات",
    purposeEn: "Sit with the entities whose initiatives are behind, name the obstacle and clear it, with the human and social sector served by its own department.",
    purposeAr: "الجلوس مع الجهات التي تأخرت مبادراتها، وتحديد العائق وتذليله، مع خدمة القطاع البشري والاجتماعي من إدارته المختصة.",
    inputs: [io("Watch list of initiatives at risk", "قائمة المراقبة للمبادرات المعرضة للخطر", "MIF"), io("Entity request for support", "طلب الدعم من الجهة")],
    outputs: [io("Support plan agreed with the entity", "خطة الدعم المتفق عليها مع الجهة"), io("Escalation note for unresolved blockers", "مذكرة تصعيد للمعوقات غير المحلولة")],
    steps: [
      step(1, "Triage the watch list and assign a support lead by sector.", "فرز قائمة المراقبة وتعيين قائد دعم حسب القطاع.", "SIE"),
      step(2, "Hold the diagnostic session with the entity's delivery team.", "عقد جلسة التشخيص مع فريق التنفيذ في الجهة.", "SIH"),
      step(3, "Agree the support plan with dates and owners.", "الاتفاق على خطة الدعم بتواريخ ومالكين.", "SIE", "SiaNexus"),
      step(4, "Escalate blockers outside the entity's control to the Executive Committee.", "تصعيد المعوقات الخارجة عن سيطرة الجهة إلى اللجنة التنفيذية.", "FAI"),
      step(5, "Record the outcome and the lesson learned.", "تسجيل النتيجة والدرس المستفاد.", "SIE", "Learning Room"),
    ],
    systems: [sys("SiaNexus", "سيانكسس"), sys("Learning Room", "غرفة التعلم")],
    kpis: [kpi("At-risk initiatives with a support plan within a month", "المبادرات المعرضة للخطر ذات خطة دعم خلال شهر", "80", "percent")],
  },
  {
    code: "P3.3", level: 1, parentCode: "P3", ownerUnitCode: "MIF",
    nameEn: "Evaluation and lessons learned", nameAr: "التقييم والدروس المستفادة",
    purposeEn: "Evaluate completed initiatives and the strategy at mid-term, and file the lessons where the next plan will find them.",
    purposeAr: "تقييم المبادرات المكتملة والاستراتيجية في منتصف المدة، وإيداع الدروس حيث تجدها الخطة التالية.",
    inputs: [io("Closure reports of completed initiatives", "تقارير إقفال المبادرات المكتملة"), io("Indicator series over the period", "سلاسل المؤشرات خلال الفترة", "NSC")],
    outputs: [io("Evaluation report", "تقرير التقييم"), io("Lessons published in the Learning Room", "الدروس المنشورة في غرفة التعلم")],
    steps: [
      step(1, "Select the initiatives and the questions for the evaluation cycle.", "اختيار المبادرات والأسئلة لدورة التقييم.", "MIF"),
      step(2, "Collect the evidence and interview the delivery teams.", "جمع الأدلة ومقابلة فرق التنفيذ.", "MIF", "SiaNexus Vault"),
      step(3, "Draft the findings with the sector department.", "صياغة النتائج مع الإدارة القطاعية.", "SDP"),
      step(4, "Publish the lessons and link them to the strategy nodes.", "نشر الدروس وربطها بعناصر الاستراتيجية.", "MIF", "Learning Room"),
      step(5, "Feed the findings into the next planning cycle's diagnostic.", "تغذية النتائج في تشخيص دورة التخطيط التالية.", "EDP"),
    ],
    systems: [sys("Learning Room", "غرفة التعلم"), sys("SiaNexus Vault", "مستودع سيانكسس")],
    kpis: [kpi("Completed initiatives with a published lesson", "المبادرات المكتملة ذات درس منشور", "100", "percent")],
  },
  {
    code: "P4.1", level: 1, parentCode: "P4", ownerUnitCode: "SOA",
    nameEn: "Census and survey operations", nameAr: "عمليات التعداد والمسوح",
    purposeEn: "Design and run the census and the household and establishment surveys from sampling frame to clean microdata.",
    purposeAr: "تصميم وتنفيذ التعداد ومسوح الأسر والمنشآت من إطار المعاينة إلى البيانات الجزئية النظيفة.",
    inputs: [io("Annual statistical programme", "البرنامج الإحصائي السنوي", "NSC"), io("Sampling frame and establishment register", "إطار المعاينة وسجل المنشآت", "ECS"), io("Field budget and staffing", "موازنة الميدان والكوادر", "FNA")],
    outputs: [io("Clean microdata file with metadata", "ملف البيانات الجزئية النظيف مع البيانات الوصفية"), io("Field operations report", "تقرير العمليات الميدانية")],
    steps: [
      step(1, "Design the questionnaire and the sample with the subject departments.", "تصميم الاستبيان والعينة مع الإدارات المختصة.", "SOA", "Survey design tools"),
      step(2, "Build the electronic questionnaire and the field application.", "بناء الاستبيان الإلكتروني وتطبيق الميدان.", "SSD", "CAPI field system"),
      step(3, "Recruit and train the field teams.", "استقطاب فرق الميدان وتدريبها.", "SDT", "Learning Room"),
      step(4, "Run the field enumeration with daily quality monitoring.", "تنفيذ العد الميداني مع مراقبة يومية للجودة.", "SOA", "CAPI field system"),
      step(5, "Clean, edit and impute the microdata.", "تنقية البيانات الجزئية وتحريرها واستكمالها.", "SOA", "Statistical processing system"),
      step(6, "Sign off the quality review before the file moves to compilation.", "اعتماد مراجعة الجودة قبل انتقال الملف إلى التجميع.", "SQ", "Quality register"),
    ],
    systems: [sys("CAPI field system", "نظام الجمع الميداني الإلكتروني"), sys("Statistical processing system", "نظام المعالجة الإحصائية"), sys("Quality register", "سجل الجودة")],
    kpis: [kpi("Household survey response rate", "معدل الاستجابة في مسوح الأسر", "85", "percent"), kpi("Surveys delivered on the programme date", "المسوح المسلمة في موعد البرنامج", "90", "percent")],
  },
  {
    code: "P4.2", level: 1, parentCode: "P4", ownerUnitCode: "ECS",
    nameEn: "Economic and social statistics compilation", nameAr: "تجميع الإحصاءات الاقتصادية والاجتماعية",
    purposeEn: "Compile the national accounts, the price indices, the trade statistics and the social and environmental indicators from survey data and administrative records.",
    purposeAr: "تجميع الحسابات القومية والأرقام القياسية للأسعار وإحصاءات التجارة والمؤشرات الاجتماعية والبيئية من بيانات المسوح والسجلات الإدارية.",
    inputs: [io("Clean microdata files", "ملفات البيانات الجزئية النظيفة", "SOA"), io("Administrative records from entities", "السجلات الإدارية من الجهات", "NDA")],
    outputs: [io("Compiled statistical tables per product", "الجداول الإحصائية المجمعة لكل منتج"), io("Methodological notes and revisions", "الملاحظات المنهجية والمراجعات")],
    steps: [
      step(1, "Receive the period's microdata and administrative records.", "استلام البيانات الجزئية والسجلات الإدارية للفترة.", "ECS", "Statistical processing system"),
      step(2, "Compile the aggregates under the international standards.", "تجميع الإجماليات وفق المعايير الدولية.", "ECS", "Statistical processing system"),
      step(3, "Compile the population, social and environmental indicators.", "تجميع المؤشرات السكانية والاجتماعية والبيئية.", "SES", "Statistical processing system"),
      step(4, "Run the consistency checks and reconcile with the previous period.", "إجراء فحوص الاتساق والمطابقة مع الفترة السابقة.", "SQ", "Quality register"),
      step(5, "Prepare the release tables and the methodological note.", "إعداد جداول الإصدار والملاحظة المنهجية.", "ECS", "Statistics Hub"),
    ],
    systems: [sys("Statistical processing system", "نظام المعالجة الإحصائية"), sys("Statistics Hub", "مركز الإحصاءات")],
    kpis: [kpi("Products compiled by the internal deadline", "المنتجات المجمعة بحلول الموعد الداخلي", "95", "percent"), kpi("Revisions larger than the tolerance", "المراجعات التي تتجاوز حد التسامح", "2", "count")],
  },
  {
    code: "P4.3", level: 1, parentCode: "P4", ownerUnitCode: "SOA",
    nameEn: "Statistical release and dissemination", nameAr: "الإصدار الإحصائي والنشر",
    purposeEn: "Release every statistical product on its pre-announced date, in both languages, with the revision policy applied and the users informed.",
    purposeAr: "إصدار كل منتج إحصائي في موعده المعلن مسبقاً باللغتين، مع تطبيق سياسة المراجعات وإعلام المستخدمين.",
    inputs: [io("Compiled release tables", "جداول الإصدار المجمعة", "ECS"), io("Pre-announced release calendar", "تقويم الإصدار المعلن مسبقاً", "NSC")],
    outputs: [io("Published release on npc.qa and the Statistics Hub", "الإصدار المنشور على الموقع الرسمي ومركز الإحصاءات"), io("Release note and revision note", "ملاحظة الإصدار وملاحظة المراجعة")],
    steps: [
      step(1, "Confirm the quality sign-off and the pre-release access list.", "تأكيد اعتماد الجودة وقائمة الاطلاع المسبق.", "SQ", "Quality register"),
      step(2, "Prepare the bilingual release note and the tables.", "إعداد ملاحظة الإصدار ثنائية اللغة والجداول.", "SOA", "Statistics Hub"),
      step(3, "Load the series into the Statistics Hub under embargo.", "تحميل السلاسل في مركز الإحصاءات تحت الحظر.", "SSD", "Statistics Hub"),
      step(4, "Release at the announced time and publish the note.", "الإصدار في الوقت المعلن ونشر الملاحظة.", "SOA", "npc.qa"),
      step(5, "Answer user enquiries and log any correction under the revision procedure.", "الرد على استفسارات المستخدمين وتسجيل أي تصحيح وفق إجراء المراجعات.", "PR"),
    ],
    systems: [sys("Statistics Hub", "مركز الإحصاءات"), sys("npc.qa", "الموقع الرسمي npc.qa")],
    kpis: [kpi("Releases on the announced date", "الإصدارات في الموعد المعلن", "95", "percent"), kpi("Corrections published with a revision note", "التصحيحات المنشورة مع ملاحظة مراجعة", "100", "percent")],
    sopDocRefs: ["cr07 policy: SOA/procedure/v2.2"],
  },
];

export const LEVEL1_C: ProcessSeed[] = [
  {
    code: "P5.1", level: 1, parentCode: "P5", ownerUnitCode: "NDA",
    nameEn: "Data standards and classification", nameAr: "معايير البيانات والتصنيف",
    purposeEn: "Maintain the common definitions, the metadata standard and the classification scheme every dataset carries.",
    purposeAr: "صيانة التعاريف الموحدة ومعيار البيانات الوصفية ومخطط التصنيف الذي تحمله كل مجموعة بيانات.",
    inputs: [io("International statistical standards", "المعايير الإحصائية الدولية"), io("Entity data dictionaries", "قواميس بيانات الجهات")],
    outputs: [io("National data standard and definitions register", "معيار البيانات الوطني وسجل التعاريف"), io("Classification decision per dataset", "قرار التصنيف لكل مجموعة بيانات")],
    steps: [
      step(1, "Receive the standard change or the new dataset proposal.", "استلام تغيير المعيار أو مقترح مجموعة البيانات الجديدة.", "NDA", "Data catalogue"),
      step(2, "Harmonise the definitions with the producing entity and the subject department.", "توحيد التعاريف مع الجهة المنتجة والإدارة المختصة.", "NDA"),
      step(3, "Assign the classification level under the information classification policy.", "تحديد مستوى التصنيف وفق سياسة تصنيف المعلومات.", "IFS"),
      step(4, "Take the decision to the Data Governance Board.", "عرض القرار على مجلس حوكمة البيانات.", "NDA"),
      step(5, "Publish the standard and update the catalogue entry.", "نشر المعيار وتحديث مدخل الفهرس.", "SSD", "Data catalogue"),
    ],
    systems: [sys("Data catalogue", "فهرس البيانات"), sys("SiaNexus Vault", "مستودع سيانكسس")],
    kpis: [kpi("Datasets with a catalogue entry and a classification", "مجموعات البيانات ذات مدخل فهرس وتصنيف", "100", "percent")],
    policyDocRefs: ["cr07 policy: IFS/policy_internal/v3.1"],
  },
  {
    code: "P5.2", level: 1, parentCode: "P5", ownerUnitCode: "NDA",
    nameEn: "Data sharing and access management", nameAr: "تبادل البيانات وإدارة الوصول",
    purposeEn: "Bring administrative data in from entities under signed agreements and give users access under the rules of their clearance.",
    purposeAr: "جلب البيانات الإدارية من الجهات بموجب اتفاقيات موقعة ومنح المستخدمين الوصول وفق قواعد تصريحهم.",
    inputs: [io("Data-sharing agreement request", "طلب اتفاقية تبادل البيانات"), io("Access request from a user or entity", "طلب وصول من مستخدم أو جهة")],
    outputs: [io("Signed data-sharing agreement", "اتفاقية تبادل بيانات موقعة"), io("Access grant with its audit trail", "منح الوصول مع سجل التدقيق")],
    steps: [
      step(1, "Draft the agreement with the entity and name a focal point on both sides.", "صياغة الاتفاقية مع الجهة وتسمية منسق من الطرفين.", "NDA"),
      step(2, "Obtain the legal opinion on the agreement.", "الحصول على الرأي القانوني في الاتفاقية.", "LA"),
      step(3, "Approve the agreement at the Data Governance Board.", "اعتماد الاتفاقية في مجلس حوكمة البيانات.", "NDA"),
      step(4, "Provision the access with the Information Security Department.", "تهيئة الوصول مع إدارة أمن المعلومات.", "IFS", "Access management system"),
      step(5, "Audit access quarterly and revoke what is no longer needed.", "تدقيق الوصول كل ربع سنة وإلغاء ما لم يعد ضرورياً.", "IFS", "Access management system"),
    ],
    systems: [sys("Access management system", "نظام إدارة الوصول"), sys("Data catalogue", "فهرس البيانات")],
    kpis: [kpi("Agreements closed within sixty days", "الاتفاقيات المنجزة خلال ستين يوماً", "80", "percent"), kpi("Data request turnaround", "زمن الاستجابة لطلبات البيانات", "10", "days")],
    sopDocRefs: ["cr07 policy: SOA/service/v1.1"],
  },
  {
    code: "P5.3", level: 1, parentCode: "P5", ownerUnitCode: "SQ",
    nameEn: "Statistical quality assurance", nameAr: "ضمان الجودة الإحصائية",
    purposeEn: "Test every statistical product and every entity data feed against the quality framework and drive the corrective actions.",
    purposeAr: "اختبار كل منتج إحصائي وكل تغذية بيانات من الجهات وفق إطار الجودة وقيادة الإجراءات التصحيحية.",
    inputs: [io("Products awaiting release", "المنتجات في انتظار الإصدار", "ECS"), io("Entity data feeds", "تغذيات البيانات من الجهات", "NDA")],
    outputs: [io("Quality sign-off or findings per product", "اعتماد الجودة أو الملاحظات لكل منتج"), io("Quarterly quality report", "تقرير الجودة الربعي")],
    steps: [
      step(1, "Run the automated checks on the product or the feed.", "تشغيل الفحوص الآلية على المنتج أو التغذية.", "SQ", "Quality register"),
      step(2, "Review the outliers with the compiling department.", "مراجعة القيم الشاذة مع الإدارة المجمعة.", "ECS"),
      step(3, "Record findings with an owner and a date.", "تسجيل الملاحظات مع مالك وتاريخ.", "SQ", "Quality register"),
      step(4, "Sign off or hold the release.", "اعتماد الإصدار أو إيقافه.", "SQ"),
      step(5, "Report the quarter's findings to the National Statistics Committee.", "رفع ملاحظات الربع إلى لجنة الإحصاء الوطنية.", "SQ", "Reports module"),
    ],
    systems: [sys("Quality register", "سجل الجودة")],
    kpis: [kpi("Findings closed within their due date", "الملاحظات المغلقة في موعدها", "85", "percent")],
  },
  {
    code: "P6.1", level: 1, parentCode: "P6", ownerUnitCode: "SF",
    nameEn: "Horizon scanning and signal triage", nameAr: "استطلاع الأفق وفرز الإشارات",
    purposeEn: "Collect weak signals from research, media and partners, triage them and attach the accepted ones to the strategy they touch.",
    purposeAr: "جمع الإشارات الضعيفة من البحوث والإعلام والشركاء، وفرزها، وربط المقبول منها بالاستراتيجية التي تمسها.",
    inputs: [io("Signal submissions and scanned sources", "الإشارات المقدمة والمصادر المرصودة"), io("Strategy outcomes and risk register", "نتائج الاستراتيجية وسجل المخاطر", "IDP")],
    outputs: [io("Triaged signal with a strategy link", "إشارة مفروزة مرتبطة بالاستراتيجية"), io("Monthly signals and foresight brief", "موجز الإشارات والاستشراف الشهري")],
    steps: [
      step(1, "Scan the agreed sources and log candidate signals.", "رصد المصادر المتفق عليها وتسجيل الإشارات المرشحة.", "SF", "Signals Radar"),
      step(2, "Triage each signal for relevance, novelty and time horizon.", "فرز كل إشارة من حيث الصلة والجدة والأفق الزمني.", "SF", "Signals Radar"),
      step(3, "Link accepted signals to outcomes and notify the owning department.", "ربط الإشارات المقبولة بالنتائج وإبلاغ الإدارة المالكة.", "SF", "SiaNexus"),
      step(4, "Issue the monthly brief to the Executive Committee.", "إصدار الموجز الشهري إلى اللجنة التنفيذية.", "SF", "Reports module"),
    ],
    systems: [sys("Signals Radar", "رادار الإشارات"), sys("Reports module", "وحدة التقارير")],
    kpis: [kpi("Signals triaged within ten working days", "الإشارات المفروزة خلال عشرة أيام عمل", "90", "percent")],
  },
  {
    code: "P6.2", level: 1, parentCode: "P6", ownerUnitCode: "NV",
    nameEn: "Scenario development and vision review", nameAr: "بناء السيناريوهات ومراجعة الرؤية",
    purposeEn: "Build scenario sets for the decisions on the table and review the national vision's long-term assumptions against them.",
    purposeAr: "بناء مجموعات السيناريوهات للقرارات المطروحة ومراجعة افتراضات الرؤية الوطنية طويلة المدى في ضوئها.",
    inputs: [io("Decision that needs a scenario set", "القرار الذي يحتاج مجموعة سيناريوهات"), io("Triaged signals", "الإشارات المفروزة", "SF")],
    outputs: [io("Scenario set with implications", "مجموعة السيناريوهات مع دلالاتها"), io("Vision assumptions review note", "مذكرة مراجعة افتراضات الرؤية")],
    steps: [
      step(1, "Name the decision the scenarios must inform and its date.", "تحديد القرار الذي تخدمه السيناريوهات وتاريخه.", "NV"),
      step(2, "Build the driving forces and the scenario logic with the foresight department.", "بناء القوى المحركة ومنطق السيناريوهات مع إدارة الاستشراف.", "SF"),
      step(3, "Test the scenarios in the policy lab with the affected entities.", "اختبار السيناريوهات في مختبر السياسات مع الجهات المعنية.", "PL"),
      step(4, "Quantify the scenarios where a model exists.", "تكميم السيناريوهات حيث يوجد نموذج.", "SPS", "Policy simulation models"),
      step(5, "Publish the set and file the vision review note.", "نشر المجموعة وإيداع مذكرة مراجعة الرؤية.", "NV", "SiaNexus Vault"),
    ],
    systems: [sys("Policy simulation models", "نماذج محاكاة السياسات"), sys("SiaNexus Vault", "مستودع سيانكسس")],
    kpis: [kpi("Scenario sets tied to a named decision", "مجموعات السيناريوهات المرتبطة بقرار محدد", "100", "percent")],
  },
  {
    code: "P6.3", level: 1, parentCode: "P6", ownerUnitCode: "SF",
    nameEn: "Strategic risk assessment", nameAr: "تقييم المخاطر الاستراتيجية",
    purposeEn: "Keep one national risk register with likelihood, impact, owner and mitigation, reviewed each quarter.",
    purposeAr: "الاحتفاظ بسجل مخاطر وطني واحد بالاحتمالية والأثر والمالك والمعالجة، يُراجع كل ربع سنة.",
    inputs: [io("Signals and scenarios", "الإشارات والسيناريوهات", "NV"), io("Delivery watch list", "قائمة مراقبة التنفيذ", "MIF")],
    outputs: [io("Updated risk register", "سجل المخاطر المحدث"), io("Quarterly risk brief", "موجز المخاطر الربعي")],
    steps: [
      step(1, "Collect new risks from the departments and the entities.", "جمع المخاطر الجديدة من الإدارات والجهات.", "SF", "SiaNexus"),
      step(2, "Score likelihood and impact with the owning department.", "تقدير الاحتمالية والأثر مع الإدارة المالكة.", "SF"),
      step(3, "Agree the mitigation and its owner.", "الاتفاق على المعالجة ومالكها.", "SF"),
      step(4, "Present the quarterly brief to the Strategy Steering Committee.", "عرض الموجز الربعي على لجنة توجيه الاستراتيجية.", "IDP", "Reports module"),
    ],
    systems: [sys("SiaNexus", "سيانكسس"), sys("Reports module", "وحدة التقارير")],
    kpis: [kpi("Open risks with a named owner and mitigation", "المخاطر المفتوحة ذات مالك ومعالجة", "100", "percent")],
  },
  {
    code: "P7.1", level: 1, parentCode: "P7", ownerUnitCode: "IIC",
    nameEn: "Index tracking and data submission", nameAr: "تتبع المؤشرات الدولية وتقديم البيانات",
    purposeEn: "Track every international index Qatar is measured on, submit the national data on time and record each new edition.",
    purposeAr: "تتبع كل مؤشر دولي تُقاس عليه دولة قطر، وتقديم البيانات الوطنية في موعدها، وتسجيل كل إصدار جديد.",
    inputs: [io("Index publisher questionnaires and schedules", "استبيانات ناشري المؤشرات وجداولهم"), io("Official statistics for the submission", "الإحصاءات الرسمية للتقديم", "NSC")],
    outputs: [io("Submitted national data with its record", "البيانات الوطنية المقدمة مع سجلها"), io("Index observation recorded in the Indices module", "قراءة المؤشر المسجلة في وحدة المؤشرات")],
    steps: [
      step(1, "Maintain the calendar of publisher deadlines.", "صيانة تقويم مواعيد الناشرين.", "IIC", "Indices module"),
      step(2, "Collect the data from the responsible entity and the statistical departments.", "جمع البيانات من الجهة المسؤولة والإدارات الإحصائية.", "IIC"),
      step(3, "Validate and submit to the publisher.", "التحقق والتقديم إلى الناشر.", "IIC"),
      step(4, "Record the published edition and the rank in the Indices module.", "تسجيل الإصدار المنشور والترتيب في وحدة المؤشرات.", "IIC", "Indices module"),
      step(5, "Brief the responsible entity on the movement.", "إحاطة الجهة المسؤولة بالتغير.", "IIC"),
    ],
    systems: [sys("Indices module", "وحدة المؤشرات الدولية")],
    kpis: [kpi("Submissions made by the publisher deadline", "التقديمات المنجزة قبل موعد الناشر", "100", "percent")],
  },
  {
    code: "P7.2", level: 1, parentCode: "P7", ownerUnitCode: "IIC",
    nameEn: "Index improvement plans with entities", nameAr: "خطط تحسين المؤشرات مع الجهات",
    purposeEn: "Agree with each responsible entity the actions that move Qatar's position and follow them through the year.",
    purposeAr: "الاتفاق مع كل جهة مسؤولة على الإجراءات التي تحرك موقع دولة قطر ومتابعتها على مدار السنة.",
    inputs: [io("Index forecast and gap analysis", "تنبؤ المؤشر وتحليل الفجوة", "IIC"), io("Entity action proposals", "مقترحات إجراءات الجهات")],
    outputs: [io("Improvement plan per index", "خطة التحسين لكل مؤشر"), io("Annual report on Qatar in international indices", "التقرير السنوي عن قطر في المؤشرات الدولية")],
    steps: [
      step(1, "Analyse the sub-indicators that drive the gap.", "تحليل المؤشرات الفرعية التي تصنع الفجوة.", "IIC", "Indices module"),
      step(2, "Agree the actions and owners with the responsible entity.", "الاتفاق على الإجراءات والمالكين مع الجهة المسؤولة.", "IIC"),
      step(3, "Follow up the actions each quarter.", "متابعة الإجراءات كل ربع سنة.", "MIF"),
      step(4, "Compile the annual indices report.", "إعداد التقرير السنوي للمؤشرات.", "IIC", "Reports module"),
    ],
    systems: [sys("Indices module", "وحدة المؤشرات الدولية"), sys("Reports module", "وحدة التقارير")],
    kpis: [kpi("Tracked indices with an agreed improvement plan", "المؤشرات المتتبعة ذات خطة تحسين متفق عليها", "80", "percent")],
  },
  {
    code: "P8.1", level: 1, parentCode: "P8", ownerUnitCode: "PQI",
    nameEn: "Institutional planning and quality", nameAr: "التخطيط المؤسسي والجودة",
    purposeEn: "Prepare the Council's own strategy and operational plans, review performance quality and simplify processes.",
    purposeAr: "إعداد الاستراتيجية المؤسسية للمجلس وخططه التشغيلية، ومراجعة جودة الأداء، وتبسيط الإجراءات.",
    inputs: [io("Sector operational plans", "الخطط التشغيلية للقطاعات"), io("Council Strategy scorecard", "بطاقة أداء استراتيجية المجلس", "IDP")],
    outputs: [io("Annual operational plan", "الخطة التشغيلية السنوية"), io("Process simplification proposals", "مقترحات تبسيط الإجراءات")],
    steps: [
      step(1, "Collect the sector plans against the strategy's outputs.", "جمع خطط القطاعات مقابل مخرجات الاستراتيجية.", "PQI", "SiaNexus"),
      step(2, "Consolidate the annual operational plan and its budget link.", "توحيد الخطة التشغيلية السنوية وربطها بالموازنة.", "FNA"),
      step(3, "Review the quality of unit performance each half year.", "مراجعة جودة أداء الوحدات كل نصف سنة.", "PQI"),
      step(4, "Propose process simplifications to the Executive Committee.", "اقتراح تبسيط الإجراءات على اللجنة التنفيذية.", "PQI", "Processes page"),
      step(5, "Prepare the annual report on the Council's activities.", "إعداد التقرير السنوي عن أنشطة المجلس.", "PQI", "Reports module"),
    ],
    systems: [sys("SiaNexus", "سيانكسس"), sys("Reports module", "وحدة التقارير")],
    kpis: [kpi("Strategy reviews completed on schedule", "مراجعات الاستراتيجية المنجزة في موعدها", "100", "percent")],
  },
  {
    code: "P8.2", level: 1, parentCode: "P8", ownerUnitCode: "HR",
    nameEn: "Workforce capability and knowledge continuity", nameAr: "قدرات القوى العاملة واستمرارية المعرفة",
    purposeEn: "Develop the Council's people and make sure knowledge is handed over before anyone leaves or moves.",
    purposeAr: "تطوير كوادر المجلس وضمان تسليم المعرفة قبل مغادرة أي موظف أو انتقاله.",
    inputs: [io("Capability needs from the units", "احتياجات القدرات من الوحدات"), io("Leaving and transfer notices", "إشعارات المغادرة والانتقال")],
    outputs: [io("Training plan and completion record", "خطة التدريب وسجل الإتمام"), io("Completed handover with a learning path for the successor", "تسليم مكتمل مع مسار تعلم للخلف")],
    steps: [
      step(1, "Compile the capability plan with the unit heads.", "إعداد خطة القدرات مع رؤساء الوحدات.", "HR"),
      step(2, "Run the training programmes through the training centre.", "تنفيذ برامج التدريب عبر مركز التدريب.", "SDT", "Learning Room"),
      step(3, "Open a handover the day a leaving notice arrives.", "فتح ملف تسليم يوم وصول إشعار المغادرة.", "HR", "Handover module"),
      step(4, "Reassign every owned item and capture the tacit knowledge.", "إعادة إسناد كل عنصر مملوك وتوثيق المعرفة الضمنية.", "HR", "Handover module"),
      step(5, "Sign off the handover and the successor's learning path.", "اعتماد التسليم ومسار تعلم الخلف.", "HR", "Handover module"),
    ],
    systems: [sys("Handover module", "وحدة التسليم"), sys("Learning Room", "غرفة التعلم")],
    kpis: [kpi("Handovers complete before the last working day", "التسليمات المكتملة قبل آخر يوم عمل", "90", "percent")],
    policyDocRefs: ["cr07 policy: HR/policy_internal/v2.0"],
    sopDocRefs: ["cr07 policy: HR/form_template/v1.3"],
  },
  {
    code: "P8.3", level: 1, parentCode: "P8", ownerUnitCode: "IS",
    nameEn: "Digital systems and information security", nameAr: "الأنظمة الرقمية وأمن المعلومات",
    purposeEn: "Run and secure the systems every process depends on, from the field applications to SiaNexus.",
    purposeAr: "تشغيل وتأمين الأنظمة التي تعتمد عليها كل عملية، من تطبيقات الميدان إلى سيانكسس.",
    inputs: [io("Change and service requests from the units", "طلبات التغيير والخدمة من الوحدات"), io("Security policies and controls", "سياسات وضوابط الأمن", "IFS")],
    outputs: [io("Operated systems within their service levels", "أنظمة مشغلة ضمن مستويات خدمتها"), io("Security incident record and closure notes", "سجل الحوادث الأمنية وملاحظات الإغلاق")],
    steps: [
      step(1, "Log and prioritise the change or service request.", "تسجيل طلب التغيير أو الخدمة وترتيب أولويته.", "IS", "Service desk"),
      step(2, "Review the design with the Information Security Department.", "مراجعة التصميم مع إدارة أمن المعلومات.", "IFS"),
      step(3, "Deliver the change and update the system record.", "تنفيذ التغيير وتحديث سجل النظام.", "IS", "Service desk"),
      step(4, "Monitor security events and respond to incidents under the procedure.", "مراقبة الأحداث الأمنية والاستجابة للحوادث وفق الإجراء.", "IFS", "Security monitoring"),
      step(5, "Report availability and incidents monthly.", "رفع تقرير التوافر والحوادث شهرياً.", "IS", "Reports module"),
    ],
    systems: [sys("Service desk", "مكتب الخدمة"), sys("Security monitoring", "المراقبة الأمنية")],
    kpis: [kpi("System availability", "توافر الأنظمة", "99.5", "percent"), kpi("Incidents closed within ten working days", "الحوادث المغلقة خلال عشرة أيام عمل", "95", "percent")],
    sopDocRefs: ["cr07 policy: IFS/procedure/v1.0"],
  },
];

export const LEVEL2: ProcessSeed[] = [
  {
    code: "P1.2.1", level: 2, parentCode: "P1.2", ownerUnitCode: "IDP",
    nameEn: "Strategy change control procedure", nameAr: "إجراء ضبط التغيير على الاستراتيجية",
    purposeEn: "How a goal, a target or a project in the strategy is changed and the record each change must leave.",
    purposeAr: "كيف يُعدَّل هدف أو مستهدف أو مشروع في الاستراتيجية والسجل الذي يجب أن يتركه كل تغيير.",
    steps: [
      step(1, "File the change request with the reason and the evidence.", "تقديم طلب التغيير مع السبب والأدلة.", "IDP", "SiaNexus"),
      step(2, "Route goals and outcomes to the Strategy Steering Committee; projects to the owning unit head.", "إحالة الأهداف والنتائج إلى لجنة توجيه الاستراتيجية، والمشاريع إلى رئيس الوحدة المالكة.", "IDP"),
      step(3, "Apply the approved change and log it with the name and the date.", "تطبيق التغيير المعتمد وتسجيله بالاسم والتاريخ.", "IDP", "SiaNexus Strategy Canvas"),
      step(4, "Notify the affected entities and focal points.", "إبلاغ الجهات والمنسقين المعنيين.", "IDP", "SiaNexus"),
    ],
    policyDocRefs: ["cr07 policy: IDP/policy_internal/v1.0"],
  },
  {
    code: "P3.1.1", level: 2, parentCode: "P3.1", ownerUnitCode: "MIF",
    nameEn: "Monthly status update procedure", nameAr: "إجراء تحديث الحالة الشهري",
    purposeEn: "What an entity focal point does, and by when, to report the status of an initiative each month.",
    purposeAr: "ما يقوم به منسق الجهة، ومتى، للإبلاغ عن حالة المبادرة كل شهر.",
    steps: [
      step(1, "Open the initiative and update the milestone status by the fifth working day.", "فتح المبادرة وتحديث حالة المعالم بحلول يوم العمل الخامس.", "MIF", "SiaNexus Strategy Canvas"),
      step(2, "Attach the evidence for every milestone marked done.", "إرفاق الأدلة لكل معلم مُعلَّم بالإنجاز.", "MIF", "SiaNexus Vault"),
      step(3, "Flag a risk or a blocker with its owner.", "الإشارة إلى خطر أو عائق مع مالكه.", "MIF"),
      step(4, "Confirm the update; the monitoring department validates within three working days.", "تأكيد التحديث، وتتحقق إدارة الرصد منه خلال ثلاثة أيام عمل.", "MIF", "SiaNexus"),
    ],
  },
  {
    code: "P4.3.1", level: 2, parentCode: "P4.3", ownerUnitCode: "SOA",
    nameEn: "Release day procedure", nameAr: "إجراء يوم الإصدار",
    purposeEn: "The checklist from embargo to publication on the morning of a statistical release.",
    purposeAr: "قائمة التحقق من الحظر إلى النشر في صباح يوم الإصدار الإحصائي.",
    steps: [
      step(1, "Confirm the quality sign-off at least one working day before release.", "تأكيد اعتماد الجودة قبل الإصدار بيوم عمل واحد على الأقل.", "SQ", "Quality register"),
      step(2, "Load the series under embargo and verify the numbers against the tables.", "تحميل السلاسل تحت الحظر والتحقق من الأرقام مقابل الجداول.", "SSD", "Statistics Hub"),
      step(3, "Release at the announced time and publish the bilingual note.", "الإصدار في الوقت المعلن ونشر الملاحظة ثنائية اللغة.", "SOA", "npc.qa"),
      step(4, "Notify subscribers and answer enquiries for the day.", "إبلاغ المشتركين والرد على الاستفسارات خلال اليوم.", "PR"),
      step(5, "Record the release in the calendar as done.", "تسجيل الإصدار في التقويم بوصفه منجزاً.", "SOA", "Statistics Hub"),
    ],
    sopDocRefs: ["cr07 policy: SOA/procedure/v2.2"],
  },
  {
    code: "P4.3.2", level: 2, parentCode: "P4.3", ownerUnitCode: "SOA",
    nameEn: "Revision and correction procedure", nameAr: "إجراء المراجعة والتصحيح",
    purposeEn: "How a published figure is revised or corrected and how the change is announced.",
    purposeAr: "كيف يُراجَع رقم منشور أو يُصحَّح وكيف يُعلن التغيير.",
    steps: [
      step(1, "Classify the change as a scheduled revision or an error correction.", "تصنيف التغيير بوصفه مراجعة مجدولة أو تصحيح خطأ.", "SOA"),
      step(2, "Obtain the quality department's confirmation of the corrected figure.", "الحصول على تأكيد إدارة الجودة للرقم المصحح.", "SQ", "Quality register"),
      step(3, "Publish the revised figure with a note stating what changed and why.", "نشر الرقم المراجع مع ملاحظة توضح ما تغير وسببه.", "SOA", "Statistics Hub"),
      step(4, "Inform the users who received the original figure.", "إعلام المستخدمين الذين تلقوا الرقم الأصلي.", "PR"),
    ],
    sopDocRefs: ["cr07 policy: SOA/procedure/v2.2"],
  },
  {
    code: "P5.2.1", level: 2, parentCode: "P5.2", ownerUnitCode: "SOA",
    nameEn: "Government data request handling", nameAr: "معالجة طلبات البيانات من الجهات الحكومية",
    purposeEn: "The steps from receipt of an entity's data request to delivery, with the turnaround the service promises.",
    purposeAr: "الخطوات من استلام طلب بيانات من جهة إلى التسليم، بزمن الاستجابة الذي تعد به الخدمة.",
    steps: [
      step(1, "Log the request and confirm the requesting officer is authorised.", "تسجيل الطلب والتأكد من تفويض المسؤول الطالب.", "SOA", "Service desk"),
      step(2, "Classify the request: published aggregate, new tabulation or microdata.", "تصنيف الطلب: تجميع منشور، أو جدولة جديدة، أو بيانات جزئية.", "SOA"),
      step(3, "For microdata, obtain the confidentiality undertaking and the centre's approval.", "للبيانات الجزئية، الحصول على تعهد السرية وموافقة المركز.", "NDA"),
      step(4, "Prepare and deliver within ten working days, twenty for new tabulations.", "الإعداد والتسليم خلال عشرة أيام عمل، وعشرين للجداول الجديدة.", "ECS", "Statistics Hub"),
      step(5, "Close the request and record the turnaround.", "إغلاق الطلب وتسجيل زمن الاستجابة.", "SOA", "Service desk"),
    ],
    sopDocRefs: ["cr07 policy: SOA/service/v1.1"],
  },
  {
    code: "P5.1.1", level: 2, parentCode: "P5.1", ownerUnitCode: "IFS",
    nameEn: "Information classification procedure", nameAr: "إجراء تصنيف المعلومات",
    purposeEn: "How the owner of a document or a dataset assigns one of the four classification levels and how the level is audited.",
    purposeAr: "كيف يحدد مالك الوثيقة أو مجموعة البيانات أحد مستويات التصنيف الأربعة وكيف يُدقَّق المستوى.",
    steps: [
      step(1, "The owner assigns the level at creation under the classification policy.", "يحدد المالك المستوى عند الإنشاء وفق سياسة التصنيف.", "NDA", "SiaNexus Vault"),
      step(2, "Levels three and four require the unit head's confirmation.", "يتطلب المستويان الثالث والرابع تأكيد رئيس الوحدة.", "IFS"),
      step(3, "The Information Security Department audits a sample each quarter.", "تدقق إدارة أمن المعلومات عينة كل ربع سنة.", "IFS"),
      step(4, "Misclassified items are corrected and the owner is notified.", "تُصحَّح العناصر المصنفة خطأً ويُبلَّغ المالك.", "IFS", "SiaNexus"),
    ],
    policyDocRefs: ["cr07 policy: IFS/policy_internal/v3.1"],
  },
  {
    code: "P8.2.1", level: 2, parentCode: "P8.2", ownerUnitCode: "HR",
    nameEn: "Knowledge handover procedure", nameAr: "إجراء تسليم المعرفة",
    purposeEn: "What happens from a leaving notice to a signed handover, using the handover checklist template.",
    purposeAr: "ما يحدث من إشعار المغادرة إلى تسليم موقع باستخدام نموذج قائمة التسليم.",
    steps: [
      step(1, "Open the handover in the module the day the notice arrives.", "فتح التسليم في الوحدة يوم وصول الإشعار.", "HR", "Handover module"),
      step(2, "The employee and the manager complete the checklist template.", "يستكمل الموظف والمدير نموذج قائمة التسليم.", "HR", "Handover module"),
      step(3, "Reassign owned documents, systems and relationships to named recipients.", "إعادة إسناد الوثائق والأنظمة والعلاقات المملوكة إلى مستلمين مسمين.", "HR", "Handover module"),
      step(4, "Capture the tacit topics in the interview and file the lessons.", "توثيق الموضوعات الضمنية في المقابلة وإيداع الدروس.", "HR", "Learning Room"),
      step(5, "Sign off by the employee, the manager and the Human Resources Department.", "اعتماد الموظف والمدير وإدارة الموارد البشرية.", "HR", "Handover module"),
    ],
    sopDocRefs: ["cr07 policy: HR/form_template/v1.3"],
  },
  {
    code: "P8.3.1", level: 2, parentCode: "P8.3", ownerUnitCode: "IFS",
    nameEn: "Security incident response procedure", nameAr: "إجراء الاستجابة لحوادث أمن المعلومات",
    purposeEn: "Reporting, triage, containment and closure of an information security incident, with the escalation path.",
    purposeAr: "الإبلاغ عن حادث أمن المعلومات وفرزه واحتواؤه وإغلاقه، مع مسار التصعيد.",
    steps: [
      step(1, "Report within one hour of discovery through the incident line.", "الإبلاغ خلال ساعة من الاكتشاف عبر خط البلاغات.", "IFS", "Security monitoring"),
      step(2, "The duty officer triages within two hours and assigns a severity.", "يفرز ضابط المناوبة البلاغ خلال ساعتين ويحدد درجة الخطورة.", "IFS"),
      step(3, "Severity one and two incidents escalate to the Secretary General the same day.", "تُصعَّد حوادث الدرجتين الأولى والثانية إلى الأمين العام في اليوم نفسه.", "OSG"),
      step(4, "Containment actions are logged as they are taken.", "تُوثَّق إجراءات الاحتواء أثناء تنفيذها.", "IS", "Service desk"),
      step(5, "A closure note with the root cause is filed within ten working days.", "يُرفع تقرير إغلاق يتضمن السبب الجذري خلال عشرة أيام عمل.", "IFS", "SiaNexus Vault"),
    ],
    sopDocRefs: ["cr07 policy: IFS/procedure/v1.0"],
  },
];

export const PROCESSES: ProcessSeed[] = [...LEVEL0, ...LEVEL1_A, ...LEVEL1_B, ...LEVEL1_C, ...LEVEL2];

/* ------------------------------------------------------------------ */
/* 4. RACI for every Level 1 process: one A, at least one R             */
/* ------------------------------------------------------------------ */

export const RACI: RaciSeed[] = [
  { processCode: "P1.1", A: "NPD", R: ["EDP", "HDP", "SDP", "EVP"], C: ["SF", "MIF", "NSC"], I: ["IDP", "OSG"] },
  { processCode: "P1.2", A: "NPD", R: ["IDP", "SPS"], C: ["EDP", "SDP", "HDP", "EVP", "SES", "NV"], I: ["OSG", "MIF"] },
  { processCode: "P1.3", A: "SG", R: ["OSG", "CSA"], C: ["LA", "IDP"], I: ["PR", "NPD"] },
  { processCode: "P2.1", A: "NPD", R: ["IDP", "SDT"], C: ["SDP", "MIF"], I: ["EDP", "HDP", "EVP"] },
  { processCode: "P2.2", A: "NPD", R: ["SDP", "EDP", "HDP", "EVP"], C: ["SES", "IDP"], I: ["FAI", "MIF"] },
  { processCode: "P2.3", A: "NPD", R: ["SPS"], C: ["ECS", "SF", "EDP"], I: ["IDP", "OSG"] },
  { processCode: "P3.1", A: "FAI", R: ["MIF"], C: ["NSC", "SIE", "SIH"], I: ["OSG", "IDP", "NPD"] },
  { processCode: "P3.2", A: "FAI", R: ["SIE", "SIH"], C: ["MIF", "EDP", "SDP"], I: ["OSG"] },
  { processCode: "P3.3", A: "FAI", R: ["MIF"], C: ["SDP", "EDP", "NSC"], I: ["IDP", "NPD"] },
  { processCode: "P4.1", A: "NSC", R: ["SOA", "SSD"], C: ["ECS", "SES", "SQ", "SDT"], I: ["FNA", "NDA"] },
  { processCode: "P4.2", A: "NSC", R: ["ECS", "SES"], C: ["SOA", "NDA", "SQ"], I: ["EDP", "MIF"] },
  { processCode: "P4.3", A: "NSC", R: ["SOA", "SSD"], C: ["SQ", "PR"], I: ["IIC", "MIF", "OSG"] },
  { processCode: "P5.1", A: "NSC", R: ["NDA"], C: ["IFS", "SQ", "SSD", "LA"], I: ["ECS", "SES", "IS"] },
  { processCode: "P5.2", A: "NSC", R: ["NDA", "IFS"], C: ["LA", "SOA"], I: ["IS", "SQ"] },
  { processCode: "P5.3", A: "NSC", R: ["SQ"], C: ["ECS", "SES", "SOA", "NDA"], I: ["IIC"] },
  { processCode: "P6.1", A: "FFV", R: ["SF"], C: ["NV", "PL", "IDP"], I: ["OSG", "MIF", "NPD"] },
  { processCode: "P6.2", A: "FFV", R: ["NV", "SF"], C: ["PL", "SPS", "BSN"], I: ["IDP", "OSG"] },
  { processCode: "P6.3", A: "FFV", R: ["SF"], C: ["MIF", "IDP", "PQI"], I: ["OSG", "NPD"] },
  { processCode: "P7.1", A: "CA", R: ["IIC"], C: ["ECS", "SES", "NDA"], I: ["OSG", "PR"] },
  { processCode: "P7.2", A: "CA", R: ["IIC"], C: ["MIF", "EDP", "SDP"], I: ["OSG", "NPD"] },
  { processCode: "P8.1", A: "CA", R: ["PQI"], C: ["FNA", "IDP", "IA"], I: ["OSG", "HR", "IS"] },
  { processCode: "P8.2", A: "SS", R: ["HR", "SDT"], C: ["IS", "PQI"], I: ["OSG", "IA"] },
  { processCode: "P8.3", A: "SS", R: ["IS", "IFS"], C: ["SSD", "PQI"], I: ["OSG", "IA", "NDA"] },
];

/* ------------------------------------------------------------------ */
/* 5. The annual calendar 2026                                          */
/* ------------------------------------------------------------------ */

export const CALENDAR: CalendarSeed[] = [
  /* strategy reviews */
  { kind: "strategy_review", titleEn: "Council Strategy annual review window", titleAr: "نافذة المراجعة السنوية لاستراتيجية المجلس", dateFrom: "2026-02-02", dateTo: "2026-02-26", ownerUnitCode: "IDP", linked: { type: "council_strategy", ref: "default" }, recurrence: "annual" },
  { kind: "strategy_review", titleEn: "Mid-year strategy review", titleAr: "مراجعة منتصف السنة للاستراتيجية", dateFrom: "2026-07-06", dateTo: "2026-07-16", ownerUnitCode: "IDP", linked: { type: "council_strategy", ref: "default" }, recurrence: "annual" },
  { kind: "strategy_review", titleEn: "Annual target setting for 2027", titleAr: "تحديد المستهدفات السنوية لعام 2027", dateFrom: "2026-11-02", dateTo: "2026-11-20", ownerUnitCode: "IDP", linked: { type: "process", ref: "P1.2" }, recurrence: "annual" },
  /* budget cycle */
  { kind: "budget", titleEn: "Budget circular received from the Ministry of Finance", titleAr: "استلام تعميم الموازنة من وزارة المالية", dateFrom: "2026-03-15", ownerUnitCode: "FNA", recurrence: "annual" },
  { kind: "budget", titleEn: "Sector budget submissions to Financial and Administrative Affairs", titleAr: "تقديم موازنات القطاعات إلى إدارة الشؤون المالية والإدارية", dateFrom: "2026-05-10", dateTo: "2026-05-31", ownerUnitCode: "FNA", linked: { type: "process", ref: "P8.1" }, recurrence: "annual" },
  { kind: "budget", titleEn: "Draft budget submitted to the Ministry of Finance", titleAr: "تقديم مشروع الموازنة إلى وزارة المالية", dateFrom: "2026-08-31", ownerUnitCode: "FNA", recurrence: "annual" },
  { kind: "budget", titleEn: "Budget approval and allocation to sectors", titleAr: "اعتماد الموازنة وتوزيعها على القطاعات", dateFrom: "2026-12-15", ownerUnitCode: "FNA", recurrence: "annual" },
  /* statistical releases beyond the releases table */
  { kind: "statistical_release", titleEn: "Quarterly National Accounts Release - Q4 2025", titleAr: "نشرة الحسابات القومية الفصلية - الربع الرابع 2025", dateFrom: "2026-01-20", ownerUnitCode: "ECS", linked: { type: "process", ref: "P4.3" }, recurrence: "none" },
  { kind: "statistical_release", titleEn: "Quarterly National Accounts Release - Q1 2026", titleAr: "نشرة الحسابات القومية الفصلية - الربع الأول 2026", dateFrom: "2026-04-20", ownerUnitCode: "ECS", linked: { type: "process", ref: "P4.3" }, recurrence: "none" },
  { kind: "statistical_release", titleEn: "Quarterly National Accounts Release - Q3 2026", titleAr: "نشرة الحسابات القومية الفصلية - الربع الثالث 2026", dateFrom: "2026-10-20", ownerUnitCode: "ECS", linked: { type: "process", ref: "P4.3" }, recurrence: "none" },
  { kind: "statistical_release", titleEn: "Labour Force Survey Bulletin - Q4 2025", titleAr: "نشرة مسح القوى العاملة - الربع الرابع 2025", dateFrom: "2026-01-14", ownerUnitCode: "SOA", linked: { type: "process", ref: "P4.3" }, recurrence: "none" },
  { kind: "statistical_release", titleEn: "Labour Force Survey Bulletin - Q1 2026", titleAr: "نشرة مسح القوى العاملة - الربع الأول 2026", dateFrom: "2026-04-14", ownerUnitCode: "SOA", linked: { type: "process", ref: "P4.3" }, recurrence: "none" },
  { kind: "statistical_release", titleEn: "Consumer Price Index monthly release", titleAr: "الإصدار الشهري للرقم القياسي لأسعار المستهلك", dateFrom: "2026-01-07", ownerUnitCode: "ECS", linked: { type: "process", ref: "P4.3" }, recurrence: "monthly" },
  { kind: "statistical_release", titleEn: "Population, Housing and Establishments Census 2026: field enumeration", titleAr: "التعداد العام للسكان والمساكن والمنشآت 2026: العد الميداني", dateFrom: "2026-03-01", dateTo: "2026-03-31", ownerUnitCode: "SOA", linked: { type: "process", ref: "P4.1" }, recurrence: "none" },
  { kind: "statistical_release", titleEn: "Census 2026: preliminary results", titleAr: "التعداد 2026: النتائج الأولية", dateFrom: "2026-09-30", ownerUnitCode: "SOA", linked: { type: "process", ref: "P4.3" }, recurrence: "none" },
  { kind: "statistical_release", titleEn: "Annual Statistical Abstract 2025", titleAr: "المجموعة الإحصائية السنوية 2025", dateFrom: "2026-11-15", ownerUnitCode: "SOA", linked: { type: "process", ref: "P4.3" }, recurrence: "annual" },
  /* NDS3 reviews */
  { kind: "nds_review", titleEn: "NDS3 annual progress review", titleAr: "المراجعة السنوية لتقدم استراتيجية التنمية الوطنية الثالثة", dateFrom: "2026-04-01", dateTo: "2026-04-30", ownerUnitCode: "MIF", linked: { type: "process", ref: "P3.1" }, recurrence: "annual" },
  { kind: "nds_review", titleEn: "NDS3 progress report to the Council of Ministers", titleAr: "تقرير تقدم الاستراتيجية الوطنية الثالثة إلى مجلس الوزراء", dateFrom: "2026-06-15", ownerUnitCode: "MIF", linked: { type: "report_type", ref: "nds3_progress_public" }, recurrence: "annual" },
  { kind: "nds_review", titleEn: "NDS3 mid-term review launch", titleAr: "إطلاق مراجعة منتصف المدة للاستراتيجية الوطنية الثالثة", dateFrom: "2026-09-01", ownerUnitCode: "NPD", linked: { type: "process", ref: "P3.3" }, recurrence: "none" },
  /* the Council */
  { kind: "council_meeting", titleEn: "Council meeting", titleAr: "اجتماع المجلس", dateFrom: "2026-03-10", ownerUnitCode: "CSA", recurrence: "quarterly" },
  /* forum and other */
  { kind: "forum", titleEn: "Doha Data Forum", titleAr: "منتدى الدوحة للبيانات", dateFrom: "2026-12-08", dateTo: "2026-12-09", ownerUnitCode: "NSC", recurrence: "annual" },
  { kind: "other", titleEn: "Annual operational plan consolidated", titleAr: "توحيد الخطة التشغيلية السنوية", dateFrom: "2026-10-15", ownerUnitCode: "PQI", linked: { type: "process", ref: "P8.1" }, recurrence: "annual" },
];

/** Report deadlines by report type code; the seed skips codes the report_types table does not carry. */
export const REPORT_DEADLINES: { code: string; dateFrom: string; recurrence: "annual" | "quarterly" | "monthly"; ownerUnitCode: string }[] = [
  { code: "npc_annual_report", dateFrom: "2026-03-31", recurrence: "annual", ownerUnitCode: "PQI" },
  { code: "nds3_progress_public", dateFrom: "2026-06-30", recurrence: "annual", ownerUnitCode: "MIF" },
  { code: "indices_annual", dateFrom: "2026-10-31", recurrence: "annual", ownerUnitCode: "IIC" },
  { code: "index_forecast_report", dateFrom: "2026-02-15", recurrence: "annual", ownerUnitCode: "IIC" },
  { code: "department_continuity", dateFrom: "2026-12-10", recurrence: "annual", ownerUnitCode: "HR" },
  { code: "statistical_highlights", dateFrom: "2026-01-25", recurrence: "quarterly", ownerUnitCode: "SOA" },
  { code: "council_performance", dateFrom: "2026-01-20", recurrence: "quarterly", ownerUnitCode: "IDP" },
  { code: "leadership_briefing", dateFrom: "2026-01-15", recurrence: "quarterly", ownerUnitCode: "OSG" },
  { code: "lessons_digest_quarterly", dateFrom: "2026-01-30", recurrence: "quarterly", ownerUnitCode: "MIF" },
  { code: "nds3_delivery_monthly", dateFrom: "2026-01-10", recurrence: "monthly", ownerUnitCode: "MIF" },
  { code: "signals_foresight_monthly", dateFrom: "2026-01-08", recurrence: "monthly", ownerUnitCode: "SF" },
];

/* ------------------------------------------------------------------ */
/* 6. Internal interfaces: twenty unit-to-unit flows                    */
/* ------------------------------------------------------------------ */

export const UNIT_INTERFACES: UnitInterfaceSeed[] = [
  { from: "SOA", to: "EDP", flowKind: "data", descriptionEn: "Indicator series and release tables for the situation analysis", descriptionAr: "سلاسل المؤشرات وجداول الإصدار لتحليل الوضع الراهن", triggerEn: "Planning cycle launch or a new release", triggerAr: "إطلاق دورة التخطيط أو صدور إصدار جديد", cadence: "quarterly", serviceLevel: "Within five working days of the request", processCode: "P1.1", focalFromEmail: "saud.alshammari@npc.qa", focalToEmail: "analyst@npc.qa" },
  { from: "SF", to: "EDP", flowKind: "input", descriptionEn: "Foresight briefs and scenario sets feeding the diagnostic", descriptionAr: "موجزات الاستشراف ومجموعات السيناريوهات المغذية للتشخيص", triggerEn: "Diagnostic drafting starts", triggerAr: "بدء صياغة التشخيص", cadence: "per planning cycle", serviceLevel: "Delivered two weeks before drafting", processCode: "P1.1", focalFromEmail: "sultan.alkubaisi@npc.qa", focalToEmail: "omar.barakat@npc.qa" },
  { from: "MIF", to: "EDP", flowKind: "deliverable", descriptionEn: "Evaluation findings of the previous strategy", descriptionAr: "نتائج تقييم الاستراتيجية السابقة", triggerEn: "Evaluation cycle closes", triggerAr: "إغلاق دورة التقييم", cadence: "annual", serviceLevel: "Filed before the cycle launch", processCode: "P3.3", focalFromEmail: "alanoud.althani@npc.qa", focalToEmail: "shaikha.alhajri@npc.qa" },
  { from: "IDP", to: "OSG", flowKind: "approval", descriptionEn: "Consolidated draft strategy for the Secretary General's review", descriptionAr: "مسودة الاستراتيجية الموحدة لمراجعة الأمين العام", triggerEn: "Draft consolidated", triggerAr: "اكتمال توحيد المسودة", cadence: "per planning cycle", serviceLevel: "Review within fifteen working days", processCode: "P1.2", focalFromEmail: "nada.almahameed@npc.qa", focalToEmail: "jassim.alsada@npc.qa" },
  { from: "EDP", to: "IDP", flowKind: "input", descriptionEn: "Economic sector priorities and outcome statements", descriptionAr: "أولويات القطاع الاقتصادي وصياغات النتائج", triggerEn: "Working group convened", triggerAr: "انعقاد مجموعة العمل", cadence: "per planning cycle", serviceLevel: "Within ten working days", processCode: "P1.2", focalFromEmail: "analyst@npc.qa", focalToEmail: "lina.haddad@npc.qa" },
  { from: "SOA", to: "IIC", flowKind: "data", descriptionEn: "Official statistics for international index submissions", descriptionAr: "الإحصاءات الرسمية لتقديمات المؤشرات الدولية", triggerEn: "Publisher deadline approaching", triggerAr: "اقتراب موعد الناشر", cadence: "per index", serviceLevel: "Ten working days before the publisher deadline", processCode: "P7.1", focalFromEmail: "saud.alshammari@npc.qa" },
  { from: "SDP", to: "MIF", flowKind: "deliverable", descriptionEn: "Alignment register entries for the follow-up sector", descriptionAr: "قيود سجل المواءمة لقطاع المتابعة", triggerEn: "Alignment opinion issued", triggerAr: "إصدار رأي المواءمة", cadence: "per submission", serviceLevel: "Same day", processCode: "P2.2", focalFromEmail: "amna.alyafei@npc.qa", focalToEmail: "alanoud.althani@npc.qa" },
  { from: "MIF", to: "OSG", flowKind: "deliverable", descriptionEn: "Monthly NDS3 delivery report and watch list", descriptionAr: "تقرير تنفيذ الاستراتيجية الوطنية الشهري وقائمة المراقبة", triggerEn: "Reporting window closes", triggerAr: "إغلاق نافذة التقارير", cadence: "monthly", serviceLevel: "Five working days after the window closes", processCode: "P3.1", focalFromEmail: "tariq.odeh@npc.qa", focalToEmail: "aisha.alemadi@npc.qa" },
  { from: "SOA", to: "MIF", flowKind: "data", descriptionEn: "Indicator actuals for the reporting period", descriptionAr: "القيم الفعلية للمؤشرات لفترة التقرير", triggerEn: "Release day", triggerAr: "يوم الإصدار", cadence: "monthly", serviceLevel: "On release day", processCode: "P3.1", focalFromEmail: "mohammed.alsulaiti@npc.qa", focalToEmail: "tariq.odeh@npc.qa" },
  { from: "MIF", to: "SIE", flowKind: "input", descriptionEn: "Watch list of initiatives at risk", descriptionAr: "قائمة المراقبة للمبادرات المعرضة للخطر", triggerEn: "Delivery report issued", triggerAr: "إصدار تقرير التنفيذ", cadence: "monthly", serviceLevel: "Within two working days", processCode: "P3.2", focalFromEmail: "alanoud.althani@npc.qa" },
  { from: "SSD", to: "SOA", flowKind: "deliverable", descriptionEn: "Electronic questionnaire and field application", descriptionAr: "الاستبيان الإلكتروني وتطبيق الميدان", triggerEn: "Questionnaire design signed", triggerAr: "اعتماد تصميم الاستبيان", cadence: "per survey", serviceLevel: "Four weeks before fieldwork", processCode: "P4.1", focalFromEmail: "rajesh.kumar@npc.qa", focalToEmail: "ahmed.fathy@npc.qa" },
  { from: "SOA", to: "ECS", flowKind: "data", descriptionEn: "Clean microdata file with metadata", descriptionAr: "ملف البيانات الجزئية النظيف مع البيانات الوصفية", triggerEn: "Quality sign-off of the microdata", triggerAr: "اعتماد جودة البيانات الجزئية", cadence: "per survey", serviceLevel: "Within ten working days of fieldwork close", processCode: "P4.2", focalFromEmail: "ahmed.fathy@npc.qa" },
  { from: "SQ", to: "SOA", flowKind: "approval", descriptionEn: "Quality sign-off before release", descriptionAr: "اعتماد الجودة قبل الإصدار", triggerEn: "Release tables ready", triggerAr: "جاهزية جداول الإصدار", cadence: "per release", serviceLevel: "One working day before release", processCode: "P4.3", focalToEmail: "saud.alshammari@npc.qa" },
  { from: "SSD", to: "SOA", flowKind: "deliverable", descriptionEn: "Series loaded under embargo in the Statistics Hub", descriptionAr: "السلاسل المحملة تحت الحظر في مركز الإحصاءات", triggerEn: "Release note ready", triggerAr: "جاهزية ملاحظة الإصدار", cadence: "per release", serviceLevel: "By 08:00 on release day", processCode: "P4.3", focalFromEmail: "noora.almalki@npc.qa", focalToEmail: "mohammed.alsulaiti@npc.qa" },
  { from: "NDA", to: "ECS", flowKind: "data", descriptionEn: "Administrative records from entities for compilation", descriptionAr: "السجلات الإدارية من الجهات لأغراض التجميع", triggerEn: "Agreement delivery date", triggerAr: "موعد التسليم في الاتفاقية", cadence: "monthly", serviceLevel: "By the tenth of the month", processCode: "P4.2", focalFromEmail: "priya.nair@npc.qa" },
  { from: "IFS", to: "NDA", flowKind: "review", descriptionEn: "Classification decision and access controls for a new dataset", descriptionAr: "قرار التصنيف وضوابط الوصول لمجموعة بيانات جديدة", triggerEn: "New dataset proposed", triggerAr: "اقتراح مجموعة بيانات جديدة", cadence: "per dataset", serviceLevel: "Within five working days", processCode: "P5.1", focalToEmail: "maha.almatwi@npc.qa" },
  { from: "NDA", to: "IS", flowKind: "input", descriptionEn: "Access provisioning requests under signed agreements", descriptionAr: "طلبات تهيئة الوصول بموجب الاتفاقيات الموقعة", triggerEn: "Agreement approved", triggerAr: "اعتماد الاتفاقية", cadence: "per agreement", serviceLevel: "Provisioned within three working days", processCode: "P5.2", focalFromEmail: "priya.nair@npc.qa", focalToEmail: "sara.alansari@npc.qa" },
  { from: "SF", to: "IDP", flowKind: "deliverable", descriptionEn: "Quarterly risk brief for the Strategy Steering Committee", descriptionAr: "موجز المخاطر الربعي للجنة توجيه الاستراتيجية", triggerEn: "Quarter end", triggerAr: "نهاية الربع", cadence: "quarterly", serviceLevel: "Ten working days after quarter end", processCode: "P6.3", focalFromEmail: "rania.zureik@npc.qa", focalToEmail: "nada.almahameed@npc.qa" },
  { from: "SF", to: "OSG", flowKind: "deliverable", descriptionEn: "Monthly signals and foresight brief for the Executive Committee", descriptionAr: "موجز الإشارات والاستشراف الشهري للجنة التنفيذية", triggerEn: "Month end", triggerAr: "نهاية الشهر", cadence: "monthly", serviceLevel: "By the eighth of the month", processCode: "P6.1", focalFromEmail: "sultan.alkubaisi@npc.qa", focalToEmail: "aisha.alemadi@npc.qa" },
  { from: "HR", to: "IS", flowKind: "input", descriptionEn: "Access revocation on completed handovers", descriptionAr: "إلغاء الصلاحيات عند اكتمال التسليم", triggerEn: "Handover signed off", triggerAr: "اعتماد التسليم", cadence: "per handover", serviceLevel: "Same day", processCode: "P8.2", focalToEmail: "ali.almarri@npc.qa" },
];

/* ------------------------------------------------------------------ */
/* 7. External interfaces: ten entities from the register               */
/* ------------------------------------------------------------------ */

export const ENTITY_INTERFACES: EntityInterfaceSeed[] = [
  { entityShort: "MOF", providesEn: "Macroeconomic projections, the national accounts and the fiscal indicators used in the budget circular", providesAr: "التوقعات الاقتصادية الكلية والحسابات القومية والمؤشرات المالية المستخدمة في تعميم الموازنة", receivesEn: "Government finance statistics, the budget circular and the approved allocations", receivesAr: "إحصاءات المالية الحكومية وتعميم الموازنة والمخصصات المعتمدة", focalNpcUnitCode: "ECS", focalEntityName: "Director of Macro-Fiscal Policy", legalBasisEn: "Statistics Law and the annual budget circular", legalBasisAr: "قانون الإحصاء وتعميم الموازنة السنوي", cadence: "quarterly", processCodes: ["P4.2", "P8.1"] },
  { entityShort: "MOCI", providesEn: "Establishment statistics, price indices and alignment opinions on the commerce sector strategy", providesAr: "إحصاءات المنشآت والأرقام القياسية للأسعار وآراء المواءمة على استراتيجية قطاع التجارة", receivesEn: "Commercial registration records and the sector strategy submission", receivesAr: "سجلات القيد التجاري واستراتيجية القطاع المقدمة", focalNpcUnitCode: "EDP", focalEntityName: "Director of Strategic Planning", legalBasisEn: "Data-sharing agreement on the commercial register", legalBasisAr: "اتفاقية تبادل بيانات السجل التجاري", cadence: "monthly", processCodes: ["P2.2", "P5.2"] },
  { entityShort: "QCB", providesEn: "Trade, price and labour statistics for monetary analysis", providesAr: "إحصاءات التجارة والأسعار والعمل للتحليل النقدي", receivesEn: "Monetary and financial sector statistics and bank credit data", receivesAr: "إحصاءات القطاع النقدي والمالي وبيانات الائتمان المصرفي", focalNpcUnitCode: "ECS", focalEntityName: "Head of Statistics and Research", legalBasisEn: "Memorandum of understanding on financial statistics", legalBasisAr: "مذكرة تفاهم بشأن الإحصاءات المالية", cadence: "monthly", processCodes: ["P4.2"] },
  { entityShort: "MOPH", providesEn: "Population estimates, vital statistics and the health chapter of the yearbook", providesAr: "تقديرات السكان والإحصاءات الحيوية وفصل الصحة في الكتاب الإحصائي", receivesEn: "Health service records and the health sector indicators", receivesAr: "سجلات الخدمات الصحية ومؤشرات قطاع الصحة", focalNpcUnitCode: "SES", focalEntityName: "Director of Health Information", legalBasisEn: "Data-sharing agreement on health administrative records", legalBasisAr: "اتفاقية تبادل بيانات السجلات الإدارية الصحية", cadence: "quarterly", processCodes: ["P4.2", "P5.2"] },
  { entityShort: "MOEHE", providesEn: "Education indicators, enrolment ratios and the alignment opinion on the education strategy", providesAr: "مؤشرات التعليم ونسب القيد ورأي المواءمة على استراتيجية التعليم", receivesEn: "School and higher education administrative records", receivesAr: "السجلات الإدارية للمدارس والتعليم العالي", focalNpcUnitCode: "HDP", focalEntityName: "Director of Planning and Statistics", legalBasisEn: "Data-sharing agreement on education records", legalBasisAr: "اتفاقية تبادل بيانات سجلات التعليم", cadence: "annual", processCodes: ["P2.2", "P4.2"] },
  { entityShort: "MOL", providesEn: "Labour force survey results and Qatarization indicators", providesAr: "نتائج مسح القوى العاملة ومؤشرات التقطير", receivesEn: "Work permit and employment records", receivesAr: "سجلات تصاريح العمل والتوظيف", focalNpcUnitCode: "SOA", focalEntityName: "Director of Labour Market Information", legalBasisEn: "Data-sharing agreement on employment records", legalBasisAr: "اتفاقية تبادل بيانات سجلات التوظيف", cadence: "quarterly", processCodes: ["P4.1", "P4.2"] },
  { entityShort: "MOECC", providesEn: "Environment statistics compilation and the environmental outcomes of the national strategy", providesAr: "تجميع إحصاءات البيئة والنتائج البيئية للاستراتيجية الوطنية", receivesEn: "Environmental monitoring data and climate indicators", receivesAr: "بيانات الرصد البيئي ومؤشرات المناخ", focalNpcUnitCode: "EVP", focalEntityName: "Director of Environmental Planning", legalBasisEn: "Memorandum of understanding on environment statistics", legalBasisAr: "مذكرة تفاهم بشأن إحصاءات البيئة", cadence: "annual", processCodes: ["P1.1", "P4.2"] },
  { entityShort: "GSCM", providesEn: "The national strategy for adoption, the NDS3 progress report and the annual report", providesAr: "الاستراتيجية الوطنية للاعتماد وتقرير تقدم الاستراتيجية الوطنية الثالثة والتقرير السنوي", receivesEn: "Council of Ministers decisions and directions on the strategy", receivesAr: "قرارات مجلس الوزراء وتوجيهاته بشأن الاستراتيجية", focalNpcUnitCode: "OSG", focalEntityName: "Director of Government Affairs", legalBasisEn: "Council of Ministers rules of procedure", legalBasisAr: "لائحة إجراءات مجلس الوزراء", cadence: "quarterly", processCodes: ["P1.3", "P3.1"] },
  { entityShort: "QF", providesEn: "Research and education statistics and the foresight partnership programme", providesAr: "إحصاءات البحث والتعليم وبرنامج الشراكة في الاستشراف", receivesEn: "Research outputs, scenario expertise and higher education data", receivesAr: "المخرجات البحثية وخبرات السيناريوهات وبيانات التعليم العالي", focalNpcUnitCode: "SF", focalEntityName: "Director of Strategy and Research", legalBasisEn: "Partnership agreement on foresight and research", legalBasisAr: "اتفاقية شراكة في الاستشراف والبحث", cadence: "semi-annual", processCodes: ["P6.2", "P6.1"] },
  { entityShort: "World Bank", providesEn: "National data submissions for the World Development Indicators and index questionnaires", providesAr: "تقديمات البيانات الوطنية لمؤشرات التنمية العالمية واستبيانات المؤشرات", receivesEn: "International benchmarks, methodology guidance and index results", receivesAr: "المقارنات الدولية والإرشادات المنهجية ونتائج المؤشرات", focalNpcUnitCode: "IIC", focalEntityName: "Country Economist", legalBasisEn: "Statistical cooperation arrangement", legalBasisAr: "ترتيب التعاون الإحصائي", cadence: "annual", processCodes: ["P7.1", "P7.2"] },
];

/* ------------------------------------------------------------------ */
/* 8. Operational KPIs with their 2026 history                          */
/* ------------------------------------------------------------------ */

export const OPS_KPIS: OpsKpiSeed[] = [
  { code: "release_timeliness", nameEn: "Statistical release timeliness", nameAr: "الالتزام بمواعيد الإصدار الإحصائي", unit: "percent", direction: "up_good", sourceKind: "manual", target: 95, values: [92, 94, 91, 95, 96, 93, 95, 97, 96] },
  { code: "data_request_turnaround", nameEn: "Data request turnaround", nameAr: "زمن الاستجابة لطلبات البيانات", unit: "days", direction: "down_good", sourceKind: "manual", target: 10, values: [12.5, 11.8, 11.2, 10.6, 10.9, 10.1, 9.8, 9.6, 9.9] },
  { code: "strategy_review_completion", nameEn: "Strategy review completion", nameAr: "إنجاز مراجعات الاستراتيجية", unit: "percent", direction: "up_good", sourceKind: "manual", target: 90, values: [86, 88, 88, 90, 92, 92, 93, 94, 94] },
  { code: "handover_completion", nameEn: "Handover completion", nameAr: "اكتمال تسليم المهام", unit: "percent", direction: "up_good", sourceKind: "auto", target: 90, values: [71, 75, 78, 80, 82, 80, 76, 73, 73] },
  { code: "policy_review_currency", nameEn: "Policy review currency", nameAr: "حداثة مراجعة السياسات", unit: "percent", direction: "up_good", sourceKind: "auto", target: 90, values: [100, 100, 100, 100, 100, 100, 100, 86, 86] },
];
