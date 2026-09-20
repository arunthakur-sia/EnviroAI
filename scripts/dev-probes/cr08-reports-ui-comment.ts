/* eslint-disable no-console */
// CR08 5 (Reports UI agent): the comment path end to end without a browser.
// Posts a section comment through the module API as the Super Admin and
// prints what the API answered and what the section row then holds, so a
// silent failure in the review screen can be told from a slow dev server.
//   REPORT=<id> npx tsx scripts/dev-probes/cr08-reports-ui-comment.ts
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
  console.log("login", login.status, cookie ? "cookie ok" : "no cookie");

  const id =
    process.env.REPORT ??
    String(
      (await db.execute("select id from reports where type_id is not null and status in ('draft','in_review') order by created_at desc limit 1")).rows[0]?.id ??
        (await db.execute("select id from reports where type_id is not null and status = 'published' order by created_at desc limit 1")).rows[0]?.id ??
        ""
    );
  if (!id) {
    console.log("no report to comment on");
    return;
  }
  const before = await fetch(`${BASE}/api/v1/report-builder/${id}`, { headers: { cookie } });
  const beforeJson = await before.json();
  const sections = (beforeJson?.data?.sections ?? []) as { code: string; comments: unknown[] }[];
  console.log(`report ${id} status=${beforeJson?.data?.report?.status} sections=${sections.length} canEdit=${beforeJson?.data?.canEdit}`);
  const code = sections[0]?.code;
  console.log(`first section ${code}, comments before: ${sections[0]?.comments?.length ?? 0}`);

  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/v1/report-builder/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ action: "comment", code, text: "Probe comment from cr08-reports-ui-comment." }),
  });
  const body = await res.text();
  console.log(`PATCH comment: ${res.status} in ${Date.now() - t0}ms\n  ${body.slice(0, 400)}`);

  const after = await fetch(`${BASE}/api/v1/report-builder/${id}`, { headers: { cookie } });
  const afterJson = await after.json();
  const afterSection = ((afterJson?.data?.sections ?? []) as { code: string; comments: unknown[] }[]).find((s) => s.code === code);
  console.log(`comments after: ${afterSection?.comments?.length ?? 0}`);

  const row = (await db.execute({ sql: "select comments_json from report_sections where report_id = ? and section_code = ?", args: [id, String(code)] })).rows[0];
  console.log("row comments_json:", String(row?.comments_json ?? "").slice(0, 300));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
