import { NextResponse } from "next/server";
import { getQueue, getStore, processScanJob, normalizeDomain } from "@scanner/core";
import { isAdmin } from "../_auth";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Admin import: upsert a list of domains as targets, then scan them. In dev this
 * drains the in-process queue inline (synchronous); in prod the Railway worker
 * drains pgmq instead. Auth-gated by ADMIN_TOKEN.
 */
export async function POST(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let domains: string[] = [];
  try {
    const body = await req.json();
    const raw: string = body?.domains ?? "";
    domains = raw.split(/[\n,]+/).map((d: string) => normalizeDomain(d)).filter((d) => d.includes("."));
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  domains = [...new Set(domains)];
  if (!domains.length) return NextResponse.json({ error: "No valid domains" }, { status: 400 });

  const store = getStore();
  await store.upsertTargets(domains.map((domain) => ({ domain })));

  const queue = getQueue();
  for (const d of domains) await queue.enqueue({ domain: d, source: "outreach", maxPages: 5 });

  const results: { domain: string; status: string; slug?: string }[] = [];
  await queue.drain(async (job) => {
    const r = await processScanJob(job);
    results.push({ domain: job.domain, status: r.status, slug: r.slug });
  });

  return NextResponse.json({ imported: domains.length, results });
}
