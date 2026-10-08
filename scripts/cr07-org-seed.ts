/* eslint-disable no-console */
// CR07 3.3: seeds the organisation from the illustrative Programme Office
// structure in scripts/data/org-structure-ksa.ts (37 units, fictional heads).
//
// The ten placeholder departments of the original seed are REWRITTEN IN PLACE
// onto their new counterparts, so their ids survive and every reference that
// already points at them (users, documents, node leads, the HR rows,
// stakeholders and indicators) keeps working with no data migration at all.
// The remaining units are inserted.
//
// Run standalone (npx tsx scripts/cr07-org-seed.ts) or from seed.ts block 12g.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { and, eq, inArray, isNull } from "drizzle-orm";
import { ulid } from "ulid";
import { ORG_STRUCTURE_KSA, type OrgUnitJson } from "./data/org-structure-ksa";

const now = () => new Date().toISOString();

/** The original seed's ten department codes mapped onto the new units. */
export const PLACEHOLDER_TO_REAL: Record<string, string> = {
  econ_planning: "WSD", // Water Security
  foresight_risk: "FRS", // Foresight and Risk
  it_dept: "DIG", // Digital
  monitoring_eval: "PMD", // Programme Monitoring
  national_data: "EDA", // Environmental Data Affairs
  planning_policies: "SPD", // Strategy Development
  sg_office: "OPD", // Office of the Programme Director
  social_planning: "AFD", // Agriculture and Food Security
  stat_operations: "DOP", // Data Operations
  stat_systems: "DSY", // Data Systems
};

/** CR07 2.1: the Strategy Office that owns the Programme Strategy. */
export const STRATEGY_OFFICE_CODE = "SPD";

/** The structure page renders carousel arrows next to some cards; a head name
    has to read like a name, not a glyph. */
function cleanName(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length < 3) return null;
  const letters = trimmed.replace(/[^A-Za-z؀-ۿ]/g, "");
  return letters.length >= 3 ? trimmed : null;
}

/** Loose name match so "Dr. Noura Al-Qahtani" finds the user named Noura Al-Qahtani. */
function normaliseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(h\.?e\.?|dr\.?|mr\.?|ms\.?|mrs\.?|eng\.?|sheikh|sheikha)\b/g, "")
    .replace(/[^a-z؀-ۿ]/g, "");
}

