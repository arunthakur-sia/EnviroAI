import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { fetch as undiciFetch, Agent } from "undici";
import * as XLSX from "xlsx";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { audit } from "@/server/auth/audit";
import { newId, nowIso } from "@/lib/ids";
import { parseCsv } from "@/server/indices/fetcher";
import { computeForecast } from "@/server/indices/compute";

/* CR08 4.3: the three-step Add index. GET returns the wizard's option lists.
   POST with step "preview" parses the data (a CSV paste, an uploaded CSV or
   XLSX, a publisher URL fetched once, or manual rows) and answers with the
   normalised rows and warnings, writing nothing. POST with step "commit"
   creates the index, its observations (status manual, with the source URL),
   its memberships, then computes the first forecast when enabled. */

// The corporate proxy re-signs public sites (DECISIONS 8/23): this one-shot
// read of a public data file is the only place the check is relaxed here.
const insecureDispatcher = new Agent({ connect: { rejectUnauthorized: false } });
const FETCH_TIMEOUT_MS = 20_000;
const FETCH_MAX_BYTES = 6 * 1024 * 1024;
const MAX_ROWS = 5000;

const CATEGORIES = ["economy", "governance", "society", "environment", "technology", "human"] as const;
const FREQUENCIES = ["annual", "biennial", "quarterly", "monthly", "irregular"] as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const [entities, groups, indicators, editions, existing] = await Promise.all([
    db
      .select({
        id: schema.entities.id,
        nameEn: schema.entities.nameEn,
        nameAr: schema.entities.nameAr,
        shortEn: schema.entities.shortNameEn,
        shortAr: schema.entities.shortNameAr,
      })
      .from(schema.entities)
      .where(eq(schema.entities.isActive, 1))
      .orderBy(asc(schema.entities.nameEn)),
    db
      .select({
        id: schema.indexGroups.id,
        code: schema.indexGroups.code,
        nameEn: schema.indexGroups.nameEn,
        nameAr: schema.indexGroups.nameAr,
        colourToken: schema.indexGroups.colourToken,
      })
      .from(schema.indexGroups)
      .where(eq(schema.indexGroups.isActive, 1))
      .orderBy(asc(schema.indexGroups.sort)),
    db
      .select({
        id: schema.indicators.id,
        code: schema.indicators.code,
        nameEn: schema.indicators.nameEn,
        nameAr: schema.indicators.nameAr,
        unit: schema.indicators.unit,
      })
      .from(schema.indicators)
      .orderBy(asc(schema.indicators.nameEn)),
    db.select().from(schema.strategyEditions),
    db.select({ code: schema.indices.code }).from(schema.indices),
  ]);
  const nds3 = editions.find((e) => e.code === "nds3") ?? editions.find((e) => e.isDefault === 1);
  const targets = nds3
    ? await db
        .select({
          id: schema.strategyNodes.id,
          code: schema.strategyNodes.code,
          titleEn: schema.strategyNodes.titleEn,
          titleAr: schema.strategyNodes.titleAr,
        })
        .from(schema.strategyNodes)
        .where(
          and(eq(schema.strategyNodes.editionId, nds3.id), eq(schema.strategyNodes.nodeType, "target"))
        )
        .orderBy(asc(schema.strategyNodes.code))
    : [];
  return NextResponse.json({
    data: {
      entities,
      groups,
      indicators,
      targets,
      categories: CATEGORIES,
      frequencies: FREQUENCIES,
      existingCodes: existing.map((r) => r.code),
    },
    error: null,
  });
}

/* ------------------------------------------------------------------ */
/* body                                                                 */
/* ------------------------------------------------------------------ */

const Basics = z.object({
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{1,23}$/),
  nameEn: z.string().trim().min(2).max(120),
  nameAr: z.string().trim().min(1).max(120),
  publisher: z.string().trim().max(120).optional(),
  publisherUrl: z.string().trim().max(500).optional(),
  scale: z.enum(["rank", "score", "both"]).default("both"),
  scoreMin: z.number().nullable().optional(),
  scoreMax: z.number().nullable().optional(),
  higherIsBetter: z.boolean().default(true),
  frequency: z.enum(FREQUENCIES).default("annual"),
  category: z.enum(CATEGORIES).default("economy"),
  responsibleEntityId: z.string().nullable().optional(),
  linkedNodeIds: z.array(z.string()).max(20).optional(),
  linkedStatisticsIndicatorId: z.string().nullable().optional(),
  methodologySummaryEn: z.string().trim().max(2000).optional(),
  methodologySummaryAr: z.string().trim().max(2000).optional(),
});

