process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0";
const OUT = path.join(process.cwd(), "sources", "org");
await mkdir(OUT, { recursive: true });

const PAGES = [
  ["https://www.npc.qa/en/aboutus/Pages/OrganizationalStructure.aspx", "rendered-en"],
  ["https://www.npc.qa/ar/aboutus/Pages/OrganizationalStructure.aspx", "rendered-ar"],
];

const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());
const ctx = await browser.newContext({
  userAgent: UA,
  ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1200 },
});
const page = await ctx.newPage();

for (const [url, name] of PAGES) {
  console.log("== " + url);
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  } catch (e) {
    console.log("goto:", e.message);
  }
  await page.waitForTimeout(6000);
  const html = await page.content();
  await writeFile(path.join(OUT, name + ".html"), html, "utf8");

  // the main content region only
  const main = await page.evaluate(() => {
    const pick =
      document.querySelector("#DeltaPlaceHolderMain") ||
      document.querySelector("main") ||
      document.querySelector("#contentBox") ||
      document.body;
    return pick ? pick.innerText : "";
  });
  await writeFile(path.join(OUT, name + ".txt"), main, "utf8");
  console.log("main text chars:", main.length);
  console.log(main.slice(0, 3000));

  const imgs = await page.evaluate(() =>
    [...document.querySelectorAll("img")]
      .map((i) => ({ src: i.currentSrc || i.src, w: i.naturalWidth, h: i.naturalHeight, alt: i.alt }))
      .filter((i) => i.w > 300 && i.h > 200)
  );
  console.log("large images:", JSON.stringify(imgs, null, 1));
  const frames = page.frames().map((f) => f.url());
  console.log("frames:", JSON.stringify(frames));

  await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: true });
}
await browser.close();
console.log("done");
