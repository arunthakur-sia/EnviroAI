/* eslint-disable no-console */
// CR08 5: smoke checks for the Reports module, wired into scripts/smoke.ts by
// the coordinator. `cookie` is a Contributor session (analyst@enviroai.demo),
// `adminCookie` the Super Admin.
type Check = (name: string, ok: boolean, detail?: string) => void;
type Ctx = { base: string; cookie: string; adminCookie: string; db: import("@libsql/client").Client };

async function json(res: Response): Promise<any> {
  return res.json().catch(() => null);
}

/** Removes a module report the smoke created: sections, versions, the
    published document with its chunks and files, the docx files. */
export async function cleanupReport(ctx: Ctx, id: string): Promise<void> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const row = await ctx.db.execute({ sql: "select published_document_id from reports where id = ?", args: [id] });
  const docId = row.rows[0]?.published_document_id ? String(row.rows[0].published_document_id) : null;
  if (docId) {
    for (const table of ["document_chunks", "document_versions", "document_tables", "taggings", "relations"]) {
      const col = table === "taggings" ? "resource_id" : table === "relations" ? "from_id" : "document_id";
      await ctx.db.execute({ sql: `delete from ${table} where ${col} = ?`, args: [docId] }).catch(() => undefined);
    }
    await ctx.db.execute({ sql: "delete from search_index where resource_id = ?", args: [docId] }).catch(() => undefined);
    await ctx.db.execute({ sql: "delete from documents where id = ?", args: [docId] });
    await fs.rm(path.join(process.cwd(), "data", "uploads", docId), { recursive: true, force: true }).catch(() => undefined);
  }
  await ctx.db.execute({ sql: "delete from report_sections where report_id = ?", args: [id] });
  await ctx.db.execute({ sql: "delete from report_versions where report_id = ?", args: [id] });
  await ctx.db.execute({ sql: "delete from notifications where link like ?", args: [`/reports/${id}%`] }).catch(() => undefined);
  await ctx.db.execute({ sql: "delete from reports where id = ?", args: [id] });
  for (const lang of ["en", "ar"]) {
    await fs.rm(path.join(process.cwd(), "data", "reports", "module", `${id}-${lang}.docx`), { force: true }).catch(() => undefined);
  }
}

/** The shared dev server resets a connection now and then while it hot
    reloads; a connection-level failure is retried twice before it counts. */
async function fetchRetry(url: string, init: RequestInit): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

