/* eslint-disable no-console */
import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const page = await browser.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE:", m.text().slice(0, 800));
  });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 1200)));
  await page.goto("http://localhost:3000/en/login");
  await page.fill("#email", "admin@npc.qa");
  await page.fill("#password", "Nexus!2026");
  await page.click("button[type=submit]");
  await page.waitForURL("**/home", { timeout: 60000 });
  await page.goto("http://localhost:3000/en/indices", { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(2500);
  await browser.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
