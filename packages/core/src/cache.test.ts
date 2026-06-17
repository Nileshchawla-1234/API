import { describe, expect, it } from "vitest";
import { cacheDecision } from "./cache";
import type { ScanSummary } from "./store/types";

const NOW = new Date("2026-06-15T00:00:00Z").getTime();
const summary = (completedAt: string | null, slug: string | null = "s-abc"): ScanSummary => ({
  scanId: "id", domain: "spa.com", slug, status: "complete", composite: 50, completedAt,
});

describe("cacheDecision", () => {
  it("miss when no summary / no slug / no completion", () => {
    expect(cacheDecision(null, { now: NOW })).toBe("miss");
    expect(cacheDecision(summary("2026-06-14T00:00:00Z", null), { now: NOW })).toBe("miss");
    expect(cacheDecision(summary(null), { now: NOW })).toBe("miss");
  });
  it("fresh within maxAge, stale beyond it", () => {
    expect(cacheDecision(summary("2026-06-10T00:00:00Z"), { now: NOW, maxAgeDays: 30 })).toBe("fresh");
    expect(cacheDecision(summary("2026-04-01T00:00:00Z"), { now: NOW, maxAgeDays: 30 })).toBe("stale");
  });
});
