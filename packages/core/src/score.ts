import cfg from "./scoring_config.json";
import type { SpeedResult } from "./collect/speed";
import type {
  BusinessType,
  ComplianceSurface,
  PillarKind,
  PillarResult,
  Scores,
  SiteSignals,
  Tier,
} from "./types";

// Deterministic scorer (spec §5). Pure + unit-tested, including the property
// that raising any single sub-signal band never increases the Gap.

export interface ScoreInput {
  business_type: BusinessType;
  signals: SiteSignals;
  speed: SpeedResult | null;
  extras: { hasClickToCall: boolean; hasReviewSchema: boolean; hasLeadForm: boolean };
}

const B = cfg.bands; // absent/partial/solid/best
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

interface SubSignal {
  key: string;
  weight: number;
  band: (i: ScoreInput) => number;
  degraded?: (i: ScoreInput) => boolean;
}

const REL_SCHEMA = /(localbusiness|medical|dentist|clinic|organization|physician|healthandbeauty)/i;
const AI_SCHEMA = /(localbusiness|medical|faqpage|qapage|service|article|product|physician)/i;

const PILLARS: Record<PillarKind, SubSignal[]> = {
  paid: [
    { key: "conversion_tracking", weight: 0.35, band: (i) =>
        i.signals.has_google_ads_conv ? B.best : i.signals.has_meta_pixel ? B.solid
        : i.signals.has_ga4 || i.signals.has_gtm ? B.partial : B.absent },
    { key: "server_side", weight: 0.25, band: (i) => (i.signals.has_server_side_signal ? B.solid : B.absent) },
    { key: "retargeting", weight: 0.20, band: (i) => (i.signals.has_retargeting ? B.solid : B.absent) },
    { key: "runs_paid", weight: 0.20, band: (i) =>
        i.signals.runs_paid_likely && i.signals.runs_paid_conf === "high" ? B.best
        : i.signals.runs_paid_likely ? B.solid : B.absent },
  ],
  search: [
    { key: "seo_health", weight: 0.45,
      band: (i) => (i.speed?.mobile.seo ?? null) !== null ? clamp(i.speed!.mobile.seo!) : B.partial,
      degraded: (i) => (i.speed?.mobile.seo ?? null) === null },
    { key: "schema", weight: 0.30, band: (i) =>
        i.signals.schema_types.some((t) => REL_SCHEMA.test(t)) ? B.best
        : i.signals.schema_types.length ? B.partial : B.absent },
    { key: "organic_footprint", weight: 0.25,
      band: (i) => {
        const sp = i.signals.spyfu;
        if (!sp || sp.coverage === "none" || !sp.organic) return B.partial; // unknown
        const kw = sp.organic.organic_keywords;
        return kw >= 1000 ? B.best : kw >= 300 ? B.solid : kw >= 50 ? B.partial : B.absent;
      },
      degraded: (i) => !i.signals.spyfu || i.signals.spyfu.coverage === "none" },
  ],
  ai: [
    { key: "ai_crawler_access", weight: 0.40, band: (i) => (i.signals.robots_blocks_ai ? B.absent : B.best) },
    { key: "ai_schema", weight: 0.35, band: (i) => {
        const n = i.signals.schema_types.filter((t) => AI_SCHEMA.test(t)).length;
        return n >= 2 ? B.best : n === 1 ? B.solid : B.absent;
      } },
    { key: "llms_txt", weight: 0.25, band: (i) => (i.signals.llms_txt ? B.best : B.partial) },
  ],
  reputation: [
    // No reviews API yet → low-confidence proxy; flagged degraded.
    { key: "review_schema", weight: 0.6, band: (i) => (i.extras.hasReviewSchema ? B.solid : B.absent), degraded: () => true },
    { key: "review_presence", weight: 0.4, band: (i) => (i.extras.hasReviewSchema ? B.partial : B.absent), degraded: () => true },
  ],
  conversion: [
    { key: "lcp", weight: 0.40,
      band: (i) => {
        const lcp = i.speed?.cwv?.lcpMs ?? null;
        if (lcp === null) return B.partial;
        return lcp <= cfg.lcpMs.good ? B.best : lcp <= cfg.lcpMs.ok ? 55 : B.absent;
      },
      degraded: (i) => (i.speed?.cwv?.lcpMs ?? null) === null },
    { key: "server_side", weight: 0.25, band: (i) => (i.signals.has_server_side_signal ? B.solid : B.absent) },
    { key: "form_friction", weight: 0.20, band: (i) =>
        i.signals.has_booking_widget ? B.best : i.extras.hasLeadForm ? B.solid : B.partial },
    { key: "click_to_call", weight: 0.15, band: (i) => (i.extras.hasClickToCall ? B.solid : B.absent) },
  ],
};

function scorePillar(kind: PillarKind, input: ScoreInput, weight: number): PillarResult {
  const subs = PILLARS[kind];
  let score = 0;
  let degraded = false;
  const signalSnapshot: Record<string, number> = {};
  for (const s of subs) {
    const band = clamp(s.band(input));
    signalSnapshot[s.key] = band;
    score += s.weight * band;
    if (s.degraded?.(input)) degraded = true;
  }
  return {
    pillar: kind,
    score: clamp(score),
    weight,
    signal_confidence: degraded ? "low" : "high",
    signals: signalSnapshot,
    findings: [],
    degraded,
  };
}

function complianceRisk(c: ComplianceSurface): number {
  // Weighted % of "bad" flags firing. PHI-context + missing consent weigh most.
  const t1 =
    (c.tier1.phi_context_pixel_detected ? 0.5 : 0) +
    (!c.tier1.cookie_consent_detected ? 0.3 : 0) +
    (!c.tier1.privacy_policy_addresses_tracking ? 0.2 : 0);
  const t2 =
    (!c.tier2.https_enforced ? 0.25 : 0) +
    (c.tier2.mixed_content ? 0.2 : 0) +
    (c.tier2.phone_form_present && !c.tier2.tcpa_opt_in_language_detected ? 0.2 : 0) +
    (c.tier2.accessibility_below_threshold ? 0.15 : 0) +
    (!c.tier2.terms_of_use_present ? 0.2 : 0);
  return clamp((0.6 * t1 + 0.4 * t2) * 100);
}

function tierOf(risk: number, gap: number): Tier {
  const { highRisk, highGap, modRisk, modGap } = cfg.tier;
  const hiRisk = risk >= highRisk;
  const hiGap = gap >= highGap;
  if (hiRisk && hiGap) return "A";
  if (hiRisk || hiGap) return "B";
  if (risk >= modRisk || gap >= modGap) return "C";
  return "D";
}

export interface ScoreResult {
  pillars: PillarResult[];
  scores: Scores;
}

export function score(input: ScoreInput, compliance: ComplianceSurface): ScoreResult {
  const weights = cfg.pillarWeights[input.business_type];
  const kinds: PillarKind[] = ["paid", "search", "ai", "reputation", "conversion"];
  const pillars = kinds.map((k) => scorePillar(k, input, weights[k]));

  const composite = clamp(pillars.reduce((sum, p) => sum + p.score * p.weight, 0));
  // Achievable = every sub-signal forced to best-practice band, capped. Since
  // weights sum to 1, this is the cap — and being independent of actual bands is
  // exactly what guarantees no detector can inflate the Gap.
  const achievable = Math.min(cfg.achievableCap, B.best);
  const gap = Math.max(0, achievable - composite);
  const compliance_risk_score = complianceRisk(compliance);
  const tier = tierOf(compliance_risk_score, gap);

  return {
    pillars,
    scores: { composite, achievable, gap, tier, compliance_risk_score },
  };
}