export async function seedCr07Org(): Promise<{ mapping: string[]; units: number }> {
  const { db, schema } = await import("../src/server/db/client");

  const units = ORG_STRUCTURE_KSA.units;

  /* 1. everyone who could be a unit head */
  const users = await db.select().from(schema.users);
  const alive = users.filter((u) => !u.deletedAt);
  const byName = new Map<string, (typeof alive)[number]>();
  for (const u of alive) {
    byName.set(normaliseName(u.nameEn), u);
    byName.set(normaliseName(u.nameAr), u);
  }
  const matchHead = (en: string | null, ar: string | null) => {
    for (const candidate of [en, ar]) {
      if (!candidate) continue;
      const hit = byName.get(normaliseName(candidate));
      if (hit) return hit;
    }
    return null;
  };

  /* 2. rewrite the placeholders in place, insert the rest */
  const existing = await db.select().from(schema.orgUnits);
  const existingByCode = new Map(existing.map((d) => [d.code, d]));
  const realToExistingId = new Map<string, string>();
  for (const [placeholder, real] of Object.entries(PLACEHOLDER_TO_REAL)) {
    const row = existingByCode.get(placeholder);
    if (row) realToExistingId.set(real, row.id);
  }
  // a rerun finds the real codes already in place
  for (const u of existing) {
    if (!realToExistingId.has(u.code)) realToExistingId.set(u.code, u.id);
  }

  const mapping: string[] = [];
  const idOfCode = new Map<string, string>();
  for (const u of units) {
    const headUser = matchHead(cleanName(u.head_name_en), cleanName(u.head_name_ar));
    const shared = {
      code: u.code,
      nameEn: u.name_en,
      nameAr: u.name_ar,
      level: u.level,
      mandateEn: u.mandate_en || null,
      mandateAr: u.mandate_ar || null,
      mandateSourceUrl: u.source_url,
      mandateSourceUrlAr: u.source_url_ar,
      mandateFetchedAt: u.fetched_at,
      headNameEn: cleanName(u.head_name_en),
      headNameAr: cleanName(u.head_name_ar),
      headTitleEn: cleanName(u.head_title_en),
      headTitleAr: cleanName(u.head_title_ar),
      sort: u.sort,
      isActive: 1,
      updatedAt: now(),
    };
    const reuseId = realToExistingId.get(u.code);
    if (reuseId) {
      await db
        .update(schema.orgUnits)
        .set({ ...shared, ...(headUser ? { headUserId: headUser.id } : {}) })
        .where(eq(schema.orgUnits.id, reuseId));
      idOfCode.set(u.code, reuseId);
      const wasPlaceholder = Object.entries(PLACEHOLDER_TO_REAL).find(([, real]) => real === u.code);
      if (wasPlaceholder && existingByCode.has(wasPlaceholder[0])) {
        mapping.push(
          `${wasPlaceholder[0]} (${existingByCode.get(wasPlaceholder[0])!.nameEn}) -> ${u.code} (${u.name_en})`
        );
      }
    } else {
      const id = ulid();
      await db.insert(schema.orgUnits).values({
        id,
        ...shared,
        descriptionEn: null,
        descriptionAr: null,
        headUserId: headUser?.id ?? null,
        parentId: null,
        responsibilitiesEn: null,
        responsibilitiesAr: null,
        keyProjectsNote: null,
        createdAt: now(),
      });
      idOfCode.set(u.code, id);
    }
  }

  /* 3. wire the hierarchy now every unit has an id */
  for (const u of units) {
    const id = idOfCode.get(u.code);
    if (!id) continue;
    await db
      .update(schema.orgUnits)
      .set({ parentId: u.parent_code ? idOfCode.get(u.parent_code) ?? null : null })
      .where(eq(schema.orgUnits.id, id));
  }

  /* 4. members from the employee records, heads first */
  const unitRows = await db.select().from(schema.orgUnits);
  const memberRows = await db.select().from(schema.orgUnitMembers);
  const haveMember = new Set(memberRows.map((m) => `${m.unitId}:${m.userId}`));
  let members = 0;
  for (const u of unitRows) {
    const staff = alive.filter((s) => s.departmentId === u.id);
    for (const s of staff) {
      if (haveMember.has(`${u.id}:${s.id}`)) continue;
      await db.insert(schema.orgUnitMembers).values({
        id: ulid(),
        unitId: u.id,
        userId: s.id,
        roleInUnit: u.headUserId === s.id ? "head" : "member",
        since: "2024-01-01",
        createdAt: now(),
      });
      members++;
    }
  }

  console.log(
    `cr07 org: ${units.length} units published, ${mapping.length} placeholders rewritten in place, ${members} memberships`
  );
  for (const line of mapping) console.log(`  ${line}`);
  return { mapping, units: units.length };
}

/* ------------------------------------------------------------------ */
/* CR07 0.1 + 3.3: the unit pages join the Vault so Ask EnviroAI cites  */
/* the mandate it quotes.                                              */
/* ------------------------------------------------------------------ */

/** CR07 3.2 and 3.5 add the knowledge types the Organisation module needs. */
export const CR07_KNOWLEDGE_TYPES: { code: string; en: string; ar: string }[] = [
  { code: "reference", en: "Reference", ar: "مرجع" },
  { code: "policy_internal", en: "Internal Policy", ar: "سياسة داخلية" },
  { code: "procedure", en: "Procedure", ar: "إجراء" },
  { code: "form_template", en: "Form or Template", ar: "نموذج أو قالب" },
  { code: "service", en: "Service", ar: "خدمة" },
];

export async function seedCr07KnowledgeTypes(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const [dimension] = await db
    .select()
    .from(schema.taxonomyDimensions)
    .where(eq(schema.taxonomyDimensions.code, "knowledge_type"))
    .limit(1);
  if (!dimension) return;
  const terms = await db
    .select()
    .from(schema.taxonomyTerms)
    .where(eq(schema.taxonomyTerms.dimensionId, dimension.id));
  const have = new Set(terms.map((t) => t.code));
  let sort = terms.length;
  let added = 0;
  for (const type of CR07_KNOWLEDGE_TYPES) {
    if (have.has(type.code)) continue;
    await db.insert(schema.taxonomyTerms).values({
      id: ulid(),
      dimensionId: dimension.id,
      code: type.code,
      nameEn: type.en,
      nameAr: type.ar,
      parentId: null,
      sort: sort++,
      isActive: 1,
    });
    added++;
  }
  if (added) console.log(`cr07 org: ${added} knowledge types added`);
}

