import { normalizeDomain } from "../util/domain";
import type {
  ClientPayload,
  LeadInput,
  ScanEventType,
  ScanRecord,
  Target,
  TargetInput,
} from "../types";
import type { ScanSummary, Store } from "./types";

/**
 * In-memory dev backend — the credential-free stand-in. Mirrors the Supabase
 * behaviour closely enough to run + test the whole pipeline. State is per-process.
 */
export class MemoryStore implements Store {
  readonly kind = "memory" as const;

  private targets = new Map<string, Target>();
  private scans = new Map<string, ScanRecord & { scanId: string }>();
  private reportsBySlug = new Map<string, ClientPayload>();
  private latestByDomain = new Map<string, ScanSummary>();
  private recent: ScanSummary[] = [];
  private leads: LeadInput[] = [];
  private events: { scanId: string; type: ScanEventType; ts: string; meta?: unknown }[] = [];

  async init(): Promise<void> {}
  async healthCheck(): Promise<boolean> {
    return true;
  }

  async upsertTargets(rows: TargetInput[]): Promise<number> {
    let n = 0;
    for (const r of rows) {
      const domain = normalizeDomain(r.domain);
      if (!domain) continue;
      const existing = this.targets.get(domain);
      this.targets.set(domain, {
        id: existing?.id ?? crypto.randomUUID(),
        tier: existing?.tier ?? null,
        outreach_status: existing?.outreach_status ?? "new",
        ...r,
        domain,
      });
      n++;
    }
    return n;
  }

  async listTargets(filter?: { tier?: string; status?: string }): Promise<Target[]> {
    let out = [...this.targets.values()];
    if (filter?.tier) out = out.filter((t) => t.tier === filter.tier);
    if (filter?.status) out = out.filter((t) => t.outreach_status === filter.status);
    return out;
  }

  async saveScanResult(result: ScanRecord): Promise<{ scanId: string; slug: string }> {
    const scanId = crypto.randomUUID();
    const domain = normalizeDomain(result.domain);
    this.scans.set(scanId, { ...result, scanId });
    this.reportsBySlug.set(result.report.slug, result.report.client_payload);
    const summary: ScanSummary = {
      scanId,
      domain,
      slug: result.report.slug,
      status: result.status,
      composite: result.scores.composite,
      completedAt: result.completed_at,
    };
    this.latestByDomain.set(domain, summary);
    this.recent.unshift(summary);
    return { scanId, slug: result.report.slug };
  }

  async recordEvent(scanId: string, type: ScanEventType, meta?: Record<string, unknown>): Promise<void> {
    this.events.push({ scanId, type, ts: new Date().toISOString(), meta });
  }

  async getReportBySlug(slug: string): Promise<ClientPayload | null> {
    return this.reportsBySlug.get(slug) ?? null;
  }

  async getLatestScanByDomain(domain: string): Promise<ScanSummary | null> {
    return this.latestByDomain.get(normalizeDomain(domain)) ?? null;
  }

  async listRecentScans(limit = 100): Promise<ScanSummary[]> {
    return this.recent.slice(0, limit);
  }

  async saveLead(lead: LeadInput): Promise<void> {
    this.leads.push(lead);
    console.log(`[lead · memory] ${lead.email} (scan ${lead.scan_id ?? "n/a"})`);
  }
}
