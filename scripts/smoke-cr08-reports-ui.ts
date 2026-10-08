/* eslint-disable no-console */
// CR08 5 (Reports UI agent): smoke checks over the rendered HTML of the
// Reports pages, wired into scripts/smoke.ts by the coordinator. `cookie` is
// a Contributor session (analyst@enviroai.demo), `adminCookie` the Super Admin.
type Check = (name: string, ok: boolean, detail?: string) => void;
type Ctx = { base: string; cookie: string; adminCookie: string; db: import("@libsql/client").Client };

/** The shared dev server resets a connection now and then while it hot
    reloads, and answers 500 for a moment mid-compile. The BODY read is
    retried with the request, because a connection dropped mid-stream fails
    there, not on the response headers. */
async function fetchPage(url: string, init: RequestInit): Promise<{ status: number; html: string }> {
  let last: { status: number; html: string } | null = null;
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(url, init);
      const html = await res.text();
      if (res.status !== 500 || i === 4) return { status: res.status, html };
      last = { status: res.status, html };
    } catch (e) {
      if (i === 4) throw e;
    }
    await new Promise((r) => setTimeout(r, 2500 * (i + 1)));
  }
  return last as { status: number; html: string };
}

function count(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

async function loginCookie(base: string, email: string): Promise<string | null> {
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(`${base}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "EnviroAI!2026" }),
      });
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      const set = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
      const pair = set.map((sc) => sc.split(";")[0]).find((s) => s.includes("="));
      return pair ?? null;
    } catch {
      await new Promise((r) => setTimeout(r, 2500 * (i + 1)));
    }
  }
  return null;
}

export async function run(check: Check, ctx: Ctx): Promise<void> {
  const page = (p: string, cookie: string) => fetchPage(ctx.base + p, { headers: { cookie }, redirect: "manual" });
  const rawKeys = (html: string) => (html.replace(/<[^>]+>/g, " ").match(/\b(reports|common)\.[a-zA-Z]+(\.[a-zA-Z0-9_]+)+\b/g) ?? []).length;

  /* the hub as the Super Admin */
  const adminHub = await page("/en/reports", ctx.adminCookie);
  const adminCovers = count(adminHub.html, 'data-testid="cover-card"');
  check("reports ui: the gallery lists the twelve published covers for the admin", adminHub.status === 200 && adminCovers >= 12, `status ${adminHub.status}, covers ${adminCovers}`);
  check("reports ui: the admin sees All reports with status tabs and the custom entry", adminHub.html.includes('data-testid="all-reports"') && adminHub.html.includes('data-testid="status-tab-in_review"') && adminHub.html.includes('data-testid="build-custom"'));
  check("reports ui: covers are served through the preview API", adminHub.html.includes("/api/v1/report-builder/") && adminHub.html.includes("/preview/0"));
  check("reports ui: the hub carries no raw i18n keys", rawKeys(adminHub.html) === 0, `${rawKeys(adminHub.html)} raw keys`);

  /* the hub as a Contributor: the gallery is filtered by their clearance */
  const hub = await page("/en/reports", ctx.cookie);
  const covers = count(hub.html, 'data-testid="cover-card"');
  const expected = await ctx.db.execute(
    "select count(*) n from reports where type_id is not null and status = 'published' and classification_level <= (select clearance_level from users where email = 'analyst@enviroai.demo')"
  );
  const expectedCovers = Number(expected.rows[0]?.n ?? 0);
  check("reports ui: a contributor sees the gallery and their requests", hub.status === 200 && covers === expectedCovers && covers > 0 && hub.html.includes('data-testid="my-requests"'), `status ${hub.status}, covers ${covers}, expected ${expectedCovers}`);
  check("reports ui: the gallery hides a report above the contributor's clearance", covers < adminCovers, `contributor ${covers}, admin ${adminCovers}`);
  check("reports ui: a contributor sees neither All reports nor the custom entry", !hub.html.includes('data-testid="all-reports"') && !hub.html.includes('data-testid="build-custom"'));

  /* the Arabic hub */
  const arHub = await page("/ar/reports", ctx.cookie);
  check("reports ui: the Arabic hub renders RTL with its title", arHub.status === 200 && /dir="rtl"/.test(arHub.html) && arHub.html.includes("التقارير"), `status ${arHub.status}`);

  /* the report page of a seeded published example */
  const seeded = await ctx.db.execute(
    "select id, title_en from reports where type_id is not null and status = 'published' and preview_images_json is not null and preview_images_json != '[]' order by created_at limit 1"
  );
  const seededId = seeded.rows[0]?.id ? String(seeded.rows[0].id) : null;
  if (seededId) {
    const report = await page(`/en/reports/${seededId}`, ctx.adminCookie);
    const sections = count(report.html, 'data-testid="report-section"');
    check("reports ui: the report page renders its sections", report.status === 200 && sections >= 5, `status ${report.status}, sections ${sections}`);
    check("reports ui: the report page carries the Ask EnviroAI context marker", report.html.includes(`data-ask-context="report:${seededId}"`));
    check("reports ui: the report page renders KPI tiles, a chart and the filmstrip", report.html.includes('data-testid="kpi-grid"') && report.html.includes('data-testid="report-chart"') && report.html.includes('data-testid="filmstrip"'));
    check("reports ui: the report page uses no <table> element", !/<table[\s>]/.test(report.html));
    const reader = await page(`/en/reports/${seededId}`, ctx.cookie);
    check("reports ui: a contributor opens a published report", reader.status === 200 && reader.html.includes('data-testid="report-section"'), `status ${reader.status}`);
    // CR08 8: the week's pick can be set from a published report, by the
    // people who manage it and by nobody else
    check(
      "reports ui: Knowledge of the Week is offered to the admin on a published report, not to a contributor",
      report.html.includes('data-testid="set-kow"') && !reader.html.includes('data-testid="set-kow"')
    );
  }

  /* the builder */
  const adminBuilder = await page("/en/reports/new", ctx.adminCookie);
  const adminTypes = count(adminBuilder.html, 'data-testid="type-card"');
  check("reports ui: the builder renders thirteen types for the admin", adminBuilder.status === 200 && adminTypes === 13, `status ${adminBuilder.status}, types ${adminTypes}`);
  const builder = await page("/en/reports/new", ctx.cookie);
  const types = count(builder.html, 'data-testid="type-card"');
  check("reports ui: the builder renders twelve types for a contributor, no custom", builder.status === 200 && types === 12 && !builder.html.includes('data-testid="type-family-custom"'), `status ${builder.status}, types ${types}`);
  check("reports ui: the builder carries the structure preview", builder.html.includes('data-testid="structure-preview"'));

  /* an unknown report, and another requester's draft, both read as not found.
     The page streams behind its loading boundary, so the shell is flushed
     before the lookup and the status stays 200: the check is on the content. */
  const missing = await page("/en/reports/01NOTAREPORT00000000000000", ctx.cookie);
  check(
    "reports ui: an unknown report renders the not found state, never a report",
    missing.status === 200 && !missing.html.includes('data-testid="report-page"') && missing.html.includes("Not found"),
    `status ${missing.status}`
  );
  const foreign = await ctx.db.execute(
    "select id from reports where type_id is not null and status != 'published' and requested_by != (select id from users where email = 'analyst@enviroai.demo') limit 1"
  );
  if (foreign.rows[0]?.id) {
    const hidden = await page(`/en/reports/${foreign.rows[0].id}`, ctx.cookie);
    check("reports ui: another requester's unpublished report is not shown", !hidden.html.includes('data-testid="report-page"'), `status ${hidden.status}`);
  }

  /* a person without the Reports portal gets the friendly 404 */
  const readerCookie = await loginCookie(ctx.base, "reader@enviroai.demo");
  const readerRow = await ctx.db.execute("select id from users where email = 'reader@enviroai.demo'");
  const readerId = readerRow.rows[0]?.id ? String(readerRow.rows[0].id) : null;
  if (readerCookie && readerId) {
    const before = await page("/en/reports", readerCookie);
    check("reports ui: a reader with the portal opens the hub", before.status === 200, `status ${before.status}`);
    const overrideId = `smoke-reports-ui-${Date.now()}`;
    await ctx.db.execute({
      sql: "insert into user_permission_overrides (id, user_id, permission_key, effect, reason, set_by, set_at) values (?, ?, 'portal:reports', 'deny', 'smoke', null, ?)",
      args: [overrideId, readerId, new Date().toISOString()],
    });
    try {
      const hidden = await page("/en/reports", readerCookie);
      check("reports ui: a reader without the reports portal gets 404", hidden.status === 404, `status ${hidden.status}`);
    } finally {
      await ctx.db.execute({ sql: "delete from user_permission_overrides where id = ?", args: [overrideId] });
    }
  }
}
