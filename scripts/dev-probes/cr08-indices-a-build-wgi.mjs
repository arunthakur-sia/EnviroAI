/* eslint-disable no-console */
// CR08 4.1 (indices research agent A): the six Worldwide Governance
// Indicators (World Bank, 2025 update, 1996-2024) from the official
// workbook, full field. Score = the published percentile rank (0-100).
// The World Bank publishes no ordinal rank: the rank stored is derived by
// sorting the published governance estimate within the year (the ordering
// the percentile rank itself expresses).
import { dl, readGrid, headerIndex, num, deriveRanks, round, writeResearch, WB_CODE_FIX } from "./cr08-indices-a-lib.mjs";

const URL = "https://www.worldbank.org/content/dam/sites/govindicators/doc/wgidataset_with_sourcedata-2025.xlsx";
const FROM_YEAR = 2010;

const DIMS = [
  { sheet: "va", code: "wgi_voice", name: "WGI: Voice and Accountability", desc: "perceptions of the extent to which citizens can participate in selecting their government, plus freedom of expression, association and a free media" },
  { sheet: "pv", code: "wgi_stability", name: "WGI: Political Stability and Absence of Violence", desc: "perceptions of the likelihood of political instability and politically motivated violence, including terrorism" },
  { sheet: "ge", code: "wgi_effectiveness", name: "WGI: Government Effectiveness", desc: "perceptions of the quality of public services and the civil service, its independence from political pressure, and the credibility of policy commitment" },
  { sheet: "rq", code: "wgi_regulatory", name: "WGI: Regulatory Quality", desc: "perceptions of the government's ability to formulate and implement sound policies and regulations that permit and promote private sector development" },
  { sheet: "rl", code: "wgi_rule_of_law", name: "WGI: Rule of Law", desc: "perceptions of confidence in and abidance by the rules of society, contract enforcement, property rights, the police and the courts, and the likelihood of crime and violence" },
  { sheet: "cc", code: "wgi_corruption", name: "WGI: Control of Corruption", desc: "perceptions of the extent to which public power is exercised for private gain, including petty and grand corruption and state capture" },
];

for (const d of DIMS) {
  const grid = readGrid(dl("wgi-2025.xlsx"), d.sheet);
  const header = grid[0].map((h) => String(h ?? "").trim());
  const iCode = headerIndex(header, "Economy (code)");
  const iYear = headerIndex(header, "Year");
  const iEst = headerIndex(header, (h) => /^Governance estimate/.test(h));
  const iPct = headerIndex(header, (h) => /^Governance score \(0-100\)/.test(h));
  if ([iCode, iYear, iEst, iPct].some((i) => i < 0)) throw new Error(`${d.sheet}: columns missing`);
  const byYear = new Map();
  for (const r of grid.slice(1)) {
    const code = WB_CODE_FIX[String(r[iCode] ?? "")] ?? String(r[iCode] ?? "");
    if (!/^[A-Z]{3}$/.test(code)) continue;
    const year = num(r[iYear]);
    const est = num(r[iEst]);
    const pct = num(r[iPct]);
    if (year == null || year < FROM_YEAR || est == null || pct == null) continue;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push({ iso: code, est, pct });
  }
  const obs = [];
  for (const [year, list] of byYear) {
    const ranks = deriveRanks(list.map((x) => ({ iso: x.iso, score: x.est })), true);
    for (const x of list) {
      obs.push({ country: x.iso, year, rank: ranks.get(x.iso), score: round(x.pct, 2), total_countries: list.length, source_url: URL, status: "fetched", estimate: round(x.est, 3) });
    }
  }
  writeResearch(
    {
      code: d.code,
      name_en: d.name,
      publisher: "World Bank",
      publisher_url: "https://www.worldbank.org/en/publication/worldwide-governance-indicators",
      scale: "score",
      score_min: 0,
      score_max: 100,
      higher_is_better: true,
      methodology_summary_en: `Worldwide Governance Indicators, ${d.name.replace("WGI: ", "")}: ${d.desc}. Aggregates many data sources with an unobserved-components model; the published percentile rank (0 lowest to 100 highest) is the score stored here, the estimate (about -2.5 to +2.5) is kept in the non-standard field 'estimate'.`,
    },
    obs,
    {
      rank_basis:
        "The World Bank publishes percentile ranks, not ordinal ranks; the rank stored is derived by sorting the published governance estimate within each year over all economies in the file (ties share a rank).",
      notes:
        `Official 2025 update workbook (years ${FROM_YEAR} to 2024 stored; the file starts in 1996). Non-ISO World Bank codes are mapped (ADO to AND, ZAR to COD, ROM to ROU, TMP to TLS, WBG to PSE, KSV to XKX, IMY to IMN). The 2025 update carries data through 2024; there is no 2025 data year yet.`,
    }
  );
}
