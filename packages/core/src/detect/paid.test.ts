import { describe, expect, it } from "vitest";
import { inferPaid } from "./paid";
import { enrichSpyFu } from "../collect/spyfu";
import { parsePage } from "../collect/parse";
import type { CrawlResult } from "../collect/crawl-types";

function crawlOf(html: string, url = "https://spa.com/"): CrawlResult {
  return {
    domain: "spa.com", finalUrl: url, fetchedAt: "x",
    pages: [parsePage(html, url, 200)],
    robotsTxt: null, sitemapXml: null, llmsTxt: null, privacyHtml: null, termsHtml: null,
    errors: [], via: "fetch",
  };
}

describe("inferPaid", () => {
  it("high confidence with a Google Ads conversion tag", () => {
    const r = inferPaid(crawlOf(`<script>gtag('config','AW-123456789')</script>`));
    expect(r).toEqual({ runs_paid_likely: true, runs_paid_conf: "high" });
  });
  it("medium confidence with a Meta Lead event", () => {
    const r = inferPaid(crawlOf(`<script>fbq('track','Lead')</script>`));
    expect(r.runs_paid_likely).toBe(true);
    expect(r.runs_paid_conf).toBe("medium");
  });
  it("low / not-likely when no paid signal", () => {
    expect(inferPaid(crawlOf(`<h1>hi</h1>`))).toEqual({ runs_paid_likely: false, runs_paid_conf: "low" });
  });
});

describe("enrichSpyFu fallback", () => {
  it("returns coverage:none with no API key (scan still completes)", async () => {
    expect(await enrichSpyFu("spa.com")).toEqual({ coverage: "none" });
  });
});
