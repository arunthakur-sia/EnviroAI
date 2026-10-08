/* eslint-disable no-console */
// CR08 6: smoke checks for the rebuilt handover. Wired into scripts/smoke.ts
// by the coordinator (section 19 auto-discovers smoke-cr08-*.ts).
//   ctx.cookie is a Contributor session (analyst@enviroai.demo), ctx.adminCookie the
//   Super Admin, ctx.db a raw libsql client.
import type { Client } from "@libsql/client";

type Check = (name: string, ok: boolean, detail?: string) => void;
type Ctx = { base: string; cookie: string; adminCookie: string; db: Client };

/** The shared dev server resets connections when several suites hit it at
    once; a transport failure is retried, a status is never retried. */
async function fetchRetry(url: string, init: RequestInit, tries = 3): Promise<Response> {
  let last: unknown = null;
  for (let i = 0; i < tries; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

async function call<T>(ctx: Ctx, cookie: string, path: string, init: RequestInit = {}) {
  const res = await fetchRetry(ctx.base + path, {
    ...init,
    headers: { "content-type": "application/json", ...((init.headers as Record<string, string>) ?? {}), cookie },
  });
  const json = (await res.json().catch(() => ({ data: null, error: "bad_json" }))) as { data: T | null; error?: string | null };
  return { status: res.status, data: json.data, error: json.error ?? null };
}

async function loginCookie(ctx: Ctx, email: string): Promise<string> {
  const res = await fetchRetry(`${ctx.base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "EnviroAI!2026" }),
  });
  const set = res.headers.get("set-cookie") ?? "";
  return set.split(";")[0];
}

export async function run(check: Check, ctx: Ctx): Promise<void> {
  /* ---- the seeded records ---- */
  const seeded = await ctx.db.execute("select id, notes, person_kind, status, report_document_id, cut_off_at, override_reason, user_id from handovers where notes like '[Illustrative] cr08-seed:%' order by notes");
  const a = seeded.rows.find((r) => String(r.notes).startsWith("[Illustrative] cr08-seed:a"));
  const b = seeded.rows.find((r) => String(r.notes).startsWith("[Illustrative] cr08-seed:b"));
  const c = seeded.rows.find((r) => String(r.notes).startsWith("[Illustrative] cr08-seed:c"));
  check("the three seeded handovers exist (internal, external, closed)", Boolean(a && b && c), `${seeded.rows.length} seeded`);
  check("the external handover stores the expert id as its person", Boolean(b) && String(b?.person_kind) === "external", String(b?.person_kind));
  const items = await ctx.db.execute({ sql: "select count(*) as n, sum(case when category is null then 1 else 0 end) as uncategorised from handover_items where handover_id = ?", args: [String(a?.id ?? "")] });
  check("the internal handover carries a categorised inventory", Number(items.rows[0].n) >= 5 && Number(items.rows[0].uncategorised) === 0, `${items.rows[0].n} items`);
  const mixed = await ctx.db.execute({ sql: "select sum(case when recipient_kind = 'person' then 1 else 0 end) as p, sum(case when recipient_kind = 'system' then 1 else 0 end) as s from handover_items where handover_id = ?", args: [String(a?.id ?? "")] });
  check("recipients are mixed: most items to a person, a few to the system", Number(mixed.rows[0].p) > Number(mixed.rows[0].s) && Number(mixed.rows[0].s) >= 1, `${mixed.rows[0].p} person / ${mixed.rows[0].s} system`);
  const interviews = await ctx.db.execute({ sql: "select status, insight_lesson_id from handover_interviews where handover_id = ?", args: [String(a?.id ?? "")] });
  const complete = interviews.rows.find((r) => r.status === "complete");
  check("one interview complete with an Expert Insights lesson, one in progress", Boolean(complete?.insight_lesson_id) && interviews.rows.some((r) => r.status === "in_progress"), interviews.rows.map((r) => r.status).join(","));
  if (complete?.insight_lesson_id) {
    const lesson = await ctx.db.execute({ sql: "select category, status from lessons where id = ?", args: [String(complete.insight_lesson_id)] });
    check("the insight lesson is a published expert lesson", lesson.rows[0]?.category === "expert" && lesson.rows[0]?.status === "published");
  }
  const paths = await ctx.db.execute({ sql: "select modules_json, progress_json, signed_off_at from handover_learning_paths where handover_id = ?", args: [String(a?.id ?? "")] });
  const modules = paths.rows[0] ? (JSON.parse(String(paths.rows[0].modules_json)) as { understoodAt: string | null; checkQuestion: { en: string; ar: string } }[]) : [];
  // the seed marks two understood; a demo or a probe may mark more, so the
  // check is "some understood, some still open", never an exact count
  const understood = modules.filter((m) => m.understoodAt).length;
  check(
    "the learning path has modules, some understood, some still open, every module with a bilingual check question",
    modules.length >= 3 && understood >= 2 && understood < modules.length && modules.every((m) => m.checkQuestion.en && m.checkQuestion.ar),
    `${understood} of ${modules.length} modules understood`
  );
  const filingB = await ctx.db.execute({ sql: "select filing_status from handover_items where handover_id = ? and recipient_kind = 'system'", args: [String(b?.id ?? "")] });
  check("the external handover's items carry filing proposals with one approved", filingB.rows.some((r) => r.filing_status === "approved") && filingB.rows.every((r) => r.filing_status !== "none"), filingB.rows.map((r) => r.filing_status).join(","));
  const accessB = await ctx.db.execute({ sql: "select access_token_hash, access_expires_at, access_revoked_at from handovers where id = ?", args: [String(b?.id ?? "")] });
  check("the external handover has an access link hash with an expiry, never the plain token", Boolean(accessB.rows[0]?.access_token_hash) && String(accessB.rows[0]?.access_token_hash).length === 64 && Boolean(accessB.rows[0]?.access_expires_at));
  check("the closed handover was cut off, carries a logged override and an archived report document", Boolean(c?.cut_off_at) && Boolean(c?.override_reason) && Boolean(c?.report_document_id));
  if (c?.report_document_id) {
    const doc = await ctx.db.execute({ sql: "select title_en, classification_level, source_ref from documents where id = ?", args: [String(c.report_document_id)] });
    check("the report document is titled 'Handover report: <name>' at classification 2", String(doc.rows[0]?.title_en ?? "").startsWith("Handover report:") && Number(doc.rows[0]?.classification_level) === 2, String(doc.rows[0]?.title_en));
  }
  const paid = await ctx.db.execute({ sql: "select event_type, count(*) as n from game_events where resource_id = ? and event_type in ('handover_completed','handover_completed_owner') group by event_type", args: [String(c?.id ?? "")] });
  check("closing paid the completion points once each", paid.rows.length >= 1 && paid.rows.every((r) => Number(r.n) === 1), paid.rows.map((r) => `${r.event_type}=${r.n}`).join(","));

  /* ---- the APIs and permissions ---- */
  const list = await call<{ rows: { id: string; readiness: boolean }[] }>(ctx, ctx.adminCookie, "/api/v1/handover");
  check("GET /api/v1/handover lists the handovers for the Super Admin with readiness", list.status === 200 && (list.data?.rows.length ?? 0) >= 3);
  const readerCookie = await loginCookie(ctx, "reader@enviroai.demo");
  const readerStart = await call(ctx, readerCookie, "/api/v1/handover", { method: "POST", body: JSON.stringify({ person: { userId: "x" }, kind: "leaving", recipient: { mode: "per_item" } }) });
  check("a reader cannot start a handover", readerStart.status === 403 || readerStart.status === 404, `${readerStart.status}`);
  const headCookie = await loginCookie(ctx, "head.stats@enviroai.demo");
  const other = await ctx.db.execute("select id from users where email = 'lina.alhazmi@enviroai.demo'");
  const headStart = await call(ctx, headCookie, "/api/v1/handover", { method: "POST", body: JSON.stringify({ person: { userId: String(other.rows[0]?.id) }, kind: "leaving", recipient: { mode: "per_item" } }) });
  check("a department head cannot start a handover for another unit", headStart.status === 403, `${headStart.status} ${headStart.error}`);
  const contributorList = await call(ctx, ctx.cookie, "/api/v1/handover");
  check("a contributor gets no administrator list", contributorList.status === 403);
  const mine = await call<{ mine: unknown; recipient: unknown[] }>(ctx, ctx.cookie, "/api/v1/handover?mine=1");
  check("GET ?mine=1 answers for a contributor without a handover", mine.status === 200 && mine.data?.mine === null);

  /* ---- close refused while items are open; override logged ---- */
  const detailA = await call<{ readiness: { ok: boolean }; id: string }>(ctx, ctx.adminCookie, `/api/v1/handover/${a?.id}`);
  check("the internal handover is not ready to close (open recipients and sign-offs)", detailA.status === 200 && detailA.data?.readiness.ok === false);
  const refused = await call(ctx, ctx.adminCookie, `/api/v1/handover/${a?.id}`, { method: "PATCH", body: JSON.stringify({ action: "close" }) });
  check("closing is refused while checks are open", refused.status === 409 && refused.error === "not_ready", `${refused.status} ${refused.error}`);
  const overrideAudit = await ctx.db.execute({ sql: "select count(*) as n from audit_log where action = 'handover_override' and resource_id = ?", args: [String(c?.id ?? "")] });
  check("the override on the closed handover is in the audit log", Number(overrideAudit.rows[0].n) >= 1);
  const transcriptsAudited = await ctx.db.execute("select count(*) as n from audit_log where action like 'handover_interview%' and meta_json like '%transcript%'");
  check("interview text is never audited", Number(transcriptsAudited.rows[0].n) === 0);

  /* ---- the token: valid once, expired after the last working day ---- */
  const bad = await call(ctx, "", "/api/v1/handover/access/" + "0".repeat(48));
  check("an unknown token is refused", bad.status === 403);
  const link = await call<{ token: string; expiresAt: string }>(ctx, ctx.adminCookie, `/api/v1/handover/${b?.id}`, { method: "PATCH", body: JSON.stringify({ action: "access_link" }) });
  check("an administrator can create the access link", link.status === 200 && Boolean(link.data?.token));
  if (link.data?.token) {
    const ws = await call<{ items: unknown[]; topics: unknown[]; recipients: unknown[] }>(ctx, "", `/api/v1/handover/access/${link.data.token}`);
    check("the token opens the minimal workspace (checklist, no recipients)", ws.status === 200 && (ws.data?.items.length ?? 0) > 0 && ws.data?.recipients.length === 0);
    // expire it: set the expiry in the past, then the nightly pass revokes it
    await ctx.db.execute({ sql: "update handovers set access_expires_at = '2000-01-01T00:00:00.000Z' where id = ?", args: [String(b?.id)] });
    const expired = await call(ctx, "", `/api/v1/handover/access/${link.data.token}`);
    check("the token stops working past the last working day", expired.status === 403);
    try {
      const { runHandoverNightly } = await import("../src/server/services/handover");
      const nightly = await runHandoverNightly();
      const revoked = await ctx.db.execute({ sql: "select access_revoked_at from handovers where id = ?", args: [String(b?.id)] });
      check("the nightly pass revokes the expired link", nightly.expired >= 1 && Boolean(revoked.rows[0]?.access_revoked_at), JSON.stringify(nightly));
    } catch (e) {
      check("the nightly pass runs", false, (e as Error).message);
    }
    // restore a fresh link for the demo (a new token, hash only stored)
    await call(ctx, ctx.adminCookie, `/api/v1/handover/${b?.id}`, { method: "PATCH", body: JSON.stringify({ action: "access_link" }) });
  }

  /* ---- HR risk rules read the new records ---- */
  const gaps = await ctx.db.execute("select count(*) as n from hr_risks where kind = 'incomplete_handover' and resolved_at is null");
  check("the HR risk register carries the handover rules (incomplete or gaps)", Number(gaps.rows[0].n) >= 1, `${gaps.rows[0].n}`);

  /* ---- Ask EnviroAI tools ---- */
  try {
    const { runTool, AnalystState } = await import("../src/server/ai/analyst/tools");
    const { getUserById } = await import("../src/server/auth/session");
    const adminRow = await ctx.db.execute("select id from users where email = 'hr@enviroai.demo'");
    const hrUser = await getUserById(String(adminRow.rows[0]?.id));
    const text = hrUser ? await runTool({ user: hrUser, state: new AnalystState() } as never, "get_handovers_in_scope", {}) : "";
    check("get_handovers_in_scope answers for the HR Admin with readiness", /handover\(s\) in your scope/.test(text) && /READY|not ready/.test(text), text.slice(0, 100));
    const personRow = await ctx.db.execute("select id from users where email = 'abdulrahman.albalawi@enviroai.demo'");
    const person = await getUserById(String(personRow.rows[0]?.id));
    const mineText = person ? await runTool({ user: person, state: new AnalystState() } as never, "get_my_handover", {}) : "";
    check("get_my_handover answers for the leaving person", /Your handover/.test(mineText), mineText.slice(0, 100));
    const recipientRow = await ctx.db.execute("select id from users where email = 'mohammed.alqarni@enviroai.demo'");
    const recipient = await getUserById(String(recipientRow.rows[0]?.id));
    const pathText = recipient ? await runTool({ user: recipient, state: new AnalystState() } as never, "get_learning_path", {}) : "";
    check("get_learning_path answers for the recipient without transcripts", /modules understood/.test(pathText) && !/EnviroAI asks/.test(pathText), pathText.slice(0, 100));
  } catch (e) {
    check("handover tools run", false, (e as Error).message);
  }
}
