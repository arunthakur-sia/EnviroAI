// CR05 4.3: real index data. Direct publisher files where they exist (HDI,
// CPI, EPI, LPI), plus the observations gathered from publisher reports and
// pages by the research pass under sources/indices/research/ (each value
// carries the URL it was read from). Never invents a number: what cannot be
// found stays missing and the coverage report says so. Raw files land under
// sources/indices/raw/ with a manifest; the report at data/indices-report.md.
// Runs from scripts/fetch-indices.ts, npm run setup, and the indices_fetch job
// (Settings > Indices > Refresh data).
import fs from "node:fs";
import path from "node:path";
import { fetch as undiciFetch, Agent } from "undici";
import * as XLSX from "xlsx";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { newId, nowIso } from "@/lib/ids";
import { CR08_INDEX_DEFS, type Cr08IndexDef } from "./defs-cr08";

// The corporate proxy re-signs public sites (DECISIONS 8/23): these are
// read-only public data files, so verification is relaxed for them only.
const insecureDispatcher = new Agent({ connect: { rejectUnauthorized: false } });

/* ------------------------------------------------------------------ */
/* scope                                                                */
/* ------------------------------------------------------------------ */

export type IndexDef = {
  code: string;
  nameEn: string;
  nameAr: string;
  publisher: string;
  publisherUrl: string;
  methodologyEn: string;
  methodologyAr: string;
  scale: "rank" | "score" | "both";
  scoreMin: number;
  scoreMax: number;
  higherIsBetter: boolean;
  frequency: string;
  category: "economy" | "governance" | "society" | "environment" | "technology" | "human";
  responsibleEntityName: string; // matched against the entities register
  linkedTargetKeywords: string[]; // matched against NDS3 target titles
  sourceNotes: string;
};

