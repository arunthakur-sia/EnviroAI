/* eslint-disable no-console */
// CR08 9: smoke checks for OwnerControl's person card, in-app messaging, the
// Inbox, delegates and the get_owner tool. Privacy is checked explicitly: an
// admin cannot read another pair's thread, and a message body never reaches
// the search index or the search service.
//   ctx.cookie is a Contributor session (analyst@enviroai.demo), ctx.adminCookie the
//   Super Admin, ctx.db a raw libsql client.
import type { Client } from "@libsql/client";

type Check = (name: string, ok: boolean, detail?: string) => void;
type Ctx = { base: string; cookie: string; adminCookie: string; db: Client };

type ThreadRow = { id: string; unread: boolean; status: string; questionId: string | null; asDelegateFor: unknown; others: { id: string }[] };
type ThreadDetail = { id: string; messages: { body: string; attachments: { documentId: string }[] }[]; participants: { id: string }[] };

async function getJson<T>(ctx: Ctx, cookie: string, path: string, init: RequestInit = {}) {
  const res = await fetch(ctx.base + path, {
    ...init,
    headers: { ...((init.headers as Record<string, string>) ?? {}), cookie },
  });
  const json = (await res.json().catch(() => ({ data: null }))) as { data: T | null; error?: string | null };
  return { status: res.status, data: json.data, error: json.error };
}
const post = (body: unknown, method = "POST"): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

async function getHtml(ctx: Ctx, cookie: string, path: string) {
  const res = await fetch(ctx.base + path, { headers: { cookie } });
  return { status: res.status, html: await res.text() };
}

