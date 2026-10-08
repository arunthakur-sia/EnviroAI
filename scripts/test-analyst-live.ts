/* eslint-disable no-console */
// CR01 acceptance 5, live half: runs the ten reference cases against the real
// model through the analyst API. Spends tokens; run against `npm run dev`.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

const CASES = [
  "How are we doing in Saudization?",
  "How many targets are in NES3?",
  "Which outcomes are at risk?",
  "What changed in fiscal sustainability this quarter?",
  "Who should I talk to about census methodology?",
  "Compare NES2 and NES3 on labour market targets",
  "What did we learn from the data policy rollout?",
  "ما هو معدل التضخم الحالي؟",
  "Is the FDI target realistic?",
];

type Jar = Map<string, string>;
function makeClient() {
  const jar: Jar = new Map();
  return async function req(path: string, opts: RequestInit = {}) {
    const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(BASE + path, {
      ...opts,
      headers: { ...((opts.headers as Record<string, string>) ?? {}), cookie },
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

function sectionsOf(final: { workspace?: Record<string, unknown[]>; citations?: unknown[] }): number {
  let n = 0;
  for (const key of ["strategy", "numbers", "documents", "lessons", "signals", "people"]) {
    if (((final.workspace?.[key] as unknown[]) ?? []).length) n++;
  }
  if ((final.citations ?? []).length) n++;
  return n;
}

async function main() {
  const client = makeClient();
  const login = await client("/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "analyst@enviroai.demo", password: "EnviroAI!2026" }),
  });
  if (login.status !== 200) throw new Error("login failed");

  let passed = 0;
  let failed = 0;
  let firstConv: string | null = null;
  for (const [i, q] of CASES.entries()) {
    const started = Date.now();
    const res = await client("/api/v1/ai/analyst", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: q, locale: /[؀-ۿ]/.test(q) ? "ar" : "en" }),
    });
    const text = await res.text();
    const finalMatch = /event: final\ndata: (.*)\n/.exec(text);
    const metaMatch = /event: meta\ndata: (.*)\n/.exec(text);
    const chips = (text.match(/event: chip/g) ?? []).length;
    const final = finalMatch ? JSON.parse(finalMatch[1]) : null;
    if (i === 0 && metaMatch) firstConv = JSON.parse(metaMatch[1]).conversationId;
    const secs = ((Date.now() - started) / 1000).toFixed(0);
    const ok =
      Boolean(final?.markdown?.length) &&
      sectionsOf(final ?? {}) >= 2 &&
      (final?.followUps?.length ?? 0) >= 2;
    if (ok) passed++;
    else failed++;
    console.log(
      `${ok ? "ok  " : "FAIL"} [${secs}s, ${chips} tool calls] case ${i + 1}: ${q.slice(0, 48)} | sections=${final ? sectionsOf(final) : 0} confidence=${final?.confidence} followups=${final?.followUps?.length ?? 0}`
    );
    if (final?.markdown) console.log(`      ${final.markdown.slice(0, 160).replace(/\n/g, " ")}`);
  }
  // case 10: follow-up resolution
  if (firstConv) {
    const res = await client("/api/v1/ai/analyst", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "and by sector?", locale: "en", conversationId: firstConv }),
    });
    const text = await res.text();
    const finalMatch = /event: final\ndata: (.*)\n/.exec(text);
    const final = finalMatch ? JSON.parse(finalMatch[1]) : null;
    const ok = Boolean(final?.markdown?.length);
    if (ok) passed++;
    else failed++;
    console.log(`${ok ? "ok  " : "FAIL"} case 10: and by sector? | ${final?.markdown?.slice(0, 140).replace(/\n/g, " ")}`);
  }
  console.log(`\n== analyst live: ${passed} passed, ${failed} failed ==`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error("CRASHED", e);
  process.exit(1);
});
