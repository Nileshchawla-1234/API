import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { mapBookingToLead, verifyCalcomSignature } from "./booking";

describe("verifyCalcomSignature", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ triggerEvent: "BOOKING_CREATED" });
  const sig = createHmac("sha256", secret).update(body).digest("hex");

  it("accepts a correctly signed payload", () => {
    expect(verifyCalcomSignature(body, sig, secret)).toBe(true);
  });
  it("rejects a bad / missing signature", () => {
    expect(verifyCalcomSignature(body, "deadbeef", secret)).toBe(false);
    expect(verifyCalcomSignature(body, null, secret)).toBe(false);
  });
});

describe("mapBookingToLead", () => {
  it("maps attendee email + phone to a lead", () => {
    const lead = mapBookingToLead({ payload: { attendees: [{ email: "ceo@spa.com", phoneNumber: "+14805550100" }] } }, "scan-1");
    expect(lead?.email).toBe("ceo@spa.com");
    expect(lead?.phone).toBe("+14805550100");
    expect(lead?.booking_status).toBe("booked");
  });
  it("returns null when there is no email", () => {
    expect(mapBookingToLead({ payload: { attendees: [{}] } }, null)).toBeNull();
  });
});
