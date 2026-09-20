-- CR08: the organisation editor, index groups, the Reports module, the
-- handover rebuild, levels and the leaderboard, Knowledge of the Week,
-- messaging and delegates, the Operating Model and the process architecture.
-- Additive only.

-- 1.2 organisation levels, snapshots, change requests ---------------------
CREATE TABLE IF NOT EXISTS `org_levels` (
  `id` text PRIMARY KEY NOT NULL,
  `code` text NOT NULL,
  `name_en` text NOT NULL,
  `name_ar` text NOT NULL,
  `sort` integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `org_levels_code` ON `org_levels` (`code`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `org_snapshots` (
  `id` text PRIMARY KEY NOT NULL,
  `taken_at` text NOT NULL,
  `taken_by` text,
  `tree_json` text NOT NULL,
  `note` text
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `org_change_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `unit_id` text NOT NULL,
  `requested_by` text NOT NULL,
  `what` text NOT NULL,
  `why` text,
  `status` text NOT NULL DEFAULT 'open',
  `resolved_by` text,
  `resolved_at` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `org_change_requests_unit_idx` ON `org_change_requests` (`unit_id`);
--> statement-breakpoint

-- 4.1 index groups ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS `index_groups` (
  `id` text PRIMARY KEY NOT NULL,
  `code` text NOT NULL,
  `name_en` text NOT NULL,
  `name_ar` text NOT NULL,
  `description_en` text,
  `description_ar` text,
  `colour_token` text NOT NULL DEFAULT 'maroon',
  `sort` integer NOT NULL DEFAULT 0,
  `is_active` integer NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `index_groups_code` ON `index_groups` (`code`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `index_group_members` (
  `id` text PRIMARY KEY NOT NULL,
  `group_id` text NOT NULL,
  `index_id` text NOT NULL,
  `sort` integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `index_group_members_unique` ON `index_group_members` (`group_id`, `index_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `index_group_members_index_idx` ON `index_group_members` (`index_id`);
--> statement-breakpoint

-- an SDG goal record carries its goal number; a national indicator reads
-- its values from a Statistics Hub series and carries a target
ALTER TABLE `indices` ADD COLUMN `sdg_goal` integer;
--> statement-breakpoint
ALTER TABLE `indices` ADD COLUMN `linked_statistics_indicator_id` text;
--> statement-breakpoint
ALTER TABLE `indices` ADD COLUMN `target_value` real;
--> statement-breakpoint
ALTER TABLE `indices` ADD COLUMN `target_year` integer;
--> statement-breakpoint
-- rank | score | target_gap, decided per index when null
ALTER TABLE `indices` ADD COLUMN `forecast_mode` text;
--> statement-breakpoint
ALTER TABLE `indices` ADD COLUMN `forecast_enabled` integer NOT NULL DEFAULT 1;
--> statement-breakpoint

-- 5 the Reports module ------------------------------------------------------
CREATE TABLE IF NOT EXISTS `report_types` (
  `id` text PRIMARY KEY NOT NULL,
  `code` text NOT NULL,
  -- public | internal | custom
  `family` text NOT NULL DEFAULT 'internal',
  `name_en` text NOT NULL,
  `name_ar` text NOT NULL,
  `description_en` text,
  `description_ar` text,
  `default_sections_json` text NOT NULL DEFAULT '[]',
  `optional_sections_json` text NOT NULL DEFAULT '[]',
  -- npc | outcome | department | project | period
  `scope_kind` text NOT NULL DEFAULT 'npc',
  `classification_default` integer NOT NULL DEFAULT 2,
  `audience_default` text NOT NULL DEFAULT 'working',
  `cadence` text,
  `sort` integer NOT NULL DEFAULT 0,
  `is_active` integer NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `report_types_code` ON `report_types` (`code`);
--> statement-breakpoint

-- the CR02 extract reports keep their rows; the module's reports add these
ALTER TABLE `reports` ADD COLUMN `type_id` text;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `title_en` text;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `title_ar` text;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `period_json` text;
--> statement-breakpoint
-- en | ar | both
ALTER TABLE `reports` ADD COLUMN `language_mode` text;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `sections_json` text;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `requested_by` text;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `approved_by` text;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `approved_at` text;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `published_document_id` text;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `published_at` text;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `docx_path` text;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `preview_images_json` text;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `version` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `progress_json` text;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `updated_at` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reports_type_idx` ON `reports` (`type_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reports_status_idx` ON `reports` (`status`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `report_sections` (
  `id` text PRIMARY KEY NOT NULL,
  `report_id` text NOT NULL,
  `section_code` text NOT NULL,
  `sort` integer NOT NULL DEFAULT 0,
  `content_json` text,
  -- pending | generating | ready | edited | failed
  `status` text NOT NULL DEFAULT 'pending',
  `comments_json` text,
  `error` text,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `report_sections_report_idx` ON `report_sections` (`report_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `report_sections_unique` ON `report_sections` (`report_id`, `section_code`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `report_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `report_id` text NOT NULL,
  `version` integer NOT NULL,
  `docx_path` text,
  `snapshot_json` text,
  `created_by` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `report_versions_report_idx` ON `report_versions` (`report_id`);
--> statement-breakpoint

-- 6.5 the handover rebuild ---------------------------------------------------
-- employee | external
ALTER TABLE `handovers` ADD COLUMN `person_kind` text NOT NULL DEFAULT 'employee';
--> statement-breakpoint
ALTER TABLE `handovers` ADD COLUMN `expert_id` text;
--> statement-breakpoint
ALTER TABLE `handovers` ADD COLUMN `external_name` text;
--> statement-breakpoint
ALTER TABLE `handovers` ADD COLUMN `external_email` text;
--> statement-breakpoint
ALTER TABLE `handovers` ADD COLUMN `reason` text;
--> statement-breakpoint
ALTER TABLE `handovers` ADD COLUMN `last_working_day` text;
--> statement-breakpoint
ALTER TABLE `handovers` ADD COLUMN `notes` text;
--> statement-breakpoint
ALTER TABLE `handovers` ADD COLUMN `access_token_hash` text;
--> statement-breakpoint
ALTER TABLE `handovers` ADD COLUMN `access_expires_at` text;
--> statement-breakpoint
ALTER TABLE `handovers` ADD COLUMN `access_revoked_at` text;
--> statement-breakpoint
ALTER TABLE `handovers` ADD COLUMN `cut_off_at` text;
--> statement-breakpoint
ALTER TABLE `handovers` ADD COLUMN `cut_off_by` text;
--> statement-breakpoint
ALTER TABLE `handovers` ADD COLUMN `report_document_id` text;
--> statement-breakpoint
ALTER TABLE `handovers` ADD COLUMN `override_reason` text;
--> statement-breakpoint
ALTER TABLE `handovers` ADD COLUMN `override_by` text;
--> statement-breakpoint
ALTER TABLE `handovers` ADD COLUMN `interview_required` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `handovers` ADD COLUMN `updated_at` text;
--> statement-breakpoint

-- person | system
ALTER TABLE `handover_items` ADD COLUMN `recipient_kind` text;
--> statement-breakpoint
ALTER TABLE `handover_items` ADD COLUMN `recipient_user_id` text;
--> statement-breakpoint
ALTER TABLE `handover_items` ADD COLUMN `category` text;
--> statement-breakpoint
ALTER TABLE `handover_items` ADD COLUMN `in_scope` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `handover_items` ADD COLUMN `filing_proposal_json` text;
--> statement-breakpoint
-- none | proposed | approved | applied
ALTER TABLE `handover_items` ADD COLUMN `filing_status` text NOT NULL DEFAULT 'none';
--> statement-breakpoint
ALTER TABLE `handover_items` ADD COLUMN `understood_at` text;
--> statement-breakpoint
ALTER TABLE `handover_items` ADD COLUMN `added_by` text;
--> statement-breakpoint
ALTER TABLE `handover_items` ADD COLUMN `created_at` text;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `handover_interviews` (
  `id` text PRIMARY KEY NOT NULL,
  `handover_id` text NOT NULL,
  `topic` text NOT NULL,
  `topic_ref_type` text,
  `topic_ref_id` text,
  `transcript_json` text,
  `structured_json` text,
  -- pending | in_progress | complete
  `status` text NOT NULL DEFAULT 'pending',
  `insight_lesson_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `handover_interviews_h_idx` ON `handover_interviews` (`handover_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `handover_learning_paths` (
  `id` text PRIMARY KEY NOT NULL,
  `handover_id` text NOT NULL,
  `recipient_user_id` text NOT NULL,
  `modules_json` text NOT NULL DEFAULT '[]',
  `progress_json` text NOT NULL DEFAULT '{}',
  `signed_off_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `handover_paths_unique` ON `handover_learning_paths` (`handover_id`, `recipient_user_id`);
--> statement-breakpoint

-- 7 levels and the leaderboard ---------------------------------------------
ALTER TABLE `levels` ADD COLUMN `descriptor_en` text;
--> statement-breakpoint
ALTER TABLE `levels` ADD COLUMN `descriptor_ar` text;
--> statement-breakpoint
ALTER TABLE `game_rules` ADD COLUMN `excluded_from_boards` integer NOT NULL DEFAULT 0;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `leaderboard_periods` (
  `id` text PRIMARY KEY NOT NULL,
  -- people | departments
  `board` text NOT NULL,
  -- overall | contributors | guardians | learners
  `category` text NOT NULL,
  -- week | month | quarter | year | all
  `period_kind` text NOT NULL,
  `period_key` text NOT NULL,
  `subject_id` text NOT NULL,
  `points` integer NOT NULL DEFAULT 0,
  `rank` integer NOT NULL DEFAULT 0,
  `previous_points` integer NOT NULL DEFAULT 0,
  `previous_rank` integer,
  `members` integer,
  `active_members` integer,
  `refreshed_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `leaderboard_periods_unique` ON `leaderboard_periods` (`board`, `category`, `period_kind`, `period_key`, `subject_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `leaderboard_periods_lookup` ON `leaderboard_periods` (`board`, `category`, `period_kind`, `period_key`, `rank`);
--> statement-breakpoint

-- 8 Knowledge of the Week ---------------------------------------------------
CREATE TABLE IF NOT EXISTS `knowledge_of_week` (
  `id` text PRIMARY KEY NOT NULL,
  `week_start` text NOT NULL,
  -- document | lesson | study | report
  `resource_type` text NOT NULL,
  `resource_id` text NOT NULL,
  `contributor_user_id` text,
  `unit_id` text,
  `note_en` text,
  `note_ar` text,
  `set_by` text,
  `set_at` text NOT NULL,
  -- scheduled | active | archived
  `status` text NOT NULL DEFAULT 'scheduled',
  `read_count` integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `knowledge_of_week_week` ON `knowledge_of_week` (`week_start`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `knowledge_of_week_reads` (
  `id` text PRIMARY KEY NOT NULL,
  `kow_id` text NOT NULL,
  `user_id` text NOT NULL,
  `read_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `kow_reads_unique` ON `knowledge_of_week_reads` (`kow_id`, `user_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `knowledge_of_week_seen` (
  `id` text PRIMARY KEY NOT NULL,
  `kow_id` text NOT NULL,
  `user_id` text NOT NULL,
  `seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `kow_seen_unique` ON `knowledge_of_week_seen` (`kow_id`, `user_id`);
--> statement-breakpoint

-- 9 messaging and delegates --------------------------------------------------
CREATE TABLE IF NOT EXISTS `message_threads` (
  `id` text PRIMARY KEY NOT NULL,
  `subject` text NOT NULL,
  `resource_type` text,
  `resource_id` text,
  `resource_title` text,
  `resource_link` text,
  `created_by` text NOT NULL,
  `created_at` text NOT NULL,
  `last_message_at` text NOT NULL,
  -- open | done
  `status` text NOT NULL DEFAULT 'open',
  `question_id` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `message_threads_last_idx` ON `message_threads` (`last_message_at`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `thread_participants` (
  `id` text PRIMARY KEY NOT NULL,
  `thread_id` text NOT NULL,
  `user_id` text NOT NULL,
  `last_read_at` text,
  `is_delegate_for_user_id` text,
  `done_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `thread_participants_unique` ON `thread_participants` (`thread_id`, `user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `thread_participants_user_idx` ON `thread_participants` (`user_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `messages` (
  `id` text PRIMARY KEY NOT NULL,
  `thread_id` text NOT NULL,
  `sender_id` text NOT NULL,
  `body` text NOT NULL,
  `attachments_json` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `messages_thread_idx` ON `messages` (`thread_id`, `created_at`);
--> statement-breakpoint

ALTER TABLE `users` ADD COLUMN `delegate_user_id` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `delegate_from` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `delegate_to` text;
--> statement-breakpoint

-- 10 the process architecture and the Operating Model ---------------------
CREATE TABLE IF NOT EXISTS `processes` (
  `id` text PRIMARY KEY NOT NULL,
  `parent_id` text,
  -- 0 value chain, 1 process, 2 procedure or SOP
  `level` integer NOT NULL DEFAULT 1,
  `code` text NOT NULL,
  `name_en` text NOT NULL,
  `name_ar` text NOT NULL,
  `purpose_en` text,
  `purpose_ar` text,
  `owner_unit_id` text,
  `inputs_json` text,
  `outputs_json` text,
  `steps_json` text,
  `systems_json` text,
  `kpis_json` text,
  `policy_document_ids_json` text,
  `sop_document_ids_json` text,
  `status` text NOT NULL DEFAULT 'active',
  `sort` integer NOT NULL DEFAULT 0,
  `is_illustrative` integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `processes_code` ON `processes` (`code`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `processes_parent_idx` ON `processes` (`parent_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `processes_owner_idx` ON `processes` (`owner_unit_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `process_raci` (
  `id` text PRIMARY KEY NOT NULL,
  `process_id` text NOT NULL,
  `unit_id` text NOT NULL,
  -- R | A | C | I
  `role` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `process_raci_unique` ON `process_raci` (`process_id`, `unit_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `operating_principles` (
  `id` text PRIMARY KEY NOT NULL,
  `sort` integer NOT NULL DEFAULT 0,
  `title_en` text NOT NULL,
  `title_ar` text NOT NULL,
  `text_en` text,
  `text_ar` text,
  `is_illustrative` integer NOT NULL DEFAULT 1
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `calendar_events` (
  `id` text PRIMARY KEY NOT NULL,
  -- strategy_review | budget | statistical_release | nds_review | council_meeting | report_deadline | forum | other
  `kind` text NOT NULL,
  `title_en` text NOT NULL,
  `title_ar` text NOT NULL,
  `date_from` text NOT NULL,
  `date_to` text,
  `owner_unit_id` text,
  `linked_resource_type` text,
  `linked_resource_id` text,
  -- none | annual | quarterly | monthly
  `recurrence` text NOT NULL DEFAULT 'none',
  `is_illustrative` integer NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `calendar_events_date_idx` ON `calendar_events` (`date_from`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `unit_interfaces` (
  `id` text PRIMARY KEY NOT NULL,
  `from_unit_id` text NOT NULL,
  `to_unit_id` text NOT NULL,
  -- data | input | approval | review | deliverable
  `flow_kind` text NOT NULL DEFAULT 'data',
  `description_en` text,
  `description_ar` text,
  `trigger_en` text,
  `trigger_ar` text,
  `cadence` text,
  `service_level` text,
  `process_id` text,
  `focal_from_user_id` text,
  `focal_to_user_id` text,
  `status` text NOT NULL DEFAULT 'active',
  `is_illustrative` integer NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `unit_interfaces_from_idx` ON `unit_interfaces` (`from_unit_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `unit_interfaces_to_idx` ON `unit_interfaces` (`to_unit_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `entity_interfaces` (
  `id` text PRIMARY KEY NOT NULL,
  `entity_id` text NOT NULL,
  `provides_en` text,
  `provides_ar` text,
  `receives_en` text,
  `receives_ar` text,
  `focal_npc_user_id` text,
  `focal_entity_name` text,
  `legal_basis_en` text,
  `legal_basis_ar` text,
  `cadence` text,
  `process_ids_json` text,
  `is_illustrative` integer NOT NULL DEFAULT 1
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `interface_change_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `interface_id` text,
  `from_unit_id` text,
  `to_unit_id` text,
  `requested_by` text NOT NULL,
  `text` text NOT NULL,
  `status` text NOT NULL DEFAULT 'open',
  `resolved_by` text,
  `resolved_at` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `ops_kpis` (
  `id` text PRIMARY KEY NOT NULL,
  `code` text NOT NULL,
  `name_en` text NOT NULL,
  `name_ar` text NOT NULL,
  `unit` text,
  `direction` text NOT NULL DEFAULT 'up_good',
  -- auto | manual
  `source_kind` text NOT NULL DEFAULT 'manual',
  `target_value` real,
  `sort` integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ops_kpis_code` ON `ops_kpis` (`code`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `ops_kpi_values` (
  `id` text PRIMARY KEY NOT NULL,
  `kpi_id` text NOT NULL,
  `period` text NOT NULL,
  `value` real,
  `entered_by` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ops_kpi_values_unique` ON `ops_kpi_values` (`kpi_id`, `period`);
--> statement-breakpoint

-- 12.3 indexes the earlier migrations left out (added here so Phase A can
-- verify them from a clean database)
CREATE INDEX IF NOT EXISTS `documents_created_idx` ON `documents` (`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `documents_classification_idx` ON `documents` (`classification_level`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `documents_type_idx` ON `documents` (`knowledge_type_term_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `lessons_status_idx` ON `lessons` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `lessons_created_idx` ON `lessons` (`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `notifications_user_read_idx` ON `notifications` (`user_id`, `read_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `game_events_created_idx` ON `game_events` (`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `council_values_period_idx` ON `council_indicator_values` (`period`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `index_obs_year_idx` ON `index_observations` (`year`);
--> statement-breakpoint
-- CR08 Phase B: the audit trail of one resource walked the whole created_at
-- index looking for a rare resource; this answers it directly.
CREATE INDEX IF NOT EXISTS `audit_resource_idx` ON `audit_log` (`resource_type`, `resource_id`, `created_at`);
--> statement-breakpoint

-- 3 External experts carry the country of their organisation (ISO 3166-1
-- alpha-2), a filter the External view needs; internal experts leave it null.
ALTER TABLE `experts` ADD COLUMN `country` text;
--> statement-breakpoint
