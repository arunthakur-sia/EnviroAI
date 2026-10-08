/* eslint-disable no-console */
// CR08 7: a reader must get the friendly 404 on /leaderboard/settings and
// a Super Admin the page; plain fetch, no browser.
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

async function cookieFor(email: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "EnviroAI!2026" }),
      redirect: "manual",
    });
    if (res.status === 200) {
      const pairs: string[] = [];
      for (const sc of (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []) {
        pairs.push(sc.split(";")[0]);
      }
      return pairs.join("; ");
    }
    console.log(`login ${email} attempt ${attempt + 1} -> ${res.status} ${(await res.text()).slice(0, 200)}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`login ${email} failed`);
}

async function main() {
  const reader = await cookieFor("reader@enviroai.demo");
  const admin = await cookieFor("admin@enviroai.demo");
  const r1 = await fetch(`${BASE}/en/leaderboard/settings`, { headers: { cookie: reader }, redirect: "manual" });
  console.log("reader /en/leaderboard/settings ->", r1.status);
  const r2 = await fetch(`${BASE}/en/leaderboard/settings`, { headers: { cookie: admin }, redirect: "manual" });
  console.log("admin  /en/leaderboard/settings ->", r2.status);
  const r3 = await fetch(`${BASE}/ar/leaderboard`, { headers: { cookie: reader }, redirect: "manual" });
  console.log("reader /ar/leaderboard ->", r3.status);
  process.exit(r1.status === 404 && r2.status === 200 && r3.status === 200 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
