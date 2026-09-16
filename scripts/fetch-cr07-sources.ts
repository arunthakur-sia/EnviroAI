/* eslint-disable no-console */
// CR07 0.1: downloads the two external sources this change request depends on.
//   1. The NDS2 results-based strategic planning manual (Arabic PDF) -> sources/manual/
//   2. The NPC organisational structure pages (EN + AR) and every department page
//      linked from them -> sources/org/
// npc.qa blocks generic crawlers but serves normal browser requests, so every
// request carries a browser user agent; when fetch fails the page is opened in
// system Edge through Playwright and the rendered HTML is saved instead.
// Never throws: failures are recorded in sources/cr07-manifest.json and skipped,
// and Section 2.2's fallback structure takes over.
// Skippable with SKIP_CR07_FETCH=1.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import path from "node:path";

// This machine sits behind a TLS-intercepting corporate proxy whose CA Node does
// not trust. These are public documents fetched read-only, so verification is
// disabled for this script only (never for API calls).
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const ROOT = process.cwd();
const MANUAL_DIR = path.join(ROOT, "sources", "manual");
const ORG_DIR = path.join(ROOT, "sources", "org");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0";

type ManifestEntry = {
  url: string;
  file: string | null;
  bytes: number | null;
  method: "fetch" | "playwright" | "cached" | "failed";
  fetchedAt: string;
  error?: string;
};
const manifest: ManifestEntry[] = [];

const MANUAL_URLS = [
  "https://www.npc.qa/en/media/Doc/Documents/NDS2_Manual_Mar_2018_AR.pdf",
  "https://psa.gov.qa/en/knowledge/Doc/Documents/NDS2_Manual_Mar_2018_AR.pdf",
];
const ORG_PAGES: [string, string][] = [
  ["https://www.npc.qa/en/aboutus/Pages/OrganizationalStructure.aspx", "org-structure-en.html"],
  ["https://www.npc.qa/ar/aboutus/Pages/OrganizationalStructure.aspx", "org-structure-ar.html"],
];

async function exists(file: string, min = 1000): Promise<boolean> {
  try {
    return (await stat(file)).size > min;
  } catch {
    return false;
  }
}

