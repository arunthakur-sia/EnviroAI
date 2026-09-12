-- CR03: per-user UI preferences (Vault shelf collapse state and similar).
-- Additive only.
ALTER TABLE users ADD COLUMN prefs_json TEXT;
