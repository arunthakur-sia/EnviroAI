/* eslint-disable no-console */
// CR08 4.1 (indices research agent A): shared helpers for the research-file
// builders. Every builder reads publisher files that were downloaded with
// curl.exe (Windows certificate store, the path DECISIONS 67 recorded for
// EGDI) into the directory named by CR08_DL, parses them locally and writes
// sources/indices/research/cr08-<code>.json in the shape the CR05 research
// files use (see wjp.extracted.json). Nothing here fetches the network.
//
// Downloads (all public, all read with curl.exe -L, a browser user agent for
// weforum.org; the Wayback id_ copies come back gzip-encoded and are
// decompressed with cr08-indices-a-gunzip.mjs):
//   SDR 2026  https://dashboards.sdgindex.org/static/downloads/database_2026.xlsx
//   SDR 2025  https://web.archive.org/web/20260220073322id_/https://dashboards.sdgindex.org/static/downloads/files/SDR2025-data.xlsx
//   SDR 2024  https://web.archive.org/web/20250306123822id_/https://dashboards.sdgindex.org/static/downloads/files/SDR2024-data.xlsx
//   SDR 2023  https://web.archive.org/web/20240209052203id_/https://dashboards.sdgindex.org/static/downloads/files/SDR2023-data.xlsx
//   SDR 2022  https://web.archive.org/web/20230124200810id_/https://dashboards.sdgindex.org/static/downloads/files/SDR-2022-Database.xlsx
//   SDR 2021  https://raw.githubusercontent.com/sdsna/SDR2021/main/SDR%202021%20-%20Database.xlsx
//   SDR 2020  https://sdsna.github.io/SDR2020/SDR2020Database.xlsx
//   WGI 2025  https://www.worldbank.org/content/dam/sites/govindicators/doc/wgidataset_with_sourcedata-2025.xlsx
//   WHR 2026  https://files.worldhappiness.report/WHR26_Data_Figure_2.1.xlsx (plus WHR20-25 edition files for cross-checks)
//   WEF GGGR  https://reports.weforum.org/docs/WEF_GGGR_2025.pdf and https://www3.weforum.org/docs/WEF_GGGR_<2021..2024>.pdf
//   Gallup    https://www.gallup.com/file/analytics/<id>/<report>.pdf (Law and Order 2019-2023, Global Safety 2024-2025, Global Emotions 2019-2024, Emotional Health 2025)
//   SPI 2025  https://cdn.prod.website-files.com/6650cb66e461b93f1a906cf2/67bfb2f98d970886cd20224a_2025%20AlTi%20Global%20Social%20Progress%20Index-%20report.pdf
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const XLSX = require("xlsx");

export const DL = process.env.CR08_DL || path.join(process.cwd(), "sources", "indices", "dl");
export const OUT = path.join(process.cwd(), "sources", "indices", "research");

// The home country of the Indices module. Mirrors HOME_ISO3 in
// src/server/indices/home.ts (plain JavaScript cannot import TypeScript):
// keep the two equal.
export const HOME_ISO3 = "SAU";

export const FOCUS = [
  HOME_ISO3, "ARE", "KWT", "BHR", "OMN", "USA", "GBR", "SGP", "KOR", "TUR",
  "EGY", "JOR", "MAR", "DEU", "FRA", "JPN", "CHN", "IND", "AUS",
];

export function dl(name) {
  return path.join(DL, name);
}

export function readGrid(file, sheetName) {
  const wb = XLSX.read(fs.readFileSync(file), { type: "buffer" });
  const ws = wb.Sheets[sheetName ?? wb.SheetNames[0]];
  if (!ws) throw new Error(`sheet "${sheetName}" missing in ${path.basename(file)} (${wb.SheetNames.join(", ")})`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
}

export function headerIndex(header, test) {
  const i = header.findIndex((h) => (typeof test === "string" ? String(h ?? "").trim() === test : test(String(h ?? ""))));
  return i;
}

export function num(v) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Ranks by sorting; ties share a rank; returns Map iso -> rank. */
export function deriveRanks(list, higherIsBetter = true) {
  const sorted = [...list]
    .filter((x) => Number.isFinite(x.score))
    .sort((a, b) => (higherIsBetter ? b.score - a.score : a.score - b.score));
  const out = new Map();
  let lastScore = null;
  let lastRank = 0;
  sorted.forEach((x, i) => {
    const rank = x.score === lastScore ? lastRank : i + 1;
    lastScore = x.score;
    lastRank = rank;
    out.set(x.iso, rank);
  });
  return out;
}

export function round(v, d = 3) {
  return v == null ? null : Math.round(v * 10 ** d) / 10 ** d;
}

/* ---------------- country names to ISO3 ---------------- */

export function normName(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the /, "");
}

