/* eslint-disable no-console */
// CR07 2.6: seeds the illustrative Council Strategy.
//
// The words come from scripts/data/cr07-council-content-a.ts (direction,
// situation analysis, governance, risks, goals, intermediate outcomes,
// outputs) and cr07-council-content-b.ts (projects, activities, indicators).
// Everything mechanical is generated here and deterministically, so a reseed
// reproduces the same database byte for byte: period targets on a straight
// line from the baseline to the 2030 target, actuals for 2025 and the first
// three quarters of 2026 that read the way the indicator's `performance`
// field says, milestone dates, stakeholders, deliverables, lesson links,
// signal links and two podcast episodes.
//
// Idempotent: it skips when the strategy already exists.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { eq, inArray, isNull } from "drizzle-orm";
import { ulid } from "ulid";
import { STRATEGY_META, SWOT, STAKEHOLDERS, CHALLENGES, BASELINES, GOVERNANCE, RISKS, GOALS, INTERMEDIATE_OUTCOMES, OUTPUTS } from "./data/cr07-council-content-a";
import { PROJECTS, INDICATORS } from "./data/cr07-council-content-b";
import type { IndicatorSeed } from "./data/cr07-council-types";

const now = () => new Date().toISOString();

/** Deterministic small hash, the same one the CR05 and CR06 seeds use. */
function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/* ------------------------------------------------------------------ */
/* period machinery                                                     */
/* ------------------------------------------------------------------ */

const BASE_YEAR = 2025;
const END_YEAR = 2030;

