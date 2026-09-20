// CR08 5.4: one module report. GET is the review payload (sections, comments,
// versions, what the caller may do); PATCH carries the review actions.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import {
  addSectionComment,
  approveReport,
  canUseReports,
  getModuleReport,
  publishReport,
  requestChanges,
  requestSectionRegeneration,
  SectionPatch,
  submitForReview,
  updateSection,
} from "@/server/services/reports";

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit_section"), code: z.string().min(1), patch: SectionPatch }),
  z.object({ action: z.literal("comment"), code: z.string().min(1), text: z.string().min(1).max(2000) }),
  z.object({ action: z.literal("regenerate_section"), code: z.string().min(1) }),
  z.object({ action: z.literal("submit") }),
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("publish") }),
  z.object({ action: z.literal("request_changes"), note: z.string().max(2000).optional() }),
]);

const STATUS_OF: Record<string, number> = {
  forbidden: 403,
  not_found: 404,
  invalid: 400,
  invalid_state: 409,
  locked: 409,
  busy: 409,
  docx_pending: 409,
  sections_failed: 409,
  file_missing: 404,
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!canUseReports(user)) return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  const detail = await getModuleReport(user, id);
  if (!detail) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });
  return NextResponse.json({ data: detail, error: null });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!canUseReports(user)) return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  const parsed = Action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const body = parsed.data;
  const result =
    body.action === "edit_section"
      ? await updateSection(user, id, body.code, body.patch)
      : body.action === "comment"
        ? await addSectionComment(user, id, body.code, body.text)
        : body.action === "regenerate_section"
          ? await requestSectionRegeneration(user, id, body.code)
          : body.action === "submit"
            ? await submitForReview(user, id)
            : body.action === "approve"
              ? await approveReport(user, id)
              : body.action === "publish"
                ? await publishReport(user, id)
                : await requestChanges(user, id, body.note);
  if (!result.ok) {
    return NextResponse.json({ data: null, error: result.error, detail: result.detail ?? null }, { status: STATUS_OF[result.error] ?? 400 });
  }
  const { ok: _ok, ...rest } = result;
  const detail = await getModuleReport(user, id);
  return NextResponse.json({ data: { ...rest, report: detail?.report ?? null, status: detail?.report.status ?? null }, error: null });
}
