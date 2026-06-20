import { fileURLToPath } from "node:url";

// Load the monorepo-root .env (Next only auto-loads app/.env). In prod (Vercel)
// there's no file — env vars come from the platform — so this is best-effort.
try {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch {
  /* no root .env (e.g. production) — rely on platform env */
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Let Next transpile the workspace engine package (it ships TS source).
  transpilePackages: ["@scanner/core"],
  // Don't bundle the heavy crawler dep — it's only imported when a Browserless
  // token is set (prod). Keeps dev/serverless bundles light.
  serverExternalPackages: ["playwright-core"],
};

export default nextConfig;
// build trigger: refresh Preview env (BACKEND=supabase)
