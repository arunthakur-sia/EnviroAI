/* eslint-disable no-console */
// CR08 5: builds one report of every nominated type synchronously with the
// mock writer (forceMock, so the AI settings are untouched), prints the
// per-section status and block counts, asserts that no section failed and
// that every text in every block is bilingual, checks the docx files when
// the template renders, then deletes the probe reports (pass --keep to
// leave them in the gallery).
//   npx tsx scripts/dev-probes/cr08-reports-run.ts [--keep]
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

import fs from "node:fs/promises";
import path from "node:path";
import type { Block, SectionContent } from "../../src/server/reports/spec";

type Problem = string;

function isBi(x: unknown): x is { en: string; ar: string } {
  return Boolean(x) && typeof (x as { en?: unknown }).en === "string" && typeof (x as { ar?: unknown }).ar === "string";
}
function biOk(x: unknown): boolean {
  return isBi(x) && x.en.trim().length > 0 && x.ar.trim().length > 0;
}

/** Every BiText a block carries must have both languages filled. */
function checkBlock(code: string, b: Block, i: number, problems: Problem[]): void {
  const where = `${code}#${i} ${b.kind}`;
  const need = (x: unknown, what: string) => {
    if (!biOk(x)) problems.push(`${where}: ${what} is not bilingual`);
  };
  switch (b.kind) {
    case "heading":
    case "paragraph":
    case "quote":
      need(b.text, "text");
      break;
    case "callout":
      need(b.text, "text");
      break;
    case "keyFigure":
      need(b.label, "label");
      break;
    case "bullets":
    case "numbered":
      b.items.forEach((it, k) => need(it, `item ${k}`));
      if (!b.items.length) problems.push(`${where}: empty list`);
      break;
    case "kpis":
      b.items.forEach((t, k) => need(t.label, `tile ${k} label`));
      break;
    case "table":
      b.columns.forEach((c, k) => need(c, `column ${k}`));
      b.rows.forEach((r, ri) => r.forEach((c, ci) => { if (!isBi(c)) problems.push(`${where}: cell ${ri},${ci} is not BiText`); }));
      break;
    case "scorecard":
      b.columns.forEach((c, k) => need(c, `column ${k}`));
      b.rows.forEach((r, k) => need(r.label, `row ${k} label`));
      break;
    case "chart":
      need(b.chart.title, "chart title");
      b.chart.series.forEach((s, k) => need(s.name, `series ${k} name`));
      break;
    case "figure":
      need(b.caption, "caption");
      break;
    default:
      break;
  }
}

function countText(blocks: Block[]): { paragraphs: number; tables: number; charts: number; kpis: number; lists: number } {
  return {
    paragraphs: blocks.filter((b) => b.kind === "paragraph").length,
    tables: blocks.filter((b) => b.kind === "table" || b.kind === "scorecard").length,
    charts: blocks.filter((b) => b.kind === "chart").length,
    kpis: blocks.filter((b) => b.kind === "kpis").length,
    lists: blocks.filter((b) => b.kind === "bullets" || b.kind === "numbered").length,
  };
}

