import type { CrawlResult } from "../collect/crawl-types";
import type { SiteSignals } from "../types";
import { BOOKING, CALL_TRACKING, PIXELS, SERVER_SIDE, type VendorSig } from "./signatures";
import { collectSchemaTypes } from "./schema";
import { robotsBlocksAi } from "./robots";

/** Combine every page's markup + scripts into one haystack for signature tests. */
function haystack(crawl: CrawlResult): string {
  const parts: string[] = [];
  for (const p of crawl.pages) {
    parts.push(p.html);
    parts.push(p.scripts.join("\n"));
    parts.push(p.inlineScripts.join("\n"));
  }
  return parts.join("\n");
}

function anyMatch(res: readonly RegExp[], hay: string): boolean {
  return res.some((re) => re.test(hay));
}

function firstVendor(sigs: VendorSig[], hay: string): string | null {
  for (const s of sigs) if (anyMatch(s.re, hay)) return s.vendor;
  return null;
}

/**
 * Surface-signal detectors (spec §4e). Pure over the crawl result. Produces the
 * `site_signals` fields. `runs_paid_*` (S7 inferPaid) and `spyfu` (S7) are left
 * at defaults here and merged by scan().
 */
export function detectSignals(crawl: CrawlResult): SiteSignals {
  const hay = haystack(crawl);

  const has_meta_pixel = anyMatch(PIXELS.meta_pixel, hay);
  const has_ga4 = anyMatch(PIXELS.ga4, hay);
  const has_gtm = anyMatch(PIXELS.gtm, hay);
  const has_google_ads_conv = anyMatch(PIXELS.google_ads_conv, hay);
  const has_tiktok_pixel = anyMatch(PIXELS.tiktok, hay);
  const has_linkedin_insight = anyMatch(PIXELS.linkedin, hay);

  const has_server_side_signal = anyMatch(SERVER_SIDE, hay);
  const call_tracking_vendor = firstVendor(CALL_TRACKING, hay);
  const booking_vendor = firstVendor(BOOKING, hay);

  // Audience-building pixels imply retargeting capability.
  const has_retargeting =
    has_meta_pixel || has_google_ads_conv || has_tiktok_pixel || has_linkedin_insight;

  const schema_types = collectSchemaTypes(crawl.pages.flatMap((p) => p.jsonLd));

  return {
    has_meta_pixel,
    has_tiktok_pixel,
    has_linkedin_insight,
    has_google_ads_conv,
    has_ga4,
    has_gtm,
    has_server_side_signal,
    server_side_conf: has_server_side_signal ? "medium" : "low",
    has_call_tracking: call_tracking_vendor !== null,
    call_tracking_vendor,
    has_booking_widget: booking_vendor !== null,
    booking_vendor,
    has_retargeting,
    // Defaults — filled by inferPaid (S7) + enrichSpyFu (S7).
    runs_paid_likely: false,
    runs_paid_conf: "low",
    location_count: null,
    schema_types,
    robots_blocks_ai: robotsBlocksAi(crawl.robotsTxt),
    llms_txt: Boolean(crawl.llmsTxt),
    spyfu: null,
  };
}
