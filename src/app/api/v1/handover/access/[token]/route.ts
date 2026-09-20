// CR08 6.2: the external access link. The token is the authentication: it
// resolves to one handover, until the last working day, until revoked, and
// until the cut-off. GET the minimal workspace; POST adds items (JSON text
// or multipart upload) and drives the optional interview.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  addItemViaToken,
  answerInterview,
  completeInterview,
  getTokenWorkspace,
  resolveAccessToken,
  setItemNote,
  startInterview,
} from "@/server/services/handover";
import { fail, invalid } from "../../_shared";

/* This handler reads no cookies and no headers, so Next would happily serve
   it from the route cache: an expired or revoked token would keep returning
   the workspace it answered with the first time. Every request re-checks the
   token against the row. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const expired = () => NextResponse.json({ data: null, error: "token_invalid" }, { status: 403 });

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    const workspace = await getTokenWorkspace(token);
    if (!workspace) return expired();
    return NextResponse.json({ data: workspace, error: null });
  } catch (e) {
    return fail(e);
  }
}

const JsonBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add_text"), title: z.string().min(2).max(180), text: z.string().max(20000).default(""), note: z.string().max(2000).nullable().optional() }),
  z.object({ action: z.literal("note"), itemId: z.string().min(1), note: z.string().max(2000) }),
  z.object({ action: z.literal("interview_start"), topic: z.string().min(2).max(160), refType: z.enum(["node", "council_node", "topic", "general"]).optional(), refId: z.string().nullable().optional() }),
  z.object({ action: z.literal("interview_answer"), interviewId: z.string().min(1), text: z.string().min(1).max(4000) }),
  z.object({ action: z.literal("interview_complete"), interviewId: z.string().min(1) }),
]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    const h = await resolveAccessToken(token);
    if (!h) return expired();
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData().catch(() => null);
      if (!form) return invalid();
      const file = form.get("file");
      const title = String(form.get("title") ?? "").trim();
      const note = String(form.get("note") ?? "").trim() || null;
      if (!(file instanceof File) || !title) return invalid();
      const buf = Buffer.from(await file.arrayBuffer());
      if (!buf.length || buf.length > 40 * 1024 * 1024) return invalid();
      const items = await addItemViaToken(token, { title, note, file: { name: file.name || "upload.bin", mime: file.type || "application/octet-stream", data: buf } });
      return NextResponse.json({ data: items, error: null });
    }
    const parsed = JsonBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return invalid(parsed.error.flatten());
    const b = parsed.data;
    const actor = { userId: null, token: true };
    switch (b.action) {
      case "add_text":
        return NextResponse.json({ data: await addItemViaToken(token, { title: b.title, note: b.note ?? null, text: b.text }), error: null });
      case "note": {
        const ws = await getTokenWorkspace(token);
        if (!ws?.items.some((i) => i.id === b.itemId)) return invalid();
        return NextResponse.json({ data: await setItemNote({ userId: null, admin: false }, b.itemId, b.note), error: null });
      }
      case "interview_start":
        return NextResponse.json({ data: await startInterview(actor, h.id, { topic: b.topic, refType: b.refType, refId: b.refId ?? null }), error: null });
      case "interview_answer": {
        const ws = await getTokenWorkspace(token);
        if (!ws?.interviews.some((i) => i.id === b.interviewId)) return invalid();
        return NextResponse.json({ data: await answerInterview(actor, b.interviewId, b.text), error: null });
      }
      case "interview_complete": {
        const ws = await getTokenWorkspace(token);
        if (!ws?.interviews.some((i) => i.id === b.interviewId)) return invalid();
        return NextResponse.json({ data: await completeInterview(actor, b.interviewId), error: null });
      }
      default:
        return invalid();
    }
  } catch (e) {
    return fail(e);
  }
}
