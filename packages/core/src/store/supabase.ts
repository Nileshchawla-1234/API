import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
 * Supabase backend (activated at integration via BACKEND=supabase). Writes to
 * the namespaced `scanner` schema. Service-key only — never reaches the browser.
 * Untested against live Postgres during dev by design; validated at the
 * pre-integration dry-run (slice S21).
 */
export class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  // Typed loosely: the `scanner` schema option changes the client's generic
  // params; we don't ship generated DB types, so all queries are untyped here.
  private db: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, {
      auth: { persistSession: false },
      db: { schema: "scanner" },
    }) as unknown as SupabaseClient;
  }

  async init(): Promise<void> {
    const ok = await this.healthCheck();
    if (!ok) throw new Error("Supabase health check failed (is the scanner schema migrated?)");
  }

  async healthCheck(): Promise<boolean> {
    const { error } = await this.db.from("scans").select("id").limit(1);
    return !error;
  }

  async upsertTargets(rows: TargetInput[]): Promise<number> {
    const payload = rows
      .map((r) => ({ ...r, domain: normalizeDomain(r.domain) }))
      .filter((r) => r.domain);
    if (!payload.length) return 0;
    const { error } = await this.db.from("targets").upsert(payload, { onConflict: "domain" });
    if (error) throw new Error(`upsertTargets: ${error.message}`);
    return payload.length;
  }

  async listTargets(filter?: { tier?: string; status?: string }): Promise<Target[]> {
    let q = this.db.from("targets").select("*");
    if (filter?.tier) q = q.eq("tier", filter.tier);
    if (filter?.status) q = q.eq("outreach_status", filter.status);
    const { data, error } = await q;
    if (error) throw new Error(`listTargets: ${error.message}`);
    return (data ?? []) as Target[];
  }

  async saveScanResult(result: ScanRecord): Promise<{ scanId: string; slug: string }> {
    const domain = normalizeDomain(result.domain);
    const { data: scan, error: scanErr } = await this.db
      .from("scans")
      .insert({
        domain,
        vertical: result.vertical,
        business_type: result.business_type,
        geo: result.geo,
        status: result.status,
        source: result.source,
        composite_score: result.scores.composite,
        achievable_score: result.scores.achievable,
        gap: result.scores.gap,
        compliance_surface: result.compliance_surface,
        compliance_risk_score: result.scores.compliance_risk_score,
        last_scanned_at: result.completed_at,
        completed_at: result.completed_at,
      })
      .select("id")
      .single();
    if (scanErr || !scan) throw new Error(`saveScanResult/scans: ${scanErr?.message}`);
    const scanId = scan.id as string;

    const ss = result.site_signals;
    const { error: sigErr } = await this.db.from("site_signals").insert({ scan_id: scanId, ...ss });
    if (sigErr) throw new Error(`saveScanResult/site_signals: ${sigErr.message}`);

    const { error: pErr } = await this.db.from("pillar_results").insert(
      result.pillars.map((p) => ({ scan_id: scanId, ...p }))
    );
    if (pErr) throw new Error(`saveScanResult/pillar_results: ${pErr.message}`);

    const { error: rErr } = await this.db.from("reports").insert({
      scan_id: scanId,
      slug: result.report.slug,
      model: result.report.model,
      prompt_version: result.report.prompt_version,
      client_payload: result.report.client_payload,
      internal_payload: result.report.internal_payload,
      cost_usd: result.report.cost_usd,
      tokens_in: result.report.tokens_in,
      tokens_out: result.report.tokens_out,
    });
    if (rErr) throw new Error(`saveScanResult/reports: ${rErr.message}`);

    return { scanId, slug: result.report.slug };
  }

  async recordEvent(scanId: string, type: ScanEventType, meta?: Record<string, unknown>): Promise<void> {
    await this.db.from("scan_events").insert({ scan_id: scanId, event_type: type, meta });
  }

  async getReportBySlug(slug: string): Promise<ClientPayload | null> {
    // Reads via the table with the service key (server-side). The public/anon
    // path uses the get_report(slug) RPC instead.
    const { data, error } = await this.db.from("reports").select("client_payload").eq("slug", slug).maybeSingle();
    if (error) throw new Error(`getReportBySlug: ${error.message}`);
    return (data?.client_payload as ClientPayload) ?? null;
  }

  async getLatestScanByDomain(domain: string): Promise<ScanSummary | null> {
    const { data, error } = await this.db
      .from("scans")
      .select("id, domain, status, composite_score, completed_at, reports(slug)")
      .eq("domain", normalizeDomain(domain))
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`getLatestScanByDomain: ${error.message}`);
    if (!data) return null;
    const reports = data.reports as unknown as { slug: string }[] | { slug: string } | null;
    const slug = Array.isArray(reports) ? reports[0]?.slug ?? null : reports?.slug ?? null;
    return {
      scanId: data.id as string,
      domain: data.domain as string,
      slug,
      status: data.status as string,
      composite: (data.composite_score as number) ?? null,
      completedAt: (data.completed_at as string) ?? null,
    };
  }

  async listRecentScans(limit = 100): Promise<ScanSummary[]> {
    const { data, error } = await this.db
      .from("scans")
      .select("id, domain, status, composite_score, completed_at, reports(slug)")
      .order("completed_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`listRecentScans: ${error.message}`);
    return (data ?? []).map((d) => {
      const reports = d.reports as unknown as { slug: string }[] | { slug: string } | null;
      const slug = Array.isArray(reports) ? reports[0]?.slug ?? null : reports?.slug ?? null;
      return {
        scanId: d.id as string,
        domain: d.domain as string,
        slug,
        status: d.status as string,
        composite: (d.composite_score as number) ?? null,
        completedAt: (d.completed_at as string) ?? null,
      };
    });
  }

  async saveLead(lead: LeadInput): Promise<void> {
    const { error } = await this.db.from("leads").insert(lead);
    if (error) throw new Error(`saveLead: ${error.message}`);
  }
}

export function createSupabaseStore(url: string, serviceKey: string): Store {
  return new SupabaseStore(url, serviceKey);
}
