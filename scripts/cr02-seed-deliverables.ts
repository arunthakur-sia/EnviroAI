/* eslint-disable no-console */
// CR02 2.3: seed 3 to 5 deliverables for at least 20 National Environment Strategy projects as real
// docx files with meaningful, deterministic bilingual content, so uploads,
// reading, citations, and the get_deliverables tool work in the demo.
// Idempotent via the cr02_deliverables_seeded setting. Callable from seed.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { eq, isNull, inArray, and } from "drizzle-orm";
import { ulid } from "ulid";

const TEMPLATES = [
  {
    code: "D1",
    titleEn: "Inception Report",
    titleAr: "تقرير التأسيس",
    milestone: "M1",
    focusEn: "scope, governance, and the delivery plan",
    focusAr: "النطاق والحوكمة وخطة التنفيذ",
    acceptance: "accepted",
  },
  {
    code: "D2",
    titleEn: "Requirements and Design Specification",
    titleAr: "وثيقة المتطلبات والتصميم",
    milestone: "M2",
    focusEn: "functional requirements and the target operating model",
    focusAr: "المتطلبات الوظيفية ونموذج التشغيل المستهدف",
    acceptance: "accepted",
  },
  {
    code: "D3",
    titleEn: "Pilot Evaluation Report",
    titleAr: "تقرير تقييم المرحلة التجريبية",
    milestone: "M3",
    focusEn: "pilot results, adoption figures, and corrective actions",
    focusAr: "نتائج التجربة وأرقام التبني والإجراءات التصحيحية",
    acceptance: "revised",
  },
  {
    code: "D4",
    titleEn: "Final Delivery Report",
    titleAr: "تقرير التسليم النهائي",
    milestone: "M4",
    focusEn: "delivered outputs against the agreed acceptance criteria",
    focusAr: "المخرجات المسلمة مقابل معايير القبول المتفق عليها",
    acceptance: "pending",
  },
  {
    code: "D5",
    titleEn: "Training and Handover Pack",
    titleAr: "حزمة التدريب والتسليم",
    milestone: "M5",
    focusEn: "operational handover, training materials, and support model",
    focusAr: "التسليم التشغيلي والمواد التدريبية ونموذج الدعم",
    acceptance: "pending",
  },
];

