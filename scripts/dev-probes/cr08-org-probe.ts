/* eslint-disable no-console */
// CR08 1: drives the Organisation chart and the Settings editor in system Edge
// against the shared dev server, in both locales, and writes screenshots to
// data/screenshots/cr08/org-*.png. Every page.evaluate is passed a STRING
// (tsx's __name helper is not defined in the browser).
//   npx tsx scripts/dev-probes/cr08-org-probe.ts [chart|settings|all]
import { chromium, type Page, type BrowserContext } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr08");
const PART = process.argv[2] ?? "all";
const PASSWORD = "Nexus!2026";

const problems: string[] = [];
const notes: string[] = [];
function expect(name: string, ok: boolean, detail?: string) {
  (ok ? notes : problems).push(`${ok ? "ok " : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
}

/** The shared dev server is busy with other agents' probes: retry the login. */
async function login(ctx: BrowserContext, email: string) {
  const page = await ctx.newPage();
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await page.request.post(`${BASE}/api/v1/auth/login`, {
        data: { email, password: PASSWORD },
        timeout: 120000,
      });
      console.log(`login ${email}: ${res.status()}${attempt > 1 ? ` (attempt ${attempt})` : ""}`);
      if (res.status() === 200) break;
    } catch (e) {
      console.log(`login ${email}: ${String(e).slice(0, 80)} (attempt ${attempt})`);
    }
    await page.waitForTimeout(4000);
  }
  await page.close();
}

/** Two hydration mismatches belong to the shell, not to this module (see
    docs/design-reviews/cr08-organisation.md): the SettingsTabs deep link and
    the Radix id sequence. They are reported as notes, not failures. */
const KNOWN_SHELL = [/<SettingsTabs/, /radix-_R_/, /A tree hydrated but some attributes/];

function watch(page: Page, errors: string[]) {
  const push = (text: string) => {
    if (KNOWN_SHELL.some((re) => re.test(text))) {
      const line = `note (shell) ${text.replace(/\s+/g, " ").slice(0, 120)}`;
      notes.push(line);
      console.log(`  ${line}`);
      return;
    }
    errors.push(text);
  };
  page.on("console", (m) => {
    if (m.type() === "error") push(`console: ${m.text().replace(/\s+/g, " ").slice(0, 1500)}`);
  });
  page.on("pageerror", (e) => push(`pageerror: ${String(e).slice(0, 600)}`));
}

/** polls a count until it reaches the target or the time runs out */
async function waitForCount(page: Page, selector: string, target: number, ms = 10000): Promise<number> {
  const until = Date.now() + ms;
  let count = 0;
  while (Date.now() < until) {
    count = await page.locator(selector).count();
    if (count >= target) return count;
    await page.waitForTimeout(300);
  }
  return count;
}

async function shot(page: Page, name: string, fullPage = false) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
  console.log(`  shot ${name}.png`);
}

const NODE_COUNT = "document.querySelectorAll('[data-testid=org-chart] [data-testid=org-unit-card]').length";
const ROOT_TRANSFORM =
  "(() => { const g = document.querySelector('[data-testid=org-chart] svg > g'); return g ? g.getAttribute('transform') : null; })()";
const CHART_HEIGHT = "document.querySelector('[data-testid=org-chart]').getBoundingClientRect().height";
const ACTIVE_CODE = "(document.activeElement && document.activeElement.getAttribute('data-unit-code')) || null";

async function chartPart(browser: import("playwright").Browser) {
  for (const locale of PART === "request" ? ([] as const) : (["en", "ar"] as const)) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await login(ctx, "admin@npc.qa");
    const page = await ctx.newPage();
    const errors: string[] = [];
    watch(page, errors);
    console.log(`== chart ${locale}`);
    await page.goto(`${BASE}/${locale}/organisation`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForSelector("[data-testid=org-chart] [data-testid=org-unit-card]", { timeout: 60000 });
    await page.waitForTimeout(1200);

    const count = (await page.evaluate(NODE_COUNT)) as number;
    const transform = (await page.evaluate(ROOT_TRANSFORM)) as string | null;
    const height = (await page.evaluate(CHART_HEIGHT)) as number;
    const noGrowth = (await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")) as boolean;
    const rail = (await page.evaluate(
      "(() => { const el = [...document.querySelectorAll('[data-testid=org-chart] span')].find(s => /Secretary General|الأمين العام/.test(s.textContent || '')); return el ? el.textContent : null; })()"
    )) as string | null;
    expect(`${locale}: cards rendered on arrival`, count >= 8, `${count} cards`);
    expect(`${locale}: root group carries a d3-zoom transform`, Boolean(transform && /scale\(/.test(transform)), transform ?? "none");
    const k = transform ? Number(/scale\(([\d.]+)\)/.exec(transform)?.[1]) : NaN;
    expect(`${locale}: fitted between 0.4 and 1`, k >= 0.4 && k <= 1, `k=${k}`);
    expect(`${locale}: frame is at least 480 tall`, height >= 480, `${Math.round(height)}px`);
    expect(`${locale}: no horizontal page growth`, noGrowth);
    expect(`${locale}: level rail names the top level`, Boolean(rail), rail ?? "missing");
    await shot(page, `org-chart-${locale}`);

    /* expand a sector: the frame height must not change, the layout animates */
    const before = (await page.evaluate(CHART_HEIGHT)) as number;
    const toggle = page.locator("[data-testid=org-chart] button[aria-expanded=false]").first();
    await toggle.click();
    await page.waitForTimeout(500);
    const after = (await page.evaluate(CHART_HEIGHT)) as number;
    const countAfter = (await page.evaluate(NODE_COUNT)) as number;
    expect(`${locale}: expanding a branch adds cards`, countAfter > count, `${count} -> ${countAfter}`);
    expect(`${locale}: frame height unchanged on expand`, Math.abs(after - before) < 1, `${before} -> ${after}`);
    await shot(page, `org-chart-expanded-${locale}`);

    /* wheel without a modifier scrolls the page and shows the hint */
    const box = await page.locator("[data-testid=org-chart]").boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const kBefore = Number(/scale\(([\d.]+)\)/.exec(((await page.evaluate(ROOT_TRANSFORM)) as string) ?? "")?.[1]);
      await page.mouse.wheel(0, 240);
      await page.waitForTimeout(300);
      const scrolled = (await page.evaluate("window.scrollY")) as number;
      const kPlain = Number(/scale\(([\d.]+)\)/.exec(((await page.evaluate(ROOT_TRANSFORM)) as string) ?? "")?.[1]);
      expect(`${locale}: plain wheel scrolls the page`, scrolled > 0, `scrollY=${scrolled}`);
      expect(`${locale}: plain wheel does not zoom`, Math.abs(kPlain - kBefore) < 0.001, `${kBefore} -> ${kPlain}`);
      const hint = await page.locator("[data-testid=org-chart] [role=status]").count();
      expect(`${locale}: the zoom hint appears`, hint > 0);
      await page.evaluate("window.scrollTo(0, 0)");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.keyboard.down("Control");
      await page.mouse.wheel(0, -200);
      await page.keyboard.up("Control");
      await page.waitForTimeout(400);
      const kCtrl = Number(/scale\(([\d.]+)\)/.exec(((await page.evaluate(ROOT_TRANSFORM)) as string) ?? "")?.[1]);
      expect(`${locale}: Ctrl and wheel zooms`, kCtrl > kBefore, `${kBefore} -> ${kCtrl}`);
      /* drag pans */
      const tBefore = (await page.evaluate(ROOT_TRANSFORM)) as string;
      await page.mouse.move(box.x + 300, box.y + 300);
      await page.mouse.down();
      await page.mouse.move(box.x + 380, box.y + 340, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(200);
      const tAfter = (await page.evaluate(ROOT_TRANSFORM)) as string;
      expect(`${locale}: drag pans`, tBefore !== tAfter, `${tBefore} -> ${tAfter}`);
      /* fit control */
      await page.locator("[data-testid=org-fit]").click();
      await page.waitForTimeout(400);
    }

    /* keyboard: focus the root, walk down and across, Enter opens, Escape closes */
    await page.locator("[data-testid=org-chart] [data-unit-code=SG]").focus();
    const start = (await page.evaluate(ACTIVE_CODE)) as string | null;
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(400);
    const down = (await page.evaluate(ACTIVE_CODE)) as string | null;
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(400);
    const right = (await page.evaluate(ACTIVE_CODE)) as string | null;
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(400);
    const up = (await page.evaluate(ACTIVE_CODE)) as string | null;
    expect(`${locale}: ArrowDown moves to a child`, start === "SG" && Boolean(down) && down !== "SG", `${start} -> ${down}`);
    expect(`${locale}: ArrowRight moves to the next column`, Boolean(right) && right !== down, `${down} -> ${right}`);
    expect(`${locale}: ArrowUp returns to the parent`, up === "SG", `${right} -> ${up}`);
    /* inside the stack column: Down walks the stack */
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(300);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(300);
    const stackNext = (await page.evaluate(ACTIVE_CODE)) as string | null;
    expect(`${locale}: ArrowDown walks the stacked column`, Boolean(stackNext) && stackNext !== down, `${down} -> ${stackNext}`);
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(300);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    const url = page.url();
    expect(`${locale}: Enter opens the panel with ?unit=`, /[?&]unit=/.test(url), url);
    /* the panel body is server rendered through router.refresh: the shared
       dev server can take a while under other agents' probes */
    await page.waitForSelector("[data-testid=org-unit-panel]", { timeout: 120000 });
    await page.waitForTimeout(900);
    const tailShown = (await page.evaluate(
      "(() => { const t = document.querySelector('[data-testid=org-panel-tail]'); return t ? getComputedStyle(t).display !== 'none' : false; })()"
    )) as boolean;
    expect(`${locale}: the pointer tail is shown under the card's x`, tailShown);
    const panelTop = (await page.evaluate("document.querySelector('[data-testid=org-unit-panel]').getBoundingClientRect().top")) as number;
    const chartBottom = (await page.evaluate("document.querySelector('[data-testid=org-chart]').getBoundingClientRect().bottom")) as number;
    expect(`${locale}: the panel sits below the frame`, panelTop > chartBottom, `panel ${Math.round(panelTop)} > chart ${Math.round(chartBottom)}`);
    const tabs = await page.locator("[data-testid=org-panel-tab]").count();
    expect(`${locale}: the panel carries its tab strip`, tabs >= 4, `${tabs} tabs`);
    await shot(page, `org-panel-${locale}`);
    await page.evaluate("window.scrollBy(0, 700)");
    await page.waitForTimeout(500);
    const chip = await page.locator("[data-testid=org-back-to-chart]").count();
    expect(`${locale}: the sticky Back to chart chip appears once the frame is away`, chip > 0);
    await shot(page, `org-panel-scrolled-${locale}`);
    if (chip > 0) {
      await page.locator("[data-testid=org-back-to-chart]").click();
      await page.waitForTimeout(700);
      const y = (await page.evaluate("window.scrollY")) as number;
      expect(`${locale}: Back to chart scrolls up`, y < 300, `scrollY=${y}`);
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
    const closed = await page.locator("[data-testid=org-unit-panel]").count();
    expect(`${locale}: Escape closes the panel`, closed === 0);

    /* the policies tab through a deep link */
    await page.goto(`${BASE}/${locale}/organisation?unit=IDP`, { waitUntil: "networkidle", timeout: 180000 });
    await page.waitForSelector("[data-testid=org-unit-panel]", { timeout: 120000 });
    await page.locator("[data-testid=org-panel-tab][data-tab=policies]").click();
    await page.waitForTimeout(500);
    const policyTabs = await page.locator("[data-testid=policy-tabs]").count();
    expect(`${locale}: the policy tabs render inside the Policies tab`, policyTabs > 0);
    await shot(page, `org-panel-policies-${locale}`);

    expect(`${locale}: no console or page errors`, errors.length === 0, errors.slice(0, 4).join(" | "));
    await ctx.close();
  }

  /* the unit head files a change request */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await login(ctx, "head.stats@npc.qa");
    const page = await ctx.newPage();
    const errors: string[] = [];
    watch(page, errors);
    console.log("== request change as head.stats");
    await page.goto(`${BASE}/en/organisation?unit=SSD`, { waitUntil: "networkidle", timeout: 180000 });
    await page.waitForSelector("[data-testid=org-unit-panel]", { timeout: 120000 });
    const chips = await page.locator("[data-testid=org-request-chip]").count();
    expect("head sees their own requests with status chips", chips >= 2, `${chips} chips`);
    await page.locator("[data-testid=org-request-open]").click();
    await page.locator("[data-testid=org-request-what]").fill("Probe: move the Data Quality section under this department.");
    await page.locator("[data-testid=org-request-why]").fill("Probe run; safe to decline.");
    await shot(page, "org-request-form-en");
    const [sendRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/v1/organisation/editor") && r.request().method() === "POST"),
      page.locator("[data-testid=org-request-send]").click(),
    ]);
    expect("the request POST is accepted", sendRes.status() === 200, `status ${sendRes.status()}`);
    /* the chip arrives with the server re-render, which the dev server can
       take a while to produce when it is recompiling */
    const chipsAfter = await waitForCount(page, "[data-testid=org-request-chip]", chips + 1, 60000);
    expect("a sent request appears as an open chip", chipsAfter >= chips + 1, `${chips} -> ${chipsAfter}`);
    expect("head: no console or page errors", errors.length === 0, errors.slice(0, 4).join(" | "));
    await ctx.close();
  }

  /* narrow: the list is the default */
  if (PART !== "request") {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await login(ctx, "admin@npc.qa");
    const page = await ctx.newPage();
    console.log("== 390px");
    await page.goto(`${BASE}/en/organisation`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(1500);
    const list = await page.locator("[data-testid=org-list-view]").count();
    expect("390px: the list view is the default", list > 0);
    await shot(page, "org-list-390-en");
    await page.goto(`${BASE}/ar/organisation`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(1500);
    await shot(page, "org-list-390-ar");
    await ctx.close();
  }
}

async function settingsPart(browser: import("playwright").Browser) {
  for (const locale of ["en", "ar"] as const) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await login(ctx, "admin@npc.qa");
    const page = await ctx.newPage();
    const errors: string[] = [];
    watch(page, errors);
    console.log(`== settings ${locale}`);
    await page.goto(`${BASE}/${locale}/settings?tab=organisation`, { waitUntil: "networkidle", timeout: 180000 });
    await page.waitForSelector("[data-testid=org-editor-row]", { timeout: 120000 });
    await page.waitForTimeout(800);
    const rows = await page.locator("[data-testid=org-editor-row]").count();
    expect(`${locale}: the editor tree renders`, rows >= 8, `${rows} rows`);
    await shot(page, `org-settings-${locale}`);
    await shot(page, `org-settings-full-${locale}`, true);

    if (locale === "en") {
      /* the first hit compiles the route on the dev server: warm it up */
      await page.request.get(`${BASE}/api/v1/organisation/editor?view=levels`);
      const isPost = (r: import("playwright").Response) =>
        r.url().includes("/api/v1/organisation/editor") && r.request().method() === "POST";
      const clickPost = async (selector: string) => {
        const [res] = await Promise.all([page.waitForResponse(isPost, { timeout: 60000 }), page.locator(selector).click()]);
        return res.status();
      };
      const parentOf = async (code: string) =>
        (await page.evaluate(
          `(() => { const r = document.querySelector('[data-testid=org-editor-row][data-unit-code=${code}]'); return r ? r.getAttribute('data-parent-code') : null; })()`
        )) as string | null;
      const waitParent = async (code: string, want: string, ms = 60000) => {
        const until = Date.now() + ms;
        let got: string | null = null;
        while (Date.now() < until) {
          got = await parentOf(code);
          if (got === want) return got;
          await page.waitForTimeout(250);
        }
        return got;
      };
      const waitGone = async (selector: string, ms = 60000) => {
        const until = Date.now() + ms;
        while (Date.now() < until) {
          if ((await page.locator(selector).count()) === 0) return true;
          await page.waitForTimeout(250);
        }
        return false;
      };

      /* move through the menu: the confirm dialog with counts */
      const row = page.locator("[data-testid=org-editor-row][data-unit-code=IS]");
      await row.locator("[data-testid=org-editor-menu]").click();
      await page.locator("[data-testid=org-menu-move]").click();
      await page.waitForSelector("[data-testid=org-move-dialog]", { timeout: 20000 });
      const targetValue = await page.locator("[data-testid=org-move-target] option", { hasText: "Council Affairs" }).first().getAttribute("value");
      await page.locator("[data-testid=org-move-target]").selectOption(targetValue ?? "");
      await page.locator("[data-testid=org-move-next]").click();
      await page.waitForSelector("[data-testid=org-move-confirm]", { timeout: 20000 });
      await page.waitForSelector("[data-testid=org-impact-item]", { timeout: 30000 }).catch(() => null);
      const impact = await page.locator("[data-testid=org-impact-item]").count();
      expect("move: the confirm dialog lists what moves with the unit", impact >= 1, `${impact} lines`);
      await shot(page, "org-settings-move-confirm-en");
      const moveStatus = await clickPost("[data-testid=org-move-confirm]");
      expect("move: the API accepts the move", moveStatus === 200, `status ${moveStatus}`);
      const movedParent = await waitParent("IS", "CA");
      expect("move: the unit now sits under Council Affairs", movedParent === "CA", `parent=${movedParent}`);
      await page.waitForSelector("[data-testid=org-undo]", { timeout: 15000 }).catch(() => null);
      const undoCount = await page.locator("[data-testid=org-undo]").count();
      expect("move: the undo button appears", undoCount > 0);
      await clickPost("[data-testid=org-undo]");
      const parentBack = await waitParent("IS", "SS");
      expect("undo: the unit is back under Shared Services", parentBack === "SS", `parent=${parentBack}`);
      await waitGone("[data-testid=org-undo]");

      /* drag and drop: the live preview while a row hovers over a target that
         shares the screen (IS onto its sibling HR), then Escape drops it */
      const dragHandle = page.locator("[data-testid=org-editor-row][data-unit-code=IS] [data-testid=org-editor-drag]");
      await dragHandle.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const handleBox = await dragHandle.boundingBox();
      const dropBox = await page.locator("[data-testid=org-editor-row][data-unit-code=HR]").boundingBox();
      let preview = 0;
      let previewParent: string | null = null;
      if (handleBox && dropBox) {
        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(dropBox.x + 200, dropBox.y + 12, { steps: 10 });
        await page.mouse.move(dropBox.x + 220, dropBox.y + 14, { steps: 4 });
        await page.waitForTimeout(400);
        preview = await page.locator("[data-testid=org-move-preview]").count();
        previewParent = await parentOf("IS");
        await shot(page, "org-settings-drag-preview-en");
        await page.keyboard.press("Escape");
        await page.mouse.up();
        await page.waitForTimeout(300);
      }
      expect("drag: the live preview redraws the tree under the target", preview > 0 && previewParent === "HR", `preview=${preview} parent=${previewParent}`);
      if ((await page.locator("[data-testid=org-move-dialog]").count()) > 0) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
      /* a real drop opens the confirmation, which is cancelled */
      if (handleBox && dropBox) {
        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(dropBox.x + 200, dropBox.y + 12, { steps: 10 });
        await page.waitForTimeout(200);
        await page.mouse.up();
        const dialog = await page.locator("[data-testid=org-move-dialog]").count();
        expect("drag: dropping opens the confirmation", dialog > 0);
        await page.keyboard.press("Escape");
        await waitGone("[data-testid=org-move-dialog]");
      }

      /* delete: the risk dialog with the reassignment */
      const del = page.locator("[data-testid=org-editor-row][data-unit-code=SSD]");
      await del.locator("[data-testid=org-editor-menu]").click();
      await page.locator("[data-testid=org-menu-delete]").click();
      await page.waitForSelector("[data-testid=org-risk-dialog]", { timeout: 20000 });
      await page.waitForSelector("[data-testid=org-impact-item]", { timeout: 30000 }).catch(() => null);
      const riskLines = await page.locator("[data-testid=org-impact-item]").count();
      expect("delete: the risk dialog lists everything beneath", riskLines >= 2, `${riskLines} lines`);
      const disabled = await page.locator("[data-testid=org-risk-confirm]").isDisabled();
      expect("delete: confirm is disabled until a unit is chosen", disabled);
      await shot(page, "org-settings-risk-dialog-en");
      await page.locator("[data-testid=org-risk-cancel]").click();
      await waitGone("[data-testid=org-risk-dialog]");

      /* add a child, rename it inline, delete it (nothing beneath), undo brings it back */
      await page.locator("[data-testid=org-editor-row][data-unit-code=SS] [data-testid=org-editor-add]").click();
      await page.waitForSelector("[data-testid=org-unit-dialog]", { timeout: 20000 });
      await page.locator("[data-testid=org-unit-code]").fill("PRB");
      await page.locator("[data-testid=org-unit-name-en]").fill("Probe Section");
      await page.locator("[data-testid=org-unit-name-ar]").fill("قسم التجربة");
      await shot(page, "org-settings-add-dialog-en");
      const addStatus = await clickPost("[data-testid=org-unit-save]");
      expect("add: the API accepts the new unit", addStatus === 200, `status ${addStatus}`);
      const added = await waitForCount(page, "[data-testid=org-editor-row][data-unit-code=PRB]", 1, 15000);
      expect("add: a child appears under the sector", added === 1);
      await page.locator("[data-testid=org-editor-row][data-unit-code=PRB] [data-testid=org-editor-rename]").click();
      await page.locator("[data-testid=org-rename-en]").fill("Probe Section Renamed");
      await shot(page, "org-settings-rename-en");
      await clickPost("[data-testid=org-rename-save]");
      await page.waitForSelector("[data-testid=org-editor-row][data-unit-code=PRB] >> text=Renamed", { timeout: 15000 }).catch(() => null);
      const renamed = await page.locator("[data-testid=org-editor-row][data-unit-code=PRB]").textContent();
      expect("rename: the new name shows", Boolean(renamed && renamed.includes("Renamed")));
      await page.locator("[data-testid=org-editor-row][data-unit-code=PRB] [data-testid=org-editor-menu]").click();
      await page.locator("[data-testid=org-menu-delete]").click();
      await page.waitForSelector("[data-testid=org-risk-dialog]", { timeout: 20000 });
      await page.waitForSelector("[data-testid=org-risk-confirm]:not([disabled])", { timeout: 30000 }).catch(() => null);
      await clickPost("[data-testid=org-risk-confirm]");
      const gone = await waitGone("[data-testid=org-editor-row][data-unit-code=PRB]");
      expect("delete: an empty unit goes without reassignment", gone);
      await clickPost("[data-testid=org-undo]");
      const back = await waitForCount(page, "[data-testid=org-editor-row][data-unit-code=PRB]", 1, 15000);
      expect("undo: the deleted unit is restored", back === 1);
      /* clean up: undo the rename and the add */
      await clickPost("[data-testid=org-undo]");
      await page.waitForTimeout(800);
      await clickPost("[data-testid=org-undo]");
      const cleaned = await waitGone("[data-testid=org-editor-row][data-unit-code=PRB]");
      expect("undo: the added unit is gone again", cleaned);
      await waitGone("[data-testid=org-undo]");

      /* snapshots: the list and a restore of the latest */
      await page.waitForTimeout(1000);
      const snaps = await page.locator("[data-testid=org-snapshot-row]").count();
      expect("snapshots: rows are listed", snaps >= 2, `${snaps} rows`);
      const rowsBefore = await page.locator("[data-testid=org-editor-row]").count();
      await page.locator("[data-testid=org-snapshot-restore]").first().click();
      await page.waitForSelector("[data-testid=org-snapshot-confirm]", { timeout: 20000 });
      await shot(page, "org-settings-snapshot-restore-en");
      const restoreStatus = await clickPost("[data-testid=org-snapshot-confirm]");
      expect("snapshots: the API accepts the restore", restoreStatus === 200, `status ${restoreStatus}`);
      await waitGone("[data-testid=org-snapshot-confirm]");
      await page.waitForTimeout(1500);
      const rowsAfter = await page.locator("[data-testid=org-editor-row]").count();
      expect("snapshots: the structure is intact after a restore", rowsAfter === rowsBefore, `${rowsBefore} -> ${rowsAfter}`);
      await page.waitForSelector("[data-testid=org-undo]", { timeout: 15000 }).catch(() => null);
      expect("snapshots: a restore can be undone", (await page.locator("[data-testid=org-undo]").count()) > 0);

      /* CSV preview */
      await page.locator("[data-testid=org-csv-text]").fill(
        "code,parent_code,level,name_en,name_ar,head_name,head_title\nPRB2,SS,department,Probe Import Department,إدارة استيراد التجربة,Probe Head,Director\nIS,SS,department,Information Systems Department,إدارة نظم المعلومات,,\nBAD,NOPE,department,Broken,مكسور,,"
      );
      await clickPost("[data-testid=org-csv-preview]");
      await page.waitForSelector("[data-testid=org-csv-row]", { timeout: 20000 });
      const csvRows = await page.locator("[data-testid=org-csv-row]").count();
      const csvErr = await page.locator("[data-testid=org-csv-row][data-status=error]").count();
      const csvNew = await page.locator("[data-testid=org-csv-row][data-status=new]").count();
      expect("csv: the preview classifies every row", csvRows === 3 && csvErr === 1 && csvNew === 1, `${csvRows} rows, ${csvErr} errors, ${csvNew} new`);
      const applyDisabled = await page.locator("[data-testid=org-csv-apply]").isDisabled();
      expect("csv: import is blocked while a row has an error", applyDisabled);
      await shot(page, "org-settings-csv-preview-en");

      /* levels */
      const levels = await page.locator("[data-testid=org-level-row]").count();
      expect("levels: the five published levels are listed", levels >= 5, `${levels} levels`);
      const requests = await page.locator("[data-testid=org-request-row]").count();
      expect("requests: the open requests are listed", requests >= 1, `${requests} rows`);
    }
    expect(`${locale}: settings, no console or page errors`, errors.length === 0, errors.slice(0, 4).join(" | "));
    await ctx.close();
  }

  /* a Knowledge Admin must not see the editor's mutations */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await login(ctx, "knowledge@npc.qa");
    const page = await ctx.newPage();
    const res = await page.request.post(`${BASE}/api/v1/organisation/editor`, {
      data: { action: "snapshots.take", note: "probe" },
    });
    expect("a Knowledge Admin is refused by the editor API", res.status() === 403, `status ${res.status()}`);
    await ctx.close();
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge" });
  try {
    if (PART === "chart" || PART === "all" || PART === "request") await chartPart(browser);
    if (PART === "settings" || PART === "all") await settingsPart(browser);
  } finally {
    await browser.close();
  }
  console.log(`\n${notes.length} ok, ${problems.length} failed`);
  for (const p of problems) console.log(p);
  process.exit(problems.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
