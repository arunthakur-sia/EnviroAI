/* eslint-disable no-console */
// CR05 seeds. Section 2: the entities register, the owner_entity_name
// migration into node_leads, and lead assignments for every NES initiative
// and project. Section 3: stakeholders. Section 5: HR statuses, backups,
// handovers, responsibilities. Section 6: role portals, the HR Admin role,
// allowed domains. Idempotent: rows insert only when absent; the register
// upserts by English name. Run standalone (npx tsx scripts/cr05-seed.ts) or
// from seed.ts.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { and, asc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { findHomeEdition } from "./data/edition";

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

// The register: real public bodies with real names in both languages (CR05 2.1
// asks for at least 25). Websites appear only where the data source databank
// lists them. A few real predecessor bodies are kept as inactive rows so
// lineage stays honest.
const ENTITIES: EntitySeed[] = [
  { key: "mewa", en: "Ministry of Environment, Water and Agriculture", ar: "وزارة البيئة والمياه والزراعة", shortEn: "MEWA", shortAr: "البيئة والمياه والزراعة", kind: "ministry", website: "https://www.mewa.gov.sa/en" },
  { key: "ncec", en: "National Center for Environmental Compliance", ar: "المركز الوطني للرقابة على الالتزام البيئي", shortEn: "NCEC", shortAr: "الرقابة على الالتزام البيئي", kind: "agency", website: "https://ncec.gov.sa" },
  { key: "ncw", en: "National Center for Wildlife", ar: "المركز الوطني لتنمية الحياة الفطرية", shortEn: "NCW", shortAr: "الحياة الفطرية", kind: "agency", website: "https://ncw.gov.sa" },
  { key: "ncvc", en: "National Center for Vegetation Cover Development and Combating Desertification", ar: "المركز الوطني لتنمية الغطاء النباتي ومكافحة التصحر", shortEn: "NCVC", shortAr: "الغطاء النباتي", kind: "agency", website: "https://ncvc.gov.sa" },
  { key: "mwan", en: "National Center for Waste Management", ar: "المركز الوطني لإدارة النفايات", shortEn: "MWAN", shortAr: "موان", kind: "agency", website: "https://mwan.gov.sa/en" },
  { key: "envfund", en: "Environment Fund", ar: "صندوق البيئة", shortEn: "Environment Fund", shortAr: "صندوق البيئة", kind: "agency" },
  { key: "swa", en: "Saudi Water Authority", ar: "الهيئة السعودية للمياه", shortEn: "SWA", shortAr: "الهيئة السعودية للمياه", kind: "authority", website: "https://swa.gov.sa" },
  { key: "nwc", en: "National Water Company", ar: "شركة المياه الوطنية", shortEn: "NWC", shortAr: "المياه الوطنية", kind: "company", website: "https://www.nwc.com.sa" },
  { key: "wera", en: "Water and Electricity Regulatory Authority", ar: "هيئة تنظيم المياه والكهرباء", shortEn: "WERA", shortAr: "تنظيم المياه والكهرباء", kind: "authority", website: "https://wera.gov.sa" },
  { key: "gastat", en: "General Authority for Statistics", ar: "الهيئة العامة للإحصاء", shortEn: "GASTAT", shortAr: "الهيئة العامة للإحصاء", kind: "authority", website: "https://www.stats.gov.sa/en" },
  { key: "sdaia", en: "Saudi Data and AI Authority", ar: "الهيئة السعودية للبيانات والذكاء الاصطناعي", shortEn: "SDAIA", shortAr: "سدايا", kind: "authority", website: "https://data.gov.sa" },
  { key: "ncm", en: "National Center for Meteorology", ar: "المركز الوطني للأرصاد", shortEn: "NCM", shortAr: "الأرصاد", kind: "agency", website: "https://ncm.gov.sa" },
  { key: "sgs", en: "Saudi Geological Survey", ar: "هيئة المساحة الجيولوجية السعودية", shortEn: "SGS", shortAr: "المساحة الجيولوجية", kind: "authority", website: "https://sgs.gov.sa/en" },
  { key: "saso", en: "Saudi Standards, Metrology and Quality Organization", ar: "الهيئة السعودية للمواصفات والمقاييس والجودة", shortEn: "SASO", shortAr: "المواصفات والمقاييس", kind: "authority", website: "https://saso.gov.sa/en" },
  { key: "momrah", en: "Ministry of Municipal, Rural Affairs and Housing", ar: "وزارة الشؤون البلدية والقروية والإسكان", shortEn: "MOMRAH", shortAr: "الشؤون البلدية والقروية", kind: "ministry", website: "https://momrah.gov.sa/en" },
  { key: "moenergy", en: "Ministry of Energy", ar: "وزارة الطاقة", shortEn: "Ministry of Energy", shortAr: "وزارة الطاقة", kind: "ministry", website: "https://www.moenergy.gov.sa/en" },
  { key: "mim", en: "Ministry of Industry and Mineral Resources", ar: "وزارة الصناعة والثروة المعدنية", shortEn: "MIM", shortAr: "الصناعة والثروة المعدنية", kind: "ministry", website: "https://mim.gov.sa/en" },
  { key: "mof", en: "Ministry of Finance", ar: "وزارة المالية", shortEn: "MOF", shortAr: "المالية", kind: "ministry" },
  { key: "gfsa", en: "General Food Security Authority", ar: "الهيئة العامة للأمن الغذائي", shortEn: "GFSA", shortAr: "الأمن الغذائي", kind: "authority", website: "https://gfsa.gov.sa/en" },
  { key: "salic", en: "Saudi Agricultural and Livestock Investment Company", ar: "الشركة السعودية للاستثمار الزراعي والإنتاج الحيواني", shortEn: "SALIC", shortAr: "سالك", kind: "company", website: "https://salic.com" },
  { key: "pif", en: "Public Investment Fund", ar: "صندوق الاستثمارات العامة", shortEn: "PIF", shortAr: "الاستثمارات العامة", kind: "authority", website: "https://www.pif.gov.sa" },
  { key: "rcjy", en: "Royal Commission for Jubail and Yanbu", ar: "الهيئة الملكية للجبيل وينبع", shortEn: "RCJY", shortAr: "الجبيل وينبع", kind: "authority", website: "https://www.rcjy.gov.sa/en" },
  { key: "rcu", en: "Royal Commission for AlUla", ar: "الهيئة الملكية لمحافظة العلا", shortEn: "RCU", shortAr: "العلا", kind: "authority", website: "https://www.rcu.gov.sa" },
  { key: "sgi", en: "Saudi Green Initiative", ar: "مبادرة السعودية الخضراء", shortEn: "SGI", shortAr: "السعودية الخضراء", kind: "other", website: "https://sgi.gov.sa" },
  { key: "mgi", en: "Middle East Green Initiative", ar: "مبادرة الشرق الأوسط الأخضر", shortEn: "MGI", shortAr: "الشرق الأوسط الأخضر", kind: "other", website: "https://www.vision2030.gov.sa/en/projects/middle-east-green-initiative/" },
  { key: "kaust", en: "King Abdullah University of Science and Technology", ar: "جامعة الملك عبدالله للعلوم والتقنية", shortEn: "KAUST", shortAr: "كاوست", kind: "other", website: "https://www.kaust.edu.sa" },
  { key: "kfupm", en: "King Fahd University of Petroleum and Minerals", ar: "جامعة الملك فهد للبترول والمعادن", shortEn: "KFUPM", shortAr: "جامعة الملك فهد", kind: "other" },
  { key: "ksu", en: "King Saud University", ar: "جامعة الملك سعود", shortEn: "KSU", shortAr: "جامعة الملك سعود", kind: "other" },
  { key: "kacst", en: "King Abdulaziz City for Science and Technology", ar: "مدينة الملك عبدالعزيز للعلوم والتقنية", shortEn: "KACST", shortAr: "مدينة الملك عبدالعزيز", kind: "agency", website: "https://www.kacst.gov.sa" },
  { key: "kapsarc", en: "King Abdullah Petroleum Studies and Research Center", ar: "مركز الملك عبدالله للدراسات والبحوث البترولية", shortEn: "KAPSARC", shortAr: "كابسارك", kind: "other", website: "https://www.kapsarc.org" },
  { key: "fao", en: "Food and Agriculture Organization of the United Nations", ar: "منظمة الأغذية والزراعة للأمم المتحدة", shortEn: "FAO", shortAr: "الفاو", kind: "international", website: "https://www.fao.org" },
  { key: "worldbank", en: "World Bank", ar: "البنك الدولي", shortEn: "World Bank", shortAr: "البنك الدولي", kind: "international", website: "https://data.worldbank.org" },
  { key: "unep", en: "United Nations Environment Programme", ar: "برنامج الأمم المتحدة للبيئة", shortEn: "UNEP", shortAr: "برنامج الأمم المتحدة للبيئة", kind: "international" },
  { key: "undp", en: "United Nations Development Programme", ar: "برنامج الأمم المتحدة الإنمائي", shortEn: "UNDP", shortAr: "الأمم المتحدة الإنمائي", kind: "international" },
  // Real predecessor bodies (inactive)
  { key: "moa_hist", en: "Ministry of Agriculture", ar: "وزارة الزراعة", shortEn: "MoA", shortAr: "الزراعة", kind: "ministry", active: false },
  { key: "mowe_hist", en: "Ministry of Water and Electricity", ar: "وزارة المياه والكهرباء", shortEn: "MOWE", shortAr: "المياه والكهرباء", kind: "ministry", active: false },
  { key: "pme_hist", en: "Presidency of Meteorology and Environment", ar: "الرئاسة العامة للأرصاد وحماية البيئة", shortEn: "PME", shortAr: "الأرصاد وحماية البيئة", kind: "agency", active: false },
  { key: "ecra_hist", en: "Electricity and Co-Generation Regulatory Authority", ar: "هيئة تنظيم الكهرباء والإنتاج المزدوج", shortEn: "ECRA", shortAr: "تنظيم الكهرباء", kind: "authority", active: false },
];

