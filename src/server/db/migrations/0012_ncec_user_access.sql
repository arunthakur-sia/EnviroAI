-- NCEC access per user (SQLite). Twin of migrations-pg/0002_ncec_user_access.sql; keep in step.
-- A user with no row is NCEC layer 1 (no NCEC access at all). L3 is never a base layer
-- (brief R4): it is base_layer 2 plus a grant naming specific datasets, with an expiry.
-- Rollback: rollback/0012_ncec_user_access.down.sql.
CREATE TABLE IF NOT EXISTS `ncec_user_access` (
  `user_id` text PRIMARY KEY NOT NULL REFERENCES `users` (`id`) ON DELETE CASCADE,
  `base_layer` integer NOT NULL CHECK (`base_layer` IN (1, 2)),
  `granted_dataset_ids` text NOT NULL DEFAULT '[]' CHECK (json_valid(`granted_dataset_ids`)),
  `include_personal_data` integer NOT NULL DEFAULT 0 CHECK (`include_personal_data` IN (0, 1)),
  `allow_export` integer NOT NULL DEFAULT 0 CHECK (`allow_export` IN (0, 1)),
  `grant_expires_at` text,
  `updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
