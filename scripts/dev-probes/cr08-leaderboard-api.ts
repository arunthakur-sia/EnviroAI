/* eslint-disable no-console */
// CR08 7: calls every board/window/category combination as the reader and
// prints status, row count and timing, to find a combination that fails.
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

async function loginCookie(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Nexus!2026" }),
    redirect: "manual",
  });
  const pairs: string[] = [];
  for (const sc of (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []) {
    pairs.push(sc.split(";")[0]);
  }
  return pairs.join("; ");
}

async function main() {
  const cookie = await loginCookie(process.argv[2] ?? "reader@npc.qa");
  for (const board of ["people", "departments"]) {
    for (const window of ["week", "month", "quarter", "year", "all"]) {
      for (const category of ["overall", "contributors", "guardians", "learners"]) {
        const t0 = Date.now();
        const res = await fetch(`${BASE}/api/v1/leaderboard?board=${board}&window=${window}&category=${category}`, {
          headers: { cookie },
        });
        const j = (await res.json().catch(() => null)) as { data?: { total?: number; people?: unknown[]; units?: unknown[]; mine?: unknown; scope?: string }; error?: string } | null;
        const d = j?.data;
        console.log(
          `${board.padEnd(11)} ${window.padEnd(7)} ${category.padEnd(12)} ${res.status} total=${d?.total ?? "?"} rows=${(board === "people" ? d?.people?.length : d?.units?.length) ?? "?"} mine=${d?.mine ? "yes" : "no"} ${Date.now() - t0}ms ${j?.error ?? ""}`
        );
      }
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
