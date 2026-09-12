// End-to-end report probe: node scope (EN) + lessons scope (both languages).
// Runs in mock mode so the narrative is extractive and free.
import fs from "node:fs";
const BASE = "http://localhost:3000";
const jar = new Map();
async function req(path, opts = {}) {
  const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { ...(opts.headers ?? {}), cookie },
    redirect: "manual",
  });
  for (const sc of res.headers.getSetCookie?.() ?? []) {
    const [pair] = sc.split(";");
    const [k, ...v] = pair.split("=");
    jar.set(k.trim(), v.join("="));
  }
  return res;
}
await req("/api/v1/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "admin@npc.qa", password: "Nexus!2026" }),
});
await req("/api/v1/settings", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ai: { mockMode: true } }),
});

// find a project id
import { createClient } from "@libsql/client";
const db = createClient({ url: "file:C:/npckms/data/nexus.db" });
const prj = (await db.execute("select id, code, title_en, title_ar from strategy_nodes where node_type='project' and code like 'PRJ-01%' limit 1")).rows[0];
db.close();

async function runReport(name, scope, options) {
  const res = await req("/api/v1/reports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scope, options }),
  });
  const json = await res.json();
  if (!res.ok) {
    console.log(name, "CREATE FAILED", json.error);
    return;
  }
  const id = json.data.id;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await req(`/api/v1/reports/${id}`);
    const pj = await poll.json();
    if (pj.data.status === "done") {
      console.log(name, "DONE:", pj.data.title, "| items:", pj.data.itemCount);
      const dl = await req(`/api/v1/reports/${id}/download`);
      const buf = Buffer.from(await dl.arrayBuffer());
      const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
      console.log(name, `download: ${buf.length} bytes, zip=${isZip}`);
      fs.writeFileSync(`C:/npckms/data/screenshots/cr02/probe-${name}.docx`, buf);
      const save = await req(`/api/v1/reports/${id}/save`, { method: "POST" });
      const sj = await save.json();
      console.log(name, "save-to-vault:", save.ok ? sj.data.documentId : sj.error);
      return;
    }
    if (pj.data.status === "failed") {
      console.log(name, "FAILED:", pj.data.error);
      return;
    }
  }
  console.log(name, "TIMEOUT");
}

await runReport(
  "node-en",
  { kind: "node", ids: [String(prj.id)], labelEn: `${prj.code} ${prj.title_en}`, labelAr: `${prj.code} ${prj.title_ar}` },
  { audience: "working", language: "en", summaryLength: "short", includeCharts: true, includeSources: true, includeLessons: true, includeSignals: false }
);
await runReport(
  "lessons-both",
  { kind: "lessons", ids: [], labelEn: "Lessons learned", labelAr: "الدروس المستفادة" },
  { audience: "leadership", language: "both", summaryLength: "full", includeCharts: false, includeSources: true, includeLessons: true, includeSignals: false }
);

await req("/api/v1/settings", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ai: { mockMode: false } }),
});
console.log("probe complete");
