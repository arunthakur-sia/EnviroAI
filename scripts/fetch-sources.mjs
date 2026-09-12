// Downloads public NPC material into /sources per NPC_KMS_BLUEPRINT.md section 12.1.
// Zero dependencies. Never throws: every failure is recorded in the manifest and skipped.
// Idempotent: files already present (>1KB) are not re-downloaded.
import { mkdir, writeFile, stat, readFile, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

// This machine sits behind a TLS-intercepting corporate proxy whose CA Node does
// not trust (UNABLE_TO_VERIFY_LEAF_SIGNATURE on every public site). These are all
// public documents fetched read-only, so verification is disabled for this script only.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const OUT = path.resolve(process.cwd(), "sources");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 SiaNexus-prototype-fetcher";
const RATE_MS = 500;
const manifest = [];
let lastRequest = 0;

function sanitize(url) {
  const u = new URL(url);
  let name = (u.pathname + (u.search ? "_" + u.search : ""))
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(-120);
  if (!name) name = "index";
  return `${u.hostname.replace(/[^a-z0-9.]/gi, "")}_${name}`;
}

async function rateLimit() {
  const wait = lastRequest + RATE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
}

async function exists(file) {
  try {
    return (await stat(file)).size > 1000;
  } catch {
    return false;
  }
}

async function fetchRaw(url, timeoutMs = 90_000) {
  await rateLimit();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: {
        "user-agent": UA,
        accept:
          "text/html,application/xhtml+xml,application/pdf,application/vnd.ms-excel,*/*;q=0.8",
        "accept-language": "en,ar;q=0.8",
      },
      redirect: "follow",
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

/** Download url to /sources. Returns {ok, file, buf?, html?} */
async function grab(url, { note = "", saveAs = null, wantText = false } = {}) {
  const filename = saveAs || sanitize(url);
  const dest = path.join(OUT, filename);
  if (await exists(dest)) {
    const buf = wantText ? await readFile(dest) : null;
    manifest.push({ url, filename, status: "exists", notes: note });
    return { ok: true, file: dest, buf };
  }
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const res = await fetchRaw(url);
      if (!res.ok) {
        if (attempt === 2) {
          manifest.push({ url, filename, status: `http_${res.status}`, notes: note });
          return { ok: false };
        }
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 200) {
        manifest.push({ url, filename, status: "too_small", notes: note });
        return { ok: false };
      }
      if (/\.pdf$/i.test(filename) && buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
        manifest.push({ url, filename, status: "not_a_pdf", notes: note });
        return { ok: false };
      }
      await writeFile(dest, buf);
      const sha256 = createHash("sha256").update(buf).digest("hex");
      manifest.push({
        url,
        filename,
        sha256,
        bytes: buf.length,
        fetched_at: new Date().toISOString(),
        status: "ok",
        notes: note,
        content_type: res.headers.get("content-type") || "",
      });
      console.log(`ok  ${filename} (${buf.length}b)`);
      return { ok: true, file: dest, buf };
    } catch (e) {
      if (attempt === 2) {
        manifest.push({ url, filename, status: "error:" + String(e?.cause?.code || e?.name || e).slice(0, 60), notes: note });
        console.log(`ERR ${url}`);
        return { ok: false };
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  return { ok: false };
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#160;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function grabPage(url, note, saveAs) {
  const r = await grab(url, { note, saveAs, wantText: true });
  if (r.ok && r.buf) {
    const html = r.buf.toString("utf8");
    const txtFile = (saveAs || sanitize(url)).replace(/\.[a-z]*$/i, "") + ".txt";
    try {
      await writeFile(path.join(OUT, txtFile), stripHtml(html));
    } catch { /* non-fatal */ }
    return html;
  }
  return null;
}

function extractLinks(html, baseUrl) {
  const links = new Set();
  const re = /href=["']([^"'#]+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      links.add(new URL(m[1], baseUrl).href);
    } catch { /* skip bad urls */ }
  }
  return [...links];
}

async function run() {
  await mkdir(OUT, { recursive: true });

  // 1 + 2: NDS3 PDFs
  await grab("https://www.npc.qa/en/planning/nds3/Documents/QNDS3_EN.pdf", {
    note: "NDS3 English PDF",
    saveAs: "QNDS3_EN.pdf",
  });
  const ndsAr = await grab("https://www.npc.qa/ar/planning/nds3/Documents/QNDS3_AR.pdf", {
    note: "NDS3 Arabic PDF",
    saveAs: "QNDS3_AR.pdf",
  });
  if (!ndsAr.ok) {
    const arPage = await grabPage(
      "https://www.npc.qa/ar/planning/nds3/Pages/default.aspx",
      "NDS3 Arabic overview page (looking for AR PDF link)",
      "npc_nds3_overview_ar.html"
    );
    if (arPage) {
      const pdfLink = extractLinks(arPage, "https://www.npc.qa").find((l) =>
        /nds3.*\.pdf$/i.test(l)
      );
      if (pdfLink) await grab(pdfLink, { note: "NDS3 Arabic PDF via page", saveAs: "QNDS3_AR.pdf" });
    }
  }

  // 3 + 4: about + overview pages
  await grabPage("https://www.npc.qa/en/aboutus/pages/default.aspx", "NPC about EN", "npc_about_en.html");
  await grabPage("https://www.npc.qa/ar/aboutus/pages/default.aspx", "NPC about AR", "npc_about_ar.html");
  await grabPage("https://www.npc.qa/en/planning/nds3/Pages/default.aspx", "NDS3 overview EN", "npc_nds3_overview_en.html");

  // 5: news crawl
  for (const [locale, listUrl] of [
    ["en", "https://www.npc.qa/en/media/pages/news/"],
    ["ar", "https://www.npc.qa/ar/media/pages/news/"],
  ]) {
    const listing = await grabPage(listUrl, `news listing ${locale}`, `npc_news_listing_${locale}.html`);
    const newsLinks = new Set([
      `https://www.npc.qa/${locale}/media/pages/news/27042025.aspx`,
    ]);
    if (listing) {
      for (const l of extractLinks(listing, listUrl)) {
        if (new RegExp(`/${locale}/media/pages/news/[^/]+\\.aspx$`, "i").test(l)) newsLinks.add(l);
        if (newsLinks.size >= 40) break;
      }
    }
    for (const l of newsLinks) {
      await grabPage(l, `news item ${locale}`, `npc_news_${locale}_` + sanitize(l).slice(-60));
    }
  }

  // 6: GCO articles
  const gco = [
    "https://www.gco.gov.qa/en/media-centre/top-news/the-general-secretariat-of-the-council-of-ministers-highlights-the-objectives-and-competencies-of-the-national-planning-council/",
    "https://www.gco.gov.qa/en/media-centre/top-news/national-planning-council-launches-national-data-and-statistics-strategy/",
    "https://www.gco.gov.qa/ar/media-centre/top-news/the-general-secretariat-of-the-council-of-ministers-highlights-the-objectives-and-competencies-of-the-national-planning-council/",
    "https://www.gco.gov.qa/ar/media-centre/top-news/national-planning-council-launches-national-data-and-statistics-strategy/",
  ];
  for (const u of gco) await grabPage(u, "GCO article");

  // 7: statistics section crawl for downloadable releases
  const statPages = [
    "https://www.npc.qa/en/statistics/pages/default.aspx",
    "https://www.npc.qa/en/statistics/pages/subjectdetails.aspx",
    "https://www.npc.qa/en/statistics1/pages/default.aspx",
  ];
  const fileLinks = new Set();
  for (const p of statPages) {
    const html = await grabPage(p, "statistics page");
    if (!html) continue;
    for (const l of extractLinks(html, p)) {
      if (/\.(pdf|xlsx?|csv)(\?|$)/i.test(l) && /npc\.qa/i.test(l)) fileLinks.add(l);
      // follow one level of statistics subject pages
      if (/statistics.*\.aspx$/i.test(l) && fileLinks.size < 5 && /npc\.qa/i.test(l)) {
        const sub = await grabPage(l, "statistics subject page");
        if (sub) for (const l2 of extractLinks(sub, l)) {
          if (/\.(pdf|xlsx?|csv)(\?|$)/i.test(l2) && /npc\.qa/i.test(l2)) fileLinks.add(l2);
        }
      }
      if (fileLinks.size >= 40) break;
    }
  }
  let statCount = 0;
  for (const l of fileLinks) {
    if (statCount++ >= 40) break;
    await grab(l, { note: "statistics release file" });
  }

  // 8: Open Data Portal. Paginate the whole catalog, then export the most
  // statistically relevant datasets (population, prices, GDP, trade, labour, permits).
  try {
    const all = [];
    for (let offset = 0; offset <= 1000; offset += 100) {
      const r = await grab(
        `https://www.data.gov.qa/api/explore/v2.1/catalog/datasets?limit=100&offset=${offset}`,
        { note: "open data catalog page", saveAs: `opendata_catalog_${offset}.json`, wantText: true }
      );
      if (!r.ok) break;
      const raw = (r.buf ?? (await readFile(path.join(OUT, `opendata_catalog_${offset}.json`)))).toString("utf8");
      const json = JSON.parse(raw);
      const results = json.results || [];
      all.push(...results);
      if (results.length < 100) break;
    }
    await writeFile(
      path.join(OUT, "opendata_catalog.json"),
      JSON.stringify({ total: all.length, results: all })
    );
    const priority = [
      /monthly.*population|population.*month|total population/i,
      /consumer price|cpi/i,
      /gross domestic|gdp|national accounts/i,
      /foreign trade|exports|imports|trade balance/i,
      /labou?r force|employment|unemployment/i,
      /building permit/i,
      /education|students|schools/i,
      /health|hospital/i,
    ];
    const scored = all
      .map((d) => {
        const id = d.dataset_id || d.datasetid || d.dataset?.dataset_id;
        const title = String(d.metas?.default?.title || d.metas?.title || d.title || id || "");
        const idx = priority.findIndex((re) => re.test(title));
        const records = d.metas?.default?.records_count || 0;
        return { id, title, idx: idx === -1 ? 99 : idx, records };
      })
      .filter((d) => d.id && d.idx < 99 && !/sdg/i.test(d.title))
      .sort((a, b) => a.idx - b.idx || b.records - a.records)
      .slice(0, 25);
    for (const d of scored) {
      await grab(
        `https://www.data.gov.qa/api/explore/v2.1/catalog/datasets/${d.id}/exports/csv?limit=-1`,
        { note: `open data csv: ${d.title.slice(0, 80)}`, saveAs: `opendata_${d.id}.csv` }
      );
    }
  } catch (e) {
    manifest.push({ url: "opendata", filename: "-", status: "error:" + String(e).slice(0, 80) });
  }

  // 9: QNV 2030 candidates
  for (const u of [
    "https://www.npc.qa/en/qnv/Documents/QNV2030_English_v2.pdf",
    "https://www.psa.gov.qa/en/qnv1/Documents/QNV2030_English_v2.pdf",
    "https://www.gco.gov.qa/wp-content/uploads/2016/09/GCO-QNV-English.pdf",
  ]) {
    const r = await grab(u, { note: "QNV 2030 candidate", saveAs: "QNV2030_EN.pdf" });
    if (r.ok) break;
  }
  for (const u of [
    "https://www.npc.qa/ar/qnv/Documents/QNV2030_Arabic_v2.pdf",
    "https://www.psa.gov.qa/ar/qnv1/Documents/QNV2030_Arabic_v2.pdf",
  ]) {
    const r = await grab(u, { note: "QNV 2030 Arabic candidate", saveAs: "QNV2030_AR.pdf" });
    if (r.ok) break;
  }

  // 10: NDS2 candidates
  for (const u of [
    "https://www.npc.qa/en/planning/Documents/NDS2Final.pdf",
    "https://www.psa.gov.qa/en/knowledge/Documents/NDS2Final.pdf",
    "https://www.psa.gov.qa/en/knowledge/Doc/NDS2Final.pdf",
    "https://www.mdps.gov.qa/en/knowledge/Documents/NDS2Final.pdf",
    "https://www.psa.gov.qa/en/nds/Documents/NDS2Final.pdf",
  ]) {
    const r = await grab(u, { note: "NDS2 English candidate", saveAs: "NDS2_EN.pdf" });
    if (r.ok) break;
  }
  for (const u of [
    "https://www.psa.gov.qa/ar/knowledge/Documents/NDS2Final_AR.pdf",
    "https://www.psa.gov.qa/ar/nds/Documents/NDS2Final_AR.pdf",
  ]) {
    const r = await grab(u, { note: "NDS2 Arabic candidate", saveAs: "NDS2_AR.pdf" });
    if (r.ok) break;
  }

  // 11: NDS1 candidates (official publication mirrored on UN/planning sites is acceptable)
  for (const u of [
    "https://www.psa.gov.qa/en/knowledge/Documents/NDS_EN.pdf",
    "https://www.psa.gov.qa/en/nds1/Documents/NDS_EN.pdf",
    "https://www.mdps.gov.qa/en/knowledge/HomePagePublications/Qatar_NDS_reprint_complete_lowres_16May.pdf",
    "https://planipolis.iiep.unesco.org/sites/default/files/ressources/qatar_national_development_strategy.pdf",
    "https://www.ilo.org/dyn/natlex/docs/ELECTRONIC/97619/115906/F-1541514465/QAT97619.pdf",
  ]) {
    const r = await grab(u, { note: "NDS1 English candidate", saveAs: "NDS1_EN.pdf" });
    if (r.ok) break;
  }

  // 12: other NPC documents linked from crawled pages (data policy, standards, guidebook)
  const interesting = /data[-_ ]?polic|data[-_ ]?standard|enablement|guidebook|trust[-_ ]?index/i;
  const crawled = manifest.filter((m) => m.status === "ok" && m.filename.endsWith(".html"));
  for (const c of crawled.slice(0, 10)) {
    try {
      const html = (await readFile(path.join(OUT, c.filename))).toString("utf8");
      for (const l of extractLinks(html, c.url)) {
        if (/\.pdf(\?|$)/i.test(l) && interesting.test(l)) {
          await grab(l, { note: "linked NPC document" });
        }
      }
    } catch { /* skip */ }
  }

  // write manifest + SOURCES.md
  await writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  const ok = manifest.filter((m) => m.status === "ok" || m.status === "exists");
  const failed = manifest.filter((m) => m.status !== "ok" && m.status !== "exists");
  const md = [
    "# SOURCES",
    "",
    `Fetched ${ok.length} items, ${failed.length} failed, at ${new Date().toISOString()}.`,
    "",
    "## Fetched",
    ...ok.map((m) => `- ${m.filename} (${m.bytes || "cached"}) from ${m.url} ${m.notes ? "- " + m.notes : ""}`),
    "",
    "## Not fetched",
    ...failed.map((m) => `- ${m.url} -> ${m.status} ${m.notes ? "- " + m.notes : ""}`),
    "",
  ].join("\n");
  await writeFile(path.join(OUT, "SOURCES.md"), md);
  console.log(`sources done: ${ok.length} ok, ${failed.length} failed`);
}

run().catch(async (e) => {
  console.error("fetch-sources top-level failure", e);
  try {
    await mkdir(OUT, { recursive: true });
    await writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  } catch { /* give up quietly */ }
  process.exitCode = 0; // never block the build
});
