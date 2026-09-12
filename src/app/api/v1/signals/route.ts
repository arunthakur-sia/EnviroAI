// GET: signal stream with filters. POST: manual submission (URL or pasted text).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { listSignals } from "@/server/services/signals";
import { extractSignalsFromText, fetchPageText } from "@/server/scan/manual";
import { audit } from "@/server/auth/audit";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const rows = await listSignals(user, {
    outcome: sp.get("outcome") ?? undefined,
    type: sp.get("type") ?? undefined,
    impact: sp.get("impact") ?? undefined,
    horizon: sp.get("horizon") ?? undefined,
    source: sp.get("source") ?? undefined,
    triage: sp.get("triage") ?? undefined,
    days: sp.get("days") ? Number(sp.get("days")) : undefined,
    q: sp.get("q") ?? undefined,
    nodeId: sp.get("nodeId") ?? undefined,
    indicatorId: sp.get("indicatorId") ?? undefined,
    riskId: sp.get("riskId") ?? undefined,
    rankingId: sp.get("rankingId") ?? undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
  });
  return NextResponse.json({ data: rows, error: null });
}

const Body = z.object({
  url: z.string().url().optional(),
  text: z.string().min(40).max(40000).optional(),
  title: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "create", "foresight")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.url && !parsed.data.text)) {
    return NextResponse.json({ data: null, error: "url_or_text_required" }, { status: 400 });
  }
  let text = parsed.data.text ?? "";
  let title = parsed.data.title ?? null;
  let publisher: string | null = null;
  if (parsed.data.url) {
    try {
      const page = await fetchPageText(parsed.data.url);
      text = text || page.text;
      title = title || page.title;
      publisher = new URL(parsed.data.url).hostname.replace(/^www\./, "");
    } catch (e) {
      if (!text) {
        return NextResponse.json(
          { data: null, error: "fetch_failed" },
          { status: 422 }
        );
      }
    }
  }
  const result = await extractSignalsFromText({
    text,
    url: parsed.data.url ?? null,
    title,
    publisher,
    userId: user.id,
  });
  await audit(user.id, "create", "signal", result.added[0], {
    manual: true,
    count: result.added.length,
  });
  return NextResponse.json({ data: result, error: null });
}
