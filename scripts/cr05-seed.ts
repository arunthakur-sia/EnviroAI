/* eslint-disable no-console */
// CR05 seeds. Section 2: the entities register, the owner_entity_name
// migration into node_leads, and lead assignments for every NDS3 initiative
// and project. Section 3: stakeholders. Section 5: HR statuses, backups,
// handovers, responsibilities. Section 6: role portals, the HR Admin role,
// allowed domains. Idempotent: rows insert only when absent; the register
// upserts by English name. Run standalone (npx tsx scripts/cr05-seed.ts) or
// from seed.ts.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { and, asc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { ulid } from "ulid";

const now = () => new Date().toISOString();

/** Deterministic small hash for stable pseudo-random assignment. */
function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

type EntitySeed = {
  key: string;
  en: string;
  ar: string;
  shortEn?: string;
  shortAr?: string;
  kind: "ministry" | "agency" | "authority" | "company" | "international" | "other";
  website?: string;
  active?: boolean;
};

// The register: real bodies with real names in both languages (CR05 2.1 asks
// for at least 25). Historical bodies from the seeded owner strings are kept
// as inactive register rows so lineage stays honest.
const ENTITIES: EntitySeed[] = [
  { key: "mof", en: "Ministry of Finance", ar: "وزارة المالية", shortEn: "MOF", shortAr: "المالية", kind: "ministry", website: "https://www.mof.gov.qa" },
  { key: "moci", en: "Ministry of Commerce and Industry", ar: "وزارة التجارة والصناعة", shortEn: "MOCI", shortAr: "التجارة والصناعة", kind: "ministry", website: "https://www.moci.gov.qa" },
  { key: "mcit", en: "Ministry of Communications and Information Technology", ar: "وزارة الاتصالات وتكنولوجيا المعلومات", shortEn: "MCIT", shortAr: "الاتصالات وتكنولوجيا المعلومات", kind: "ministry", website: "https://www.mcit.gov.qa" },
  { key: "moehe", en: "Ministry of Education and Higher Education", ar: "وزارة التربية والتعليم والتعليم العالي", shortEn: "MOEHE", shortAr: "التربية والتعليم", kind: "ministry", website: "https://www.edu.gov.qa" },
  { key: "moph", en: "Ministry of Public Health", ar: "وزارة الصحة العامة", shortEn: "MOPH", shortAr: "الصحة العامة", kind: "ministry", website: "https://www.moph.gov.qa" },
  { key: "mom", en: "Ministry of Municipality", ar: "وزارة البلدية", shortEn: "MoM", shortAr: "البلدية", kind: "ministry", website: "https://www.mme.gov.qa" },
  { key: "moecc", en: "Ministry of Environment and Climate Change", ar: "وزارة البيئة والتغير المناخي", shortEn: "MOECC", shortAr: "البيئة والتغير المناخي", kind: "ministry", website: "https://www.mecc.gov.qa" },
  { key: "mol", en: "Ministry of Labour", ar: "وزارة العمل", shortEn: "MOL", shortAr: "العمل", kind: "ministry", website: "https://www.mol.gov.qa" },
  { key: "msdf", en: "Ministry of Social Development and Family", ar: "وزارة التنمية الاجتماعية والأسرة", shortEn: "MSDF", shortAr: "التنمية الاجتماعية والأسرة", kind: "ministry", website: "https://www.msdf.gov.qa" },
  { key: "culture", en: "Ministry of Culture", ar: "وزارة الثقافة", shortEn: "MoC", shortAr: "الثقافة", kind: "ministry", website: "https://www.moc.gov.qa" },
  { key: "sports", en: "Ministry of Sports and Youth", ar: "وزارة الرياضة والشباب", shortEn: "MSY", shortAr: "الرياضة والشباب", kind: "ministry" },
  { key: "mot", en: "Ministry of Transport", ar: "وزارة المواصلات", shortEn: "MOT", shortAr: "المواصلات", kind: "ministry", website: "https://www.mot.gov.qa" },
  { key: "moi", en: "Ministry of Interior", ar: "وزارة الداخلية", shortEn: "MOI", shortAr: "الداخلية", kind: "ministry", website: "https://www.moi.gov.qa" },
  { key: "moj", en: "Ministry of Justice", ar: "وزارة العدل", shortEn: "MOJ", shortAr: "العدل", kind: "ministry" },
  { key: "mofa", en: "Ministry of Foreign Affairs", ar: "وزارة الخارجية", shortEn: "MOFA", shortAr: "الخارجية", kind: "ministry", website: "https://www.mofa.gov.qa" },
  { key: "awqaf", en: "Ministry of Endowments and Islamic Affairs", ar: "وزارة الأوقاف والشؤون الإسلامية", shortEn: "Awqaf", shortAr: "الأوقاف", kind: "ministry" },
  { key: "qcb", en: "Qatar Central Bank", ar: "مصرف قطر المركزي", shortEn: "QCB", shortAr: "المصرف المركزي", kind: "authority", website: "https://www.qcb.gov.qa" },
  { key: "qia", en: "Qatar Investment Authority", ar: "جهاز قطر للاستثمار", shortEn: "QIA", shortAr: "جهاز الاستثمار", kind: "authority", website: "https://www.qia.qa" },
  { key: "qfza", en: "Qatar Free Zones Authority", ar: "هيئة المناطق الحرة - قطر", shortEn: "QFZA", shortAr: "المناطق الحرة", kind: "authority", website: "https://qfz.gov.qa" },
  { key: "qfc", en: "Qatar Financial Centre Authority", ar: "هيئة مركز قطر للمال", shortEn: "QFC", shortAr: "مركز قطر للمال", kind: "authority", website: "https://www.qfc.qa" },
  { key: "qrdi", en: "Qatar Research, Development and Innovation Council", ar: "مجلس قطر للبحث والتطوير والابتكار", shortEn: "QRDI", shortAr: "مجلس البحث والابتكار", kind: "agency", website: "https://qrdi.org.qa" },
  { key: "qf", en: "Qatar Foundation", ar: "مؤسسة قطر", shortEn: "QF", shortAr: "مؤسسة قطر", kind: "other", website: "https://www.qf.org.qa" },
  { key: "qatarenergy", en: "QatarEnergy", ar: "قطر للطاقة", shortEn: "QatarEnergy", shortAr: "قطر للطاقة", kind: "company", website: "https://www.qatarenergy.qa" },
  { key: "qt", en: "Qatar Tourism", ar: "قطر للسياحة", shortEn: "Qatar Tourism", shortAr: "قطر للسياحة", kind: "authority", website: "https://www.visitqatar.com" },
  { key: "qm", en: "Qatar Museums", ar: "متاحف قطر", shortEn: "QM", shortAr: "متاحف قطر", kind: "authority", website: "https://qm.org.qa" },
  { key: "cra", en: "Communications Regulatory Authority", ar: "هيئة تنظيم الاتصالات", shortEn: "CRA", shortAr: "تنظيم الاتصالات", kind: "authority", website: "https://www.cra.gov.qa" },
  { key: "qdb", en: "Qatar Development Bank", ar: "بنك قطر للتنمية", shortEn: "QDB", shortAr: "بنك التنمية", kind: "company", website: "https://www.qdb.qa" },
  { key: "ashghal", en: "Public Works Authority (Ashghal)", ar: "هيئة الأشغال العامة (أشغال)", shortEn: "Ashghal", shortAr: "أشغال", kind: "authority", website: "https://www.ashghal.gov.qa" },
  { key: "kahramaa", en: "Qatar General Electricity and Water Corporation (Kahramaa)", ar: "المؤسسة العامة القطرية للكهرباء والماء (كهرماء)", shortEn: "Kahramaa", shortAr: "كهرماء", kind: "company", website: "https://www.km.qa" },
  { key: "ncsa", en: "National Cyber Security Agency", ar: "الوكالة الوطنية للأمن السيبراني", shortEn: "NCSA", shortAr: "الأمن السيبراني", kind: "agency", website: "https://ncsa.gov.qa" },
  { key: "cgb", en: "Civil Service and Government Development Bureau", ar: "ديوان الخدمة المدنية والتطوير الحكومي", shortEn: "CGB", shortAr: "ديوان الخدمة المدنية", kind: "agency", website: "https://www.cgb.gov.qa" },
  { key: "ipa", en: "Invest Qatar (Investment Promotion Agency)", ar: "وكالة ترويج الاستثمار (استثمر في قطر)", shortEn: "Invest Qatar", shortAr: "استثمر في قطر", kind: "agency", website: "https://www.invest.qa" },
  { key: "customs", en: "General Authority of Customs", ar: "الهيئة العامة للجمارك", shortEn: "Customs", shortAr: "الجمارك", kind: "authority", website: "https://www.customs.gov.qa" },
  { key: "gta", en: "General Tax Authority", ar: "الهيئة العامة للضرائب", shortEn: "GTA", shortAr: "الضرائب", kind: "authority", website: "https://www.gta.gov.qa" },
  { key: "qu", en: "Qatar University", ar: "جامعة قطر", shortEn: "QU", shortAr: "جامعة قطر", kind: "other", website: "https://www.qu.edu.qa" },
  { key: "hmc", en: "Hamad Medical Corporation", ar: "مؤسسة حمد الطبية", shortEn: "HMC", shortAr: "حمد الطبية", kind: "company", website: "https://www.hamad.qa" },
  { key: "phcc", en: "Primary Health Care Corporation", ar: "مؤسسة الرعاية الصحية الأولية", shortEn: "PHCC", shortAr: "الرعاية الأولية", kind: "company", website: "https://www.phcc.gov.qa" },
  { key: "qse", en: "Qatar Stock Exchange", ar: "بورصة قطر", shortEn: "QSE", shortAr: "البورصة", kind: "company", website: "https://www.qe.com.qa" },
  { key: "qrail", en: "Qatar Rail", ar: "سكك الحديد القطرية (الريل)", shortEn: "Qatar Rail", shortAr: "الريل", kind: "company", website: "https://www.qr.com.qa" },
  { key: "mwani", en: "Mwani Qatar", ar: "موانئ قطر", shortEn: "Mwani", shortAr: "موانئ", kind: "company", website: "https://www.mwani.com.qa" },
  { key: "manateq", en: "Manateq (Economic Zones Company)", ar: "شركة المناطق الاقتصادية (مناطق)", shortEn: "Manateq", shortAr: "مناطق", kind: "company", website: "https://www.manateq.qa" },
  { key: "matar", en: "Hamad International Airport (MATAR)", ar: "مطار حمد الدولي (مطار)", shortEn: "MATAR", shortAr: "مطار حمد", kind: "company", website: "https://dohahamadairport.com" },
  { key: "grsia", en: "General Retirement and Social Insurance Authority", ar: "الهيئة العامة للتقاعد والتأمينات الاجتماعية", shortEn: "GRSIA", shortAr: "التقاعد والتأمينات", kind: "authority", website: "https://www.grsia.gov.qa" },
  { key: "qfsw", en: "Qatar Foundation for Social Work", ar: "المؤسسة القطرية للعمل الاجتماعي", shortEn: "QFSW", shortAr: "العمل الاجتماعي", kind: "other", website: "https://www.qfsw.org.qa" },
  { key: "eaa", en: "Education Above All Foundation", ar: "مؤسسة التعليم فوق الجميع", shortEn: "EAA", shortAr: "التعليم فوق الجميع", kind: "other", website: "https://www.educationaboveall.org" },
  { key: "gscm", en: "General Secretariat of the Council of Ministers", ar: "الأمانة العامة لمجلس الوزراء", shortEn: "GSCM", shortAr: "أمانة مجلس الوزراء", kind: "agency" },
  { key: "qatalum", en: "Qatar Aluminium (Qatalum)", ar: "قطر للألمنيوم (كتلم)", shortEn: "Qatalum", shortAr: "كتلم", kind: "company", website: "https://www.qatalum.com" },
  { key: "undp", en: "United Nations Development Programme", ar: "برنامج الأمم المتحدة الإنمائي", shortEn: "UNDP", shortAr: "الأمم المتحدة الإنمائي", kind: "international", website: "https://www.undp.org" },
  { key: "worldbank", en: "World Bank", ar: "البنك الدولي", shortEn: "World Bank", shortAr: "البنك الدولي", kind: "international", website: "https://www.worldbank.org" },
  // Historical bodies referenced by the seeded owner strings (inactive)
  { key: "psa", en: "Planning and Statistics Authority", ar: "جهاز التخطيط والإحصاء", shortEn: "PSA", shortAr: "التخطيط والإحصاء", kind: "authority", active: false },
  { key: "mdps", en: "Ministry of Development Planning and Statistics", ar: "وزارة التخطيط التنموي والإحصاء", shortEn: "MDPS", shortAr: "التخطيط التنموي", kind: "ministry", active: false },
  { key: "gsdp", en: "General Secretariat for Development Planning", ar: "الأمانة العامة للتخطيط التنموي", shortEn: "GSDP", shortAr: "التخطيط التنموي", kind: "agency", active: false },
  { key: "mme_hist", en: "Ministry of Municipality and Environment", ar: "وزارة البلدية والبيئة", shortEn: "MME", shortAr: "البلدية والبيئة", kind: "ministry", active: false },
  { key: "madlsa", en: "Ministry of Administrative Development, Labor and Social Affairs", ar: "وزارة التنمية الإدارية والعمل والشؤون الاجتماعية", shortEn: "MADLSA", shortAr: "التنمية الإدارية", kind: "ministry", active: false },
  { key: "mec", en: "Ministry of Economy and Commerce", ar: "وزارة الاقتصاد والتجارة", shortEn: "MEC", shortAr: "الاقتصاد والتجارة", kind: "ministry", active: false },
  { key: "mcs", en: "Ministry of Culture and Sport", ar: "وزارة الثقافة والرياضة", shortEn: "MCS", shortAr: "الثقافة والرياضة", kind: "ministry", active: false },
  { key: "motc", en: "Ministry of Transport and Communications", ar: "وزارة المواصلات والاتصالات", shortEn: "MOTC", shortAr: "المواصلات والاتصالات", kind: "ministry", active: false },
  { key: "mei", en: "Ministry of Energy and Industry", ar: "وزارة الطاقة والصناعة", shortEn: "MEI", shortAr: "الطاقة والصناعة", kind: "ministry", active: false },
  { key: "moe_hist", en: "Ministry of Environment", ar: "وزارة البيئة", shortEn: "MoE", shortAr: "البيئة", kind: "ministry", active: false },
  { key: "mosa", en: "Ministry of Social Affairs", ar: "وزارة الشؤون الاجتماعية", shortEn: "MoSA", shortAr: "الشؤون الاجتماعية", kind: "ministry", active: false },
  { key: "ictqatar", en: "Ministry of Information and Communications Technology (ictQATAR)", ar: "وزارة تكنولوجيا المعلومات والاتصالات", shortEn: "ictQATAR", shortAr: "تكنولوجيا المعلومات", kind: "ministry", active: false },
  { key: "mcah", en: "Ministry of Culture, Arts and Heritage", ar: "وزارة الثقافة والفنون والتراث", shortEn: "MCAH", shortAr: "الثقافة والفنون", kind: "ministry", active: false },
  { key: "sec", en: "Supreme Education Council", ar: "المجلس الأعلى للتعليم", shortEn: "SEC", shortAr: "الأعلى للتعليم", kind: "authority", active: false },
  { key: "sch", en: "Supreme Council of Health", ar: "المجلس الأعلى للصحة", shortEn: "SCH", shortAr: "الأعلى للصحة", kind: "authority", active: false },
  { key: "scfa", en: "Supreme Council for Family Affairs", ar: "المجلس الأعلى لشؤون الأسرة", shortEn: "SCFA", shortAr: "شؤون الأسرة", kind: "authority", active: false },
];

