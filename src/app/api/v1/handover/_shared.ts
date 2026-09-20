// CR08 6: the error envelope every handover route shares.
import { NextResponse } from "next/server";
import { HandoverError } from "@/server/services/handover";

export function fail(e: unknown): NextResponse {
  if (e instanceof HandoverError) {
    return NextResponse.json({ data: e.extra ?? null, error: e.code }, { status: e.status });
  }
  console.error("[handover api]", (e as Error)?.message ?? e);
  return NextResponse.json({ data: null, error: "server_error" }, { status: 500 });
}

export const unauthorized = () => NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
export const forbidden = () => NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
export const notFound = () => NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
export const invalid = (detail?: unknown) => NextResponse.json({ data: detail ?? null, error: "invalid" }, { status: 400 });
