// CR08 10 smoke checks: seeded counts, the process map and one process over
// the API, the RACI invariant (one A and at least one R per Level 1 process),
// permission refusals for a Contributor and acceptance for the Super Admin,
// the interface change request lifecycle, document visibility on a process's
// SOPs, and the three Ask NPC tools called directly. Wired into
// scripts/smoke.ts by the coordinator.
type Check = (name: string, ok: boolean, detail?: string) => void;
type Ctx = { base: string; cookie: string; adminCookie: string; db: import("@libsql/client").Client };

type Envelope<T = unknown> = { data: T; error: string | null; detail?: Record<string, unknown> };

async function api<T = unknown>(
  ctx: Ctx,
  cookie: string,
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<{ status: number; body: Envelope<T> }> {
  const res = await fetch(`${ctx.base}${path}`, {
    method: init.method ?? "GET",
    headers: { cookie, "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  let body: Envelope<T>;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    body = { data: null as T, error: `non-json ${res.status}` };
  }
  return { status: res.status, body };
}

async function count(ctx: Ctx, sql: string): Promise<number> {
  const r = await ctx.db.execute(sql);
  return Number(r.rows[0]?.c ?? 0);
}

export async function run(check: Check, ctx: Ctx): Promise<void> {
  /* 1. seeded counts */
  const l0 = await count(ctx, "select count(*) c from processes where level = 0");
  const l1 = await count(ctx, "select count(*) c from processes where level = 1");
  const l2 = await count(ctx, "select count(*) c from processes where level = 2");
  check(`opmodel: eight Level 0 processes (${l0}), Level 1 (${l1}), Level 2 (${l2})`, l0 === 8 && l1 >= 16 && l2 >= 6);
  check("opmodel: six principles seeded", (await count(ctx, "select count(*) c from operating_principles")) >= 6);
  check("opmodel: calendar carries a full year", (await count(ctx, "select count(*) c from calendar_events")) >= 40);
  const internal = await count(ctx, "select count(*) c from unit_interfaces");
  const external = await count(ctx, "select count(*) c from entity_interfaces");
  check(`opmodel: twenty internal and ten external interfaces (${internal}, ${external})`, internal >= 20 && external === 10);
  check("opmodel: five KPIs with monthly values", (await count(ctx, "select count(*) c from ops_kpis")) === 5 && (await count(ctx, "select count(*) c from ops_kpi_values")) >= 40);
  check("opmodel: every seeded row is illustrative", (await count(ctx, "select count(*) c from processes where is_illustrative = 0")) === 0);

  /* 2. the RACI invariant */
  const bad = await ctx.db.execute(
    "select p.code, sum(case when r.role = 'A' then 1 else 0 end) a, sum(case when r.role = 'R' then 1 else 0 end) r from processes p left join process_raci r on r.process_id = p.id where p.level = 1 group by p.id having a <> 1 or r < 1"
  );
  check("opmodel: every Level 1 process has exactly one A and at least one R", bad.rows.length === 0, bad.rows.map((r) => String(r.code)).join(","));

  /* 3. the process map over the API, as a Contributor */
  const map = await api<{ chain: { code: string; children: unknown[] }[]; byUnit: unknown[]; byPolicyType: unknown[]; totals: { level0: number } }>(ctx, ctx.cookie, "/api/v1/processes");
  check("opmodel: GET /processes answers the chain in order", map.status === 200 && map.body.data?.chain.map((c) => c.code).join(",") === "P1,P2,P3,P4,P5,P6,P7,P8");
  check("opmodel: every Level 0 process has two or three Level 1 children", Boolean(map.body.data?.chain.every((c) => c.children.length >= 2 && c.children.length <= 3)));
  const byUnit = await api<{ byUnit: { unit: { code: string }; processes: unknown[] }[] }>(ctx, ctx.cookie, "/api/v1/processes?view=unit");
  check("opmodel: ?view=unit lists the owning units", byUnit.status === 200 && (byUnit.body.data?.byUnit.length ?? 0) >= 10 && Boolean(byUnit.body.data?.byUnit.some((u) => u.unit.code === "SOA" && u.processes.length >= 2)));
  const byPolicy = await api<{ byPolicyType: { tab: string; documents: unknown[] }[] }>(ctx, ctx.cookie, "/api/v1/processes?view=policy");
  check("opmodel: ?view=policy answers the four tabs", byPolicy.status === 200 && byPolicy.body.data?.byPolicyType.map((t) => t.tab).join(",") === "policy_internal,procedure,form_template,service");

  /* 4. one process */
  const p41 = await api<{ code: string; ownerUnit: { code: string } | null; steps: unknown[]; raci: { role: string }[]; parent: { code: string } | null; kpis: unknown[] }>(ctx, ctx.cookie, "/api/v1/processes/P4.1");
  check(
    "opmodel: GET /processes/P4.1 carries owner SOA, steps, KPIs, RACI and its parent",
    p41.status === 200 && p41.body.data?.ownerUnit?.code === "SOA" && (p41.body.data?.steps.length ?? 0) >= 4 && (p41.body.data?.kpis.length ?? 0) >= 1 && Boolean(p41.body.data?.raci.some((r) => r.role === "A")) && p41.body.data?.parent?.code === "P4"
  );
  const missing = await api(ctx, ctx.cookie, "/api/v1/processes/P99.9");
  check("opmodel: an unknown code is a 404", missing.status === 404 && missing.body.error === "not_found");

  /* 5. document visibility on a procedure's SOPs: IFS's unit-only procedure hides from the Contributor */
  const asContributor = await api<{ sops: unknown[] }>(ctx, ctx.cookie, "/api/v1/processes/P8.3.1");
  const asAdmin = await api<{ sops: unknown[] }>(ctx, ctx.adminCookie, "/api/v1/processes/P8.3.1");
  check("opmodel: a unit-only SOP shows to the Super Admin and not to a Contributor of another unit", asAdmin.body.data?.sops.length === 1 && asContributor.body.data?.sops.length === 0);

  /* 6. the whole operating model */
  const model = await api<{
    principles: unknown[];
    governance: { bodies: { source: string }[]; connectors: unknown[] };
    chain: unknown[];
    raci: { processes: unknown[]; units: unknown[]; cells: unknown[] };
    calendar: { year: number; events: { kind: string }[] };
    interfaces: { internal: unknown[]; external: unknown[]; chord: unknown[]; units: unknown[] };
    kpis: { code: string; latest: { value: number | null } | null; rag: string }[];
    canEdit: boolean;
    isIllustrative: boolean;
  }>(ctx, ctx.cookie, "/api/v1/operating-model");
  const m = model.body.data;
  check("opmodel: GET /operating-model answers every section", model.status === 200 && Boolean(m) && m.principles.length >= 6 && m.chain.length === 8 && m.kpis.length === 5 && m.isIllustrative && m.canEdit === false);
  check("opmodel: governance merges the Council Strategy bodies with the added bodies", Boolean(m) && m.governance.bodies.filter((b) => b.source === "council").length >= 3 && m.governance.bodies.filter((b) => b.source === "operating_model").length === 5 && m.governance.connectors.length >= 8);
  check("opmodel: the RACI matrix covers every Level 1 process", Boolean(m) && m.raci.processes.length === l1 && m.raci.units.length >= 15 && m.raci.cells.length >= 100);
  const kinds = new Set(m?.calendar.events.map((e) => e.kind));
  check("opmodel: the calendar expands recurrences and carries every kind", Boolean(m) && m.calendar.year >= 2026 && m.calendar.events.length >= 60 && ["strategy_review", "budget", "statistical_release", "nds_review", "council_meeting", "report_deadline", "forum"].every((k) => kinds.has(k)));
  check("opmodel: interfaces carry the matrix aggregate", Boolean(m) && m.interfaces.internal.length >= 20 && m.interfaces.external.length === 10 && m.interfaces.chord.length >= 15 && m.interfaces.units.length >= 12);
  check("opmodel: every KPI has a latest value and a RAG", Boolean(m) && m.kpis.every((k) => k.latest?.value != null && k.rag !== "no_data"));
  const section = await api<unknown[]>(ctx, ctx.cookie, "/api/v1/operating-model?section=kpis");
  check("opmodel: ?section=kpis answers the cards alone", section.status === 200 && Array.isArray(section.body.data) && section.body.data.length === 5);
  const badSection = await api(ctx, ctx.cookie, "/api/v1/operating-model?section=nope");
  check("opmodel: an unknown section is a 400", badSection.status === 400);

  /* 7. writes: a Contributor is refused, the Super Admin is allowed */
  const p11 = await ctx.db.execute("select id from processes where code = 'P1.1'");
  const processId = String(p11.rows[0]?.id ?? "");
  const pr = await ctx.db.execute("select id from org_units where code = 'PR'");
  const prUnitId = String(pr.rows[0]?.id ?? "");
  const refused = await api(ctx, ctx.cookie, "/api/v1/operating-model/raci", { method: "PUT", body: { processId, unitId: prUnitId, role: "I" } });
  check("opmodel: a Contributor outside the Strategy Office cannot edit the RACI", refused.status === 403);
  const set = await api(ctx, ctx.adminCookie, "/api/v1/operating-model/raci", { method: "PUT", body: { processId, unitId: prUnitId, role: "I" } });
  const secondA = await api(ctx, ctx.adminCookie, "/api/v1/operating-model/raci", { method: "PUT", body: { processId, unitId: prUnitId, role: "A" } });
  const cleared = await api(ctx, ctx.adminCookie, "/api/v1/operating-model/raci", { method: "PUT", body: { processId, unitId: prUnitId, role: null } });
  check("opmodel: the Super Admin sets and clears a RACI cell, and a second A is refused", set.status === 200 && secondA.status === 409 && secondA.body.error === "accountable_exists" && cleared.status === 200);
  const calRefused = await api(ctx, ctx.cookie, "/api/v1/operating-model/calendar", { method: "POST", body: { kind: "other", titleEn: "x", titleAr: "س", dateFrom: "2026-12-01" } });
  check("opmodel: a Contributor cannot add a calendar event", calRefused.status === 403);
  const kpiRefused = await api(ctx, ctx.cookie, "/api/v1/operating-model/kpis", { method: "POST", body: { code: "release_timeliness", period: "2026-09", value: 1 } });
  check("opmodel: a Contributor cannot enter a KPI value", kpiRefused.status === 403);

  /* 8. the interface change request lifecycle */
  const firstIface = await ctx.db.execute("select id from unit_interfaces order by id limit 1");
  const interfaceId = String(firstIface.rows[0]?.id ?? "");
  const proposeRefused = await api(ctx, ctx.cookie, "/api/v1/operating-model/interfaces", { method: "POST", body: { kind: "change_request", interfaceId, text: "Smoke: a Contributor who heads no unit proposes." } });
  check("opmodel: a Contributor who heads no unit cannot propose an interface change", proposeRefused.status === 403);
  const proposed = await api<{ id: string; notified: number }>(ctx, ctx.adminCookie, "/api/v1/operating-model/interfaces", { method: "POST", body: { kind: "change_request", interfaceId, text: "Smoke: move the service level to three working days." } });
  check("opmodel: an editor proposes an interface change and the Strategy Office is notified", proposed.status === 200 && Boolean(proposed.body.data?.id) && (proposed.body.data?.notified ?? 0) >= 1);
  const requestId = proposed.body.data?.id ?? "";
  const resolved = await api(ctx, ctx.adminCookie, "/api/v1/operating-model/interfaces", { method: "PATCH", body: { kind: "resolve", id: requestId, status: "approved" } });
  const again = await api(ctx, ctx.adminCookie, "/api/v1/operating-model/interfaces", { method: "PATCH", body: { kind: "resolve", id: requestId, status: "declined" } });
  const status = await ctx.db.execute(`select status from interface_change_requests where id = '${requestId.replace(/'/g, "")}'`);
  check("opmodel: the editor resolves the request once", resolved.status === 200 && again.status === 409 && String(status.rows[0]?.status) === "approved");
  if (requestId) await ctx.db.execute(`delete from interface_change_requests where id = '${requestId.replace(/'/g, "")}'`);

  /* 9. the Ask NPC tools, called directly */
  try {
    const mod = (await import("../src/server/ai/analyst/cr08/operating-model")).default;
    const { AnalystState } = await import("../src/server/ai/analyst/tools");
    const { getUserById } = await import("../src/server/auth/session");
    const adminRow = await ctx.db.execute("select id from users where email = 'admin@npc.qa'");
    const user = await getUserById(String(adminRow.rows[0]?.id ?? ""));
    check("opmodel tools: three definitions registered with their portals", mod.definitions.map((d) => d.name).join(",") === "get_operating_model,get_process,get_interfaces" && mod.portal.get_process === "processes" && mod.portal.get_operating_model === "operating_model");
    if (user) {
      const state = new AnalystState();
      const toolCtx = { user, state };
      const proc = (await mod.run(toolCtx, "get_process", { code: "P4.1" })) ?? "";
      check("opmodel tools: get_process(P4.1) names the process, its owner and its steps", /Census and survey operations/.test(proc) && /Owner unit: SOA/.test(proc) && /Step 1:/.test(proc) && /illustrative data/.test(proc), proc.slice(0, 120));
      check("opmodel tools: get_process registers a process source", state.sources.some((s) => s.resource_type === "process"));
      const l0 = (await mod.run(toolCtx, "get_process", { code: "p4" })) ?? "";
      check("opmodel tools: a Level 0 code resolves case-insensitively with its children", /Level 0 process P4/.test(l0) && /Beneath it: P4\.1/.test(l0));
      const ifaces = (await mod.run(toolCtx, "get_interfaces", { unit: "SOA" })) ?? "";
      check("opmodel tools: get_interfaces(SOA) lists what the unit gives and receives", /Gives \(\d+\)/.test(ifaces) && /Receives \(\d+\)/.test(ifaces), ifaces.slice(0, 120));
      const raci = (await mod.run(toolCtx, "get_operating_model", { section: "raci" })) ?? "";
      check("opmodel tools: get_operating_model(raci) lists every Level 1 process with its A", /P4\.1 Census and survey operations: A=NSC/.test(raci));
      const gov = (await mod.run(toolCtx, "get_operating_model", { section: "governance" })) ?? "";
      check("opmodel tools: governance names the Council bodies and the added bodies", /Executive Committee/.test(gov) && /Strategy Steering Committee/.test(gov) && /Council Strategy body/.test(gov));
      const overview = (await mod.run(toolCtx, "get_operating_model", {})) ?? "";
      check("opmodel tools: the overview counts every section", /8 Level 0 processes/.test(overview) && /Operational KPIs/.test(overview));
      check("opmodel tools: sources say the content is illustrative", state.sources.some((s) => s.resource_type === "operating_model" && /illustrative/.test(s.title)));
      check("opmodel tools: an unknown name is not this module's tool", (await mod.run(toolCtx, "not_a_tool", {})) === null);
    } else {
      check("opmodel tools: the admin user loads", false);
    }
  } catch (e) {
    check("opmodel tools: module loads from the script", false, String((e as Error)?.message ?? e).slice(0, 160));
  }
}
