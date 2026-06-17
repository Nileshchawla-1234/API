import type { ScanSource } from "../types";

// Queue seam. In-process for dev (per-process), pgmq at integration (spec §10).
// The handler is identical regardless of transport.

export interface ScanJob {
  domain: string;
  source?: ScanSource;
  priority?: number;
  maxPages?: number;
}

export interface Queue {
  readonly kind: "inproc" | "pgmq";
  enqueue(job: ScanJob): Promise<void>;
  /** Drain all currently-queued jobs through the handler, then return. */
  drain(handler: (job: ScanJob) => Promise<void>): Promise<number>;
}

class InProcQueue implements Queue {
  readonly kind = "inproc" as const;
  private jobs: ScanJob[] = [];
  async enqueue(job: ScanJob): Promise<void> {
    this.jobs.push(job);
  }
  async drain(handler: (job: ScanJob) => Promise<void>): Promise<number> {
    let n = 0;
    while (this.jobs.length) {
      const job = this.jobs.shift()!;
      await handler(job);
      n++;
    }
    return n;
  }
}

let cached: Queue | null = null;

/** In-process queue for dev. pgmq lands at integration (S10 prod path). */
export function getQueue(): Queue {
  if (!cached) cached = new InProcQueue();
  return cached;
}

export function __resetQueue(): void {
  cached = null;
}