const ManualRow = z.object({
  country: z.string().trim(),
  year: z.union([z.number(), z.string()]),
  rank: z.union([z.number(), z.string(), z.null()]).optional(),
  score: z.union([z.number(), z.string(), z.null()]).optional(),
  total: z.union([z.number(), z.string(), z.null()]).optional(),
});

const Data = z.object({
  mode: z.enum(["paste", "upload", "url", "manual"]),
  /** the wizard commits the previewed rows as manual rows and names where they came from */
  origin: z.enum(["paste", "upload", "url", "manual"]).optional(),
  csv: z.string().max(2_000_000).optional(),
  fileName: z.string().max(200).optional(),
  fileBase64: z.string().max(12_000_000).optional(),
  url: z.string().trim().max(1000).optional(),
  rows: z.array(ManualRow).max(MAX_ROWS).optional(),
  sourceUrl: z.string().trim().max(500).optional(),
});

const Forecasting = z.object({
  enabled: z.boolean().default(true),
  mode: z.enum(["auto", "rank", "score", "target_gap"]).default("auto"),
  targetValue: z.number().nullable().optional(),
  targetYear: z.number().int().min(2000).max(2100).nullable().optional(),
});

const Body = z.object({
  step: z.enum(["preview", "commit"]),
  basics: Basics,
  data: Data,
  forecasting: Forecasting.default({}),
  groupIds: z.array(z.string()).max(40).default([]),
});

/* ------------------------------------------------------------------ */
/* parsing                                                              */
/* ------------------------------------------------------------------ */

export type ParsedRow = {
  country: string;
  year: number;
  rank: number | null;
  score: number | null;
  total: number | null;
};

export type Warning = { code: string; count: number; examples: string[] };

class WarningBag {
  private map = new Map<string, Warning>();
  add(code: string, example?: string) {
    const w = this.map.get(code) ?? { code, count: 0, examples: [] };
    w.count++;
    if (example && w.examples.length < 5 && !w.examples.includes(example)) w.examples.push(example);
    this.map.set(code, w);
  }
  list(): Warning[] {
    return [...this.map.values()];
  }
}

const HEADER_ALIASES: Record<string, keyof ParsedRow> = {
  country: "country",
  iso3: "country",
  iso: "country",
  code: "country",
  country_code: "country",
  countrycode: "country",
  economy: "country",
  year: "year",
  edition: "year",
  period: "year",
  rank: "rank",
  ranking: "rank",
  position: "rank",
  score: "score",
  value: "score",
  index: "score",
  total: "total",
  total_countries: "total",
  of: "total",
  countries: "total",
  n: "total",
};

function num(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/,/g, "");
  if (!s || s === "-" || s.toLowerCase() === "n/a" || s.toLowerCase() === "na") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function normalise(
  grid: unknown[][],
  bag: WarningBag
): Promise<ParsedRow[]> {
  if (!grid.length) return [];
  const header = grid[0].map((h) => String(h ?? "").trim().toLowerCase().replace(/\s+/g, "_"));
  const col: Partial<Record<keyof ParsedRow, number>> = {};
  header.forEach((h, i) => {
    const key = HEADER_ALIASES[h];
    if (key && col[key] === undefined) col[key] = i;
  });
  const missing = (["country", "year"] as const).filter((k) => col[k] === undefined);
  if (missing.length || (col.rank === undefined && col.score === undefined)) {
    bag.add("missing_columns", [...missing, ...(col.rank === undefined && col.score === undefined ? ["rank/score"] : [])].join(", "));
    return [];
  }
  const countries = await db.select().from(schema.countries);
  const iso = new Set(countries.map((c) => c.iso3));
  const byName = new Map(countries.map((c) => [c.nameEn.toLowerCase(), c.iso3]));
  const seen = new Map<string, ParsedRow>();
  for (const raw of grid.slice(1, MAX_ROWS + 1)) {
    if (!raw.some((c) => String(c ?? "").trim())) continue;
    const countryRaw = String(raw[col.country!] ?? "").trim();
    let country = countryRaw.toUpperCase();
    if (!/^[A-Z]{3}$/.test(country) || !iso.has(country)) {
      const byNameHit = byName.get(countryRaw.toLowerCase());
      if (byNameHit) country = byNameHit;
      else if (/^[A-Z]{3}$/.test(country)) {
        // an ISO3 outside the countries table still stores (the fetcher does the same)
      } else {
        bag.add("unknown_country", countryRaw);
        continue;
      }
    }
    const year = num(raw[col.year!]);
    if (year == null || !Number.isInteger(year) || year < 1990 || year > 2100) {
      bag.add("bad_year", String(raw[col.year!] ?? ""));
      continue;
    }
    const rank = col.rank !== undefined ? num(raw[col.rank]) : null;
    const score = col.score !== undefined ? num(raw[col.score]) : null;
    const total = col.total !== undefined ? num(raw[col.total]) : null;
    if (rank == null && score == null) {
      bag.add("no_value", `${country} ${year}`);
      continue;
    }
    if (rank != null && (rank < 1 || !Number.isInteger(rank))) {
      bag.add("bad_rank", `${country} ${year}: ${rank}`);
      continue;
    }
    const key = `${country}:${year}`;
    if (seen.has(key)) bag.add("duplicate", key);
    seen.set(key, { country, year, rank, score, total: total != null ? Math.round(total) : null });
  }
  const rows = [...seen.values()].sort((a, b) => a.country.localeCompare(b.country) || a.year - b.year);
  if (!rows.some((r) => r.country === "QAT")) bag.add("no_qatar");
  return rows;
}

