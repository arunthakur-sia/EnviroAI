// Brief me: one-page leadership brief on any resource. JSON by default,
// .docx export with ?format=docx.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq, and } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { generateBrief, type Brief } from "@/server/ai";
import { audit } from "@/server/auth/audit";
import { canReadResource } from "@/server/auth/permissions";

const Body = z.object({
  resourceType: z.enum(["document", "node", "indicator", "question", "expert", "signal"]),
  resourceId: z.string(),
  locale: z.string().default("en"),
  format: z.enum(["json", "docx"]).default("json"),
});

async function subjectFor(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  resourceType: string,
  resourceId: string
) {
  if (resourceType === "document") {
    const [d] = await db.select().from(schema.documents).where(eq(schema.documents.id, resourceId)).limit(1);
    if (!d || !canReadResource(user, { classificationLevel: d.classificationLevel, departmentId: d.departmentId }))
      return null;
    const chunks = await db
      .select({ text: schema.documentChunks.text })
      .from(schema.documentChunks)
      .where(eq(schema.documentChunks.documentId, d.id))
      .limit(6);
    return {
      titleEn: d.titleEn,
      titleAr: d.titleAr || d.titleEn,
      bodyEn: [d.summaryEn ?? "", ...chunks.map((c) => c.text)].join("\n\n"),
      bodyAr: d.summaryAr ?? "",
      numbers: [] as { label_en: string; label_ar: string; value: string }[],
    };
  }
  if (resourceType === "node") {
    const [n] = await db.select().from(schema.strategyNodes).where(eq(schema.strategyNodes.id, resourceId)).limit(1);
    if (!n) return null;
    const kpis = await db.select().from(schema.kpis).where(eq(schema.kpis.nodeId, n.id));
    const numbers: { label_en: string; label_ar: string; value: string }[] = [];
    for (const k of kpis.slice(0, 5)) {
      const [latest] = await db
        .select()
        .from(schema.kpiValues)
        .where(eq(schema.kpiValues.kpiId, k.id))
        .orderBy(desc(schema.kpiValues.period))
        .limit(1);
      numbers.push({
        label_en: k.nameEn,
        label_ar: k.nameAr,
        value: `${latest?.actualValue ?? "-"} ${k.unit ?? ""}${k.targetValue ? ` (target ${k.targetValue} by ${k.targetYear ?? 2030})` : ""}`,
      });
    }
    const updates = await db
      .select()
      .from(schema.statusUpdates)
      .where(eq(schema.statusUpdates.nodeId, n.id))
      .orderBy(desc(schema.statusUpdates.createdAt))
      .limit(3);
    return {
      titleEn: n.titleEn,
      titleAr: n.titleAr,
      bodyEn: [n.descriptionEn ?? "", ...updates.map((u) => `Update ${u.period ?? u.createdAt.slice(0, 10)} (${u.status}, ${u.progressPct}%): ${u.summaryEn ?? ""}`)].join("\n\n"),
      bodyAr: [n.descriptionAr ?? "", ...updates.map((u) => u.summaryAr ?? "")].join("\n\n"),
      numbers,
    };
  }
  if (resourceType === "signal") {
    const [s] = await db.select().from(schema.signals).where(eq(schema.signals.id, resourceId)).limit(1);
    if (!s) return null;
    return {
      titleEn: s.titleEn,
      titleAr: s.titleAr || s.titleEn,
      bodyEn: [
        s.descriptionEn ?? "",
        s.whyItMattersEn ? `Why it matters for NDS3: ${s.whyItMattersEn}` : "",
        s.publisher ? `Source: ${s.publisher}${s.publishedAt ? `, ${s.publishedAt}` : ""}${s.url ? ` (${s.url})` : ""}` : "",
        s.sourceExcerpt ? `Source excerpt: ${s.sourceExcerpt}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      bodyAr: [s.descriptionAr ?? "", s.whyItMattersAr ?? ""].filter(Boolean).join("\n\n"),
      numbers: [] as { label_en: string; label_ar: string; value: string }[],
    };
  }
  if (resourceType === "indicator") {
    const [ind] = await db.select().from(schema.indicators).where(eq(schema.indicators.id, resourceId)).limit(1);
    if (!ind || ind.classificationLevel > user.clearanceLevel) return null;
    const values = await db
      .select()
      .from(schema.indicatorValues)
      .where(and(eq(schema.indicatorValues.indicatorId, ind.id), eq(schema.indicatorValues.dimensionKey, "total")))
      .orderBy(desc(schema.indicatorValues.period))
      .limit(12);
    return {
      titleEn: ind.nameEn,
      titleAr: ind.nameAr,
      bodyEn: `${ind.definitionEn ?? ""}\n\nMethodology: ${ind.methodologyEn ?? ""}\n\nSeries: ${values.map((v) => `${v.period}: ${v.value}`).join("; ")}`,
      bodyAr: `${ind.definitionAr ?? ""}\n\n${ind.methodologyAr ?? ""}`,
      numbers: values.slice(0, 5).map((v) => ({
        label_en: v.period,
        label_ar: v.period,
        value: `${v.value} ${ind.unit ?? ""}`,
      })),
    };
  }
  if (resourceType === "question") {
    const [q] = await db.select().from(schema.questions).where(eq(schema.questions.id, resourceId)).limit(1);
    if (!q) return null;
    const answers = await db.select().from(schema.answers).where(eq(schema.answers.questionId, q.id));
    return {
      titleEn: q.titleEn,
      titleAr: q.titleAr,
      bodyEn: [q.bodyEn ?? "", ...answers.map((a) => a.bodyEn ?? "")].join("\n\n"),
      bodyAr: [q.bodyAr ?? "", ...answers.map((a) => a.bodyAr ?? "")].join("\n\n"),
      numbers: [],
    };
  }
  if (resourceType === "expert") {
    const [e] = await db.select().from(schema.experts).where(eq(schema.experts.id, resourceId)).limit(1);
    if (!e) return null;
    return {
      titleEn: e.nameEn,
      titleAr: e.nameAr,
      bodyEn: `${e.positionEn ?? ""} at ${e.organisationEn ?? ""}. ${e.bioEn ?? ""}`,
      bodyAr: `${e.positionAr ?? ""} في ${e.organisationAr ?? ""}. ${e.bioAr ?? ""}`,
      numbers: [],
    };
  }
  return null;
}

async function briefToDocx(brief: Brief): Promise<Buffer> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  const children = [
    new Paragraph({ text: brief.title_en, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: brief.title_ar }),
  ];
  for (const s of brief.sections) {
    children.push(new Paragraph({ text: s.heading_en, heading: HeadingLevel.HEADING_1 }));
    children.push(new Paragraph({ text: s.body_en }));
    children.push(new Paragraph({ text: s.heading_ar, heading: HeadingLevel.HEADING_2 }));
    children.push(
      new Paragraph({ children: [new TextRun({ text: s.body_ar, rightToLeft: true })] })
    );
  }
  if (brief.key_numbers.length) {
    children.push(new Paragraph({ text: "Key numbers", heading: HeadingLevel.HEADING_1 }));
    for (const n of brief.key_numbers) {
      children.push(new Paragraph({ text: `${n.label_en}: ${n.value}` }));
    }
  }
  if (brief.recommended_actions.length) {
    children.push(new Paragraph({ text: "Recommended actions", heading: HeadingLevel.HEADING_1 }));
    for (const a of brief.recommended_actions) {
      children.push(new Paragraph({ text: `- ${a.text_en}` }));
    }
  }
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const { resourceType, resourceId, format } = parsed.data;

  const subject = await subjectFor(user, resourceType, resourceId);
  if (!subject) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });

  const brief = await generateBrief(subject);
  await audit(user.id, "brief", resourceType, resourceId);

  if (format === "docx") {
    const buf = await briefToDocx(brief);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent("brief.docx")}`,
      },
    });
  }
  return NextResponse.json({ data: brief, error: null });
}
