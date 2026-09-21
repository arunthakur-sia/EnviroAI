// CR08 5.4: the Reports module service. Types, the module report list and
// detail with their visibility rules, the request with its scope and
// permission checks, the review actions (edit, comment, regenerate, submit,
// request changes, approve) and publishing to Institutional Memory. The
// CR02 "Extract report" rows (type_id null) are untouched by everything here.
import fs from "node:fs/promises";
import { and, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { can, canSeePortal } from "@/server/auth/permissions";
import { newId, nowIso } from "@/lib/ids";
import { audit } from "@/server/auth/audit";
import { enqueue } from "@/server/jobs/queue";
import { notify, record } from "@/server/gamification/engine";
import { put } from "@/server/storage";
import { resolveDataPath } from "@/server/paths";
import { termByCode } from "@/server/services/taxonomy";
import { CUSTOM_TYPE_CODE } from "@/server/reports/types";
import { composeTitle, RENDER_ONLY, type ProgressState } from "@/server/reports/build";
import { isSectionCode, librarySummary, orderSections, SECTION_LIBRARY } from "@/server/reports/sections";
import { periodLabel } from "@/server/reports/sections/_shared";
import {
  bi,
  SECTION_ORDER,
  type Audience,
  type BiText,
  type LanguageMode,
  type ReportPeriod,
  type ReportScope,
  type ScopeKind,
  type SectionCode,
  type SectionContent,
} from "@/server/reports/spec";

/* ------------------------------------------------------------------ */
/* shapes                                                                */
/* ------------------------------------------------------------------ */

export type ReportTypeView = {
  id: string;
  code: string;
  family: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  defaultSections: SectionCode[];
  optionalSections: SectionCode[];
  scopeKind: ScopeKind;
  classificationDefault: number;
  audienceDefault: Audience;
  cadence: string | null;
  sort: number;
};

export type SectionComment = { id: string; userId: string; nameEn: string; nameAr: string; text: string; at: string };

export type ReportListItem = {
  id: string;
  typeId: string;
  typeCode: string;
  typeNameEn: string;
  typeNameAr: string;
  family: string;
  titleEn: string;
  titleAr: string;
  status: string;
  period: ReportPeriod;
  scope: ReportScope;
  languageMode: LanguageMode;
  audience: string;
  classification: number;
  requestedBy: string | null;
  requesterNameEn: string | null;
  requesterNameAr: string | null;
  /** CR08 9.1: the requester's avatar colour, null when no live account holds
      the request, so the hub and the report page raise the person card only
      where there is a card to raise */
  requesterColor: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  publishedDocumentId: string | null;
  hasDocx: boolean;
  previewCount: number;
  firstPreview: string | null;
  version: number;
  sectionCount: number;
  progress: ProgressState | null;
  error: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type ReportSectionView = {
  id: string;
  code: SectionCode;
  sort: number;
  status: string;
  name: BiText;
  layout: string;
  estimatedPages: number;
  content: SectionContent | null;
  comments: SectionComment[];
  error: string | null;
  updatedAt: string;
};

export type ReportDetail = {
  report: ReportListItem;
  sections: ReportSectionView[];
  versions: { id: string; version: number; docxPath: string | null; createdBy: string | null; createdAt: string }[];
  canEdit: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canPublish: boolean;
  canRequestChanges: boolean;
  isSuperAdmin: boolean;
};

export type ServiceResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; detail?: string };

/* ------------------------------------------------------------------ */
/* helpers                                                               */
/* ------------------------------------------------------------------ */

type ReportRow = typeof schema.reports.$inferSelect;
type TypeRow = typeof schema.reportTypes.$inferSelect;

function parse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function isSuperAdmin(user: CurrentUser | null): boolean {
  return Boolean(user) && can(user, "manage", "settings");
}

/** Everyone with the Reports portal may use the module. */
export function canUseReports(user: CurrentUser | null): boolean {
  return Boolean(user) && canSeePortal(user, "reports");
}

function typeView(t: TypeRow): ReportTypeView {
  return {
    id: t.id,
    code: t.code,
    family: t.family,
    nameEn: t.nameEn,
    nameAr: t.nameAr,
    descriptionEn: t.descriptionEn,
    descriptionAr: t.descriptionAr,
    defaultSections: orderSections(parse<string[]>(t.defaultSectionsJson, [])),
    optionalSections: orderSections(parse<string[]>(t.optionalSectionsJson, [])),
    scopeKind: t.scopeKind as ScopeKind,
    classificationDefault: t.classificationDefault,
    audienceDefault: t.audienceDefault as Audience,
    cadence: t.cadence,
    sort: t.sort,
  };
}

function canView(user: CurrentUser, row: ReportRow): boolean {
  if (isSuperAdmin(user)) return true;
  if (row.requestedBy === user.id) return true;
  return row.status === "published" && row.classificationLevel <= user.clearanceLevel;
}

function canEditRow(user: CurrentUser, row: ReportRow): boolean {
  if (!(isSuperAdmin(user) || row.requestedBy === user.id)) return false;
  return row.status === "draft" || row.status === "in_review";
}

async function loadRow(id: string): Promise<{ row: ReportRow; type: TypeRow | null } | null> {
  const [row] = await db.select().from(schema.reports).where(eq(schema.reports.id, id)).limit(1);
  if (!row || !row.typeId) return null;
  const [type] = await db.select().from(schema.reportTypes).where(eq(schema.reportTypes.id, row.typeId)).limit(1);
  return { row, type: type ?? null };
}

/** CR08 9.1: the avatar colour travels with the name, so the requester can be
    shown as a person chip that opens the person card. */
async function userNames(ids: string[]): Promise<Map<string, { nameEn: string; nameAr: string; color: string; deleted: boolean }>> {
  const clean = [...new Set(ids.filter(Boolean))];
  if (!clean.length) return new Map();
  const rows = await db
    .select({
      id: schema.users.id,
      nameEn: schema.users.nameEn,
      nameAr: schema.users.nameAr,
      color: schema.users.avatarColor,
      deletedAt: schema.users.deletedAt,
    })
    .from(schema.users)
    .where(inArray(schema.users.id, clean));
  return new Map(rows.map((r) => [r.id, { nameEn: r.nameEn, nameAr: r.nameAr, color: r.color, deleted: Boolean(r.deletedAt) }]));
}

async function superAdminIds(): Promise<string[]> {
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.users.roleId))
    .where(and(eq(schema.roles.nameEn, "Super Admin"), isNull(schema.users.deletedAt)));
  return rows.map((r) => r.id);
}

