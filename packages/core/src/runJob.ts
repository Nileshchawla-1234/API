import { env } from "./env";
import { scanDomain } from "./scan";
import { getStore } from "./store";
import type { ScanJob } from "./queue/index";

/**
 * Process one scan job: run the pipeline, persist, emit events. Used by both the
 * dev CLI (in-proc queue) and the Railway worker (pgmq). Never throws — failures
 * are recorded as events so one bad domain can't take down the worker.
 */
export async function processScanJob(job: ScanJob): Promise<{ slug?: string; status: string }> {
  const store = getStore();
  try {
    const record = await scanDomain(job.domain, {
      browserlessToken: env.browserlessToken,
      browserlessUrl: env.browserlessUrl,
      googleApiKey: env.googleApiKey,
      spyfuApiKey: env.spyfuApiKey,
      anthropicApiKey: env.anthropicApiKey,
      source: job.source,
      maxPages: job.maxPages,
    });
    const { scanId, slug } = await store.saveScanResult(record);
    await store.recordEvent(scanId, "completed", { slug });
    return { slug, status: record.status };
  } catch (err) {
    console.error(`[scan] ${job.domain} failed:`, (err as Error).message);
    return { status: "failed" };
  }
}
