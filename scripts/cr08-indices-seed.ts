/* eslint-disable no-console */
// CR08 4: the index groups with their memberships, the new index
// definitions with their observations (research files and cached publisher
// files, offline), the national indicators linked to Statistics Hub
// series with their National Environment Strategy targets, and the forecasts
// of every new index. Home country: see src/server/indices/home.ts.
// Owned by the Indices data agents. Idempotent: run it as often as needed.
//
// The group codes are FIXED (the UI and the tools key on them):
//   sdg, national, environment, climate, water, agriculture, governance,
//   human
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { and, eq, inArray } from "drizzle-orm";
import { ulid } from "ulid";
import type { IndexDef } from "../src/server/indices/fetcher";
import { HOME_ISO3 } from "../src/server/indices/home";

export const INDEX_GROUPS: {
  code: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  colourToken: string;
  sort: number;
}[] = [
  {
    code: "sdg",
    nameEn: "SDGs",
    nameAr: "أهداف التنمية المستدامة",
    descriptionEn:
      "The seventeen Sustainable Development Goal scores from the Sustainable Development Report of the SDSN, with Saudi Arabia's overall SDG Index score and rank.",
    descriptionAr:
      "درجات أهداف التنمية المستدامة السبعة عشر من تقرير التنمية المستدامة الصادر عن شبكة حلول التنمية المستدامة، مع درجة المملكة العربية السعودية وترتيبها في مؤشر أهداف التنمية المستدامة.",
    colourToken: "teal",
    sort: 1,
  },
  {
    code: "national",
    nameEn: "National Indicators",
    nameAr: "المؤشرات الوطنية",
    descriptionEn:
      "Headline indicators of Saudi Vision 2030 and the National Environment Strategy, read from the Statistics Hub with their targets.",
    descriptionAr:
      "المؤشرات الرئيسية لرؤية السعودية 2030 والاستراتيجية الوطنية للبيئة، مقروءة من مركز الإحصاءات مع مستهدفاتها.",
    colourToken: "navy",
    sort: 2,
  },
  {
    code: "environment",
    nameEn: "Environment",
    nameAr: "البيئة",
    descriptionEn:
      "Environmental Performance Index, Climate Change Performance Index, protected areas, forest cover, air quality and the environmental SDGs.",
    descriptionAr:
      "مؤشر الأداء البيئي، ومؤشر أداء تغير المناخ، والمناطق المحمية، والغطاء الحرجي، وجودة الهواء، وأهداف التنمية المستدامة البيئية.",
    colourToken: "ok",
    sort: 3,
  },
  {
    code: "climate",
    nameEn: "Climate",
    nameAr: "المناخ",
    descriptionEn:
      "ND-GAIN climate adaptation, Climate Change Performance, greenhouse gas emissions per capita and the renewable share of energy.",
    descriptionAr:
      "التكيف المناخي وفق مؤشر ND-GAIN، وأداء تغير المناخ، وانبعاثات غازات الدفيئة للفرد، وحصة الطاقة المتجددة.",
    colourToken: "aqua",
    sort: 4,
  },
  {
    code: "water",
    nameEn: "Water Security",
    nameAr: "الأمن المائي",
    descriptionEn:
      "Aqueduct baseline water stress, freshwater withdrawals, renewable water per capita and access to basic drinking water.",
    descriptionAr:
      "الإجهاد المائي الأساسي وفق Aqueduct، والسحب السنوي للمياه العذبة، ونصيب الفرد من المياه المتجددة، والوصول إلى مياه الشرب الأساسية.",
    colourToken: "info",
    sort: 5,
  },
  {
    code: "agriculture",
    nameEn: "Agriculture and Food Security",
    nameAr: "الأمن الغذائي والزراعة",
    descriptionEn:
      "Food production, cereal yield, forest and vegetation cover and the zero hunger and life on land goals.",
    descriptionAr:
      "إنتاج الأغذية، وإنتاجية الحبوب، والغطاء الحرجي والنباتي، وهدفا القضاء على الجوع والحياة في البر.",
    colourToken: "ink",
    sort: 6,
  },
  {
    code: "governance",
    nameEn: "Governance and Institutions",
    nameAr: "الحوكمة والمؤسسات",
    descriptionEn:
      "Corruption Perceptions and the Worldwide Governance Indicators, the institutional context of environmental regulation.",
    descriptionAr:
      "مدركات الفساد ومؤشرات الحوكمة العالمية، وهي السياق المؤسسي للتنظيم البيئي.",
    colourToken: "navy",
    sort: 7,
  },
  {
    code: "human",
    nameEn: "Human Development and Society",
    nameAr: "التنمية البشرية والمجتمع",
    descriptionEn: "Human Development and Social Progress.",
    descriptionAr: "التنمية البشرية والتقدم الاجتماعي.",
    colourToken: "teal",
    sort: 8,
  },
];

