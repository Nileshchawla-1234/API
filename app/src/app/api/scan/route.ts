import { NextResponse } from "next/server";
import { cacheDecision, getQueue, getStore, processScanJob, normalizeDomain } from "@scanner/core";

export const runtime = "nodejs";
export const maxDuration = 120;

// Naive in-memory rate limit (5/IP/hr). Replace with a durable limiter at scale.
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Rate limit: 5 scans/hour" }, { status: 429 });
  }

  let domain: string | undefined;
  try {
    domain = (await req.json())?.domain;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!domain || typeof domain !== "string") {
    return NextResponse.json({ error: "Missing 'domain'" }, { status: 400 });
  }
  const norm = normalizeDomain(domain);
  if (!norm.includes(".")) {
    return NextResponse.json({ error: "Enter a valid website URL" }, { status: 400 });
  }

  const store = getStore();

  // Cache (S17): fresh → serve instantly. (stale → serve + re-queue lands with
  // pgmq at integration; in dev we just re-scan.)
  const existing = await store.getLatestScanByDomain(norm);
  if (cacheDecision(existing, { now: Date.now() }) === "fresh" && existing?.slug) {
    return NextResponse.json({ slug: existing.slug, cached: true });
  }

  // Heavy work normally runs on the Railway worker. In dev (single process), we
  // drain the in-process queue inline using the SAME handler the worker uses —
  // so the code path is identical, only the transport differs at integration.
  const queue = getQueue();
  // Live public scans crawl fewer pages for a snappier wait; background
  // pre-scans (outreach) use the full set.
  await queue.enqueue({ domain: norm, source: "public", maxPages: 4 });
  let slug: string | undefined;
  let status = "failed";
  await queue.drain(async (job) => {
    const r = await processScanJob(job);
    slug = r.slug;
    status = r.status;
  });

  if (!slug) {
    return NextResponse.json(
      { error: `Could not scan ${norm}. The site may block automated fetches (Browserless handles these in production).`, status },
      { status: 502 }
    );
  }
  return NextResponse.json({ slug, status, cached: false });
}
