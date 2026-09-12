-- CR02: lessons categories, deliverables, podcast, reports. Non-destructive:
-- only ADD COLUMN and CREATE TABLE, so existing data survives. The migrate
-- runner tolerates "already exists" and "duplicate column name".

ALTER TABLE lessons ADD COLUMN category text NOT NULL DEFAULT 'institutional';
--> statement-breakpoint
CREATE TABLE deliverable_meta (
  id text PRIMARY KEY,
  document_id text NOT NULL,
  node_id text NOT NULL,
  deliverable_code text NOT NULL,
  milestone text,
  due_date text,
  delivered_date text,
  acceptance_status text NOT NULL DEFAULT 'pending',
  created_at text NOT NULL
);
--> statement-breakpoint
CREATE INDEX deliverable_meta_node_idx ON deliverable_meta (node_id);
--> statement-breakpoint
CREATE INDEX deliverable_meta_doc_idx ON deliverable_meta (document_id);
--> statement-breakpoint
CREATE TABLE podcast_episodes (
  id text PRIMARY KEY,
  title_en text NOT NULL,
  title_ar text NOT NULL,
  description_en text,
  description_ar text,
  language text NOT NULL DEFAULT 'en',
  focus text NOT NULL DEFAULT 'overview',
  source_scope_json text,
  script_json text,
  audio_path text,
  audio_provider text NOT NULL DEFAULT 'browser',
  duration_sec integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_by text,
  classification_level integer NOT NULL DEFAULT 2,
  listens integer NOT NULL DEFAULT 0,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
--> statement-breakpoint
CREATE INDEX podcast_episodes_status_idx ON podcast_episodes (status);
--> statement-breakpoint
CREATE TABLE podcast_listens (
  id text PRIMARY KEY,
  episode_id text NOT NULL,
  user_id text NOT NULL,
  seconds_listened integer NOT NULL DEFAULT 0,
  completed integer NOT NULL DEFAULT 0,
  updated_at text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX podcast_listens_unique ON podcast_listens (episode_id, user_id);
--> statement-breakpoint
CREATE TABLE reports (
  id text PRIMARY KEY,
  title text NOT NULL,
  scope_json text NOT NULL,
  options_json text,
  audience text NOT NULL DEFAULT 'working',
  language text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'queued',
  file_path text,
  narrative_json text,
  error text,
  vault_document_id text,
  classification_level integer NOT NULL DEFAULT 2,
  created_by text,
  created_at text NOT NULL,
  finished_at text
);
--> statement-breakpoint
CREATE INDEX reports_user_idx ON reports (created_by);