// Every distinct owner_entity_name in the seed, mapped onto the register
// (case variants deduplicated; historical bodies keep their own rows).
const OWNER_MAP: Record<string, string> = {
  "ministry of municipality and environment": "mme_hist",
  "ministry of administrative development, labor and social affairs": "madlsa",
  "planning and statistics authority": "psa",
  "ministry of public health": "moph",
  "ministry of interior": "moi",
  "ministry of foreign affairs": "mofa",
  "ministry of finance": "mof",
  "ministry of education and higher education": "moehe",
  "ministry of culture and sport": "mcs",
  "ministry of communications and information technology": "mcit",
  "kahramaa": "kahramaa",
  "qatar tourism": "qt",
  "ministry of social development and family": "msdf",
  "ministry of labour": "mol",
  "ministry of economy and commerce": "mec",
  "ministry of commerce and industry": "moci",
  "general secretariat of the council of ministers": "gscm",
  "qatarenergy": "qatarenergy",
  "qatar museums": "qm",
  "qatar development bank": "qdb",
  "ministry of development planning and statistics": "mdps",
  "civil service and government development bureau": "cgb",
  "qatar foundation for social work": "qfsw",
  "mwani qatar": "mwani",
  "ministry of environment and climate change": "moecc",
  "ministry of environment": "moe_hist",
  "manateq": "manateq",
  "hamad medical corporation": "hmc",
  "supreme education council": "sec",
  "supreme council of health": "sch",
  "supreme council for family affairs": "scfa",
  "qatar research, development and innovation council": "qrdi",
  "qatar rail": "qrail",
  "qatar investment authority": "qia",
  "qatar financial centre authority": "qfc",
  "qatar central bank": "qcb",
  "qatar aluminium (qatalum)": "qatalum",
  "primary health care corporation": "phcc",
  "ministry of transport and communications": "motc",
  "ministry of transport": "mot",
  "ministry of social affairs": "mosa",
  "ministry of municipality": "mom",
  "ministry of justice": "moj",
  "ministry of information and communications technology (ictqatar)": "ictqatar",
  "ministry of energy and industry": "mei",
  "ministry of culture, arts and heritage": "mcah",
  "ministry of culture": "culture",
  "invest qatar": "ipa",
  "hamad international airport (matar)": "matar",
  "general secretariat for development planning": "gsdp",
  "general retirement and social insurance authority": "grsia",
  "general authority of customs": "customs",
  "education above all foundation": "eaa",
};

