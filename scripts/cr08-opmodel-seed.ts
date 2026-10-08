/* eslint-disable no-console */
// CR08 10: the illustrative operating model: six principles, the governance
// bodies beyond the Programme Strategy's own (a settings row), eight Level 0
// processes with their Level 1 processes and Level 2 procedures, the RACI
// for every Level 1, the 2026 planning and reporting calendar (strategy
// reviews, the budget cycle, the data releases of the releases table
// plus the field survey round and the quarterly water balance and monthly air
// quality releases, NES reviews, quarterly Programme Steering Committee
// meetings, report deadlines from report_types, the Saudi Green Initiative
// Forum), ten external interfaces on entities of the register,
// twenty internal unit-to-unit interfaces with focal users, and five
// operational KPIs with monthly 2026 values.
//
// The words come from scripts/data/cr08-opmodel-content.ts. Idempotent: every
// row is keyed (process code, principle title, calendar kind + title + date,
// interface pair + kind + description, entity id, KPI code + period) and is
// updated in place on a rerun, so two runs report the same counts.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { and, eq, isNull } from "drizzle-orm";
import { ulid } from "ulid";
import {
  CALENDAR,
  CONNECTORS,
  COUNCIL_ENRICHMENT,
  ENTITY_INTERFACES,
  GOVERNANCE_BODIES,
  OPS_KPIS,
  PRINCIPLES,
  PROCESSES,
  RACI,
  REPORT_DEADLINES,
  UNIT_INTERFACES,
} from "./data/cr08-opmodel-content";

const now = () => new Date().toISOString();
const GOVERNANCE_SETTING_KEY = "operating_model_governance";
const POLICY_TABS = ["policy_internal", "procedure", "form_template", "service"];