/** Ingests the organisational structure pages and every unit page into the
    Vault as reference documents, linked to their unit. */
export async function seedCr07OrgDocuments(): Promise<number> {
  const { db, schema } = await import("../src/server/db/client");
  const { putText } = await import("../src/server/storage");
  const { runIngest } = await import("../src/server/ingest/pipeline");

  const payload = ORG_STRUCTURE_KSA;
  const [dimension] = await db
    .select()
    .from(schema.taxonomyDimensions)
    .where(eq(schema.taxonomyDimensions.code, "knowledge_type"))
    .limit(1);
  const terms = dimension
    ? await db
        .select()
        .from(schema.taxonomyTerms)
        .where(eq(schema.taxonomyTerms.dimensionId, dimension.id))
    : [];
  const referenceTermId = terms.find((t) => t.code === "reference")?.id ?? null;
  const [owner] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, "knowledge@enviroai.demo"))
    .limit(1);
  const unitRows = await db.select().from(schema.orgUnits);
  const unitByCode = new Map(unitRows.map((u) => [u.code, u]));

  let made = 0;
  for (const u of payload.units) {
    const unit = unitByCode.get(u.code);
    if (!unit) continue;
    const sourceRef = `enviroai.demo organisational structure: ${u.code}`;
    const [already] = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.sourceRef, sourceRef))
      .limit(1);
    if (already) continue;

    const body = [
      `${u.name_en}`,
      `${u.name_ar}`,
      "",
      `Level: ${u.level}`,
      `Source: ${u.source_url || "illustrative"}`,
      `Authority: ${payload.authority}`,
      `Fetched: ${u.fetched_at}`,
      u.head_name_en ? `Head: ${u.head_name_en} (${u.head_title_en ?? ""})` : "",
      u.head_name_ar ? `رئيس الوحدة: ${u.head_name_ar} (${u.head_title_ar ?? ""})` : "",
      "",
      "Responsibilities and functions (English, illustrative)",
      u.mandate_en,
      "",
      "المسؤوليات والاختصاصات (توضيحية)",
      u.mandate_ar,
    ]
      .filter(Boolean)
      .join("\n");

    const documentId = ulid();
    const storagePath = await putText(documentId, `org-unit-${u.code}.txt`, body);
    await db.insert(schema.documents).values({
      id: documentId,
      titleEn: `${u.name_en}: mandate and responsibilities`,
      titleAr: `${u.name_ar}: المسؤوليات والاختصاصات`,
      titleArMachine: 0,
      summaryEn: `The illustrative mandate of ${u.name_en} at the Programme Office, as recorded in the demonstration organisational structure.`,
      summaryAr: `الاختصاصات التوضيحية لـ ${u.name_ar} في مكتب البرنامج، كما وردت في الهيكل التنظيمي التجريبي.`,
      summaryMachine: 0,
      knowledgeTypeTermId: referenceTermId,
      classificationLevel: 1,
      departmentId: unit.id,
      ownerUserId: owner?.id ?? null,
      languageOriginal: "mixed",
      status: "verified",
      verifiedBy: owner?.id ?? null,
      verifiedAt: now(),
      sourceOrigin: "org",
      publishYear: 2024,
      originalFilename: `org-unit-${u.code}.txt`,
      mime: "text/plain",
      sizeBytes: Buffer.byteLength(body, "utf8"),
      pageCount: 1,
      storagePath,
      visibilityScope: "all_staff",
      isSeeded: 1,
      sourceRef,
      createdAt: now(),
      updatedAt: now(),
    });
    await db.insert(schema.documentUnitLinks).values({
      id: ulid(),
      documentId,
      unitId: unit.id,
      createdAt: now(),
    });
    try {
      await runIngest(documentId, { skipEmbed: process.env.SKIP_EMBED === "1" });
    } catch (e) {
      console.warn(`  ingest failed for ${u.code}: ${(e as Error).message}`);
    }
    made++;
  }
  console.log(`cr07 org: ${made} unit reference documents ingested into the Vault`);
  return made;
}

/* ------------------------------------------------------------------ */
/* CR07 3.5: a small, honest set of policies so the visibility model    */
/* can be seen and tested. Every other unit keeps its empty state.      */
/* ------------------------------------------------------------------ */

