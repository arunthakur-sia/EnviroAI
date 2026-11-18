// Server-computed KPIs and chart series for the two NCEC dashboards
// (ui-plan.md s2.1, s2.2). Figures are derived only from already-loaded
// record values of datasets the calling dashboard is gated to (the
// environmental dashboard is L2+, the sensitive dashboard is called only for
// an L3 principal whose grant includes DS-015/DS-016), so no extra
// field-visibility check is layered on top here — the page-level gate in
// principal.ts/policy.ts is what actually enforces access. Every count below
// was checked by hand against the loaded data (ui-plan.md s2) and is
// reported honestly even where it differs from the mockup images.
import "server-only";
import { countRecords, getDataset, listDepartments, listFields, listRecords } from "./repo";
import { projectRecord } from "./policy";
import { buildColumns } from "./datasets";
import type { NcecPrincipal } from "./types";

const DS_FACILITIES = "DS-001";
const DS_CONTAMINATED = "DS-027";
const DS_INSPECTIONS = "DS-015";
const DS_VIOLATIONS = "DS-016";

/** DS-001 Environmentally permitted facilities (register field names in comments). */
const FAC = {
  name: "DMO-002", // Facility name
  city: "DMO-004", // City
  region: "DMO-005", // Region
  coords: "DMO-006", // Coordinates
  sector: "DMO-012", // Sector
  permitType: "DMO-016", // Permit type
  expiry: "DMO-018", // Permit expiry date
  status: "DMO-019", // Status
} as const;

/** DS-016 Violations. DMO-277's register name is "violation type" but its
    values read as a severity scale (ui-plan.md decision #6). */
const VIO = {
  facilityName: "DMO-261",
  region: "DMO-264",
  coords: "DMO-265",
  issueDate: "DMO-275",
  typeName: "DMO-276",
  severity: "DMO-277",
  violationNo: "DMO-278",
  penalty: "DMO-280",
  // mockup_helper fields added by the CSV build (not in the register), L3
  status: "DUM-HLP-016-01",
  correctivePlan: "DUM-HLP-016-02",
  reporterContact: "DUM-HLP-016-03",
} as const;

/** DS-015 Facilities visited vs. total registered. */
const INS = { visited: "DMO-257" } as const;

