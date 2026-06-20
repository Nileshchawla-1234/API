import { crawl } from "./collect/crawl";
import { getSpeed } from "./collect/speed";
import { enrichSpyFu } from "./collect/spyfu";
import { extractOrg } from "./collect/org";
import { detectSignals } from "./detect/signals";
import { inferPaid } from "./detect/paid";
import { detectCompliance } from "./detect/compliance";
import { score } from "./score";
import { composeReport } from "./report";
import { enhanceReportCopy } from "./ai/copy";
import { normalizeDomain, reportSlug } from "./util/domain";
import type { BusinessType, ScanRecord, ScanSource } from "./types";

export interface ScanOptions {
  browserlessToken?: string;
  browserlessUrl?: string;
  googleApiKey?: string;
  spyfuApiKey?: string;
  anthropicApiKey?: string;
  businessType?: BusinessType;
  source?: ScanSource;
  maxPages?: number;
}

/**
 * The full pipeline (spec §9): crawl → speed → detect → inferPaid → SpyFu →
 * compliance → score → composeReport. Returns a ScanRecord ready to persist.
 * Pure of storage; the worker/CLI calls store.saveScanResult on the result.
 */
export async function scanDomain(domain: string, opts: ScanOptions = {}): Promise<ScanRecord> {
  // Crawl and PageSpeed are independent (PageSpeed only needs the URL), so run
  // them in parallel — roughly halves wall-clock vs running them in sequence.
  const startUrl = `https://${normalizeDomain(domain)}`;
  const [crawled, speed] = await Promise.all([
    crawl(domain, {
      browserlessToken: opts.browserlessToken,
      browserlessUrl: opts.browserlessUrl,
      maxPages: opts.maxPages,
    }),
    getSpeed(startUrl, opts.googleApiKey),
  ]);

  const base = detectSignals(crawled);
  const paid = inferPaid(crawled);
  const spyfu = await enrichSpyFu(crawled.domain, opts.spyfuApiKey);
  const signals = { ...base, ...paid, spyfu };

  const compliance = detectCompliance(crawled, { accessibilityScore: speed.mobile.accessibility });

  const extras = {
    hasClickToCall: crawled.pages.some((p) => p.telLinks.length > 0),
    hasReviewSchema: signals.schema_types.some((t) => /aggregaterating|review/i.test(t)),
    hasLeadForm: crawled.pages.some((p) => p.forms.length > 0),
  };

  const business_type = opts.businessType ?? "local";
  const { pillars, scores } = score({ business_type, signals, speed, extras }, compliance);

  const scanDate = new Date().toISOString();
  // Business name + location from the site's own schema (omitted if not published).
  const org = extractOrg(crawled);
  const { client_payload, internal_payload } = composeReport({
    domain: crawled.domain,
    business_name: org.name,
    location: org.location,
    scanDate,
    signals,
    speed,
    compliance,
    pillars,
    scores,
  });

  // Optional AI copy pass — guarded so it can only rephrase, never fabricate.
  const enhanced = await enhanceReportCopy(client_payload, opts.anthropicApiKey);

  return {
    domain: crawled.domain,
    vertical: "medspa",
    business_type,
    geo: org.location ?? null,
    status: crawled.pages.length > 0 ? "complete" : "partial",
    source: opts.source ?? "public",
    scores,
    site_signals: signals,
    compliance_surface: compliance,
    pillars,
    report: {
      slug: reportSlug(crawled.domain, crypto.randomUUID()),
      model: enhanced.model,
      prompt_version: enhanced.promptVersion,
      client_payload: enhanced.payload,
      internal_payload,
    },
    raw: { via: crawled.via, pages: crawled.pages.length, errors: crawled.errors },
    completed_at: scanDate,
  };
}
