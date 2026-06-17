import { describe, expect, it } from "vitest";
import { score, type ScoreInput } from "./score";
import type { ComplianceSurface, SiteSignals } from "./types";

const baseSignals: SiteSignals = {
  has_meta_pixel: false, has_tiktok_pixel: false, has_linkedin_insight: false,
  has_google_ads_conv: false, has_ga4: false, has_gtm: false,
  has_server_side_signal: false, server_side_conf: "low",
  has_call_tracking: false, call_tracking_vendor: null,
  has_booking_widget: false, booking_vendor: null,
  has_retargeting: false, runs_paid_likely: false, runs_paid_conf: "low",
  location_count: null, schema_types: [], robots_blocks_ai: false, llms_txt: false,
  spyfu: null,
};

const cleanCompliance: ComplianceSurface = {
  tier1: { phi_context_pixel_detected: false, phi_context_conf: "low", privacy_policy_present: true, privacy_policy_url: "/privacy", privacy_policy_addresses_tracking: true, cookie_consent_detected: true, consent_platform: "OneTrust" },
  tier2: { terms_of_use_present: true, phone_form_present: false, tcpa_opt_in_language_detected: false, https_enforced: true, mixed_content: false, accessibility_score: 90, accessibility_below_threshold: false },
};

const baseInput: ScoreInput = {
  business_type: "local",
  signals: baseSignals,
  speed: null,
  extras: { hasClickToCall: false, hasReviewSchema: false, hasLeadForm: false },
};

describe("scorer", () => {
  it("produces a composite, achievable (≤90), gap, and tier", () => {
    const r = score(baseInput, cleanCompliance);
    expect(r.scores.achievable).toBe(90);
    expect(r.scores.gap).toBe(90 - r.scores.composite);
    expect(["A", "B", "C", "D", "X"]).toContain(r.scores.tier);
    expect(r.pillars).toHaveLength(5);
  });

  it("PROPERTY: raising any single sub-signal band never increases the Gap", () => {
    const base = score(baseInput, cleanCompliance).scores.gap;

    const improvements: ((s: SiteSignals) => SiteSignals)[] = [
      (s) => ({ ...s, has_google_ads_conv: true }),
      (s) => ({ ...s, has_meta_pixel: true }),
      (s) => ({ ...s, has_server_side_signal: true }),
      (s) => ({ ...s, has_retargeting: true }),
      (s) => ({ ...s, runs_paid_likely: true, runs_paid_conf: "high" }),
      (s) => ({ ...s, schema_types: ["MedicalBusiness", "FAQPage"] }),
      (s) => ({ ...s, llms_txt: true }),
      (s) => ({ ...s, has_booking_widget: true }),
    ];
    for (const mut of improvements) {
      const g = score({ ...baseInput, signals: mut(baseSignals) }, cleanCompliance).scores.gap;
      expect(g).toBeLessThanOrEqual(base);
    }

    // extras + speed improvements too
    const withExtras = score(
      { ...baseInput, extras: { hasClickToCall: true, hasReviewSchema: true, hasLeadForm: true } },
      cleanCompliance
    ).scores.gap;
    expect(withExtras).toBeLessThanOrEqual(base);
  });

  it("high-risk compliance + big gap ⇒ tier A", () => {
    const risky: ComplianceSurface = {
      tier1: { phi_context_pixel_detected: true, phi_context_conf: "high", privacy_policy_present: false, privacy_policy_url: null, privacy_policy_addresses_tracking: false, cookie_consent_detected: false, consent_platform: null },
      tier2: { terms_of_use_present: false, phone_form_present: true, tcpa_opt_in_language_detected: false, https_enforced: false, mixed_content: true, accessibility_score: 50, accessibility_below_threshold: true },
    };
    const r = score(baseInput, risky); // base signals → big gap
    expect(r.scores.compliance_risk_score).toBeGreaterThanOrEqual(60);
    expect(r.scores.tier).toBe("A");
  });
});