type Coord = { lat: number; lng: number };
function parseCoords(s: unknown): Coord | null {
  if (typeof s !== "string") return null;
  const parts = s.split(",").map((x) => Number(x.trim()));
  if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return null;
  return { lat: parts[0], lng: parts[1] };
}
function avg(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export type FacilityRow = {
  recordId: string;
  facility: string;
  city: string;
  region: string;
  sector: string;
  permitType: string;
  expiry: string;
  status: string;
  /** the status actually shown, after the P2 guard: a register row marked
      "active" past its own expiry date is never shown as active. */
  displayStatus: "active" | "renewal" | "expired";
  statusMismatch: boolean;
};

export type EnvironmentalDashboard = {
  kpis: {
    permittedFacilities: number;
    activePermits: number;
    expiringIn90Days: number;
    contaminatedSites: number;
  };
  facilitiesBySector: Array<{ sector: string; count: number; points: Coord[] }>;
  facilitiesTable: FacilityRow[];
};

export async function getEnvironmentalDashboard(todayIso: string): Promise<EnvironmentalDashboard> {
  const [facRows, contaminatedCount] = await Promise.all([
    listRecords(DS_FACILITIES, { limit: 1000 }),
    countRecords(DS_CONTAMINATED),
  ]);
  const in90 = new Date(Date.parse(todayIso) + 90 * 86400000).toISOString().slice(0, 10);

  let active = 0;
  let expiring = 0;
  const bySector = new Map<string, { count: number; points: Coord[] }>();
  const table: FacilityRow[] = [];

  for (const r of facRows) {
    const v = r.values;
    const status = String(v[FAC.status] ?? "");
    const expiry = String(v[FAC.expiry] ?? "");
    const sector = String(v[FAC.sector] ?? "");
    const registerActive = status === "ساري";
    const registerExpired = status === "منتهي";
    const expired = registerExpired || (expiry !== "" && expiry < todayIso);
    const statusMismatch = registerActive && expired;
    const displayStatus: FacilityRow["displayStatus"] = expired ? "expired" : registerActive ? "active" : "renewal";
    if (displayStatus === "active") active++;
    if (!expired && expiry >= todayIso && expiry <= in90) expiring++;

    const entry = bySector.get(sector) ?? { count: 0, points: [] };
    entry.count++;
    const coords = parseCoords(v[FAC.coords]);
    if (coords) entry.points.push(coords);
    bySector.set(sector, entry);

    table.push({
      recordId: r.recordId,
      facility: String(v[FAC.name] ?? ""),
      city: String(v[FAC.city] ?? ""),
      region: String(v[FAC.region] ?? ""),
      sector,
      permitType: String(v[FAC.permitType] ?? ""),
      expiry,
      status,
      displayStatus,
      statusMismatch,
    });
  }

  return {
    kpis: {
      permittedFacilities: facRows.length,
      activePermits: active,
      expiringIn90Days: expiring,
      contaminatedSites: contaminatedCount,
    },
    facilitiesBySector: [...bySector.entries()].map(([sector, v]) => ({ sector, count: v.count, points: v.points })),
    facilitiesTable: table,
  };
}

export type ViolationRow = {
  recordId: string;
  violationNo: string;
  facility: string;
  region: string;
  type: string;
  severity: string;
  issueDate: string;
  penalty: number;
  status: string;
  /** personal data (R6): the mask unless the caller's grant includes personal data; null when not visible */
  reporterContact: string | null;
};

export type SensitiveDashboard = {
  grantApproverNameAr: string | null;
  grantApproverNameEn: string | null;
  kpis: {
    violations2026: number;
    penalties2026: number;
    inspectionCoveragePct: number;
    inspectionsVisited: number;
    inspectionsTotal: number;
    facilitiesWithViolation: number;
    openCorrectivePlans: number;
  };
  violationsByType: Array<{ type: string; count: number }>;
  violationsByRegion: Array<{ region: string; count: number; point: Coord | null }>;
  violationsTable: ViolationRow[];
};

/** Approver shown on the demo approval banner: the executive department that
    actually owns the Violations dataset in the register, looked up live
    rather than hardcoded. */
export async function getSensitiveDashboard(principal: NcecPrincipal): Promise<SensitiveDashboard> {
  const [vioRows, insRows, vioDataset, depts, vioFields] = await Promise.all([
    listRecords(DS_VIOLATIONS, { limit: 1000 }),
    listRecords(DS_INSPECTIONS, { limit: 1000 }),
    getDataset(DS_VIOLATIONS),
    listDepartments(),
    listFields(DS_VIOLATIONS),
  ]);
  // every violation value goes through the same allowlist and personal-data
  // mask as the generic dataset view, so nothing here can bypass R5/R6
  const vioColumns = buildColumns(principal, vioFields);
  const deptById = new Map(depts.map((d) => [d.deptId, d]));
  const approver = vioDataset ? deptById.get(vioDataset.execDeptId) ?? null : null;

  let violations2026 = 0;
  let penalties2026 = 0;
  const byType = new Map<string, number>();
  const byRegion = new Map<string, { count: number; points: Coord[] }>();
  const facilitiesWithViolation = new Set<string>();
  const table: ViolationRow[] = [];
  let openCorrectivePlans = 0;

  for (const r of vioRows) {
    const v = projectRecord(principal, vioColumns, r.values);
    if (v[VIO.correctivePlan] === "مفتوحة") openCorrectivePlans++;
    const issueDate = String(v[VIO.issueDate] ?? "");
    const penalty = Number(v[VIO.penalty] ?? 0);
    if (issueDate.startsWith("2026")) {
      violations2026++;
      penalties2026 += Number.isFinite(penalty) ? penalty : 0;
    }
    const type = String(v[VIO.typeName] ?? "");
    byType.set(type, (byType.get(type) ?? 0) + 1);

    const region = String(v[VIO.region] ?? "");
    const entry = byRegion.get(region) ?? { count: 0, points: [] };
    entry.count++;
    const coords = parseCoords(v[VIO.coords]);
    if (coords) entry.points.push(coords);
    byRegion.set(region, entry);

    facilitiesWithViolation.add(String(v[VIO.facilityName] ?? r.recordId));
    table.push({
      recordId: r.recordId,
      violationNo: String(v[VIO.violationNo] ?? ""),
      facility: String(v[VIO.facilityName] ?? ""),
      region,
      type,
      severity: String(v[VIO.severity] ?? ""),
      issueDate,
      penalty: Number.isFinite(penalty) ? penalty : 0,
      status: String(v[VIO.status] ?? ""),
      reporterContact: v[VIO.reporterContact] == null ? null : String(v[VIO.reporterContact]),
    });
  }

  const visited = insRows.filter((r) => String(r.values[INS.visited] ?? "") === "نعم").length;
  const violationsByRegion = [...byRegion.entries()].map(([region, v]) => ({
    region,
    count: v.count,
    point: v.points.length ? { lat: avg(v.points.map((p) => p.lat)), lng: avg(v.points.map((p) => p.lng)) } : null,
  }));

  return {
    grantApproverNameAr: approver?.nameAr ?? null,
    grantApproverNameEn: approver?.nameEn ?? null,
    kpis: {
      violations2026,
      penalties2026,
      inspectionCoveragePct: insRows.length ? Math.round((visited / insRows.length) * 100) : 0,
      inspectionsVisited: visited,
      inspectionsTotal: insRows.length,
      facilitiesWithViolation: facilitiesWithViolation.size,
      openCorrectivePlans,
    },
    violationsByType: [...byType.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    violationsByRegion,
    violationsTable: table,
  };
}