// Plausible lead pools per NDS3 outcome sort order (1..7), used only where the
// sources named nobody; those rows stay verified = 0.
const OUTCOME_POOLS: Record<number, string[]> = {
  1: ["moci", "mof", "qfza", "qdb", "ipa", "qia", "manateq", "qt", "qfc", "qatarenergy"],
  2: ["mof", "qcb", "gta", "customs"],
  3: ["moehe", "mol", "qu", "qf", "cgb"],
  4: ["msdf", "culture", "awqaf", "qfsw", "sports"],
  5: ["moph", "hmc", "phcc", "mom", "ashghal", "qm", "mot"],
  6: ["moecc", "kahramaa", "mom", "qatarenergy"],
  7: ["cgb", "mcit", "ncsa", "gscm", "moi", "moj"],
};

// NPC department co-lead pools per outcome (department codes). CR06 reuses
// the first code of each pool as the outcome's department owner.
export const OUTCOME_DEPTS: Record<number, string[]> = {
  1: ["econ_planning"],
  2: ["econ_planning", "monitoring_eval"],
  3: ["social_planning"],
  4: ["social_planning"],
  5: ["social_planning", "monitoring_eval"],
  6: ["foresight_risk"],
  7: ["planning_policies", "national_data"],
};

export async function seedCr05Entities(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");

  /* 1. the register: upsert by English name */
  const existing = await db.select().from(schema.entities);
  const byName = new Map(existing.map((e) => [e.nameEn.toLowerCase(), e]));
  const idOfKey = new Map<string, string>();
  for (const e of ENTITIES) {
    const found = byName.get(e.en.toLowerCase());
    if (found) {
      idOfKey.set(e.key, found.id);
      continue;
    }
    const eid = ulid();
    await db.insert(schema.entities).values({
      id: eid,
      nameEn: e.en,
      nameAr: e.ar,
      shortNameEn: e.shortEn ?? e.en,
      shortNameAr: e.shortAr ?? e.ar,
      kind: e.kind,
      website: e.website ?? null,
      isActive: e.active === false ? 0 : 1,
      nameArMachine: 0,
      createdAt: now(),
      updatedAt: now(),
    });
    idOfKey.set(e.key, eid);
  }
  console.log(`entities register: ${ENTITIES.length} rows ready`);

  /* 2. migrate owner_entity_name into node_leads (all editions) */
  const anyLead = await db.select().from(schema.nodeLeads).limit(1);
  if (anyLead.length) {
    console.log("node_leads already seeded; skipping migration");
    return;
  }
  const nodes = await db
    .select()
    .from(schema.strategyNodes)
    .orderBy(asc(schema.strategyNodes.sort));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const outcomeSortOf = (nodeId: string): number => {
    let cur = nodeById.get(nodeId);
    let guard = 0;
    while (cur && cur.nodeType !== "outcome" && cur.parentId && guard++ < 10) {
      cur = nodeById.get(cur.parentId);
    }
    if (cur && cur.nodeType === "outcome") {
      // outcome codes are O1..O7; fall back to sort order
      const m = /(\d+)/.exec(cur.code ?? "");
      if (m) return Math.min(7, Math.max(1, Number(m[1])));
      return Math.min(7, (cur.sort ?? 0) + 1);
    }
    return 7;
  };

  const departments = await db.select().from(schema.departments);
  const deptByCode = new Map(departments.map((d) => [d.code, d]));
  const unmapped = new Set<string>();
  let migrated = 0;

  for (const n of nodes) {
    const raw = (n.ownerEntityName ?? "").trim();
    if (!raw) continue;
    const key = OWNER_MAP[raw.toLowerCase()];
    let entityId = key ? idOfKey.get(key) : undefined;
    if (!entityId) {
      // unexpected value: create a register row with a machine-flagged Arabic name
      unmapped.add(raw);
      const eid = ulid();
      await db.insert(schema.entities).values({
        id: eid,
        nameEn: raw,
        nameAr: raw,
        shortNameEn: raw,
        shortNameAr: raw,
        kind: "other",
        isActive: 0,
        nameArMachine: 1,
        createdAt: now(),
        updatedAt: now(),
      });
      entityId = eid;
    }
    await db.insert(schema.nodeLeads).values({
      id: ulid(),
      nodeId: n.id,
      leadKind: "entity",
      entityId,
      role: "lead",
      sort: 0,
      verified: n.verified ?? 0,
      createdAt: now(),
    });
    migrated++;
  }
  console.log(
    `owner_entity_name migrated: ${migrated} leads${unmapped.size ? ` (${unmapped.size} unmapped values flagged)` : ""}`
  );

  /* 3. every NDS3 initiative and project gets a lead; joint department leads
        and supporting entities are assigned deterministically (verified 0) */
  const [nds3] = await db
    .select()
    .from(schema.strategyEditions)
    .where(eq(schema.strategyEditions.code, "nds3"));
  if (!nds3) throw new Error("nds3 edition missing");
  const delivery = nodes.filter(
    (n) =>
      n.editionId === nds3.id &&
      (n.nodeType === "initiative" || n.nodeType === "project")
  );
  const leadsNow = await db.select().from(schema.nodeLeads);
  const hasLead = new Set(leadsNow.filter((l) => l.role === "lead").map((l) => l.nodeId));
  let assigned = 0;
  let joints = 0;
  let supports = 0;

  for (const n of delivery) {
    const outcome = outcomeSortOf(n.id);
    const pool = OUTCOME_POOLS[outcome] ?? OUTCOME_POOLS[7];
    const h = hashOf(n.id);
    if (!hasLead.has(n.id)) {
      const entityId = idOfKey.get(pool[h % pool.length])!;
      await db.insert(schema.nodeLeads).values({
        id: ulid(),
        nodeId: n.id,
        leadKind: "entity",
        entityId,
        role: "lead",
        sort: 0,
        verified: 0,
        createdAt: now(),
      });
      assigned++;
    }
    // roughly a third of delivery nodes are jointly led with an NPC department
    if (h % 3 === 0) {
      const codes = OUTCOME_DEPTS[outcome] ?? ["planning_policies"];
      const dept = deptByCode.get(codes[(h >> 3) % codes.length]);
      if (dept) {
        await db.insert(schema.nodeLeads).values({
          id: ulid(),
          nodeId: n.id,
          leadKind: "department",
          departmentId: dept.id,
          role: "lead",
          sort: 1,
          verified: 0,
          createdAt: now(),
        });
        joints++;
      }
    }
    // about half get one or two supporting entities distinct from the lead
    if (h % 2 === 0) {
      const count = 1 + ((h >> 5) % 2);
      for (let i = 0; i < count; i++) {
        const supportKey = pool[(h + i + 1) % pool.length];
        const supportId = idOfKey.get(supportKey)!;
        const leadRow = leadsNow.find((l) => l.nodeId === n.id && l.role === "lead");
        if (leadRow?.entityId === supportId) continue;
        await db.insert(schema.nodeLeads).values({
          id: ulid(),
          nodeId: n.id,
          leadKind: "entity",
          entityId: supportId,
          role: "supporting",
          sort: 10 + i,
          verified: 0,
          createdAt: now(),
        });
        supports++;
      }
    }
  }
  console.log(
    `nds3 lead coverage: +${assigned} assigned, ${joints} joint department leads, ${supports} supporting rows`
  );
}

