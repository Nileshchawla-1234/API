import type { CrawlResult } from "../collect/crawl-types";
import type { Confidence } from "../types";

// inferPaid (spec §4e "runs-paid"): the always-on, free signal for "is this spa
// running ads?" — a labeled INFERENCE, never asserted as fact.

const GCLID = /[?&]gclid=|gclid['"]?\s*[:=]|storeGclid|gclaw/i;
const META_LEAD = /fbq\(\s*['"]track['"]\s*,\s*['"]Lead['"]/i;
const ADS_CONV = /gtag\(\s*['"]config['"]\s*,\s*['"]AW-|googleadservices\.com\/pagead\/conversion|\bAW-\d{6,}\b/i;
const AD_LP = /\/(lp|landing|ppc|offer|promo)(\/|$)/i;

export function inferPaid(crawl: CrawlResult): { runs_paid_likely: boolean; runs_paid_conf: Confidence } {
  const hay = crawl.pages.map((p) => p.html + "\n" + p.inlineScripts.join("\n") + "\n" + p.scripts.join("\n")).join("\n");
  const hasConv = ADS_CONV.test(hay);
  const hasGclid = GCLID.test(hay);
  const hasLead = META_LEAD.test(hay);
  const hasAdLp = crawl.pages.some((p) => AD_LP.test(p.url));

  if (hasConv) return { runs_paid_likely: true, runs_paid_conf: "high" };
  if (hasGclid || hasLead || hasAdLp) return { runs_paid_likely: true, runs_paid_conf: "medium" };
  return { runs_paid_likely: false, runs_paid_conf: "low" };
}
