-- NCEC access per user (Postgres). Twin of migrations/0012_ncec_user_access.sql; keep in step.
-- A user with no row is NCEC layer 1 (no NCEC access at all). L3 is never a base layer
-- (brief R4): it is base_layer 2 plus a grant naming specific datasets, with an expiry.
-- Idempotent. Rollback: rollback/0002_ncec_user_access.down.sql.

CREATE TABLE IF NOT EXISTS ncec_user_access (
  user_id text PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  base_layer smallint NOT NULL CHECK (base_layer IN (1, 2)),
  granted_dataset_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  include_personal_data boolean NOT NULL DEFAULT false,
  allow_export boolean NOT NULL DEFAULT false,
  grant_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
