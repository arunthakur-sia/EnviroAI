/* eslint-disable no-console */
// CR08 4.2 (Indices UI agent): isolates the card "Move to" menu from the drag
// path. Moves the first Governance card to Human Development and back, and
// reports the DOM counts and the persisted membership after each step, so a
// stale section can be told from a failed write.
//   npx tsx scripts/dev-probes/cr08-indices-ui-menu-debug.ts
import { chromium, type Page } from "playwright";

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const FROM = "governance";
const TO = "human";

type GroupRow = { id: string; code: string; memberIds: string[] };

async function counts(page: Page) {
  const f = await page.locator(`[data-group-code="${FROM}"] [data-testid="index-card"]`).count();
  const t = await page.locator(`[data-group-code="${TO}"] [data-testid="index-card"]`).count();
  return `${FROM}=${f} ${TO}=${t}`;
}

async function api(page: Page): Promise<GroupRow[]> {
  const res = await page.request.get(`${BASE}/api/v1/indices/groups`, { timeout: 180000 });
  return ((await res.json()) as { data: GroupRow[] }).data;
}

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|hot-update|hydrat/i.test(m.text())) {
      console.log(`  console error: ${m.text().slice(0, 200)}`);
    }
  });

  await page.request.post(`${BASE}/api/v1/auth/login`, {
    data: { email: "admin@npc.qa", password: "Nexus!2026" },
    timeout: 120000,
  });
  await page.goto(`${BASE}/en/indices`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForSelector('[data-testid="indices-edit-toggle"]', { timeout: 180000 });
  await page.waitForFunction(
    `(() => { const el = document.querySelector('[data-testid="group-switcher"]'); return !!el && Object.keys(el).some((k) => k.startsWith('__reactFiber')); })()`,
    undefined,
    { timeout: 300000, polling: 500 }
  );
  await page.click('[data-testid="indices-edit-toggle"]');
  await page.waitForSelector('[data-testid="edit-hint"]', { timeout: 30000 });
  console.log(`edit mode on: ${await counts(page)}`);

  const groups = await api(page);
  const fromId = groups.find((g) => g.code === FROM)!.id;
  const toId = groups.find((g) => g.code === TO)!.id;

  const code = await page
    .locator(`[data-group-code="${FROM}"] [data-testid="index-card"]`)
    .first()
    .getAttribute("data-index-code");
  console.log(`moving ${code}`);

  // FROM -> TO: through the menu, or (with --drag) through the same dispatched
  // DragEvents the probe falls back to, so the probe's exact sequence is
  // reproduced rather than an approximation of it
  if (process.argv.includes("--drag")) {
    await page.evaluate(
      `(async ([s, t]) => { const src = document.querySelector(s); const dst = document.querySelector(t); if (!src || !dst) return 'missing'; const dt = new DataTransfer(); const tick = () => new Promise((r) => setTimeout(r, 60)); const fire = (type, el) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt })); fire('dragstart', src); await tick(); fire('dragenter', dst); await tick(); fire('dragover', dst); await tick(); fire('drop', dst); await tick(); fire('dragend', src); return 'ok'; })(${JSON.stringify(
        [`[data-group-code="${FROM}"] [data-index-code="${code}"]`, `[data-group-code="${TO}"] [data-testid="group-dropzone"]`]
      )})`
    );
    console.log("  (moved by dispatched DragEvents)");
  } else {
    await page
      .locator(`[data-group-code="${FROM}"] [data-index-code="${code}"] [data-testid="card-move-select"]`)
      .selectOption(`move:${toId}`);
  }
  await page.waitForTimeout(2500);
  console.log(`after menu ${FROM}->${TO}: ${await counts(page)}`);
  const a = await api(page);
  console.log(
    `  api: ${FROM}=${a.find((g) => g.code === FROM)!.memberIds.length} ${TO}=${a.find((g) => g.code === TO)!.memberIds.length}`
  );
  await page.waitForTimeout(2000);
  console.log(`  dom again: ${await counts(page)}`);

  // TO -> FROM through the menu
  const back = page.locator(`[data-group-code="${TO}"] [data-index-code="${code}"] [data-testid="card-move-select"]`);
  console.log(`  card visible in ${TO}: ${await back.count()}`);
  await back.selectOption(`move:${fromId}`);
  await page.waitForTimeout(2500);
  console.log(`after menu ${TO}->${FROM}: ${await counts(page)}`);
  const b = await api(page);
  console.log(
    `  api: ${FROM}=${b.find((g) => g.code === FROM)!.memberIds.length} ${TO}=${b.find((g) => g.code === TO)!.memberIds.length}`
  );
  await page.waitForTimeout(2500);
  console.log(`  dom again: ${await counts(page)}`);
  console.log(
    `  card visible in ${FROM}: ${await page.locator(`[data-group-code="${FROM}"] [data-index-code="${code}"]`).count()}`
  );
  // where did the DOM put it, if anywhere?
  const where = await page.evaluate(
    `(() => { const els = Array.from(document.querySelectorAll('[data-index-code=${JSON.stringify(code)}]')); return els.map((e) => e.closest('[data-group-code]')?.getAttribute('data-group-code') ?? 'none'); })()`
  );
  console.log(`  DOM sections holding the card: ${JSON.stringify(where)}`);

  // does a stale section converge on its own data after a reload?
  await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForSelector('[data-testid="group-switcher"]', { timeout: 180000 });
  await page.waitForTimeout(1500);
  console.log(`after reload: ${await counts(page)}`);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