function gridFromBuffer(buf: Buffer, name: string, contentType: string): unknown[][] {
  const looksXlsx =
    /\.xlsx?$/i.test(name) ||
    /spreadsheet|ms-excel|officedocument/i.test(contentType) ||
    (buf[0] === 0x50 && buf[1] === 0x4b);
  if (looksXlsx) {
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true }) as unknown[][];
  }
  return parseCsv(buf.toString("utf8").replace(/^﻿/, ""));
}

async function fetchPublisher(url: string, bag: WarningBag): Promise<unknown[][]> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    bag.add("bad_url", url);
    return [];
  }
  if (!/^https?:$/.test(target.protocol)) {
    bag.add("bad_url", url);
    return [];
  }
  try {
    const res = await undiciFetch(target.toString(), {
      dispatcher: insecureDispatcher,
      headers: { "user-agent": "SiaNexus-indices/1.0 (research prototype)" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) {
      bag.add("fetch_failed", `HTTP ${res.status}`);
      return [];
    }
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > FETCH_MAX_BYTES) {
      bag.add("too_large", `${Math.round(declared / 1024)} KB`);
      return [];
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > FETCH_MAX_BYTES) {
      bag.add("too_large", `${Math.round(buf.byteLength / 1024)} KB`);
      return [];
    }
    const type = res.headers.get("content-type") ?? "";
    if (/text\/html/i.test(type) && !/\.csv$/i.test(target.pathname)) {
      bag.add("html_page", target.hostname);
      return [];
    }
    return gridFromBuffer(buf, target.pathname, type);
  } catch (e) {
    bag.add("fetch_failed", String((e as Error)?.name === "TimeoutError" ? "timeout" : (e as Error)?.message ?? e).slice(0, 80));
    return [];
  }
}

async function parseData(data: z.infer<typeof Data>): Promise<{ rows: ParsedRow[]; warnings: Warning[]; sourceUrl: string | null }> {
  const bag = new WarningBag();
  let grid: unknown[][] = [];
  let sourceUrl: string | null = data.sourceUrl?.trim() || null;
  if (data.mode === "manual") {
    grid = [
      ["country", "year", "rank", "score", "total"],
      ...(data.rows ?? []).map((r) => [r.country, r.year, r.rank ?? "", r.score ?? "", r.total ?? ""]),
    ];
  } else if (data.mode === "paste") {
    grid = parseCsv((data.csv ?? "").replace(/^﻿/, "").replace(/\t/g, ","));
  } else if (data.mode === "upload") {
    if (!data.fileBase64) bag.add("no_file");
    else grid = gridFromBuffer(Buffer.from(data.fileBase64, "base64"), data.fileName ?? "", "");
  } else if (data.mode === "url") {
    if (!data.url) bag.add("bad_url", "");
    else {
      grid = await fetchPublisher(data.url, bag);
      sourceUrl = sourceUrl ?? data.url;
    }
  }
  const rows = grid.length ? await normalise(grid, bag) : [];
  if (!rows.length && !bag.list().length) bag.add("no_rows");
  return { rows, warnings: bag.list(), sourceUrl };
}

