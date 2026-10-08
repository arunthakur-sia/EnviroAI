// Client-safe types and constants for the Regulatory Overview (no database imports).
export const INSTRUMENT_TYPES = [
  "law",
  "royal_decree",
  "cabinet_resolution",
  "executive_regulation",
  "strategy",
  "library",
] as const;
export type InstrumentType = (typeof INSTRUMENT_TYPES)[number];
export type TimelineKind = "law" | "decision" | "event";

export type Regulator = {
  code: string;
  shortEn: string;
  shortAr: string | null;
  nameEn: string;
  nameAr: string | null;
  roleEn: string | null;
  roleAr: string | null;
  icon: string;
  website: string | null;
  regulationCount: number;
};

export type Regulation = {
  id: string;
  titleEn: string;
  titleAr: string | null;
  regulatorCode: string | null;
  issuerLabel: string | null;
  instrumentType: InstrumentType;
  reference: string | null;
  gregorianDate: string | null;
  hijriDate: string | null;
  status: "active" | "superseded";
  documentUrl: string | null;
  sourceId: string | null;
  isIllustrative: boolean;
  notesEn: string | null;
  notesAr: string | null;
};

export type TimelineEvent = {
  id: string;
  kind: TimelineKind;
  gregorianDate: string | null;
  hijriDate: string | null;
  titleEn: string;
  titleAr: string | null;
  isIllustrative: boolean;
  regulationId: string | null;
};

export type RegulatoryOverview = {
  regulators: Regulator[];
  timeline: TimelineEvent[];
  regulations: Regulation[];
  typeCounts: Record<InstrumentType, number> & { all: number };
};

export type RegulatoryFilters = { regulator?: string; type?: string };
