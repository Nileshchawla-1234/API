import { createHmac, timingSafeEqual } from "node:crypto";
import type { LeadInput } from "./types";

// Cal.com booking webhook (spec §9). Verify the HMAC-SHA256 signature over the
// raw body, then map booking.created → a lead row.

export function verifyCalcomSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface CalcomPayload {
  triggerEvent?: string;
  payload?: {
    attendees?: { email?: string; name?: string; phoneNumber?: string }[];
    responses?: { phone?: { value?: string }; email?: { value?: string } };
    uid?: string;
    metadata?: Record<string, unknown>;
  };
}

/** Map a Cal.com booking.created payload to a LeadInput. Returns null if no email. */
export function mapBookingToLead(body: CalcomPayload, scanId: string | null): LeadInput | null {
  const a = body.payload?.attendees?.[0];
  const email = a?.email || body.payload?.responses?.email?.value;
  if (!email) return null;
  const phone = a?.phoneNumber || body.payload?.responses?.phone?.value || null;
  return {
    scan_id: scanId,
    email,
    phone,
    consent_email: true,
    booking_status: "booked",
    utm: (body.payload?.metadata as Record<string, unknown>) ?? undefined,
  };
}
