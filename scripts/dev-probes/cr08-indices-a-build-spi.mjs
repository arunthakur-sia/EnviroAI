/* eslint-disable no-console */
// CR08 4.1 (indices research agent A): the Social Progress Index. The 2025
// AlTi Global Social Progress Index report PDF prints the full ranking
// (Figure 39, 170 countries, rank + score); the 2026 edition publishes its
// ranking only as an image and behind premium access, so the 2026 rows are
// the ranks the publisher's press release states, rank only.
import fs from "node:fs";
import { dl, round, isoOf, unmappedNames, writeResearch } from "./cr08-indices-a-lib.mjs";

const URL_2025 =
  "https://cdn.prod.website-files.com/6650cb66e461b93f1a906cf2/67bfb2f98d970886cd20224a_2025%20AlTi%20Global%20Social%20Progress%20Index-%20report.pdf";
const URL_2026_PRESS = "https://www.socialprogress.org/post/new-report-reveals-stagnation-in-global-social-progress-press-release";

const text = fs.readFileSync(dl("spi-2025-report.pdf.txt"), "utf8").split(/\r?\n/);
const start = text.findIndex((l) => /^1 Norway 9\d\.\d\d/.test(l));
const end = text.findIndex((l, i) => i > start && /^170 South Sudan/.test(l));
if (start < 0 || end < 0) throw new Error(`SPI 2025 table not found (${start}, ${end})`);
const found = new Map();
const re = /(\d{1,3}) ([A-Za-z][A-Za-z ,'&().À-ſ-]*?) (\d{1,3}\.\d{2})(?=\s|$)/g;
for (const line of text.slice(start, end + 1)) {
  const clean = line.replace(/[ï¨„©-]+/g, " ").replace(/\s+/g, " ").trim();
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(clean))) {
    const rank = Number(m[1]);
    const name = m[2].trim();
    const score = Number(m[3]);
    if (rank < 1 || rank > 170) continue;
    if (!found.has(rank)) found.set(rank, { name, score });
  }
}
const missing = [];
for (let r = 1; r <= 170; r++) if (!found.has(r)) missing.push(r);
console.log(`SPI 2025: ${found.size} ranks parsed${missing.length ? ", missing ranks " + missing.join(",") : ""}`);

const obs = [];
for (const [rank, { name, score }] of found) {
  const iso = isoOf(name);
  if (!iso) continue;
  obs.push({ country: iso, year: 2025, rank, score: round(score, 2), total_countries: 170, source_url: URL_2025, status: "fetched" });
}
if (unmappedNames().length) console.log("SPI unmapped: " + unmappedNames().join(" | "));

// 2026: ranks stated in the publisher's press release (scores not published openly)
const press2026 = [
  ["NOR", 1, 91.73],
  ["IRL", 8, null],
  ["DEU", 11, null],
  ["AUS", 13, null],
  ["JPN", 14, null],
  ["SGP", 15, null],
  ["SVN", 16, null],
  ["EST", 17, null],
  ["GBR", 18, null],
  ["NZL", 19, null],
  ["CAN", 22, null],
  ["USA", 32, null],
  ["CHL", 36, null],
  ["BRA", 51, null],
  ["MUS", 56, null],
  ["CHN", 73, null],
  ["RUS", 77, null],
];
for (const [iso, rank, score] of press2026) {
  obs.push({ country: iso, year: 2026, rank, score, total_countries: 171, source_url: URL_2026_PRESS, status: "fetched" });
}

writeResearch(
  {
    code: "social_progress",
    name_en: "Social Progress Index",
    publisher: "Social Progress Imperative",
    publisher_url: "https://www.socialprogress.org/social-progress-index",
    scale: "both",
    score_min: 0,
    score_max: 100,
    higher_is_better: true,
    methodology_summary_en:
      "Aggregates 57 social and environmental outcome indicators (no economic inputs) into three dimensions, Basic Human Needs, Foundations of Wellbeing and Opportunity, scored 0 to 100 for about 170 countries. Annual; the 2025 edition was published as the AlTi Global Social Progress Index.",
  },
  obs,
  {
    notes:
      "2025: full ranking (170 countries) read from Figure 39 of the publisher's 2025 report PDF. 2026: the publisher shows the ranking as an image and sells the dataset through premium access; only the ranks stated in the 15 January 2026 press release are stored (rank only, scores not openly published except Norway's), so the GCC states have no 2026 row. Editions before 2025 sit behind the publisher's premium access and are not stored (the countryeconomy.com compiler carries them but is a secondary source).",
  }
);
