// CR08 10: illustrative content for the Operating Model and the process
// architecture. Hand written bilingual words; everything mechanical (ids,
// dates of recurring events, KPI histories) is generated in
// scripts/cr08-opmodel-seed.ts deterministically.
//
// IMPORTANT: the content below is ILLUSTRATIVE. It is a plausible operating
// model written to exercise the /processes and /operating-model screens, not
// the approved operating model of any programme office. Every row seeded from
// this file is marked is_illustrative = 1 and shows the "Illustrative" chip
// until the real content replaces it. Unit codes are the codes of the
// demonstration organisation structure (see the org seed) and must not be
// edited here without checking it. Entity names must match the entities
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

/** Decisions and the escalation path for the bodies the Programme Strategy already carries. */
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
  kind: "strategy_review" | "budget" | "statistical_release" | "nes_review" | "council_meeting" | "report_deadline" | "forum" | "other";
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
  focalOrgUnitCode: string;
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
    textEn: "Every environmental plan, target and policy recommendation rests on data whose source is named and a method that can be explained; where the evidence is thin the plan says so.",
    textAr: "تستند كل خطة بيئية ومستهدف وتوصية سياساتية إلى بيانات محددة المصدر ومنهجية قابلة للشرح، وحين تكون الأدلة محدودة تُصرّح الخطة بذلك.",
  },
  {
    titleEn: "One trusted data source",
    titleAr: "مصدر موثوق واحد للبيانات",
    textEn: "Environmental data is produced once, to one standard, and reused by every entity; no figure reaches a decision through a parallel channel.",
    textAr: "تُنتج البيانات البيئية مرة واحدة وفق معيار واحد وتُعاد الاستفادة منها في كل جهة، ولا يصل أي رقم إلى قرار عبر قناة موازية.",
  },
  {
    titleEn: "Results orientation",
    titleAr: "التوجه نحو النتائج",
    textEn: "Work is planned, budgeted and reported as a results chain from inputs to themes, and progress is judged by what changed for the Kingdom, not by activity counts.",
    textAr: "يُخطط العمل ويُموَّل ويُرفع عنه التقرير بوصفه سلسلة نتائج من المدخلات إلى المحاور، ويُقاس التقدم بما تغير للمملكة لا بعدد الأنشطة.",
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
    textEn: "Every process closes with a lesson recorded where the next team will find it, and every departure hands knowledge over deliberately so the Office never loses a capability with a person.",
    textAr: "تُختتم كل عملية بدرس يُدوَّن حيث يجده الفريق التالي، ويُسلَّم كل مغادر معرفته بشكل منظم حتى لا يفقد المكتب قدرة برحيل شخص.",
  },
];

/* ------------------------------------------------------------------ */
/* 2. Governance bodies beyond the Programme Strategy's own three       */
/* ------------------------------------------------------------------ */

export const GOVERNANCE_BODIES: GovernanceBodySeed[] = [
  {
    key: "council",
    nameEn: "Programme Steering Committee",
    nameAr: "اللجنة التوجيهية للبرنامج",
    roleEn: "The Programme Steering Committee is the highest authority over the Office. It endorses the National Environment Strategy (NES) and its reviews, approves the annual data and monitoring programme and the annual report, and directs the Programme Director.",
    roleAr: "اللجنة التوجيهية للبرنامج هي السلطة العليا على المكتب. تعتمد الاستراتيجية الوطنية للبيئة ومراجعاتها، وتقر برنامج البيانات والرصد السنوي والتقرير السنوي، وتوجه مدير البرنامج.",
    decisionsEn: ["Endorsement of the National Environment Strategy and its mid-term review", "Approval of the annual data and monitoring programme", "Approval of the annual report of the Office", "Positions on matters escalated by the Programme Director"],
    decisionsAr: ["اعتماد الاستراتيجية الوطنية للبيئة ومراجعتها النصفية", "إقرار برنامج البيانات والرصد السنوي", "اعتماد التقرير السنوي للمكتب", "البت في الموضوعات التي يرفعها مدير البرنامج"],
    cadence: "quarterly",
    members: [{ en: "Chair of the Programme Steering Committee", ar: "رئيس اللجنة التوجيهية للبرنامج" }, { en: "Representatives of the member entities", ar: "ممثلو الجهات الأعضاء" }, { en: "Programme Director, Rapporteur", ar: "مدير البرنامج، مقرراً" }],
    escalatesTo: null,
    escalationEn: "Final authority within the programme; matters beyond its mandate go to the national steering level.",
    escalationAr: "السلطة النهائية داخل البرنامج، وما يتجاوز اختصاصها يُرفع إلى مستوى التوجيه الوطني.",
  },
  {
    key: "secretary_general",
    nameEn: "The Programme Director",
    nameAr: "مدير البرنامج",
    roleEn: "Directs the Office, chairs the Executive Committee of the Office and the Strategy Steering Committee, approves the operating model and its processes, and represents the Office before government entities.",
    roleAr: "يدير المكتب، ويرأس اللجنة التنفيذية للمكتب ولجنة توجيه الاستراتيجية، ويعتمد نموذج التشغيل وعملياته، ويمثل المكتب أمام الجهات الحكومية.",
    decisionsEn: ["Approval of the operating model, the process architecture and the RACI", "Allocation of budget and people between sectors", "Release of data products that depart from the pre-announced calendar", "Escalations from the Executive Committee of the Office and the Strategy Steering Committee"],
    decisionsAr: ["اعتماد نموذج التشغيل وهيكل العمليات ومصفوفة المسؤوليات", "توزيع الموازنة والكوادر بين القطاعات", "الإذن بإصدار المنتجات البيانية الخارجة عن التقويم المعلن", "التصعيدات الواردة من اللجنة التنفيذية للمكتب ولجنة توجيه الاستراتيجية"],
    cadence: "weekly",
    members: [{ en: "Programme Director", ar: "مدير البرنامج" }, { en: "Office of the Programme Director", ar: "مكتب مدير البرنامج" }, { en: "Strategy and Performance Sector", ar: "قطاع الاستراتيجية والأداء" }],
    escalatesTo: "council",
    escalationEn: "Matters of policy, mandate or national significance are escalated to the Programme Steering Committee.",
    escalationAr: "تُرفع المسائل السياساتية أو المتعلقة بالاختصاص أو ذات الأهمية الوطنية إلى اللجنة التوجيهية للبرنامج.",
  },
  {
    key: "executive_committee",
    nameEn: "Executive Committee of the Office",
    nameAr: "اللجنة التنفيذية للمكتب",
    roleEn: "The sector heads with the Programme Director run the Office week to week: cross-sector priorities, the operating calendar, interface disputes between units and the operational KPI scorecard.",
    roleAr: "يدير رؤساء القطاعات مع مدير البرنامج المكتب أسبوعاً بأسبوع: الأولويات العابرة للقطاعات، والتقويم التشغيلي، والخلافات على الواجهات بين الوحدات، وبطاقة مؤشرات الأداء التشغيلي.",
    decisionsEn: ["Approval of changes to unit-to-unit interfaces proposed by unit heads", "Monthly review of the operational KPI scorecard", "Sequencing of the annual planning and reporting calendar", "Resolution of ownership questions between sectors"],
    decisionsAr: ["اعتماد تعديلات الواجهات بين الوحدات المقترحة من رؤساء الوحدات", "المراجعة الشهرية لبطاقة مؤشرات الأداء التشغيلي", "ترتيب تقويم التخطيط والتقارير السنوي", "حسم مسائل الملكية بين القطاعات"],
    cadence: "monthly",
    members: [{ en: "Programme Director, Chair", ar: "مدير البرنامج، رئيساً" }, { en: "Head of the Strategy and Performance Sector", ar: "رئيس قطاع الاستراتيجية والأداء" }, { en: "Head of the Data and Knowledge Sector", ar: "رئيس قطاع البيانات والمعرفة" }, { en: "Head of the Regulatory Affairs Sector", ar: "رئيس قطاع الشؤون التنظيمية" }, { en: "Director of Foresight and Risk", ar: "مدير الاستشراف والمخاطر" }, { en: "Director of Partnerships and International Commitments", ar: "مدير الشراكات والالتزامات الدولية" }, { en: "Head of the Corporate Services Sector", ar: "رئيس قطاع الخدمات المؤسسية" }],
    escalatesTo: "secretary_general",
    escalationEn: "Anything the committee cannot settle by consensus is decided by the Programme Director.",
    escalationAr: "ما تعجز اللجنة عن حسمه بالتوافق يبت فيه مدير البرنامج.",
  },
  {
    key: "regulatory_review_panel",
    nameEn: "Regulatory Review Panel",
    nameAr: "لجنة المراجعة التنظيمية",
    roleEn: "Reviews changes in environmental regulation that affect the Office and its partner entities: the regulatory register, the impact of new and amended instruments on the NES themes, and the follow up of compliance findings, with the regulators represented.",
    roleAr: "تراجع التغييرات في التنظيمات البيئية التي تمس المكتب والجهات الشريكة: السجل التنظيمي، وأثر الأدوات الجديدة والمعدلة على محاور الاستراتيجية الوطنية للبيئة، ومتابعة نتائج الامتثال، بتمثيل الجهات التنظيمية.",
    decisionsEn: ["Entries and status changes in the regulatory register", "Which regulatory changes need an impact note for the themes", "Referral of compliance findings to the owning entity", "The quarterly regulatory change brief to leadership"],
    decisionsAr: ["القيود وتغييرات الحالة في السجل التنظيمي", "التغييرات التنظيمية التي تستوجب مذكرة أثر على المحاور", "إحالة نتائج الامتثال إلى الجهة المالكة", "موجز التغييرات التنظيمية الربعي للقيادة"],
    cadence: "quarterly",
    members: [{ en: "Head of the Regulatory Affairs Sector, Chair", ar: "رئيس قطاع الشؤون التنظيمية، رئيساً" }, { en: "Director of Regulatory Compliance Monitoring", ar: "مدير متابعة الامتثال التنظيمي" }, { en: "Director of Regulatory and Legislative Review", ar: "مدير المراجعة التنظيمية والتشريعية" }, { en: "Director of Water Security", ar: "مدير الأمن المائي" }, { en: "Representatives of the partner regulators", ar: "ممثلو الجهات التنظيمية الشريكة" }],
    escalatesTo: "executive_committee",
    escalationEn: "Disagreements with an entity on a regulatory interpretation are escalated to the Executive Committee of the Office.",
    escalationAr: "تُرفع الخلافات مع الجهات حول تفسير تنظيمي إلى اللجنة التنفيذية للمكتب.",
  },
  {
    key: "data_governance_board",
    nameEn: "Data Governance Board",
    nameAr: "مجلس حوكمة البيانات",
    roleEn: "Owns the data standards, the classification scheme, the data-sharing agreements and the access controls across the Office and the entities it serves.",
    roleAr: "يملك معايير البيانات، ومخطط التصنيف، واتفاقيات تبادل البيانات، وضوابط الوصول على مستوى المكتب والجهات التي يخدمها.",
    decisionsEn: ["Adoption of data standards and common definitions", "Approval of data-sharing agreements with entities", "Classification of new datasets and exceptions to the access rules", "Remediation plans for data quality gaps"],
    decisionsAr: ["اعتماد معايير البيانات والتعاريف الموحدة", "اعتماد اتفاقيات تبادل البيانات مع الجهات", "تصنيف مجموعات البيانات الجديدة والاستثناءات من قواعد الوصول", "خطط معالجة فجوات جودة البيانات"],
    cadence: "monthly",
    members: [{ en: "Director of Environmental Data Affairs, Chair", ar: "مدير شؤون البيانات البيئية، رئيساً" }, { en: "Director of Data Quality and Standards", ar: "مدير جودة البيانات والمعايير" }, { en: "Director of Data Systems", ar: "مدير نظم البيانات" }, { en: "Director of Data Governance and Security", ar: "مدير حوكمة البيانات وأمنها" }, { en: "Director of Digital", ar: "مدير الرقمنة" }, { en: "Regulatory and Legislative Review representative", ar: "ممثل المراجعة التنظيمية والتشريعية" }],
    escalatesTo: "executive_committee",
    escalationEn: "Standards disputes and refusals to share data are escalated to the Executive Committee of the Office.",
    escalationAr: "تُرفع الخلافات على المعايير ورفض تبادل البيانات إلى اللجنة التنفيذية للمكتب.",
  },
];

