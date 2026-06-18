import { normalizeDomain } from "../util/domain";
import type { SpyfuEnrichment } from "../types";

// SpyFu enrichment (spec §4d). Client has the plan. EVERY figure is "estimated"
// and rendered with a SpyFu source chip. On any error/empty (common for small
// local spas) → coverage:"none", and the scan still completes. Cached ~24h.

const cache = new Map<string, { at: number; value: SpyfuEnrichment }>();
const TTL_MS = 24 * 60 * 60 * 1000;

const NONE: SpyfuEnrichment = { coverage: "none" };

async function getJson(url: string, headers: Record<string, string>): Promise<any | null> {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Best-effort SpyFu enrichment. Returns coverage:"none" when no key, on error,
 * or when SpyFu has no data for the domain. Never throws.
 */
export async function enrichSpyFu(domain: string, apiKey?: string): Promise<SpyfuEnrichment> {
  const norm = normalizeDomain(domain);
  if (!apiKey) return NONE;

  const hit = cache.get(norm);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  // SpyFu API v2 (key as query param). Field names per developer.spyfu.com;
  // guarded so unexpected shapes degrade to coverage:"none".
  const auth = { Authorization: `Basic ${apiKey}` };
  const stats = await getJson(
    `https://www.spyfu.com/apis/domain_stats_api/v2/getLatestDomainStats?domain=${encodeURIComponent(norm)}&countryCode=US`,
    auth
  );

  const row = stats?.results?.[0] ?? stats?.[0] ?? stats;
  if (!row || typeof row !== "object") {
    cache.set(norm, { at: Date.now(), value: NONE });
    return NONE;
  }

  const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
  const paidKw = num(row.totalAdsPurchased) ?? num(row.totalPaidResults);
  const orgKw = num(row.totalOrganicResults);
  const budget = num(row.monthlyBudget) ?? num(row.searchMonthlyPaidClicks);

  const value: SpyfuEnrichment = {
    coverage: paidKw || orgKw || budget ? "partial" : "none",
    paid:
      paidKw || budget
        ? {
            monthly_budget_est: budget ?? 0,
            paid_keywords: paidKw ?? 0,
            paid_clicks_est: num(row.searchMonthlyPaidClicks) ?? 0,
          }
        : undefined,
    organic:
      orgKw !== undefined
        ? {
            organic_keywords: orgKw,
            organic_clicks_est: num(row.searchMonthlyOrganicClicks) ?? 0,
            rank_strength: num(row.strength) ?? 0,
          }
        : undefined,
    fetched_at: new Date().toISOString(),
  };

  cache.set(norm, { at: Date.now(), value });
  return value;
}
