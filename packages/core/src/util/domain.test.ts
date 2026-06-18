import { describe, expect, it } from "vitest";
import { normalizeDomain, reportSlug } from "./domain";

describe("normalizeDomain", () => {
  it("strips scheme, www, path, query, trailing slash", () => {
    expect(normalizeDomain("https://www.Example.com/path?q=1")).toBe("example.com");
    expect(normalizeDomain("HTTP://Example.com/")).toBe("example.com");
    expect(normalizeDomain("example.com")).toBe("example.com");
  });
});

describe("reportSlug", () => {
  it("produces a url-safe slug with a short suffix", () => {
    expect(reportSlug("https://www.Radiance-MedSpa.com", "abcdef1234")).toBe("radiance-medspa-com-abcdef");
  });
});
