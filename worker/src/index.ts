// Railway worker entrypoint. Continuously drains the scan queue using the same
// handler the dev CLI uses. In dev the in-process queue is per-process (empty
// here — use `npm run scan`); at integration this drains Supabase pgmq.
import { getQueue, getStore, processScanJob, env, CORE_VERSION } from "@scanner/core";

try {
  process.loadEnvFile?.(".env");
} catch {}

const POLL_MS = 3000;

async function main(): Promise<void> {
  const store = getStore();
  await store.init();
  const queue = getQueue();

  console.log(`[worker] @scanner/core v${CORE_VERSION}`);
  console.log(`[worker] backend: ${store.kind} · queue: ${queue.kind} (BACKEND=${env.backend})`);
  console.log(`[worker] consumer running — polling every ${POLL_MS}ms`);

  // Drain loop. processScanJob never throws (records failures as events), so one
  // bad domain can't take the worker down.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const n = await queue.drain(async (job) => {
      console.log(`[worker] scanning ${job.domain}...`);
      const r = await processScanJob(job);
      console.log(`[worker] ${job.domain} → ${r.status}${r.slug ? ` (${r.slug})` : ""}`);
    });
    if (n === 0) await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
