/* eslint-disable no-console */
// CR08 5: the twelve report types (plus the Super Admin's custom type) and
// one generated example per type for the cover gallery. Owned by the Reports
// builder agent. Idempotent: types are upserted by code; an example is
// skipped when one already exists for the type, period and scope; an
// example left as draft because the docx template was not ready is
// rendered, approved and published on the next run.
//
//   npx tsx scripts/cr08-reports-seed.ts
//   REPORTS_SEED_AI=1 npx tsx scripts/cr08-reports-seed.ts   (live writer)
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import type { CreateReportInputType } from "../src/server/services/reports";

type ScopeInput = CreateReportInputType["scope"];
type PeriodInput = CreateReportInputType["period"];

/** Upserts the catalogue rows by code. Exported for the probe. */
export async function upsertReportTypes(): Promise<number> {
  const { db, schema } = await import("../src/server/db/client");
  const { eq } = await import("drizzle-orm");
  const { newId } = await import("../src/lib/ids");
  const { REPORT_TYPES } = await import("../src/server/reports/types");
  let touched = 0;
  for (const t of REPORT_TYPES) {
    const values = {
      code: t.code,
      family: t.family,
      nameEn: t.nameEn,
      nameAr: t.nameAr,
      descriptionEn: t.descriptionEn,
      descriptionAr: t.descriptionAr,
      defaultSectionsJson: JSON.stringify(t.defaultSections),
      optionalSectionsJson: JSON.stringify(t.optionalSections),
      scopeKind: t.scopeKind,
      classificationDefault: t.classificationDefault,
      audienceDefault: t.audienceDefault,
      cadence: t.cadence,
      sort: t.sort,
      isActive: 1,
    };
    const [existing] = await db.select({ id: schema.reportTypes.id }).from(schema.reportTypes).where(eq(schema.reportTypes.code, t.code)).limit(1);
    if (existing) await db.update(schema.reportTypes).set(values).where(eq(schema.reportTypes.id, existing.id));
    else await db.insert(schema.reportTypes).values({ id: newId(), ...values });
    touched += 1;
  }
  return touched;
}

/** The scope the example of a type uses: the first outcome of the default
    edition, the department of the seeded Department Head, the project with
    the most deliverables, or the Office. Exported for the probe. */
export async function exampleScopeFor(scopeKind: string): Promise<ScopeInput> {
  const { db, schema } = await import("../src/server/db/client");
  const { and, asc, eq, sql } = await import("drizzle-orm");
  if (scopeKind === "outcome") {
    const [edition] = await db.select().from(schema.strategyEditions).where(eq(schema.strategyEditions.isDefault, 1)).limit(1);
    const [outcome] = edition
      ? await db.select().from(schema.strategyNodes).where(and(eq(schema.strategyNodes.editionId, edition.id), eq(schema.strategyNodes.nodeType, "outcome"))).orderBy(asc(schema.strategyNodes.sort)).limit(1)
      : [];
    if (!outcome) throw new Error("no outcome to scope the example on");
    return { kind: "outcome", id: outcome.id };
  }
  if (scopeKind === "department") {
    const [head] = await db.select({ departmentId: schema.users.departmentId }).from(schema.users).where(eq(schema.users.email, "head.stats@enviroai.demo")).limit(1);
    if (head?.departmentId) return { kind: "department", id: head.departmentId };
    const [unit] = await db.select().from(schema.orgUnits).where(eq(schema.orgUnits.level, "department")).orderBy(asc(schema.orgUnits.sort)).limit(1);
    if (!unit) throw new Error("no department to scope the example on");
    return { kind: "department", id: unit.id };
  }
  if (scopeKind === "project") {
    const rows = await db
      .select({ id: schema.strategyNodes.id, n: sql<number>`(select count(*) from deliverable_meta m where m.node_id = ${schema.strategyNodes.id})` })
      .from(schema.strategyNodes)
      .where(eq(schema.strategyNodes.nodeType, "project"))
      .orderBy(sql`2 desc`, asc(schema.strategyNodes.sort))
      .limit(1);
    if (!rows[0]) throw new Error("no project to scope the example on");
    return { kind: "project", id: rows[0].id };
  }
  return { kind: scopeKind === "period" ? "period" : "org" };
}

/** 2026 for annual and on-demand types, Q3 2026 for quarterly, September 2026 for monthly. */
export function examplePeriodFor(cadence: string | null): PeriodInput {
  if (cadence === "quarterly") return { kind: "quarter", year: 2026, quarter: 3 };
  if (cadence === "monthly") return { kind: "month", year: 2026, month: 9 };
  return { kind: "year", year: 2026 };
}

async function ensureGameRule(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const { eq } = await import("drizzle-orm");
  const { newId } = await import("../src/lib/ids");
  const [rule] = await db.select().from(schema.gameRules).where(eq(schema.gameRules.eventType, "report_published")).limit(1);
  if (!rule) {
    await db.insert(schema.gameRules).values({ id: newId(), eventType: "report_published", points: 20, isActive: 1, excludedFromBoards: 0 });
    console.log("cr08 reports: game rule report_published (20 points) added");
  }
}

