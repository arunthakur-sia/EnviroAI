// EnviroAI KSA modules: the Source Library and the Regulatory Overview.
// Same conventions as schema.ts: text ULID-style ids, ISO timestamps,
// bilingual fields as _en/_ar pairs. An empty Arabic field means "fall back
// to English" at read time; nothing here is machine-translated.
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/* ---------------- Source Library ---------------- */

export const ksaSources = sqliteTable(
  "ksa_sources",
  {
    id: text("id").primaryKey(),
    /** regulatory | scientific | initiatives | portals | indices */
    category: text("category").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar"),
    organizationEn: text("organization_en"),
    organizationAr: text("organization_ar"),
    subCategoryEn: text("sub_category_en"),
    subCategoryAr: text("sub_category_ar"),
    mainUrl: text("main_url"),
    dataUrl: text("data_url"),
    /** non-URL guidance from the databank's URL columns (for example a search filter) */
    dataHint: text("data_hint"),
    formats: text("formats"),
    languages: text("languages"),
    /** the databank's access text, verbatim */
    access: text("access"),
    /** JSON array of free | registration | paid derived from `access` */
    accessTags: text("access_tags").notNull().default("[]"),
    /** the databank itself marks the access or status as unverified or unclear */
    unverified: integer("unverified").notNull().default(0),
    notesEn: text("notes_en"),
    notesAr: text("notes_ar"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("ksa_sources_category_idx").on(t.category, t.sortOrder)]
);

export const ksaVerificationNotes = sqliteTable(
  "ksa_verification_notes",
  {
    id: text("id").primaryKey(),
    sortOrder: integer("sort_order").notNull().default(0),
    item: text("item").notNull(),
    tab: text("tab"),
    category: text("category"),
    issue: text("issue").notNull(),
    action: text("action"),
    /** JSON array of ksa_sources ids this note applies to (may be empty) */
    sourceIdsJson: text("source_ids_json").notNull().default("[]"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("ksa_verification_sort_idx").on(t.sortOrder)]
);

/* ---------------- Regulatory Overview ---------------- */

export const ksaRegulators = sqliteTable("ksa_regulators", {
  id: text("id").primaryKey(),
  /** MEWA | NCEC | NCW | NCVC | MWAN | ENVFUND */
  code: text("code").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  shortEn: text("short_en").notNull(),
  shortAr: text("short_ar"),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar"),
  /** one-line role for cards whose name is short (the Environment Fund) */
  roleEn: text("role_en"),
  roleAr: text("role_ar"),
  /** lucide-react icon name, resolved in the client */
  icon: text("icon").notNull().default("landmark"),
  website: text("website"),
  createdAt: text("created_at").notNull(),
});

export const ksaRegulations = sqliteTable(
  "ksa_regulations",
  {
    id: text("id").primaryKey(),
    titleEn: text("title_en").notNull(),
    titleAr: text("title_ar"),
    /** ksa_regulators.code of the issuing body, or a free label for others */
    regulatorCode: text("regulator_code"),
    issuerLabel: text("issuer_label"),
    /** law | royal_decree | cabinet_resolution | executive_regulation | strategy | library */
    instrumentType: text("instrument_type").notNull(),
    /** the decree or resolution reference, only where a source confirms it */
    reference: text("reference"),
    gregorianDate: text("gregorian_date"),
    hijriDate: text("hijri_date"),
    /** active | superseded */
    status: text("status").notNull().default("active"),
    documentUrl: text("document_url"),
    /** ksa_sources.id the entry is traced to, if any */
    sourceId: text("source_id"),
    /** true when the entry is a placeholder and not a verified instrument */
    isIllustrative: integer("is_illustrative").notNull().default(0),
    notesEn: text("notes_en"),
    notesAr: text("notes_ar"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("ksa_regulations_regulator_idx").on(t.regulatorCode)]
);

export const ksaTimelineEvents = sqliteTable("ksa_timeline_events", {
  id: text("id").primaryKey(),
  /** law | decision | event */
  kind: text("kind").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  gregorianDate: text("gregorian_date"),
  hijriDate: text("hijri_date"),
  titleEn: text("title_en").notNull(),
  titleAr: text("title_ar"),
  isIllustrative: integer("is_illustrative").notNull().default(0),
  regulationId: text("regulation_id"),
  createdAt: text("created_at").notNull(),
});
