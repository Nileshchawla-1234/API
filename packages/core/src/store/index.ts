import { env, hasSupabaseCreds } from "../env";
import { MemoryStore } from "./memory";
import { createSupabaseStore } from "./supabase";
import type { Store } from "./types";

export type { Store, StoreKind, ScanSummary } from "./types";
export { MemoryStore } from "./memory";
export { SupabaseStore, createSupabaseStore } from "./supabase";

// Cache on globalThis so the in-memory dev store is shared across Next's
// duplicated module instances (API route + server component run in one process
// but may load the module twice). In prod the Supabase store is stateless anyway.
const g = globalThis as unknown as { __scannerStore?: Store };

/**
 * The ONLY place that decides which backend is live. In-memory dev store unless
 * BACKEND=supabase and real credentials are present — then Supabase, no code
 * change anywhere else.
 */
export function getStore(): Store {
  if (g.__scannerStore) return g.__scannerStore;
  if (env.backend === "supabase") {
    if (!hasSupabaseCreds()) {
      throw new Error("BACKEND=supabase but SUPABASE_URL / SUPABASE_SERVICE_KEY are not set.");
    }
    g.__scannerStore = createSupabaseStore(env.supabaseUrl!, env.supabaseServiceKey!);
    return g.__scannerStore;
  }
  g.__scannerStore = new MemoryStore();
  return g.__scannerStore;
}

export function __resetStore(): void {
  g.__scannerStore = undefined;
}