/** Every period of a cadence from 2025 to 2030, oldest first. */
function periodsFor(freq: "monthly" | "quarterly" | "yearly"): string[] {
  const out: string[] = [];
  for (let y = BASE_YEAR; y <= END_YEAR; y++) {
    if (freq === "yearly") out.push(String(y));
    else if (freq === "quarterly") for (let q = 1; q <= 4; q++) out.push(`${y}-Q${q}`);
    else for (let m = 1; m <= 12; m++) out.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

/** The periods that already have an actual: all of 2025, and 2026 to Q3. */
function reportedPeriods(freq: "monthly" | "quarterly" | "yearly"): string[] {
  if (freq === "yearly") return ["2025", "2026"];
  if (freq === "quarterly") return ["2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2", "2026-Q3"];
  const out: string[] = [];
  for (let m = 1; m <= 12; m++) out.push(`2025-${String(m).padStart(2, "0")}`);
  for (let m = 1; m <= 9; m++) out.push(`2026-${String(m).padStart(2, "0")}`);
  return out;
}

/** 0 at the first period of 2025, 1 at the last period of 2030. */
function progressOf(period: string, all: string[]): number {
  const i = all.indexOf(period);
  return all.length > 1 ? i / (all.length - 1) : 1;
}

function round(value: number, unit: string | null): number {
  if (unit === "percent" || unit === "score") return Math.round(value * 10) / 10;
  if (unit === "ratio") return Math.round(value * 100) / 100;
  if (unit === "QAR million") return Math.round(value * 10) / 10;
  return Math.round(value);
}

/**
 * The target line: straight from the baseline to the 2030 target. The actual
 * line tracks it and then lands where `performance` says, with a small
 * deterministic wobble so the charts do not look drawn with a ruler.
 */
function seriesFor(indicator: IndicatorSeed): {
  targets: { period: string; value: number }[];
  actuals: { period: string; value: number }[];
} {
  const freq = indicator.frequency as "monthly" | "quarterly" | "yearly";
  const all = periodsFor(freq);
  const reported = new Set(reportedPeriods(freq));
  const span = indicator.targetValue2030 - indicator.baselineValue;
  const h = hashOf(indicator.code);
  // how far off target the actual lands by the newest reported period
  const gap =
    indicator.performance === "on_target"
      ? 0.02 + ((h % 5) / 100)
      : indicator.performance === "at_risk"
        ? 0.12 + ((h % 6) / 100)
        : 0.28 + ((h % 9) / 100);
  const down = indicator.direction === "down_good";

  const targets: { period: string; value: number }[] = [];
  const actuals: { period: string; value: number }[] = [];
  for (const period of all) {
    const p = progressOf(period, all);
    const targetValue = indicator.baselineValue + span * p;
    targets.push({ period, value: round(targetValue, indicator.unit) });
    if (!reported.has(period)) continue;
    // The shortfall opens in the first third of the period and then holds, so
    // by the newest reported quarter an indicator reads the way its own
    // `performance` field says rather than still hugging the target line.
    const wobble = (((hashOf(indicator.code + period) % 100) / 100) - 0.5) * 0.04;
    const shortfall = gap * Math.min(1, p * 3) + wobble;
    // a shortfall moves the actual against the good direction
    const raw = down
      ? indicator.baselineValue + span * p * (1 - shortfall) + Math.abs(span) * shortfall
      : indicator.baselineValue + span * p * (1 - shortfall);
    let value = raw;
    if (indicator.unit === "percent") value = Math.max(0, Math.min(100, value));
    if (indicator.unit === "score" || indicator.unit === "number" || indicator.unit === "days") {
      value = Math.max(0, value);
    }
    actuals.push({ period, value: round(value, indicator.unit) });
  }
  return { targets, actuals };
}

/* ------------------------------------------------------------------ */
/* the seeder                                                           */
/* ------------------------------------------------------------------ */

export async function seedCr07Council(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");

  const [already] = await db.select().from(schema.councilStrategies).limit(1);
  if (already && process.env.CR07_COUNCIL_RESEED !== "1") {
    console.log("cr07 council: the strategy already exists; skipping");
    return;
  }
  if (already) {
    console.log("cr07 council: CR07_COUNCIL_RESEED=1, clearing the council tables");
    const nodeIds = (
      await db.select({ id: schema.councilNodes.id }).from(schema.councilNodes)
    ).map((n) => n.id);
    for (const table of [
      schema.councilIndicatorValues,
      schema.councilIndicatorTargets,
      schema.councilIndicators,
      schema.councilMilestones,
      schema.councilDependencies,
      schema.councilAlignment,
      schema.councilRisks,
      schema.councilGovernance,
      schema.councilAnalysis,
      schema.councilChangeLog,
      schema.councilNodes,
      schema.councilStrategies,
    ]) {
      await db.delete(table);
    }
    if (nodeIds.length) {
      await db.delete(schema.nodeStakeholders).where(inArray(schema.nodeStakeholders.nodeId, nodeIds));
      await db.delete(schema.lessonNodeLinks).where(inArray(schema.lessonNodeLinks.nodeId, nodeIds));
      await db.delete(schema.signalLinks).where(inArray(schema.signalLinks.resourceId, nodeIds));
      await db.delete(schema.deliverableMeta).where(inArray(schema.deliverableMeta.nodeId, nodeIds));
      await db.delete(schema.relations).where(inArray(schema.relations.toId, nodeIds));
    }
    // the deliverable documents point at council nodes that no longer exist
    const strayDocs = (
      await db
        .select({ id: schema.documents.id, sourceRef: schema.documents.sourceRef })
        .from(schema.documents)
    )
      .filter((d) => (d.sourceRef ?? "").startsWith("cr07 council deliverable:"))
      .map((d) => d.id);
    if (strayDocs.length) {
      await db.delete(schema.documentChunks).where(inArray(schema.documentChunks.documentId, strayDocs));
      await db.delete(schema.documents).where(inArray(schema.documents.id, strayDocs));
    }
    // the ten seeded council lessons go with them
    const orphanLessons = await db
      .select({ id: schema.lessons.id })
      .from(schema.lessons)
      .where(eq(schema.lessons.category, "delivery"));
    const linked = new Set(
      (await db.select({ lessonId: schema.lessonNodeLinks.lessonId }).from(schema.lessonNodeLinks)).map(
        (l) => l.lessonId
      )
    );
    const strays = orphanLessons.filter((l) => !linked.has(l.id)).map((l) => l.id);
    if (strays.length) {
      await db.delete(schema.lessons).where(inArray(schema.lessons.id, strays));
    }
  }

  const units = await db.select().from(schema.orgUnits);
  const unitByCode = new Map(units.map((u) => [u.code, u]));
  if (!unitByCode.size) {
    console.log("cr07 council: no organisation units; run the org seed first");
    return;
  }
  const users = await db.select().from(schema.users).where(isNull(schema.users.deletedAt));
  const usersByUnit = new Map<string, typeof users>();
  for (const u of users) {
    if (!u.departmentId) continue;
    (usersByUnit.get(u.departmentId) ?? usersByUnit.set(u.departmentId, []).get(u.departmentId)!).push(u);
  }
  /** A stable person from the owning unit, else anyone. */
  const personFor = (unitCode: string, salt: number) => {
    const unit = unitByCode.get(unitCode);
    const pool = (unit ? usersByUnit.get(unit.id) : undefined) ?? [];
    const fallback = users.filter((u) => u.email !== "admin@npc.qa");
    const chosen = pool.length ? pool : fallback;
    return chosen.length ? chosen[(hashOf(unitCode) + salt * 7919) % chosen.length] : null;
  };

  /* 1. the strategy header */
  const strategyId = ulid();
  const ownerUnit = unitByCode.get(STRATEGY_META.ownerUnitCode);
  await db.insert(schema.councilStrategies).values({
    id: strategyId,
    nameEn: STRATEGY_META.nameEn,
    nameAr: STRATEGY_META.nameAr,
    periodFrom: STRATEGY_META.periodFrom,
    periodTo: STRATEGY_META.periodTo,
    visionEn: STRATEGY_META.visionEn,
    visionAr: STRATEGY_META.visionAr,
    missionEn: STRATEGY_META.missionEn,
    missionAr: STRATEGY_META.missionAr,
    valuesJson: JSON.stringify(
      STRATEGY_META.values.map((v) => ({
        name_en: v.nameEn,
        name_ar: v.nameAr,
        description_en: v.descriptionEn,
        description_ar: v.descriptionAr,
      }))
    ),
    status: "live",
    isDefault: 1,
    approvedOn: STRATEGY_META.approvedOn,
    sourceDocumentId: null,
    ownerUnitId: ownerUnit?.id ?? null,
    isIllustrative: 1,
    createdAt: now(),
    updatedAt: now(),
  });

  /* 2. the situation analysis */
  const analysisRows: { kind: string; payload: unknown }[] = [
    {
      kind: "swot",
      payload: SWOT.map((s) => ({ quadrant: s.quadrant, textEn: s.textEn, textAr: s.textAr })),
    },
    {
      kind: "stakeholder",
      payload: STAKEHOLDERS.map((s) => ({
        nameEn: s.nameEn,
        nameAr: s.nameAr,
        interest: s.interest,
        influence: s.influence,
        roleEn: s.roleEn,
        roleAr: s.roleAr,
      })),
    },
    {
      kind: "challenge",
      payload: CHALLENGES.map((c) => ({
        titleEn: c.titleEn,
        titleAr: c.titleAr,
        descriptionEn: c.descriptionEn,
        descriptionAr: c.descriptionAr,
        goalCode: c.goalCode,
      })),
    },
    {
      kind: "baseline",
      payload: BASELINES.map((b) => ({ textEn: b.textEn, textAr: b.textAr })),
    },
  ];
  let sort = 0;
  for (const row of analysisRows) {
    await db.insert(schema.councilAnalysis).values({
      id: ulid(),
      strategyId,
      kind: row.kind,
      payloadJson: JSON.stringify(row.payload),
      sort: sort++,
    });
  }

  /* 3. the results chain */
  const idOfCode = new Map<string, string>();
  const insertNode = async (input: {
    code: string;
    parentCode: string | null;
    level: string;
    titleEn: string;
    titleAr: string;
    descriptionEn: string;
    descriptionAr: string;
    ownerUnitCode: string;
    ownerUserId?: string | null;
    status?: string;
    startDate?: string | null;
    endDate?: string | null;
    budgetQar?: number | null;
    inputsJson?: string | null;
    priorityImpact?: number | null;
    priorityFeasibility?: number | null;
    order: number;
  }) => {
    const id = ulid();
    idOfCode.set(input.code, id);
    await db.insert(schema.councilNodes).values({
      id,
      strategyId,
      parentId: input.parentCode ? idOfCode.get(input.parentCode) ?? null : null,
      level: input.level,
      code: input.code,
      titleEn: input.titleEn,
      titleAr: input.titleAr,
      descriptionEn: input.descriptionEn,
      descriptionAr: input.descriptionAr,
      ownerUnitId: unitByCode.get(input.ownerUnitCode)?.id ?? null,
      ownerUserId: input.ownerUserId ?? null,
      status: input.status ?? "on_track",
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      budgetQar: input.budgetQar ?? null,
      inputsJson: input.inputsJson ?? null,
      priorityImpact: input.priorityImpact ?? null,
      priorityFeasibility: input.priorityFeasibility ?? null,
      sort: input.order,
      sourceRef: "SiaNexus Council Strategy, illustrative data",
      isIllustrative: 1,
      createdAt: now(),
      updatedAt: now(),
    });
    return id;
  };

  let order = 0;
  for (const g of GOALS) {
    await insertNode({
      code: g.code,
      parentCode: null,
      level: "goal",
      titleEn: g.titleEn,
      titleAr: g.titleAr,
      descriptionEn: g.descriptionEn,
      descriptionAr: g.descriptionAr,
      ownerUnitCode: g.ownerUnitCode,
      startDate: STRATEGY_META.periodFrom,
      endDate: STRATEGY_META.periodTo,
      order: order++,
    });
  }
  for (const io of INTERMEDIATE_OUTCOMES) {
    await insertNode({
      code: io.code,
      parentCode: io.goalCode,
      level: "intermediate_outcome",
      titleEn: io.titleEn,
      titleAr: io.titleAr,
      descriptionEn: io.descriptionEn,
      descriptionAr: io.descriptionAr,
      ownerUnitCode: io.ownerUnitCode,
      startDate: STRATEGY_META.periodFrom,
      endDate: STRATEGY_META.periodTo,
      order: order++,
    });
  }
  for (const op of OUTPUTS) {
    await insertNode({
      code: op.code,
      parentCode: op.intermediateCode,
      level: "output",
      titleEn: op.titleEn,
      titleAr: op.titleAr,
      descriptionEn: op.descriptionEn,
      descriptionAr: op.descriptionAr,
      ownerUnitCode: op.ownerUnitCode,
      startDate: STRATEGY_META.periodFrom,
      endDate: STRATEGY_META.periodTo,
      order: order++,
    });
  }

  /* projects: dates spread across the period, owned by a person of the unit */
  const projectIdOfCode = new Map<string, string>();
  for (const p of PROJECTS) {
    const h = hashOf(p.code);
    const startYear = 2025 + (h % 3); // 2025 to 2027
    const startMonth = 1 + (h % 12);
    const months = 9 + (h % 16); // 9 to 24 months
    const start = new Date(Date.UTC(startYear, startMonth - 1, 1));
    const end = new Date(Date.UTC(startYear, startMonth - 1 + months, 0));
    const owner = personFor(p.ownerUnitCode, 3);
    const id = await insertNode({
      code: p.code,
      parentCode: p.outputCode,
      level: "project",
      titleEn: p.titleEn,
      titleAr: p.titleAr,
      descriptionEn: p.descriptionEn,
      descriptionAr: p.descriptionAr,
      ownerUnitCode: p.ownerUnitCode,
      ownerUserId: owner?.id ?? null,
      status: p.status,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      budgetQar: p.budgetQar,
      inputsJson: JSON.stringify({
        people: p.people,
        systems_en: p.systemsEn,
        systems_ar: p.systemsAr,
        note_en: p.inputsEn,
        note_ar: p.inputsAr,
      }),
      priorityImpact: p.priorityImpact,
      priorityFeasibility: p.priorityFeasibility,
      order: order++,
    });
    projectIdOfCode.set(p.code, id);

    // activities
    let ai = 0;
    for (const a of p.activities) {
      await insertNode({
        code: `${p.code}.A${ai + 1}`,
        parentCode: p.code,
        level: "activity",
        titleEn: a.titleEn,
        titleAr: a.titleAr,
        descriptionEn: "",
        descriptionAr: "",
        ownerUnitCode: p.ownerUnitCode,
        ownerUserId: owner?.id ?? null,
        status: a.status,
        order: order++,
      });
      ai++;
    }

    // milestones: one per activity plus a closing one, dated across the span
    const spanMs = end.getTime() - start.getTime();
    const milestoneCount = Math.max(2, p.activities.length);
    for (let m = 0; m < milestoneCount; m++) {
      const at = new Date(start.getTime() + (spanMs * (m + 1)) / (milestoneCount + 1));
      const done = at.getTime() < Date.now() && p.status !== "delayed" && p.status !== "not_started";
      await db.insert(schema.councilMilestones).values({
        id: ulid(),
        nodeId: id,
        titleEn: m === milestoneCount - 1 ? "Closure report approved" : `Stage ${m + 1} complete`,
        titleAr: m === milestoneCount - 1 ? "اعتماد تقرير الإغلاق" : `اكتمال المرحلة ${m + 1}`,
        dueDate: at.toISOString().slice(0, 10),
        doneDate: done ? at.toISOString().slice(0, 10) : null,
        status: done ? "done" : at.getTime() < Date.now() ? "overdue" : "planned",
        sort: m,
      });
    }
  }

  /* dependencies: about a third of the projects wait on a sibling */
  const projectCodes = PROJECTS.map((p) => p.code);
  let dependencies = 0;
  for (const p of PROJECTS) {
    const h = hashOf(p.code + "dep");
    if (h % 3 !== 0) continue;
    const otherCode = projectCodes[h % projectCodes.length];
    if (otherCode === p.code) continue;
    const from = projectIdOfCode.get(p.code);
    const to = projectIdOfCode.get(otherCode);
    if (!from || !to) continue;
    await db.insert(schema.councilDependencies).values({
      id: ulid(),
      nodeId: from,
      dependsOnNodeId: to,
      noteEn: "Cannot start before the preceding project delivers its outputs.",
      noteAr: "لا يمكن البدء قبل تسليم المشروع السابق لمخرجاته.",
    });
    dependencies++;
  }

  /* 4. alignment to NDS3 */
  const ndsNodes = await db
    .select({
      id: schema.strategyNodes.id,
      code: schema.strategyNodes.code,
      editionId: schema.strategyNodes.editionId,
      nodeType: schema.strategyNodes.nodeType,
    })
    .from(schema.strategyNodes)
    .where(eq(schema.strategyNodes.nodeType, "outcome"));
  const [nds3] = await db
    .select()
    .from(schema.strategyEditions)
    .where(eq(schema.strategyEditions.code, "nds3"))
    .limit(1);
  const outcomeByCode = new Map(
    ndsNodes.filter((n) => n.editionId === nds3?.id && n.code).map((n) => [n.code!, n.id])
  );
  let alignments = 0;
  for (const g of GOALS) {
    const councilNodeId = idOfCode.get(g.code);
    if (!councilNodeId) continue;
    for (const a of g.alignment) {
      const targetId =
        a.targetKind === "nds_node" ? outcomeByCode.get(a.targetCode) ?? null : a.targetCode;
      if (!targetId) continue;
      await db.insert(schema.councilAlignment).values({
        id: ulid(),
        councilNodeId,
        targetKind: a.targetKind,
        targetId,
        labelEn: a.labelEn,
        labelAr: a.labelAr,
        noteEn: a.noteEn,
        noteAr: a.noteAr,
      });
      alignments++;
    }
  }

  /* 5. indicators with their cards, targets and actuals */
  let targetRows = 0;
  let valueRows = 0;
  const statsIndicators = await db
    .select({ id: schema.indicators.id, code: schema.indicators.code })
    .from(schema.indicators)
    .limit(200);
  let indicatorSort = 0;
  for (const ind of INDICATORS) {
    const nodeId = idOfCode.get(ind.nodeCode);
    if (!nodeId) {
      console.warn(`  indicator ${ind.code} points at unknown node ${ind.nodeCode}`);
      continue;
    }
    const ownerCode =
      PROJECTS.find((p) => p.code === ind.nodeCode)?.ownerUnitCode ??
      OUTPUTS.find((o) => o.code === ind.nodeCode)?.ownerUnitCode ??
      INTERMEDIATE_OUTCOMES.find((io) => io.code === ind.nodeCode)?.ownerUnitCode ??
      GOALS.find((g) => g.code === ind.nodeCode)?.ownerUnitCode ??
      "IDP";
    const responsible = personFor(ownerCode, 11);
    // CR07 2.5: about one in ten reads its actuals from the Statistics Hub
    const linked =
      statsIndicators.length && hashOf(ind.code) % 10 === 0
        ? statsIndicators[hashOf(ind.code) % statsIndicators.length].id
        : null;
    const indicatorId = ulid();
    await db.insert(schema.councilIndicators).values({
      id: indicatorId,
      nodeId,
      code: ind.code,
      nameEn: ind.nameEn,
      nameAr: ind.nameAr,
      definitionEn: ind.definitionEn,
      definitionAr: ind.definitionAr,
      formulaEn: ind.formulaEn,
      formulaAr: ind.formulaAr,
      unit: ind.unit,
      direction: ind.direction,
      baselineYear: "2024",
      baselineValue: ind.baselineValue,
      frequency: ind.frequency,
      dataSourceEn: ind.dataSourceEn,
      dataSourceAr: ind.dataSourceAr,
      meansOfVerificationEn: ind.meansOfVerificationEn,
      meansOfVerificationAr: ind.meansOfVerificationAr,
      responsibleUserId: responsible?.id ?? null,
      linkedStatisticsIndicatorId: linked,
      notesEn: ind.notesEn,
      notesAr: ind.notesAr,
      sort: indicatorSort++,
      createdAt: now(),
      updatedAt: now(),
    });
    const { targets, actuals } = seriesFor(ind);
    for (const t of targets) {
      await db.insert(schema.councilIndicatorTargets).values({
        id: ulid(),
        indicatorId,
        period: t.period,
        targetValue: t.value,
      });
      targetRows++;
    }
    for (const a of actuals) {
      await db.insert(schema.councilIndicatorValues).values({
        id: ulid(),
        indicatorId,
        period: a.period,
        actualValue: a.value,
        // the newest period of each indicator is still provisional
        status: a.period === actuals[actuals.length - 1]?.period ? "provisional" : "final",
        sourceDocumentId: null,
        enteredBy: responsible?.id ?? null,
        createdAt: now(),
      });
      valueRows++;
    }
  }

  /* 6. risks */
  for (const r of RISKS) {
    const owner = personFor(
      r.nodeCode
        ? PROJECTS.find((p) => p.code === r.nodeCode)?.ownerUnitCode ??
            OUTPUTS.find((o) => o.code === r.nodeCode)?.ownerUnitCode ??
            "IDP"
        : "IDP",
      hashOf(r.code) % 7
    );
    await db.insert(schema.councilRisks).values({
      id: ulid(),
      strategyId,
      nodeId: r.nodeCode ? idOfCode.get(r.nodeCode) ?? null : null,
      code: r.code,
      titleEn: r.titleEn,
      titleAr: r.titleAr,
      descriptionEn: r.descriptionEn,
      descriptionAr: r.descriptionAr,
      likelihood: r.likelihood,
      impact: r.impact,
      ownerUserId: owner?.id ?? null,
      mitigationEn: r.mitigationEn,
      mitigationAr: r.mitigationAr,
      status: r.status,
      createdAt: now(),
      updatedAt: now(),
    });
  }

  /* 7. governance */
  let govSort = 0;
  for (const g of GOVERNANCE) {
    await db.insert(schema.councilGovernance).values({
      id: ulid(),
      strategyId,
      bodyNameEn: g.bodyNameEn,
      bodyNameAr: g.bodyNameAr,
      roleEn: g.roleEn,
      roleAr: g.roleAr,
      cadence: g.cadence,
      membersJson: JSON.stringify(g.members),
      sort: govSort++,
    });
  }

  console.log(
    `cr07 council: ${GOALS.length} goals, ${INTERMEDIATE_OUTCOMES.length} intermediate outcomes, ${OUTPUTS.length} outputs, ${PROJECTS.length} projects, ${PROJECTS.reduce((s, p) => s + p.activities.length, 0)} activities, ${INDICATORS.length} indicators (${targetRows} targets, ${valueRows} actuals), ${RISKS.length} risks, ${GOVERNANCE.length} governance bodies, ${alignments} alignment links, ${dependencies} dependencies`
  );

  await seedCouncilStakeholders(strategyId);
  await seedCouncilDeliverables(strategyId);
  await seedCouncilLessons(strategyId);
  await seedCouncilSignals(strategyId);
}

/* ------------------------------------------------------------------ */
/* 8. cross-module content (CR07 2.5 and 2.6)                           */
/* ------------------------------------------------------------------ */

/** Every council project gets the same six-role stakeholder section. */
async function seedCouncilStakeholders(strategyId: string): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const projects = await db
    .select()
    .from(schema.councilNodes)
    .where(eq(schema.councilNodes.strategyId, strategyId));
  const councilProjects = projects.filter((p) => p.level === "project");
  const users = await db.select().from(schema.users).where(isNull(schema.users.deletedAt));
  const experts = await db.select().from(schema.experts);
  const domains = await db.select().from(schema.expertDomains);
  const domainOf = new Map<string, string>();
  for (const d of domains) if (!domainOf.has(d.expertId)) domainOf.set(d.expertId, d.termId);
  const expertPool = experts.filter((e) => domainOf.has(e.id));
  const heads = users.filter((u) => u.email.startsWith("head.") || u.email === "admin@npc.qa");

  let rows = 0;
  for (const p of councilProjects) {
    const h = hashOf(p.id);
    const unitStaff = users.filter((u) => u.departmentId === p.ownerUnitId);
    const pool = unitStaff.length ? unitStaff : users;
    const pick = <T>(arr: T[], salt: number): T | null =>
      arr.length ? arr[(h + salt * 7919) % arr.length] : null;
    let sort = 0;
    const add = async (values: Record<string, unknown>) => {
      await db.insert(schema.nodeStakeholders).values({
        id: ulid(),
        nodeId: p.id,
        nodeKind: "council",
        sort: sort++,
        sinceDate: p.startDate ?? "2025-01-01",
        createdAt: now(),
        ...values,
      } as never);
      rows++;
    };
    const sponsor = pick(heads.length ? heads : users, 1);
    const owner = p.ownerUserId
      ? users.find((u) => u.id === p.ownerUserId) ?? pick(pool, 2)
      : pick(pool, 2);
    const manager = pick(
      pool.filter((u) => u.id !== owner?.id).length ? pool.filter((u) => u.id !== owner?.id) : pool,
      3
    );
    if (sponsor) await add({ personKind: "employee", userId: sponsor.id, role: "sponsor" });
    if (owner) await add({ personKind: "employee", userId: owner.id, role: "owner" });
    if (manager) await add({ personKind: "employee", userId: manager.id, role: "manager" });
    const teamCount = 2 + (h % 3);
    const seen = new Set([sponsor?.id, owner?.id, manager?.id].filter(Boolean) as string[]);
    for (let i = 0; i < teamCount; i++) {
      const member = pick(pool, 10 + i);
      if (!member || seen.has(member.id)) continue;
      seen.add(member.id);
      await add({ personKind: "employee", userId: member.id, role: "team" });
    }
    const expert = pick(expertPool, 20);
    if (expert) {
      await add({
        personKind: "expert",
        expertId: expert.id,
        role: "expert",
        roleNoteEn: "Methodology advisor",
        roleNoteAr: "مستشار منهجية",
        domainTermId: domainOf.get(expert.id) ?? null,
      });
    }
  }
  console.log(`cr07 council: ${rows} stakeholder rows across ${councilProjects.length} council projects`);
}

/** Three deliverables on fifteen projects, as Vault documents. */
async function seedCouncilDeliverables(strategyId: string): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const { putText } = await import("../src/server/storage");
  const projects = (
    await db.select().from(schema.councilNodes).where(eq(schema.councilNodes.strategyId, strategyId))
  )
    .filter((p) => p.level === "project")
    .sort((a, b) => a.sort - b.sort)
    .slice(0, 15);
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
  const deliverableTermId = terms.find((t) => t.code === "deliverable")?.id ?? null;
  const users = await db.select().from(schema.users).where(isNull(schema.users.deletedAt));

  const KINDS: { en: string; ar: string }[] = [
    { en: "Inception report", ar: "تقرير البدء" },
    { en: "Design document", ar: "وثيقة التصميم" },
    { en: "Progress report", ar: "تقرير التقدم" },
  ];
  let made = 0;
  for (const p of projects) {
    const owner = p.ownerUserId ? users.find((u) => u.id === p.ownerUserId) : null;
    for (let i = 0; i < KINDS.length; i++) {
      const kind = KINDS[i];
      const sourceRef = `cr07 council deliverable: ${p.code}/${i + 1}`;
      const [already] = await db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.sourceRef, sourceRef))
        .limit(1);
      if (already) continue;
      const documentId = ulid();
      const body = [
        `${kind.en}: ${p.titleEn}`,
        `${kind.ar}: ${p.titleAr}`,
        "",
        p.descriptionEn ?? "",
        p.descriptionAr ?? "",
        "",
        "This deliverable belongs to the Council Strategy and carries the Internal classification.",
        "هذا التسليم يخص الاستراتيجية المؤسسية للمجلس ويحمل تصنيف داخلي.",
      ].join("\n");
      const storagePath = await putText(documentId, `${p.code}-deliverable-${i + 1}.txt`, body);
      await db.insert(schema.documents).values({
        id: documentId,
        titleEn: `${kind.en}: ${p.titleEn}`,
        titleAr: `${kind.ar}: ${p.titleAr}`,
        titleArMachine: 0,
        summaryEn: `The ${kind.en.toLowerCase()} of the council project ${p.code}.`,
        summaryAr: `${kind.ar} لمشروع المجلس ${p.code}.`,
        summaryMachine: 0,
        knowledgeTypeTermId: deliverableTermId,
        // CR07 2.1: council content defaults to Internal
        classificationLevel: 2,
        departmentId: p.ownerUnitId,
        ownerUserId: owner?.id ?? null,
        languageOriginal: "mixed",
        status: "verified",
        sourceOrigin: "npc",
        publishYear: Number((p.startDate ?? "2025").slice(0, 4)),
        originalFilename: `${p.code}-deliverable-${i + 1}.txt`,
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
      await db.insert(schema.relations).values({
        id: ulid(),
        fromType: "document",
        fromId: documentId,
        toType: "council_node",
        toId: p.id,
        relation: "about_node",
        source: "seed",
        createdAt: now(),
      });
      await db.insert(schema.deliverableMeta).values({
        id: ulid(),
        documentId,
        nodeId: p.id,
        deliverableCode: `${p.code}-D${i + 1}`,
        milestone: kind.en,
        dueDate: p.endDate,
        deliveredDate: i < 2 ? p.startDate : null,
        acceptanceStatus: i < 2 ? "accepted" : "pending",
        createdAt: now(),
      });
      made++;
    }
  }
  console.log(`cr07 council: ${made} deliverables on ${projects.length} projects`);
}

