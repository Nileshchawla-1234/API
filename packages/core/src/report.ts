import type { SpeedResult } from "./collect/speed";
import type {
  ClientPayload,
  ComplianceSurface,
  PillarKind,
  PillarResult,
  Scores,
  SiteSignals,
  SpyfuEnrichment,
} from "./types";

// composeReport (spec §6). Builds the gated client_payload + the internal_payload.
// THE GATE: client_payload carries NO weights, detector internals, how-to-fix
// recommendations, or locked-pillar substance — those live in internal_payload.
// This deterministic pass is the source of truth; S11 adds an AI copy layer that
// may only rephrase these facts (never introduce a number).

export interface ComposeInput {
  domain: string;
  business_name?: string;
  location?: string;
  scanDate: string; // ISO
  signals: SiteSignals;
  speed: SpeedResult | null;
  compliance: ComplianceSurface;
  pillars: PillarResult[];
  scores: Scores;
}

const PILLAR_LABEL: Record<PillarKind, string> = {
  paid: "Paid Acquisition",
  search: "Search & Local Presence",
  ai: "AI Visibility Readiness",
  reputation: "Reputation Surface",
  conversion: "Conversion Infrastructure",
};

const PILLAR_TARGET: Record<PillarKind, string> = {
  paid: "What 100 looks like: full-funnel conversion tracking incl. server-side, with retargeting live.",
  search: "What 100 looks like: ranking for non-brand commercial queries with rich local + medical schema.",
  ai: "What 100 looks like: AI crawlers allowed, complete schema, and an llms.txt, cited by answer engines.",
  reputation: "What 100 looks like: steady review velocity, fast responses, consistent ratings across platforms.",
  conversion: "What 100 looks like: sub-2.5s mobile LCP, frictionless booking, click-to-call above the fold.",
};

function rag(score: number): "crit" | "warn" | "ok" {
  return score < 40 ? "crit" : score < 70 ? "warn" : "ok";
}

/** Factual, sourced findings per pillar — observations only, no invented numbers. */
function pillarFindings(kind: PillarKind, i: ComposeInput): { text: string; source: string }[] {
  const s = i.signals;
  const out: { text: string; source: string }[] = [];
  const add = (text: string, source: string) => out.push({ text, source });

  if (kind === "paid") {
    if (!s.has_server_side_signal) add("No server-side conversion signal detected", "crawl");
    if (!s.has_meta_pixel && !s.has_google_ads_conv) add("No paid-conversion pixel detected", "crawl");
    if (!s.has_retargeting) add("No retargeting pixel detected", "crawl");
    if (s.spyfu?.coverage && s.spyfu.coverage !== "none" && s.spyfu.paid)
      add(`Estimated paid keywords: ${s.spyfu.paid.paid_keywords}`, "SpyFu");
  } else if (kind === "search") {
    if (!s.schema_types.some((t) => /localbusiness|medical/i.test(t)))
      add("Missing the local-business markup Google looks for", "crawl");
    if (s.spyfu?.organic) add(`Estimated organic keywords: ${s.spyfu.organic.organic_keywords}`, "SpyFu");
    if (i.speed?.mobile.seo != null) add(`PageSpeed SEO score: ${i.speed.mobile.seo}/100`, "PageSpeed");
  } else if (kind === "ai") {
    if (s.robots_blocks_ai) add("Your site blocks AI engines (e.g. GPT Bot) from reading it", "crawl");
    if (!s.llms_txt) add("No llms.txt present (helps AI engines understand the site)", "crawl");
    if (!s.schema_types.some((t) => /faqpage|service/i.test(t))) add("No FAQ content for AI engines to quote", "crawl");
  } else if (kind === "reputation") {
    add("Review data requires Google Business Profile enrichment (not in this scan)", "crawl");
  } else if (kind === "conversion") {
    const lcp = i.speed?.cwv?.lcpMs ?? null;
    if (lcp != null) add(`Mobile load time: ${(lcp / 1000).toFixed(1)}s on a typical phone connection`, "PageSpeed");
    if (!s.has_booking_widget) add("No online booking widget detected", "crawl");
  }
  return out;
}