/** The twelve CR05 indices. */
export const CR05_INDEX_DEFS: IndexDef[] = [
  {
    code: "hdi",
    nameEn: "Human Development Index",
    nameAr: "مؤشر التنمية البشرية",
    publisher: "UNDP",
    publisherUrl: "https://hdr.undp.org/",
    methodologyEn:
      "Geometric mean of normalized indices for health (life expectancy), education (expected and mean years of schooling) and standard of living (GNI per capita, PPP). Annual; the 2025 report carries data through 2023.",
    methodologyAr:
      "متوسط هندسي لمؤشرات معيارية للصحة (العمر المتوقع) والتعليم (سنوات الدراسة المتوقعة والفعلية) ومستوى المعيشة (نصيب الفرد من الدخل القومي الإجمالي). يصدر سنويًا، وتغطي نسخة 2025 بيانات عام 2023.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 1,
    higherIsBetter: true,
    frequency: "annual",
    category: "human",
    responsibleEntityName: "Ministry of Social Development and Family",
    linkedTargetKeywords: ["human", "quality of life", "wellbeing"],
    sourceNotes:
      "Bulk CSV from the HDR data center (HDR25 composite time series). Ranks for non-latest years are derived by sorting the official values.",
  },
  {
    code: "gii",
    nameEn: "Global Innovation Index",
    nameAr: "مؤشر الابتكار العالمي",
    publisher: "WIPO",
    publisherUrl: "https://www.wipo.int/gii",
    methodologyEn:
      "About 80 indicators across seven pillars covering innovation inputs (institutions, human capital, infrastructure, markets, business sophistication) and outputs (knowledge, creative). Score 0-100, annual.",
    methodologyAr:
      "نحو 80 مؤشرًا موزعة على سبع ركائز تغطي مدخلات الابتكار (المؤسسات ورأس المال البشري والبنية التحتية والأسواق وتطور الأعمال) ومخرجاته (المعرفة والإبداع). الدرجة من 0 إلى 100، ويصدر سنويًا.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 100,
    higherIsBetter: true,
    frequency: "annual",
    category: "technology",
    responsibleEntityName: "Qatar Research, Development and Innovation Council",
    linkedTargetKeywords: ["innovation", "research", "rdi"],
    sourceNotes: "Values read from the official WIPO report PDFs, 2011-2024.",
  },
  {
    code: "cpi",
    nameEn: "Corruption Perceptions Index",
    nameAr: "مؤشر مدركات الفساد",
    publisher: "Transparency International",
    publisherUrl: "https://www.transparency.org/en/cpi",
    methodologyEn:
      "Aggregates up to 13 expert and business surveys of perceived public-sector corruption to a 0-100 scale (100 = very clean). Comparable across years from 2012.",
    methodologyAr:
      "يجمع حتى 13 تقييمًا من الخبراء واستطلاعات رجال الأعمال حول مدركات الفساد في القطاع العام على مقياس من 0 إلى 100 (حيث 100 الأكثر نزاهة). قابل للمقارنة عبر السنوات منذ 2012.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 100,
    higherIsBetter: true,
    frequency: "annual",
    category: "governance",
    responsibleEntityName: "Ministry of Justice",
    linkedTargetKeywords: ["governance", "government excellence", "integrity", "transparency"],
    sourceNotes: "Official results workbook (timeseries sheet, 2012 onward).",
  },
  {
    code: "egdi",
    nameEn: "E-Government Development Index",
    nameAr: "مؤشر تطور الحكومة الإلكترونية",
    publisher: "UN DESA",
    publisherUrl: "https://publicadministration.un.org/egovkb",
    methodologyEn:
      "Weighted average of normalized indices for online services, telecommunication infrastructure and human capital. Score 0-1, biennial, 193 member states.",
    methodologyAr:
      "متوسط مرجح لمؤشرات معيارية للخدمات الإلكترونية والبنية التحتية للاتصالات ورأس المال البشري. الدرجة من 0 إلى 1، ويصدر كل سنتين ويشمل 193 دولة عضوًا.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 1,
    higherIsBetter: true,
    frequency: "biennial",
    category: "technology",
    responsibleEntityName: "Ministry of Communications and Information Technology",
    linkedTargetKeywords: ["digital", "government excellence", "e-government", "services"],
    sourceNotes:
      "UN eGov knowledgebase country pages (no stable bulk file URL; the data center export is session-gated).",
  },
  {
    code: "gpi",
    nameEn: "Global Peace Index",
    nameAr: "مؤشر السلام العالمي",
    publisher: "Institute for Economics and Peace",
    publisherUrl: "https://www.visionofhumanity.org/",
    methodologyEn:
      "23 indicators across societal safety, ongoing conflict and militarisation, banded 1 (most peaceful) to 5. Lower is better. Annual, 163 countries.",
    methodologyAr:
      "23 مؤشرًا تغطي الأمان المجتمعي والنزاعات القائمة ومستوى العسكرة، على مقياس من 1 (الأكثر سلامًا) إلى 5. الأدنى أفضل. يصدر سنويًا ويغطي 163 دولة.",
    scale: "both",
    scoreMin: 1,
    scoreMax: 5,
    higherIsBetter: false,
    frequency: "annual",
    category: "society",
    responsibleEntityName: "Ministry of Interior",
    linkedTargetKeywords: ["security", "safety", "cohesive society"],
    sourceNotes:
      "Series compiled from countryeconomy.com (secondary; the IEP PDFs are unparseable on this machine), cross-checked against IEP and press values where available.",
  },
  {
    code: "imd",
    nameEn: "IMD World Competitiveness Ranking",
    nameAr: "تصنيف IMD للتنافسية العالمية",
    publisher: "IMD",
    publisherUrl: "https://www.imd.org/centers/wcc/world-competitiveness-center/",
    methodologyEn:
      "Ranks about 67 economies on economic performance, government efficiency, business efficiency and infrastructure using statistics and an executive survey. Annual; detailed scores are paywalled, ranks are public.",
    methodologyAr:
      "يرتب نحو 67 اقتصادًا وفق الأداء الاقتصادي وكفاءة الحكومة وكفاءة الأعمال والبنية التحتية اعتمادًا على الإحصاءات واستطلاع للمديرين التنفيذيين. يصدر سنويًا؛ الدرجات التفصيلية مدفوعة والترتيب علني.",
    scale: "rank",
    scoreMin: 0,
    scoreMax: 100,
    higherIsBetter: true,
    frequency: "annual",
    category: "economy",
    responsibleEntityName: "Ministry of Commerce and Industry",
    linkedTargetKeywords: ["competitiveness", "business environment", "economic growth"],
    sourceNotes:
      "Ranks from official IMD PDFs and press releases; scores only for editions where IMD published them openly. Qatar 2013 could not be sourced.",
  },
  {
    code: "lpi",
    nameEn: "Logistics Performance Index",
    nameAr: "مؤشر الأداء اللوجستي",
    publisher: "World Bank",
    publisherUrl: "https://lpi.worldbank.org/",
    methodologyEn:
      "Survey of logistics professionals scoring six components (customs, infrastructure, shipments, competence, tracking, timeliness) 1-5, aggregated to an overall score. Roughly biennial; latest survey edition 2023.",
    methodologyAr:
      "استطلاع لمتخصصي اللوجستيات يقيّم ستة مكونات (الجمارك والبنية التحتية والشحنات والكفاءة والتتبع والالتزام بالمواعيد) من 1 إلى 5، وتُجمع في درجة كلية. يصدر كل سنتين تقريبًا؛ وآخر نسخة مسحية 2023.",
    scale: "both",
    scoreMin: 1,
    scoreMax: 5,
    higherIsBetter: true,
    frequency: "biennial",
    category: "economy",
    responsibleEntityName: "Ministry of Transport",
    linkedTargetKeywords: ["logistics", "transport", "trade"],
    sourceNotes: "World Bank Data360 bulk CSV (WB_LPI), survey editions 2007-2023.",
  },
  {
    code: "nri",
    nameEn: "Network Readiness Index",
    nameAr: "مؤشر الجاهزية الشبكية",
    publisher: "Portulans Institute",
    publisherUrl: "https://networkreadinessindex.org/",
    methodologyEn:
      "Four pillars (technology, people, governance, impact) over about 130 economies, score 0-100. Published by WEF to 2016 (1-7 scale, noted per row) and by Portulans since 2019.",
    methodologyAr:
      "أربع ركائز (التقنية والأفراد والحوكمة والأثر) لنحو 130 اقتصادًا، بدرجة من 0 إلى 100. أصدره المنتدى الاقتصادي العالمي حتى 2016 (بمقياس 1-7 كما هو مدوَّن) وتصدره مؤسسة بورتولانس منذ 2019.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 100,
    higherIsBetter: true,
    frequency: "annual",
    category: "technology",
    responsibleEntityName: "Ministry of Communications and Information Technology",
    linkedTargetKeywords: ["digital", "technology", "connectivity"],
    sourceNotes:
      "Official report PDFs (WEF GITR era and Portulans). The WEF era used a 1-7 scale; rows keep their published values.",
  },
  {
    code: "ttdi",
    nameEn: "Travel and Tourism Development Index",
    nameAr: "مؤشر تنمية السفر والسياحة",
    publisher: "World Economic Forum",
    publisherUrl: "https://www.weforum.org/publications/travel-tourism-development-index-2024/",
    methodologyEn:
      "Assesses factors enabling sustainable tourism development across about 119 economies, score 1-7. Successor of the TTCI (to 2019); the series break is noted.",
    methodologyAr:
      "يقيّم عوامل التنمية السياحية المستدامة في نحو 119 اقتصادًا بدرجة من 1 إلى 7. خليفة مؤشر تنافسية السفر والسياحة (حتى 2019) مع الإشارة إلى انقطاع المنهجية.",
    scale: "both",
    scoreMin: 1,
    scoreMax: 7,
    higherIsBetter: true,
    frequency: "biennial",
    category: "economy",
    responsibleEntityName: "Qatar Tourism",
    linkedTargetKeywords: ["tourism", "visitors"],
    sourceNotes:
      "Official WEF report PDFs 2011-2024; TTCI values kept as published (methodology break at 2021).",
  },
  {
    code: "epi",
    nameEn: "Environmental Performance Index",
    nameAr: "مؤشر الأداء البيئي",
    publisher: "Yale University",
    publisherUrl: "https://epi.yale.edu/",
    methodologyEn:
      "Biennial scorecard of proximity to environmental targets over about 47 indicators in climate, environmental health and ecosystem vitality, normalized 0-100. Methodology changes between editions.",
    methodologyAr:
      "بطاقة نتائج تصدر كل سنتين لقياس الاقتراب من الأهداف البيئية عبر نحو 47 مؤشرًا في المناخ والصحة البيئية وحيوية النظم الإيكولوجية، بدرجات معيارية من 0 إلى 100. تتغير المنهجية بين النسخ.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 100,
    higherIsBetter: true,
    frequency: "biennial",
    category: "environment",
    responsibleEntityName: "Ministry of Environment and Climate Change",
    linkedTargetKeywords: ["environment", "emissions", "sustainability"],
    sourceNotes:
      "2026 edition from the official results workbook (ranks derived by sorting the official scores); earlier editions from the research pass.",
  },
  {
    code: "gtci",
    nameEn: "Global Talent Competitiveness Index",
    nameAr: "مؤشر تنافسية المواهب العالمي",
    publisher: "INSEAD",
    publisherUrl: "https://www.insead.edu/global-talent-competitiveness-index",
    methodologyEn:
      "Measures how countries enable, attract, grow and retain talent across six pillars, score 0-100, about 130 economies. Roughly annual.",
    methodologyAr:
      "يقيس قدرة الدول على تمكين المواهب واستقطابها وتنميتها والاحتفاظ بها عبر ست ركائز، بدرجة من 0 إلى 100 لنحو 130 اقتصادًا. يصدر سنويًا تقريبًا.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 100,
    higherIsBetter: true,
    frequency: "annual",
    category: "human",
    responsibleEntityName: "Ministry of Labour",
    linkedTargetKeywords: ["workforce", "talent", "skills", "labour"],
    sourceNotes: "Official INSEAD report PDFs (archived/mirrored copies where INSEAD blocks fetches).",
  },
  {
    code: "wjp",
    nameEn: "Rule of Law Index",
    nameAr: "مؤشر سيادة القانون",
    publisher: "World Justice Project",
    publisherUrl: "https://worldjusticeproject.org/rule-of-law-index/",
    methodologyEn:
      "Household and expert surveys scored 0-1 over eight factors (constraints on government powers, absence of corruption, open government, fundamental rights, order and security, regulatory enforcement, civil and criminal justice). Annual, 143 jurisdictions.",
    methodologyAr:
      "استطلاعات للأسر والخبراء بدرجات من 0 إلى 1 عبر ثمانية عوامل (قيود سلطات الحكومة، وغياب الفساد، والحكومة المنفتحة، والحقوق الأساسية، والنظام والأمن، وإنفاذ اللوائح، والعدالة المدنية والجنائية). يصدر سنويًا ويغطي 143 ولاية قضائية.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 1,
    higherIsBetter: true,
    frequency: "annual",
    category: "governance",
    responsibleEntityName: "Ministry of Justice",
    linkedTargetKeywords: ["justice", "rule of law", "governance"],
    sourceNotes:
      "Official WJP historical data files. Qatar entered the index in the 2025 edition; there is no earlier Qatar series (recorded honestly).",
  },
];

