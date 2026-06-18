import { describe, expect, it } from "vitest";
import { placesToTargets } from "./places";
import { discoverMedSpas } from "./places";

describe("placesToTargets", () => {
  it("maps website/phone/name and dedupes by normalized domain", () => {
    const out = placesToTargets([
      { displayName: { text: "Radiance Med Spa" }, websiteUri: "https://www.radiance.com/", nationalPhoneNumber: "(480) 555-0100", id: "p1" },
      { displayName: { text: "Radiance (dupe)" }, websiteUri: "http://radiance.com", id: "p2" },
      { displayName: { text: "No Site Spa" } }, // skipped — no website
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.domain).toBe("radiance.com");
    expect(out[0]!.business_name).toBe("Radiance Med Spa");
  });
});

describe("discoverMedSpas (credential-free)", () => {
  it("returns empty with a note when no API key", async () => {
    const r = await discoverMedSpas("Scottsdale, AZ");
    expect(r.targets).toEqual([]);
    expect(r.note).toMatch(/skipped/i);
  });
});
