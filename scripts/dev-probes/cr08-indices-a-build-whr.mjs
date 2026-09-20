/* eslint-disable no-console */
// CR08 4.1 (indices research agent A): World Happiness Report rankings from
// the publisher's WHR 2026 "Data for Figure 2.1 (2011-2025)" workbook, which
// carries the ranking of every edition (file year + 1 = report edition; the
// life evaluation is the average of the three preceding years). The edition
// files WHR 2020 to 2025 are cross-checked against it and any mismatch is
// printed; observations cite the WHR 2026 file they were read from.
import fs from "node:fs";
import { dl, readGrid, headerIndex, num, round, isoOf, unmappedNames, writeResearch } from "./cr08-indices-a-lib.mjs";

const MAIN_URL = "https://files.worldhappiness.report/WHR26_Data_Figure_2.1.xlsx";
const grid = readGrid(dl("whr26.xlsx"));
const header = grid[0].map((h) => String(h ?? "").trim());
const iYear = headerIndex(header, "Year");
const iRank = headerIndex(header, "Rank");
const iName = headerIndex(header, "Country name");
const iScore = headerIndex(header, (h) => /^Life evaluation/.test(h));
const byYear = new Map();
for (const r of grid.slice(1)) {
  const y = num(r[iYear]);
  const rank = num(r[iRank]);
  const score = num(r[iScore]);
  if (y == null || rank == null || score == null) continue;
  const iso = isoOf(r[iName]);
  if (!iso) continue;
  if (!byYear.has(y)) byYear.set(y, []);
  byYear.get(y).push({ iso, name: String(r[iName]), rank, score });
}

const obs = [];
for (const [y, list] of byYear) {
  const total = Math.max(...list.map((x) => x.rank));
  for (const x of list) {
    obs.push({ country: x.iso, year: y + 1, rank: x.rank, score: round(x.score, 3), total_countries: total, source_url: MAIN_URL, status: "fetched", data_year: y });
  }
}

/* cross-check the edition files */
const EDITIONS = [
  { edition: 2025, file: "whr25.xlsx", url: "https://files.worldhappiness.report/WHR25_Data_Figure_2.1v3.xlsx", nameCol: "Country name", scoreCol: /^Life evaluation/, yearCol: "Year", rankCol: "Rank" },
  { edition: 2024, file: "whr24.xls", url: "https://files.worldhappiness.report/WHR24_Data_Figure_2.1.xls", nameCol: "Country name", scoreCol: /^Ladder score$/ },
  { edition: 2023, file: "whr23.xls", url: "https://files.worldhappiness.report/WHR23_Data_Figure_2.1.xls", nameCol: "Country name", scoreCol: /^Ladder score$/ },
  { edition: 2022, file: "whr22.xls", url: "https://files.worldhappiness.report/WHR22_Data_Figure_2.1.xls", nameCol: "Country", scoreCol: /^Happiness score$/, rankCol: "RANK" },
  { edition: 2021, file: "whr21.xls", url: "https://files.worldhappiness.report/WHR21_Data_Figure_2.1.xls", nameCol: "Country name", scoreCol: /^Ladder score$/ },
  { edition: 2020, file: "whr20.xls", url: "https://files.worldhappiness.report/WHR20_Data_Figure_2.1.xls", nameCol: "Country name", scoreCol: /^Ladder score$/ },
];
const checks = [];
for (const ed of EDITIONS) {
  if (!fs.existsSync(dl(ed.file))) {
    checks.push(`${ed.edition}: file missing`);
    continue;
  }
  const g = readGrid(dl(ed.file));
  const h = g[0].map((x) => String(x ?? "").trim());
  const iN = headerIndex(h, ed.nameCol);
  const iS = headerIndex(h, (x) => ed.scoreCol.test(x));
  const iY = ed.yearCol ? headerIndex(h, ed.yearCol) : -1;
  if (iN < 0 || iS < 0) {
    checks.push(`${ed.edition}: columns not found (${h.slice(0, 5).join(" | ")})`);
    continue;
  }
  const main = new Map(obs.filter((o) => o.year === ed.edition).map((o) => [o.country, o]));
  let n = 0;
  let mism = 0;
  let missing = 0;
  const examples = [];
  for (const r of g.slice(1)) {
    if (iY >= 0 && num(r[iY]) !== ed.edition - 1) continue;
    const score = num(r[iS]);
    if (score == null) continue;
    const iso = isoOf(r[iN]);
    if (!iso) continue;
    n++;
    const m = main.get(iso);
    if (!m) {
      missing++;
      if (examples.length < 4) examples.push(`${iso} absent in 2026 file`);
      continue;
    }
    if (Math.abs(m.score - score) > 0.0015) {
      mism++;
      if (examples.length < 4) examples.push(`${iso} ${round(score, 3)} vs ${m.score}`);
    }
  }
  checks.push(`${ed.edition}: ${n} rows in the edition file, ${mism} score mismatches, ${missing} not in the 2026 file${examples.length ? " (" + examples.join("; ") + ")" : ""}`);
}
for (const c of checks) console.log("WHR check " + c);
if (unmappedNames().length) console.log("WHR unmapped names: " + unmappedNames().join(" | "));

writeResearch(
  {
    code: "happiness",
    name_en: "World Happiness Report",
    publisher: "Wellbeing Research Centre, University of Oxford (World Happiness Report)",
    publisher_url: "https://worldhappiness.report/",
    scale: "both",
    score_min: 0,
    score_max: 10,
    higher_is_better: true,
    methodology_summary_en:
      "National average of the Cantril ladder life evaluation (0 worst to 10 best possible life) from the Gallup World Poll, averaged over the three years preceding each report, with the ranking of every country surveyed. Annual.",
  },
  obs,
  {
    notes:
      "Year = report edition (the file's data year + 1; the value averages the three years ending in the data year, kept in the non-standard field data_year). Every edition's ranking is read from the publisher's WHR 2026 Figure 2.1 data file, which lists the ranking of each year since 2011. Cross-checks against the edition files: " +
      checks.join("; ") +
      ". Qatar was last surveyed for the 2019 edition (rank 29 of 156, 6.374) and has not appeared since: Gallup has not polled Qatar for the report's window. Northern Cyprus and the Somaliland region carry no ISO3 code and are skipped.",
  }
);