export const COUNCIL_ENRICHMENT: CouncilEnrichmentSeed[] = [
  {
    matchNameEn: "Strategy Steering Committee",
    key: "strategy_steering_committee",
    decisionsEn: ["Annual targets of the institutional strategy", "Quarterly scorecard and risk register review", "Reallocation of budget and people between Programme Strategy projects"],
    decisionsAr: ["المستهدفات السنوية للاستراتيجية المؤسسية", "المراجعة الربعية لبطاقة الأداء وسجل المخاطر", "إعادة توزيع الموازنة والكوادر بين مشاريع استراتيجية المكتب"],
    escalatesTo: "secretary_general",
    escalationEn: "Blockers the committee cannot clear go to the Programme Director.",
    escalationAr: "تُرفع المعوقات التي تعجز اللجنة عن تذليلها إلى مدير البرنامج.",
  },
  {
    matchNameEn: "Strategy Office",
    key: "strategy_office",
    decisionsEn: ["Maintenance of the results chain, the indicator cards and the process architecture", "Acceptance of a reported actual as evidenced", "Approval of interface changes on behalf of the Executive Committee of the Office"],
    decisionsAr: ["صيانة سلسلة النتائج وبطاقات المؤشرات وهيكل العمليات", "قبول القيمة الفعلية المرفوعة بوصفها موثقة بالأدلة", "اعتماد تعديلات الواجهات نيابة عن اللجنة التنفيذية للمكتب"],
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
  { from: "regulatory_review_panel", to: "executive_committee", kind: "escalates_to" },
  { from: "data_governance_board", to: "executive_committee", kind: "escalates_to" },
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
  { code: "P1", level: 0, parentCode: null, ownerUnitCode: "SPS", nameEn: "NES strategy development", nameAr: "إعداد استراتيجية البيئة الوطنية", purposeEn: "Turn Saudi Vision 2030 environmental ambitions into a National Environment Strategy with themes, targets and owners that every entity plans against.", purposeAr: "تحويل طموحات رؤية السعودية 2030 البيئية إلى استراتيجية وطنية للبيئة بمحاور ومستهدفات ومالكين تخطط على أساسها كل جهة." },
  { code: "P2", level: 0, parentCode: null, ownerUnitCode: "SPS", nameEn: "Theme and sector strategy support", nameAr: "دعم استراتيجيات المحاور والقطاعات", purposeEn: "Help every government entity write, align and appraise its own strategy so that sector plans add up to the NES, with the regulatory changes that touch them tracked.", purposeAr: "مساعدة كل جهة حكومية على إعداد استراتيجيتها ومواءمتها وتقييمها حتى تتكامل الخطط القطاعية مع الاستراتيجية الوطنية للبيئة، مع تتبع التغييرات التنظيمية التي تمسها." },
  { code: "P3", level: 0, parentCode: null, ownerUnitCode: "PEV", nameEn: "Monitoring and evaluation", nameAr: "الرصد والتقييم", purposeEn: "Track delivery of the NES, support entities that fall behind, and evaluate what worked.", purposeAr: "متابعة تنفيذ الاستراتيجية الوطنية للبيئة، ودعم الجهات المتأخرة، وتقييم ما نجح." },
  { code: "P4", level: 0, parentCode: null, ownerUnitCode: "DKS", nameEn: "Environmental data production and dissemination", nameAr: "إنتاج البيانات البيئية ونشرها", purposeEn: "Produce trusted environmental data for water, agriculture, climate, land, waste and air from field monitoring, remote sensing and administrative records, and release it on a pre-announced calendar.", purposeAr: "إنتاج بيانات بيئية موثوقة للمياه والزراعة والمناخ والأراضي والنفايات والهواء من الرصد الميداني والاستشعار عن بعد والسجلات الإدارية، ونشرها وفق تقويم معلن مسبقاً." },
  { code: "P5", level: 0, parentCode: null, ownerUnitCode: "DKS", nameEn: "Data governance", nameAr: "حوكمة البيانات", purposeEn: "Set the standards, the classification and the sharing rules that make environmental data one trusted source.", purposeAr: "وضع المعايير والتصنيف وقواعد التبادل التي تجعل البيانات البيئية مصدراً واحداً موثوقاً." },
  { code: "P6", level: 0, parentCode: null, ownerUnitCode: "FRS", nameEn: "Foresight and risk", nameAr: "الاستشراف والمخاطر", purposeEn: "Read the future early: scan signals, build scenarios and assess environmental risks before they reach a plan.", purposeAr: "قراءة المستقبل مبكراً: رصد الإشارات وبناء السيناريوهات وتقييم المخاطر البيئية قبل أن تبلغ الخطة." },
  { code: "P7", level: 0, parentCode: null, ownerUnitCode: "PAR", nameEn: "International index and commitments monitoring", nameAr: "متابعة المؤشرات والالتزامات الدولية", purposeEn: "Track Saudi Arabia's position in international indices and its global environmental commitments, and work with entities on the improvements that move it.", purposeAr: "متابعة موقع المملكة العربية السعودية في المؤشرات الدولية والتزاماتها البيئية العالمية، والعمل مع الجهات على التحسينات التي تحرك هذا الموقع." },
  { code: "P8", level: 0, parentCode: null, ownerUnitCode: "CSS", nameEn: "Institutional development", nameAr: "التطوير المؤسسي", purposeEn: "Keep the Office itself capable: its plans, its people, its knowledge and its systems.", purposeAr: "الحفاظ على قدرة المكتب نفسه: خططه وكوادره ومعرفته وأنظمته." },
];

export const LEVEL1_A: ProcessSeed[] = [
  {
    code: "P1.1", level: 1, parentCode: "P1", ownerUnitCode: "SPD",
    nameEn: "Situation analysis and diagnostics", nameAr: "تحليل الوضع الراهن والتشخيص",
    purposeEn: "Establish the evidence base of a planning cycle: where the Kingdom stands on every theme, what changed since the last strategy and why.",
    purposeAr: "تأسيس قاعدة الأدلة لدورة التخطيط: أين تقف المملكة في كل محور، وما الذي تغير منذ الاستراتيجية السابقة ولماذا.",
    inputs: [io("Environmental data and indicator series", "البيانات البيئية وسلاسل المؤشرات", "DKS"), io("Evaluation findings of the previous strategy", "نتائج تقييم الاستراتيجية السابقة", "PMD"), io("Foresight briefs and scenario sets", "موجزات الاستشراف ومجموعات السيناريوهات", "SCN")],
    outputs: [io("Situation analysis report per theme", "تقرير تحليل الوضع الراهن لكل محور"), io("Baseline table for every candidate indicator", "جدول خط الأساس لكل مؤشر مرشح")],
    steps: [
      step(1, "Agree the analytical frame and the theme list with the theme departments.", "الاتفاق على الإطار التحليلي وقائمة المحاور مع إدارات المحاور.", "SPD", "EnviroAI Strategy Canvas"),
      step(2, "Request the indicator series and the latest releases from the Data and Knowledge Sector.", "طلب سلاسل المؤشرات وأحدث الإصدارات من قطاع البيانات والمعرفة.", "SPD", "Data Hub"),
      step(3, "Draft the diagnostic per theme with the water, agriculture, climate, land, waste and air departments.", "صياغة التشخيص لكل محور مع إدارات المياه والزراعة والمناخ والأراضي والنفايات والهواء.", "WSD", "EnviroAI Vault"),
      step(4, "Integrate the foresight scenarios and the risk register into the diagnostic.", "دمج سيناريوهات الاستشراف وسجل المخاطر في التشخيص.", "SCN", "Signals Radar"),
      step(5, "Review the draft with the Strategy Office and file it as the cycle's baseline document.", "مراجعة المسودة مع مكتب الاستراتيجية وإيداعها بوصفها وثيقة خط الأساس للدورة.", "SPD", "EnviroAI Vault"),
    ],
    systems: [sys("Data Hub", "مركز البيانات"), sys("EnviroAI Vault", "مستودع EnviroAI"), sys("Signals Radar", "رادار الإشارات")],
    kpis: [kpi("Themes with a signed baseline before formulation starts", "المحاور ذات خط أساس معتمد قبل بدء الصياغة", "100", "percent"), kpi("Weeks from cycle launch to the diagnostic report", "الأسابيع من إطلاق الدورة إلى تقرير التشخيص", "10", "weeks")],
  },
  {
    code: "P1.2", level: 1, parentCode: "P1", ownerUnitCode: "SPD",
    nameEn: "Strategy formulation and results chain design", nameAr: "صياغة الاستراتيجية وتصميم سلسلة النتائج",
    purposeEn: "Write the National Environment Strategy as a results chain: themes, targets, indicators, initiatives and the entity that leads each.",
    purposeAr: "كتابة الاستراتيجية الوطنية للبيئة بوصفها سلسلة نتائج: محاور ومستهدفات ومؤشرات ومبادرات والجهة القائدة لكل منها.",
    inputs: [io("Situation analysis and baselines", "تحليل الوضع الراهن وخطوط الأساس", "SPD"), io("Entity proposals and sector priorities", "مقترحات الجهات والأولويات القطاعية"), io("Saudi Vision 2030 environmental objectives", "الأهداف البيئية لرؤية السعودية 2030", "PAR")],
    outputs: [io("Draft strategy document with the results chain", "مسودة وثيقة الاستراتيجية مع سلسلة النتائج"), io("Indicator cards with targets to 2030", "بطاقات المؤشرات بمستهدفات حتى 2030"), io("Lead entity per initiative", "الجهة القائدة لكل مبادرة")],
    steps: [
      step(1, "Convene the theme working groups and agree the theme statements.", "عقد مجموعات عمل المحاور والاتفاق على صياغة المحاور.", "SPD", "EnviroAI Strategy Canvas"),
      step(2, "Design targets and indicator cards with the environmental accounts and data departments.", "تصميم المستهدفات وبطاقات المؤشرات مع إدارات الحسابات البيئية والبيانات.", "EAS", "Data Hub"),
      step(3, "Run the policy simulations on the candidate targets.", "تشغيل محاكاة السياسات على المستهدفات المرشحة.", "PLB", "Policy simulation models"),
      step(4, "Assign a lead entity and a supporting entity to every initiative.", "إسناد جهة قائدة وجهة داعمة لكل مبادرة.", "SPD", "EnviroAI Strategy Canvas"),
      step(5, "Consolidate the draft and send it to the Programme Director for review.", "توحيد المسودة وإرسالها إلى مدير البرنامج للمراجعة.", "OPD", "EnviroAI Vault"),
      step(6, "Record every amendment in the change log under the change control policy.", "تسجيل كل تعديل في سجل التغيير وفق سياسة ضبط التغيير.", "SPD", "EnviroAI"),
    ],
    systems: [sys("EnviroAI Strategy Canvas", "لوحة الاستراتيجية في EnviroAI"), sys("Policy simulation models", "نماذج محاكاة السياسات")],
    kpis: [kpi("Initiatives with a named lead entity", "المبادرات ذات جهة قائدة مسماة", "100", "percent"), kpi("Indicators with a baseline and a 2030 target", "المؤشرات ذات خط أساس ومستهدف 2030", "100", "percent")],
    policyDocRefs: ["cr07 policy: SPD/policy_internal/v1.0"],
  },
  {
    code: "P1.3", level: 1, parentCode: "P1", ownerUnitCode: "OPD",
    nameEn: "Strategy approval and publication", nameAr: "اعتماد الاستراتيجية ونشرها",
    purposeEn: "Carry the draft strategy through the Programme Steering Committee and the national steering level and publish the approved text in both languages.",
    purposeAr: "تمرير مسودة الاستراتيجية عبر اللجنة التوجيهية للبرنامج ومستوى التوجيه الوطني ونشر النص المعتمد باللغتين.",
    inputs: [io("Consolidated draft strategy", "مسودة الاستراتيجية الموحدة", "SPD"), io("Regulatory and legal review of the text", "المراجعة التنظيمية والقانونية للنص", "RLR")],
    outputs: [io("Steering Committee decision endorsing the strategy", "قرار اللجنة التوجيهية باعتماد الاستراتيجية"), io("Published strategy in Arabic and English", "الاستراتيجية المنشورة بالعربية والإنجليزية")],
    steps: [
      step(1, "Prepare the session file with the draft and the summary of decisions required.", "إعداد ملف الجلسة مع المسودة وملخص القرارات المطلوبة.", "PSA", "Steering committee sessions system"),
      step(2, "Present the draft to the Programme Steering Committee and record its decision and directions.", "عرض المسودة على اللجنة التوجيهية للبرنامج وتسجيل قرارها وتوجيهاتها.", "OPD"),
      step(3, "Apply the Committee's directions and obtain the regulatory and legal review of the final text.", "تطبيق توجيهات اللجنة والحصول على المراجعة التنظيمية والقانونية للنص النهائي.", "RLR"),
      step(4, "Transmit the strategy to the national steering level for adoption.", "إحالة الاستراتيجية إلى مستوى التوجيه الوطني للاعتماد.", "OPD"),
      step(5, "Publish the approved strategy and brief the entities through the communication plan.", "نشر الاستراتيجية المعتمدة وإحاطة الجهات عبر خطة الاتصال.", "COM", "Office portal"),
    ],
    systems: [sys("Steering committee sessions system", "نظام جلسات اللجنة التوجيهية"), sys("Office portal", "بوابة المكتب")],
    kpis: [kpi("Days from Steering Committee decision to publication", "الأيام من قرار اللجنة التوجيهية إلى النشر", "30", "days")],
  },
  {
    code: "P2.1", level: 1, parentCode: "P2", ownerUnitCode: "SPD",
    nameEn: "Sector strategy guidance and templates", nameAr: "الإرشادات ونماذج الاستراتيجيات القطاعية",
    purposeEn: "Give entities one planning manual, one template and one worked example so their strategies arrive in a form that aligns.",
    purposeAr: "تزويد الجهات بدليل تخطيط واحد ونموذج واحد ومثال مطبق واحد حتى تصل استراتيجياتها بصيغة قابلة للمواءمة.",
    inputs: [io("Results-based planning manual", "دليل التخطيط المبني على النتائج"), io("Lessons from the previous submission round", "الدروس من جولة الطلبات السابقة", "PMD")],
    outputs: [io("Planning template and guidance note", "نموذج التخطيط والمذكرة الإرشادية"), io("Training clinics for entity planning teams", "جلسات إرشادية لفرق التخطيط في الجهات")],
    steps: [
      step(1, "Update the template and the guidance note after each planning round.", "تحديث النموذج والمذكرة الإرشادية بعد كل جولة تخطيط.", "SPD", "EnviroAI Vault"),
      step(2, "Prepare a fully worked example from one real sector.", "إعداد مثال مكتمل من قطاع حقيقي.", "AFD"),
      step(3, "Run the planning clinics with the entity focal points.", "عقد الجلسات الإرشادية مع منسقي الجهات.", "CAP", "Learning Room"),
      step(4, "Publish the template and open the submission window.", "نشر النموذج وفتح نافذة تقديم الطلبات.", "SPD", "Entity portal"),
    ],
    systems: [sys("Entity portal", "بوابة الجهات"), sys("Learning Room", "غرفة التعلم")],
    kpis: [kpi("Entities attending a clinic before submitting", "الجهات التي حضرت جلسة إرشادية قبل التقديم", "90", "percent")],
  },
  {
    code: "P2.2", level: 1, parentCode: "P2", ownerUnitCode: "AFD",
    nameEn: "Sector strategy review and alignment", nameAr: "مراجعة الاستراتيجيات القطاعية ومواءمتها",
    purposeEn: "Review every entity strategy against the NES results chain and the current regulatory register, and return an alignment opinion the entity can act on.",
    purposeAr: "مراجعة كل استراتيجية قطاعية مقابل سلسلة نتائج الاستراتيجية الوطنية للبيئة والسجل التنظيمي الحالي، وإعادة رأي مواءمة تستطيع الجهة العمل به.",
    inputs: [io("Entity strategy submission", "استراتيجية الجهة المقدمة"), io("NES results chain and targets", "سلسلة نتائج الاستراتيجية الوطنية للبيئة والمستهدفات", "SPD"), io("Regulatory register and change notes", "السجل التنظيمي وملاحظات التغيير", "RCM")],
    outputs: [io("Alignment opinion with required changes", "رأي المواءمة مع التعديلات المطلوبة"), io("Alignment register entry", "قيد في سجل المواءمة")],
    steps: [
      step(1, "Log the submission and assign the reviewing department by theme.", "تسجيل الطلب وإسناد الإدارة المراجعة حسب المحور.", "AFD", "Entity portal"),
      step(2, "Map the entity's themes and initiatives onto the national chain.", "ربط محاور الجهة ومبادراتها بالسلسلة الوطنية.", "WSD", "EnviroAI Strategy Canvas"),
      step(3, "Check the indicators against the official data and flag the unmeasurable.", "فحص المؤشرات مقابل البيانات الرسمية والتنبيه إلى ما لا يمكن قياسه.", "EAS", "Data Hub"),
      step(4, "Check the initiatives against the regulatory register and flag pending regulatory changes that affect them.", "فحص المبادرات مقابل السجل التنظيمي والتنبيه إلى التغييرات التنظيمية المرتقبة التي تمسها.", "RCM", "Regulatory register"),
      step(5, "Issue the alignment opinion within twenty working days.", "إصدار رأي المواءمة خلال عشرين يوم عمل.", "AFD"),
      step(6, "Record the alignment in the register and notify the follow-up sector.", "تسجيل المواءمة في السجل وإبلاغ قطاع المتابعة.", "AFD", "EnviroAI"),
    ],
    systems: [sys("Entity portal", "بوابة الجهات"), sys("EnviroAI Strategy Canvas", "لوحة الاستراتيجية في EnviroAI"), sys("Regulatory register", "السجل التنظيمي")],
    kpis: [kpi("Opinions issued within twenty working days", "الآراء الصادرة خلال عشرين يوم عمل", "90", "percent"), kpi("Entity initiatives mapped to a national target", "مبادرات الجهات المرتبطة بمستهدف وطني", "95", "percent")],
  },
  {
    code: "P2.3", level: 1, parentCode: "P2", ownerUnitCode: "PLB",
    nameEn: "Policy simulation and impact appraisal", nameAr: "محاكاة السياسات وتقييم الأثر",
    purposeEn: "Model the effect of a proposed policy, regulation or target before it is adopted, so choices rest on projected outcomes.",
    purposeAr: "نمذجة أثر سياسة أو تنظيم أو مستهدف مقترح قبل اعتماده حتى تستند الخيارات إلى النتائج المتوقعة.",
    inputs: [io("Policy or draft regulation and its parameters", "مقترح السياسة أو مسودة التنظيم ومعاييره"), io("Indicator series and environmental accounts", "سلاسل المؤشرات والحسابات البيئية", "EAS")],
    outputs: [io("Impact appraisal note with scenarios", "مذكرة تقييم الأثر مع السيناريوهات"), io("Recommended option", "الخيار الموصى به")],
    steps: [
      step(1, "Scope the question and the decision date with the requesting department.", "تحديد نطاق السؤال وتاريخ القرار مع الإدارة الطالبة.", "PLB"),
      step(2, "Assemble the data and calibrate the model.", "تجميع البيانات ومعايرة النموذج.", "PLB", "Policy simulation models"),
      step(3, "Run the baseline and the alternative scenarios.", "تشغيل السيناريو الأساسي والسيناريوهات البديلة.", "PLB", "Policy simulation models"),
      step(4, "Review the results with the theme department and the foresight department.", "مراجعة النتائج مع إدارة المحور وإدارة الاستشراف.", "SCN"),
      step(5, "Issue the appraisal note before the decision date.", "إصدار مذكرة التقييم قبل تاريخ القرار.", "PLB", "EnviroAI Vault"),
    ],
    systems: [sys("Policy simulation models", "نماذج محاكاة السياسات")],
    kpis: [kpi("Appraisals delivered before the decision date", "التقييمات المسلمة قبل تاريخ القرار", "100", "percent")],
  },
];

export const LEVEL1_B: ProcessSeed[] = [
  {
    code: "P3.1", level: 1, parentCode: "P3", ownerUnitCode: "PMD",
    nameEn: "Delivery monitoring and status reporting", nameAr: "رصد التنفيذ وتقارير الحالة",
    purposeEn: "Collect the status of every NES initiative each month and turn it into the delivery report leadership reads.",
    purposeAr: "جمع حالة كل مبادرة من مبادرات الاستراتيجية الوطنية للبيئة شهرياً وتحويلها إلى تقرير التنفيذ الذي تقرؤه القيادة.",
    inputs: [io("Status updates from entity focal points", "تحديثات الحالة من منسقي الجهات"), io("Indicator actuals for the period", "القيم الفعلية للمؤشرات للفترة", "DKS")],
    outputs: [io("Monthly NES delivery report", "تقرير تنفيذ الاستراتيجية الوطنية للبيئة الشهري"), io("Watch list of initiatives at risk", "قائمة المراقبة للمبادرات المعرضة للخطر")],
    steps: [
      step(1, "Open the monthly reporting window and remind the entity focal points.", "فتح نافذة التقارير الشهرية وتذكير منسقي الجهات.", "PMD", "EnviroAI"),
      step(2, "Validate each status update against evidence and the milestone plan.", "التحقق من كل تحديث حالة مقابل الأدلة وخطة المعالم.", "PMD", "EnviroAI Strategy Canvas"),
      step(3, "Pull the period's indicator actuals from the Data Hub.", "سحب القيم الفعلية للمؤشرات للفترة من مركز البيانات.", "PMD", "Data Hub"),
      step(4, "Assemble the delivery report and the watch list.", "تجميع تقرير التنفيذ وقائمة المراقبة.", "PMD", "Reports module"),
      step(5, "Brief the Programme Director and circulate to the sectors.", "إحاطة مدير البرنامج والتعميم على القطاعات.", "OPD", "Reports module"),
    ],
    systems: [sys("EnviroAI Strategy Canvas", "لوحة الاستراتيجية في EnviroAI"), sys("Reports module", "وحدة التقارير")],
    kpis: [kpi("Initiatives with a status update in the month", "المبادرات ذات تحديث حالة في الشهر", "95", "percent"), kpi("Working days from window close to report issue", "أيام العمل من إغلاق النافذة إلى إصدار التقرير", "5", "days")],
  },
  {
    code: "P3.2", level: 1, parentCode: "P3", ownerUnitCode: "ISU",
    nameEn: "Implementation support to entities", nameAr: "دعم التنفيذ لدى الجهات",
    purposeEn: "Sit with the entities whose initiatives are behind, name the obstacle and clear it, with each theme served by its own department.",
    purposeAr: "الجلوس مع الجهات التي تأخرت مبادراتها، وتحديد العائق وتذليله، مع خدمة كل محور من إدارته المختصة.",
    inputs: [io("Watch list of initiatives at risk", "قائمة المراقبة للمبادرات المعرضة للخطر", "PMD"), io("Entity request for support", "طلب الدعم من الجهة")],
    outputs: [io("Support plan agreed with the entity", "خطة الدعم المتفق عليها مع الجهة"), io("Escalation note for unresolved blockers", "مذكرة تصعيد للمعوقات غير المحلولة")],
    steps: [
      step(1, "Triage the watch list and assign a support lead by theme.", "فرز قائمة المراقبة وتعيين قائد دعم حسب المحور.", "ISU"),
      step(2, "Hold the diagnostic session with the entity's delivery team.", "عقد جلسة التشخيص مع فريق التنفيذ في الجهة.", "ISU"),
      step(3, "Agree the support plan with dates and owners.", "الاتفاق على خطة الدعم بتواريخ ومالكين.", "ISU", "EnviroAI"),
      step(4, "Escalate blockers outside the entity's control to the Executive Committee of the Office.", "تصعيد المعوقات الخارجة عن سيطرة الجهة إلى اللجنة التنفيذية للمكتب.", "PEV"),
      step(5, "Record the outcome and the lesson learned.", "تسجيل النتيجة والدرس المستفاد.", "ISU", "Learning Room"),
    ],
    systems: [sys("EnviroAI", "EnviroAI"), sys("Learning Room", "غرفة التعلم")],
    kpis: [kpi("At-risk initiatives with a support plan within a month", "المبادرات المعرضة للخطر ذات خطة دعم خلال شهر", "80", "percent")],
  },
  {
    code: "P3.3", level: 1, parentCode: "P3", ownerUnitCode: "PMD",
    nameEn: "Evaluation and lessons learned", nameAr: "التقييم والدروس المستفادة",
    purposeEn: "Evaluate completed initiatives and the strategy at mid-term, and file the lessons where the next plan will find them.",
    purposeAr: "تقييم المبادرات المكتملة والاستراتيجية في منتصف المدة، وإيداع الدروس حيث تجدها الخطة التالية.",
    inputs: [io("Closure reports of completed initiatives", "تقارير إقفال المبادرات المكتملة"), io("Indicator series over the period", "سلاسل المؤشرات خلال الفترة", "DKS")],
    outputs: [io("Evaluation report", "تقرير التقييم"), io("Lessons published in the Learning Room", "الدروس المنشورة في غرفة التعلم")],
    steps: [
      step(1, "Select the initiatives and the questions for the evaluation cycle.", "اختيار المبادرات والأسئلة لدورة التقييم.", "PMD"),
      step(2, "Collect the evidence and interview the delivery teams.", "جمع الأدلة ومقابلة فرق التنفيذ.", "PEV", "EnviroAI Vault"),
      step(3, "Draft the findings with the theme department.", "صياغة النتائج مع إدارة المحور.", "AFD"),
      step(4, "Publish the lessons and link them to the strategy nodes.", "نشر الدروس وربطها بعناصر الاستراتيجية.", "PMD", "Learning Room"),
      step(5, "Feed the findings into the next planning cycle's diagnostic.", "تغذية النتائج في تشخيص دورة التخطيط التالية.", "SPD"),
    ],
    systems: [sys("Learning Room", "غرفة التعلم"), sys("EnviroAI Vault", "مستودع EnviroAI")],
    kpis: [kpi("Completed initiatives with a published lesson", "المبادرات المكتملة ذات درس منشور", "100", "percent")],
  },
  {
    code: "P4.1", level: 1, parentCode: "P4", ownerUnitCode: "DOP",
    nameEn: "Environmental monitoring and field data operations", nameAr: "عمليات الرصد البيئي والبيانات الميدانية",
    purposeEn: "Design and run the field monitoring, the remote sensing products and the environmental surveys from the sampling design to clean, documented datasets.",
    purposeAr: "تصميم وتنفيذ الرصد الميداني ومنتجات الاستشعار عن بعد والمسوح البيئية من تصميم العينات إلى مجموعات بيانات نظيفة وموثقة.",
    inputs: [io("Annual data and monitoring programme", "برنامج البيانات والرصد السنوي", "DKS"), io("Monitoring network and site register", "شبكة الرصد وسجل المواقع", "EAS"), io("Field budget and staffing", "موازنة الميدان والكوادر", "FIN")],
    outputs: [io("Clean dataset with metadata", "مجموعة البيانات النظيفة مع البيانات الوصفية"), io("Field operations report", "تقرير العمليات الميدانية")],
    steps: [
      step(1, "Design the monitoring protocol and the sample with the theme departments.", "تصميم بروتوكول الرصد والعينة مع إدارات المحاور.", "DOP", "Survey design tools"),
      step(2, "Build the electronic forms and the field application, and configure the sensor feeds.", "بناء النماذج الإلكترونية وتطبيق الميدان وإعداد تغذيات المستشعرات.", "DSY", "Field data capture system"),
      step(3, "Recruit and train the field teams.", "استقطاب فرق الميدان وتدريبها.", "CAP", "Learning Room"),
      step(4, "Run the field collection and the remote sensing acquisition with daily quality monitoring.", "تنفيذ الجمع الميداني وتحصيل بيانات الاستشعار عن بعد مع مراقبة يومية للجودة.", "DOP", "Field data capture system"),
      step(5, "Clean, edit and impute the datasets.", "تنقية مجموعات البيانات وتحريرها واستكمالها.", "DOP", "Environmental data processing system"),
      step(6, "Sign off the quality review before the dataset moves to compilation.", "اعتماد مراجعة الجودة قبل انتقال المجموعة إلى التجميع.", "DQS", "Quality register"),
    ],
    systems: [sys("Field data capture system", "نظام جمع البيانات الميدانية"), sys("Environmental data processing system", "نظام معالجة البيانات البيئية"), sys("Quality register", "سجل الجودة")],
    kpis: [kpi("Monitoring sites reporting on schedule", "مواقع الرصد التي ترفع بياناتها في موعدها", "90", "percent"), kpi("Field rounds delivered on the programme date", "الجولات الميدانية المسلمة في موعد البرنامج", "90", "percent")],
  },
  {
    code: "P4.2", level: 1, parentCode: "P4", ownerUnitCode: "EAS",
    nameEn: "Environmental accounts and indicators compilation", nameAr: "تجميع الحسابات والمؤشرات البيئية",
    purposeEn: "Compile the water, agriculture, climate, land, waste and air indicators and the environmental accounts from monitoring data and administrative records of the regulators.",
    purposeAr: "تجميع مؤشرات المياه والزراعة والمناخ والأراضي والنفايات والهواء والحسابات البيئية من بيانات الرصد والسجلات الإدارية للجهات التنظيمية.",
    inputs: [io("Clean monitoring datasets", "مجموعات بيانات الرصد النظيفة", "DOP"), io("Administrative records from entities such as MEWA, NCEC and NCW", "السجلات الإدارية من جهات مثل وزارة البيئة والمياه والزراعة والمركز الوطني للالتزام البيئي والمركز الوطني للحياة الفطرية", "EDA")],
    outputs: [io("Compiled indicator tables per product", "جداول المؤشرات المجمعة لكل منتج"), io("Methodological notes and revisions", "الملاحظات المنهجية والمراجعات")],
    steps: [
      step(1, "Receive the period's datasets and administrative records.", "استلام مجموعات البيانات والسجلات الإدارية للفترة.", "EAS", "Environmental data processing system"),
      step(2, "Compile the aggregates under the international standards.", "تجميع الإجماليات وفق المعايير الدولية.", "EAS", "Environmental data processing system"),
      step(3, "Compile the water, land and climate indicators with the theme departments.", "تجميع مؤشرات المياه والأراضي والمناخ مع إدارات المحاور.", "WSD", "Environmental data processing system"),
      step(4, "Run the consistency checks and reconcile with the previous period.", "إجراء فحوص الاتساق والمطابقة مع الفترة السابقة.", "DQS", "Quality register"),
      step(5, "Prepare the release tables and the methodological note.", "إعداد جداول الإصدار والملاحظة المنهجية.", "EAS", "Data Hub"),
    ],
    systems: [sys("Environmental data processing system", "نظام معالجة البيانات البيئية"), sys("Data Hub", "مركز البيانات")],
    kpis: [kpi("Products compiled by the internal deadline", "المنتجات المجمعة بحلول الموعد الداخلي", "95", "percent"), kpi("Revisions larger than the tolerance", "المراجعات التي تتجاوز حد التسامح", "2", "count")],
  },
  {
    code: "P4.3", level: 1, parentCode: "P4", ownerUnitCode: "DOP",
    nameEn: "Data release and dissemination", nameAr: "إصدار البيانات ونشرها",
    purposeEn: "Release every data product on its pre-announced date, in both languages, with the revision policy applied and the users informed.",
    purposeAr: "إصدار كل منتج بيانات في موعده المعلن مسبقاً باللغتين، مع تطبيق سياسة المراجعات وإعلام المستخدمين.",
    inputs: [io("Compiled release tables", "جداول الإصدار المجمعة", "EAS"), io("Pre-announced release calendar", "تقويم الإصدار المعلن مسبقاً", "DKS")],
    outputs: [io("Published release on the Office portal and the Data Hub", "الإصدار المنشور على بوابة المكتب ومركز البيانات"), io("Release note and revision note", "ملاحظة الإصدار وملاحظة المراجعة")],
    steps: [
      step(1, "Confirm the quality sign-off and the pre-release access list.", "تأكيد اعتماد الجودة وقائمة الاطلاع المسبق.", "DQS", "Quality register"),
      step(2, "Prepare the bilingual release note and the tables.", "إعداد ملاحظة الإصدار ثنائية اللغة والجداول.", "DOP", "Data Hub"),
      step(3, "Load the series into the Data Hub under embargo.", "تحميل السلاسل في مركز البيانات تحت الحظر.", "DSY", "Data Hub"),
      step(4, "Release at the announced time and publish the note.", "الإصدار في الوقت المعلن ونشر الملاحظة.", "DOP", "Office portal"),
      step(5, "Answer user enquiries and log any correction under the revision procedure.", "الرد على استفسارات المستخدمين وتسجيل أي تصحيح وفق إجراء المراجعات.", "COM"),
    ],
    systems: [sys("Data Hub", "مركز البيانات"), sys("Office portal", "بوابة المكتب")],
    kpis: [kpi("Releases on the announced date", "الإصدارات في الموعد المعلن", "95", "percent"), kpi("Corrections published with a revision note", "التصحيحات المنشورة مع ملاحظة مراجعة", "100", "percent")],
    sopDocRefs: ["cr07 policy: DOP/procedure/v2.2"],
  },
];

export const LEVEL1_C: ProcessSeed[] = [
  {
    code: "P5.1", level: 1, parentCode: "P5", ownerUnitCode: "EDA",
    nameEn: "Data standards and classification", nameAr: "معايير البيانات والتصنيف",
    purposeEn: "Maintain the common definitions, the metadata standard and the classification scheme every dataset carries, including the entries of the regulatory register that set data obligations.",
    purposeAr: "صيانة التعاريف الموحدة ومعيار البيانات الوصفية ومخطط التصنيف الذي تحمله كل مجموعة بيانات، بما في ذلك قيود السجل التنظيمي التي تفرض التزامات بيانات.",
    inputs: [io("International environmental data standards", "المعايير الدولية للبيانات البيئية"), io("Entity data dictionaries", "قواميس بيانات الجهات"), io("Regulatory change notes that affect data obligations", "ملاحظات التغيير التنظيمي المؤثرة على التزامات البيانات", "RCM")],
    outputs: [io("National data standard and definitions register", "معيار البيانات الوطني وسجل التعاريف"), io("Classification decision per dataset", "قرار التصنيف لكل مجموعة بيانات")],
    steps: [
      step(1, "Receive the standard change or the new dataset proposal.", "استلام تغيير المعيار أو مقترح مجموعة البيانات الجديدة.", "EDA", "Data catalogue"),
      step(2, "Check the regulatory register for changes that alter a data obligation and log them for the Regulatory Review Panel.", "فحص السجل التنظيمي بحثاً عن تغييرات تعدل التزام بيانات وتسجيلها للجنة المراجعة التنظيمية.", "RCM", "Regulatory register"),
      step(3, "Harmonise the definitions with the producing entity and the theme department.", "توحيد التعاريف مع الجهة المنتجة وإدارة المحور.", "EDA"),
      step(4, "Assign the classification level under the information classification policy.", "تحديد مستوى التصنيف وفق سياسة تصنيف المعلومات.", "DGS"),
      step(5, "Take the decision to the Data Governance Board.", "عرض القرار على مجلس حوكمة البيانات.", "EDA"),
      step(6, "Publish the standard and update the catalogue entry.", "نشر المعيار وتحديث مدخل الفهرس.", "DSY", "Data catalogue"),
    ],
    systems: [sys("Data catalogue", "فهرس البيانات"), sys("Regulatory register", "السجل التنظيمي"), sys("EnviroAI Vault", "مستودع EnviroAI")],
    kpis: [kpi("Datasets with a catalogue entry and a classification", "مجموعات البيانات ذات مدخل فهرس وتصنيف", "100", "percent")],
    policyDocRefs: ["cr07 policy: DGS/policy_internal/v3.1"],
  },
  {
    code: "P5.2", level: 1, parentCode: "P5", ownerUnitCode: "EDA",
    nameEn: "Data sharing and access management", nameAr: "تبادل البيانات وإدارة الوصول",
    purposeEn: "Bring administrative data in from entities under signed agreements and give users access under the rules of their clearance.",
    purposeAr: "جلب البيانات الإدارية من الجهات بموجب اتفاقيات موقعة ومنح المستخدمين الوصول وفق قواعد تصريحهم.",
    inputs: [io("Data-sharing agreement request", "طلب اتفاقية تبادل البيانات"), io("Access request from a user or entity", "طلب وصول من مستخدم أو جهة")],
    outputs: [io("Signed data-sharing agreement", "اتفاقية تبادل بيانات موقعة"), io("Access grant with its audit trail", "منح الوصول مع سجل التدقيق")],
    steps: [
      step(1, "Draft the agreement with the entity and name a focal point on both sides.", "صياغة الاتفاقية مع الجهة وتسمية منسق من الطرفين.", "EDA"),
      step(2, "Obtain the regulatory and legal review of the agreement.", "الحصول على المراجعة التنظيمية والقانونية للاتفاقية.", "RLR"),
      step(3, "Approve the agreement at the Data Governance Board.", "اعتماد الاتفاقية في مجلس حوكمة البيانات.", "EDA"),
      step(4, "Provision the access with the Data Governance and Security Department.", "تهيئة الوصول مع إدارة حوكمة البيانات وأمنها.", "DGS", "Access management system"),
      step(5, "Audit access quarterly and revoke what is no longer needed.", "تدقيق الوصول كل ربع سنة وإلغاء ما لم يعد ضرورياً.", "DGS", "Access management system"),
    ],
    systems: [sys("Access management system", "نظام إدارة الوصول"), sys("Data catalogue", "فهرس البيانات")],
    kpis: [kpi("Agreements closed within sixty days", "الاتفاقيات المنجزة خلال ستين يوماً", "80", "percent"), kpi("Data request turnaround", "زمن الاستجابة لطلبات البيانات", "10", "days")],
    sopDocRefs: ["cr07 policy: DOP/service/v1.1"],
  },
  {
    code: "P5.3", level: 1, parentCode: "P5", ownerUnitCode: "DQS",
    nameEn: "Data quality assurance", nameAr: "ضمان جودة البيانات",
    purposeEn: "Test every data product and every entity data feed against the quality framework and drive the corrective actions.",
    purposeAr: "اختبار كل منتج بيانات وكل تغذية بيانات من الجهات وفق إطار الجودة وقيادة الإجراءات التصحيحية.",
    inputs: [io("Products awaiting release", "المنتجات في انتظار الإصدار", "EAS"), io("Entity data feeds", "تغذيات البيانات من الجهات", "EDA")],
    outputs: [io("Quality sign-off or findings per product", "اعتماد الجودة أو الملاحظات لكل منتج"), io("Quarterly quality report", "تقرير الجودة الربعي")],
    steps: [
      step(1, "Run the automated checks on the product or the feed.", "تشغيل الفحوص الآلية على المنتج أو التغذية.", "DQS", "Quality register"),
      step(2, "Review the outliers with the compiling department.", "مراجعة القيم الشاذة مع الإدارة المجمعة.", "EAS"),
      step(3, "Record findings with an owner and a date.", "تسجيل الملاحظات مع مالك وتاريخ.", "DQS", "Quality register"),
      step(4, "Sign off or hold the release.", "اعتماد الإصدار أو إيقافه.", "DQS"),
      step(5, "Report the quarter's findings to the Data Governance Board.", "رفع ملاحظات الربع إلى مجلس حوكمة البيانات.", "DQS", "Reports module"),
    ],
    systems: [sys("Quality register", "سجل الجودة")],
    kpis: [kpi("Findings closed within their due date", "الملاحظات المغلقة في موعدها", "85", "percent")],
  },
  {
    code: "P6.1", level: 1, parentCode: "P6", ownerUnitCode: "SCN",
    nameEn: "Horizon scanning and signal triage", nameAr: "استطلاع الأفق وفرز الإشارات",
    purposeEn: "Collect weak signals from research, media, regulators and partners, triage them and attach the accepted ones to the strategy they touch.",
    purposeAr: "جمع الإشارات الضعيفة من البحوث والإعلام والجهات التنظيمية والشركاء، وفرزها، وربط المقبول منها بالاستراتيجية التي تمسها.",
    inputs: [io("Signal submissions and scanned sources", "الإشارات المقدمة والمصادر المرصودة"), io("Strategy themes and risk register", "محاور الاستراتيجية وسجل المخاطر", "SPD")],
    outputs: [io("Triaged signal with a strategy link", "إشارة مفروزة مرتبطة بالاستراتيجية"), io("Monthly signals and foresight brief", "موجز الإشارات والاستشراف الشهري")],
    steps: [
      step(1, "Scan the agreed sources and log candidate signals.", "رصد المصادر المتفق عليها وتسجيل الإشارات المرشحة.", "SCN", "Signals Radar"),
      step(2, "Triage each signal for relevance, novelty and time horizon.", "فرز كل إشارة من حيث الصلة والجدة والأفق الزمني.", "SCN", "Signals Radar"),
      step(3, "Link accepted signals to themes and notify the owning department.", "ربط الإشارات المقبولة بالمحاور وإبلاغ الإدارة المالكة.", "SCN", "EnviroAI"),
      step(4, "Issue the monthly brief to the Executive Committee of the Office.", "إصدار الموجز الشهري إلى اللجنة التنفيذية للمكتب.", "SCN", "Reports module"),
    ],
    systems: [sys("Signals Radar", "رادار الإشارات"), sys("Reports module", "وحدة التقارير")],
    kpis: [kpi("Signals triaged within ten working days", "الإشارات المفروزة خلال عشرة أيام عمل", "90", "percent")],
  },
  {
    code: "P6.2", level: 1, parentCode: "P6", ownerUnitCode: "SCN",
    nameEn: "Scenario development and vision review", nameAr: "بناء السيناريوهات ومراجعة الرؤية",
    purposeEn: "Build scenario sets for the decisions on the table and review the long-term assumptions behind the Saudi Vision 2030 environmental targets against them.",
    purposeAr: "بناء مجموعات السيناريوهات للقرارات المطروحة ومراجعة الافتراضات طويلة المدى وراء المستهدفات البيئية لرؤية السعودية 2030 في ضوئها.",
    inputs: [io("Decision that needs a scenario set", "القرار الذي يحتاج مجموعة سيناريوهات"), io("Triaged signals", "الإشارات المفروزة", "SCN")],
    outputs: [io("Scenario set with implications", "مجموعة السيناريوهات مع دلالاتها"), io("Vision assumptions review note", "مذكرة مراجعة افتراضات الرؤية")],
    steps: [
      step(1, "Name the decision the scenarios must inform and its date.", "تحديد القرار الذي تخدمه السيناريوهات وتاريخه.", "SCN"),
      step(2, "Build the driving forces and the scenario logic with the foresight department.", "بناء القوى المحركة ومنطق السيناريوهات مع إدارة الاستشراف.", "FRS"),
      step(3, "Test the scenarios in the policy lab with the affected entities.", "اختبار السيناريوهات في مختبر السياسات مع الجهات المعنية.", "PLB"),
      step(4, "Quantify the scenarios where a model exists.", "تكميم السيناريوهات حيث يوجد نموذج.", "PLB", "Policy simulation models"),
      step(5, "Publish the set and file the vision review note.", "نشر المجموعة وإيداع مذكرة مراجعة الرؤية.", "SCN", "EnviroAI Vault"),
    ],
    systems: [sys("Policy simulation models", "نماذج محاكاة السياسات"), sys("EnviroAI Vault", "مستودع EnviroAI")],
    kpis: [kpi("Scenario sets tied to a named decision", "مجموعات السيناريوهات المرتبطة بقرار محدد", "100", "percent")],
  },
  {
    code: "P6.3", level: 1, parentCode: "P6", ownerUnitCode: "FRS",
    nameEn: "Strategic risk assessment", nameAr: "تقييم المخاطر الاستراتيجية",
    purposeEn: "Keep one environmental risk register with likelihood, impact, owner and mitigation, reviewed each quarter.",
    purposeAr: "الاحتفاظ بسجل مخاطر بيئية واحد بالاحتمالية والأثر والمالك والمعالجة، يُراجع كل ربع سنة.",
    inputs: [io("Signals and scenarios", "الإشارات والسيناريوهات", "SCN"), io("Delivery watch list", "قائمة مراقبة التنفيذ", "PMD")],
    outputs: [io("Updated risk register", "سجل المخاطر المحدث"), io("Quarterly risk brief", "موجز المخاطر الربعي")],
    steps: [
      step(1, "Collect new risks from the departments and the entities.", "جمع المخاطر الجديدة من الإدارات والجهات.", "FRS", "EnviroAI"),
      step(2, "Score likelihood and impact with the owning department.", "تقدير الاحتمالية والأثر مع الإدارة المالكة.", "FRS"),
      step(3, "Agree the mitigation and its owner.", "الاتفاق على المعالجة ومالكها.", "FRS"),
      step(4, "Present the quarterly brief to the Strategy Steering Committee.", "عرض الموجز الربعي على لجنة توجيه الاستراتيجية.", "SPD", "Reports module"),
    ],
    systems: [sys("EnviroAI", "EnviroAI"), sys("Reports module", "وحدة التقارير")],
    kpis: [kpi("Open risks with a named owner and mitigation", "المخاطر المفتوحة ذات مالك ومعالجة", "100", "percent")],
  },
  {
    code: "P7.1", level: 1, parentCode: "P7", ownerUnitCode: "PAR",
    nameEn: "Index tracking and data submission", nameAr: "تتبع المؤشرات الدولية وتقديم البيانات",
    purposeEn: "Track every international index and global reporting framework Saudi Arabia is measured on, submit the national data on time and record each new edition.",
    purposeAr: "تتبع كل مؤشر دولي وإطار إبلاغ عالمي تُقاس عليه المملكة العربية السعودية، وتقديم البيانات الوطنية في موعدها، وتسجيل كل إصدار جديد.",
    inputs: [io("Index publisher questionnaires and schedules", "استبيانات ناشري المؤشرات وجداولهم"), io("Official data for the submission", "البيانات الرسمية للتقديم", "DKS")],
    outputs: [io("Submitted national data with its record", "البيانات الوطنية المقدمة مع سجلها"), io("Index observation recorded in the Indices module", "قراءة المؤشر المسجلة في وحدة المؤشرات")],
    steps: [
      step(1, "Maintain the calendar of publisher deadlines.", "صيانة تقويم مواعيد الناشرين.", "PAR", "Indices module"),
      step(2, "Collect the data from the responsible entity and the data departments.", "جمع البيانات من الجهة المسؤولة وإدارات البيانات.", "PAR"),
      step(3, "Validate and submit to the publisher.", "التحقق والتقديم إلى الناشر.", "PAR"),
      step(4, "Record the published edition and the rank in the Indices module.", "تسجيل الإصدار المنشور والترتيب في وحدة المؤشرات.", "PAR", "Indices module"),
      step(5, "Brief the responsible entity on the movement.", "إحاطة الجهة المسؤولة بالتغير.", "PAR"),
    ],
    systems: [sys("Indices module", "وحدة المؤشرات الدولية")],
    kpis: [kpi("Submissions made by the publisher deadline", "التقديمات المنجزة قبل موعد الناشر", "100", "percent")],
  },
  {
    code: "P7.2", level: 1, parentCode: "P7", ownerUnitCode: "PAR",
    nameEn: "Index improvement plans with entities", nameAr: "خطط تحسين المؤشرات مع الجهات",
    purposeEn: "Agree with each responsible entity the actions that move Saudi Arabia's position and follow them through the year.",
    purposeAr: "الاتفاق مع كل جهة مسؤولة على الإجراءات التي تحرك موقع المملكة العربية السعودية ومتابعتها على مدار السنة.",
    inputs: [io("Index forecast and gap analysis", "تنبؤ المؤشر وتحليل الفجوة", "PAR"), io("Entity action proposals", "مقترحات إجراءات الجهات")],
    outputs: [io("Improvement plan per index", "خطة التحسين لكل مؤشر"), io("Annual report on Saudi Arabia in international indices", "التقرير السنوي عن المملكة العربية السعودية في المؤشرات الدولية")],
    steps: [
      step(1, "Analyse the sub-indicators that drive the gap.", "تحليل المؤشرات الفرعية التي تصنع الفجوة.", "PAR", "Indices module"),
      step(2, "Agree the actions and owners with the responsible entity.", "الاتفاق على الإجراءات والمالكين مع الجهة المسؤولة.", "PAR"),
      step(3, "Follow up the actions each quarter.", "متابعة الإجراءات كل ربع سنة.", "PMD"),
      step(4, "Compile the annual indices report.", "إعداد التقرير السنوي للمؤشرات.", "PAR", "Reports module"),
    ],
    systems: [sys("Indices module", "وحدة المؤشرات الدولية"), sys("Reports module", "وحدة التقارير")],
    kpis: [kpi("Tracked indices with an agreed improvement plan", "المؤشرات المتتبعة ذات خطة تحسين متفق عليها", "80", "percent")],
  },
  {
    code: "P8.1", level: 1, parentCode: "P8", ownerUnitCode: "PQS",
    nameEn: "Institutional planning and quality", nameAr: "التخطيط المؤسسي والجودة",
    purposeEn: "Prepare the Office's own strategy and operational plans, review performance quality and simplify processes.",
    purposeAr: "إعداد الاستراتيجية المؤسسية للمكتب وخططه التشغيلية، ومراجعة جودة الأداء، وتبسيط الإجراءات.",
    inputs: [io("Sector operational plans", "الخطط التشغيلية للقطاعات"), io("Programme Strategy scorecard", "بطاقة أداء استراتيجية المكتب", "SPD")],
    outputs: [io("Annual operational plan", "الخطة التشغيلية السنوية"), io("Process simplification proposals", "مقترحات تبسيط الإجراءات")],
    steps: [
      step(1, "Collect the sector plans against the strategy's outputs.", "جمع خطط القطاعات مقابل مخرجات الاستراتيجية.", "PQS", "EnviroAI"),
      step(2, "Consolidate the annual operational plan and its budget link.", "توحيد الخطة التشغيلية السنوية وربطها بالموازنة.", "FIN"),
      step(3, "Review the quality of unit performance each half year.", "مراجعة جودة أداء الوحدات كل نصف سنة.", "PQS"),
      step(4, "Propose process simplifications to the Executive Committee of the Office.", "اقتراح تبسيط الإجراءات على اللجنة التنفيذية للمكتب.", "PQS", "Processes page"),
      step(5, "Prepare the annual report on the Office's activities.", "إعداد التقرير السنوي عن أنشطة المكتب.", "PQS", "Reports module"),
    ],
    systems: [sys("EnviroAI", "EnviroAI"), sys("Reports module", "وحدة التقارير")],
    kpis: [kpi("Strategy reviews completed on schedule", "مراجعات الاستراتيجية المنجزة في موعدها", "100", "percent")],
  },
  {
    code: "P8.2", level: 1, parentCode: "P8", ownerUnitCode: "HR",
    nameEn: "Workforce capability and knowledge continuity", nameAr: "قدرات القوى العاملة واستمرارية المعرفة",
    purposeEn: "Develop the Office's people and make sure knowledge is handed over before anyone leaves or moves.",
    purposeAr: "تطوير كوادر المكتب وضمان تسليم المعرفة قبل مغادرة أي موظف أو انتقاله.",
    inputs: [io("Capability needs from the units", "احتياجات القدرات من الوحدات"), io("Leaving and transfer notices", "إشعارات المغادرة والانتقال")],
    outputs: [io("Training plan and completion record", "خطة التدريب وسجل الإتمام"), io("Completed handover with a learning path for the successor", "تسليم مكتمل مع مسار تعلم للخلف")],
    steps: [
      step(1, "Compile the capability plan with the unit heads.", "إعداد خطة القدرات مع رؤساء الوحدات.", "HR"),
      step(2, "Run the training programmes through the capability development unit.", "تنفيذ برامج التدريب عبر إدارة تنمية القدرات.", "CAP", "Learning Room"),
      step(3, "Open a handover the day a leaving notice arrives.", "فتح ملف تسليم يوم وصول إشعار المغادرة.", "HR", "Handover module"),
      step(4, "Reassign every owned item and capture the tacit knowledge.", "إعادة إسناد كل عنصر مملوك وتوثيق المعرفة الضمنية.", "KMD", "Handover module"),
      step(5, "Sign off the handover and the successor's learning path.", "اعتماد التسليم ومسار تعلم الخلف.", "HR", "Handover module"),
    ],
    systems: [sys("Handover module", "وحدة التسليم"), sys("Learning Room", "غرفة التعلم")],
    kpis: [kpi("Handovers complete before the last working day", "التسليمات المكتملة قبل آخر يوم عمل", "90", "percent")],
    policyDocRefs: ["cr07 policy: HR/policy_internal/v2.0"],
    sopDocRefs: ["cr07 policy: HR/form_template/v1.3"],
  },
  {
    code: "P8.3", level: 1, parentCode: "P8", ownerUnitCode: "DIG",
    nameEn: "Digital systems and information security", nameAr: "الأنظمة الرقمية وأمن المعلومات",
    purposeEn: "Run and secure the systems every process depends on, from the field applications to EnviroAI.",
    purposeAr: "تشغيل وتأمين الأنظمة التي تعتمد عليها كل عملية، من تطبيقات الميدان إلى EnviroAI.",
    inputs: [io("Change and service requests from the units", "طلبات التغيير والخدمة من الوحدات"), io("Security policies and controls", "سياسات وضوابط الأمن", "DGS")],
    outputs: [io("Operated systems within their service levels", "أنظمة مشغلة ضمن مستويات خدمتها"), io("Security incident record and closure notes", "سجل الحوادث الأمنية وملاحظات الإغلاق")],
    steps: [
      step(1, "Log and prioritise the change or service request.", "تسجيل طلب التغيير أو الخدمة وترتيب أولويته.", "DIG", "Service desk"),
      step(2, "Review the design with the Data Governance and Security Department.", "مراجعة التصميم مع إدارة حوكمة البيانات وأمنها.", "DGS"),
      step(3, "Deliver the change and update the system record.", "تنفيذ التغيير وتحديث سجل النظام.", "DIG", "Service desk"),
      step(4, "Monitor security events and respond to incidents under the procedure.", "مراقبة الأحداث الأمنية والاستجابة للحوادث وفق الإجراء.", "DGS", "Security monitoring"),
      step(5, "Report availability and incidents monthly.", "رفع تقرير التوافر والحوادث شهرياً.", "DIG", "Reports module"),
    ],
    systems: [sys("Service desk", "مكتب الخدمة"), sys("Security monitoring", "المراقبة الأمنية")],
    kpis: [kpi("System availability", "توافر الأنظمة", "99.5", "percent"), kpi("Incidents closed within ten working days", "الحوادث المغلقة خلال عشرة أيام عمل", "95", "percent")],
    sopDocRefs: ["cr07 policy: DGS/procedure/v1.0"],
  },
];

export const LEVEL2: ProcessSeed[] = [
  {
    code: "P1.2.1", level: 2, parentCode: "P1.2", ownerUnitCode: "SPD",
    nameEn: "Strategy change control procedure", nameAr: "إجراء ضبط التغيير على الاستراتيجية",
    purposeEn: "How a goal, a target or a project in the strategy is changed and the record each change must leave.",
    purposeAr: "كيف يُعدَّل هدف أو مستهدف أو مشروع في الاستراتيجية والسجل الذي يجب أن يتركه كل تغيير.",
    steps: [
      step(1, "File the change request with the reason and the evidence.", "تقديم طلب التغيير مع السبب والأدلة.", "SPD", "EnviroAI"),
      step(2, "Route goals and themes to the Strategy Steering Committee; projects to the owning unit head.", "إحالة الأهداف والمحاور إلى لجنة توجيه الاستراتيجية، والمشاريع إلى رئيس الوحدة المالكة.", "SPD"),
      step(3, "Apply the approved change and log it with the name and the date.", "تطبيق التغيير المعتمد وتسجيله بالاسم والتاريخ.", "SPD", "EnviroAI Strategy Canvas"),
      step(4, "Notify the affected entities and focal points.", "إبلاغ الجهات والمنسقين المعنيين.", "SPD", "EnviroAI"),
    ],
    policyDocRefs: ["cr07 policy: SPD/policy_internal/v1.0"],
  },
  {
    code: "P3.1.1", level: 2, parentCode: "P3.1", ownerUnitCode: "PMD",
    nameEn: "Monthly status update procedure", nameAr: "إجراء تحديث الحالة الشهري",
    purposeEn: "What an entity focal point does, and by when, to report the status of an initiative each month.",
    purposeAr: "ما يقوم به منسق الجهة، ومتى، للإبلاغ عن حالة المبادرة كل شهر.",
    steps: [
      step(1, "Open the initiative and update the milestone status by the fifth working day.", "فتح المبادرة وتحديث حالة المعالم بحلول يوم العمل الخامس.", "PMD", "EnviroAI Strategy Canvas"),
      step(2, "Attach the evidence for every milestone marked done.", "إرفاق الأدلة لكل معلم مُعلَّم بالإنجاز.", "PMD", "EnviroAI Vault"),
      step(3, "Flag a risk or a blocker with its owner.", "الإشارة إلى خطر أو عائق مع مالكه.", "PMD"),
      step(4, "Confirm the update; the monitoring department validates within three working days.", "تأكيد التحديث، وتتحقق إدارة المتابعة منه خلال ثلاثة أيام عمل.", "PMD", "EnviroAI"),
    ],
  },
  {
    code: "P4.3.1", level: 2, parentCode: "P4.3", ownerUnitCode: "DOP",
    nameEn: "Release day procedure", nameAr: "إجراء يوم الإصدار",
    purposeEn: "The checklist from embargo to publication on the morning of a data release.",
    purposeAr: "قائمة التحقق من الحظر إلى النشر في صباح يوم إصدار البيانات.",
    steps: [
      step(1, "Confirm the quality sign-off at least one working day before release.", "تأكيد اعتماد الجودة قبل الإصدار بيوم عمل واحد على الأقل.", "DQS", "Quality register"),
      step(2, "Load the series under embargo and verify the numbers against the tables.", "تحميل السلاسل تحت الحظر والتحقق من الأرقام مقابل الجداول.", "DSY", "Data Hub"),
      step(3, "Release at the announced time and publish the bilingual note.", "الإصدار في الوقت المعلن ونشر الملاحظة ثنائية اللغة.", "DOP", "Office portal"),
      step(4, "Notify subscribers and answer enquiries for the day.", "إبلاغ المشتركين والرد على الاستفسارات خلال اليوم.", "COM"),
      step(5, "Record the release in the calendar as done.", "تسجيل الإصدار في التقويم بوصفه منجزاً.", "DOP", "Data Hub"),
    ],
    sopDocRefs: ["cr07 policy: DOP/procedure/v2.2"],
  },
  {
    code: "P4.3.2", level: 2, parentCode: "P4.3", ownerUnitCode: "DOP",
    nameEn: "Revision and correction procedure", nameAr: "إجراء المراجعة والتصحيح",
    purposeEn: "How a published figure is revised or corrected and how the change is announced.",
    purposeAr: "كيف يُراجَع رقم منشور أو يُصحَّح وكيف يُعلن التغيير.",
    steps: [
      step(1, "Classify the change as a scheduled revision or an error correction.", "تصنيف التغيير بوصفه مراجعة مجدولة أو تصحيح خطأ.", "DOP"),
      step(2, "Obtain the data quality department's confirmation of the corrected figure.", "الحصول على تأكيد إدارة جودة البيانات للرقم المصحح.", "DQS", "Quality register"),
      step(3, "Publish the revised figure with a note stating what changed and why.", "نشر الرقم المراجع مع ملاحظة توضح ما تغير وسببه.", "DOP", "Data Hub"),
      step(4, "Inform the users who received the original figure.", "إعلام المستخدمين الذين تلقوا الرقم الأصلي.", "COM"),
    ],
    sopDocRefs: ["cr07 policy: DOP/procedure/v2.2"],
  },
  {
    code: "P5.2.1", level: 2, parentCode: "P5.2", ownerUnitCode: "DOP",
    nameEn: "Government data request handling", nameAr: "معالجة طلبات البيانات من الجهات الحكومية",
    purposeEn: "The steps from receipt of an entity's data request to delivery, with the turnaround the service promises.",
    purposeAr: "الخطوات من استلام طلب بيانات من جهة إلى التسليم، بزمن الاستجابة الذي تعد به الخدمة.",
    steps: [
      step(1, "Log the request and confirm the requesting officer is authorised.", "تسجيل الطلب والتأكد من تفويض المسؤول الطالب.", "DOP", "Service desk"),
      step(2, "Classify the request: published aggregate, new tabulation or restricted record-level data.", "تصنيف الطلب: تجميع منشور، أو جدولة جديدة، أو بيانات تفصيلية مقيّدة.", "DOP"),
      step(3, "For restricted data, obtain the confidentiality undertaking and the approval of the Data Governance Board.", "للبيانات المقيّدة، الحصول على تعهد السرية وموافقة مجلس حوكمة البيانات.", "EDA"),
      step(4, "Prepare and deliver within ten working days, twenty for new tabulations.", "الإعداد والتسليم خلال عشرة أيام عمل، وعشرين للجداول الجديدة.", "EAS", "Data Hub"),
      step(5, "Close the request and record the turnaround.", "إغلاق الطلب وتسجيل زمن الاستجابة.", "DOP", "Service desk"),
    ],
    sopDocRefs: ["cr07 policy: DOP/service/v1.1"],
  },
  {
    code: "P5.1.1", level: 2, parentCode: "P5.1", ownerUnitCode: "DGS",
    nameEn: "Information classification procedure", nameAr: "إجراء تصنيف المعلومات",
    purposeEn: "How the owner of a document or a dataset assigns one of the four classification levels and how the level is audited.",
    purposeAr: "كيف يحدد مالك الوثيقة أو مجموعة البيانات أحد مستويات التصنيف الأربعة وكيف يُدقَّق المستوى.",
    steps: [
      step(1, "The owner assigns the level at creation under the classification policy.", "يحدد المالك المستوى عند الإنشاء وفق سياسة التصنيف.", "EDA", "EnviroAI Vault"),
      step(2, "Levels three and four require the unit head's confirmation.", "يتطلب المستويان الثالث والرابع تأكيد رئيس الوحدة.", "DGS"),
      step(3, "The Data Governance and Security Department audits a sample each quarter.", "تدقق إدارة حوكمة البيانات وأمنها عينة كل ربع سنة.", "DGS"),
      step(4, "Misclassified items are corrected and the owner is notified.", "تُصحَّح العناصر المصنفة خطأً ويُبلَّغ المالك.", "DGS", "EnviroAI"),
    ],
    policyDocRefs: ["cr07 policy: DGS/policy_internal/v3.1"],
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
      step(4, "Capture the tacit topics in the interview and file the lessons.", "توثيق الموضوعات الضمنية في المقابلة وإيداع الدروس.", "KMD", "Learning Room"),
      step(5, "Sign off by the employee, the manager and the Human Resources Department.", "اعتماد الموظف والمدير وإدارة الموارد البشرية.", "HR", "Handover module"),
    ],
    sopDocRefs: ["cr07 policy: HR/form_template/v1.3"],
  },
  {
    code: "P8.3.1", level: 2, parentCode: "P8.3", ownerUnitCode: "DGS",
    nameEn: "Security incident response procedure", nameAr: "إجراء الاستجابة لحوادث أمن المعلومات",
    purposeEn: "Reporting, triage, containment and closure of an information security incident, with the escalation path.",
    purposeAr: "الإبلاغ عن حادث أمن المعلومات وفرزه واحتواؤه وإغلاقه، مع مسار التصعيد.",
    steps: [
      step(1, "Report within one hour of discovery through the incident line.", "الإبلاغ خلال ساعة من الاكتشاف عبر خط البلاغات.", "DGS", "Security monitoring"),
      step(2, "The duty officer triages within two hours and assigns a severity.", "يفرز ضابط المناوبة البلاغ خلال ساعتين ويحدد درجة الخطورة.", "DGS"),
      step(3, "Severity one and two incidents escalate to the Programme Director the same day.", "تُصعَّد حوادث الدرجتين الأولى والثانية إلى مدير البرنامج في اليوم نفسه.", "OPD"),
      step(4, "Containment actions are logged as they are taken.", "تُوثَّق إجراءات الاحتواء أثناء تنفيذها.", "DIG", "Service desk"),
      step(5, "A closure note with the root cause is filed within ten working days.", "يُرفع تقرير إغلاق يتضمن السبب الجذري خلال عشرة أيام عمل.", "DGS", "EnviroAI Vault"),
    ],
    sopDocRefs: ["cr07 policy: DGS/procedure/v1.0"],
  },
];

