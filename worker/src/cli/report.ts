// npm run report -- --domain=example.com --version=A|B
// Scans the domain (if needed), renders the report to PDF (or HTML if no
// Chromium), and writes it to output/reports/.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getQueue, getStore, processScanJob, generateReportPdf, normalizeDomain } from "@scanner/core";
import type { ReportVersion } from "@scanner/core";

try {
  process.loadEnvFile?.(".env");
} catch {}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=").replace(/^["']|["']$/g, "");
}

async function main() {
  const domain = arg("domain");
  const version = (arg("version") || "A").toUpperCase() as ReportVersion;
  if (!domain) {
    console.error("Usage: npm run report -- --domain=example.com --version=A|B");
    process.exit(1);
  }
  const norm = normalizeDomain(domain);
  const store = getStore();

  // Reuse a stored scan if present (same process), else run one.
  let summary = await store.getLatestScanByDomain(norm);
  if (!summary?.slug) {
    const q = getQueue();
    await q.enqueue({ domain: norm, source: "public" });
    await q.drain(async (job) => { await processScanJob(job); });
    summary = await store.getLatestScanByDomain(norm);
  }
  if (!summary?.slug) {
    console.error(`Could not scan ${norm}`);
    process.exit(1);
  }

  const payload = await store.getReportBySlug(summary.slug);
  if (!payload) {
    console.error("No report payload found");
    process.exit(1);
  }

  const out = await generateReportPdf(payload, version);
  const dir = join(process.cwd(), "output", "reports");
  mkdirSync(dir, { recursive: true });
  const ext = out.rendered === "pdf" ? "pdf" : "html";
  const file = join(dir, `${norm}-behind-score-${version}.${ext}`);
  writeFileSync(file, out.pdf ?? out.html);
  console.log(`[report] wrote ${file} (${out.rendered})`);
  if (out.rendered === "html") {
    console.log("[report] note: no local Chromium — wrote HTML. PDF renders in prod (Browserless/Chromium).");
  }
}

main().catch((e) => {
  console.error("[report] failed:", e.message);
  process.exit(1);
});