/* ------------------------------------------------------------------ */
/* CR05 3: stakeholders on every NDS3 project (sponsor, owner, manager, */
/* team, experts with domains, and an external partner where an entity  */
/* leads). Deterministic, idempotent (skips when any row exists).       */
/* ------------------------------------------------------------------ */

export const EXPERT_NOTES: [string, string][] = [
  ["Methodology advisor", "مستشار منهجية"],
  ["Data quality reviewer", "مراجع جودة البيانات"],
  ["Sector specialist", "متخصص قطاعي"],
  ["Evaluation advisor", "مستشار تقييم"],
];

const PARTNER_NAMES: [string, string][] = [
  ["Khalid Al-Sowaidi", "خالد السويدي"],
  ["Noura Al-Hajri", "نورة الهاجري"],
  ["Ibrahim Al-Malki", "إبراهيم المالكي"],
  ["Hessa Al-Khalifa", "حصة آل خليفة"],
  ["Salem Al-Naimi", "سالم النعيمي"],
];

export async function seedCr05Stakeholders(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const { eq: eq2, asc: asc2, inArray: inArray2 } = await import("drizzle-orm");

  const any = await db.select().from(schema.nodeStakeholders).limit(1);
  if (any.length) {
    console.log("node_stakeholders already seeded; skipping");
    return;
  }

  const [nds3] = await db
    .select()
    .from(schema.strategyEditions)
    .where(eq2(schema.strategyEditions.code, "nds3"));
  const nodes = await db
    .select()
    .from(schema.strategyNodes)
    .where(eq2(schema.strategyNodes.editionId, nds3.id))
    .orderBy(asc2(schema.strategyNodes.sort));
  const projects = nodes.filter((n) => n.nodeType === "project");

  const users = await db.select().from(schema.users);
  const alive = users.filter((u) => !u.deletedAt);
  const heads = alive.filter((u) => u.email.startsWith("head.") || u.email === "admin@npc.qa");
  const roleRows = await db.select().from(schema.roles);
  const roleName = new Map(roleRows.map((r) => [r.id, r.nameEn]));
  const contributors = alive.filter((u) =>
    ["Contributor", "Knowledge Admin", "Expert Verifier", "Department Head"].includes(
      roleName.get(u.roleId) ?? ""
    )
  );
  const teamPool = alive.filter((u) => u.email !== "admin@npc.qa");

  const experts = await db.select().from(schema.experts);
  const domains = await db.select().from(schema.expertDomains);
  const domainOf = new Map<string, string>();
  for (const d of domains) if (!domainOf.has(d.expertId)) domainOf.set(d.expertId, d.termId);
  const expertsWithDomains = experts.filter((e) => domainOf.has(e.id));

  const leads = await db.select().from(schema.nodeLeads);
  const entityLeadOf = new Map<string, string>();
  for (const l of leads) {
    if (l.role === "lead" && l.leadKind === "entity" && l.entityId)
      entityLeadOf.set(l.nodeId, l.entityId);
  }
  const entityRows = await db.select().from(schema.entities);
  const entityById = new Map(entityRows.map((e) => [e.id, e]));

  let rows = 0;
  for (const p of projects) {
    const h = hashOf(p.id);
    const pick = <T>(pool: T[], salt: number): T => pool[(h + salt * 7919) % pool.length];
    let sort = 0;
    const add = async (v: Record<string, unknown>) => {
      await db.insert(schema.nodeStakeholders).values({
        id: ulid(),
        nodeId: p.id,
        sort: sort++,
        sinceDate: p.startDate ?? "2024-09-01",
        createdAt: now(),
        ...v,
      } as never);
      rows++;
    };

    const sponsor = pick(heads.length ? heads : contributors, 1);
    const owner = pick(contributors, 2);
    // one in seven projects: the sponsor also owns it (two roles, two rows)
    const ownerUser = h % 7 === 0 ? sponsor : owner;
    const manager = pick(
      contributors.filter((c) => c.id !== ownerUser.id).length
        ? contributors.filter((c) => c.id !== ownerUser.id)
        : contributors,
      3
    );
    await add({ personKind: "employee", userId: sponsor.id, role: "sponsor" });
    await add({ personKind: "employee", userId: ownerUser.id, role: "owner" });
    await add({ personKind: "employee", userId: manager.id, role: "manager" });

    const teamCount = 2 + (h % 4); // 2..5
    const seen = new Set([sponsor.id, ownerUser.id, manager.id]);
    for (let i = 0; i < teamCount; i++) {
      const member = pick(teamPool, 10 + i);
      if (seen.has(member.id)) continue;
      seen.add(member.id);
      await add({ personKind: "employee", userId: member.id, role: "team" });
    }

    const expertCount = 1 + (h % 3); // 1..3
    const seenExperts = new Set<string>();
    for (let i = 0; i < expertCount; i++) {
      const ex = pick(expertsWithDomains, 20 + i);
      if (seenExperts.has(ex.id)) continue;
      seenExperts.add(ex.id);
      const note = EXPERT_NOTES[(h + i) % EXPERT_NOTES.length];
      await add({
        personKind: "expert",
        expertId: ex.id,
        role: "expert",
        roleNoteEn: note[0],
        roleNoteAr: note[1],
        domainTermId: domainOf.get(ex.id) ?? null,
      });
    }

    const leadEntityId = entityLeadOf.get(p.id);
    if (leadEntityId) {
      const ent = entityById.get(leadEntityId);
      const partner = PARTNER_NAMES[h % PARTNER_NAMES.length];
      const domain = ent?.website ? ent.website.replace(/^https?:\/\/(www\.)?/, "") : null;
      await add({
        personKind: "external_contact",
        nameEn: partner[0],
        nameAr: partner[1],
        organisation: ent?.nameEn ?? null,
        email: domain
          ? `${partner[0].split(" ")[0].toLowerCase()}.${partner[0].split(" ")[1].replace(/^Al-/, "").toLowerCase()}@${domain}`
          : null,
        role: "external_partner",
        roleNoteEn: "Entity focal point",
        roleNoteAr: "منسق الجهة",
      });
    }
  }
  console.log(`stakeholders seeded: ${rows} rows across ${projects.length} projects`);
}

