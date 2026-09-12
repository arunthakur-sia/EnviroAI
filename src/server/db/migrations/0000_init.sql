CREATE TABLE `ai_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text,
	`context_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`citations_json` text,
	`confidence` text,
	`retrieved_chunk_ids_json` text,
	`model` text,
	`tokens_in` integer,
	`tokens_out` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_messages_conv_idx` ON `ai_messages` (`conversation_id`);--> statement-breakpoint
CREATE TABLE `answers` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`author_id` text,
	`is_ai` integer DEFAULT 0 NOT NULL,
	`body_en` text,
	`body_ar` text,
	`citations_json` text,
	`confidence` text,
	`is_verified` integer DEFAULT 0 NOT NULL,
	`verified_by` text,
	`verified_at` text,
	`helpful_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `answers_question_idx` ON `answers` (`question_id`);--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`hashed_key` text NOT NULL,
	`scopes_json` text,
	`is_active` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`meta_json` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `badges` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`family` text NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text NOT NULL,
	`description_en` text,
	`description_ar` text,
	`criteria_json` text,
	`icon` text,
	`tier` text
);
--> statement-breakpoint
CREATE TABLE `bounties` (
	`id` text PRIMARY KEY NOT NULL,
	`title_en` text NOT NULL,
	`title_ar` text NOT NULL,
	`description_en` text,
	`description_ar` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`points` integer DEFAULT 80 NOT NULL,
	`term_id` text,
	`node_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`posted_by` text,
	`fulfilled_by` text,
	`fulfilled_resource_type` text,
	`fulfilled_resource_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `classification_levels` (
	`id` text PRIMARY KEY NOT NULL,
	`level` integer NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text NOT NULL,
	`color` text NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE TABLE `collection_items` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`added_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `collection_items_cidx` ON `collection_items` (`collection_id`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text NOT NULL,
	`description_en` text,
	`description_ar` text,
	`cover_style` text DEFAULT 'maroon-weave' NOT NULL,
	`owner_user_id` text,
	`department_id` text,
	`visibility` text DEFAULT 'all' NOT NULL,
	`is_featured` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `communities` (
	`id` text PRIMARY KEY NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text NOT NULL,
	`description_en` text,
	`description_ar` text,
	`term_id` text,
	`lead_user_id` text,
	`cover_style` text DEFAULT 'gulf-weave' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `community_members` (
	`id` text PRIMARY KEY NOT NULL,
	`community_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_card_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`chosen_index` integer NOT NULL,
	`is_correct` integer NOT NULL,
	`answered_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_card_answers_unique` ON `daily_card_answers` (`user_id`,`card_id`);--> statement-breakpoint
CREATE TABLE `daily_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`indicator_id` text,
	`fact_en` text NOT NULL,
	`fact_ar` text NOT NULL,
	`hook_en` text,
	`hook_ar` text,
	`quiz_question_en` text,
	`quiz_question_ar` text,
	`options_json` text,
	`correct_index` integer,
	`explanation_en` text,
	`explanation_ar` text,
	`big_number` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_cards_date_idx` ON `daily_cards` (`date`);--> statement-breakpoint
CREATE TABLE `decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`title_en` text NOT NULL,
	`title_ar` text NOT NULL,
	`decision_en` text,
	`decision_ar` text,
	`rationale_en` text,
	`rationale_ar` text,
	`decided_on` text,
	`owner_user_id` text,
	`node_id` text,
	`evidence_document_ids_json` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text NOT NULL,
	`description_en` text,
	`description_ar` text,
	`head_user_id` text,
	`parent_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `document_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`version_id` text,
	`chunk_index` integer NOT NULL,
	`page_from` integer,
	`page_to` integer,
	`heading` text,
	`text` text NOT NULL,
	`lang` text DEFAULT 'en' NOT NULL,
	`token_count` integer,
	`embedding` blob,
	`embedding_model` text
);
--> statement-breakpoint
CREATE INDEX `chunks_document_idx` ON `document_chunks` (`document_id`);--> statement-breakpoint
CREATE TABLE `document_tables` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`page` integer,
	`caption` text,
	`columns_json` text,
	`rows_json` text,
	`promoted_indicator_id` text
);
--> statement-breakpoint
CREATE TABLE `document_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`version_no` integer NOT NULL,
	`storage_path` text NOT NULL,
	`uploaded_by` text,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`title_en` text NOT NULL,
	`title_ar` text NOT NULL,
	`title_ar_machine` integer DEFAULT 0 NOT NULL,
	`summary_en` text,
	`summary_ar` text,
	`summary_machine` integer DEFAULT 0 NOT NULL,
	`key_facts_json` text,
	`knowledge_type_term_id` text,
	`classification_level` integer DEFAULT 2 NOT NULL,
	`department_id` text,
	`owner_user_id` text,
	`language_original` text DEFAULT 'en' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`review_due_at` text,
	`verified_by` text,
	`verified_at` text,
	`source_origin` text DEFAULT 'npc' NOT NULL,
	`publish_year` integer,
	`original_filename` text,
	`mime` text,
	`size_bytes` integer,
	`page_count` integer,
	`storage_path` text,
	`text_path` text,
	`current_version_id` text,
	`view_count` integer DEFAULT 0 NOT NULL,
	`download_count` integer DEFAULT 0 NOT NULL,
	`reuse_count` integer DEFAULT 0 NOT NULL,
	`is_seeded` integer DEFAULT 0 NOT NULL,
	`source_ref` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `documents_status_idx` ON `documents` (`status`);--> statement-breakpoint
CREATE INDEX `documents_dept_idx` ON `documents` (`department_id`);--> statement-breakpoint
CREATE TABLE `endorsements` (
	`id` text PRIMARY KEY NOT NULL,
	`expert_id` text NOT NULL,
	`endorsed_by` text NOT NULL,
	`term_id` text,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expert_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`expert_id` text NOT NULL,
	`term_id` text NOT NULL,
	`level` text DEFAULT 'practitioner' NOT NULL,
	`source` text DEFAULT 'self' NOT NULL,
	`accepted` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `expert_domains_eidx` ON `expert_domains` (`expert_id`);--> statement-breakpoint
CREATE TABLE `expert_engagements` (
	`id` text PRIMARY KEY NOT NULL,
	`expert_id` text NOT NULL,
	`title` text NOT NULL,
	`year` integer,
	`role` text,
	`department_id` text,
	`outcome_en` text,
	`outcome_ar` text,
	`rating` integer,
	`linked_document_ids_json` text,
	`linked_node_id` text
);
--> statement-breakpoint
CREATE TABLE `expert_publications` (
	`id` text PRIMARY KEY NOT NULL,
	`expert_id` text NOT NULL,
	`title` text NOT NULL,
	`year` integer,
	`url_or_document_id` text
);
--> statement-breakpoint
CREATE TABLE `expert_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_id` text NOT NULL,
	`expert_id` text NOT NULL,
	`question_id` text,
	`subject` text NOT NULL,
	`detail` text,
	`status` text DEFAULT 'open' NOT NULL,
	`outcome_note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expert_skills` (
	`id` text PRIMARY KEY NOT NULL,
	`expert_id` text NOT NULL,
	`skill` text NOT NULL,
	`level` text DEFAULT 'practitioner' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `experts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`type` text DEFAULT 'npc_employee' NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text NOT NULL,
	`photo_path` text,
	`avatar_color` text DEFAULT 'gulf' NOT NULL,
	`organisation_en` text,
	`organisation_ar` text,
	`position_en` text,
	`position_ar` text,
	`bio_en` text,
	`bio_ar` text,
	`email` text,
	`phone` text,
	`contact_protocol` text,
	`nationality` text,
	`languages_json` text,
	`years_experience` integer,
	`education_json` text,
	`certifications_json` text,
	`availability` text DEFAULT 'available' NOT NULL,
	`clearance_level` integer DEFAULT 2 NOT NULL,
	`owner_user_id` text,
	`is_verified` integer DEFAULT 0 NOT NULL,
	`visibility_classification` integer DEFAULT 2 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `experts_user_idx` ON `experts` (`user_id`);--> statement-breakpoint
CREATE TABLE `follows` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `follows_unique` ON `follows` (`user_id`,`resource_type`,`resource_id`);--> statement-breakpoint
CREATE TABLE `game_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_type` text NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`points` integer DEFAULT 0 NOT NULL,
	`multiplier` real DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `game_events_user_idx` ON `game_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `game_events_type_idx` ON `game_events` (`user_id`,`event_type`);--> statement-breakpoint
CREATE TABLE `game_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`points` integer NOT NULL,
	`multiplier_rules_json` text,
	`is_active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`indicator_id` text NOT NULL,
	`document_id` text,
	`mapping_json` text,
	`rows_imported` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`log` text,
	`created_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `index_rankings` (
	`id` text PRIMARY KEY NOT NULL,
	`index_name_en` text NOT NULL,
	`index_name_ar` text NOT NULL,
	`publisher` text,
	`year` integer,
	`rank` integer,
	`score` real,
	`total_countries` integer,
	`responsible_entity` text,
	`source_url` text,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `indicator_dimensions` (
	`id` text PRIMARY KEY NOT NULL,
	`indicator_id` text NOT NULL,
	`code` text NOT NULL,
	`values_json` text
);
--> statement-breakpoint
CREATE TABLE `indicator_values` (
	`id` text PRIMARY KEY NOT NULL,
	`indicator_id` text NOT NULL,
	`period` text NOT NULL,
	`value` real NOT NULL,
	`dimension_key` text DEFAULT 'total' NOT NULL,
	`status` text DEFAULT 'final' NOT NULL,
	`source_document_id` text,
	`note` text,
	`entered_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `indicator_values_unique` ON `indicator_values` (`indicator_id`,`period`,`dimension_key`);--> statement-breakpoint
CREATE INDEX `indicator_values_ind_idx` ON `indicator_values` (`indicator_id`);--> statement-breakpoint
CREATE TABLE `indicators` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text NOT NULL,
	`definition_en` text,
	`definition_ar` text,
	`unit` text,
	`decimals` integer DEFAULT 0 NOT NULL,
	`frequency` text DEFAULT 'annual' NOT NULL,
	`department_id` text,
	`source_en` text,
	`source_ar` text,
	`methodology_en` text,
	`methodology_ar` text,
	`category_term_id` text,
	`classification_level` integer DEFAULT 1 NOT NULL,
	`direction` text DEFAULT 'up_good' NOT NULL,
	`first_period` text,
	`last_period` text,
	`is_headline` integer DEFAULT 0 NOT NULL,
	`publish_calendar_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `indicators_code_idx` ON `indicators` (`code`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`payload_json` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`error` text,
	`run_after` text,
	`created_at` text NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`);--> statement-breakpoint
CREATE TABLE `knowledge_gaps` (
	`id` text PRIMARY KEY NOT NULL,
	`label_en` text NOT NULL,
	`label_ar` text NOT NULL,
	`example_queries_json` text,
	`question_ids_json` text,
	`term_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`bounty_id` text,
	`detected_at` text
);
--> statement-breakpoint
CREATE TABLE `kpi_values` (
	`id` text PRIMARY KEY NOT NULL,
	`kpi_id` text NOT NULL,
	`period` text NOT NULL,
	`actual_value` real,
	`target_for_period` real,
	`source_document_id` text,
	`note` text,
	`entered_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `kpi_values_kpi_idx` ON `kpi_values` (`kpi_id`);--> statement-breakpoint
CREATE TABLE `kpis` (
	`id` text PRIMARY KEY NOT NULL,
	`node_id` text NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text NOT NULL,
	`unit` text,
	`direction` text DEFAULT 'up_good' NOT NULL,
	`baseline_value` real,
	`baseline_year` integer,
	`target_value` real,
	`target_year` integer,
	`frequency` text DEFAULT 'annual' NOT NULL,
	`indicator_id` text,
	`owner_user_id` text,
	`methodology_en` text,
	`methodology_ar` text
);
--> statement-breakpoint
CREATE INDEX `kpis_node_idx` ON `kpis` (`node_id`);--> statement-breakpoint
CREATE TABLE `lesson_clusters` (
	`id` text PRIMARY KEY NOT NULL,
	`label_en` text NOT NULL,
	`label_ar` text NOT NULL,
	`summary_en` text,
	`summary_ar` text,
	`lesson_ids_json` text,
	`generated_at` text
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`title_en` text NOT NULL,
	`title_ar` text NOT NULL,
	`context_en` text,
	`context_ar` text,
	`learning_en` text,
	`learning_ar` text,
	`recommendation_en` text,
	`recommendation_ar` text,
	`node_id` text,
	`document_ids_json` text,
	`classification_level` integer DEFAULT 2 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`reuse_count` integer DEFAULT 0 NOT NULL,
	`cluster_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `levels` (
	`id` text PRIMARY KEY NOT NULL,
	`order_no` integer NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text NOT NULL,
	`min_points` integer NOT NULL,
	`unlocks_json` text
);
--> statement-breakpoint
CREATE TABLE `node_dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`node_id` text NOT NULL,
	`depends_on_node_id` text NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `node_lineage` (
	`id` text PRIMARY KEY NOT NULL,
	`from_node_id` text NOT NULL,
	`to_node_id` text NOT NULL,
	`relation` text NOT NULL,
	`note_en` text,
	`note_ar` text
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`title_en` text NOT NULL,
	`title_ar` text NOT NULL,
	`body_en` text,
	`body_ar` text,
	`link` text,
	`read_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE TABLE `question_routes` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`expert_id` text NOT NULL,
	`reason` text,
	`status` text DEFAULT 'notified' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`title_en` text NOT NULL,
	`title_ar` text NOT NULL,
	`body_en` text,
	`body_ar` text,
	`lang_original` text DEFAULT 'en' NOT NULL,
	`classification_level` integer DEFAULT 2 NOT NULL,
	`department_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`ai_answer_id` text,
	`verified_answer_id` text,
	`view_count` integer DEFAULT 0 NOT NULL,
	`follow_count` integer DEFAULT 0 NOT NULL,
	`bounty_id` text,
	`context_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `questions_status_idx` ON `questions` (`status`);--> statement-breakpoint
CREATE TABLE `relations` (
	`id` text PRIMARY KEY NOT NULL,
	`from_type` text NOT NULL,
	`from_id` text NOT NULL,
	`to_type` text NOT NULL,
	`to_id` text NOT NULL,
	`relation` text NOT NULL,
	`source` text DEFAULT 'human' NOT NULL,
	`confidence` real,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `relations_from_idx` ON `relations` (`from_type`,`from_id`);--> statement-breakpoint
CREATE INDEX `relations_to_idx` ON `relations` (`to_type`,`to_id`);--> statement-breakpoint
CREATE TABLE `releases` (
	`id` text PRIMARY KEY NOT NULL,
	`title_en` text NOT NULL,
	`title_ar` text NOT NULL,
	`release_date` text NOT NULL,
	`indicator_ids_json` text,
	`document_id` text,
	`summary_en` text,
	`summary_ar` text
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`decision` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `risks` (
	`id` text PRIMARY KEY NOT NULL,
	`title_en` text NOT NULL,
	`title_ar` text NOT NULL,
	`likelihood` integer DEFAULT 3 NOT NULL,
	`impact` integer DEFAULT 3 NOT NULL,
	`owner_user_id` text,
	`node_id` text,
	`mitigation_en` text,
	`mitigation_ar` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text NOT NULL,
	`permissions_json` text NOT NULL,
	`default_clearance` integer DEFAULT 2 NOT NULL,
	`default_department_scope` text DEFAULT 'all' NOT NULL,
	`is_system` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `search_index` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`text` text NOT NULL,
	`lang` text DEFAULT 'en' NOT NULL,
	`embedding` blob,
	`embedding_model` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_index_unique` ON `search_index` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE TABLE `search_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`query` text NOT NULL,
	`lang` text,
	`intent` text,
	`result_count` integer DEFAULT 0 NOT NULL,
	`clicked_resource_type` text,
	`clicked_resource_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `search_log_created_idx` ON `search_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`ip` text,
	`user_agent` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `signals` (
	`id` text PRIMARY KEY NOT NULL,
	`title_en` text NOT NULL,
	`title_ar` text NOT NULL,
	`description_en` text,
	`description_ar` text,
	`source` text,
	`impact` text DEFAULT 'medium' NOT NULL,
	`horizon` text DEFAULT 'mid' NOT NULL,
	`node_ids_json` text,
	`document_id` text,
	`created_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `spotlights` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`blurb_en` text,
	`blurb_ar` text,
	`starts_on` text,
	`ends_on` text,
	`chosen_by` text
);
--> statement-breakpoint
CREATE TABLE `status_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`node_id` text NOT NULL,
	`author_id` text NOT NULL,
	`status` text NOT NULL,
	`progress_pct` integer DEFAULT 0 NOT NULL,
	`summary_en` text,
	`summary_ar` text,
	`risks_json` text,
	`next_steps_json` text,
	`evidence_document_ids_json` text,
	`period` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `status_updates_node_idx` ON `status_updates` (`node_id`);--> statement-breakpoint
CREATE TABLE `strategy_editions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text NOT NULL,
	`period_from` integer NOT NULL,
	`period_to` integer NOT NULL,
	`status` text DEFAULT 'live' NOT NULL,
	`summary_en` text,
	`summary_ar` text,
	`source_document_id` text,
	`is_default` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `strategy_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`edition_id` text NOT NULL,
	`parent_id` text,
	`node_type` text NOT NULL,
	`code` text,
	`title_en` text NOT NULL,
	`title_ar` text NOT NULL,
	`description_en` text,
	`description_ar` text,
	`owner_user_id` text,
	`owner_entity_name` text,
	`status` text DEFAULT 'not_started' NOT NULL,
	`start_date` text,
	`end_date` text,
	`budget_qar` real,
	`funding_source` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`source_ref` text,
	`verified` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `nodes_edition_idx` ON `strategy_nodes` (`edition_id`);--> statement-breakpoint
CREATE INDEX `nodes_parent_idx` ON `strategy_nodes` (`parent_id`);--> statement-breakpoint
CREATE TABLE `taggings` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`term_id` text NOT NULL,
	`source` text DEFAULT 'human' NOT NULL,
	`confidence` real,
	`created_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `taggings_resource_idx` ON `taggings` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE TABLE `taxonomy_dimensions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text NOT NULL,
	`is_hierarchical` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `taxonomy_terms` (
	`id` text PRIMARY KEY NOT NULL,
	`dimension_id` text NOT NULL,
	`parent_id` text,
	`code` text NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text NOT NULL,
	`description_en` text,
	`description_ar` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `terms_dimension_idx` ON `taxonomy_terms` (`dimension_id`);--> statement-breakpoint
CREATE TABLE `user_badges` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`badge_id` text NOT NULL,
	`awarded_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_badges_unique` ON `user_badges` (`user_id`,`badge_id`);--> statement-breakpoint
CREATE TABLE `user_game_state` (
	`user_id` text PRIMARY KEY NOT NULL,
	`total_points` integer DEFAULT 0 NOT NULL,
	`level_id` text,
	`daily_streak` integer DEFAULT 0 NOT NULL,
	`weekly_streak` integer DEFAULT 0 NOT NULL,
	`streak_freezes` integer DEFAULT 0 NOT NULL,
	`last_active_date` text,
	`last_contribution_week` text,
	`breadth_json` text,
	`quiz_streak` integer DEFAULT 0 NOT NULL,
	`contribution_count` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text NOT NULL,
	`avatar_path` text,
	`avatar_color` text DEFAULT 'maroon' NOT NULL,
	`department_id` text,
	`role_id` text NOT NULL,
	`clearance_level` integer DEFAULT 2 NOT NULL,
	`department_scope` text DEFAULT 'all' NOT NULL,
	`locale_pref` text DEFAULT 'en' NOT NULL,
	`numerals_pref` text DEFAULT 'western' NOT NULL,
	`quiet_mode` integer DEFAULT 0 NOT NULL,
	`onboarding_json` text,
	`position_en` text,
	`position_ar` text,
	`last_login_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `word_of_day` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text,
	`kind` text NOT NULL,
	`text_en` text NOT NULL,
	`text_ar` text NOT NULL,
	`attribution_en` text,
	`attribution_ar` text,
	`source_ref` text
);
