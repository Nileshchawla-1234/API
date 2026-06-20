import type { CrawlResult } from "./crawl-types";

// Pull the business name + location from the site's own JSON-LD (a LocalBusiness/
// Organization with a PostalAddress). Honest + sourced — only what the site
// publishes. Returns undefined fields when nothing is found; we never guess a
// location. Most med spas publish a LocalBusiness address; generic sites may not.

const BIZ_TYPE =
  /(LocalBusiness|MedicalBusiness|HealthAndBeauty|DaySpa|BeautySalon|Dentist|Physician|Clinic|MedicalClinic|MedicalOrganization|Organization|Corporation)/i;

function typeStr(t: unknown): string {
  return Array.isArray(t) ? t.join(" ") : typeof t === "string" ? t : "";
}

export function extractOrg(crawl: CrawlResult): { name?: string; location?: string } {
  let name: string | undefined;
  let location: string | undefined;

  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const o = node as Record<string, unknown>;

    // location ← a PostalAddress (directly, or via .address)
    if (!location) {
      const a =
        o["@type"] === "PostalAddress"
          ? o
          : o.address && typeof o.address === "object" && !Array.isArray(o.address)
            ? (o.address as Record<string, unknown>)
            : undefined;
      if (a) {
        const city = typeof a.addressLocality === "string" ? a.addressLocality : undefined;
        const region = typeof a.addressRegion === "string" ? a.addressRegion : undefined;
        const country =
          typeof a.addressCountry === "string"
            ? a.addressCountry
            : a.addressCountry && typeof a.addressCountry === "object"
              ? ((a.addressCountry as Record<string, unknown>).name as string | undefined)
              : undefined;
        const parts = [city, region || country].filter((x): x is string => Boolean(x));
        if (parts.length) location = parts.join(", ");
      }
    }

    // name ← a business-type node
    if (!name && typeof o.name === "string" && o.name.trim() && BIZ_TYPE.test(typeStr(o["@type"]))) {
      name = o.name.trim();
    }

    Object.values(o).forEach(visit);
  };

  for (const page of crawl.pages) for (const block of page.jsonLd) visit(block);
  return { name, location };
}