export const PROCESSES: ProcessSeed[] = [...LEVEL0, ...LEVEL1_A, ...LEVEL1_B, ...LEVEL1_C, ...LEVEL2];

/* ------------------------------------------------------------------ */
/* 4. RACI for every Level 1 process: one A, at least one R             */
/* ------------------------------------------------------------------ */

export const RACI: RaciSeed[] = [
  { processCode: "P1.1", A: "SPS", R: ["SPD", "WSD", "AFD", "CLD"], C: ["SCN", "PMD", "DKS"], I: ["BLD", "OPD"] },
  { processCode: "P1.2", A: "SPS", R: ["SPD", "PLB"], C: ["WSD", "AFD", "CLD", "BLD", "EAS", "SCN"], I: ["OPD", "PMD"] },
  { processCode: "P1.3", A: "OPD", R: ["PSA"], C: ["RLR", "SPD"], I: ["COM", "SPS"] },
  { processCode: "P2.1", A: "SPS", R: ["SPD", "CAP"], C: ["AFD", "PMD"], I: ["WSD", "CLD", "BLD"] },
  { processCode: "P2.2", A: "SPS", R: ["AFD", "WSD", "CLD", "BLD"], C: ["EAS", "SPD", "RCM"], I: ["PEV", "PMD"] },
  { processCode: "P2.3", A: "SPS", R: ["PLB"], C: ["EAS", "SCN", "WSD", "RLR"], I: ["SPD", "OPD"] },
  { processCode: "P3.1", A: "PEV", R: ["PMD"], C: ["DKS", "ISU"], I: ["OPD", "SPD", "SPS"] },
  { processCode: "P3.2", A: "PEV", R: ["ISU"], C: ["PMD", "WSD", "AFD"], I: ["OPD"] },
  { processCode: "P3.3", A: "PEV", R: ["PMD"], C: ["AFD", "WSD", "DKS"], I: ["SPD", "SPS"] },
  { processCode: "P4.1", A: "DKS", R: ["DOP", "DSY"], C: ["EAS", "DQS", "CAP", "BLD"], I: ["FIN", "EDA"] },
  { processCode: "P4.2", A: "DKS", R: ["EAS"], C: ["DOP", "EDA", "DQS", "AQD", "WCD"], I: ["WSD", "PMD"] },
  { processCode: "P4.3", A: "DKS", R: ["DOP", "DSY"], C: ["DQS", "COM"], I: ["PAR", "PMD", "OPD"] },
  { processCode: "P5.1", A: "DKS", R: ["EDA"], C: ["DGS", "DQS", "DSY", "RLR", "RCM"], I: ["EAS", "DIG"] },
  { processCode: "P5.2", A: "DKS", R: ["EDA", "DGS"], C: ["RLR", "DOP"], I: ["DIG", "DQS"] },
  { processCode: "P5.3", A: "DKS", R: ["DQS"], C: ["EAS", "DOP", "EDA"], I: ["PAR"] },
  { processCode: "P6.1", A: "FRS", R: ["SCN"], C: ["PLB", "SPD"], I: ["OPD", "PMD", "SPS"] },
  { processCode: "P6.2", A: "FRS", R: ["SCN"], C: ["PLB", "BIN"], I: ["SPD", "OPD"] },
  { processCode: "P6.3", A: "FRS", R: ["SCN"], C: ["PMD", "SPD", "PQS"], I: ["OPD", "SPS"] },
  { processCode: "P7.1", A: "PAR", R: ["COM"], C: ["EAS", "EDA"], I: ["OPD", "DKS"] },
  { processCode: "P7.2", A: "PAR", R: ["COM"], C: ["PMD", "WSD", "AFD"], I: ["OPD", "SPS"] },
  { processCode: "P8.1", A: "SPS", R: ["PQS"], C: ["FIN", "SPD"], I: ["OPD", "HR", "DIG"] },
  { processCode: "P8.2", A: "CSS", R: ["HR", "CAP"], C: ["DIG", "KMD", "PQS"], I: ["OPD"] },
  { processCode: "P8.3", A: "CSS", R: ["DIG", "DGS"], C: ["DSY", "PQS"], I: ["OPD", "DKS"] },
];

