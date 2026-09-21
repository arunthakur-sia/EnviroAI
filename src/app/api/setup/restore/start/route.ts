// Begins a bundle upload, or reports where the last one stopped.
// Exists only while SETUP_TOKEN is set; 404 otherwise. See src/server/setup.ts.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { beginUpload, checkToken, clientKeyOf, setupEnabled } from "@/server/setup";

export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(1).max(200),
  size: z.number().int().positive().max(8 * 1024 * 1024 * 1024),
  sha256: z.string().regex(/^[0-9a-fA-F]{64}$/),
});

export async function POST(req: NextRequest) {
  if (!setupEnabled()) return new NextResponse(null, { status: 404 });
  const gate = checkToken(req.headers.get("x-setup-token"), clientKeyOf(req.headers));
  if (!gate.ok) {
    return NextResponse.json(
      { data: null, error: gate.reason, ...gate },
      { status: gate.reason === "locked" ? 429 : 401 }
    );
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid" }, { status: 400 });
  try {
    const state = await beginUpload(parsed.data);
    return NextResponse.json({ data: state, error: null });
  } catch (e) {
    return NextResponse.json(
      { data: null, error: "start_failed", detail: String((e as Error)?.message ?? e).slice(0, 200) },
      { status: 500 }
    );
  }
}
