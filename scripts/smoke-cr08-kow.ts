/* eslint-disable no-console */
// CR08 8: smoke checks for the Knowledge of the Week. Wired into
// scripts/smoke.ts by the coordinator.
//   ctx.cookie is a Contributor session (analyst@enviroai.demo), ctx.adminCookie the
//   Super Admin, ctx.db a raw libsql client.
// The writes below target a far-future week and are removed again at the
// end, so the seeded picks are untouched.
import type { Client } from "@libsql/client";

type Check = (name: string, ok: boolean, detail?: string) => void;
type Ctx = { base: string; cookie: string; adminCookie: string; db: Client };

type Card = {
  id: string;
  weekStart: string;
  status: string;
  resourceType: string;
  resourceId: string;
  titleEn: string;
  titleAr: string;
  href: string;
  contributor: { id: string; nameEn: string; unitNameEn: string | null } | null;
  noteEn: string | null;
  noteAr: string | null;
  readCount: number;
  viewerRead: boolean;
  viewerSeen: boolean;
};
type Hall = { canManage: boolean; current: Card | null; scheduled: Card[]; months: { key: string; items: Card[] }[]; total: number };

async function getJson<T>(ctx: Ctx, cookie: string, path: string, init: RequestInit = {}) {
  const res = await fetch(ctx.base + path, {
    ...init,
    headers: { ...((init.headers as Record<string, string>) ?? {}), cookie },
  });
  const json = (await res.json().catch(() => ({ data: null }))) as { data: T | null; error?: string | null };
  return { status: res.status, data: json.data, error: json.error };
}

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const patch = (body: unknown): RequestInit => ({ ...post(body), method: "PATCH" });

function mondayPlusWeeks(weeks: number): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1) + weeks * 7);
  return d.toISOString().slice(0, 10);
}

