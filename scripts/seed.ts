/* eslint-disable no-console */
// Builds the full seeded SiaNexus database from /sources and scripts/seed-content.
// Drops and recreates. Run: npm run seed
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "../src/lib/load-env";

loadEnv();

import { migrate } from "./migrate";

const ROOT = process.cwd();
const CONTENT = path.join(ROOT, "scripts", "seed-content");
const SOURCES = path.join(ROOT, "sources");

function readPack<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(CONTENT, name), "utf8")) as T;
}

function pickBi(item: Record<string, unknown>, key: string): { en: string; ar: string } {
  return { en: String(item[`${key}_en`] ?? ""), ar: String(item[`${key}_ar`] ?? "") };
}

async function main() {
  console.log("== SiaNexus seed ==");
  const t0 = Date.now();

  // 1. reset database
  const dataDir = path.join(ROOT, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  for (const f of ["nexus.db", "nexus.db-wal", "nexus.db-shm"]) {
    try {
      fs.rmSync(path.join(dataDir, f), { force: true });
    } catch { /* locked? proceed */ }
  }
  await migrate();

  // late imports so the fresh db file is used
  const { db, schema, rawClient } = await import("../src/server/db/client");
  const { newId, nowIso, todayIso } = await import("../src/lib/ids");
  const { hashPassword } = await import("../src/server/auth/passwords");
  const { parseDocument } = await import("../src/server/ingest/parse");
  const { chunkDocument } = await import("../src/server/ingest/chunker");
  const { embedTexts, float32ToBuffer } = await import("../src/server/ai/embeddings");
  const { mockEnrich, mockAnswer } = await import("../src/server/ai/mock");
  const { retrieveChunks } = await import("../src/server/search/hybrid");
  const { embedStructuredRecords } = await import("../src/server/search/records");

  const report: Record<string, number> = {};
  const toVerify: string[] = [];
  const now = nowIso();
  const bump = (k: string, n = 1) => (report[k] = (report[k] ?? 0) + n);

  /* ---------------- 2. classification + taxonomy ---------------- */
  const taxonomyPack = readPack<{
    dimensions: { code: string; name_en: string; name_ar: string; is_hierarchical: boolean }[];
    terms: {
      dimension: string;
      code: string;
      name_en: string;
      name_ar: string;
      description_en?: string;
      description_ar?: string;
      sort: number;
    }[];
    departments: { code: string; name_en: string; name_ar: string; description_en: string; description_ar: string }[];
    users: {
      email: string;
      name_en: string;
      name_ar: string;
      position_en: string;
      position_ar: string;
      department_code: string;
      role: string;
      clearance_level: number;
      avatar_color: string;
      locale_pref: string;
      is_head: boolean;
    }[];
  }>("taxonomy-org.json");

  const classLevels = [
    { level: 1, nameEn: "Public", nameAr: "عام", color: "#0F6E76" },
    { level: 2, nameEn: "Internal", nameAr: "داخلي", color: "#928B93" },
    { level: 3, nameEn: "Confidential", nameAr: "سري", color: "#B7791F" },
    { level: 4, nameEn: "Secret", nameAr: "سري للغاية", color: "#B3261E" },
  ];
  for (const c of classLevels) {
    await db.insert(schema.classificationLevels).values({
      id: newId(),
      level: c.level,
      nameEn: c.nameEn,
      nameAr: c.nameAr,
      color: c.color,
    });
  }

  const dimIds = new Map<string, string>();
  for (const d of taxonomyPack.dimensions) {
    const id = newId();
    dimIds.set(d.code, id);
    await db.insert(schema.taxonomyDimensions).values({
      id,
      code: d.code,
      nameEn: d.name_en,
      nameAr: d.name_ar,
      isHierarchical: d.is_hierarchical ? 1 : 0,
    });
  }
  // years dimension generated in code
  const yearDimId = newId();
  await db.insert(schema.taxonomyDimensions).values({
    id: yearDimId,
    code: "year",
    nameEn: "Year",
    nameAr: "السنة",
    isHierarchical: 0,
  });
  const termIdByKey = new Map<string, string>(); // `${dimension}:${code}` -> id
  for (const term of taxonomyPack.terms) {
    const dimensionId = dimIds.get(term.dimension);
    if (!dimensionId) continue;
    const id = newId();
    termIdByKey.set(`${term.dimension}:${term.code}`, id);
    await db.insert(schema.taxonomyTerms).values({
      id,
      dimensionId,
      code: term.code,
      nameEn: term.name_en,
      nameAr: term.name_ar,
      descriptionEn: term.description_en ?? null,
      descriptionAr: term.description_ar ?? null,
      sort: term.sort ?? 0,
    });
    bump("taxonomy_terms");
  }
  for (let y = 2008; y <= 2026; y++) {
    const id = newId();
    termIdByKey.set(`year:${y}`, id);
    await db.insert(schema.taxonomyTerms).values({
      id,
      dimensionId: yearDimId,
      code: String(y),
      nameEn: String(y),
      nameAr: String(y),
      sort: y,
    });
  }

  /* ---------------- 3. roles, departments, users ---------------- */
  const allTrue = Object.fromEntries(
    ["vault", "strategy", "statistics", "experts", "ask", "lessons", "foresight", "settings", "analytics", "gamification"].map(
      (m) => [m, Object.fromEntries(["read", "create", "edit_own", "edit_any", "verify", "delete", "manage"].map((a) => [a, true]))]
    )
  );
  const readerMatrix = Object.fromEntries(
    ["vault", "strategy", "statistics", "experts", "ask", "lessons", "foresight"].map((m) => [
      m,
      { read: true, create: m === "ask" },
    ])
  );
  const contributorMatrix = Object.fromEntries(
    ["vault", "strategy", "statistics", "experts", "ask", "lessons", "foresight"].map((m) => [
      m,
      { read: true, create: true, edit_own: true },
    ])
  );
  const verifierMatrix = {
    ...contributorMatrix,
    vault: { read: true, create: true, edit_own: true, verify: true },
    ask: { read: true, create: true, edit_own: true, verify: true },
    lessons: { read: true, create: true, edit_own: true, verify: true },
    statistics: { read: true, create: true, edit_own: true, verify: true },
  };
  const headMatrix = {
    ...verifierMatrix,
    vault: { read: true, create: true, edit_own: true, edit_any: true, verify: true },
    strategy: { read: true, create: true, edit_own: true, edit_any: true, verify: true },
    analytics: { read: true },
    gamification: { read: true, manage: true },
  };
  const knowledgeAdminMatrix = {
    ...allTrue,
    settings: { read: true },
    analytics: { read: true, manage: true },
  };

  const roleDefs: Record<string, { nameEn: string; nameAr: string; matrix: object; clearance: number; scope: string; system: boolean }> = {
    super_admin: { nameEn: "Super Admin", nameAr: "المشرف العام", matrix: allTrue, clearance: 4, scope: "all", system: true },
    knowledge_admin: { nameEn: "Knowledge Admin", nameAr: "مشرف المعرفة", matrix: knowledgeAdminMatrix, clearance: 3, scope: "all", system: true },
    department_head: { nameEn: "Department Head", nameAr: "مدير إدارة", matrix: headMatrix, clearance: 3, scope: "own", system: true },
    expert_verifier: { nameEn: "Expert Verifier", nameAr: "موثق خبير", matrix: verifierMatrix, clearance: 3, scope: "all", system: true },
    contributor: { nameEn: "Contributor", nameAr: "مساهم", matrix: contributorMatrix, clearance: 2, scope: "all", system: true },
    reader: { nameEn: "Reader", nameAr: "قارئ", matrix: readerMatrix, clearance: 2, scope: "all", system: true },
  };
  const roleIds = new Map<string, string>();
  for (const [code, def] of Object.entries(roleDefs)) {
    const id = newId();
    roleIds.set(code, id);
    await db.insert(schema.roles).values({
      id,
      nameEn: def.nameEn,
      nameAr: def.nameAr,
      permissionsJson: JSON.stringify(def.matrix),
      defaultClearance: def.clearance,
      defaultDepartmentScope: def.scope,
      isSystem: def.system ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  const deptIds = new Map<string, string>();
  for (const d of taxonomyPack.departments) {
    const id = newId();
    deptIds.set(d.code, id);
    await db.insert(schema.departments).values({
      id,
      code: d.code,
      nameEn: d.name_en,
      nameAr: d.name_ar,
      descriptionEn: d.description_en,
      descriptionAr: d.description_ar,
      createdAt: now,
      updatedAt: now,
    });
    bump("departments");
  }

  const passwordHash = await hashPassword("Nexus!2026");
  const userIdByEmail = new Map<string, string>();
  const employeePool: string[] = []; // ids of non-named users for employee:N mapping
  const NAMED = new Set([
    "admin@npc.qa",
    "knowledge@npc.qa",
    "head.stats@npc.qa",
    "verifier@npc.qa",
    "analyst@npc.qa",
    "reader@npc.qa",
  ]);
  for (const u of taxonomyPack.users) {
    const id = newId();
    userIdByEmail.set(u.email.toLowerCase(), id);
    if (!NAMED.has(u.email.toLowerCase())) employeePool.push(id);
    await db.insert(schema.users).values({
      id,
      email: u.email.toLowerCase(),
      passwordHash,
      nameEn: u.name_en,
      nameAr: u.name_ar,
      positionEn: u.position_en,
      positionAr: u.position_ar,
      avatarColor: ["maroon", "gulf", "gold"].includes(u.avatar_color) ? u.avatar_color : "maroon",
      departmentId: deptIds.get(u.department_code) ?? null,
      roleId: roleIds.get(u.role) ?? roleIds.get("reader")!,
      clearanceLevel: u.clearance_level,
      departmentScope: u.role === "department_head" ? "own" : "all",
      localePref: u.locale_pref === "ar" ? "ar" : "en",
      createdAt: now,
      updatedAt: now,
    });
    // CR01 3.1: the onboarding quest was removed; nothing to mark.
    if (u.is_head) {
      const deptId = deptIds.get(u.department_code);
      if (deptId) {
        await db.update(schema.departments).set({ headUserId: id }).where(
          (await import("drizzle-orm")).eq(schema.departments.id, deptId)
        );
      }
    }
    bump("users");
  }
  const uid = (ref: string): string => {
    if (ref.startsWith("employee:")) {
      const n = Number(ref.split(":")[1]) || 1;
      return employeePool[(n - 1) % employeePool.length];
    }
    return userIdByEmail.get(ref.toLowerCase()) ?? employeePool[0];
  };
  const deptOfUser = new Map<string, string | null>();
  for (const u of taxonomyPack.users) {
    deptOfUser.set(userIdByEmail.get(u.email.toLowerCase())!, deptIds.get(u.department_code) ?? null);
  }
  const headOfDept = new Map<string, string>(); // dept code -> head user id
  for (const u of taxonomyPack.users) {
    if (u.is_head) headOfDept.set(u.department_code, userIdByEmail.get(u.email.toLowerCase())!);
  }

  // expert profiles for employees
  const expertIdByUserId = new Map<string, string>();
  for (const u of taxonomyPack.users) {
    const userId = userIdByEmail.get(u.email.toLowerCase())!;
    const id = newId();
    expertIdByUserId.set(userId, id);
    await db.insert(schema.experts).values({
      id,
      userId,
      type: "npc_employee",
      nameEn: u.name_en,
      nameAr: u.name_ar,
      avatarColor: u.avatar_color,
      organisationEn: "National Planning Council",
      organisationAr: "المجلس الوطني للتخطيط",
      positionEn: u.position_en,
      positionAr: u.position_ar,
      availability: "available",
      clearanceLevel: u.clearance_level,
      ownerUserId: userId,
      isVerified: 1,
      visibilityClassification: 2,
      createdAt: now,
      updatedAt: now,
    });
    bump("experts_employees");
  }

  /* ---------------- 4. indicators ---------------- */
  const indicatorsPack = readPack<{
    indicators: {
      code: string;
      name_en: string;
      name_ar: string;
      definition_en: string;
      definition_ar: string;
      unit: string;
      decimals: number;
      frequency: string;
      category_code: string;
      direction: string;
      is_headline: boolean;
      source_en: string;
      source_ar: string;
      methodology_en?: string;
      methodology_ar?: string;
      dimensions?: { code: string; values: string[] }[];
      series?: { period: string; value: number; status?: string; note?: string | null }[];
      series_dimensioned?: { period: string; dimension_key: string; value: number; status?: string; note?: string | null }[];
    }[];
    releases: {
      title_en: string;
      title_ar: string;
      release_date: string;
      summary_en: string;
      summary_ar: string;
      indicator_codes: string[];
    }[];
  }>("indicators.json");

  const indicatorIdByCode = new Map<string, string>();
  for (const ind of indicatorsPack.indicators) {
    const id = newId();
    indicatorIdByCode.set(ind.code, id);
    const series = ind.series ?? [];
    const periods = series.map((s) => s.period).sort();
    await db.insert(schema.indicators).values({
      id,
      code: ind.code,
      nameEn: ind.name_en,
      nameAr: ind.name_ar,
      definitionEn: ind.definition_en,
      definitionAr: ind.definition_ar,
      unit: ind.unit || null,
      decimals: ind.decimals ?? 0,
      frequency: ind.frequency,
      sourceEn: ind.source_en,
      sourceAr: ind.source_ar,
      methodologyEn: ind.methodology_en ?? null,
      methodologyAr: ind.methodology_ar ?? null,
      categoryTermId: termIdByKey.get(`stat_category:${ind.category_code}`) ?? null,
      classificationLevel: 1,
      direction: ind.direction === "down_good" ? "down_good" : "up_good",
      firstPeriod: periods[0] ?? null,
      lastPeriod: periods[periods.length - 1] ?? null,
      isHeadline: ind.is_headline ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    });
    bump("indicators");
    for (const d of ind.dimensions ?? []) {
      await db.insert(schema.indicatorDimensions).values({
        id: newId(),
        indicatorId: id,
        code: d.code,
        valuesJson: JSON.stringify(d.values),
      });
    }
    for (const v of series) {
      await db.insert(schema.indicatorValues).values({
        id: newId(),
        indicatorId: id,
        period: v.period,
        value: v.value,
        dimensionKey: "total",
        status: v.status ?? "provisional",
        note: v.note ?? null,
        createdAt: now,
      });
      bump("indicator_values");
    }
    for (const v of ind.series_dimensioned ?? []) {
      await db.insert(schema.indicatorValues).values({
        id: newId(),
        indicatorId: id,
        period: v.period,
        value: v.value,
        dimensionKey: v.dimension_key,
        status: v.status ?? "provisional",
        note: v.note ?? null,
        createdAt: now,
      });
      bump("indicator_values");
    }
    if (series.some((s) => s.note?.includes("illustrative"))) {
      toVerify.push(`indicator ${ind.code}: illustrative series`);
    }
  }

  /* ---------------- 5. strategy ---------------- */
  const strategyPack = readPack<{
    editions: {
      code: string;
      name_en: string;
      name_ar: string;
      period_from: number;
      period_to: number;
      status: string;
      is_default: boolean;
      summary_en: string;
      summary_ar: string;
    }[];
    nodes: {
      key: string;
      edition: string;
      parent_key: string | null;
      node_type: string;
      code?: string | null;
      title_en: string;
      title_ar: string;
      description_en?: string;
      description_ar?: string;
      status: string;
      start_date?: string | null;
      end_date?: string | null;
      budget_qar?: number | null;
      owner_entity_name?: string | null;
      owner_department_code?: string | null;
      sort: number;
      source_ref?: string | null;
      verified: boolean;
    }[];
    kpis: {
      node_key: string;
      name_en: string;
      name_ar: string;
      unit?: string;
      direction: string;
      baseline_value?: number | null;
      baseline_year?: number | null;
      target_value?: number | null;
      target_year?: number | null;
      frequency?: string;
      indicator_code?: string | null;
      series?: { period: string; value: number }[];
    }[];
    lineage: { from_key: string; to_key: string; relation: string; note_en: string; note_ar: string }[];
    dependencies: { node_key: string; depends_on_key: string; note?: string }[];
  }>("strategy.json");

  const editionIdByCode = new Map<string, string>();
  for (const e of strategyPack.editions) {
    const id = newId();
    editionIdByCode.set(e.code, id);
    await db.insert(schema.strategyEditions).values({
      id,
      code: e.code,
      nameEn: e.name_en,
      nameAr: e.name_ar,
      periodFrom: e.period_from,
      periodTo: e.period_to,
      status: e.status === "live" ? "live" : "archived",
      summaryEn: e.summary_en,
      summaryAr: e.summary_ar,
      isDefault: e.is_default ? 1 : 0,
    });
  }
  const nodeIdByKey = new Map<string, string>();
  for (const n of strategyPack.nodes) nodeIdByKey.set(n.key, newId());
  for (const n of strategyPack.nodes) {
    const editionId = editionIdByCode.get(n.edition);
    if (!editionId) continue;
    await db.insert(schema.strategyNodes).values({
      id: nodeIdByKey.get(n.key)!,
      editionId,
      parentId: n.parent_key ? (nodeIdByKey.get(n.parent_key) ?? null) : null,
      nodeType: n.node_type,
      code: n.code ?? null,
      titleEn: n.title_en,
      titleAr: n.title_ar,
      descriptionEn: n.description_en ?? null,
      descriptionAr: n.description_ar ?? null,
      ownerUserId: n.owner_department_code
        ? (headOfDept.get(n.owner_department_code) ?? null)
        : null,
      ownerEntityName: n.owner_entity_name ?? null,
      status: n.status,
      startDate: n.start_date ?? null,
      endDate: n.end_date ?? null,
      budgetQar: n.budget_qar ?? null,
      sort: n.sort ?? 0,
      sourceRef: n.source_ref ?? null,
      verified: n.verified ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    });
    bump("strategy_nodes");
    if (!n.verified) toVerify.push(`node ${n.key}: unverified wording`);
  }
  for (const k of strategyPack.kpis) {
    const nodeId = nodeIdByKey.get(k.node_key);
    if (!nodeId) continue;
    const kpiId = newId();
    await db.insert(schema.kpis).values({
      id: kpiId,
      nodeId,
      nameEn: k.name_en,
      nameAr: k.name_ar,
      unit: k.unit ?? null,
      direction: k.direction === "down_good" ? "down_good" : "up_good",
      baselineValue: k.baseline_value ?? null,
      baselineYear: k.baseline_year ?? null,
      targetValue: k.target_value ?? null,
      targetYear: k.target_year ?? null,
      frequency: k.frequency ?? "annual",
      indicatorId: k.indicator_code ? (indicatorIdByCode.get(k.indicator_code) ?? null) : null,
    });
    bump("kpis");
    for (const v of k.series ?? []) {
      await db.insert(schema.kpiValues).values({
        id: newId(),
        kpiId,
        period: v.period,
        actualValue: v.value,
        note: "seeded illustrative value",
        createdAt: now,
      });
      bump("kpi_values");
    }
  }
  for (const l of strategyPack.lineage) {
    const from = nodeIdByKey.get(l.from_key);
    const to = nodeIdByKey.get(l.to_key);
    if (!from || !to) continue;
    await db.insert(schema.nodeLineage).values({
      id: newId(),
      fromNodeId: from,
      toNodeId: to,
      relation: l.relation,
      noteEn: l.note_en,
      noteAr: l.note_ar,
    });
    bump("node_lineage");
  }
  for (const d of strategyPack.dependencies) {
    const a = nodeIdByKey.get(d.node_key);
    const b = nodeIdByKey.get(d.depends_on_key);
    if (!a || !b) continue;
    await db.insert(schema.nodeDependencies).values({
      id: newId(),
      nodeId: a,
      dependsOnNodeId: b,
      note: d.note ?? null,
    });
  }
  // a handful of recent status updates so "What changed" has life
  const nds3Projects = strategyPack.nodes.filter(
    (n) => n.edition === "nds3" && (n.node_type === "project" || n.node_type === "initiative")
  );
  const updateAuthors = [uid("analyst@npc.qa"), uid("knowledge@npc.qa"), uid("head.stats@npc.qa")];
  for (let i = 0; i < Math.min(8, nds3Projects.length); i++) {
    const n = nds3Projects[(i * 9) % nds3Projects.length];
    const daysAgo = [1, 2, 3, 5, 6, 12, 20, 28][i] ?? 3;
    const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
    await db.insert(schema.statusUpdates).values({
      id: newId(),
      nodeId: nodeIdByKey.get(n.key)!,
      authorId: updateAuthors[i % updateAuthors.length],
      status: n.status === "not_started" ? "on_track" : n.status,
      progressPct: [15, 30, 45, 55, 60, 70, 80, 90][i] ?? 50,
      summaryEn: `Delivery review completed for ${n.title_en}. Milestones tracked against the approved plan.`,
      summaryAr: `اكتملت مراجعة التنفيذ لـ${n.title_ar}. وتجري متابعة المعالم وفق الخطة المعتمدة.`,
      risksJson:
        i % 3 === 0
          ? JSON.stringify([{ text_en: "Data sharing agreement pending with one entity", text_ar: "اتفاقية مشاركة بيانات معلقة مع جهة واحدة", severity: "medium" }])
          : null,
      nextStepsJson: JSON.stringify([
        { text_en: "Confirm next quarter milestones with the delivery office", text_ar: "تأكيد معالم الربع القادم مع مكتب التنفيذ" },
      ]),
      period: "2026-Q3",
      createdAt,
    });
    bump("status_updates");
  }

  /* ---------------- 6. releases ---------------- */
  for (const r of indicatorsPack.releases) {
    await db.insert(schema.releases).values({
      id: newId(),
      titleEn: r.title_en,
      titleAr: r.title_ar,
      releaseDate: r.release_date,
      indicatorIdsJson: JSON.stringify(
        r.indicator_codes.map((c) => indicatorIdByCode.get(c)).filter(Boolean)
      ),
      summaryEn: r.summary_en,
      summaryAr: r.summary_ar,
    });
    bump("releases");
  }

  /* ---------------- 7. documents from /sources ---------------- */
  console.log("-- ingesting source documents (parse + chunk + embed)...");
  type Manifest = { url: string; filename: string; status: string; notes?: string }[];
  let manifest: Manifest = [];
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(SOURCES, "manifest.json"), "utf8"));
  } catch { /* no sources fetched */ }
  const okFiles = manifest.filter(
    (m) => (m.status === "ok" || m.status === "exists") && fs.existsSync(path.join(SOURCES, m.filename))
  );
  // dedupe by filename
  const seen = new Set<string>();
  const files = okFiles.filter((m) => {
    if (seen.has(m.filename)) return false;
    seen.add(m.filename);
    // skip machine artifacts
    return !/^opendata_catalog|manifest|SOURCES/.test(m.filename) && !m.filename.endsWith(".txt");
  });

  // pre-authored bilingual metadata for the flagship documents
  const authored: Record<
    string,
    { titleEn: string; titleAr: string; summaryEn: string; summaryAr: string; type: string; outcomes: string[]; topics: string[]; year: number }
  > = {
    "QNDS3_EN.pdf": {
      titleEn: "Third National Development Strategy 2024-2030",
      titleAr: "استراتيجية التنمية الوطنية الثالثة 2024-2030",
      summaryEn:
        "The Third National Development Strategy is Qatar's final delivery plan toward Qatar National Vision 2030. It sets seven strategic national outcomes: sustainable economic growth, fiscal sustainability, a future-ready workforce, a cohesive society, quality of life, environmental sustainability, and government excellence. The strategy targets average real GDP growth of around 4 percent to 2030, driven by productivity and non-hydrocarbon expansion through priority economic clusters, and is delivered through a portfolio of national programmes and projects with clear governance, measurable targets, and named accountability across more than twenty sector teams.",
      summaryAr:
        "استراتيجية التنمية الوطنية الثالثة هي خطة قطر التنفيذية الأخيرة نحو رؤية قطر الوطنية 2030. وتحدد سبع نتائج وطنية استراتيجية: النمو الاقتصادي المستدام، والاستدامة المالية، وقوى عاملة جاهزة للمستقبل، ومجتمع متماسك، وجودة الحياة، والاستدامة البيئية، والتميز الحكومي. وتستهدف الاستراتيجية نمواً حقيقياً للناتج المحلي بمتوسط 4 بالمئة سنوياً حتى 2030، مدفوعاً بالإنتاجية وتوسع القطاع غير الهيدروكربوني عبر عناقيد اقتصادية ذات أولوية، وتُنفذ من خلال محفظة برامج ومشاريع وطنية بحوكمة واضحة ومستهدفات قابلة للقياس ومساءلة محددة عبر أكثر من عشرين فريقاً قطاعياً.",
      type: "strategy",
      outcomes: ["eco_growth", "fiscal_sust", "workforce", "cohesive_society", "quality_life", "env_sust", "gov_excellence"],
      topics: ["strategy_design", "strategy_delivery"],
      year: 2024,
    },
    "QNDS3_AR.pdf": {
      titleEn: "Third National Development Strategy 2024-2030 (Arabic)",
      titleAr: "استراتيجية التنمية الوطنية الثالثة 2024-2030",
      summaryEn:
        "The Arabic edition of the Third National Development Strategy 2024-2030, presenting the seven strategic national outcomes, headline national targets, priority economic clusters, and the delivery and governance model that carries Qatar to its National Vision 2030.",
      summaryAr:
        "النسخة العربية من استراتيجية التنمية الوطنية الثالثة 2024-2030، وتعرض النتائج الوطنية الاستراتيجية السبع والمستهدفات الوطنية الرئيسية والعناقيد الاقتصادية ذات الأولوية ونموذج التنفيذ والحوكمة الذي يقود قطر نحو رؤيتها الوطنية 2030.",
      type: "strategy",
      outcomes: ["eco_growth", "gov_excellence"],
      topics: ["strategy_design", "strategy_delivery"],
      year: 2024,
    },
    "www.npc.qa_en_planning_Documents_nds2_NDS2Final.pdf": {
      titleEn: "Second National Development Strategy 2018-2022",
      titleAr: "استراتيجية التنمية الوطنية الثانية 2018-2022",
      summaryEn:
        "Qatar's Second National Development Strategy set the country's development agenda for 2018-2022 across twelve sector strategies, from economic diversification and infrastructure to healthcare, education, and environmental management. It introduced a strengthened delivery framework with defined institutional responsibilities and formed the bridge between the first strategy's foundations and the outcome-driven Third National Development Strategy.",
      summaryAr:
        "حددت استراتيجية التنمية الوطنية الثانية أجندة التنمية في قطر للفترة 2018-2022 عبر اثنتي عشرة استراتيجية قطاعية، من التنويع الاقتصادي والبنية التحتية إلى الرعاية الصحية والتعليم والإدارة البيئية. وقدمت إطار تنفيذ معززاً بمسؤوليات مؤسسية محددة، وشكلت الجسر بين أسس الاستراتيجية الأولى واستراتيجية التنمية الوطنية الثالثة القائمة على النتائج.",
      type: "strategy",
      outcomes: [],
      topics: ["strategy_design", "me_monitoring"],
      year: 2018,
    },
    "www.npc.qa_ar_planning_Documents_nds2_NDS2Final.pdf": {
      titleEn: "Second National Development Strategy 2018-2022 (Arabic)",
      titleAr: "استراتيجية التنمية الوطنية الثانية 2018-2022",
      summaryEn:
        "The Arabic edition of the Second National Development Strategy 2018-2022 with its twelve sector strategies and delivery framework.",
      summaryAr:
        "النسخة العربية من استراتيجية التنمية الوطنية الثانية 2018-2022 باستراتيجياتها القطاعية الاثنتي عشرة وإطار تنفيذها.",
      type: "strategy",
      outcomes: [],
      topics: ["strategy_design"],
      year: 2018,
    },
    "QNV2030_EN.pdf": {
      titleEn: "Qatar National Vision 2030",
      titleAr: "رؤية قطر الوطنية 2030",
      summaryEn:
        "Qatar National Vision 2030, launched in 2008, is the nation's long-term development compass. It rests on four pillars: human development, social development, economic development, and environmental development, and commits Qatar to transforming into an advanced society capable of sustaining its development and providing a high standard of living for its people by 2030.",
      summaryAr:
        "رؤية قطر الوطنية 2030، التي أُطلقت عام 2008، هي بوصلة التنمية طويلة المدى للدولة. وترتكز على أربع ركائز: التنمية البشرية والتنمية الاجتماعية والتنمية الاقتصادية والتنمية البيئية، وتلتزم بتحويل قطر إلى مجتمع متقدم قادر على استدامة تنميته وتوفير مستوى معيشة مرتفع لشعبه بحلول 2030.",
      type: "strategy",
      outcomes: ["quality_life", "cohesive_society"],
      topics: ["strategy_design"],
      year: 2008,
    },
    "QNV2030_AR.pdf": {
      titleEn: "Qatar National Vision 2030 (Arabic)",
      titleAr: "رؤية قطر الوطنية 2030",
      summaryEn: "The Arabic edition of Qatar National Vision 2030 and its four development pillars.",
      summaryAr: "النسخة العربية من رؤية قطر الوطنية 2030 وركائزها التنموية الأربع.",
      type: "strategy",
      outcomes: [],
      topics: ["strategy_design"],
      year: 2008,
    },
  };
  // guidebook: filename contains 'Guidebook'
  const guidebookEntry = files.find((f) => /guidebook/i.test(f.filename));
  if (guidebookEntry) {
    authored[guidebookEntry.filename] = {
      titleEn: "NDS3 Governance Guidebook",
      titleAr: "دليل حوكمة تنفيذ استراتيجية التنمية الوطنية الثالثة",
      summaryEn:
        "The guidebook for the governance of NDS3 implementation. It defines the delivery architecture: the roles of the National Planning Council, sector teams, and delivery entities, the cadence of reporting and escalation, and how outcomes, programmes, and projects are monitored so that accountability for Qatar's final push to Vision 2030 stays clear and evidence-based.",
      summaryAr:
        "دليل حوكمة تنفيذ استراتيجية التنمية الوطنية الثالثة. يحدد بنية التنفيذ: أدوار المجلس الوطني للتخطيط والفرق القطاعية والجهات المنفذة، وإيقاع التقارير والتصعيد، وكيفية متابعة النتائج والبرامج والمشاريع لتبقى المساءلة في مسيرة قطر الأخيرة نحو رؤية 2030 واضحة ومبنية على الأدلة.",
      type: "guideline",
      outcomes: ["gov_excellence"],
      topics: ["strategy_delivery", "me_monitoring", "results_frameworks"],
      year: 2024,
    };
  }

  const knowledgeAdminId = uid("knowledge@npc.qa");

  /** Pattern-based clean titles for fetched files without hand-authored metadata. */
  const GCC_TITLES: Record<string, { en: string; ar: string }> = {
    "GCC_20Market_20Statistics_20Bulletin": {
      en: "GCC Market Statistics Bulletin",
      ar: "نشرة إحصاءات أسواق دول مجلس التعاون",
    },
    "Education_20health_20and_20social_20services": {
      en: "GCC Statistics: Education, Health and Social Services",
      ar: "إحصاءات الخليج: التعليم والصحة والخدمات الاجتماعية",
    },
    "Practicing_20all_20economic_20investments_20and_20services_20activities": {
      en: "GCC Statistics: Economic and Investment Activities",
      ar: "إحصاءات الخليج: الأنشطة الاقتصادية والاستثمارية",
    },
    "Real_20estate_20ownership": {
      en: "GCC Statistics: Real Estate Ownership",
      ar: "إحصاءات الخليج: تملك العقارات",
    },
    "Social_20security_20and_20retirement": {
      en: "GCC Statistics: Social Security and Retirement",
      ar: "إحصاءات الخليج: الضمان الاجتماعي والتقاعد",
    },
    "Stock_20trading_20and_20companies_20establishment": {
      en: "GCC Statistics: Stock Trading and Company Establishment",
      ar: "إحصاءات الخليج: تداول الأسهم وتأسيس الشركات",
    },
    "Transportation_20and_20accommodation": {
      en: "GCC Statistics: Transportation and Accommodation",
      ar: "إحصاءات الخليج: النقل والإقامة",
    },
    "Work_20in_20the_20governmental_20and_20private_20sectors": {
      en: "GCC Statistics: Employment in Government and Private Sectors",
      ar: "إحصاءات الخليج: العمل في القطاعين الحكومي والخاص",
    },
  };
  const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function niceTitle(filename: string): { en: string; ar: string } | null {
    if (/^npc_about_en/.test(filename))
      return { en: "About the National Planning Council", ar: "عن المجلس الوطني للتخطيط" };
    if (/^npc_about_ar/.test(filename))
      return { en: "About the National Planning Council (Arabic)", ar: "عن المجلس الوطني للتخطيط" };
    if (/^npc_nds3_overview/.test(filename))
      return { en: "NDS3 Overview (npc.qa)", ar: "التعريف باستراتيجية التنمية الوطنية الثالثة" };
    const news = /^npc_news_(en|ar)_.*?(\d{2})(\d{2})(\d{4})\.aspx/.exec(filename);
    if (news) {
      const [, lang, dd, mm, yyyy] = news;
      const mi = Math.max(0, Math.min(11, Number(mm) - 1));
      return {
        en: `NPC News, ${Number(dd)} ${EN_MONTHS[mi]} ${yyyy}`,
        ar: `أخبار المجلس الوطني للتخطيط، ${Number(dd)} ${AR_MONTHS[mi]} ${yyyy}`,
      };
    }
    for (const [key, val] of Object.entries(GCC_TITLES)) {
      if (filename.includes(key)) return val;
    }
    const od = /^opendata_(.+)\.csv$/.exec(filename);
    if (od) {
      const slug = od[1]
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .slice(0, 90);
      return { en: `Open Data: ${slug}`, ar: "" };
    }
    if (/statistics.*\.aspx/.test(filename)) {
      return { en: "NPC Statistics Portal Page", ar: "صفحة بوابة الإحصاءات في المجلس" };
    }
    return null;
  }

  const docIdByFilename = new Map<string, string>();
  let chunkTotal = 0;
  for (const f of files) {
    const filePath = path.join(SOURCES, f.filename);
    const buf = fs.readFileSync(filePath);
    if (buf.length < 500) continue;
    const documentId = newId();
    docIdByFilename.set(f.filename, documentId);

    // copy into uploads storage
    const uploadDir = path.join(dataDir, "uploads", documentId);
    fs.mkdirSync(uploadDir, { recursive: true });
    const storedName = f.filename.slice(0, 140);
    fs.writeFileSync(path.join(uploadDir, storedName), buf);
    const storagePath = path.join("data", "uploads", documentId, storedName).replace(/\\/g, "/");

    const parsed = await parseDocument(buf, f.filename);
    fs.writeFileSync(path.join(uploadDir, "extracted.txt"), parsed.text.slice(0, 2_000_000));

    const meta = authored[f.filename];
    const enrich = meta
      ? null
      : mockEnrich({
          filename: f.filename.replace(/^www\.npc\.qa_|^opendata_/, "").replace(/_20/g, " "),
          text: parsed.text,
          pages: parsed.pages,
          lang: parsed.lang,
          terms: taxonomyPack.terms.map((t) => ({
            code: t.code,
            nameEn: t.name_en,
            nameAr: t.name_ar,
            dimension: t.dimension,
          })),
          sourceOrigin: "npc",
        });

    const typeCode = meta?.type ?? enrich?.knowledge_type_code ?? "report";
    const clean = meta ? null : niceTitle(f.filename);
    const versionId = newId();
    await db.insert(schema.documents).values({
      id: documentId,
      titleEn: meta?.titleEn ?? clean?.en ?? enrich?.title_en ?? f.filename,
      titleAr: meta?.titleAr ?? clean?.ar ?? enrich?.title_ar ?? "",
      titleArMachine: meta || clean ? 0 : enrich?.title_ar ? 1 : 0,
      summaryEn: meta?.summaryEn ?? enrich?.summary_en ?? null,
      summaryAr: meta?.summaryAr ?? enrich?.summary_ar ?? null,
      summaryMachine: meta ? 0 : 1,
      keyFactsJson: enrich ? JSON.stringify(enrich.key_facts) : null,
      knowledgeTypeTermId: termIdByKey.get(`knowledge_type:${typeCode}`) ?? termIdByKey.get("knowledge_type:report") ?? null,
      classificationLevel: 1,
      departmentId: null,
      ownerUserId: knowledgeAdminId,
      languageOriginal: parsed.lang,
      status: "verified",
      verifiedBy: knowledgeAdminId,
      verifiedAt: now,
      sourceOrigin: "npc",
      publishYear: meta?.year ?? enrich?.publish_year ?? null,
      originalFilename: f.filename,
      mime: (await import("../src/server/ingest/parse")).mimeFromFilename(f.filename),
      sizeBytes: buf.length,
      pageCount: parsed.pageCount,
      storagePath,
      currentVersionId: versionId,
      reviewDueAt: new Date(Date.now() + 365 * 86400000).toISOString(),
      isSeeded: 1,
      sourceRef: f.url,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.documentVersions).values({
      id: versionId,
      documentId,
      versionNo: 1,
      storagePath,
      uploadedBy: knowledgeAdminId,
      createdAt: now,
    });
    bump("documents");

    // tags
    const tagCodes = [
      ...(meta?.outcomes ?? enrich?.outcome_codes ?? []).map((c: string) => `outcome:${c}`),
      ...(meta?.topics ?? [...(enrich?.sector_codes ?? []), ...(enrich?.topic_codes ?? [])]).map(
        (c: string) => (termIdByKey.has(`topic:${c}`) ? `topic:${c}` : `sector:${c}`)
      ),
    ];
    for (const key of tagCodes) {
      const termId = termIdByKey.get(key);
      if (!termId) continue;
      await db.insert(schema.taggings).values({
        id: newId(),
        resourceType: "document",
        resourceId: documentId,
        termId,
        source: meta ? "human" : "ai_suggested",
        createdBy: knowledgeAdminId,
        createdAt: now,
      });
    }

    // tables
    for (const tb of parsed.tables.slice(0, 8)) {
      await db.insert(schema.documentTables).values({
        id: newId(),
        documentId,
        page: tb.page,
        caption: tb.caption,
        columnsJson: JSON.stringify(tb.columns.slice(0, 60)),
        rowsJson: JSON.stringify(tb.rows.slice(0, 400)),
      });
    }

    // chunks (embedding happens in batch below)
    const chunks = chunkDocument(parsed).slice(0, 260);
    for (const c of chunks) {
      await db.insert(schema.documentChunks).values({
        id: newId(),
        documentId,
        versionId,
        chunkIndex: c.index,
        pageFrom: c.pageFrom,
        pageTo: c.pageTo,
        heading: c.heading,
        text: c.text,
        lang: c.lang,
        tokenCount: c.tokenCount,
      });
      chunkTotal++;
    }
    console.log(`   ${f.filename}: ${parsed.pageCount}p, ${chunks.length} chunks`);
  }
  report.document_chunks = chunkTotal;

  // one Confidential document (clearance checks in smoke tests and the demo)
  {
    const documentId = newId();
    const versionId = newId();
    const confText =
      "Confidential working paper: preliminary fiscal scenario assumptions for the 2027 budget cycle. " +
      "Prepared for internal NPC deliberation only. Scenario A assumes hydrocarbon revenues stable; Scenario B models a 12 percent decline with expenditure smoothing through the stabilization buffer.";
    const uploadDir = path.join(dataDir, "uploads", documentId);
    fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, "fiscal-scenarios-2027.txt"), confText);
    fs.writeFileSync(path.join(uploadDir, "extracted.txt"), confText);
    const storagePath = path
      .join("data", "uploads", documentId, "fiscal-scenarios-2027.txt")
      .replace(/\\/g, "/");
    await db.insert(schema.documents).values({
      id: documentId,
      titleEn: "Fiscal Scenario Assumptions 2027 (Working Paper)",
      titleAr: "افتراضات السيناريوهات المالية 2027 (ورقة عمل)",
      summaryEn: "Preliminary fiscal scenario assumptions for the 2027 budget cycle, for internal deliberation.",
      summaryAr: "افتراضات أولية للسيناريوهات المالية لدورة موازنة 2027، للتداول الداخلي.",
      knowledgeTypeTermId: termIdByKey.get("knowledge_type:study") ?? null,
      classificationLevel: 3,
      departmentId: deptIds.get("econ_planning") ?? null,
      ownerUserId: uid("head.stats@npc.qa"),
      languageOriginal: "en",
      status: "verified",
      verifiedBy: knowledgeAdminId,
      verifiedAt: now,
      sourceOrigin: "npc",
      publishYear: 2026,
      originalFilename: "fiscal-scenarios-2027.txt",
      mime: "text/plain",
      sizeBytes: confText.length,
      pageCount: 1,
      storagePath,
      currentVersionId: versionId,
      isSeeded: 1,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.documentVersions).values({
      id: versionId,
      documentId,
      versionNo: 1,
      storagePath,
      uploadedBy: knowledgeAdminId,
      createdAt: now,
    });
    const confChunks = chunkDocument({
      text: confText,
      pages: [{ page: 1, text: confText }],
      tables: [],
      pageCount: 1,
      lang: "en",
    });
    for (const c of confChunks) {
      await db.insert(schema.documentChunks).values({
        id: newId(),
        documentId,
        versionId,
        chunkIndex: c.index,
        pageFrom: c.pageFrom,
        pageTo: c.pageTo,
        heading: c.heading,
        text: c.text,
        lang: c.lang,
        tokenCount: c.tokenCount,
      });
    }
    bump("documents");
  }

  // batch-embed all chunks
  console.log(`-- embedding ${chunkTotal} chunks...`);
  const { isNull } = await import("drizzle-orm");
  const pending = await db
    .select({ id: schema.documentChunks.id, text: schema.documentChunks.text })
    .from(schema.documentChunks)
    .where(isNull(schema.documentChunks.embedding));
  for (let i = 0; i < pending.length; i += 64) {
    const batch = pending.slice(i, i + 64);
    const { vectors, model } = await embedTexts(batch.map((b) => b.text));
    const { eq } = await import("drizzle-orm");
    for (let j = 0; j < batch.length; j++) {
      await db
        .update(schema.documentChunks)
        .set({ embedding: float32ToBuffer(vectors[j]), embeddingModel: model })
        .where(eq(schema.documentChunks.id, batch[j].id));
    }
    if (i % 256 === 0) console.log(`   embedded ${Math.min(i + 64, pending.length)}/${pending.length}`);
  }

  // point strategy editions at their source documents
  {
    const { eq } = await import("drizzle-orm");
    const map: [string, string][] = [
      ["nds3", "QNDS3_EN.pdf"],
      ["nds2", "www.npc.qa_en_planning_Documents_nds2_NDS2Final.pdf"],
    ];
    for (const [code, fname] of map) {
      const docId = docIdByFilename.get(fname);
      const edId = editionIdByCode.get(code);
      if (docId && edId) {
        await db.update(schema.strategyEditions).set({ sourceDocumentId: docId }).where(eq(schema.strategyEditions.id, edId));
      }
    }
  }

  /* ---------------- 8. experts, communities, Q&A, lessons ---------------- */
  const expertsPack = readPack<{
    external_experts: any[];
    employee_domains: { user: string; domains: string[]; skills?: string[] }[];
    communities: { code: string; name_en: string; name_ar: string; description_en: string; description_ar: string; lead: string; topic_code: string }[];
    questions: any[];
    lessons: any[];
    decisions: any[];
  }>("experts-qa.json");

  const resolveTermId = (code: string): string | null =>
    termIdByKey.get(`topic:${code}`) ?? termIdByKey.get(`sector:${code}`) ?? termIdByKey.get(`outcome:${code}`) ?? null;

  for (const e of expertsPack.external_experts) {
    const id = newId();
    await db.insert(schema.experts).values({
      id,
      userId: null,
      type: e.type,
      nameEn: e.name_en,
      nameAr: e.name_ar,
      avatarColor: ["gulf", "gold", "maroon"][Math.floor(Math.random() * 3)],
      organisationEn: e.organisation_en,
      organisationAr: e.organisation_ar,
      positionEn: e.position_en,
      positionAr: e.position_ar,
      bioEn: e.bio_en,
      bioAr: e.bio_ar,
      nationality: e.nationality ?? null,
      languagesJson: JSON.stringify(e.languages ?? []),
      yearsExperience: e.years_experience ?? null,
      educationJson: JSON.stringify(e.education ?? []),
      availability: e.availability ?? "available",
      clearanceLevel: 1,
      ownerUserId: uid("knowledge@npc.qa"),
      isVerified: 1,
      visibilityClassification: 2,
      createdAt: now,
      updatedAt: now,
    });
    bump("experts_external");
    for (const code of e.domains ?? []) {
      const termId = resolveTermId(code);
      if (!termId) continue;
      await db.insert(schema.expertDomains).values({
        id: newId(),
        expertId: id,
        termId,
        level: "expert",
        source: "self",
        accepted: 1,
      });
    }
    for (const skill of e.skills ?? []) {
      await db.insert(schema.expertSkills).values({ id: newId(), expertId: id, skill, level: "expert" });
    }
    for (const g of e.engagements ?? []) {
      await db.insert(schema.expertEngagements).values({
        id: newId(),
        expertId: id,
        title: g.title,
        year: g.year ?? null,
        role: g.role ?? null,
        outcomeEn: g.outcome_en ?? null,
        outcomeAr: g.outcome_ar ?? null,
        rating: g.rating ?? null,
      });
    }
    for (const p of e.publications ?? []) {
      await db.insert(schema.expertPublications).values({
        id: newId(),
        expertId: id,
        title: p.title,
        year: p.year ?? null,
      });
    }
  }

  for (const ed of expertsPack.employee_domains) {
    const userId = uid(ed.user);
    const expertId = expertIdByUserId.get(userId);
    if (!expertId) continue;
    for (const code of ed.domains) {
      const termId = resolveTermId(code);
      if (!termId) continue;
      await db.insert(schema.expertDomains).values({
        id: newId(),
        expertId,
        termId,
        level: "practitioner",
        source: "self",
        accepted: 1,
      });
    }
    for (const skill of ed.skills ?? []) {
      await db.insert(schema.expertSkills).values({ id: newId(), expertId, skill, level: "practitioner" });
    }
  }
  // AI-suggested domains for the analyst account (drives the profile screen)
  {
    const analystExpert = expertIdByUserId.get(uid("analyst@npc.qa"));
    if (analystExpert) {
      for (const code of ["economic_diversification", "national_accounts", "sme_policy"]) {
        const termId = resolveTermId(code);
        if (!termId) continue;
        await db.insert(schema.expertDomains).values({
          id: newId(),
          expertId: analystExpert,
          termId,
          level: "practitioner",
          source: "ai_suggested",
          accepted: 0,
        });
      }
    }
  }

  const communityIdByCode = new Map<string, string>();
  for (const c of expertsPack.communities) {
    const id = newId();
    communityIdByCode.set(c.code, id);
    const leadId = uid(c.lead);
    await db.insert(schema.communities).values({
      id,
      nameEn: c.name_en,
      nameAr: c.name_ar,
      descriptionEn: c.description_en,
      descriptionAr: c.description_ar,
      termId: resolveTermId(c.topic_code),
      leadUserId: leadId,
      createdAt: now,
    });
    bump("communities");
    const memberIds = new Set<string>([leadId]);
    for (let i = 0; i < 6; i++) memberIds.add(employeePool[(i * 5 + c.code.length) % employeePool.length]);
    for (const m of memberIds) {
      await db.insert(schema.communityMembers).values({
        id: newId(),
        communityId: id,
        userId: m,
        role: m === leadId ? "lead" : "member",
        createdAt: now,
      });
    }
  }

  console.log("-- seeding questions with retrieval-grounded AI answers...");
  let aiAnswered = 0;
  const seedUserForRetrieval = {
    clearanceLevel: 4,
    departmentId: null,
    departmentScope: "all",
  };
  for (const [qi, q] of expertsPack.questions.entries()) {
    const qid = newId();
    const authorId = uid(q.author);
    const created = new Date(Date.now() - (qi + 2) * 86400000 * 2.3).toISOString();
    const answers: any[] = q.answers ?? [];
    let aiAnswerId: string | null = null;
    // ~1 in 3 questions get a stored AI answer generated through the real retrieval pipeline
    if (aiAnswered < 10 && qi % 3 === 0) {
      try {
        const query = q.lang_original === "ar" ? q.title_ar : q.title_en;
        const { chunks, topSimilarity } = await retrieveChunks(
          query,
          { maxClassification: 4 },
          6
        );
        const mock = mockAnswer(query, chunks, q.lang_original, topSimilarity);
        aiAnswerId = newId();
        await db.insert(schema.answers).values({
          id: aiAnswerId,
          questionId: qid,
          authorId: null,
          isAi: 1,
          bodyEn: q.lang_original === "ar" ? null : mock.markdown,
          bodyAr: q.lang_original === "ar" ? mock.markdown : null,
          citationsJson: JSON.stringify(mock.citations),
          confidence: mock.confidence,
          createdAt: created,
        });
        aiAnswered++;
      } catch { /* retrieval optional */ }
    }
    let verifiedAnswerId: string | null = null;
    for (const [ai, a] of answers.entries()) {
      const answerId = newId();
      if (a.verified) verifiedAnswerId = answerId;
      await db.insert(schema.answers).values({
        id: answerId,
        questionId: qid,
        authorId: uid(a.author),
        isAi: 0,
        bodyEn: a.body_en ?? null,
        bodyAr: a.body_ar ?? null,
        isVerified: a.verified ? 1 : 0,
        verifiedBy: a.verified ? uid("verifier@npc.qa") : null,
        verifiedAt: a.verified ? now : null,
        helpfulCount: a.helpful_count ?? 0,
        createdAt: new Date(new Date(created).getTime() + (ai + 1) * 86400000).toISOString(),
      });
      bump("answers");
    }
    const status = verifiedAnswerId
      ? "verified"
      : answers.length
        ? "answered"
        : aiAnswerId
          ? "ai_answered"
          : "open";
    await db.insert(schema.questions).values({
      id: qid,
      authorId,
      titleEn: q.title_en ?? "",
      titleAr: q.title_ar ?? "",
      bodyEn: q.body_en ?? null,
      bodyAr: q.body_ar ?? null,
      langOriginal: q.lang_original ?? "en",
      classificationLevel: q.classification_level ?? 2,
      departmentId: deptOfUser.get(authorId) ?? null,
      status,
      aiAnswerId,
      verifiedAnswerId,
      viewCount: Math.floor(Math.random() * 40),
      contextJson: q.community_code
        ? JSON.stringify({ communityId: communityIdByCode.get(q.community_code) })
        : null,
      createdAt: created,
      updatedAt: created,
    });
    bump("questions");
    for (const code of q.topic_codes ?? []) {
      const termId = resolveTermId(code);
      if (!termId) continue;
      await db.insert(schema.taggings).values({
        id: newId(),
        resourceType: "question",
        resourceId: qid,
        termId,
        source: "human",
        createdBy: authorId,
        createdAt: created,
      });
    }
  }

  // lessons + decisions
  const nds3OutcomeNodes = strategyPack.nodes.filter((n) => n.edition === "nds3" && n.node_type === "outcome");
  const outcomeNodeByCode = new Map<string, string>();
  for (const n of nds3OutcomeNodes) {
    // node code like O1..O7; map by outcome order to outcome taxonomy codes
    outcomeNodeByCode.set(n.key, nodeIdByKey.get(n.key)!);
  }
  const outcomeKeys = [...outcomeNodeByCode.keys()];
  for (const [li, l] of expertsPack.lessons.entries()) {
    const id = newId();
    const authorId = uid(l.author);
    const created = new Date(Date.now() - (li + 1) * 86400000 * 1.7).toISOString();
    const nodeKey = l.outcome_code && outcomeKeys.length ? outcomeKeys[li % outcomeKeys.length] : null;
    await db.insert(schema.lessons).values({
      id,
      authorId,
      titleEn: l.title_en,
      titleAr: l.title_ar,
      contextEn: l.context_en,
      contextAr: l.context_ar,
      learningEn: l.learning_en,
      learningAr: l.learning_ar,
      recommendationEn: l.recommendation_en,
      recommendationAr: l.recommendation_ar,
      nodeId: nodeKey ? outcomeNodeByCode.get(nodeKey)! : null,
      classificationLevel: l.classification_level ?? 2,
      status: l.status === "verified" ? "verified" : "published",
      reuseCount: Math.floor(Math.random() * 7),
      createdAt: created,
      updatedAt: created,
    });
    bump("lessons");
    const codes = [...(l.topic_codes ?? []), ...(l.outcome_code ? [l.outcome_code] : [])];
    for (const code of codes) {
      const termId = resolveTermId(code);
      if (!termId) continue;
      await db.insert(schema.taggings).values({
        id: newId(),
        resourceType: "lesson",
        resourceId: id,
        termId,
        source: "human",
        createdBy: authorId,
        createdAt: created,
      });
    }
  }
  for (const d of expertsPack.decisions) {
    await db.insert(schema.decisions).values({
      id: newId(),
      titleEn: d.title_en,
      titleAr: d.title_ar,
      decisionEn: d.decision_en,
      decisionAr: d.decision_ar,
      rationaleEn: d.rationale_en,
      rationaleAr: d.rationale_ar,
      decidedOn: d.decided_on ?? null,
      ownerUserId: uid(d.owner),
      createdAt: now,
    });
    bump("decisions");
  }

  /* ---------------- 9. engagement pack ---------------- */
  const engagement = readPack<{
    word_of_day: any[];
    daily_cards: any[];
    bounties: any[];
    knowledge_gaps: any[];
    index_rankings: any[];
    signals: any[];
    risks: any[];
    spotlights: any[];
    collections: any[];
    notification_templates: any[];
  }>("engagement.json");

  for (const w of engagement.word_of_day) {
    await db.insert(schema.wordOfDay).values({
      id: newId(),
      kind: w.kind,
      textEn: w.text_en,
      textAr: w.text_ar,
      attributionEn: w.attribution_en ?? null,
      attributionAr: w.attribution_ar ?? null,
      sourceRef: w.source_ref ?? null,
    });
    bump("word_of_day");
  }
  for (const c of engagement.daily_cards) {
    const date = new Date(Date.now() + (c.offset_day ?? 0) * 86400000).toISOString().slice(0, 10);
    await db.insert(schema.dailyCards).values({
      id: newId(),
      date,
      indicatorId: c.indicator_code ? (indicatorIdByCode.get(c.indicator_code) ?? null) : null,
      factEn: c.fact_en,
      factAr: c.fact_ar,
      hookEn: c.hook_en ?? null,
      hookAr: c.hook_ar ?? null,
      quizQuestionEn: c.quiz_question_en ?? null,
      quizQuestionAr: c.quiz_question_ar ?? null,
      optionsJson: JSON.stringify(c.options ?? []),
      correctIndex: c.correct_index ?? 0,
      explanationEn: c.explanation_en ?? null,
      explanationAr: c.explanation_ar ?? null,
      bigNumber: c.big_number ?? null,
    });
    bump("daily_cards");
  }
  const bountyIds: string[] = [];
  for (const b of engagement.bounties) {
    const id = newId();
    bountyIds.push(id);
    await db.insert(schema.bounties).values({
      id,
      titleEn: b.title_en,
      titleAr: b.title_ar,
      descriptionEn: b.description_en,
      descriptionAr: b.description_ar,
      source: b.source === "gap_radar" ? "gap_radar" : "manual",
      points: b.points ?? 80,
      termId: b.topic_code ? resolveTermId(b.topic_code) : null,
      nodeId: null,
      status: "open",
      postedBy: uid("knowledge@npc.qa"),
      createdAt: now,
      updatedAt: now,
    });
    bump("bounties");
  }
  for (const [gi, g] of engagement.knowledge_gaps.entries()) {
    await db.insert(schema.knowledgeGaps).values({
      id: newId(),
      labelEn: g.label_en,
      labelAr: g.label_ar,
      exampleQueriesJson: JSON.stringify(g.example_queries ?? []),
      termId: g.topic_code ? resolveTermId(g.topic_code) : null,
      status: "open",
      bountyId: bountyIds[gi] ?? null,
      detectedAt: now,
    });
    bump("knowledge_gaps");
  }
  for (const r of engagement.index_rankings) {
    await db.insert(schema.indexRankings).values({
      id: newId(),
      indexNameEn: r.index_name_en,
      indexNameAr: r.index_name_ar,
      publisher: r.publisher,
      year: r.year,
      rank: r.rank ?? null,
      score: r.score ?? null,
      totalCountries: r.total_countries ?? null,
      responsibleEntity: r.responsible_entity ?? null,
      sourceUrl: r.source_url ?? null,
      note: r.note ?? null,
    });
    bump("index_rankings");
    if (r.note) toVerify.push(`index ranking ${r.index_name_en} (${r.year}): ${r.note}`);
  }
  for (const s of engagement.signals) {
    await db.insert(schema.signals).values({
      id: newId(),
      titleEn: s.title_en,
      titleAr: s.title_ar,
      descriptionEn: s.description_en,
      descriptionAr: s.description_ar,
      source: s.source ?? null,
      impact: s.impact ?? "medium",
      horizon: s.horizon ?? "mid",
      createdBy: uid(s.created_by ?? "knowledge@npc.qa"),
      createdAt: now,
    });
    bump("signals");
  }
  for (const r of engagement.risks) {
    await db.insert(schema.risks).values({
      id: newId(),
      titleEn: r.title_en,
      titleAr: r.title_ar,
      likelihood: r.likelihood ?? 3,
      impact: r.impact ?? 3,
      mitigationEn: r.mitigation_en ?? null,
      mitigationAr: r.mitigation_ar ?? null,
      ownerUserId: uid(r.owner ?? "admin@npc.qa"),
      status: r.status ?? "open",
      createdAt: now,
    });
    bump("risks");
  }
  for (const s of engagement.spotlights) {
    await db.insert(schema.spotlights).values({
      id: newId(),
      userId: uid(s.user),
      blurbEn: s.blurb_en,
      blurbAr: s.blurb_ar,
      startsOn: todayIso(),
      endsOn: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      chosenBy: uid("admin@npc.qa"),
    });
    bump("spotlights");
  }

  // collections + membership by keyword matching on titles
  const allDocs = await db.select().from(schema.documents);
  for (const c of engagement.collections) {
    const id = newId();
    await db.insert(schema.collections).values({
      id,
      nameEn: c.name_en,
      nameAr: c.name_ar,
      descriptionEn: c.description_en,
      descriptionAr: c.description_ar,
      coverStyle: c.cover_style ?? "maroon-weave",
      ownerUserId: uid("knowledge@npc.qa"),
      visibility: "all",
      isFeatured: 1,
      createdAt: now,
      updatedAt: now,
    });
    bump("collections");
    const keywords: string[] = c.keywords ?? [];
    let sort = 0;
    for (const doc of allDocs) {
      const hay = `${doc.titleEn} ${doc.originalFilename}`.toLowerCase();
      if (keywords.some((k) => hay.includes(k.toLowerCase()))) {
        await db.insert(schema.collectionItems).values({
          id: newId(),
          collectionId: id,
          resourceType: "document",
          resourceId: doc.id,
          sort: sort++,
          addedBy: uid("knowledge@npc.qa"),
          createdAt: now,
        });
      }
    }
  }

  // notifications for the named accounts
  for (const email of NAMED) {
    const userId = userIdByEmail.get(email)!;
    for (const [ni, n] of engagement.notification_templates.entries()) {
      if (ni >= 8) break;
      await db.insert(schema.notifications).values({
        id: newId(),
        userId,
        kind: n.kind ?? "info",
        titleEn: n.title_en,
        titleAr: n.title_ar,
        bodyEn: n.body_en ?? null,
        bodyAr: n.body_ar ?? null,
        link: n.link ?? null,
        readAt: ni < 5 ? now : null,
        createdAt: new Date(Date.now() - ni * 86400000 * 0.8).toISOString(),
      });
      bump("notifications");
    }
  }

  /* ---------------- 10. gamification: levels, badges, rules, history ---------------- */
  const levels = [
    { order: 1, nameEn: "Explorer", nameAr: "مستكشف", minPoints: 0 },
    { order: 2, nameEn: "Contributor", nameAr: "مساهم", minPoints: 150 },
    { order: 3, nameEn: "Curator", nameAr: "أمين معرفة", minPoints: 600 },
    { order: 4, nameEn: "Knowledge Keeper", nameAr: "حافظ المعرفة", minPoints: 1500 },
    { order: 5, nameEn: "NPC Sage", nameAr: "حكيم المجلس", minPoints: 4000 },
  ];
  const levelIds: string[] = [];
  for (const l of levels) {
    const id = newId();
    levelIds.push(id);
    await db.insert(schema.levels).values({ id, order: l.order, nameEn: l.nameEn, nameAr: l.nameAr, minPoints: l.minPoints });
  }
  const badgeDefs: [string, string, string, string, string | null][] = [
    ["builder_bronze", "builder", "Builder I", "بنّاء 1", "bronze"],
    ["builder_silver", "builder", "Builder II", "بنّاء 2", "silver"],
    ["builder_gold", "builder", "Builder III", "بنّاء 3", "gold"],
    ["guardian_bronze", "guardian", "Guardian I", "حارس 1", "bronze"],
    ["guardian_silver", "guardian", "Guardian II", "حارس 2", "silver"],
    ["guardian_gold", "guardian", "Guardian III", "حارس 3", "gold"],
    ["connector_bronze", "connector", "Connector I", "موصّل 1", "bronze"],
    ["connector_silver", "connector", "Connector II", "موصّل 2", "silver"],
    ["connector_gold", "connector", "Connector III", "موصّل 3", "gold"],
    ["explorer_bronze", "explorer", "Explorer I", "مستكشف 1", "bronze"],
    ["explorer_silver", "explorer", "Explorer II", "مستكشف 2", "silver"],
    ["explorer_gold", "explorer", "Explorer III", "مستكشف 3", "gold"],
    ["first_shelf", "builder", "First Shelf", "أول رف", null],
    ["bilingual", "guardian", "Bilingual", "ثنائي اللغة", null],
    ["gap_closer", "connector", "Gap Closer", "سادّ الفجوات", null],
  ];
  const badgeIdByCode = new Map<string, string>();
  for (const [code, family, nameEn, nameAr, tier] of badgeDefs) {
    const id = newId();
    badgeIdByCode.set(code, id);
    await db.insert(schema.badges).values({ id, code, family, nameEn, nameAr, tier });
  }
  const ruleRows: [string, number][] = [
    ["document_uploaded", 20],
    ["document_verified", 30],
    ["document_version_added", 10],
    ["content_verified", 30],
    ["ai_tag_confirmed", 3],
    ["translation_reviewed", 15],
    ["question_asked", 5],
    ["answer_posted", 20],
    ["answer_verified", 40],
    ["answer_marked_helpful", 5],
    ["lesson_published", 25],
    ["lesson_verified", 20],
    ["decision_logged", 15],
    ["expert_profile_completed", 100],
    ["expert_profile_domain_accepted", 5],
    ["external_expert_added", 30],
    ["expert_request_answered", 25],
    ["kpi_value_entered", 10],
    ["status_update_posted", 15],
    ["indicator_import_completed", 40],
    ["daily_login", 5],
    ["daily_quiz_correct", 10],
    ["daily_quiz_wrong", 4],
    ["mystery_shelf_opened", 5],
    ["document_read_fully", 3],
    ["bounty_fulfilled", 80],
    // CR01 5.5 + 2.6
    ["knowledge_submitted", 15],
    ["knowledge_verified", 25],
    ["knowledge_linked_to_nds", 5],
    ["knowledge_from_event", 20],
    ["signal_accepted", 10],
  ];
  for (const [eventType, points] of ruleRows) {
    await db.insert(schema.gameRules).values({ id: newId(), eventType, points, isActive: 1 });
  }

  // history: a plausible spread of levels (one Sage: knowledge admin)
  const spread: [string, number][] = [
    ["knowledge@npc.qa", 4400],
    ["admin@npc.qa", 1900],
    ["head.stats@npc.qa", 1650],
    ["verifier@npc.qa", 900],
    ["analyst@npc.qa", 40],
    ["reader@npc.qa", 25],
  ];
  const historyTypes = ["document_uploaded", "answer_posted", "content_verified", "lesson_published", "daily_login", "kpi_value_entered"];
  const allUsers = [...spread, ...employeePool.slice(0, 24).map((id, i) => {
    const email = [...userIdByEmail.entries()].find(([, v]) => v === id)?.[0] ?? "";
    return [email, 80 + ((i * 137) % 900)] as [string, number];
  })];
  for (const [email, targetPoints] of allUsers) {
    const userId = userIdByEmail.get(email);
    if (!userId) continue;
    let total = 0;
    let i = 0;
    while (total < targetPoints && i < 400) {
      const type = historyTypes[i % historyTypes.length];
      const points = ruleRows.find(([t]) => t === type)?.[1] ?? 5;
      const daysAgo = 1 + ((i * 3) % 90);
      await db.insert(schema.gameEvents).values({
        id: newId(),
        userId,
        eventType: type,
        points,
        multiplier: 1,
        createdAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
      });
      total += points;
      i++;
    }
    const levelIdx = levels.filter((l) => l.minPoints <= total).length - 1;
    await db.insert(schema.userGameState).values({
      userId,
      totalPoints: total,
      levelId: levelIds[Math.max(0, levelIdx)],
      dailyStreak: email === "knowledge@npc.qa" ? 14 : Math.floor(Math.random() * 6),
      weeklyStreak: email === "knowledge@npc.qa" ? 9 : Math.floor(Math.random() * 4),
      streakFreezes: 1,
      lastActiveDate: todayIso(),
      lastContributionWeek: null,
      breadthJson: JSON.stringify(
        Object.fromEntries(
          ["eco_growth", "gov_excellence", "workforce", "quality_life"]
            .slice(0, 1 + (total % 4))
            .map((c) => [c, 1 + (total % 9)])
        )
      ),
      quizStreak: Math.floor(Math.random() * 5),
      contributionCount: Math.floor(total / 25),
      updatedAt: now,
    });
    bump("user_game_state");
  }
  // badges for the heavy hitters
  for (const [email, badgeCodes] of [
    ["knowledge@npc.qa", ["builder_gold", "guardian_silver", "connector_silver", "first_shelf", "bilingual"]],
    ["admin@npc.qa", ["builder_silver", "guardian_bronze", "first_shelf"]],
    ["head.stats@npc.qa", ["builder_silver", "guardian_bronze"]],
    ["verifier@npc.qa", ["guardian_silver", "first_shelf"]],
  ] as [string, string[]][]) {
    const userId = userIdByEmail.get(email);
    if (!userId) continue;
    for (const code of badgeCodes) {
      const badgeId = badgeIdByCode.get(code);
      if (!badgeId) continue;
      await db.insert(schema.userBadges).values({ id: newId(), userId, badgeId, awardedAt: now });
    }
  }

  /* ---------------- 11. relations ---------------- */
  console.log("-- linking documents to nodes and indicators...");
  const outcomeTermPairs: [string, string][] = [
    ["eco_growth", "economic"],
    ["fiscal_sust", "fiscal"],
    ["workforce", "workforce"],
    ["env_sust", "environment"],
    ["gov_excellence", "government"],
  ];
  const nds3EditionId = editionIdByCode.get("nds3");
  const { eq: eqOp, and: andOp } = await import("drizzle-orm");
  const outcomeNodes = nds3EditionId
    ? await db
        .select()
        .from(schema.strategyNodes)
        .where(andOp(eqOp(schema.strategyNodes.editionId, nds3EditionId), eqOp(schema.strategyNodes.nodeType, "outcome")))
    : [];
  for (const doc of allDocs) {
    const hay = `${doc.titleEn} ${doc.summaryEn ?? ""}`.toLowerCase();
    for (const [code, kw] of outcomeTermPairs) {
      if (!hay.includes(kw)) continue;
      const node = outcomeNodes[outcomeTermPairs.findIndex(([c]) => c === code) % Math.max(1, outcomeNodes.length)];
      if (!node) continue;
      await db.insert(schema.relations).values({
        id: newId(),
        fromType: "document",
        fromId: doc.id,
        toType: "node",
        toId: node.id,
        relation: "about_node",
        source: "ai",
        confidence: 0.7,
        createdAt: now,
      });
      bump("relations");
      break;
    }
  }
  // NDS3 doc -> all outcomes, experts -> outcomes
  const nds3DocId = docIdByFilename.get("QNDS3_EN.pdf");
  if (nds3DocId) {
    for (const node of outcomeNodes) {
      await db.insert(schema.relations).values({
        id: newId(),
        fromType: "document",
        fromId: nds3DocId,
        toType: "node",
        toId: node.id,
        relation: "about_node",
        source: "human",
        createdAt: now,
      });
      bump("relations");
    }
  }
  const someExperts = await db.select().from(schema.experts).limit(60);
  for (const [i, node] of outcomeNodes.entries()) {
    const expert = someExperts[(i * 7 + 3) % someExperts.length];
    if (!expert) continue;
    await db.insert(schema.relations).values({
      id: newId(),
      fromType: "expert",
      fromId: expert.id,
      toType: "node",
      toId: node.id,
      relation: "about_node",
      source: "human",
      createdAt: now,
    });
  }

  /* ---------------- 11b. CR01: Trends and Signals + Ask 2.0 seed ---------------- */
  console.log("-- CR01: feeds, scan briefs, accepted signals, example questions...");
  const cr01 = readPack<{
    scan_briefs: {
      code: string;
      name_en: string;
      name_ar: string;
      query_en: string;
      query_ar: string;
      outcome_codes: string[];
      indicator_codes: string[];
    }[];
    signals: {
      title_en: string;
      title_ar: string;
      summary_en: string;
      summary_ar: string;
      why_en: string;
      why_ar: string;
      publisher: string;
      url: string;
      days_ago: number;
      signal_type: string;
      sentiment: string;
      impact: string;
      horizon: string;
      confidence: number;
      outcome_codes: string[];
      indicator_codes: string[];
    }[];
    example_questions: { en: string; ar: string }[];
  }>("cr01.json");

  // 15 curated feeds (CR01 2.3 source 2)
  const feedRows: [string, string, string][] = [
    ["Qatar News Agency", "https://www.qna.org.qa/en/RSS-Feeds/News", "rss"],
    ["Gulf Times", "https://www.gulf-times.com/rss/qatar", "rss"],
    ["The Peninsula", "https://thepeninsulaqatar.com/rss", "rss"],
    ["Qatar Tribune", "https://www.qatar-tribune.com/rss", "rss"],
    ["Doha News", "https://dohanews.co/feed/", "rss"],
    ["Hukoomi News", "https://hukoomi.gov.qa/en/rss/news", "rss"],
    ["GCO News", "https://www.gco.gov.qa/en/feed/", "rss"],
    ["NPC News", "https://www.npc.qa/en/_layouts/15/listfeed.aspx?List=news", "rss"],
    ["IMF Qatar", "https://www.imf.org/en/Countries/QAT/rss", "rss"],
    ["World Bank MENA", "https://www.worldbank.org/en/region/mena/rss", "rss"],
    ["OECD Newsroom", "https://www.oecd.org/newsroom/index.xml", "rss"],
    ["UN ESCWA", "https://www.unescwa.org/rss.xml", "rss"],
    ["World Economic Forum", "https://www.weforum.org/agenda/rss.xml", "rss"],
    ["Google News: Qatar NDS3", "https://news.google.com/rss/search?q=Qatar%20national%20development%20strategy", "google_news"],
    ["Google News: Qatar economy", "https://news.google.com/rss/search?q=Qatar%20economy%20policy", "google_news"],
  ];
  for (const [name, url, kind] of feedRows) {
    await db.insert(schema.feeds).values({ id: newId(), name, url, kind, isActive: 1, createdAt: now });
    bump("feeds");
  }

  // outcome code -> nds3 outcome node id (by sort order, same rule as runtime)
  const outcomeSortOrder = [
    "eco_growth",
    "fiscal_sust",
    "workforce",
    "cohesive_society",
    "quality_life",
    "env_sust",
    "gov_excellence",
  ];
  const cr01OutcomeNodeByCode = new Map<string, string>();
  outcomeSortOrder.forEach((code, i) => {
    if (outcomeNodes[i]) cr01OutcomeNodeByCode.set(code, outcomeNodes[i].id);
  });
  const indicatorIdByCode2 = new Map<string, string>();
  for (const ind of await db.select({ id: schema.indicators.id, code: schema.indicators.code }).from(schema.indicators)) {
    indicatorIdByCode2.set(ind.code, ind.id);
  }

  for (const b of cr01.scan_briefs) {
    await db.insert(schema.scanBriefs).values({
      id: newId(),
      nameEn: b.name_en,
      nameAr: b.name_ar,
      queryEn: b.query_en,
      queryAr: b.query_ar || null,
      nodeIdsJson: JSON.stringify(
        (b.outcome_codes ?? []).map((c) => cr01OutcomeNodeByCode.get(c)).filter(Boolean)
      ),
      indicatorIdsJson: JSON.stringify(
        (b.indicator_codes ?? []).map((c) => indicatorIdByCode2.get(c)).filter(Boolean)
      ),
      isActive: 1,
      createdBy: userIdByEmail.get("knowledge@npc.qa") ?? null,
      createdAt: now,
    });
    bump("scan_briefs");
  }

  // 30 accepted signals with embeddings and NDS3/indicator links
  const rankingsForLinks = await db.select().from(schema.indexRankings);
  const signalTexts = cr01.signals.map((s) => `${s.title_en} ${s.summary_en} ${s.title_ar}`.slice(0, 2000));
  const { vectors: signalVectors, model: signalModel } = await embedTexts(signalTexts);
  const triager = userIdByEmail.get("knowledge@npc.qa") ?? null;
  for (let i = 0; i < cr01.signals.length; i++) {
    const s = cr01.signals[i];
    const id = newId();
    const publishedAt = new Date(Date.now() - s.days_ago * 86400000).toISOString().slice(0, 10);
    await db.insert(schema.signals).values({
      id,
      titleEn: s.title_en,
      titleAr: s.title_ar,
      descriptionEn: s.summary_en,
      descriptionAr: s.summary_ar,
      source: s.publisher || "seeded",
      impact: s.impact,
      horizon: s.horizon,
      createdBy: triager,
      createdAt: new Date(Date.now() - s.days_ago * 86400000).toISOString(),
      sourceKind: "web_search",
      url: s.url || null,
      publisher: s.publisher || "seeded",
      publishedAt,
      signalType: s.signal_type,
      sentiment: s.sentiment,
      confidence: s.confidence,
      whyItMattersEn: s.why_en,
      whyItMattersAr: s.why_ar,
      triageStatus: "accepted",
      triagedBy: triager,
      triagedAt: now,
      embedding: float32ToBuffer(signalVectors[i]),
      embeddingModel: signalModel,
    });
    for (const code of s.outcome_codes ?? []) {
      const nodeId = cr01OutcomeNodeByCode.get(code);
      if (!nodeId) continue;
      await db.insert(schema.signalLinks).values({
        id: newId(),
        signalId: id,
        resourceType: "node",
        resourceId: nodeId,
        relation: "about",
        source: "ai",
        createdAt: now,
      });
    }
    for (const code of s.indicator_codes ?? []) {
      const indId = indicatorIdByCode2.get(code);
      if (!indId) continue;
      await db.insert(schema.signalLinks).values({
        id: newId(),
        signalId: id,
        resourceType: "indicator",
        resourceId: indId,
        relation: "about",
        source: "ai",
        createdAt: now,
      });
    }
    // index-type signals link to matching international index rankings
    if (s.signal_type === "index") {
      const title = `${s.title_en} ${s.summary_en}`.toLowerCase();
      for (const rk of rankingsForLinks) {
        const words = rk.indexNameEn.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        if (words.length >= 2 && words.filter((w) => title.includes(w)).length >= 2) {
          await db.insert(schema.signalLinks).values({
            id: newId(),
            signalId: id,
            resourceType: "ranking",
            resourceId: rk.id,
            relation: "about",
            source: "ai",
            createdAt: now,
          });
        }
      }
    }
    bump("signals_accepted");
  }
  // a few risk links so the heat map shows related-signal counts
  const risksForLinks = await db.select().from(schema.risks).limit(12);
  const acceptedSignalRows = await db
    .select({ id: schema.signals.id })
    .from(schema.signals)
    .where(eqOp(schema.signals.triageStatus, "accepted"))
    .limit(8);
  for (let i = 0; i < Math.min(5, risksForLinks.length, acceptedSignalRows.length); i++) {
    await db.insert(schema.signalLinks).values({
      id: newId(),
      signalId: acceptedSignalRows[i].id,
      resourceType: "risk",
      resourceId: risksForLinks[i].id,
      relation: "about",
      source: "ai",
      createdAt: now,
    });
  }

  // example questions for the Home ask box (CR01 3.2)
  const { setSetting } = await import("../src/server/settings");
  await setSetting("example_questions", cr01.example_questions);
  bump("example_questions", cr01.example_questions.length);

  /* ---------------- 12. structured record embeddings ---------------- */
  console.log("-- embedding structured records (search_index)...");
  await embedStructuredRecords();

  /* ---------------- 12b. CR01: seeded analyst conversations (mock mode) ---------------- */
  console.log("-- CR01: seeding analyst conversations for the analyst account...");
  {
    const { DEFAULT_AI_SETTINGS } = await import("../src/server/settings");
    await setSetting("ai", { ...DEFAULT_AI_SETTINGS, mockMode: true });
    const { analystStream } = await import("../src/server/ai/analyst");
    const { getCurrentUser: _g } = await import("../src/server/auth/session");
    void _g;
    const analystUserId = userIdByEmail.get("analyst@npc.qa")!;
    const [analystUser] = await db.select().from(schema.users).where(eqOp(schema.users.id, analystUserId)).limit(1);
    const [analystRole] = await db.select().from(schema.roles).where(eqOp(schema.roles.id, analystUser.roleId)).limit(1);
    const fullUser = { ...analystUser, role: analystRole, department: null } as never;
    const conversationSeeds = [
      "How are we doing in Qatarization?",
      "How many targets are in NDS3?",
      "Which outcomes are at risk?",
      "ما هو معدل التضخم الحالي؟",
      "Compare NDS2 and NDS3 on labour market targets",
    ];
    for (const question of conversationSeeds) {
      const convId = newId();
      await db.insert(schema.aiConversations).values({
        id: convId,
        userId: analystUserId,
        title: question.slice(0, 120),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(schema.aiMessages).values({
        id: newId(),
        conversationId: convId,
        role: "user",
        content: question,
        createdAt: now,
      });
      try {
        for await (const ev of analystStream({
          user: fullUser,
          message: question,
          locale: /[؀-ۿ]/.test(question) ? "ar" : "en",
          conversationId: convId,
        })) {
          if (ev.type === "final") {
            await db.insert(schema.aiMessages).values({
              id: newId(),
              conversationId: convId,
              role: "assistant",
              content: ev.markdown,
              citationsJson: JSON.stringify(ev.citations),
              confidence: ev.confidence,
              workspaceJson: JSON.stringify({
                workspace: ev.workspace,
                followUps: ev.followUps,
                includesSecret: ev.includesSecret,
              }),
              createdAt: now,
            });
          }
        }
        bump("seeded_conversations");
      } catch (e) {
        console.error("conversation seed failed:", question, (e as Error)?.message);
      }
    }
    await setSetting("ai", { ...DEFAULT_AI_SETTINGS, mockMode: false });
  }

  /* ---------------- 12c. CR02: strategy shape, lesson categories, rules,
        deliverables, podcast episodes ---------------- */
  console.log("-- CR02: strategy migration, categories, deliverables, podcast...");
  {
    // the new game rules (knowledge_by_voice, podcast, reports)
    const cr02Rules: [string, number][] = [
      ["knowledge_by_voice", 10],
      ["podcast_created", 30],
      ["podcast_listened_full", 5],
      ["report_extracted", 15],
    ];
    const { eq: eqRule } = await import("drizzle-orm");
    for (const [eventType, points] of cr02Rules) {
      const existing = await db
        .select({ id: schema.gameRules.id })
        .from(schema.gameRules)
        .where(eqRule(schema.gameRules.eventType, eventType))
        .limit(1);
      if (!existing.length) {
        await db.insert(schema.gameRules).values({
          id: newId(),
          eventType,
          points,
          multiplierRulesJson: null,
          isActive: 1,
        });
        bump("game_rules");
      }
    }
    const { migrateStrategyCr02 } = await import("./cr02-migrate-strategy");
    await migrateStrategyCr02();
    const { migrateLessonCategoriesCr02 } = await import("./cr02-migrate-lessons");
    await migrateLessonCategoriesCr02();
    const { seedDeliverablesCr02 } = await import("./cr02-seed-deliverables");
    report.deliverables = await seedDeliverablesCr02();
    const { seedPodcastCr02 } = await import("./cr02-seed-podcast");
    report.podcast_episodes = await seedPodcastCr02();
  }

  /* ---------------- 12d. CR04: pillars, chapters, Learning Room ---------------- */
  console.log("-- CR04: pillars, chapters, learning room seeds...");
  {
    const { seedCr04 } = await import("./cr04-seed");
    await seedCr04();
  }

  /* ---------------- 13. report ---------------- */
  const lines = [
    "# Seed report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Duration: ${((Date.now() - t0) / 1000).toFixed(0)}s`,
    "",
    "## Counts",
    ...Object.entries(report)
      .sort()
      .map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Items marked to verify or illustrative",
    ...(toVerify.length ? toVerify.slice(0, 200).map((v) => `- ${v}`) : ["- none"]),
    "",
  ];
  fs.writeFileSync(path.join(dataDir, "seed-report.md"), lines.join("\n"));
  console.log(`== seed complete in ${((Date.now() - t0) / 1000).toFixed(0)}s ==`);
  console.table(report);
  rawClient.close();
}

main().catch((e) => {
  console.error("SEED FAILED", e);
  process.exit(1);
});
