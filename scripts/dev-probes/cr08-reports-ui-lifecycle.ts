/* eslint-disable no-console */
// CR08 5 (Reports UI agent): the lifecycle actions of the review screen
// driven through the module API (submit, approve, publish), with the status
// and the error envelope printed after each, so a refusal can be told from a
// slow dev server. Read only unless ACT=1.
//   REPORT=<id> npx tsx scripts/dev-probes/cr08-reports-ui-lifecycle.ts
//   REPORT=<id> ACT=1 npx tsx scripts/dev-probes/cr08-reports-ui-lifecycle.ts
import { createClient } from "@libsql/client";

const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";

async function main() {
  const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
  const login = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@npc.qa", password: "Nexus!2026" }),
  });
  const cookie = (login.headers.get("set-cookie") ?? "").split(",").map((s) => s.trim().split(";")[0]).find((s) => s.includes("=")) ?? "";

  const id =
    process.env.REPORT ??
    String((await db.execute("select id from reports where type_id is not null and status != 'published' order by created_at desc limit 1")).rows[0]?.id ?? "");
  if (!id) {
    console.log("no report");
    return;
  }
  const row = (await db.execute({ sql: "select status, docx_path, error, progress_json, version from reports where id = ?", args: [id] })).rows[0];
  console.log(`db: status=${row?.status} docx=${row?.docx_path ? "yes" : "no"} version=${row?.version} error=${row?.error ?? ""}`);
  const sections = (await db.execute({ sql: "select section_code, status, error from report_sections where report_id = ?", args: [id] })).rows;
  for (const s of sections) console.log(`  section ${s.section_code}: ${s.status}${s.error ? ` error=${s.error}` : ""}`);

  const detail = await (await fetch(`${BASE}/api/v1/report-builder/${id}`, { headers: { cookie } })).json();
  const d = detail?.data ?? {};
  console.log(`api: status=${d?.report?.status} canSubmit=${d.canSubmit} canApprove=${d.canApprove} canPublish=${d.canPublish} hasDocx=${d?.report?.hasDocx}`);

  if (process.env.ACT !== "1") return;
  for (const action of ["submit", "approve", "publish"]) {
    const t0 = Date.now();
    const res = await fetch(`${BASE}/api/v1/report-builder/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ action }),
    });
    const text = await res.text();
    console.log(`PATCH ${action}: ${res.status} in ${Date.now() - t0}ms  ${text.slice(0, 220)}`);
    if (!res.ok) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
