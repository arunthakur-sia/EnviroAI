/* eslint-disable no-console */
// CR08 4.1 (indices research agent A): Gallup World Poll measures from
// Gallup's public reports (text extracted locally from the official PDFs on
// gallup.com/file/analytics/...). Year = the survey year Gallup labels the
// series with (the report edition is one year later).
//   gallup_law_order  full country tables: Law and Order reports 2019-2023,
//                     Global Safety reports 2024-2025 (data 2018-2024)
//   gallup_safe_night "feel safe walking alone at night" %: the full 2024
//                     table in the 2025 Global Safety report, plus the
//                     highest/lowest lists of the earlier reports
//   gallup_positive / gallup_negative  the highest/lowest lists of the
//                     Global Emotions reports 2019-2024 (Gallup prints no
//                     full tables; the interactive carries no text)
//   gallup_life_eval  Qatar's thriving share from Gallup's GCC article
// Gallup's reports since 2019 do not list Qatar at all: Qatar stays missing.
import fs from "node:fs";
import { dl, isoOf, unmappedNames, writeResearch } from "./cr08-indices-a-lib.mjs";

const FILE = "https://www.gallup.com/file/analytics/";
const LAW = [
  { report: 2019, year: 2018, file: "gallup-law-2019.pdf.txt", url: FILE + "267896/2019_Global_Law_and_Order_Report.pdf", heading: /^Law and Order Index Score Results for 2018/ },
  { report: 2020, year: 2019, file: "gallup-law-2020.pdf.txt", url: FILE + "322256/Gallup_Global_Law_and_Order_2020_Report.pdf", heading: /^Law and Order Index Scores$/, last: true },
  { report: 2021, year: 2020, file: "gallup-law-2021.pdf.txt", url: FILE + "357173/2021_Global_Law_and_Order_Report.pdf", heading: /^Law and Order Index Scores for 2020/ },
  { report: 2022, year: 2021, file: "gallup-law-2022.pdf.txt", url: FILE + "403964/2022_Global_Law_and_Order_Report.pdf", heading: /^Law and Order Index Scores for 2021/ },
  { report: 2023, year: 2022, file: "gallup-law-2023.pdf.txt", url: FILE + "513407/2023_Global_Law_and_Order_Report.pdf", heading: /^Law and Order Index Scores for 2022/ },
  { report: 2024, year: 2023, file: "gallup-safety-2024.pdf.txt", url: FILE + "650768/Gallup_Global-Safety-Report-2024.pdf", heading: /^Law and Order Index Scores for 2023$/, last: true },
  { report: 2025, year: 2024, file: "gallup-safety-2025.pdf.txt", url: FILE + "695138/Gallup_Global-Safety-Report-2025.pdf", heading: /^Law and Order Index Scores, 2024/, endHeading: /Safe to Walk Alone at Night/ },
];
const EMOTIONS = [
  { report: 2019, year: 2018, file: "gallup-emotions-2019.pdf.txt", url: FILE + "248909/Gallup_2019_Global_Emotions_Report.pdf" },
  { report: 2020, year: 2019, file: "gallup-emotions-2020.pdf.txt", url: FILE + "324209/Gallup_Global_Emotions_2020_Report.pdf" },
  { report: 2021, year: 2020, file: "gallup-emotions-2021.pdf.txt", url: FILE + "352337/Gallup_Global_Emotions_2021_Report.pdf" },
  { report: 2022, year: 2021, file: "gallup-emotions-2022b.pdf.txt", url: FILE + "393977/Gallup%202022%20Global%20Emotions%20Report.pdf" },
  { report: 2023, year: 2022, file: "gallup-emotions-2023.pdf.txt", url: FILE + "507719/Gallup%202023%20Global%20Emotions%20Report.pdf" },
  { report: 2024, year: 2023, file: "gallup-emotions-2024.pdf.txt", url: FILE + "646109/Global%20Emotions_2024%20Report.pdf" },
];

const ROW = /^(.+?) (\d{1,3})%?(?:Copyright.*)?$/;
const JUNK = /^(G L O B A L|Copyright|Global Law and Order|The Global Safety Report|GALLUP|===== PAGE|Country|COUNTRY|Index|Law and Order|ORDE R|Analytics|Learn more|Page)/i;

function readLines(name) {
  return fs.readFileSync(dl(name), "utf8").split(/\r?\n/);
}

/** A wrapped name ("United Kingdom of Great" / "Britain and Northern Ireland 88") is joined with the previous line. */
function fullName(lines, i, name) {
  if (isoOf(name) !== null || i === 0) return name;
  const prev = lines[i - 1].trim();
  if (!prev || ROW.test(prev) || JUNK.test(prev)) return name;
  const joined = `${prev} ${name}`.replace(/\s+/g, " ");
  return isoOf(joined) !== null ? joined : name;
}

