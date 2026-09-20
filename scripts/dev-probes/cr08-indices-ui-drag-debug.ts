/* eslint-disable no-console */
// CR08 (Indices UI agent): where does a drag between groups break? Dispatches
// the HTML5 drag events one by one on the board in edit mode and reads the
// DOM state React should produce after each (aria-grabbed on the source,
// the drop highlight on the target, the member counts), then tries the real
// pointer. Restores the seeded membership through the API afterwards.
//
// Page functions are passed as self-invoking expression STRINGS: tsx's
// esbuild output adds a __name helper that does not exist in the browser,
// and a bare "(x) => ..." string evaluates to a function value that
// Playwright returns unserialised instead of calling.
//   npx tsx scripts/dev-probes/cr08-indices-ui-drag-debug.ts
import { chromium, type Page } from "playwright";

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";
const FROM = "governance";
const TO = "human";

/** page.evaluate of `(fn)(arg)` so the function actually runs in the page. */
function evalWith<T>(page: Page, fn: string, arg: unknown): Promise<T> {
  return page.evaluate(`(${fn})(${JSON.stringify(arg)})`) as Promise<T>;
}

async function main() {
  const browser = await chromium.launch({ channel: "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(180000);
  page.on("console", (m) => {
    if (m.type() === "error") console.log("  console:", m.type(), m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => console.log("  pageerror:", String(e).slice(0, 300)));
  page.on("response", async (r) => {
    if (r.url().includes("/api/v1/indices/groups")) {
      console.log("  response:", r.request().method(), r.url().replace(BASE, ""), r.status());
    }
  });
  let status = 0;
  for (let attempt = 0; attempt < 10 && status !== 200; attempt++) {
    const res = await page.request.post(`${BASE}/api/v1/auth/login`, { data: { email: "admin@npc.qa", password: "Nexus!2026" }, timeout: 120000 });
    status = res.status();
    if (status !== 200) await page.waitForTimeout(10000);
  }
  if (status !== 200) throw new Error("login failed");
  const groupsApi = await (await page.request.get(`${BASE}/api/v1/indices/groups`)).json();
  const before = Object.fromEntries((groupsApi.data as { code: string; id: string; memberIds: string[] }[]).map((g) => [g.code, g.memberIds]));
  const idOf = Object.fromEntries((groupsApi.data as { code: string; id: string }[]).map((g) => [g.code, g.id]));

  await page.goto(`${BASE}/en/indices`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="group-switcher"]');
  await page.waitForFunction(
    "(() => { const el = document.querySelector('[data-testid=group-switcher]'); return !!el && Object.keys(el).some((k) => k.startsWith('__reactFiber')); })()",
    undefined,
    { timeout: 300000, polling: 500 }
  );
  console.log("hydrated");
  await page.click('[data-testid="indices-edit-toggle"]');
  await page.waitForSelector('[data-testid="edit-hint"]', { timeout: 15000 });
  const countIn = (code: string) => page.locator(`[data-group-code="${code}"] [data-testid="index-card"]`).count();
  console.log(`counts: ${FROM}=${await countIn(FROM)} ${TO}=${await countIn(TO)}`);
  const code = await page.locator(`[data-group-code="${FROM}"] [data-testid="index-card"]`).first().getAttribute("data-index-code");
  const srcSel = `[data-group-code="${FROM}"] [data-testid="index-card"][data-index-code="${code}"]`;
  const dstSel = `[data-group-code="${TO}"] [data-testid="group-dropzone"]`;
  console.log(`moving ${code}; source group-id attr = ${await page.getAttribute(srcSel, "data-group-id")} (api ${idOf[FROM]}); target zone exists = ${(await page.locator(dstSel).count()) === 1}`);

  console.log(
    "  source node:",
    await evalWith(
      page,
      "(sel) => { const el = document.querySelector(sel); if (!el) return 'missing'; const propsKey = Object.keys(el).find((k) => k.startsWith('__reactProps')); const props = propsKey ? el[propsKey] : null; return JSON.stringify({ draggable: el.getAttribute('draggable'), hasFiber: Object.keys(el).some((k) => k.startsWith('__reactFiber')), hasOnDragStart: !!(props && props.onDragStart), hasOnDrop: !!(props && props.onDrop) }); }",
      srcSel
    )
  );
  console.log(
    "  scroll container:",
    await evalWith(
      page,
      "(sel) => { let el = document.querySelector(sel); const out = []; while (el && el !== document.body) { const cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY)) out.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 60), scrollTop: el.scrollTop, clientH: el.clientHeight, scrollH: el.scrollHeight }); el = el.parentElement; } return JSON.stringify({ containers: out, windowY: window.scrollY, docTop: document.scrollingElement && document.scrollingElement.scrollTop }); }",
      dstSel
    )
  );

  const state = async (label: string) => {
    // the source selector vanishes the moment the card moves: never wait on it
    const grabbed = (await page.locator(srcSel).count()) ? await page.getAttribute(srcSel, "aria-grabbed", { timeout: 5000 }) : "(moved)";
    const dstClass = (await page.getAttribute(dstSel, "class", { timeout: 5000 }).catch(() => "")) ?? "";
    console.log(`  after ${label}: aria-grabbed=${grabbed} target-highlight=${dstClass.includes("border-gold-500")} ${FROM}=${await countIn(FROM)} ${TO}=${await countIn(TO)}`);
  };
  const fire = async (type: string, sel: string) => {
    const ret = await evalWith(
      page,
      "([type, sel]) => { const el = document.querySelector(sel); if (!el) return 'missing'; if (!window.__dt) window.__dt = new DataTransfer(); const ev = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: window.__dt }); const r = el.dispatchEvent(ev); return JSON.stringify({ dispatched: r, hasDataTransfer: !!ev.dataTransfer }); }",
      [type, sel]
    );
    console.log(`  fire ${type}: ${ret}`);
    await page.waitForTimeout(200);
    await state(type);
  };
  console.log("dispatched events:");
  try {
  await fire("dragstart", srcSel);
  await fire("dragenter", dstSel);
  await fire("dragover", dstSel);
  await fire("drop", dstSel);
  await fire("dragend", srcSel);
  await page.waitForTimeout(1200);
  await state("settle");

  let now = await countIn(TO);
  const movedByEvents = now !== (before[TO]?.length ?? 0);
  if (movedByEvents) {
    // put it back through the API before the pointer attempt
    await page.request.put(`${BASE}/api/v1/indices/groups/members`, {
      data: { groups: [{ groupId: idOf[FROM], indexIds: before[FROM] }, { groupId: idOf[TO], indexIds: before[TO] }] },
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      "(() => { const el = document.querySelector('[data-testid=group-switcher]'); return !!el && Object.keys(el).some((k) => k.startsWith('__reactFiber')); })()",
      undefined,
      { timeout: 300000, polling: 500 }
    );
    await page.click('[data-testid="indices-edit-toggle"]');
    await page.waitForSelector('[data-testid="edit-hint"]', { timeout: 15000 });
  }
  console.log("pointer drag:");
  const scrolled = await evalWith(
    page,
    "(sel) => { const el = document.querySelector(sel); const before = el.getBoundingClientRect().top; el.scrollIntoView({ block: 'center', behavior: 'instant' }); const after = el.getBoundingClientRect().top; return JSON.stringify({ before, after, windowY: window.scrollY }); }",
    dstSel
  );
  console.log("  scrollIntoView:", scrolled);
  await page.waitForTimeout(300);
  const sb = await page.locator(`${srcSel} [data-testid="card-grip"]`).boundingBox();
  const tb = await page.locator(dstSel).boundingBox();
  console.log("  boxes", JSON.stringify(sb), JSON.stringify(tb));
  if (sb && tb && sb.y >= 0 && sb.y < 900 && tb.y >= 0 && tb.y < 900) {
    await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
    await page.mouse.down();
    await page.mouse.move(sb.x + 10, sb.y + 10, { steps: 3 });
    await state("mousedown+move");
    await page.mouse.move(tb.x + tb.width / 2, tb.y + 30, { steps: 15 });
    await state("moved over target");
    await page.mouse.up();
    await page.waitForTimeout(1200);
    await state("mouseup");
  } else {
    console.log("  source and target not both in the viewport; pointer path skipped");
  }
  now = await countIn(TO);
  console.log(`result: events=${movedByEvents ? "moved" : "no"} pointer=${now !== (before[TO]?.length ?? 0) ? "moved" : "no"}`);
  } finally {
  // restore, whatever happened above
  const after = await (await page.request.get(`${BASE}/api/v1/indices/groups`)).json();
  const changed = (after.data as { code: string; id: string; memberIds: string[] }[]).filter(
    (g) => (before[g.code] ?? []).join(",") !== g.memberIds.join(",")
  );
  if (changed.length) {
    await page.request.put(`${BASE}/api/v1/indices/groups/members`, {
      data: { groups: changed.map((g) => ({ groupId: g.id, indexIds: before[g.code] ?? [] })) },
    });
    console.log("restored", changed.map((g) => g.code).join(", "));
  }
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
