-- Run this if you applied 0001 before grants were added. Idempotent.
-- Gives the Data API roles access to the scanner schema (RLS still gates
-- anon/authenticated — only the secret/service key, which bypasses RLS, gets data).
grant usage on schema scanner to anon, authenticated, service_role;
grant all privileges on all tables in schema scanner to service_role;
grant all privileges on all sequences in schema scanner to service_role;
alter default privileges in schema scanner grant all on tables to service_role;
alter default privileges in schema scanner grant all on sequences to service_role;
notify pgrst, 'reload schema';
