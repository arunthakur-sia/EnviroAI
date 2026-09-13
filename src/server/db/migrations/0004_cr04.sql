-- CR04: the Learning Room. Private reflection notes and guided Learn
-- sessions. Additive only.
CREATE TABLE IF NOT EXISTS `notes` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `lesson_id` text NOT NULL,
  `text` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `notes_user_idx` ON `notes` (`user_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `learn_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `lesson_ids_json` text NOT NULL,
  `progress_json` text,
  `completed_at` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `learn_sessions_user_idx` ON `learn_sessions` (`user_id`);
