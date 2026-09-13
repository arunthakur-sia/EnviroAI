// Probe: during a book pull, inspect computed stacking of the pulled wrap
// and its next neighbour.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch());
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${BASE}/en/login`);
await page.fill("#email", "admin@npc.qa");
await page.fill("#password", "Nexus!2026");
await page.click("button[type=submit]");
await page.waitForURL("**/home");
await page.goto(`${BASE}/en/vault`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const box = await page.locator(':nth-match([data-testid="book"], 4) a').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
await page.waitForTimeout(600);
const info = await page.evaluate(() => {
  const wraps = [...document.querySelectorAll('[data-testid="book"]')];
  const pulled = wraps.find((w) => w.getAttribute("data-pulled") === "true");
  if (!pulled) return "no pulled wrap";
  const next = pulled.nextElementSibling;
  const cs = (el) => {
    const s = getComputedStyle(el);
    return {
      z: s.zIndex,
      pos: s.position,
      transform: s.transform.slice(0, 40),
      willChange: s.willChange,
    };
  };
  return {
    pulledWrap: cs(pulled),
    pulledBook: cs(pulled.querySelector(".book")),
    nextWrap: next ? cs(next) : null,
    nextBook: next ? cs(next.querySelector(".book")) : null,
    parentPerspective: getComputedStyle(pulled.parentElement).perspective,
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
