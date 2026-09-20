/* eslint-disable no-console */
// CR08 6: quick server-side check of the login and the handover APIs.
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

async function main() {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "hr@npc.qa", password: "Nexus!2026" }),
  });
  const body = await res.text();
  console.log("login status", res.status, `${Date.now() - t0}ms`, body.slice(0, 300));
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
  console.log("cookie:", cookie ? cookie.slice(0, 30) + "..." : "NONE");
  if (!cookie) return;

  for (const path of ["/api/v1/handover", "/api/v1/handover?mine=1", "/api/v1/handover?candidates=1&q=tariq"]) {
    const t = Date.now();
    const r = await fetch(BASE + path, { headers: { cookie } });
    const text = await r.text();
    console.log(path, r.status, `${Date.now() - t}ms`, text.slice(0, 200));
  }
  const { db, schema } = await import("../../src/server/db/client");
  const { like } = await import("drizzle-orm");
  const rows = await db.select().from(schema.handovers).where(like(schema.handovers.notes, "[Illustrative] cr08-seed:%"));
  for (const h of rows) {
    const t = Date.now();
    const r = await fetch(`${BASE}/api/v1/handover/${h.id}`, { headers: { cookie } });
    const text = await r.text();
    console.log(`detail ${String(h.notes).slice(0, 34)}`, r.status, `${Date.now() - t}ms`, text.slice(0, 160));
  }
  // the recipient banner the Home page mounts (CR08 6.3)
  const recRes = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "mohammed.alsulaiti@npc.qa", password: "Nexus!2026" }),
  });
  const recCookie = (recRes.headers.get("set-cookie") ?? "").split(";")[0];
  for (const p of ["/en/home", "/ar/home", "/en/handover", "/ar/handover"]) {
    const r = await fetch(BASE + p, { headers: { cookie: recCookie }, redirect: "manual" });
    const html = r.status < 300 ? await r.text() : "";
    console.log("recipient", p, r.status, r.headers.get("location") ?? "", /data-testid="handover-banner"/.test(html) ? "banner present" : "no banner");
  }

  // the pages themselves
  for (const p of ["/en/hr/handovers", "/en/handover/mine", "/ar/hr/handovers"]) {
    const t = Date.now();
    const r = await fetch(BASE + p, { headers: { cookie } });
    const html = await r.text();
    console.log("page", p, r.status, `${Date.now() - t}ms`, html.length, /data-testid="(hr-handovers|my-handover)"/.test(html) ? "testid ok" : "NO TESTID");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
