// Indicator import: preview proposes a column mapping (AI or heuristic); confirm
// writes provisional values and records the import.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { parseDocument } from "@/server/ingest/parse";
import { callJson } from "@/server/ai/client";
import { addIndicatorValue } from "@/server/services/statistics";
import { newId, nowIso } from "@/lib/ids";
import { record } from "@/server/gamification/engine";
import { audit } from "@/server/auth/audit";

type Mapping = {
  period_column: string;
  value_column: string;
  period_format: string;
  confidence: number;
  warnings: string[];
};

function heuristicMapping(columns: string[], rows: string[][]): Mapping {
  const lower = columns.map((c) => c.toLowerCase());
  const periodIdx = lower.findIndex((c) =>
    /(year|date|period|month|quarter|السنة|الفترة|الشهر|التاريخ|الربع)/.test(c)
  );
  let valueIdx = lower.findIndex((c) => /(value|القيمة|amount|total|عدد)/.test(c));
  if (valueIdx === -1) {
    // first mostly-numeric column that is not the period column
    for (let i = 0; i < columns.length; i++) {
      if (i === periodIdx) continue;
      const numeric = rows.slice(0, 10).filter((r) => r[i] && !Number.isNaN(Number(String(r[i]).replace(/,/g, ""))));
      if (numeric.length >= Math.min(5, rows.length)) {
        valueIdx = i;
        break;
      }
    }
  }
  const sample = rows[0]?.[periodIdx === -1 ? 0 : periodIdx] ?? "";
  const format = /^\d{4}-\d{2}/.test(sample)
    ? "yyyy-mm"
    : /Q[1-4]/i.test(sample)
      ? "yyyy-Qn"
      : "yyyy";
  const warnings: string[] = [];
  if (periodIdx === -1) warnings.push("No period column detected");
  if (valueIdx === -1) warnings.push("No numeric value column detected");
  return {
    period_column: columns[periodIdx === -1 ? 0 : periodIdx] ?? "0",
    value_column: columns[valueIdx === -1 ? 1 : valueIdx] ?? "1",
    period_format: format,
    confidence: periodIdx !== -1 && valueIdx !== -1 ? 0.8 : 0.4,
    warnings,
  };
}

function normalizePeriod(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-Q[1-4]$/i.test(s)) return s.toUpperCase();
  const q = /^Q([1-4])[\s-]*(\d{4})$/i.exec(s);
  if (q) return `${q[2]}-Q${q[1]}`;
  const my = /^(\d{1,2})\/(\d{4})$/.exec(s);
  if (my) return `${my[2]}-${my[1].padStart(2, "0")}`;
  const ymd = /^(\d{4})-(\d{2})-\d{2}/.exec(s);
  if (ymd) return `${ymd[1]}-${ymd[2]}`;
  return null;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "create", "statistics")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    // PREVIEW: parse the file, propose a mapping
    const form = await req.formData();
    const file = form.get("file");
    const indicatorId = String(form.get("indicatorId") ?? "");
    if (!(file instanceof File)) {
      return NextResponse.json({ data: null, error: "file_required" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const parsed = await parseDocument(buf, file.name);
    const table = parsed.tables[0];
    if (!table || !table.rows.length) {
      return NextResponse.json({ data: null, error: "no_table_found" }, { status: 422 });
    }
    const columns = table.columns.length ? table.columns : table.rows[0].map((_, i) => `Column ${i + 1}`);
    const rows = table.rows.slice(0, 400);

    let mapping = heuristicMapping(columns, rows);
    const [ind] = indicatorId
      ? await db.select().from(schema.indicators).where(eq(schema.indicators.id, indicatorId)).limit(1)
      : [];
    const ai = await callJson<Mapping>(
      "system_table_map",
      JSON.stringify({
        indicator: ind ? { name: ind.nameEn, unit: ind.unit, frequency: ind.frequency } : null,
        columns,
        sample_rows: rows.slice(0, 12),
      }),
      { maxTokens: 800 }
    );
    if (ai?.period_column !== undefined) mapping = { ...mapping, ...ai, warnings: [...(ai.warnings ?? [])] };

    // validate
    const pIdx = columns.indexOf(mapping.period_column);
    const vIdx = columns.indexOf(mapping.value_column);
    const preview: { period: string | null; value: number | null; raw: string[] }[] = rows
      .slice(0, 60)
      .map((r) => ({
        period: normalizePeriod(String(r[pIdx === -1 ? 0 : pIdx] ?? "")),
        value: (() => {
          const n = Number(String(r[vIdx === -1 ? 1 : vIdx] ?? "").replace(/,/g, ""));
          return Number.isNaN(n) ? null : n;
        })(),
        raw: r.slice(0, 6),
      }));
    const bad = preview.filter((p) => !p.period || p.value === null).length;
    if (bad > 0) mapping.warnings.push(`${bad} rows could not be parsed and will be skipped`);
    const seen = new Set<string>();
    for (const p of preview) {
      if (p.period && seen.has(p.period)) {
        mapping.warnings.push("Duplicate periods detected; later rows overwrite earlier ones");
        break;
      }
      if (p.period) seen.add(p.period);
    }
    return NextResponse.json({
      data: { columns, rowCount: rows.length, mapping, preview, allRows: rows },
      error: null,
    });
  }

  // CONFIRM: JSON body with resolved rows
  const Body = z.object({
    indicatorId: z.string(),
    rows: z.array(z.object({ period: z.string(), value: z.number() })).min(1).max(3000),
  });
  const parsedBody = Body.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  }
  const { indicatorId, rows } = parsedBody.data;
  let written = 0;
  for (const r of rows) {
    const result = await addIndicatorValue(user, indicatorId, r.period, r.value, {
      note: "imported",
    });
    if (result.ok) written++;
  }
  await db.insert(schema.imports).values({
    id: newId(),
    indicatorId,
    rowsImported: written,
    status: "done",
    createdBy: user.id,
    createdAt: nowIso(),
  });
  await record({
    userId: user.id,
    type: "indicator_import_completed",
    resourceType: "indicator",
    resourceId: indicatorId,
    meta: { departmentId: user.departmentId },
  });
  await audit(user.id, "create", "indicator_import", indicatorId, { rows: written });
  return NextResponse.json({ data: { written }, error: null });
}