/** CR08 4.1: the CR05 twelve plus the additions of both research agents
    (src/server/indices/defs-cr08-a.ts and defs-cr08-b.ts). */
export const INDEX_DEFS: IndexDef[] = [...CR05_INDEX_DEFS, ...CR08_INDEX_DEFS];

export const INDEX_COUNTRIES: { iso3: string; en: string; ar: string; region: string }[] = [
  { iso3: "QAT", en: "Qatar", ar: "قطر", region: "GCC" },
  { iso3: "SAU", en: "Saudi Arabia", ar: "السعودية", region: "GCC" },
  { iso3: "ARE", en: "United Arab Emirates", ar: "الإمارات", region: "GCC" },
  { iso3: "KWT", en: "Kuwait", ar: "الكويت", region: "GCC" },
  { iso3: "BHR", en: "Bahrain", ar: "البحرين", region: "GCC" },
  { iso3: "OMN", en: "Oman", ar: "عُمان", region: "GCC" },
  { iso3: "USA", en: "United States", ar: "الولايات المتحدة", region: "G20" },
  { iso3: "GBR", en: "United Kingdom", ar: "المملكة المتحدة", region: "G20" },
  { iso3: "SGP", en: "Singapore", ar: "سنغافورة", region: "other" },
  { iso3: "KOR", en: "South Korea", ar: "كوريا الجنوبية", region: "G20" },
  { iso3: "TUR", en: "Türkiye", ar: "تركيا", region: "G20" },
  { iso3: "EGY", en: "Egypt", ar: "مصر", region: "MENA" },
  { iso3: "JOR", en: "Jordan", ar: "الأردن", region: "MENA" },
  { iso3: "MAR", en: "Morocco", ar: "المغرب", region: "MENA" },
  { iso3: "DEU", en: "Germany", ar: "ألمانيا", region: "OECD" },
  { iso3: "FRA", en: "France", ar: "فرنسا", region: "OECD" },
  { iso3: "JPN", en: "Japan", ar: "اليابان", region: "G20" },
  { iso3: "CHN", en: "China", ar: "الصين", region: "G20" },
  { iso3: "IND", en: "India", ar: "الهند", region: "G20" },
];

type Obs = {
  country: string;
  year: number;
  rank: number | null;
  score: number | null;
  total: number | null;
  sourceUrl: string;
};

type PillarValueRow = {
  pillarCode: string;
  nameEn: string;
  nameAr: string;
  country: string;
  year: number;
  rank: number | null;
  score: number | null;
  sourceUrl: string | null;
};

/* ------------------------------------------------------------------ */
/* small CSV parser (quoted fields)                                     */
/* ------------------------------------------------------------------ */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
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

/* ------------------------------------------------------------------ */
/* download with retries, raw archive, offline fallback                 */
/* ------------------------------------------------------------------ */

const RAW_DIR = path.join(process.cwd(), "sources", "indices", "raw");
const RESEARCH_DIR = path.join(process.cwd(), "sources", "indices", "research");

