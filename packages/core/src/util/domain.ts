/** Lowercase, strip scheme/www/trailing slash/query. Used by discovery + cache. */
export function normalizeDomain(url: string): string {
  let d = url.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/^www\./, "");
  d = d.split("/")[0] ?? d; // drop path
  d = d.split("?")[0] ?? d; // drop query
  d = d.split("#")[0] ?? d;
  return d.replace(/\/+$/, "").trim();
}

/** A url-safe slug for a report, derived from domain + a short random suffix. */
export function reportSlug(domain: string, rand: string): string {
  const base = normalizeDomain(domain).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${base}-${rand.slice(0, 6)}`;
}
