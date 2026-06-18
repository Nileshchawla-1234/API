import type { CrawlPage, CrawlResult } from "../collect/crawl-types";
import type { ComplianceSurface, Confidence } from "../types";
import { PIXELS } from "./signatures";

// detectCompliance (spec §4f) → ComplianceSurface (§3). STRUCTURAL PATTERN FLAGS
// ONLY — never legal verdicts. Every output is a surface observation with
// confidence; the report attaches the disclaimer.

const TREATMENT_PATH = /\/(botox|filler|laser|coolsculpting|treatments?|services|consultation)/i;
const INTAKE_FIELD = /(name|email|phone|tel|dob|birth|date|message|reason|treatment)/i;
const TRACKING_TERMS = [
  /pixel/i, /tracking/i, /\bmeta\b/i, /facebook/i, /google analytics/i,
  /advertising partners/i, /third[- ]party/i, /cookies?/i,
];
const TCPA = /consent to receive|marketing texts|\bSMS\b|message (and data )?rates|text messages/i;

const CONSENT_PLATFORMS: { name: string; re: RegExp }[] = [
  { name: "OneTrust", re: /otSDKStub|cdn\.cookielaw\.org|onetrust/i },
  { name: "Cookiebot", re: /consent\.cookiebot|cookiebot/i },
  { name: "CookieYes", re: /cookieyes/i },
  { name: "Termly", re: /termly/i },
  { name: "Iubenda", re: /iubenda/i },
  { name: "Quantcast", re: /__cmp|quantcast/i },
];

function pageText(p: CrawlPage): string {
  return [p.html, p.scripts.join("\n"), p.inlineScripts.join("\n")].join("\n");
}

function pageHasPixel(p: CrawlPage): boolean {
  const t = pageText(p);
  return [...PIXELS.meta_pixel, ...PIXELS.google_ads_conv].some((re) => re.test(t));
}

function pageHasIntakeForm(p: CrawlPage): boolean {
  return p.forms.some((f) => f.inputs.some((i) => INTAKE_FIELD.test(`${i.name ?? ""} ${i.type ?? ""}`)));
}

export function detectCompliance(
  crawl: CrawlResult,
  opts: { accessibilityScore?: number | null } = {}
): ComplianceSurface {
  const allHtml = crawl.pages.map(pageText).join("\n");

  // ── PHI-context pixel ──────────────────────────────────────────────────────
  let phi = false;
  let phiConf: Confidence = "medium";
  for (const p of crawl.pages) {
    if (!pageHasPixel(p)) continue;
    const onTreatment = TREATMENT_PATH.test(p.url);
    const hasForm = pageHasIntakeForm(p);
    if (onTreatment || hasForm) {
      phi = true;
      if (onTreatment && hasForm) {
        phiConf = "high"; // strongest signal — keep and stop
        break;
      }
    }
  }

  // ── Privacy policy ──────────────────────────────────────────────────────────
  const privacyPresent = Boolean(crawl.privacyHtml);
  const privacyUrl = privacyPresent
    ? crawl.pages.some((p) => /privacy/i.test(p.html)) ? "/privacy" : "/privacy-policy"
    : null;
  const privacyAddressesTracking =
    privacyPresent && crawl.privacyHtml
      ? TRACKING_TERMS.filter((re) => re.test(crawl.privacyHtml!)).length >= 2
      : false;

  // ── Cookie consent ──────────────────────────────────────────────────────────
  const consent = CONSENT_PLATFORMS.find((c) => c.re.test(allHtml)) ?? null;
  const genericConsent = /\[id\*=.?cookie.?\]|class=["'][^"']*cookie[^"']*consent/i.test(allHtml);

  // ── Tier 2 ──────────────────────────────────────────────────────────────────
  const phoneForm = crawl.pages.some((p) =>
    p.forms.some((f) => f.inputs.some((i) => /phone|tel/i.test(`${i.name ?? ""} ${i.type ?? ""}`)))
  );
  const home = crawl.pages[0];
  const hsts = Boolean(home && Object.keys(home.headers).some((h) => h.toLowerCase() === "strict-transport-security"));
  const httpsEnforced = Boolean(crawl.finalUrl.startsWith("https://") && hsts);
  const mixed = crawl.pages.some((p) => p.mixedContent.length > 0);
  const a11y = opts.accessibilityScore ?? null;

  return {
    tier1: {
      phi_context_pixel_detected: phi,
      phi_context_conf: phiConf,
      privacy_policy_present: privacyPresent,
      privacy_policy_url: privacyUrl,
      privacy_policy_addresses_tracking: privacyAddressesTracking,
      cookie_consent_detected: Boolean(consent) || genericConsent,
      consent_platform: consent?.name ?? null,
    },
    tier2: {
      terms_of_use_present: Boolean(crawl.termsHtml),
      phone_form_present: phoneForm,
      tcpa_opt_in_language_detected: TCPA.test(allHtml),
      https_enforced: httpsEnforced,
      mixed_content: mixed,
      accessibility_score: a11y,
      accessibility_below_threshold: a11y !== null ? a11y < 70 : false,
    },
  };
}
