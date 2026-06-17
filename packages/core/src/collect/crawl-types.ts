// Structured output of the crawler (spec §4a). Detectors (S5), compliance (S8)
// read from this shape — never from raw network calls.

export interface CrawlForm {
  action: string | null;
  inputs: { name: string | null; type: string | null }[];
}

export interface CrawlPage {
  url: string;
  status: number;
  html: string;
  scripts: string[]; // <script src> values
  inlineScripts: string[]; // inline <script> text
  dataLayer: unknown[] | null; // null when JS wasn't executed (fetch fallback)
  meta: Record<string, string>; // name/property → content
  jsonLd: unknown[]; // parsed JSON-LD blocks
  h1: string[];
  h2: string[];
  forms: CrawlForm[];
  telLinks: string[];
  headers: Record<string, string>;
  mixedContent: string[]; // http:// subresources on an https page
}

export interface CrawlResult {
  domain: string;
  finalUrl: string;
  fetchedAt: string;
  pages: CrawlPage[]; // [0] is the homepage
  robotsTxt: string | null;
  sitemapXml: string | null;
  llmsTxt: string | null;
  privacyHtml: string | null;
  termsHtml: string | null;
  errors: string[];
  via: "browserless" | "fetch";
}
