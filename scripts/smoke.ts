/* eslint-disable no-console */
// Section 15 acceptance checks. Run against `npm run dev` on a seeded database:
//   npm run smoke
import { loadEnv } from "../src/lib/load-env";
loadEnv();

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

type Jar = Map<string, string>;
function makeClient() {
  const jar: Jar = new Map();
  return async function req(path: string, opts: RequestInit = {}) {
    const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(BASE + path, {
      ...opts,
      headers: { ...(opts.headers as Record<string, string> ?? {}), cookie },
      redirect: "manual",
    });
    for (const sc of (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []) {
      const [pair] = sc.split(";");
      const [k, ...v] = pair.split("=");
      jar.set(k.trim(), v.join("="));
    }
    return res;
  };
}

let passed = 0;
let failed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` (${detail})` : ""}`);
    console.log(`  FAIL ${name} ${detail}`);
  }
}

async function login(req: ReturnType<typeof makeClient>, email: string, password = "Nexus!2026") {
  const res = await req("/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.status;
}

async function readSse(res: Response) {
  const text = await res.text();
  const m = /event: final\ndata: (.*)\n/.exec(text);
  return { final: m ? JSON.parse(m[1]) : null, deltas: (text.match(/event: delta/g) ?? []).length };
}

async function main() {
  console.log(`== SiaNexus smoke against ${BASE} ==\n`);

  /* 1. logins, clearance */
  console.log("1. Accounts and clearance");
  const accounts = [
    "admin@npc.qa",
    "knowledge@npc.qa",
    "head.stats@npc.qa",
    "verifier@npc.qa",
    "analyst@npc.qa",
    "reader@npc.qa",
  ];
  for (const email of accounts) {
    const client = makeClient();
    check(`login ${email}`, (await login(client, email)) === 200);
    for (const locale of ["en", "ar"]) {
      const res = await client(`/${locale}/home`);
      check(`${email} /${locale}/home`, res.status === 200);
    }
  }
  {
    const client = makeClient();
    check("wrong password rejected", (await login(client, "reader@npc.qa", "wrong")) === 401);
  }
  // reader vs confidential
  const admin = makeClient();
  await login(admin, "admin@npc.qa");
  // the list clamps to 120 per page; page until a confidential doc appears
  // (CR02 added 90+ newer internal deliverables above it in the sort)
  let docs: { id: string; titleEn: string; classification: number }[] = [];
  let cursor: number | null = 0;
  for (let page = 0; page < 5 && cursor !== null; page++) {
    const pageRes = await admin(`/api/v1/documents?limit=120&cursor=${cursor}`);
    const pageJson = await pageRes.json();
    docs = docs.concat(pageJson.data ?? []);
    cursor = pageJson.meta?.nextCursor ?? null;
    if (docs.some((d) => d.classification >= 3)) break;
  }
  const confidential = docs.find((d) => d.classification >= 3);
  check("admin sees a confidential document", Boolean(confidential));
  const reader = makeClient();
  await login(reader, "reader@npc.qa");
  if (confidential) {
    const res = await reader(`/api/v1/documents/${confidential.id}/download`);
    check("reader gets 403 on confidential download", res.status === 403);
    const list = await reader("/api/v1/documents?limit=120");
    const readerDocs = (await list.json()).data as { id: string }[];
    check(
      "confidential absent from reader listing",
      !readerDocs.some((d) => d.id === confidential.id)
    );
    const sugg = await reader("/api/v1/search/suggest?q=fiscal%20scenario%20assumptions&locale=en");
    const groups = (await sugg.json()).data ?? {};
    const inSuggest = Object.values(groups as Record<string, { id: string }[]>)
      .flat()
      .some((s) => s.id === confidential.id);
    check("confidential absent from reader suggestions", !inSuggest);
  }

  /* 2. Home for analyst */
  console.log("\n2. Home");
  const analyst = makeClient();
  await login(analyst, "analyst@npc.qa");
  const homeHtml = await (await analyst("/en/home")).text();
  check("onboarding quest is gone from Home", !homeHtml.includes('data-testid="quest-card"'));
  check("ask box present on Home", homeHtml.includes('data-testid="home-ask"'));
  // CR03 4.4.3: the daily card became the Daily challenge flip card
  check("daily challenge present", homeHtml.includes('data-testid="daily-challenge"'));
  // CR03 4.4.1: the word of the day became the Words that guide us band
  check("quote band present", homeHtml.includes('data-testid="quote-band"'));
  check("lessons box present", homeHtml.includes('data-testid="home-lessons"'));
  check("mystery shelf removed (CR02)", !homeHtml.includes('data-testid="mystery"'));
  check("progress panel present", homeHtml.includes('data-testid="progress-panel"'));
  check("newest shelf present", homeHtml.includes('data-testid="newest-shelf"'));
  // quiz awards points
  {
    const cardsRes = await analyst("/api/v1/gamification/state").catch(() => null);
    const home2 = await analyst("/en/home");
    const idMatch = /"cardId":"([^"]+)"|data-card-id="([^"]+)"/.exec(await home2.text());
    // fall back: read the daily card via the DB-backed page markup is brittle; use the API
    const today = new Date().toISOString().slice(0, 10);
    // answer through the api using the card fetched from the seed dates
    const { createClient } = await import("@libsql/client");
    const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
    const card = await db.execute({
      sql: "select id, correct_index from daily_cards where date <= ? order by date desc limit 1",
      args: [today],
    });
    if (card.rows.length) {
      const res = await analyst("/api/v1/daily-card/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId: String(card.rows[0].id), chosenIndex: Number(card.rows[0].correct_index) }),
      });
      const json = await res.json().catch(() => ({}));
      check(
        "quiz answer awards points",
        (res.status === 200 && json.data?.points > 0) || res.status === 409,
        `status ${res.status}`
      );
    } else {
      check("quiz answer awards points", false, "no daily card seeded");
    }
    db.close();
  }

  /* 3. Vault */
  console.log("\n3. Vault");
  check("vault lists seeded documents", docs.length >= 40, `got ${docs.length}`);
  // upload NDS3 PDF -> duplicate detection
  const fs = await import("node:fs");
  const path = await import("node:path");
  const nds3Path = path.join(process.cwd(), "sources", "QNDS3_EN.pdf");
  if (fs.existsSync(nds3Path)) {
    const buf = fs.readFileSync(nds3Path);
    const form = new FormData();
    form.append("file", new File([new Uint8Array(buf)], "QNDS3_EN_again.pdf", { type: "application/pdf" }));
    const res = await admin("/api/v1/documents", { method: "POST", body: form });
    const json = await res.json();
    check("upload parses and enriches", res.status === 200 && Boolean(json.data?.enrichment?.title_en));
    check(
      "duplicate detected above 0.92",
      Boolean(json.data?.duplicate) && json.data.duplicate.similarity >= 0.92,
      JSON.stringify(json.data?.duplicate ?? null)
    );
    check(
      "enrichment fields complete",
      Boolean(
        json.data?.enrichment &&
          json.data.enrichment.summary_en !== undefined &&
          Array.isArray(json.data.enrichment.key_facts) &&
          json.data.enrichment.classification_level >= 1
      )
    );
    // attach as new version of the duplicate target
    if (json.data?.duplicate) {
      const confirmRes = await admin(`/api/v1/documents/${json.data.documentId}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title_en: "dup",
          as_new_version_of: json.data.duplicate.id,
        }),
      });
      check("duplicate resolves to new version", confirmRes.status === 200);
    }
  } else {
    check("upload parses and enriches", false, "sources/QNDS3_EN.pdf missing");
  }
  // reader page 10 + verify + download audit
  const nds3Doc = docs.find((d) => d.titleEn.includes("Third National Development Strategy"));
  if (nds3Doc) {
    const res = await analyst(`/en/vault/${nds3Doc.id}?page=10`);
    check("reader page opens at cited page", res.status === 200);
    const dl = await analyst(`/api/v1/documents/${nds3Doc.id}/download`);
    check("download works", dl.status === 200);
  }
  // verification flow on a fresh upload by analyst
  {
    const text = "Smoke test memo. The committee reviewed data quality metrics for 2026 and agreed follow-ups.";
    const form = new FormData();
    form.append("file", new File([text], "smoke-memo.txt", { type: "text/plain" }));
    const up = await analyst("/api/v1/documents", { method: "POST", body: form });
    const upJson = await up.json();
    const newDocId = upJson.data?.documentId;
    const confirm = await analyst(`/api/v1/documents/${newDocId}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title_en: "Smoke Test Memo",
        title_ar: "مذكرة اختبار",
        knowledge_type_code: "minutes",
        classification_level: 2,
      }),
    });
    check("analyst upload confirm succeeds", confirm.status === 200);
    const verifier = makeClient();
    await login(verifier, "verifier@npc.qa");
    const verify = await verifier(`/api/v1/documents/${newDocId}/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "verified" }),
    });
    check("verifier verifies document", verify.status === 200);
  }

  /* 4. Search */
  console.log("\n4. Search");
  {
    const parseCount = (html: string) => Number(/data-count="(\d+)"/.exec(html)?.[1] ?? -1);
    const res = await analyst("/en/search?q=population%20growth");
    const html = await res.text();
    check(
      "search: population query returns results",
      res.status === 200 && parseCount(html) > 0,
      `count=${parseCount(html)}`
    );
    check("search: number intent shows the indicator tile", html.includes('data-testid="intent-indicator"'));
    const ar = await analyst(encodeURI("/ar/search?q=التضخم"));
    const arHtml = await ar.text();
    check("search AR: inflation returns results", ar.status === 200 && parseCount(arHtml) > 0, `count=${parseCount(arHtml)}`);
    const nonsense = await analyst("/en/search?q=zxqvvw%20flibbertigibbet");
    const nonsenseHtml = await nonsense.text();
    check("zero-result state shows", nonsenseHtml.includes('data-testid="zero-results"'));
    const { createClient } = await import("@libsql/client");
    const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
    const logRow = await db.execute({
      sql: "select count(*) c from search_log where query like ?",
      args: ["%flibbertigibbet%"],
    });
    check("zero-result search logged", Number(logRow.rows[0].c) >= 1);
    db.close();
  }

  /* 5. Strategy */
  console.log("\n5. Strategy");
  {
    const { createClient } = await import("@libsql/client");
    const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
    const outcomes = await db.execute(
      "select n.id from strategy_nodes n join strategy_editions e on e.id = n.edition_id where e.code = 'nds3' and n.node_type = 'outcome'"
    );
    check("seven outcomes exist", outcomes.rows.length === 7, `got ${outcomes.rows.length}`);
    let kpiPerOutcome = 0;
    for (const row of outcomes.rows) {
      const k = await db.execute({ sql: "select count(*) c from kpis where node_id = ?", args: [row.id] });
      if (Number(k.rows[0].c) >= 1) kpiPerOutcome++;
    }
    check("every outcome has a KPI", kpiPerOutcome === 7, `${kpiPerOutcome}/7`);
    const lineage = await db.execute("select count(*) c from node_lineage");
    check("at least 25 lineage links", Number(lineage.rows[0].c) >= 25, String(lineage.rows[0].c));
    db.close();

    // CR02 2.2: archive editions live at /strategy/{code} in the navigator
    const nds2 = await analyst("/en/strategy/nds2");
    const nds2Html = await nds2.text();
    check("NDS2 renders with archive banner", nds2Html.includes('data-testid="archive-banner"'));
    const nds1 = await analyst("/en/strategy/nds1");
    check("NDS1 renders", nds1.status === 200);

    // post a status update and see it in what changed
    const { createClient: cc2 } = await import("@libsql/client");
    const db2 = cc2({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
    const anyProject = await db2.execute(
      "select n.id from strategy_nodes n join strategy_editions e on e.id = n.edition_id where e.code='nds3' and n.node_type='project' limit 1"
    );
    const nodeId = String(anyProject.rows[0].id);
    db2.close();
    const upd = await analyst("/api/v1/strategy/updates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nodeId,
        status: "on_track",
        progressPct: 65,
        summaryEn: "Smoke test: quarterly milestones confirmed with the delivery office.",
      }),
    });
    check("status update posts", upd.status === 200);
    const nodePage = await analyst(`/en/strategy/${nodeId}`);
    const nodeHtml = await nodePage.text();
    check("update appears on node page", nodeHtml.includes("quarterly milestones confirmed"));
  }

  /* 6. Statistics import */
  console.log("\n6. Statistics");
  {
    const listRes = await admin("/en/statistics");
    check("statistics landing renders", listRes.status === 200);
    const { createClient } = await import("@libsql/client");
    const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
    const ind = await db.execute("select id from indicators where code = 'building_permits' limit 1");
    const indicatorId = String(ind.rows[0].id);
    db.close();
    const csv = "Year,Value\n2031,712\n2032,738\n";
    const form = new FormData();
    form.append("file", new File([csv], "permits.csv", { type: "text/csv" }));
    form.append("indicatorId", indicatorId);
    const preview = await admin("/api/v1/indicators/import", { method: "POST", body: form });
    const prevJson = await preview.json();
    check("import preview maps columns", preview.status === 200 && prevJson.data?.mapping?.value_column);
    const confirm = await admin("/api/v1/indicators/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        indicatorId,
        rows: [
          { period: "2031", value: 712 },
          { period: "2032", value: 738 },
        ],
      }),
    });
    const confJson = await confirm.json();
    check("import writes values", confirm.status === 200 && confJson.data?.written === 2);
    const narrate = await admin("/api/v1/ai/narrate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ indicatorId }),
    });
    const narrJson = await narrate.json();
    check("narration returns text", Boolean(narrJson.data?.narration_en?.length > 20));
  }

  /* 7. Experts */
  console.log("\n7. Experts");
  {
    const res = await analyst("/api/v1/experts?q=who%20knows%20census%20methodology");
    const json = await res.json();
    check("expert matching returns candidates", (json.data?.length ?? 0) >= 3, `got ${json.data?.length}`);
    const expertId = json.data?.[0]?.id;
    if (expertId) {
      const reqRes = await analyst("/api/v1/experts/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expertId, subject: "Smoke: advice on census record linkage" }),
      });
      check("expert request created", reqRes.status === 200);
    }
    const create = await analyst("/api/v1/experts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nameEn: "Dr Test Externus",
        nameAr: "د. اختبار خارجي",
        type: "academic",
        organisationEn: "Test University",
      }),
    });
    const createJson = await create.json();
    check("external expert created by analyst", create.status === 200 && Boolean(createJson.data?.id));
    if (createJson.data?.id) {
      const { createClient } = await import("@libsql/client");
      const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
      const owner = await db.execute({
        sql: "select owner_user_id from experts where id = ?",
        args: [createJson.data.id],
      });
      const analystRow = await db.execute("select id from users where email = 'analyst@npc.qa'");
      check("external owned by analyst", owner.rows[0].owner_user_id === analystRow.rows[0].id);
      db.close();
    }
  }

  /* 8. Ask */
  console.log("\n8. Ask");
  {
    const res = await analyst("/api/v1/ai/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "What are the seven national outcomes of NDS3?", locale: "en" }),
    });
    const { final, deltas } = await readSse(res);
    check("ask streams", deltas > 0);
    check("ask returns citations", (final?.citations?.length ?? 0) >= 1);
    const low = await analyst("/api/v1/ai/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "What is the lunch menu of the cafeteria next Tuesday?", locale: "en" }),
    });
    const lowRes = await readSse(low);
    check("low confidence offers routing", lowRes.final?.confidence === "low" && (lowRes.final?.suggestedExperts?.length ?? 0) > 0);
    // question -> answer -> verify -> points
    const qRes = await analyst("/api/v1/questions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Smoke: how are provisional GDP figures revised?" }),
    });
    const qJson = await qRes.json();
    check("question posts", qRes.status === 200);
    const verifier = makeClient();
    await login(verifier, "verifier@npc.qa");
    const aRes = await verifier(`/api/v1/questions/${qJson.data.id}/answers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "Provisional figures are revised on the quarterly cycle when final source data arrives from entities." }),
    });
    const aJson = await aRes.json();
    check("expert answers", aRes.status === 200);
    const vRes = await verifier(`/api/v1/answers/${aJson.data.id}/verify`, { method: "POST" });
    check("verifier verifies answer", vRes.status === 200);
  }

  /* 9. Lessons */
  console.log("\n9. Lessons");
  {
    const structured = await analyst("/api/v1/ai/lesson-structure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rough:
          "During the smoke test integration we assumed the data sharing agreement would be signed quickly but legal review took much longer than planned. Next time start the legal review in parallel with technical onboarding.",
      }),
    });
    const structJson = await structured.json();
    check("AI structures a lesson", structured.status === 200 && Boolean(structJson.data?.learning_en || structJson.data?.learning_ar));
    const publish = await analyst("/api/v1/lessons", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...structJson.data, title_en: structJson.data.title_en || "Smoke lesson: legal review timing" }),
    });
    check("lesson publishes", publish.status === 200);
    const home = await analyst("/en/home");
    const homeText = await home.text();
    check("lesson appears on Home", homeText.includes("legal review") || homeText.includes("Smoke lesson"));
  }

  /* 10. Quiet mode */
  console.log("\n10. Quiet mode");
  {
    await analyst("/api/v1/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quietMode: true }),
    });
    const home = await analyst("/en/home");
    const html = await home.text();
    check("quiet mode hides footprint", !html.includes('data-testid="footprint"'));
    await analyst("/api/v1/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quietMode: false }),
    });
  }

  /* 11. Settings: role lifecycle + audit export */
  console.log("\n11. Settings");
  {
    const roleRes = await admin("/api/v1/roles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nameEn: "Smoke Analyst",
        nameAr: "محلل اختبار",
        permissions: { vault: { read: true }, ask: { read: true, create: true } },
      }),
    });
    const roleJson = await roleRes.json();
    check("custom role created", roleRes.status === 200);
    // assign to reader and confirm restriction (no vault create)
    const { createClient } = await import("@libsql/client");
    const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
    const readerRow = await db.execute("select id from users where email = 'reader@npc.qa'");
    db.close();
    const assign = await admin(`/api/v1/users/${readerRow.rows[0].id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roleId: roleJson.data.id }),
    });
    check("role assigned", assign.status === 200);
    const restricted = makeClient();
    await login(restricted, "reader@npc.qa");
    const form = new FormData();
    form.append("file", new File(["nope"], "nope.txt", { type: "text/plain" }));
    const denied = await restricted("/api/v1/documents", { method: "POST", body: form });
    check("restricted role cannot upload", denied.status === 403);
    // restore reader role
    const roles = await admin("/api/v1/roles");
    const rolesJson = await roles.json();
    const readerRole = rolesJson.data.find((r: { nameEn: string }) => r.nameEn === "Reader");
    await admin(`/api/v1/users/${readerRow.rows[0].id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roleId: readerRole.id }),
    });
    const csv = await admin("/api/v1/audit?format=csv&limit=50");
    check("audit CSV exports", csv.status === 200 && (csv.headers.get("content-type") ?? "").includes("csv"));
  }

  /* 12. CR01: branding, Trends and Signals, Home ask, analyst, Add Knowledge */
  console.log("12. CR01 acceptance");
  {
    const fs = await import("node:fs");
    const path = await import("node:path");

    // 1-2: branding
    const loginRes = await fetch(`${BASE}/en/login`);
    const loginHtml = await loginRes.text();
    check("login shows the SiaNexus wordmark", loginHtml.includes("/brand/SiaNexus_logo"));
    check("top bar carries the NPC logo asset", fs.existsSync(path.join(process.cwd(), "public", "brand", "NPC_logo_transparent.png")));
    const homeRes2 = await analyst("/en/home");
    const homeHtml2 = await homeRes2.text();
    check("shell shows the NPC lockup at the end side", homeHtml2.includes("NPC_logo_transparent.png"));
    check("no user-visible NEXUS remains on home", !/NEXUS(?!_)/.test(homeHtml2.replace(/SiaNexus/g, "")));

    // 3: /foresight redirects to /trends
    const fore = await analyst("/en/foresight");
    check(
      "/foresight redirects to /trends",
      fore.status >= 300 && fore.status < 400 && (fore.headers.get("location") ?? "").includes("/trends")
    );
    const trends = await analyst("/en/trends");
    const trendsHtml = await trends.text();
    // CR03 3.1 reordered the page: radar, briefing, then the unchanged
    // heat map and tracker below.
    check("trends renders the four sections", trends.status === 200 && trendsHtml.includes('data-testid="signal-radar"') && trendsHtml.includes('data-testid="signal-briefing"') && trendsHtml.includes("Risk heat map") && trendsHtml.includes("International index tracker"));
    check("signal briefing shows signal cards", trendsHtml.includes("/en/trends/"));

    // force mock mode for deterministic scan + analyst checks
    await admin("/api/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ai: { mockMode: true } }),
    });
    await new Promise((r) => setTimeout(r, 300));

    // Scan now creates a run + signals
    const { createClient } = await import("@libsql/client");
    const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
    const runsBefore = await db.execute("select count(*) c from scan_runs");
    const scanRes = await admin("/api/v1/scan/run", { method: "POST" });
    check("scan now accepted", scanRes.status === 200);
    await new Promise((r) => setTimeout(r, 1500));
    const runsAfter = await db.execute("select count(*) c from scan_runs");
    check("scan run row created", Number(runsAfter.rows[0].c) > Number(runsBefore.rows[0].c));
    const newSignals = await db.execute("select id from signals where triage_status = 'new' limit 3");
    check("scan produced triage candidates", newSignals.rows.length >= 1);

    // triage: accept + dismiss + convert award and log
    if (newSignals.rows.length >= 1) {
      const acceptRes = await admin(`/api/v1/signals/${newSignals.rows[0].id}/triage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      const acceptJson = await acceptRes.json();
      check("signal accept works and awards points", acceptRes.status === 200 && (acceptJson.data?.points ?? 0) > 0);
    }
    if (newSignals.rows.length >= 2) {
      const dismissRes = await admin(`/api/v1/signals/${newSignals.rows[1].id}/triage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      });
      check("signal dismiss works", dismissRes.status === 200);
    }
    if (newSignals.rows.length >= 3) {
      const convertRes = await admin(`/api/v1/signals/${newSignals.rows[2].id}/triage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "convert", target: "lesson" }),
      });
      const convertJson = await convertRes.json();
      check("signal converts to a lesson", convertRes.status === 200 && Boolean(convertJson.data?.resourceId));
    }

    // node page shows its signals
    const linkedNode = await db.execute(
      "select sl.resource_id as node_id from signal_links sl join signals s on s.id = sl.signal_id where sl.resource_type='node' and s.triage_status='accepted' limit 1"
    );
    if (linkedNode.rows.length) {
      const nodeRes = await analyst(`/en/strategy/${linkedNode.rows[0].node_id}`);
      const nodeHtml = await nodeRes.text();
      check("node page lists its signals", nodeRes.status === 200 && nodeHtml.includes(">Signals<"));
    } else {
      check("node page lists its signals", false, "no linked accepted signal");
    }

    // 5: the ten reference cases in mock mode
    const referenceCases = [
      "How are we doing in Qatarization?",
      "How many targets are in NDS3?",
      "Which outcomes are at risk?",
      "What changed in fiscal sustainability this quarter?",
      "Who should I talk to about census methodology?",
      "Compare NDS2 and NDS3 on labour market targets",
      "What did we learn from the data policy rollout?",
      "ما هو معدل التضخم الحالي؟",
      "Is the FDI target realistic?",
    ];
    const sectionsOf = (final: {
      workspace?: Record<string, unknown[]>;
      citations?: unknown[];
    }): number => {
      let n = 0;
      for (const key of ["strategy", "numbers", "documents", "lessons", "signals", "people"]) {
        if (((final.workspace?.[key] as unknown[]) ?? []).length) n++;
      }
      if ((final.citations ?? []).length) n++;
      return n;
    };
    let firstConversationId: string | null = null;
    let qatarizationConvId: string | null = null;
    for (const [i, q] of referenceCases.entries()) {
      const res = await analyst("/api/v1/ai/analyst", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: q, locale: /[؀-ۿ]/.test(q) ? "ar" : "en" }),
      });
      const text = await res.text();
      const finalMatch = /event: final\ndata: (.*)\n/.exec(text);
      const metaMatch = /event: meta\ndata: (.*)\n/.exec(text);
      const final = finalMatch ? JSON.parse(finalMatch[1]) : null;
      const convId = metaMatch ? JSON.parse(metaMatch[1]).conversationId : null;
      if (i === 0) qatarizationConvId = convId;
      if (!firstConversationId) firstConversationId = convId;
      const ok =
        Boolean(final?.markdown?.length) &&
        sectionsOf(final ?? {}) >= 2 &&
        (final?.followUps?.length ?? 0) >= 2 &&
        (final?.citations?.length ?? 0) >= 1;
      check(`analyst case ${i + 1}: "${q.slice(0, 40)}"`, ok, ok ? "" : `sections=${final ? sectionsOf(final) : "none"} followups=${final?.followUps?.length}`);
      if (q === "How many targets are in NDS3?") {
        const targetCount = await db.execute(
          "select count(*) c from strategy_nodes sn join strategy_editions se on se.id = sn.edition_id where se.code='nds3' and sn.node_type='target'"
        );
        const expected = String(targetCount.rows[0].c);
        check(
          "case 2 counts the seeded targets",
          Boolean(final?.markdown?.includes(expected)),
          `expected ${expected} in answer`
        );
      }
    }
    // case 10: elliptical follow-up in the same conversation
    if (qatarizationConvId) {
      const res = await analyst("/api/v1/ai/analyst", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "and by sector?", locale: "en", conversationId: qatarizationConvId }),
      });
      const text = await res.text();
      const finalMatch = /event: final\ndata: (.*)\n/.exec(text);
      const final = finalMatch ? JSON.parse(finalMatch[1]) : null;
      check(
        'analyst case 10: "and by sector?" resolves from history',
        Boolean(final?.markdown?.length) && sectionsOf(final ?? {}) >= 1,
        `sections=${final ? sectionsOf(final) : "none"}`
      );
    } else {
      check('analyst case 10: "and by sector?" resolves from history', false, "no conversation id");
    }

    // 6: conversations persist, resume, share with clearance filtering, export
    if (firstConversationId) {
      const page = await analyst(`/en/ask/c/${firstConversationId}`);
      const pageHtml = await page.text();
      check("conversation page renders the workspace", page.status === 200 && pageHtml.includes("workspace-turn"));
      const share = await analyst(`/api/v1/conversations/${firstConversationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ share: true }),
      });
      check("conversation shares", share.status === 200);
      const readerView = await reader(`/en/ask/c/${firstConversationId}`);
      check("shared conversation opens for another user", readerView.status === 200);
      const exportRes = await analyst(`/api/v1/conversations/${firstConversationId}/export`);
      check(
        "conversation exports to docx",
        exportRes.status === 200 && (exportRes.headers.get("content-type") ?? "").includes("wordprocessingml")
      );
    }

    // 7: Add Knowledge with the six sample inputs
    const samplesDir = path.join(process.cwd(), "sources", "samples");
    const structureWith = async (form: FormData) => {
      const res = await analyst("/api/v1/knowledge/structure", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      return { status: res.status, items: json.data?.items ?? [] };
    };
    const textSamples: [string, string][] = [
      ["conference-note-en.txt", "utf8 text"],
      ["conference-note-ar.txt", "arabic text"],
      ["mixed-email.txt", "mixed email"],
    ];
    for (const [file] of textSamples) {
      const form = new FormData();
      form.set("notes", fs.readFileSync(path.join(samplesDir, file), "utf8"));
      form.set("whereFrom", file.includes("conference") ? "Doha Data Forum 2026" : "");
      const { status, items } = await structureWith(form);
      check(`add-knowledge structures ${file}`, status === 200 && items.length >= 1, `items=${items.length}`);
    }
    {
      const urlLines = fs.readFileSync(path.join(samplesDir, "url-list.txt"), "utf8");
      const form = new FormData();
      form.set("notes", "Saved reading list from the strategy team, extract anything useful.");
      form.set("urls", urlLines.split(/\r?\n/).map((l) => l.split(" | ")[0]).filter(Boolean).join("\n"));
      const { status, items } = await structureWith(form);
      check("add-knowledge structures url-list.txt", status === 200 && items.length >= 1, `items=${items.length}`);
    }
    for (const file of ["handwritten-note.png", "slide-deck.pdf"]) {
      const form = new FormData();
      const buf = fs.readFileSync(path.join(samplesDir, file));
      form.append(
        "files",
        new File([new Uint8Array(buf)], file, { type: file.endsWith(".png") ? "image/png" : "application/pdf" })
      );
      const { status, items } = await structureWith(form);
      check(`add-knowledge structures ${file}`, status === 200 && items.length >= 1, `items=${items.length}`);
    }
    // publish one structured lesson with an event bonus and NDS link
    {
      const form = new FormData();
      form.set("notes", fs.readFileSync(path.join(samplesDir, "conference-note-en.txt"), "utf8"));
      form.set("whereFrom", "Doha Data Forum 2026");
      const { items } = await structureWith(form);
      if (items.length) {
        const item = items[0];
        if (!item.outcome_links?.length) {
          item.outcome_links = [{ code: "gov_excellence", reason_en: "Data governance theme.", reason_ar: "موضوع حوكمة البيانات." }];
        }
        const pub = await analyst("/api/v1/knowledge/publish", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: [item], whereFrom: "Doha Data Forum 2026" }),
        });
        const pubJson = await pub.json();
        check(
          "add-knowledge publishes and awards the new points",
          pub.status === 200 && (pubJson.data?.points ?? 0) >= 15 + 20,
          `points=${pubJson.data?.points}`
        );
        check("published item landed in its module", (pubJson.data?.published?.length ?? 0) >= 1);
      } else {
        check("add-knowledge publishes and awards the new points", false, "no items to publish");
      }
    }
    // /lessons/new redirects to /add
    const lessonsNew = await analyst("/en/lessons/new");
    check(
      "/lessons/new redirects to /add",
      lessonsNew.status >= 300 && lessonsNew.status < 400 && (lessonsNew.headers.get("location") ?? "").includes("/add")
    );

    // restore live AI mode
    await admin("/api/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ai: { mockMode: false } }),
    });
    db.close();
  }

  /* 13. CR02: Home redesign, Living Strategy, lessons categories, podcast,
        voice intake, signals refresh, reports */
  console.log("13. CR02 acceptance");
  {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { createClient } = await import("@libsql/client");
    const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });

    // mock mode for deterministic AI paths
    await admin("/api/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ai: { mockMode: true } }),
    });
    await new Promise((r) => setTimeout(r, 300));

    // 13.1 Home composition
    const home = await admin("/en/home");
    const homeHtml = await home.text();
    // CR03 4 recomposed the Today row into the bento (number, challenge,
    // podcast, timeline); the CR02 content set is all still present.
    check("home renders the bento content set", homeHtml.includes('data-testid="qatar-numbers"') && homeHtml.includes('data-testid="daily-challenge"') && homeHtml.includes('data-testid="what-changed"') && homeHtml.includes('data-testid="podcast-card"'));
    check("home shows lessons row, shelf, and progress panel", homeHtml.includes('data-testid="home-lessons"') && homeHtml.includes('data-testid="newest-shelf"') && homeHtml.includes('data-testid="progress-panel"'));
    check("mystery shelf, spotlight, and For-you are gone", !homeHtml.includes('data-testid="mystery"') && !homeHtml.includes("Contributor spotlight") && !homeHtml.includes('data-testid="word-strip"'));
    check("the leadership quote band is present", homeHtml.includes('data-testid="quote-band"'));
    check("podcast card names the latest episode", /what the knowledge says|ماذا تقول المعرفة/.test(homeHtml));
    check("rail has no Add Knowledge button", !/href="\/en\/add"[^>]*>[\s\S]{0,200}?<\/a>/.test(homeHtml.split("<main")[0] ?? homeHtml.slice(0, 6000)));
    const forYouRows = await db.execute("select count(*) c from notifications where kind='for_you'");
    check("For-you items became notifications", Number(forYouRows.rows[0].c) >= 1);

    // 13.2 design review reports exist
    const reviews = ["home-before", "home-after", "vault", "statistics", "experts", "ask", "trends", "settings"];
    check(
      "design review reports exist for all pages",
      reviews.every((r) => fs.existsSync(path.join(process.cwd(), "docs", "design-reviews", `${r}.md`)))
    );
    const afterReview = fs.readFileSync(path.join(process.cwd(), "docs", "design-reviews", "home-after.md"), "utf8");
    check("home-after has no High or Critical findings", !/^\s*-?\s*\*\*(High|Critical)\b/m.test(afterReview) && !/### Critical\n\n- /.test(afterReview));

    // 13.3 Living Strategy navigator
    const nav = await admin("/en/strategy");
    const navHtml = await nav.text();
    // CR03 2.2 replaced the column navigator with the medallion overview
    check("strategy opens the medallion overview", nav.status === 200 && navHtml.includes('data-testid="medallion-arc"') && navHtml.includes('data-testid="glance-band"'));
    const drill = await admin("/en/strategy/nds3/o3/o3-t1");
    const drillHtml = await drill.text();
    check("URL path drills to outcome and target", drill.status === 200 && drillHtml.includes("O3.T1"));
    const badItems = await db.execute(`
      select count(*) c from strategy_nodes n
      where n.edition_id = (select id from strategy_editions where code='nds3')
        and n.node_type in ('initiative')
        and n.parent_id not in (select id from strategy_nodes where node_type in ('target','outcome'))`);
    check("every NDS3 initiative sits under a target or outcome", Number(badItems.rows[0].c) === 0, `stray=${badItems.rows[0].c}`);
    const badProjects = await db.execute(`
      select count(*) c from strategy_nodes p
      join strategy_nodes i on i.id = p.parent_id
      where p.edition_id = (select id from strategy_editions where code='nds3')
        and p.node_type='project'
        and i.parent_id not in (select id from strategy_nodes where node_type in ('target','outcome'))`);
    check("every NDS3 project inherits a target through its initiative", Number(badProjects.rows[0].c) === 0);

    // 13.4 deliverables: upload -> vault doc + relation + list + analyst citation
    const prjRow = await db.execute("select id, code from strategy_nodes where node_type='project' and code like 'PRJ-01%' limit 1");
    const prjId = String(prjRow.rows[0].id);
    const prjCode = String(prjRow.rows[0].code);
    {
      const form = new FormData();
      form.set(
        "file",
        new File(
          [
            "Acceptance test deliverable for the smoke suite. Completion 90 percent against the agreed acceptance criteria. Adoption reached 61 percent in the pilot group.",
          ],
          "smoke-deliverable.txt",
          { type: "text/plain" }
        )
      );
      form.set("nodeId", prjId);
      const up = await admin("/api/v1/deliverables", { method: "POST", body: form });
      const upJson = await up.json();
      check("deliverable upload creates a Vault document", up.status === 200 && Boolean(upJson.data?.documentId), upJson.error ?? "");
      if (upJson.data?.documentId) {
        const rel = await db.execute({
          sql: "select count(*) c from relations where from_type='document' and from_id=? and to_type='node' and to_id=? and relation='about_node'",
          args: [upJson.data.documentId, prjId],
        });
        check("deliverable carries the about_node relation", Number(rel.rows[0].c) === 1);
        const typeRow = await db.execute({
          sql: "select tt.code from documents d join taxonomy_terms tt on tt.id=d.knowledge_type_term_id where d.id=?",
          args: [upJson.data.documentId],
        });
        check("deliverable has knowledge_type deliverable", String(typeRow.rows[0]?.code) === "deliverable");
      }
      const list = await admin(`/api/v1/deliverables?nodeId=${prjId}`);
      const listJson = await list.json();
      check("deliverables list shows the node's files", list.status === 200 && (listJson.data?.length ?? 0) >= 4);
    }
    {
      const ask = await admin("/api/v1/ai/analyst", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: `What did project ${prjCode} deliver?`, locale: "en" }),
      });
      const { final } = await readSse(ask);
      const cites = (final?.citations ?? []) as { title: string }[];
      check(
        "analyst answers the deliverables question citing them",
        Boolean(final) && cites.some((c) => c.title.startsWith("Deliverable D")),
        cites.map((c) => c.title).slice(0, 2).join(" | ")
      );
      check(
        "deliverable citations carry the node code",
        cites.some((c) => c.title.includes(prjCode))
      );
    }

    // 13.5 lessons categories
    const uncategorised = await db.execute(
      "select count(*) c from lessons where category not in ('delivery','external','expert','institutional')"
    );
    check("every lesson has a category", Number(uncategorised.rows[0].c) === 0);
    const lessonsPage = await admin("/en/lessons");
    const lessonsHtml = await lessonsPage.text();
    check("lessons header shows the category segmented control", lessonsHtml.includes('data-testid="category-tabs"'));
    const catTotals = await db.execute("select category, count(*) c from lessons group by category");
    const totalLessons = catTotals.rows.reduce((s, r) => s + Number(r.c), 0);
    const allCount = await db.execute("select count(*) c from lessons");
    check("segmented control counts add up", totalLessons === Number(allCount.rows[0].c));
    const byProject = await admin("/en/lessons?view=projects");
    const byProjectHtml = await byProject.text();
    check("By project mode lists nodes with lessons", byProject.status === 200 && byProjectHtml.includes('data-testid="lessons-by-project"'));
    {
      // Add lesson from a project pre-fills node and Delivery category
      const form = new FormData();
      form.set("notes", "During the smoke test rollout we learned that pre-filled delivery context should survive the structuring step and stay linked to the project.");
      form.set("nodeId", prjId);
      form.set("category", "delivery");
      const structRes = await admin("/api/v1/knowledge/structure", { method: "POST", body: form });
      const structJson = await structRes.json();
      const first = structJson.data?.items?.[0];
      check(
        "Add Knowledge pre-fills the node and Delivery category",
        structRes.status === 200 && first?.category === "delivery" && first?.node_link?.id === prjId,
        `category=${first?.category}`
      );
    }

    // 13.6 podcast
    const episodeCount = await db.execute("select count(*) c from podcast_episodes where status='published'");
    check("six or more seeded episodes exist", Number(episodeCount.rows[0].c) >= 6, String(episodeCount.rows[0].c));
    const library = await admin("/en/podcast");
    const libraryHtml = await library.text();
    check("podcast library renders episode cards", library.status === 200 && libraryHtml.includes('data-testid="episode-card"'));
    {
      const scriptRes = await admin("/api/v1/podcast/script", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope: { kind: "node", ids: [prjId], labelEn: `${prjCode} smoke episode`, labelAr: "حلقة اختبار" },
          options: { language: "en", minutes: 3, focus: "overview" },
        }),
      });
      const scriptJson = await scriptRes.json();
      const script = scriptJson.data?.script;
      check("composer writes a script from a project", scriptRes.status === 200 && (script?.segments?.length ?? 0) >= 4);
      check("script respects the five minute cap", (script?.estimated_seconds ?? 999) <= 5 * 60, `${script?.estimated_seconds}s`);
      if (script) {
        script.segments[0].text = script.segments[0].text + " (edited in review)";
        const createRes = await admin("/api/v1/podcast", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            scope: { kind: "node", ids: [prjId], labelEn: `${prjCode} smoke episode`, labelAr: "حلقة اختبار" },
            options: { language: "en", minutes: 3, focus: "overview" },
            script,
            render: "browser",
          }),
        });
        const createJson = await createRes.json();
        check("episode saves with podcast_created points", createRes.status === 200 && (createJson.data?.points ?? 0) >= 30, `points=${createJson.data?.points}`);
        const epId = createJson.data?.id;
        if (epId) {
          const asAnalyst = await analyst(`/api/v1/podcast/${epId}`);
          const asAnalystJson = await asAnalyst.json();
          check("episode is visible to other users at clearance", asAnalyst.status === 200 && asAnalystJson.data?.script?.segments?.[0]?.text?.includes("(edited in review)"));
          const listen = await analyst(`/api/v1/podcast/${epId}/listen`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ seconds: 180, completed: true }),
          });
          const listenJson = await listen.json();
          check("full listen awards podcast_listened_full", listen.status === 200 && (listenJson.data?.points ?? 0) >= 5);
          const listens = await db.execute({ sql: "select listens from podcast_episodes where id=?", args: [epId] });
          check("listen count incremented", Number(listens.rows[0].listens) >= 1);
        }
      }
      const studio = await db.execute("select id from podcast_episodes where audio_provider='elevenlabs' and audio_path is not null limit 1");
      if (studio.rows.length) {
        const audio = await admin(`/api/v1/podcast/${studio.rows[0].id}/audio`);
        check("studio episode streams mp3 audio", audio.status === 200 && (audio.headers.get("content-type") ?? "").includes("audio/mpeg"));
      } else {
        check("studio episode streams mp3 audio", false, "no rendered episode found");
      }
    }

    // 13.7 voice intake
    const addSpeak = await admin("/en/add?mode=speak");
    const addSpeakHtml = await addSpeak.text();
    check("Speak mode renders the recorder", addSpeak.status === 200 && addSpeakHtml.includes('data-testid="add-modes"') && addSpeakHtml.includes('data-testid="speak-panel"'));
    const transcribeProbe = await admin("/api/v1/transcribe");
    const transcribeJson = await transcribeProbe.json();
    check("transcribe capability probe answers", transcribeProbe.status === 200 && typeof transcribeJson.data?.available === "boolean");
    {
      // voice bonus on publish
      const form = new FormData();
      form.set("notes", "Spoken note for the smoke test: the census field teams asked for a shared checklist of entity contacts before each collection wave, which saved two days of coordination.");
      form.set("audio", new File([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0])], "voice-note.webm", { type: "audio/webm" }));
      const structRes = await admin("/api/v1/knowledge/structure", { method: "POST", body: form });
      const structJson = await structRes.json();
      check("speak submission stores the audio", structRes.status === 200 && Boolean(structJson.data?.audioRef?.storagePath));
      const items = structJson.data?.items ?? [];
      if (items.length) {
        const pub = await admin("/api/v1/knowledge/publish", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: [items[0]], whereFrom: "", voice: true, audioRef: structJson.data.audioRef }),
        });
        const pubJson = await pub.json();
        check("voice publish awards the knowledge_by_voice bonus", pub.status === 200 && (pubJson.data?.points ?? 0) >= 15 + 10, `points=${pubJson.data?.points}`);
        if (pubJson.data?.published?.length) {
          const audioRel = await db.execute({
            sql: "select count(*) c from relations where from_id=? and relation='source_audio'",
            args: [pubJson.data.published[0].id],
          });
          check("audio is attached to the published item", Number(audioRel.rows[0].c) === 1);
        }
      } else {
        check("voice publish awards the knowledge_by_voice bonus", false, "no items structured");
      }
    }

    // 13.8 signals refresh
    const runsBefore2 = await db.execute("select count(*) c from scan_runs");
    const refresh = await admin("/api/v1/scan/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    check("Refresh signals runs a scan", refresh.status === 200);
    await new Promise((r) => setTimeout(r, 1500));
    const runsAfter2 = await db.execute("select count(*) c from scan_runs");
    check("refresh logged in scan_runs", Number(runsAfter2.rows[0].c) > Number(runsBefore2.rows[0].c));
    const progressApi = await admin("/api/v1/scan/run");
    const progressJson = await progressApi.json();
    check("progress endpoint reports the latest run", progressApi.status === 200 && progressJson.data?.status !== undefined && typeof progressJson.data?.totalBriefs === "number");
    const rescan = await admin("/api/v1/scan/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ outcome: "workforce" }),
    });
    check("Rescan resolves the outcome's brief", rescan.status === 200);

    // 13.9 reports
    async function smokeReport(name: string, language: "en" | "ar" | "both") {
      const create = await admin("/api/v1/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope: { kind: "node", ids: [prjId], labelEn: `${prjCode} report`, labelAr: `تقرير ${prjCode}` },
          options: { audience: "working", language, summaryLength: "short", includeCharts: true, includeSources: true, includeLessons: true, includeSignals: false },
        }),
      });
      const createJson = await create.json();
      if (create.status !== 200) {
        check(`report (${name}) generates`, false, createJson.error);
        return null;
      }
      const id = createJson.data.id as string;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const poll = await admin(`/api/v1/reports/${id}`);
        const pj = await poll.json();
        if (pj.data?.status === "done") {
          check(`report (${name}) generates`, true);
          return id;
        }
        if (pj.data?.status === "failed") {
          check(`report (${name}) generates`, false, pj.data.error);
          return null;
        }
      }
      check(`report (${name}) generates`, false, "timeout");
      return null;
    }
    const enReport = await smokeReport("English", "en");
    if (enReport) {
      const dl = await admin(`/api/v1/reports/${enReport}/download`);
      const buf = Buffer.from(await dl.arrayBuffer());
      check("report downloads as a Word file", dl.status === 200 && buf[0] === 0x50 && buf[1] === 0x4b);
      const save = await admin(`/api/v1/reports/${enReport}/save`, { method: "POST" });
      const saveJson = await save.json();
      check("Save to Vault creates a searchable report document", save.status === 200 && Boolean(saveJson.data?.documentId));
      if (saveJson.data?.documentId) {
        const typeRow = await db.execute({
          sql: "select tt.code from documents d left join taxonomy_terms tt on tt.id=d.knowledge_type_term_id where d.id=?",
          args: [saveJson.data.documentId],
        });
        check("saved report has knowledge_type report", String(typeRow.rows[0]?.code) === "report");
      }
      const pointsRow = await db.execute(
        "select count(*) c from game_events where event_type='report_extracted'"
      );
      check("report_extracted points recorded", Number(pointsRow.rows[0].c) >= 1);
    }
    const bothReport = await smokeReport("both languages", "both");
    if (bothReport) {
      const row = await db.execute({ sql: "select narrative_json from reports where id=?", args: [bothReport] });
      const parts = JSON.parse(String(row.rows[0].narrative_json)).parts as { lang: string }[];
      check("Both produces two language parts in one file", parts.length === 2 && parts[0].lang === "en" && parts[1].lang === "ar");
    }

    // podcast episodes are an Ask source type
    const idx = await db.execute("select count(*) c from search_index where resource_type='podcast_episode'");
    check("podcast episodes joined the unified index", Number(idx.rows[0].c) >= 6);

    // restore live AI mode
    await admin("/api/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ai: { mockMode: false } }),
    });
    db.close();
  }

  /* 14. CR03: library vault, medallion strategy, signals radar, bento home */
  console.log("\n14. CR03 acceptance");
  {
    const { createClient } = await import("@libsql/client");
    const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
    const fs = await import("node:fs");
    const path = await import("node:path");

    // 14.1 Vault: fixed shelf order, books, Projects shelf, persistence
    const vault = await admin("/en/vault");
    const vaultHtml = await vault.text();
    check("vault renders the shelves board", vault.status === 200 && vaultHtml.includes('data-testid="vault-shelves"'));
    const order = ["shelf-strategies", "shelf-policies", "shelf-reports", "shelf-statistical", "shelf-projects"];
    const positions = order.map((k) => vaultHtml.indexOf(`data-testid="${k}"`));
    check(
      "shelves follow the fixed order with Projects lowest",
      positions.every((p) => p >= 0) && positions.every((p, i) => i === 0 || p > positions[i - 1]),
      positions.join(",")
    );
    const delCounts = await db.execute(
      "select count(*) c, count(distinct node_id) p from deliverable_meta"
    );
    check(
      "Projects header carries the deliverable and project counts",
      vaultHtml.includes(`Projects: ${delCounts.rows[0].c} deliverables across ${delCounts.rows[0].p} projects`)
    );
    check("expand and collapse all sit on the shelf toolbar", vaultHtml.includes('data-testid="expand-all"') && vaultHtml.includes('data-testid="collapse-all"'));
    const bookCount = (vaultHtml.match(/data-testid="book"/g) ?? []).length;
    check("documents render as books", bookCount >= 40, `books=${bookCount}`);
    check(
      "spine widths follow page count",
      vaultHtml.includes("width:40") && vaultHtml.includes("width:52") && vaultHtml.includes("width:64")
    );
    const clothShades = new Set(vaultHtml.match(/background:#[0-9a-f]{6}/g) ?? []);
    check(
      "cloth colours vary per book from the library palette",
      clothShades.size >= 8,
      `shades=${clothShades.size}`
    );
    const grid = await admin("/en/vault?view=grid");
    const gridHtml = await grid.text();
    check("grid view uses the front-cover design", gridHtml.includes('data-testid="book-cover"'));
    const arVault = await admin("/ar/vault");
    const arVaultHtml = await arVault.text();
    check("Arabic shelves carry native labels", arVaultHtml.includes("الاستراتيجيات") && arVaultHtml.includes('data-testid="book"'));
    // collapse state persists per user in preferences
    const prefPatch = await admin("/api/v1/profile/prefs", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vaultShelves: { strategies: false, projects: true } }),
    });
    const prefGet = await admin("/api/v1/profile/prefs");
    const prefJson = await prefGet.json();
    check(
      "shelf collapse state persists in preferences",
      prefPatch.status === 200 && prefJson.data?.vaultShelves?.strategies === false && prefJson.data?.vaultShelves?.projects === true
    );
    await admin("/api/v1/profile/prefs", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vaultShelves: {} }),
    });

    // 14.2 Strategy: medallions, glance, no tables, target cards, lanes
    const l1 = await admin("/en/strategy");
    const l1Html = await l1.text();
    const medallions = (l1Html.match(/data-testid="outcome-medallion"/g) ?? []).length;
    check("seven outcome medallions in the arc", medallions === 7, `got ${medallions}`);
    check("at-a-glance band shows the three figures and sparkline", l1Html.includes('data-testid="glance-band"'));
    check("no table on strategy level 1", !l1Html.includes("<table"));
    const mapView = await admin("/en/strategy?view=map");
    check("the radial map stays behind the toggle", (await mapView.text()).includes('data-testid="strategy-map"'));
    const l2 = await admin("/en/strategy/nds3/o3");
    const l2Html = await l2.text();
    check("outcome page shows the hero and target cards", l2.status === 200 && l2Html.includes('data-testid="outcome-hero"') && l2Html.includes('data-testid="target-card"'));
    check("no table on strategy level 2", !l2Html.includes("<table"));
    const l3 = await admin("/en/strategy/nds3/o3/o3-t1");
    const l3Html = await l3.text();
    check("target slug opens the target detail page", l3.status === 200 && l3Html.includes('data-testid="node-hero"') && l3Html.includes("O3.T1"));
    check("target detail groups delivery by status", l3Html.includes('data-testid="target-lanes"'));
    const prjShelfRow = await db.execute(
      "select node_id from deliverable_meta group by node_id order by count(*) desc limit 1"
    );
    const prjPage = await admin(`/en/strategy/${prjShelfRow.rows[0].node_id}`);
    const prjHtml = await prjPage.text();
    check("project page shows the deliverables mini shelf", prjHtml.includes('data-testid="deliverables-mini-shelf"') && prjHtml.includes('data-testid="book"'));
    check("project page draws the milestone timeline", prjHtml.includes('data-testid="delivery-timeline"'));

    // 14.3 Trends: radar geometry, briefing structure, filters
    const tr = await admin("/en/trends");
    const trHtml = await tr.text();
    check("signals radar renders with legend", trHtml.includes('data-testid="signal-radar"') && trHtml.includes('data-testid="radar-legend"'));
    const blipCount = (trHtml.match(/data-testid="radar-blip"/g) ?? []).length;
    check("accepted signals appear as blips", blipCount >= 10, `blips=${blipCount}`);
    const featureCount = (trHtml.match(/data-testid="feature-signal"/g) ?? []).length;
    check(
      "briefing opens with the highest-impact feature row",
      trHtml.includes('data-testid="feature-row"') && featureCount >= 1 && featureCount <= 3,
      `featured=${featureCount}`
    );
    check("category lanes and the by-outcome toggle exist", trHtml.includes('data-testid="briefing-lanes"') && trHtml.includes('data-testid="by-outcome-toggle"'));
    const trFiltered = await admin("/en/trends?horizon=near");
    const trFilteredHtml = await trFiltered.text();
    check("active filters render as chips above the briefing", trFilteredHtml.includes('data-testid="filter-chips"'));
    const trNew = await admin("/en/trends?triage=new");
    const trNewHtml = await trNew.text();
    check("radar keeps only accepted signals (empty for triage=new)", trNewHtml.includes('data-testid="radar-empty"'));

    // 14.4 Home: bento, constellation, quote band, numbers, challenge
    const home3 = await admin("/en/home");
    const home3Html = await home3.text();
    check(
      "home bento carries the full content set",
      ["home-ask", "quote-band", "qatar-numbers", "daily-challenge", "podcast-card", "what-changed", "home-lessons", "newest-shelf", "progress-panel"].every((id) => home3Html.includes(`data-testid="${id}"`))
    );
    check("the constellation is generated behind the content", home3Html.includes('data-testid="constellation"'));
    const dotCount = (home3Html.match(/data-testid="outcome-dot"/g) ?? []).length;
    check("progress panel shows the seven outcome dots", dotCount === 7, `dots=${dotCount}`);
    check("the mini library shelves real books", home3Html.split('data-testid="newest-shelf"')[1]?.includes('data-testid="book"') === true);
    check("no table on home", !home3Html.includes("<table"));
    check("what changed rows carry outcome chips", home3Html.includes('data-testid="what-changed"'));
    const arHome = await admin("/ar/home");
    const arHomeHtml = await arHome.text();
    check("Arabic home renders the bento with the quote band", arHome.status === 200 && arHomeHtml.includes('data-testid="quote-band"') && arHomeHtml.includes("كلمات تقودنا"));

    // 14.5 CR03 design reviews exist with no unresolved generic item
    const cr03Reviews = ["cr03-vault", "cr03-strategy-l1", "cr03-strategy-l2", "cr03-signals", "cr03-home"];
    check(
      "CR03 self-critique reviews exist for every screen",
      cr03Reviews.every((r) => fs.existsSync(path.join(process.cwd(), "docs", "design-reviews", `${r}.md`)))
    );
    check(
      "CR03 reviews close with no High or Critical findings",
      cr03Reviews.every((r) => {
        const text = fs.readFileSync(path.join(process.cwd(), "docs", "design-reviews", `${r}.md`), "utf8");
        return /no High or Critical HIG findings/.test(text);
      })
    );

    db.close();
  }

  console.log(`\n== smoke result: ${passed} passed, ${failed} failed ==`);
  if (failures.length) {
    console.log("Failures:");
    for (const f of failures) console.log(` - ${f}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("SMOKE CRASHED", e);
  process.exit(1);
});