type ManifestEntry = {
  file: string;
  url: string;
  fetchedAt: string;
  bytes: number;
  status: "downloaded" | "cached" | "failed";
};

async function download(
  url: string,
  filename: string,
  manifest: ManifestEntry[],
  wantDownload: boolean,
  attempts = 3
): Promise<Buffer | null> {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const target = path.join(RAW_DIR, filename);
  if (wantDownload) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const res = await undiciFetch(url, {
          dispatcher: insecureDispatcher,
          headers: { "user-agent": "SiaNexus-indices/1.0 (research prototype)" },
          signal: AbortSignal.timeout(120000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 200) throw new Error("suspiciously small response");
        fs.writeFileSync(target, buf);
        manifest.push({
          file: filename,
          url,
          fetchedAt: nowIso(),
          bytes: buf.length,
          status: "downloaded",
        });
        return buf;
      } catch (e) {
        if (attempt === attempts - 1) {
          console.warn(`download failed after ${attempts} tries: ${url}: ${String(e)}`);
        }
      }
    }
  }
  if (fs.existsSync(target)) {
    const buf = fs.readFileSync(target);
    manifest.push({
      file: filename,
      url,
      fetchedAt: nowIso(),
      bytes: buf.length,
      status: "cached",
    });
    return buf;
  }
  manifest.push({ file: filename, url, fetchedAt: nowIso(), bytes: 0, status: "failed" });
  return null;
}

/* ------------------------------------------------------------------ */
/* bulk-file parsers                                                    */
/* ------------------------------------------------------------------ */

const HDI_URL =
  "https://hdr.undp.org/sites/default/files/2025_HDR/HDR25_Composite_indices_complete_time_series.csv";

function parseHdi(buf: Buffer): Obs[] {
  const rows = parseCsv(buf.toString("utf8"));
  const header = rows[0];
  const isoIdx = header.indexOf("iso3");
  const codeIdx = header.indexOf("hdicode");
  const yearCols: { year: number; idx: number }[] = [];
  header.forEach((h, i) => {
    const m = /^hdi_(\d{4})$/.exec(h);
    if (m && Number(m[1]) >= 2010) yearCols.push({ year: Number(m[1]), idx: i });
  });
  const countries = rows
    .slice(1)
    .filter((r) => /^[A-Z]{3}$/.test(r[isoIdx] ?? "") && (r[codeIdx] ?? "") !== "");
  const out: Obs[] = [];
  for (const { year, idx } of yearCols) {
    const ranked = countries
      .map((r) => ({ iso: r[isoIdx], v: Number(r[idx]) }))
      .filter((x) => Number.isFinite(x.v) && x.v > 0)
      .sort((a, b) => b.v - a.v);
    const total = ranked.length;
    ranked.forEach((x, i) => {
      out.push({
        country: x.iso,
        year,
        rank: i + 1,
        score: x.v,
        total,
        sourceUrl: HDI_URL,
      });
    });
  }
  return out;
}

const CPI_URL = "https://files.transparencycdn.org/images/CPI2025_Results.xlsx";

function parseCpi(buf: Buffer): Obs[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName =
    wb.SheetNames.find((n) => /timeseries/i.test(n)) ?? wb.SheetNames[0];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1,
  }) as unknown[][];
  const headerRowIdx = grid.findIndex((r) => r.some((c) => String(c).trim() === "ISO3"));
  if (headerRowIdx === -1) return [];
  const header = grid[headerRowIdx].map((c) => String(c ?? "").trim());
  const isoIdx = header.indexOf("ISO3");
  const scoreCols: { year: number; idx: number }[] = [];
  const rankCols = new Map<number, number>();
  header.forEach((h, i) => {
    let m = /^CPI [Ss]core (\d{4})$/.exec(h);
    if (m) scoreCols.push({ year: Number(m[1]), idx: i });
    m = /^Rank (\d{4})$/.exec(h);
    if (m) rankCols.set(Number(m[1]), i);
  });
  const rows = grid.slice(headerRowIdx + 1).filter((r) => /^[A-Z]{3}$/.test(String(r[isoIdx] ?? "")));
  const out: Obs[] = [];
  for (const { year, idx } of scoreCols) {
    const yearRows = rows
      .map((r) => ({
        iso: String(r[isoIdx]),
        score: Number(r[idx]),
        rank: rankCols.has(year) ? Number(r[rankCols.get(year)!]) : NaN,
      }))
      .filter((x) => Number.isFinite(x.score));
    // derive ranks when the sheet has no rank column for the year
    const sorted = [...yearRows].sort((a, b) => b.score - a.score);
    const derivedRank = new Map<string, number>();
    let lastScore = Infinity;
    let lastRank = 0;
    sorted.forEach((x, i) => {
      const rank = x.score === lastScore ? lastRank : i + 1;
      lastScore = x.score;
      lastRank = rank;
      derivedRank.set(x.iso, rank);
    });
    const total = yearRows.length;
    for (const x of yearRows) {
      out.push({
        country: x.iso,
        year,
        rank: Number.isFinite(x.rank) ? x.rank : derivedRank.get(x.iso) ?? null,
        score: x.score,
        total,
        sourceUrl: CPI_URL,
      });
    }
  }
  return out;
}

const EPI_URL = "https://epi.yale.edu/downloads/epi2026results2026-07-07.xlsx";

function parseEpi(buf: Buffer): Obs[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName = wb.SheetNames.find((n) => /data/i.test(n)) ?? wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]);
  const list = rows
    .map((r) => ({
      iso: String(r["iso"] ?? "").trim(),
      score: Number(r["EPI.new"]),
    }))
    .filter((x) => /^[A-Z]{3}$/.test(x.iso) && Number.isFinite(x.score));
  const sorted = [...list].sort((a, b) => b.score - a.score);
  const total = sorted.length;
  return sorted.map((x, i) => ({
    country: x.iso,
    year: 2026,
    rank: i + 1,
    score: x.score,
    total,
    sourceUrl: EPI_URL,
  }));
}

const LPI_URL = "https://data360files.worldbank.org/data360-data/data/WB_LPI/WB_LPI.csv";