/* ------------------------------------------------------------------ */
/* CR05 4: peer-group presets, forecast assumption defaults, and the    */
/* official forecasts (computed with the mock explanation writer at     */
/* seed time, DECISIONS 5).                                             */
/* ------------------------------------------------------------------ */

export async function seedCr05Indices(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const { getSetting, setSetting } = await import("../src/server/settings");
  const { eq: eqI, isNull } = await import("drizzle-orm");

  /* shared peer-group presets */
  const groups = await db.select().from(schema.peerGroups);
  const presets: [string, string, string[], boolean][] = [
    ["GCC", "مجلس التعاون", ["SAU", "ARE", "KWT", "BHR", "OMN"], true],
    ["MENA sample", "عينة الشرق الأوسط وشمال أفريقيا", ["SAU", "ARE", "EGY", "JOR", "MAR"], false],
    ["G20 sample", "عينة مجموعة العشرين", ["USA", "GBR", "KOR", "TUR", "DEU", "FRA", "JPN", "CHN", "IND"], false],
  ];
  for (const [en, ar, countriesList, isDefault] of presets) {
    if (groups.some((g) => g.nameEn === en && !g.ownerUserId)) continue;
    await db.insert(schema.peerGroups).values({
      id: ulid(),
      nameEn: en,
      nameAr: ar,
      countryCodesJson: JSON.stringify(countriesList),
      isDefault: isDefault ? 1 : 0,
      ownerUserId: null,
      createdAt: now(),
    });
  }
  console.log("peer-group presets ready");

  /* global assumption defaults (index_id null) */
  const existing = await db
    .select()
    .from(schema.indexForecastAssumptions)
    .where(isNull(schema.indexForecastAssumptions.indexId));
  const defaults: [string, number, number, number, number, string, string][] = [
    ["signal_strength", 1, 0, 2, 0.1, "Signal adjustment strength", "قوة تعديل الإشارات"],
    ["target_pull", 1, 0, 2, 0.1, "Target pull weight", "وزن الجذب نحو المستهدف"],
    ["history_window", 15, 5, 16, 1, "History window (years)", "نافذة السلسلة (سنوات)"],
    ["manual_shock", 0, -10, 10, 0.5, "Manual shock (score points)", "صدمة يدوية (نقاط)"],
  ];
  for (const [key, value, min, max, step, labelEn, labelAr] of defaults) {
    if (existing.some((a) => a.key === key)) continue;
    await db.insert(schema.indexForecastAssumptions).values({
      id: ulid(),
      indexId: null,
      key,
      value,
      min,
      max,
      step,
      labelEn,
      labelAr,
      editableBy: "user_whatif",
    });
  }
  console.log("forecast assumption defaults ready");

  /* official forecasts, mock explanations at seed (DECISIONS 5) */
  const anyIndex = await db.select().from(schema.indices).limit(1);
  if (!anyIndex.length) {
    console.log("no indices seeded yet; skipping forecasts (run fetch-indices first)");
    return;
  }
  const anyCurrent = await db
    .select()
    .from(schema.indexForecasts)
    .where(eqI(schema.indexForecasts.status, "current"))
    .limit(1);
  if (anyCurrent.length) {
    console.log("forecasts already computed; skipping");
    return;
  }
  const ai = await getSetting<{ mockMode?: boolean }>("ai", {});
  const wasMock = ai.mockMode === true;
  if (!wasMock) await setSetting("ai", { ...ai, mockMode: true });
  try {
    const { computeAllForecasts } = await import("../src/server/indices/compute");
    const done = await computeAllForecasts();
    console.log(`official forecasts computed: ${done} indices`);
  } finally {
    if (!wasMock) await setSetting("ai", { ...ai, mockMode: false });
  }
}

