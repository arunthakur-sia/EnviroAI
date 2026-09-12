// CR02 7: creates a report row and queues generation.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { newId, nowIso } from "@/lib/ids";
import { enqueue } from "@/server/jobs/queue";
import { audit } from "@/server/auth/audit";

const Body = z.object({
  scope: z.object({
    kind: z.enum(["signals", "lessons", "vault", "node", "ask", "podcast", "collection"]),
    ids: z.array(z.string()).default([]),
    labelEn: z.string(),
    labelAr: z.string().default(""),
    filters: z.record(z.string()).optional(),
  }),
  options: z.object({
    audience: z.enum(["leadership", "working"]).default("working"),
    language: z.enum(["en", "ar", "both"]).default("en"),
    summaryLength: z.enum(["short", "full"]).default("short"),
    includeCharts: z.boolean().default(true),
    includeSources: z.boolean().default(true),
    includeLessons: z.boolean().default(true),
    includeSignals: z.boolean().default(false),
    dateFrom: z.string().nullable().optional(),
    dateTo: z.string().nullable().optional(),
  }),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "read", "vault")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  }
  const id = newId();
  await db.insert(schema.reports).values({
    id,
    title: parsed.data.scope.labelEn,
    scopeJson: JSON.stringify(parsed.data.scope),
    optionsJson: JSON.stringify(parsed.data.options),
    audience: parsed.data.options.audience,
    language: parsed.data.options.language,
    status: "queued",
    classificationLevel: 2,
    createdBy: user.id,
    createdAt: nowIso(),
  });
  await enqueue("report_generate", { reportId: id });
  await audit(user.id, "create", "report", id, { kind: parsed.data.scope.kind });
  return NextResponse.json({ data: { id }, error: null });
}
