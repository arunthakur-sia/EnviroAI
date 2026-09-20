/* eslint-disable no-console */
// CR08 4.1 (indices research agent A): the UNDP Gender Inequality Index from
// the HDR 2025 composite time series CSV the CR05 fetcher already downloads
// to sources/indices/raw/hdi-timeseries.csv (columns gii_<year> and
// gii_rank_2023). Lower is better. Ranks for years other than 2023 are
// derived by sorting the official values (the HDI precedent, DECISIONS 67).
import fs from "node:fs";
import path from "node:path";
import { parseCsv, num, deriveRanks, round, writeResearch } from "./cr08-indices-a-lib.mjs";

const URL = "https://hdr.undp.org/sites/default/files/2025_HDR/HDR25_Composite_indices_complete_time_series.csv";
const file = path.join(process.cwd(), "sources", "indices", "raw", "hdi-timeseries.csv");
const rows = parseCsv(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
const header = rows[0];
const iIso = header.indexOf("iso3");
const iCode = header.indexOf("hdicode");
const iRank23 = header.indexOf("gii_rank_2023");
const yearCols = [];
header.forEach((h, i) => {
  const m = /^gii_(\d{4})$/.exec(h);
  if (m && Number(m[1]) >= 2010) yearCols.push({ year: Number(m[1]), idx: i });
});
const countries = rows.slice(1).filter((r) => /^[A-Z]{3}$/.test(r[iIso] ?? "") && (r[iCode] ?? "") !== "");
const obs = [];
for (const { year, idx } of yearCols) {
  const list = countries
    .map((r) => ({ iso: r[iIso], score: num(r[idx]), pubRank: year === 2023 && iRank23 >= 0 ? num(r[iRank23]) : null }))
    .filter((x) => x.score != null);
  const derived = deriveRanks(list, false);
  for (const x of list) {
    obs.push({ country: x.iso, year, rank: x.pubRank ?? derived.get(x.iso), score: round(x.score, 3), total_countries: list.length, source_url: URL, status: "fetched" });
  }
}
writeResearch(
  {
    code: "gender_inequality",
    name_en: "Gender Inequality Index",
    publisher: "UNDP",
    publisher_url: "https://hdr.undp.org/data-center/thematic-composite-indices/gender-inequality-index",
    scale: "both",
    score_min: 0,
    score_max: 1,
    higher_is_better: false,
    methodology_summary_en:
      "Composite of reproductive health (maternal mortality, adolescent births), empowerment (parliamentary seats, secondary education by sex) and labour market participation by sex; 0 means women and men fare equally, 1 the worst inequality. Annual, published with the Human Development Report.",
  },
  obs,
  {
    rank_basis: "The 2023 rank is the published gii_rank_2023; ranks for earlier years are derived by sorting the official values ascending (ties share a rank), as the fetcher does for HDI.",
    notes: "HDR 2025 composite indices time series (data years 2010 to 2023), the same publisher file the CR05 fetcher parses for HDI; values stored to three decimals as the report prints them.",
  }
);
