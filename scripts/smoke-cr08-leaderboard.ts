/* eslint-disable no-console */
// CR08 7: smoke checks for the numeric levels and the materialised
// leaderboard. Wired into scripts/smoke.ts by the coordinator.
//   ctx.cookie is a Contributor session (analyst@npc.qa), ctx.adminCookie the
//   Super Admin, ctx.db a raw libsql client.
import type { Client } from "@libsql/client";

type Check = (name: string, ok: boolean, detail?: string) => void;
type Ctx = { base: string; cookie: string; adminCookie: string; db: Client };

type PersonRow = { subjectId: string; rank: number; points: number; isMe: boolean; levelOrder: number | null };
type UnitRow = { subjectId: string; rank: number; points: number; members: number; pointsPerMember: number; activeShare: number };
type View = {
  board: string;
  window: string;
  category: string;
  periodKey: string;
  refreshedAt: string | null;
  hidden: boolean;
  notBuilt: boolean;
  scope: string;
  total: number;
  people: PersonRow[];
  units: UnitRow[];
  mine: PersonRow | null;
  excludedViewer: boolean;
  canRefresh: boolean;
};

/** The dev server and the ten-minute job write the same SQLite file, so a
    raw write from the smoke can meet SQLITE_BUSY; retry briefly. */
async function execRetry(db: Client, stmt: string | { sql: string; args: (string | number)[] }) {
  let last: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await db.execute(stmt as never);
    } catch (e) {
      last = e;
      if (!/SQLITE_BUSY|locked/i.test(String(e))) throw e;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw last;
}

async function getJson<T>(ctx: Ctx, cookie: string, path: string, init: RequestInit = {}) {
  const res = await fetch(ctx.base + path, {
    ...init,
    headers: { ...((init.headers as Record<string, string>) ?? {}), cookie },
  });
  const json = (await res.json().catch(() => ({ data: null }))) as { data: T | null; error?: string | null };
  return { status: res.status, data: json.data, error: json.error };
}

