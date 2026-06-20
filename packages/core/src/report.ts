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
  } else if (kind === "search") {
    if (!s.schema_types.some((t) => /localbusiness|medical/i.test(t)))
      add("Missing the local-business markup Google looks for", "crawl");
    if (i.speed?.mobile.seo != null) add(`Search-readiness score: ${i.speed.mobile.seo}/100`, "PageSpeed");
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
  // Potential PHI context
  if (c.tier1.phi_context_pixel_detected)
    rows.push({ signal: "Potential PHI-context pixel detected", observed: "present", tier: 1, confidence: c.tier1.phi_context_conf, why: "When advertising or analytics pixels appear on treatment, consultation, or intake-style pages, visitor activity may occur in a sensitive context. This deserves closer review because tracking, privacy language, and consent expectations should stay aligned." });

  // Privacy policy
  if (c.tier1.privacy_policy_present && c.tier1.privacy_policy_addresses_tracking)
    rows.push({ signal: "Privacy policy present", observed: "present", tier: 1, confidence: "high", why: "A visible privacy policy helps visitors understand how the site may collect, use, and share information. For med spa websites, this becomes more important when advertising pixels, analytics tools, forms, or booking flows are present." });
  else
    rows.push({ signal: "Privacy policy does not clearly address tracking", observed: "unclear", tier: 1, confidence: "low", why: "If tracking tools are present but the privacy policy does not clearly mention cookies, pixels, analytics, advertising partners, or third-party tracking, there may be a communication gap between what the site does and what visitors are told." });

  // Cookie consent
  if (c.tier1.cookie_consent_detected)
    rows.push({ signal: "Cookie consent detected", observed: "present", tier: 1, confidence: "medium", why: "A consent platform is a positive structural signal. It suggests the site has some mechanism for disclosing or managing tracking preferences, though the exact implementation still needs human review." });
  else
    rows.push({ signal: "Cookie consent not detected", observed: "absent", tier: 1, confidence: "medium", why: "A consent layer can help visitors understand and control non-essential tracking. If pixels or advertising scripts are active without a visible consent experience, it may increase trust and compliance review concerns." });

  // Secure connection
  if (c.tier2.mixed_content)
    rows.push({ signal: "Mixed content detected", observed: "present", tier: 2, confidence: "medium", why: "Mixed content can weaken the secure browsing experience by loading some assets over unsecured connections. It may create browser warnings, break page elements, or reduce visitor trust." });
  else if (c.tier2.https_enforced)
    rows.push({ signal: "HTTPS enforced", observed: "yes", tier: 2, confidence: "high", why: "HTTPS is a positive trust signal. It helps protect the visitor experience, reduces browser warnings, and supports a more secure path through forms, booking links, and landing pages." });
  else
    rows.push({ signal: "Secure connection not fully enforced", observed: "partial", tier: 2, confidence: "medium", why: "Some visits may not be fully encrypted, which can trigger browser warnings and reduce visitor trust." });

  // Phone form / opt-in
  if (c.tier2.phone_form_present && !c.tier2.tcpa_opt_in_language_detected)
    rows.push({ signal: "Phone form without clear opt-in wording", observed: "present", tier: 2, confidence: "medium", why: "If a form collects phone numbers but nearby SMS or marketing consent language is not visible, the follow-up workflow may need closer review before using automated texts or promotional messages." });
  else if (c.tier2.phone_form_present)
    rows.push({ signal: "Phone form with opt-in wording", observed: "present", tier: 2, confidence: "medium", why: "When a website collects phone numbers, the follow-up process matters. Clear consent language helps set expectations around calls, texts, reminders, and marketing communication." });

  // Terms of use
  if (!c.tier2.terms_of_use_present)
    rows.push({ signal: "Terms of use not detected", observed: "absent", tier: 2, confidence: "medium", why: "Terms of use help set expectations around website content, service information, limitations, and visitor responsibilities. Missing terms can make the website's public-facing governance look incomplete." });

  // Accessibility
  if (c.tier2.accessibility_below_threshold)
    rows.push({ signal: "Accessibility score below threshold", observed: `score ${c.tier2.accessibility_score}`, tier: 2, confidence: "high", why: "Accessibility affects how easily visitors can read, navigate, and complete actions on the site. A low score may mean some users struggle to engage with the page or complete a booking path." });

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

const COMPLIANCE_INTRO =
  "Your Compliance Surface looks at public website patterns such as tracking pixels, treatment pages, forms, privacy language, consent tools, phone collection, HTTPS, and accessibility. These are structural flags only — not legal conclusions.";
const COMPLIANCE_DISCLAIMER =
  "This Compliance Surface is a structural pattern review based on publicly visible website signals. It is not a legal determination, legal advice, or a finding of non-compliance. Any compliance decisions should be reviewed with your legal, privacy, or compliance advisor.";
const FOOTER_DISCLAIMER =
  "The Compounding Method is a marketing operations firm, not a law firm. Compliance Surface findings are based on structural website patterns and public signals only. They should be used as discussion points for further review, not as legal conclusions.";

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
      intro: COMPLIANCE_INTRO,
      rows: complianceRows(input.compliance),
      disclaimer: COMPLIANCE_DISCLAIMER,
    },
    cwv: cwvRows(input.speed),
    cta: {
      headline: "See what's really behind your score.",
      body: "Your scan found growth gaps across acquisition, search visibility, AI readiness, reputation, conversion, and your Compliance Surface. Book a Behind-the-Score call and we'll walk through what the score means, which patterns were detected, and where the biggest compounding opportunities appear.",
      button: "Book your Behind-the-Score call",
      note: "A focused review of your actual scan — not a generic website audit.",
    },
    footer_disclaimer: FOOTER_DISCLAIMER,
  };

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
