process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { chromium } from "playwright";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0";
const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());
const ctx = await browser.newContext({ userAgent: UA, ignoreHTTPSErrors: true, viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();
for (const url of [
  "https://www.npc.qa/en/aboutus/Pages/department.aspx?code=IDP",
  "https://www.npc.qa/ar/aboutus/Pages/department.aspx?code=IDP",
  "https://www.npc.qa/en/aboutus/Pages/sector.aspx?code=NPD",
]) {
  console.log("\n===== " + url);
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(3500);
    const main = await page.evaluate(() => {
      const pick = document.querySelector("#DeltaPlaceHolderMain") || document.querySelector("main") || document.body;
      return pick ? pick.innerText : "";
    });
    console.log(main.slice(0, 2500));
  } catch (e) {
    console.log("ERR", e.message);
  }
}
await browser.close();
