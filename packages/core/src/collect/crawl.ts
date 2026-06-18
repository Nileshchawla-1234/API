import { normalizeDomain } from "../util/domain";
import { discoverLinks, parsePage } from "./parse";
import type { CrawlPage, CrawlResult } from "./crawl-types";

export type { CrawlPage, CrawlResult, CrawlForm } from "./crawl-types";

const UA =
  "Mozilla/5.0 (compatible; CompoundingMethodScanner/0.1; +https://thecompoundingmethod.com)";

interface FetchResult {
  status: number;
  body: string;
  finalUrl: string;
  headers: Record<string, string>;
}

async function httpGet(url: string, timeoutMs = 15000): Promise<FetchResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      redirect: "follow",
      signal: controller.signal,
    });
    const body = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k] = v));
    return { status: res.status, body, finalUrl: res.url || url, headers };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function rawGet(origin: string, path: string): Promise<string | null> {
  const r = await httpGet(new URL(path, origin).toString(), 8000);
  return r && r.status < 400 && r.body.trim() ? r.body : null;
}

/**
 * Crawl a domain into the structured CrawlResult. Uses Browserless (real browser,
 * executes JS) when a token is present; otherwise a credential-free fetch
 * fallback (no JS, so `dataLayer` is null). Never hard-fails on one bad page.
 */
export async function crawl(
  domain: string,
  opts: { browserlessToken?: string; browserlessUrl?: string; maxPages?: number } = {}
): Promise<CrawlResult> {
  const norm = normalizeDomain(domain);
  const start = `https://${norm}`;
  const errors: string[] = [];
  const maxPages = opts.maxPages ?? 8;
  const baseUrl = opts.browserlessUrl || "wss://production-sfo.browserless.io";

  if (opts.browserlessToken) {
    try {
      return await crawlBrowserless(start, norm, opts.browserlessToken, baseUrl, maxPages, errors);
    } catch (e) {
      errors.push(`browserless failed, falling back to fetch: ${(e as Error).message}`);
    }
  }
  return crawlFetch(start, norm, maxPages, errors);
}

async function crawlFetch(
  start: string,
  norm: string,
  maxPages: number,
  errors: string[]
): Promise<CrawlResult> {
  const home = await httpGet(start);
  if (!home) {
    // try http:// as a last resort
    const alt = await httpGet(`http://${norm}`);
    if (!alt) throw new Error(`could not fetch ${norm}`);
    return assemble(norm, alt, [], maxPages, errors, "fetch");
  }
  const origin = safeOrigin(home.finalUrl, start);
  const links = discoverLinks(home.body, home.finalUrl, maxPages - 1);
  const subPages: CrawlPage[] = [];
  await Promise.all(
    links.map(async (url) => {
      const r = await httpGet(url, 12000);
      if (r && r.status < 400) subPages.push(parsePage(r.body, r.finalUrl, r.status, r.headers));
      else errors.push(`page fetch failed: ${url}`);
    })
  );
  return assemble(norm, home, subPages, maxPages, errors, "fetch", origin);
}

async function crawlBrowserless(
  start: string,
  norm: string,
  token: string,
  baseUrl: string,
  maxPages: number,
  errors: string[]
): Promise<CrawlResult> {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.connectOverCDP(`${baseUrl}?token=${token}`, { timeout: 25000 });
  try {
    const ctx = await browser.newContext({
      userAgent: UA,
      viewport: { width: 390, height: 844 },
    });

    const visit = async (url: string): Promise<CrawlPage | null> => {
      const page = await ctx.newPage();
      try {
        const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
        const html = await page.content();
        const dataLayer = (await page
          .evaluate(() => (globalThis as unknown as { dataLayer?: unknown[] }).dataLayer ?? null)
          .catch(() => null)) as unknown[] | null;
        const headers = resp ? resp.headers() : {};
        return parsePage(html, page.url(), resp?.status() ?? 0, headers, dataLayer);
      } catch (e) {
        errors.push(`page failed: ${url} (${(e as Error).message})`);
        return null;
      } finally {
        await page.close().catch(() => {});
      }
    };

    const home = await visit(start);
    if (!home) throw new Error("homepage failed");
    const origin = safeOrigin(home.url, start);
    const links = discoverLinks(home.html, home.url, maxPages - 1);
    const subs = (await Promise.all(links.map(visit))).filter((p): p is CrawlPage => !!p);

    const homeFR: FetchResult = { status: home.status, body: home.html, finalUrl: home.url, headers: home.headers };
    return assemble(norm, homeFR, subs, maxPages, errors, "browserless", origin, home);
  } finally {
    await browser.close().catch(() => {});
  }
}

async function assemble(
  norm: string,
  home: FetchResult,
  subPages: CrawlPage[],
  _maxPages: number,
  errors: string[],
  via: "browserless" | "fetch",
  origin = safeOrigin(home.finalUrl, `https://${norm}`),
  homePageParsed?: CrawlPage
): Promise<CrawlResult> {
  const homePage = homePageParsed ?? parsePage(home.body, home.finalUrl, home.status, home.headers);

  const [robotsTxt, sitemapXml, llmsTxt, privacyHtml, termsHtml] = await Promise.all([
    rawGet(origin, "/robots.txt"),
    rawGet(origin, "/sitemap.xml"),
    rawGet(origin, "/llms.txt"),
    rawGet(origin, "/privacy").then((r) => r ?? rawGet(origin, "/privacy-policy")),
    rawGet(origin, "/terms").then((r) => r ?? rawGet(origin, "/terms-of-service")),
  ]);

  return {
    domain: norm,
    finalUrl: home.finalUrl,
    fetchedAt: new Date().toISOString(),
    pages: [homePage, ...subPages],
    robotsTxt,
    sitemapXml,
    llmsTxt,
    privacyHtml,
    termsHtml,
    errors,
    via,
  };
}

function safeOrigin(url: string, fallback: string): string {
  try {
    return new URL(url).origin;
  } catch {
    try {
      return new URL(fallback).origin;
    } catch {
      return fallback;
    }
  }
}
