// Bulk-file sources for the Saudi environment, water and agriculture
// benchmark. Each parser reads a public publisher file (every country, not
// only Saudi Arabia) and returns one observation per country and year. Ranks
// are derived by sorting the official values (ties share a rank), the same
// derivation the HDI and EPI parsers apply. Nothing here invents a value: a
// country or year the file does not carry stays absent.
//
//   nd_gain       University of Notre Dame Global Adaptation Initiative,
//                 country index download (zip, gain/gain.csv)
//   aqueduct_bws  WRI Aqueduct 4.0 country rankings (xlsx, country_baseline)
//   wdi_*         World Bank WDI through the public indicators API
//
// This module must not import ./fetcher (the fetcher imports it).
import JSZip from "jszip";
import * as XLSX from "xlsx";

export type SourceObs = {
  country: string;
  year: number;
  rank: number | null;
  score: number | null;
  total: number | null;
  sourceUrl: string;
};

/** Some publishers refuse the default client string; these hosts get a
    browser one. Read-only public data files only. */
export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
export const NEEDS_BROWSER_UA = /(^|\.)(gain\.nd\.edu|wri\.org)$/i;

function rankByValue(
  rows: { key: string; value: number }[],
  higherIsBetter: boolean
): Map<string, number> {
  const sorted = [...rows].sort((a, b) => (higherIsBetter ? b.value - a.value : a.value - b.value));
  const out = new Map<string, number>();
  let lastValue = Number.NaN;
  let lastRank = 0;
  sorted.forEach((x, i) => {
    const rank = x.value === lastValue ? lastRank : i + 1;
    lastValue = x.value;
    lastRank = rank;
    out.set(x.key, rank);
  });
  return out;
}

/** Turns a country x year table of values into observations with derived
    ranks per year. */