// Aliases for owner_entity_name strings that differ from the register names.
// Anything else resolves by a case-insensitive match on the English or short
// name, then falls back to a new active register row.
const OWNER_MAP: Record<string, string> = {
  "ministry of environment, water & agriculture": "mewa",
  "ministry of environment water and agriculture": "mewa",
  "environment, water and agriculture": "mewa",
  "national center for vegetation cover & combating desertification": "ncvc",
  "national center for vegetation cover and combating desertification": "ncvc",
  "national centre for waste management": "mwan",
  "national centre for environmental compliance": "ncec",
  "national centre for wildlife": "ncw",
  "national centre for meteorology": "ncm",
  "general authority of statistics": "gastat",
  "statistics authority": "gastat",
  "saudi water authority (swa)": "swa",
  "national water company (nwc)": "nwc",
  "ministry of municipal and rural affairs and housing": "momrah",
  "ministry of municipal, rural affairs & housing": "momrah",
  "ministry of industry and mineral resources (mim)": "mim",
  "saudi green initiative (sgi)": "sgi",
  "pif": "pif",
  "public investment fund (pif)": "pif",
  "fao": "fao",
  "food and agriculture organization": "fao",
  "un environment programme": "unep",
  "united nations environment programme (unep)": "unep",
  "undp": "undp",
  "united nations development programme (undp)": "undp",
};

