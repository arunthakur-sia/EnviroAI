// CR08 1: smoke checks for the Organisation rebuild. Wired into scripts/smoke.ts
// by the coordinator: run(check, { base, cookie, adminCookie, db }).
// Levels from org_levels, snapshots, change requests, the editor API and its
// refusals, the chart's selectors, the unit panel's tab strip, and the two new
// analyst tools. Every mutation made here is undone through the API's own
// inverse so the database is left as it was found.
import fs from "node:fs";
import path from "node:path";

type Check = (name: string, ok: boolean, detail?: string) => void;
type Ctx = { base: string; cookie: string; adminCookie: string; db: import("@libsql/client").Client };

/** The shared dev server resets a connection now and then under load; a
    read is retried, a write is not. */
async function fetchRetry(url: string, init: RequestInit): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  let last: unknown = null;
  for (let attempt = 0; attempt < (method === "GET" ? 3 : 1); attempt++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw last;
}

export async function run(check: Check, ctx: Ctx): Promise<void> {
  const { base, cookie, adminCookie, db } = ctx;
  const admin = (p: string, init: RequestInit = {}) =>
    fetchRetry(`${base}${p}`, { ...init, headers: { cookie: adminCookie, ...(init.headers ?? {}) }, redirect: "manual" });
  const user = (p: string, init: RequestInit = {}) =>
    fetchRetry(`${base}${p}`, { ...init, headers: { cookie, ...(init.headers ?? {}) }, redirect: "manual" });
  const post = (who: typeof admin, body: Record<string, unknown>) =>
    who("/api/v1/organisation/editor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  /* 1. the levels are the editable source of truth */
  const levelRows = (await db.execute("select code, name_en, name_ar, sort from org_levels order by sort")).rows;
  check(
    "org_levels holds the five published levels in order",
    levelRows.map((r) => String(r.code)).join(",") === "secretary_general,sector,office,department,section",
    levelRows.map((r) => r.code).join(",")
  );
  check(
    "every level carries a bilingual name",
    levelRows.every((r) => String(r.name_en).length > 1 && /[؀-ۿ]/.test(String(r.name_ar)))
  );
  const strayLevels = (
    await db.execute("select count(*) c from org_units where level not in (select code from org_levels)")
  ).rows[0];
  check("no unit uses a level the table does not know", Number(strayLevels.c) === 0);
  const levelsApi = await user("/api/v1/organisation/editor?view=levels");
  const levelsJson = await levelsApi.json();
  check(
    "any signed-in user can read the levels in order",
    levelsApi.status === 200 && Array.isArray(levelsJson.data) && levelsJson.data[0]?.code === "secretary_general"
  );

  /* 2. snapshots and change requests are seeded */
  const snapshots = (await db.execute("select count(*) c from org_snapshots")).rows[0];
  check("at least one structure snapshot exists", Number(snapshots.c) >= 1, `${snapshots.c} snapshots`);
  const [firstSnapshot] = (
    await db.execute("select length(tree_json) len, note from org_snapshots order by taken_at asc limit 1")
  ).rows;
  check(
    "the initial snapshot carries the whole tree",
    Boolean(firstSnapshot) && Number(firstSnapshot.len) > 20000,
    firstSnapshot ? `${firstSnapshot.len} bytes, ${firstSnapshot.note}` : "none"
  );
  const requests = (
    await db.execute("select status, count(*) c from org_change_requests group by status")
  ).rows;
  const byStatus = Object.fromEntries(requests.map((r) => [String(r.status), Number(r.c)]));
  check(
    "the seeded change requests cover an open and a resolved one",
    (byStatus.open ?? 0) >= 1 && (byStatus.resolved ?? 0) >= 1,
    JSON.stringify(byStatus)
  );
  const [requester] = (
    await db.execute(
      "select u.email from org_change_requests r join users u on u.id = r.requested_by where r.status = 'resolved' limit 1"
    )
  ).rows;
  check("the sample requests come from the seeded department head", String(requester?.email) === "head.stats@npc.qa");

  /* 3. the editor API: Super Admin only for mutations */
  const refused = await post(user, { action: "snapshots.take", note: "smoke" });
  check("a Contributor is refused by the editor API", refused.status === 403, `status ${refused.status}`);
  const refusedRead = await user("/api/v1/organisation/editor?view=snapshots");
  check("a Contributor cannot list the snapshots", refusedRead.status === 403, `status ${refusedRead.status}`);
  const invalid = await post(admin, { action: "unit.move" });
  check("an invalid body is rejected with 400", invalid.status === 400, `status ${invalid.status}`);

  /* 4. impact counts and a move with its undo */
  const [is] = (await db.execute("select id, parent_id from org_units where code = 'IS' limit 1")).rows;
  const [ca] = (await db.execute("select id from org_units where code = 'CA' limit 1")).rows;
  if (is && ca) {
    const impact = await admin(`/api/v1/organisation/editor?view=impact&id=${String(is.id)}`);
    const impactJson = await impact.json();
    check(
      "the impact of a unit counts the people beneath it",
      impact.status === 200 && Number(impactJson.data?.counts?.people ?? 0) >= 1,
      JSON.stringify(impactJson.data?.counts ?? {})
    );
    const move = await post(admin, { action: "unit.move", id: String(is.id), parentId: String(ca.id) });
    const moveJson = await move.json();
    const movedTo = (await db.execute({ sql: "select parent_id from org_units where id = ?", args: [String(is.id)] })).rows[0];
    check(
      "a move answers with its inverse and reparents the unit",
      move.status === 200 && moveJson.data?.inverse?.action === "unit.move" && String(movedTo?.parent_id) === String(ca.id)
    );
    if (moveJson.data?.inverse) {
      const undo = await post(admin, moveJson.data.inverse);
      const back = (await db.execute({ sql: "select parent_id from org_units where id = ?", args: [String(is.id)] })).rows[0];
      check(
        "applying the inverse puts the unit back where it was",
        undo.status === 200 && String(back?.parent_id) === String(is.parent_id)
      );
    }
    // IS sits under SS: moving SS under IS would make SS its own ancestor
    const [ssUnit] = (await db.execute("select id from org_units where code = 'SS' limit 1")).rows;
    const cycle = ssUnit
      ? await post(admin, { action: "unit.move", id: String(ssUnit.id), parentId: String(is.id) })
      : null;
    const ssParent = ssUnit
      ? (await db.execute({ sql: "select parent_id from org_units where id = ?", args: [String(ssUnit.id)] })).rows[0]
      : null;
    check(
      "a move that would create a cycle is refused and changes nothing",
      Boolean(cycle) && cycle!.status === 400 && String(ssParent?.parent_id) !== String(is.id),
      `status ${cycle?.status}`
    );
  } else {
    check("the IS and CA units exist for the move check", false);
  }

  /* 5. delete with reassignment and its undo, on a throwaway unit */
  const [ss] = (await db.execute("select id from org_units where code = 'SS' limit 1")).rows;
  if (ss) {
    const add = await post(admin, {
      action: "unit.add",
      code: "SMK",
      nameEn: "Smoke Section",
      nameAr: "قسم الفحص",
      level: "section",
      parentId: String(ss.id),
    });
    const addJson = await add.json();
    check("a child unit can be added at the section level", add.status === 200 && Boolean(addJson.data?.id));
    if (addJson.data?.id) {
      const retire = await post(admin, { action: "unit.retire", id: String(addJson.data.id), mode: "delete", reassignTo: null });
      const retireJson = await retire.json();
      const gone = (await db.execute("select count(*) c from org_units where code = 'SMK'")).rows[0];
      check(
        "deleting an empty unit needs no reassignment and answers with a restore payload",
        retire.status === 200 && retireJson.data?.inverse?.action === "unit.restore" && Number(gone.c) === 0
      );
      if (retireJson.data?.inverse) {
        const restore = await post(admin, retireJson.data.inverse);
        const back = (await db.execute("select count(*) c from org_units where code = 'SMK'")).rows[0];
        check("the restore payload brings the deleted unit back", restore.status === 200 && Number(back.c) === 1);
        // leave the database as found
        await post(admin, { action: "unit.retire", id: String(addJson.data.id), mode: "delete", reassignTo: null });
      }
    }
    const [ssd] = (await db.execute("select id from org_units where code = 'SSD' limit 1")).rows;
    if (ssd) {
      const needs = await post(admin, { action: "unit.retire", id: String(ssd.id), mode: "deactivate", reassignTo: null });
      check("a unit with people beneath cannot be retired without a reassignment", needs.status === 400, `status ${needs.status}`);
    }
  }

  /* 6. the CSV preview validates */
  const csv = await post(admin, {
    action: "csv.preview",
    text: "code,parent_code,level,name_en,name_ar\nSMK2,SS,department,Smoke Dept,إدارة الفحص\nBAD,NOPE,department,Broken,مكسور",
  });
  const csvJson = await csv.json();
  check(
    "the CSV preview classifies a new row and an unknown parent",
    csv.status === 200 && csvJson.data?.counts?.new === 1 && csvJson.data?.counts?.error === 1,
    JSON.stringify(csvJson.data?.counts ?? {})
  );

  /* 7. a level in use cannot be removed */
  const [deptLevel] = (await db.execute("select id from org_levels where code = 'department' limit 1")).rows;
  if (deptLevel) {
    const del = await post(admin, { action: "levels.delete", id: String(deptLevel.id) });
    check("a level that units use cannot be removed", del.status === 409, `status ${del.status}`);
  }

  /* 8. the chart and the panel */
  const orgHtml = await (await admin("/en/organisation")).text();
  check(
    "the organisation page renders the chart frame with search and the view toggle",
    orgHtml.includes('data-testid="org-chart"') &&
      orgHtml.includes('data-testid="org-search"') &&
      orgHtml.includes('data-testid="org-view-chart"') &&
      orgHtml.includes('data-testid="org-resize-handle"')
  );
  const chartSrc = fs.readFileSync(
    path.join(process.cwd(), "src", "app", "[locale]", "(app)", "organisation", "OrgChart.tsx"),
    "utf8"
  );
  check(
    "the chart is a d3-hierarchy tree under one d3-zoom transform with a mini-map and a list view",
    chartSrc.includes('from "d3-hierarchy"') &&
      chartSrc.includes('from "d3-zoom"') &&
      chartSrc.includes('data-testid="org-minimap"') &&
      chartSrc.includes('data-testid="org-list-view"') &&
      chartSrc.includes("scaleExtent([MIN_Z, MAX_Z])")
  );
  const unitHtml = await (await admin("/en/organisation?unit=SSD")).text();
  check(
    "the unit panel carries its tab strip and the policy tabs",
    unitHtml.includes('data-testid="org-panel-tabs"') && unitHtml.includes('data-testid="policy-tabs"')
  );
  /* the change request is the unit head's: a Contributor who is not the head
     is refused, and nothing is written */
  const [ssdUnit] = (await db.execute("select id from org_units where code = 'SSD' limit 1")).rows;
  if (ssdUnit) {
    const before = (await db.execute("select count(*) c from org_change_requests")).rows[0];
    const asked = await post(user, { action: "requests.create", unitId: String(ssdUnit.id), what: "smoke: not the head" });
    const after = (await db.execute("select count(*) c from org_change_requests")).rows[0];
    check(
      "a change request from someone who is not the unit's head is refused",
      asked.status === 403 && Number(before.c) === Number(after.c),
      `status ${asked.status}`
    );
  }
  const arHtml = await (await admin("/ar/organisation")).text();
  check("the Arabic page names the levels from the table", arHtml.includes("الأمين العام"));

  /* 9. the analyst tools */
  const { runTool, AnalystState } = await import("../src/server/ai/analyst/tools");
  const { getUserById } = await import("../src/server/auth/session");
  const [adminRow] = (await db.execute("select id from users where email = 'admin@npc.qa' limit 1")).rows;
  const [readerRow] = (await db.execute("select id from users where email = 'reader@npc.qa' limit 1")).rows;
  const askAdmin = adminRow ? await getUserById(String(adminRow.id)) : null;
  const askReader = readerRow ? await getUserById(String(readerRow.id)) : null;
  if (askAdmin) {
    const levelsAnswer = await runTool({ user: askAdmin, state: new AnalystState() } as never, "get_org_levels", {});
    check("get_org_levels lists the levels from the top", /1\. Secretary General/.test(levelsAnswer) && /Section/.test(levelsAnswer));
    const openAnswer = await runTool({ user: askAdmin, state: new AnalystState() } as never, "get_org_change_requests", { status: "open" });
    check("get_org_change_requests answers the Super Admin with the open requests", /OPEN \|/.test(openAnswer));
  } else {
    check("the admin account exists for the tool checks", false);
  }
  if (askReader) {
    const readerAnswer = await runTool({ user: askReader, state: new AnalystState() } as never, "get_org_change_requests", {});
    check("get_org_change_requests refuses a reader", /Only a Super Admin/.test(readerAnswer), readerAnswer.slice(0, 80));
  }
}
