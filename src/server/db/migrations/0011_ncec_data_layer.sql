-- NCEC data layer, step 1 (SQLite). Twin of migrations-pg/0001_ncec_data_layer.sql; keep in step.
-- Booleans are 0/1, timestamps ISO text, JSON is text, as elsewhere in this schema.
-- Rollback: rollback/0011_ncec_data_layer.down.sql.
CREATE TABLE IF NOT EXISTS `ncec_import_batches` (
  `import_batch_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `files` text NOT NULL CHECK (json_valid(`files`)),
  `counts` text NOT NULL CHECK (json_valid(`counts`)),
  `imported_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ncec_classifications` (
  `code` text PRIMARY KEY NOT NULL CHECK (`code` IN ('public', 'restricted', 'secret', 'top_secret')),
  `name_ar` text NOT NULL,
  `name_en` text NOT NULL,
  `layer` integer NOT NULL CHECK (`layer` BETWEEN 1 AND 3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ncec_departments` (
  `dept_id` text PRIMARY KEY NOT NULL,
  `name_ar` text NOT NULL UNIQUE,
  `name_en` text NOT NULL,
  `name_en_status` text NOT NULL DEFAULT 'working_translation',
  `unit_type` text NOT NULL CHECK (`unit_type` IN ('executive_department', 'general_department', 'department')),
  `parent_dept_id` text REFERENCES `ncec_departments` (`dept_id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ncec_departments_parent_idx` ON `ncec_departments` (`parent_dept_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ncec_datasets` (
  `dataset_id` text PRIMARY KEY NOT NULL CHECK (`dataset_id` GLOB 'DS-[0-9][0-9][0-9]'),
  `register_order` integer NOT NULL UNIQUE,
  `name_ar` text NOT NULL UNIQUE,
  `name_en` text NOT NULL,
  `name_en_status` text NOT NULL DEFAULT 'working_translation',
  `domain` text CHECK (`domain` IN ('core_environmental', 'corporate_support')),
  `exec_dept_id` text NOT NULL REFERENCES `ncec_departments` (`dept_id`),
  `general_dept_id` text REFERENCES `ncec_departments` (`dept_id`),
  `import_batch_id` integer REFERENCES `ncec_import_batches` (`import_batch_id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ncec_datasets_exec_idx` ON `ncec_datasets` (`exec_dept_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ncec_datasets_general_idx` ON `ncec_datasets` (`general_dept_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ncec_fields` (
  `asset_id` text PRIMARY KEY NOT NULL,
  `dataset_id` text NOT NULL REFERENCES `ncec_datasets` (`dataset_id`),
  `ordinal` integer NOT NULL,
  `register_row` integer,
  `field_kind` text NOT NULL CHECK (`field_kind` IN ('field', 'group_label', 'dataset_placeholder', 'mockup_helper')),
  `name_ar` text,
  `name_en` text,
  `name_en_status` text NOT NULL DEFAULT 'working_translation',
  `register_classification` text REFERENCES `ncec_classifications` (`code`),
  `personal_data` text NOT NULL DEFAULT 'none' CHECK (`personal_data` IN ('none', 'personal', 'sensitive')),
  `effective_layer` integer GENERATED ALWAYS AS (
    max(
      CASE `register_classification` WHEN 'public' THEN 1 WHEN 'restricted' THEN 2 ELSE 3 END,
      CASE WHEN `personal_data` <> 'none' THEN 2 ELSE 1 END
    )
  ) STORED,
  `data_nature_ar` text,
  `description_ar` text,
  `data_steward` text,
  `steward_email` text,
  `source_system` text,
  `update_frequency_ar` text,
  `last_update_date` text,
  `update_status_ar` text,
  `notes_ar` text,
  `next_update_date` text,
  `audit_notes_ar` text,
  `import_batch_id` integer REFERENCES `ncec_import_batches` (`import_batch_id`),
  UNIQUE (`dataset_id`, `ordinal`),
  CHECK (
    (`field_kind` IN ('field', 'group_label') AND `name_ar` IS NOT NULL AND `name_en` IS NOT NULL)
    OR (`field_kind` = 'mockup_helper' AND `name_en` IS NOT NULL)
    OR (`field_kind` = 'dataset_placeholder' AND `name_ar` IS NULL AND `name_en` IS NULL)
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ncec_fields_dataset_idx` ON `ncec_fields` (`dataset_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ncec_fields_classification_idx` ON `ncec_fields` (`register_classification`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ncec_records` (
  `record_id` text PRIMARY KEY NOT NULL,
  `dataset_id` text NOT NULL REFERENCES `ncec_datasets` (`dataset_id`),
  `field_values` text NOT NULL CHECK (json_valid(`field_values`)),
  `is_dummy` integer NOT NULL CHECK (`is_dummy` IN (0, 1)),
  `data_status` text NOT NULL CHECK (`data_status` IN ('DUMMY', 'REAL')),
  `import_batch_id` integer REFERENCES `ncec_import_batches` (`import_batch_id`),
  CHECK (`is_dummy` = (`data_status` = 'DUMMY')),
  CHECK (`is_dummy` = 0 OR `record_id` LIKE 'DUM-%')
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ncec_records_dataset_idx` ON `ncec_records` (`dataset_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ncec_classification_history` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `asset_id` text NOT NULL REFERENCES `ncec_fields` (`asset_id`),
  `old_classification` text,
  `new_classification` text,
  `old_personal_data` text,
  `new_personal_data` text,
  `old_layer` integer,
  `new_layer` integer,
  `source` text NOT NULL DEFAULT 'register_import',
  `import_batch_id` integer,
  `changed_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ncec_classification_history_asset_idx` ON `ncec_classification_history` (`asset_id`);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `ncec_fields_classification_log`
AFTER UPDATE OF `register_classification`, `personal_data` ON `ncec_fields`
WHEN NEW.`register_classification` IS NOT OLD.`register_classification`
  OR NEW.`personal_data` IS NOT OLD.`personal_data`
BEGIN
  INSERT INTO `ncec_classification_history`
    (`asset_id`, `old_classification`, `new_classification`, `old_personal_data`, `new_personal_data`,
     `old_layer`, `new_layer`, `import_batch_id`)
  VALUES
    (NEW.`asset_id`, OLD.`register_classification`, NEW.`register_classification`, OLD.`personal_data`,
     NEW.`personal_data`, OLD.`effective_layer`, NEW.`effective_layer`, NEW.`import_batch_id`);
END;
