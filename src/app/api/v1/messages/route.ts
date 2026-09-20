// CR08 9.2: the Inbox list (GET) and a new thread (POST). Threads answer only
// to their participants; the service enforces it.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { createThread, listThreads, MessagingError, type ListFilter } from "@/server/services/messaging";

const FILTERS: ListFilter[] = ["all", "unread", "done", "delegate", "mine"];

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const raw = sp.get("filter") ?? "all";
  const filter = (FILTERS as string[]).includes(raw) ? (raw as ListFilter) : "all";
  const rows = await listThreads(user, { filter, q: sp.get("q") ?? undefined });
  return NextResponse.json({ data: rows, error: null });
}

const Resource = z.object({
  type: z.string().min(1).max(40),
  id: z.string().min(1).max(120),
  titleEn: z.string().max(300).default(""),
  titleAr: z.string().max(300).default(""),
  link: z.string().max(500).default(""),
});

const Body = z.object({
  toUserId: z.string().min(1),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
  resource: Resource.nullable().optional(),
  attachments: z.array(z.object({ documentId: z.string().min(1) })).max(5).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  try {
    const result = await createThread(user, parsed.data);
    return NextResponse.json({ data: result, error: null });
  } catch (e) {
    if (e instanceof MessagingError) {
      return NextResponse.json({ data: null, error: e.code }, { status: e.status });
    }
    throw e;
  }
}
