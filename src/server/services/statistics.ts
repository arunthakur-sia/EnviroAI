import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { newId, nowIso, todayIso } from "@/lib/ids";
import { record } from "@/server/gamification/engine";
import { audit } from "@/server/auth/audit";
import { enqueue } from "@/server/jobs/queue";
import type { TileData } from "@/components/nexus/IndicatorTile";

export async function tileFor(indicatorId: string): Promise<TileData | null> {
  const [ind] = await db
    .select()
    .from(schema.indicators)
    .where(eq(schema.indicators.id, indicatorId))
    .limit(1);
  if (!ind) return null;
  const values = await db
    .select()
    .from(schema.indicatorValues)
    .where(
      and(
        eq(schema.indicatorValues.indicatorId, indicatorId),
        eq(schema.indicatorValues.dimensionKey, "total")
      )
    )
    .orderBy(desc(schema.indicatorValues.period))
    .limit(24);
  const chron = [...values].reverse();
  return {
    id: ind.id,
    nameEn: ind.nameEn,
    nameAr: ind.nameAr,
    unit: ind.unit,
    decimals: ind.decimals,
    direction: ind.direction,
    latestValue: values[0]?.value ?? null,
    latestPeriod: values[0]?.period ?? null,
    previousValue: values[1]?.value ?? null,
    spark: chron.map((v) => v.value),
    illustrative: Boolean(values[0]?.note?.includes("illustrative")),
  };
}

export async function headlineTiles(user: CurrentUser): Promise<TileData[]> {
  const headliners = await db
    .select({ id: schema.indicators.id })
    .from(schema.indicators)
    .where(
      and(eq(schema.indicators.isHeadline, 1), lte(schema.indicators.classificationLevel, user.clearanceLevel))
    )
    .limit(8);
  const tiles = await Promise.all(headliners.map((h) => tileFor(h.id)));
  return tiles.filter(Boolean) as TileData[];
}

export async function catalog(user: CurrentUser) {
  const inds = await db
    .select({
      id: schema.indicators.id,
      code: schema.indicators.code,
      nameEn: schema.indicators.nameEn,
      nameAr: schema.indicators.nameAr,
      unit: schema.indicators.unit,
      frequency: schema.indicators.frequency,
      categoryTermId: schema.indicators.categoryTermId,
      lastPeriod: schema.indicators.lastPeriod,
      isHeadline: schema.indicators.isHeadline,
    })
    .from(schema.indicators)
    .where(lte(schema.indicators.classificationLevel, user.clearanceLevel))
    .orderBy(asc(schema.indicators.nameEn));
  const termIds = [...new Set(inds.map((i) => i.categoryTermId).filter(Boolean))] as string[];
  const terms = termIds.length
    ? await db
        .select()
        .from(schema.taxonomyTerms)
        .where(inArray(schema.taxonomyTerms.id, termIds))
    : [];
  const termMap = new Map(terms.map((t) => [t.id, t]));
  const groups = new Map<
    string,
    { code: string; nameEn: string; nameAr: string; indicators: typeof inds }
  >();
  for (const ind of inds) {
    const term = ind.categoryTermId ? termMap.get(ind.categoryTermId) : null;
    const key = term?.code ?? "other";
    if (!groups.has(key)) {
      groups.set(key, {
        code: key,
        nameEn: term?.nameEn ?? "Other",
        nameAr: term?.nameAr ?? "أخرى",
        indicators: [],
      });
    }
    groups.get(key)!.indicators.push(ind);
  }
  return [...groups.values()];
}

export async function releaseCalendar(daysAhead = 30) {
  const today = todayIso();
  const until = new Date(Date.now() + daysAhead * 86400000).toISOString().slice(0, 10);
  return db
    .select()
    .from(schema.releases)
    .where(and(gte(schema.releases.releaseDate, today), lte(schema.releases.releaseDate, until)))
    .orderBy(asc(schema.releases.releaseDate));
}

