import { describe, expect, it } from "vitest";
import { hasNoFabrication, extractNumbers, assertGated } from "./guardrail";
import { composeReport } from "../report";
import { score } from "../score";
import type { ComplianceSurface, SiteSignals } from "../types";

describe("no-fabrication guardrail (spec §7)", () => {
  it("passes when output numbers all appear in the input", () => {
    const facts = "Mobile LCP: 5.6s. Estimated organic keywords: 1,240.";
    expect(hasNoFabrication(facts, "Your LCP is 5.6s and you rank for ~1240 organic keywords.").ok).toBe(true);
  });
  it("FAILS when the output invents a number", () => {
    const r = hasNoFabrication("Mobile LCP: 5.6s.", "Your LCP is 5.6s — that's costing you 30% of conversions.");
    expect(r.ok).toBe(false);
    expect(r.offending).toContain("30");
  });
  it("strips thousands separators when comparing", () => {
    expect(extractNumbers("1,240 reviews").has("1240")).toBe(true);
  });
});

const signals: SiteSignals = {
  has_meta_pixel: true, has_tiktok_pixel: false, has_linkedin_insight: false,
  has_google_ads_conv: false, has_ga4: true, has_gtm: true,
  has_server_side_signal: false, server_side_conf: "low",
  has_call_tracking: false, call_tracking_vendor: null,
  has_booking_widget: true, booking_vendor: "Boulevard",
  has_retargeting: true, runs_paid_likely: true, runs_paid_conf: "medium",
  location_count: 1, schema_types: ["MedicalBusiness"], robots_blocks_ai: false, llms_txt: false, spyfu: null,
};
const compliance: ComplianceSurface = {
  tier1: { phi_context_pixel_detected: true, phi_context_conf: "high", privacy_policy_present: true, privacy_policy_url: "/privacy", privacy_policy_addresses_tracking: false, cookie_consent_detected: false, consent_platform: null },
  tier2: { terms_of_use_present: false, phone_form_present: true, tcpa_opt_in_language_detected: false, https_enforced: true, mixed_content: false, accessibility_score: 64, accessibility_below_threshold: true },
};

describe("the gate (spec §6)", () => {
  it("client_payload contains no weights / internals / recommendations", () => {
    const { pillars, scores } = score({ business_type: "local", signals, speed: null, extras: { hasClickToCall: true, hasReviewSchema: false, hasLeadForm: true } }, compliance);
    const { client_payload, internal_payload } = composeReport({
      domain: "spa.com", scanDate: "2026-06-15T00:00:00Z", signals, speed: null, compliance, pillars, scores,
    });
    expect(assertGated(client_payload).ok).toBe(true);
    // the forbidden detail DOES live in internal_payload
    expect(internal_payload.weights).toBeDefined();
    expect(internal_payload.raw_signals).toBeDefined();
  });

  it("locked pillars are teased but carry no substance in client_payload", () => {
    const { pillars, scores } = score({ business_type: "local", signals, speed: null, extras: { hasClickToCall: false, hasReviewSchema: false, hasLeadForm: false } }, compliance);
    const { client_payload } = composeReport({ domain: "spa.com", scanDate: "x", signals, speed: null, compliance, pillars, scores });
    expect(client_payload.locked).toHaveLength(2);
    expect(client_payload.locked[0]).toHaveProperty("tease");
    expect(client_payload.locked[0]).not.toHaveProperty("findings");
  });

  it("compliance language hygiene: no 'Legal Exposure', uses disclaimers", () => {
    const { pillars, scores } = score({ business_type: "local", signals, speed: null, extras: { hasClickToCall: false, hasReviewSchema: false, hasLeadForm: false } }, compliance);
    const { client_payload } = composeReport({ domain: "spa.com", scanDate: "x", signals, speed: null, compliance, pillars, scores });
    const json = JSON.stringify(client_payload);
    expect(json).not.toMatch(/legal exposure/i);
    expect(client_payload.compliance.disclaimer).toMatch(/not a legal determination/i);
  });
});
