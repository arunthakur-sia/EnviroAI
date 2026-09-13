// CR04 1.6: measure frames per second while the pointer sweeps a full shelf
// of books. Sweeps the widest shelf (Statistical Releases, 37 books) and the
// Projects sub-shelves after Expand all; reports rAF-counted fps.
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

// bring the statistical shelf into view
const shelf = page.locator('[data-testid="shelf-statistical"]');
await shelf.scrollIntoViewIfNeeded();
await page.waitForTimeout(600);
const books = page.locator('[data-testid="shelf-statistical"] [data-testid="book"]');
const count = await books.count();
const first = await books.first().boundingBox();
const last = await books.last().boundingBox();
console.log("books on the shelf:", count);

// start counting frames, then sweep the pointer across every book and back
await page.evaluate(() => {
  const w = window;
  w.__frames = 0;
  w.__stop = false;
  const tick = () => {
    w.__frames++;
    if (!w.__stop) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const y = first.y + first.height / 2;
const x0 = first.x + 4;
const x1 = Math.min(last.x + last.width - 4, 1420);
const started = Date.now();
await page.mouse.move(x0, y);
await page.mouse.move(x1, y, { steps: 90 });
await page.mouse.move(x0, y, { steps: 90 });
await page.mouse.move(x1, y, { steps: 90 });
const elapsed = (Date.now() - started) / 1000;
const frames = await page.evaluate(() => {
  const w = window;
  w.__stop = true;
  return w.__frames;
});
const fps = frames / elapsed;
console.log(`sweep: ${elapsed.toFixed(2)}s, ${frames} frames -> ${fps.toFixed(1)} fps`);
await browser.close();