async function main() {
  const keep = process.argv.includes("--keep");
  const { db, schema } = await import("../../src/server/db/client");
  const { and, eq, inArray, like } = await import("drizzle-orm");
  const { getUserById } = await import("../../src/server/auth/session");
  const { REPORT_TYPES } = await import("../../src/server/reports/types");
  const { createReportRequest } = await import("../../src/server/services/reports");
  const { runReportBuild } = await import("../../src/server/reports/build");
  const { upsertReportTypes, exampleScopeFor, examplePeriodFor } = await import("../cr08-reports-seed");

  await upsertReportTypes();
  const [adminRow] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, "admin@enviroai.demo")).limit(1);
  const admin = adminRow ? await getUserById(adminRow.id) : null;
  if (!admin) throw new Error("admin@enviroai.demo missing");

  const problems: Problem[] = [];
  const created: string[] = [];
  let docxSeen = 0;
  for (const spec of REPORT_TYPES.filter((t) => t.family !== "custom")) {
    const res = await createReportRequest(admin, { typeCode: spec.code, period: examplePeriodFor(spec.cadence), scope: await exampleScopeFor(spec.scopeKind), languageMode: "both" });
    if (!res.ok) {
      problems.push(`${spec.code}: request refused (${res.error} ${res.detail ?? ""})`);
      continue;
    }
    created.push(res.id);
    const t0 = Date.now();
    await runReportBuild(res.id, { forceMock: true });
    const ms = Date.now() - t0;
    const [row] = await db.select().from(schema.reports).where(eq(schema.reports.id, res.id)).limit(1);
    const sections = await db.select().from(schema.reportSections).where(eq(schema.reportSections.reportId, res.id)).orderBy(schema.reportSections.sort);
    console.log(`\n== ${spec.code}: "${res.titleEn}" status=${row?.status} ${ms}ms docx=${row?.docxPath ?? "pending"} sections=${sections.length}`);
    if (row?.status !== "draft") problems.push(`${spec.code}: report status is ${row?.status} (${row?.error ?? ""})`);
    for (const s of sections) {
      let content: SectionContent | null = null;
      try {
        content = s.contentJson ? (JSON.parse(s.contentJson) as SectionContent) : null;
      } catch {
        content = null;
      }
      const counts = content ? countText(content.blocks) : null;
      console.log(`   ${s.status.padEnd(9)} ${s.sectionCode.padEnd(24)} blocks=${content?.blocks.length ?? 0} p=${counts?.paragraphs ?? 0} tbl=${counts?.tables ?? 0} chart=${counts?.charts ?? 0} kpi=${counts?.kpis ?? 0} list=${counts?.lists ?? 0} sources=${content?.sources?.length ?? 0}${content?.needsEditing ? " needsEditing" : ""}${s.error ? ` error=${s.error.slice(0, 80)}` : ""}`);
      if (s.status === "failed") problems.push(`${spec.code}/${s.sectionCode}: failed (${s.error ?? ""})`);
      if (!content) {
        problems.push(`${spec.code}/${s.sectionCode}: no content`);
        continue;
      }
      if (!biOk(content.title)) problems.push(`${spec.code}/${s.sectionCode}: title not bilingual`);
      if (content.lead && !biOk(content.lead)) problems.push(`${spec.code}/${s.sectionCode}: lead not bilingual`);
      content.blocks.forEach((b, i) => checkBlock(`${spec.code}/${s.sectionCode}`, b, i, problems));
      const dashes = JSON.stringify(content).match(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`, "g"));
      if (dashes) problems.push(`${spec.code}/${s.sectionCode}: ${dashes.length} em or en dashes in content`);
    }
    if (row?.docxPath) {
      for (const lang of ["en", "ar"]) {
        const p = path.join(process.cwd(), "data", "reports", "module", `${res.id}-${lang}.docx`);
        try {
          const st = await fs.stat(p);
          docxSeen += 1;
          console.log(`   docx ${lang}: ${st.size} bytes`);
        } catch {
          problems.push(`${spec.code}: docx ${lang} missing at ${p}`);
        }
      }
    }
  }

  console.log(`\n${created.length} reports built, ${docxSeen} docx files seen, ${problems.length} problems`);
  for (const p of problems) console.log(`  PROBLEM ${p}`);

  if (!keep && created.length) {
    await db.delete(schema.reportSections).where(inArray(schema.reportSections.reportId, created));
    await db.delete(schema.reportVersions).where(inArray(schema.reportVersions.reportId, created));
    await db.delete(schema.reports).where(inArray(schema.reports.id, created));
    for (const id of created) {
      await db.delete(schema.notifications).where(and(eq(schema.notifications.userId, admin.id), like(schema.notifications.link, `/reports/${id}%`)));
      for (const lang of ["en", "ar"]) {
        await fs.rm(path.join(process.cwd(), "data", "reports", "module", `${id}-${lang}.docx`), { force: true });
      }
    }
    console.log("probe reports removed");
  }
  process.exit(problems.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