// World Bank codes that are not ISO 3166-1 alpha-3
export const WB_CODE_FIX = {
  ADO: "AND", ZAR: "COD", ROM: "ROU", TMP: "TLS", WBG: "PSE", KSV: "XKX", IMY: "IMN",
};

const ALIASES = {
  "turkey": "TUR", "turkiye": "TUR", "republic of turkiye": "TUR",
  "south korea": "KOR", "korea rep": "KOR", "korea republic of": "KOR", "republic of korea": "KOR", "korea": "KOR",
  "north korea": "PRK", "korea dem people s rep": "PRK", "korea dem rep": "PRK",
  "russia": "RUS", "russian federation": "RUS",
  "iran": "IRN", "iran islamic republic of": "IRN", "iran islamic rep": "IRN",
  "laos": "LAO", "lao pdr": "LAO", "lao people s democratic republic": "LAO",
  "vietnam": "VNM", "viet nam": "VNM",
  "syria": "SYR", "syrian arab republic": "SYR",
  "venezuela": "VEN", "venezuela rb": "VEN", "venezuela bolivarian republic of": "VEN",
  "bolivia": "BOL", "bolivia plurinational state of": "BOL",
  "tanzania": "TZA", "united republic of tanzania": "TZA",
  "moldova": "MDA", "republic of moldova": "MDA",
  "eswatini": "SWZ", "swaziland": "SWZ",
  "north macedonia": "MKD", "macedonia": "MKD", "macedonia fyr": "MKD",
  "gambia": "GMB", "gambia the": "GMB",
  "united states": "USA", "united states of america": "USA", "usa": "USA",
  "united kingdom": "GBR", "uk": "GBR", "united kingdom of great britain and northern ireland": "GBR",
  "gambia republic of the": "GMB", "gambia republic of": "GMB",
  "bolivia plurinational state of": "BOL", "iran islamic republic of": "IRN", "united republic of tanzania": "TZA",
  "micronesia federated states of": "FSM", "moldova republic of": "MDA", "tanzania united republic of": "TZA",
  "lao people s democratic republic": "LAO", "lao people s dem rep": "LAO", "lao pdr": "LAO",
  "myanmar": "MMR", "burma": "MMR",
  "czechia": "CZE", "czech republic": "CZE",
  "ivory coast": "CIV", "cote d ivoire": "CIV", "cote divoire": "CIV",
  "congo kinshasa": "COD", "democratic republic of the congo": "COD", "congo dem rep": "COD", "dr congo": "COD", "congo democratic republic of the": "COD",
  "congo brazzaville": "COG", "republic of the congo": "COG", "congo rep": "COG", "congo": "COG", "congo republic of the": "COG", "republic of congo": "COG",
  "democratic republic of congo": "COD", "congo democratic republic": "COD", "congo dr": "COD",
  "state of palestine": "PSE", "palestinian territories": "PSE", "palestine": "PSE", "west bank and gaza": "PSE", "palestine state of": "PSE",
  "taiwan province of china": "TWN", "taiwan": "TWN", "taiwan china": "TWN",
  "hong kong s a r of china": "HKG", "hong kong": "HKG", "hong kong sar china": "HKG", "hong kong sar": "HKG", "hong kong s a r china": "HKG", "hong kong sar of china": "HKG", "hong kong s a r": "HKG",
  "republic of north macedonia": "MKD", "north macedonia republic of": "MKD",
  "taiwan province of china 1": "TWN", "taiwan republic of china": "TWN",
  "macao sar china": "MAC", "macao": "MAC",
  "kosovo": "XKX",
  "egypt": "EGY", "egypt arab rep": "EGY",
  "brunei": "BRN", "brunei darussalam": "BRN",
  "cabo verde": "CPV", "cape verde": "CPV",
  "kyrgyzstan": "KGZ", "kyrgyz republic": "KGZ",
  "slovakia": "SVK", "slovak republic": "SVK",
  "bahamas": "BHS", "bahamas the": "BHS",
  "yemen": "YEM", "yemen rep": "YEM",
  "micronesia": "FSM", "micronesia fed sts": "FSM", "micronesia federated states of": "FSM",
  "saint lucia": "LCA", "st lucia": "LCA",
  "saint kitts and nevis": "KNA", "st kitts and nevis": "KNA",
  "saint vincent and the grenadines": "VCT", "st vincent and the grenadines": "VCT",
  "sao tome and principe": "STP",
  "timor leste": "TLS", "east timor": "TLS",
  "trinidad and tobago": "TTO",
  "bosnia and herzegovina": "BIH",
  "united arab emirates": "ARE", "uae": "ARE",
  "saudi arabia": "SAU",
  "south sudan": "SSD",
  "cyprus": "CYP",
  "libya": "LBY",
  "somalia": "SOM",
  "puerto rico": "PRI",
  "curacao": "CUW",
  "sint maarten dutch part": "SXM",
  "virgin islands u s": "VIR",
  "st martin french part": "MAF",
  "eswatini kingdom of": "SWZ",
  "the netherlands": "NLD", "netherlands": "NLD",
  "luxembourg": "LUX",
  "chinese taipei": "TWN",
  "guinea bissau": "GNB",
  "equatorial guinea": "GNQ",
  "papua new guinea": "PNG",
  "central african republic": "CAF",
  "dominican republic": "DOM",
  "el salvador": "SLV",
  "costa rica": "CRI",
  "sri lanka": "LKA",
  "new zealand": "NZL",
  "burkina faso": "BFA",
  "sierra leone": "SLE",
  "solomon islands": "SLB",
  "marshall islands": "MHL",
  "antigua and barbuda": "ATG",
  "south africa": "ZAF",
  "north cyprus": null, "northern cyprus": null, "somaliland region": null, "somaliland": null,
  "kosovo under unscr 1244": "XKX",
};