/** Upserts the groups by code; never touches memberships. */
export async function seedIndexGroups(): Promise<Map<string, string>> {
  const { db, schema } = await import("../src/server/db/client");
  const existing = await db.select().from(schema.indexGroups);
  const byCode = new Map(existing.map((g) => [g.code, g.id]));
  for (const g of INDEX_GROUPS) {
    const id = byCode.get(g.code);
    if (id) {
      await db
        .update(schema.indexGroups)
        .set({
          nameEn: g.nameEn,
          nameAr: g.nameAr,
          descriptionEn: g.descriptionEn,
          descriptionAr: g.descriptionAr,
          colourToken: g.colourToken,
          sort: g.sort,
        })
        .where(eq(schema.indexGroups.id, id));
    } else {
      const newId = ulid();
      await db.insert(schema.indexGroups).values({ id: newId, ...g, isActive: 1 });
      byCode.set(g.code, newId);
    }
  }
  console.log(`cr08 indices: ${INDEX_GROUPS.length} groups in place`);
  return byCode;
}

/* ------------------------------------------------------------------ */
/* CR08 4.1 (2): national indicators as index records                   */
/* ------------------------------------------------------------------ */
/*
  One index record per chosen Statistics Hub indicator (code nat_<indicator
  code>), in the "national" group, linked through linked_statistics_indicator_id.
  Observations are home-country only and are COPIED from the indicator's values
  (dimension "total"), one row per year; the annual value follows the rule
  named on each spec: "mean" of the sub-annual readings (years with at least
  half the periods), "sum" of the monthly readings (complete years only, for
  flows and counts), "last" reading of the year (stocks), or the annual
  value as published. Periods later than the current year are ignored. The
  target comes from the strategy KPI attached to the indicator (kpis.indicator_id)
  with a unit alignment where the KPI is stated in GW and the series in MW.
  The Statistics Hub is seeded (illustrative) until it is connected to the
  national data source; the source notes say so.
*/

type NationalSpec = {
  code: string;
  annualise: "mean" | "sum" | "last";
  category: IndexDef["category"];
  scoreMin: number;
  scoreMax: number;
  responsibleEntityName: string;
  ruleEn: string;
  ruleAr: string;
};

const RULE = {
  mean: {
    ruleEn: "annual value = mean of the sub-annual readings (years with at least half the periods)",
    ruleAr: "القيمة السنوية = متوسط القراءات دون السنوية (السنوات التي تتوافر لها نصف الفترات على الأقل)",
  },
  sum: {
    ruleEn: "annual value = sum of the monthly readings (complete years only)",
    ruleAr: "القيمة السنوية = مجموع القراءات الشهرية (السنوات المكتملة فقط)",
  },
  last: {
    ruleEn: "annual value = the last reading of the year",
    ruleAr: "القيمة السنوية = آخر قراءة في السنة",
  },
  annual: {
    ruleEn: "annual series as published",
    ruleAr: "سلسلة سنوية كما نُشرت",
  },
} as const;

