-- Reverses 0001_init.sql. Drops ONLY the scanner schema + the public RPC, so it
-- leaves the client's existing site database untouched.
drop function if exists public.get_report(text);
drop schema if exists scanner cascade;
