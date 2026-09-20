// CR08 10.1 smoke checks: the /processes page in both locales (the eight
// Level 0 cards and their connectors, the chips, the deep links of the panel,
// the expanded chain, the by-unit and by-policy views), a reader whose
// portal is denied gets the friendly 404, the process writes (a Contributor
// refused, the Super Admin creates and deletes), the unit tab helper, and
// the i18n fragment's parity. Wired into scripts/smoke.ts by the
// coordinator: run(check, { base, cookie, adminCookie, db }).
import fs from "node:fs";
import path from "node:path";

type Check = (name: string, ok: boolean, detail?: string) => void;
type Ctx = { base: string; cookie: string; adminCookie: string; db: import("@libsql/client").Client };

/** The shared dev server resets a connection now and then under load: a read is retried, a write is not. */
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

const count = (html: string, needle: string) => html.split(needle).length - 1;

export async function run(check: Check, ctx: Ctx): Promise<void> {
  const { base, cookie, adminCookie, db } = ctx;
  const admin = (p: string, init: RequestInit = {}) =>
    fetchRetry(`${base}${p}`, { ...init, headers: { cookie: adminCookie, ...(init.headers ?? {}) }, redirect: "manual" });
  const user = (p: string, init: RequestInit = {}) =>
    fetchRetry(`${base}${p}`, { ...init, headers: { cookie, ...(init.headers ?? {}) }, redirect: "manual" });
  const json = (who: typeof admin, p: string, method: string, body?: unknown) =>
    who(p, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

  /* 1. the page in English: the map, the chips, the view switch */
  const enRes = await admin("/en/processes");
  const en = await enRes.text();
  check("processes: the English page renders", enRes.status === 200 && en.includes("Processes, Policies, and SOPs"), `status ${enRes.status}`);
  check("processes: the eight Level 0 cards are in the chain", count(en, 'data-testid="process-l0-card"') === 8, `${count(en, 'data-testid="process-l0-card"')} cards`);
  check("processes: seven connectors join the eight cards", count(en, 'data-testid="process-connector"') === 7);
  check(
    "processes: the Internal and Illustrative chips and the view switch are on the page",
    en.includes('data-testid="internal-chip"') && en.includes('data-testid="illustrative-chip"') && en.includes('data-testid="processes-view-switch"')
  );
  check("processes: the Super Admin sees Add process", en.includes('data-testid="processes-add"'));
  const cardOrder = [...en.matchAll(/data-testid="process-l0-card"[^>]*data-code="(P\d)"/g)].map((m) => m[1]).join(",");
  check("processes: the cards run P1 to P8 in order", cardOrder === "P1,P2,P3,P4,P5,P6,P7,P8", cardOrder);

  /* 2. the Arabic mirror */
  const ar = await (await admin("/ar/processes")).text();
  check("processes: the Arabic page carries the title and the eight cards", ar.includes("العمليات والسياسات والإجراءات") && count(ar, 'data-testid="process-l0-card"') === 8);
  check("processes: no raw message key on either page", !/processes\.(title|map|panel|views)\./.test(en) && !/processes\.(title|map|panel|views)\./.test(ar));

  /* 3. deep links: the panel, the expanded chain, the AskContextItem marker */
  const p41 = await (await user("/en/processes?p=P4.1")).text();
  const steps = count(p41, 'data-testid="process-step"');
  check("processes: ?p=P4.1 opens the panel with its numbered steps", p41.includes('data-testid="process-panel"') && p41.includes('data-code="P4.1"') && steps >= 4, `${steps} steps`);
  check("processes: the panel carries the Ask NPC context marker for the process", p41.includes('data-ask-context="process:P4.1"'));
  check("processes: the panel names the owner unit and the RACI", p41.includes('data-testid="process-owner"') && p41.includes('data-testid="process-raci"') && count(p41, 'data-testid="raci-cell"') >= 2);
  check("processes: a Level 1 deep link expands its Level 0 parent in place", p41.includes('data-testid="level1-panel"') && p41.includes('data-testid="level1-panel" data-code="P4"') && count(p41, 'data-testid="process-l1-row"') >= 3);
  const p43 = await (await user("/en/processes?p=P4.3")).text();
  check("processes: P4.3 shows its SOP on the mini shelf to a Contributor", p43.includes('data-testid="process-mini-shelf"') && count(p43, 'data-testid="book"') >= 1);
  const l0 = await (await user("/en/processes?l0=P6")).text();
  check("processes: ?l0=P6 expands the chain without a panel", l0.includes('data-testid="level1-panel" data-code="P6"') && !l0.includes('data-testid="process-panel"'));
  const missing = await user("/en/processes?p=P99.9");
  check("processes: an unknown ?p code still renders the map", missing.status === 200 && count(await missing.text(), 'data-testid="process-l0-card"') === 8);

  /* 4. the by-unit and by-policy views */
  const byUnit = await (await user("/en/processes?view=unit&unit=SOA")).text();
  check(
    "processes: ?view=unit lists the units and expands SOA with its processes",
    byUnit.includes('data-testid="by-unit-view"') && /data-unit="SOA" data-expanded="true"/.test(byUnit) && count(byUnit, 'data-testid="process-list-row"') >= 5
  );
  const byPolicy = await (await user("/en/processes?view=policy&tab=procedure")).text();
  check(
    "processes: ?view=policy shows the four tabs with the procedures selected",
    byPolicy.includes('data-testid="by-policy-view"') && count(byPolicy, 'data-testid="policy-type-tab"') === 4 && /data-tab="procedure"[^>]*aria-selected="true"|aria-selected="true"[^>]*data-tab="procedure"/.test(byPolicy) && count(byPolicy, 'data-testid="policy-doc-row"') >= 1
  );
  const arUnit = await (await admin("/ar/processes?view=unit")).text();
  check("processes: the Arabic by-unit view names the tabs from the Organisation", arUnit.includes('data-testid="by-unit-view"') && arUnit.includes("حسب الوحدة"));

  /* 5. a reader whose portal is denied gets the friendly 404 */
  const [analyst] = (await db.execute("select id from users where email = 'analyst@npc.qa' limit 1")).rows;
  const analystId = String(analyst?.id ?? "");
  if (analystId) {
    const denied = await json(admin, `/api/v1/users/${analystId}/access`, "POST", { permissionKey: "portal:processes", effect: "deny", reason: "smoke test" });
    const hidden = await user("/en/processes");
    await json(admin, `/api/v1/users/${analystId}/access`, "POST", { permissionKey: "portal:processes", effect: null });
    const back = await user("/en/processes");
    check("processes: a reader without the portal gets 404, restored afterwards", denied.status === 200 && hidden.status === 404 && back.status === 200, `${denied.status}/${hidden.status}/${back.status}`);
  } else {
    check("processes: the analyst account exists for the portal check", false);
  }

  /* 6. writes: a Contributor is refused, the Super Admin creates and deletes */
  const smokeCode = "P9.SMOKE";
  const body = { code: smokeCode, level: 0, parentId: null, nameEn: "Smoke process", nameAr: "عملية اختبار", purposeEn: "Created by the smoke suite.", purposeAr: "أنشأتها حزمة الاختبار.", steps: [{ n: 1, textEn: "One", textAr: "واحد", roleUnitCode: "SOA", system: "SiaNexus" }], isIllustrative: true };
  const refused = await json(user, "/api/v1/processes", "POST", body);
  check("processes: a Contributor outside the Strategy Office cannot add a process", refused.status === 403);
  const created = await json(admin, "/api/v1/processes", "POST", body);
  const createdJson = await created.json().catch(() => null);
  const createdId = String(createdJson?.data?.id ?? "");
  check("processes: the Super Admin adds a process", created.status === 200 && Boolean(createdId));
  if (createdId) {
    const read = await admin(`/api/v1/processes/${smokeCode}`);
    const readJson = await read.json().catch(() => null);
    check("processes: the new process reads back with its step and owner", read.status === 200 && readJson?.data?.steps?.length === 1 && readJson?.data?.steps?.[0]?.roleUnit?.code === "SOA");
    const clash = await json(admin, "/api/v1/processes", "POST", body);
    check("processes: a second process with the same code is refused", clash.status === 409);
    const patched = await json(admin, "/api/v1/processes", "PATCH", { ...body, id: createdId, nameEn: "Smoke process (edited)" });
    check("processes: the Super Admin edits the process", patched.status === 200);
    const deleted = await admin(`/api/v1/processes?id=${encodeURIComponent(createdId)}`, { method: "DELETE" });
    const gone = await admin(`/api/v1/processes/${smokeCode}`);
    check("processes: the Super Admin deletes it and it is gone", deleted.status === 200 && gone.status === 404);
    if (gone.status !== 404) await db.execute(`delete from processes where id = '${createdId.replace(/'/g, "")}'`);
  }

  /* 7. the unit tab the Organisation panel mounts loads itself from ?view=unit */
  const unitView = await user("/api/v1/processes?view=unit");
  const unitJson = (await unitView.json().catch(() => null)) as { data?: { byUnit?: { unit: { id: string; code: string }; processes: { code: string }[] }[] } } | null;
  const soaGroup = unitJson?.data?.byUnit?.find((u) => u.unit.code === "SOA");
  check(
    "processes: GET ?view=unit feeds the unit panel tab with the unit's processes",
    unitView.status === 200 && Boolean(soaGroup?.unit.id) && (soaGroup?.processes.length ?? 0) >= 5,
    `${unitJson?.data?.byUnit?.length ?? 0} units, SOA ${soaGroup?.processes.length ?? 0} processes`
  );

  /* 8. the unit tab helper the Organisation panel may use server side */
  try {
    const { getUnitProcesses } = await import("../src/server/services/operating-model-unit");
    const { getUserById } = await import("../src/server/auth/session");
    const [adminRow] = (await db.execute("select id from users where email = 'admin@npc.qa' limit 1")).rows;
    const [soa] = (await db.execute("select id from org_units where code = 'SOA' limit 1")).rows;
    const adminUser = await getUserById(String(adminRow?.id ?? ""));
    const owned = adminUser ? await getUnitProcesses(adminUser, String(soa?.id ?? "")) : [];
    check("processes: getUnitProcesses(SOA) lists the unit's processes for the unit panel", owned.length >= 5 && owned.some((p) => p.code === "P4.1"), `${owned.length} processes`);
  } catch (e) {
    check("processes: getUnitProcesses loads from the script", false, String((e as Error)?.message ?? e).slice(0, 160));
  }

  /* 9. the i18n fragment: the namespace is whole in both languages */
  const readJson = (file: string) => JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  const enMessages = readJson(path.join(process.cwd(), "messages", "en.json"));
  const arMessages = readJson(path.join(process.cwd(), "messages", "ar.json"));
  const keys = (o: Record<string, unknown>, prefix = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`]));
  const enKeys = keys(enMessages.processes ?? {});
  const arKeys = new Set(keys(arMessages.processes ?? {}));
  check("processes: the i18n namespace is whole in both languages", enKeys.length >= 150 && enKeys.every((k) => arKeys.has(k)) && arMessages.processes?.title === "العمليات والسياسات والإجراءات", `${enKeys.length} keys`);
}
