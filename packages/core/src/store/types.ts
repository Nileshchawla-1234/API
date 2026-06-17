import type {
  ClientPayload,
  LeadInput,
  ScanEventType,
  ScanRecord,
  Target,
  TargetInput,
} from "../types";

export type StoreKind = "memory" | "supabase";

/** Summary row used by cache (S17) and admin/prescan. */
export interface ScanSummary {
  scanId: string;
  domain: string;
  slug: string | null;
  status: string;
  composite: number | null;
  completedAt: string | null;
}

/**
 * The persistence seam. Implemented by the in-memory dev store and (at
 * integration) Supabase. The engine and API only ever touch this interface.
 */
export interface Store {
  readonly kind: StoreKind;
  init(): Promise<void>;
  healthCheck(): Promise<boolean>;

  // discovery (S3) / prescan (S12)
  upsertTargets(rows: TargetInput[]): Promise<number>;
  listTargets(filter?: { tier?: string; status?: string }): Promise<Target[]>;

  // scan persistence (S10)
  saveScanResult(result: ScanRecord): Promise<{ scanId: string; slug: string }>;
  recordEvent(scanId: string, type: ScanEventType, meta?: Record<string, unknown>): Promise<void>;

  // reads
  getReportBySlug(slug: string): Promise<ClientPayload | null>;
  getLatestScanByDomain(domain: string): Promise<ScanSummary | null>;
  listRecentScans(limit?: number): Promise<ScanSummary[]>;

  // booking (S18)
  saveLead(lead: LeadInput): Promise<void>;
}
