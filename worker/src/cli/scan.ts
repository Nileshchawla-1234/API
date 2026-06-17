// npm run scan -- --domain=example.com
// Enqueues a scan and drains the (in-process) queue, exercising the same path
// the Railway worker uses against pgmq.
import { getQueue, getStore, processScanJob } from "@scanner/core";

try {
  process.loadEnvFile?.(".env");
} catch {}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=").replace(/^["']|["']$/g, "");
}

async function main() {
  const domain = arg("domain");
  if (!domain) {
    console.error("Usage: npm run scan -- --domain=example.com");
    process.exit(1);
  }
  const store = getStore();
  const queue = getQueue();
  await queue.enqueue({ domain, source: "public" });

  const started = Date.now();
  await queue.drain(async (job) => {
    const { slug, status } = await processScanJob(job);
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`[scan] ${job.domain} → ${status} in ${secs}s (backend: ${store.kind})`);
    if (slug) {
      const payload = await store.getReportBySlug(slug);
      console.log(`  slug: ${slug}`);
      console.log(`  composite: ${payload?.score.composite}/100  achievable: ${payload?.score.achievable}  gap: ${payload?.score.gap}  tier: ${payload?.header.tier}`);
      console.log(`  compliance risk: ${payload?.compliance.risk}  (${payload?.compliance.rows.length} flags)`);
      console.log(`  pillars: ${payload?.pillars.map((p) => `${p.key}:${p.score}(${p.rag})`).join(" ")}`);
    }
  });
}

main().catch((e) => {
  console.error("[scan] failed:", e.message);
  process.exit(1);
});
