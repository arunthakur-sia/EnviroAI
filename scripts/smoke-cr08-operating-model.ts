// CR08 10.2 smoke checks: the /operating-model page in both locales (the
// seven sections, the chips, the seeded volumes on screen), the section API,
// the seeded counts in the database, and every write with its refusal: the
// RACI cell (a Contributor refused, the Super Admin cycling, the second A
// answered with 409 accountable_exists), the calendar event, the interface
// change request, the operational KPI value, and the i18n parity of the
// namespace. Every write is undone before the module returns. Wired into
// scripts/smoke.ts by the coordinator: run(check, { base, cookie, adminCookie, db }).
import fs from "node:fs";
import path from "node:path";

type Check = (name: string, ok: boolean, detail?: string) => void;
type Ctx = { base: string; cookie: string; adminCookie: string; db: import("@libsql/client").Client };

type UnitRef = { id: string; code: string };
type Model = {
  principles: { id: string }[];
  governance: { bodies: { id: string; source: string }[]; connectors: { kind: string }[] };
  chain: { code: string; children: unknown[] }[];
  raci: { processes: { id: string; code: string }[]; units: UnitRef[]; cells: { processId: string; unitId: string; role: string }[] };
  calendar: { year: number; events: { id: string; kind: string }[] };
  interfaces: {
    external: { id: string }[];
    internal: { id: string; fromUnit: UnitRef; toUnit: UnitRef }[];
    units: UnitRef[];
    matrix: { count: number }[];
    chord: { count: number }[];
    changeRequests: { id: string }[];
  };
  kpis: { id: string; code: string; series: unknown[] }[];
  canEdit: boolean;
  isIllustrative: boolean;
};

/** The shared dev server resets a connection now and then under load. A read
 *  is retried three times; a write is retried once, and every write in this
 *  module either upserts by key or is swept by name afterwards, so a retry
 *  cannot leave a duplicate behind. */
async function fetchRetry(url: string, init: RequestInit): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  let last: unknown = null;
  for (let attempt = 0; attempt < (method === "GET" ? 3 : 2); attempt++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw last;
}

const count = (html: string, needle: string) => html.split(needle).length - 1;
const num = (v: unknown) => Number((v as { count?: unknown })?.count ?? v ?? 0);

