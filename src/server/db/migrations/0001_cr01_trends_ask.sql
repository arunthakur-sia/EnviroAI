CREATE TABLE `feeds` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`kind` text DEFAULT 'rss' NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`last_fetched_at` text,
	`last_error` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text NOT NULL,
	`query_en` text NOT NULL,
	`query_ar` text,
	`node_ids_json` text,
	`indicator_ids_json` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`last_run_at` text,
	`created_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text DEFAULT 'running' NOT NULL,
	`trigger` text DEFAULT 'scheduled' NOT NULL,
	`briefs_run` integer DEFAULT 0 NOT NULL,
	`candidates` integer DEFAULT 0 NOT NULL,
	`accepted_new` integer DEFAULT 0 NOT NULL,
	`duplicates` integer DEFAULT 0 NOT NULL,
	`errors_json` text,
	`tokens_in` integer DEFAULT 0 NOT NULL,
	`tokens_out` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `signal_links` (
	`id` text PRIMARY KEY NOT NULL,
	`signal_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`relation` text DEFAULT 'about' NOT NULL,
	`source` text DEFAULT 'ai' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `signal_links_signal_idx` ON `signal_links` (`signal_id`);--> statement-breakpoint
CREATE INDEX `signal_links_resource_idx` ON `signal_links` (`resource_type`,`resource_id`);--> statement-breakpoint
ALTER TABLE `ai_conversations` ADD `is_shared` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_conversations` ADD `summary` text;--> statement-breakpoint
ALTER TABLE `ai_messages` ADD `workspace_json` text;--> statement-breakpoint
ALTER TABLE `search_index` ADD `edition` text;--> statement-breakpoint
ALTER TABLE `signals` ADD `source_kind` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `signals` ADD `url` text;--> statement-breakpoint
ALTER TABLE `signals` ADD `publisher` text;--> statement-breakpoint
ALTER TABLE `signals` ADD `published_at` text;--> statement-breakpoint
ALTER TABLE `signals` ADD `signal_type` text DEFAULT 'policy' NOT NULL;--> statement-breakpoint
ALTER TABLE `signals` ADD `sentiment` text DEFAULT 'neutral' NOT NULL;--> statement-breakpoint
ALTER TABLE `signals` ADD `confidence` real;--> statement-breakpoint
ALTER TABLE `signals` ADD `why_it_matters_en` text;--> statement-breakpoint
ALTER TABLE `signals` ADD `why_it_matters_ar` text;--> statement-breakpoint
ALTER TABLE `signals` ADD `triage_status` text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `signals` ADD `triaged_by` text;--> statement-breakpoint
ALTER TABLE `signals` ADD `triaged_at` text;--> statement-breakpoint
ALTER TABLE `signals` ADD `converted_resource_type` text;--> statement-breakpoint
ALTER TABLE `signals` ADD `converted_resource_id` text;--> statement-breakpoint
ALTER TABLE `signals` ADD `scan_run_id` text;--> statement-breakpoint
ALTER TABLE `signals` ADD `raw_json` text;--> statement-breakpoint
ALTER TABLE `signals` ADD `source_excerpt` text;--> statement-breakpoint
ALTER TABLE `signals` ADD `embedding` blob;--> statement-breakpoint
ALTER TABLE `signals` ADD `embedding_model` text;--> statement-breakpoint
CREATE INDEX `signals_triage_idx` ON `signals` (`triage_status`);--> statement-breakpoint
CREATE INDEX `signals_published_idx` ON `signals` (`published_at`);