export const NATIONAL_INDICATORS: NationalSpec[] = [
  { code: "gdp_real_growth", annualise: "mean", category: "economy", scoreMin: -20, scoreMax: 20, responsibleEntityName: "Ministry of Finance", ...RULE.mean },
  { code: "gdp_nonhydro_share", annualise: "mean", category: "economy", scoreMin: 0, scoreMax: 100, responsibleEntityName: "Ministry of Finance", ...RULE.mean },
  { code: "unemployment_rate", annualise: "mean", category: "economy", scoreMin: 0, scoreMax: 100, responsibleEntityName: "Ministry of Human Resources and Social Development", ...RULE.mean },
  { code: "cpi_inflation", annualise: "mean", category: "economy", scoreMin: -20, scoreMax: 50, responsibleEntityName: "General Authority for Statistics", ...RULE.mean },
  { code: "pop_total", annualise: "last", category: "society", scoreMin: 0, scoreMax: 100_000_000, responsibleEntityName: "General Authority for Statistics", ...RULE.last },
  { code: "trade_balance", annualise: "sum", category: "economy", scoreMin: -2000, scoreMax: 2000, responsibleEntityName: "Ministry of Commerce", ...RULE.sum },
  { code: "building_permits", annualise: "sum", category: "economy", scoreMin: 0, scoreMax: 1_000_000, responsibleEntityName: "Ministry of Municipal, Rural Affairs and Housing", ...RULE.sum },
  { code: "labour_productivity_growth", annualise: "mean", category: "economy", scoreMin: -20, scoreMax: 20, responsibleEntityName: "Ministry of Human Resources and Social Development", ...RULE.annual },
  { code: "digital_services_share", annualise: "mean", category: "governance", scoreMin: 0, scoreMax: 100, responsibleEntityName: "Ministry of Communications and Information Technology", ...RULE.annual },
  { code: "ghg_per_capita", annualise: "mean", category: "environment", scoreMin: 0, scoreMax: 100, responsibleEntityName: "National Center for Environmental Compliance", ...RULE.annual },
  { code: "solar_capacity", annualise: "mean", category: "environment", scoreMin: 0, scoreMax: 100_000, responsibleEntityName: "Ministry of Energy", ...RULE.annual },
];

const ruleOf = (spec: NationalSpec, frequency: string) =>
  frequency === "annual"
    ? { en: RULE.annual.ruleEn, ar: RULE.annual.ruleAr }
    : { en: spec.ruleEn, ar: spec.ruleAr };

export function annualise(
  rows: { period: string; value: number }[],
  rule: NationalSpec["annualise"],
  frequency: string
): { year: number; value: number }[] {
  const thisYear = new Date().getFullYear();
  const byYear = new Map<number, { period: string; value: number }[]>();
  for (const r of rows) {
    const m = /^(\d{4})(?:-(\d{2})|-Q([1-4]))?$/.exec(r.period.trim());
    if (!m) continue;
    const year = Number(m[1]);
    if (year < 2000 || year > thisYear || !Number.isFinite(r.value)) continue;
    (byYear.get(year) ?? byYear.set(year, []).get(year)!).push(r);
  }
  const expected = frequency === "monthly" ? 12 : frequency === "quarterly" ? 4 : 1;
  const out: { year: number; value: number }[] = [];
  for (const [year, list] of [...byYear].sort((a, b) => a[0] - b[0])) {
    list.sort((a, b) => a.period.localeCompare(b.period));
    let value: number;
    if (expected === 1 || rule === "last") {
      value = list[list.length - 1].value;
    } else if (rule === "sum") {
      if (list.length < expected) continue;
      value = list.reduce((s, r) => s + r.value, 0);
    } else {
      if (list.length * 2 < expected) continue;
      value = list.reduce((s, r) => s + r.value, 0) / list.length;
    }
    out.push({ year, value: Math.round(value * 10000) / 10000 });
  }
  return out;
}