export async function run(check: Check, ctx: Ctx): Promise<void> {
  const get = (p: string, cookie: string) => fetchRetry(ctx.base + p, { headers: { cookie } });
  const send = (p: string, method: string, cookie: string, body: unknown) =>
    fetchRetry(ctx.base + p, { method, headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) });

  /* catalogue and library */
  const list = await json(await get("/api/v1/report-builder", ctx.cookie));
  const types: { code: string; family: string }[] = list?.data?.types ?? [];
  check("reports: twelve nominated types for a contributor", types.length === 12 && !types.some((t) => t.family === "custom"), `got ${types.length}`);
  check("reports: section library carries 23 sections", (list?.data?.library ?? []).length === 23, `got ${(list?.data?.library ?? []).length}`);
  const adminList = await json(await get("/api/v1/report-builder", ctx.adminCookie));
  check("reports: the custom type is visible to the Super Admin only", (adminList?.data?.types ?? []).some((t: { family: string }) => t.family === "custom"));
  const seeded = await ctx.db.execute("select count(*) c from reports where type_id is not null and requested_by is not null");
  check("reports: a seeded example exists per type", Number(seeded.rows[0]?.c ?? 0) >= 12, `got ${seeded.rows[0]?.c}`);
  const publishedSeed = await ctx.db.execute("select count(*) c from reports where type_id is not null and status = 'published'");
  const docxPending = await ctx.db.execute("select count(*) c from reports where type_id is not null and status = 'draft' and docx_path is null");
  check(
    "reports: seeded examples published, or awaiting the docx template",
    Number(publishedSeed.rows[0]?.c ?? 0) >= 12 || Number(docxPending.rows[0]?.c ?? 0) > 0,
    `published ${publishedSeed.rows[0]?.c}, awaiting template ${docxPending.rows[0]?.c}`
  );

  /* a seeded, published example serves its cover preview to any reader of the portal */
  const seededExample = await ctx.db.execute("select id, preview_images_json from reports where type_id is not null and status = 'published' and preview_images_json is not null and preview_images_json != '[]' order by created_at limit 1");
  if (seededExample.rows[0]?.id) {
    const preview = await get(`/api/v1/report-builder/${seededExample.rows[0].id}/preview/0`, ctx.cookie);
    check("reports: a published example serves its cover preview as PNG", preview.status === 200 && (preview.headers.get("content-type") ?? "").startsWith("image/"), `got ${preview.status} ${preview.headers.get("content-type") ?? ""}`);
    const docx = await get(`/api/v1/report-builder/${seededExample.rows[0].id}/download?lang=ar`, ctx.cookie);
    check("reports: a published example downloads its Arabic edition", docx.status === 200, `got ${docx.status}`);
  }

  /* the request: a nominated type for a contributor, minimal sections so the build needs no model */
  const create = await send("/api/v1/report-builder", "POST", ctx.cookie, {
    typeCode: "statistical_highlights",
    period: { kind: "quarter", year: 2026, quarter: 3 },
    scope: { kind: "period" },
    languageMode: "en",
    sectionCodes: ["cover", "contents", "closing"],
  });
  const createJson = await json(create);
  const id: string | undefined = createJson?.data?.id;
  check("reports: a contributor may request a nominated type", create.status === 200 && Boolean(id), `${create.status} ${createJson?.error ?? ""}`);

  const custom = await send("/api/v1/report-builder", "POST", ctx.cookie, { typeCode: "custom", period: { kind: "year", year: 2026 }, scope: { kind: "org" }, languageMode: "en" });
  check("reports: the custom type is refused for a contributor", custom.status === 403, `got ${custom.status}`);

  const otherUnit = await ctx.db.execute(
    "select id from org_units where level = 'department' and id != (select coalesce(department_id, '') from users where email = 'analyst@enviroai.demo') limit 1"
  );
  if (otherUnit.rows[0]?.id) {
    const outside = await send("/api/v1/report-builder", "POST", ctx.cookie, { typeCode: "department_continuity", period: { kind: "year", year: 2026 }, scope: { kind: "department", id: String(otherUnit.rows[0].id) }, languageMode: "en" });
    check("reports: a department outside the requester's unit is refused", outside.status === 403, `got ${outside.status}`);
  }
  const wrongScope = await send("/api/v1/report-builder", "POST", ctx.cookie, { typeCode: "project_closure", period: { kind: "year", year: 2026 }, scope: { kind: "org" }, languageMode: "en" });
  check("reports: a scope of the wrong kind is rejected", wrongScope.status === 400, `got ${wrongScope.status}`);

  if (!id) return;

  /* the build runs on the shared worker; wait for it */
  let detail: any = null;
  for (let i = 0; i < 60; i++) {
    detail = await json(await get(`/api/v1/report-builder/${id}`, ctx.cookie));
    if (detail?.data?.report?.status && detail.data.report.status !== "generating") break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  const status = detail?.data?.report?.status;
  check("reports: the build finishes as a draft", status === "draft", `status ${status} ${detail?.data?.report?.error ?? ""}`);
  check("reports: the detail carries the requested sections", (detail?.data?.sections ?? []).length === 3 && detail.data.sections.every((s: { status: string }) => s.status === "ready"), JSON.stringify((detail?.data?.sections ?? []).map((s: { code: string; status: string }) => `${s.code}:${s.status}`)));
  check("reports: every section is bilingual", (detail?.data?.sections ?? []).every((s: { content: { title: { en: string; ar: string } } | null }) => s.content && s.content.title.en && s.content.title.ar));

  /* review */
  const edit = await send(`/api/v1/report-builder/${id}`, "PATCH", ctx.cookie, {
    action: "edit_section",
    code: "closing",
    patch: { blocks: [{ kind: "paragraph", text: { en: "Edited by the smoke test.", ar: "حُرر بواسطة اختبار الدخان." } }] },
  });
  const editJson = await json(edit);
  check("reports: a manual edit marks the section edited", edit.status === 200 && editJson?.data?.content?.meta?.editedBy, `${edit.status} ${editJson?.error ?? ""}`);
  const edited = await ctx.db.execute({ sql: "select status from report_sections where report_id = ? and section_code = 'closing'", args: [id] });
  check("reports: the edited section status is stored", edited.rows[0]?.status === "edited", String(edited.rows[0]?.status));

  const comment = await send(`/api/v1/report-builder/${id}`, "PATCH", ctx.cookie, { action: "comment", code: "cover", text: "Please check the subtitle." });
  check("reports: a section comment is accepted", comment.status === 200);

  /* regenerate one section through the worker: the section returns to ready and the version moves on */
  const regen = await send(`/api/v1/report-builder/${id}`, "PATCH", ctx.cookie, { action: "regenerate_section", code: "closing" });
  check("reports: regenerate_section is accepted", regen.status === 200, `got ${regen.status}`);
  let regenerated: any = null;
  for (let i = 0; i < 40; i++) {
    regenerated = await json(await get(`/api/v1/report-builder/${id}`, ctx.cookie));
    const closing = (regenerated?.data?.sections ?? []).find((s: { code: string }) => s.code === "closing");
    if (regenerated?.data?.report?.status === "draft" && closing?.status === "ready" && (regenerated?.data?.report?.version ?? 1) > 1) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  const closingAfter = (regenerated?.data?.sections ?? []).find((s: { code: string; status: string }) => s.code === "closing");
  check(
    "reports: the regenerated section is ready again and the version moved on",
    regenerated?.data?.report?.status === "draft" && closingAfter?.status === "ready" && (regenerated?.data?.report?.version ?? 1) > 1,
    `status ${regenerated?.data?.report?.status}, closing ${closingAfter?.status}, version ${regenerated?.data?.report?.version}`
  );

  const submit = await send(`/api/v1/report-builder/${id}`, "PATCH", ctx.cookie, { action: "submit" });
  const submitJson = await json(submit);
  check("reports: submit moves the report to in_review", submit.status === 200 && submitJson?.data?.status === "in_review", `${submit.status} ${submitJson?.data?.status ?? submitJson?.error}`);

  const approveAsContributor = await send(`/api/v1/report-builder/${id}`, "PATCH", ctx.cookie, { action: "approve" });
  check("reports: approve is refused for a contributor", approveAsContributor.status === 403, `got ${approveAsContributor.status}`);

  const approve = await send(`/api/v1/report-builder/${id}`, "PATCH", ctx.adminCookie, { action: "approve" });
  const approveJson = await json(approve);
  check("reports: the Super Admin approves", approve.status === 200 && approveJson?.data?.status === "approved", `${approve.status} ${approveJson?.error ?? ""}`);

  const publish = await send(`/api/v1/report-builder/${id}`, "PATCH", ctx.adminCookie, { action: "publish" });
  const publishJson = await json(publish);
  const publishedOk = publish.status === 200 && publishJson?.data?.status === "published";
  const pendingTemplate = publish.status === 409 && publishJson?.error === "docx_pending";
  check("reports: publish succeeds, or waits for the docx template", publishedOk || pendingTemplate, `${publish.status} ${publishJson?.error ?? ""}`);
  if (publishedOk) {
    const docId = publishJson?.data?.documentId;
    const doc = await ctx.db.execute({ sql: "select d.id, t.code from documents d left join taxonomy_terms t on t.id = d.knowledge_type_term_id where d.id = ?", args: [docId] });
    check("reports: publishing creates a report document in Institutional Memory", doc.rows.length === 1 && doc.rows[0]?.code === "report", String(doc.rows[0]?.code));
    const download = await get(`/api/v1/report-builder/${id}/download?lang=en`, ctx.cookie);
    check("reports: the requester downloads the docx", download.status === 200 && (download.headers.get("content-type") ?? "").includes("wordprocessingml"), `got ${download.status}`);
  } else {
    const download = await get(`/api/v1/report-builder/${id}/download?lang=en`, ctx.cookie);
    check("reports: download answers docx_pending while the template is missing", download.status === 409, `got ${download.status}`);
  }

  /* visibility: another person's unpublished report is invisible */
  const foreign = await ctx.db.execute("select id from reports where type_id is not null and status != 'published' and requested_by != (select id from users where email = 'analyst@enviroai.demo') limit 1");
  if (foreign.rows[0]?.id) {
    const hidden = await get(`/api/v1/report-builder/${foreign.rows[0].id}`, ctx.cookie);
    check("reports: another requester's draft is not visible", hidden.status === 404, `got ${hidden.status}`);
  }

  /* the smoke's own report leaves the gallery and Institutional Memory */
  await cleanupReport(ctx, id);

  /* Ask EnviroAI tools */
  const { runTool, AnalystState } = await import("../src/server/ai/analyst/tools");
  const { getUserById } = await import("../src/server/auth/session");
  const adminRow = await ctx.db.execute("select id from users where email = 'admin@enviroai.demo'");
  const askUser = adminRow.rows[0]?.id ? await getUserById(String(adminRow.rows[0].id)) : null;
  if (askUser) {
    const state = new AnalystState();
    const toolCtx = { user: askUser, state } as never;
    const typesText = await runTool(toolCtx, "list_report_types", {});
    check("reports: list_report_types names the Annual Report", typesText.includes("Annual Environment Report") && typesText.includes("leadership_briefing"));
    const found = await runTool(toolCtx, "find_reports", { type: "annual", include_mine: true });
    check("reports: find_reports returns a /reports/ link", /\/reports\/[0-9A-Z]{26}/.test(found), found.slice(0, 120));
  }
}