// Plausible lead pools per theme sort order (1..7: water, agriculture,
// climate, biodiversity, waste, air quality, regulatory), used only where the
// sources named nobody; those rows stay verified = 0.
const OUTCOME_POOLS: Record<number, string[]> = {
  1: ["mewa", "swa", "nwc", "wera", "sgs", "momrah", "kfupm"],
  2: ["mewa", "gfsa", "salic", "ncvc", "fao", "kaust", "worldbank"],
  3: ["mewa", "ncm", "sgi", "mgi", "moenergy", "kapsarc", "unep", "undp"],
  4: ["ncw", "ncvc", "rcu", "mewa", "kaust", "unep"],
  5: ["mwan", "momrah", "ncec", "envfund", "mim", "rcjy"],
  6: ["ncec", "ncm", "rcjy", "momrah", "moenergy", "kfupm"],
  7: ["ncec", "mewa", "saso", "sdaia", "gastat", "mof", "mim", "wera"],
};

// Programme Office unit co-lead pools per theme (unit codes). CR06 reuses
// the first code of each pool as the theme's unit owner.
export const OUTCOME_DEPTS: Record<number, string[]> = {
  1: ["WSD"],
  2: ["AFD", "PMD"],
  3: ["CLD"],
  4: ["BLD"],
  5: ["WCD", "PMD"],
  6: ["AQD"],
  7: ["RCM", "EDA"],
};

