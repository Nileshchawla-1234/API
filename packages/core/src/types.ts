// Core domain model — mirrors the SQL schema (spec §3) at the type level.
// Detectors/scorer/report slices populate these; the Store persists them.

export type BusinessType = "local" | "national" | "ecom";
export type ScanStatus = "queued" | "running" | "complete" | "partial" | "failed";
export type ScanSource = "outreach" | "public" | "deep" | "competitor";
export type PillarKind = "paid" | "search" | "ai" | "reputation" | "conversion";
export type Confidence = "low" | "medium" | "high";
export type Tier = "A" | "B" | "C" | "D" | "X";

// ── site_signals ─────────────────────────────────────────────────────────────
export interface SiteSignals {
  has_meta_pixel: boolean;
  has_tiktok_pixel: boolean;
  has_linkedin_insight: boolean;
  has_google_ads_conv: boolean;
  has_ga4: boolean;
  has_gtm: boolean;
  has_server_side_signal: boolean;
  server_side_conf: Confidence;
  has_call_tracking: boolean;
  call_tracking_vendor: string | null;
  has_booking_widget: boolean;
  booking_vendor: string | null;
  has_retargeting: boolean;
  runs_paid_likely: boolean;
  runs_paid_conf: Confidence;
  location_count: number | null;
  schema_types: string[];
  robots_blocks_ai: boolean;
  llms_txt: boolean;
  spyfu: SpyfuEnrichment | null;
}

export interface SpyfuEnrichment {
  coverage: "full" | "partial" | "none";
  paid?: { monthly_budget_est: number; paid_keywords: number; paid_clicks_est: number };
  organic?: { organic_keywords: number; organic_clicks_est: number; rank_strength: number };
  competitors?: { domain: string; est_traffic: number; overlap: number }[];
  fetched_at?: string;
}

// ── compliance_surface (spec §3 shape) ───────────────────────────────────────
export interface ComplianceSurface {
  tier1: {
    phi_context_pixel_detected: boolean;
    phi_context_conf: Confidence;
    privacy_policy_present: boolean;
    privacy_policy_url: string | null;
    privacy_policy_addresses_tracking: boolean;
    cookie_consent_detected: boolean;
    consent_platform: string | null;
  };
  tier2: {
    terms_of_use_present: boolean;
    phone_form_present: boolean;
    tcpa_opt_in_language_detected: boolean;
    https_enforced: boolean;
    mixed_content: boolean;
    accessibility_score: number | null;
    accessibility_below_threshold: boolean;
  };
}

// ── pillars + scores ─────────────────────────────────────────────────────────
export interface PillarResult {
  pillar: PillarKind;
  score: number;
  weight: number;
  signal_confidence: Confidence;
  signals: Record<string, unknown>;
  findings: { text: string; source: "SpyFu" | "crawl" | "PageSpeed" | "reviews" }[];
  degraded: boolean;
}

export interface Scores {
  composite: number;
  achievable: number;
  gap: number;
  tier: Tier;
  compliance_risk_score: number;
}

// ── persisted aggregate (what the Store writes for one completed scan) ────────
export interface ScanRecord {
  domain: string;
  vertical: string | null;
  business_type: BusinessType;
  geo: string | null;
  status: ScanStatus;
  source: ScanSource;
  scores: Scores;
  site_signals: SiteSignals;
  compliance_surface: ComplianceSurface;
  pillars: PillarResult[];
  report: ReportRecord;
  raw?: Record<string, unknown>;
  completed_at: string;
}

export interface ReportRecord {
  slug: string;
  model: string | null;
  prompt_version: string | null;
  client_payload: ClientPayload;
  internal_payload: Record<string, unknown>;
  cost_usd?: number;
  tokens_in?: number;
  tokens_out?: number;
}

// ── client_payload (spec §6 — the ONLY object that leaves the server) ─────────
export interface ClientPayload {
  header: { domain: string; business_name?: string; location?: string; scan_date: string; tier: Tier };
  score: { composite: number; achievable: number; gap: number };
  pillars: {
    key: PillarKind;
    score: number;
    rag: "crit" | "warn" | "ok";
    findings: { text: string; source: string }[];
    target: string;
  }[];
  locked: { name: string; tease: string }[];
  compliance: {
    risk: number;
    intro?: string;
    rows: { signal: string; observed: string; tier: 1 | 2; confidence: Confidence; why?: string }[];
    disclaimer: string;
  };
  cwv: { metric: string; good: string; actual: string }[];
  competitors?: { source: string; rows: Record<string, unknown>[] };
  ai_citations?: { scope: string; rows: Record<string, unknown>[] };
  cta: { headline: string; body: string; button: string; note?: string };
  footer_disclaimer: string;
}

// ── targets / leads / events ─────────────────────────────────────────────────
export interface TargetInput {
  business_name?: string;
  domain: string;
  phone?: string;
  city?: string;
  place_id?: string;
  location_count?: number;
}

export interface Target extends TargetInput {
  id: string;
  tier: Tier | null;
  outreach_status: string;
}

export interface LeadInput {
  scan_id: string | null;
  email: string;
  phone?: string | null;
  consent_email?: boolean;
  consent_tcpa?: boolean;
  booking_status?: string;
  utm?: Record<string, unknown>;
}

export type ScanEventType = "queued" | "started" | "completed" | "partial" | "error" | "booked";