let lookup = null;
function buildLookup() {
  lookup = new Map();
  const add = (name, iso) => {
    const k = normName(name);
    if (k && !lookup.has(k)) lookup.set(k, iso);
  };
  // SDR 2026 database: 193 UN member states with ISO3
  try {
    const grid = readGrid(dl("sdr-database_2026.xlsx"), "SDR2026 Data");
    for (const r of grid.slice(1)) if (/^[A-Z]{3}$/.test(String(r[0] ?? ""))) add(r[1], r[0]);
  } catch (e) {
    console.warn("lookup: SDR 2026 database unavailable: " + String(e));
  }
  // WGI 2025: 200+ economies with World Bank codes
  try {
    const grid = readGrid(dl("wgi-2025.xlsx"), "va");
    for (const r of grid.slice(1)) {
      const code = WB_CODE_FIX[r[2]] ?? String(r[2] ?? "");
      if (/^[A-Z]{3}$/.test(code)) add(r[1], code);
    }
  } catch (e) {
    console.warn("lookup: WGI workbook unavailable: " + String(e));
  }
  for (const [k, v] of Object.entries(ALIASES)) lookup.set(k, v);
}

const unmapped = new Set();
export function isoOf(name) {
  if (!lookup) buildLookup();
  const k = normName(name);
  if (lookup.has(k)) return lookup.get(k);
  // "Korea, Rep." style: strip the trailing qualifier after a comma
  const k2 = normName(String(name).split(",")[0]);
  if (lookup.has(k2)) return lookup.get(k2);
  unmapped.add(String(name));
  return null;
}
export function unmappedNames() {
  return [...unmapped].sort();
}

/* ---------------- CSV ---------------- */

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else cur += ch;
  }
  if (cur !== "" || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

/* ---------------- research file writer ---------------- */

/**
 * Writes sources/indices/research/cr08-<code>.json, one observation per line,
 * in the CR05 research-file shape. `meta` holds code, name_en, publisher,
 * publisher_url, scale, score_min, score_max, higher_is_better,
 * methodology_summary_en; `extra` (optional) adds pillars / notes.
 */
export function writeResearch(meta, observations, extra = {}) {
  for (const o of observations) {
    if (!o.source_url) throw new Error(`${meta.code}: observation without source_url ${JSON.stringify(o)}`);
    if (!/^[A-Z]{3}$/.test(o.country)) throw new Error(`${meta.code}: bad country ${JSON.stringify(o)}`);
    if (o.rank == null && o.score == null) throw new Error(`${meta.code}: empty observation ${JSON.stringify(o)}`);
  }
  const sorted = [...observations].sort((a, b) =>
    a.country === b.country ? a.year - b.year : FOCUS.indexOf(b.country) - FOCUS.indexOf(a.country) || a.country.localeCompare(b.country)
  );
  const head = Object.entries(meta).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  const obs = sorted.map((o) => "    " + JSON.stringify(o));
  const tail = Object.entries(extra).map(([k, v]) => {
    if (k === "pillars" && Array.isArray(v)) {
      return `  "pillars": [\n${v.map((p) => "    " + JSON.stringify(p)).join(",\n")}\n  ]`;
    }
    return `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`;
  });
  const parts = [...head, `  "observations": [\n${obs.join(",\n")}\n  ]`, ...tail];
  const text = "{\n" + parts.join(",\n") + "\n}\n";
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `cr08-${meta.code}.json`);
  fs.writeFileSync(file, text, { encoding: "utf8" });
  const home = sorted.filter((o) => o.country === HOME_ISO3).map((o) => o.year);
  console.log(
    `${path.basename(file)}: ${sorted.length} observations, ${new Set(sorted.map((o) => o.country)).size} countries, years ${Math.min(...sorted.map((o) => o.year))}-${Math.max(...sorted.map((o) => o.year))}, ${HOME_ISO3} ${home.length ? home.join(",") : "none"}`
  );
  return file;
}