export async function run(check: Check, ctx: Ctx): Promise<void> {
  const one = async (sqlText: string) => (await ctx.db.execute(sqlText)).rows[0] ?? {};
  const idOf = async (email: string) => String((await one(`select id from users where email = '${email}'`)).id ?? "");
  const analystId = await idOf("analyst@enviroai.demo");
  const headId = await idOf("head.stats@enviroai.demo");
  const knowledgeId = await idOf("knowledge@enviroai.demo");

  /* a run that died before its cleanup (the shared dev server restarts under
     load) leaves its thread behind and would inflate the next run's counts */
  const SMOKE_SUBJECT = "Smoke: about the population indicator";
  const stale = (await ctx.db.execute(`select id from message_threads where subject = '${SMOKE_SUBJECT}'`)).rows;
  for (const row of stale) {
    const id = String(row.id);
    await ctx.db.execute(`delete from messages where thread_id = '${id}'`);
    await ctx.db.execute(`delete from thread_participants where thread_id = '${id}'`);
    await ctx.db.execute(`delete from message_threads where id = '${id}'`);
    await ctx.db.execute(`delete from notifications where link = '/inbox?thread=${id}'`);
  }
  const staleQuestions = (await ctx.db.execute(`select id from questions where title_en = '${SMOKE_SUBJECT}'`)).rows;
  for (const row of staleQuestions) {
    const qid = String(row.id);
    await ctx.db.execute(`delete from question_routes where question_id = '${qid}'`);
    await ctx.db.execute(`delete from search_index where resource_type = 'question' and resource_id = '${qid}'`);
    await ctx.db.execute(`delete from notifications where link = '/ask/${qid}'`);
    await ctx.db.execute(`delete from questions where id = '${qid}'`);
  }

  /* ---- seed ---- */
  const seeded = await one("select count(*) as c from message_threads where id like 'cr08msg_thread_%'");
  check("six seeded conversations exist", Number(seeded.c) === 6, `${seeded.c}`);
  const done = await one("select count(*) as c from message_threads where id like 'cr08msg_thread_%' and status = 'done'");
  const attached = await one("select count(*) as c from messages where thread_id like 'cr08msg_thread_%' and attachments_json is not null");
  const delegated = await one(`select count(*) as c from thread_participants where thread_id like 'cr08msg_thread_%' and is_delegate_for_user_id = '${headId}'`);
  check(
    "seed covers a done thread, an attachment and a delegate participant",
    Number(done.c) >= 1 && Number(attached.c) >= 1 && Number(delegated.c) >= 1,
    `done ${done.c}, attachments ${attached.c}, delegate rows ${delegated.c}`
  );
  const headDelegate = await one(`select delegate_user_id, delegate_from, delegate_to from users where id = '${headId}'`);
  check("head.stats delegates to a colleague with a date range", Boolean(headDelegate.delegate_user_id) && Boolean(headDelegate.delegate_from) && Boolean(headDelegate.delegate_to));

  /* ---- listing and privacy ---- */
  const list = await getJson<ThreadRow[]>(ctx, ctx.cookie, "/api/v1/messages");
  const rows = list.data ?? [];
  let allMine = rows.length > 0;
  for (const r of rows) {
    const p = await one(`select count(*) as c from thread_participants where thread_id = '${r.id}' and user_id = '${analystId}'`);
    if (Number(p.c) !== 1) allMine = false;
  }
  check("the Inbox lists only threads the viewer participates in", list.status === 200 && allMine, `${list.status}, ${rows.length} rows`);
  const adminPeek = await getJson(ctx, ctx.adminCookie, "/api/v1/messages/cr08msg_thread_3");
  check("an admin cannot read another pair's thread (404)", adminPeek.status === 404, `${adminPeek.status}`);
  const adminList = await getJson<ThreadRow[]>(ctx, ctx.adminCookie, "/api/v1/messages");
  check(
    "the admin's own list never carries the reader and head.stats thread",
    adminList.status === 200 && !(adminList.data ?? []).some((r) => r.id === "cr08msg_thread_3")
  );
  const anon = await fetch(ctx.base + "/api/v1/messages");
  check("messages API refuses an anonymous caller", anon.status === 401, `${anon.status}`);

  /* ---- unread flips on read ---- */
  await ctx.db.execute(`update thread_participants set last_read_at = null where thread_id = 'cr08msg_thread_2' and user_id = '${analystId}'`);
  const before = await getJson<ThreadRow[]>(ctx, ctx.cookie, "/api/v1/messages?filter=unread");
  const wasUnread = (before.data ?? []).some((r) => r.id === "cr08msg_thread_2" && r.unread);
  const opened = await getJson<ThreadDetail>(ctx, ctx.cookie, "/api/v1/messages/cr08msg_thread_2");
  const after = await getJson<ThreadRow[]>(ctx, ctx.cookie, "/api/v1/messages");
  const nowRead = (after.data ?? []).some((r) => r.id === "cr08msg_thread_2" && !r.unread);
  check("unread count changes once the thread is read", wasUnread && opened.status === 200 && nowRead);
  check(
    "the thread carries its attachment and its messages",
    Boolean(opened.data && opened.data.messages.length >= 3 && opened.data.messages.some((m) => m.attachments.length > 0))
  );

  /* ---- create, delegate, reply, convert, done ---- */
  const secret = `SMOKE-PRIVATE-${Date.now().toString(36)}`;
  const created = await getJson<{ id: string }>(
    ctx,
    ctx.cookie,
    "/api/v1/messages",
    post({
      toUserId: headId,
      subject: SMOKE_SUBJECT,
      body: `${secret} this sentence must never be searchable.`,
      resource: { type: "unit", id: "smoke", titleEn: "Smoke unit", titleAr: "وحدة الاختبار", link: "/organisation" },
    })
  );
  const threadId = created.data?.id ?? "";
  check("a Contributor can start a thread with head.stats", created.status === 200 && Boolean(threadId), `${created.status} ${created.error ?? ""}`);
  const delegateRow = await one(`select user_id from thread_participants where thread_id = '${threadId}' and is_delegate_for_user_id = '${headId}'`);
  check("the recipient's active delegate joins the thread as delegate", Boolean(delegateRow.user_id));
  const notes = await one(`select count(*) as c from notifications where link = '/inbox?thread=${threadId}' and kind = 'message'`);
  check("the recipient and the delegate are notified with the Inbox deep link", Number(notes.c) >= 2, `${notes.c}`);

  const replied = await getJson<{ id: string }>(ctx, ctx.cookie, `/api/v1/messages/${threadId}`, post({ action: "reply", body: "A second line." }, "PATCH"));
  const count = await one(`select count(*) as c, max(created_at) as last from messages where thread_id = '${threadId}'`);
  const th = await one(`select last_message_at from message_threads where id = '${threadId}'`);
  check("a reply appends a message and moves last_message_at", replied.status === 200 && Number(count.c) === 2 && th.last_message_at === count.last);

  /* ---- messages never reach search (checked BEFORE the thread is converted:
     converting publishes the opening message as an Ask EnviroAI question by the
     participant's explicit choice, and questions are indexed) ---- */
  const idx = await one(`select count(*) as c from search_index where text like '%${secret}%'`);
  const chunks = await one(`select count(*) as c from document_chunks where text like '%${secret}%'`);
  check("a message body is absent from the search index tables", Number(idx.c) === 0 && Number(chunks.c) === 0);
  try {
    const { runSearch } = await import("../src/server/services/search");
    const { getUserById } = await import("../src/server/auth/session");
    const admin = await getUserById(await idOf("admin@enviroai.demo"));
    const results = admin ? await runSearch(admin, secret, "en") : null;
    check(
      "the search service returns no result carrying a message body",
      results !== null && !results.results.some((r) => JSON.stringify(r).includes(secret))
    );
  } catch (e) {
    check("the search service returns no result carrying a message body", false, (e as Error).message);
  }
  const page = await getHtml(ctx, ctx.adminCookie, `/en/search?q=${encodeURIComponent("must never be searchable")}`);
  check("the search page shows no message text", page.status === 200 && !page.html.includes(secret));

  const converted = await getJson<{ questionId: string; routed: boolean }>(ctx, ctx.cookie, `/api/v1/messages/${threadId}`, post({ action: "convert" }, "PATCH"));
  const qid = converted.data?.questionId ?? "";
  const q = await one(`select title_en, status from questions where id = '${qid}'`);
  const linked = await one(`select question_id from message_threads where id = '${threadId}'`);
  check(
    "convert creates an Ask EnviroAI question linked to the thread",
    converted.status === 200 && Boolean(qid) && q.title_en === SMOKE_SUBJECT && linked.question_id === qid,
    `${converted.status} ${converted.error ?? ""}`
  );
  const route = await one(`select count(*) as c from question_routes where question_id = '${qid}'`);
  check("the converted question is routed to the counterpart's expert profile", Number(route.c) >= 1 || converted.data?.routed === false, `routes ${route.c}, routed ${converted.data?.routed}`);
  const doneRes = await getJson(ctx, ctx.cookie, `/api/v1/messages/${threadId}`, post({ action: "done" }, "PATCH"));
  const doneList = await getJson<ThreadRow[]>(ctx, ctx.cookie, "/api/v1/messages?filter=done");
  check("mark done moves the thread to the done filter", doneRes.status === 200 && (doneList.data ?? []).some((r) => r.id === threadId && r.status === "done"));

  /* ---- person card and people search ---- */
  const [indicator] = (await ctx.db.execute("select id from indicators order by code limit 1")).rows;
  const card = await getJson<{ breadcrumb: unknown[]; delegate: unknown; email: string; links: { unit: string | null } }>(
    ctx,
    ctx.cookie,
    `/api/v1/people/${headId}/card?itemType=indicator&itemId=${indicator?.id ?? ""}`
  );
  check(
    "the person card carries the unit breadcrumb, the email and the active delegate",
    card.status === 200 && Boolean(card.data && card.data.breadcrumb.length >= 1 && card.data.delegate && card.data.email && card.data.links.unit)
  );
  const cardMissing = await getJson(ctx, ctx.cookie, "/api/v1/people/nobody/card");
  check("an unknown person answers 404", cardMissing.status === 404);
  const people = await getJson<{ id: string }[]>(ctx, ctx.cookie, "/api/v1/people?q=al");
  check("people search answers colleagues and never the caller", people.status === 200 && (people.data?.length ?? 0) > 0 && !(people.data ?? []).some((p) => p.id === analystId));

  /* ---- delegate ---- */
  const setDel = await getJson<{ delegate: { id: string } | null; active: boolean }>(ctx, ctx.cookie, "/api/v1/profile/delegate", post({ delegateUserId: knowledgeId, from: null, to: null }, "PUT"));
  const stored = await one(`select delegate_user_id from users where id = '${analystId}'`);
  check("PUT /profile/delegate stores the delegate", setDel.status === 200 && stored.delegate_user_id === knowledgeId && setDel.data?.active === true);
  const selfDel = await getJson(ctx, ctx.cookie, "/api/v1/profile/delegate", post({ delegateUserId: analystId }, "PUT"));
  check("delegating to yourself is refused", selfDel.status === 400);
  const clearDel = await getJson(ctx, ctx.cookie, "/api/v1/profile/delegate", post({ delegateUserId: null }, "PUT"));
  const cleared = await one(`select delegate_user_id from users where id = '${analystId}'`);
  check("clearing the delegate empties the columns", clearDel.status === 200 && !cleared.delegate_user_id);
  const bad = await getJson(ctx, ctx.cookie, "/api/v1/messages", post({ subject: "x" }));
  check("creating a thread validates its body", bad.status === 400);

  /* ---- pages ---- */
  const inboxEn = await getHtml(ctx, ctx.cookie, "/en/inbox");
  const inboxAr = await getHtml(ctx, ctx.cookie, "/ar/inbox");
  check("the Inbox renders in both locales", inboxEn.status === 200 && inboxEn.html.includes('data-testid="inbox"') && inboxAr.status === 200 && inboxAr.html.includes("صندوق الوارد"));
  check(
    "the Inbox offers the unread, item type and person filters",
    inboxEn.html.includes('data-testid="inbox-filter-unread"') &&
      inboxEn.html.includes('data-testid="inbox-filter-item"') &&
      inboxEn.html.includes('data-testid="inbox-filter-person"'),
    "unread tab, item type select, person select"
  );
  const profile = await getHtml(ctx, ctx.cookie, "/en/profile");
  check("the profile carries the delegate block", profile.status === 200 && profile.html.includes('data-testid="delegate-block"'));

  /* ---- Ask EnviroAI tool ---- */
  try {
    const { runTool, AnalystState } = await import("../src/server/ai/analyst/tools");
    const { getUserById } = await import("../src/server/auth/session");
    const user = await getUserById(analystId);
    if (user) {
      const [unit] = (await ctx.db.execute(`select code from org_units where id = (select department_id from users where id = '${headId}')`)).rows;
      const owner = await runTool({ user, state: new AnalystState() } as never, "get_owner", { item_type: "unit", item: String(unit?.code ?? "") });
      check("get_owner names the unit head with person-card facts", /UNIT HEAD|DEPARTMENT OWNER/.test(owner) && /Unit:|headed by/.test(owner), owner.slice(0, 120));
      check("get_owner never carries a message body", !owner.includes(secret) && !/must never be searchable/.test(owner));
      const docOwner = await runTool({ user, state: new AnalystState() } as never, "get_owner", { item_type: "document", item: "National Development Strategy" });
      check("get_owner resolves a document custodian by title", /^\[1\]/.test(docOwner) && /CUSTODIAN|No owner/.test(docOwner), docOwner.slice(0, 100));
    } else {
      check("get_owner tool user loaded", false, "analyst user missing");
    }
  } catch (e) {
    check("get_owner tool runs", false, (e as Error).message);
  }

  /* ---- cleanup of the smoke thread and its converted question ---- */
  await ctx.db.execute(`delete from messages where thread_id = '${threadId}'`);
  await ctx.db.execute(`delete from thread_participants where thread_id = '${threadId}'`);
  await ctx.db.execute(`delete from message_threads where id = '${threadId}'`);
  await ctx.db.execute(`delete from notifications where link = '/inbox?thread=${threadId}'`);
  if (qid) {
    await ctx.db.execute(`delete from question_routes where question_id = '${qid}'`);
    await ctx.db.execute(`delete from search_index where resource_type = 'question' and resource_id = '${qid}'`);
    await ctx.db.execute(`delete from notifications where link = '/ask/${qid}'`);
    await ctx.db.execute(`delete from questions where id = '${qid}'`);
  }
}
