// Probe: hover a radar blip and report whether the hover card appears.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/en/login`);
await page.fill("#email", "admin@npc.qa");
await page.fill("#password", "Nexus!2026");
await page.click("button[type=submit]");
await page.waitForURL("**/home", { timeout: 60000 });
await page.goto(`${BASE}/en/trends`, { waitUntil: "networkidle" });
await page.waitForTimeout(2600);
const blips = page.locator('[data-testid="signal-radar"] circle[role="button"]');
console.log("blips:", await blips.count());
const first = blips.first();
console.log("visible:", await first.isVisible());
const box = await first.boundingBox();
console.log("box:", JSON.stringify(box));
if (box) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const under = await page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return el ? `${el.tagName}.${el.getAttribute("class") ?? ""}#${el.getAttribute("role") ?? ""}` : "none";
    },
    [cx, cy]
  );
  console.log("element under pointer:", under);
  await page.mouse.move(cx - 40, cy - 40);
  await page.mouse.move(cx, cy, { steps: 8 });
  await page.waitForTimeout(700);
  const cardCount = await page
    .locator('[data-testid="signal-radar"] .card')
    .count();
  console.log("hover cards:", cardCount);
  await page.screenshot({ path: "data/screenshots/cr03/trends-en-1440-hover.png" });
  console.log("saved");
}
await browser.close();
