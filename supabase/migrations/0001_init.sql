-- Med-Spa Growth Scanner — initial schema (tech spec §3).
-- Namespaced in the dedicated `scanner` schema so it is SAFE to run on the
-- client's existing Supabase: it cannot collide with their site's `public`
-- tables. Idempotent (IF NOT EXISTS) and reversible (see 0001_init.down.sql).
--
-- Run at integration in the Supabase SQL editor. Extensions (pgmq, pg_cron)
-- require admin and are enabled in §EXTENSIONS below.

create schema if not exists scanner;

-- ── Enums ───────────────────────────────────────────────────────────────────
do $$ begin
  create type scanner.business_type as enum ('local','national','ecom');
exception when duplicate_object then null; end $$;
do $$ begin
  create type scanner.scan_status as enum ('queued','running','complete','partial','failed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type scanner.scan_source as enum ('outreach','public','deep','competitor');
exception when duplicate_object then null; end $$;
do $$ begin
  create type scanner.pillar_kind as enum ('paid','search','ai','reputation','conversion');
exception when duplicate_object then null; end $$;
do $$ begin
  create type scanner.confidence as enum ('low','medium','high');
exception when duplicate_object then null; end $$;

-- ── targets ──────────────────────────────────────────────────────────────────
create table if not exists scanner.targets (
  id uuid primary key default gen_random_uuid(),
  business_name text, domain text unique not null, phone text, city text, place_id text,
  location_count int, tier char(1),
  fit_score int, legal_exposure_score int, sophistication_gap_score int, key_findings text,
  outreach_status text default 'new', priority int,
  created_at timestamptz default now()
);

-- ── scans ────────────────────────────────────────────────────────────────────
create table if not exists scanner.scans (
  id uuid primary key default gen_random_uuid(),
  target_id uuid references scanner.targets(id),
  domain text not null, vertical text,
  business_type scanner.business_type default 'local', geo text,
  status scanner.scan_status default 'queued', source scanner.scan_source default 'outreach',
  composite_score int, achievable_score int, gap int,
  compliance_surface jsonb, compliance_risk_score int,
  detect_confidence jsonb, last_scanned_at timestamptz,
  created_at timestamptz default now(), completed_at timestamptz
);
create index if not exists scans_domain_idx on scanner.scans (domain);
create index if not exists scans_last_scanned_idx on scanner.scans (last_scanned_at);

-- ── site_signals ─────────────────────────────────────────────────────────────
create table if not exists scanner.site_signals (
  scan_id uuid references scanner.scans(id) on delete cascade,
  has_meta_pixel bool, has_tiktok_pixel bool, has_linkedin_insight bool,
  has_google_ads_conv bool, has_ga4 bool, has_gtm bool,
  has_server_side_signal bool, server_side_conf scanner.confidence,
  has_call_tracking bool, call_tracking_vendor text,
  has_booking_widget bool, booking_vendor text,
  has_retargeting bool, runs_paid_likely bool, runs_paid_conf scanner.confidence,
  location_count int, schema_types text[], robots_blocks_ai bool, llms_txt bool,
  spyfu jsonb, raw jsonb, detected_at timestamptz default now(),
  primary key (scan_id)
);

-- ── pillar_results ───────────────────────────────────────────────────────────
create table if not exists scanner.pillar_results (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid references scanner.scans(id) on delete cascade,
  pillar scanner.pillar_kind not null, score int, weight numeric,
  signal_confidence scanner.confidence, signals jsonb, findings jsonb,
  degraded bool default false
);
create index if not exists pillar_results_scan_idx on scanner.pillar_results (scan_id);

-- ── reports ──────────────────────────────────────────────────────────────────
create table if not exists scanner.reports (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid references scanner.scans(id) on delete cascade,
  slug text unique not null, model text, prompt_version text,
  client_payload jsonb,    -- gated; only this leaves the server
  internal_payload jsonb,  -- call-only detail
  tokens_in int, tokens_out int, cost_usd numeric, created_at timestamptz default now()
);
create index if not exists reports_slug_idx on scanner.reports (slug);

-- ── leads ────────────────────────────────────────────────────────────────────
create table if not exists scanner.leads (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid references scanner.scans(id), email text, phone text,
  consent_email bool, consent_tcpa bool, booking_status text, booked_at timestamptz,
  utm jsonb, created_at timestamptz default now()
);

-- ── scan_events ──────────────────────────────────────────────────────────────
create table if not exists scanner.scan_events (
  id bigserial primary key, scan_id uuid references scanner.scans(id),
  event_type text, ts timestamptz default now(), meta jsonb
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Everything is service-key only. The public/anon role reaches reports ONLY
-- through the get_report(slug) RPC below, which returns just client_payload.
alter table scanner.targets        enable row level security;
alter table scanner.scans          enable row level security;
alter table scanner.site_signals   enable row level security;
alter table scanner.pillar_results enable row level security;
alter table scanner.reports        enable row level security;
alter table scanner.leads          enable row level security;
alter table scanner.scan_events    enable row level security;

create or replace function public.get_report(p_slug text)
returns jsonb
language sql
security definer
set search_path = scanner, public
as $$
  select client_payload from scanner.reports where slug = p_slug;
$$;
revoke all on function public.get_report(text) from public;
grant execute on function public.get_report(text) to anon, authenticated;

-- ── Grants ────────────────────────────────────────────────────────────────────
-- The Data API roles need USAGE on the schema. The secret/service key (which
-- bypasses RLS) needs table privileges. anon/authenticated get USAGE only — RLS
-- (no policies) still denies them everything, so this stays locked down.
grant usage on schema scanner to anon, authenticated, service_role;
grant all privileges on all tables in schema scanner to service_role;
grant all privileges on all sequences in schema scanner to service_role;
alter default privileges in schema scanner grant all on tables to service_role;
alter default privileges in schema scanner grant all on sequences to service_role;
notify pgrst, 'reload schema';

-- ── EXTENSIONS (admin; enable at integration) ────────────────────────────────
-- create extension if not exists pgmq;
-- create extension if not exists pg_cron;
-- select pgmq.create('scans');