/* ------------------------------------------------------------------ */
/* POST                                                                 */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "manage", "settings")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: "invalid", issues: parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 }
    );
  }
  const b = parsed.data;
  const [dupe] = await db
    .select({ id: schema.indices.id })
    .from(schema.indices)
    .where(eq(schema.indices.code, b.basics.code))
    .limit(1);
  if (dupe) return NextResponse.json({ data: null, error: "code_exists" }, { status: 409 });

  const { rows, warnings, sourceUrl } = await parseData(b.data);
  const qatarRows = rows.filter((r) => r.country === "QAT");
  const years = rows.map((r) => r.year);
  const summary = {
    rows: rows.length,
    countries: new Set(rows.map((r) => r.country)).size,
    qatarYears: qatarRows.length,
    yearFrom: years.length ? Math.min(...years) : null,
    yearTo: years.length ? Math.max(...years) : null,
    withRank: rows.filter((r) => r.rank != null).length,
    withScore: rows.filter((r) => r.score != null).length,
  };

  if (b.step === "preview") {
    return NextResponse.json({
      data: { rows: rows.slice(0, 400), truncated: rows.length > 400, warnings, summary, sourceUrl },
      error: null,
    });
  }

  if (!rows.length) {
    return NextResponse.json({ data: null, error: "no_rows", warnings }, { status: 400 });
  }
  const groups = b.groupIds.length
    ? await db.select().from(schema.indexGroups).where(eq(schema.indexGroups.isActive, 1))
    : [];
  const validGroupIds = b.groupIds.filter((id) => groups.some((g) => g.id === id));

  const id = newId();
  const now = nowIso();
  const latestYear = qatarRows.length ? Math.max(...qatarRows.map((r) => r.year)) : summary.yearTo;
  await db.insert(schema.indices).values({
    id,
    code: b.basics.code,
    nameEn: b.basics.nameEn,
    nameAr: b.basics.nameAr,
    publisher: b.basics.publisher || null,
    publisherUrl: b.basics.publisherUrl || null,
    methodologySummaryEn: b.basics.methodologySummaryEn || null,
    methodologySummaryAr: b.basics.methodologySummaryAr || null,
    scale: b.basics.scale,
    scoreMin: b.basics.scoreMin ?? null,
    scoreMax: b.basics.scoreMax ?? null,
    higherIsBetter: b.basics.higherIsBetter ? 1 : 0,
    frequency: b.basics.frequency,
    latestYear,
    responsibleEntityId: b.basics.responsibleEntityId || null,
    linkedNodeIdsJson: b.basics.linkedNodeIds?.length ? JSON.stringify(b.basics.linkedNodeIds) : null,
    category: b.basics.category,
    isActive: 1,
    sourceNotes: `Added in Settings > Indices (${b.data.origin ?? b.data.mode}); observations carry the manual status.`,
    linkedStatisticsIndicatorId: b.basics.linkedStatisticsIndicatorId || null,
    targetValue: b.forecasting.targetValue ?? null,
    targetYear: b.forecasting.targetYear ?? null,
    forecastMode: b.forecasting.mode === "auto" ? null : b.forecasting.mode,
    forecastEnabled: b.forecasting.enabled ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  });
  for (const r of rows) {
    await db.insert(schema.indexObservations).values({
      id: newId(),
      indexId: id,
      countryCode: r.country,
      year: r.year,
      rank: r.rank,
      score: r.score,
      totalCountries: r.total,
      sourceUrl,
      fetchedAt: now,
      status: "manual",
    });
  }
  for (const groupId of validGroupIds) {
    const existing = await db
      .select({ sort: schema.indexGroupMembers.sort })
      .from(schema.indexGroupMembers)
      .where(eq(schema.indexGroupMembers.groupId, groupId));
    const sort = existing.reduce((m, r) => Math.max(m, r.sort), 0) + 1;
    await db.insert(schema.indexGroupMembers).values({ id: newId(), groupId, indexId: id, sort });
  }
  await audit(user.id, "index_created", "index", id, {
    code: b.basics.code,
    mode: b.data.origin ?? b.data.mode,
    observations: rows.length,
    groups: validGroupIds.length,
  });

  let forecast = false;
  if (b.forecasting.enabled && qatarRows.length >= 2) {
    try {
      forecast = await computeForecast(id);
    } catch (e) {
      console.error(`first forecast failed for ${b.basics.code}:`, (e as Error)?.message);
    }
  }
  return NextResponse.json({
    data: { id, code: b.basics.code, observations: rows.length, groups: validGroupIds.length, forecast, warnings },
    error: null,
  });
}