export async function seedDeliverablesCr02(): Promise<number> {
  const { db, schema } = await import("../src/server/db/client");
  const { put } = await import("../src/server/storage");
  const { parseDocument } = await import("../src/server/ingest/parse");
  const { chunkDocument } = await import("../src/server/ingest/chunker");
  const { embedTexts, float32ToBuffer } = await import("../src/server/ai/embeddings");
  const { ensureDeliverableTerm, nodeAncestry } = await import(
    "../src/server/services/deliverables"
  );
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");

  const [marker] = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "cr02_deliverables_seeded"))
    .limit(1);
  if (marker) {
    console.log("cr02 deliverables already seeded, skipping");
    return 0;
  }

  const [currentEdition] = await db
    .select()
    .from(schema.strategyEditions)
    .where(eq(schema.strategyEditions.code, "nes3"))
    .limit(1);
  if (!currentEdition) return 0;
  const projects = await db
    .select()
    .from(schema.strategyNodes)
    .where(
      and(
        eq(schema.strategyNodes.editionId, currentEdition.id),
        eq(schema.strategyNodes.nodeType, "project")
      )
    )
    .orderBy(schema.strategyNodes.sort);
  const chosen = projects.slice(0, 22);
  const [admin] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, "admin@enviroai.demo"))
    .limit(1);
  const termId = await ensureDeliverableTerm();
  const now = new Date().toISOString();
  let made = 0;

  for (let pi = 0; pi < chosen.length; pi++) {
    const project = chosen[pi];
    const { target, outcome } = await nodeAncestry(project.id);
    const count = 3 + (pi % 3); // 3..5
    for (let di = 0; di < count; di++) {
      const tpl = TEMPLATES[di];
      const year = 2025 + (di > 2 ? 1 : 0);
      const month = String(((pi + di * 3) % 12) + 1).padStart(2, "0");
      const due = `${year}-${month}-15`;
      const delivered = tpl.acceptance === "pending" && di === count - 1 ? null : `${year}-${month}-08`;

      const owner = project.ownerEntityName ?? "the delivery entity";
      const kickoff = `2024-${String(((pi + 2) % 12) + 1).padStart(2, "0")}-01`;
      const adoption = 40 + ((pi * 7 + di * 11) % 55);
      const completion = 55 + ((pi * 5 + di * 13) % 40);
      const titleEn = `${project.code ?? ""} ${tpl.titleEn}`.trim();
      const titleAr = `${tpl.titleAr} ${project.code ?? ""}`.trim();

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({ text: titleEn, heading: HeadingLevel.TITLE }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Deliverable ${tpl.code} of project ${project.code ?? project.titleEn}, milestone ${tpl.milestone}. Prepared for the Programme Office under ${outcome?.titleEn ?? "the National Environment Strategy"}.`,
                    italics: true,
                  }),
                ],
              }),
              new Paragraph({ text: "1. Context", heading: HeadingLevel.HEADING_1 }),
              new Paragraph(
                `${project.titleEn} is a delivery project under ${target ? `target ${target.code} (${target.titleEn})` : `outcome ${outcome?.code ?? ""}`}. ${project.descriptionEn ?? ""} The project started on ${project.startDate ?? kickoff} and is led by ${owner}.`
              ),
              new Paragraph({ text: "2. Purpose of this deliverable", heading: HeadingLevel.HEADING_1 }),
              new Paragraph(
                `This ${tpl.titleEn.toLowerCase()} covers ${tpl.focusEn}. It is deliverable ${tpl.code} against milestone ${tpl.milestone}, due ${due}.`
              ),
              new Paragraph({ text: "3. Key findings", heading: HeadingLevel.HEADING_1 }),
              new Paragraph(
                `1. Overall completion of the workstream stands at ${completion} percent as of the reporting date, ${completion >= 70 ? "ahead of" : "broadly in line with"} the delivery plan.`
              ),
              new Paragraph(
                `2. Adoption by the target entities reached ${adoption} percent, measured across the pilot group defined in the inception phase.`
              ),
              new Paragraph(
                `3. The main delivery risk is dependency on ${target ? `the data readiness required by ${target.code}` : "cross-entity data readiness"}; a mitigation owner has been assigned and the item is tracked in the project risk log.`
              ),
              new Paragraph({ text: "4. Recommendations", heading: HeadingLevel.HEADING_1 }),
              new Paragraph(
                `Sustain the current cadence of fortnightly delivery reviews, close the open acceptance items before milestone ${tpl.milestone === "M5" ? "closure" : "M" + (Number(tpl.milestone[1]) + 1)}, and record the lessons learned in EnviroAI so the next phase reuses them.`
              ),
              new Paragraph({ text: "٥. ملخص تنفيذي (عربي)", heading: HeadingLevel.HEADING_1 }),
              new Paragraph({
                bidirectional: true,
                children: [
                  new TextRun(
                    `يغطي هذا المستند (${titleAr}) ${tpl.focusAr}. بلغت نسبة الإنجاز ${completion} بالمئة، وبلغ التبني ${adoption} بالمئة ضمن المجموعة التجريبية. يوصى بمواصلة إيقاع المراجعات النصف شهرية وإغلاق بنود القبول المفتوحة وتسجيل الدروس المستفادة في سيا نكسس.`
                  ),
                ],
              }),
            ],
          },
        ],
      });
      const buf = Buffer.from(await Packer.toBuffer(doc));
      const filename = `${(project.code ?? "PRJ").replace(/[^\w-]/g, "")}_${tpl.code}_${tpl.titleEn.replace(/[^\w]+/g, "_")}.docx`;

      const documentId = ulid();
      const storagePath = await put(documentId, filename, buf);
      const parsed = await parseDocument(
        buf,
        filename,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      const versionId = ulid();
      const verified = tpl.acceptance !== "pending";
      await db.insert(schema.documents).values({
        id: documentId,
        titleEn,
        titleAr,
        titleArMachine: 0,
        summaryEn: `Deliverable ${tpl.code} of ${project.code ?? project.titleEn}: ${tpl.focusEn}. Completion ${completion} percent, adoption ${adoption} percent.`,
        summaryAr: `التسليم ${tpl.code} للمشروع ${project.code ?? ""}: ${tpl.focusAr}. الإنجاز ${completion} بالمئة والتبني ${adoption} بالمئة.`,
        summaryMachine: 0,
        keyFactsJson: JSON.stringify([
          { text_en: `Workstream completion ${completion} percent`, text_ar: `إنجاز مسار العمل ${completion} بالمئة`, page: 1 },
          { text_en: `Adoption ${adoption} percent in the pilot group`, text_ar: `تبنٍ بنسبة ${adoption} بالمئة في المجموعة التجريبية`, page: 1 },
        ]),
        knowledgeTypeTermId: termId,
        classificationLevel: 2,
        departmentId: admin?.departmentId ?? null,
        ownerUserId: project.ownerUserId ?? admin?.id ?? null,
        languageOriginal: "en",
        status: verified ? "verified" : "under_review",
        verifiedBy: verified ? admin?.id ?? null : null,
        verifiedAt: verified ? now : null,
        reviewDueAt: new Date(Date.now() + 365 * 86400000).toISOString(),
        sourceOrigin: "org",
        publishYear: year,
        originalFilename: filename,
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: buf.length,
        pageCount: parsed.pageCount,
        storagePath,
        textPath: null,
        currentVersionId: versionId,
        isSeeded: 1,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(schema.documentVersions).values({
        id: versionId,
        documentId,
        versionNo: 1,
        storagePath,
        uploadedBy: project.ownerUserId ?? admin?.id ?? null,
        createdAt: now,
      });
      for (const toId of [
        ...new Set([project.id, target?.id, outcome?.id].filter(Boolean) as string[]),
      ]) {
        await db.insert(schema.relations).values({
          id: ulid(),
          fromType: "document",
          fromId: documentId,
          toType: "node",
          toId,
          relation: "about_node",
          source: toId === project.id ? "human" : "inherited",
          createdAt: now,
        });
      }
      await db.insert(schema.deliverableMeta).values({
        id: ulid(),
        documentId,
        nodeId: project.id,
        deliverableCode: tpl.code,
        milestone: tpl.milestone,
        dueDate: due,
        deliveredDate: delivered,
        acceptanceStatus: tpl.acceptance,
        createdAt: now,
      });
      const chunks = chunkDocument(parsed).slice(0, 30);
      for (const c of chunks) {
        await db.insert(schema.documentChunks).values({
          id: ulid(),
          documentId,
          versionId,
          chunkIndex: c.index,
          pageFrom: c.pageFrom,
          pageTo: c.pageTo,
          heading: c.heading,
          text: c.text,
          lang: c.lang,
          tokenCount: c.tokenCount,
        });
      }
      made++;
    }
    console.log(`  ${project.code}: ${count} deliverables`);
  }

  // batch-embed the new chunks
  const pending = await db
    .select({ id: schema.documentChunks.id, text: schema.documentChunks.text })
    .from(schema.documentChunks)
    .where(isNull(schema.documentChunks.embedding));
  console.log(`  embedding ${pending.length} deliverable chunks...`);
  for (let i = 0; i < pending.length; i += 64) {
    const batch = pending.slice(i, i + 64);
    const { vectors, model } = await embedTexts(batch.map((b) => b.text));
    for (let j = 0; j < batch.length; j++) {
      await db
        .update(schema.documentChunks)
        .set({ embedding: float32ToBuffer(vectors[j]), embeddingModel: model })
        .where(eq(schema.documentChunks.id, batch[j].id));
    }
  }

  await db.insert(schema.settings).values({
    key: "cr02_deliverables_seeded",
    valueJson: JSON.stringify({ at: now, count: made }),
  });
  console.log(`cr02 deliverables seeded: ${made}`);
  return made;
}

const isMain = process.argv[1] && /cr02-seed-deliverables\.(ts|js|mjs)$/.test(process.argv[1]);
if (isMain) {
  seedDeliverablesCr02()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
