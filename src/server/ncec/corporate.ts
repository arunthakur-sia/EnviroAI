// Server-computed figures for NCEC Corporate Data (brief s8.4), from the
// generated corporate dummy records: Employee data (DS-056), Training
// programs delivered (DS-120), Co-op (DS-117) and Tamheer (DS-118) trainees.
// Headcount (DMO-809) is classified Secret in the register, so every figure
// derived from it (headcount, shares, employment-type split, vacancies,
// headcount trend, hours per employee) is computed only when the caller can
// see that field, checked against the stored layer, and is otherwise absent
// from the result (null), never sent and hidden (R5).
import "server-only";
import { listDepartments, listFields, listRecords } from "./repo";
import { canSeeField } from "./policy";
import type { NcecPrincipal } from "./types";

const YEAR = 2026;
const PREV = 2025;

const EMP = { year: "DUM-HLP-056-01", dept: "DUM-HLP-056-02", type: "DUM-HLP-056-03", headcount: "DMO-809", vacancies: "DUM-HLP-056-04" } as const;
const TRN = { year: "DUM-HLP-120-01", dept: "DUM-HLP-120-03", hours: "DUM-HLP-120-04", participants: "DUM-HLP-120-05" } as const;
const TRAINEE_YEAR: Record<string, string> = { "DS-117": "DUM-HLP-117-01", "DS-118": "DUM-HLP-118-01" };
const TRAINEE_DEPT: Record<string, string> = { "DS-117": "DUM-HLP-117-02", "DS-118": "DUM-HLP-118-02" };

export type YearPair = { current: number; previous: number };

export type CorporateDepartmentRow = {
  deptId: string;
  nameAr: string;
  nameEn: string | null;
  headcount: number | null;
  headcountTrendPct: number | null;
  sharePct: number | null;
  vacancies: number | null;
  programmes: YearPair;
  trainingHours: YearPair;
  /** per employee when headcount is visible for this department, else per participant */
  hoursPer: { basis: "employee" | "participant"; current: number; previous: number };
  trainees: YearPair;
  /** this department's own headcount by employment type (current year); null when headcount is not visible */
  employmentType: Array<{ type: string; count: number }> | null;
};

export type CorporateDashboard = {
  headcountVisible: boolean;
  vacanciesVisible: boolean;
  kpis: {
    headcount: YearPair | null;
    programmes: YearPair;
    /** per employee when headcount is visible to the caller, else per participant */
    hoursPer: { basis: "employee" | "participant"; current: number; previous: number };
    trainees: YearPair;
  };
  byEmploymentType: Array<{ type: string; count: number }> | null;
  departments: CorporateDepartmentRow[];
};

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;

export function trendPct(p: YearPair): number | null {
  return p.previous > 0 ? ((p.current - p.previous) / p.previous) * 100 : null;
}

async function visible(principal: NcecPrincipal, datasetId: string, assetId: string): Promise<boolean> {
  const f = (await listFields(datasetId)).find((x) => x.assetId === assetId);
  return !!f && canSeeField(principal, datasetId, f.effectiveLayer);
}

