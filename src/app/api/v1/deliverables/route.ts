// CR02 2.3: deliverables API. GET ?nodeId= lists a node's deliverables;
// POST multipart (file, nodeId, milestone?, dueDate?) uploads one file as a
// deliverable Vault document.
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { createDeliverable, listDeliverables } from "@/server/services/deliverables";
import { isAllowedUpload } from "@/server/storage";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const nodeId = req.nextUrl.searchParams.get("nodeId");
  if (!nodeId) return NextResponse.json({ data: null, error: "node_required" }, { status: 400 });
  return NextResponse.json({ data: await listDeliverables(user, nodeId), error: null });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const nodeId = form?.get("nodeId");
  if (!form || !(file instanceof File) || typeof nodeId !== "string" || !nodeId) {
    return NextResponse.json({ data: null, error: "file_and_node_required" }, { status: 400 });
  }
  // CR08 Phase A: the same upload allowlist as Institutional Memory
  if (!isAllowedUpload(file.name)) {
    return NextResponse.json({ data: null, error: "file_type_not_allowed" }, { status: 415 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > 100 * 1024 * 1024) {
    return NextResponse.json({ data: null, error: "file_too_large" }, { status: 413 });
  }
  const milestone = form.get("milestone");
  const dueDate = form.get("dueDate");
  const res = await createDeliverable(user, {
    nodeId,
    filename: file.name,
    buffer: buf,
    mime: file.type || undefined,
    milestone: typeof milestone === "string" && milestone ? milestone : undefined,
    dueDate: typeof dueDate === "string" && dueDate ? dueDate : undefined,
  });
  if (!res.ok) {
    return NextResponse.json({ data: null, error: res.error }, { status: res.error === "forbidden" ? 403 : 400 });
  }
  return NextResponse.json({ data: res, error: null });
}