export async function run(check: Check, ctx: Ctx): Promise<void> {
  const { base, cookie, adminCookie, db } = ctx;
  const admin = (p: string, init: RequestInit = {}) =>
    fetchRetry(`${base}${p}`, { ...init, headers: { cookie: adminCookie, ...(init.headers ?? {}) }, redirect: "manual" });
  const user = (p: string, init: RequestInit = {}) =>
    fetchRetry(`${base}${p}`, { ...init, headers: { cookie, ...(init.headers ?? {}) }, redirect: "manual" });
  const json = (who: typeof admin, p: string, method: string, body?: unknown) =>
    who(p, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = async (res: Response) => (await res.json().catch(() => null))?.data ?? null;
  const rows = async (sql: string) => num((await db.execute(sql)).rows[0]);
  /** The database file is shared with the dev server: a housekeeping write waits out SQLITE_BUSY. */
  const exec = async (sql: string) => {
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        await db.execute(sql);
        return true;
      } catch {
        await new Promise((r) => setTimeout(r, 700));
      }
    }
    return false;
  };

  /* 1. the page in English: the seven sections, the chips, the seeded volumes */
  const enRes = await admin("/en/operating-model");
  const en = await enRes.text();
  const anchors = ["om-principles", "om-governance", "om-processes", "om-raci", "om-calendar", "om-interfaces", "om-kpis"];
  check("operating model: the English page renders with its title", enRes.status === 200 && en.includes("Operating Model"), `status ${enRes.status}`);
  check(
    "operating model: the seven sections are on the page in order",
    anchors.every((a) => en.includes(`id="${a}"`)) && anchors.map((a) => en.indexOf(a)).every((v, i, arr) => i === 0 || v > arr[i - 1]),
    anchors.filter((a) => !en.includes(`id="${a}"`)).join(",")
  );
  check(
    "operating model: the hero carries the Internal and Illustrative chips and the Ask link",
    en.includes('data-testid="internal-chip"') && en.includes('data-testid="illustrative-chip"') && en.includes('data-testid="om-ask"')
  );
  check(
    "operating model: the seeded volumes render (6 principles, 8 chain cards, 10 entity cards, 5 KPI tiles)",
    count(en, 'data-testid="om-principle"') === 6 &&
      count(en, 'data-testid="chain-card"') === 8 &&
      count(en, 'data-testid="entity-card"') === 10 &&
      count(en, 'data-testid="kpi-tile"') === 5,
    `${count(en, 'data-testid="om-principle"')}/${count(en, 'data-testid="chain-card"')}/${count(en, 'data-testid="entity-card"')}/${count(en, 'data-testid="kpi-tile"')}`
  );

  /* 2. the Arabic mirror and no raw message key on either page */
  const ar = await (await admin("/ar/operating-model")).text();
  check(
    "operating model: the Arabic page carries the title and the seven sections",
    ar.includes("نموذج التشغيل") && anchors.every((a) => ar.includes(`id="${a}"`))
  );
  const rawKey = /operatingModel\.(title|nav|section|raci|calendar|interfaces|kpis|governance|principles)\./;
  check("operating model: no raw message key on either page", !rawKey.test(en) && !rawKey.test(ar));

  /* 3. the whole model through the API, and one section at a time */
  const modelRes = await admin("/api/v1/operating-model");
  const model = (await data(modelRes)) as Model | null;
  check(
    "operating model: GET /api/v1/operating-model returns the whole model to the Super Admin",
    modelRes.status === 200 && Boolean(model) && model!.canEdit === true && model!.isIllustrative === true,
    `status ${modelRes.status}`
  );
  if (!model) {
    check("operating model: the model loaded, later checks skipped", false);
    return;
  }
  check(
    "operating model: the seeded model carries every section (6 principles, 6 bodies, 8 Level 0, 182 RACI cells, 46 events, 30 interfaces, 5 KPIs)",
    model.principles.length === 6 &&
      model.governance.bodies.length >= 6 &&
      model.governance.connectors.length >= 8 &&
      model.chain.length === 8 &&
      model.raci.cells.length === 182 &&
      model.calendar.events.length >= 46 &&
      model.interfaces.internal.length === 20 &&
      model.interfaces.external.length === 10 &&
      model.kpis.length === 5,
    `${model.principles.length}/${model.governance.bodies.length}/${model.chain.length}/${model.raci.cells.length}/${model.calendar.events.length}/${model.interfaces.internal.length}/${model.interfaces.external.length}/${model.kpis.length}`
  );
  check(
    "operating model: the chord and the matrix agree with the internal interfaces",
    model.interfaces.chord.length > 0 &&
      model.interfaces.chord.reduce((s, c) => s + c.count, 0) === 20 &&
      model.interfaces.matrix.reduce((s, c) => s + c.count, 0) === 20,
    `chord ${model.interfaces.chord.reduce((s, c) => s + c.count, 0)}, matrix ${model.interfaces.matrix.reduce((s, c) => s + c.count, 0)}`
  );
  check(
    "operating model: every KPI carries a series for the sparkline",
    model.kpis.length === 5 && model.kpis.every((k) => k.series.length >= 6),
    model.kpis.map((k) => `${k.code}:${k.series.length}`).join(" ")
  );
  const sectionRes = await admin("/api/v1/operating-model?section=kpis");
  const section = await data(sectionRes);
  const badSection = await admin("/api/v1/operating-model?section=nope");
  check(
    "operating model: ?section=kpis returns that section alone and an unknown section is 400",
    sectionRes.status === 200 && Array.isArray(section) && section.length === 5 && badSection.status === 400,
    `${sectionRes.status}/${badSection.status}`
  );
  const anon = await fetchRetry(`${base}/api/v1/operating-model`, { redirect: "manual" });
  const asUser = (await data(await user("/api/v1/operating-model?section=principles"))) as { id: string }[] | null;
  const userModel = (await data(await user("/api/v1/operating-model"))) as Model | null;
  check(
    "operating model: no session is 401, a Contributor reads the model but cannot edit it",
    anon.status === 401 && Array.isArray(asUser) && asUser.length === 6 && userModel?.canEdit === false,
    `anon ${anon.status}, canEdit ${String(userModel?.canEdit)}`
  );

  /* 4. the seeded rows in the database */
  const counts = {
    principles: await rows("select count(*) as count from operating_principles"),
    raci: await rows("select count(*) as count from process_raci"),
    calendar: await rows("select count(*) as count from calendar_events"),
    internal: await rows("select count(*) as count from unit_interfaces where status = 'active'"),
    external: await rows("select count(*) as count from entity_interfaces"),
    kpis: await rows("select count(*) as count from ops_kpis"),
    values: await rows("select count(*) as count from ops_kpi_values"),
  };
  check(
    "operating model: the seed left 6 principles, 182 RACI cells, 46 calendar events, 20 internal and 10 external interfaces, 5 KPIs with 45 values",
    counts.principles === 6 &&
      counts.raci === 182 &&
      counts.calendar === 46 &&
      counts.internal === 20 &&
      counts.external === 10 &&
      counts.kpis === 5 &&
      counts.values === 45,
    JSON.stringify(counts)
  );
  const oneA = await rows("select count(*) as count from (select process_id from process_raci where role = 'A' group by process_id having count(*) > 1)");
  check("operating model: no process carries two accountable units", oneA === 0, `${oneA} processes with two A`);

  /* 5. the RACI cell: a Contributor refused, the Super Admin cycles, the second A is 409 */
  const firstProcess = model.raci.processes[0];
  const taken = new Set(model.raci.cells.filter((c) => c.processId === firstProcess.id).map((c) => c.unitId));
  const freeUnit = model.raci.units.find((u) => !taken.has(u.id));
  const refused = await json(user, "/api/v1/operating-model/raci", "PUT", {
    processId: firstProcess.id,
    unitId: freeUnit?.id ?? model.raci.units[0].id,
    role: "C",
  });
  check("operating model: a Contributor cannot write a RACI cell", refused.status === 403, `status ${refused.status}`);
  if (freeUnit) {
    const set = await json(admin, "/api/v1/operating-model/raci", "PUT", { processId: firstProcess.id, unitId: freeUnit.id, role: "C" });
    const after = (await data(await admin("/api/v1/operating-model?section=raci"))) as Model["raci"] | null;
    const wrote = after?.cells.some((c) => c.processId === firstProcess.id && c.unitId === freeUnit.id && c.role === "C") ?? false;
    const cleared = await json(admin, "/api/v1/operating-model/raci", "PUT", { processId: firstProcess.id, unitId: freeUnit.id, role: null });
    const back = await rows(
      `select count(*) as count from process_raci where process_id = '${firstProcess.id.replace(/'/g, "")}' and unit_id = '${freeUnit.id.replace(/'/g, "")}'`
    );
    check(
      "operating model: the Super Admin sets a RACI cell, reads it back and clears it",
      set.status === 200 && wrote && cleared.status === 200 && back === 0,
      `set ${set.status}, read ${wrote}, clear ${cleared.status}, left ${back}`
    );
  } else {
    check("operating model: a free RACI cell exists to write", false);
  }
  const accountable = model.raci.cells.find((c) => c.role === "A");
  const rival = accountable ? model.raci.units.find((u) => u.id !== accountable.unitId) : null;
  if (accountable && rival) {
    const clash = await json(admin, "/api/v1/operating-model/raci", "PUT", { processId: accountable.processId, unitId: rival.id, role: "A" });
    const body = await clash.json().catch(() => null);
    check(
      "operating model: a second accountable unit on one process is refused with 409 accountable_exists",
      clash.status === 409 && body?.error === "accountable_exists" && body?.detail?.accountableUnitId === accountable.unitId,
      `status ${clash.status}, error ${body?.error}`
    );
  } else {
    check("operating model: a seeded accountable cell exists for the 409 check", false);
  }

  /* 6. the calendar: the year switch, a Contributor refused, the Super Admin writes and removes */
  const y2027 = (await data(await admin("/api/v1/operating-model/calendar?year=2027"))) as Model["calendar"] | null;
  check(
    "operating model: the calendar answers another year with its recurring occurrences",
    y2027?.year === 2027 && (y2027?.events.length ?? 0) >= 20,
    `${y2027?.events.length ?? 0} events in 2027`
  );
  const eventBody = {
    kind: "forum" as const,
    titleEn: "Smoke forum",
    titleAr: "منتدى اختبار",
    dateFrom: `${model.calendar.year}-11-04`,
    dateTo: `${model.calendar.year}-11-05`,
    recurrence: "none" as const,
  };
  const calRefused = await json(user, "/api/v1/operating-model/calendar", "POST", eventBody);
  const created = await json(admin, "/api/v1/operating-model/calendar", "POST", eventBody);
  const createdId = String(((await created.json().catch(() => null))?.data?.id ?? ""));
  const patched = createdId
    ? await json(admin, "/api/v1/operating-model/calendar", "PATCH", { ...eventBody, id: createdId, titleEn: "Smoke forum (edited)" })
    : null;
  const deleted = createdId ? await admin(`/api/v1/operating-model/calendar?id=${encodeURIComponent(createdId)}`, { method: "DELETE" }) : null;
  const gone = createdId ? await rows(`select count(*) as count from calendar_events where id = '${createdId.replace(/'/g, "")}'`) : 1;
  check(
    "operating model: the calendar refuses a Contributor and lets the Super Admin add, edit and delete an event",
    calRefused.status === 403 && created.status === 200 && Boolean(createdId) && patched?.status === 200 && deleted?.status === 200 && gone === 0,
    `${calRefused.status}/${created.status}/${patched?.status}/${deleted?.status}, left ${gone}`
  );
  // a retried write on a reset connection can leave a twin: sweep it by name
  await exec("delete from calendar_events where title_en like 'Smoke forum%'");

  /* 7. the interfaces: one unit's flows, an unknown unit, and a change request a Contributor may not file */
  const unitCode = model.interfaces.units[0]?.code ?? "DOP";
  const unitRes = await user(`/api/v1/operating-model/interfaces?unit=${encodeURIComponent(unitCode)}`);
  const unitView = (await data(unitRes)) as { gives?: unknown[]; receives?: unknown[] } | null;
  const unknownUnit = await user("/api/v1/operating-model/interfaces?unit=NOPE");
  check(
    `operating model: the interfaces of ${unitCode} load and an unknown unit is 404`,
    unitRes.status === 200 && Array.isArray(unitView?.gives) && Array.isArray(unitView?.receives) && (unitView!.gives!.length + unitView!.receives!.length) > 0 && unknownUnit.status === 404,
    `status ${unitRes.status}/${unknownUnit.status}`
  );
  const anInterface = model.interfaces.internal[0];
  const proposed = await json(user, "/api/v1/operating-model/interfaces", "POST", {
    kind: "change_request",
    interfaceId: anInterface.id,
    text: "The smoke suite proposes a shorter service level on this interface.",
  });
  check(
    "operating model: a Contributor who heads neither unit cannot propose an interface change",
    proposed.status === 403,
    `status ${proposed.status}`
  );
  const short = await json(admin, "/api/v1/operating-model/interfaces", "POST", { kind: "change_request", interfaceId: anInterface.id, text: "no" });
  check("operating model: a change request needs a real sentence", short.status === 400, `status ${short.status}`);

  /* 8. the operational KPIs: a Contributor refused, the Super Admin defines one and enters a value */
  const kpiRefused = await json(user, "/api/v1/operating-model/kpis", "POST", { code: model.kpis[0].code, period: "2026-01", value: 1 });
  const badPeriod = await json(admin, "/api/v1/operating-model/kpis", "POST", { code: model.kpis[0].code, period: "2026-13", value: 1 });
  check(
    "operating model: a Contributor cannot enter a KPI value and an impossible period is refused",
    kpiRefused.status === 403 && badPeriod.status === 400,
    `${kpiRefused.status}/${badPeriod.status}`
  );
  const defined = await json(admin, "/api/v1/operating-model/kpis", "PATCH", {
    code: "OPS.SMOKE",
    nameEn: "Smoke KPI",
    nameAr: "مؤشر اختبار",
    unit: "%",
    direction: "up_good",
    sourceKind: "manual",
    targetValue: 90,
  });
  const definedId = String(((await defined.json().catch(() => null))?.data?.id ?? ""));
  const entered = definedId ? await json(admin, "/api/v1/operating-model/kpis", "POST", { kpiId: definedId, period: "2026-08", value: 81.5 }) : null;
  const cards = (await data(await admin("/api/v1/operating-model/kpis"))) as Model["kpis"] | null;
  const smokeCard = cards?.find((k) => k.code === "OPS.SMOKE") as (Model["kpis"][number] & { latest?: { value: number }; rag?: string }) | undefined;
  check(
    "operating model: the Super Admin defines a KPI, enters a value and it reads back with its RAG",
    defined.status === 200 && entered?.status === 200 && smokeCard?.latest?.value === 81.5 && smokeCard?.rag === "at_risk",
    `${defined.status}/${entered?.status}, latest ${String(smokeCard?.latest?.value)}, rag ${String(smokeCard?.rag)}`
  );
  if (definedId) {
    const id = definedId.replace(/'/g, "");
    await exec(`delete from ops_kpi_values where kpi_id = '${id}'`);
    await exec(`delete from ops_kpis where id = '${id}'`);
  }
  const kpisLeft = await rows("select count(*) as count from ops_kpis");
  check("operating model: the smoke KPI is removed and the five seeded KPIs remain", kpisLeft === 5, `${kpisLeft} KPIs`);

  /* 9. the i18n namespace is whole in both languages */
  const readJson = (file: string) => JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  const enMessages = readJson(path.join(process.cwd(), "messages", "en.json"));
  const arMessages = readJson(path.join(process.cwd(), "messages", "ar.json"));
  const keys = (o: Record<string, unknown>, prefix = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`]));
  const enKeys = keys(enMessages.operatingModel ?? {});
  const arKeys = new Set(keys(arMessages.operatingModel ?? {}));
  check(
    "operating model: the i18n namespace is whole in both languages",
    enKeys.length >= 150 && enKeys.every((k) => arKeys.has(k)) && arMessages.operatingModel?.title === "نموذج التشغيل",
    `${enKeys.length} keys, ${enKeys.filter((k) => !arKeys.has(k)).slice(0, 3).join(",")}`
  );
}
