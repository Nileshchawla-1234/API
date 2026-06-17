import { describe, expect, it, beforeEach } from "vitest";
import { getStore, __resetStore } from "./index";
import type { ScanRecord } from "../types";

function fixtureScan(domain: string): ScanRecord {
  return {
    domain,
    vertical: "medspa",
    business_type: "local",
    geo: "Scottsdale, AZ",
    status: "complete",
    source: "outreach",
    scores: { composite: 44, achievable: 87, gap: 43, tier: "A", compliance_risk_score: 72 },
    site_signals: {
      has_meta_pixel: true, has_tiktok_pixel: false, has_linkedin_insight: false,
      has_google_ads_conv: false, has_ga4: true, has_gtm: true,
      has_server_side_signal: false, server_side_conf: "low",
      has_call_tracking: false, call_tracking_vendor: null,
      has_booking_widget: true, booking_vendor: "Boulevard",
      has_retargeting: true, runs_paid_likely: true, runs_paid_conf: "medium",
      location_count: 1, schema_types: ["MedicalBusiness"], robots_blocks_ai: false, llms_txt: false,
      spyfu: null,
    },
    compliance_surface: {
      tier1: { phi_context_pixel_detected: true, phi_context_conf: "high", privacy_policy_present: true, privacy_policy_url: "/privacy", privacy_policy_addresses_tracking: false, cookie_consent_detected: false, consent_platform: null },
      tier2: { terms_of_use_present: false, phone_form_present: true, tcpa_opt_in_language_detected: false, https_enforced: true, mixed_content: false, accessibility_score: 64, accessibility_below_threshold: true },
    },
    pillars: [],
    report: {
      slug: "test-spa-abc123", model: null, prompt_version: null,
      client_payload: {
        header: { domain, scan_date: "2026-06-15", tier: "A" },
        score: { composite: 44, achievable: 87, gap: 43 },
        pillars: [], locked: [], compliance: { risk: 72, rows: [], disclaimer: "" },
        cwv: [], cta: { headline: "", body: "", button: "Book" }, footer_disclaimer: "",
      },
      internal_payload: {},
    },
    completed_at: "2026-06-15T00:00:00.000Z",
  };
}

describe("storage seam (S1/S2)", () => {
  beforeEach(() => __resetStore());

  it("defaults to in-memory with no credentials", () => {
    expect(getStore().kind).toBe("memory");
  });

  it("persists a scan and reads its report back by slug", async () => {
    const store = getStore();
    const { scanId, slug } = await store.saveScanResult(fixtureScan("https://Test-Spa.com/"));
    expect(scanId).toBeTruthy();
    const payload = await store.getReportBySlug(slug);
    expect(payload?.score.gap).toBe(43);
  });

  it("indexes the latest scan by normalized domain (for cache)", async () => {
    const store = getStore();
    await store.saveScanResult(fixtureScan("https://www.Test-Spa.com"));
    const summary = await store.getLatestScanByDomain("test-spa.com");
    expect(summary?.composite).toBe(44);
  });

  it("upserts targets deduped by normalized domain", async () => {
    const store = getStore();
    await store.upsertTargets([{ domain: "https://www.A.com/" }, { domain: "a.com" }]);
    const targets = await store.listTargets();
    expect(targets).toHaveLength(1);
  });
});