function parseLpi(buf: Buffer): Obs[] {
  const rows = parseCsv(buf.toString("utf8"));
  const header = rows[0];
  const col = (name: string) => header.indexOf(name);
  const iRef = col("REF_AREA");
  const iTime = col("TIME_PERIOD");
  const iC1 = col("COMP_BREAKDOWN_1");
  const iC2 = col("COMP_BREAKDOWN_2");
  const iVal = col("OBS_VALUE");
  if ([iRef, iTime, iC1, iC2, iVal].some((i) => i === -1)) return [];
  const byKey = new Map<string, { score: number | null; rank: number | null }>();
  for (const r of rows.slice(1)) {
    if (r[iC1] !== "_T") continue;
    const metric = r[iC2];
    if (metric !== "WB_LPI_SC" && metric !== "WB_LPI_RK") continue;
    const iso = r[iRef];
    if (!/^[A-Z]{3}$/.test(iso)) continue;
    const year = Number(r[iTime]);
    if (!Number.isFinite(year) || year < 2010) continue;
    const v = Number(r[iVal]);
    if (!Number.isFinite(v)) continue;
    const key = `${iso}:${year}`;
    const cur = byKey.get(key) ?? { score: null, rank: null };
    if (metric === "WB_LPI_SC") cur.score = v;
    else cur.rank = v;
    byKey.set(key, cur);
  }
  const totals = new Map<number, number>();
  for (const [key, v] of byKey) {
    const year = Number(key.split(":")[1]);
    if (v.rank != null) totals.set(year, Math.max(totals.get(year) ?? 0, v.rank));
  }
  const out: Obs[] = [];
  for (const [key, v] of byKey) {
    const [iso, yearStr] = key.split(":");
    out.push({
      country: iso,
      year: Number(yearStr),
      rank: v.rank,
      score: v.score,
      total: totals.get(Number(yearStr)) ?? null,
      sourceUrl: LPI_URL,
    });
  }
  return out;
}

/** Competition ranking (ties share a rank, the next rank skips) over the
    official scores of one edition; used where a publisher releases scores
    but no ranks (Heritage workbooks, the World Bank GovTech dataset), the
    same derivation the HDI and EPI parsers apply (DECISIONS 67). */
function deriveRanks(
  rows: { key: string; score: number }[],
  higherIsBetter = true
): Map<string, number> {
  const sorted = [...rows].sort((a, b) => (higherIsBetter ? b.score - a.score : a.score - b.score));
  const out = new Map<string, number>();
  let lastScore = Number.NaN;
  let lastRank = 0;
  sorted.forEach((x, i) => {
    const rank = x.score === lastScore ? lastRank : i + 1;
    lastScore = x.score;
    lastRank = rank;
    out.set(x.key, rank);
  });
  return out;
}

/* CR08 4.1: Heritage Index of Economic Freedom data workbooks (one per
   edition, every graded economy with its overall score; no ISO codes and no
   rank column, so the focus countries are matched by name and ranks are
   derived by sorting the official overall scores). */
const heritageUrl = (year: number) =>
  `https://static.heritage.org/index/data/${year}/${year}_indexofeconomicfreedom_data.xlsx`;
const HERITAGE_FIRST_YEAR = 2024; // the data workbook exists from the 2024 edition
const HERITAGE_NAMES: Record<string, string> = {
  Qatar: "QAT",
  "Saudi Arabia": "SAU",
  "United Arab Emirates": "ARE",
  Kuwait: "KWT",
  Bahrain: "BHR",
  Oman: "OMN",
  "United States": "USA",
  "United Kingdom": "GBR",
  Singapore: "SGP",
  "South Korea": "KOR",
  "Korea, South": "KOR",
  Turkey: "TUR",
  "Türkiye": "TUR",
  Egypt: "EGY",
  Jordan: "JOR",
  Morocco: "MAR",
  Germany: "DEU",
  France: "FRA",
  Japan: "JPN",
  China: "CHN",
  India: "IND",
};

function parseHeritage(buf: Buffer, year: number, url: string): Obs[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
  }) as unknown[][];
  const hIdx = grid.findIndex(
    (r) =>
      r.some((c) => String(c ?? "").trim() === "Country") &&
      r.some((c) => /overall score/i.test(String(c ?? "")))
  );
  if (hIdx === -1) return [];
  const header = grid[hIdx].map((c) => String(c ?? "").trim());
  const iName = header.indexOf("Country");
  const iScore = header.findIndex((c) => /overall score/i.test(c));
  const rows = grid
    .slice(hIdx + 1)
    .map((r) => ({ key: String(r[iName] ?? "").trim(), score: Number(r[iScore]) }))
    .filter((x) => x.key !== "" && Number.isFinite(x.score));
  const ranks = deriveRanks(rows);
  const out: Obs[] = [];
  for (const r of rows) {
    const iso = HERITAGE_NAMES[r.key];
    if (!iso) continue;
    out.push({
      country: iso,
      year,
      rank: ranks.get(r.key) ?? null,
      score: r.score,
      total: rows.length,
      sourceUrl: url,
    });
  }
  return out;
}

/* CR08 4.1: World Bank GovTech Maturity Index dataset (December 2025
   workbook; sheet GTMI_Data holds the 2020, 2022 and 2025 editions for
   every economy with the GTMI score and group). The Bank publishes no
   ranks, so they are derived by sorting the official scores per edition. */
const GTMI_URL =
  "https://datacatalogfiles.worldbank.org/ddh-published/0037889/DR0095721/WBG_GovTech_Dataset_Dec2025.xlsx";

