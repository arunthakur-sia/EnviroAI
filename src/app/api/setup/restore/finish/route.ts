// Verifies the uploaded bundle against the size and digest the browser
// declared, then puts it where the boot script looks for it. A file that does
// not match its digest is discarded rather than left for the boot script to
// unpack over the volume. Exists only while SETUP_TOKEN is set.
import { NextRequest, NextResponse } from "next/server";
import { checkToken, clientKeyOf, finishUpload, setupEnabled } from "@/server/setup";

export const dynamic = "force-dynamic";
// hashing a 120 MB file takes a moment
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!setupEnabled()) return new NextResponse(null, { status: 404 });
  const gate = checkToken(req.headers.get("x-setup-token"), clientKeyOf(req.headers));
  if (!gate.ok) {
    return NextResponse.json(
      { data: null, error: gate.reason, ...gate },
      { status: gate.reason === "locked" ? 429 : 401 }
    );
  }
  try {
    const result = await finishUpload();
    if (!result.ok) return NextResponse.json({ data: null, ...result }, { status: 409 });
    return NextResponse.json({ data: result, error: null });
  } catch (e) {
    return NextResponse.json(
      { data: null, error: "finish_failed", detail: String((e as Error)?.message ?? e).slice(0, 200) },
      { status: 500 }
    );
  }
}
