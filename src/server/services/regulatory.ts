// EnviroAI Regulatory Overview: the regulator directory, the key regulatory
// timeline and the regulations table. Read-only. Counts per regulator are
// computed from the regulations table. Rows that the source databank does not
// back carry isIllustrative and are shown as such; nothing here is presented
// as a verified instrument unless it is traced to a databank source.
import { asc } from "drizzle-orm";
import { db, schema } from "@/server/db/client";

import {
  INSTRUMENT_TYPES,
  type InstrumentType,
  type Regulation,
  type Regulator,
  type RegulatoryFilters,
  type RegulatoryOverview,
  type TimelineEvent,
  type TimelineKind,
} from "./regulatory-types";

export * from "./regulatory-types";

const isType = (v: string): v is InstrumentType => (INSTRUMENT_TYPES as readonly string[]).includes(v);
const isKind = (v: string): v is TimelineKind => v === "law" || v === "decision" || v === "event";

export async function getRegulatoryOverview(filters: RegulatoryFilters = {}): Promise<RegulatoryOverview> {
  const [regulatorRows, regulationRows, timelineRows] = await Promise.all([
    db.select().from(schema.ksaRegulators).orderBy(asc(schema.ksaRegulators.sortOrder)),
    db.select().from(schema.ksaRegulations).orderBy(asc(schema.ksaRegulations.sortOrder)),
    db.select().from(schema.ksaTimelineEvents).orderBy(asc(schema.ksaTimelineEvents.sortOrder)),
  ]);

  const allRegulations: Regulation[] = regulationRows
    .filter((r) => isType(r.instrumentType))
    .map((r) => ({
      id: r.id,
      titleEn: r.titleEn,
      titleAr: r.titleAr,
      regulatorCode: r.regulatorCode,
      issuerLabel: r.issuerLabel,
      instrumentType: r.instrumentType as InstrumentType,
      reference: r.reference,
      gregorianDate: r.gregorianDate,
      hijriDate: r.hijriDate,
      status: r.status === "superseded" ? "superseded" : "active",
      documentUrl: r.documentUrl,
      sourceId: r.sourceId,
      isIllustrative: r.isIllustrative === 1,
      notesEn: r.notesEn,
      notesAr: r.notesAr,
    }));

  const perRegulator = new Map<string, number>();
  for (const r of allRegulations) {
    if (r.regulatorCode) perRegulator.set(r.regulatorCode, (perRegulator.get(r.regulatorCode) ?? 0) + 1);
  }
  const regulators: Regulator[] = regulatorRows.map((r) => ({
    code: r.code,
    shortEn: r.shortEn,
    shortAr: r.shortAr,
    nameEn: r.nameEn,
    nameAr: r.nameAr,
    roleEn: r.roleEn,
    roleAr: r.roleAr,
    icon: r.icon,
    website: r.website,
    regulationCount: perRegulator.get(r.code) ?? 0,
  }));

  const typeCounts = { all: allRegulations.length, law: 0, royal_decree: 0, cabinet_resolution: 0, executive_regulation: 0, strategy: 0, library: 0 };
  for (const r of allRegulations) typeCounts[r.instrumentType]++;

  let regulations = allRegulations;
  if (filters.regulator) regulations = regulations.filter((r) => r.regulatorCode === filters.regulator);
  if (filters.type && isType(filters.type)) regulations = regulations.filter((r) => r.instrumentType === filters.type);

  const timeline: TimelineEvent[] = timelineRows
    .filter((e) => isKind(e.kind))
    .map((e) => ({
      id: e.id,
      kind: e.kind as TimelineKind,
      gregorianDate: e.gregorianDate,
      hijriDate: e.hijriDate,
      titleEn: e.titleEn,
      titleAr: e.titleAr,
      isIllustrative: e.isIllustrative === 1,
      regulationId: e.regulationId,
    }));

  return { regulators, timeline, regulations, typeCounts };
}