function withDerivedRanks(
  byYear: Map<number, { country: string; value: number }[]>,
  higherIsBetter: boolean,
  sourceUrl: string,
  digits = 4
): SourceObs[] {
  const out: SourceObs[] = [];
  for (const [year, list] of byYear) {
    const ranks = rankByValue(
      list.map((x) => ({ key: x.country, value: x.value })),
      higherIsBetter
    );
    for (const x of list) {
      out.push({
        country: x.country,
        year,
        rank: ranks.get(x.country) ?? null,
        score: Math.round(x.value * 10 ** digits) / 10 ** digits,
        total: list.length,
        sourceUrl,
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* ND-GAIN                                                              */
/* ------------------------------------------------------------------ */

export const GAIN_DOWNLOAD_PAGE = "https://gain.nd.edu/our-work/country-index/download-data/";
/** Known edition, used when the download page cannot be read. */
export const GAIN_FALLBACK_URL = "https://gain.nd.edu/assets/647440/ndgain_countryindex_2026.zip";

/** Finds the current country-index zip link on the publisher's download page. */
export function findGainZipUrl(html: string): string | null {
  const m = /href="([^"]*ndgain_countryindex_\d{4}\.zip)"/i.exec(html);
  if (!m) return null;
  return new URL(m[1], "https://gain.nd.edu").toString();
}

export async function parseNdGain(buf: Buffer, sourceUrl: string): Promise<SourceObs[]> {
  const zip = await JSZip.loadAsync(buf);
  const entry = Object.values(zip.files).find(
    (f) => !f.dir && !f.name.startsWith("__MACOSX") && /(^|\/)gain\/gain\.csv$/i.test(f.name)
  );
  if (!entry) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(
    XLSX.read(await entry.async("string"), { type: "string" }).Sheets.Sheet1,
    { header: 1 }
  ) as unknown[][];
  const header = (rows[0] ?? []).map((c) => String(c ?? "").trim());
  const iIso = header.indexOf("ISO3");
  if (iIso === -1) return [];
  const byYear = new Map<number, { country: string; value: number }[]>();
  header.forEach((h, col) => {
    if (!/^\d{4}$/.test(h)) return;
    const year = Number(h);
    for (const r of rows.slice(1)) {
      const iso = String(r[iIso] ?? "").trim();
      const value = typeof r[col] === "number" ? (r[col] as number) : Number.NaN;
      if (!/^[A-Z]{3}$/.test(iso) || !Number.isFinite(value)) continue;
      (byYear.get(year) ?? byYear.set(year, []).get(year)!).push({ country: iso, value });
    }
  });
  return withDerivedRanks(byYear, true, sourceUrl, 3);
}

/* ------------------------------------------------------------------ */
/* WRI Aqueduct 4.0 (baseline water stress)                             */
/* ------------------------------------------------------------------ */

export const AQUEDUCT_URL = "https://files.wri.org/aqueduct/aqueduct-4-0-country-rankings.zip";
/** The 4.0 release of July 2023; the baseline period is 1979 to 2019. */
export const AQUEDUCT_RELEASE_YEAR = 2023;

export async function parseAqueduct(buf: Buffer): Promise<SourceObs[]> {
  const zip = await JSZip.loadAsync(buf);
  const entry = Object.values(zip.files).find((f) => !f.dir && /\.xlsx$/i.test(f.name));
  if (!entry) return [];
  const wb = XLSX.read(await entry.async("nodebuffer"), { type: "buffer" });
  const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["country_baseline"], {
    header: 1,
  }) as unknown[][];
  const header = (grid[0] ?? []).map((c) => String(c ?? "").trim());
  const iIso = header.indexOf("gid_0");
  const iInd = header.indexOf("indicator_name");
  const iWeight = header.indexOf("weight");
  const iScore = header.indexOf("score");
  if ([iIso, iInd, iWeight, iScore].some((i) => i === -1)) return [];
  const list: { country: string; value: number }[] = [];
  for (const r of grid.slice(1)) {
    // baseline water stress, weighted by total water demand
    if (r[iInd] !== "bws" || r[iWeight] !== "Tot") continue;
    const iso = String(r[iIso] ?? "").trim();
    const value = r[iScore];
    if (/^[A-Z]{3}$/.test(iso) && typeof value === "number" && value >= 0) {
      list.push({ country: iso, value });
    }
  }
  // 0 to 5, a HIGHER score is more stress, so rank 1 is the least stressed
  return withDerivedRanks(new Map([[AQUEDUCT_RELEASE_YEAR, list]]), false, AQUEDUCT_URL);
}

/* ------------------------------------------------------------------ */
/* World Bank WDI                                                       */
/* ------------------------------------------------------------------ */

export const WB_COUNTRIES_URL = "https://api.worldbank.org/v2/country?format=json&per_page=400";
export const wdiUrl = (wb: string, fromYear: number, toYear: number) =>
  `https://api.worldbank.org/v2/country/all/indicator/${wb}?format=json&per_page=20000&date=${fromYear}:${toYear}`;
export const wdiPage = (wb: string) => `https://data.worldbank.org/indicator/${wb}`;

/** The WDI series that become index records: index code -> WDI code and the
    direction used to derive ranks. */
export const WDI_SERIES: Record<string, { wb: string; higherIsBetter: boolean }> = {
  wdi_freshwater_withdrawal: { wb: "ER.H2O.FWTL.ZS", higherIsBetter: false },
  wdi_basic_water: { wb: "SH.H2O.BASW.ZS", higherIsBetter: true },
  wdi_water_per_capita: { wb: "ER.H2O.INTR.PC", higherIsBetter: true },
  wdi_food_production: { wb: "AG.PRD.FOOD.XD", higherIsBetter: true },
  wdi_cereal_yield: { wb: "AG.YLD.CREL.KG", higherIsBetter: true },
  wdi_protected_land: { wb: "ER.LND.PTLD.ZS", higherIsBetter: true },
  wdi_forest_area: { wb: "AG.LND.FRST.ZS", higherIsBetter: true },
  wdi_renewables_share: { wb: "EG.FEC.RNEW.ZS", higherIsBetter: true },
  wdi_ghg_per_capita: { wb: "EN.GHG.ALL.PC.CE.AR5", higherIsBetter: false },
  wdi_pm25: { wb: "EN.ATM.PM25.MC.M3", higherIsBetter: false },
};

/** ISO3 codes of real countries (aggregates such as WLD carry region "NA"). */
export function parseWbCountries(json: unknown): Set<string> {
  const out = new Set<string>();
  const rows = Array.isArray(json) ? (json[1] as unknown) : null;
  if (!Array.isArray(rows)) return out;
  for (const c of rows as { id?: string; region?: { id?: string } }[]) {
    if (c?.id && /^[A-Z]{3}$/.test(c.id) && c.region?.id && c.region.id !== "NA") out.add(c.id);
  }
  return out;
}

export function parseWdi(
  json: unknown,
  wb: string,
  countries: Set<string>,
  higherIsBetter: boolean
): SourceObs[] {
  const rows = Array.isArray(json) ? (json[1] as unknown) : null;
  if (!Array.isArray(rows)) return [];
  const byYear = new Map<number, { country: string; value: number }[]>();
  for (const r of rows as { countryiso3code?: string; date?: string; value?: number | null }[]) {
    const iso = String(r?.countryiso3code ?? "");
    const year = Number(r?.date);
    if (!countries.has(iso) || !Number.isFinite(year) || typeof r.value !== "number") continue;
    (byYear.get(year) ?? byYear.set(year, []).get(year)!).push({ country: iso, value: r.value });
  }
  return withDerivedRanks(byYear, higherIsBetter, wdiPage(wb));
}