/* ------------------------------------------------------------------ */
/* CR05 5.8: HR seeds. Statuses, backups for about 60 percent of owned  */
/* items, three handovers in different states, responsibilities for     */
/* every department, the game rules, and the risk register at seed.     */
/* ------------------------------------------------------------------ */

const DEPT_RESPONSIBILITIES: Record<string, [string, string]> = {
  econ_planning: [
    "Leads macroeconomic and sectoral planning for NDS3: growth scenarios, diversification analysis, and the economic policy pipeline with the ministries and economic entities.",
    "تقود التخطيط الاقتصادي الكلي والقطاعي للاستراتيجية الوطنية الثالثة: سيناريوهات النمو وتحليل التنويع الاقتصادي وخط السياسات الاقتصادية مع الوزارات والجهات الاقتصادية.",
  ],
  social_planning: [
    "Plans the social and human development agenda: education, health, labour, family and community outcomes, and their alignment with QNV 2030.",
    "تخطط أجندة التنمية الاجتماعية والبشرية: مخرجات التعليم والصحة والعمل والأسرة والمجتمع ومواءمتها مع رؤية قطر الوطنية 2030.",
  ],
  foresight_risk: [
    "Runs horizon scanning, the signals pipeline, national risk registers, and futures work that feeds the mid-term review.",
    "تدير استشراف الأفق وخط الإشارات وسجلات المخاطر الوطنية وأعمال المستقبلات التي تغذي مراجعة منتصف المدة.",
  ],
  monitoring_eval: [
    "Owns the NDS3 results framework: KPI collection, status updates, delivery reviews, and the evaluation calendar.",
    "تملك إطار نتائج الاستراتيجية: جمع مؤشرات الأداء وتحديثات الحالة ومراجعات الإنجاز وتقويم التقييم.",
  ],
  national_data: [
    "Coordinates national data governance, data sharing agreements, and the statistical registers behind the indicators.",
    "تنسق حوكمة البيانات الوطنية واتفاقيات تبادل البيانات والسجلات الإحصائية التي تقوم عليها المؤشرات.",
  ],
  stat_operations: [
    "Runs statistical field operations, surveys and censuses, and the production of official releases.",
    "تدير العمليات الإحصائية الميدانية والمسوح والتعدادات وإنتاج الإصدارات الرسمية.",
  ],
  stat_systems: [
    "Builds and maintains the statistical production systems, classifications, and quality frameworks.",
    "تبني وتشغل نظم الإنتاج الإحصائي والتصنيفات وأطر الجودة.",
  ],
  planning_policies: [
    "Develops planning policy, institutional modernization, and government excellence programmes with CGB.",
    "تطور سياسات التخطيط وبرامج التحديث المؤسسي والتميز الحكومي بالتعاون مع ديوان الخدمة المدنية.",
  ],
  it_dept: [
    "Operates SiaNexus and the council's digital platforms, integrations, and information security posture.",
    "تشغل سيا نكسس والمنصات الرقمية للمجلس وتكاملاتها ووضعها في أمن المعلومات.",
  ],
  sg_office: [
    "Supports the Secretary General: cabinet coordination, entity relations, and the council's decision pipeline.",
    "يساند الأمين العام: التنسيق مع مجلس الوزراء وعلاقات الجهات وخط قرارات المجلس.",
  ],
};