/** Every "Name N" row between a heading and an end (or the file end). */
function tableRows(lines, from, to) {
  const rows = [];
  for (let i = from; i < to; i++) {
    const l = lines[i].trim();
    if (!l || JUNK.test(l)) continue;
    const m = ROW.exec(l);
    if (!m) continue;
    const v = Number(m[2]);
    if (v < 0 || v > 100) continue;
    rows.push({ name: fullName(lines, i, m[1].trim()), value: v, line: i + 1 });
  }
  return rows;
}

/** The rows of a short list that follows a heading (stops at the first non-row after the list starts). */
function listRows(lines, headingIdx) {
  const rows = [];
  let started = false;
  for (let i = headingIdx + 1; i < Math.min(lines.length, headingIdx + 40); i++) {
    const l = lines[i].trim();
    const m = ROW.exec(l);
    const name = m ? fullName(lines, i, m[1].trim()) : "";
    const ok = m && !JUNK.test(l) && Number(m[2]) <= 100 && isoOf(name);
    if (ok) {
      started = true;
      rows.push({ name, value: Number(m[2]), line: i + 1 });
      if (/Copyright/.test(l)) break;
    } else if (started) break;
  }
  return rows;
}

function findHeading(lines, re, last) {
  let idx = -1;
  lines.forEach((l, i) => {
    if (re.test(l.trim()) && (last || idx < 0)) idx = i;
  });
  return idx;
}

const law = [];
const safe = new Map(); // key iso:year -> obs
const lawNotes = [];
for (const src of LAW) {
  const lines = readLines(src.file);
  const h = findHeading(lines, src.heading, src.last);
  if (h < 0) throw new Error(`${src.report}: law heading not found`);
  const end = src.endHeading ? lines.findIndex((l, i) => i > h && src.endHeading.test(l)) : lines.length;
  const rows = tableRows(lines, h + 1, end);
  const seen = new Set();
  let n = 0;
  for (const r of rows) {
    const iso = isoOf(r.name);
    if (!iso || seen.has(iso)) continue;
    seen.add(iso);
    n++;
    law.push({ country: iso, year: src.year, rank: null, score: r.value, total_countries: null, source_url: src.url, status: "fetched", report_edition: src.report });
  }
  for (const o of law) if (o.year === src.year) o.total_countries = n;
  lawNotes.push(`${src.year}: ${n} countries from the ${src.report} report`);
  console.log(`Law and Order ${src.year}: ${n} countries (table at line ${h + 1}${src.endHeading ? " to " + end : ""})`);

  // feel-safe percentages
  if (src.endHeading && end > 0) {
    const pct = tableRows(lines, end + 1, lines.length);
    const seen2 = new Set();
    for (const r of pct) {
      const iso = isoOf(r.name);
      if (!iso || seen2.has(iso)) continue;
      seen2.add(iso);
      safe.set(`${iso}:${src.year}`, { country: iso, year: src.year, rank: null, score: r.value, total_countries: null, source_url: src.url, status: "fetched", report_edition: src.report, basis: "full table" });
    }
    for (const o of safe.values()) if (o.year === src.year) o.total_countries = seen2.size;
    console.log(`Feel safe ${src.year}: ${seen2.size} countries from the full table`);
  }
  let listed = 0;
  lines.forEach((l, i) => {
    if (!/(Safest|Least Safe) Walking Alone/i.test(l)) return;
    for (const r of listRows(lines, i)) {
      const iso = isoOf(r.name);
      const key = `${iso}:${src.year}`;
      if (!iso || safe.has(key)) continue;
      safe.set(key, { country: iso, year: src.year, rank: null, score: r.value, total_countries: null, source_url: src.url, status: "fetched", report_edition: src.report, basis: "highest/lowest list" });
      listed++;
    }
  });
  if (listed) console.log(`Feel safe ${src.year}: ${listed} countries from the highest/lowest lists`);
}

// Gallup emotions lists
const pos = [];
const neg = [];
for (const src of EMOTIONS) {
  const lines = readLines(src.file);
  const seenP = new Set();
  const seenN = new Set();
  lines.forEach((l, i) => {
    // the 2019 report breaks the heading over two lines ("Highest Positive" / "Experiences Worldwide")
    const two = `${l.trim()} ${(lines[i + 1] ?? "").trim()}`;
    const one = /(Highest|Lowest) (Positive|Negative) Experiences Worldwide/i.exec(l);
    const m = one ?? /(Highest|Lowest) (Positive|Negative) Experiences Worldwide/i.exec(two);
    if (!m) return;
    const target = /positive/i.test(m[2]) ? pos : neg;
    const seen = /positive/i.test(m[2]) ? seenP : seenN;
    for (const r of listRows(lines, one ? i : i + 1)) {
      const iso = isoOf(r.name);
      if (!iso || seen.has(iso)) continue;
      seen.add(iso);
      target.push({ country: iso, year: src.year, rank: null, score: r.value, total_countries: null, source_url: src.url, status: "fetched", report_edition: src.report, basis: `${m[1].toLowerCase()} list` });
    }
  });
  console.log(`Emotions ${src.year}: ${seenP.size} positive, ${seenN.size} negative from the lists`);
}

