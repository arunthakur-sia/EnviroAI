process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { chromium } from "playwright";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0";
const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());
const ctx = await browser.newContext({ userAgent: UA, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
await page.goto("https://www.npc.qa/en/aboutus/Pages/department.aspx?code=TO", {
  waitUntil: "networkidle",
  timeout: 90000,
});
await page.waitForTimeout(3000);
const dump = await page.evaluate(() => {
  const main = document.querySelector("#DeltaPlaceHolderMain") || document.body;
  const out = [];
  main.querySelectorAll("*").forEach((el) => {
    const cls = el.className && typeof el.className === "string" ? el.className : "";
    if (!cls) return;
    if (/dept|unit|mandate|resp|head|breadcrumb|manager|director|person|profile|title/i.test(cls)) {
      out.push({
        tag: el.tagName.toLowerCase(),
        cls,
        text: (el.innerText || "").slice(0, 160).replace(/\s+/g, " "),
      });
    }
  });
  return out.slice(0, 60);
});
console.log(JSON.stringify(dump, null, 1));
await browser.close();