export async function seedCr05Entities(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");

  /* 1. the register: upsert by English name */
  const existing = await db.select().from(schema.entities);
  const byName = new Map(existing.map((e) => [e.nameEn.toLowerCase(), e]));
  const idOfKey = new Map<string, string>();
  // case-insensitive lookup over English and short names, for owner strings
  const idByLabel = new Map<string, string>();
  const labelIndex = (id: string, ...labels: (string | null | undefined)[]) => {
    for (const l of labels) if (l) idByLabel.set(l.trim().toLowerCase(), id);
  };
  for (const e of ENTITIES) {
    const found = byName.get(e.en.toLowerCase());
    if (found) {
      idOfKey.set(e.key, found.id);
      labelIndex(found.id, e.en, e.shortEn);
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
    labelIndex(eid, e.en, e.shortEn);
  }
  // rows already in the register (added by hand or by an earlier run)
  for (const e of existing) labelIndex(e.id, e.nameEn, e.shortNameEn);
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
    const lower = raw.toLowerCase();
    const key = OWNER_MAP[lower];
    let entityId = (key ? idOfKey.get(key) : undefined) ?? idByLabel.get(lower);
    if (!entityId) {
      // unexpected value: create an active register row named as given
      unmapped.add(raw);
      const eid = ulid();
      await db.insert(schema.entities).values({
        id: eid,
        nameEn: raw,
        nameAr: raw,
        shortNameEn: raw,
        shortNameAr: raw,
        kind: "other",
        isActive: 1,
        nameArMachine: 0,
        createdAt: now(),
        updatedAt: now(),
      });
      entityId = eid;
      labelIndex(eid, raw);
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
    `owner_entity_name migrated: ${migrated} leads${unmapped.size ? ` (${unmapped.size} unmapped values added to the register)` : ""}`
  );

  /* 3. every NES initiative and project gets a lead; joint unit leads
        and supporting entities are assigned deterministically (verified 0) */
  const homeEdition = await findHomeEdition(db, schema);
  if (!homeEdition) throw new Error("strategy edition missing");
  const delivery = nodes.filter(
    (n) =>
      n.editionId === homeEdition.id &&
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
    // roughly a third of delivery nodes are jointly led with a Programme Office unit
    if (h % 3 === 0) {
      const codes = OUTCOME_DEPTS[outcome] ?? ["SPD"];
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
    `NES lead coverage: +${assigned} assigned, ${joints} joint unit leads, ${supports} supporting rows`
  );
}

/* ------------------------------------------------------------------ */
/* CR05 3: stakeholders on every NES project (sponsor, owner, manager, */
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
  ["Faisal Al-Rashidi", "فيصل الرشيدي"],
  ["Reem Al-Zahrani", "ريم الزهراني"],
  ["Abdulaziz Al-Otaibi", "عبدالعزيز العتيبي"],
  ["Lama Al-Qahtani", "لمى القحطاني"],
  ["Saud Al-Dosari", "سعود الدوسري"],
];

export async function seedCr05Stakeholders(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const { eq: eq2, asc: asc2, inArray: inArray2 } = await import("drizzle-orm");

  const any = await db.select().from(schema.nodeStakeholders).limit(1);
  if (any.length) {
    console.log("node_stakeholders already seeded; skipping");
    return;
  }

  const homeEdition = await findHomeEdition(db, schema);
  if (!homeEdition) throw new Error("strategy edition missing");
  const nodes = await db
    .select()
    .from(schema.strategyNodes)
    .where(eq2(schema.strategyNodes.editionId, homeEdition.id))
    .orderBy(asc2(schema.strategyNodes.sort));
  const projects = nodes.filter((n) => n.nodeType === "project");

  const users = await db.select().from(schema.users);
  const alive = users.filter((u) => !u.deletedAt);
  const heads = alive.filter((u) => u.email.startsWith("head.") || u.email === "admin@enviroai.demo");
  const roleRows = await db.select().from(schema.roles);
  const roleName = new Map(roleRows.map((r) => [r.id, r.nameEn]));
  const contributors = alive.filter((u) =>
    ["Contributor", "Knowledge Admin", "Expert Verifier", "Department Head"].includes(
      roleName.get(u.roleId) ?? ""
    )
  );
  const teamPool = alive.filter((u) => u.email !== "admin@enviroai.demo");

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
      await add({
        personKind: "external_contact",
        nameEn: partner[0],
        nameAr: partner[1],
        organisation: ent?.nameEn ?? null,
        email: null,
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
  WSD: [
    "Leads the water security theme of the NES: demand and supply balance, desalination and wastewater reuse, and the water policy pipeline with MEWA, SWA and NWC.",
    "تقود محور الأمن المائي في الاستراتيجية الوطنية للبيئة: توازن العرض والطلب وتحلية المياه وإعادة استخدام المياه المعالجة وخط سياسات المياه مع وزارة البيئة والمياه والزراعة والهيئة السعودية للمياه وشركة المياه الوطنية.",
  ],
  AFD: [
    "Leads the agriculture and food security theme: sustainable farming, agricultural water use, food supply resilience, and alignment with GFSA and FAO.",
    "تقود محور الأمن الغذائي والزراعة: الزراعة المستدامة واستخدام المياه الزراعية ومرونة إمدادات الغذاء والمواءمة مع الهيئة العامة للأمن الغذائي ومنظمة الفاو.",
  ],
  CLD: [
    "Leads the climate and environment theme: emissions and adaptation tracking, the Saudi Green Initiative targets, and climate data partnerships.",
    "تقود محور المناخ والبيئة: تتبع الانبعاثات والتكيف ومستهدفات مبادرة السعودية الخضراء وشراكات بيانات المناخ.",
  ],
  BLD: [
    "Leads the biodiversity and land theme: protected areas, wildlife, vegetation cover, and desertification indicators with NCW and NCVC.",
    "تقود محور التنوع الأحيائي والأراضي: المحميات والحياة الفطرية والغطاء النباتي ومؤشرات التصحر مع المركز الوطني لتنمية الحياة الفطرية والمركز الوطني لتنمية الغطاء النباتي.",
  ],
  WCD: [
    "Leads the waste and circular economy theme: waste data, recycling targets, and coordination with MWAN and the Environment Fund.",
    "تقود محور النفايات والاقتصاد الدائري: بيانات النفايات ومستهدفات إعادة التدوير والتنسيق مع المركز الوطني لإدارة النفايات وصندوق البيئة.",
  ],
  AQD: [
    "Leads the air quality theme: monitoring network data, air quality indices, and coordination with NCEC and NCM.",
    "تقود محور جودة الهواء: بيانات شبكة الرصد ومؤشرات جودة الهواء والتنسيق مع المركز الوطني للرقابة على الالتزام البيئي والمركز الوطني للأرصاد.",
  ],
  RCM: [
    "Tracks regulatory compliance and change: the regulatory register, enforcement signals, and compliance reporting across the sector.",
    "تتابع الامتثال التنظيمي والتغيرات التنظيمية: السجل التنظيمي وإشارات الإنفاذ وتقارير الامتثال على مستوى القطاع.",
  ],
  FRS: [
    "Runs horizon scanning, the signals pipeline, environmental risk registers, and futures work that feeds the mid-term review.",
    "تدير استشراف الأفق وخط الإشارات وسجلات المخاطر البيئية وأعمال المستقبلات التي تغذي مراجعة منتصف المدة.",
  ],
  PMD: [
    "Owns the NES results framework: KPI collection, status updates, delivery reviews, and the evaluation calendar.",
    "تملك إطار نتائج الاستراتيجية الوطنية للبيئة: جمع مؤشرات الأداء وتحديثات الحالة ومراجعات الإنجاز وتقويم التقييم.",
  ],
  EDA: [
    "Coordinates environmental data governance, data sharing agreements, and the registers behind the indicators.",
    "تنسق حوكمة البيانات البيئية واتفاقيات تبادل البيانات والسجلات التي تقوم عليها المؤشرات.",
  ],
  DOP: [
    "Runs environmental monitoring operations, remote sensing and administrative record collection, and the production of data releases.",
    "تدير عمليات الرصد البيئي والاستشعار عن بعد وجمع السجلات الإدارية وإنتاج إصدارات البيانات.",
  ],
  DSY: [
    "Builds and maintains the data production systems, classifications, and quality frameworks.",
    "تبني وتشغل نظم إنتاج البيانات والتصنيفات وأطر الجودة.",
  ],
  SPD: [
    "Develops the Programme Strategy, institutional modernisation, and excellence programmes with partner entities.",
    "تطور استراتيجية المكتب وبرامج التحديث المؤسسي والتميز مع الجهات الشريكة.",
  ],
  DIG: [
    "Operates EnviroAI and the Office's digital platforms, integrations, and information security posture.",
    "تشغل EnviroAI والمنصات الرقمية للمكتب وتكاملاتها ووضعها في أمن المعلومات.",
  ],
  OPD: [
    "Supports the Programme Director: steering committee coordination, entity relations, and the Office's decision pipeline.",
    "يساند مدير البرنامج: التنسيق مع اللجنة التوجيهية وعلاقات الجهات وخط قرارات المكتب.",
  ],
};

// Placeholder department codes in legacy rows resolve to the new units.
const LEGACY_UNIT: Record<string, string> = {
  econ_planning: "WSD",
  foresight_risk: "FRS",
  it_dept: "DIG",
  monitoring_eval: "PMD",
  national_data: "EDA",
  planning_policies: "SPD",
  sg_office: "OPD",
  social_planning: "AFD",
  stat_operations: "DOP",
  stat_systems: "DSY",
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
    const r = DEPT_RESPONSIBILITIES[d.code] ?? DEPT_RESPONSIBILITIES[LEGACY_UNIT[d.code] ?? ""];
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
  const admin = byEmail.get("admin@enviroai.demo")!;

  /* statuses: two leaving, one transferring, one long leave (5.8) */
  const leaving1 = byEmail.get("tariq.alsulami@enviroai.demo");
  const leaving2 = byEmail.get("sarah.alanazi@enviroai.demo");
  const transferring = byEmail.get("nasser.almutlaq@enviroai.demo");
  const longLeave = byEmail.get("munira.althaqafi@enviroai.demo");
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
          ? departments.find((d) => d.code === "EDA" || d.code === "national_data")?.id ?? null
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
  const pool = users.filter((u) => !["admin@enviroai.demo"].includes(u.email));
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
  const successorA = byEmail.get("sara.alansari@enviroai.demo");
  const successorB = byEmail.get("omar.almansour@enviroai.demo");
  const successorC = byEmail.get("asma.alajlan@enviroai.demo");

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
  if (!domains) await setSetting("allowed_domains", ["enviroai.demo"]);

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
  if (!users.some((u) => u.email === "hr@enviroai.demo")) {
    const dept = (await db.select().from(schema.departments)).find(
      (d) => d.code === "OPD" || d.code === "sg_office"
    );
    await db.insert(schema.users).values({
      id: ulid(),
      email: "hr@enviroai.demo",
      passwordHash: await hashPassword("EnviroAI!2026"),
      nameEn: "Noof Al-Suwaidi",
      nameAr: "نوف السويدي",
      avatarColor: "aqua",
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
    console.log("hr@enviroai.demo created (HR Admin)");
  }
}

export async function seedCr05(): Promise<void> {
  await seedCr05Entities();
  await seedCr05Stakeholders();
  await seedCr05Indices();
  // access first: the HR seed's risk owners fall back to hr@enviroai.demo
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
