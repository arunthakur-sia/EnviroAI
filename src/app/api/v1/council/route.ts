// CR07 2.4.8: editing the Programme Strategy. Every level, the indicator cards,
// target and actual entry per period, the prioritisation matrix, and the
// change log behind them. The Strategy Office, Knowledge Admins and Super
// Admins may write; everyone else reads.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { audit } from "@/server/auth/audit";
import { newId, nowIso } from "@/lib/ids";
import {
  canEditCouncil,
  getCouncilPageData,
  getCouncilProject,
  getScorecard,
  getCouncilChangeLog,
  logCouncilChange,
  periodCadence,
  syncLinkedIndicator,
} from "@/server/services/council";

/** GET ?view=page|project|scorecard|changelog */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const view = sp.get("view") ?? "page";

  if (view === "project") {
    const id = sp.get("id") ?? "";
    const data = await getCouncilProject(user, id);
    if (!data) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
    return NextResponse.json({ data, error: null });
  }
  if (view === "scorecard") {
    const data = await getScorecard(user, {
      strategyId: sp.get("strategyId") ?? undefined,
      period: sp.get("period") ?? undefined,
    });
    return NextResponse.json({ data, error: null });
  }
  if (view === "changelog") {
    const strategyId = sp.get("strategyId") ?? "";
    if (!strategyId) return NextResponse.json({ data: [], error: null });
    return NextResponse.json({ data: await getCouncilChangeLog(strategyId), error: null });
  }
  const data = await getCouncilPageData(user, sp.get("strategyId") ?? undefined);
  return NextResponse.json({ data, error: null });
}

const NodePatch = z.object({
  kind: z.literal("node"),
  id: z.string().min(1),
  titleEn: z.string().max(400).optional(),
  titleAr: z.string().max(400).optional(),
  descriptionEn: z.string().max(4000).optional(),
  descriptionAr: z.string().max(4000).optional(),
  status: z.enum(["not_started", "on_track", "at_risk", "delayed", "completed"]).optional(),
  startDate: z.string().max(10).optional(),
  endDate: z.string().max(10).optional(),
  budgetQar: z.number().nonnegative().optional(),
  ownerUnitId: z.string().optional(),
  ownerUserId: z.string().optional(),
  priorityImpact: z.number().int().min(1).max(5).optional(),
  priorityFeasibility: z.number().int().min(1).max(5).optional(),
});

const IndicatorPatch = z.object({
  kind: z.literal("indicator"),
  id: z.string().min(1),
  nameEn: z.string().max(300).optional(),
  nameAr: z.string().max(300).optional(),
  definitionEn: z.string().max(2000).optional(),
  definitionAr: z.string().max(2000).optional(),
  formulaEn: z.string().max(1000).optional(),
  formulaAr: z.string().max(1000).optional(),
  unit: z.string().max(40).optional(),
  direction: z.enum(["up_good", "down_good"]).optional(),
  baselineYear: z.string().max(10).optional(),
  baselineValue: z.number().optional(),
  frequency: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  dataSourceEn: z.string().max(500).optional(),
  dataSourceAr: z.string().max(500).optional(),
  meansOfVerificationEn: z.string().max(500).optional(),
  meansOfVerificationAr: z.string().max(500).optional(),
  responsibleUserId: z.string().optional(),
  linkedStatisticsIndicatorId: z.string().nullable().optional(),
  notesEn: z.string().max(1000).optional(),
  notesAr: z.string().max(1000).optional(),
});

const ValuePatch = z.object({
  kind: z.literal("value"),
  indicatorId: z.string().min(1),
  /** 2026 | 2026-Q3 | 2026-07, matching the indicator's cadence */
  period: z.string().min(4).max(7),
  targetValue: z.number().nullable().optional(),
  actualValue: z.number().nullable().optional(),
  status: z.enum(["provisional", "final"]).optional(),
});

const RiskPatch = z.object({
  kind: z.literal("risk"),
  id: z.string().min(1),
  likelihood: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  status: z.enum(["open", "mitigating", "closed"]).optional(),
  mitigationEn: z.string().max(2000).optional(),
  mitigationAr: z.string().max(2000).optional(),
});

