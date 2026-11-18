-- NCEC data layer, step 1: catalogue (datasets, fields, classification) and dummy records.
-- Postgres track. The SQLite twin is migrations/0011_ncec_data_layer.sql; keep the two in step.
-- Portable Postgres 12+: text plus CHECK (no enums), no extensions, nothing Supabase specific.
-- Every statement is idempotent. Rollback: rollback/0001_ncec_data_layer.down.sql.

CREATE TABLE IF NOT EXISTS ncec_import_batches (
  import_batch_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  files jsonb NOT NULL,
  counts jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ncec_classifications (
  code text PRIMARY KEY CHECK (code IN ('public', 'restricted', 'secret', 'top_secret')),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  layer smallint NOT NULL CHECK (layer BETWEEN 1 AND 3)
);

CREATE TABLE IF NOT EXISTS ncec_departments (
  dept_id text PRIMARY KEY,
  name_ar text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_en_status text NOT NULL DEFAULT 'working_translation',
  unit_type text NOT NULL CHECK (unit_type IN ('executive_department', 'general_department', 'department')),
  parent_dept_id text REFERENCES ncec_departments (dept_id)
);
CREATE INDEX IF NOT EXISTS ncec_departments_parent_idx ON ncec_departments (parent_dept_id);

CREATE TABLE IF NOT EXISTS ncec_datasets (
  dataset_id text PRIMARY KEY CHECK (dataset_id ~ '^DS-[0-9]{3}$'),
  register_order integer NOT NULL UNIQUE,
  name_ar text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_en_status text NOT NULL DEFAULT 'working_translation',
  domain text CHECK (domain IN ('core_environmental', 'corporate_support')),
  exec_dept_id text NOT NULL REFERENCES ncec_departments (dept_id),
  general_dept_id text REFERENCES ncec_departments (dept_id), -- NULL: not specified in the register
  import_batch_id bigint REFERENCES ncec_import_batches (import_batch_id)
);
CREATE INDEX IF NOT EXISTS ncec_datasets_exec_idx ON ncec_datasets (exec_dept_id);
CREATE INDEX IF NOT EXISTS ncec_datasets_general_idx ON ncec_datasets (general_dept_id);

CREATE TABLE IF NOT EXISTS ncec_fields (
  asset_id text PRIMARY KEY, -- DMO-001.. from the register; DUM-HLP-.. for mockup helpers
  dataset_id text NOT NULL REFERENCES ncec_datasets (dataset_id),
  ordinal integer NOT NULL,
  register_row integer,
  field_kind text NOT NULL CHECK (field_kind IN ('field', 'group_label', 'dataset_placeholder', 'mockup_helper')),
  name_ar text,
  name_en text,
  name_en_status text NOT NULL DEFAULT 'working_translation',
  register_classification text REFERENCES ncec_classifications (code), -- NULL = unclassified (rule R3: L3)
  personal_data text NOT NULL DEFAULT 'none' CHECK (personal_data IN ('none', 'personal', 'sensitive')),
  -- R2, R3, R6: layer from the register class (unclassified = L3), raised to L2 for personal data.
  effective_layer smallint GENERATED ALWAYS AS (
    GREATEST(
      CASE register_classification WHEN 'public' THEN 1 WHEN 'restricted' THEN 2 ELSE 3 END,
      CASE WHEN personal_data <> 'none' THEN 2 ELSE 1 END
    )
  ) STORED,
  data_nature_ar text,
  description_ar text,
  data_steward text,
  steward_email text,
  source_system text,
  update_frequency_ar text,
  last_update_date date,
  update_status_ar text,
  notes_ar text,
  next_update_date date,
  audit_notes_ar text,
  import_batch_id bigint REFERENCES ncec_import_batches (import_batch_id),
  UNIQUE (dataset_id, ordinal),
  CHECK (
    (field_kind IN ('field', 'group_label') AND name_ar IS NOT NULL AND name_en IS NOT NULL)
    OR (field_kind = 'mockup_helper' AND name_en IS NOT NULL)
    OR (field_kind = 'dataset_placeholder' AND name_ar IS NULL AND name_en IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS ncec_fields_dataset_idx ON ncec_fields (dataset_id);
CREATE INDEX IF NOT EXISTS ncec_fields_classification_idx ON ncec_fields (register_classification);

CREATE TABLE IF NOT EXISTS ncec_records (
  record_id text PRIMARY KEY,
  dataset_id text NOT NULL REFERENCES ncec_datasets (dataset_id),
  field_values jsonb NOT NULL, -- keys are asset_id; values are never keyed by name
  is_dummy boolean NOT NULL,
  data_status text NOT NULL CHECK (data_status IN ('DUMMY', 'REAL')),
  import_batch_id bigint REFERENCES ncec_import_batches (import_batch_id),
  CHECK (is_dummy = (data_status = 'DUMMY')),
  CHECK (NOT is_dummy OR record_id LIKE 'DUM-%')
);
CREATE INDEX IF NOT EXISTS ncec_records_dataset_idx ON ncec_records (dataset_id);

CREATE TABLE IF NOT EXISTS ncec_classification_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asset_id text NOT NULL REFERENCES ncec_fields (asset_id),
  old_classification text,
  new_classification text,
  old_personal_data text,
  new_personal_data text,
  old_layer smallint,
  new_layer smallint,
  source text NOT NULL DEFAULT 'register_import',
  import_batch_id bigint,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ncec_classification_history_asset_idx ON ncec_classification_history (asset_id);

-- Logs a change of class or personal data flag. The first insert of a field is not logged:
-- the import batch row records the initial load.
CREATE OR REPLACE FUNCTION ncec_log_classification_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.register_classification IS DISTINCT FROM OLD.register_classification
     OR NEW.personal_data IS DISTINCT FROM OLD.personal_data THEN
    INSERT INTO ncec_classification_history
      (asset_id, old_classification, new_classification, old_personal_data, new_personal_data,
       old_layer, new_layer, import_batch_id)
    VALUES
      (NEW.asset_id, OLD.register_classification, NEW.register_classification, OLD.personal_data,
       NEW.personal_data, OLD.effective_layer, NEW.effective_layer, NEW.import_batch_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ncec_fields_classification_log ON ncec_fields;
CREATE TRIGGER ncec_fields_classification_log
  AFTER UPDATE OF register_classification, personal_data ON ncec_fields
  FOR EACH ROW EXECUTE FUNCTION ncec_log_classification_change();

-- Same posture as supabase/03_lock_down.sql: RLS on, no policies, so the anon REST key reads
-- nothing. This is not the access model; access control comes with the screens.
ALTER TABLE ncec_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ncec_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ncec_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ncec_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ncec_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE ncec_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ncec_classification_history ENABLE ROW LEVEL SECURITY;
