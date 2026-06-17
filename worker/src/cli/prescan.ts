// npm run prescan -- --tier=A         (scan all targets of a tier)
// npm run prescan -- --domains=a.com,b.com   (dev: scan an explicit list)
import { getQueue, getStore, processScanJob } from "@scanner/core";

try {
  process.loadEnvFile?.(".env");
} catch {}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=").replace(/^["']|["']$/g, "");
}

async function main() {
  const store = getStore();
  const queue = getQueue();

  const domainsArg = arg("domains");
  const tier = arg("tier");
  let domains: string[];
  if (domainsArg) {
    domains = domainsArg.split(",").map((d) => d.trim()).filter(Boolean);
  } else {
    const targets = await store.listTargets(tier ? { tier } : undefined);
    domains = targets.map((t) => t.domain);
  }

  if (!domains.length) {
    console.log("[prescan] no targets to scan (run `discover` first, or pass --domains=...)");
    return;
  }

  console.log(`[prescan] queuing ${domains.length} domain(s)...`);
  for (const d of domains) await queue.enqueue({ domain: d, source: "outreach" });

  const scores: number[] = [];
  let complete = 0, partial = 0, failed = 0;
  await queue.drain(async (job) => {
    const { slug, status } = await processScanJob(job);
    if (status === "complete") complete++;
    else if (status === "partial") partial++;
    else failed++;
    if (slug) {
      const p = await store.getReportBySlug(slug);
      if (p) scores.push(p.score.composite);
      console.log(`  ${job.domain} → ${status}${p ? ` (${p.score.composite}/100, tier ${p.header.tier})` : ""}`);
    } else {
      console.log(`  ${job.domain} → ${status}`);
    }
  });

  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  console.log(`\n[prescan] done — complete:${complete} partial:${partial} failed:${failed} avg score:${avg}`);
}

main().catch((e) => {
  console.error("[prescan] failed:", e.message);
  process.exit(1);
});