type PolicySeed = {
  unitCode: string;
  type: "policy_internal" | "procedure" | "form_template" | "service";
  titleEn: string;
  titleAr: string;
  summaryEn: string;
  summaryAr: string;
  visibility: "all_staff" | "unit_only" | "restricted";
  versionLabel: string;
  effectiveFrom: string;
  reviewCycleMonths: number;
  classification: number;
  bodyEn: string[];
  bodyAr: string[];
};

const POLICY_SEEDS: PolicySeed[] = [
  {
    unitCode: "HR",
    type: "policy_internal",
    titleEn: "Remote and flexible working policy",
    titleAr: "سياسة العمل عن بعد والعمل المرن",
    summaryEn:
      "How employees of the Office request, approve and record remote or flexible working days, and the responsibilities of the line manager.",
    summaryAr:
      "كيف يطلب موظفو المكتب أيام العمل عن بعد أو العمل المرن ويحصلون على الموافقة ويوثقونها، ومسؤوليات المدير المباشر.",
    visibility: "all_staff",
    versionLabel: "v2.0",
    effectiveFrom: "2026-01-01",
    reviewCycleMonths: 24,
    classification: 1,
    bodyEn: [
      "Scope: all employees of the Office on permanent and fixed term contracts.",
      "An employee may request up to two remote days a week through the digital workplace.",
      "The line manager records the decision within three working days.",
      "Remote days do not change the employee's core hours or their obligation to attend scheduled meetings.",
      "The Human Resources Department reports quarterly on uptake by unit.",
    ],
    bodyAr: [
      "النطاق: جميع موظفي الأمانة العامة على العقود الدائمة والمحددة المدة.",
      "يجوز للموظف طلب يومين للعمل عن بعد أسبوعياً عبر بيئة العمل الرقمية.",
      "يسجل المدير المباشر القرار خلال ثلاثة أيام عمل.",
      "لا تغير أيام العمل عن بعد ساعات العمل الأساسية ولا التزام الموظف بحضور الاجتماعات المقررة.",
      "ترفع إدارة الموارد البشرية تقريراً ربع سنوي عن نسب الاستفادة حسب الوحدة.",
    ],
  },
  {
    unitCode: "HR",
    type: "form_template",
    titleEn: "Knowledge handover checklist template",
    titleAr: "نموذج قائمة تسليم المعرفة",
    summaryEn:
      "The template a departing employee and their manager complete so ownership of documents, systems and relationships transfers cleanly.",
    summaryAr:
      "النموذج الذي يستكمله الموظف المغادر ومديره لضمان انتقال ملكية الوثائق والأنظمة والعلاقات بشكل سليم.",
    visibility: "all_staff",
    versionLabel: "v1.3",
    effectiveFrom: "2025-09-01",
    reviewCycleMonths: 12,
    classification: 1,
    bodyEn: [
      "Section 1: documents owned, with their location and the receiving colleague.",
      "Section 2: systems and access to be transferred or revoked.",
      "Section 3: external relationships and standing commitments.",
      "Section 4: work in progress and its agreed landing point.",
      "Section 5: sign off by the employee, the manager and the Human Resources Department.",
    ],
    bodyAr: [
      "القسم الأول: الوثائق المملوكة وأماكنها والزميل المستلم.",
      "القسم الثاني: الأنظمة والصلاحيات المطلوب نقلها أو إلغاؤها.",
      "القسم الثالث: العلاقات الخارجية والالتزامات القائمة.",
      "القسم الرابع: الأعمال قيد التنفيذ ونقطة تسليمها المتفق عليها.",
      "القسم الخامس: اعتماد الموظف والمدير وإدارة الموارد البشرية.",
    ],
  },
  {
    unitCode: "DGS",
    type: "policy_internal",
    titleEn: "Information classification and handling policy",
    titleAr: "سياسة تصنيف المعلومات والتعامل معها",
    summaryEn:
      "The four classification levels used across the Office, who may assign them, and the handling rules for each level.",
    summaryAr:
      "مستويات تصنيف المعلومات الأربعة المعتمدة في المكتب، ومن يملك صلاحية تحديدها، وقواعد التعامل مع كل مستوى.",
    visibility: "all_staff",
    versionLabel: "v3.1",
    effectiveFrom: "2026-03-01",
    reviewCycleMonths: 12,
    classification: 2,
    bodyEn: [
      "Level 1 Public: cleared for publication on the Office public channels.",
      "Level 2 Internal: available to all employees of the Office.",
      "Level 3 Confidential: available to named recipients and their unit head.",
      "Level 4 Restricted: available only to the Programme Director and named recipients.",
      "The owner of a document assigns its level; the Data Governance and Security Department audits a sample each quarter.",
    ],
    bodyAr: [
      "المستوى الأول عام: معتمد للنشر على الموقع الرسمي.",
      "المستوى الثاني داخلي: متاح لجميع موظفي المكتب.",
      "المستوى الثالث سري: متاح للمستلمين المحددين ورئيس وحدتهم.",
      "المستوى الرابع مقيد: متاح للأمين العام والمستلمين المحددين فقط.",
      "يحدد مالك الوثيقة مستواها، وتدقق إدارة أمن المعلومات عينة كل ربع سنة.",
    ],
  },
  {
    unitCode: "DGS",
    type: "procedure",
    titleEn: "Security incident reporting procedure",
    titleAr: "إجراء الإبلاغ عن حوادث أمن المعلومات",
    summaryEn:
      "The steps and timings for reporting, triaging and closing an information security incident, including the escalation path.",
    summaryAr:
      "خطوات وتوقيتات الإبلاغ عن حوادث أمن المعلومات وفرزها وإغلاقها، بما في ذلك مسار التصعيد.",
    visibility: "unit_only",
    versionLabel: "v1.0",
    effectiveFrom: "2026-02-15",
    reviewCycleMonths: 6,
    classification: 3,
    bodyEn: [
      "Step 1: report within one hour of discovery through the incident line.",
      "Step 2: the duty officer triages within two hours and assigns a severity.",
      "Step 3: severity one and two incidents escalate to the Programme Director the same day.",
      "Step 4: containment actions are logged as they are taken, not afterwards.",
      "Step 5: a closure note with the root cause is filed within ten working days.",
    ],
    bodyAr: [
      "الخطوة الأولى: الإبلاغ خلال ساعة من اكتشاف الحادث عبر خط البلاغات.",
      "الخطوة الثانية: يفرز ضابط المناوبة البلاغ خلال ساعتين ويحدد درجة الخطورة.",
      "الخطوة الثالثة: تصعد حوادث الدرجتين الأولى والثانية إلى مدير البرنامج في اليوم نفسه.",
      "الخطوة الرابعة: توثق إجراءات الاحتواء أثناء تنفيذها لا بعده.",
      "الخطوة الخامسة: يرفع تقرير إغلاق يتضمن السبب الجذري خلال عشرة أيام عمل.",
    ],
  },
  {
    unitCode: "DOP",
    type: "procedure",
    titleEn: "Data release and revision procedure",
    titleAr: "إجراء إصدار البيانات ومراجعتها",
    summaryEn:
      "How a data product moves from production to release, the pre-announced calendar, and how revisions are published.",
    summaryAr:
      "كيف ينتقل منتج البيانات من الإنتاج إلى النشر، والتقويم المعلن مسبقاً، وكيفية نشر المراجعات.",
    visibility: "all_staff",
    versionLabel: "v2.2",
    effectiveFrom: "2026-01-15",
    reviewCycleMonths: 12,
    classification: 1,
    bodyEn: [
      "Release dates are published at least three months ahead and are not moved without the approval of the Head of the Data and Knowledge Sector.",
      "Quality checks are signed off by the Data Quality and Standards Department before any figure leaves the building.",
      "Pre-release access is limited to the named list held by the Data Operations Department.",
      "A revision is published with a note stating what changed and why.",
    ],
    bodyAr: [
      "تعلن مواعيد الإصدار قبل ثلاثة أشهر على الأقل ولا تعدل إلا بموافقة رئيس قطاع البيانات والمعرفة.",
      "تعتمد إدارة جودة البيانات والمعايير فحوص الجودة قبل خروج أي رقم.",
      "يقتصر الاطلاع المسبق على القائمة المعتمدة لدى إدارة عمليات البيانات.",
      "تنشر المراجعة مصحوبة بملاحظة توضح ما تغير وسببه.",
    ],
  },
  {
    unitCode: "DOP",
    type: "service",
    titleEn: "Data request service for government entities",
    titleAr: "خدمة طلب البيانات للجهات الحكومية",
    summaryEn:
      "The service a government entity uses to request environmental data that is not published, with turnaround times and the required approvals.",
    summaryAr:
      "الخدمة التي تستخدمها الجهات الحكومية لطلب بيانات بيئية غير منشورة، مع أزمنة الاستجابة والموافقات المطلوبة.",
    visibility: "all_staff",
    versionLabel: "v1.1",
    effectiveFrom: "2025-11-01",
    reviewCycleMonths: 12,
    classification: 1,
    bodyEn: [
      "Who may request: an authorised officer of a government entity.",
      "Turnaround: ten working days for published aggregates, twenty for new tabulations.",
      "Requests for record level data require a confidentiality undertaking and the approval of the Head of the Data and Knowledge Sector.",
      "Requests and their outcomes are logged and reported in the Annual Environment Statistical Digest (illustrative).",
    ],
    bodyAr: [
      "من يحق له الطلب: مسؤول مفوض من جهة حكومية.",
      "زمن الاستجابة: عشرة أيام عمل للتجميعات المنشورة وعشرون يوماً للجداول الجديدة.",
      "تتطلب طلبات البيانات التفصيلية تعهد سرية وموافقة رئيس قطاع البيانات والمعرفة.",
      "تسجل الطلبات ونتائجها وترفع في ملخص الإحصاءات البيئية السنوي (توضيحي).",
    ],
  },
  {
    unitCode: "SPD",
    type: "policy_internal",
    titleEn: "Strategy change control policy",
    titleAr: "سياسة ضبط التغيير على الاستراتيجية",
    summaryEn:
      "Who may change a goal, an indicator target or a project in the Programme Strategy, and the record each change must leave.",
    summaryAr:
      "من يملك صلاحية تعديل هدف أو مستهدف مؤشر أو مشروع في الاستراتيجية المؤسسية، والسجل الذي يجب أن يتركه كل تغيير.",
    visibility: "restricted",
    versionLabel: "v1.0",
    effectiveFrom: "2026-04-01",
    reviewCycleMonths: 12,
    classification: 3,
    bodyEn: [
      "Goals and intermediate outcomes change only by decision of the Strategy Steering Committee.",
      "Indicator targets change only at the annual review, with the reason recorded in the change log.",
      "Project scope and budget changes are approved by the owning unit head and recorded within five working days.",
      "Every change carries the name of the person who made it and the date.",
    ],
    bodyAr: [
      "لا تعدل الأهداف والنتائج الوسيطة إلا بقرار من لجنة توجيه الاستراتيجية.",
      "لا تعدل مستهدفات المؤشرات إلا في المراجعة السنوية مع تسجيل السبب في سجل التغيير.",
      "يعتمد رئيس الوحدة المالكة تغييرات نطاق المشروع وميزانيته وتسجل خلال خمسة أيام عمل.",
      "يحمل كل تغيير اسم من أجراه وتاريخه.",
    ],
  },
];