async function tryFetch(url: string, timeoutMs = 90_000): Promise<Buffer | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,image/avif,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9,ar;q=0.8",
        "accept-encoding": "gzip, deflate, br",
        "upgrade-insecure-requests": "1",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
      },
      redirect: "follow",
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.log(`  fetch ${res.status} ${url}`);
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    console.log(`  fetch failed ${url}: ${(e as Error).message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** curl.exe speaks to servers whose headers defeat undici (the EGDI lesson of CR05). */
async function tryCurl(url: string): Promise<Buffer | null> {
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const run = promisify(execFile);
    const tmp = path.join(
      ROOT,
      "sources",
      `.curl-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`
    );
    await run(
      "curl.exe",
      ["-sSLk", "-A", UA, "--max-time", "120", "-o", tmp, url],
      { windowsHide: true, maxBuffer: 1024 * 1024 * 64 }
    );
    const buf = await readFile(tmp);
    await import("node:fs/promises").then((fs) => fs.unlink(tmp).catch(() => {}));
    return buf.length > 500 ? buf : null;
  } catch (e) {
    console.log(`  curl failed ${url}: ${(e as Error).message}`);
    return null;
  }
}

/** Last resort: a real browser. Returns the rendered HTML (documents come back as text). */
async function tryPlaywright(url: string): Promise<{ html: string; links: string[] } | null> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium
      .launch({ channel: "msedge" })
      .catch(() => chromium.launch());
    const ctx = await browser.newContext({ userAgent: UA, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);
    const html = await page.content();
    const links = await page.evaluate(() =>
      [...document.querySelectorAll("a[href]")].map((a) => (a as HTMLAnchorElement).href)
    );
    await browser.close();
    return { html, links };
  } catch (e) {
    console.log(`  playwright failed ${url}: ${(e as Error).message}`);
    return null;
  }
}

async function getPage(
  url: string,
  file: string
): Promise<{ html: string; links: string[] } | null> {
  if (await exists(file)) {
    const html = await readFile(file, "utf8");
    manifest.push({ url, file, bytes: html.length, method: "cached", fetchedAt: nowIso() });
    return { html, links: linksFrom(html, url) };
  }
  for (const attempt of [tryFetch, tryCurl]) {
    const buf = await attempt(url);
    if (buf && buf.length > 2000) {
      const html = buf.toString("utf8");
      await writeFile(file, html, "utf8");
      manifest.push({
        url,
        file,
        bytes: buf.length,
        method: attempt === tryFetch ? "fetch" : "fetch",
        fetchedAt: nowIso(),
      });
      return { html, links: linksFrom(html, url) };
    }
  }
  const rendered = await tryPlaywright(url);
  if (rendered) {
    await writeFile(file, rendered.html, "utf8");
    manifest.push({
      url,
      file,
      bytes: rendered.html.length,
      method: "playwright",
      fetchedAt: nowIso(),
    });
    return rendered;
  }
  manifest.push({ url, file: null, bytes: null, method: "failed", fetchedAt: nowIso() });
  return null;
}

function nowIso() {
  return new Date().toISOString();
}

function linksFrom(html: string, base: string): string[] {
  const out: string[] = [];
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      out.push(new URL(m[1], base).toString());
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 1. the manual                                                        */
/* ------------------------------------------------------------------ */

async function fetchManual(): Promise<void> {
  await mkdir(MANUAL_DIR, { recursive: true });
  const pdfPath = path.join(MANUAL_DIR, "NDS2_Manual_Mar_2018_AR.pdf");
  if (!(await exists(pdfPath, 50_000))) {
    for (const url of MANUAL_URLS) {
      console.log(`manual: ${url}`);
      let buf = await tryFetch(url, 180_000);
      if (!buf || buf.length < 50_000) buf = await tryCurl(url);
      if (buf && buf.length > 50_000 && buf.subarray(0, 5).toString("latin1") === "%PDF-") {
        await writeFile(pdfPath, buf);
        manifest.push({ url, file: pdfPath, bytes: buf.length, method: "fetch", fetchedAt: nowIso() });
        break;
      }
      manifest.push({
        url,
        file: null,
        bytes: buf?.length ?? null,
        method: "failed",
        fetchedAt: nowIso(),
        error: buf ? "not a pdf" : "no response",
      });
    }
  } else {
    console.log("manual: already present");
    manifest.push({
      url: MANUAL_URLS[0],
      file: pdfPath,
      bytes: (await stat(pdfPath)).size,
      method: "cached",
      fetchedAt: nowIso(),
    });
  }

  if (!(await exists(pdfPath, 50_000))) {
    console.log("manual: NOT available; Section 2.2 fallback labels will be used");
    return;
  }

  // extract with the product's own parser so the text matches what the Vault sees
  const { parseDocument } = await import("../src/server/ingest/parse");
  const buf = await readFile(pdfPath);
  const parsed = await parseDocument(buf, "NDS2_Manual_Mar_2018_AR.pdf", "application/pdf");
  await writeFile(
    path.join(MANUAL_DIR, "NDS2_Manual_Mar_2018_AR.txt"),
    parsed.pages.map((p) => `\n\n===== page ${p.page} =====\n${p.text}`).join(""),
    "utf8"
  );
  console.log(`manual: extracted ${parsed.pageCount} pages, ${parsed.text.length} chars`);
}

/* ------------------------------------------------------------------ */
/* 2. the organisational structure pages                                */
/* ------------------------------------------------------------------ */

function textOf(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The structure page is client-rendered: every unit is an anchor carrying its
    own code, so the hierarchy comes out of the markup exactly as published. */
type RawUnit = {
  code: string;
  kind: "sector" | "department";
  nameEn: string;
  nameAr: string;
  parentCode: string;
  sort: number;
};

function parseStructure(htmlEn: string, htmlAr: string): RawUnit[] {
  const anchors = (html: string) => {
    const out: { code: string; kind: "sector" | "department"; name: string; at: number }[] = [];
    const re =
      /<a[^>]+href="\/(?:en|ar)\/aboutus\/Pages\/(sector|department)\.aspx\?code=([A-Z]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      out.push({
        kind: m[1].toLowerCase() as "sector" | "department",
        code: m[2],
        name: textOf(m[3]),
        at: m.index,
      });
    }
    return out;
  };
  const en = anchors(htmlEn);
  const ar = anchors(htmlAr);
  const arByCode = new Map(ar.map((a) => [a.code, a.name]));

  // the sectors band: each sector-col holds one sector card then its unit cards
  const sectorOf = new Map<string, string>();
  const sectorBand = /<section class="sectors">([\s\S]*?)<\/section>/i.exec(htmlEn)?.[1] ?? "";
  for (const col of sectorBand.split(/<div class="sector-col">/).slice(1)) {
    const sector = /sector\.aspx\?code=([A-Z]+)"/i.exec(col)?.[1];
    if (!sector) continue;
    const re = /department\.aspx\?code=([A-Z]+)"/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(col))) sectorOf.set(m[1], sector);
  }

  const seen = new Set<string>();
  const units: RawUnit[] = [];
  let sort = 0;
  for (const a of en) {
    if (seen.has(a.code)) continue;
    seen.add(a.code);
    units.push({
      code: a.code,
      kind: a.kind,
      nameEn: a.name,
      nameAr: arByCode.get(a.code) ?? a.name,
      // sectors and the units in the Secretary General band report to SG
      parentCode: a.code === "SG" ? "" : sectorOf.get(a.code) ?? "SG",
      sort: sort++,
    });
  }
  return units;
}

type UnitPage = {
  breadcrumb: string[];
  name: string;
  mandate: string[];
  headTitle: string | null;
  headName: string | null;
  /** the whole main region, so the head and the sector blurb can be parsed
      here rather than by re-rendering the site */
  fullText: string;
};

/** Sectors print one descriptive paragraph; departments print a numbered
    mandate. Both end with a profile card: unit name, head title, head name. */
function parseUnitText(
  t: UnitPage | null,
  unitName: string
): { headTitle: string | null; headName: string | null; blurb: string[] } {
  if (!t?.fullText) return { headTitle: null, headName: null, blurb: [] };
  const lines = t.fullText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  let headTitle: string | null = null;
  let headName: string | null = null;
  // walk back from the end to the last repetition of the unit name
  for (let i = lines.length - 1; i >= 0 && i > lines.length - 8; i--) {
    if (lines[i] === unitName && i + 2 < lines.length) {
      headTitle = lines[i + 1];
      headName = lines[i + 2];
      break;
    }
    if (lines[i] === unitName && i + 1 < lines.length) {
      headName = lines[i + 1];
      break;
    }
  }
  // the sector blurb: the paragraph after the title repetition, before the
  // subordinate list
  const blurb: string[] = [];
  const firstTitle = lines.indexOf(unitName);
  const secondTitle = lines.indexOf(unitName, firstTitle + 1);
  const stop = lines.findIndex(
    (l) => /^(Subordinate Departments|الإدارات التابعة)/i.test(l)
  );
  if (secondTitle >= 0) {
    const end = stop > secondTitle ? stop : Math.min(lines.length, secondTitle + 4);
    for (const l of lines.slice(secondTitle + 1, end)) {
      if (l.length > 40 && l !== unitName) blurb.push(l);
    }
  }
  return { headTitle, headName, blurb };
}

async function fetchOrg(): Promise<void> {
  await mkdir(ORG_DIR, { recursive: true });
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());
  const ctx = await browser.newContext({
    userAgent: UA,
    ignoreHTTPSErrors: true,
    viewport: { width: 1600, height: 1200 },
  });
  const page = await ctx.newPage();

  /* The page function is passed as a STRING on purpose: tsx compiles arrow
     functions with an esbuild __name helper that is not defined inside the
     browser, and page.evaluate(fn) would serialise the compiled form. */
  const EXTRACT = `(() => {
    var t = function (el) { return el ? el.innerText.trim() : ""; };
    var crumb = t(document.querySelector("nav.breadcrumbs")).split("/").map(function (s) { return s.trim(); }).filter(Boolean);
    var name = t(document.querySelector(".page-head"));
    var resp = document.querySelector("section.resp");
    var mandate = [];
    if (resp) {
      var items = Array.prototype.slice.call(resp.querySelectorAll("li")).map(t).filter(Boolean);
      mandate = items.length ? items : t(resp).split("\\n").map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 30; });
      if (mandate.length && /Responsibilities|المسؤوليات/.test(mandate[0]) ) mandate = mandate.slice(1);
    }
    if (!mandate.length) {
      var head = document.querySelector(".page-head");
      var para = head && head.parentElement
        ? Array.prototype.slice.call(head.parentElement.querySelectorAll("p")).map(t).filter(function (s) { return s.length > 30; })
        : [];
      mandate = para.slice(0, 3);
    }
    var cards = Array.prototype.slice.call(document.querySelectorAll(".card-head"));
    var last = cards.length ? cards[cards.length - 1] : null;
    var headTitle = null, headName = null;
    if (last && cards.length > 1) {
      var box = last.closest("section, .card, div");
      var lines = box ? t(box).split("\\n").map(function (s) { return s.trim(); }).filter(Boolean) : [];
      var idx = lines.indexOf(t(last));
      var rest = lines.slice(idx + 1);
      if (rest.length >= 2) { headTitle = rest[0]; headName = rest[1]; }
      else if (rest.length === 1) { headName = rest[0]; }
    }
    var region = document.querySelector("#DeltaPlaceHolderMain") || document.body;
    return { breadcrumb: crumb, name: name, mandate: mandate, headTitle: headTitle, headName: headName, fullText: t(region) };
  })()`;

  /** Renders a unit page and pulls the published fields out of the DOM. */
  const readUnit = async (url: string): Promise<UnitPage | null> => {
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
      await page.waitForTimeout(1800);
      return (await page.evaluate(EXTRACT)) as UnitPage;
    } catch (e) {
      console.log(`  unit page failed ${url}: ${(e as Error).message}`);
      return null;
    }
  };

  // 1. the two structure pages, rendered
  const structure: Record<string, string> = {};
  for (const [url, name] of ORG_PAGES) {
    const locale = name.includes("-ar") ? "ar" : "en";
    const file = path.join(ORG_DIR, `rendered-${locale}.html`);
    if (await exists(file, 20_000)) {
      structure[locale] = await readFile(file, "utf8");
      manifest.push({ url, file, bytes: structure[locale].length, method: "cached", fetchedAt: nowIso() });
      console.log(`org: cached ${locale} structure`);
      continue;
    }
    console.log(`org: rendering ${url}`);
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
      await page.waitForTimeout(4000);
      const html = await page.content();
      await writeFile(file, html, "utf8");
      await writeFile(
        path.join(ORG_DIR, `rendered-${locale}.txt`),
        (await page.evaluate(
          `((document.querySelector("#DeltaPlaceHolderMain") || document.body).innerText)`
        )) as string,
        "utf8"
      );
      structure[locale] = html;
      manifest.push({ url, file, bytes: html.length, method: "playwright", fetchedAt: nowIso() });
    } catch (e) {
      manifest.push({
        url,
        file: null,
        bytes: null,
        method: "failed",
        fetchedAt: nowIso(),
        error: (e as Error).message,
      });
    }
  }
  if (!structure.en) {
    console.log("org: the structure page could not be rendered; Section 3 falls back");
    await browser.close();
    return;
  }

  // 2. every unit's own page, both languages
  const raw = parseStructure(structure.en, structure.ar ?? structure.en);
  console.log(`org: ${raw.length} units published`);
  const units: Record<string, unknown>[] = [];
  for (const u of raw) {
    const base = u.kind === "sector" ? "sector" : "department";
    const enUrl = `https://www.npc.qa/en/aboutus/Pages/${base}.aspx?code=${u.code}`;
    const arUrl = `https://www.npc.qa/ar/aboutus/Pages/${base}.aspx?code=${u.code}`;
    const cacheEn = path.join(ORG_DIR, `unit-${u.code}-en.json`);
    let en: UnitPage | null = null;
    let ar: UnitPage | null = null;
    if (await exists(cacheEn, 100)) {
      const cached = JSON.parse(await readFile(cacheEn, "utf8"));
      en = cached.en;
      ar = cached.ar;
    } else {
      en = await readUnit(enUrl);
      ar = await readUnit(arUrl);
      await writeFile(cacheEn, JSON.stringify({ en, ar }, null, 1), "utf8");
    }
    // the breadcrumb is the published parent; trust it over the markup grouping
    let parentCode = u.parentCode;
    if (en?.breadcrumb.length && u.code !== "SG") {
      const parentName = en.breadcrumb[en.breadcrumb.length - 2];
      const match = raw.find((r) => r.nameEn === parentName);
      if (match) parentCode = match.code;
      else if (parentName && /Secretary General/i.test(parentName)) parentCode = "SG";
    }
    const level =
      u.code === "SG"
        ? "secretary_general"
        : u.kind === "sector"
          ? "sector"
          : /^Office of/i.test(u.nameEn)
            ? "office"
            : "department";
    const nameEn = en?.name || u.nameEn;
    const nameAr = ar?.name || u.nameAr;
    const pEn = parseUnitText(en, nameEn);
    const pAr = parseUnitText(ar, nameAr);
    units.push({
      code: u.code,
      level,
      parent_code: parentCode || null,
      name_en: nameEn,
      name_ar: nameAr,
      head_name_en: en?.headName ?? pEn.headName,
      head_name_ar: ar?.headName ?? pAr.headName,
      head_title_en: en?.headTitle ?? pEn.headTitle,
      head_title_ar: ar?.headTitle ?? pAr.headTitle,
      mandate_en: (en?.mandate?.length ? en.mandate : pEn.blurb).join("\n"),
      mandate_ar: (ar?.mandate?.length ? ar.mandate : pAr.blurb).join("\n"),
      source_url: enUrl,
      source_url_ar: arUrl,
      fetched_at: nowIso(),
      sort: u.sort,
    });
    const head = en?.headName ?? pEn.headName;
    console.log(
      `  ${u.code.padEnd(4)} ${level.padEnd(18)} ${nameEn.slice(0, 46).padEnd(46)}${head ? ` | ${head}` : ""}`
    );
  }
  await writeFile(
    path.join(ORG_DIR, "org-structure.json"),
    JSON.stringify(
      {
        source: ORG_PAGES[0][0],
        source_ar: ORG_PAGES[1][0],
        authority:
          "Decision of the Chairman of the National Planning Council No. (13) of 2024",
        fetched_at: nowIso(),
        units,
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`org: org-structure.json written with ${units.length} units`);
  await browser.close();
}

async function main() {
  if (process.env.SKIP_CR07_FETCH === "1") {
    console.log("SKIP_CR07_FETCH=1: reusing whatever is already under sources/");
    return;
  }
  await mkdir(path.join(ROOT, "sources"), { recursive: true });
  await fetchManual().catch((e) => console.log("manual step failed:", (e as Error).message));
  await fetchOrg().catch((e) => console.log("org step failed:", (e as Error).message));
  await writeFile(
    path.join(ROOT, "sources", "cr07-manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );
  console.log(`\ncr07 sources: ${manifest.filter((m) => m.method !== "failed").length} ok, ${manifest.filter((m) => m.method === "failed").length} failed`);
}

main().catch((e) => {
  console.error("fetch-cr07-sources crashed:", e);
  process.exit(0); // never block the run
});
