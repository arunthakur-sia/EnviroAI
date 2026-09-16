-- CR07: lessons linked to many strategy nodes, the Council Strategy, and the
-- Organisation module. Additive except for the departments -> org_units rename,
-- which keeps a read-only `departments` view so raw SQL written before CR07
-- (probes, the smoke suite) still reads.

-- 1.2 Lessons link to many nodes -----------------------------------------
CREATE TABLE IF NOT EXISTS `lesson_node_links` (
  `id` text PRIMARY KEY NOT NULL,
  `lesson_id` text NOT NULL,
  `node_id` text NOT NULL,
  -- nds = strategy_nodes, council = council_nodes
  `node_kind` text NOT NULL DEFAULT 'nds',
  `is_primary` integer NOT NULL DEFAULT 0,
  `linked_by` text,
  `linked_at` text NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `lesson_links_lesson_idx` ON `lesson_node_links` (`lesson_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `lesson_links_node_idx` ON `lesson_node_links` (`node_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `lesson_links_unique` ON `lesson_node_links` (`lesson_id`, `node_id`, `node_kind`);
--> statement-breakpoint

-- migrate the single lessons.node_id into a primary link
INSERT INTO `lesson_node_links` (`id`, `lesson_id`, `node_id`, `node_kind`, `is_primary`, `linked_by`, `linked_at`)
SELECT
  lower(hex(randomblob(16))),
  l.`id`,
  l.`node_id`,
  'nds',
  1,
  l.`author_id`,
  l.`created_at`
FROM `lessons` l
WHERE l.`node_id` IS NOT NULL
  AND l.`node_id` <> ''
  AND NOT EXISTS (
    SELECT 1 FROM `lesson_node_links` x WHERE x.`lesson_id` = l.`id` AND x.`node_id` = l.`node_id`
  );
--> statement-breakpoint

-- 3.2 departments become org_units ---------------------------------------
-- The rename keeps every existing id, so users.department_id, node_leads,
-- stakeholders, HR rows and indicators all keep pointing at the same units.
-- idempotent: the rename runs once; on a rerun `departments` is already a view
ALTER TABLE `departments` RENAME TO `org_units`;
--> statement-breakpoint

ALTER TABLE `org_units` ADD COLUMN `level` text NOT NULL DEFAULT 'department';
--> statement-breakpoint
ALTER TABLE `org_units` ADD COLUMN `mandate_en` text;
--> statement-breakpoint
ALTER TABLE `org_units` ADD COLUMN `mandate_ar` text;
--> statement-breakpoint
ALTER TABLE `org_units` ADD COLUMN `mandate_source_url` text;
--> statement-breakpoint
ALTER TABLE `org_units` ADD COLUMN `mandate_source_url_ar` text;
--> statement-breakpoint
ALTER TABLE `org_units` ADD COLUMN `mandate_fetched_at` text;
--> statement-breakpoint
ALTER TABLE `org_units` ADD COLUMN `head_name_en` text;
--> statement-breakpoint
ALTER TABLE `org_units` ADD COLUMN `head_name_ar` text;
--> statement-breakpoint
ALTER TABLE `org_units` ADD COLUMN `head_title_en` text;
--> statement-breakpoint
ALTER TABLE `org_units` ADD COLUMN `head_title_ar` text;
--> statement-breakpoint
ALTER TABLE `org_units` ADD COLUMN `sort` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `org_units` ADD COLUMN `is_active` integer NOT NULL DEFAULT 1;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `org_units_parent_idx` ON `org_units` (`parent_id`);
--> statement-breakpoint

-- read-only compatibility view for SQL written against the old name
CREATE VIEW IF NOT EXISTS `departments` AS
SELECT `id`, `code`, `name_en`, `name_ar`, `description_en`, `description_ar`,
       `head_user_id`, `parent_id`, `responsibilities_en`, `responsibilities_ar`,
       `key_projects_note`, `created_at`, `updated_at`
FROM `org_units`;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `org_unit_members` (
  `id` text PRIMARY KEY NOT NULL,
  `unit_id` text NOT NULL,
  `user_id` text NOT NULL,
  -- head | deputy | member
  `role_in_unit` text NOT NULL DEFAULT 'member',
  `since` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS `org_unit_members_unique` ON `org_unit_members` (`unit_id`, `user_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `org_sync_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `fetched_at` text NOT NULL,
  `diff_json` text,
  `applied_by` text,
  `applied_at` text
);
--> statement-breakpoint

-- 3.5 Policies and procedures ---------------------------------------------
CREATE TABLE IF NOT EXISTS `document_unit_links` (
  `id` text PRIMARY KEY NOT NULL,
  `document_id` text NOT NULL,
  `unit_id` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS `document_unit_unique` ON `document_unit_links` (`document_id`, `unit_id`);
--> statement-breakpoint

-- all_staff | unit_only | restricted
ALTER TABLE `documents` ADD COLUMN `visibility_scope` text NOT NULL DEFAULT 'all_staff';
--> statement-breakpoint
-- json array of user ids and role ids allowed when visibility_scope = restricted
ALTER TABLE `documents` ADD COLUMN `visibility_allow_json` text;
--> statement-breakpoint
ALTER TABLE `documents` ADD COLUMN `effective_from` text;
--> statement-breakpoint
ALTER TABLE `documents` ADD COLUMN `version_label` text;
--> statement-breakpoint
ALTER TABLE `documents` ADD COLUMN `review_cycle_months` integer;
--> statement-breakpoint
ALTER TABLE `documents` ADD COLUMN `supersedes_document_id` text;
--> statement-breakpoint

-- 2.3 Council Strategy -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `council_strategies` (
  `id` text PRIMARY KEY NOT NULL,
  `name_en` text NOT NULL,
  `name_ar` text NOT NULL,
  `period_from` text,
  `period_to` text,
  `vision_en` text,
  `vision_ar` text,
  `mission_en` text,
  `mission_ar` text,
  `values_json` text,
  `status` text NOT NULL DEFAULT 'live',
  `is_default` integer NOT NULL DEFAULT 0,
  `approved_on` text,
  `source_document_id` text,
  `owner_unit_id` text,
  `is_illustrative` integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `council_analysis` (
  `id` text PRIMARY KEY NOT NULL,
  `strategy_id` text NOT NULL,
  -- swot | stakeholder | challenge | baseline
  `kind` text NOT NULL,
  `payload_json` text NOT NULL,
  `sort` integer NOT NULL DEFAULT 0
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `council_analysis_strategy_idx` ON `council_analysis` (`strategy_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `council_nodes` (
  `id` text PRIMARY KEY NOT NULL,
  `strategy_id` text NOT NULL,
  `parent_id` text,
  -- goal | intermediate_outcome | output | project | activity
  `level` text NOT NULL,
  `code` text,
  `title_en` text NOT NULL,
  `title_ar` text NOT NULL,
  `description_en` text,
  `description_ar` text,
  `owner_unit_id` text,
  `owner_user_id` text,
  `status` text NOT NULL DEFAULT 'not_started',
  `start_date` text,
  `end_date` text,
  `budget_qar` real,
  `inputs_json` text,
  `priority_impact` integer,
  `priority_feasibility` integer,
  `sort` integer NOT NULL DEFAULT 0,
  `source_ref` text,
  `is_illustrative` integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `council_nodes_strategy_idx` ON `council_nodes` (`strategy_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `council_nodes_parent_idx` ON `council_nodes` (`parent_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `council_nodes_level_idx` ON `council_nodes` (`level`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `council_indicators` (
  `id` text PRIMARY KEY NOT NULL,
  `node_id` text NOT NULL,
  `code` text,
  `name_en` text NOT NULL,
  `name_ar` text NOT NULL,
  `definition_en` text,
  `definition_ar` text,
  `formula_en` text,
  `formula_ar` text,
  `unit` text,
  -- up_good | down_good
  `direction` text NOT NULL DEFAULT 'up_good',
  `baseline_year` text,
  `baseline_value` real,
  -- monthly | quarterly | yearly
  `frequency` text NOT NULL DEFAULT 'yearly',
  `data_source_en` text,
  `data_source_ar` text,
  `means_of_verification_en` text,
  `means_of_verification_ar` text,
  `responsible_user_id` text,
  `linked_statistics_indicator_id` text,
  `notes_en` text,
  `notes_ar` text,
  `sort` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `council_indicators_node_idx` ON `council_indicators` (`node_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `council_indicator_targets` (
  `id` text PRIMARY KEY NOT NULL,
  `indicator_id` text NOT NULL,
  -- 2026 | 2026-Q3 | 2026-07
  `period` text NOT NULL,
  `target_value` real
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS `council_targets_unique` ON `council_indicator_targets` (`indicator_id`, `period`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `council_indicator_values` (
  `id` text PRIMARY KEY NOT NULL,
  `indicator_id` text NOT NULL,
  `period` text NOT NULL,
  `actual_value` real,
  -- provisional | final
  `status` text NOT NULL DEFAULT 'provisional',
  `source_document_id` text,
  `entered_by` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS `council_values_unique` ON `council_indicator_values` (`indicator_id`, `period`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `council_milestones` (
  `id` text PRIMARY KEY NOT NULL,
  `node_id` text NOT NULL,
  `title_en` text NOT NULL,
  `title_ar` text NOT NULL,
  `due_date` text,
  `done_date` text,
  `status` text NOT NULL DEFAULT 'planned',
  `sort` integer NOT NULL DEFAULT 0
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `council_milestones_node_idx` ON `council_milestones` (`node_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `council_dependencies` (
  `id` text PRIMARY KEY NOT NULL,
  `node_id` text NOT NULL,
  `depends_on_node_id` text NOT NULL,
  `note_en` text,
  `note_ar` text
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `council_dependencies_node_idx` ON `council_dependencies` (`node_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `council_risks` (
  `id` text PRIMARY KEY NOT NULL,
  `strategy_id` text NOT NULL,
  `node_id` text,
  `code` text,
  `title_en` text NOT NULL,
  `title_ar` text NOT NULL,
  `description_en` text,
  `description_ar` text,
  `likelihood` integer NOT NULL DEFAULT 3,
  `impact` integer NOT NULL DEFAULT 3,
  `owner_user_id` text,
  `mitigation_en` text,
  `mitigation_ar` text,
  -- open | mitigating | closed
  `status` text NOT NULL DEFAULT 'open',
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `council_risks_strategy_idx` ON `council_risks` (`strategy_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `council_governance` (
  `id` text PRIMARY KEY NOT NULL,
  `strategy_id` text NOT NULL,
  `body_name_en` text NOT NULL,
  `body_name_ar` text NOT NULL,
  `role_en` text,
  `role_ar` text,
  `cadence` text,
  `members_json` text,
  `sort` integer NOT NULL DEFAULT 0
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `council_alignment` (
  `id` text PRIMARY KEY NOT NULL,
  `council_node_id` text NOT NULL,
  -- nds_node | nds_kpi | data_strategy_initiative
  `target_kind` text NOT NULL DEFAULT 'nds_node',
  `target_id` text NOT NULL,
  `label_en` text,
  `label_ar` text,
  `note_en` text,
  `note_ar` text
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `council_alignment_node_idx` ON `council_alignment` (`council_node_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `council_change_log` (
  `id` text PRIMARY KEY NOT NULL,
  `strategy_id` text NOT NULL,
  `entity_kind` text NOT NULL,
  `entity_id` text NOT NULL,
  `action` text NOT NULL,
  `detail_json` text,
  `actor_id` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `council_change_log_strategy_idx` ON `council_change_log` (`strategy_id`);
--> statement-breakpoint

-- 2.3 shared tables gain the council discriminator
ALTER TABLE `node_leads` ADD COLUMN `node_kind` text NOT NULL DEFAULT 'nds';
--> statement-breakpoint
ALTER TABLE `node_stakeholders` ADD COLUMN `node_kind` text NOT NULL DEFAULT 'nds';
--> statement-breakpoint
ALTER TABLE `signal_links` ADD COLUMN `node_kind` text NOT NULL DEFAULT 'nds';
--> statement-breakpoint