if (unmappedNames().length) console.log("Gallup unmapped: " + unmappedNames().join(" | "));

const gallup = { publisher: "Gallup", higher_is_better: true, score_min: 0, score_max: 100, scale: "score" };

writeResearch(
  {
    code: "gallup_law_order",
    name_en: "Gallup Law and Order Index",
    ...gallup,
    publisher_url: "https://www.gallup.com/analytics/356963/gallup-global-law-and-order-report.aspx",
    methodology_summary_en:
      "Composite 0 to 100 score from four Gallup World Poll questions: confidence in the local police, feeling safe walking alone at night, and whether money or property was stolen or the respondent was assaulted in the past year. Higher means more of the population feels secure. Annual, about 140 countries.",
  },
  law,
  {
    notes:
      "Full country tables read from the official report PDFs (Gallup Global Law and Order reports 2019 to 2023 and Global Safety reports 2024 and 2025). Year = the survey year Gallup labels the scores with; the report edition is in report_edition. Gallup publishes no ranks. Qatar does not appear in any of these reports (Gallup has not published World Poll results for Qatar in this period), so Qatar has no observation. " +
      lawNotes.join("; ") + ".",
  }
);

writeResearch(
  {
    code: "gallup_safe_night",
    name_en: "Gallup: Feel Safe Walking Alone at Night",
    ...gallup,
    publisher_url: "https://www.gallup.com/analytics/356996/gallup-global-safety-research-center.aspx",
    methodology_summary_en:
      "Share of adults answering yes to 'Do you feel safe walking alone at night in the city or area where you live?' in the Gallup World Poll, the indicator Gallup reports for SDG 16. Annual, about 140 countries.",
  },
  [...safe.values()],
  {
    notes:
      "2024 (2025 Global Safety Report): the full published table. Earlier years: only the countries Gallup listed among the highest and lowest in each report (the field is not printed in full), marked basis = highest/lowest list. Qatar is not listed in any report.",
  }
);

writeResearch(
  {
    code: "gallup_positive",
    name_en: "Gallup Positive Experience Index",
    ...gallup,
    publisher_url: "https://www.gallup.com/analytics/349280/state-of-worlds-emotional-health.aspx",
    methodology_summary_en:
      "Mean share of yes answers to five questions about the previous day (felt well-rested, treated with respect, smiled or laughed a lot, learned or did something interesting, experienced enjoyment), 0 to 100. Annual Global Emotions report.",
  },
  pos,
  {
    notes:
      "Gallup's Global Emotions reports print only the highest and lowest countries per year (no full table; the interactive page carries the data as graphics). Stored: every country in those lists, 2018 to 2023 survey years. Qatar is not listed in any edition.",
  }
);

writeResearch(
  {
    code: "gallup_negative",
    name_en: "Gallup Negative Experience Index",
    ...gallup,
    higher_is_better: false,
    publisher_url: "https://www.gallup.com/analytics/349280/state-of-worlds-emotional-health.aspx",
    methodology_summary_en:
      "Mean share of yes answers to five questions about the previous day (physical pain, worry, sadness, stress, anger), 0 to 100; lower is better. Annual Global Emotions report.",
  },
  neg,
  {
    notes:
      "Gallup's Global Emotions reports print only the highest and lowest countries per year (no full table). Stored: every country in those lists, 2018 to 2023 survey years. Qatar is not listed in any edition.",
  }
);

writeResearch(
  {
    code: "gallup_life_eval",
    name_en: "Gallup Life Evaluation Index (thriving)",
    ...gallup,
    publisher_url: "https://www.gallup.com/394505/indicator-life-evaluation-index.aspx",
    methodology_summary_en:
      "Share of adults classified as thriving: rating their current life 7 or higher and their life in five years 8 or higher on the 0 to 10 Cantril ladder, Gallup World Poll.",
  },
  [
    { country: "QAT", year: 2010, rank: null, score: 56, total_countries: null, source_url: "https://news.gallup.com/poll/157064/life-evaluations-gcc-subjective-wellbeing-health.aspx", status: "fetched", basis: "Qatari nationals, surveys February to December 2010; women 64%, men 44%" },
  ],
  {
    notes:
      "Gallup publishes the Life Evaluation Index by country only inside its paid World Poll; the only Qatar figure on Gallup's public pages is the 56% of Qatari nationals thriving in 2010 (Gallup, Life Evaluations in the GCC, 2012). No later Qatar value is published: Gallup has not fielded the World Poll in Qatar since the early 2010s.",
  }
);