function complianceRows(c: ComplianceSurface): ClientPayload["compliance"]["rows"] {
  const rows: ClientPayload["compliance"]["rows"] = [];
  if (c.tier1.phi_context_pixel_detected)
    rows.push({ signal: "Potential PHI context: ad pixel on a treatment/intake page", observed: "present", tier: 1, confidence: c.tier1.phi_context_conf });
  if (!c.tier1.cookie_consent_detected)
    rows.push({ signal: "No cookie-consent platform detected", observed: "absent", tier: 1, confidence: "medium" });
  if (!c.tier1.privacy_policy_addresses_tracking)
    rows.push({ signal: "Privacy policy does not clearly address tracking", observed: "unclear", tier: 1, confidence: "low" });
  if (!c.tier2.https_enforced)
    rows.push({ signal: "HTTPS/HSTS not fully enforced", observed: "partial", tier: 2, confidence: "medium" });
  if (c.tier2.phone_form_present && !c.tier2.tcpa_opt_in_language_detected)
    rows.push({ signal: "Phone form without TCPA opt-in language", observed: "present", tier: 2, confidence: "medium" });
  if (c.tier2.accessibility_below_threshold)
    rows.push({ signal: "Accessibility below threshold", observed: `score ${c.tier2.accessibility_score}`, tier: 2, confidence: "high" });
  return rows;
}

function cwvRows(speed: SpeedResult | null): ClientPayload["cwv"] {
  const cwv = speed?.cwv;
  if (!cwv) return [];
  const rows: ClientPayload["cwv"] = [];
  if (cwv.lcpMs != null) rows.push({ metric: "Mobile load speed", good: "under 2.5s", actual: `${(cwv.lcpMs / 1000).toFixed(1)}s` });
  if (cwv.inpMs != null) rows.push({ metric: "Tap response", good: "under 200ms", actual: `${Math.round(cwv.inpMs)}ms` });
  if (cwv.cls != null) rows.push({ metric: "Visual stability", good: "under 0.1", actual: cwv.cls.toFixed(2) });
  return rows;
}

const COMPLIANCE_DISCLAIMER =
  "This is a structural pattern flag, not a legal determination. The Compounding Method is a marketing operations firm, not a law firm.";
const FOOTER_DISCLAIMER =
  "The Compounding Method is a marketing operations firm, not a law firm. Compliance Surface findings are structural pattern observations, not legal advice.";

export interface ComposeResult {
  client_payload: ClientPayload;
  internal_payload: Record<string, unknown>;
}

export function composeReport(input: ComposeInput): ComposeResult {
  const client_payload: ClientPayload = {
    header: {
      domain: input.domain,
      business_name: input.business_name,
      location: input.location,
      scan_date: input.scanDate,
      tier: input.scores.tier,
    },
    score: { composite: input.scores.composite, achievable: input.scores.achievable, gap: input.scores.gap },
    pillars: input.pillars.map((p) => ({
      key: p.pillar,
      score: p.score,
      rag: rag(p.score),
      findings: pillarFindings(p.pillar, input),
      target: PILLAR_TARGET[p.pillar],
    })),
    locked: [
      { name: "Lead Lifecycle", tease: "How leads are captured, routed, and followed up, measured end to end." },
      { name: "Monetization & Retention", tease: "Rebooking, LTV, and the offers that compound revenue per patient." },
    ],
    compliance: {
      risk: input.scores.compliance_risk_score,
      rows: complianceRows(input.compliance),
      disclaimer: COMPLIANCE_DISCLAIMER,
    },
    cwv: cwvRows(input.speed),
    cta: {
      headline: "See exactly what's behind your score.",
      body: "A 30-minute Behind-the-Score call walks through every pillar and the fastest path to close the gap.",
      button: "Book your Behind-the-Score call",
    },
    footer_disclaimer: FOOTER_DISCLAIMER,
  };

  if (input.signals.spyfu?.coverage && input.signals.spyfu.coverage !== "none" && input.signals.spyfu.competitors?.length) {
    client_payload.competitors = {
      source: "SpyFu (estimated)",
      rows: input.signals.spyfu.competitors.map((c) => ({ name: c.domain, est_traffic: c.est_traffic, overlap: c.overlap })),
    };
  }

  // internal_payload: everything the gate forbids in client_payload.
  const internal_payload = {
    weights: input.pillars.map((p) => ({ pillar: p.pillar, weight: p.weight })),
    pillar_signals: input.pillars.map((p) => ({ pillar: p.pillar, signals: p.signals, confidence: p.signal_confidence, degraded: p.degraded })),
    raw_signals: input.signals,
    full_spyfu: input.signals.spyfu,
    compliance_surface: input.compliance,
    locked_detail: {
      lead_lifecycle: "Full lead-lifecycle audit reserved for the paid diagnostic.",
      monetization: "Full monetization & retention audit reserved for the paid diagnostic.",
    },
  };

  return { client_payload, internal_payload };
}