export async function run(check: Check, ctx: Ctx): Promise<void> {
  /* ---- seeded state ---- */
  const rules = await ctx.db.execute("select event_type, points from game_rules where event_type in ('kow_contributor','kow_unit','kow_read') order by event_type");
  check(
    "the three rules exist with the CR08 points",
    rules.rows.length === 3 &&
      rules.rows.every((r) => ({ kow_contributor: 150, kow_unit: 100, kow_read: 10 })[String(r.event_type)] === Number(r.points))
  );
  const badge = await ctx.db.execute("select id from badges where code = 'knowledge_of_week' and family = 'guardian'");
  check("the knowledge_of_week badge exists in the guardian family", badge.rows.length === 1);
  const counts = await ctx.db.execute("select status, count(*) as n from knowledge_of_week group by status");
  const byStatus = Object.fromEntries(counts.rows.map((r) => [String(r.status), Number(r.n)]));
  check("one active pick, four or more archived, one scheduled", byStatus.active === 1 && (byStatus.archived ?? 0) >= 4 && (byStatus.scheduled ?? 0) >= 1, JSON.stringify(byStatus));
  const dup = await ctx.db.execute("select week_start, count(*) as n from knowledge_of_week group by week_start having n > 1");
  check("one pick per week", dup.rows.length === 0);

  /* ---- the active card ---- */
  const active = await getJson<Card>(ctx, ctx.cookie, "/api/v1/knowledge-of-week?view=active");
  check("GET ?view=active answers with the card", active.status === 200 && Boolean(active.data?.id && active.data.titleEn && active.data.titleAr && active.data.href));
  check("the card carries the contributor and the bilingual note", Boolean(active.data?.contributor?.nameEn && active.data?.noteEn && active.data?.noteAr));
  const activeId = active.data?.id ?? "";

  /* ---- the ribbon id set and toShelfDocs ---- */
  const ids = await getJson<string[]>(ctx, ctx.cookie, "/api/v1/knowledge-of-week?view=ids");
  check("GET ?view=ids lists the active pick", ids.status === 200 && Boolean(ids.data?.includes(`${active.data?.resourceType}:${active.data?.resourceId}`)));
  try {
    const { toShelfDocs } = await import("../src/server/services/documents");
    const { db, schema } = await import("../src/server/db/client");
    const { eq } = await import("drizzle-orm");
    const rows = await db.select().from(schema.documents).where(eq(schema.documents.id, active.data?.resourceId ?? "")).limit(1);
    const shelf = await toShelfDocs(rows);
    check("toShelfDocs flags the pick with kow: true", shelf.length === 1 && shelf[0].kow === true);
  } catch (e) {
    check("toShelfDocs flags the pick with kow: true", false, (e as Error).message);
  }

  /* ---- permissions ---- */
  const forbidden = await getJson(ctx, ctx.cookie, "/api/v1/knowledge-of-week", post({ resourceType: "document", resourceId: "x", weekStart: mondayPlusWeeks(30) }));
  check("a contributor cannot set the Knowledge of the Week", forbidden.status === 403);
  const schedule403 = await getJson(ctx, ctx.cookie, "/api/v1/knowledge-of-week?view=schedule");
  check("a contributor cannot read the schedule", schedule403.status === 403);

  /* ---- set, conflict, replace on a far-future week ---- */
  const weekA = mondayPlusWeeks(30);
  const docRows = await ctx.db.execute(
    "select d.id from documents d join users u on u.id = d.owner_user_id where d.status = 'verified' and d.deleted_at is null and d.classification_level <= 2 and u.department_id is not null and d.id not in (select resource_id from knowledge_of_week) limit 2"
  );
  const docA = String(docRows.rows[0]?.id ?? "");
  const docB = String(docRows.rows[1]?.id ?? docA);
  const draft = await ctx.db.execute("select id from documents where status <> 'verified' and deleted_at is null limit 1");
  const draftId = String(draft.rows[0]?.id ?? "");
  const created: string[] = [];
  try {
    if (draftId) {
      const notEligible = await getJson(ctx, ctx.adminCookie, "/api/v1/knowledge-of-week", post({ resourceType: "document", resourceId: draftId, weekStart: weekA }));
      check("an unverified document is refused (422)", notEligible.status === 422, `${notEligible.status}`);
    }
    const badWeek = await getJson(ctx, ctx.adminCookie, "/api/v1/knowledge-of-week", post({ resourceType: "document", resourceId: docA, weekStart: "2020-01-06" }));
    check("a past week is refused (400)", badWeek.status === 400);
    const notMonday = await getJson(ctx, ctx.adminCookie, "/api/v1/knowledge-of-week", post({ resourceType: "document", resourceId: docA, weekStart: mondayPlusWeeks(30).replace(/\d{2}$/, (d) => String(Number(d) + 1).padStart(2, "0")) }));
    check("a week that does not start on a Monday is refused", notMonday.status === 400);

    const set = await getJson<{ id: string; status: string }>(ctx, ctx.adminCookie, "/api/v1/knowledge-of-week", post({ resourceType: "document", resourceId: docA, weekStart: weekA, noteEn: "Smoke note", noteAr: "ملاحظة تجريبية" }));
    check("the Super Admin sets a future pick (201, scheduled)", set.status === 201 && set.data?.status === "scheduled", `${set.status} ${set.data?.status}`);
    if (set.data?.id) created.push(set.data.id);
    const conflict = await getJson<{ id: string; titleEn: string }>(ctx, ctx.adminCookie, "/api/v1/knowledge-of-week", post({ resourceType: "document", resourceId: docB, weekStart: weekA }));
    check("a second pick for the same week answers 409 with the existing title", conflict.status === 409 && Boolean(conflict.data?.titleEn));
    const replace = await getJson<{ id: string; replaced: boolean }>(ctx, ctx.adminCookie, "/api/v1/knowledge-of-week", post({ resourceType: "document", resourceId: docB, weekStart: weekA, replace: true }));
    check("replace = true swaps the pick for the week", replace.status === 201 && replace.data?.replaced === true);
    if (replace.data?.id) created.push(replace.data.id);
    const rowsForWeek = await ctx.db.execute({ sql: "select resource_id, contributor_user_id, unit_id from knowledge_of_week where week_start = ?", args: [weekA] });
    check("the week holds exactly the replacement, with contributor and unit resolved", rowsForWeek.rows.length === 1 && String(rowsForWeek.rows[0].resource_id) === docB && Boolean(rowsForWeek.rows[0].contributor_user_id) && Boolean(rowsForWeek.rows[0].unit_id));
    const schedule = await getJson<Card[]>(ctx, ctx.adminCookie, "/api/v1/knowledge-of-week?view=schedule");
    check("the schedule lists the future pick for the administrator", schedule.status === 200 && Boolean(schedule.data?.some((c) => c.weekStart === weekA)));
    const noPay = await ctx.db.execute({ sql: "select count(*) as n from game_events where event_type = 'kow_contributor' and resource_id in (select id from knowledge_of_week where week_start = ?)", args: [weekA] });
    check("a scheduled pick pays nothing until it activates", Number(noPay.rows[0].n) === 0);
  } finally {
    for (const id of created) {
      await ctx.db.execute({ sql: "delete from knowledge_of_week_reads where kow_id = ?", args: [id] });
      await ctx.db.execute({ sql: "delete from knowledge_of_week_seen where kow_id = ?", args: [id] });
      await ctx.db.execute({ sql: "delete from knowledge_of_week where id = ?", args: [id] });
    }
    await ctx.db.execute({ sql: "delete from knowledge_of_week where week_start = ?", args: [weekA] });
  }

  /* ---- seen and read, once ---- */
  const contributorRow = await ctx.db.execute("select id from users where email = 'analyst@enviroai.demo'");
  const contributorId = String(contributorRow.rows[0]?.id ?? "");
  const wasRead = await ctx.db.execute({ sql: "select id from knowledge_of_week_reads where kow_id = ? and user_id = ?", args: [activeId, contributorId] });
  const pointsBefore = await ctx.db.execute({ sql: "select count(*) as n from game_events where user_id = ? and event_type = 'kow_read' and resource_id = ?", args: [contributorId, activeId] });
  if (!wasRead.rows.length) {
    const seen = await getJson<{ ok: boolean }>(ctx, ctx.cookie, "/api/v1/knowledge-of-week", patch({ action: "seen", kowId: activeId }));
    check("PATCH seen records the reveal", seen.status === 200 && seen.data?.ok === true);
    const afterSeen = await getJson<Card>(ctx, ctx.cookie, "/api/v1/knowledge-of-week?view=active");
    check("the card now says the viewer has seen it", afterSeen.data?.viewerSeen === true);
    const read1 = await getJson<{ first: boolean; readCount: number; points: number }>(ctx, ctx.cookie, "/api/v1/knowledge-of-week", patch({ action: "read", kowId: activeId }));
    check("PATCH read counts the first read and pays ten points", read1.status === 200 && read1.data?.first === true && read1.data.points === 10, JSON.stringify(read1.data));
    const read2 = await getJson<{ first: boolean; points: number }>(ctx, ctx.cookie, "/api/v1/knowledge-of-week", patch({ action: "read", kowId: activeId }));
    check("a second read is not counted and pays nothing", read2.status === 200 && read2.data?.first === false && read2.data.points === 0);
    const events = await ctx.db.execute({ sql: "select count(*) as n from game_events where user_id = ? and event_type = 'kow_read' and resource_id = ?", args: [contributorId, activeId] });
    check("exactly one kow_read event for the reader", Number(events.rows[0].n) === Number(pointsBefore.rows[0].n) + 1);
  } else {
    const read2 = await getJson<{ first: boolean; points: number }>(ctx, ctx.cookie, "/api/v1/knowledge-of-week", patch({ action: "read", kowId: activeId }));
    check("a repeated read is not counted and pays nothing", read2.status === 200 && read2.data?.first === false && read2.data.points === 0);
  }

  /* ---- the invariants, whichever branch ran ---- */
  const readOnce = await ctx.db.execute({
    sql: "select (select count(*) from knowledge_of_week_reads where kow_id = ? and user_id = ?) as reads, (select count(*) from game_events where user_id = ? and event_type = 'kow_read' and resource_id = ?) as events",
    args: [activeId, contributorId, contributorId, activeId],
  });
  check(
    "the reader's read and its ten points are recorded exactly once",
    Number(readOnce.rows[0].reads) === 1 && Number(readOnce.rows[0].events) === 1,
    `reads=${readOnce.rows[0].reads} events=${readOnce.rows[0].events}`
  );
  const seenOnce = await ctx.db.execute({
    sql: "select count(*) as n from knowledge_of_week_seen where kow_id = ? and user_id = ?",
    args: [activeId, contributorId],
  });
  check("reading the pick records the reveal as seen, once", Number(seenOnce.rows[0].n) === 1, String(seenOnce.rows[0].n));
  const count = await ctx.db.execute({ sql: "select read_count, (select count(*) from knowledge_of_week_reads where kow_id = ?) as reads from knowledge_of_week where id = ?", args: [activeId, activeId] });
  check("read_count equals the reads rows", Number(count.rows[0].read_count) === Number(count.rows[0].reads));
  const card = await getJson<Card>(ctx, ctx.cookie, "/api/v1/knowledge-of-week?view=active");
  check("the card tells the reader they have read and seen it", card.data?.viewerRead === true && card.data.viewerSeen === true);

  /* ---- awards paid once per pick ---- */
  const paid = await ctx.db.execute(
    "select k.id, (select count(*) from game_events e where e.event_type = 'kow_contributor' and e.resource_id = k.id) as n from knowledge_of_week k where k.status in ('active','archived') and k.contributor_user_id is not null"
  );
  check("every active or archived pick paid its contributor exactly once", paid.rows.length > 0 && paid.rows.every((r) => Number(r.n) === 1), paid.rows.map((r) => r.n).join(","));
  const unitPaid = await ctx.db.execute("select count(*) as n from game_events where event_type = 'kow_unit' and resource_type = 'org_unit'");
  check("the unit award is attributed to org_unit rows", Number(unitPaid.rows[0].n) >= paid.rows.length);
  const badges = await ctx.db.execute(
    "select count(distinct k.contributor_user_id) as contributors, (select count(*) from user_badges ub join badges b on b.id = ub.badge_id where b.code = 'knowledge_of_week') as awarded from knowledge_of_week k where k.status in ('active','archived') and k.contributor_user_id is not null"
  );
  check("every contributor holds the permanent badge", Number(badges.rows[0].awarded) >= Number(badges.rows[0].contributors));

  /* ---- rollover: archive and activate ---- */
  try {
    const { rolloverKnowledgeOfWeek, weekStartOf } = await import("../src/server/services/knowledge-of-week");
    const before = await ctx.db.execute("select id, status from knowledge_of_week where status = 'active'");
    const roll = await rolloverKnowledgeOfWeek();
    const after = await ctx.db.execute("select id from knowledge_of_week where status = 'active'");
    check("rollover keeps this week's active pick and changes nothing mid-week", roll.archived === 0 && roll.activated === null && after.rows.length === 1 && String(after.rows[0].id) === String(before.rows[0].id));
    const activeWeek = await ctx.db.execute("select week_start from knowledge_of_week where status = 'active'");
    check("the active pick belongs to the current ISO week", String(activeWeek.rows[0].week_start) === weekStartOf());
  } catch (e) {
    check("rolloverKnowledgeOfWeek runs", false, (e as Error).message);
  }

  /* ---- the hall ---- */
  const hall = await getJson<Hall>(ctx, ctx.cookie, "/api/v1/knowledge-of-week?view=hall");
  check("GET ?view=hall lists the current pick and the archive by month", hall.status === 200 && Boolean(hall.data?.current) && (hall.data?.months.length ?? 0) >= 1 && (hall.data?.total ?? 0) >= 5);
  check("the hall hides the schedule from non-administrators", hall.data?.canManage === false && hall.data.scheduled.length === 0);
  const hallHtml = await (await fetch(ctx.base + "/en/hall-of-knowledge", { headers: { cookie: ctx.cookie } })).text();
  check("the Hall of Knowledge page renders", hallHtml.includes('data-testid="hall-page"') && hallHtml.includes("Hall of Knowledge"));

  /* ---- Ask EnviroAI ---- */
  try {
    const { runTool, AnalystState } = await import("../src/server/ai/analyst/tools");
    const { getUserById } = await import("../src/server/auth/session");
    const user = await getUserById(contributorId);
    if (user) {
      const state = new AnalystState();
      const text = await runTool({ user, state } as never, "get_knowledge_of_week", {});
      check("get_knowledge_of_week answers with this week's pick and past picks", /THIS WEEK/.test(text) && /PAST/.test(text), text.slice(0, 120));
      check("the tool registers the picks as sources", state.sources.length >= 2);
    } else {
      check("get_knowledge_of_week tool user loaded", false, "analyst user missing");
    }
  } catch (e) {
    check("get_knowledge_of_week runs", false, (e as Error).message);
  }
}