const Body = z.discriminatedUnion("kind", [NodePatch, IndicatorPatch, ValuePatch, RiskPatch]);

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!(await canEditCouncil(user))) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  const body = parsed.data;

  if (body.kind === "node") {
    const { kind, id, ...patch } = body;
    void kind;
    const [node] = await db
      .select()
      .from(schema.councilNodes)
      .where(eq(schema.councilNodes.id, id))
      .limit(1);
    if (!node) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
    await db
      .update(schema.councilNodes)
      .set({ ...patch, updatedAt: nowIso() })
      .where(eq(schema.councilNodes.id, id));
    await logCouncilChange(node.strategyId, "node", id, "edit", patch, user.id);
    await audit(user.id, "council_node_edit", "council_node", id, patch);
    return NextResponse.json({ data: { ok: true }, error: null });
  }

  if (body.kind === "indicator") {
    const { kind, id, ...patch } = body;
    void kind;
    const [indicator] = await db
      .select()
      .from(schema.councilIndicators)
      .where(eq(schema.councilIndicators.id, id))
      .limit(1);
    if (!indicator) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
    await db
      .update(schema.councilIndicators)
      .set({ ...patch, updatedAt: nowIso() })
      .where(eq(schema.councilIndicators.id, id));
    const [node] = await db
      .select({ strategyId: schema.councilNodes.strategyId })
      .from(schema.councilNodes)
      .where(eq(schema.councilNodes.id, indicator.nodeId))
      .limit(1);
    if (node) await logCouncilChange(node.strategyId, "indicator", id, "edit", patch, user.id);
    // CR07 2.5: a newly linked statistics indicator pulls its actuals in
    if (patch.linkedStatisticsIndicatorId) await syncLinkedIndicator(id);
    await audit(user.id, "council_indicator_edit", "council_indicator", id, patch);
    return NextResponse.json({ data: { ok: true }, error: null });
  }

  if (body.kind === "value") {
    const [indicator] = await db
      .select()
      .from(schema.councilIndicators)
      .where(eq(schema.councilIndicators.id, body.indicatorId))
      .limit(1);
    if (!indicator) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
    // the period picker must match the indicator's own cadence
    if (periodCadence(body.period) !== indicator.frequency) {
      return NextResponse.json(
        { data: null, error: "period_cadence_mismatch" },
        { status: 400 }
      );
    }
    if (body.targetValue !== undefined) {
      const [existing] = await db
        .select()
        .from(schema.councilIndicatorTargets)
        .where(
          and(
            eq(schema.councilIndicatorTargets.indicatorId, body.indicatorId),
            eq(schema.councilIndicatorTargets.period, body.period)
          )
        )
        .limit(1);
      if (existing) {
        await db
          .update(schema.councilIndicatorTargets)
          .set({ targetValue: body.targetValue })
          .where(eq(schema.councilIndicatorTargets.id, existing.id));
      } else {
        await db.insert(schema.councilIndicatorTargets).values({
          id: newId(),
          indicatorId: body.indicatorId,
          period: body.period,
          targetValue: body.targetValue,
        });
      }
    }
    if (body.actualValue !== undefined) {
      const [existing] = await db
        .select()
        .from(schema.councilIndicatorValues)
        .where(
          and(
            eq(schema.councilIndicatorValues.indicatorId, body.indicatorId),
            eq(schema.councilIndicatorValues.period, body.period)
          )
        )
        .limit(1);
      if (existing) {
        await db
          .update(schema.councilIndicatorValues)
          .set({ actualValue: body.actualValue, status: body.status ?? existing.status })
          .where(eq(schema.councilIndicatorValues.id, existing.id));
      } else {
        await db.insert(schema.councilIndicatorValues).values({
          id: newId(),
          indicatorId: body.indicatorId,
          period: body.period,
          actualValue: body.actualValue,
          status: body.status ?? "provisional",
          sourceDocumentId: null,
          enteredBy: user.id,
          createdAt: nowIso(),
        });
      }
    }
    const [node] = await db
      .select({ strategyId: schema.councilNodes.strategyId })
      .from(schema.councilNodes)
      .where(eq(schema.councilNodes.id, indicator.nodeId))
      .limit(1);
    if (node) {
      await logCouncilChange(
        node.strategyId,
        "indicator_value",
        body.indicatorId,
        "enter",
        { period: body.period, target: body.targetValue, actual: body.actualValue },
        user.id
      );
    }
    return NextResponse.json({ data: { ok: true }, error: null });
  }

  // risk
  const { kind, id, ...patch } = body;
  void kind;
  const [risk] = await db
    .select()
    .from(schema.councilRisks)
    .where(eq(schema.councilRisks.id, id))
    .limit(1);
  if (!risk) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  await db
    .update(schema.councilRisks)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(schema.councilRisks.id, id));
  await logCouncilChange(risk.strategyId, "risk", id, "edit", patch, user.id);
  return NextResponse.json({ data: { ok: true }, error: null });
}

/** Bulk actuals, the shape the xlsx import flow produces. */
const ImportBody = z.object({
  rows: z
    .array(
      z.object({
        indicatorCode: z.string().min(1),
        period: z.string().min(4).max(7),
        actualValue: z.number(),
        status: z.enum(["provisional", "final"]).optional(),
      })
    )
    .max(2000),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!(await canEditCouncil(user))) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = ImportBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });

  const indicators = await db.select().from(schema.councilIndicators);
  const byCode = new Map(indicators.map((i) => [i.code ?? "", i]));
  let written = 0;
  const rejected: { indicatorCode: string; period: string; reason: string }[] = [];
  for (const row of parsed.data.rows) {
    const indicator = byCode.get(row.indicatorCode);
    if (!indicator) {
      rejected.push({ ...row, reason: "unknown_indicator" });
      continue;
    }
    if (periodCadence(row.period) !== indicator.frequency) {
      rejected.push({ ...row, reason: "period_cadence_mismatch" });
      continue;
    }
    const [existing] = await db
      .select()
      .from(schema.councilIndicatorValues)
      .where(
        and(
          eq(schema.councilIndicatorValues.indicatorId, indicator.id),
          eq(schema.councilIndicatorValues.period, row.period)
        )
      )
      .limit(1);
    if (existing) {
      await db
        .update(schema.councilIndicatorValues)
        .set({ actualValue: row.actualValue, status: row.status ?? "provisional" })
        .where(eq(schema.councilIndicatorValues.id, existing.id));
    } else {
      await db.insert(schema.councilIndicatorValues).values({
        id: newId(),
        indicatorId: indicator.id,
        period: row.period,
        actualValue: row.actualValue,
        status: row.status ?? "provisional",
        sourceDocumentId: null,
        enteredBy: user.id,
        createdAt: nowIso(),
      });
    }
    written++;
  }
  await audit(user.id, "council_actuals_import", "council_strategy", "bulk", {
    written,
    rejected: rejected.length,
  });
  return NextResponse.json({ data: { written, rejected }, error: null });
}
