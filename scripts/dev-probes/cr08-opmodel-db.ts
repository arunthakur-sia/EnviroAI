/* eslint-disable no-console */
// CR08 10 dev probe: dumps the reference data the operating model seed and the
// read models rely on (units, users per unit, entities, report types,
// indicators with publish calendars, releases, knowledge-type terms, the CR07
// policy documents, handovers, council governance bodies, game rules).
// Run: npx tsx scripts/dev-probes/cr08-opmodel-db.ts [outfile.json]
import { loadEnv } from "../../src/lib/load-env";
loadEnv();
import fs from "node:fs";
import { asc, isNull, like } from "drizzle-orm";

async function main() {
  const { db, schema } = await import("../../src/server/db/client");
  const units = await db
    .select({
      id: schema.orgUnits.id,
      code: schema.orgUnits.code,
      nameEn: schema.orgUnits.nameEn,
      nameAr: schema.orgUnits.nameAr,
      level: schema.orgUnits.level,
      parentId: schema.orgUnits.parentId,
      headUserId: schema.orgUnits.headUserId,
      headNameEn: schema.orgUnits.headNameEn,
      isActive: schema.orgUnits.isActive,
      sort: schema.orgUnits.sort,
    })
    .from(schema.orgUnits)
    .orderBy(asc(schema.orgUnits.sort));
  const users = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      nameEn: schema.users.nameEn,
      departmentId: schema.users.departmentId,
      roleId: schema.users.roleId,
      positionEn: schema.users.positionEn,
    })
    .from(schema.users)
    .where(isNull(schema.users.deletedAt));
  const roles = await db.select({ id: schema.roles.id, nameEn: schema.roles.nameEn }).from(schema.roles);
  const entities = await db
    .select({
      id: schema.entities.id,
      nameEn: schema.entities.nameEn,
      nameAr: schema.entities.nameAr,
      shortNameEn: schema.entities.shortNameEn,
      kind: schema.entities.kind,
      isActive: schema.entities.isActive,
      mergedIntoId: schema.entities.mergedIntoId,
    })
    .from(schema.entities)
    .orderBy(asc(schema.entities.nameEn));
  const reportTypes = await db
    .select({
      id: schema.reportTypes.id,
      code: schema.reportTypes.code,
      nameEn: schema.reportTypes.nameEn,
      nameAr: schema.reportTypes.nameAr,
      cadence: schema.reportTypes.cadence,
      family: schema.reportTypes.family,
      isActive: schema.reportTypes.isActive,
    })
    .from(schema.reportTypes);
  const indicators = await db
    .select({
      id: schema.indicators.id,
      code: schema.indicators.code,
      nameEn: schema.indicators.nameEn,
      frequency: schema.indicators.frequency,
      departmentId: schema.indicators.departmentId,
      publishCalendarJson: schema.indicators.publishCalendarJson,
      isHeadline: schema.indicators.isHeadline,
    })
    .from(schema.indicators);
  const releases = await db.select().from(schema.releases);
  const dims = await db.select().from(schema.taxonomyDimensions);
  const ktDim = dims.find((d) => d.code === "knowledge_type");
  const terms = ktDim
    ? await db.select().from(schema.taxonomyTerms).where(like(schema.taxonomyTerms.dimensionId, ktDim.id))
    : [];
  const policyDocs = (
    await db
      .select({
        id: schema.documents.id,
        titleEn: schema.documents.titleEn,
        sourceRef: schema.documents.sourceRef,
        knowledgeTypeTermId: schema.documents.knowledgeTypeTermId,
        departmentId: schema.documents.departmentId,
        effectiveFrom: schema.documents.effectiveFrom,
        reviewCycleMonths: schema.documents.reviewCycleMonths,
        status: schema.documents.status,
      })
      .from(schema.documents)
  ).filter((d) => (d.sourceRef ?? "").startsWith("cr07 policy:"));
  const handovers = await db
    .select({ id: schema.handovers.id, status: schema.handovers.status, completionPct: schema.handovers.completionPct, createdAt: schema.handovers.createdAt, completedAt: schema.handovers.completedAt, dueDate: schema.handovers.dueDate })
    .from(schema.handovers);
  const governance = await db.select().from(schema.councilGovernance).orderBy(asc(schema.councilGovernance.sort));
  const gameRules = await db.select({ type: schema.gameRules.eventType }).from(schema.gameRules);
  const settings = await db.select().from(schema.settings);
  const counts = {
    processes: (await db.select().from(schema.processes)).length,
    raci: (await db.select().from(schema.processRaci)).length,
    principles: (await db.select().from(schema.operatingPrinciples)).length,
    calendar: (await db.select().from(schema.calendarEvents)).length,
    unitInterfaces: (await db.select().from(schema.unitInterfaces)).length,
    entityInterfaces: (await db.select().from(schema.entityInterfaces)).length,
    icr: (await db.select().from(schema.interfaceChangeRequests)).length,
    opsKpis: (await db.select().from(schema.opsKpis)).length,
    opsKpiValues: (await db.select().from(schema.opsKpiValues)).length,
  };
  const out = {
    units,
    users: users.map((u) => ({ ...u, role: roles.find((r) => r.id === u.roleId)?.nameEn ?? null })),
    entities,
    reportTypes,
    indicators,
    releases,
    knowledgeTypeTerms: terms.map((t) => ({ id: t.id, code: t.code, nameEn: t.nameEn })),
    policyDocs,
    handovers,
    governance,
    gameRules: gameRules.map((g) => g.type),
    settings: settings.map((s) => ({ key: s.key, value: s.valueJson.slice(0, 200) })),
    counts,
  };
  const file = process.argv[2];
  if (file) {
    fs.writeFileSync(file, JSON.stringify(out, null, 2));
    console.log(`wrote ${file}`);
  } else {
    console.log(JSON.stringify(out, null, 2));
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
