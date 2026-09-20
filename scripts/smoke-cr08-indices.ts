/* eslint-disable no-console */
// CR08 4.2/4.3 smoke: index groups. The groups API (list, create, rename,
// reorder, archive, a non-admin refused), membership PUT with order, the
// grouped board and the index page chips, the Add index wizard through
// preview to commit with three pasted rows (then deactivated), and the three
// Ask NPC tools answering. Wired into scripts/smoke.ts by the coordinator.
type Check = (name: string, ok: boolean, detail?: string) => void;
type Ctx = {
  base: string;
  cookie: string;
  adminCookie: string;
  db: import("@libsql/client").Client;
};

const GROUP_CODES = ["sdg", "national", "competitiveness", "gallup", "governance", "human", "environment", "peace", "digital"];

export async function run(check: Check, ctx: Ctx): Promise<void> {
  const { base, cookie, adminCookie, db } = ctx;
  const stamp = Date.now().toString(36).slice(-6);
  const get = (p: string, c?: string) => fetch(base + p, { headers: c ? { cookie: c } : {}, redirect: "manual" });
  const send = (p: string, method: string, body: unknown, c?: string) =>
    fetch(base + p, {
      method,
      headers: { "content-type": "application/json", ...(c ? { cookie: c } : {}) },
      body: JSON.stringify(body),
      redirect: "manual",
    });
  const json = async (res: Response) => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };

  /* 1. the groups API */
  const list = await get("/api/v1/indices/groups", adminCookie);
  const listJson = await json(list);
  const groups = (listJson?.data ?? []) as { id: string; code: string; isActive: boolean; memberIds: string[]; memberCount: number }[];
  check("indices groups: GET lists the nine fixed groups", list.status === 200 && GROUP_CODES.every((c) => groups.some((g) => g.code === c)), `codes=${groups.map((g) => g.code).join(",")}`);
  const contributorList = await get("/api/v1/indices/groups", cookie);
  check("indices groups: a contributor can read the groups", contributorList.status === 200);
  check("indices groups: refused without a session", (await get("/api/v1/indices/groups")).status === 401);
  const competitiveness = groups.find((g) => g.code === "competitiveness");
  check("indices groups: competitiveness carries members", (competitiveness?.memberCount ?? 0) >= 5, String(competitiveness?.memberCount));

  const refused = await send("/api/v1/indices/groups", "POST", { action: "create", nameEn: "Nope", nameAr: "لا" }, cookie);
  check("indices groups: a non-admin cannot create a group", refused.status === 403, String(refused.status));

  const created = await send(
    "/api/v1/indices/groups",
    "POST",
    { action: "create", code: `smoke_${stamp}`, nameEn: `Smoke group ${stamp}`, nameAr: `مجموعة اختبار ${stamp}`, colourToken: "info", descriptionEn: "Smoke" },
    adminCookie
  );
  const createdJson = await json(created);
  const groupId = createdJson?.data?.id as string | undefined;
  check("indices groups: admin creates a group", created.status === 200 && Boolean(groupId));
  if (groupId) {
    const renamed = await send("/api/v1/indices/groups", "POST", { action: "update", id: groupId, nameEn: `Smoke group ${stamp} renamed`, colourToken: "ok" }, adminCookie);
    const row = await db.execute({ sql: "select name_en, colour_token, sort from index_groups where id = ?", args: [groupId] });
    check("indices groups: rename and colour persist", renamed.status === 200 && String(row.rows[0]?.name_en).endsWith("renamed") && row.rows[0]?.colour_token === "ok");
    const reordered = await send("/api/v1/indices/groups", "POST", { action: "reorder", ids: [groupId, ...groups.map((g) => g.id)] }, adminCookie);
    const sortRow = await db.execute({ sql: "select sort from index_groups where id = ?", args: [groupId] });
    check("indices groups: reorder puts the group first", reordered.status === 200 && Number(sortRow.rows[0]?.sort) === 1);
    // restore the seeded order (the fixed nine in their seed order)
    await send("/api/v1/indices/groups", "POST", { action: "reorder", ids: GROUP_CODES.map((c) => groups.find((g) => g.code === c)?.id).filter(Boolean) }, adminCookie);
    const archived = await send("/api/v1/indices/groups", "POST", { action: "archive", id: groupId, isActive: false }, adminCookie);
    const activeRow = await db.execute({ sql: "select is_active from index_groups where id = ?", args: [groupId] });
    check("indices groups: archive persists", archived.status === 200 && Number(activeRow.rows[0]?.is_active) === 0);
    const audit = await db.execute({ sql: "select count(*) c from audit_log where resource_type = 'index_group' and resource_id = ?", args: [groupId] });
    check("indices groups: mutations are audited", Number(audit.rows[0]?.c) >= 3, String(audit.rows[0]?.c));
  }

  /* 2. membership PUT */
  if (competitiveness && competitiveness.memberIds.length >= 2) {
    const original = competitiveness.memberIds;
    const reversed = [...original].reverse();
    const refusedPut = await send("/api/v1/indices/groups/members", "PUT", { groupId: competitiveness.id, indexIds: reversed }, cookie);
    check("indices members: a non-admin cannot change membership", refusedPut.status === 403, String(refusedPut.status));
    const put = await send("/api/v1/indices/groups/members", "PUT", { groups: [{ groupId: competitiveness.id, indexIds: reversed }] }, adminCookie);
    const rows = await db.execute({ sql: "select index_id from index_group_members where group_id = ? order by sort", args: [competitiveness.id] });
    const stored = rows.rows.map((r) => String(r.index_id));
    check("indices members: PUT replaces the ordered membership", put.status === 200 && stored.join(",") === reversed.join(","));
    await send("/api/v1/indices/groups/members", "PUT", { groupId: competitiveness.id, indexIds: original }, adminCookie);
    const unknown = await send("/api/v1/indices/groups/members", "PUT", { groupId: competitiveness.id, indexIds: ["no-such-index"] }, adminCookie);
    check("indices members: unknown index ids are rejected", unknown.status === 400);
  } else {
    check("indices members: PUT replaces the ordered membership", false, "competitiveness has fewer than two members");
  }

  /* 3. the board and the index page */
  const board = await get("/en/indices", adminCookie);
  const boardHtml = await board.text();
  check("indices board: renders the group switcher and sections", board.status === 200 && boardHtml.includes('data-testid="group-switcher"') && boardHtml.includes('data-testid="group-section"'));
  check("indices board: every group has a summary strip", (boardHtml.match(/data-testid="group-summary"/g) ?? []).length >= 9);
  const oneGroup = await get("/en/indices?group=governance", adminCookie);
  const oneHtml = await oneGroup.text();
  check("indices board: ?group= renders one section", oneGroup.status === 200 && (oneHtml.match(/data-testid="group-section"/g) ?? []).length === 1);
  const arBoard = await get("/ar/indices?group=competitiveness", cookie);
  check("indices board: Arabic renders for a contributor", arBoard.status === 200 && (await arBoard.text()).includes('data-group-code="competitiveness"'));
  const egdi = await get("/en/indices/egdi", cookie);
  const egdiHtml = await egdi.text();
  check("index page: EGDI carries its two group chips", egdi.status === 200 && (egdiHtml.match(/data-testid="index-group-chip"/g) ?? []).length === 2);

  /* 4. the Add index wizard API */
  const options = await get("/api/v1/indices/create", adminCookie);
  const optionsJson = await json(options);
  check("add index: options list groups, entities and targets", options.status === 200 && (optionsJson?.data?.groups?.length ?? 0) >= 9 && (optionsJson?.data?.targets?.length ?? 0) > 0);
  check("add index: options refused for a non-admin", (await get("/api/v1/indices/create", cookie)).status === 403);
  const code = `sm${stamp}`;
  const governance = groups.find((g) => g.code === "governance");
  const basics = { code, nameEn: `Smoke Index ${stamp}`, nameAr: `مؤشر اختبار ${stamp}`, publisher: "Smoke", scale: "both", higherIsBetter: true, frequency: "annual", category: "governance" };
  const preview = await send(
    "/api/v1/indices/create",
    "POST",
    { step: "preview", basics, data: { mode: "paste", csv: "country,year,rank,score\nQAT,2022,30,60.5\nQAT,2023,28,62.1\nQAT,2024,25,64.0\nNOPE,2024,1,99\n" }, forecasting: { enabled: true, mode: "auto" }, groupIds: governance ? [governance.id] : [] },
    adminCookie
  );
  const previewJson = await json(preview);
  check("add index: preview parses three rows and warns about the unknown country", preview.status === 200 && previewJson?.data?.rows?.length === 3 && previewJson?.data?.warnings?.some((w: { code: string }) => w.code === "unknown_country"), JSON.stringify(previewJson?.data?.summary ?? previewJson));
  const notWritten = await db.execute({ sql: "select count(*) c from indices where code = ?", args: [code] });
  check("add index: preview writes nothing", Number(notWritten.rows[0]?.c) === 0);
  const refusedCreate = await send("/api/v1/indices/create", "POST", { step: "commit", basics, data: { mode: "manual", rows: previewJson?.data?.rows ?? [] } }, cookie);
  check("add index: commit refused for a non-admin", refusedCreate.status === 403);
  const commit = await send(
    "/api/v1/indices/create",
    "POST",
    { step: "commit", basics, data: { mode: "manual", origin: "paste", rows: previewJson?.data?.rows ?? [], sourceUrl: "https://example.org/smoke.csv" }, forecasting: { enabled: true, mode: "auto", targetValue: 15, targetYear: 2030 }, groupIds: governance ? [governance.id] : [] },
    adminCookie
  );
  const commitJson = await json(commit);
  const newId = commitJson?.data?.id as string | undefined;
  check("add index: commit creates the index with three observations", commit.status === 200 && commitJson?.data?.observations === 3 && Boolean(newId), JSON.stringify(commitJson));
  if (newId) {
    const obs = await db.execute({ sql: "select count(*) c, min(status) s, min(source_url) u from index_observations where index_id = ?", args: [newId] });
    check("add index: observations carry the manual status and the source URL", Number(obs.rows[0]?.c) === 3 && obs.rows[0]?.s === "manual" && String(obs.rows[0]?.u).includes("example.org"));
    const member = await db.execute({ sql: "select count(*) c from index_group_members where index_id = ?", args: [newId] });
    check("add index: membership row written", Number(member.rows[0]?.c) === 1);
    const fc = await db.execute({ sql: "select count(*) c from index_forecasts where index_id = ? and status = 'current'", args: [newId] });
    check("add index: the first forecast was computed", Number(fc.rows[0]?.c) === 3, String(fc.rows[0]?.c));
    const dupe = await send("/api/v1/indices/create", "POST", { step: "preview", basics, data: { mode: "manual", rows: [] } }, adminCookie);
    check("add index: a duplicate code is refused", dupe.status === 409);
    const page = await get(`/en/indices/${code}`, adminCookie);
    const pageHtml = await page.text();
    check("add index: the new index page renders with its target line", page.status === 200 && pageHtml.includes('data-testid="target-line"'));
    // retire the smoke index so the board stays clean
    await send("/api/v1/indices", "PATCH", { id: newId, isActive: false }, adminCookie);
  }

  /* 5. the Ask NPC tools, called directly (the mock planner never picks them) */
  try {
    const mod = (await import("../src/server/ai/analyst/cr08/indices")).default;
    const sources: { resource_type: string; resource_id: string }[] = [];
    const state = {
      sources,
      workspace: { strategy: [], numbers: [], documents: [], lessons: [], signals: [], people: [] },
      toolCalls: 0,
      addSource(s: { resource_type: string; resource_id: string }) {
        const hit = sources.findIndex((x) => x.resource_type === s.resource_type && x.resource_id === s.resource_id);
        if (hit !== -1) return hit + 1;
        sources.push(s);
        return sources.length;
      },
    };
    const toolCtx = { user: { id: "smoke", role: "Super Admin" }, state } as unknown as Parameters<typeof mod.run>[0];
    check("indices tools: three definitions registered", mod.definitions.map((d) => d.name).join(",") === "get_index_groups,query_index_group,get_sdg_scores" && Object.values(mod.portal).every((p) => p === "indices"));
    const groupsOut = (await mod.run(toolCtx, "get_index_groups", {})) ?? "";
    check("indices tools: get_index_groups names every group with counts", GROUP_CODES.every((c) => groupsOut.includes(`${c}:`)) && /improving/.test(groupsOut), groupsOut.slice(0, 120));
    check("indices tools: groups register index_group sources", sources.some((s) => s.resource_type === "index_group"));
    const membersOut = (await mod.run(toolCtx, "query_index_group", { group: "competitiveness" })) ?? "";
    check("indices tools: query_index_group lists members with Qatar's values", /imd/.test(membersOut) && /Qatar \d{4}/.test(membersOut) && sources.some((s) => s.resource_type === "index" && s.resource_id === "imd"), membersOut.slice(0, 160));
    const byName = (await mod.run(toolCtx, "query_index_group", { group: "الحوكمة" })) ?? "";
    check("indices tools: a group resolves by its Arabic name", /governance/.test(byName), byName.slice(0, 80));
    const sdgOut = (await mod.run(toolCtx, "get_sdg_scores", {})) ?? "";
    check("indices tools: get_sdg_scores answers (goals or the honest empty line)", /SDG Index|Goal \d+|No SDG scores/.test(sdgOut), sdgOut.slice(0, 80));
    check("indices tools: an unknown name is not this module's tool", (await mod.run(toolCtx, "not_a_tool", {})) === null);
  } catch (e) {
    check("indices tools: module loads from the script", false, String((e as Error)?.message ?? e).slice(0, 160));
  }
}