/** Ten delivery lessons linked to council projects (CR07 1 plus 2.6). */
async function seedCouncilLessons(strategyId: string): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const projects = (
    await db.select().from(schema.councilNodes).where(eq(schema.councilNodes.strategyId, strategyId))
  )
    .filter((p) => p.level === "project")
    .sort((a, b) => a.sort - b.sort);
  const users = await db.select().from(schema.users).where(isNull(schema.users.deletedAt));

  const LESSONS: { titleEn: string; titleAr: string; contextEn: string; contextAr: string; learningEn: string; learningAr: string; recEn: string; recAr: string }[] = [
    {
      titleEn: "Agree the data definition before the dashboard is built",
      titleAr: "الاتفاق على تعريف البيانات قبل بناء لوحة المتابعة",
      contextEn: "Two units reported the same measure differently for a full quarter because the definition lived in a slide, not in a card.",
      contextAr: "أبلغت وحدتان عن المقياس نفسه بطريقتين مختلفتين لربع كامل لأن التعريف كان في عرض تقديمي لا في بطاقة مؤشر.",
      learningEn: "A dashboard hardens whatever definition it is given. Write the indicator card first, have the owning unit sign it, then build.",
      learningAr: "تثبت لوحة المتابعة أي تعريف يعطى لها. اكتب بطاقة المؤشر أولاً واعتمدها من الوحدة المالكة ثم ابنِ.",
      recEn: "No dashboard build starts without an approved indicator card for every figure on it.",
      recAr: "لا يبدأ بناء أي لوحة متابعة دون بطاقة مؤشر معتمدة لكل رقم عليها.",
    },
    {
      titleEn: "Entity planning teams need the template and a worked example",
      titleAr: "فرق التخطيط في الجهات تحتاج النموذج ومثالاً مطبقاً",
      contextEn: "The first round of submissions using the new template came back with the results chain filled in as a list of activities.",
      contextAr: "عادت الجولة الأولى من الطلبات بالنموذج الجديد وسلسلة النتائج مملوءة بقائمة أنشطة.",
      learningEn: "A template teaches format, not thinking. A completed example from a real sector teaches both.",
      learningAr: "يعلّم النموذج الشكل لا التفكير. المثال المكتمل من قطاع حقيقي يعلّم الاثنين.",
      recEn: "Ship every planning template with one fully worked example and a thirty minute clinic.",
      recAr: "أرفق مع كل نموذج تخطيط مثالاً مكتملاً وجلسة إرشادية مدتها ثلاثون دقيقة.",
    },
    {
      titleEn: "Publish the revision policy before the first revision",
      titleAr: "انشر سياسة المراجعة قبل أول مراجعة",
      contextEn: "A routine revision to a quarterly figure was read as an error because no published policy explained when revisions happen.",
      contextAr: "فُهمت مراجعة روتينية لرقم ربع سنوي على أنها خطأ لعدم وجود سياسة منشورة توضح متى تجري المراجعات.",
      learningEn: "Trust is lost at the first unexplained change, not at the tenth.",
      learningAr: "تُفقد الثقة عند أول تغيير غير مفسر لا عند العاشر.",
      recEn: "Publish the revisions policy alongside the release calendar, before any product goes live.",
      recAr: "انشر سياسة المراجعات مع تقويم الإصدار قبل إطلاق أي منتج.",
    },
    {
      titleEn: "A data sharing agreement moves faster with a named owner on both sides",
      titleAr: "تتحرك اتفاقية تبادل البيانات أسرع بوجود مالك محدد من الطرفين",
      contextEn: "Agreements with a named focal point on each side closed in weeks; those routed through general correspondence took months.",
      contextAr: "أُغلقت الاتفاقيات التي لها منسق محدد من كل طرف خلال أسابيع، بينما استغرقت المرسلة عبر المراسلات العامة شهوراً.",
      learningEn: "The bottleneck is rarely legal. It is the absence of a person whose job it is to close the file.",
      learningAr: "نادراً ما يكون العائق قانونياً، بل غياب شخص مهمته إغلاق الملف.",
      recEn: "Name a focal point on both sides in the first meeting and record it in the file.",
      recAr: "حدد منسقاً من الطرفين في الاجتماع الأول وسجله في الملف.",
    },
    {
      titleEn: "Scenario work lands when it is tied to a decision on the table",
      titleAr: "تؤتي السيناريوهات ثمارها حين ترتبط بقرار مطروح",
      contextEn: "A well made scenario set was read once and shelved; a smaller one prepared for a budget decision changed the decision.",
      contextAr: "قُرئت مجموعة سيناريوهات متقنة مرة واحدة ثم حُفظت، بينما غيّرت مجموعة أصغر أُعدت لقرار موازنة القرار نفسه.",
      learningEn: "Foresight products compete with the inbox. Anchoring them to a live decision is what gets them read.",
      learningAr: "تنافس منتجات الاستشراف صندوق الوارد. ربطها بقرار قائم هو ما يجعلها تُقرأ.",
      recEn: "Start every scenario commission by naming the decision it must inform and its date.",
      recAr: "ابدأ تكليف أي سيناريو بتحديد القرار الذي يجب أن يخدمه وتاريخه.",
    },
    {
      titleEn: "Automation saves nothing until the paper step is removed",
      titleAr: "لا توفر الأتمتة شيئاً حتى تُلغى الخطوة الورقية",
      contextEn: "A workflow was automated while the signed paper copy stayed mandatory, so the cycle time did not move.",
      contextAr: "أُتمتت دورة عمل مع بقاء النسخة الورقية الموقعة إلزامية فلم يتغير زمن الدورة.",
      learningEn: "Digitising a process next to the old one adds work. The old step has to be retired in the same release.",
      learningAr: "رقمنة إجراء بجانب الإجراء القديم تضيف عملاً. يجب إلغاء الخطوة القديمة في الإصدار نفسه.",
      recEn: "Every automation change request must name the manual step it removes.",
      recAr: "يجب أن يحدد كل طلب أتمتة الخطوة اليدوية التي يلغيها.",
    },
    {
      titleEn: "Quality assurance findings need an owner and a date, not a report",
      titleAr: "تحتاج نتائج ضمان الجودة مالكاً وتاريخاً لا تقريراً",
      contextEn: "The first quality review produced 34 findings; six months later 29 were still open because none carried a name.",
      contextAr: "أنتجت أول مراجعة جودة 34 ملاحظة، وبعد ستة أشهر بقيت 29 مفتوحة لأن أياً منها لم يحمل اسماً.",
      learningEn: "A finding without an owner is an observation. With an owner and a date it becomes work.",
      learningAr: "الملاحظة بلا مالك مجرد رصد. وبمالك وتاريخ تصبح عملاً.",
      recEn: "Close every quality review by assigning each finding to a person with a due date.",
      recAr: "اختم كل مراجعة جودة بإسناد كل ملاحظة إلى شخص مع تاريخ استحقاق.",
    },
    {
      titleEn: "Training uptake follows the manager, not the invitation",
      titleAr: "يتبع الإقبال على التدريب المدير لا الدعوة",
      contextEn: "Units whose head attended the first session reached 80 percent completion; units where the invitation went straight to staff reached 30.",
      contextAr: "بلغت الوحدات التي حضر رئيسها الجلسة الأولى 80 في المئة إتماماً، بينما بلغت الوحدات التي أُرسلت فيها الدعوة للموظفين مباشرة 30 في المئة.",
      learningEn: "Attendance is a signal about priority, and staff read it from their manager.",
      learningAr: "الحضور إشارة عن الأولوية، ويقرأها الموظفون من مديرهم.",
      recEn: "Book the unit head into the first session of every capability programme.",
      recAr: "احجز مقعد رئيس الوحدة في الجلسة الأولى من كل برنامج بناء قدرات.",
    },
    {
      titleEn: "One catalogue entry is worth ten shared folders",
      titleAr: "مدخل واحد في الفهرس يعادل عشرة مجلدات مشتركة",
      contextEn: "The same dataset existed in four places with three different vintages before the catalogue entry was created.",
      contextAr: "وُجدت مجموعة البيانات نفسها في أربعة أماكن بثلاث نسخ زمنية مختلفة قبل إنشاء مدخل الفهرس.",
      learningEn: "Duplication is a symptom of an absent authoritative record, not of careless staff.",
      learningAr: "التكرار عرض لغياب سجل مرجعي لا لإهمال الموظفين.",
      recEn: "Create the catalogue entry when the dataset is first produced, not when it is first requested.",
      recAr: "أنشئ مدخل الفهرس عند إنتاج البيانات أول مرة لا عند طلبها أول مرة.",
    },
    {
      titleEn: "A monthly indicator needs a monthly owner",
      titleAr: "المؤشر الشهري يحتاج مالكاً شهرياً",
      contextEn: "Monthly indicators assigned to a committee were reported late three months in a row; the same indicators assigned to a person were on time.",
      contextAr: "تأخر الإبلاغ عن المؤشرات الشهرية المسندة إلى لجنة ثلاثة أشهر متتالية، بينما التزمت المؤشرات نفسها بالمواعيد حين أُسندت إلى شخص.",
      learningEn: "Reporting cadence has to match the accountability unit. A committee cannot meet monthly about one number.",
      learningAr: "يجب أن تتوافق دورية الإبلاغ مع وحدة المساءلة. لا يمكن للجنة أن تجتمع شهرياً حول رقم واحد.",
      recEn: "Every monthly indicator card names one responsible person, never a body.",
      recAr: "تحدد بطاقة كل مؤشر شهري شخصاً مسؤولاً واحداً لا جهة.",
    },
  ];

  let made = 0;
  for (let i = 0; i < LESSONS.length && i < projects.length; i++) {
    const l = LESSONS[i];
    const project = projects[i * 4 < projects.length ? i * 4 : i];
    const author =
      users.find((u) => u.id === project.ownerUserId) ??
      users[hashOf(project.code ?? String(i)) % users.length];
    const lessonId = ulid();
    await db.insert(schema.lessons).values({
      id: lessonId,
      authorId: author.id,
      category: "delivery",
      titleEn: l.titleEn,
      titleAr: l.titleAr,
      contextEn: l.contextEn,
      contextAr: l.contextAr,
      learningEn: l.learningEn,
      learningAr: l.learningAr,
      recommendationEn: l.recEn,
      recommendationAr: l.recAr,
      // council nodes live in their own store, so the legacy column stays null
      nodeId: null,
      documentIdsJson: null,
      classificationLevel: 2,
      status: i % 3 === 0 ? "verified" : "published",
      reuseCount: hashOf(lessonId) % 5,
      createdAt: new Date(Date.UTC(2026, (i % 9), 5 + (i % 20))).toISOString(),
      updatedAt: now(),
    });
    await db.insert(schema.lessonNodeLinks).values({
      id: ulid(),
      lessonId,
      nodeId: project.id,
      nodeKind: "council",
      isPrimary: 1,
      linkedBy: author.id,
      linkedAt: now(),
    });
    made++;
  }
  console.log(`cr07 council: ${made} delivery lessons linked to council projects`);
}

