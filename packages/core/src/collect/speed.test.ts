import { describe, expect, it } from "vitest";
import { getSpeed } from "./speed";

describe("getSpeed (credential-free)", () => {
  it("returns available:false with a note when no API key", async () => {
    const r = await getSpeed("https://example.com");
    expect(r.available).toBe(false);
    expect(r.cwv).toBeNull();
    expect(r.note).toMatch(/skipped/i);
  });
});