export async function seedCr05Hr(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const { eq: eqH, isNull } = await import("drizzle-orm");

  /* game rules (5.7) */
  const rules = await db.select().from(schema.gameRules);
  const newRules: [string, number][] = [
    ["handover_item_completed", 5],
    ["handover_completed", 60],
    ["handover_completed_owner", 40],
    ["backup_assigned", 5],
    ["knowledge_capture_bonus", 20],
  ];
  for (const [eventType, points] of newRules) {
    if (rules.some((r) => r.eventType === eventType)) continue;
    await db.insert(schema.gameRules).values({
      id: ulid(),
      eventType,
      points,
      isActive: 1,
    });
  }
  console.log("hr game rules ready");

  /* department responsibilities */
  const departments = await db.select().from(schema.departments);
  for (const d of departments) {
    if (d.responsibilitiesEn) continue;
    const r = DEPT_RESPONSIBILITIES[d.code];
    if (!r) continue;
    await db
      .update(schema.departments)
      .set({ responsibilitiesEn: r[0], responsibilitiesAr: r[1], updatedAt: now() })
      .where(eqH(schema.departments.id, d.id));
  }
  console.log("department responsibilities ready");

  const anyStatus = await db.select().from(schema.employeeStatus).limit(1);
  if (anyStatus.length) {
    console.log("hr statuses already seeded; skipping the rest");
    return;
  }

  const users = await db.select().from(schema.users).where(isNull(schema.users.deletedAt));
  const byEmail = new Map(users.map((u) => [u.email, u]));
  const admin = byEmail.get("admin@npc.qa")!;

  /* statuses: two leaving, one transferring, one long leave (5.8) */
  const leaving1 = byEmail.get("tariq.odeh@npc.qa");
  const leaving2 = byEmail.get("priya.nair@npc.qa");
  const transferring = byEmail.get("nasser.almannai@npc.qa");
  const longLeave = byEmail.get("mona.abdelrahman@npc.qa");
  const statusRows: [typeof leaving1, string, string | null][] = [
    [leaving1, "leaving", "2026-10-15"],
    [leaving2, "leaving", "2026-11-30"],
    [transferring, "transferring", "2026-10-01"],
    [longLeave, "long_leave", "2026-09-20"],
  ];
  for (const [u, status, date] of statusRows) {
    if (!u) continue;
    await db.insert(schema.employeeStatus).values({
      userId: u.id,
      status,
      effectiveDate: date,
      targetDepartmentId:
        status === "transferring"
          ? departments.find((d) => d.code === "national_data")?.id ?? null
          : null,
      note: null,
      setBy: admin.id,
      setAt: now(),
    });
  }
  console.log("employee statuses seeded");

  /* backups for about 60 percent of owned items */
  const { buildInventory } = await import("../src/server/services/hr");
  const inventory = await buildInventory();
  const pool = users.filter((u) => !["admin@npc.qa"].includes(u.email));
  let backups = 0;
  for (const [userId, items] of inventory) {
    for (const item of items) {
      if (item.itemKind === "node_role") continue;
      const h = hashOf(`${item.resourceType}:${item.resourceId}`);
      if (h % 10 >= 6) continue; // ~60 percent
      let backup = pool[h % pool.length];
      if (backup.id === userId) backup = pool[(h + 1) % pool.length];
      await db
        .insert(schema.ownershipBackups)
        .values({
          id: ulid(),
          resourceType: item.resourceType,
          resourceId: item.resourceId,
          backupUserId: backup.id,
          setBy: admin.id,
          setAt: now(),
        })
        .onConflictDoNothing();
      backups++;
    }
  }
  console.log(`ownership backups seeded: ${backups}`);

  /* three handovers in different states */
  const { getUserById } = await import("../src/server/auth/session");
  const { startHandover, refreshHandoverCompletion } = await import(
    "../src/server/services/hr"
  );
  const actor = await getUserById(admin.id);
  if (!actor) throw new Error("admin missing");
  const successorA = byEmail.get("sara.alansari@npc.qa");
  const successorB = byEmail.get("omar.barakat@npc.qa");
  const successorC = byEmail.get("aisha.alemadi@npc.qa");

  // 1: leaving, in progress, half the items handled
  if (leaving1 && successorA) {
    const created = await startHandover(actor, {
      userId: leaving1.id,
      kind: "leaving",
      dueDate: "2026-10-10",
      successorDefaultUserId: successorA.id,
    });
    if (created) {
      const items = await db
        .select()
        .from(schema.handoverItems)
        .where(eqH(schema.handoverItems.handoverId, created.id));
      let i = 0;
      for (const item of items) {
        if (i++ % 2 === 0) {
          await db
            .update(schema.handoverItems)
            .set({
              status: item.itemKind === "tacit_topic" ? "captured" : "reassigned",
              successorUserId: successorA.id,
              doneAt: now(),
            })
            .where(eqH(schema.handoverItems.id, item.id));
        }
      }
      await refreshHandoverCompletion(created.id);
    }
  }
  // 2: transferring, complete
  if (transferring && successorB) {
    const created = await startHandover(actor, {
      userId: transferring.id,
      kind: "transferring",
      dueDate: "2026-09-28",
      successorDefaultUserId: successorB.id,
    });
    if (created) {
      const items = await db
        .select()
        .from(schema.handoverItems)
        .where(eqH(schema.handoverItems.handoverId, created.id));
      for (const item of items) {
        await db
          .update(schema.handoverItems)
          .set({
            status: item.itemKind === "tacit_topic" ? "captured" : "reassigned",
            successorUserId: successorB.id,
            doneAt: now(),
          })
          .where(eqH(schema.handoverItems.id, item.id));
      }
      await refreshHandoverCompletion(created.id);
    }
  }
  // 3: leaving, open and past due (feeds the incomplete_handover rule)
  if (leaving2 && successorC) {
    const created = await startHandover(actor, {
      userId: leaving2.id,
      kind: "leaving",
      dueDate: "2026-09-05",
      successorDefaultUserId: successorC.id,
    });
    if (created) await refreshHandoverCompletion(created.id);
  }
  console.log("handovers seeded: 3");

  /* the risk register, computed by the real rules */
  const { recomputeHrRisks } = await import("../src/server/services/hr");
  const open = await recomputeHrRisks();
  console.log(`hr risks materialised: ${open} open`);
}

