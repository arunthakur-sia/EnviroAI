/* eslint-disable no-console */
// CR08 4.1 (indices research agent A): validates every research file this
// agent produced (sources/indices/research/cr08-*.json for its codes):
// parses as JSON, has the CR05 shape, every observation carries a
// source_url, an ISO3 country, a year and a rank or score; then prints a
// coverage table (markdown) per index. Exits 1 on any failure.
// Usage: node scripts/dev-probes/cr08-indices-a-validate.mjs [--table]
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "sources", "indices", "research");
const CODES = [
  "sdg_index",
  ...Array.from({ length: 17 }, (_, i) => `sdg_${String(i + 1).padStart(2, "0")}`),
  "gallup_law_order", "gallup_safe_night", "gallup_positive", "gallup_negative", "gallup_life_eval",
  "gender_inequality", "gender_gap", "happiness", "social_progress",
  "wgi_voice", "wgi_stability", "wgi_effectiveness", "wgi_regulatory", "wgi_rule_of_law", "wgi_corruption",
];
const FOCUS = ["QAT", "SAU", "ARE", "KWT", "BHR", "OMN", "USA", "GBR", "SGP", "KOR", "TUR", "EGY", "JOR", "MAR", "DEU", "FRA", "JPN", "CHN", "IND"];

let failures = 0;
const fail = (msg) => {
  failures++;
  console.error("FAIL " + msg);
};
const rows = [];
for (const code of CODES) {
  const file = path.join(DIR, `cr08-${code}.json`);
  if (!fs.existsSync(file)) {
    fail(`${code}: file missing`);
    continue;
  }
  const raw = fs.readFileSync(file, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) fail(`${code}: BOM present`);
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    fail(`${code}: unparseable JSON: ${String(e)}`);
    continue;
  }
  if (data.code !== code) fail(`${code}: code field is ${data.code}`);
  for (const k of ["name_en", "publisher", "publisher_url", "scale", "score_min", "score_max", "higher_is_better", "methodology_summary_en"]) {
    if (data[k] === undefined) fail(`${code}: meta field ${k} missing`);
  }
  if (!Array.isArray(data.observations) || !data.observations.length) {
    fail(`${code}: no observations`);
    continue;
  }
  const keys = new Set();
  const urls = new Set();
  const years = new Set();
  const countries = new Set();
  const perFocus = new Map(FOCUS.map((c) => [c, []]));
  for (const o of data.observations) {
    if (typeof o.source_url !== "string" || !/^https?:\/\//.test(o.source_url)) fail(`${code}: observation without source_url ${JSON.stringify(o)}`);
    if (!/^[A-Z]{3}$/.test(String(o.country))) fail(`${code}: bad country ${JSON.stringify(o)}`);
    if (!Number.isInteger(o.year) || o.year < 2000 || o.year > 2030) fail(`${code}: bad year ${JSON.stringify(o)}`);
    if (o.rank == null && o.score == null) fail(`${code}: neither rank nor score ${JSON.stringify(o)}`);
    if (o.rank != null && (!Number.isInteger(o.rank) || o.rank < 1)) fail(`${code}: bad rank ${JSON.stringify(o)}`);
    if (o.score != null && typeof o.score === "number") {
      if (o.score < data.score_min - 1e-9 || o.score > data.score_max + 1e-9) fail(`${code}: score out of scale ${JSON.stringify(o)}`);
    }
    if (o.total_countries != null && o.rank != null && o.rank > o.total_countries) fail(`${code}: rank above total ${JSON.stringify(o)}`);
    const key = `${o.country}:${o.year}`;
    if (keys.has(key)) fail(`${code}: duplicate ${key}`);
    keys.add(key);
    urls.add(o.source_url);
    years.add(o.year);
    countries.add(o.country);
    if (perFocus.has(o.country)) perFocus.get(o.country).push(o.year);
  }
  const ys = [...years].sort((a, b) => a - b);
  const qat = perFocus.get("QAT").sort((a, b) => a - b);
  const missingFocus = FOCUS.filter((c) => !perFocus.get(c).length);
  const partialFocus = FOCUS.filter((c) => perFocus.get(c).length && perFocus.get(c).length < ys.length).map((c) => `${c} ${perFocus.get(c).length}/${ys.length}`);
  rows.push({
    code,
    obs: data.observations.length,
    years: ys.length > 1 ? `${ys[0]} to ${ys[ys.length - 1]} (${ys.length})` : String(ys[0]),
    countries: countries.size,
    qatar: qat.length ? (qat.length === ys.length ? "all years" : qat.join(", ")) : "none",
    missingFocus,
    partialFocus,
    urls: [...urls],
  });
  console.log(`ok ${code}: ${data.observations.length} obs, ${countries.size} countries, years ${ys[0]}-${ys[ys.length - 1]}, Qatar ${qat.length ? qat.length + " years" : "none"}, ${urls.size} source URL(s)`);
}

if (process.argv.includes("--table")) {
  console.log("");
  console.log("| Index | Observations | Years | Countries | Qatar | Focus countries missing | Focus countries partial |");
  console.log("|---|---|---|---|---|---|---|");
  for (const r of rows) {
    console.log(`| ${r.code} | ${r.obs} | ${r.years} | ${r.countries} | ${r.qatar} | ${r.missingFocus.join(", ") || "none"} | ${r.partialFocus.join(", ") || "none"} |`);
  }
  console.log("");
  console.log("URLs per index:");
  for (const r of rows) console.log(`- ${r.code}: ${r.urls.join(" ; ")}`);
}

if (failures) {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
console.log(`all ${CODES.length} research files valid`);
