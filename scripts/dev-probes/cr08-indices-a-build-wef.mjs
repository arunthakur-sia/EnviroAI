/* eslint-disable no-console */
// CR08 4.1 (indices research agent A): the Global Gender Gap Index (WEF)
// from the text of the official report PDFs, editions 2021 to 2025, full
// field. 2021 to 2024 come from Table 1.1 (the global rankings table); the
// 2025 PDF renders Table 1.1 as vector graphics that carry no text, so its
// values are read from the regional ranking tables of the same report, which
// print every economy with its regional rank, global rank and score.
import fs from "node:fs";
import { dl, round, isoOf, unmappedNames, writeResearch } from "./cr08-indices-a-lib.mjs";

const EDITIONS = [
  { year: 2025, file: "gggr2025.pdf.txt", url: "https://reports.weforum.org/docs/WEF_GGGR_2025.pdf", total: 148, mode: "regional" },
  { year: 2024, file: "gggr2024.pdf.txt", url: "https://www3.weforum.org/docs/WEF_GGGR_2024.pdf", total: 146, mode: "bar" },
  { year: 2023, file: "gggr2023.pdf.txt", url: "https://www3.weforum.org/docs/WEF_GGGR_2023.pdf", total: 146, mode: "bar" },
  { year: 2022, file: "gggr2022.pdf.txt", url: "https://www3.weforum.org/docs/WEF_GGGR_2022.pdf", total: 146, mode: "bar" },
  { year: 2021, file: "gggr2021.pdf.txt", url: "https://www3.weforum.org/docs/WEF_GGGR_2021.pdf", total: 156, mode: "comma" },
];

const obs = [];
const notes = [];
for (const ed of EDITIONS) {
  const lines = fs.readFileSync(dl(ed.file), "utf8").split(/\r?\n/);
  const found = new Map(); // rank -> {name, score, line}
  // a name that wraps onto two lines leaves its first half on the previous
  // line ("Bolivia (Plurinational" / "State of) 12 48 0.747"): join them
  const fullName = (name, i) => {
    const clean = name.replace(/\*+$/, "").trim();
    if (isoOf(clean) !== null || i === 0) return clean;
    const prev = (lines[i - 1] ?? "").trim().replace(/^\d{1,3} /, "");
    const joined = `${prev} ${clean}`.replace(/\s+/g, " ");
    return prev && !/\d\.\d{3}/.test(prev) && isoOf(joined) !== null ? joined : clean;
  };
  const put = (rank, name, score, i) => {
    if (rank < 1 || rank > ed.total) return;
    if (!found.has(rank)) found.set(rank, { name: fullName(name, i), score, line: i + 1 });
  };
  if (ed.mode === "bar") {
    const re = /^(\d{1,3}) (.+?)\s*\*?\s*(\d\.\d{3}) █/u;
    lines.forEach((l, i) => {
      const m = re.exec(l);
      if (m) put(Number(m[1]), m[2], Number(m[3]), i);
    });
  } else if (ed.mode === "comma") {
    const start = lines.findIndex((l) => /^1 Iceland 0,892/.test(l));
    const end = lines.findIndex((l, i) => i > start && /^156 /.test(l));
    const re = /^(\d{1,3}) (.+?)\*? (\d,\d{3}) (\d,\d{3}|n\/a|–|-)/u;
    for (let i = start; i <= end; i++) {
      const m = re.exec(lines[i]);
      if (m) put(Number(m[1]), m[2], Number(m[3].replace(",", ".")), i);
    }
  } else {
    const re = /^(\p{L}[\p{L} ,'().-]*?)\*?\s+(\d{1,3}) (\d{1,3}) (\d\.\d{3})$/u;
    lines.forEach((l, i) => {
      const m = re.exec(l.trim());
      if (m) put(Number(m[3]), m[1], Number(m[4]), i);
    });
  }
  const missing = [];
  for (let r = 1; r <= ed.total; r++) if (!found.has(r)) missing.push(r);
  const span = [...found.values()].map((v) => v.line);
  const msg = `GGGR ${ed.year}: ${found.size}/${ed.total} ranks (lines ${Math.min(...span)}-${Math.max(...span)})${missing.length ? ", missing ranks " + missing.join(",") : ""}`;
  console.log(msg);
  notes.push(msg);
  for (const [rank, v] of found) {
    const iso = isoOf(v.name);
    if (!iso) continue;
    obs.push({ country: iso, year: ed.year, rank, score: round(v.score, 3), total_countries: ed.total, source_url: ed.url, status: "fetched" });
  }
  const q = [...found.entries()].find(([, v]) => /^Qatar/.test(v.name));
  console.log(`  Qatar ${q ? `rank ${q[0]} score ${q[1].score}` : "not in this edition"}`);
}
if (unmappedNames().length) console.log("GGGR unmapped: " + unmappedNames().join(" | "));

writeResearch(
  {
    code: "gender_gap",
    name_en: "Global Gender Gap Index",
    publisher: "World Economic Forum",
    publisher_url: "https://www.weforum.org/publications/series/global-gender-gap-report/",
    scale: "both",
    score_min: 0,
    score_max: 1,
    higher_is_better: true,
    methodology_summary_en:
      "Benchmarks the gap between women and men across four subindexes (economic participation and opportunity, educational attainment, health and survival, political empowerment) on a 0 to 1 scale where 1 is parity; about 146 economies, annual.",
  },
  obs,
  {
    notes:
      "Official report PDFs, text extracted locally. 2021 to 2024 from Table 1.1 (global rankings); 2025 from the report's regional ranking tables (economy, regional rank, global rank, score) because Table 1.1 of the 2025 PDF is drawn as graphics without text. Qatar is covered 2021 to 2024 and is absent from the 2025 edition (148 economies): WEF did not include it. " +
      notes.join(" "),
  }
);
