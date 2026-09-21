/* eslint-disable no-console */
// With SETUP_TOKEN unset, the restore page and every one of its routes must be
// gone: 404, not 403, so the route does not even confirm it is there.
//   node scripts/dev-probes/setup-closed-check.mjs http://localhost:4000
const BASE = process.argv[2] ?? "http://localhost:4000";

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

const page = await fetch(`${BASE}/setup/restore`, { redirect: "manual" });
check("the restore page is gone", page.status === 404, `status ${page.status}`);

for (const route of ["start", "chunk", "finish"]) {
  const res = await fetch(`${BASE}/api/setup/restore/${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
    redirect: "manual",
  });
  check(`/api/setup/restore/${route} is gone`, res.status === 404, `status ${res.status}`);
}

const health = await fetch(`${BASE}/api/health`);
check("the health check still answers", health.status === 200, `status ${health.status}`);

const home = await fetch(`${BASE}/en/home`, { redirect: "manual" });
check("the app itself still serves", home.status === 200 || home.status === 307, `status ${home.status}`);

console.log(`\n== ${pass} passed, ${fail} failed ==`);
process.exit(fail ? 1 : 0);