/* ------------------------------------------------------------------ */
/* CR05 6: the access model. The HR Admin system role and account, the  */
/* role portal sets, and the allowed sign-in domains.                   */
/* ------------------------------------------------------------------ */

export async function seedCr05Access(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const { setSetting, getSetting } = await import("../src/server/settings");
  const { defaultPortalsForRole } = await import("../src/server/auth/permissions");
  const { hashPassword } = await import("../src/server/auth/passwords");
  const { eq: eqA, isNull } = await import("drizzle-orm");

  const domains = await getSetting<string[] | null>("allowed_domains", null as never);
  if (!domains) await setSetting("allowed_domains", ["npc.qa"]);

  const roles = await db.select().from(schema.roles);
  let hrRole = roles.find((r) => r.nameEn === "HR Admin");
  if (!hrRole) {
    const knowledgeAdmin = roles.find((r) => r.nameEn === "Knowledge Admin");
    // read widely, manage nothing outside HR (the HR surfaces key off the role)
    const permissions: Record<string, Record<string, boolean>> = {};
    try {
      const base = JSON.parse(knowledgeAdmin?.permissionsJson ?? "{}");
      for (const [m, actions] of Object.entries(base as Record<string, Record<string, boolean>>)) {
        permissions[m] = { read: Boolean(actions.read) };
      }
    } catch {
      /* minimal */
    }
    const id = ulid();
    await db.insert(schema.roles).values({
      id,
      nameEn: "HR Admin",
      nameAr: "مسؤول الموارد البشرية",
      permissionsJson: JSON.stringify(permissions),
      defaultClearance: 3,
      defaultDepartmentScope: "all",
      isSystem: 1,
      portalsJson: JSON.stringify(defaultPortalsForRole("HR Admin")),
      createdAt: now(),
      updatedAt: now(),
    });
    hrRole = (await db.select().from(schema.roles).where(eqA(schema.roles.id, id)))[0];
    console.log("HR Admin role created");
  }

  /* stamp every role's portal set so the Roles page shows real columns */
  for (const r of await db.select().from(schema.roles)) {
    if (r.portalsJson) continue;
    await db
      .update(schema.roles)
      .set({ portalsJson: JSON.stringify(defaultPortalsForRole(r.nameEn)), updatedAt: now() })
      .where(eqA(schema.roles.id, r.id));
  }

  /* the HR Admin account */
  const users = await db.select().from(schema.users).where(isNull(schema.users.deletedAt));
  if (!users.some((u) => u.email === "hr@npc.qa")) {
    const dept = (await db.select().from(schema.departments)).find(
      (d) => d.code === "sg_office"
    );
    await db.insert(schema.users).values({
      id: ulid(),
      email: "hr@npc.qa",
      passwordHash: await hashPassword("Nexus!2026"),
      nameEn: "Noof Al-Suwaidi",
      nameAr: "نوف السويدي",
      avatarColor: "gold",
      departmentId: dept?.id ?? null,
      roleId: hrRole!.id,
      clearanceLevel: 3,
      departmentScope: "all",
      localePref: "en",
      positionEn: "Head of People and Knowledge Continuity",
      positionAr: "رئيسة وحدة الأشخاص واستمرارية المعرفة",
      passwordSetAt: now(),
      createdAt: now(),
      updatedAt: now(),
    });
    console.log("hr@npc.qa created (HR Admin)");
  }
}

export async function seedCr05(): Promise<void> {
  await seedCr05Entities();
  await seedCr05Stakeholders();
  await seedCr05Indices();
  // access first: the HR seed's risk owners fall back to hr@npc.qa
  await seedCr05Access();
  await seedCr05Hr();
}

const isMain = process.argv[1] && /cr05-seed\.ts$/.test(process.argv[1]);
if (isMain) {
  seedCr05()
    .then(() => {
      console.log("cr05 seed complete");
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