/* ------------------------------------------------------------------ */
/* 5. The annual calendar 2026                                          */
/* ------------------------------------------------------------------ */

export const CALENDAR: CalendarSeed[] = [
  /* strategy reviews */
  { kind: "strategy_review", titleEn: "Programme Strategy annual review window", titleAr: "نافذة المراجعة السنوية لاستراتيجية المكتب", dateFrom: "2026-02-02", dateTo: "2026-02-26", ownerUnitCode: "SPD", linked: { type: "council_strategy", ref: "default" }, recurrence: "annual" },
  { kind: "strategy_review", titleEn: "Mid-year strategy review", titleAr: "مراجعة منتصف السنة للاستراتيجية", dateFrom: "2026-07-06", dateTo: "2026-07-16", ownerUnitCode: "SPD", linked: { type: "council_strategy", ref: "default" }, recurrence: "annual" },
  { kind: "strategy_review", titleEn: "Annual target setting for 2027", titleAr: "تحديد المستهدفات السنوية لعام 2027", dateFrom: "2026-11-02", dateTo: "2026-11-20", ownerUnitCode: "SPD", linked: { type: "process", ref: "P1.2" }, recurrence: "annual" },
  /* budget cycle */
  { kind: "budget", titleEn: "Budget circular received from the Ministry of Finance", titleAr: "استلام تعميم الموازنة من وزارة المالية", dateFrom: "2026-03-15", ownerUnitCode: "FIN", recurrence: "annual" },
  { kind: "budget", titleEn: "Sector budget submissions to Finance and Administration", titleAr: "تقديم موازنات القطاعات إلى إدارة المالية والشؤون الإدارية", dateFrom: "2026-05-10", dateTo: "2026-05-31", ownerUnitCode: "FIN", linked: { type: "process", ref: "P8.1" }, recurrence: "annual" },
  { kind: "budget", titleEn: "Draft budget submitted to the Ministry of Finance", titleAr: "تقديم مشروع الموازنة إلى وزارة المالية", dateFrom: "2026-08-31", ownerUnitCode: "FIN", recurrence: "annual" },
  { kind: "budget", titleEn: "Budget approval and allocation to sectors", titleAr: "اعتماد الموازنة وتوزيعها على القطاعات", dateFrom: "2026-12-15", ownerUnitCode: "FIN", recurrence: "annual" },
  /* data releases beyond the releases table */
  { kind: "statistical_release", titleEn: "Quarterly Water Balance Release - Q4 2025", titleAr: "نشرة الميزان المائي الفصلية - الربع الرابع 2025", dateFrom: "2026-01-20", ownerUnitCode: "EAS", linked: { type: "process", ref: "P4.3" }, recurrence: "none" },
  { kind: "statistical_release", titleEn: "Quarterly Water Balance Release - Q1 2026", titleAr: "نشرة الميزان المائي الفصلية - الربع الأول 2026", dateFrom: "2026-04-20", ownerUnitCode: "EAS", linked: { type: "process", ref: "P4.3" }, recurrence: "none" },
  { kind: "statistical_release", titleEn: "Quarterly Water Balance Release - Q3 2026", titleAr: "نشرة الميزان المائي الفصلية - الربع الثالث 2026", dateFrom: "2026-10-20", ownerUnitCode: "EAS", linked: { type: "process", ref: "P4.3" }, recurrence: "none" },
  { kind: "statistical_release", titleEn: "Land Cover and Vegetation Monitoring Bulletin - Q4 2025", titleAr: "نشرة رصد الغطاء الأرضي والنباتي - الربع الرابع 2025", dateFrom: "2026-01-14", ownerUnitCode: "DOP", linked: { type: "process", ref: "P4.3" }, recurrence: "none" },
  { kind: "statistical_release", titleEn: "Land Cover and Vegetation Monitoring Bulletin - Q1 2026", titleAr: "نشرة رصد الغطاء الأرضي والنباتي - الربع الأول 2026", dateFrom: "2026-04-14", ownerUnitCode: "DOP", linked: { type: "process", ref: "P4.3" }, recurrence: "none" },
  { kind: "statistical_release", titleEn: "Air Quality Monthly Bulletin", titleAr: "النشرة الشهرية لجودة الهواء", dateFrom: "2026-01-07", ownerUnitCode: "AQD", linked: { type: "process", ref: "P4.3" }, recurrence: "monthly" },
  { kind: "statistical_release", titleEn: "Environmental field survey round 2026: field collection", titleAr: "جولة المسح البيئي الميداني 2026: الجمع الميداني", dateFrom: "2026-03-01", dateTo: "2026-03-31", ownerUnitCode: "DOP", linked: { type: "process", ref: "P4.1" }, recurrence: "none" },
  { kind: "statistical_release", titleEn: "Field survey round 2026: preliminary results", titleAr: "الجولة الميدانية 2026: النتائج الأولية", dateFrom: "2026-09-30", ownerUnitCode: "DOP", linked: { type: "process", ref: "P4.3" }, recurrence: "none" },
  { kind: "statistical_release", titleEn: "Annual Environment Statistical Digest 2025", titleAr: "الموجز الإحصائي البيئي السنوي 2025", dateFrom: "2026-11-15", ownerUnitCode: "DOP", linked: { type: "process", ref: "P4.3" }, recurrence: "annual" },
  /* NES reviews */
  { kind: "nes_review", titleEn: "NES annual progress review", titleAr: "المراجعة السنوية لتقدم الاستراتيجية الوطنية للبيئة", dateFrom: "2026-04-01", dateTo: "2026-04-30", ownerUnitCode: "PMD", linked: { type: "process", ref: "P3.1" }, recurrence: "annual" },
  { kind: "nes_review", titleEn: "NES progress report to the Programme Steering Committee", titleAr: "تقرير تقدم الاستراتيجية الوطنية للبيئة إلى اللجنة التوجيهية للبرنامج", dateFrom: "2026-06-15", ownerUnitCode: "PMD", linked: { type: "report_type", ref: "nes3_progress_public" }, recurrence: "annual" },
  { kind: "nes_review", titleEn: "NES mid-term review launch", titleAr: "إطلاق مراجعة منتصف المدة للاستراتيجية الوطنية للبيئة", dateFrom: "2026-09-01", ownerUnitCode: "SPS", linked: { type: "process", ref: "P3.3" }, recurrence: "none" },
  /* the Steering Committee */
  { kind: "council_meeting", titleEn: "Programme Steering Committee meeting", titleAr: "اجتماع اللجنة التوجيهية للبرنامج", dateFrom: "2026-03-10", ownerUnitCode: "PSA", recurrence: "quarterly" },
  /* forum and other */
  { kind: "forum", titleEn: "Saudi Green Initiative Forum", titleAr: "منتدى مبادرة السعودية الخضراء", dateFrom: "2026-12-08", dateTo: "2026-12-09", ownerUnitCode: "DKS", recurrence: "annual" },
  { kind: "other", titleEn: "Annual operational plan consolidated", titleAr: "توحيد الخطة التشغيلية السنوية", dateFrom: "2026-10-15", ownerUnitCode: "PQS", linked: { type: "process", ref: "P8.1" }, recurrence: "annual" },
];

