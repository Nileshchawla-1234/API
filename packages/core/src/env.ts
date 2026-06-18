// Centralized env access. Uses getters so process.env is read on ACCESS, not at
// import time — this way CLIs that call process.loadEnvFile(".env") after
// importing the engine still get the values. The `backend` switch is what makes
// the build run credential-free in dev and flip to Supabase at integration.

export type Backend = "memory" | "supabase";

export const env = {
  get backend(): Backend {
    return (process.env.BACKEND as Backend) || "memory";
  },
  get supabaseUrl(): string | undefined {
    return process.env.SUPABASE_URL;
  },
  get supabaseServiceKey(): string | undefined {
    return process.env.SUPABASE_SERVICE_KEY;
  },
  get browserlessToken(): string | undefined {
    return process.env.BROWSERLESS_TOKEN;
  },
  get browserlessUrl(): string {
    return process.env.BROWSERLESS_URL || "wss://production-sfo.browserless.io";
  },
  get googleApiKey(): string | undefined {
    return process.env.GOOGLE_API_KEY;
  },
  get spyfuApiKey(): string | undefined {
    return process.env.SPYFU_API_KEY;
  },
  get anthropicApiKey(): string | undefined {
    return process.env.ANTHROPIC_API_KEY;
  },
  get calcomWebhookSecret(): string | undefined {
    return process.env.CALCOM_WEBHOOK_SECRET;
  },
  get appBaseUrl(): string {
    return process.env.APP_BASE_URL || "http://localhost:3000";
  },
  get adminToken(): string | undefined {
    return process.env.ADMIN_TOKEN;
  },
};

/** True only when real Supabase credentials are present. */
export function hasSupabaseCreds(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceKey);
}
