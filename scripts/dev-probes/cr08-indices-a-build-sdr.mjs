/* eslint-disable no-console */
// CR08 4.1 (indices research agent A): the SDG Index (overall) and the 17
// goal scores from the Sustainable Development Report databases, editions
// 2020 to 2026, full ranked field. Goal scores come from the edition's own
// data sheet where it carries "Goal N Score" columns, otherwise from the
// edition's "Backdated SDG Index" sheet at the row whose index score equals
// the edition headline (the backdated series' last year is the edition).
// SDSN publishes no goal-level ranks: goal ranks are derived by sorting the
// official goal scores (ties share a rank), the HDI precedent of DECISIONS 67.
import { dl, readGrid, headerIndex, num, deriveRanks, round, writeResearch, HOME_ISO3 } from "./cr08-indices-a-lib.mjs";

const EDITIONS = [
  { year: 2026, file: "sdr-database_2026.xlsx", sheet: "SDR2026 Data", url: "https://dashboards.sdgindex.org/static/downloads/database_2026.xlsx" },
  { year: 2025, file: "sdr2025-wb.xlsx", sheet: "SDR2025 Data", url: "https://web.archive.org/web/20260220073322id_/https://dashboards.sdgindex.org/static/downloads/files/SDR2025-data.xlsx" },
  { year: 2024, file: "sdr2024-wb.xlsx", sheet: "Full Database", url: "https://web.archive.org/web/20250306123822id_/https://dashboards.sdgindex.org/static/downloads/files/SDR2024-data.xlsx" },
  { year: 2023, file: "sdr2023-wb.xlsx", sheet: "SDR 2023 Data", url: "https://web.archive.org/web/20240209052203id_/https://dashboards.sdgindex.org/static/downloads/files/SDR2023-data.xlsx" },
  { year: 2022, file: "sdr2022-wb1.xlsx", sheet: "SDR2022 Data", url: "https://web.archive.org/web/20230124200810id_/https://dashboards.sdgindex.org/static/downloads/files/SDR-2022-Database.xlsx" },
  { year: 2021, file: "sdr2021-gh.xlsx", sheet: "SDR2021 Data", url: "https://raw.githubusercontent.com/sdsna/SDR2021/main/SDR%202021%20-%20Database.xlsx" },
  { year: 2020, file: "sdr2020.xlsx", sheet: "SDR2020 Data", url: "https://sdsna.github.io/SDR2020/SDR2020Database.xlsx" },
];

const GOALS = [
  ["No Poverty", "القضاء على الفقر"],
  ["Zero Hunger", "القضاء التام على الجوع"],
  ["Good Health and Well-being", "الصحة الجيدة والرفاه"],
  ["Quality Education", "التعليم الجيد"],
  ["Gender Equality", "المساواة بين الجنسين"],
  ["Clean Water and Sanitation", "المياه النظيفة والنظافة الصحية"],
  ["Affordable and Clean Energy", "طاقة نظيفة وبأسعار معقولة"],
  ["Decent Work and Economic Growth", "العمل اللائق ونمو الاقتصاد"],
  ["Industry, Innovation and Infrastructure", "الصناعة والابتكار والهياكل الأساسية"],
  ["Reduced Inequalities", "الحد من أوجه عدم المساواة"],
  ["Sustainable Cities and Communities", "مدن ومجتمعات محلية مستدامة"],
  ["Responsible Consumption and Production", "الاستهلاك والإنتاج المسؤولان"],
  ["Climate Action", "العمل المناخي"],
  ["Life Below Water", "الحياة تحت الماء"],
  ["Life on Land", "الحياة في البر"],
  ["Peace, Justice and Strong Institutions", "السلام والعدل والمؤسسات القوية"],
  ["Partnerships for the Goals", "عقد الشراكات لتحقيق الأهداف"],
];

const indexObs = [];
const goalObs = Array.from({ length: 17 }, () => []);
const editionNotes = [];