/** Report deadlines by report type code; the seed skips codes the report_types table does not carry. */
export const REPORT_DEADLINES: { code: string; dateFrom: string; recurrence: "annual" | "quarterly" | "monthly"; ownerUnitCode: string }[] = [
  { code: "org_annual_report", dateFrom: "2026-03-31", recurrence: "annual", ownerUnitCode: "PQS" },
  { code: "nes3_progress_public", dateFrom: "2026-06-30", recurrence: "annual", ownerUnitCode: "PMD" },
  { code: "indices_annual", dateFrom: "2026-10-31", recurrence: "annual", ownerUnitCode: "PAR" },
  { code: "index_forecast_report", dateFrom: "2026-02-15", recurrence: "annual", ownerUnitCode: "PAR" },
  { code: "department_continuity", dateFrom: "2026-12-10", recurrence: "annual", ownerUnitCode: "HR" },
  { code: "statistical_highlights", dateFrom: "2026-01-25", recurrence: "quarterly", ownerUnitCode: "DOP" },
  { code: "council_performance", dateFrom: "2026-01-20", recurrence: "quarterly", ownerUnitCode: "SPD" },
  { code: "leadership_briefing", dateFrom: "2026-01-15", recurrence: "quarterly", ownerUnitCode: "OPD" },
  { code: "lessons_digest_quarterly", dateFrom: "2026-01-30", recurrence: "quarterly", ownerUnitCode: "PMD" },
  { code: "nes3_delivery_monthly", dateFrom: "2026-01-10", recurrence: "monthly", ownerUnitCode: "PMD" },
  { code: "signals_foresight_monthly", dateFrom: "2026-01-08", recurrence: "monthly", ownerUnitCode: "SCN" },
];

