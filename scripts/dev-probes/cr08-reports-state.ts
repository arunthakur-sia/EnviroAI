/* eslint-disable no-console */
// CR08 5: the state of the seeded module reports: status, docx, previews.
//   npx tsx scripts/dev-probes/cr08-reports-state.ts
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
  const rows = (await db.execute(
    "select r.id, t.code, r.status, r.version, r.docx_path, r.preview_images_json, r.published_document_id from reports r join report_types t on t.id = r.type_id order by t.sort"
  )).rows;
  for (const r of rows) {
    let previews: string[] = [];
    try {
      previews = JSON.parse(String(r.preview_images_json ?? "[]"));
    } catch {
      previews = [];
    }
    const docxOk = r.docx_path ? fs.existsSync(path.join(process.cwd(), "data", String(r.docx_path))) : false;
    const firstPreview = previews[0]
      ? path.isAbsolute(previews[0])
        ? previews[0]
        : previews[0].startsWith("data/")
          ? path.join(process.cwd(), previews[0])
          : path.join(process.cwd(), "data", previews[0])
      : null;
    const previewOk = firstPreview ? fs.existsSync(firstPreview) : false;
    console.log(`${String(r.code).padEnd(28)} ${String(r.status).padEnd(10)} v${r.version} docx=${docxOk ? "ok" : "missing"} previews=${previews.length}${previews.length ? (previewOk ? " (files ok)" : " (files missing)") : ""} doc=${r.published_document_id ? "yes" : "no"} sample=${previews[0] ?? ""}`);
  }
  const dir = path.join(process.cwd(), "data", "reports", "previews");
  console.log("previews dir:", fs.existsSync(dir) ? fs.readdirSync(dir).length + " entries" : "absent");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