export async function getCorporateDashboard(principal: NcecPrincipal): Promise<CorporateDashboard> {
  const [headcountVisible, vacanciesVisible, emp, trn, coop, tamheer, depts] = await Promise.all([
    visible(principal, "DS-056", EMP.headcount),
    visible(principal, "DS-056", EMP.vacancies),
    listRecords("DS-056", { limit: 1000 }),
    listRecords("DS-120", { limit: 1000 }),
    listRecords("DS-117", { limit: 1000 }),
    listRecords("DS-118", { limit: 1000 }),
    listDepartments(),
  ]);
  const deptByAr = new Map(depts.map((d) => [d.nameAr, d]));

  type Acc = {
    headcount: YearPair;
    vacancies: number;
    programmes: YearPair;
    hours: YearPair;
    participants: YearPair;
    trainees: YearPair;
    employmentType: Map<string, number>;
  };
  const byDept = new Map<string, Acc>();
  const acc = (deptAr: string) => {
    let a = byDept.get(deptAr);
    if (!a) {
      byDept.set(
        deptAr,
        (a = {
          headcount: { current: 0, previous: 0 },
          vacancies: 0,
          programmes: { current: 0, previous: 0 },
          hours: { current: 0, previous: 0 },
          participants: { current: 0, previous: 0 },
          trainees: { current: 0, previous: 0 },
          employmentType: new Map(),
        })
      );
    }
    return a;
  };

  const headcount: YearPair = { current: 0, previous: 0 };
  const byType = new Map<string, number>();
  for (const r of emp) {
    const v = r.values;
    const y = num(v[EMP.year]);
    const a = acc(String(v[EMP.dept] ?? ""));
    const n = num(v[EMP.headcount]);
    if (y === YEAR) {
      headcount.current += n;
      a.headcount.current += n;
      a.vacancies += num(v[EMP.vacancies]);
      const type = String(v[EMP.type] ?? "");
      byType.set(type, (byType.get(type) ?? 0) + n);
      a.employmentType.set(type, (a.employmentType.get(type) ?? 0) + n);
    } else if (y === PREV) {
      headcount.previous += n;
      a.headcount.previous += n;
    }
  }

  const programmes: YearPair = { current: 0, previous: 0 };
  const participantHours: YearPair = { current: 0, previous: 0 };
  const participants: YearPair = { current: 0, previous: 0 };
  for (const r of trn) {
    const v = r.values;
    const y = num(v[TRN.year]);
    const ph = num(v[TRN.hours]) * num(v[TRN.participants]);
    const key = y === YEAR ? "current" : y === PREV ? "previous" : null;
    if (!key) continue;
    programmes[key]++;
    participantHours[key] += ph;
    participants[key] += num(v[TRN.participants]);
    const a = acc(String(v[TRN.dept] ?? ""));
    a.programmes[key]++;
    a.hours[key] += ph;
    a.participants[key] += num(v[TRN.participants]);
  }

  const trainees: YearPair = { current: 0, previous: 0 };
  for (const [ds, rows] of [["DS-117", coop], ["DS-118", tamheer]] as const) {
    for (const r of rows) {
      const y = num(r.values[TRAINEE_YEAR[ds]]);
      const key = y === YEAR ? "current" : y === PREV ? "previous" : null;
      if (!key) continue;
      trainees[key]++;
      acc(String(r.values[TRAINEE_DEPT[ds]] ?? "")).trainees[key]++;
    }
  }

  const ratio = (a: number, b: number) => (b > 0 ? Math.round(a / b) : 0);
  const hoursPer = headcountVisible
    ? { basis: "employee" as const, current: ratio(participantHours.current, headcount.current), previous: ratio(participantHours.previous, headcount.previous) }
    : { basis: "participant" as const, current: ratio(participantHours.current, participants.current), previous: ratio(participantHours.previous, participants.previous) };

  const departments: CorporateDepartmentRow[] = [...byDept.entries()]
    .filter(([ar]) => ar)
    .map(([ar, a]) => {
      const d = deptByAr.get(ar);
      const deptHoursPer = headcountVisible
        ? { basis: "employee" as const, current: ratio(a.hours.current, a.headcount.current), previous: ratio(a.hours.previous, a.headcount.previous) }
        : { basis: "participant" as const, current: ratio(a.hours.current, a.participants.current), previous: ratio(a.hours.previous, a.participants.previous) };
      return {
        deptId: d?.deptId ?? ar,
        nameAr: ar,
        nameEn: d?.nameEn ?? null,
        headcount: headcountVisible ? a.headcount.current : null,
        headcountTrendPct: headcountVisible ? trendPct(a.headcount) : null,
        sharePct: headcountVisible && headcount.current ? (a.headcount.current / headcount.current) * 100 : null,
        vacancies: vacanciesVisible ? a.vacancies : null,
        programmes: a.programmes,
        trainingHours: a.hours,
        hoursPer: deptHoursPer,
        trainees: a.trainees,
        employmentType: headcountVisible ? [...a.employmentType.entries()].map(([type, count]) => ({ type, count })) : null,
      };
    })
    .sort((x, y) => (y.headcount ?? y.programmes.current) - (x.headcount ?? x.programmes.current));

  return {
    headcountVisible,
    vacanciesVisible,
    kpis: { headcount: headcountVisible ? headcount : null, programmes, hoursPer, trainees },
    byEmploymentType: headcountVisible ? [...byType.entries()].map(([type, count]) => ({ type, count })) : null,
    departments,
  };
}