for (const ed of EDITIONS) {
  const grid = readGrid(dl(ed.file), ed.sheet);
  const header = grid[0].map((h) => String(h ?? "").trim());
  const iIso = headerIndex(header, (h) => /^(Country Code ISO3|id)$/i.test(h.trim()));
  const iScore = headerIndex(header, (h) => /^\d{4} SDG Index Score$/.test(h.trim()));
  const iRank = headerIndex(header, (h) => /^\d{4} SDG Index Rank$/.test(h.trim()));
  if (iIso < 0 || iScore < 0 || iRank < 0) throw new Error(`${ed.year}: columns not found (${iIso},${iScore},${iRank})`);
  const goalCols = new Map();
  header.forEach((h, i) => {
    const m = /^Goal (\d{1,2}) Score$/.exec(h);
    if (m) goalCols.set(Number(m[1]), i);
  });
  const rows = grid
    .slice(1)
    .filter((r) => /^[A-Z]{3}$/.test(String(r[iIso] ?? "")))
    .map((r) => ({ iso: String(r[iIso]), score: num(r[iScore]), rank: num(r[iRank]), raw: r }));
  const ranked = rows.filter((r) => r.score != null && r.rank != null);
  const total = ranked.length;
  for (const r of ranked) {
    indexObs.push({ country: r.iso, year: ed.year, rank: r.rank, score: round(r.score, 2), total_countries: total, source_url: ed.url, status: "fetched" });
  }

  // goal scores
  let goalSource = "";
  const goalScores = new Map(); // iso -> number[17]
  if (goalCols.size === 17) {
    goalSource = `data sheet "${ed.sheet}" Goal N Score columns`;
    for (const r of ranked) goalScores.set(r.iso, Array.from({ length: 17 }, (_, g) => num(r.raw[goalCols.get(g + 1)])));
  } else {
    let back;
    try {
      back = readGrid(dl(ed.file), "Backdated SDG Index");
    } catch {
      back = null;
    }
    if (back) {
      const bh = back[0].map((h) => String(h ?? "").trim());
      const bIso = headerIndex(bh, (h) => /^(Country Code ISO3|id)$/i.test(h.trim()));
      const bYear = headerIndex(bh, (h) => /^year$/i.test(h.trim()));
      const bScore = headerIndex(bh, (h) => /^(sdgi_s|SDG Index Score)$/i.test(h.trim()));
      const bGoal = new Map();
      bh.forEach((h, i) => {
        const m = /^(?:goal|Goal )(\d{1,2})(?: Score)?$/.exec(h);
        if (m) bGoal.set(Number(m[1]), i);
      });
      if (bGoal.size === 17 && bIso >= 0 && bYear >= 0 && bScore >= 0) {
        const headline = new Map(ranked.map((r) => [r.iso, r.score]));
        let matched = 0;
        let byMaxYear = 0;
        const latest = new Map();
        for (const r of back.slice(1)) {
          const iso = String(r[bIso] ?? "");
          if (!headline.has(iso)) continue;
          const y = num(r[bYear]);
          const s = num(r[bScore]);
          if (y == null) continue;
          if (s != null && Math.abs(s - headline.get(iso)) < 1e-6) {
            goalScores.set(iso, Array.from({ length: 17 }, (_, g) => num(r[bGoal.get(g + 1)])));
            matched++;
          }
          const cur = latest.get(iso);
          if (!cur || y > cur.y) latest.set(iso, { y, row: r });
        }
        for (const [iso, { row }] of latest) {
          if (goalScores.has(iso)) continue;
          goalScores.set(iso, Array.from({ length: 17 }, (_, g) => num(row[bGoal.get(g + 1)])));
          byMaxYear++;
        }
        goalSource = `Backdated SDG Index sheet (${matched} countries matched on the headline score, ${byMaxYear} taken at the sheet's latest year)`;
      } else {
        goalSource = `no goal scores (backdated sheet lacks goal columns: ${bGoal.size})`;
      }
    } else {
      goalSource = "no goal scores (no Goal N Score columns, no backdated sheet)";
    }
  }
  editionNotes.push(`${ed.year}: ${total} ranked countries; goals from ${goalSource}`);
  const home = ranked.find((r) => r.iso === HOME_ISO3);
  console.log(`SDR ${ed.year}: ${total} ranked; ${HOME_ISO3} ${home ? `${round(home.score, 2)} rank ${home.rank}` : "absent"}; goals: ${goalSource}`);

  for (let g = 0; g < 17; g++) {
    const list = [];
    for (const [iso, arr] of goalScores) if (arr[g] != null) list.push({ iso, score: arr[g] });
    if (!list.length) continue;
    const ranks = deriveRanks(list, true);
    for (const x of list) {
      goalObs[g].push({ country: x.iso, year: ed.year, rank: ranks.get(x.iso), score: round(x.score, 2), total_countries: list.length, source_url: ed.url, status: "fetched" });
    }
  }
}

const common = {
  publisher: "SDSN Sustainable Development Report",
  publisher_url: "https://dashboards.sdgindex.org/",
  higher_is_better: true,
};

writeResearch(
  {
    code: "sdg_index",
    name_en: "SDG Index",
    ...common,
    scale: "both",
    score_min: 0,
    score_max: 100,
    methodology_summary_en:
      "Overall score of the SDG Index of the Sustainable Development Report (SDSN): the unweighted average of the 17 goal scores, each an average of normalized indicators on a 0 to 100 scale where 100 is the SDG target, over all UN member states with sufficient data. Ranks as published per edition.",
  },
  indexObs,
  {
    notes:
      "Editions 2020 to 2026, full ranked field from the publisher's edition databases: 2026 from the live dashboards download, 2022 to 2025 from Wayback Machine copies of the publisher's own edition files (the live site only serves the current edition; the id_ raw copies are cited as read), 2021 from the SDSN GitHub repository, 2020 from sdsna.github.io. Year is the edition year. Scores are stored to two decimals as the report prints them. " +
      editionNotes.join(" "),
  }
);

for (let g = 0; g < 17; g++) {
  const n = g + 1;
  const code = `sdg_${String(n).padStart(2, "0")}`;
  writeResearch(
    {
      code,
      name_en: `SDG ${n}: ${GOALS[g][0]}`,
      name_ar: `الهدف ${n}: ${GOALS[g][1]}`,
      sdg_goal: n,
      ...common,
      scale: "score",
      score_min: 0,
      score_max: 100,
      methodology_summary_en: `Goal ${n} score of the SDG Index (Sustainable Development Report, SDSN): the average of the goal's normalized indicators on a 0 to 100 scale, 100 meaning the SDG target is met.`,
    },
    goalObs[g],
    {
      rank_basis:
        "SDSN publishes no goal-level ranks; ranks here are derived by sorting the official goal scores of the edition (ties share a rank), the same derivation DECISIONS 67 accepted for HDI.",
      notes: "Editions 2020 to 2026, year = edition year, full field of countries with a published goal score. " + editionNotes.join(" "),
    }
  );
}