function parseGtmi(buf: Buffer): Obs[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName =
    wb.SheetNames.find((n) => /^GTMI_Data$/i.test(n)) ??
    wb.SheetNames.find((n) => /GTMI_Data/i.test(n));
  if (!sheetName) return [];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1,
  }) as unknown[][];
  const header = (grid[0] ?? []).map((c) => String(c ?? "").trim());
  const iYear = header.indexOf("Year");
  const iCode = header.indexOf("Code");
  const iScore = header.indexOf("GTMI");
  if ([iYear, iCode, iScore].some((i) => i === -1)) return [];
  const byYear = new Map<number, { key: string; score: number }[]>();
  for (const r of grid.slice(1)) {
    const year = Number(r[iYear]);
    const iso = String(r[iCode] ?? "").trim().toUpperCase();
    const score = Number(r[iScore]);
    if (!Number.isFinite(year) || !/^[A-Z]{3}$/.test(iso) || !Number.isFinite(score)) continue;
    (byYear.get(year) ?? byYear.set(year, []).get(year)!).push({ key: iso, score });
  }
  const out: Obs[] = [];
  for (const [year, rows] of byYear) {
    const ranks = deriveRanks(rows);
    for (const r of rows) {
      out.push({
        country: r.key,
        year,
        rank: ranks.get(r.key) ?? null,
        score: r.score,
        total: rows.length,
        sourceUrl: GTMI_URL,
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* research-file loaders                                                */
/* ------------------------------------------------------------------ */

type ResearchFile = {
  observations?: {
    country: string;
    year: number;
    rank: number | null;
    score: number | null;
    total_countries: number | null;
    source_url: string;
  }[];
  pillars?: unknown;
};

function loadResearch(def: IndexDef): { obs: Obs[]; pillars: PillarValueRow[] } {
  const obs: Obs[] = [];
  const pillars: PillarValueRow[] = [];
  const code = def.code;
  // CR05 extractions, then the CR08 research files (cr08-<code>.json plus an
  // optional extra file named on the def); later files win on the same key
  const files = [
    `${code}.extracted.json`,
    `${code}-history.extracted.json`,
    `cr08-${code}.json`,
  ];
  const extra = (def as Partial<Cr08IndexDef>).researchFile;
  if (extra && !files.includes(extra)) files.push(extra);
  for (const f of files) {
    const p = path.join(RESEARCH_DIR, f);
    if (!fs.existsSync(p)) continue;
    let data: ResearchFile;
    try {
      data = JSON.parse(fs.readFileSync(p, "utf8"));
    } catch {
      console.warn(`unreadable research file ${f}`);
      continue;
    }
    for (const o of data.observations ?? []) {
      if (o.rank == null && o.score == null) continue;
      obs.push({
        country: o.country,
        year: o.year,
        rank: o.rank ?? null,
        score: o.score ?? null,
        total: o.total_countries ?? null,
        sourceUrl: o.source_url,
      });
    }
    // pillar shapes vary: [{pillar_code,name_en,values:[...]}] or flat rows
    const raw = data.pillars;
    if (Array.isArray(raw)) {
      for (const entry of raw as Record<string, unknown>[]) {
        if (Array.isArray(entry.values)) {
          const codeStr = String(entry.pillar_code ?? entry.code ?? "").trim();
          const nameEn = String(entry.name_en ?? codeStr);
          for (const v of entry.values as Record<string, unknown>[]) {
            pillars.push({
              pillarCode: codeStr || slugify(nameEn),
              nameEn,
              nameAr: String(entry.name_ar ?? nameEn),
              country: String(v.country),
              year: Number(v.year),
              rank: v.rank == null ? null : Number(v.rank),
              score: v.score == null ? null : Number(v.score),
              sourceUrl: v.source_url ? String(v.source_url) : null,
            });
          }
        } else if (entry.factor || entry.pillar) {
          const nameEn = String(entry.factor ?? entry.pillar);
          pillars.push({
            pillarCode: slugify(nameEn),
            nameEn,
            nameAr: nameEn,
            country: String(entry.country),
            year: Number(entry.year),
            rank: entry.rank == null ? null : Number(entry.rank),
            score: entry.score == null ? null : Number(entry.score),
            sourceUrl: entry.source_url ? String(entry.source_url) : null,
          });
        }
      }
    }
  }
  return { obs, pillars };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/* ------------------------------------------------------------------ */
/* the run                                                              */
/* ------------------------------------------------------------------ */

export type FetchReport = {
  perIndex: {
    code: string;
    observations: number;
    inserted: number;
    countries: number;
    qatarYears: number[];
    pillarValues: number;
  }[];
};

/** Ensures one indices row per definition (CR05 and CR08). New rows carry
    the CR08 columns from the def (sdg_goal, forecast_mode, forecast_enabled);
    existing rows only get sdg_goal / forecast_mode filled where they are
    still null, so a Super Admin's settings are never overwritten. Returns
    code -> id. Used by runIndicesFetch and by scripts/cr08-indices-seed.ts. */
export async function ensureIndexRows(defs: IndexDef[]): Promise<Map<string, string>> {
  const entities = await db.select().from(schema.entities);
  const entityByName = new Map(entities.map((e) => [e.nameEn.toLowerCase(), e.id]));
  const existing = await db.select().from(schema.indices);
  const byCode = new Map(existing.map((i) => [i.code, i]));
  const idOfIndex = new Map<string, string>();
  for (const def of defs) {
    const cr08 = def as Partial<Cr08IndexDef>;
    const found = byCode.get(def.code);
    if (found) {
      idOfIndex.set(def.code, found.id);
      const patch: Partial<typeof schema.indices.$inferInsert> = {};
      if (found.sdgGoal == null && cr08.sdgGoal != null) patch.sdgGoal = cr08.sdgGoal;
      if (found.forecastMode == null && cr08.forecastMode) patch.forecastMode = cr08.forecastMode;
      if (Object.keys(patch).length) {
        await db
          .update(schema.indices)
          .set({ ...patch, updatedAt: nowIso() })
          .where(eq(schema.indices.id, found.id));
      }
      continue;
    }
    const id = newId();
    await db.insert(schema.indices).values({
      id,
      code: def.code,
      nameEn: def.nameEn,
      nameAr: def.nameAr,
      publisher: def.publisher,
      publisherUrl: def.publisherUrl,
      methodologySummaryEn: def.methodologyEn,
      methodologySummaryAr: def.methodologyAr,
      scale: def.scale,
      scoreMin: def.scoreMin,
      scoreMax: def.scoreMax,
      higherIsBetter: def.higherIsBetter ? 1 : 0,
      frequency: def.frequency,
      category: def.category,
      responsibleEntityId: entityByName.get(def.responsibleEntityName.toLowerCase()) ?? null,
      linkedNodeIdsJson: null,
      isActive: 1,
      sourceNotes: def.sourceNotes,
      sdgGoal: cr08.sdgGoal ?? null,
      forecastMode: cr08.forecastMode ?? null,
      forecastEnabled: cr08.forecastEnabled === false ? 0 : 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    idOfIndex.set(def.code, id);
  }
  return idOfIndex;
}

export async function runIndicesFetch(
  opts: { download?: boolean; codes?: string[] } = {}
): Promise<FetchReport> {
  const wantDownload =
    opts.download !== false && process.env.SKIP_INDICES_FETCH !== "1";
  const manifest: ManifestEntry[] = [];
  // CR08 4.1: a partial run (the cr08 seed) only ingests the listed codes and
  // leaves the manifest and the refresh stamp to full runs
  const partial = Array.isArray(opts.codes);
  const defs = partial
    ? INDEX_DEFS.filter((d) => opts.codes!.includes(d.code))
    : INDEX_DEFS;
  // the refresh job and the seeds share the SQLite file with the app: wait
  // for concurrent writers instead of failing with SQLITE_BUSY
  await db.run(sql`PRAGMA busy_timeout = 30000`);

  /* countries */
  const existingCountries = await db.select().from(schema.countries);
  const haveIso = new Set(existingCountries.map((c) => c.iso3));
  for (const c of INDEX_COUNTRIES) {
    if (!haveIso.has(c.iso3)) {
      await db.insert(schema.countries).values({
        iso3: c.iso3,
        nameEn: c.en,
        nameAr: c.ar,
        region: c.region,
      });
    }
  }

  /* register rows (every def, so the board sees the whole register) */
  const idOfIndex = await ensureIndexRows(INDEX_DEFS);
  const registered = await db.select().from(schema.indices);
  const byCode = new Map(registered.map((i) => [i.code, i]));

  /* link NDS3 targets by keyword (plausible, presentation-level) */
  const [nds3] = await db
    .select()
    .from(schema.strategyEditions)
    .where(eq(schema.strategyEditions.code, "nds3"));
  if (nds3) {
    const targets = await db
      .select()
      .from(schema.strategyNodes)
      .where(eq(schema.strategyNodes.editionId, nds3.id));
    const targetRows = targets.filter((t) => t.nodeType === "target");
    for (const def of defs) {
      const id = idOfIndex.get(def.code)!;
      const row = byCode.get(def.code);
      if (row?.linkedNodeIdsJson) continue; // keep manual links
      const hits = targetRows
        .filter((t) =>
          def.linkedTargetKeywords.some((k) => t.titleEn.toLowerCase().includes(k))
        )
        .slice(0, 2)
        .map((t) => t.id);
      if (hits.length) {
        await db
          .update(schema.indices)
          .set({ linkedNodeIdsJson: JSON.stringify(hits), updatedAt: nowIso() })
          .where(eq(schema.indices.id, id));
      }
    }
  }

  /* observations per index */
  const report: FetchReport = { perIndex: [] };
  const thisYear = new Date().getFullYear();
  for (const def of defs) {
    const indexId = idOfIndex.get(def.code)!;
    let obs: Obs[] = [];
    let pillarRows: PillarValueRow[] = [];

    if (def.code === "hdi") {
      const buf = await download(HDI_URL, "hdi-timeseries.csv", manifest, wantDownload);
      if (buf) obs = parseHdi(buf);
    } else if (def.code === "cpi") {
      const buf = await download(CPI_URL, "cpi-results.xlsx", manifest, wantDownload);
      if (buf) obs = parseCpi(buf);
    } else if (def.code === "epi") {
      const buf = await download(EPI_URL, "epi2026-results.xlsx", manifest, wantDownload);
      if (buf) obs = parseEpi(buf);
      const research = loadResearch(def);
      obs = obs.concat(research.obs);
      pillarRows = research.pillars;
    } else if (def.code === "lpi") {
      const buf = await download(LPI_URL, "lpi-data360.csv", manifest, wantDownload);
      if (buf) obs = parseLpi(buf);
    } else if (def.code === "economic_freedom") {
      // CR08 4.1: one workbook per edition; next year's file is probed once
      // so a refresh picks it up when Heritage publishes it
      for (let year = HERITAGE_FIRST_YEAR; year <= thisYear + 1; year++) {
        const buf = await download(
          heritageUrl(year),
          `heritage-${year}-data.xlsx`,
          manifest,
          wantDownload,
          year > thisYear ? 1 : 3
        );
        if (buf) obs = obs.concat(parseHeritage(buf, year, heritageUrl(year)));
      }
      // the research file carries Qatar's published ranks and earlier scores
      // and wins over the derived rows on the same key
      const research = loadResearch(def);
      obs = obs.concat(research.obs);
      pillarRows = research.pillars;
    } else if (def.code === "govtech") {
      const buf = await download(GTMI_URL, "govtech-dataset-dec2025.xlsx", manifest, wantDownload);
      if (buf) obs = parseGtmi(buf);
      const research = loadResearch(def);
      obs = obs.concat(research.obs);
      pillarRows = research.pillars;
    } else {
      const research = loadResearch(def);
      obs = research.obs;
      pillarRows = research.pillars;
    }

    // one row per country and year: the last source listed wins (research
    // corrections over bulk-file derivations)
    const dedup = new Map<string, Obs>();
    for (const o of obs) {
      if (!/^[A-Z]{3}$/.test(o.country)) continue;
      dedup.set(`${o.country}:${o.year}`, o);
    }

    // upsert observations; never clobber manual or verified corrections
    const existingObs = await db
      .select()
      .from(schema.indexObservations)
      .where(eq(schema.indexObservations.indexId, indexId));
    const existingByKey = new Map(
      existingObs.map((o) => [`${o.countryCode}:${o.year}`, o])
    );
    let inserted = 0;
    for (const o of dedup.values()) {
      const key = `${o.country}:${o.year}`;
      const prior = existingByKey.get(key);
      if (prior) {
        if (prior.status !== "fetched") continue;
        if (
          prior.rank !== (o.rank ?? null) ||
          prior.score !== (o.score ?? null) ||
          prior.totalCountries !== (o.total ?? null)
        ) {
          await db
            .update(schema.indexObservations)
            .set({
              rank: o.rank,
              score: o.score,
              totalCountries: o.total,
              sourceUrl: o.sourceUrl,
              fetchedAt: nowIso(),
            })
            .where(eq(schema.indexObservations.id, prior.id));
        }
        continue;
      }
      await db.insert(schema.indexObservations).values({
        id: newId(),
        indexId,
        countryCode: o.country,
        year: o.year,
        rank: o.rank,
        score: o.score,
        totalCountries: o.total,
        sourceUrl: o.sourceUrl,
        fetchedAt: nowIso(),
        status: "fetched",
      });
      existingByKey.set(key, {
        id: "",
        indexId,
        countryCode: o.country,
        year: o.year,
        rank: o.rank,
        score: o.score,
        totalCountries: o.total,
        sourceUrl: o.sourceUrl,
        fetchedAt: nowIso(),
        status: "fetched",
      } as (typeof existingObs)[number]);
      inserted++;
    }

    /* pillars */
    let pillarValues = 0;
    if (pillarRows.length) {
      const pillarDefs = new Map<string, { nameEn: string; nameAr: string }>();
      for (const p of pillarRows) {
        if (!pillarDefs.has(p.pillarCode))
          pillarDefs.set(p.pillarCode, { nameEn: p.nameEn, nameAr: p.nameAr });
      }
      const existingPillars = await db
        .select()
        .from(schema.indexPillars)
        .where(eq(schema.indexPillars.indexId, indexId));
      const havePillar = new Set(existingPillars.map((p) => p.pillarCode));
      let sort = existingPillars.length;
      for (const [codeStr, names] of pillarDefs) {
        if (havePillar.has(codeStr)) continue;
        await db.insert(schema.indexPillars).values({
          id: newId(),
          indexId,
          pillarCode: codeStr,
          nameEn: names.nameEn,
          nameAr: names.nameAr,
          sort: sort++,
        });
      }
      const existingValues = await db
        .select()
        .from(schema.indexPillarValues)
        .where(eq(schema.indexPillarValues.indexId, indexId));
      const haveValue = new Set(
        existingValues.map((v) => `${v.pillarCode}:${v.countryCode}:${v.year}`)
      );
      for (const p of pillarRows) {
        if (p.rank == null && p.score == null) continue;
        const key = `${p.pillarCode}:${p.country}:${p.year}`;
        if (haveValue.has(key)) continue;
        haveValue.add(key);
        await db.insert(schema.indexPillarValues).values({
          id: newId(),
          indexId,
          pillarCode: p.pillarCode,
          countryCode: p.country,
          year: p.year,
          rank: p.rank,
          score: p.score,
          sourceUrl: p.sourceUrl,
        });
        pillarValues++;
      }
    }

    /* latest year with a Qatar observation */
    const after = await db
      .select()
      .from(schema.indexObservations)
      .where(eq(schema.indexObservations.indexId, indexId));
    const qatarYears = after
      .filter((o) => o.countryCode === "QAT")
      .map((o) => o.year)
      .sort((a, b) => a - b);
    const latest = qatarYears.length
      ? qatarYears[qatarYears.length - 1]
      : after.length
        ? Math.max(...after.map((o) => o.year))
        : null;
    await db
      .update(schema.indices)
      .set({ latestYear: latest, updatedAt: nowIso() })
      .where(eq(schema.indices.id, indexId));

    report.perIndex.push({
      code: def.code,
      observations: after.length,
      inserted,
      countries: new Set(after.map((o) => o.countryCode)).size,
      qatarYears,
      pillarValues,
    });
  }

  /* manifest + coverage report (a partial run keeps the last full manifest
     and refresh stamp) */
  await writeCoverageReport();
  if (partial) return report;
  fs.mkdirSync(path.join(process.cwd(), "sources", "indices"), { recursive: true });
  fs.writeFileSync(
    path.join(process.cwd(), "sources", "indices", "manifest.json"),
    JSON.stringify({ generatedAt: nowIso(), files: manifest }, null, 2)
  );
  // stored as an object: getSetting merges objects over the fallback and
  // would shred a bare string into character indices
  const stamp = JSON.stringify({ at: nowIso() });
  await db
    .insert(schema.settings)
    .values({ key: "indices_last_refresh", valueJson: stamp })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: { valueJson: stamp },
    });
  return report;
}

export async function writeCoverageReport(): Promise<void> {
  const indices = await db.select().from(schema.indices);
  const obs = await db.select().from(schema.indexObservations);
  const focusList = INDEX_COUNTRIES.map((c) => c.iso3);
  const lines: string[] = [
    "# International indices: coverage report",
    "",
    `Generated ${nowIso()}. Counts are real stored observations; a dash means no published value was found (never invented).`,
    "",
  ];
  for (const idx of indices.sort((a, b) => a.code.localeCompare(b.code))) {
    const mine = obs.filter((o) => o.indexId === idx.id);
    const qat = mine
      .filter((o) => o.countryCode === "QAT")
      .map((o) => o.year)
      .sort((a, b) => a - b);
    lines.push(`## ${idx.nameEn} (${idx.code})`);
    lines.push("");
    lines.push(
      `- Observations: ${mine.length} across ${new Set(mine.map((o) => o.countryCode)).size} countries; latest year ${idx.latestYear ?? "-"}.`
    );
    lines.push(
      `- Qatar: ${qat.length ? `${qat.length} years (${qat[0]}-${qat[qat.length - 1]})` : "no published coverage"}.`
    );
    const per = focusList
      .map((iso) => {
        const c = mine.filter((o) => o.countryCode === iso);
        return `${iso} ${c.length || "-"}`;
      })
      .join(" · ");
    lines.push(`- Focus countries (years stored): ${per}`);
    if (idx.sourceNotes) lines.push(`- Sources: ${idx.sourceNotes}`);
    lines.push("");
  }
  fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), "data", "indices-report.md"), lines.join("\n"));
}
