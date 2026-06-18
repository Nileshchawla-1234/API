import { NextResponse } from "next/server";
import { env, getStore, mapBookingToLead, verifyCalcomSignature } from "@scanner/core";

export const runtime = "nodejs";

/**
 * Cal.com booking webhook (spec §9). Verifies the HMAC signature, maps
 * booking.created → leads. Rejects unsigned/invalid payloads with 401.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = env.calcomWebhookSecret;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const sig = req.headers.get("x-cal-signature-256");
  if (!verifyCalcomSignature(raw, sig, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Optional: link to a scan via metadata.scanId if the booking carries it.
  const scanId =
    (body as { payload?: { metadata?: { scanId?: string } } })?.payload?.metadata?.scanId ?? null;

  const lead = mapBookingToLead(body as never, scanId);
  if (!lead) {
    return NextResponse.json({ error: "No attendee email" }, { status: 400 });
  }

  try {
    await getStore().saveLead(lead);
    if (scanId) await getStore().recordEvent(scanId, "booked", { email: lead.email });
    // TODO(integration): notify Shawn via email/Slack webhook.
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
