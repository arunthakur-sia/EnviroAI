// Exports a conversation's answer workspace as a .docx brief.
import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { audit } from "@/server/auth/audit";
import type { Workspace, SourceRef } from "@/server/ai/analyst/tools";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const [conv] = await db
    .select()
    .from(schema.aiConversations)
    .where(eq(schema.aiConversations.id, id))
    .limit(1);
  if (!conv || (conv.userId !== user.id && conv.isShared !== 1)) {
    return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  }
  const messages = await db
    .select()
    .from(schema.aiMessages)
    .where(eq(schema.aiMessages.conversationId, id))
    .orderBy(asc(schema.aiMessages.createdAt));

  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  const children = [
    new Paragraph({ text: conv.title ?? "SiaNexus analyst conversation", heading: HeadingLevel.TITLE }),
    new Paragraph({ text: `Exported from SiaNexus, ${new Date().toISOString().slice(0, 10)}` }),
  ];
  for (const m of messages) {
    if (m.role === "user") {
      children.push(new Paragraph({ text: `Question: ${m.content}`, heading: HeadingLevel.HEADING_1 }));
      continue;
    }
    children.push(new Paragraph({ text: "Answer", heading: HeadingLevel.HEADING_2 }));
    for (const line of m.content.split("\n")) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, rightToLeft: /[؀-ۿ]/.test(line) })],
        })
      );
    }
    try {
      const ws = JSON.parse(m.workspaceJson ?? "{}") as {
        workspace?: Workspace;
      };
      const w = ws.workspace;
      if (w?.numbers?.length) {
        children.push(new Paragraph({ text: "Numbers", heading: HeadingLevel.HEADING_2 }));
        for (const n of w.numbers) {
          children.push(
            new Paragraph({
              text: `${n.nameEn}: ${n.latest?.value ?? "-"} ${n.unit ?? ""} (${n.latest?.period ?? "-"})${n.target ? `, target ${n.target.value} by ${n.target.year ?? "-"}` : ""}`,
            })
          );
        }
      }
      if (w?.strategy?.length) {
        children.push(new Paragraph({ text: "Strategy", heading: HeadingLevel.HEADING_2 }));
        for (const s of w.strategy) {
          children.push(
            new Paragraph({ text: `${s.editionCode.toUpperCase()} ${s.code ?? s.nodeType}: ${s.titleEn} (${s.status})` })
          );
        }
      }
    } catch {
      /* workspace is optional */
    }
    try {
      const citations = JSON.parse(m.citationsJson ?? "[]") as SourceRef[];
      if (citations.length) {
        children.push(new Paragraph({ text: "Sources", heading: HeadingLevel.HEADING_2 }));
        for (const c of citations) {
          children.push(new Paragraph({ text: `[${c.n}] ${c.title}${c.page ? `, p. ${c.page}` : ""}` }));
        }
      }
    } catch {
      /* citations optional */
    }
  }
  const doc = new Document({ sections: [{ children }] });
  const buf = await Packer.toBuffer(doc);
  await audit(user.id, "brief", "ai_conversation", id, { export: "docx" });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent("sianexus-answer.docx")}`,
    },
  });
}
