-- EnviroAI KSA modules: the Source Library and the Regulatory Overview.
-- Additive only.

CREATE TABLE IF NOT EXISTS `ksa_sources` (
  `id` text PRIMARY KEY NOT NULL,
  `category` text NOT NULL,
  `sort_order` integer NOT NULL DEFAULT 0,
  `name_en` text NOT NULL,
  `name_ar` text,
  `organization_en` text,
  `organization_ar` text,
  `sub_category_en` text,
  `sub_category_ar` text,
  `main_url` text,
  `data_url` text,
  `data_hint` text,
  `formats` text,
  `languages` text,
  `access` text,
  `access_tags` text NOT NULL DEFAULT '[]',
  `unverified` integer NOT NULL DEFAULT 0,
  `notes_en` text,
  `notes_ar` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ksa_sources_category_idx` ON `ksa_sources` (`category`, `sort_order`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `ksa_verification_notes` (
  `id` text PRIMARY KEY NOT NULL,
  `sort_order` integer NOT NULL DEFAULT 0,
  `item` text NOT NULL,
  `tab` text,
  `category` text,
  `issue` text NOT NULL,
  `action` text,
  `source_ids_json` text NOT NULL DEFAULT '[]',
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ksa_verification_sort_idx` ON `ksa_verification_notes` (`sort_order`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `ksa_regulators` (
  `id` text PRIMARY KEY NOT NULL,
  `code` text NOT NULL,
  `sort_order` integer NOT NULL DEFAULT 0,
  `short_en` text NOT NULL,
  `short_ar` text,
  `name_en` text NOT NULL,
  `name_ar` text,
  `role_en` text,
  `role_ar` text,
  `icon` text NOT NULL DEFAULT 'landmark',
  `website` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ksa_regulators_code_unique` ON `ksa_regulators` (`code`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `ksa_regulations` (
  `id` text PRIMARY KEY NOT NULL,
  `title_en` text NOT NULL,
  `title_ar` text,
  `regulator_code` text,
  `issuer_label` text,
  `instrument_type` text NOT NULL,
  `reference` text,
  `gregorian_date` text,
  `hijri_date` text,
  `status` text NOT NULL DEFAULT 'active',
  `document_url` text,
  `source_id` text,
  `is_illustrative` integer NOT NULL DEFAULT 0,
  `notes_en` text,
  `notes_ar` text,
  `sort_order` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ksa_regulations_regulator_idx` ON `ksa_regulations` (`regulator_code`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `ksa_timeline_events` (
  `id` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL,
  `sort_order` integer NOT NULL DEFAULT 0,
  `gregorian_date` text,
  `hijri_date` text,
  `title_en` text NOT NULL,
  `title_ar` text,
  `is_illustrative` integer NOT NULL DEFAULT 0,
  `regulation_id` text,
  `created_at` text NOT NULL
);
