// Appends one chunk of the bundle. The index is a query parameter and the body
// is the raw bytes, so there is no multipart parsing between the browser and
// the disk. Exists only while SETUP_TOKEN is set.
import { NextRequest, NextResponse } from "next/server";
import { appendChunk, checkToken, clientKeyOf, setupEnabled } from "@/server/setup";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!setupEnabled()) return new NextResponse(null, { status: 404 });
  const gate = checkToken(req.headers.get("x-setup-token"), clientKeyOf(req.headers));
  if (!gate.ok) {
    return NextResponse.json(
      { data: null, error: gate.reason, ...gate },
      { status: gate.reason === "locked" ? 429 : 401 }
    );
  }
  const index = Number.parseInt(req.nextUrl.searchParams.get("index") ?? "", 10);
  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json({ data: null, error: "bad_index" }, { status: 400 });
  }
  let body: Buffer;
  try {
    body = Buffer.from(await req.arrayBuffer());
  } catch {
    return NextResponse.json({ data: null, error: "body_unreadable" }, { status: 400 });
  }
  if (!body.length) return NextResponse.json({ data: null, error: "empty_chunk" }, { status: 400 });

  try {
    const result = await appendChunk(index, body);
    if (!result.ok) return NextResponse.json({ data: null, ...result }, { status: 409 });
    return NextResponse.json({ data: result, error: null });
  } catch (e) {
    return NextResponse.json(
      { data: null, error: "write_failed", detail: String((e as Error)?.message ?? e).slice(0, 200) },
      { status: 500 }
    );
  }
}
