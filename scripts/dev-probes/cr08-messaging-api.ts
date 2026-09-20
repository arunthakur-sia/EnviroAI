/* eslint-disable no-console */
// CR08 9 verification helper: calls the APIs the Section 9 screens use with a
// real session and prints status plus the first of the body, so a 500 seen in
// the browser can be named without driving a browser.
//   npx tsx scripts/dev-probes/cr08-messaging-api.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";

async function loginCookie(email: string): Promise<string> {
  const res = await fetch(BASE + "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Nexus!2026" }),
    redirect: "manual",
  });
  const jar = new Map<string, string>();
  for (const sc of (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []) {
    const [pair] = sc.split(";");
    const [k, ...v] = pair.split("=");
    jar.set(k.trim(), v.join("="));
  }
  if (!jar.size) throw new Error(`login failed for ${email}: ${res.status}`);
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function main() {
  const cookie = await loginCookie(process.env.WARM_EMAIL ?? "analyst@npc.qa");
  const { db, schema } = await import("../../src/server/db/client");
  const { eq } = await import("drizzle-orm");
  const [head] = await db.select().from(schema.users).where(eq(schema.users.email, "head.stats@npc.qa")).limit(1);
  const paths = [
    "/api/v1/profile/delegate",
    "/api/v1/people?q=al",
    "/api/v1/messages",
    "/api/v1/messages?filter=unread",
    "/api/v1/messages/cr08msg_thread_2",
    `/api/v1/people/${head?.id ?? ""}/card`,
    "/api/v1/notifications",
    "/api/v1/documents?q=strategy&limit=8",
    "/api/v1/profile/suggested-domains",
  ];
  for (const p of paths) {
    const t0 = Date.now();
    try {
      const res = await fetch(BASE + p, { headers: { cookie } });
      const body = await res.text();
      console.log(`${String(res.status).padEnd(4)} ${String(Date.now() - t0).padStart(7)}ms  ${p}`);
      if (res.status >= 400) console.log("      " + body.replace(/\s+/g, " ").slice(0, 500));
    } catch (e) {
      console.log(`ERR  ${String(Date.now() - t0).padStart(7)}ms  ${p}  ${String(e).slice(0, 200)}`);
    }
  }

  // the RSC payload router.refresh() asks for, three times each: the probe saw
  // a 404 and a 500 on these while the dev server was restarting, so check
  // whether they reproduce
  for (const p of ["/en/inbox?thread=cr08msg_thread_1", "/en/inbox?thread=cr08msg_thread_6", "/ar/inbox"]) {
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      const res = await fetch(BASE + p, { headers: { cookie, RSC: "1" } });
      const body = await res.text();
      console.log(`RSC ${String(res.status).padEnd(4)} ${String(Date.now() - t0).padStart(7)}ms  ${p}`);
      if (res.status >= 400) console.log("      " + body.replace(/\s+/g, " ").slice(0, 700));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
