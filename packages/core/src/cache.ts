import type { ScanSummary } from "./store/types";

// Report cache policy (spec §10): fresh → serve instantly · stale → serve +
// re-queue (stale-while-revalidate) · miss → live-scan. Pure + unit-tested.

export type CacheDecision = "fresh" | "stale" | "miss";

export function cacheDecision(
  summary: ScanSummary | null,
  opts: { now: number; maxAgeDays?: number } = { now: Date.now() }
): CacheDecision {
  if (!summary || !summary.slug || !summary.completedAt) return "miss";
  const maxAgeMs = (opts.maxAgeDays ?? 30) * 24 * 60 * 60 * 1000;
  const age = opts.now - new Date(summary.completedAt).getTime();
  return age <= maxAgeMs ? "fresh" : "stale";
}
