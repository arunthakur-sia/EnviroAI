/* eslint-disable no-console */
// CR08 9.1 probe: the owner control across the strategy and council surfaces,
// in system Edge against the shared dev server, both locales at 1440x900.
// Screenshots land in data/screenshots/cr08/owners-strategy-*.png.
// It opens person cards from inside the canvas, the node drawer and the
// council project drawer and asserts each one paints above what opened it
// (elementFromPoint at the card's centre lands inside the card).
// Every page.evaluate is passed a STRING: tsx's __name helper is not defined
// in the browser.
//   npx tsx scripts/dev-probes/cr08-owners-strategy-probe.ts [en|ar|all]
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "data", "screenshots", "cr08");
const ONLY = process.argv[2] ?? "all";
const PASSWORD = "EnviroAI!2026";
const NAV = { waitUntil: "networkidle" as const, timeout: 120000 };
const WAIT = 120000;

const problems: string[] = [];
const notes: string[] = [];
function expect(name: string, ok: boolean, detail?: string) {
  (ok ? notes : problems).push(`${ok ? "ok " : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
}

async function login(ctx: BrowserContext, email: string) {
  const page = await ctx.newPage();
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await page.request.post(`${BASE}/api/v1/auth/login`, {
        data: { email, password: PASSWORD },
        timeout: WAIT,
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

/** Hydration notes that belong to the shell, not to this pass. */
const KNOWN_SHELL = [/<SettingsTabs/, /radix-_R_/, /A tree hydrated but some attributes/];

function watch(page: Page, errors: string[]) {
  const push = (text: string) => {
    if (KNOWN_SHELL.some((re) => re.test(text))) {
      notes.push(`note (shell) ${text.replace(/\s+/g, " ").slice(0, 120)}`);
      return;
    }
    errors.push(text);
  };
  page.on("console", (m) => {
    if (m.type() === "error") push(`console: ${m.text().replace(/\s+/g, " ").slice(0, 600)}`);
  });
  page.on("pageerror", (e) => push(`pageerror: ${String(e).slice(0, 400)}`));
}

async function shot(page: Page, name: string, fullPage = false) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
  console.log(`  shot ${name}.png`);
}

async function goto(page: Page, url: string, selector: string) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await page.goto(url, NAV);
      await page.waitForSelector(selector, { timeout: WAIT });
      return;
    } catch (e) {
      console.log(`  goto ${url}: ${String(e).slice(0, 90)} (attempt ${attempt})`);
      if (attempt === 2) throw e;
    }
  }
}

const NO_GROWTH = "document.documentElement.scrollWidth <= window.innerWidth";
/* every person chip on the page has to sit inside the viewport (the canvas
   itself grows 37px on a pre-existing CR04 medallion hover card, which this
   pass does not touch) */
const CHIPS_INSIDE = `(() => {
  const vw = window.innerWidth;
  const bad = [];
  document.querySelectorAll('[data-testid=owner-control], [data-testid=owner-control-compact]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0) return;
    if (r.right > vw + 1 || r.left < -1) bad.push(Math.round(r.left) + '..' + Math.round(r.right));
  });
  return bad;
})()`;

/** Opens the person card behind a trigger and proves it is painted on top. */
async function openCard(page: Page, trigger: import("playwright").Locator, label: string) {
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await page.waitForSelector("[data-testid=person-card-popover]", { timeout: WAIT });
  /* the card fetches the person; wait for the loaded card rather than a timer */
  await page
    .waitForSelector("[data-testid=person-card-popover] [data-testid=person-card]", { timeout: 60000 })
    .catch(() => {});
  await page.waitForTimeout(700);
  const onTop = (await page.evaluate(
    "(() => { const el = document.querySelector('[data-testid=person-card-popover]'); if (!el) return { ok: false, why: 'no card' }; const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + 24)); return { ok: Boolean(hit && el.contains(hit)), why: hit ? hit.tagName + '.' + String(hit.className).slice(0, 40) : 'nothing', z: getComputedStyle(el.parentElement || el).zIndex, w: Math.round(r.width), h: Math.round(r.height) }; })()"
  )) as { ok: boolean; why: string; z: string; w: number; h: number };
  expect(`${label}: the person card paints above what opened it`, onTop.ok, JSON.stringify(onTop));
  const inside = await page.locator("[data-testid=person-card-popover]").innerText();
  expect(`${label}: the card names a person and offers its actions`, inside.trim().length > 10, inside.replace(/\s+/g, " ").slice(0, 80));
  return onTop;
}

async function closeCard(page: Page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

async function pass(browser: Browser, locale: "en" | "ar", ids: Ids) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await login(ctx, "admin@enviroai.demo");
  const page = await ctx.newPage();
  const errors: string[] = [];
  watch(page, errors);
  console.log(`== ${locale}`);

  /* 1. the canvas with an outcome panel open */
  await goto(page, `${BASE}/${locale}/strategy/${ids.edition}?o=${ids.outcomeSlug}`, "[data-testid=outcome-panel]");
  await page.waitForTimeout(900);
  const panelOwner = page.locator("[data-testid=outcome-panel] [data-testid=owner-control]").first();
  expect(`${locale}: the outcome panel carries an owner control`, (await panelOwner.count()) > 0);
  const laneChips = await page.locator("[data-testid=outcome-panel] [data-testid=owner-control-compact]").count();
  expect(`${locale}: the outcome panel's cards and rosters carry person chips`, laneChips > 0, `${laneChips} chips`);
  const spill = (await page.evaluate(CHIPS_INSIDE)) as string[];
  expect(`${locale}: every person chip on the canvas sits inside the viewport`, spill.length === 0, spill.join(" "));
  /* the panel header carries the owner chip, so leave room for the top bar */
  await page.evaluate(
    "(() => { document.querySelector('[data-testid=outcome-panel]').scrollIntoView({ block: 'start' }); window.scrollBy(0, -96); })()"
  );
  await page.waitForTimeout(400);
  await shot(page, `owners-strategy-canvas-${locale}`);

  /* the person card from the panel header */
  await openCard(page, panelOwner.locator("[data-testid=owner-control-trigger]"), `${locale} canvas`);
  await shot(page, `owners-strategy-card-canvas-${locale}`);
  await closeCard(page);

  /* 2. the node drawer over the canvas, with its owner and a card on top.
     The card opened is one whose own chip says it has an owner. */
  const ownedCard = page
    .locator("[data-node-id]:has([data-testid=owner-control-compact])")
    .locator("[data-testid=outcome-level-card], [data-testid=lane-card]")
    .first();
  const laneCard = (await ownedCard.count())
    ? ownedCard
    : page.locator("[data-testid=outcome-level-card], [data-testid=lane-card]").first();
  if (await laneCard.count()) {
    await laneCard.scrollIntoViewIfNeeded();
    await laneCard.click();
    await page.waitForSelector("[data-testid=node-drawer]", { timeout: WAIT });
    await page.waitForSelector("[data-testid=node-drawer] [data-testid=open-full-page]", { timeout: WAIT });
    await page.waitForTimeout(600);
    const drawerOwner = page.locator("[data-testid=node-drawer] [data-testid=owner-control]").first();
    const hasOwner = (await drawerOwner.count()) > 0;
    expect(`${locale}: the node drawer carries the owner control`, hasOwner);
    await shot(page, `owners-strategy-drawer-${locale}`);
    if (hasOwner) {
      await openCard(page, drawerOwner.locator("[data-testid=owner-control-trigger]"), `${locale} node drawer`);
      await shot(page, `owners-strategy-drawer-card-${locale}`);
      await closeCard(page);
      /* CR08 9.1: Escape dismisses the card the drawer opened, not the drawer */
      expect(
        `${locale}: Escape closes the person card and leaves the node drawer open`,
        (await page.locator("[data-testid=person-card-popover]").count()) === 0 &&
          (await page.locator("[data-testid=node-drawer]").count()) === 1
      );
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  } else {
    expect(`${locale}: a lane card to open the drawer`, false, "no lane card on the panel");
  }

  /* 3. a node detail page: the owner in the hero, people on the stakeholder rows */
  await goto(page, `${BASE}/${locale}/strategy/${ids.projectId}`, "[data-testid=node-hero]");
  await page.waitForTimeout(700);
  const heroOwner = page.locator("[data-testid=node-hero] [data-testid=owner-control][data-role=project_owner]");
  expect(`${locale}: the project header carries the owner as project owner`, (await heroOwner.count()) === 1);
  expect(`${locale}: no horizontal page growth on the node page`, (await page.evaluate(NO_GROWTH)) as boolean);
  await shot(page, `owners-strategy-node-${locale}`);
  const rows = await page.locator("[data-testid=stakeholders-section] [data-testid=owner-control-compact]").count();
  expect(`${locale}: the stakeholder rows carry person chips`, rows >= 2, `${rows} chips`);
  await page.evaluate("document.querySelector('[data-testid=stakeholders-section]').scrollIntoView({ block: 'center' })");
  await page.waitForTimeout(400);
  await shot(page, `owners-strategy-stakeholders-${locale}`);
  await openCard(
    page,
    page.locator("[data-testid=stakeholders-section] [data-testid=owner-control-compact]").first(),
    `${locale} stakeholder row`
  );
  await shot(page, `owners-strategy-card-stakeholder-${locale}`);
  await closeCard(page);

  /* 4. the KPI section of an outcome: the custodian */
  await goto(page, `${BASE}/${locale}/strategy/${ids.outcomeId}`, "[data-testid=node-hero]");
  await page.waitForTimeout(700);
  const custodians = await page.locator("[data-testid=owner-control][data-role=custodian]").count();
  expect(`${locale}: the KPI cards carry their custodian`, custodians >= 1, `${custodians} custodians`);
  expect(
    `${locale}: the outcome header falls back to the department head`,
    (await page.locator("[data-testid=node-hero] [data-testid=owner-control][data-role=department_owner]").count()) === 1
  );
  await page.evaluate("(() => { const el = document.querySelector('[data-role=custodian]'); if (el) el.scrollIntoView({ block: 'center' }); })()");
  await page.waitForTimeout(400);
  await shot(page, `owners-strategy-kpis-${locale}`);

  /* 5. the council chain, its project drawer and the indicator dialog */
  await goto(
    page,
    `${BASE}/${locale}/council-strategy?g=${ids.goalSlug}&io=${ids.ioSlug}&o=${ids.outputSlug}`,
    "[data-testid=project-card]"
  );
  await page.waitForTimeout(900);
  const chainChips = await page.locator("[data-testid=owner-control-compact]").count();
  expect(`${locale}: the council project cards carry person chips`, chainChips > 0, `${chainChips} chips`);
  expect(`${locale}: no horizontal page growth on the council chain`, (await page.evaluate(NO_GROWTH)) as boolean);
  await page.evaluate("document.querySelector('[data-testid=project-card]').scrollIntoView({ block: 'center' })");
  await page.waitForTimeout(400);
  await shot(page, `owners-strategy-council-${locale}`);

  await page.locator("[data-testid=project-card]").first().click();
  await page.waitForSelector("[data-testid=council-project-drawer]", { timeout: WAIT });
  /* the drawer loads its project over the API; wait for the loaded body */
  await page.waitForSelector("[data-testid=council-project-drawer] h2", { timeout: WAIT });
  await page.waitForTimeout(700);
  const councilOwner = page.locator("[data-testid=council-owner] [data-testid=owner-control]").first();
  expect(`${locale}: the council project drawer carries the owner control`, (await councilOwner.count()) > 0);
  await shot(page, `owners-strategy-council-drawer-${locale}`);
  if (await councilOwner.count()) {
    await openCard(page, councilOwner.locator("[data-testid=owner-control-trigger]"), `${locale} council drawer`);
    await shot(page, `owners-strategy-council-card-${locale}`);
    await closeCard(page);
    expect(
      `${locale}: Escape closes the person card and leaves the council drawer open`,
      (await page.locator("[data-testid=person-card-popover]").count()) === 0 &&
        (await page.locator("[data-testid=council-project-drawer]").count()) === 1
    );
  }

  /* the indicator card dialog, opened from inside the drawer */
  const indicatorLink = page.locator("[data-testid=council-project-drawer] button.link-draw").first();
  if (await indicatorLink.count()) {
    await indicatorLink.scrollIntoViewIfNeeded();
    await indicatorLink.click();
    await page.waitForSelector("[data-testid=indicator-card]", { timeout: WAIT });
    await page.waitForTimeout(800);
    const responsible = await page
      .locator("[data-testid=indicator-card] [data-testid=owner-control-compact]")
      .count();
    expect(`${locale}: the indicator dialog names its custodian as a person chip`, responsible === 1, `${responsible}`);
    await shot(page, `owners-strategy-council-indicator-${locale}`);
    if (responsible) {
      await openCard(
        page,
        page.locator("[data-testid=indicator-card] [data-testid=owner-control-compact]").first(),
        `${locale} indicator dialog`
      );
      await shot(page, `owners-strategy-council-indicator-card-${locale}`);
      await closeCard(page);
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  } else {
    expect(`${locale}: an indicator to open from the drawer`, false, "no indicator link in the drawer");
  }

  expect(`${locale}: no console or page errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

type Ids = {
  edition: string;
  outcomeSlug: string;
  outcomeId: string;
  projectId: string;
  goalSlug: string;
  ioSlug: string;
  outputSlug: string;
};

async function resolveIds(): Promise<Ids> {
  const { rawClient } = await import("../../src/server/db/client");
  const slug = (code: string) => code.toLowerCase().replace(/\./g, "-");
  const project = (
    await rawClient.execute(
      `select n.id from strategy_nodes n join users u on u.id = n.owner_user_id and u.deleted_at is null
        where n.node_type in ('project','initiative')
          and exists (select 1 from node_stakeholders s where s.node_id = n.id and s.user_id is not null)
        order by n.code limit 1`
    )
  ).rows[0] as unknown as { id: string };
  const outcome = (
    await rawClient.execute(
      `select n.id, n.code, e.code edition from strategy_nodes n join strategy_editions e on e.id = n.edition_id
        where n.node_type = 'outcome' and n.parent_id is null and e.is_default = 1
          and exists (select 1 from kpis k where k.node_id = n.id and k.owner_user_id is not null)
        order by n.sort limit 1`
    )
  ).rows[0] as unknown as { id: string; code: string; edition: string };
  const council = (
    await rawClient.execute(
      `select p.code output_code, pp.code io_code, ppp.code goal_code
         from council_nodes c
         join council_nodes p on p.id = c.parent_id
         join council_nodes pp on pp.id = p.parent_id
         join council_nodes ppp on ppp.id = pp.parent_id
         join users u on u.id = c.owner_user_id
        where c.level = 'project' order by c.code limit 1`
    )
  ).rows[0] as unknown as { output_code: string; io_code: string; goal_code: string };
  return {
    edition: outcome.edition,
    outcomeSlug: slug(outcome.code),
    outcomeId: outcome.id,
    projectId: project.id,
    goalSlug: slug(council.goal_code),
    ioSlug: slug(council.io_code),
    outputSlug: slug(council.output_code),
  };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const ids = await resolveIds();
  console.log(`ids: ${JSON.stringify(ids)}`);
  const browser = await chromium.launch({ channel: "msedge" });
  try {
    const locales = (ONLY === "all" ? ["en", "ar"] : [ONLY]) as ("en" | "ar")[];
    for (const locale of locales) await pass(browser, locale, ids);
  } finally {
    await browser.close();
  }
  console.log(`\n${notes.length} ok, ${problems.length} problems`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(problems.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
