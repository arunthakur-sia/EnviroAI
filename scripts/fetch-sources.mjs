// Downloads public Saudi environment, water and agriculture reference material
// into /sources. The list below is derived from the public URLs recorded in the
// KSA Environmental, Water and Agriculture Data Source Databank (the Source
// Library seed carries the full register; this script only fetches the few
// documents that the knowledge library ingests as full text).
// Zero dependencies. Never throws: every failure is recorded in the manifest and skipped.
// Idempotent: files already present (>1KB) are not re-downloaded.
import { mkdir, writeFile, stat, readFile, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

// Behind a TLS-intercepting corporate proxy whose CA Node does not trust,
// every public site fails verification (UNABLE_TO_VERIFY_LEAF_SIGNATURE).
// Prefer NODE_EXTRA_CA_CERTS. As a last resort, set FETCH_INSECURE_TLS=1 to
// disable verification for this script only (public documents, read-only).
if (process.env.FETCH_INSECURE_TLS === "1") process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const OUT = path.resolve(process.cwd(), "sources");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 EnviroAI-source-fetcher";
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

/* Fixed file names: scripts/seed.ts keys its authored metadata on them. */
const DOCUMENTS = [
  {
    url: "https://www.mewa.gov.sa/en/Ministry/initiatives/SectorStratigy/Documents/6.%20BAH-MEWA-KSA%20NES-CEDA%20Executive%20Summary%20v3%2020180221%20ENG.pdf",
    saveAs: "NES_Executive_Summary_EN.pdf",
    note: "MEWA National Environment Strategy executive summary",
  },
  {
    url: "https://www.jetro.go.jp/ext_images/world/middle_east/sa/law/pdf/National_Environmental_Strategy_ENG.pdf",
    saveAs: "NES_Environmental_Strategy_Mirror_EN.pdf",
    note: "National Environment Strategy, third-party mirror copy",
  },
  {
    url: "https://sgi.gov.sa/media/v4pllu0w/about_saudi_green_initiative_factsheet_en.pdf",
    saveAs: "SGI_Factsheet_EN.pdf",
    note: "Saudi Green Initiative factsheet",
  },
  {
    url: "https://unfccc.int/sites/default/files/2026-01/2nd%20KSA%20NDC%20Document%20Final%20Document%20%2828122025%29_DNA.pdf",
    saveAs: "Saudi_NDC_2025.pdf",
    note: "Saudi Arabia second NDC (UNFCCC)",
  },
  {
    url: "https://ncw.gov.sa/assets/img/open-data/NCW_Annual_Report_2023.pdf",
    saveAs: "NCW_Annual_Report_2023.pdf",
    note: "National Center for Wildlife annual report 2023",
  },
  {
    url: "https://www.mewa.gov.sa/en/Ministry/Agencies/AgencyForInnovation/Topics/Documents/SlmReport-En.pdf",
    saveAs: "Sustainable_Land_Management_Report_EN.pdf",
    note: "MEWA sustainable land management report",
  },
  {
    url: "https://www.irena.org/-/media/Files/IRENA/Agency/Statistics/Statistical_Profiles/Middle%20East/Saudi%20Arabia_Middle%20East_RE_SP.pdf",
    saveAs: "IRENA_Saudi_Arabia_Statistical_Profile.pdf",
    note: "IRENA statistical profile, Saudi Arabia",
  },
  {
    url: "https://enowa.neom.com/ENOWA_Water_Inaugural_ESG_Report.pdf",
    saveAs: "ENOWA_Water_ESG_Report.pdf",
    note: "ENOWA water inaugural ESG report",
  },
  {
    url: "https://sirc.sa/SIRC_2024_Sustainability_Report_English.pdf",
    saveAs: "SIRC_Sustainability_Report_2024.pdf",
    note: "SIRC 2024 sustainability report",
  },
];

/* Public pages from the same databank, kept as text captures. */
const PAGES = [
  { url: "https://sgi.gov.sa/sgi-initiatives/", saveAs: "page_sgi_initiatives.html", note: "Saudi Green Initiative tracker" },
  { url: "https://www.vision2030.gov.sa/en/projects/middle-east-green-initiative/", saveAs: "page_middle_east_green_initiative.html", note: "Middle East Green Initiative" },
  { url: "https://www.mewa.gov.sa/en/Ministry/Agencies/TheWaterAgency/Topics/Pages/Strategy.aspx", saveAs: "page_national_water_strategy_2030.html", note: "National Water Strategy 2030 page" },
  { url: "https://www.mewa.gov.sa/en/Ministry/initiatives/SectorStratigy/Pages/default.aspx", saveAs: "page_mewa_sector_strategy.html", note: "MEWA sector strategy page" },
];

async function run() {
  await mkdir(OUT, { recursive: true });

  for (const d of DOCUMENTS) await grab(d.url, { note: d.note, saveAs: d.saveAs });
  for (const p of PAGES) await grabPage(p.url, p.note, p.saveAs);

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
