// Client-safe types and constants for the Source Library (no database imports).
export const SOURCE_CATEGORIES = ["regulatory", "scientific", "initiatives", "portals", "indices"] as const;
export type SourceCategory = (typeof SOURCE_CATEGORIES)[number];
export type AccessTag = "free" | "registration" | "paid";

export type SourceVerification = {
  id: string;
  issue: string;
  action: string | null;
};

export type SourceItem = {
  id: string;
  category: SourceCategory;
  nameEn: string;
  nameAr: string | null;
  organizationEn: string | null;
  organizationAr: string | null;
  subCategoryEn: string | null;
  subCategoryAr: string | null;
  mainUrl: string | null;
  dataUrl: string | null;
  dataHint: string | null;
  formats: string | null;
  languages: string | null;
  access: string | null;
  accessTags: AccessTag[];
  unverified: boolean;
  notesEn: string | null;
  notesAr: string | null;
  /** verification notes that apply to this source */
  flags: SourceVerification[];
};

export type VerificationItem = {
  id: string;
  item: string;
  tab: string | null;
  category: SourceCategory | null;
  issue: string;
  action: string | null;
  sourceIds: string[];
};

export type SourcesPage = {
  items: SourceItem[];
  verification: VerificationItem[];
  counts: Record<SourceCategory, number> & { all: number; flagged: number; verification: number };
};

export type SourceFilters = {
  category?: string;
  q?: string;
  access?: string;
  flagged?: boolean;
};