/* ------------------------------------------------------------------ */
/* 6. Internal interfaces: unit-to-unit flows                           */
/* ------------------------------------------------------------------ */

export const UNIT_INTERFACES: UnitInterfaceSeed[] = [
  { from: "DOP", to: "WSD", flowKind: "data", descriptionEn: "Indicator series and release tables for the situation analysis", descriptionAr: "سلاسل المؤشرات وجداول الإصدار لتحليل الوضع الراهن", triggerEn: "Planning cycle launch or a new release", triggerAr: "إطلاق دورة التخطيط أو صدور إصدار جديد", cadence: "quarterly", serviceLevel: "Within five working days of the request", processCode: "P1.1", focalFromEmail: "saud.alshammari@enviroai.demo", focalToEmail: "analyst@enviroai.demo" },
  { from: "SCN", to: "WSD", flowKind: "input", descriptionEn: "Foresight briefs and scenario sets feeding the diagnostic", descriptionAr: "موجزات الاستشراف ومجموعات السيناريوهات المغذية للتشخيص", triggerEn: "Diagnostic drafting starts", triggerAr: "بدء صياغة التشخيص", cadence: "per planning cycle", serviceLevel: "Delivered two weeks before drafting", processCode: "P1.1", focalFromEmail: "sultan.alshahrani@enviroai.demo", focalToEmail: "omar.almansour@enviroai.demo" },
  { from: "PMD", to: "WSD", flowKind: "deliverable", descriptionEn: "Evaluation findings of the previous strategy", descriptionAr: "نتائج تقييم الاستراتيجية السابقة", triggerEn: "Evaluation cycle closes", triggerAr: "إغلاق دورة التقييم", cadence: "annual", serviceLevel: "Filed before the cycle launch", processCode: "P3.3", focalFromEmail: "alanoud.alfahad@enviroai.demo", focalToEmail: "shaikha.alharthi@enviroai.demo" },
  { from: "SPD", to: "OPD", flowKind: "approval", descriptionEn: "Consolidated draft strategy for the Programme Director's review", descriptionAr: "مسودة الاستراتيجية الموحدة لمراجعة مدير البرنامج", triggerEn: "Draft consolidated", triggerAr: "اكتمال توحيد المسودة", cadence: "per planning cycle", serviceLevel: "Review within fifteen working days", processCode: "P1.2", focalFromEmail: "lama.alsudairi@enviroai.demo", focalToEmail: "jaber.aldakhil@enviroai.demo" },
  { from: "WSD", to: "SPD", flowKind: "input", descriptionEn: "Water security priorities and theme statements", descriptionAr: "أولويات الأمن المائي وصياغات المحور", triggerEn: "Working group convened", triggerAr: "انعقاد مجموعة العمل", cadence: "per planning cycle", serviceLevel: "Within ten working days", processCode: "P1.2", focalFromEmail: "analyst@enviroai.demo", focalToEmail: "lina.alhazmi@enviroai.demo" },
  { from: "DOP", to: "PAR", flowKind: "data", descriptionEn: "Official environmental data for international index submissions", descriptionAr: "البيانات البيئية الرسمية لتقديمات المؤشرات الدولية", triggerEn: "Publisher deadline approaching", triggerAr: "اقتراب موعد الناشر", cadence: "per index", serviceLevel: "Ten working days before the publisher deadline", processCode: "P7.1", focalFromEmail: "saud.alshammari@enviroai.demo" },
  { from: "AFD", to: "PMD", flowKind: "deliverable", descriptionEn: "Alignment register entries for the follow-up sector", descriptionAr: "قيود سجل المواءمة لقطاع المتابعة", triggerEn: "Alignment opinion issued", triggerAr: "إصدار رأي المواءمة", cadence: "per submission", serviceLevel: "Same day", processCode: "P2.2", focalFromEmail: "amal.alyami@enviroai.demo", focalToEmail: "alanoud.alfahad@enviroai.demo" },
  { from: "PMD", to: "OPD", flowKind: "deliverable", descriptionEn: "Monthly NES delivery report and watch list", descriptionAr: "تقرير تنفيذ الاستراتيجية الوطنية للبيئة الشهري وقائمة المراقبة", triggerEn: "Reporting window closes", triggerAr: "إغلاق نافذة التقارير", cadence: "monthly", serviceLevel: "Five working days after the window closes", processCode: "P3.1", focalFromEmail: "tariq.alsulami@enviroai.demo", focalToEmail: "asma.alajlan@enviroai.demo" },
  { from: "DOP", to: "PMD", flowKind: "data", descriptionEn: "Indicator actuals for the reporting period", descriptionAr: "القيم الفعلية للمؤشرات لفترة التقرير", triggerEn: "Release day", triggerAr: "يوم الإصدار", cadence: "monthly", serviceLevel: "On release day", processCode: "P3.1", focalFromEmail: "mohammed.alqarni@enviroai.demo", focalToEmail: "tariq.alsulami@enviroai.demo" },
  { from: "PMD", to: "ISU", flowKind: "input", descriptionEn: "Watch list of initiatives at risk", descriptionAr: "قائمة المراقبة للمبادرات المعرضة للخطر", triggerEn: "Delivery report issued", triggerAr: "إصدار تقرير التنفيذ", cadence: "monthly", serviceLevel: "Within two working days", processCode: "P3.2", focalFromEmail: "alanoud.alfahad@enviroai.demo" },
  { from: "DSY", to: "DOP", flowKind: "deliverable", descriptionEn: "Electronic forms and field application", descriptionAr: "النماذج الإلكترونية وتطبيق الميدان", triggerEn: "Monitoring protocol signed", triggerAr: "اعتماد بروتوكول الرصد", cadence: "per field round", serviceLevel: "Four weeks before fieldwork", processCode: "P4.1", focalFromEmail: "faisal.alrashid@enviroai.demo", focalToEmail: "abdulrahman.albalawi@enviroai.demo" },
  { from: "DOP", to: "EAS", flowKind: "data", descriptionEn: "Clean dataset with metadata", descriptionAr: "مجموعة البيانات النظيفة مع البيانات الوصفية", triggerEn: "Quality sign-off of the dataset", triggerAr: "اعتماد جودة مجموعة البيانات", cadence: "per field round", serviceLevel: "Within ten working days of field collection close", processCode: "P4.2", focalFromEmail: "abdulrahman.albalawi@enviroai.demo" },
  { from: "DQS", to: "DOP", flowKind: "approval", descriptionEn: "Quality sign-off before release", descriptionAr: "اعتماد الجودة قبل الإصدار", triggerEn: "Release tables ready", triggerAr: "جاهزية جداول الإصدار", cadence: "per release", serviceLevel: "One working day before release", processCode: "P4.3", focalToEmail: "saud.alshammari@enviroai.demo" },
  { from: "DSY", to: "DOP", flowKind: "deliverable", descriptionEn: "Series loaded under embargo in the Data Hub", descriptionAr: "السلاسل المحملة تحت الحظر في مركز البيانات", triggerEn: "Release note ready", triggerAr: "جاهزية ملاحظة الإصدار", cadence: "per release", serviceLevel: "By 08:00 on release day", processCode: "P4.3", focalFromEmail: "noora.almalki@enviroai.demo", focalToEmail: "mohammed.alqarni@enviroai.demo" },
  { from: "EDA", to: "EAS", flowKind: "data", descriptionEn: "Administrative records from entities for compilation", descriptionAr: "السجلات الإدارية من الجهات لأغراض التجميع", triggerEn: "Agreement delivery date", triggerAr: "موعد التسليم في الاتفاقية", cadence: "monthly", serviceLevel: "By the tenth of the month", processCode: "P4.2", focalFromEmail: "sarah.alanazi@enviroai.demo" },
  { from: "DGS", to: "EDA", flowKind: "review", descriptionEn: "Classification decision and access controls for a new dataset", descriptionAr: "قرار التصنيف وضوابط الوصول لمجموعة بيانات جديدة", triggerEn: "New dataset proposed", triggerAr: "اقتراح مجموعة بيانات جديدة", cadence: "per dataset", serviceLevel: "Within five working days", processCode: "P5.1", focalToEmail: "nouf.almutairi@enviroai.demo" },
  { from: "EDA", to: "DIG", flowKind: "input", descriptionEn: "Access provisioning requests under signed agreements", descriptionAr: "طلبات تهيئة الوصول بموجب الاتفاقيات الموقعة", triggerEn: "Agreement approved", triggerAr: "اعتماد الاتفاقية", cadence: "per agreement", serviceLevel: "Provisioned within three working days", processCode: "P5.2", focalFromEmail: "sarah.alanazi@enviroai.demo", focalToEmail: "sara.alansari@enviroai.demo" },
  { from: "FRS", to: "SPD", flowKind: "deliverable", descriptionEn: "Quarterly risk brief for the Strategy Steering Committee", descriptionAr: "موجز المخاطر الربعي للجنة توجيه الاستراتيجية", triggerEn: "Quarter end", triggerAr: "نهاية الربع", cadence: "quarterly", serviceLevel: "Ten working days after quarter end", processCode: "P6.3", focalFromEmail: "rawan.alzamil@enviroai.demo", focalToEmail: "lama.alsudairi@enviroai.demo" },
  { from: "SCN", to: "OPD", flowKind: "deliverable", descriptionEn: "Monthly signals and foresight brief for the Executive Committee of the Office", descriptionAr: "موجز الإشارات والاستشراف الشهري للجنة التنفيذية للمكتب", triggerEn: "Month end", triggerAr: "نهاية الشهر", cadence: "monthly", serviceLevel: "By the eighth of the month", processCode: "P6.1", focalFromEmail: "sultan.alshahrani@enviroai.demo", focalToEmail: "asma.alajlan@enviroai.demo" },
  { from: "HR", to: "DIG", flowKind: "input", descriptionEn: "Access revocation on completed handovers", descriptionAr: "إلغاء الصلاحيات عند اكتمال التسليم", triggerEn: "Handover signed off", triggerAr: "اعتماد التسليم", cadence: "per handover", serviceLevel: "Same day", processCode: "P8.2", focalToEmail: "ali.alruhaili@enviroai.demo" },
];

