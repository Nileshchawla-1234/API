import { describe, expect, it } from "vitest";
import { detectSignals } from "./signals";
import { parsePage } from "../collect/parse";
import type { CrawlResult } from "../collect/crawl-types";

function crawlOf(html: string, robotsTxt: string | null = null, llmsTxt: string | null = null): CrawlResult {
  return {
    domain: "spa.com",
    finalUrl: "https://spa.com/",
    fetchedAt: "2026-06-15T00:00:00Z",
    pages: [parsePage(html, "https://spa.com/", 200)],
    robotsTxt,
    sitemapXml: null,
    llmsTxt,
    privacyHtml: null,
    termsHtml: null,
    errors: [],
    via: "fetch",
  };
}

describe("detectSignals", () => {
  it("detects pixels, booking vendor, schema, retargeting on a real-ish med spa", () => {
    const html = `<html><head>
      <script src="https://connect.facebook.net/en_US/fbevents.js"></script>
      <script>fbq('init','1');gtag('js');</script>
      <script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC"></script>
      <script type="application/ld+json">{"@type":"MedicalBusiness"}</script>
      </head><body>
      <iframe src="https://radiance.zenoti.com/webstoreNew/"></iframe>
      </body></html>`;
    const s = detectSignals(crawlOf(html));
    expect(s.has_meta_pixel).toBe(true);
    expect(s.has_gtm).toBe(true);
    expect(s.has_booking_widget).toBe(true);
    expect(s.booking_vendor).toBe("Zenoti");
    expect(s.has_retargeting).toBe(true);
    expect(s.schema_types).toContain("MedicalBusiness");
  });

  it("reports clean negatives without asserting false certainty on server-side", () => {
    const s = detectSignals(crawlOf(`<html><body><h1>Hi</h1></body></html>`));
    expect(s.has_meta_pixel).toBe(false);
    expect(s.has_server_side_signal).toBe(false);
    expect(s.server_side_conf).toBe("low"); // "no clear signal", not a hard "none"
    expect(s.call_tracking_vendor).toBeNull();
  });

  it("flags AI-crawler blocking from robots.txt", () => {
    const robots = "User-agent: GPTBot\nDisallow: /";
    expect(detectSignals(crawlOf("<html></html>", robots)).robots_blocks_ai).toBe(true);
    expect(detectSignals(crawlOf("<html></html>", "User-agent: *\nDisallow:")).robots_blocks_ai).toBe(false);
  });
});