export async function run(check: Check, ctx: Ctx): Promise<void> {
  /* ---- 7.1 the levels ---- */
  const levels = await ctx.db.execute("select order_no, name_en, name_ar, min_points, descriptor_en, descriptor_ar from levels order by order_no");
  check("ten numeric levels", levels.rows.length === 10, `${levels.rows.length}`);
  check(
    "level thresholds are the CR08 ones",
    JSON.stringify(levels.rows.map((r) => Number(r.min_points))) ===
      JSON.stringify([0, 100, 300, 700, 1300, 2200, 3500, 5500, 8500, 13000])
  );
  check(
    "level names are Level N / المستوى N with descriptors",
    levels.rows.every(
      (r, i) => r.name_en === `Level ${i + 1}` && r.name_ar === `المستوى ${i + 1}` && Boolean(r.descriptor_en) && Boolean(r.descriptor_ar)
    )
  );
  const oldNames = await ctx.db.execute(
    "select count(*) as n from levels where name_en in ('Explorer','Contributor','Curator','Knowledge Keeper','NPC Sage') or name_ar in ('مستكشف','مساهم','أمين معرفة','حافظ المعرفة','حكيم المجلس')"
  );
  check("no old level names remain in the levels table", Number(oldNames.rows[0].n) === 0);
  const mismatched = await ctx.db.execute(
    "select count(*) as n from user_game_state s join levels l on l.id = s.level_id where s.total_points < l.min_points or exists (select 1 from levels h where h.min_points <= s.total_points and h.order_no > l.order_no)"
  );
  check("every game state sits on the level its points earn", Number(mismatched.rows[0].n) === 0, `${mismatched.rows[0].n} off`);

  /* ---- 7.2 rules and settings ---- */
  const newRules = await ctx.db.execute(
    "select event_type, points from game_rules where event_type in ('learning_path_completed','kow_contributor','kow_unit','kow_read')"
  );
  check("the CR08 rules exist (learning path, KOW contributor, unit, read)", newRules.rows.length === 4);
  const excluded = await ctx.db.execute("select event_type from game_rules where excluded_from_boards = 1");
  const excludedTypes = excluded.rows.map((r) => String(r.event_type));
  check("admin-duty rules are excluded from the boards", excludedTypes.includes("daily_login") && excludedTypes.includes("indicator_import_completed"), excludedTypes.join(","));
  const settings = await getJson<{ excludeRoles: string[]; quietModeHidesBoard: boolean; roles: unknown[] }>(ctx, ctx.adminCookie, "/api/v1/leaderboard/settings");
  check(
    "Super Admin and Knowledge Admin excluded from the People board by default",
    settings.status === 200 && Boolean(settings.data?.excludeRoles.includes("Super Admin") && settings.data?.excludeRoles.includes("Knowledge Admin"))
  );
  const forbiddenSettings = await getJson(ctx, ctx.cookie, "/api/v1/leaderboard/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ quietModeHidesBoard: true }),
  });
  check("a contributor cannot change the leaderboard settings", forbiddenSettings.status === 403);

  /* ---- the materialised table and the job ---- */
  const counts = await ctx.db.execute(
    "select count(distinct board) as boards, count(distinct category) as categories, count(distinct period_kind) as kinds, count(*) as rows from leaderboard_periods"
  );
  const c = counts.rows[0];
  check(
    "leaderboard_periods holds every board, category and window",
    Number(c.boards) === 2 && Number(c.categories) === 4 && Number(c.kinds) === 5 && Number(c.rows) > 0,
    `${c.boards}/${c.categories}/${c.kinds}/${c.rows}`
  );
  const job = await ctx.db.execute("select count(*) as n from jobs where type = 'leaderboard_refresh' and status = 'queued'");
  check("the ten-minute leaderboard_refresh job is queued", Number(job.rows[0].n) >= 1);

  /* ---- the read side ---- */
  const contributor = await getJson<View>(ctx, ctx.cookie, "/api/v1/leaderboard?board=people&window=all&category=overall");
  check("GET /api/v1/leaderboard answers for a contributor", contributor.status === 200 && Boolean(contributor.data));
  const rows = contributor.data?.people ?? [];
  check("a contributor sees at most the top 10", rows.length > 0 && rows.length <= 10 && contributor.data?.scope === "top10", `${rows.length} rows, scope ${contributor.data?.scope}`);
  check(
    "ranks are 1..n in order with unique values",
    rows.every((r, i) => r.rank === i + 1) && rows.every((r, i) => i === 0 || rows[i - 1].points >= r.points)
  );
  check("the viewer's own row is pinned with a rank", Boolean(contributor.data?.mine && contributor.data.mine.rank >= 1 && contributor.data.mine.isMe));
  check("rows carry a numeric level", rows.every((r) => r.levelOrder === null || (r.levelOrder >= 1 && r.levelOrder <= 10)));

  const admin = await getJson<View>(ctx, ctx.adminCookie, "/api/v1/leaderboard?board=people&window=all&category=overall");
  check("an administrator sees the full list", admin.status === 200 && admin.data?.scope === "full" && (admin.data?.people.length ?? 0) > 10, `${admin.data?.people.length} rows`);
  check("the administrator's own account is excluded from the People board", Boolean(admin.data?.excludedViewer) && admin.data?.mine === null);

  const units = await getJson<View>(ctx, ctx.cookie, "/api/v1/leaderboard?board=departments&window=all&category=overall");
  const unitRows = units.data?.units ?? [];
  check(
    "the Departments board lists every unit with members, ranked by points per member",
    unitRows.length >= 3 &&
      unitRows.every((u) => u.members > 0 && u.pointsPerMember >= 0 && u.activeShare >= 0 && u.activeShare <= 1) &&
      unitRows.every((u, i) => i === 0 || unitRows[i - 1].pointsPerMember >= u.pointsPerMember),
    `${unitRows.length} units`
  );
  const bad = await getJson(ctx, ctx.cookie, "/api/v1/leaderboard?board=teams");
  check("an unknown board is rejected", bad.status === 400);

  /* ---- the board reads the materialised table, not the ledger ---- */
  const contributorRow = await ctx.db.execute("select id from users where email = 'analyst@npc.qa'");
  const contributorId = String(contributorRow.rows[0]?.id ?? "");
  const before = contributor.data?.mine?.points ?? 0;
  const probeId = `smoke-lb-${Date.now()}`;
  await execRetry(ctx.db, {
    sql: "insert into game_events (id, user_id, event_type, resource_type, resource_id, points, multiplier, created_at) values (?, ?, 'document_uploaded', 'smoke', ?, 20, 1, ?)",
    args: [probeId, contributorId, probeId, new Date().toISOString()],
  });
  try {
    const stale = await getJson<View>(ctx, ctx.cookie, "/api/v1/leaderboard?board=people&window=all&category=overall");
    check("a fresh game event does not change the board until a refresh", (stale.data?.mine?.points ?? 0) === before, `${before} -> ${stale.data?.mine?.points}`);
    const refuse = await getJson(ctx, ctx.cookie, "/api/v1/leaderboard/refresh", { method: "POST" });
    check("a contributor cannot press Refresh now", refuse.status === 403);
    const refreshed = await getJson<{ rows: number }>(ctx, ctx.adminCookie, "/api/v1/leaderboard/refresh", { method: "POST" });
    check("an administrator can refresh the boards", refreshed.status === 200 && (refreshed.data?.rows ?? 0) > 0, `${refreshed.data?.rows} rows`);
    const after = await getJson<View>(ctx, ctx.cookie, "/api/v1/leaderboard?board=people&window=all&category=overall");
    /* The board is materialised, so `before` is whatever the last refresh
       saw: the rest of this suite awards this same account real points as it
       runs, and the refresh picks those up too. The invariant that matters is
       that the refresh brings the board to the ledger, and that it is at least
       the twenty points this check itself added. */
    /* The People board drops two kinds of event and this sum has to drop the
       same two or it is not the board's ledger: a rule flagged
       `excluded_from_boards`, and the unit-only awards in `UNIT_ONLY_TYPES`,
       which are paid to a person's account because the engine pays per user but
       belong to their unit and are counted on the Departments board alone
       (DECISIONS 101). */
    const { UNIT_ONLY_TYPES } = await import("../src/server/gamification/engine");
    const unitOnly = [...UNIT_ONLY_TYPES];
    const ledger = await ctx.db.execute({
      sql: `select coalesce(sum(e.points), 0) total from game_events e
            join game_rules r on r.event_type = e.event_type
            where e.user_id = ?
              and coalesce(r.excluded_from_boards, 0) = 0
              and e.event_type not in (${unitOnly.map(() => "?").join(", ")})`,
      args: [contributorId, ...unitOnly],
    });
    const total = Number(ledger.rows[0]?.total ?? 0);
    const now = after.data?.mine?.points ?? 0;
    check("after the refresh the new event is on the board", now >= before + 20, `${before} -> ${now}`);
    check("the refreshed board equals the ledger", now === total, `board ${now}, ledger ${total}`);
  } finally {
    await execRetry(ctx.db, { sql: "delete from game_events where id = ?", args: [probeId] });
    await getJson(ctx, ctx.adminCookie, "/api/v1/leaderboard/refresh", { method: "POST" });
  }

  /* ---- quiet mode hides the board from the viewer only ---- */
  await execRetry(ctx.db, { sql: "update users set quiet_mode = 1 where id = ?", args: [contributorId] });
  try {
    const quiet = await getJson<View>(ctx, ctx.cookie, "/api/v1/leaderboard?board=people&window=all&category=overall");
    check("quiet mode hides the board from the viewer", quiet.status === 200 && quiet.data?.hidden === true && quiet.data.people.length === 0);
    const others = await getJson<View>(ctx, ctx.adminCookie, "/api/v1/leaderboard?board=people&window=all&category=overall");
    check("the quiet person still appears on the board for others", Boolean(others.data?.people.some((p) => p.subjectId === contributorId)));
  } finally {
    await execRetry(ctx.db, { sql: "update users set quiet_mode = 0 where id = ?", args: [contributorId] });
  }

  /* ---- Ask NPC ---- */
  try {
    const { runTool, AnalystState } = await import("../src/server/ai/analyst/tools");
    const { getUserById } = await import("../src/server/auth/session");
    const user = await getUserById(contributorId);
    if (user) {
      const state = new AnalystState();
      const ctxTool = { user, state } as never;
      const text = await runTool(ctxTool, "get_leaderboard", { board: "people", window: "all", category: "overall" });
      check("get_leaderboard answers with ranked lines and the viewer's position", /1\. .+: \d+ points/.test(text) && /Viewer:/.test(text), text.slice(0, 120));
      const units = await runTool(ctxTool, "get_leaderboard", { board: "departments", window: "month" });
      check("get_leaderboard answers the Departments board", /points per member/.test(units), units.slice(0, 120));
      await execRetry(ctx.db, { sql: "update users set quiet_mode = 1 where id = ?", args: [contributorId] });
      try {
        const quietUser = await getUserById(contributorId);
        const hidden = await runTool({ user: quietUser, state: new AnalystState() } as never, "get_leaderboard", {});
        check("get_leaderboard says the board is hidden in quiet mode", /hidden/i.test(hidden) && !/1\. /.test(hidden));
      } finally {
        await execRetry(ctx.db, { sql: "update users set quiet_mode = 0 where id = ?", args: [contributorId] });
      }
    } else {
      check("get_leaderboard tool user loaded", false, "analyst user missing");
    }
  } catch (e) {
    check("get_leaderboard tool runs", false, (e as Error).message);
  }
}
