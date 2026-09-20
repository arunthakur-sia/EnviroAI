// CR08 10: the envelope helpers shared by the processes and operating-model routes.
import { NextResponse } from "next/server";
import { OpModelError } from "@/server/services/operating-model";

export function ok(data: unknown, status = 200) {
  return NextResponse.json({ data, error: null }, { status });
}

export function fail(error: string, status: number, detail?: Record<string, unknown>) {
  return NextResponse.json({ data: null, error, ...(detail ? { detail } : {}) }, { status });
}

/** Maps a service error onto the envelope; anything else is a 500 with a generic code. */
export function failFrom(e: unknown) {
  if (e instanceof OpModelError) return fail(e.code, e.status, e.detail);
  const message = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ data: null, error: "internal", detail: { message: message.slice(0, 200) } }, { status: 500 });
}

export async function readJson(req: Request): Promise<unknown> {
  return req.json().catch(() => null);
}
