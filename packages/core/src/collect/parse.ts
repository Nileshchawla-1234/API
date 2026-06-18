import * as cheerio from "cheerio";
import type { CrawlForm, CrawlPage } from "./crawl-types";

/**
 * Pure: turn a page's HTML (+ url/status/headers) into the structured CrawlPage
 * the detectors consume. No network. `dataLayer` is passed in (only the
 * Browserless path can read it); the fetch fallback passes null.
 */
export function parsePage(
  html: string,
  url: string,
  status: number,
  headers: Record<string, string> = {},
  dataLayer: unknown[] | null = null
): CrawlPage {
  const $ = cheerio.load(html);

  const scripts: string[] = [];
  const inlineScripts: string[] = [];
  $("script").each((_, el) => {
    const src = $(el).attr("src");
    if (src) scripts.push(src);
    else {
      const t = $(el).contents().text();
      if (t.trim()) inlineScripts.push(t);
    }
  });

  const meta: Record<string, string> = {};
  $("meta").each((_, el) => {
    const key = $(el).attr("name") || $(el).attr("property");
    const content = $(el).attr("content");
    if (key && content) meta[key.toLowerCase()] = content;
  });

  const jsonLd: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw.trim()) return;
    try {
      jsonLd.push(JSON.parse(raw));
    } catch {
      /* malformed JSON-LD — skip */
    }
  });

  const h1 = textsOf($, "h1");
  const h2 = textsOf($, "h2");

  const forms: CrawlForm[] = [];
  $("form").each((_, el) => {
    const inputs: CrawlForm["inputs"] = [];
    $(el)
      .find("input, select, textarea")
      .each((__, i) => {
        inputs.push({ name: $(i).attr("name") ?? null, type: $(i).attr("type") ?? null });
      });
    forms.push({ action: $(el).attr("action") ?? null, inputs });
  });

  const telLinks: string[] = [];
  $('a[href^="tel:"]').each((_, el) => {
    const v = ($(el).attr("href") || "").replace(/^tel:/, "").trim();
    if (v) telLinks.push(v);
  });

  // Mixed content: http:// subresources on an https page.
  const mixedContent: string[] = [];
  if (url.startsWith("https://")) {
    $("[src], [href]").each((_, el) => {
      const v = $(el).attr("src") || $(el).attr("href") || "";
      if (/^http:\/\//i.test(v)) mixedContent.push(v);
    });
  }

  return {
    url,
    status,
    html,
    scripts,
    inlineScripts,
    dataLayer,
    meta,
    jsonLd,
    h1,
    h2,
    forms,
    telLinks,
    headers,
    mixedContent: [...new Set(mixedContent)].slice(0, 20),
  };
}

function textsOf($: cheerio.CheerioAPI, sel: string): string[] {
  const out: string[] = [];
  $(sel).each((_, el) => {
    const t = $(el).text().trim();
    if (t) out.push(t);
  });
  return out;
}

/** Same-origin links matching the med-spa page set (spec §4a). */
const PAGE_MATCH = /\/(services|treatments?|botox|filler|laser|coolsculpting|consultation|contact|about|book|appointment)/i;

export function discoverLinks(html: string, finalUrl: string, cap = 8): string[] {
  const $ = cheerio.load(html);
  let origin: string;
  try {
    origin = new URL(finalUrl).origin;
  } catch {
    return [];
  }
  const out = new Set<string>();
  $("a[href]").each((_, el) => {
    if (out.size >= cap) return;
    const href = $(el).attr("href") || "";
    try {
      const abs = new URL(href, finalUrl);
      if (abs.origin === origin && PAGE_MATCH.test(abs.pathname)) {
        out.add(abs.toString().split("#")[0]!);
      }
    } catch {
      /* ignore */
    }
  });
  return [...out].slice(0, cap);
}