function listItem(
  row: ReportRow,
  type: TypeRow | null,
  names: Map<string, { nameEn: string; nameAr: string; color: string; deleted: boolean }>,
  sectionCount: number
): ReportListItem {
  const previews = parse<string[]>(row.previewImagesJson, []);
  const requester = row.requestedBy ? names.get(row.requestedBy) : null;
  return {
    id: row.id,
    typeId: row.typeId ?? "",
    typeCode: type?.code ?? CUSTOM_TYPE_CODE,
    typeNameEn: type?.nameEn ?? "Custom report",
    typeNameAr: type?.nameAr ?? "تقرير مخصص",
    family: type?.family ?? "custom",
    titleEn: row.titleEn ?? row.title,
    titleAr: row.titleAr ?? row.title,
    status: row.status,
    period: parse<ReportPeriod>(row.periodJson, { kind: "year", year: Number(row.createdAt.slice(0, 4)), label: bi("", "") }),
    scope: parse<ReportScope>(row.scopeJson, { kind: "npc", label: bi("National Planning Council", "المجلس الوطني للتخطيط") }),
    languageMode: (row.languageMode as LanguageMode) ?? "en",
    audience: row.audience,
    classification: row.classificationLevel,
    requestedBy: row.requestedBy,
    requesterNameEn: requester?.nameEn ?? null,
    requesterNameAr: requester?.nameAr ?? null,
    requesterColor: requester && !requester.deleted ? requester.color : null,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt,
    publishedAt: row.publishedAt,
    publishedDocumentId: row.publishedDocumentId,
    hasDocx: Boolean(row.docxPath),
    previewCount: previews.length,
    firstPreview: previews[0] ?? null,
    version: row.version,
    sectionCount,
    progress: parse<ProgressState | null>(row.progressJson, null),
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/* ------------------------------------------------------------------ */
/* reads                                                                 */
/* ------------------------------------------------------------------ */

export async function listReportTypes(user: CurrentUser): Promise<ReportTypeView[]> {
  const rows = await db.select().from(schema.reportTypes).where(eq(schema.reportTypes.isActive, 1)).orderBy(schema.reportTypes.sort);
  const admin = isSuperAdmin(user);
  return rows.filter((t) => admin || t.family !== "custom").map(typeView);
}

export function listSectionLibrary() {
  return librarySummary();
}

export type ReportListFilters = { status?: string; typeCode?: string; scopeKind?: string; mine?: boolean; limit?: number };

/** Everyone sees published reports; requesters see their own; Super Admins all. */
export async function listModuleReports(user: CurrentUser, filters: ReportListFilters = {}): Promise<ReportListItem[]> {
  const conds = [isNotNull(schema.reports.typeId)];
  if (!isSuperAdmin(user)) {
    conds.push(or(eq(schema.reports.status, "published"), eq(schema.reports.requestedBy, user.id))!);
  }
  if (filters.mine) conds.push(eq(schema.reports.requestedBy, user.id));
  if (filters.status) conds.push(eq(schema.reports.status, filters.status));
  const rows = await db
    .select()
    .from(schema.reports)
    .where(and(...conds))
    .orderBy(desc(schema.reports.createdAt))
    .limit(Math.min(filters.limit ?? 200, 500));
  const types = await db.select().from(schema.reportTypes);
  const typeById = new Map(types.map((t) => [t.id, t]));
  const names = await userNames(rows.map((r) => r.requestedBy ?? ""));
  const items = rows
    .map((row) => listItem(row, row.typeId ? typeById.get(row.typeId) ?? null : null, names, orderSections(parse<string[]>(row.sectionsJson, [])).length))
    .filter((r) => r.classification <= user.clearanceLevel || r.requestedBy === user.id || isSuperAdmin(user))
    .filter((r) => !filters.typeCode || r.typeCode === filters.typeCode)
    .filter((r) => !filters.scopeKind || r.scope.kind === filters.scopeKind);
  return items;
}

export async function getModuleReport(user: CurrentUser, id: string): Promise<ReportDetail | null> {
  const loaded = await loadRow(id);
  if (!loaded || !canView(user, loaded.row)) return null;
  const { row, type } = loaded;
  const codes = orderSections(parse<string[]>(row.sectionsJson, []));
  const sectionRows = await db.select().from(schema.reportSections).where(eq(schema.reportSections.reportId, id));
  const sections: ReportSectionView[] = codes.map((code, i) => {
    const s = sectionRows.find((r) => r.sectionCode === code);
    const def = SECTION_LIBRARY[code];
    return {
      id: s?.id ?? `${id}-${code}`,
      code,
      sort: s?.sort ?? i,
      status: s?.status ?? "pending",
      name: def.name,
      layout: def.layout,
      estimatedPages: def.estimatedPages,
      content: s ? parse<SectionContent | null>(s.contentJson, null) : null,
      comments: s ? parse<SectionComment[]>(s.commentsJson, []) : [],
      error: s?.error ?? null,
      updatedAt: s?.updatedAt ?? row.createdAt,
    };
  });
  const versions = await db.select().from(schema.reportVersions).where(eq(schema.reportVersions.reportId, id)).orderBy(desc(schema.reportVersions.version));
  const names = await userNames([row.requestedBy ?? "", row.approvedBy ?? ""]);
  const admin = isSuperAdmin(user);
  const editable = canEditRow(user, row);
  return {
    report: listItem(row, type, names, codes.length),
    sections,
    versions: versions.map((v) => ({ id: v.id, version: v.version, docxPath: v.docxPath, createdBy: v.createdBy, createdAt: v.createdAt })),
    canEdit: editable,
    canSubmit: editable && row.status === "draft",
    canApprove: admin && (row.status === "in_review" || row.status === "draft"),
    canPublish: admin && row.status === "approved" && Boolean(row.docxPath),
    canRequestChanges: admin && (row.status === "in_review" || row.status === "approved"),
    isSuperAdmin: admin,
  };
}

/* ------------------------------------------------------------------ */
/* the request                                                           */
/* ------------------------------------------------------------------ */

export const PeriodInput = z.object({
  kind: z.enum(["year", "quarter", "month", "range"]),
  year: z.number().int().min(2000).max(2100),
  quarter: z.number().int().min(1).max(4).optional(),
  month: z.number().int().min(1).max(12).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const ScopeInput = z.object({
  kind: z.enum(["npc", "outcome", "department", "project", "period"]),
  id: z.string().optional().nullable(),
  code: z.string().optional().nullable(),
});

export const CreateReportInput = z.object({
  typeCode: z.string().min(1),
  period: PeriodInput,
  scope: ScopeInput,
  audience: z.enum(["leadership", "working", "public"]).optional(),
  languageMode: z.enum(["en", "ar", "both"]).default("both"),
  sectionCodes: z.array(z.string()).optional(),
  classification: z.number().int().min(1).max(4).optional(),
});
export type CreateReportInputType = z.infer<typeof CreateReportInput>;

function normalisePeriod(p: z.infer<typeof PeriodInput>): ReportPeriod | null {
  if (p.kind === "quarter" && !p.quarter) return null;
  if (p.kind === "month" && !p.month) return null;
  if (p.kind === "range" && (!p.from || !p.to || p.from > p.to)) return null;
  const period: ReportPeriod = { kind: p.kind, year: p.year, quarter: p.quarter, month: p.month, from: p.from, to: p.to, label: bi("", "") };
  period.label = periodLabel(period);
  return period;
}

/** Resolves the scope the request names to its row and bilingual label. */
async function resolveScopeInput(input: z.infer<typeof ScopeInput>): Promise<{ scope: ReportScope; node?: typeof schema.strategyNodes.$inferSelect; unit?: typeof schema.orgUnits.$inferSelect } | null> {
  if (input.kind === "npc" || input.kind === "period") {
    return { scope: { kind: input.kind, id: null, code: null, label: bi("National Planning Council", "المجلس الوطني للتخطيط") } };
  }
  const key = (input.id ?? input.code ?? "").trim();
  if (!key) return null;
  if (input.kind === "department") {
    const [unit] = await db.select().from(schema.orgUnits).where(or(eq(schema.orgUnits.id, key), eq(schema.orgUnits.code, key))).limit(1);
    if (!unit) return null;
    return { scope: { kind: "department", id: unit.id, code: unit.code, label: bi(unit.nameEn, unit.nameAr) }, unit };
  }
  const [node] = await db.select().from(schema.strategyNodes).where(or(eq(schema.strategyNodes.id, key), eq(schema.strategyNodes.code, key))).limit(1);
  if (!node) return null;
  if (input.kind === "outcome" && node.nodeType !== "outcome") return null;
  if (input.kind === "project" && node.nodeType !== "project" && node.nodeType !== "initiative") return null;
  return { scope: { kind: input.kind, id: node.id, code: node.code, label: bi(`${node.code ?? ""} ${node.titleEn}`.trim(), `${node.code ?? ""} ${node.titleAr}`.trim()) }, node };
}

/** "Within their unit or projects": a department must be the requester's
    own, a project must be led by their department or carry them as a
    stakeholder or owner; outcomes and the Council are open to everyone with
    the portal. Only the Super Admin requests on any scope (a role's read
    scope of "all" does not widen what a person may commission). */
async function mayRequestScope(user: CurrentUser, resolved: NonNullable<Awaited<ReturnType<typeof resolveScopeInput>>>): Promise<boolean> {
  if (isSuperAdmin(user)) return true;
  if (resolved.unit) return resolved.unit.id === user.departmentId;
  if (resolved.node && (resolved.node.nodeType === "project" || resolved.node.nodeType === "initiative")) {
    if (resolved.node.ownerUserId === user.id) return true;
    const leads = await db.select().from(schema.nodeLeads).where(eq(schema.nodeLeads.nodeId, resolved.node.id));
    if (user.departmentId && leads.some((l) => l.leadKind === "department" && l.departmentId === user.departmentId)) return true;
    const roles = await db.select({ id: schema.nodeStakeholders.id }).from(schema.nodeStakeholders).where(and(eq(schema.nodeStakeholders.nodeId, resolved.node.id), eq(schema.nodeStakeholders.userId, user.id))).limit(1);
    return roles.length > 0;
  }
  return true;
}

export async function createReportRequest(user: CurrentUser, raw: CreateReportInputType): Promise<ServiceResult<{ id: string; titleEn: string; titleAr: string; sectionCodes: SectionCode[] }>> {
  if (!canUseReports(user)) return { ok: false, error: "forbidden", detail: "reports portal" };
  const parsed = CreateReportInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid", detail: parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ") };
  const input = parsed.data;
  const [type] = await db.select().from(schema.reportTypes).where(and(eq(schema.reportTypes.code, input.typeCode), eq(schema.reportTypes.isActive, 1))).limit(1);
  if (!type) return { ok: false, error: "not_found", detail: "unknown report type" };
  const isCustom = type.family === "custom";
  if (isCustom && !isSuperAdmin(user)) return { ok: false, error: "forbidden", detail: "custom reports are built by the Super Admin" };
  const councilWide = (k: string) => k === "npc" || k === "period";
  if (!isCustom && type.scopeKind !== input.scope.kind && !(councilWide(type.scopeKind) && councilWide(input.scope.kind))) {
    return { ok: false, error: "invalid", detail: `this type takes a ${type.scopeKind} scope` };
  }
  const resolved = await resolveScopeInput(input.scope);
  if (!resolved) return { ok: false, error: "not_found", detail: "scope not found" };
  if (!(await mayRequestScope(user, resolved))) return { ok: false, error: "forbidden", detail: "outside the requester's unit or projects" };
  const period = normalisePeriod(input.period);
  if (!period) return { ok: false, error: "invalid", detail: "period" };

  const defaults = orderSections(parse<string[]>(type.defaultSectionsJson, []));
  const optional = orderSections(parse<string[]>(type.optionalSectionsJson, []));
  let codes: SectionCode[];
  if (input.sectionCodes?.length) {
    const allowed = new Set<string>(isCustom ? SECTION_ORDER : [...defaults, ...optional]);
    const bad = input.sectionCodes.filter((c) => !isSectionCode(c) || !allowed.has(c));
    if (bad.length) return { ok: false, error: "invalid", detail: `sections not available for this type: ${bad.join(", ")}` };
    codes = orderSections(input.sectionCodes);
  } else {
    codes = defaults;
  }
  if (!codes.length) return { ok: false, error: "invalid", detail: "no sections selected" };

  const classification = Math.min(4, Math.max(type.classificationDefault, input.classification ?? 1));
  const audience = input.audience ?? (type.audienceDefault as Audience);
  const title = composeTitle(bi(type.nameEn, type.nameAr), resolved.scope, period);
  const id = newId();
  const now = nowIso();
  const progress: ProgressState = { done: 0, total: codes.length, current: null, stage: "queued", notes: [], startedAt: now };
  await db.insert(schema.reports).values({
    id,
    title: title.en,
    scopeJson: JSON.stringify(resolved.scope),
    optionsJson: null,
    audience,
    language: input.languageMode === "both" ? "en" : input.languageMode,
    status: "generating",
    classificationLevel: classification,
    createdBy: user.id,
    createdAt: now,
    typeId: type.id,
    titleEn: title.en,
    titleAr: title.ar,
    periodJson: JSON.stringify(period),
    languageMode: input.languageMode,
    sectionsJson: JSON.stringify(codes),
    requestedBy: user.id,
    version: 1,
    progressJson: JSON.stringify(progress),
    updatedAt: now,
  });
  for (const [i, code] of codes.entries()) {
    await db.insert(schema.reportSections).values({ id: newId(), reportId: id, sectionCode: code, sort: i, status: "pending", updatedAt: now });
  }
  await audit(user.id, "create", "report", id, { typeCode: type.code, scope: resolved.scope.kind, period: period.label.en, sections: codes.length });
  return { ok: true, id, titleEn: title.en, titleAr: title.ar, sectionCodes: codes };
}

/* ------------------------------------------------------------------ */
/* review                                                                */
/* ------------------------------------------------------------------ */

const BiInput = z.object({ en: z.string().min(1), ar: z.string().min(1) });
export const SectionPatch = z.object({
  title: BiInput.optional(),
  lead: BiInput.optional().nullable(),
  blocks: z.array(z.object({ kind: z.string().min(1) }).passthrough()).optional(),
});
export type SectionPatchType = z.infer<typeof SectionPatch>;

const BLOCK_KINDS = new Set(["heading", "paragraph", "bullets", "numbered", "kpis", "table", "scorecard", "chart", "quote", "callout", "keyFigure", "figure", "sources", "pageBreak"]);

/** A manual edit of the AI text. The section becomes "edited" and the
    document is re-rendered from the stored sections (no regeneration). */
export async function updateSection(user: CurrentUser, reportId: string, code: string, rawPatch: SectionPatchType): Promise<ServiceResult<{ content: SectionContent }>> {
  const loaded = await loadRow(reportId);
  if (!loaded || !canView(user, loaded.row)) return { ok: false, error: "not_found" };
  if (!canEditRow(user, loaded.row)) return { ok: false, error: loaded.row.status === "generating" ? "busy" : "locked" };
  if (!isSectionCode(code)) return { ok: false, error: "invalid", detail: "unknown section" };
  const parsed = SectionPatch.safeParse(rawPatch);
  if (!parsed.success) return { ok: false, error: "invalid", detail: parsed.error.issues.map((i) => i.message).join("; ") };
  const patch = parsed.data;
  if (patch.blocks?.some((b) => !BLOCK_KINDS.has(b.kind))) return { ok: false, error: "invalid", detail: "unknown block kind" };
  const [row] = await db.select().from(schema.reportSections).where(and(eq(schema.reportSections.reportId, reportId), eq(schema.reportSections.sectionCode, code))).limit(1);
  if (!row) return { ok: false, error: "not_found", detail: "section" };
  const current = parse<SectionContent | null>(row.contentJson, null) ?? { code, title: SECTION_LIBRARY[code].name, layout: SECTION_LIBRARY[code].layout, blocks: [], sources: [] };
  const content: SectionContent = {
    ...current,
    title: patch.title ?? current.title,
    lead: patch.lead === null ? undefined : patch.lead ?? current.lead,
    blocks: (patch.blocks as SectionContent["blocks"] | undefined) ?? current.blocks,
    needsEditing: false,
    meta: { ...(current.meta ?? {}), editedBy: user.id, editedAt: nowIso() },
  };
  await db
    .update(schema.reportSections)
    .set({ contentJson: JSON.stringify(content), status: "edited", error: null, updatedAt: nowIso() })
    .where(eq(schema.reportSections.id, row.id));
  await db.update(schema.reports).set({ updatedAt: nowIso() }).where(eq(schema.reports.id, reportId));
  await audit(user.id, "edit", "report_section", row.id, { reportId, code });
  await enqueue("report_section_rebuild", { reportId, sectionCode: RENDER_ONLY });
  return { ok: true, content };
}

export async function addSectionComment(user: CurrentUser, reportId: string, code: string, text: string): Promise<ServiceResult<{ comment: SectionComment }>> {
  const loaded = await loadRow(reportId);
  if (!loaded || !canView(user, loaded.row)) return { ok: false, error: "not_found" };
  if (!isSectionCode(code)) return { ok: false, error: "invalid", detail: "unknown section" };
  const clean = text.trim().slice(0, 2000);
  if (!clean) return { ok: false, error: "invalid", detail: "empty comment" };
  const [row] = await db.select().from(schema.reportSections).where(and(eq(schema.reportSections.reportId, reportId), eq(schema.reportSections.sectionCode, code))).limit(1);
  if (!row) return { ok: false, error: "not_found", detail: "section" };
  const comments = parse<SectionComment[]>(row.commentsJson, []);
  const comment: SectionComment = { id: newId(), userId: user.id, nameEn: user.nameEn, nameAr: user.nameAr, text: clean, at: nowIso() };
  comments.push(comment);
  await db.update(schema.reportSections).set({ commentsJson: JSON.stringify(comments), updatedAt: nowIso() }).where(eq(schema.reportSections.id, row.id));
  await audit(user.id, "comment", "report_section", row.id, { reportId, code });
  const sectionName = SECTION_LIBRARY[code].name;
  const title = loaded.row.titleEn ?? loaded.row.title;
  const recipients = new Set<string>();
  if (loaded.row.requestedBy && loaded.row.requestedBy !== user.id) recipients.add(loaded.row.requestedBy);
  if (!isSuperAdmin(user)) for (const id of await superAdminIds()) if (id !== user.id) recipients.add(id);
  for (const id of recipients) {
    await notify(id, "report_comment", `Comment on ${sectionName.en}: ${title}`, `تعليق على ${sectionName.ar}: ${loaded.row.titleAr ?? title}`, `/reports/${reportId}?section=${code}`, { en: clean.slice(0, 200), ar: clean.slice(0, 200) });
  }
  return { ok: true, comment };
}

export async function requestSectionRegeneration(user: CurrentUser, reportId: string, code: string): Promise<ServiceResult> {
  const loaded = await loadRow(reportId);
  if (!loaded || !canView(user, loaded.row)) return { ok: false, error: "not_found" };
  if (!canEditRow(user, loaded.row)) return { ok: false, error: loaded.row.status === "generating" ? "busy" : "locked" };
  if (!isSectionCode(code)) return { ok: false, error: "invalid", detail: "unknown section" };
  const codes = orderSections(parse<string[]>(loaded.row.sectionsJson, []));
  if (!codes.includes(code)) return { ok: false, error: "invalid", detail: "section not in this report" };
  await db
    .update(schema.reportSections)
    .set({ status: "pending", updatedAt: nowIso() })
    .where(and(eq(schema.reportSections.reportId, reportId), eq(schema.reportSections.sectionCode, code)));
  await enqueue("report_section_rebuild", { reportId, sectionCode: code });
  await audit(user.id, "regenerate", "report_section", `${reportId}:${code}`, { reportId, code });
  return { ok: true };
}

export async function submitForReview(user: CurrentUser, reportId: string): Promise<ServiceResult> {
  const loaded = await loadRow(reportId);
  if (!loaded || !canView(user, loaded.row)) return { ok: false, error: "not_found" };
  const { row } = loaded;
  if (!(isSuperAdmin(user) || row.requestedBy === user.id)) return { ok: false, error: "forbidden" };
  if (row.status !== "draft") return { ok: false, error: "invalid_state", detail: row.status };
  await db.update(schema.reports).set({ status: "in_review", updatedAt: nowIso() }).where(eq(schema.reports.id, reportId));
  await audit(user.id, "submit", "report", reportId);
  const title = row.titleEn ?? row.title;
  for (const id of await superAdminIds()) {
    if (id === user.id) continue;
    await notify(id, "report_review", `Report submitted for review: ${title}`, `تقرير مقدم للمراجعة: ${row.titleAr ?? title}`, `/reports/${reportId}`, { en: `Submitted by ${user.nameEn}.`, ar: `قدمه ${user.nameAr}.` });
  }
  return { ok: true };
}

export async function requestChanges(user: CurrentUser, reportId: string, noteText?: string): Promise<ServiceResult> {
  if (!isSuperAdmin(user)) return { ok: false, error: "forbidden" };
  const loaded = await loadRow(reportId);
  if (!loaded) return { ok: false, error: "not_found" };
  const { row } = loaded;
  if (row.status !== "in_review" && row.status !== "approved") return { ok: false, error: "invalid_state", detail: row.status };
  await db.update(schema.reports).set({ status: "draft", approvedBy: null, approvedAt: null, updatedAt: nowIso() }).where(eq(schema.reports.id, reportId));
  await audit(user.id, "request_changes", "report", reportId, { note: noteText?.slice(0, 200) });
  if (row.requestedBy) {
    await notify(row.requestedBy, "report_changes", `Changes requested: ${row.titleEn ?? row.title}`, `طُلبت تعديلات: ${row.titleAr ?? row.title}`, `/reports/${reportId}`, { en: noteText?.slice(0, 300) ?? "The reviewer asked for changes.", ar: noteText?.slice(0, 300) ?? "طلب المراجع تعديلات." });
  }
  return { ok: true };
}

export async function approveReport(user: CurrentUser, reportId: string): Promise<ServiceResult> {
  if (!isSuperAdmin(user)) return { ok: false, error: "forbidden" };
  const loaded = await loadRow(reportId);
  if (!loaded) return { ok: false, error: "not_found" };
  const { row } = loaded;
  if (row.status !== "in_review" && row.status !== "draft") return { ok: false, error: "invalid_state", detail: row.status };
  const failed = await db.select({ id: schema.reportSections.id }).from(schema.reportSections).where(and(eq(schema.reportSections.reportId, reportId), eq(schema.reportSections.status, "failed"))).limit(1);
  if (failed.length) return { ok: false, error: "sections_failed", detail: "regenerate the failed sections first" };
  await db.update(schema.reports).set({ status: "approved", approvedBy: user.id, approvedAt: nowIso(), updatedAt: nowIso() }).where(eq(schema.reports.id, reportId));
  await audit(user.id, "approve", "report", reportId);
  if (row.requestedBy && row.requestedBy !== user.id) {
    await notify(row.requestedBy, "report_approved", `Report approved: ${row.titleEn ?? row.title}`, `اعتُمد التقرير: ${row.titleAr ?? row.title}`, `/reports/${reportId}`);
  }
  return { ok: true };
}

/** Publishes to Institutional Memory as a `report` document made from the
    primary docx, stores the document id, queues ingestion and tells the
    requester. Without a rendered docx the publish waits (docx_pending). */
export async function publishReport(user: CurrentUser, reportId: string): Promise<ServiceResult<{ documentId: string }>> {
  if (!isSuperAdmin(user)) return { ok: false, error: "forbidden" };
  const loaded = await loadRow(reportId);
  if (!loaded) return { ok: false, error: "not_found" };
  const { row, type } = loaded;
  if (row.status === "published" && row.publishedDocumentId) return { ok: true, documentId: row.publishedDocumentId };
  if (row.status !== "approved") return { ok: false, error: "invalid_state", detail: row.status };
  if (!row.docxPath) return { ok: false, error: "docx_pending", detail: "the document has not been rendered yet" };
  let buf: Buffer;
  try {
    buf = await fs.readFile(resolveDataPath(row.docxPath));
  } catch {
    return { ok: false, error: "file_missing" };
  }
  const term = await termByCode("knowledge_type", "report");
  const period = parse<ReportPeriod>(row.periodJson, { kind: "year", year: Number(row.createdAt.slice(0, 4)), label: bi("", "") });
  const scope = parse<ReportScope>(row.scopeJson, { kind: "npc", label: bi("National Planning Council", "المجلس الوطني للتخطيط") });
  const [requester] = row.requestedBy ? await db.select().from(schema.users).where(eq(schema.users.id, row.requestedBy)).limit(1) : [];
  const titleEn = row.titleEn ?? row.title;
  const titleAr = row.titleAr ?? row.title;
  const documentId = newId();
  const filename = `${titleEn.replace(/[^\w؀-ۿ -]+/g, "").slice(0, 60) || "report"}.docx`;
  const storagePath = await put(documentId, filename, buf);
  const versionId = newId();
  const now = nowIso();
  const languageOriginal = row.languageMode === "ar" ? "ar" : "en";
  await db.insert(schema.documents).values({
    id: documentId,
    titleEn,
    titleAr,
    titleArMachine: 0,
    summaryEn: `${type?.nameEn ?? "Report"} for ${period.label?.en ?? ""}${scope.kind !== "npc" && scope.kind !== "period" ? ` on ${scope.label.en}` : ""}, generated by SiaNexus and approved for Institutional Memory.`,
    summaryAr: `${type?.nameAr ?? "تقرير"} عن ${period.label?.ar ?? ""}${scope.kind !== "npc" && scope.kind !== "period" ? ` بشأن ${scope.label.ar}` : ""}، أعده سيا نكسس واعتُمد لمكتبة المعرفة.`,
    summaryMachine: 0,
    keyFactsJson: JSON.stringify([
      { text_en: `Report type: ${type?.nameEn ?? "custom"} (${type?.family ?? "custom"})`, text_ar: `نوع التقرير: ${type?.nameAr ?? "مخصص"}`, page: 1 },
      { text_en: `Period: ${period.label?.en ?? ""}; scope: ${scope.kind} ${scope.label.en}`, text_ar: `الفترة: ${period.label?.ar ?? ""}؛ النطاق: ${scope.label.ar}`, page: 1 },
      { text_en: `Languages: ${row.languageMode ?? "en"}; version ${row.version}`, text_ar: `اللغات: ${row.languageMode ?? "en"}؛ الإصدار ${row.version}`, page: 1 },
    ]),
    knowledgeTypeTermId: term?.id ?? null,
    classificationLevel: row.classificationLevel,
    departmentId: requester?.departmentId ?? user.departmentId,
    ownerUserId: row.requestedBy ?? user.id,
    languageOriginal,
    status: "verified",
    verifiedBy: user.id,
    verifiedAt: now,
    reviewDueAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    sourceOrigin: "npc",
    publishYear: period.year,
    originalFilename: filename,
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: buf.length,
    storagePath,
    currentVersionId: versionId,
    isSeeded: 0,
    sourceRef: `report:${reportId}`,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.documentVersions).values({ id: versionId, documentId, versionNo: 1, storagePath, uploadedBy: user.id, note: `Published from report ${reportId} v${row.version}`, createdAt: now });
  await db
    .update(schema.reports)
    .set({ status: "published", publishedDocumentId: documentId, publishedAt: now, vaultDocumentId: documentId, updatedAt: now })
    .where(eq(schema.reports.id, reportId));
  await enqueue("ingest_document", { documentId });
  await audit(user.id, "publish", "report", reportId, { documentId });
  await audit(user.id, "create", "document", documentId, { fromReport: reportId });
  if (row.requestedBy) {
    await notify(row.requestedBy, "report_published", `Report published: ${titleEn}`, `نُشر التقرير: ${titleAr}`, `/reports/${reportId}`, { en: "It is now in Institutional Memory and citable by Ask NPC.", ar: "أصبح الآن في مكتبة المعرفة ويمكن لاسأل المجلس الاستشهاد به." });
    await record({ userId: row.requestedBy, type: "report_published", resourceType: "report", resourceId: reportId, meta: { departmentId: requester?.departmentId ?? null } });
  }
  return { ok: true, documentId };
}

/* ------------------------------------------------------------------ */
/* files                                                                 */
/* ------------------------------------------------------------------ */

export async function resolveDownload(user: CurrentUser, reportId: string, lang?: string): Promise<ServiceResult<{ absPath: string; filename: string; lang: "en" | "ar" }>> {
  const loaded = await loadRow(reportId);
  if (!loaded || !canView(user, loaded.row)) return { ok: false, error: "not_found" };
  const { row } = loaded;
  if (!row.docxPath) return { ok: false, error: "docx_pending" };
  const mode = (row.languageMode as LanguageMode) ?? "en";
  const wanted: "en" | "ar" = lang === "ar" ? "ar" : lang === "en" ? "en" : mode === "ar" ? "ar" : "en";
  if (mode !== "both" && wanted !== mode) return { ok: false, error: "not_found", detail: `no ${wanted} edition` };
  const rel = mode === "both" ? `reports/module/${reportId}-${wanted}.docx` : row.docxPath;
  const absPath = resolveDataPath(rel);
  try {
    await fs.access(absPath);
  } catch {
    return { ok: false, error: "file_missing" };
  }
  const base = (wanted === "ar" ? row.titleAr : row.titleEn) ?? row.title;
  const filename = `${base.replace(/[^\w؀-ۿ -]+/g, "").slice(0, 60) || "report"}-${wanted}.docx`;
  return { ok: true, absPath, filename, lang: wanted };
}

export async function resolvePreview(
  user: CurrentUser,
  reportId: string,
  n: number,
  opts: { thumb?: boolean } = {}
): Promise<ServiceResult<{ absPath: string; isThumb: boolean }>> {
  const loaded = await loadRow(reportId);
  if (!loaded || !canView(user, loaded.row)) return { ok: false, error: "not_found" };
  const previews = parse<string[]>(loaded.row.previewImagesJson, []);
  const rel = previews[n];
  if (!rel) return { ok: false, error: "not_found", detail: "no such preview" };
  const absPath = previewAbsPath(rel);
  // the gallery asks for the small rendition; a report rendered before thumbs
  // existed has none, and the full page is served instead
  if (opts.thumb) {
    const { thumbPathOf } = await import("@/server/reports/template/preview");
    const thumb = thumbPathOf(absPath);
    try {
      await fs.access(thumb);
      return { ok: true, absPath: thumb, isThumb: true };
    } catch {
      /* fall through to the full page */
    }
  }
  try {
    await fs.access(absPath);
  } catch {
    return { ok: false, error: "file_missing" };
  }
  return { ok: true, absPath, isThumb: false };
}

/** The template stores preview paths as `data/reports/previews/...`; older rows
    may hold a path relative to the data directory instead. Both resolve. */
export function previewAbsPath(rel: string): string {
  return resolveDataPath(rel);
}