export default async function seedCr08OpModel(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const { getSetting, setSetting } = await import("../src/server/settings");

  const units = await db.select().from(schema.orgUnits);
  const unitByCode = new Map(units.map((u) => [u.code.toUpperCase(), u]));
  if (!unitByCode.size) {
    console.log("cr08 opmodel: no organisation units; run the org seed first");
    return;
  }
  const users = await db.select().from(schema.users).where(isNull(schema.users.deletedAt));
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  const unitId = (code: string | null | undefined) => (code ? unitByCode.get(code.toUpperCase())?.id ?? null : null);
  const warn = (msg: string) => console.warn(`  cr08 opmodel: ${msg}`);
  /** the unit head with an account, else the first person of the unit */
  const personOfUnit = (code: string) => {
    const unit = unitByCode.get(code.toUpperCase());
    if (!unit) return null;
    const head = unit.headUserId ? users.find((u) => u.id === unit.headUserId) : null;
    if (head) return head;
    return users.find((u) => u.departmentId === unit.id && u.email !== "admin@enviroai.demo") ?? null;
  };

  /* 1. principles, keyed by the English title */
  let principles = 0;
  for (let i = 0; i < PRINCIPLES.length; i++) {
    const p = PRINCIPLES[i];
    const [existing] = await db.select().from(schema.operatingPrinciples).where(eq(schema.operatingPrinciples.titleEn, p.titleEn)).limit(1);
    const values = { sort: i, titleEn: p.titleEn, titleAr: p.titleAr, textEn: p.textEn, textAr: p.textAr, isIllustrative: 1 };
    if (existing) await db.update(schema.operatingPrinciples).set(values).where(eq(schema.operatingPrinciples.id, existing.id));
    else await db.insert(schema.operatingPrinciples).values({ id: ulid(), ...values });
    principles++;
  }

  /* 2. the governance bodies beyond the Programme Strategy's, once */
  const currentGovernance = await getSetting<{ bodies?: unknown[] }>(GOVERNANCE_SETTING_KEY, {});
  if (!Array.isArray(currentGovernance.bodies) || !currentGovernance.bodies.length || process.env.CR08_OPMODEL_RESEED === "1") {
    await setSetting(GOVERNANCE_SETTING_KEY, {
      bodies: GOVERNANCE_BODIES.map((b, i) => ({ ...b, sort: i })),
      councilEnrichment: COUNCIL_ENRICHMENT,
      connectors: CONNECTORS,
      isIllustrative: true,
    });
  }

  /* 3. processes by code, parents first (PROCESSES is ordered that way) */
  const policyDocs = (await db.select({ id: schema.documents.id, sourceRef: schema.documents.sourceRef }).from(schema.documents)).filter((d) =>
    (d.sourceRef ?? "").startsWith("cr07 policy:")
  );
  const docIdOfRef = (refs: string[] | undefined) =>
    (refs ?? [])
      .map((ref) => {
        const doc = policyDocs.find((d) => d.sourceRef === ref);
        if (!doc) warn(`policy document "${ref}" is not seeded; link skipped`);
        return doc?.id ?? null;
      })
      .filter((id): id is string => Boolean(id));
  const idOfCode = new Map<string, string>();
  const levelCounts = { 0: 0, 1: 0, 2: 0 } as Record<number, number>;
  for (let i = 0; i < PROCESSES.length; i++) {
    const p = PROCESSES[i];
    const parentId = p.parentCode ? idOfCode.get(p.parentCode) ?? null : null;
    if (p.parentCode && !parentId) {
      warn(`process ${p.code} names an unknown parent ${p.parentCode}; skipped`);
      continue;
    }
    const ownerUnitId = unitId(p.ownerUnitCode);
    if (!ownerUnitId) warn(`process ${p.code} names an unknown unit ${p.ownerUnitCode}`);
    for (const s of p.steps ?? []) {
      if (s.role_unit_code && !unitId(s.role_unit_code)) warn(`process ${p.code} step ${s.n} names an unknown unit ${s.role_unit_code}`);
    }
    const values = {
      parentId,
      level: p.level,
      code: p.code,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      purposeEn: p.purposeEn,
      purposeAr: p.purposeAr,
      ownerUnitId,
      inputsJson: p.inputs ? JSON.stringify(p.inputs) : null,
      outputsJson: p.outputs ? JSON.stringify(p.outputs) : null,
      stepsJson: p.steps ? JSON.stringify(p.steps) : null,
      systemsJson: p.systems ? JSON.stringify(p.systems) : null,
      kpisJson: p.kpis ? JSON.stringify(p.kpis) : null,
      policyDocumentIdsJson: JSON.stringify(docIdOfRef(p.policyDocRefs)),
      sopDocumentIdsJson: JSON.stringify(docIdOfRef(p.sopDocRefs)),
      status: "active",
      sort: i,
      isIllustrative: 1,
      updatedAt: now(),
    };
    const [existing] = await db.select({ id: schema.processes.id }).from(schema.processes).where(eq(schema.processes.code, p.code)).limit(1);
    let id = existing?.id;
    if (id) await db.update(schema.processes).set(values).where(eq(schema.processes.id, id));
    else {
      id = ulid();
      await db.insert(schema.processes).values({ id, ...values, createdAt: now() });
    }
    idOfCode.set(p.code, id);
    levelCounts[p.level]++;
  }

  /* 4. the RACI */
  let raciRows = 0;
  for (const r of RACI) {
    const processId = idOfCode.get(r.processCode);
    if (!processId) {
      warn(`RACI names an unknown process ${r.processCode}`);
      continue;
    }
    const cells: { code: string; role: string }[] = [
      { code: r.A, role: "A" },
      ...r.R.map((code) => ({ code, role: "R" })),
      ...r.C.map((code) => ({ code, role: "C" })),
      ...r.I.map((code) => ({ code, role: "I" })),
    ];
    for (const cell of cells) {
      const uid = unitId(cell.code);
      if (!uid) {
        warn(`RACI ${r.processCode} names an unknown unit ${cell.code}`);
        continue;
      }
      const [existing] = await db
        .select()
        .from(schema.processRaci)
        .where(and(eq(schema.processRaci.processId, processId), eq(schema.processRaci.unitId, uid)))
        .limit(1);
      if (existing) {
        if (existing.role !== cell.role) await db.update(schema.processRaci).set({ role: cell.role }).where(eq(schema.processRaci.id, existing.id));
      } else {
        await db.insert(schema.processRaci).values({ id: ulid(), processId, unitId: uid, role: cell.role });
      }
      raciRows++;
    }
  }

  /* 5. the calendar */
  const [strategy] = await db.select().from(schema.councilStrategies).limit(1);
  const reportTypes = await db.select().from(schema.reportTypes);
  const releases = await db.select().from(schema.releases);
  type CalRow = {
    kind: string;
    titleEn: string;
    titleAr: string;
    dateFrom: string;
    dateTo: string | null;
    ownerUnitId: string | null;
    linkedResourceType: string | null;
    linkedResourceId: string | null;
    recurrence: string;
  };
  const calRows: CalRow[] = [];
  for (const c of CALENDAR) {
    let linkedType: string | null = null;
    let linkedId: string | null = null;
    if (c.linked) {
      linkedType = c.linked.type;
      if (c.linked.type === "process") linkedId = idOfCode.get(c.linked.ref) ?? null;
      else if (c.linked.type === "report_type") linkedId = reportTypes.find((r) => r.code === c.linked!.ref)?.id ?? null;
      else if (c.linked.type === "release") linkedId = releases.find((r) => r.titleEn === c.linked!.ref)?.id ?? null;
      else if (c.linked.type === "council_strategy") linkedId = strategy?.id ?? null;
      if (!linkedId) linkedType = null;
    }
    calRows.push({
      kind: c.kind,
      titleEn: c.titleEn,
      titleAr: c.titleAr,
      dateFrom: c.dateFrom,
      dateTo: c.dateTo ?? null,
      ownerUnitId: unitId(c.ownerUnitCode),
      linkedResourceType: linkedType,
      linkedResourceId: linkedId,
      recurrence: c.recurrence,
    });
  }
  // the data releases already in the releases table, dated as published
  const releaseOwner = (title: string) =>
    /water|balance|account|digest|index|indices/i.test(title) ? "EAS" : /air quality|emission/i.test(title) ? "AQD" : "DOP";
  for (const r of releases) {
    calRows.push({
      kind: "statistical_release",
      titleEn: r.titleEn.replace(/\s*\(Forthcoming\)$/i, ""),
      titleAr: r.titleAr.replace(/\s*\(قادمة\)$/, ""),
      dateFrom: r.releaseDate,
      dateTo: null,
      ownerUnitId: unitId(releaseOwner(r.titleEn)),
      linkedResourceType: "release",
      linkedResourceId: r.id,
      recurrence: "none",
    });
  }
  // report deadlines from the report types that exist, at their cadence
  for (const d of REPORT_DEADLINES) {
    const rt = reportTypes.find((r) => r.code === d.code && r.isActive === 1);
    if (!rt) continue;
    calRows.push({
      kind: "report_deadline",
      titleEn: `${rt.nameEn} due`,
      titleAr: `موعد ${rt.nameAr}`,
      dateFrom: d.dateFrom,
      dateTo: null,
      ownerUnitId: unitId(d.ownerUnitCode),
      linkedResourceType: "report_type",
      linkedResourceId: rt.id,
      recurrence: d.recurrence,
    });
  }
  let calendarRows = 0;
  for (const row of calRows) {
    const [existing] = await db
      .select({ id: schema.calendarEvents.id })
      .from(schema.calendarEvents)
      .where(and(eq(schema.calendarEvents.kind, row.kind), eq(schema.calendarEvents.titleEn, row.titleEn), eq(schema.calendarEvents.dateFrom, row.dateFrom)))
      .limit(1);
    if (existing) await db.update(schema.calendarEvents).set({ ...row, isIllustrative: 1 }).where(eq(schema.calendarEvents.id, existing.id));
    else await db.insert(schema.calendarEvents).values({ id: ulid(), ...row, isIllustrative: 1 });
    calendarRows++;
  }

  /* 6. internal interfaces */
  let internal = 0;
  for (const i of UNIT_INTERFACES) {
    const fromUnitId = unitId(i.from);
    const toUnitId = unitId(i.to);
    if (!fromUnitId || !toUnitId) {
      warn(`interface ${i.from} to ${i.to} names an unknown unit; skipped`);
      continue;
    }
    const focalFrom = (i.focalFromEmail ? userByEmail.get(i.focalFromEmail.toLowerCase()) : null) ?? personOfUnit(i.from);
    const focalTo = (i.focalToEmail ? userByEmail.get(i.focalToEmail.toLowerCase()) : null) ?? personOfUnit(i.to);
    const values = {
      fromUnitId,
      toUnitId,
      flowKind: i.flowKind,
      descriptionEn: i.descriptionEn,
      descriptionAr: i.descriptionAr,
      triggerEn: i.triggerEn,
      triggerAr: i.triggerAr,
      cadence: i.cadence,
      serviceLevel: i.serviceLevel,
      processId: idOfCode.get(i.processCode) ?? null,
      focalFromUserId: focalFrom?.id ?? null,
      focalToUserId: focalTo?.id ?? null,
      status: "active",
      isIllustrative: 1,
    };
    const [existing] = await db
      .select({ id: schema.unitInterfaces.id })
      .from(schema.unitInterfaces)
      .where(
        and(
          eq(schema.unitInterfaces.fromUnitId, fromUnitId),
          eq(schema.unitInterfaces.toUnitId, toUnitId),
          eq(schema.unitInterfaces.flowKind, i.flowKind),
          eq(schema.unitInterfaces.descriptionEn, i.descriptionEn)
        )
      )
      .limit(1);
    if (existing) await db.update(schema.unitInterfaces).set(values).where(eq(schema.unitInterfaces.id, existing.id));
    else await db.insert(schema.unitInterfaces).values({ id: ulid(), ...values });
    internal++;
  }

  /* 7. external interfaces on entities of the register */
  const entities = (await db.select().from(schema.entities)).filter((e) => e.isActive === 1 && !e.mergedIntoId);
  let external = 0;
  for (const e of ENTITY_INTERFACES) {
    const needle = e.entityShort.toLowerCase();
    const entity =
      entities.find((x) => (x.shortNameEn ?? "").toLowerCase() === needle) ??
      entities.find((x) => x.nameEn.toLowerCase() === needle) ??
      entities.find((x) => x.nameEn.toLowerCase().includes(needle));
    if (!entity) {
      warn(`entity "${e.entityShort}" is not in the register; skipped`);
      continue;
    }
    const focal = personOfUnit(e.focalOrgUnitCode);
    const values = {
      entityId: entity.id,
      providesEn: e.providesEn,
      providesAr: e.providesAr,
      receivesEn: e.receivesEn,
      receivesAr: e.receivesAr,
      focalOrgUserId: focal?.id ?? null,
      focalEntityName: e.focalEntityName,
      legalBasisEn: e.legalBasisEn,
      legalBasisAr: e.legalBasisAr,
      cadence: e.cadence,
      processIdsJson: JSON.stringify(e.processCodes.map((c) => idOfCode.get(c)).filter(Boolean)),
      isIllustrative: 1,
    };
    const [existing] = await db.select({ id: schema.entityInterfaces.id }).from(schema.entityInterfaces).where(eq(schema.entityInterfaces.entityId, entity.id)).limit(1);
    if (existing) await db.update(schema.entityInterfaces).set(values).where(eq(schema.entityInterfaces.id, existing.id));
    else await db.insert(schema.entityInterfaces).values({ id: ulid(), ...values });
    external++;
  }

  /* 8. operational KPIs with their monthly 2026 values to date */
  const live = await liveValues();
  const thisMonth = now().slice(0, 7);
  let kpis = 0;
  let kpiValues = 0;
  for (let i = 0; i < OPS_KPIS.length; i++) {
    const k = OPS_KPIS[i];
    const values = {
      code: k.code,
      nameEn: k.nameEn,
      nameAr: k.nameAr,
      unit: k.unit,
      direction: k.direction,
      sourceKind: k.sourceKind,
      targetValue: k.target,
      sort: i,
    };
    const [existing] = await db.select({ id: schema.opsKpis.id }).from(schema.opsKpis).where(eq(schema.opsKpis.code, k.code)).limit(1);
    let kpiId = existing?.id;
    if (kpiId) await db.update(schema.opsKpis).set(values).where(eq(schema.opsKpis.id, kpiId));
    else {
      kpiId = ulid();
      await db.insert(schema.opsKpis).values({ id: kpiId, ...values });
    }
    kpis++;
    for (let m = 0; m < k.values.length && m < 12; m++) {
      const period = `2026-${String(m + 1).padStart(2, "0")}`;
      if (period > thisMonth) break;
      let value = k.values[m];
      if (k.sourceKind === "auto" && period === thisMonth && live.has(k.code)) value = live.get(k.code)!;
      const [row] = await db
        .select({ id: schema.opsKpiValues.id })
        .from(schema.opsKpiValues)
        .where(and(eq(schema.opsKpiValues.kpiId, kpiId), eq(schema.opsKpiValues.period, period)))
        .limit(1);
      if (row) await db.update(schema.opsKpiValues).set({ value }).where(eq(schema.opsKpiValues.id, row.id));
      else await db.insert(schema.opsKpiValues).values({ id: ulid(), kpiId, period, value, enteredBy: null, createdAt: now() });
      kpiValues++;
    }
  }

  console.log(
    `cr08 opmodel: ${principles} principles, ${GOVERNANCE_BODIES.length} governance bodies (settings), ${levelCounts[0]} level 0 + ${levelCounts[1]} level 1 + ${levelCounts[2]} level 2 processes, ${raciRows} RACI cells, ${calendarRows} calendar events, ${internal} internal interfaces, ${external} external interfaces, ${kpis} KPIs with ${kpiValues} values`
  );

  /** the same live readings the scorecard uses for the current month */
  async function liveValues(): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    const handovers = await db.select({ status: schema.handovers.status }).from(schema.handovers);
    out.set("handover_completion", handovers.length ? Math.round((100 * handovers.filter((h) => h.status === "complete").length) / handovers.length) : 100);
    const [dimension] = await db.select().from(schema.taxonomyDimensions).where(eq(schema.taxonomyDimensions.code, "knowledge_type")).limit(1);
    const terms = dimension ? await db.select().from(schema.taxonomyTerms).where(eq(schema.taxonomyTerms.dimensionId, dimension.id)) : [];
    const termIds = new Set(terms.filter((t) => POLICY_TABS.includes(t.code)).map((t) => t.id));
    const docs = (await db.select().from(schema.documents).where(isNull(schema.documents.deletedAt))).filter(
      (d) => d.knowledgeTypeTermId && termIds.has(d.knowledgeTypeTermId) && d.status !== "archived"
    );
    const today = new Date();
    const current = docs.filter((d) => {
      if (!d.effectiveFrom || !d.reviewCycleMonths) return true;
      const due = new Date(d.effectiveFrom);
      due.setMonth(due.getMonth() + d.reviewCycleMonths);
      return due > today;
    }).length;
    out.set("policy_review_currency", docs.length ? Math.round((100 * current) / docs.length) : 100);
    return out;
  }
}

const isMain = process.argv[1] && /cr08-opmodel-seed\.ts$/.test(process.argv[1]);
if (isMain) {
  seedCr08OpModel()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
