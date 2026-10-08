/* eslint-disable no-console */
// CR08 1: traces the pointer events of a drag in the structure editor.
//   npx tsx scripts/dev-probes/cr08-org-drag.ts
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.request.post(`${BASE}/api/v1/auth/login`, { data: { email: "admin@enviroai.demo", password: "EnviroAI!2026" }, timeout: 120000 });
  await page.goto(`${BASE}/en/settings?tab=organisation`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForSelector("[data-testid=org-editor-row][data-unit-code=IS]", { timeout: 120000 });
  await page.waitForTimeout(1000);
  await page.evaluate(
    "window.__ev = []; for (const t of ['pointerdown','pointermove','pointerup','pointercancel','gotpointercapture','lostpointercapture']) document.addEventListener(t, (e) => { const el = e.target; window.__ev.push(t + ' @' + Math.round(e.clientX) + ',' + Math.round(e.clientY) + ' on ' + (el.getAttribute && (el.getAttribute('data-testid') || el.tagName)) + ' captured=' + (el.hasPointerCapture ? el.hasPointerCapture(e.pointerId) : '?')); }, true);"
  );
  const handle = page.locator("[data-testid=org-editor-row][data-unit-code=IS] [data-testid=org-editor-drag]");
  const hb = await handle.boundingBox();
  const target = page.locator("[data-testid=org-editor-row][data-unit-code=CA]");
  const tb = await target.boundingBox();
  console.log("handle", hb, "target", tb);
  if (!hb || !tb) throw new Error("no boxes");
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(100);
  await page.mouse.move(tb.x + 200, tb.y + 12, { steps: 10 });
  await page.waitForTimeout(400);
  const state = await page.evaluate(
    "({ preview: document.querySelectorAll('[data-testid=org-move-preview]').length, isParent: document.querySelector('[data-testid=org-editor-row][data-unit-code=IS]').getAttribute('data-parent-code'), over: [...document.querySelectorAll('[data-drop-target]')].map(r => r.getAttribute('data-unit-code')), under: (() => { const el = document.elementFromPoint(" +
      Math.round(tb.x + 200) +
      ", " +
      Math.round(tb.y + 12) +
      "); return el ? (el.closest('[data-unit-id]') ? el.closest('[data-unit-id]').getAttribute('data-unit-code') : 'no row: ' + el.tagName + '.' + el.className) : null; })() })"
  );
  console.log("state while hovering:", JSON.stringify(state));
  await page.screenshot({ path: "data/screenshots/cr08/org-settings-drag-preview-en.png" });
  await page.mouse.up();
  await page.waitForTimeout(600);
  const dialog = await page.locator("[data-testid=org-move-dialog]").count();
  console.log("move dialog after drop:", dialog);
  console.log((await page.evaluate("window.__ev.slice(0, 40).join('\\n')")) as string);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