export async function seedCr07Policies(): Promise<number> {
  const { db, schema } = await import("../src/server/db/client");
  const { putText } = await import("../src/server/storage");
  const { runIngest } = await import("../src/server/ingest/pipeline");

  const [dimension] = await db
    .select()
    .from(schema.taxonomyDimensions)
    .where(eq(schema.taxonomyDimensions.code, "knowledge_type"))
    .limit(1);
  const terms = dimension
    ? await db
        .select()
        .from(schema.taxonomyTerms)
        .where(eq(schema.taxonomyTerms.dimensionId, dimension.id))
    : [];
  const termId = (code: string) => terms.find((t) => t.code === code)?.id ?? null;
  const unitRows = await db.select().from(schema.orgUnits);
  const unitByCode = new Map(unitRows.map((u) => [u.code, u]));
  const users = await db.select().from(schema.users).where(isNull(schema.users.deletedAt));
  const superAdmin = users.find((u) => u.email === "admin@enviroai.demo");

  let made = 0;
  for (const p of POLICY_SEEDS) {
    const unit = unitByCode.get(p.unitCode);
    if (!unit) continue;
    const sourceRef = `cr07 policy: ${p.unitCode}/${p.type}/${p.versionLabel}`;
    const [already] = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.sourceRef, sourceRef))
      .limit(1);
    if (already) continue;

    const head = unit.headUserId ? users.find((u) => u.id === unit.headUserId) : null;
    const body = [
      p.titleEn,
      p.titleAr,
      "",
      `Version ${p.versionLabel}, effective ${p.effectiveFrom}, reviewed every ${p.reviewCycleMonths} months.`,
      "",
      ...p.bodyEn.map((line, i) => `${i + 1}. ${line}`),
      "",
      ...p.bodyAr.map((line, i) => `${i + 1}. ${line}`),
    ].join("\n");
    const documentId = ulid();
    const storagePath = await putText(documentId, `${p.type}-${p.unitCode}.txt`, body);
    await db.insert(schema.documents).values({
      id: documentId,
      titleEn: p.titleEn,
      titleAr: p.titleAr,
      titleArMachine: 0,
      summaryEn: p.summaryEn,
      summaryAr: p.summaryAr,
      summaryMachine: 0,
      knowledgeTypeTermId: termId(p.type),
      classificationLevel: p.classification,
      departmentId: unit.id,
      ownerUserId: head?.id ?? superAdmin?.id ?? null,
      languageOriginal: "mixed",
      status: "verified",
      verifiedBy: superAdmin?.id ?? null,
      verifiedAt: now(),
      sourceOrigin: "org",
      publishYear: Number(p.effectiveFrom.slice(0, 4)),
      originalFilename: `${p.type}-${p.unitCode}.txt`,
      mime: "text/plain",
      sizeBytes: Buffer.byteLength(body, "utf8"),
      pageCount: 1,
      storagePath,
      visibilityScope: p.visibility,
      visibilityAllowJson:
        p.visibility === "restricted"
          ? JSON.stringify([head?.id, superAdmin?.id].filter(Boolean))
          : null,
      effectiveFrom: p.effectiveFrom,
      versionLabel: p.versionLabel,
      reviewCycleMonths: p.reviewCycleMonths,
      isSeeded: 1,
      sourceRef,
      createdAt: now(),
      updatedAt: now(),
    });
    await db.insert(schema.documentUnitLinks).values({
      id: ulid(),
      documentId,
      unitId: unit.id,
      createdAt: now(),
    });
    try {
      await runIngest(documentId, { skipEmbed: process.env.SKIP_EMBED === "1" });
    } catch {
      /* the nightly job retries */
    }
    made++;
  }
  console.log(`cr07 org: ${made} policies and procedures seeded across 4 units`);
  return made;
}