/* ------------------------------------------------------------------ */
/* 7. External interfaces: ten entities from the register               */
/* ------------------------------------------------------------------ */

export const ENTITY_INTERFACES: EntityInterfaceSeed[] = [
  { entityShort: "MEWA", providesEn: "Water, agriculture and environment sector data, the NES theme priorities and alignment opinions on the sector strategies", providesAr: "بيانات قطاعات المياه والزراعة والبيئة وأولويات محاور الاستراتيجية الوطنية للبيئة وآراء المواءمة على الاستراتيجيات القطاعية", receivesEn: "Compiled indicators, delivery reports and the regulatory change brief", receivesAr: "المؤشرات المجمعة وتقارير التنفيذ وموجز التغييرات التنظيمية", focalOrgUnitCode: "SPD", focalEntityName: "Director of Strategic Planning", legalBasisEn: "Data-sharing agreement and partnership arrangement (illustrative)", legalBasisAr: "اتفاقية تبادل بيانات وترتيب شراكة (توضيحي)", cadence: "monthly", processCodes: ["P2.2", "P3.1", "P5.2"] },
  { entityShort: "NCEC", providesEn: "Compliance and permitting records and the status of environmental regulations", providesAr: "سجلات الامتثال والتراخيص وحالة التنظيمات البيئية", receivesEn: "Environmental indicators and monitoring data relevant to compliance", receivesAr: "المؤشرات البيئية وبيانات الرصد ذات الصلة بالامتثال", focalOrgUnitCode: "RCM", focalEntityName: "Director of Compliance Information", legalBasisEn: "Data-sharing agreement on compliance records (illustrative)", legalBasisAr: "اتفاقية تبادل بيانات سجلات الامتثال (توضيحي)", cadence: "monthly", processCodes: ["P2.2", "P4.2", "P5.1"] },
  { entityShort: "NCW", providesEn: "Wildlife and protected area records and biodiversity monitoring data", providesAr: "سجلات الحياة الفطرية والمناطق المحمية وبيانات رصد التنوع الأحيائي", receivesEn: "Compiled biodiversity indicators and scenario outputs", receivesAr: "مؤشرات التنوع الأحيائي المجمعة ومخرجات السيناريوهات", focalOrgUnitCode: "BLD", focalEntityName: "Director of Biodiversity Information", legalBasisEn: "Data-sharing agreement on biodiversity records (illustrative)", legalBasisAr: "اتفاقية تبادل بيانات سجلات التنوع الأحيائي (توضيحي)", cadence: "quarterly", processCodes: ["P4.1", "P4.2"] },
  { entityShort: "NCVC", providesEn: "Vegetation cover, rangeland and desertification monitoring data", providesAr: "بيانات رصد الغطاء النباتي والمراعي والتصحر", receivesEn: "Land cover bulletins and remote sensing products", receivesAr: "نشرات الغطاء الأرضي ومنتجات الاستشعار عن بعد", focalOrgUnitCode: "BLD", focalEntityName: "Director of Vegetation Monitoring", legalBasisEn: "Data-sharing agreement on vegetation records (illustrative)", legalBasisAr: "اتفاقية تبادل بيانات سجلات الغطاء النباتي (توضيحي)", cadence: "quarterly", processCodes: ["P4.1", "P4.2"] },
  { entityShort: "MWAN", providesEn: "Waste generation, treatment and recycling records and the waste strategy indicators", providesAr: "سجلات توليد النفايات ومعالجتها وإعادة تدويرها ومؤشرات استراتيجية النفايات", receivesEn: "Compiled waste and circular economy indicators", receivesAr: "مؤشرات النفايات والاقتصاد الدائري المجمعة", focalOrgUnitCode: "WCD", focalEntityName: "Director of Waste Information", legalBasisEn: "Data-sharing agreement on waste records (illustrative)", legalBasisAr: "اتفاقية تبادل بيانات سجلات النفايات (توضيحي)", cadence: "quarterly", processCodes: ["P4.2", "P5.2"] },
  { entityShort: "GASTAT", providesEn: "Official statistics, classifications and the national statistical standards used in the Data Hub", providesAr: "الإحصاءات الرسمية والتصنيفات والمعايير الإحصائية الوطنية المستخدمة في مركز البيانات", receivesEn: "Environmental accounts and indicator series for the national statistical system", receivesAr: "الحسابات البيئية وسلاسل المؤشرات للمنظومة الإحصائية الوطنية", focalOrgUnitCode: "EAS", focalEntityName: "Director of Statistical Coordination", legalBasisEn: "Statistical cooperation arrangement (illustrative)", legalBasisAr: "ترتيب تعاون إحصائي (توضيحي)", cadence: "quarterly", processCodes: ["P4.2", "P5.1"] },
  { entityShort: "SDAIA", providesEn: "Data governance guidance, national data standards and the open data platform services", providesAr: "إرشادات حوكمة البيانات والمعايير الوطنية للبيانات وخدمات منصة البيانات المفتوحة", receivesEn: "Dataset catalogue entries and open data publications of the Office", receivesAr: "مدخلات فهرس البيانات والمنشورات المفتوحة للمكتب", focalOrgUnitCode: "DGS", focalEntityName: "Director of Data Governance", legalBasisEn: "Memorandum of understanding on data governance (illustrative)", legalBasisAr: "مذكرة تفاهم بشأن حوكمة البيانات (توضيحي)", cadence: "semi-annual", processCodes: ["P5.1", "P5.2"] },
  { entityShort: "NWC", providesEn: "Water supply, demand and network performance data", providesAr: "بيانات إمدادات المياه والطلب وأداء الشبكات", receivesEn: "Water balance releases and water demand scenarios", receivesAr: "نشرات الميزان المائي وسيناريوهات الطلب على المياه", focalOrgUnitCode: "WSD", focalEntityName: "Director of Planning and Performance", legalBasisEn: "Data-sharing agreement on water records (illustrative)", legalBasisAr: "اتفاقية تبادل بيانات سجلات المياه (توضيحي)", cadence: "monthly", processCodes: ["P4.2", "P6.2"] },
  { entityShort: "Environment Fund", providesEn: "Funding programme records and project results for the environment sector", providesAr: "سجلات برامج التمويل ونتائج المشاريع لقطاع البيئة", receivesEn: "Delivery reports and evaluation findings on funded initiatives", receivesAr: "تقارير التنفيذ ونتائج التقييم للمبادرات الممولة", focalOrgUnitCode: "PMD", focalEntityName: "Director of Programmes", legalBasisEn: "Partnership arrangement (illustrative)", legalBasisAr: "ترتيب شراكة (توضيحي)", cadence: "semi-annual", processCodes: ["P3.1", "P3.3"] },
  { entityShort: "World Bank", providesEn: "Global data submissions benchmarks and methodology guidance for international indicators", providesAr: "مقارنات تقديم البيانات العالمية والإرشادات المنهجية للمؤشرات الدولية", receivesEn: "National data submissions and questionnaire responses", receivesAr: "تقديمات البيانات الوطنية وردود الاستبيانات", focalOrgUnitCode: "PAR", focalEntityName: "Country Economist", legalBasisEn: "Statistical cooperation arrangement (illustrative)", legalBasisAr: "ترتيب التعاون الإحصائي (توضيحي)", cadence: "annual", processCodes: ["P7.1", "P7.2"] },
];

