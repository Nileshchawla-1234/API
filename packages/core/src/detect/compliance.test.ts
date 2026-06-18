import { describe, expect, it } from "vitest";
import { detectCompliance } from "./compliance";
import { parsePage } from "../collect/parse";
import type { CrawlPage, CrawlResult } from "../collect/crawl-types";

function crawl(pages: { html: string; url: string }[], extra: Partial<CrawlResult> = {}): CrawlResult {
  return {
    domain: "spa.com",
    finalUrl: pages[0]!.url,
    fetchedAt: "x",
    pages: pages.map((p) => parsePage(p.html, p.url, 200, {})),
    robotsTxt: null, sitemapXml: null, llmsTxt: null, privacyHtml: null, termsHtml: null,
    errors: [], via: "fetch",
    ...extra,
  };
}

describe("detectCompliance — high-risk med spa", () => {
  const c = crawl(
    [
      {
        url: "https://spa.com/services/botox/",
        html: `<script src="https://connect.facebook.net/en_US/fbevents.js"></script>
               <form><input name="name"><input name="phone" type="tel"></form>
               <p>By submitting you consent to receive marketing texts, message and data rates may apply.</p>`,
      },
    ],
    { privacyHtml: "We use cookies and Meta pixel tracking with advertising partners." }
  );
  const s = detectCompliance(c, { accessibilityScore: 64 });

  it("flags PHI-context pixel at HIGH confidence (pixel on treatment URL with a form)", () => {
    expect(s.tier1.phi_context_pixel_detected).toBe(true);
    expect(s.tier1.phi_context_conf).toBe("high");
  });
  it("detects privacy policy + tracking language, phone form, TCPA, low a11y", () => {
    expect(s.tier1.privacy_policy_present).toBe(true);
    expect(s.tier1.privacy_policy_addresses_tracking).toBe(true);
    expect(s.tier2.phone_form_present).toBe(true);
    expect(s.tier2.tcpa_opt_in_language_detected).toBe(true);
    expect(s.tier2.accessibility_below_threshold).toBe(true);
  });
  it("notes missing cookie consent", () => {
    expect(s.tier1.cookie_consent_detected).toBe(false);
  });
});

describe("detectCompliance — clean site", () => {
  const c = crawl([{ url: "https://clean.com/", html: `<h1>Hello</h1><p>No pixels here</p>` }]);
  const s = detectCompliance(c, { accessibilityScore: 92 });
  it("is low risk", () => {
    expect(s.tier1.phi_context_pixel_detected).toBe(false);
    expect(s.tier2.accessibility_below_threshold).toBe(false);
  });
});