/* ------------------------------------------------------------------ */
/* CR07 2.1 and 3.1: both new portals are visible to all Office staff, so  */
/* every stored role portal set gains them (roles that never stored a   */
/* set already fall back to the defaults, which include both).          */
/* ------------------------------------------------------------------ */

export async function seedCr07Portals(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const roles = await db.select().from(schema.roles);
  let touched = 0;
  for (const role of roles) {
    let stored: unknown;
    try {
      stored = JSON.parse(role.portalsJson ?? "null");
    } catch {
      stored = null;
    }
    if (!Array.isArray(stored)) continue; // the default set already has both
    const list = stored.filter((p): p is string => typeof p === "string");
    const before = list.length;
    // keep rail order: council after strategy, organisation after experts
    const next: string[] = [];
    for (const portal of list) {
      next.push(portal);
      if (portal === "strategy" && !list.includes("council")) next.push("council");
      if (portal === "experts" && !list.includes("organisation")) next.push("organisation");
    }
    if (!next.includes("council")) next.push("council");
    if (!next.includes("organisation")) next.push("organisation");
    if (next.length === before) continue;
    await db
      .update(schema.roles)
      .set({ portalsJson: JSON.stringify(next) })
      .where(eq(schema.roles.id, role.id));
    touched++;
  }
  if (touched) console.log(`cr07 org: ${touched} roles gained the council and organisation portals`);
}

/** CR07 2.1: the Strategy Office is configurable in Settings. */
export async function seedCr07CouncilSettings(): Promise<void> {
  const { setSetting, getSetting } = await import("../src/server/settings");
  const current = await getSetting<{ unitCode?: string }>("council_strategy_office", {});
  if (current.unitCode) return;
  await setSetting("council_strategy_office", { unitCode: STRATEGY_OFFICE_CODE });
  console.log(`cr07 council: the Strategy Office is set to ${STRATEGY_OFFICE_CODE}`);
}

export async function seedCr07OrgAll(): Promise<void> {
  await seedCr07KnowledgeTypes();
  await seedCr07Org();
  await seedCr07Portals();
  await seedCr07CouncilSettings();
  await seedCr07OrgDocuments();
  await seedCr07Policies();
}

const isMain = process.argv[1] && /cr07-org-seed\.ts$/.test(process.argv[1]);
if (isMain) {
  seedCr07OrgAll()
    .then(() => {
      console.log("cr07 org seed complete");
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