/* ------------------------------------------------------------------ */
/* 8. Operational KPIs with their 2026 history                          */
/* ------------------------------------------------------------------ */

export const OPS_KPIS: OpsKpiSeed[] = [
  { code: "release_timeliness", nameEn: "Data release timeliness", nameAr: "الالتزام بمواعيد إصدار البيانات", unit: "percent", direction: "up_good", sourceKind: "manual", target: 95, values: [92, 94, 91, 95, 96, 93, 95, 97, 96] },
  { code: "data_request_turnaround", nameEn: "Data request turnaround", nameAr: "زمن الاستجابة لطلبات البيانات", unit: "days", direction: "down_good", sourceKind: "manual", target: 10, values: [12.5, 11.8, 11.2, 10.6, 10.9, 10.1, 9.8, 9.6, 9.9] },
  { code: "strategy_review_completion", nameEn: "Strategy review completion", nameAr: "إنجاز مراجعات الاستراتيجية", unit: "percent", direction: "up_good", sourceKind: "manual", target: 90, values: [86, 88, 88, 90, 92, 92, 93, 94, 94] },
  { code: "handover_completion", nameEn: "Handover completion", nameAr: "اكتمال تسليم المهام", unit: "percent", direction: "up_good", sourceKind: "auto", target: 90, values: [71, 75, 78, 80, 82, 80, 76, 73, 73] },
  { code: "policy_review_currency", nameEn: "Policy review currency", nameAr: "حداثة مراجعة السياسات", unit: "percent", direction: "up_good", sourceKind: "auto", target: 90, values: [100, 100, 100, 100, 100, 100, 100, 86, 86] },
];