export async function pastReleases(limit = 30) {
  const today = todayIso();
  return db
    .select()
    .from(schema.releases)
    .where(lte(schema.releases.releaseDate, today))
    .orderBy(desc(schema.releases.releaseDate))
    .limit(limit);
}

export async function indicatorDetail(user: CurrentUser, id: string) {
  const [ind] = await db.select().from(schema.indicators).where(eq(schema.indicators.id, id)).limit(1);
  if (!ind || ind.classificationLevel > user.clearanceLevel) return null;
  const values = await db
    .select()
    .from(schema.indicatorValues)
    .where(eq(schema.indicatorValues.indicatorId, id))
    .orderBy(asc(schema.indicatorValues.period));
  const dimensions = await db
    .select()
    .from(schema.indicatorDimensions)
    .where(eq(schema.indicatorDimensions.indicatorId, id));
  const kpiLinks = await db
    .select({
      kpiId: schema.kpis.id,
      nameEn: schema.kpis.nameEn,
      nameAr: schema.kpis.nameAr,
      targetValue: schema.kpis.targetValue,
      targetYear: schema.kpis.targetYear,
      nodeId: schema.kpis.nodeId,
      nodeTitleEn: schema.strategyNodes.titleEn,
      nodeTitleAr: schema.strategyNodes.titleAr,
    })
    .from(schema.kpis)
    .innerJoin(schema.strategyNodes, eq(schema.strategyNodes.id, schema.kpis.nodeId))
    .where(eq(schema.kpis.indicatorId, id));
  const allReleases = await db.select().from(schema.releases);
  const linkedReleases = allReleases.filter((r) => {
    try {
      return (JSON.parse(r.indicatorIdsJson ?? "[]") as string[]).includes(id);
    } catch {
      return false;
    }
  });
  return { ind, values, dimensions, kpiLinks, linkedReleases };
}

export async function addIndicatorValue(
  user: CurrentUser,
  indicatorId: string,
  period: string,
  value: number,
  opts: { dimensionKey?: string; note?: string; sourceDocumentId?: string } = {}
): Promise<{ ok: boolean; error?: string }> {
  if (!can(user, "create", "statistics")) return { ok: false, error: "forbidden" };
  const [ind] = await db
    .select()
    .from(schema.indicators)
    .where(eq(schema.indicators.id, indicatorId))
    .limit(1);
  if (!ind) return { ok: false, error: "not_found" };
  const dimensionKey = opts.dimensionKey ?? "total";
  const existing = await db
    .select()
    .from(schema.indicatorValues)
    .where(
      and(
        eq(schema.indicatorValues.indicatorId, indicatorId),
        eq(schema.indicatorValues.period, period),
        eq(schema.indicatorValues.dimensionKey, dimensionKey)
      )
    )
    .limit(1);
  if (existing.length) {
    await db
      .update(schema.indicatorValues)
      .set({ value, status: "revised", note: opts.note ?? existing[0].note, enteredBy: user.id })
      .where(eq(schema.indicatorValues.id, existing[0].id));
  } else {
    await db.insert(schema.indicatorValues).values({
      id: newId(),
      indicatorId,
      period,
      value,
      dimensionKey,
      status: "provisional",
      note: opts.note ?? null,
      sourceDocumentId: opts.sourceDocumentId ?? null,
      enteredBy: user.id,
      createdAt: nowIso(),
    });
  }
  const isLater = !ind.lastPeriod || period >= ind.lastPeriod;
  await db
    .update(schema.indicators)
    .set({
      lastPeriod: isLater ? period : ind.lastPeriod,
      firstPeriod: !ind.firstPeriod || period < ind.firstPeriod ? period : ind.firstPeriod,
      updatedAt: nowIso(),
    })
    .where(eq(schema.indicators.id, indicatorId));
  await record({
    userId: user.id,
    type: "kpi_value_entered",
    resourceType: "indicator",
    resourceId: indicatorId,
    meta: { departmentId: user.departmentId },
  });
  await audit(user.id, "create", "indicator_value", indicatorId, { period, dimensionKey });
  await enqueue("embed_records", { resourceType: "indicator", resourceId: indicatorId });
  return { ok: true };
}
