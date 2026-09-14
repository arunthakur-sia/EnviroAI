-- CR05: responsible entities, stakeholders, the International Indices module,
-- the HR Knowledge Dashboard, and the access model. Additive only.

-- 2.1 Responsible entities ------------------------------------------------
CREATE TABLE IF NOT EXISTS `entities` (
  `id` text PRIMARY KEY NOT NULL,
  `name_en` text NOT NULL,
  `name_ar` text NOT NULL,
  `short_name_en` text,
  `short_name_ar` text,
  `kind` text NOT NULL DEFAULT 'ministry',
  `logo_path` text,
  `website` text,
  `contact_name` text,
  `contact_email` text,
  `is_active` integer NOT NULL DEFAULT 1,
  `name_ar_machine` integer NOT NULL DEFAULT 0,
  `merged_into_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `node_leads` (
  `id` text PRIMARY KEY NOT NULL,
  `node_id` text NOT NULL,
  `lead_kind` text NOT NULL,
  `department_id` text,
  `entity_id` text,
  `role` text NOT NULL DEFAULT 'lead',
  `sort` integer NOT NULL DEFAULT 0,
  `verified` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `node_leads_node_idx` ON `node_leads` (`node_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `node_leads_entity_idx` ON `node_leads` (`entity_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `node_leads_department_idx` ON `node_leads` (`department_id`);
--> statement-breakpoint

-- 3.1 Stakeholders --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `node_stakeholders` (
  `id` text PRIMARY KEY NOT NULL,
  `node_id` text NOT NULL,
  `person_kind` text NOT NULL DEFAULT 'employee',
  `user_id` text,
  `expert_id` text,
  `name_en` text,
  `name_ar` text,
  `organisation` text,
  `email` text,
  `role` text NOT NULL DEFAULT 'team',
  `role_note_en` text,
  `role_note_ar` text,
  `domain_term_id` text,
  `since_date` text,
  `until_date` text,
  `sort` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `node_stakeholders_node_idx` ON `node_stakeholders` (`node_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `node_stakeholders_user_idx` ON `node_stakeholders` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `node_stakeholders_expert_idx` ON `node_stakeholders` (`expert_id`);
--> statement-breakpoint

-- 4.2 International Indices -----------------------------------------------
CREATE TABLE IF NOT EXISTS `indices` (
  `id` text PRIMARY KEY NOT NULL,
  `code` text NOT NULL,
  `name_en` text NOT NULL,
  `name_ar` text NOT NULL,
  `publisher` text,
  `publisher_url` text,
  `methodology_summary_en` text,
  `methodology_summary_ar` text,
  `scale` text NOT NULL DEFAULT 'both',
  `score_min` real,
  `score_max` real,
  `higher_is_better` integer NOT NULL DEFAULT 1,
  `frequency` text NOT NULL DEFAULT 'annual',
  `latest_year` integer,
  `responsible_entity_id` text,
  `linked_node_ids_json` text,
  `category` text NOT NULL DEFAULT 'economy',
  `is_active` integer NOT NULL DEFAULT 1,
  `source_notes` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `indices_code_idx` ON `indices` (`code`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `index_observations` (
  `id` text PRIMARY KEY NOT NULL,
  `index_id` text NOT NULL,
  `country_code` text NOT NULL,
  `year` integer NOT NULL,
  `rank` integer,
  `score` real,
  `total_countries` integer,
  `source_url` text,
  `fetched_at` text,
  `status` text NOT NULL DEFAULT 'fetched'
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `index_obs_unique` ON `index_observations` (`index_id`, `country_code`, `year`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `index_obs_index_idx` ON `index_observations` (`index_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `index_pillars` (
  `id` text PRIMARY KEY NOT NULL,
  `index_id` text NOT NULL,
  `pillar_code` text NOT NULL,
  `name_en` text NOT NULL,
  `name_ar` text NOT NULL,
  `sort` integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `index_pillars_index_idx` ON `index_pillars` (`index_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `index_pillar_values` (
  `id` text PRIMARY KEY NOT NULL,
  `index_id` text NOT NULL,
  `pillar_code` text NOT NULL,
  `country_code` text NOT NULL,
  `year` integer NOT NULL,
  `rank` integer,
  `score` real,
  `source_url` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `index_pillar_values_unique` ON `index_pillar_values` (`index_id`, `pillar_code`, `country_code`, `year`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `countries` (
  `iso3` text PRIMARY KEY NOT NULL,
  `name_en` text NOT NULL,
  `name_ar` text NOT NULL,
  `region` text NOT NULL DEFAULT 'other'
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `peer_groups` (
  `id` text PRIMARY KEY NOT NULL,
  `name_en` text NOT NULL,
  `name_ar` text NOT NULL,
  `country_codes_json` text NOT NULL,
  `is_default` integer NOT NULL DEFAULT 0,
  `owner_user_id` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `index_forecasts` (
  `id` text PRIMARY KEY NOT NULL,
  `index_id` text NOT NULL,
  `generated_at` text NOT NULL,
  `horizon_years` integer NOT NULL,
  `central_rank` real,
  `central_score` real,
  `low` real,
  `high` real,
  `rank_low` real,
  `rank_high` real,
  `direction` text NOT NULL DEFAULT 'stable',
  `method_version` text NOT NULL DEFAULT 'v1',
  `assumptions_json` text,
  `inputs_json` text,
  `simulation_summary_json` text,
  `explanation_en` text,
  `explanation_ar` text,
  `status` text NOT NULL DEFAULT 'current'
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `index_forecasts_index_idx` ON `index_forecasts` (`index_id`, `status`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `index_forecast_assumptions` (
  `id` text PRIMARY KEY NOT NULL,
  `index_id` text,
  `key` text NOT NULL,
  `value` real NOT NULL,
  `min` real NOT NULL,
  `max` real NOT NULL,
  `step` real NOT NULL DEFAULT 0.1,
  `label_en` text NOT NULL,
  `label_ar` text NOT NULL,
  `editable_by` text NOT NULL DEFAULT 'user_whatif'
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `index_assumptions_index_idx` ON `index_forecast_assumptions` (`index_id`);
--> statement-breakpoint

-- 5.2 HR Knowledge Dashboard ----------------------------------------------
ALTER TABLE `departments` ADD COLUMN `responsibilities_en` text;
--> statement-breakpoint
ALTER TABLE `departments` ADD COLUMN `responsibilities_ar` text;
--> statement-breakpoint
ALTER TABLE `departments` ADD COLUMN `key_projects_note` text;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `employee_status` (
  `user_id` text PRIMARY KEY NOT NULL,
  `status` text NOT NULL DEFAULT 'active',
  `effective_date` text,
  `target_department_id` text,
  `note` text,
  `set_by` text,
  `set_at` text NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `ownership_backups` (
  `id` text PRIMARY KEY NOT NULL,
  `resource_type` text NOT NULL,
  `resource_id` text NOT NULL,
  `backup_user_id` text NOT NULL,
  `set_by` text,
  `set_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ownership_backups_unique` ON `ownership_backups` (`resource_type`, `resource_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ownership_backups_user_idx` ON `ownership_backups` (`backup_user_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `handovers` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `kind` text NOT NULL DEFAULT 'leaving',
  `created_by` text,
  `created_at` text NOT NULL,
  `due_date` text,
  `successor_default_user_id` text,
  `status` text NOT NULL DEFAULT 'open',
  `completion_pct` integer NOT NULL DEFAULT 0,
  `completed_at` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `handovers_user_idx` ON `handovers` (`user_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `handover_items` (
  `id` text PRIMARY KEY NOT NULL,
  `handover_id` text NOT NULL,
  `item_kind` text NOT NULL,
  `resource_type` text NOT NULL,
  `resource_id` text NOT NULL,
  `title` text NOT NULL,
  `successor_user_id` text,
  `status` text NOT NULL DEFAULT 'pending',
  `note` text,
  `done_at` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `handover_items_h_idx` ON `handover_items` (`handover_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `knowledge_captures` (
  `id` text PRIMARY KEY NOT NULL,
  `handover_id` text NOT NULL,
  `lesson_id` text,
  `document_id` text,
  `topic` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `knowledge_captures_h_idx` ON `knowledge_captures` (`handover_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `hr_risks` (
  `id` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL,
  `severity` text NOT NULL DEFAULT 'medium',
  `department_id` text,
  `user_id` text,
  `resource_type` text,
  `resource_id` text,
  `title` text NOT NULL,
  `detail_en` text,
  `detail_ar` text,
  `owner_user_id` text,
  `detected_at` text NOT NULL,
  `resolved_at` text,
  `resolved_by` text,
  `resolution_note` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `hr_risks_open_idx` ON `hr_risks` (`resolved_at`, `severity`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `hr_risks_dept_idx` ON `hr_risks` (`department_id`);
--> statement-breakpoint

-- 6 Access model ------------------------------------------------------------
ALTER TABLE `roles` ADD COLUMN `portals_json` text;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `user_permission_overrides` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `permission_key` text NOT NULL,
  `effect` text NOT NULL DEFAULT 'grant',
  `reason` text,
  `set_by` text,
  `set_at` text NOT NULL,
  `expires_at` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `user_overrides_user_idx` ON `user_permission_overrides` (`user_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `invitations` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `name_en` text,
  `name_ar` text,
  `role_id` text NOT NULL,
  `department_id` text,
  `clearance_level` integer NOT NULL DEFAULT 2,
  `portals_json` text,
  `token` text NOT NULL,
  `invited_by` text,
  `created_at` text NOT NULL,
  `expires_at` text NOT NULL,
  `accepted_at` text,
  `status` text NOT NULL DEFAULT 'pending'
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `invitations_token_idx` ON `invitations` (`token`);
--> statement-breakpoint

-- 6.3 lockout counters and session inactivity
ALTER TABLE `users` ADD COLUMN `failed_logins` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `locked_until` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `password_set_at` text;
--> statement-breakpoint
ALTER TABLE `sessions` ADD COLUMN `last_seen_at` text;
