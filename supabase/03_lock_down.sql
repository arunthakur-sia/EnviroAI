-- Run last. Turns on row-level security for every table in public with no
-- policies, so the public anon key cannot read or write anything through
-- Supabase's REST API. The service_role key and direct Postgres connections
-- still work.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
