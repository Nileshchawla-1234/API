// Detection signatures (spec §4e), kept as data — not hardcoded in logic — so
// they're easy to audit and extend. Each entry is a set of regexes; a match in
// the combined page source means the technology is present.

export const PIXELS = {
  meta_pixel: [/connect\.facebook\.net\/[^"']*\/fbevents\.js/i, /\bfbq\(\s*['"]init['"]/i, /\b_fbp\b/],
  ga4: [/gtag\/js\?id=G-/i, /google-analytics\.com\/g\/collect/i, /\bG-[A-Z0-9]{6,}\b/],
  gtm: [/googletagmanager\.com\/gtm\.js/i, /\bGTM-[A-Z0-9]+\b/],
  google_ads_conv: [/gtag\(\s*['"]config['"]\s*,\s*['"]AW-/i, /googleadservices\.com\/pagead\/conversion/i, /\bAW-\d{6,}\b/],
  tiktok: [/analytics\.tiktok\.com/i, /\bttq\.(load|page|track)\b/i],
  linkedin: [/snap\.licdn\.com\/li\.lms-analytics/i, /_linkedin_partner_id/i],
} as const;

export interface VendorSig {
  vendor: string;
  re: RegExp[];
}

export const CALL_TRACKING: VendorSig[] = [
  { vendor: "CallRail", re: [/cdn\.callrail\.com/i, /\bcallrail\b/i, /\/swap\.js/i] },
  { vendor: "CallTrackingMetrics", re: [/tctm\.co/i, /calltrackingmetrics/i] },
  { vendor: "Invoca", re: [/invoca/i] },
  { vendor: "WhatConverts", re: [/whatconverts/i] },
  { vendor: "Ringba", re: [/ringba/i] },
];

export const BOOKING: VendorSig[] = [
  { vendor: "Square", re: [/squareup\.com\/appointments/i] },
  { vendor: "Zenoti", re: [/zenoti/i] },
  { vendor: "Vagaro", re: [/vagaro\.com/i] },
  { vendor: "Boulevard", re: [/blvd\.co/i, /getboulevard/i] },
  { vendor: "Mindbody", re: [/mindbody/i, /healcode/i] },
  { vendor: "Calendly", re: [/calendly\.com/i] },
  { vendor: "Acuity", re: [/acuityscheduling/i] },
  { vendor: "Jane", re: [/jane\.app/i, /janeapp/i] },
];

// First-party server-side tagging signals (sGTM / Stape). Medium confidence —
// per spec we report "no clear signal", never assert "none".
export const SERVER_SIDE = [/\.stape\.io/i, /\bsgtm\./i, /\/server-side-tagging\b/i];

// AI crawler user-agents we check robots.txt against.
export const AI_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "anthropic-ai", "Claude-Web",
  "PerplexityBot", "Google-Extended", "CCBot", "Bytespider", "Applebot-Extended",
];
