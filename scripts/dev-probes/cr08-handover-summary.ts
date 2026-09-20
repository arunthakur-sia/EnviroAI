/* eslint-disable no-console */
// CR08 6: the final state summary quoted in the agent report.
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { db, schema } = await import("../../src/server/db/client");
  const { eq, like, inArray } = await import("drizzle-orm");
  const hs = await db.select().from(schema.handovers);
  const items = await db.select().from(schema.handoverItems);
  const ivs = await db.select().from(schema.handoverInterviews);
  const paths = await db.select().from(schema.handoverLearningPaths);
  console.log(`handovers ${hs.length} (${hs.filter((h) => h.personKind === "external").length} external, ${hs.filter((h) => h.status === "complete").length} closed, ${hs.filter((h) => h.cutOffAt).length} cut off)`);
  console.log(`items ${items.length}: person ${items.filter((i) => i.recipientKind === "person").length}, system ${items.filter((i) => i.recipientKind === "system").length}, undecided ${items.filter((i) => !i.recipientKind).length}, with notes ${items.filter((i) => (i.note ?? "").trim()).length}`);
  console.log(`filing: proposed ${items.filter((i) => i.filingStatus === "proposed").length}, approved ${items.filter((i) => i.filingStatus === "approved").length}, applied ${items.filter((i) => i.filingStatus === "applied").length}`);
  console.log(`interviews ${ivs.length} (${ivs.filter((i) => i.status === "complete").length} complete), insight lessons ${ivs.filter((i) => i.insightLessonId).length}`);
  for (const p of paths) {
    const mods = JSON.parse(p.modulesJson) as { understoodAt: string | null; episodeId: string | null }[];
    console.log(`path for ${p.recipientUserId}: ${mods.length} modules, ${mods.filter((m) => m.understoodAt).length} understood, ${mods.filter((m) => m.episodeId).length} with an episode, signed off ${p.signedOffAt ?? "no"}`);
  }
  const reportDocs = hs.map((h) => h.reportDocumentId).filter(Boolean) as string[];
  if (reportDocs.length) {
    const docs = await db.select().from(schema.documents).where(inArray(schema.documents.id, reportDocs));
    for (const d of docs) console.log(`report document: ${d.titleEn} | class ${d.classificationLevel} | ${d.sizeBytes} bytes | ${d.storagePath}`);
  }
  const dir = path.join(process.cwd(), "data", "reports", "handover");
  console.log("rendered docx:", fs.existsSync(dir) ? fs.readdirSync(dir).join(", ") : "none");
  const eps = await db.select().from(schema.podcastEpisodes).where(like(schema.podcastEpisodes.titleEn, "Handover:%"));
  console.log(`handover episodes: ${eps.length}`);
  const notes = await db.select().from(schema.notifications).where(like(schema.notifications.kind, "handover%"));
  console.log(`handover notifications: ${notes.length} (${[...new Set(notes.map((n) => n.kind))].join(", ")})`);
  const events = await db.select().from(schema.gameEvents).where(inArray(schema.gameEvents.eventType, ["learning_path_completed", "handover_completed", "handover_completed_owner", "knowledge_capture_bonus"]));
  console.log("points:", events.map((e) => `${e.eventType}=${e.points}`).join(", ") || "none");
  const risks = await db.select().from(schema.hrRisks).where(eq(schema.hrRisks.kind, "incomplete_handover"));
  console.log(`hr incomplete_handover risks: ${risks.length} (${risks.filter((r) => r.resourceType === "handover_gap").length} gap rows)`);
  const audits = await db.select().from(schema.auditLog).where(like(schema.auditLog.action, "handover%"));
  console.log(`audit rows: ${audits.length} (${[...new Set(audits.map((a) => a.action))].join(", ")})`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