/** Eight accepted signals linked to council goals (CR07 2.5). */
async function seedCouncilSignals(strategyId: string): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const goals = (
    await db.select().from(schema.councilNodes).where(eq(schema.councilNodes.strategyId, strategyId))
  )
    .filter((n) => n.level === "goal")
    .sort((a, b) => a.sort - b.sort);
  if (!goals.length) return;
  const signals = await db
    .select()
    .from(schema.signals)
    .where(inArray(schema.signals.triageStatus, ["accepted", "converted"]))
    .limit(40);
  if (!signals.length) {
    console.log("cr07 council: no accepted signals to link");
    return;
  }
  let made = 0;
  for (let i = 0; i < 8 && i < signals.length; i++) {
    const signal = signals[i];
    const goal = goals[i % goals.length];
    const [already] = await db
      .select()
      .from(schema.signalLinks)
      .where(eq(schema.signalLinks.signalId, signal.id))
      .limit(1);
    if (already && already.resourceId === goal.id) continue;
    await db.insert(schema.signalLinks).values({
      id: ulid(),
      signalId: signal.id,
      resourceType: "node",
      resourceId: goal.id,
      relation: "about",
      source: "seed",
      nodeKind: "council",
      createdAt: now(),
    });
    made++;
  }
  console.log(`cr07 council: ${made} signals linked to council goals`);
}

const isMain = process.argv[1] && /cr07-council-seed\.ts$/.test(process.argv[1]);
if (isMain) {
  seedCr07Council()
    .then(() => {
      console.log("cr07 council seed complete");
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