export default async function seedCr08Reports(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const { and, eq } = await import("drizzle-orm");
  const { getUserById } = await import("../src/server/auth/session");
  const { REPORT_TYPES } = await import("../src/server/reports/types");
  const { createReportRequest, submitForReview, approveReport, publishReport } = await import("../src/server/services/reports");
  const { runReportBuild, runSectionRebuild, RENDER_ONLY } = await import("../src/server/reports/build");

  const n = await upsertReportTypes();
  console.log(`cr08 reports: ${n} report types upserted`);
  await ensureGameRule();

  const [adminRow] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, "admin@enviroai.demo")).limit(1);
  const admin = adminRow ? await getUserById(adminRow.id) : null;
  if (!admin) {
    console.log("cr08 reports: admin@enviroai.demo is missing; no examples generated");
    return;
  }
  const forceMock = !process.env.REPORTS_SEED_AI;
  console.log(`cr08 reports: examples written by the ${forceMock ? "mock writer" : "live model"}`);

  const types = await db.select().from(schema.reportTypes);
  let built = 0;
  let published = 0;
  let pending = 0;
  for (const spec of REPORT_TYPES.filter((t) => t.family !== "custom")) {
    const type = types.find((t) => t.code === spec.code);
    if (!type) continue;
    const period = examplePeriodFor(spec.cadence);
    const scope = await exampleScopeFor(spec.scopeKind);
    const periodKey = JSON.stringify({ kind: period.kind, year: period.year, quarter: period.quarter ?? null, month: period.month ?? null });
    const existingRows = await db.select().from(schema.reports).where(and(eq(schema.reports.typeId, type.id), eq(schema.reports.requestedBy, admin.id)));
    const existing = existingRows.find((r) => {
      try {
        const p = JSON.parse(r.periodJson ?? "{}");
        const s = JSON.parse(r.scopeJson ?? "{}");
        return JSON.stringify({ kind: p.kind, year: p.year, quarter: p.quarter ?? null, month: p.month ?? null }) === periodKey && (s.id ?? null) === (scope.id ?? null) && s.kind === scope.kind;
      } catch {
        return false;
      }
    });

    let reportId = existing?.id ?? null;
    if (existing) {
      if (existing.status === "published") {
        console.log(`cr08 reports: ${spec.code} example already published`);
        continue;
      }
      if (existing.status === "failed") {
        console.log(`cr08 reports: ${spec.code} example failed earlier, rebuilding`);
        await runReportBuild(existing.id, { forceMock });
        built += 1;
      } else if (existing.status === "draft" && !existing.docxPath) {
        console.log(`cr08 reports: ${spec.code} example is a draft without a document, rendering`);
        await runSectionRebuild(existing.id, RENDER_ONLY, { forceMock });
      } else if (existing.status === "generating") {
        console.log(`cr08 reports: ${spec.code} example is mid-build (status generating), rebuilding`);
        await runReportBuild(existing.id, { forceMock });
        built += 1;
      }
    } else {
      const res = await createReportRequest(admin, { typeCode: spec.code, period, scope, languageMode: "both" });
      if (!res.ok) {
        console.log(`cr08 reports: ${spec.code} request refused: ${res.error} ${res.detail ?? ""}`);
        continue;
      }
      reportId = res.id;
      const t0 = Date.now();
      await runReportBuild(res.id, { forceMock });
      built += 1;
      console.log(`cr08 reports: built ${spec.code} "${res.titleEn}" in ${Math.round((Date.now() - t0) / 1000)}s`);
    }
    if (!reportId) continue;
    const [row] = await db.select().from(schema.reports).where(eq(schema.reports.id, reportId)).limit(1);
    if (!row) continue;
    if (row.status === "draft" && row.docxPath) {
      const s = await submitForReview(admin, reportId);
      const a = s.ok ? await approveReport(admin, reportId) : s;
      const p = a.ok ? await publishReport(admin, reportId) : a;
      if (p.ok) {
        published += 1;
        console.log(`cr08 reports: ${spec.code} example published`);
      } else {
        console.log(`cr08 reports: ${spec.code} could not be published: ${p.error} ${p.detail ?? ""}`);
      }
    } else if (row.status === "draft") {
      pending += 1;
      console.log(`cr08 reports: ${spec.code} left as draft, the docx template is not ready (rerun the seed once it lands)`);
    } else {
      console.log(`cr08 reports: ${spec.code} example is ${row.status}${row.error ? `: ${row.error}` : ""}`);
    }
  }
  console.log(`cr08 reports: done. built ${built}, published ${published}, awaiting template ${pending}`);
}

const isMain = process.argv[1] && /cr08-reports-seed\.ts$/.test(process.argv[1]);
if (isMain) {
  seedCr08Reports()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