export async function seedNationalIndicators(): Promise<{
  codes: string[];
  created: number;
  observations: number;
  withTarget: number;
}> {
  const { db, schema } = await import("../src/server/db/client");
  const { newId, nowIso } = await import("../src/lib/ids");
  const wanted = NATIONAL_INDICATORS.map((s) => s.code);
  const indicators = await db
    .select()
    .from(schema.indicators)
    .where(inArray(schema.indicators.code, wanted));
  const indicatorByCode = new Map(indicators.map((i) => [i.code, i]));
  const entities = await db.select().from(schema.entities);
  const entityByName = new Map(entities.map((e) => [e.nameEn.toLowerCase(), e.id]));
  // the strategy edition whose KPIs carry the targets: the default one
  const editions = await db.select().from(schema.strategyEditions);
  const strategyEdition = editions.find((e) => e.isDefault === 1) ?? editions[0];
  const kpis = indicators.length
    ? await db
        .select()
        .from(schema.kpis)
        .where(inArray(schema.kpis.indicatorId, indicators.map((i) => i.id)))
    : [];
  const nodes = kpis.length
    ? await db
        .select()
        .from(schema.strategyNodes)
        .where(inArray(schema.strategyNodes.id, kpis.map((k) => k.nodeId)))
    : [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const existingIndices = await db.select().from(schema.indices);
  const indexByCode = new Map(existingIndices.map((i) => [i.code, i]));

  let created = 0;
  let observations = 0;
  let withTarget = 0;
  const codes: string[] = [];
  for (const spec of NATIONAL_INDICATORS) {
    const ind = indicatorByCode.get(spec.code);
    if (!ind) {
      console.warn(`cr08 indices: indicator ${spec.code} not found, skipped`);
      continue;
    }
    /* the target: the strategy KPI on this indicator, latest target year first */
    const cands = kpis
      .filter((k) => k.indicatorId === ind.id && k.targetValue != null)
      .sort((a, b) => {
        const aN = strategyEdition && nodeById.get(a.nodeId)?.editionId === strategyEdition.id ? 1 : 0;
        const bN = strategyEdition && nodeById.get(b.nodeId)?.editionId === strategyEdition.id ? 1 : 0;
        return bN - aN || (b.targetYear ?? 0) - (a.targetYear ?? 0);
      });
    const kpi = cands[0] ?? null;
    let targetValue = kpi?.targetValue ?? null;
    const targetYear = kpi?.targetYear ?? null;
    if (
      kpi &&
      targetValue != null &&
      /\bGW\b/i.test(kpi.unit ?? "") &&
      /\bMW\b/i.test(ind.unit ?? "")
    ) {
      targetValue = targetValue * 1000; // the KPI states gigawatts, the series megawatts
    }
    if (targetValue != null && targetYear != null) withTarget++;
    const rule = ruleOf(spec, ind.frequency);
    const code = `nat_${spec.code}`;
    codes.push(code);
    const unit = ind.unit ? ` (${ind.unit})` : "";
    const base = {
      nameEn: ind.nameEn,
      nameAr: ind.nameAr,
      publisher: "Programme Office, Statistics Hub",
      publisherUrl: null,
      methodologySummaryEn: `${ind.definitionEn ? ind.definitionEn.replace(/\.?$/, ".") + " " : ""}Read from the EnviroAI Statistics Hub series ${ind.code}${unit}; ${rule.en}.${targetValue != null && targetYear != null ? ` National target ${targetValue} by ${targetYear} (${kpi?.nameEn ?? "strategy KPI"}).` : ""}`,
      methodologySummaryAr: `${ind.definitionAr ? ind.definitionAr.replace(/\.?$/, ".") + " " : ""}يُقرأ من سلسلة مركز الإحصاءات في EnviroAI ${ind.code}${unit}؛ ${rule.ar}.${targetValue != null && targetYear != null ? ` المستهدف الوطني ${targetValue} بحلول ${targetYear} (${kpi?.nameAr ?? "مؤشر أداء الاستراتيجية"}).` : ""}`,
      scale: "score",
      scoreMin: spec.scoreMin,
      scoreMax: spec.scoreMax,
      higherIsBetter: ind.direction === "down_good" ? 0 : 1,
      frequency: "annual",
      category: spec.category,
      responsibleEntityId: entityByName.get(spec.responsibleEntityName.toLowerCase()) ?? null,
      linkedNodeIdsJson: kpi ? JSON.stringify([kpi.nodeId]) : null,
      isActive: 1,
      sourceNotes:
        "Values copied from the EnviroAI Statistics Hub series (seeded, illustrative until the hub is connected to the national data source); the target is the strategy KPI attached to the indicator.",
      linkedStatisticsIndicatorId: ind.id,
      targetValue,
      targetYear,
      updatedAt: nowIso(),
    };
    const existing = indexByCode.get(code);
    let indexId: string;
    if (existing) {
      indexId = existing.id;
      await db
        .update(schema.indices)
        .set({
          ...base,
          // the mode is filled once; a Super Admin may change it afterwards
          forecastMode:
            existing.forecastMode ??
            (targetValue != null && targetYear != null ? "target_gap" : "score"),
        })
        .where(eq(schema.indices.id, indexId));
    } else {
      indexId = newId();
      await db.insert(schema.indices).values({
        id: indexId,
        code,
        ...base,
        forecastMode: targetValue != null && targetYear != null ? "target_gap" : "score",
        forecastEnabled: 1,
        createdAt: nowIso(),
      });
      created++;
    }

    /* observations copied from the hub series (home country only) */
    const values = await db
      .select()
      .from(schema.indicatorValues)
      .where(
        and(
          eq(schema.indicatorValues.indicatorId, ind.id),
          eq(schema.indicatorValues.dimensionKey, "total")
        )
      );
    const annual = annualise(
      values.map((v) => ({ period: v.period, value: v.value })),
      spec.annualise,
      ind.frequency
    );
    const existingObs = await db
      .select()
      .from(schema.indexObservations)
      .where(eq(schema.indexObservations.indexId, indexId));
    const byYear = new Map(existingObs.filter((o) => o.countryCode === HOME_ISO3).map((o) => [o.year, o]));
    const sourceUrl = `/statistics/${ind.id}`;
    for (const a of annual) {
      const prior = byYear.get(a.year);
      if (prior) {
        if (prior.status !== "fetched") continue; // manual and verified rows stand
        if (prior.score !== a.value) {
          await db
            .update(schema.indexObservations)
            .set({ score: a.value, sourceUrl, fetchedAt: nowIso() })
            .where(eq(schema.indexObservations.id, prior.id));
        }
        continue;
      }
      await db.insert(schema.indexObservations).values({
        id: newId(),
        indexId,
        countryCode: HOME_ISO3,
        year: a.year,
        rank: null,
        score: a.value,
        totalCountries: null,
        sourceUrl,
        fetchedAt: nowIso(),
        status: "fetched",
      });
      observations++;
    }
    const latest = annual.length ? annual[annual.length - 1].year : null;
    await db
      .update(schema.indices)
      .set({ latestYear: latest, updatedAt: nowIso() })
      .where(eq(schema.indices.id, indexId));
  }
  console.log(
    `cr08 indices: ${codes.length} national indicator indices (${created} created, ${withTarget} with a target, ${observations} observations added)`
  );
  return { codes, created, observations, withTarget };
}

/* ------------------------------------------------------------------ */
/* memberships                                                          */
/* ------------------------------------------------------------------ */

/** Adds the missing (group, index) rows for every def's groups, the CR05
    memberships and the national indicators; never removes or reorders what
    is already there (a Super Admin may have moved indices in edit mode). */
export async function seedMemberships(
  groupIds: Map<string, string>,
  wanted: { code: string; groups: string[] }[]
): Promise<Map<string, number>> {
  const { db, schema } = await import("../src/server/db/client");
  const indices = await db.select().from(schema.indices);
  const indexByCode = new Map(indices.map((i) => [i.code, i.id]));
  const existing = await db.select().from(schema.indexGroupMembers);
  const have = new Set(existing.map((m) => `${m.groupId}:${m.indexId}`));
  const nextSort = new Map<string, number>();
  for (const m of existing) {
    nextSort.set(m.groupId, Math.max(nextSort.get(m.groupId) ?? 0, m.sort + 1));
  }
  let inserted = 0;
  for (const w of wanted) {
    const indexId = indexByCode.get(w.code);
    if (!indexId) continue;
    for (const g of w.groups) {
      const groupId = groupIds.get(g);
      if (!groupId) {
        console.warn(`cr08 indices: unknown group "${g}" on ${w.code}`);
        continue;
      }
      const key = `${groupId}:${indexId}`;
      if (have.has(key)) continue;
      const sort = nextSort.get(groupId) ?? 0;
      nextSort.set(groupId, sort + 1);
      await db.insert(schema.indexGroupMembers).values({ id: ulid(), groupId, indexId, sort });
      have.add(key);
      inserted++;
    }
  }
  const counts = new Map<string, number>();
  const after = await db.select().from(schema.indexGroupMembers);
  for (const [code, id] of groupIds) counts.set(code, after.filter((m) => m.groupId === id).length);
  console.log(
    `cr08 indices: memberships ${inserted} added; ${[...counts].map(([c, n]) => `${c}=${n}`).join(" ")}`
  );
  return counts;
}

/* ------------------------------------------------------------------ */
/* the seed                                                             */
/* ------------------------------------------------------------------ */

export default async function seedCr08Indices(): Promise<void> {
  // other agents' seeds write to the same SQLite file at the same time:
  // wait for their transactions instead of failing with SQLITE_BUSY
  {
    const { db } = await import("../src/server/db/client");
    const { sql } = await import("drizzle-orm");
    await db.run(sql`PRAGMA busy_timeout = 60000`);
  }
  const groupIds = await seedIndexGroups();
  const { CR05_INDEX_DEFS, ensureIndexRows, runIndicesFetch } = await import(
    "../src/server/indices/fetcher"
  );
  const { CR08_INDEX_DEFS, EXISTING_INDEX_GROUPS } = await import(
    "../src/server/indices/defs-cr08"
  );
  const { CR08_EXISTING_MEMBERSHIPS_A } = await import("../src/server/indices/defs-cr08-a");

  /* 1. every index row exists (CR05 twelve and the CR08 additions) */
  await ensureIndexRows([...CR05_INDEX_DEFS, ...CR08_INDEX_DEFS]);
  console.log(
    `cr08 indices: ${CR05_INDEX_DEFS.length + CR08_INDEX_DEFS.length} index definitions in place (${CR08_INDEX_DEFS.length} added by CR08)`
  );

  /* 2. observations of the CR08 indices: research files and the cached
        publisher workbooks (offline; the refresh job downloads) */
  const cr08Codes = CR08_INDEX_DEFS.map((d) => d.code);
  const report = await runIndicesFetch({ download: false, codes: cr08Codes });
  for (const r of report.perIndex) {
    console.log(
      `  ${r.code.padEnd(18)} obs=${String(r.observations).padStart(5)} (+${r.inserted}) countries=${r.countries} home=${
        r.homeYears.length
          ? `${r.homeYears.length}y ${r.homeYears[0]}-${r.homeYears[r.homeYears.length - 1]}`
          : "none"
      }`
    );
  }

  /* 3. national indicators */
  const national = await seedNationalIndicators();

  /* 4. memberships */
  // the CR05 memberships: the union of both research agents' maps
  const cr05Groups = new Map<string, Set<string>>();
  for (const d of CR05_INDEX_DEFS) cr05Groups.set(d.code, new Set(EXISTING_INDEX_GROUPS[d.code] ?? []));
  for (const m of CR08_EXISTING_MEMBERSHIPS_A) {
    const set = cr05Groups.get(m.code) ?? cr05Groups.set(m.code, new Set()).get(m.code)!;
    for (const g of m.groups) set.add(g);
  }
  const wanted: { code: string; groups: string[] }[] = [
    ...[...cr05Groups].map(([code, groups]) => ({ code, groups: [...groups] })),
    ...CR08_INDEX_DEFS.map((d) => ({ code: d.code, groups: [...d.groups] })),
    ...national.codes.map((code) => ({ code, groups: ["national"] })),
  ];
  await seedMemberships(groupIds, wanted);

  /* 5. forecasts for every new index (rank, score or target_gap per row) */
  const { db, schema } = await import("../src/server/db/client");
  const { computeForecast } = await import("../src/server/indices/compute");
  const newCodes = [...cr08Codes, ...national.codes];
  const rows = await db
    .select({ id: schema.indices.id, code: schema.indices.code })
    .from(schema.indices)
    .where(inArray(schema.indices.code, newCodes));
  let computed = 0;
  let skipped = 0;
  for (const row of rows) {
    try {
      if (await computeForecast(row.id)) computed++;
      else skipped++;
    } catch (e) {
      skipped++;
      console.error(`  forecast failed for ${row.code}: ${(e as Error)?.message}`);
    }
  }
  console.log(
    `cr08 indices: forecasts computed for ${computed} of ${rows.length} new indices (${skipped} skipped: disabled or no home-country series)`
  );
}

const isMain = process.argv[1] && /cr08-indices-seed\.ts$/.test(process.argv[1]);
if (isMain) {
  seedCr08Indices()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
